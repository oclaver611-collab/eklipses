require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const OUT_DIR     = path.join(__dirname, '..', 'lesson3_audio');
const FISH_KEY    = process.env.FISH_AUDIO_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const RYAN_VOICE  = '44b996214285427697767cb469793647';   // Fish Audio — same voice as L1/L2
const SOFIA_VOICE = '836513f294d64aec8403226e69268b1b';   // Fish Audio — same voice as L1/L2
const R2_BUCKET   = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX   = 'lessons/lesson3/audio';

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
    text: "Lessons 1 and 2 covered how to open — and how to hold your ground when she tests you. You're past that now. This is the next phase. And it's harder — not because it requires more skill, but because the moment things go well is the moment most men make their biggest mistake. Here's what happens: she's interested. You can feel it. Things are moving. And in that moment, most men try to lock it in. They say too much. They give too much away. They declare interest before she's had a reason to wonder. They compliment before the tension has had time to build. And slowly — without even knowing it — they drain every reason she had to keep wanting more. What you're about to learn is PACE. Four moves for the phase where most men stop thinking clearly. Let's begin.",
  },
  {
    file: 'ryan_seg01.mp3',
    text: "PACE stands for four things. Pause. Ask-back. Contain. Earn. Together they answer one question — what do you do once she's already interested? Researchers tested something counterintuitive: women shown profiles of men who were definitely attracted to them were less interested than women shown profiles of men who might be attracted to them. Uncertainty about how a man feels is itself attractive — more attractive than certainty that he does. The men who declare their feelings early, who give her the full picture too fast — they think they're being honest. What they're actually doing is removing the pull. The moment she knows exactly how you feel, there's nothing left to wonder about. PACE works with that reality instead of against it. Watch Alex now. Sofia is going to ask him directly how he feels about her. Watch what he does.",
  },
  {
    file: 'ryan_seg03.mp3',
    text: "Stop. Did you hear that? She asked him directly — do you actually like me? And he answered. Completely. Without hesitating. Feels honest, right? It's not wrong to be honest. The problem is what she was actually asking with that question. She wasn't asking for information. She was testing whether he could make her wait for it. The pull that had been building — it came from not knowing exactly where she stood with him. The moment he answered completely, that uncertainty was gone. And with it, the pull. A Pause isn't a game. You're not pretending you don't feel something. You're just not handing it over the moment she asks. I haven't decided yet — ask me again in an hour. That's a Pause. That's a faster question than I expected. Also a Pause. She asks. You make her wonder a little longer. The answer is still coming. It just hasn't arrived yet. P — Pause.",
  },
  {
    file: 'ryan_seg05.mp3',
    text: "Notice what just happened in that conversation. She asked about him. He answered — fully, completely. And stopped. She said hm. And it went flat. Not because his job is boring. Because he took the ball and just held it. Every time she asks about you is a chance to learn something about her. The move is simple: answer briefly, then redirect. Your turn. What about you — same question. I'll ask you the same thing. That's all it is. It sounds too simple to matter, but watch what it does. She asked because she's curious about him. When he answers and turns it back, she has to say something real about herself. And the moment she explains herself to you, she's more invested in you than she was thirty seconds ago. The conversation moves because of her, not just him. That's Ask-back. Answer, redirect, repeat. A — Ask-back.",
  },
  {
    file: 'ryan_seg07.mp3',
    text: "She laughed. Real warmth. That's the moment the lesson happens. Because the moment she gave him something, he gave everything back — and the tension he'd been building went flat. She's beautiful, I've been thinking it since the beach — both things may be true. The problem isn't honesty. The problem is timing. When she shows you warmth, that's when most men pile on. They think it's the right moment to tell her. It isn't. That's the moment the compliment costs the least — and means the least. She already knows. She can feel it. Saying it out loud doesn't add anything. It only removes the space where the wondering was. The rule is not to never compliment. The rule is to not stack them when she's already feeling it. You've noticed things. You're keeping them. That creates more pull than anything you could say. C — Contain.",
  },
  {
    file: 'ryan_seg09.mp3',
    text: "He said it on the third exchange. I haven't felt this easy with someone in a while. I'd like to take you out properly. Both things may be true. But she hadn't shown him yet that she was worth the risk of saying it. And that's the thing about declarations — they're not gifts. They're bets. When you tell someone you want to see them again, you're showing your cards before the hand is played. You're telling her exactly how you feel before she's demonstrated she deserves to know. Wait. Let her show you something first. Let her lean in — actually lean in — before you match it. Not because you're withholding. Because the declaration only means something once she's earned it. Premature declarations tell her she already won. And once she's won — without having done anything — there's very little game left. E — Earn.",
  },
  {
    file: 'ryan_seg10.mp3',
    text: "That's PACE. Let me give you the four one more time. P — Pause. When she asks you directly how you feel, make her wait for the answer. Not forever. Just long enough for the wondering to do its work. A — Ask-back. After every answer about yourself, redirect with a question back to her. Answer briefly. Turn it. Keep learning. C — Contain. Hold the compliment when you most want to give it. What you notice and don't say has more weight than what you say out loud. E — Earn. Wait for her to show real investment before you match it. Declarations land when she's earned them — not before. How do you remember all four? PACE. You set the pace. Not because you're playing games — because you understand something most men don't: the tension isn't an obstacle. It's the thing she's feeling right now, and it's yours to keep or give away. Most men rush because they're afraid the moment will pass. The men who understand PACE know something different: the moment is only available to the man willing to wait for it. She's waiting. Go find out.",
  },
];

