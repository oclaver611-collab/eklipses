require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const OUT_DIR     = path.join(__dirname, '..', 'lesson2_audio');
const FISH_KEY    = process.env.FISH_AUDIO_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const EL_KEY      = process.env.ELEVENLABS_API_KEY;
const RYAN_VOICE  = '44b996214285427697767cb469793647';
const SOFIA_EL_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice — ElevenLabs Flash v2.5
const R2_BUCKET   = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX   = 'lessons/lesson2/audio';

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
    text: "Lesson 2. If you went through Lesson 1, you know how to open. You know how to make her feel noticed — not hit on. You know how to build something from nothing. Now comes the harder part. Because once she's interested — or even before she's interested — she's going to test you. Not because she's mean. Not because she doesn't like you. Because that's how attraction works. Women test men instinctively. They push to see who they're dealing with. A man who breaks under the pressure doesn't make her feel safe. A man who holds his ground does. What you're about to learn is FRAME. Five principles for holding your ground when things get uncomfortable. Most men never learn this. They bend. They over-explain. They apologize for things they didn't do wrong. And every time they do — she loses a little more interest. You're not going to do that. Let's begin.",
  },
  {
    file: 'ryan_seg01.mp3',
    text: "FRAME stands for five things. Feel nothing. Reframe. Add humor. Make her qualify. Exit. Together, they answer one question — what do you do when she tests you? And she will test you. Could be a cold response when you thought it was going well. Could be a dismissive comment. Could be her looking at her phone while you're talking. Could be a direct challenge — I bet you say that to everyone. Whatever the test is, most men fail it the same way. They flinch. They explain themselves. They chase. FRAME gives you something else to do instead. Watch Alex now. Sofia is about to make things uncomfortable. Watch how he handles it.",
  },
  {
    file: 'ryan_seg02.mp3',
    text: "Notice where we are in the conversation. Things were going okay. There was some warmth. It felt like it was building. And then she's going to pull back. This is the part most men get wrong. They take it personally. They think the conversation broke. They try harder to fix it — and in doing so, they make it worse. Alex is about to do something completely different. Watch how still he stays.",
  },
  {
    file: 'ryan_seg04.mp3',
    text: "Stop. Did you see that? She opened with a small test — something you probably wouldn't understand. That line is designed to provoke. Most men try to prove themselves immediately. Oh no, I'm actually really smart, I went to — Alex said nothing like that. He said probably not — and kept going. That's Feel Nothing. When she tests you — don't react. Not with defensiveness. Not with approval-seeking. Not with a long explanation. The move is to stay exactly where you are. Calm. Comfortable. Interested in her — not concerned with how she's evaluating you. Here's the thing about tests. They're not personal. She doesn't know you well enough for it to be personal. She's checking to see if you're the kind of man who breaks under mild pressure. You're not going to break. You're not going to react. You're going to stay still — and keep going. F — Feel Nothing. Done.",
  },
  {
    file: 'ryan_seg06.mp3',
    text: "She said I don't usually talk to strangers. Most men hear that as rejection. They apologize, they back off, they explain why it's okay that she's talking to them. Alex heard something completely different. He heard an opportunity. That's Reframe. A frame is the way someone describes a situation. Sofia's frame was — this is unusual, this is me being weak. Alex took that frame and turned it over. Or a strong one — depends how you look at it. He didn't argue with her. He didn't lecture her. He just offered a different way to see the same moment. And because it was calm and honest — it landed. The key to reframing is you can't be defensive when you do it. You have to be genuinely curious about the other possibility. She says it's too soon. You say depends what we're measuring. She says you're too forward. You say I prefer clear. Not a fight. A shift. R — Reframe. Done.",
  },
  {
    file: 'ryan_seg08.mp3',
    text: "She said you're very sure of yourself. Classic test. She's checking to see if the confidence is real or performed. Alex didn't explain himself. He didn't say well I wouldn't say that, I'm actually very humble. He leaned into it. It's gotten me into trouble before. That's Add Humor. When she challenges your confidence or calls you out on something — the worst thing you can do is defend it seriously. You become stiff. You confirm that you care what she thinks. Humor does the opposite. It says — yeah, I see it. I'm not bothered by it. And I'm also not going anywhere. The humor has to be low-key. Not a joke. Not a bit. Just a light acknowledgment that doesn't explain and doesn't apologize. Still here, aren't I — three words. No defense. No pressure. She laughed. A — Add Humor. Done.",
  },
  {
    file: 'ryan_seg10.mp3',
    text: "He asked what she liked about the beach. She gave a short answer. He pushed. She gave a real answer. That's Make Her Qualify. Most men in conversation give everything — they explain themselves, they answer every question, they volunteer information to fill silence. And in doing so, they remove all tension. Alex flipped it. He made her explain herself to him. He didn't interrogate. He didn't press. He just showed genuine interest — and kept going deeper. Half the beach is quiet. What else? The more she explains herself to you, the more invested she becomes. That's psychology, not manipulation. When someone says something out loud, it becomes more real to them. When she tells you what she values, she's also telling herself. Make her qualify doesn't mean make her beg. It means stay curious long enough for her to give you something real. M — Make Her Qualify. Done.",
  },
  {
    file: 'ryan_seg12.mp3',
    text: "He said I should probably let you get back to it. Why did he do that? Because he's been leading this conversation from the beginning — and leaders leave first. That's Exit. There's a moment in every good conversation where you have a choice. Stay until things naturally wind down — or leave while things are still good. Most men stay too long. They worry that leaving means losing. So they push to extend, they think of reasons to stay, they make the conversation go on longer than it wants to. And then it ends flatly. When you leave at the right moment — before things plateau — you do something powerful. You create pull. She wanted to keep going. You're the one who decided when. That's the same composure you've been showing throughout. You're not chasing. You're not trying. You're moving at your own pace — and inviting her to join. Notice he asked for her number as he was leaving. Not as a big moment. As the natural next step. Give me your number — I want to hear how it ends. Direct. Simple. Light. She said okay. E — Exit. Done.",
  },
  {
    file: 'ryan_seg13.mp3',
    text: "That's FRAME. Let me give you the five one more time. F — Feel Nothing. When she tests you, don't react. Stay where you are. Keep going. R — Reframe. When she describes a situation one way, offer her a different way to see it. No argument. Just a flip. A — Add Humor. When she calls you out — don't defend. Lean into it, lightly. She can't shame the unashamed. M — Make Her Qualify. Stay curious. Push her for real answers. The more she explains herself to you, the more she's invested. E — Exit. Leave before things plateau. Decision-makers leave first. Now — how do you remember all five? FRAME. That's it. The word is the mnemonic. Every time a woman tests you, a frame is exactly what you're holding. That frame is who you are — your standards, your pace, your posture. She's checking to see if she can move it. She can't. The women are waiting for you. Some will test harder than what you just watched. Some will test differently. All of them are asking the same question — who are you when things get uncomfortable? Now you have an answer. Go find out.",
  },
];

