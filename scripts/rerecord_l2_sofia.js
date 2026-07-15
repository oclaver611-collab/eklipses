// Re-record Lesson 2 Sofia files using Fish Audio (same voice as Lesson 1).
// Replaces the original ElevenLabs Rachel recordings.
// Uploads directly to R2 — does NOT touch Ryan/Alex files or manifest.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const FISH_KEY    = process.env.FISH_AUDIO_API_KEY;
const SOFIA_VOICE = '836513f294d64aec8403226e69268b1b'; // Fish Audio — same as Lesson 1
const R2_BUCKET   = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX   = 'lessons/lesson2/audio';
const OUT_DIR     = path.join(__dirname, '..', 'lesson2_audio');

if (!FISH_KEY) { console.error('FISH_AUDIO_API_KEY missing'); process.exit(1); }
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SOFIA_LINES = [
  // seg03
  { file: 'sofia_s03_01.mp3', text: "...something you probably wouldn't understand." },
  { file: 'sofia_s03_02.mp3', text: '...a piece on coastal erosion.' },
  { file: 'sofia_s03_03.mp3', text: '...I grew up here. You notice things when you grow up somewhere.' },
  { file: 'sofia_s03_04.mp3', text: "...you're not going to pretend you find coastal erosion interesting, are you?" },
  { file: 'sofia_s03_05.mp3', text: '...hm.' },
  // seg05
  { file: 'sofia_s05_01.mp3', text: "I don't usually talk to strangers." },
  { file: 'sofia_s05_02.mp3', text: '...you caught me in a weak moment.' },
  { file: 'sofia_s05_03.mp3', text: "...that's a convenient interpretation." },
  { file: 'sofia_s05_04.mp3', text: "...you do that a lot, don't you. Flip things." },
  { file: 'sofia_s05_05.mp3', text: "...and you think mine didn't?" },
  // seg07
  { file: 'sofia_s07_01.mp3', text: "You're very sure of yourself." },
  { file: 'sofia_s07_02.mp3', text: '...I bet it has.' },
  { file: 'sofia_s07_03.mp3', text: '...how do you figure?' },
  { file: 'sofia_s07_04.mp3', text: '...barely.' },
  { file: 'sofia_s07_05.mp3', text: "...you're strange." },
  { file: 'sofia_s07_06.mp3', text: '...oh god.' },
  // seg09
  { file: 'sofia_s09_01.mp3', text: "...it's quiet here." },
  { file: 'sofia_s09_02.mp3', text: "...I don't know. I just like it." },
  { file: 'sofia_s09_03.mp3', text: '...the tide line is always different. It changes.' },
  { file: 'sofia_s09_04.mp3', text: "...I guess yeah. Things that stay exactly the same start to feel dead." },
  { file: 'sofia_s09_05.mp3', text: '...what?' },
  { file: 'sofia_s09_06.mp3', text: '...I almost did.' },
  // seg11
  { file: 'sofia_s11_01.mp3', text: "...you don't have to." },
  { file: 'sofia_s11_02.mp3', text: '...I can take a break.' },
  { file: 'sofia_s11_03.mp3', text: '...disappearance. How things go. Slowly, and you don\'t notice until they\'re gone.' },
  { file: 'sofia_s11_04.mp3', text: "...it's not really a pitch." },
  { file: 'sofia_s11_05.mp3', text: '...okay.' },
];

async function fishTTS(text, filename, attempt = 1) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FISH_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, reference_id: SOFIA_VOICE, format: 'mp3', streaming: false, temperature: 0.7 }),
    });
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`HTTP ${res.status}: ${e.slice(0, 120)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null };
  } catch (e) {
    if (attempt === 1) { await sleep(2000); return fishTTS(text, filename, 2); }
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message };
  }
}

async function uploadR2(filename) {
  const filePath = path.join(OUT_DIR, filename);
  if (!fs.existsSync(filePath)) return { file: filename, ok: false, err: 'local file missing' };
  try {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${R2_PREFIX}/${filename}`,
      Body: fs.readFileSync(filePath),
      ContentType: 'audio/mpeg',
    }));
    return { file: filename, ok: true };
  } catch (e) {
    return { file: filename, ok: false, err: e.message };
  }
}

(async () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' LESSON 2 — RE-RECORD SOFIA (Fish Audio, voice match Lesson 1)');
  console.log(`  Voice ID: ${SOFIA_VOICE}`);
  console.log(`  Files:    ${SOFIA_LINES.length}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];

  for (let i = 0; i < SOFIA_LINES.length; i++) {
    if (i > 0) await sleep(1000);
    const { file, text } = SOFIA_LINES[i];
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${SOFIA_LINES.length}] ${file} ...`);
    const r = await fishTTS(text, file);
    process.stdout.write(r.error ? ` FAIL: ${r.error}\n` : ` ${r.kb} KB (${r.ms}ms)\n`);
    results.push(r);
  }

  const ttsOk  = results.filter(r => !r.error);
  const ttsFail = results.filter(r =>  r.error);

  console.log(`\nTTS: ${ttsOk.length}/${SOFIA_LINES.length} OK${ttsFail.length ? '  FAILED: ' + ttsFail.map(r => r.file).join(', ') : ''}`);

  if (ttsFail.length > 0) { console.error('Aborting R2 upload — fix TTS failures first'); process.exit(1); }

  console.log('\n── Uploading to R2 (parallel) ─────────────────────────────────');
  const r2Results = await Promise.all(ttsOk.map(r => uploadR2(r.file)));
  r2Results.forEach(({ file, ok, err }) => console.log(`  ${file}: ${ok ? 'OK' : 'FAIL: ' + err}`));

  const r2Fail = r2Results.filter(r => !r.ok);
  console.log(`\nR2: ${r2Results.length - r2Fail.length}/${r2Results.length} uploaded`);

  if (r2Fail.length > 0) { console.error('R2 upload failures — check above'); process.exit(1); }

  console.log('\n✓ All Sofia files re-recorded and uploaded. Manifest unchanged.\n');
})();