const ALEX_LINES = [
  // seg02 — Watch — The Pause (bad example: Alex reveals feelings too eagerly)
  { file: 'alex_s02_01.mp3', text: "Go ahead." },
  { file: 'alex_s02_02.mp3', text: "Yeah. I like you. I've been thinking about you since the beach, honestly." },
  { file: 'alex_s02_03.mp3', text: "Is that weird to say?" },
  { file: 'alex_s02_04.mp3', text: "I figured I'd just say it." },

  // seg04 — Watch — The Ask-back (bad example: Alex gives full answer, no redirect)
  { file: 'alex_s04_01.mp3', text: "Product design — UX, mostly. I've been doing it about five years. Started freelance, now I'm at a small studio. We work with a lot of tech companies." },
  { file: 'alex_s04_02.mp3', text: "Probably sounds more interesting than it is." },
  { file: 'alex_s04_03.mp3', text: "Fair." },

  // seg06 — Watch — Contain (bad example: Alex stacks compliments)
  { file: 'alex_s06_01.mp3', text: "You have a great laugh." },
  { file: 'alex_s06_02.mp3', text: "No, I mean it — you're beautiful. I've been thinking that since the beach and I keep not saying it." },
  { file: 'alex_s06_03.mp3', text: "I mean it. I've thought about you a lot." },

  // seg08 — Watch — Earn (bad example: Alex declares too soon)
  { file: 'alex_s08_01.mp3', text: "Same. Honestly — I haven't felt this easy with someone in a while." },
  { file: 'alex_s08_02.mp3', text: "I'd like to see you again. Like, properly. Take you out somewhere." },
  { file: 'alex_s08_03.mp3', text: "I mean it." },
];

