// api/tts.js — Kokoro primary TTS, ElevenLabs fallback, OpenAI final fallback
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
    sofia:       'EST9Ui6982FZPSi7gCHi',  // Elise
    anna:        'EXAVITQu4vr4xnSDxMaL',
    zoe:         'EXAVITQu4vr4xnSDxMaL',
    nadia:       'EXAVITQu4vr4xnSDxMaL',
    erika:       'EXAVITQu4vr4xnSDxMaL',
    ava:         'FGY2WhTYpPnrIDTdsKH5', // Laura (Sarah voice pMsXgVXv3BLzUkzvXi1f deprecated)
    elena:       'FGY2WhTYpPnrIDTdsKH5',
    julia:       'FGY2WhTYpPnrIDTdsKH5',
    fatou:       'FGY2WhTYpPnrIDTdsKH5',
    eden:        'FGY2WhTYpPnrIDTdsKH5',
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

  // Kokoro disabled — cold starts on free Render tier cause 20-30s delays
  // ── Try Kokoro first (character requests only) ────────────────────────────
  // if (characterId) {
  //   try {
  //     const controller = new AbortController();
  //     const timeout = setTimeout(() => controller.abort(), 25000);
  //
  //     const kokoroRes = await fetch('https://kokoro-tts-server.onrender.com/tts', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ text, voice: 'af_heart' }),
  //       signal: controller.signal,
  //     });
  //
  //     clearTimeout(timeout);
  //
  //     if (kokoroRes.ok && kokoroRes.headers.get('content-type')?.includes('audio/mpeg')) {
  //       res.setHeader('Content-Type', 'audio/mpeg');
  //       res.setHeader('Cache-Control', 'no-cache');
  //       res.setHeader('Transfer-Encoding', 'chunked');
  //       res.setHeader('X-TTS-Provider', 'kokoro');
  //
  //       const reader = kokoroRes.body.getReader();
  //       while (true) {
  //         const { done, value } = await reader.read();
  //         if (done) break;
  //         res.write(Buffer.from(value));
  //       }
  //       res.end();
  //       return;
  //     }
  //     const kokoroErrBody = await kokoroRes.text();
  //     console.error('[tts] Kokoro non-OK:', kokoroRes.status, kokoroErrBody);
  //   } catch (err) {
  //     console.error('[tts] Kokoro failed, falling back to ElevenLabs:', err.message);
  //   }
  // }

  // ── Try ElevenLabs Flash v2.5 ─────────────────────────────────────────────
  if (elVoiceId && process.env.ELEVENLABS_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

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
      const elErrBody = await elRes.text();
      console.error('[tts] ElevenLabs non-OK:', elRes.status, elErrBody);
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
