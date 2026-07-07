// record_seg10b.js — Record ryan_seg10b.mp3 + upload MP3 + upload manifest
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const FISH_API_KEY  = process.env.FISH_AUDIO_API_KEY;
const RYAN_VOICE_ID = process.env.FISH_AUDIO_RYAN_VOICE_ID;
const R2_BUCKET     = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX     = 'lessons/lesson1/audio_v2';
const LOCAL_DIR     = path.join(__dirname, 'lesson1_audio_v2');
const MANIFEST_PATH = path.join(LOCAL_DIR, 'manifest.json');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const TEXT = `Watch what happens now. [pause] Alex has been in this conversation for twenty minutes. He's built something. She's engaged. She's interested. [pause] Most guys at this point start hinting. They drop signals and hope she figures it out. They ask in a way that sounds like an apology. [pause] Alex doesn't do that. [pause] Watch how he asks. Watch his tone. Watch what he doesn't say. [pause] This is Step 5.`;

async function generateAudio() {
  console.log('→ Calling Fish Audio TTS...');
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text:         TEXT,
      reference_id: RYAN_VOICE_ID,
      format:       'mp3',
      mp3_bitrate:  128,
      normalize:    true,
      latency:      'normal',
      temperature:  0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fish Audio error ${res.status}: ${err}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`✓ Generated: ${(buf.length / 1024).toFixed(1)} KB`);
  return buf;
}

async function uploadToR2(body, key, contentType) {
  console.log(`→ Uploading to R2: ${key}`);
  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        body,
    ContentType: contentType,
    CacheControl: contentType === 'audio/mpeg'
      ? 'public, max-age=31536000'
      : 'public, max-age=0, must-revalidate',
  }));
  console.log(`✓ Uploaded: ${key}`);
}

async function main() {
  // Validate
  for (const k of ['FISH_AUDIO_API_KEY', 'FISH_AUDIO_RYAN_VOICE_ID', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    if (!process.env[k]) { console.error(`Missing env: ${k}`); process.exit(1); }
  }

  // 1. Record
  const mp3 = await generateAudio();

  // 2. Save locally
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const localPath = path.join(LOCAL_DIR, 'ryan_seg10b.mp3');
  fs.writeFileSync(localPath, mp3);
  console.log(`✓ Saved locally: ${localPath}`);

  // 3. Upload MP3 to R2
  await uploadToR2(mp3, `${R2_PREFIX}/ryan_seg10b.mp3`, 'audio/mpeg');

  // 4. Update manifest — insert 10b between 10 and 11
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const idx10 = manifest.segments.findIndex(s => s.segmentId === '10');
  if (idx10 === -1) { console.error('Segment 10 not found in manifest'); process.exit(1); }

  const already = manifest.segments.find(s => s.segmentId === '10b');
  if (already) {
    console.log('⚠ Segment 10b already in manifest — updating in place');
    Object.assign(already, {
      type: 'coaching',
      title: 'Watch — The Close',
      files: [{ file: 'ryan_seg10b.mp3', voice: 'ryan' }],
    });
    delete already.sequence;
  } else {
    manifest.segments.splice(idx10 + 1, 0, {
      segmentId: '10b',
      type:      'coaching',
      title:     'Watch — The Close',
      files:     [{ file: 'ryan_seg10b.mp3', voice: 'ryan' }],
    });
  }

  manifest.generatedAt = new Date().toISOString();
  const manifestJson = JSON.stringify(manifest, null, 2);

  // 5. Save manifest locally
  fs.writeFileSync(MANIFEST_PATH, manifestJson);
  console.log(`✓ Manifest updated locally (${manifest.segments.length} segments)`);

  // 6. Upload manifest to R2
  await uploadToR2(Buffer.from(manifestJson, 'utf8'), `${R2_PREFIX}/manifest.json`, 'application/json');

  console.log('\n✓ All done. Run: node deploy-worker.js');
}

main().catch(err => { console.error('✗', err.message); process.exit(1); });
