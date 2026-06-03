/**
 * kokoro-speech.js v6 — MediaSource streaming, no blob buffering
 */
const KokoroSpeech = (() => {
  let currentAudio = null;
  let currentMediaSource = null;

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

      if (window.MediaSource && MediaSource.isTypeSupported('audio/mpeg')) {
        await new Promise((resolve, reject) => {
          const mediaSource = new MediaSource();
          const audio = new Audio();
          audio.src = URL.createObjectURL(mediaSource);
          currentAudio = audio;
          currentMediaSource = mediaSource;

          const sourceOpenTimer = setTimeout(() => reject(new Error('sourceopen timeout')), 8000);

          mediaSource.addEventListener('sourceopen', async () => {
            clearTimeout(sourceOpenTimer);
            const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
            sourceBuffer.addEventListener('updateerror', () => reject(new Error('sourceBuffer updateerror')));
            const reader = response.body.getReader();
            let started = false;

            const pump = async () => {
              try {
                while (true) {
                  const { done, value } = await Promise.race([
                    reader.read(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('stream stall timeout')), 15000)),
                  ]);
                  if (done) {
                    const tryEnd = () => {
                      if (!sourceBuffer.updating) mediaSource.endOfStream();
                      else sourceBuffer.addEventListener('updateend', tryEnd, { once: true });
                    };
                    tryEnd();
                    break;
                  }
                  if (sourceBuffer.updating) {
                    await new Promise((res, rej) => {
                      const t = setTimeout(() => rej(new Error('updateend timeout')), 10000);
                      sourceBuffer.addEventListener('updateend', () => { clearTimeout(t); res(); }, { once: true });
                    });
                  }
                  sourceBuffer.appendBuffer(value);
                  if (!started) {
                    started = true;
                    audio.volume = 1;
                    audio.muted = false;
                    try {
                      await audio.play();
                      console.log('[TTS] playing (streaming)');
                    } catch (playErr) {
                      console.warn('[TTS] play() blocked:', playErr.message);
                    }
                  }
                }
              } catch (e) { reject(e); }
            };
            pump();
          });

          audio.onended = () => {
            URL.revokeObjectURL(audio.src);
            currentAudio = null;
            currentMediaSource = null;
            resolve();
          };
          audio.onerror = (e) => {
            console.error('[TTS] audio error:', e);
            URL.revokeObjectURL(audio.src);
            currentAudio = null;
            currentMediaSource = null;
            resolve();
          };
        });
      } else {
        // Fallback: full blob (Safari / browsers without MediaSource audio/mpeg support)
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.volume = 1;
        audio.muted = false;
        await new Promise((resolve) => {
          audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
          audio.onerror = (e) => { console.error('[TTS] audio error:', e); URL.revokeObjectURL(url); currentAudio = null; resolve(); };
          audio.play().then(() => {
            console.log('[TTS] playing (blob fallback)');
          }).catch((err) => {
            console.error('[TTS] play() blocked:', err.message);
            resolve();
          });
        });
      }
    } catch (err) {
      console.error('[TTS] speak() error:', err);
    }
  }

  function cancel() {
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.src = ''; } catch {}
      currentAudio = null;
    }
    if (currentMediaSource) {
      try { if (currentMediaSource.readyState === 'open') currentMediaSource.endOfStream(); } catch {}
      currentMediaSource = null;
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
console.log('[TTS] OpenAI TTS module ready (v6 streaming)');
