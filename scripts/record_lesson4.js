require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const OUT_DIR     = path.join(__dirname, '..', 'lesson4_audio');
const FISH_KEY    = process.env.FISH_AUDIO_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const RYAN_VOICE  = '44b996214285427697767cb469793647';   // Fish Audio — same voice as L1/L2/L3
const SOFIA_VOICE = '836513f294d64aec8403226e69268b1b';   // Fish Audio — same voice as L1/L2/L3
const R2_BUCKET   = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX   = 'lessons/lesson4/audio';

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

// ─── SEGMENT SCRIPTS ──────────────────────────────────────────────────────────

const RYAN_LINES = [
  {
    file: 'ryan_seg00.mp3',
    text: "Lesson 4. If you've done the first three lessons, you know how to start a conversation — and how to hold it when things get difficult. What you might still feel, even with all of that, is a quiet anxiety that hits when things go quiet. The feeling of running out of things to say. That's the most common thing men describe to me. I don't know what to say next. And here's what I want you to hear about that: it's almost never true. She has been talking this entire time. In every sentence she speaks, she's offering you threads — topics, details, emotions she's handing you to pull on. The problem isn't a lack of material. The problem is that most men aren't listening at the right level. This lesson teaches you to listen that way. What you're about to learn is CHAIN. Five principles for keeping a conversation alive from the inside — not by generating new content, but by going deeper into what she's already given you. Watch what that looks like when someone gets it wrong first.",
  },
  {
    file: 'ryan_seg02.mp3',
    text: "Let's go back. Sofia said one sentence. I want you to count what she put in it. She said: I haven't been here in ages — my friend used to work here — she moved to Amsterdam — got this job she'd been going after for three years. That's three threads. The bar — her relationship with this place, what it means that she hasn't been back. The friend — who she is, what happened, what it meant for Sofia when she left. The job pursuit — three years going after something, still going back after every rejection. Alex picked one thread. The most obvious one. He asked about the bar. She gave a short answer. He tried to extend it. She gave another short answer. Then he jumped to a new topic entirely. Here's what that does. When you pick a thread and use it up in one closed question, it's gone. There's nothing left to pull from it. And when you jump to a new topic, she knows you weren't actually listening — you were waiting for a pause. He didn't run out of things to say. He ran out of attention.",
  },
  {
    file: 'ryan_seg04.mp3',
    text: "C and H happen before you speak. That's the part most men skip. Most men are already forming their response while she's still talking. Catch means stop doing that. Let the whole sentence land. Hear all of it — not just the main point, but the detail she added after, the thing she mentioned and then moved past, the word that didn't quite fit the rest of the sentence. Those details are usually where the most interesting threads live. Then Hook. You choose which thread to pull. And the instinct is almost always to pick the safe, obvious one — the one that's easiest to talk about, the one where you already know where it goes. That's usually the wrong one. The richest thread is the one with the most charge in it — the thing she said differently, with more or less energy than everything else, the detail that wasn't necessary but she included anyway. Go there. She put it in for a reason.",
  },
  {
    file: 'ryan_seg06.mp3',
    text: "He stayed on the same thread. Not to a new topic — one more layer into the same one. That's Ask deeper. And notice what it does. When someone keeps following what you said instead of moving to their own agenda, something shifts. The conversation stops feeling like a transaction and starts feeling like you're actually being listened to. The other move is Inject. A conversation that only moves in one direction — where one person asks and the other answers and there's no genuine contribution going the other way — starts to feel like an interview. When Alex shared something from his own life that connected to what Sofia said, he wasn't redirecting the conversation. He was adding to it. He contributed something real that built on where she already was. That changed things. The conversation became mutual. And mutual conversations are the ones that actually go somewhere.",
  },
  {
    file: 'ryan_seg08.mp3',
    text: "She said one thing — almost as an aside — and then moved on immediately. She probably expected no one to track it. She might not have fully meant to say it. Alex caught it. And then, later in the conversation, in a completely different part of it, he came back. You said something a few minutes ago. I keep thinking about it. Watch what that does to her. She pauses. She wasn't expecting that. Because most people track themselves in a conversation — their own next thought, their own comfort, their own performance. Alex tracked her. When you return to something she said — not because it was interesting to you, but because it seemed like it might matter to her — she feels something most conversations never give anyone. The experience of being actually listened to. Not heard. Listened to. She'll know the difference.",
  },
  {
    file: 'ryan_seg09.mp3',
    text: "That's CHAIN. One more time. C — Catch threads. Let the full sentence land before you respond. Hear all of it — the main point and the things she added after. H — Hook the richest. Don't pick the obvious thread. Pick the one with the most charge — the detail she almost didn't include, the word that didn't quite match everything else. A — Ask deeper. Go one layer further on the same thread — not to a new topic, into this one. I — Inject yourself. Share something real that connects to what she said. Brief. Genuine. It makes the conversation mutual — and mutual conversations are the only ones that actually mean something. N — Never abandon a live thread. If she lit up when she said something — or went quieter, or moved past it a little too fast — come back. She'll know you were listening in a way that most conversations never give her. The conversation that never runs dry isn't the one where you said the most interesting things. It's the one where she felt most understood. She gave you everything you needed. You just had to catch it. She's talking. Go catch it.",
  },
];

