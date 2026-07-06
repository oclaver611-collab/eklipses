require('dotenv').config({ path: '.env.local' });
const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const OUT_DIR     = path.join(__dirname, 'lesson1_audio_v2');
const FISH_KEY    = process.env.FISH_AUDIO_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const RYAN_VOICE  = '44b996214285427697767cb469793647';
const SOFIA_VOICE = '836513f294d64aec8403226e69268b1b';
const R2_BUCKET   = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX   = 'lessons/lesson1/audio_v2';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── SEGMENTS ─────────────────────────────────────────────────────────────────

const RYAN_LINES = [
  {
    file: 'ryan_seg01.mp3',
    text: "You've probably seen a hundred videos like this. [pause] Guy explains how to talk to women. Makes it sound simple. You watch, you feel inspired — and then nothing changes. [pause] Because watching someone else do it never made anyone better at anything. [pause] This is different. [pause] After this lesson, you're not going to close a YouTube tab and go back to your life. You're going to practice — right here, right now — with some of the most beautiful women you've ever seen. Different personalities. Different ethnicities. Different energies. Some warm, some cold, some playful, some guarded. [pause] Real conversations. Real reactions. And zero consequences. [pause] No anxiety about approaching. No fear of rejection. No going home wondering what you should have said. You get to try it, fail, learn, and try again — as many times as you want. [pause] Nobody else is offering this. This is not a video. This is a gym. [pause] Now — watch closely. I'll show you exactly what to do. And then you'll go do it yourself. [pause] Let's begin.",
  },
  {
    file: 'ryan_seg02.mp3',
    text: "Before I walk over, look at what I'm NOT doing. [pause] I'm not rehearsing a line. I'm not waiting for the perfect moment. I'm not asking myself if she'll like me. [pause] I'm just looking at her. Actually looking. Finding something real to say. [pause] That's it. That's the whole preparation. [pause] Most guys stand there frozen, planning the perfect opener — and by the time they're ready, the moment is gone. They killed it themselves. [pause] You don't need the perfect line. You need one real thing you actually noticed. [pause] I've got mine. Watch.",
  },
  {
    file: 'ryan_seg04.mp3',
    text: "Stop. [pause] Did you see what just happened? [pause] He didn't say you're beautiful. He didn't say you have nice eyes. He found one specific thing — her hairstyle — and he said something real about it. [pause] That's Step 1. The observation opener. [pause] Don't compliment her looks. Find one specific thing you actually noticed. Could be her hairstyle, her outfit, a bracelet, her accent, her style — anything real. [pause] Lines you can use right now — [pause] Excuse me, that jacket is amazing — where did you get it? [pause] Let me guess where you're from. Italian? No wait — French? [pause] That hairstyle is actually incredible — where do you get it done? [pause] Simple. Specific. Real. [pause] She feels noticed — not hit on. That's the difference. [pause] Step 1 — done. Let's keep going.",
  },
  {
    file: 'ryan_seg06.mp3',
    text: "Did you feel the difference? [pause] The conversation just changed. [pause] It's not two strangers being polite anymore. There's something happening. [pause] That's what playful challenge does. Alex didn't agree with everything she said. He pushed back — lightly, without being mean. [pause] That's Step 2. [pause] Don't go along with everything. When she says something, don't just nod. React. Challenge it a little. Stay curious. [pause] Examples — [pause] She says I don't really talk to strangers. You say that's funny, you seem like exactly the kind of person who would. [pause] She says I'm not that interesting. You say people who say that are always the most interesting. [pause] But here's the important part. [pause] Once she's laughing, once she's engaged — you stop. You don't keep pushing. [pause] Teasing too much makes you predictable. You become the guy trying too hard to be funny. [pause] Light the fuse. Then let it burn. [pause] Step 2 — done.",
  },
  {
    file: 'ryan_seg08.mp3',
    text: "She asked about his job. Simple question. [pause] Most guys answer immediately — full job title, company name, how long they've been there. Everything. [pause] And the moment they do that, something dies. Not because the job is bad. Because of what that answer says about them. [pause] It says — I need you to approve of me. [pause] Alex didn't do that. He deflected — lightly, with a smile — and flipped it back on her. [pause] That's Step 3. Own your mystery. [pause] Don't give everything away the moment she asks. Answer in a way that shows you're comfortable — and leaves her wanting to know more. [pause] Try this — she asks where you work, you say somewhere that lets me be here on a Tuesday afternoon — that's all you need to know for now. [pause] She asks if you have a girlfriend, you say that's a very specific question for someone I just met. [pause] She asks how old you are, you say guess — I won't take it personally. [pause] You're not lying. You're not being rude. [pause] You're just not auditioning. [pause] Step 3 — done.",
  },
  {
    file: 'ryan_seg10.mp3',
    text: "Notice what Alex just did. [pause] He didn't say I like you. He didn't say you're beautiful. He said something that meant both of those things — without saying either. [pause] That's the verbal spike. [pause] Women don't respond to what you say. They respond to what you mean. And they feel the difference immediately. [pause] When you say you're beautiful — she hears it, files it away, moves on. She's heard it a hundred times today. [pause] But when you say something that implies it — something specific, something that shows you actually paid attention — she feels it. That's different. [pause] Try this — instead of I think you're amazing, say I don't usually stop what I'm doing for anyone — just so you know. [pause] Instead of I like talking to you, say this is the most interesting conversation I've had all week — and I wasn't expecting that. [pause] You're not announcing your feelings. You're letting her feel them. [pause] That gap — between what you say and what you mean — that's where attraction lives. [pause] Step 4 — done.",
  },
  {
    file: 'ryan_seg12.mp3',
    text: "You think the close is the hardest part. [pause] It's not. [pause] If you did everything before this right — the observation opener, the playful challenge, the mystery, the verbal spike — by the time you ask for her number, she's already interested. You're not asking a stranger for a favour. You're offering a natural next step. [pause] Most guys blow this moment. [pause] They build up to it nervously. They drop hints and hope she figures it out. They ask in a way that sounds like an apology. [pause] Don't do that. [pause] Be direct. Keep it light. No pressure. [pause] I'd like to continue this somewhere that isn't here — coffee, a drink, whatever works for you. [pause] That's it. Simple. Clean. [pause] And when she says yes — don't celebrate. Don't say amazing, great, awesome. Stay in the same frame you've been in the whole conversation. [pause] Comfortable. Slightly playful. In control of yourself. [pause] The close is not a moment you survive. It's a moment you lead. [pause] Step 5 — done.",
  },
  {
    file: 'ryan_seg13.mp3',
    text: "That's the full approach. [pause] Let me give you the five steps one more time. [pause] Step 1 — the observation opener. Don't compliment her looks. Find one specific thing you actually noticed and say something real about it. [pause] Step 2 — playful challenge. Don't agree with everything. Push back lightly. Create some friction. Then stop once she's engaged. [pause] Step 3 — own your mystery. Don't give everything away the moment she asks. Stay comfortable. Leave her wanting to know more. [pause] Step 4 — the verbal spike. Don't announce your interest. Make her feel it through what you imply — not what you state. [pause] Step 5 — the natural close. Direct. Light. No pressure. No apology. Lead the moment. [pause] Now — here's how you remember all five. [pause] One Tequila Makes Ideas Click. [pause] One — observe something specific. Tequila — tease playfully. Makes — mystery, don't give everything away. Ideas — imply your interest. Click — close naturally. [pause] Say it once. You'll never forget it. [pause] Now here's the thing. [pause] Watching this was the easy part. [pause] The women are waiting for you right now. Different faces, different personalities, different energies. Some will be warm. Some will test you. Some will push back hard. [pause] That's the point. [pause] You don't get better by watching. You get better by doing. [pause] Go. Try it. Fail. Learn. Try again. [pause] That's how this works.",
  },
];