const ALEX_LINES = [
  // seg03 — The Test Begins
  { file: 'alex_s03_01.mp3', text: 'What are you working on?' },
  { file: 'alex_s03_02.mp3', text: "Probably not. What is it anyway?" },
  { file: 'alex_s03_03.mp3', text: "So — not what I expected. What made you start writing about that?" },
  { file: 'alex_s03_04.mp3', text: "Yeah. That makes sense." },
  { file: 'alex_s03_05.mp3', text: "No. But I'm interested in why you do." },
  // seg05 — The Reframe
  { file: 'alex_s05_01.mp3', text: "That's interesting. You're talking to me." },
  { file: 'alex_s05_02.mp3', text: "Or a strong one. Depends how you look at it." },
  { file: 'alex_s05_03.mp3', text: "Most of the useful ones are." },
  { file: 'alex_s05_04.mp3', text: "Only when the original framing doesn't hold." },
  // seg07 — The Humor
  { file: 'alex_s07_01.mp3', text: "It's gotten me into trouble before." },
  { file: 'alex_s07_02.mp3', text: "Worth it, though." },
  { file: 'alex_s07_03.mp3', text: "Still here, aren't I?" },
  { file: 'alex_s07_04.mp3', text: "I'll take it." },
  { file: 'alex_s07_05.mp3', text: "That's the nicest thing anyone's said to me all week." },
  // seg09 — The Qualification
  { file: 'alex_s09_01.mp3', text: "So what made you come to this beach specifically?" },
  { file: 'alex_s09_02.mp3', text: "Half the beach is quiet. What else?" },
  { file: 'alex_s09_03.mp3', text: "What do you like about it?" },
  { file: 'alex_s09_04.mp3', text: "That matters to you — things that change?" },
  { file: 'alex_s09_05.mp3', text: "Hm." },
  { file: 'alex_s09_06.mp3', text: "That's a real answer. Most people would've just said I grew up nearby." },
  // seg11 — The Exit
  { file: 'alex_s11_01.mp3', text: "I should probably let you get back to it." },
  { file: 'alex_s11_02.mp3', text: "You were working." },
  { file: 'alex_s11_03.mp3', text: "One question first. What's the piece actually about — the real one, not the one you'd tell a stranger." },
  { file: 'alex_s11_04.mp3', text: "Okay. That's a much better pitch." },
  { file: 'alex_s11_05.mp3', text: "Even better. Alright, I really should go. But give me your number. I want to hear how it ends." },
];

