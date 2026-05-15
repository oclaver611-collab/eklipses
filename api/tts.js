// api/tts.js — OpenAI TTS with streaming for low latency
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, voice = 'nova' } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',        // tts-1 is faster than tts-1-hd for real-time
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'OpenAI error: ' + err });
    }

    // Stream directly — don't buffer the whole file
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
