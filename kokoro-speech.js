/**
 * kokoro-speech.js v5 — streaming playback, no blob buffering
 */
const KokoroSpeech = (() => {
  let currentAudio = null;
  let _cancelResolve = null; // resolves any pending speak() promise when cancel() fires

  const VOICE_MAP = {
    'af_nicole':  'nova',
    'am_michael': 'onyx',
    'am_adam':    'onyx',
  };

  async function speak(text, voice = 'af_nicole', prefetchedUrl = null) {
    if (typeof window !== 'undefined' && window.__EKLIPSES_TEST_MODE) return;
    if (!text?.trim()) return;
    const openaiVoice = VOICE_MAP[voice] || 'nova';
    let url = prefetchedUrl;
    if (!url) {
      cancel();
      // fetch happens below
    }
    try {
      if (!url) {
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
        url = URL.createObjectURL(blob);
      } else {
        console.log(`[TTS] ${openaiVoice} (prefetched): "${text.slice(0,50)}"`);
      }
      cancel();
      const audio = new Audio(url);
      currentAudio = audio;
      audio.volume = 1;
      audio.muted = false;
      audio.preload = 'auto';
      await new Promise((resolve) => {
        _cancelResolve = resolve;
        const done = () => { _cancelResolve = null; URL.revokeObjectURL(url); currentAudio = null; resolve(); };
        const timeout = setTimeout(done, 30000);
        audio.onended = () => { clearTimeout(timeout); done(); };
        audio.onerror = () => { clearTimeout(timeout); done(); };
        audio.play().catch(() => { _cancelResolve = null; resolve(); });
      });
    } catch (err) {
      console.error('[TTS] speak() error:', err);
    }
  }

  async function prefetch(text, voice = 'af_nicole') {
    if (!text?.trim()) return null;
    const openaiVoice = VOICE_MAP[voice] || 'nova';
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: openaiVoice }),
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch { return null; }
  }

  function cancel() {
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.src = ''; } catch {}
      currentAudio = null;
    }
    if (_cancelResolve) {
      const r = _cancelResolve;
      _cancelResolve = null;
      r();
    }
  }

  async function preload() {
    console.log('[TTS] OpenAI TTS — no preload needed');
    return true;
  }

  function isReady() { return true; }

  return { speak, cancel, preload, isReady, prefetch };
})();

window.KokoroSpeech = KokoroSpeech;
console.log('[TTS] OpenAI TTS module ready');
