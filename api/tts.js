// api/tts.js — ElevenLabs Flash TTS (primary) + OpenAI TTS (fallback) + per-character voice mapping
const { checkRateLimit } = require('./ratelimit');

// ElevenLabs voice IDs per character
// Rachel (21m00...) — warm, natural, expressive  (most characters)
// Charlotte (XB0f...) — cooler, composed, mature (intellectual / guarded characters)
const ELEVENLABS_VOICES = {
  sofia:       '21m00Tcm4TlvDq8ikWAM',
  anna:        '21m00Tcm4TlvDq8ikWAM',
  sarah:       '21m00Tcm4TlvDq8ikWAM',
  eden:        '21m00Tcm4TlvDq8ikWAM',
  ava:         '21m00Tcm4TlvDq8ikWAM',
  elena:       '21m00Tcm4TlvDq8ikWAM',
  erika:       '21m00Tcm4TlvDq8ikWAM',
  fatou:       '21m00Tcm4TlvDq8ikWAM',
  zoe:         '21m00Tcm4TlvDq8ikWAM',
  sanna:       'XB0fDUnXU5powFXDhCwa',
  isabelle:    'XB0fDUnXU5powFXDhCwa',
  leila:       'XB0fDUnXU5powFXDhCwa',
  maya_office: 'XB0fDUnXU5powFXDhCwa',
  nadia:       'XB0fDUnXU5powFXDhCwa',
  julia:       'XB0fDUnXU5powFXDhCwa',
};

const DEFAULT_ELEVENLABS_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// OpenAI fallback voices
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = checkRateLimit(req, res);
  if (!rl.allowed) return;

  const { text, voice = 'nova', characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  const elevenLabsVoiceId = (characterId && ELEVENLABS_VOICES[characterId]) || DEFAULT_ELEVENLABS_VOICE;
  const openaiVoice = (characterId && OPENAI_VOICES[characterId]) || voice || 'nova';

  // ── ElevenLabs Flash (primary) ───────────────────────────────────────────
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const elRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}/stream`,
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
            output_format: 'mp3_44100_128',
          }),
        }
      );

      if (elRes.ok) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Transfer-Encoding', 'chunked');
        const reader = elRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        return res.end();
      }
      console.error('[tts] ElevenLabs error', elRes.status, await elRes.text());
    } catch (err) {
      console.error('[tts] ElevenLabs exception, falling back to OpenAI:', err.message);
    }
  }

  // ── OpenAI TTS (fallback) ────────────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'No TTS API key available' });

  try {
    const oaRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: openaiVoice,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!oaRes.ok) {
      const err = await oaRes.text();
      return res.status(500).json({ error: 'OpenAI error: ' + err });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = oaRes.body.getReader();
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
