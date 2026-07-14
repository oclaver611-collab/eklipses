/**
 * kokoro-speech.js v5 — streaming playback, no blob buffering
 */
const KokoroSpeech = (() => {
  let currentAudio = null;
  let _cancelResolve = null; // resolves any pending speak() promise when cancel() fires

  // Strips intonation markers before text reaches the TTS engine.
  // Kokoro/Fish Audio treats em-dashes, ellipses, and bracket tags as prosody
  // cues — removing them lets the engine use its natural default voice.
  function sanitizeForTTS(text) {
    if (!text) return text;
    return text
      .replace(/\[.*?\]/g, '')         // [pause], [break], any bracket tag
      .replace(/\*\*(.+?)\*\*/g, '$1') // **bold** → plain
      .replace(/\*(.+?)\*/g, '$1')     // *italic* → plain
      .replace(/—|–/g, ', ')           // em/en dash → comma (natural pause, no stress)
      .replace(/\.{2,}/g, '.')         // ... or .. → single period
      .replace(/…/g, '.')              // unicode ellipsis → period
      .replace(/\s+/g, ' ')            // collapse whitespace
      .trim();
  }

  const VOICE_MAP = {
    'af_nicole':  'ryan',
    'am_michael': 'ryan',
    'am_adam':    'ryan',
  };

  async function speak(text, voice = 'af_nicole', prefetchedUrl = null) {
    if (typeof window !== 'undefined' && window.__EKLIPSES_TEST_MODE) return;
    if (!text?.trim()) return;
    cancel(); // always stop any in-flight audio before starting a new line
    const charId = VOICE_MAP[voice] || 'ryan';
    const cleanText = sanitizeForTTS(text);
    let url = prefetchedUrl;
    try {
      if (!url) {
        console.log(`[TTS] ${charId}: "${cleanText.slice(0,50)}"`);
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, characterId: charId }),
        });
        if (!response.ok) {
          console.error('[TTS] API error:', response.status);
          return;
        }
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
      } else {
        console.log(`[TTS] ${charId} (prefetched): "${text.slice(0,50)}"`);
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
    const charId = VOICE_MAP[voice] || 'ryan';
    const cleanText = sanitizeForTTS(text);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, characterId: charId }),
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
