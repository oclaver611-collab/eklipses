// kokoro-server.mjs — Kokoro TTS server for Render
import express from 'express';
import { KokoroTTS } from 'kokoro-js';
import ffmpegPath from 'ffmpeg-static';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

// Load once at startup — q8 keeps peak RAM under 400MB on Render 512MB instance
console.log('[kokoro] Loading model...');
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
});
console.log('[kokoro] Model ready.');

// Concurrency queue — tts.generate() is not thread-safe; serialize all requests
let queue = Promise.resolve();
const enqueue = (fn) => {
  queue = queue.then(fn, fn);
  return queue;
};

app.post('/tts', async (req, res) => {
  const { text, voice = 'af_heart' } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  await enqueue(async () => {
    const id = randomUUID();
    const wav = join(tmpdir(), `${id}.wav`);
    const mp3 = join(tmpdir(), `${id}.mp3`);

    try {
      const audio = await tts.generate(text, { voice });
      audio.save(wav);
      execSync(`"${ffmpegPath}" -i "${wav}" -codec:a libmp3lame -qscale:a 2 "${mp3}"`, { stdio: 'pipe' });
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(readFileSync(mp3));
    } catch (err) {
      console.error('[kokoro] TTS error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    } finally {
      try { unlinkSync(wav); } catch {}
      try { unlinkSync(mp3); } catch {}
    }
  });
});

app.listen(process.env.PORT || 3001, () =>
  console.log(`[kokoro] Listening on :${process.env.PORT || 3001}`)
);