const SOFIA_LINES = [
  // seg02
  { file: 'sofia_s02_01.mp3', text: "Can I ask you something?" },
  { file: 'sofia_s02_02.mp3', text: "...do you actually like me? Or is this just — I don't know — something to do?" },
  { file: 'sofia_s02_03.mp3', text: "...oh." },
  { file: 'sofia_s02_04.mp3', text: "...no, it's fine. I just wasn't expecting that." },

  // seg04
  { file: 'sofia_s04_01.mp3', text: "What do you actually do? Like, day to day." },
  { file: 'sofia_s04_02.mp3', text: "...hm." },
  { file: 'sofia_s04_03.mp3', text: "...maybe. I don't know enough about it to say." },

  // seg06
  { file: 'sofia_s06_01.mp3', text: "...okay, that's actually really funny." },
  { file: 'sofia_s06_02.mp3', text: "...thanks." },
  { file: 'sofia_s06_03.mp3', text: "...that's sweet." },
  { file: 'sofia_s06_04.mp3', text: "...yeah." },

  // seg08
  { file: 'sofia_s08_01.mp3', text: "I've actually really enjoyed this." },
  { file: 'sofia_s08_02.mp3', text: "...yeah?" },
  { file: 'sofia_s08_03.mp3', text: "...that's really sweet." },
  { file: 'sofia_s08_04.mp3', text: "...okay." },
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
  ],
  '04': [
    { file: 'sofia_s04_01.mp3', voice: 'sofia' },
    { file: 'alex_s04_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_02.mp3', voice: 'sofia' },
    { file: 'alex_s04_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_03.mp3', voice: 'sofia' },
    { file: 'alex_s04_03.mp3',  voice: 'alex'  },
  ],
  '06': [
    { file: 'sofia_s06_01.mp3', voice: 'sofia' },
    { file: 'alex_s06_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s06_02.mp3', voice: 'sofia' },
    { file: 'alex_s06_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s06_03.mp3', voice: 'sofia' },
    { file: 'alex_s06_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s06_04.mp3', voice: 'sofia' },
  ],
  '08': [
    { file: 'sofia_s08_01.mp3', voice: 'sofia' },
    { file: 'alex_s08_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s08_02.mp3', voice: 'sofia' },
    { file: 'alex_s08_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s08_03.mp3', voice: 'sofia' },
    { file: 'alex_s08_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s08_04.mp3', voice: 'sofia' },
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
  console.log(' LESSON 3 AUDIO PIPELINE — "The Long Game" (PACE)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!FISH_KEY)   { console.error('FISH_AUDIO_API_KEY missing'); process.exit(1); }
  if (!OPENAI_KEY) { console.error('OPENAI_API_KEY missing'); process.exit(1); }

  const allResults = {};

  // ── 1. Ryan (Fish Audio, sequential) ─────────────────────────────────────
  console.log(`── Ryan (Fish Audio, ${RYAN_LINES.length} coaching segments) ─────────────────────────`);
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
  console.log(`\n── Sofia (Fish Audio ${SOFIA_VOICE}, ${SOFIA_LINES.length} lines, sequential) ──────`);
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
    lesson: '3',
    title: 'The Long Game',
    mnemonic: 'PACE',
    generatedAt: new Date().toISOString(),
    segments: [
      { segmentId: '00', type: 'coaching', title: 'Welcome',              files:    [mk('ryan_seg00.mp3', 'ryan')] },
      { segmentId: '01', type: 'coaching', title: 'What PACE Is',         files:    [mk('ryan_seg01.mp3', 'ryan')] },
      { segmentId: '02', type: 'exchange', title: 'Watch — The Pause',    sequence: EXCHANGE_SEQUENCES['02'] },
      { segmentId: '03', type: 'coaching', title: 'P — Pause',            files:    [mk('ryan_seg03.mp3', 'ryan')] },
      { segmentId: '04', type: 'exchange', title: 'Watch — The Ask-back', sequence: EXCHANGE_SEQUENCES['04'] },
      { segmentId: '05', type: 'coaching', title: 'A — Ask-back',         files:    [mk('ryan_seg05.mp3', 'ryan')] },
      { segmentId: '06', type: 'exchange', title: 'Watch — Contain',      sequence: EXCHANGE_SEQUENCES['06'] },
      { segmentId: '07', type: 'coaching', title: 'C — Contain',          files:    [mk('ryan_seg07.mp3', 'ryan')] },
      { segmentId: '08', type: 'exchange', title: 'Watch — Earn',         sequence: EXCHANGE_SEQUENCES['08'] },
      { segmentId: '09', type: 'coaching', title: 'E — Earn',             files:    [mk('ryan_seg09.mp3', 'ryan')] },
      { segmentId: '10', type: 'coaching', title: 'Your Four Steps',      files:    [mk('ryan_seg10.mp3', 'ryan')] },
    ],
  };

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nmanifest.json written → lesson3_audio/manifest.json');

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
  const audioFiles   = Object.keys(allResults).length;
  const totalFiles   = audioFiles; // manifest counted separately
  const failedTTS    = Object.values(allResults).filter(r => r.error).map(r => r.file);
  const failedR2     = r2Results.filter(r => !r.r2).map(r => r.file);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(` SUMMARY: ${totalFiles} audio files + manifest.json`);
  console.log(`  Ryan:           ${RYAN_LINES.length} files`);
  console.log(`  Alex:           ${ALEX_LINES.length} files`);
  console.log(`  Sofia:          ${SOFIA_LINES.length} files`);
  console.log(`  TTS failures:   ${failedTTS.length === 0 ? 'none' : failedTTS.join(', ')}`);
  console.log(`  R2 failures:    ${failedR2.length === 0 ? 'none' : failedR2.join(', ')}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failedTTS.length > 0 || failedR2.length > 0) process.exit(1);
})();