const SOFIA_LINES = [
  { file: 'sofia_s03_01.mp3', text: '...oh. Thank you.' },
  { file: 'sofia_s03_02.mp3', text: 'Just my usual place, nothing special.' },
  { file: 'sofia_s03_03.mp3', text: '...Sofia. Nice to meet you.' },
  { file: 'sofia_s05_01.mp3', text: '...just thoughts. Nothing interesting.' },
  { file: 'sofia_s05_02.mp3', text: '...or maybe it really is nothing.' },
  { file: 'sofia_s05_03.mp3', text: '...maybe.' },
  { file: 'sofia_s07_01.mp3', text: 'So what do you do?' },
  { file: 'sofia_s07_02.mp3', text: "...that's convenient." },
  { file: 'sofia_s07_03.mp3', text: 'I asked first.' },
  { file: 'sofia_s07_04.mp3', text: '...maybe.' },
  { file: 'sofia_s09_01.mp3', text: '...what?' },
  { file: 'sofia_s09_02.mp3', text: '...is that a bad thing?' },
  { file: 'sofia_s09_03.mp3', text: "...you're very observant." },
  { file: 'sofia_s09_04.mp3', text: '...okay.' },
  { file: 'sofia_s11_01.mp3', text: '...is that a complaint?' },
  { file: 'sofia_s11_02.mp3', text: "...yeah. I'd like that." },
  { file: 'sofia_s11_03.mp3', text: '...direct.' },
  { file: 'sofia_s11_04.mp3', text: '...maybe I do.' },
];

