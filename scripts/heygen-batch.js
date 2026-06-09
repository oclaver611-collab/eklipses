// ============================================================
// EKLIPSES — fal.ai / Kling Avatar Batch Generator
// Usage: node scripts/heygen-batch.js camille priya ingrid
// ============================================================

require('dotenv').config();
const fs           = require('fs');
const path         = require('path');
const https        = require('https');
const { execSync } = require('child_process');

const FAL_KEY            = process.env.FAL_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const RACHEL_VOICE_ID    = '21m00Tcm4TlvDq8ikWAM';
const R2_BUCKET          = 'eklipses-videos';
const PHOTOS_DIR         = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'dames');
const OUTPUT_DIR         = path.join(__dirname, 'heygen-output');
const DONE_FILE          = path.join(__dirname, 'heygen-done.json');

const AVATAR_MODEL = 'fal-ai/kling-video/ai-avatar/v2/standard';
const IDLE_MODEL   = 'fal-ai/kling-video/v2.1/standard/image-to-video';
const IDLE_PROMPT  = 'eyes open and alive, natural micro-blinking only, soft focus gaze forward, subtle breathing, slight natural head movement, hair gently moving, calm and present expression, photorealistic portrait, eyes never fully close';

// ── Character definitions ─────────────────────────────────────
const CHARACTERS = [
  { name: 'camille',   speaking: "Paris taught me that the best conversations happen after midnight — lucky for you, I have nowhere else to be.",          idle: "Mm, vraiment." },
  { name: 'priya',     speaking: "I could talk about stars all night, but honestly, I'd rather just talk about you.",                                       idle: "Tell me more." },
  { name: 'valentina', speaking: "Life is too short for boring conversations, and you are anything but boring.",                                             idle: "Interesante." },
  { name: 'mei',       speaking: "There's something quietly beautiful about the way you think — I notice these things.",                                     idle: "Mm, yes." },
  { name: 'amara',     speaking: "The best part of my day? Right now, talking to you.",                                                                      idle: "I'm listening." },
  { name: 'ingrid',    speaking: "I don't waste words on people who aren't worth it — so take that as a compliment.",                                        idle: "Fair enough." },
  { name: 'solene',    speaking: "Every story has a twist — I have a feeling yours is going to be unforgettable.",                                           idle: "Curious." },
  { name: 'keiko',     speaking: "I think you're exactly the kind of person I was hoping to find here.",                                                     idle: "So kind." },
  { name: 'rania',     speaking: "Intelligence is the most attractive thing in the world — you clearly have it.",                                            idle: "Of course." },
  { name: 'bianca',    speaking: "You know what I love? People who actually say what they mean — it's refreshing.",                                          idle: "Bello." },
  { name: 'chloe',     speaking: "Okay, I'll be honest — this is already way more interesting than I expected.",                                             idle: "Ha, really?" },
  { name: 'nour',      speaking: "Some conversations feel like they were always meant to happen — this is one of them.",                                      idle: "Subhanallah." },
  { name: 'astrid',    speaking: "I don't do small talk, but I have a feeling you're not here for that either.",                                             idle: "Interesting." },
  { name: 'layla',     speaking: "Every night I wonder who's out there thinking the same thoughts as me — maybe it's you.",                                  idle: "Dreaming." },
  { name: 'ines',      speaking: "People forget that listening is an art — and you, you seem to understand that.",                                           idle: "Sí, claro." },
  { name: 'zara',      speaking: "I don't know who told you this was going to be an ordinary evening, but they lied.",                                       idle: "Exactly that." },
  { name: 'talia',     speaking: "I've been told I have a gift for reading people — and you're fascinating to read.",                                        idle: "Fascinating." },
  { name: 'miriam',    speaking: "The world is full of people who talk — I'm more interested in who's actually listening.",                                  idle: "C'est vrai." },
  { name: 'suki',      speaking: "I have a theory that the best people are always a little bit unpredictable — prove me right.",                             idle: "Cheeky." },
  { name: 'cara',      speaking: "I've always thought good company is the greatest luxury — and you're proving my point.",                                    idle: "Go on." },
  { name: 'elif',      speaking: "Istanbul taught me that beauty and depth always go together — I see that in you.",                                          idle: "Exactly." },
  { name: 'hana',      speaking: "I don't usually open up this quickly, but something about you makes it easy.",                                             idle: "Really?" },
  { name: 'lucia',     speaking: "There's something about you that makes me want to stay in this conversation forever.",                                      idle: "Dios mío." },
  { name: 'dina',      speaking: "I'm not easily impressed, but here I am — genuinely impressed.",                                                           idle: "Da, konechno." },
  { name: 'moana',     speaking: "The ocean taught me to be patient — but I don't want to be patient with this, I want to know you now.",                    idle: "E kala mai." },
  { name: 'petra',     speaking: "People always underestimate the quiet ones — lucky for you, I see right through that.",                                    idle: "Precisely." },
  { name: 'yuki',      speaking: "There's a kind of peace I feel in this moment — I hope you feel it too.",                                                  idle: "So still." },
  { name: 'aisha',     speaking: "You want to know what strength looks like? Start by looking at the people you choose to let in.",                           idle: "Mashallah." },
  { name: 'fiona',     speaking: "I've sat through enough dull evenings to know when something special is happening — this is it.",                          idle: "Aye, truly." },
  { name: 'celeste',   speaking: "Some nights feel like they were made for exactly this kind of conversation — don't you think?",                            idle: "Mmm, oui." },
  { name: 'naomi',     speaking: "I think the most attractive thing about you is that you actually pay attention.",                                           idle: "That's it." },
  { name: 'zola',      speaking: "My grandmother used to say the right person makes even silence feel like music — I think I understand that now.",           idle: "Ubuntu." },
  { name: 'imani',     speaking: "There is something powerful about a conversation where both people are fully present — that's what this is.",              idle: "Absolutely." },
  { name: 'nia',       speaking: "I believe every person carries a story worth hearing — I'd love to hear yours.",                                            idle: "Tell me." },
  { name: 'cleo',      speaking: "The most powerful thing in any room is a mind that knows its own worth — I see you know yours.",                            idle: "Naturally." },
  { name: 'sage',      speaking: "I've learned that the people who ask better questions are always the most interesting ones.",                               idle: "Fair point." },
  { name: 'amira',     speaking: "You have the kind of energy that makes people feel seen — that's a rare gift.",                                             idle: "Vraiment." },
  { name: 'jade',      speaking: "I'm selective about who gets my real attention — consider yourself selected.",                                              idle: "Indeed." },
  { name: 'solange',   speaking: "Art taught me that the most beautiful things take time to reveal themselves — I feel that with you.",                       idle: "Mm, oui." },
  { name: 'kaia',      speaking: "I think happiness finds the people who know how to be still — you seem like one of those people.",                         idle: "Aloha." },
];

