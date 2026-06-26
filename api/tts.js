// api/tts.js — Fish Audio TTS for all voices
const { checkRateLimit } = require('./ratelimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  const { text, characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.FISH_AUDIO_API_KEY) return res.status(500).json({ error: 'FISH_AUDIO_API_KEY not set' });

  // ── Fish Audio voice mapping ───────────────────────────────────────────────
  const FISH_AUDIO_VOICES = {
    ryan:    '44b996214285427697767cb469793647',
    sofia:   '8c7ee2cd4d884622a0747daa25120b47',
    mary:    '8c7ee2cd4d884622a0747daa25120b47',
    anna:    '8c7ee2cd4d884622a0747daa25120b47',
    leila:   'd2d81e5c8a8f4114870d3d34c3c58005',
    eden:    'd2d81e5c8a8f4114870d3d34c3c58005',
    erika:   'd2d81e5c8a8f4114870d3d34c3c58005',
    julia:   '933563129e564b19a115bedd57b7406a',
    maya:    '933563129e564b19a115bedd57b7406a',
    sanna:   '933563129e564b19a115bedd57b7406a',
    elena:   'cad803570d5d4202808bf6d4838a4246',
    fatou:   'cad803570d5d4202808bf6d4838a4246',
    sarah:   'cad803570d5d4202808bf6d4838a4246',
    default: '22d0bcafaa6d4f489145bc65c1afdaa1',
  };

  const voiceId = characterId ? (FISH_AUDIO_VOICES[characterId] || FISH_AUDIO_VOICES.default) : null;
  if (!voiceId) return res.status(400).json({ error: 'Unknown characterId: ' + characterId });

  // ── Fish Audio TTS ─────────────────────────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const t0 = Date.now();

    const fishRes = await fetch(
      'https://api.fish.audio/v1/tts',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          reference_id: voiceId,
          format: 'mp3',
          streaming: false,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (fishRes.ok) {
      console.log(`[tts] ${characterId} voice=${voiceId.slice(0, 8)} chars=${text.length} ${Date.now() - t0}ms`);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-TTS-Provider', 'fishaudio');

      const reader = fishRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
      return;
    }

    const errBody = await fishRes.text();
    console.error('[tts] Fish Audio non-OK:', fishRes.status, errBody);
    return res.status(fishRes.status).json({ error: 'Fish Audio error: ' + errBody });
  } catch (err) {
    console.error('[tts] Fish Audio failed:', err.message);
    return res.status(503).json({ error: 'TTS unavailable: ' + err.message });
  }
};