const SOFIA_LINES = [
  // seg03
  { file: 'sofia_s03_01.mp3', text: "...something you probably wouldn't understand." },
  { file: 'sofia_s03_02.mp3', text: "...a piece on coastal erosion." },
  { file: 'sofia_s03_03.mp3', text: "...I grew up here. You notice things when you grow up somewhere." },
  { file: 'sofia_s03_04.mp3', text: "...you're not going to pretend you find coastal erosion interesting, are you?" },
  { file: 'sofia_s03_05.mp3', text: "...hm." },
  // seg05
  { file: 'sofia_s05_01.mp3', text: "I don't usually talk to strangers." },
  { file: 'sofia_s05_02.mp3', text: "...you caught me in a weak moment." },
  { file: 'sofia_s05_03.mp3', text: "...that's a convenient interpretation." },
  { file: 'sofia_s05_04.mp3', text: "...you do that a lot, don't you. Flip things." },
  { file: 'sofia_s05_05.mp3', text: "...and you think mine didn't?" },
  // seg07
  { file: 'sofia_s07_01.mp3', text: "You're very sure of yourself." },
  { file: 'sofia_s07_02.mp3', text: "...I bet it has." },
  { file: 'sofia_s07_03.mp3', text: "...how do you figure?" },
  { file: 'sofia_s07_04.mp3', text: "...barely." },
  { file: 'sofia_s07_05.mp3', text: "...you're strange." },
  { file: 'sofia_s07_06.mp3', text: "...oh god." },
  // seg09
  { file: 'sofia_s09_01.mp3', text: "...it's quiet here." },
  { file: 'sofia_s09_02.mp3', text: "...I don't know. I just like it." },
  { file: 'sofia_s09_03.mp3', text: "...the tide line is always different. It changes." },
  { file: 'sofia_s09_04.mp3', text: "...I guess yeah. Things that stay exactly the same start to feel dead." },
  { file: 'sofia_s09_05.mp3', text: "...what?" },
  { file: 'sofia_s09_06.mp3', text: "...I almost did." },
  // seg11
  { file: 'sofia_s11_01.mp3', text: "...you don't have to." },
  { file: 'sofia_s11_02.mp3', text: "...I can take a break." },
  { file: 'sofia_s11_03.mp3', text: "...disappearance. How things go. Slowly, and you don't notice until they're gone." },
  { file: 'sofia_s11_04.mp3', text: "...it's not really a pitch." },
  { file: 'sofia_s11_05.mp3', text: "...okay." },
];