const ALEX_LINES = [
  // seg01 — Threading fail (bad example: picks surface thread, closed question, topic-hops)
  { file: 'alex_s01_01.mp3', text: "Oh — do you miss coming here?" },
  { file: 'alex_s01_02.mp3', text: "When did she move?" },
  { file: 'alex_s01_03.mp3', text: "So what do you do yourself?" },

  // seg03 — C and H in action (good: picks richest thread, goes deeper)
  { file: 'alex_s03_01.mp3', text: "Three years going after the same thing. What made her stick with it that long?" },
  { file: 'alex_s03_02.mp3', text: "What does that actually look like — wanting something that much?" },
  { file: 'alex_s03_03.mp3', text: "That takes something." },

  // seg05 — A and I in action (good: asks one layer deeper, injects self briefly)
  { file: 'alex_s05_01.mp3', text: "What was it like when she left?" },
  { file: 'alex_s05_02.mp3', text: "I had someone go to Berlin two years ago. Different situation. But I know that feeling — you don't realize how much of your life is built around someone being in a specific place." },
  { file: 'alex_s05_03.mp3', text: "What do you miss most? Not about her — about how things were when she was here." },

  // seg07 — N in action (good: notes offhand remark, returns to it later)
  { file: 'alex_s07_01.mp3', text: "What makes you say that?" },
  { file: 'alex_s07_02.mp3', text: "About three years. Came for work, stayed because it was easier." },
  { file: 'alex_s07_03.mp3', text: "You said something a few minutes ago. That you should probably find somewhere else to drink." },
  { file: 'alex_s07_04.mp3', text: "What did you mean?" },
  { file: 'alex_s07_05.mp3', text: "What's wrong with easy?" },
];

const SOFIA_LINES = [
  // seg01 — Threading fail (bad example)
  { file: 'sofia_s01_01.mp3', text: "I haven't been here in ages, actually. My friend used to work here — she moved to Amsterdam. Got this job she'd been going after for three years." },
  { file: 'sofia_s01_02.mp3', text: "...a bit. It's a good spot." },
  { file: 'sofia_s01_03.mp3', text: "...last autumn." },
  { file: 'sofia_s01_04.mp3', text: "...I work in research. What about you?" },

  // seg03 — C and H in action (good example)
  { file: 'sofia_s03_01.mp3', text: "I haven't been here in ages, actually. My friend used to work here — she moved to Amsterdam. Got this job she'd been going after for three years." },
  { file: 'sofia_s03_02.mp3', text: "...she just really wanted it. More than most people want things, I think." },
  { file: 'sofia_s03_03.mp3', text: "...she applied four times. Got rejected every time. Just kept going back." },

  // seg05 — A and I in action (good example)
  { file: 'sofia_s05_01.mp3', text: "...she didn't even know if she'd like it there. She just knew she had to find out." },
  { file: 'sofia_s05_02.mp3', text: "...weird. Good for her, obviously. We'd just been in the same city for so long. You get used to someone being around." },
  { file: 'sofia_s05_03.mp3', text: "...exactly. You don't notice it until it's gone." },
  { file: 'sofia_s05_04.mp3', text: "...having someone nearby who already knows the context. You don't have to explain everything." },

  // seg07 — N in action (thread return)
  { file: 'sofia_s07_01.mp3', text: "...I should probably find somewhere else to drink." },
  { file: 'sofia_s07_02.mp3', text: "...I don't know. Anyway — have you been in this area long?" },
  { file: 'sofia_s07_03.mp3', text: "...that's usually how it goes." },
  { file: 'sofia_s07_04.mp3', text: "...did I?" },
  { file: 'sofia_s07_05.mp3', text: "...I come here too much, I think. It's just easy." },
  { file: 'sofia_s07_06.mp3', text: "...I don't know. Sometimes easy starts to feel like stuck." },
];

