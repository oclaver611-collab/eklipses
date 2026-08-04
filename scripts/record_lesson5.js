require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const OUT_DIR     = path.join(__dirname, '..', 'lesson5_audio');
const FISH_KEY    = process.env.FISH_AUDIO_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const RYAN_VOICE  = '44b996214285427697767cb469793647';   // Fish Audio — same voice as L1–L4
const SOFIA_VOICE = '836513f294d64aec8403226e69268b1b';   // Fish Audio — same voice as L1–L4
const R2_BUCKET   = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX   = 'lessons/lesson5/audio';

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
    text: "Lesson 5. If you've done the first four, here's where you are. You can start a conversation — the approach, the opener, the close. You can hold your ground when she tests you — the frame, the reframe, the exit. You can pace yourself when things go well — not rushing what needs time. And you can sustain a conversation for as long as it needs to run, going deeper into what she gives you rather than hunting for new material. That's a complete skill set. And yet — conversations still end without going anywhere. The person you were talking to was interested, and you left. Or you moved before there was anything real there, and she pulled back. The thing you were missing in both cases is the same. You couldn't read the difference between someone who's enjoying talking to you and someone who wants more than the talking. That difference isn't vague. It isn't a gut feeling you either have or don't. It is a specific set of behavioral signals — documented, observed in real settings, catalogued in peer-reviewed research. She has been sending them your entire life. You just weren't taught what they look like. This lesson teaches you what they look like. What you're about to learn is TRACE.",
  },
  {
    file: 'ryan_seg01.mp3',
    text: "Here's the research. Monica Moore spent time watching women in real social settings — bars, cafes, bookstores, libraries — and catalogued fifty-two distinct nonverbal behaviors women emit specifically when they're interested. Not when they're being friendly. When they're interested. Things like eye contact that holds two or three beats past where most people look away. Moving closer than the physical space or the conversation required. Posture that starts to echo the person she's talking to without any apparent reason. A brief touch on the arm that wasn't necessary. These signals are real. They're documented. And they're not random — they cluster. One of these in twenty minutes means nothing. Three from different categories in twenty minutes means something specific. That's the most important finding in Moore's work: signal frequency and variety, not any single signal, predicted whether an approach would succeed. The second piece of research matters as much. Grammer and his team studied whether men could actually detect these signals in real interactions. The answer was barely above chance. Not because men are inattentive. Because no one ever told them what to pay attention to. The gap between what she's emitting and what he's receiving is exactly the gap this lesson closes.",
  },
  {
    file: 'ryan_seg03.mp3',
    text: "Let's go back through that. From the moment they were talking, Sofia was sending him signals. He just wasn't reading them. Track gaze first. When she said 'I notice specific things' — she held eye contact for two or three beats past where most people break it. That's not conversational attention. Conversational eye contact follows speech. It breaks when the sentence ends or when the speaker looks away. What she did held after the sentence ended, into the silence after. That's the first signal. Register proximity next. When she asked about the book, she moved. Not because the aisle was crowded. Because distance felt like too much. She put herself beside him — close enough to look at what he was holding — with no conversational justification for closing that space. He stood exactly where he was and answered the question about the book. He didn't register that she had just voluntarily cut the distance between them by more than half. Two signals in the first few minutes of talking. He didn't see either of them. Watch what changes when he does.",
  },
  {
    file: 'ryan_seg05.mp3',
    text: "Watch what happens over the next few minutes. Sofia's posture starts to change. When Alex leans back against the shelf, her angle shifts — not all the way, not dramatically. She just moves into the same lean. When he shifts his weight, a minute or so later, she shifts hers. She isn't doing this on purpose. Chartrand and Bargh documented this in a study called the chameleon effect — people unconsciously mirror the posture, pace, and gesture of people they feel positively toward. It operates below the level of conscious awareness. She cannot feel herself doing it. The practical test is simple: change your posture slightly, then wait. If she mirrors it within a minute, that's a signal. Attend to alignment — A. The fourth signal is the touch. When she made a point about the book — she put her hand on his forearm for a half second, then released it. She didn't have to make contact there. Nothing in the conversation required it. She chose to, briefly, and let go. That is not an accident. Accidental contact is pulled back from. Deliberate contact settles into, however briefly, before releasing. Gaze. Proximity. Alignment. Touch. In one fifteen-minute conversation. That is not noise. That is a cluster.",
  },
  {
    file: 'ryan_seg07.mp3',
    text: "That was Enter on the cluster. And notice what it wasn't. It wasn't a setup. It wasn't a speech about how much he'd enjoyed the conversation or how rare it was to meet someone like her. It wasn't a question — 'can I get your number?' — which introduces doubt and transfers the weight of the decision to her. It was one sentence. A statement. Unhurried. Unambiguous. He wasn't nervous because he wasn't guessing. He had tracked the signals, confirmed the cluster, and now he was acting on what was real. The trap most men fall into after reading the signals correctly is continuing to read. They want a sixth signal, or a seventh, or a cleaner moment that will make the move feel more natural than the last one. That moment doesn't arrive. What arrives is her phone buzzing, or someone else joining the conversation, or just the natural end of the scene. The signals don't accumulate forever. There's a window — and it opens when the cluster is confirmed. Once you have three or more signals across different categories inside twenty minutes, that's the window. You enter it. One move. Direct. Unhurried. You don't explain why. You don't apologize for it. You just act on what you know.",
  },
  {
    file: 'ryan_seg09.mp3',
    text: "That's TRACE. One more time. T — Track gaze. Sustained eye contact that holds past the end of a sentence, past the end of a silence, past where most people look away. That's not conversational attention. That's a signal. R — Register proximity. She moved closer than the space or the conversation required. That move has a reason. Log it. A — Attend to alignment. Her posture echoes yours without any coordination — the lean, the pace, the angle. The chameleon effect only operates toward people she's drawn to. C — Catch touch initiation. Any contact she made that she didn't have to make. Brief. Deliberate. Not a correction, not an accident. A signal. E — Enter once you see the cluster. Three or more of these in a twenty-minute window is not noise. It's a confirmed read. One direct, unhurried move. Statement, not question. You act on what you know. She has been doing this the whole time — every woman who was interested in you, in every conversation you walked away from wondering. She was leaning closer, holding your eye contact a beat longer than she needed to, touching your arm when she didn't have to. And most men never saw it. Not because they weren't paying attention. Because no one told them what to pay attention to. Now you know. That's the whole lesson. Go practice. She's already in there.",
  },
];

