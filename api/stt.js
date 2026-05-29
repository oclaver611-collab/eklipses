// api/stt.js — Deepgram Nova-3 STT proxy
// Browser sends raw audio chunks via POST, gets transcript back instantly
// Keeps DEEPGRAM_API_KEY server-side — never exposed to client
//
// POST /api/stt
//   Body: raw audio bytes (webm/opus or ogg/opus)
//   Headers: Content-Type: audio/webm or audio/ogg
//   Returns: { transcript: "...", is_final: true/false }

const { checkRateLimit } = require('./ratelimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  if (!process.env.DEEPGRAM_API_KEY) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not set' });
  }

  // Read raw audio body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const audioBuffer = Buffer.concat(chunks);

  if (audioBuffer.length < 100) {
    return res.json({ transcript: '', is_final: false });
  }

  const contentType = req.headers['content-type'] || 'audio/webm';

  try {
    // Deepgram Nova-3 pre-recorded endpoint (low latency, ~200ms)
    // Using pre-recorded (not streaming) because Vercel doesn't support WebSockets
    // But we call it with small chunks so effective latency is 200-400ms per chunk
    const dgRes = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&language=en&smart_format=false&punctuate=true&interim_results=false',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      }
    );

    if (!dgRes.ok) {
      const err = await dgRes.text();
      return res.status(500).json({ error: 'Deepgram error: ' + err });
    }

    const data = await dgRes.json();
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = data?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    return res.json({
      transcript: transcript.trim(),
      confidence,
      is_final: true,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