const EXCHANGE_SEQUENCES = {
  '03': [
    { file: 'alex_s03_01.mp3', voice: 'alex' },
    { file: 'sofia_s03_01.mp3', voice: 'sofia' },
    { file: 'alex_s03_02.mp3', voice: 'alex' },
    { file: 'sofia_s03_02.mp3', voice: 'sofia' },
    { file: 'alex_s03_03.mp3', voice: 'alex' },
    { file: 'sofia_s03_03.mp3', voice: 'sofia' },
    { file: 'alex_s03_04.mp3', voice: 'alex' },
    { file: 'sofia_s03_04.mp3', voice: 'sofia' },
    { file: 'alex_s03_05.mp3', voice: 'alex' },
    { file: 'sofia_s03_05.mp3', voice: 'sofia' },
  ],
  '05': [
    { file: 'sofia_s05_01.mp3', voice: 'sofia' },
    { file: 'alex_s05_01.mp3', voice: 'alex' },
    { file: 'sofia_s05_02.mp3', voice: 'sofia' },
    { file: 'alex_s05_02.mp3', voice: 'alex' },
    { file: 'sofia_s05_03.mp3', voice: 'sofia' },
    { file: 'alex_s05_03.mp3', voice: 'alex' },
    { file: 'sofia_s05_04.mp3', voice: 'sofia' },
    { file: 'alex_s05_04.mp3', voice: 'alex' },
    { file: 'sofia_s05_05.mp3', voice: 'sofia' },
  ],
  '07': [
    { file: 'sofia_s07_01.mp3', voice: 'sofia' },
    { file: 'alex_s07_01.mp3', voice: 'alex' },
    { file: 'sofia_s07_02.mp3', voice: 'sofia' },
    { file: 'alex_s07_02.mp3', voice: 'alex' },
    { file: 'sofia_s07_03.mp3', voice: 'sofia' },
    { file: 'alex_s07_03.mp3', voice: 'alex' },
    { file: 'sofia_s07_04.mp3', voice: 'sofia' },
    { file: 'alex_s07_04.mp3', voice: 'alex' },
    { file: 'sofia_s07_05.mp3', voice: 'sofia' },
    { file: 'alex_s07_05.mp3', voice: 'alex' },
    { file: 'sofia_s07_06.mp3', voice: 'sofia' },
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
    { file: 'alex_s09_05.mp3', voice: 'alex' },
    { file: 'sofia_s09_05.mp3', voice: 'sofia' },
    { file: 'alex_s09_06.mp3', voice: 'alex' },
    { file: 'sofia_s09_06.mp3', voice: 'sofia' },
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
    { file: 'alex_s11_05.mp3', voice: 'alex' },
    { file: 'sofia_s11_05.mp3', voice: 'sofia' },
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
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null };
  } catch (e) {
    if (attempt === 1) { await sleep(2000); return fishTTS(text, voiceId, filename, 2); }
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message };
  }
}

async function openaiTTS(text, filename, attempt = 1) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'onyx', input: text, response_format: 'mp3' }),
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