const ALEX_LINES = [
  { file: 'alex_s03_01.mp3', text: 'Hey — sorry, one second.' },
  { file: 'alex_s03_02.mp3', text: 'That hairstyle... where do you get it done?' },
  { file: 'alex_s03_03.mp3', text: "No seriously, it's actually really good." },
  { file: 'alex_s03_04.mp3', text: "Nothing special — it looks incredible though." },
  { file: 'alex_s03_05.mp3', text: "I'm Alex by the way." },
  { file: 'alex_s05_01.mp3', text: 'So what are you writing?' },
  { file: 'alex_s05_02.mp3', text: 'People who say nothing interesting are always writing something very interesting.' },
  { file: 'alex_s05_03.mp3', text: "You're very good at keeping secrets." },
  { file: 'alex_s05_04.mp3', text: 'I like that actually.' },
  { file: 'alex_s07_01.mp3', text: "Something I never explain on a beach — it kills the mood immediately." },
  { file: 'alex_s07_02.mp3', text: 'It really is. What about you?' },
  { file: 'alex_s07_03.mp3', text: "Okay — I'll tell you over coffee. Deal?" },
  { file: 'alex_s09_01.mp3', text: 'You know what I noticed about you from over there?' },
  { file: 'alex_s09_02.mp3', text: "You looked completely fine being alone. Not waiting for anyone. Not checking your phone. Just... present." },
  { file: 'alex_s09_03.mp3', text: "No. It's rare. Most people can't do that." },
  { file: 'alex_s09_04.mp3', text: "Only when something's worth observing." },
  { file: 'alex_s11_01.mp3', text: "I have to be honest — I didn't plan to spend twenty minutes talking to someone on a beach today." },
  { file: 'alex_s11_02.mp3', text: "No. Opposite actually. Look — I'd like to continue this somewhere that isn't a beach. Coffee, a drink, whatever works for you." },
  { file: 'alex_s11_03.mp3', text: 'Good. Give me your number.' },
  { file: 'alex_s11_04.mp3', text: 'You seem like someone who appreciates that.' },
];

