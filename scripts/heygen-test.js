// ============================================================
// EKLIPSES — HeyGen Test (Sanna only) v2
// Fixed: upload uses raw binary body, not multipart
// Usage: node scripts/heygen-test.js
// ============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const R2_BUCKET      = 'eklipses-videos';
const PHOTOS_DIR     = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'dames');
const OUTPUT_DIR     = path.join(__dirname, 'heygen-output');

const CHAR = {
  name:     'sanna',
  photo:    'Sanna.png',
  speaking: "The view up here is worth it. Whether the crowd is — still deciding.",
  idle:     "Mm. Interesting.",
};

// ── Helpers ───────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); }
function err(msg) { console.error(`[ERROR] ${msg}`); }
const pause = ms => new Promise(r => setTimeout(r, ms));

async function heygenAPI(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.heygen.com',
      path:     endpoint,
      method,
      headers: {
        'X-Api-Key':    HEYGEN_API_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON: ' + raw.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Upload raw binary — correct format for HeyGen upload API
async function uploadAsset(filePath) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const ext      = path.extname(filePath).slice(1).toLowerCase();
    const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';

    const options = {
      hostname: 'upload.heygen.com',
      path:     '/v1/talking_photo',
      method:   'POST',
      headers: {
        'X-Api-Key':      HEYGEN_API_KEY,
        'Content-Type':   mimeType,
        'Content-Length': fileData.length,
      },
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        log(`  Upload HTTP ${res.statusCode}: ${raw.slice(0, 300)}`);
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Upload parse error: ' + raw.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function generateVideo(talkingPhotoId, script, voiceId) {
  const body = {
    video_inputs: [{
      character: {
        type:             'talking_photo',
        talking_photo_id: talkingPhotoId,
      },
      voice: {
        type:       'text',
        input_text: script,
        voice_id:   voiceId,
      },
    }],
    dimension:           { width: 1280, height: 720 },
    aspect_ratio:        '16:9',
    // Avatar V — no use_avatar_iv_model flag
  };
  return heygenAPI('POST', '/v2/video/generate', body);
}

async function pollVideo(videoId, maxMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await pause(8000);
    const res    = await heygenAPI('GET', `/v1/video_status.get?video_id=${videoId}`);
    const status = res?.data?.status;
    log(`  Poll ${videoId}: ${status}`);
    if (status === 'completed') return res.data.video_url;
    if (status === 'failed')    throw new Error('Video failed: ' + JSON.stringify(res.data));
  }
  throw new Error('Timeout: ' + videoId);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get  = u => {
      const mod = u.startsWith('https') ? require('https') : require('http');
      mod.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302) { get(res.headers.location); return; }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    get(url);
  });
}

function uploadToR2(localPath, r2Key) {
  log(`  R2: ${r2Key}`);
  execSync(`wrangler r2 object put ${R2_BUCKET}/${r2Key} --file="${localPath}" --remote`, { stdio: 'inherit' });
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  if (!HEYGEN_API_KEY) { err('HEYGEN_API_KEY not in .env'); process.exit(1); }
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  log('=== HEYGEN TEST — SANNA ONLY v2 ===');

  const photoPath = path.join(PHOTOS_DIR, CHAR.photo);
  if (!fs.existsSync(photoPath)) { err(`Photo not found: ${photoPath}`); process.exit(1); }
  log(`Photo: ${photoPath}`);

  // Step 1 — Upload photo
  log('Step 1: Uploading photo...');
  const uploadRes = await uploadAsset(photoPath);
  const imageKey  = uploadRes?.data?.talking_photo_id
                 || uploadRes?.data?.image_key
                 || uploadRes?.data?.asset_id
                 || uploadRes?.talking_photo_id
                 || uploadRes?.image_key;
  if (!imageKey) { err('No talking_photo_id. Full response: ' + JSON.stringify(uploadRes)); process.exit(1); }
  log(`talking_photo_id: ${imageKey}`);

  // Step 2 — Get a real voice ID
  log('Step 2: Fetching voices...');
  let voiceId;
  try {
    const vRes   = await heygenAPI('GET', '/v2/voices', null);
    const voices = vRes?.data?.voices || [];
    const female = voices.find(v => v.gender === 'female' && (v.language || '').toLowerCase().includes('english'));
    const first  = voices[0];
    voiceId      = female?.voice_id || first?.voice_id;
    log(`Voice: ${(female || first)?.name} (${voiceId})`);
  } catch(e) {
    err('Could not fetch voices: ' + e.message);
    process.exit(1);
  }

  // Step 3 — Speaking video
  log('Step 3: Generating speaking video...');
  const speakRes = await generateVideo(imageKey, CHAR.speaking, voiceId);
  log('Generate response: ' + JSON.stringify(speakRes));
  const speakId  = speakRes?.data?.video_id;
  if (!speakId) { err('No video_id'); process.exit(1); }
  const speakUrl = await pollVideo(speakId);
  log(`Speaking ready: ${speakUrl.slice(0, 80)}...`);

  // Step 4 — Idle video
  log('Step 4: Generating idle video...');
  const idleRes = await generateVideo(imageKey, CHAR.idle, voiceId);
  const idleId  = idleRes?.data?.video_id;
  if (!idleId) { err('No video_id for idle'); process.exit(1); }
  const idleUrl = await pollVideo(idleId);
  log(`Idle ready: ${idleUrl.slice(0, 80)}...`);

  // Step 5 — Download
  const speakLocal = path.join(OUTPUT_DIR, 'sanna_speaking_v5test.mp4');
  const idleLocal  = path.join(OUTPUT_DIR, 'sanna_idle_v5test.mp4');
  log('Step 5: Downloading...');
  await downloadFile(speakUrl, speakLocal);
  log(`Saved: ${speakLocal}`);
  await downloadFile(idleUrl, idleLocal);
  log(`Saved: ${idleLocal}`);

  // Step 6 — skipped, comparison test only
  log('');
  log('=== AVATAR V API TEST DONE ✅ ===');
  log('Compare these two files locally:');
  log(`  IV: ${path.join(OUTPUT_DIR, 'sanna_speaking.mp4')}`);
  log(`  V:  ${speakLocal}`);
}

main().catch(e => { err(e.message); process.exit(1); });
