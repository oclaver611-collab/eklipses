/**
 * kokoro-speech.js  v4 — OpenAI TTS
 * Calls /api/tts (Vercel serverless) → OpenAI TTS API
 * No model download. Works instantly.
 *
 * Voice mapping:
 *   af_nicole  → nova   (Mary  — warm female)
 *   am_michael → onyx   (Daniel — deep male)
 *   am_adam    → echo   (Ryan  — clear male)
 */

const KokoroSpeech = (() => {
  let currentAudio = null;

  const VOICE_MAP = {
    'af_nicole':  'nova',
    'am_michael': 'onyx',
    'am_adam':    'echo',
  };

  async function speak(text, voice = 'af_nicole') {
    if (!text?.trim()) return;
    cancel();
    const openaiVoice = VOICE_MAP[voice] || 'nova';
    try {
      console.log(`[TTS] ${openaiVoice}: "${text.slice(0,50)}"`);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: openaiVoice }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        console.error('[TTS] API error:', err);
        return;
      }
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      await new Promise((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch (err) {
      console.error('[TTS] speak() error:', err);
    }
  }

  function cancel() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
  }

  async function preload() {
    console.log('[TTS] OpenAI TTS — no preload needed');
    return true;
  }

  function isReady() { return true; }

  return { speak, cancel, preload, isReady };
})();

window.KokoroSpeech = KokoroSpeech;
console.log('[TTS] OpenAI TTS module ready');
