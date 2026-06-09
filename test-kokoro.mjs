import { KokoroTTS } from 'kokoro-js';
import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

const TEXT = "Hi, I'm Sofia. I've been sitting here for twenty minutes and you're the first interesting thing that's walked by.";
const WAV  = './test-kokoro.wav';
const MP3  = './test-kokoro.mp3';

console.log('[kokoro] Loading model (first run downloads ~300MB, cached after)...');
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
});

console.log('[kokoro] Generating audio with voice af_heart...');
const audio = await tts.generate(TEXT, { voice: 'af_heart' });

console.log('[kokoro] Saving WAV...');
audio.save(WAV);

console.log('[kokoro] Converting to MP3 via ffmpeg...');
if (existsSync(MP3)) unlinkSync(MP3);
execSync(`ffmpeg -i "${WAV}" -codec:a libmp3lame -qscale:a 2 "${MP3}"`, { stdio: 'inherit' });
if (existsSync(WAV)) unlinkSync(WAV);

console.log('[kokoro] Done — test-kokoro.mp3 saved.');
