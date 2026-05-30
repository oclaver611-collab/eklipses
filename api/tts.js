// api/tts.js — ElevenLabs TTS (primary, no OpenAI fallback)
// Model: eleven_flash_v2_5
// Voices: Bella / Sarah / Laura (confirmed account default voices)
const { checkRateLimit } = require('./ratelimit');

// ── Per-character voice mapping ───────────────────────────────────────────────
// Bella  EXAVITQu4vr4xnSDxMaL — soft, natural
// Sarah  pMsXgVXv3BLzUkzvXi1f — warm, clear
// Laura  FGY2WhTYpPnrIDTdsKH5 — composed, smooth
const ELEVENLABS_VOICES = {
  sofia:       'EXAVITQu4vr4xnSDxMaL', // Bella
  anna:        'EXAVITQu4vr4xnSDxMaL', // Bella
  zoe:         'EXAVITQu4vr4xnSDxMaL', // Bella
  nadia:       'EXAVITQu4vr4xnSDxMaL', // Bella
  erika:       'EXAVITQu4vr4xnSDxMaL', // Bella
  ava:         'pMsXgVXv3BLzUkzvXi1f', // Sarah
  elena:       'pMsXgVXv3BLzUkzvXi1f', // Sarah
  julia:       'pMsXgVXv3BLzUkzvXi1f', // Sarah
  fatou:       'pMsXgVXv3BLzUkzvXi1f', // Sarah
  sanna:       'FGY2WhTYpPnrIDTdsKH5', // Laura
  isabelle:    'FGY2WhTYpPnrIDTdsKH5', // Laura
  leila:       'FGY2WhTYpPnrIDTdsKH5', // Laura
  maya_office: 'FGY2WhTYpPnrIDTdsKH5', // Laura
  remi:        'FGY2WhTYpPnrIDTdsKH5', // Laura
  // remaining characters default to Bella
  sarah:       'EXAVITQu4vr4xnSDxMaL', // Bella
  eden:        'EXAVITQu4vr4xnSDxMaL', // Bella
};

const DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Bella

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  const { text, characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'ELEVENLABS_API_KEY not configured' });

  const voiceId = (characterId && ELEVENLABS_VOICES[characterId]) || DEFAULT_VOICE;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          output_format: 'mp3_44100_128',
        }),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timeout);

    if (!elRes.ok) {
      const errText = await elRes.text().catch(() => String(elRes.status));
      console.error('[tts] ElevenLabs error', elRes.status, errText.slice(0, 120));
      return res.status(503).json({ error: 'TTS unavailable: ' + elRes.status });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = elRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();

  } catch (err) {
    clearTimeout(timeout);
    const reason = err.name === 'AbortError' ? 'timeout (8s)' : err.message;
    console.error('[tts] ElevenLabs failed:', reason);
    return res.status(503).json({ error: 'TTS unavailable: ' + reason });
  }
};