// Playback order for exchange segments — used in manifest
const EXCHANGE_SEQUENCES = {
  '03': [
    { file: 'alex_s03_01.mp3', voice: 'alex' },
    { file: 'alex_s03_02.mp3', voice: 'alex' },
    { file: 'alex_s03_03.mp3', voice: 'alex' },
    { file: 'sofia_s03_01.mp3', voice: 'sofia' },
    { file: 'sofia_s03_02.mp3', voice: 'sofia' },
    { file: 'alex_s03_04.mp3', voice: 'alex' },
    { file: 'alex_s03_05.mp3', voice: 'alex' },
    { file: 'sofia_s03_03.mp3', voice: 'sofia' },
  ],
  '05': [
    { file: 'alex_s05_01.mp3', voice: 'alex' },
    { file: 'sofia_s05_01.mp3', voice: 'sofia' },
    { file: 'alex_s05_02.mp3', voice: 'alex' },
    { file: 'sofia_s05_02.mp3', voice: 'sofia' },
    { file: 'alex_s05_03.mp3', voice: 'alex' },
    { file: 'sofia_s05_03.mp3', voice: 'sofia' },
    { file: 'alex_s05_04.mp3', voice: 'alex' },
  ],
  '07': [
    { file: 'sofia_s07_01.mp3', voice: 'sofia' },
    { file: 'alex_s07_01.mp3', voice: 'alex' },
    { file: 'sofia_s07_02.mp3', voice: 'sofia' },
    { file: 'alex_s07_02.mp3', voice: 'alex' },
    { file: 'sofia_s07_03.mp3', voice: 'sofia' },
    { file: 'alex_s07_03.mp3', voice: 'alex' },
    { file: 'sofia_s07_04.mp3', voice: 'sofia' },
  ],
  '09': [
    { file: 'alex_s09_01.mp3', voice: 'alex' },
    { file: 'sofia_s09_01.mp3', voice: 'sofia' },
    { file: 'alex_s09_02.mp3', voice: 'alex' },
    { file: 'sofia_s09_02.mp3', voice: 'sofia' },
    { file: 'alex_s09_03.mp3', voice: 'alex' },
    { file: 'sofia_s09_03.mp3', voice: 'sofia' },
    { file: 'alex_s09_04.mp3', voice: 'alex' },
    { file: 'sofia_s09_04.mp3', voice: 'sofia' },
  ],
  '11': [
    { file: 'alex_s11_01.mp3', voice: 'alex' },
    { file: 'sofia_s11_01.mp3', voice: 'sofia' },
    { file: 'alex_s11_02.mp3', voice: 'alex' },
    { file: 'sofia_s11_02.mp3', voice: 'sofia' },
    { file: 'alex_s11_03.mp3', voice: 'alex' },
    { file: 'sofia_s11_03.mp3', voice: 'sofia' },
    { file: 'alex_s11_04.mp3', voice: 'alex' },
    { file: 'sofia_s11_04.mp3', voice: 'sofia' },
  ],
};

// ─── TTS FUNCTIONS ────────────────────────────────────────────────────────────

async function fishTTS(text, voiceId, filename, attempt = 1) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FISH_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, reference_id: voiceId, format: 'mp3', streaming: false, temperature: 0.7 }),
    });
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`HTTP ${res.status}: ${e.slice(0, 100)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null, r2: false };
  } catch (e) {
    if (attempt === 1) {
      process.stdout.write(` RETRY...`);
      await sleep(2000);
      return fishTTS(text, voiceId, filename, 2);
    }
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message, r2: false };
  }
}

async function openaiTTS(text, filename, attempt = 1) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'echo', input: text, response_format: 'mp3' }),
    });
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`HTTP ${res.status}: ${e.slice(0, 100)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null, r2: false };
  } catch (e) {
    if (attempt === 1) {
      await sleep(2000);
      return openaiTTS(text, filename, 2);
    }
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message, r2: false };
  }
}

