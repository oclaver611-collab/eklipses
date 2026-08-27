// api/stt.js — Speech-to-text via OpenAI Whisper
// Accepts multipart/form-data with a single `audio` field (webm/ogg/mp4/m4a blob).
// Returns { transcript: string } or { error: string }.
// Used by player.js on iOS Safari and any browser lacking Web Speech API.
// Cost: ~$0.006/min of audio — negligible at MVP scale.

const { checkRateLimit } = require('./ratelimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OpenAI API key not configured' });

  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  // Parse the raw multipart body manually — Vercel doesn't auto-parse multipart.
  // We use a minimal boundary parser rather than a full library to keep dependencies lean.
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) return res.status(400).json({ error: 'Expected multipart/form-data' });

  const boundary = boundaryMatch[1];

  // Collect raw body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);

  // Extract the audio file part
  const audioBuffer = extractFirstFilePart(raw, boundary);
  if (!audioBuffer) return res.status(400).json({ error: 'No audio field found in request' });

  // Detect MIME type from the Content-Type of the part (default to webm)
  const partHeader = extractPartHeader(raw, boundary);
  const mimeMatch = partHeader.match(/Content-Type:\s*([^\r\n]+)/i);
  const mime = mimeMatch ? mimeMatch[1].trim() : 'audio/webm';
  const ext = mimeToExt(mime);

  // Build a FormData-like multipart body for the Whisper API call
  const whisperBoundary = '----WhisperBoundary' + Date.now();
  const bodyParts = [
    `--${whisperBoundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n`,
    `Content-Type: ${mime}\r\n\r\n`,
  ];
  const bodyHeader = Buffer.from(bodyParts.join(''));
  const bodyFooter = Buffer.from(`\r\n--${whisperBoundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n` +
    `--${whisperBoundary}--\r\n`);
  const body = Buffer.concat([bodyHeader, audioBuffer, bodyFooter]);

  try {
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': `multipart/form-data; boundary=${whisperBoundary}`,
      },
      body,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('[stt] Whisper error', whisperRes.status, errText.slice(0, 200));
      return res.status(502).json({ error: 'Whisper API error: ' + whisperRes.status });
    }

    const data = await whisperRes.json();
    const transcript = (data.text || '').trim();
    console.log('[stt] transcript:', transcript.slice(0, 120));
    return res.json({ transcript });
  } catch (err) {
    console.error('[stt] fetch error:', err.message);
    return res.status(500).json({ error: 'STT request failed: ' + err.message });
  }
};

// ── Multipart helpers ──────────────────────────────────────────────────────────

function mimeToExt(mime) {
  const map = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
  };
  return map[mime.split(';')[0].trim()] || 'webm';
}

function extractPartHeader(raw, boundary) {
  const delim = Buffer.from(`--${boundary}\r\n`);
  const start = raw.indexOf(delim);
  if (start === -1) return '';
  const headerStart = start + delim.length;
  const headerEnd = raw.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd === -1) return '';
  return raw.slice(headerStart, headerEnd).toString('utf8');
}

function extractFirstFilePart(raw, boundary) {
  const delim = Buffer.from(`--${boundary}\r\n`);
  const end = Buffer.from(`\r\n--${boundary}`);
  const headerSep = Buffer.from('\r\n\r\n');

  let pos = 0;
  while (pos < raw.length) {
    const partStart = raw.indexOf(delim, pos);
    if (partStart === -1) break;
    const headerStart = partStart + delim.length;
    const headerEnd = raw.indexOf(headerSep, headerStart);
    if (headerEnd === -1) break;

    const header = raw.slice(headerStart, headerEnd).toString('utf8');
    const bodyStart = headerEnd + headerSep.length;
    const bodyEnd = raw.indexOf(end, bodyStart);
    if (bodyEnd === -1) break;

    if (header.includes('filename=')) {
      return raw.slice(bodyStart, bodyEnd);
    }
    pos = bodyEnd + end.length;
  }
  return null;
}
