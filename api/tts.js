// api/tts.js — ElevenLabs Flash v2.5 primary TTS, OpenAI fallback
// Ryan is NOT routed through this file — handled separately in player.js
const { checkRateLimit } = require('./ratelimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  const { text, voice = 'nova', characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  // ── ElevenLabs voice mapping ───────────────────────────────────────────────
  // Bella (EXAVITQu4vr4xnSDxMaL) — warm, expressive
  // Sarah (pMsXgVXv3BLzUkzvXi1f) — sharp, direct
  // Laura (FGY2WhTYpPnrIDTdsKH5) — composed, intellectual
  const ELEVENLABS_VOICES = {
    sofia:       'EXAVITQu4vr4xnSDxMaL', // Bella
    anna:        'EXAVITQu4vr4xnSDxMaL',
    zoe:         'EXAVITQu4vr4xnSDxMaL',
    nadia:       'EXAVITQu4vr4xnSDxMaL',
    erika:       'EXAVITQu4vr4xnSDxMaL',
    ava:         'pMsXgVXv3BLzUkzvXi1f', // Sarah
    elena:       'pMsXgVXv3BLzUkzvXi1f',
    julia:       'pMsXgVXv3BLzUkzvXi1f',
    fatou:       'pMsXgVXv3BLzUkzvXi1f',
    sanna:       'FGY2WhTYpPnrIDTdsKH5', // Laura
    isabelle:    'FGY2WhTYpPnrIDTdsKH5',
    leila:       'FGY2WhTYpPnrIDTdsKH5',
    maya_office: 'FGY2WhTYpPnrIDTdsKH5',
    remi:        'FGY2WhTYpPnrIDTdsKH5',
    sarah:       'FGY2WhTYpPnrIDTdsKH5',
  };

  // ── OpenAI fallback voice mapping ──────────────────────────────────────────
  const OPENAI_VOICES = {
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

  const elVoiceId  = characterId ? ELEVENLABS_VOICES[characterId] : null;
  const openAIVoice = (characterId && OPENAI_VOICES[characterId]) || voice || 'nova';

  // ── Helper: stream OpenAI TTS ──────────────────────────────────────────────
  async function streamOpenAI() {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: openAIVoice,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error('OpenAI TTS error: ' + err);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-TTS-Provider', 'openai');

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  }

  // ── Try ElevenLabs Flash v2.5 first ───────────────────────────────────────
  if (elVoiceId && process.env.ELEVENLABS_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const elRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}/stream`,
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
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (elRes.ok) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('X-TTS-Provider', 'elevenlabs');

        const reader = elRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
        return;
      }
      // ElevenLabs returned non-OK — fall through to OpenAI
      console.error('[tts] ElevenLabs non-OK:', elRes.status);
    } catch (err) {
      // Timeout or network error — fall through to OpenAI
      console.error('[tts] ElevenLabs failed, falling back to OpenAI:', err.message);
    }
  }

  // ── OpenAI fallback ────────────────────────────────────────────────────────
  try {
    await streamOpenAI();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