const ALEX_LINES = [
  // seg02 — The Missed Read (bad example: doesn't register signals, ends the conversation)
  { file: 'alex_s02_01.mp3', text: "That's a specific thing to notice about a writer." },
  { file: 'alex_s02_02.mp3', text: "What kind of work are you in?" },
  { file: 'alex_s02_03.mp3', text: "It was next to something I was actually looking for." },
  { file: 'alex_s02_04.mp3', text: "Yeah, probably. I should make a decision before the shop closes." },
  { file: 'alex_s02_05.mp3', text: "Good to talk to you." },

  // seg04 — Catching T and R (good: holds gaze, doesn't move back when she closes distance)
  { file: 'alex_s04_01.mp3', text: "That's a specific thing to notice about a writer." },
  { file: 'alex_s04_02.mp3', text: "What kind of work are you in?" },
  { file: 'alex_s04_03.mp3', text: "It was next to something I was actually looking for." },
  { file: 'alex_s04_04.mp3', text: "What are you in here for?" },

  // seg06 — Reading the Full Cluster (good: registers all four signals, confirms cluster)
  { file: 'alex_s06_01.mp3', text: "You always know before you ask." },
  { file: 'alex_s06_02.mp3', text: "What made you want to work in architecture in the first place?" },
  { file: 'alex_s06_03.mp3', text: "That's a good reason." },

  // seg08 — The Window (good: enters before the window closes)
  { file: 'alex_s08_01.mp3', text: "I want to keep talking to you. What's your number." },
  { file: 'alex_s08_02.mp3', text: "It wasn't. I've been deciding for a few minutes." },
  { file: 'alex_s08_03.mp3', text: "Good." },
];

