// api/tts.js — Vercel serverless function, CommonJS syntax
// Uses Groq Orpheus TTS (faster than OpenAI, same GROQ_API_KEY)
//
// Voice mapping (kept compatible with existing kokoro-speech.js):
//   nova  → leah   (Mary  — warm female)
//   onyx  → austin (Daniel — deep male)
//   echo  → thaddeus  (Ryan  — clear male)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice = 'nova' } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set in Vercel env vars' });
  }

  // Map OpenAI voice names → Groq Orpheus voices
  const VOICE_MAP = {
    nova:  'leah',     // Mary — warm female
    onyx:  'daniel',   // Daniel — deep male
    echo:  'troy', // Ryan — clear male
  };
  const groqVoice = VOICE_MAP[voice] || 'leah';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'canopylabs/orpheus-v1-english',
        input: text,
        voice: groqVoice,
        response_format: 'wav',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Groq TTS error: ' + err });
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
