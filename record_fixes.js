// record_fixes.js — Re-record alex_s11_02.mp3 (OpenAI) + ryan_seg12.mp3 (Fish Audio)
require('dotenv').config({ path: '.env.local' });
const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const LOCAL_DIR = path.join(__dirname, 'lesson1_audio_v2');
const R2_PREFIX = 'lessons/lesson1/audio_v2';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ── Recordings ────────────────────────────────────────────────────────────────

async function recordAlex() {
  console.log('→ [ALEX] OpenAI TTS tts-1-hd / onyx ...');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      voice: 'onyx',
      input: "No. Opposite actually. Look — I'd like to continue this somewhere that isn't a beach. Coffee, a drink, whatever works for you.",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS error ${res.status}: ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`✓ [ALEX] Generated: ${(buf.length / 1024).toFixed(1)} KB`);
  return buf;
}

async function recordRyan() {
  console.log('→ [RYAN] Fish Audio TTS ...');
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      text: "Stop. [pause] Did you see what just happened? [pause] Alex didn't hint. He didn't say maybe we could hang out sometime. He didn't apologize for asking. [pause] He said exactly what he wanted — directly, lightly, no pressure. And she said yes. [pause] That's Step 5. The direct, comfortable close. [pause] Here are three ways you can say it — pick the one that feels natural. [pause] One: I'd love to grab a coffee — are you up for it? [pause] Two: Look, I have to go — but I'd like to see you again. You free this week? [pause] Three: Give me your number. Let's do this again somewhere better. [pause] All three work. All three are direct. All three leave her room to say yes without pressure. [pause] The close is not a moment you survive. It's a moment you lead. [pause] Step 5 — done.",
      reference_id: process.env.FISH_AUDIO_RYAN_VOICE_ID,
      format:       'mp3',
      mp3_bitrate:  128,
      normalize:    true,
      latency:      'normal',
      temperature:  0.7,
    }),
  });
  if (!res.ok) throw new Error(`Fish Audio error ${res.status}: ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`✓ [RYAN] Generated: ${(buf.length / 1024).toFixed(1)} KB`);
  return buf;
}

async function upload(buf, filename) {
  const key = `${R2_PREFIX}/${filename}`;
  console.log(`→ Uploading ${filename} to R2...`);
  await r2.send(new PutObjectCommand({
    Bucket:       process.env.R2_BUCKET_NAME,
    Key:          key,
    Body:         buf,
    ContentType:  'audio/mpeg',
    CacheControl: 'public, max-age=31536000',
  }));
  console.log(`✓ Uploaded: ${key}`);
}

async function main() {
  for (const k of ['OPENAI_API_KEY', 'FISH_AUDIO_API_KEY', 'FISH_AUDIO_RYAN_VOICE_ID', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    if (!process.env[k]) { console.error(`Missing env: ${k}`); process.exit(1); }
  }

  // Record both in parallel
  const [alexBuf, ryanBuf] = await Promise.all([recordAlex(), recordRyan()]);

  // Save locally
  fs.writeFileSync(path.join(LOCAL_DIR, 'alex_s11_02.mp3'), alexBuf);
  fs.writeFileSync(path.join(LOCAL_DIR, 'ryan_seg12.mp3'),  ryanBuf);
  console.log('✓ Saved locally');

  // Upload both in parallel
  await Promise.all([
    upload(alexBuf, 'alex_s11_02.mp3'),
    upload(ryanBuf, 'ryan_seg12.mp3'),
  ]);

  console.log('\n✓ Both files recorded and uploaded.');
}

main().catch(err => { console.error('✗', err.message); process.exit(1); });
