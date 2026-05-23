// api/tts.js — OpenAI TTS with streaming + per-character voice mapping
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, voice = 'nova', characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  // ── Per-character voice mapping ───────────────────────────────────────────
  // All OpenAI voices — same price ($15/1M chars), zero extra cost.
  // Grouped by personality energy:
  //   nova    — warm, natural, approachable      (Sofia, Anna, Sarah, Eden)
  //   shimmer — cooler, composed, precise        (Sanna, Isabelle, Leila, Maya)
  //   fable   — expressive, quicker energy       (Ava, Elena, Erika)
  //   echo    — direct, grounded, no-nonsense    (Zoe, Fatou)
  //   alloy   — neutral, thoughtful, measured    (Nadia, Julia)
  // onyx reserved for future male characters
  const CHARACTER_VOICES = {
    sofia:       'nova',
    anna:        'nova',
    sarah:       'nova',
    eden:        'nova',
    sanna:       'shimmer',
    isabelle:    'shimmer',
    leila:       'shimmer',
    maya_office: 'shimmer',
    ava:         'fable',
    elena:       'fable',
    erika:       'fable',
    zoe:         'echo',
    fatou:       'echo',
    nadia:       'alloy',
    julia:       'alloy',
  };

  // Resolve voice: characterId lookup → explicit voice param → default nova
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