const SOFIA_LINES = [
  // seg02 — The Missed Read (bad example)
  { file: 'sofia_s02_01.mp3', text: "...I like how he builds silence into the sentences." },
  { file: 'sofia_s02_02.mp3', text: "I notice specific things." },
  { file: 'sofia_s02_03.mp3', text: "...architecture. What made you pick that one up?" },
  { file: 'sofia_s02_04.mp3', text: "That's how you find the good ones." },
  { file: 'sofia_s02_05.mp3', text: "...right." },
  { file: 'sofia_s02_06.mp3', text: "...you too." },

  // seg04 — Catching T and R (good example)
  { file: 'sofia_s04_01.mp3', text: "...I like how he builds silence into the sentences." },
  { file: 'sofia_s04_02.mp3', text: "I notice specific things." },
  { file: 'sofia_s04_03.mp3', text: "...architecture. What made you pick that one up?" },
  { file: 'sofia_s04_04.mp3', text: "That's how you find the good ones." },
  { file: 'sofia_s04_05.mp3', text: "...something I've probably already read." },

  // seg06 — Reading the Full Cluster (good example)
  { file: 'sofia_s06_01.mp3', text: "...it's the kind of decision where if you have to keep asking, you already know the answer." },
  { file: 'sofia_s06_02.mp3', text: "Usually." },
  { file: 'sofia_s06_03.mp3', text: "...I wanted to make things that didn't apologize for existing." },

  // seg08 — The Window (enter before it closes)
  { file: 'sofia_s08_01.mp3', text: "...I should probably go find what I actually came in for." },
  { file: 'sofia_s08_02.mp3', text: "...that was fast." },
  { file: 'sofia_s08_03.mp3', text: "...okay." },
  { file: 'sofia_s08_04.mp3', text: "Done." },
];

const EXCHANGE_SEQUENCES = {
  '02': [
    { file: 'sofia_s02_01.mp3', voice: 'sofia' },
    { file: 'alex_s02_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_02.mp3', voice: 'sofia' },
    { file: 'alex_s02_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_03.mp3', voice: 'sofia' },
    { file: 'alex_s02_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_04.mp3', voice: 'sofia' },
    { file: 'alex_s02_04.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_05.mp3', voice: 'sofia' },
    { file: 'alex_s02_05.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_06.mp3', voice: 'sofia' },
  ],
  '04': [
    { file: 'sofia_s04_01.mp3', voice: 'sofia' },
    { file: 'alex_s04_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_02.mp3', voice: 'sofia' },
    { file: 'alex_s04_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_03.mp3', voice: 'sofia' },
    { file: 'alex_s04_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_04.mp3', voice: 'sofia' },
    { file: 'alex_s04_04.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_05.mp3', voice: 'sofia' },
  ],
  '06': [
    { file: 'sofia_s06_01.mp3', voice: 'sofia' },
    { file: 'alex_s06_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s06_02.mp3', voice: 'sofia' },
    { file: 'alex_s06_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s06_03.mp3', voice: 'sofia' },
    { file: 'alex_s06_03.mp3',  voice: 'alex'  },
  ],
  '08': [
    { file: 'sofia_s08_01.mp3', voice: 'sofia' },
    { file: 'alex_s08_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s08_02.mp3', voice: 'sofia' },
    { file: 'alex_s08_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s08_03.mp3', voice: 'sofia' },
    { file: 'sofia_s08_04.mp3', voice: 'sofia' },
    { file: 'alex_s08_03.mp3',  voice: 'alex'  },
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
  console.log(' LESSON 5 AUDIO PIPELINE — "The Read" (TRACE)');
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
    lesson: '5',
    title: 'The Read',
    mnemonic: 'TRACE',
    generatedAt: new Date().toISOString(),
    segments: [
      { segmentId: '00', type: 'coaching', title: 'Welcome',                      files:    [mk('ryan_seg00.mp3', 'ryan')] },
      { segmentId: '01', type: 'coaching', title: 'Why Men Miss It',              files:    [mk('ryan_seg01.mp3', 'ryan')] },
      { segmentId: '02', type: 'exchange', title: 'Watch — The Missed Read',      sequence: EXCHANGE_SEQUENCES['02'] },
      { segmentId: '03', type: 'coaching', title: 'T — Track · R — Register',     files:    [mk('ryan_seg03.mp3', 'ryan')] },
      { segmentId: '04', type: 'exchange', title: 'Watch — Catching T and R',     sequence: EXCHANGE_SEQUENCES['04'] },
      { segmentId: '05', type: 'coaching', title: 'A — Align · C — Catch',        files:    [mk('ryan_seg05.mp3', 'ryan')] },
      { segmentId: '06', type: 'exchange', title: 'Watch — The Full Cluster',     sequence: EXCHANGE_SEQUENCES['06'] },
      { segmentId: '07', type: 'coaching', title: 'E — Enter',                    files:    [mk('ryan_seg07.mp3', 'ryan')] },
      { segmentId: '08', type: 'exchange', title: 'Watch — The Window',           sequence: EXCHANGE_SEQUENCES['08'] },
      { segmentId: '09', type: 'coaching', title: 'Your Five Steps',              files:    [mk('ryan_seg09.mp3', 'ryan')] },
    ],
  };

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nmanifest.json written → lesson5_audio/manifest.json');

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
