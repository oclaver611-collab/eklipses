// api/tts.js — OpenAI TTS with streaming + per-character voice mapping + rate limiting
const { checkRateLimit } = require('./ratelimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate limiting (IP-based, dev bypass via x-dev-key header) ──
  const rl = checkRateLimit(req, res);
  if (!rl.allowed) return;

  const { text, voice = 'nova', characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  // ── Per-character voice mapping ───────────────────────────────────────────
  // nova  — warm, natural, expressive  (most characters)
  // alloy — cooler, composed, precise  (intellectual / guarded characters)
  const CHARACTER_VOICES = {
    sofia:       'nova',
    anna:        'nova',
    sarah:       'nova',
    eden:        'nova',
    ava:         'nova',
    elena:       'nova',
    erika:       'nova',
    fatou:       'nova',
    zoe:         'nova',
    sanna:       'alloy',
    isabelle:    'alloy',
    leila:       'alloy',
    maya_office: 'alloy',
    nadia:       'alloy',
    julia:       'alloy',
  };

  const resolvedVoice = (characterId && CHARACTER_VOICES[characterId]) || voice || 'nova';

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: resolvedVoice,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'OpenAI error: ' + err });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