// ── Helpers ───────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`); }
function err(msg) { console.error(`[ERROR] ${msg}`); }
const pause = ms => new Promise(r => setTimeout(r, ms));

function loadDone() {
  if (!fs.existsSync(DONE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DONE_FILE, 'utf8')); }
  catch { return {}; }
}

function markDone(done, name) {
  done[name] = new Date().toISOString();
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
}

// Generic HTTPS request returning parsed JSON
function httpsJSON(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const data   = body ? JSON.stringify(body) : null;
    const parsed = new URL(urlStr);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 400)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Bad JSON (HTTP ${res.statusCode}): ${raw.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function falHeaders(extra = {}) {
  return { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json', ...extra };
}

// ── ElevenLabs TTS ────────────────────────────────────────────
async function generateTTS(text, outputPath) {
  log('  TTS: generating audio...');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    });
    const options = {
      hostname: 'api.elevenlabs.io',
      path:     `/v1/text-to-speech/${RACHEL_VOICE_ID}`,
      method:   'POST',
      headers: {
        'xi-api-key':     ELEVENLABS_API_KEY,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept':         'audio/mpeg',
      },
    };
    const file = fs.createWriteStream(outputPath);
    const req  = https.request(options, res => {
      if (res.statusCode !== 200) {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => reject(new Error(`ElevenLabs HTTP ${res.statusCode}: ${raw.slice(0, 200)}`)));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── fal.ai storage upload ────────────────────────────────────
async function falUpload(filePath, contentType) {
  const fileName = path.basename(filePath);
  log(`  fal upload: ${fileName}`);

  // Step 1 — request a presigned PUT URL
  const initRes = await httpsJSON(
    'POST',
    'https://rest.alpha.fal.ai/storage/upload/initiate',
    falHeaders(),
    { content_type: contentType, file_name: fileName },
  );
  const { upload_url, file_url } = initRes;
  if (!upload_url || !file_url) throw new Error('fal upload initiate failed: ' + JSON.stringify(initRes));

  // Step 2 — PUT the raw file to the presigned URL
  const fileData  = fs.readFileSync(filePath);
  const putParsed = new URL(upload_url);
  await new Promise((resolve, reject) => {
    const opts = {
      hostname: putParsed.hostname,
      path:     putParsed.pathname + putParsed.search,
      method:   'PUT',
      headers:  { 'Content-Type': contentType, 'Content-Length': fileData.length },
    };
    const req = https.request(opts, res => {
      res.resume();
      if (res.statusCode >= 200 && res.statusCode < 300) resolve();
      else reject(new Error(`PUT failed HTTP ${res.statusCode}`));
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });

  log(`  fal upload done: ${file_url.slice(0, 80)}...`);
  return file_url;
}

// ── fal.ai queue: submit + poll ──────────────────────────────
async function falSubmit(modelId, input) {
  const res = await httpsJSON(
    'POST',
    `https://queue.fal.run/${modelId}`,
    falHeaders(),
    input,
  );
  log(`  Submit raw: ${JSON.stringify(res).slice(0, 300)}`);
  if (!res.request_id) throw new Error(`No request_id from ${modelId}: ` + JSON.stringify(res).slice(0, 300));
  log(`  Submitted → ${res.request_id.slice(0, 8)}...`);
  return res; // full response — contains status_url and response_url
}

// submitRes is the full object returned by falSubmit
async function falPoll(submitRes, modelId, maxMs = 600000) {
  const requestId = submitRes.request_id;
  const shortId   = requestId.slice(0, 8);
  // prefer the URLs fal.ai gave us; fall back to constructing them
  const pollUrl   = submitRes.status_url   || `https://queue.fal.run/${modelId}/requests/${requestId}/status`;
  const resultUrl = submitRes.response_url || `https://queue.fal.run/${modelId}/requests/${requestId}`;
  log(`  Polling ${shortId} → ${pollUrl}`);
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await pause(10000);
    const statusRes = await httpsJSON('GET', pollUrl, falHeaders(), null);
    const status = statusRes.status;
    log(`  Poll ${shortId}: ${status}`);
    if (status === 'COMPLETED') {
      return httpsJSON('GET', resultUrl, falHeaders(), null);
    }
    if (status === 'FAILED') throw new Error(`Job ${shortId} failed: ` + JSON.stringify(statusRes).slice(0, 300));
  }
  throw new Error(`Timeout: ${requestId}`);
}

function extractVideoUrl(result) {
  return result?.video?.url
      || result?.output?.video?.url
      || result?.outputs?.[0]?.url
      || result?.video_url
      || result?.output?.video_url;
}

// ── Download + local utils ────────────────────────────────────
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

function extractThumb(videoPath, thumbPath) {
  try {
    execSync(`ffmpeg -y -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 2 "${thumbPath}"`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function uploadToR2(localPath, r2Key) {
  log(`  R2: ${r2Key}`);
  execSync(`wrangler r2 object put ${R2_BUCKET}/${r2Key} --file="${localPath}" --remote`, { stdio: 'inherit' });
}

// ── Per-character pipeline ────────────────────────────────────
async function processCharacter(char, { idleOnly = false } = {}) {
  const { name, speaking } = char;
  const capName    = name.charAt(0).toUpperCase() + name.slice(1);
  const photoPath  = path.join(PHOTOS_DIR, `${capName}.png`);
  const audioPath  = path.join(OUTPUT_DIR, `${name}_speaking.mp3`);
  const speakLocal = path.join(OUTPUT_DIR, `${name}_speaking.mp4`);
  const idleLocal  = path.join(OUTPUT_DIR, `${name}_idle.mp4`);
  const thumbLocal = path.join(OUTPUT_DIR, `${name}_thumb.jpg`);

  if (!fs.existsSync(photoPath)) throw new Error(`Photo not found: ${photoPath}`);
  log(`Photo: ${photoPath}${idleOnly ? ' [idle-only]' : ''}`);

  if (idleOnly) {
    // ── Idle-only path ──────────────────────────────────────────
    log('  Uploading photo to fal.ai...');
    const imageUrl   = await falUpload(photoPath, 'image/png');

    log('  Submitting idle video (Kling img2vid)...');
    const idleSubmit = await falSubmit(IDLE_MODEL, {
      image_url:    imageUrl,
      prompt:       IDLE_PROMPT,
      duration:     '5',
      aspect_ratio: '16:9',
    });

    log('  Polling idle video...');
    const idleResult = await falPoll(idleSubmit, IDLE_MODEL);
    const idleUrl    = extractVideoUrl(idleResult);
    if (!idleUrl) throw new Error('No video URL in idle result: ' + JSON.stringify(idleResult).slice(0, 300));
    log(`  Idle URL: ${idleUrl.slice(0, 80)}...`);

    log('  Downloading idle...');
    await downloadFile(idleUrl, idleLocal);

    log('  Extracting thumbnail...');
    if (!extractThumb(idleLocal, thumbLocal)) {
      log('  ffmpeg unavailable — copying photo as thumb');
      fs.copyFileSync(photoPath, thumbLocal);
    }

    log('  Uploading to R2...');
    uploadToR2(idleLocal,  `${name}_idle.mp4`);
    uploadToR2(thumbLocal, `${name}_thumb.jpg`);

    log(`  Done (idle-only): ${name}`);
    return;
  }

  // ── Full pipeline ───────────────────────────────────────────
  // Step 1 — ElevenLabs TTS
  await generateTTS(speaking, audioPath);
  log(`  Audio saved: ${audioPath}`);

  // Step 2 — Upload photo + audio to fal.ai storage
  log('  Uploading assets to fal.ai...');
  const [imageUrl, audioUrl] = await Promise.all([
    falUpload(photoPath, 'image/png'),
    falUpload(audioPath, 'audio/mpeg'),
  ]);

  // Step 3 — Submit both video jobs
  log('  Submitting speaking video (Kling Avatar)...');
  const speakSubmit = await falSubmit(AVATAR_MODEL, {
    image_url: imageUrl,
    audio_url: audioUrl,
  });

  log('  Submitting idle video (Kling img2vid)...');
  const idleSubmit = await falSubmit(IDLE_MODEL, {
    image_url:    imageUrl,
    prompt:       IDLE_PROMPT,
    duration:     '5',
    aspect_ratio: '16:9',
  });

  // Step 4 — Poll both in parallel
  log('  Polling both videos...');
  const [speakResult, idleResult] = await Promise.all([
    falPoll(speakSubmit, AVATAR_MODEL),
    falPoll(idleSubmit,  IDLE_MODEL),
  ]);

  const speakUrl = extractVideoUrl(speakResult);
  const idleUrl  = extractVideoUrl(idleResult);
  if (!speakUrl) throw new Error('No video URL in speaking result: ' + JSON.stringify(speakResult).slice(0, 300));
  if (!idleUrl)  throw new Error('No video URL in idle result: '     + JSON.stringify(idleResult).slice(0, 300));
  log(`  Speaking URL: ${speakUrl.slice(0, 80)}...`);
  log(`  Idle URL:     ${idleUrl.slice(0, 80)}...`);

  // Step 5 — Download
  log('  Downloading speaking...');
  await downloadFile(speakUrl, speakLocal);
  log('  Downloading idle...');
  await downloadFile(idleUrl, idleLocal);

  // Step 6 — Thumbnail
  log('  Extracting thumbnail...');
  if (!extractThumb(speakLocal, thumbLocal)) {
    log('  ffmpeg unavailable — copying photo as thumb');
    fs.copyFileSync(photoPath, thumbLocal);
  }

  // Step 7 — R2 upload
  log('  Uploading to R2...');
  uploadToR2(speakLocal, `${name}_speaking.mp4`);
  uploadToR2(idleLocal,  `${name}_idle.mp4`);
  uploadToR2(thumbLocal, `${name}_thumb.jpg`);

  log(`  Done: ${name}`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  if (!FAL_KEY)            { err('FAL_KEY not set in .env');            process.exit(1); }
  if (!ELEVENLABS_API_KEY) { err('ELEVENLABS_API_KEY not set in .env'); process.exit(1); }

  const args     = process.argv.slice(2);
  const idleOnly = args.includes('--idle-only');
  const names    = args.filter(a => !a.startsWith('--')).map(n => n.toLowerCase());

  if (names.length === 0) {
    err('Usage: node scripts/heygen-batch.js <name> [name...] [--idle-only]');
    err(`Available: ${CHARACTERS.map(c => c.name).join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const done = loadDone();

  const queue = [];
  for (const name of names) {
    if (!idleOnly && done[name]) { log(`SKIP ${name} — already completed ${done[name]}`); continue; }
    const char = CHARACTERS.find(c => c.name === name);
    if (!char) { err(`Unknown character: ${name}`); process.exit(1); }
    queue.push(char);
  }

  if (queue.length === 0) { log('Nothing to do — all requested characters already completed.'); return; }

  log(`\nProcessing ${queue.length} character(s): ${queue.map(c => c.name).join(', ')}${idleOnly ? ' [idle-only]' : ''}\n`);

  for (const char of queue) {
    log(`\n=== ${char.name.toUpperCase()} ===`);
    try {
      await processCharacter(char, { idleOnly });
      if (!idleOnly) markDone(done, char.name);
    } catch (e) {
      err(`Failed ${char.name}: ${e.message}`);
      log('Continuing with next character...');
    }
  }

  log('\n=== BATCH COMPLETE ===');
  log(`Done file: ${DONE_FILE}`);
}

main().catch(e => { err(e.message); process.exit(1); });
