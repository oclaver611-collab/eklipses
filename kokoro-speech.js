/**
 * kokoro-speech.js  v2
 * Uses kokoro-js (dedicated TTS package — cleaner than raw transformers.js)
 *
 * API:
 *   await KokoroSpeech.preload(onProgress)  — call on user tap, before speaking
 *   await KokoroSpeech.speak(text, voice)   — plays audio, resolves when done
 *   KokoroSpeech.cancel()                   — stops current audio immediately
 *   KokoroSpeech.isReady()                  — true after model loaded
 *
 * Voices:  af_nicole (Mary)  |  am_michael (Daniel)  |  am_adam (Ryan)
 */

const KokoroSpeech = (() => {

  let tts         = null;
  let loading     = false;
  let waiters     = [];
  let audioCtx    = null;
  let currentSrc  = null;

  /* ── Load model (once) ──────────────────────────────────────────────── */
  async function ensureLoaded(onProgress) {
    if (tts) return tts;
    if (loading) return new Promise(r => waiters.push(r));
    loading = true;

    try {
      const { KokoroTTS } = await import(
        "https://cdn.jsdelivr.net/npm/kokoro-js@1/+esm"
      );
      tts = await KokoroTTS.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0",
        { dtype: "q8", progress_callback: onProgress }
      );
    } catch (err) {
      loading = false;
      waiters.forEach(r => r(null));
      waiters = [];
      throw err;
    }

    loading = false;
    waiters.forEach(r => r(tts));
    waiters = [];
    return tts;
  }

  /* ── Public: preload ────────────────────────────────────────────────── */
  async function preload(onProgress) {
    return ensureLoaded(onProgress);
  }

  /* ── Public: speak ──────────────────────────────────────────────────── */
  async function speak(text, voice = "af_nicole") {
    if (!text?.trim()) return;
    try {
      const engine = await ensureLoaded();
      if (!engine) return;
      const result = await engine.generate(text, { voice, speed: 1.0 });
      await _playPCM(result.audio, result.sampling_rate);
    } catch (err) {
      console.error("[KokoroSpeech] speak error:", err);
    }
  }

  /* ── Public: cancel ─────────────────────────────────────────────────── */
  function cancel() {
    if (currentSrc) {
      try { currentSrc.stop(); } catch (_) {}
      currentSrc = null;
    }
  }

  /* ── Public: isReady ────────────────────────────────────────────────── */
  function isReady() { return tts !== null; }

  /* ── Internal: Web Audio playback ───────────────────────────────────── */
  async function _playPCM(float32, sampleRate) {
    cancel();
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const buf = audioCtx.createBuffer(1, float32.length, sampleRate);
    buf.copyToChannel(float32, 0);

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    currentSrc = src;

    return new Promise(resolve => {
      src.onended = () => { currentSrc = null; resolve(); };
      src.start(0);
    });
  }

  return { speak, cancel, preload, isReady };
})();

window.KokoroSpeech = KokoroSpeech;
