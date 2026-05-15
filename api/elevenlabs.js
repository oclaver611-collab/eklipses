// api/elevenlabs.js — ElevenLabs TTS for Sofia (Mary speaker)
// Ryan stays on Kokoro in the browser — only Mary uses this endpoint
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, speaker } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No text provided' });
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  // Only Sofia/Mary uses ElevenLabs — other speakers fall back gracefully
  const SOFIA_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — default voice, works on free tier

  // Clean text for TTS — remove stage directions but keep emotional cues
  // ElevenLabs v3 supports [laughs], [sighs], [whispers] natively
  const cleanText = text
    .replace(/\*[^*]+\*/g, '') // remove *stage directions*
    .trim();

  if (!cleanText) return res.status(400).json({ error: 'Empty text after cleaning' });

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${SOFIA_VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', response.status, err);
      return res.status(500).json({ error: 'ElevenLabs error: ' + response.status });
    }

    // Stream audio directly to client
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
    console.error('TTS error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
