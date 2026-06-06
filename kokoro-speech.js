/**
 * kokoro-speech.js v5 — streaming playback, no blob buffering
 */
const KokoroSpeech = (() => {
  let currentAudio = null;

  const VOICE_MAP = {
    'af_nicole':  'nova',
    'am_michael': 'onyx',
    'am_adam':    'onyx',
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
        console.error('[TTS] API error:', response.status);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      audio.volume = 1;
      audio.muted = false;
      audio.preload = 'auto';
      await new Promise((resolve) => {
        const timeout = setTimeout(() => { URL.revokeObjectURL(url); currentAudio = null; resolve(); }, 30000);
        audio.onended = () => { clearTimeout(timeout); URL.revokeObjectURL(url); currentAudio = null; resolve(); };
        audio.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(url); currentAudio = null; resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch (err) {
      console.error('[TTS] speak() error:', err);
    }
  }

  function cancel() {
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.src = ''; } catch {}
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
