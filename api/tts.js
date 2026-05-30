// api/tts.js — ElevenLabs Flash TTS (primary) + OpenAI TTS (fallback) + per-character voice mapping
const { checkRateLimit } = require('./ratelimit');

// ElevenLabs premade American English female voices (5 distinct voices, 16 characters)
// Rachel    21m00Tcm4TlvDq8ikWAM — warm, conversational
// Bella     EXAVITQu4vr4xnSDxMaL — soft, natural
// Elli      MF3mGyEYCl7XYWbV9V6O — bright, expressive
// Charlotte XB0fDUnXU5powFXDhCwa — composed, mature
// Lily      pFZP5JQG7iQjIQuC4Bku — sharp, direct
const ELEVENLABS_VOICES = {
  sofia:       'EXAVITQu4vr4xnSDxMaL', // Bella     — soft, natural (main character)
  anna:        '21m00Tcm4TlvDq8ikWAM',  // Rachel    — warm, conversational
  sarah:       'MF3mGyEYCl7XYWbV9V6O',  // Elli      — bright, expressive
  eden:        'pFZP5JQG7iQjIQuC4Bku',  // Lily      — sharp, direct
  ava:         'XB0fDUnXU5powFXDhCwa',  // Charlotte — composed, confident
  elena:       '21m00Tcm4TlvDq8ikWAM',  // Rachel    — warm, open
  erika:       'MF3mGyEYCl7XYWbV9V6O',  // Elli      — bright, energetic
  fatou:       'pFZP5JQG7iQjIQuC4Bku',  // Lily      — direct, grounded
  zoe:         'EXAVITQu4vr4xnSDxMaL',  // Bella     — soft, playful
  sanna:       'XB0fDUnXU5powFXDhCwa',  // Charlotte — composed, cool
  isabelle:    'MF3mGyEYCl7XYWbV9V6O',  // Elli      — expressive, intellectual
  leila:       '21m00Tcm4TlvDq8ikWAM',  // Rachel    — warm, guarded
  maya_office: 'pFZP5JQG7iQjIQuC4Bku',  // Lily      — sharp, professional
  nadia:       'EXAVITQu4vr4xnSDxMaL',  // Bella     — soft, reserved
  julia:       'XB0fDUnXU5powFXDhCwa',  // Charlotte — composed, precise
  remi:        'MF3mGyEYCl7XYWbV9V6O',  // Elli      — bright, curious
};

const DEFAULT_ELEVENLABS_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Bella

// OpenAI fallback voices
const OPENAI_VOICES = {
  sofia:       'nova',
  anna:        'nova',
  sarah:       'nova',
  eden:        'nova',
  ava:         'alloy',
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
  remi:        'nova',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  const { text, voice = 'nova', characterId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  const elevenLabsVoiceId = (characterId && ELEVENLABS_VOICES[characterId]) || DEFAULT_ELEVENLABS_VOICE;
  const openaiVoice = (characterId && OPENAI_VOICES[characterId]) || voice || 'nova';

  // ── ElevenLabs Flash (primary) — 8s timeout, falls back to OpenAI on hang ─
  const useElevenLabs = false; // TEMP DISABLED — force OpenAI TTS until ElevenLabs hang is resolved
  if (useElevenLabs && process.env.ELEVENLABS_API_KEY) {
    const elCtrl = new AbortController();
    const elTimeout = setTimeout(() => elCtrl.abort(), 8000);
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
          signal: elCtrl.signal,
        }
      );
      clearTimeout(elTimeout);

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
      clearTimeout(elTimeout);
      const reason = err.name === 'AbortError' ? 'timeout (8s)' : err.message;
      console.error('[tts] ElevenLabs failed (' + reason + '), falling back to OpenAI');
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