const EXCHANGE_SEQUENCES = {
  '01': [
    { file: 'sofia_s01_01.mp3', voice: 'sofia' },
    { file: 'alex_s01_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s01_02.mp3', voice: 'sofia' },
    { file: 'alex_s01_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s01_03.mp3', voice: 'sofia' },
    { file: 'alex_s01_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s01_04.mp3', voice: 'sofia' },
  ],
  '03': [
    { file: 'sofia_s03_01.mp3', voice: 'sofia' },
    { file: 'alex_s03_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s03_02.mp3', voice: 'sofia' },
    { file: 'alex_s03_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s03_03.mp3', voice: 'sofia' },
    { file: 'alex_s03_03.mp3',  voice: 'alex'  },
  ],
  '05': [
    { file: 'sofia_s05_01.mp3', voice: 'sofia' },
    { file: 'alex_s05_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s05_02.mp3', voice: 'sofia' },
    { file: 'alex_s05_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s05_03.mp3', voice: 'sofia' },
    { file: 'alex_s05_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s05_04.mp3', voice: 'sofia' },
  ],
  '07': [
    { file: 'sofia_s07_01.mp3', voice: 'sofia' },
    { file: 'alex_s07_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s07_02.mp3', voice: 'sofia' },
    { file: 'alex_s07_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s07_03.mp3', voice: 'sofia' },
    { file: 'alex_s07_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s07_04.mp3', voice: 'sofia' },
    { file: 'alex_s07_04.mp3',  voice: 'alex'  },
    { file: 'sofia_s07_05.mp3', voice: 'sofia' },
    { file: 'alex_s07_05.mp3',  voice: 'alex'  },
    { file: 'sofia_s07_06.mp3', voice: 'sofia' },
  ],
};

// ─── TTS FUNCTIONS ────────────────────────────────────────────────────────────

