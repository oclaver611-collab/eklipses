// api/tts.js
// Vercel serverless function — proxies OpenAI TTS
// API key stays server-side, never exposed to browser

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice = 'nova' } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured in Vercel env vars' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',       // fast + cheap (~$0.015/1000 chars)
        input: text,
        voice: voice,         // nova | onyx | echo | alloy | fable | shimmer
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[TTS API] OpenAI error:', err);
      return res.status(500).json({ error: 'OpenAI TTS failed: ' + err });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1hr — same text = same audio
    res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('[TTS API] Error:', err);
    res.status(500).json({ error: err.message });
  }
}
