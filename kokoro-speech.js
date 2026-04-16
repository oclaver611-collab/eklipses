/**
 * kokoro-speech.js  v3
 * Uses esm.sh CDN — properly handles transitive dependencies
 * unlike jsdelivr which fails silently on complex packages.
 */

const KokoroSpeech = (() => {

  let tts        = null;
  let loading    = false;
  let waiters    = [];
  let audioCtx   = null;
  let currentSrc = null;

  async function ensureLoaded(onProgress) {
    if (tts) return tts;
    if (loading) return new Promise(r => waiters.push(r));
    loading = true;

    console.log("[KokoroSpeech] Starting model load...");

    let KokoroTTS;
    try {
      ({ KokoroTTS } = await import("https://esm.sh/kokoro-js@1"));
      console.log("[KokoroSpeech] kokoro-js imported OK");
    } catch (err) {
      loading = false;
      waiters.forEach(r => r(null));
      waiters = [];
      console.error("[KokoroSpeech] Import FAILED:", err);
      throw new Error("Failed to import kokoro-js: " + err.message);
    }

    try {
      tts = await KokoroTTS.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0",
        { dtype: "q8", progress_callback: onProgress }
      );
      console.log("[KokoroSpeech] Model loaded OK");
    } catch (err) {
      loading = false;
      waiters.forEach(r => r(null));
      waiters = [];
      console.error("[KokoroSpeech] Model load FAILED:", err);
      throw new Error("Failed to load model: " + err.message);
    }

    loading = false;
    waiters.forEach(r => r(tts));
    waiters = [];
    return tts;
  }

  async function preload(onProgress) { return ensureLoaded(onProgress); }

  async function speak(text, voice = "af_nicole") {
    if (!text?.trim()) return;
    try {
      const engine = await ensureLoaded();
      if (!engine) return;
      console.log("[KokoroSpeech] Speaking:", text.slice(0,40), "voice:", voice);
      const result = await engine.generate(text, { voice, speed: 1.0 });
      await _playPCM(result.audio, result.sampling_rate);
    } catch (err) {
      console.error("[KokoroSpeech] speak() error:", err);
    }
  }

  function cancel() {
    if (currentSrc) { try { currentSrc.stop(); } catch (_) {} currentSrc = null; }
  }

  function isReady() { return tts !== null; }

  async function _playPCM(float32, sampleRate) {
    cancel();
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
console.log("[KokoroSpeech] Ready on window.KokoroSpeech");