async function elevenLabsTTS(text, filename, attempt = 1) {
  const t0 = Date.now();
  const clean = text.replace(/\.\.\./g, '').replace(/^\.+/, '').trim();
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${SOFIA_EL_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': EL_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
        }),
      }
    );
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`HTTP ${res.status}: ${e.slice(0, 100)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null };
  } catch (e) {
    if (attempt === 1) { await sleep(2000); return elevenLabsTTS(text, filename, 2); }
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
  console.log(' LESSON 2 AUDIO PIPELINE — "Holding Your Ground" (FRAME)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!FISH_KEY)   { console.error('FISH_AUDIO_API_KEY missing'); process.exit(1); }
  if (!OPENAI_KEY) { console.error('OPENAI_API_KEY missing'); process.exit(1); }
  if (!EL_KEY)     { console.error('ELEVENLABS_API_KEY missing'); process.exit(1); }

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

  // ── 3. Sofia (ElevenLabs Flash v2.5, sequential) ──────────────────────────
  console.log(`\n── Sofia (ElevenLabs Flash v2.5, ${SOFIA_LINES.length} lines, sequential) ───────────`);
  for (let i = 0; i < SOFIA_LINES.length; i++) {
    if (i > 0) await sleep(500);
    const { file, text } = SOFIA_LINES[i];
    process.stdout.write(`  ${file} ...`);
    const r = await elevenLabsTTS(text, file);
    process.stdout.write(r.error ? ` FAIL: ${r.error}\n` : ` ${r.kb} KB (${r.ms}ms)\n`);
    allResults[file] = r;
  }

  // ── 4. Write manifest ─────────────────────────────────────────────────────
  const mk = (f, v) => ({ file: f, voice: v });
  const manifest = {
    version: '1',
    lesson: '2',
    title: 'Holding Your Ground',
    mnemonic: 'FRAME',
    generatedAt: new Date().toISOString(),
    segments: [
      { segmentId: '00', type: 'coaching',  title: 'Welcome',             files:    [mk('ryan_seg00.mp3', 'ryan')] },
      { segmentId: '01', type: 'coaching',  title: 'What FRAME Is',       files:    [mk('ryan_seg01.mp3', 'ryan')] },
      { segmentId: '02', type: 'coaching',  title: 'Before the Test',     files:    [mk('ryan_seg02.mp3', 'ryan')] },
      { segmentId: '03', type: 'exchange',  title: 'Watch — The Test',    sequence: EXCHANGE_SEQUENCES['03'] },
      { segmentId: '04', type: 'coaching',  title: 'F — Feel Nothing',    files:    [mk('ryan_seg04.mp3', 'ryan')] },
      { segmentId: '05', type: 'exchange',  title: 'Watch — The Reframe', sequence: EXCHANGE_SEQUENCES['05'] },
      { segmentId: '06', type: 'coaching',  title: 'R — Reframe',         files:    [mk('ryan_seg06.mp3', 'ryan')] },
      { segmentId: '07', type: 'exchange',  title: 'Watch — The Humor',   sequence: EXCHANGE_SEQUENCES['07'] },
      { segmentId: '08', type: 'coaching',  title: 'A — Add Humor',       files:    [mk('ryan_seg08.mp3', 'ryan')] },
      { segmentId: '09', type: 'exchange',  title: 'Watch — The Qualification', sequence: EXCHANGE_SEQUENCES['09'] },
      { segmentId: '10', type: 'coaching',  title: 'M — Make Her Qualify',files:    [mk('ryan_seg10.mp3', 'ryan')] },
      { segmentId: '11', type: 'exchange',  title: 'Watch — The Exit',    sequence: EXCHANGE_SEQUENCES['11'] },
      { segmentId: '12', type: 'coaching',  title: 'E — Exit',            files:    [mk('ryan_seg12.mp3', 'ryan')] },
      { segmentId: '13', type: 'coaching',  title: 'Your Five Steps',     files:    [mk('ryan_seg13.mp3', 'ryan')] },
    ],
  };

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nmanifest.json written → lesson2_audio/manifest.json');

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
  const totalFiles  = Object.keys(allResults).length;
  const failedTTS   = Object.values(allResults).filter(r => r.error).map(r => r.file);
  const failedR2    = r2Results.filter(r => !r.r2).map(r => r.file);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(` SUMMARY: ${totalFiles} files`);
  console.log(`  TTS failures:   ${failedTTS.length === 0 ? 'none' : failedTTS.join(', ')}`);
  console.log(`  R2 failures:    ${failedR2.length === 0 ? 'none' : failedR2.join(', ')}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failedTTS.length > 0 || failedR2.length > 0) process.exit(1);
})();
