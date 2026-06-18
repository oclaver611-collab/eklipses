// api/tts.js — ElevenLabs TTS for all voices (no OpenAI speech API)
const { checkRateLimit } = require('./ratelimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  const { text, characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  // ── ElevenLabs voice mapping ───────────────────────────────────────────────
  // Drew  (29vD33N1rvCBjLBSMJK1) — steady, confident, coach voice (Ryan)
  // Elise (EST9Ui6982FZPSi7gCHi) — warm, expressive
  // Bella (EXAVITQu4vr4xnSDxMaL) — warm, expressive
  // Sarah (pMsXgVXv3BLzUkzvXi1f) — sharp, direct
  // Laura (FGY2WhTYpPnrIDTdsKH5) — composed, intellectual
  const ELEVENLABS_VOICES = {
    ryan:        '29vD33N1rvCBjLBSMJK1', // Drew
    sofia:       'EST9Ui6982FZPSi7gCHi',  // Elise
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

  const elVoiceId = characterId ? ELEVENLABS_VOICES[characterId] : null;
  if (!elVoiceId) return res.status(400).json({ error: 'Unknown characterId: ' + characterId });

  // ── ElevenLabs Flash v2.5 ─────────────────────────────────────────────────
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

    const errBody = await elRes.text();
    console.error('[tts] ElevenLabs non-OK:', elRes.status, errBody);
    return res.status(elRes.status).json({ error: 'ElevenLabs error: ' + errBody });
  } catch (err) {
    console.error('[tts] ElevenLabs failed:', err.message);
    return res.status(503).json({ error: 'TTS unavailable: ' + err.message });
  }
};