async function uploadR2(filename) {
  const filePath = path.join(OUT_DIR, filename);
  if (!fs.existsSync(filePath)) return { file: filename, r2: false, r2Error: 'local file missing' };
  try {
    const body = fs.readFileSync(filePath);
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${R2_PREFIX}/${filename}`,
      Body: body,
      ContentType: 'audio/mpeg',
    }));
    return { file: filename, r2: true, r2Error: null };
  } catch (e) {
    return { file: filename, r2: false, r2Error: e.message };
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

(async () => {
  const allResults = {};

  // ── 1. Ryan (Fish Audio, sequential, 1s pause) ────────────────────────────
  console.log(`\n── Ryan (Fish Audio, ${RYAN_LINES.length} segments) ─────────────────────────────────`);
  for (let i = 0; i < RYAN_LINES.length; i++) {
    if (i > 0) await sleep(1000);
    const { file, text } = RYAN_LINES[i];
    process.stdout.write(`  ${file} ...`);
    const r = await fishTTS(text, RYAN_VOICE, file);
    process.stdout.write(r.error ? ` FAIL: ${r.error}\n` : ` ${r.kb} KB (${r.ms}ms)\n`);
    allResults[file] = r;
  }

  // ── 2. Sofia (Fish Audio, sequential, 1s pause) ───────────────────────────
  console.log(`\n── Sofia (Fish Audio, ${SOFIA_LINES.length} lines) ──────────────────────────────────`);
  for (let i = 0; i < SOFIA_LINES.length; i++) {
    await sleep(1000);
    const { file, text } = SOFIA_LINES[i];
    process.stdout.write(`  ${file} ...`);
    const r = await fishTTS(text, SOFIA_VOICE, file);
    process.stdout.write(r.error ? ` FAIL: ${r.error}\n` : ` ${r.kb} KB (${r.ms}ms)\n`);
    allResults[file] = r;
  }

  // ── 3. Alex (OpenAI, all parallel) ───────────────────────────────────────
  console.log(`\n── Alex (OpenAI tts-1-hd/echo, ${ALEX_LINES.length} lines, parallel) ───────────────`);
  const alexResults = await Promise.all(ALEX_LINES.map(({ file, text }) => openaiTTS(text, file)));
  alexResults.forEach(r => {
    console.log(`  ${r.file}: ${r.error ? 'FAIL: ' + r.error : r.kb + ' KB (' + r.ms + 'ms)'}`);
    allResults[r.file] = r;
  });

  // ── 4. Upload all to R2 (parallel, includes manifest) ───────────────────
  console.log('\n── Uploading to R2 (parallel) ──────────────────────────────────');
  const allFileNames = [
    ...RYAN_LINES.map(l => l.file),
    ...SOFIA_LINES.map(l => l.file),
    ...ALEX_LINES.map(l => l.file),
  ];
  const r2Results = await Promise.all(allFileNames.map(uploadR2));
  r2Results.forEach(({ file, r2, r2Error }) => {
    console.log(`  ${file}: ${r2 ? 'OK' : 'FAIL: ' + r2Error}`);
    if (allResults[file]) allResults[file].r2 = r2;
  });

  // ── 5. Write manifest ─────────────────────────────────────────────────────
  const mk = f => ({ file: f, voice: f.startsWith('ryan') ? 'ryan' : f.startsWith('alex') ? 'alex' : 'sofia', r2Key: `${R2_PREFIX}/${f}` });
  const manifest = {
    version: '2',
    generatedAt: new Date().toISOString(),
    segments: [
      { segmentId: '01', type: 'coaching',  files:    [mk('ryan_seg01.mp3')] },
      { segmentId: '02', type: 'coaching',  files:    [mk('ryan_seg02.mp3')] },
      { segmentId: '03', type: 'exchange',  sequence: EXCHANGE_SEQUENCES['03'].map(e => ({ ...e, r2Key: `${R2_PREFIX}/${e.file}` })) },
      { segmentId: '04', type: 'coaching',  files:    [mk('ryan_seg04.mp3')] },
      { segmentId: '05', type: 'exchange',  sequence: EXCHANGE_SEQUENCES['05'].map(e => ({ ...e, r2Key: `${R2_PREFIX}/${e.file}` })) },
      { segmentId: '06', type: 'coaching',  files:    [mk('ryan_seg06.mp3')] },
      { segmentId: '07', type: 'exchange',  sequence: EXCHANGE_SEQUENCES['07'].map(e => ({ ...e, r2Key: `${R2_PREFIX}/${e.file}` })) },
      { segmentId: '08', type: 'coaching',  files:    [mk('ryan_seg08.mp3')] },
      { segmentId: '09', type: 'exchange',  sequence: EXCHANGE_SEQUENCES['09'].map(e => ({ ...e, r2Key: `${R2_PREFIX}/${e.file}` })) },
      { segmentId: '10', type: 'coaching',  files:    [mk('ryan_seg10.mp3')] },
      { segmentId: '11', type: 'exchange',  sequence: EXCHANGE_SEQUENCES['11'].map(e => ({ ...e, r2Key: `${R2_PREFIX}/${e.file}` })) },
      { segmentId: '12', type: 'coaching',  files:    [mk('ryan_seg12.mp3')] },
      { segmentId: '13', type: 'coaching',  files:    [mk('ryan_seg13.mp3')] },
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nmanifest.json written → lesson1_audio_v2/manifest.json');

  // Upload manifest to R2 so the lesson player can fetch it via /api/lesson-audio?file=manifest.json
  try {
    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         `${R2_PREFIX}/manifest.json`,
      Body:        fs.readFileSync(path.join(OUT_DIR, 'manifest.json')),
      ContentType: 'application/json',
    }));
    console.log('manifest.json uploaded → R2: ' + R2_PREFIX + '/manifest.json');
  } catch (e) {
    console.error('manifest R2 upload FAILED:', e.message);
  }

  // ── 6. Summary table ──────────────────────────────────────────────────────
  const all  = allFileNames.map(f => allResults[f] || { file: f, kb: null, ms: null, error: 'not recorded', r2: false });
  const ok   = all.filter(r => !r.error);
  const errs = all.filter(r =>  r.error);
  const r2ok = all.filter(r =>  r.r2);

  console.log('\n┌───────────────────────┬────────┬────────┬──────┬──────┐');
  console.log('│ File                  │   KB   │   ms   │ TTS  │  R2  │');
  console.log('├───────────────────────┼────────┼────────┼──────┼──────┤');
  for (const r of all) {
    const f = r.file.padEnd(21);
    const k = (r.kb  ?? '—').toString().padStart(4);
    const m = (r.ms  ?? '—').toString().padStart(6);
    const t = r.error ? 'FAIL' : 'OK  ';
    const u = r.r2   ? 'OK  ' : 'FAIL';
    console.log(`│ ${f} │ ${k}   │ ${m} │ ${t} │ ${u} │`);
  }
  console.log('└───────────────────────┴────────┴────────┴──────┴──────┘');
  console.log(`\n  TTS ${ok.length}/${all.length} OK   R2 ${r2ok.length}/${all.length} uploaded   ${errs.length} error(s)`);

  // ── 7. Write DONE.md ──────────────────────────────────────────────────────
  const fileLines = all.map(r =>
    `- ${r.file}  ${r.kb ? r.kb + ' KB' : 'FAILED'}  R2:${r.r2 ? 'OK' : 'FAIL'}`
  ).join('\n');

  const failLines = errs.length
    ? errs.map(r => `- ${r.file}: ${r.error}`).join('\n')
    : 'None.';

  const r2FailLines = all.filter(r => !r.r2 && !r.error).map(r => `- ${r.file}`).join('\n') || 'None.';

  const doneText = `# DONE — July 5, 2026

## Summary
${ok.length} files generated, ${r2ok.length} uploaded to R2, ${errs.length} TTS failure(s).

## Files generated
${fileLines}

## R2 upload status
All uploaded: ${r2ok.length === all.length ? 'YES' : 'NO'}
R2 path: lessons/lesson1/audio_v2/
R2 failures:
${r2FailLines}

## Manifest
lesson1_audio_v2/manifest.json — lists all ${all.length} files with r2Keys under lessons/lesson1/audio_v2/

## NEEDS MANUAL REVIEW — Serge
1. Spot check these files locally:
   - ryan_seg01.mp3 — does it sound clean, no hallucinated words?
   - alex_s03_01.mp3 — does Alex sound natural and casual?
   - sofia_s03_01.mp3 — does Sofia sound natural?
   - ryan_seg13.mp3 — does "One Tequila Makes Ideas Click" land well?
2. Confirm all files are in R2 under lessons/lesson1/audio_v2/
3. Come back with approval — we then update the lesson player to use audio_v2

## Failures / retries
${failLines}
`;

  fs.writeFileSync(path.join(__dirname, 'DONE.md'), doneText);
  console.log('DONE.md written.');
})();