async function fishTTS(text, voiceId, filename, attempt = 1) {
  const t0 = Date.now();
  const clean = text.replace(/\.\.\./g, '').replace(/^\.+/, '').trim();
  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FISH_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, reference_id: voiceId, format: 'mp3', streaming: false, temperature: 0.7 }),
    });
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`HTTP ${res.status}: ${e.slice(0, 100)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null };
  } catch (e) {
    if (attempt === 1) { await sleep(2000); return fishTTS(text, voiceId, filename, 2); }
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message };
  }
}

async function openaiTTS(text, filename, attempt = 1) {
  const t0 = Date.now();
  const clean = text.replace(/\.\.\./g, '').replace(/^\.+/, '').trim();
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'onyx', input: clean, response_format: 'mp3' }),
    });
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`HTTP ${res.status}: ${e.slice(0, 100)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null };
  } catch (e) {
    if (attempt === 1) { await sleep(2000); return openaiTTS(text, filename, 2); }
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message };
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
      ContentType: filename.endsWith('.json') ? 'application/json' : 'audio/mpeg',
    }));
    return { file: filename, r2: true, r2Error: null };
  } catch (e) {
    return { file: filename, r2: false, r2Error: e.message };
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' LESSON 4 AUDIO PIPELINE — "The Thread" (CHAIN)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!FISH_KEY)   { console.error('FISH_AUDIO_API_KEY missing'); process.exit(1); }
  if (!OPENAI_KEY) { console.error('OPENAI_API_KEY missing'); process.exit(1); }

  const allResults = {};

  // ── 1. Ryan (Fish Audio, sequential) ─────────────────────────────────────
  console.log(`── Ryan (Fish Audio ${RYAN_VOICE.slice(0,8)}…, ${RYAN_LINES.length} coaching segments) ───────────`);
  for (let i = 0; i < RYAN_LINES.length; i++) {
    if (i > 0) await sleep(1000);
    const { file, text } = RYAN_LINES[i];
    process.stdout.write(`  ${file} ...`);
    const r = await fishTTS(text, RYAN_VOICE, file);
    process.stdout.write(r.error ? ` FAIL: ${r.error}\n` : ` ${r.kb} KB (${r.ms}ms)\n`);
    allResults[file] = r;
  }

  // ── 2. Alex (OpenAI tts-1-hd/onyx, parallel) ─────────────────────────────
  console.log(`\n── Alex (OpenAI tts-1-hd onyx, ${ALEX_LINES.length} lines, parallel) ─────────────────`);
  const alexResults = await Promise.all(ALEX_LINES.map(({ file, text }) => openaiTTS(text, file)));
  alexResults.forEach(r => {
    console.log(`  ${r.file}: ${r.error ? 'FAIL: ' + r.error : r.kb + ' KB (' + r.ms + 'ms)'}`);
    allResults[r.file] = r;
  });

  // ── 3. Sofia (Fish Audio, sequential) ─────────────────────────────────────
  console.log(`\n── Sofia (Fish Audio ${SOFIA_VOICE.slice(0,8)}…, ${SOFIA_LINES.length} lines, sequential) ──────`);
  for (let i = 0; i < SOFIA_LINES.length; i++) {
    if (i > 0) await sleep(1000);
    const { file, text } = SOFIA_LINES[i];
    process.stdout.write(`  ${file} ...`);
    const r = await fishTTS(text, SOFIA_VOICE, file);
    process.stdout.write(r.error ? ` FAIL: ${r.error}\n` : ` ${r.kb} KB (${r.ms}ms)\n`);
    allResults[r.file] = r;
  }

  // ── 4. Write manifest ─────────────────────────────────────────────────────
  const mk = (f, v) => ({ file: f, voice: v });
  const manifest = {
    version: '1',
    lesson: '4',
    title: 'The Thread',
    mnemonic: 'CHAIN',
    generatedAt: new Date().toISOString(),
    segments: [
      { segmentId: '00', type: 'coaching', title: 'Welcome',                files:    [mk('ryan_seg00.mp3', 'ryan')] },
      { segmentId: '01', type: 'exchange', title: 'Watch — Threading Fail', sequence: EXCHANGE_SEQUENCES['01'] },
      { segmentId: '02', type: 'coaching', title: 'What Just Happened',     files:    [mk('ryan_seg02.mp3', 'ryan')] },
      { segmentId: '03', type: 'exchange', title: 'Watch — C and H',        sequence: EXCHANGE_SEQUENCES['03'] },
      { segmentId: '04', type: 'coaching', title: 'C — Catch · H — Hook',   files:    [mk('ryan_seg04.mp3', 'ryan')] },
      { segmentId: '05', type: 'exchange', title: 'Watch — A and I',        sequence: EXCHANGE_SEQUENCES['05'] },
      { segmentId: '06', type: 'coaching', title: 'A — Ask · I — Inject',   files:    [mk('ryan_seg06.mp3', 'ryan')] },
      { segmentId: '07', type: 'exchange', title: 'Watch — N',              sequence: EXCHANGE_SEQUENCES['07'] },
      { segmentId: '08', type: 'coaching', title: 'N — Never Abandon',      files:    [mk('ryan_seg08.mp3', 'ryan')] },
      { segmentId: '09', type: 'coaching', title: 'Your Five Steps',        files:    [mk('ryan_seg09.mp3', 'ryan')] },
    ],
  };

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nmanifest.json written → lesson4_audio/manifest.json');

  // ── 5. Upload all to R2 ───────────────────────────────────────────────────
  console.log('\n── Uploading to R2 (parallel) ──────────────────────────────────');
  const allFileNames = [
    ...RYAN_LINES.map(l => l.file),
    ...ALEX_LINES.map(l => l.file),
    ...SOFIA_LINES.map(l => l.file),
    'manifest.json',
  ];
  const r2Results = await Promise.all(allFileNames.map(uploadR2));
  r2Results.forEach(({ file, r2, r2Error }) => {
    console.log(`  ${file}: ${r2 ? 'OK' : 'FAIL: ' + r2Error}`);
    if (allResults[file]) allResults[file].r2 = r2;
  });

  // ── 6. Summary ────────────────────────────────────────────────────────────
  const audioFiles  = Object.keys(allResults).length;
  const failedTTS   = Object.values(allResults).filter(r => r.error).map(r => r.file);
  const failedR2    = r2Results.filter(r => !r.r2).map(r => r.file);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(` SUMMARY: ${audioFiles} audio files + manifest.json`);
  console.log(`  Ryan (Fish Audio):   ${RYAN_LINES.length} files`);
  console.log(`  Alex (OpenAI onyx):  ${ALEX_LINES.length} files`);
  console.log(`  Sofia (Fish Audio):  ${SOFIA_LINES.length} files`);
  console.log(`  TTS failures:        ${failedTTS.length === 0 ? 'none' : failedTTS.join(', ')}`);
  console.log(`  R2 failures:         ${failedR2.length === 0 ? 'none' : failedR2.join(', ')}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failedTTS.length > 0 || failedR2.length > 0) process.exit(1);
})();
