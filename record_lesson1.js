/**
 * EKLIPSES — Lesson 1 Audio Recording Script
 * 
 * Records all 13 Ryan narration segments via Fish Audio TTS API
 * and uploads each MP3 to Cloudflare R2.
 * 
 * Usage:
 *   node record_lesson1.js
 * 
 * Requirements:
 *   npm install @aws-sdk/client-s3 node-fetch dotenv
 * 
 * Env vars needed in .env.local:
 *   FISH_AUDIO_API_KEY=your_key
 *   FISH_AUDIO_RYAN_VOICE_ID=your_ryan_voice_id
 *   R2_ACCOUNT_ID=your_cloudflare_account_id
 *   R2_ACCESS_KEY_ID=your_r2_access_key
 *   R2_SECRET_ACCESS_KEY=your_r2_secret_key
 *   R2_BUCKET_NAME=eklipses-videos
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
// fetch is native in Node 18+ — no require needed
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
const RYAN_VOICE_ID = process.env.FISH_AUDIO_RYAN_VOICE_ID;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'eklipses-videos';
const R2_PREFIX = 'lessons/lesson1/audio';
const OUTPUT_DIR = path.join(__dirname, 'lesson1_audio');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ─── SEGMENTS ────────────────────────────────────────────────────────────────

const SEGMENTS = [
  {
    id: '01',
    title: 'Lesson Intro',
    text: `What you are about to see is something most men spend their entire lives never figuring out.

They see a woman like this. They feel that pull. And they do nothing. They walk past. They go home. They tell themselves next time will be different. And next time — they do the exact same thing.

Here is what those men do not understand. The problem is never confidence. The problem is never looks. The problem is never what to say. The problem is that nobody ever showed them how this actually works.

Today I am going to show you.

You are going to watch a real approach from start to finish. How to stop her. How to make her stay. How to build something real in a matter of minutes with a complete stranger. And I am going to stop along the way and show you exactly what is happening beneath the surface — because what you see on the outside and what is actually going on underneath are two completely different things.

By the time this lesson ends, you will have a set of principles you can use anywhere. Not tricks. Not lines. Principles. Things that work because they are based on how attraction actually functions — not on what society tells you, not on what movies show you, but on what is real.

There is one rule before we begin. Watch everything. Not just what I say — watch how I say it. Watch the timing. Watch what I do not say. Because sometimes the most important move is the one you cannot hear.

She is right there. Let us begin.`
  },
  {
    id: '02',
    title: 'Before The Approach',
    text: `Before I take a single step toward her, I want you to notice what I am not doing.

I am not rehearsing a line in my head. I am not waiting for the perfect moment. I am not asking myself whether she will like me or whether I am good enough.

I am observing.

This is the first thing most men get completely wrong. They spend so much time inside their own heads — planning, calculating, worrying — that by the time they are ready, the moment is gone. And they use that as an excuse. They say the moment passed. The truth is they killed it themselves.

There is something I want you to remember for the rest of your life. The woman standing in front of you is not thinking about you. She is in her own world. She does not know you exist yet. That means you have something most men waste — a blank slate. No judgment. No expectations. Nothing.

What you do in the next thirty seconds will determine everything.

I am going to walk over there now. Watch what I say — and more importantly, watch what I do not say.`
  },
  {
    id: '03',
    title: 'The Approach — Live Exchange',
    text: `Hey — sorry to interrupt. Can I tell you something for just a second?

I was walking past and I had to stop. You have this energy — like you belong somewhere else entirely. Not here. Somewhere quieter. More interesting. I don't know why but that caught my attention.

Strange things are usually the most true.`
  },
  {
    id: '04',
    title: 'Step 1 — The Observation Opener',
    text: `Stop. Right there.

Did you notice what just happened? I did not tell her she was beautiful. I did not tell her she had a nice smile. I did not say any of the things that every other man who has ever approached her has said.

I made a specific observation. Something real. Something that showed I was actually paying attention to her — not just to how she looks, but to who she is in that moment.

Here is why this matters more than anything else you will learn today.

When you compliment a woman's appearance, her radar receives that signal and immediately files it into a category. She has heard it a thousand times. She knows exactly what it means and exactly what you want. The conversation is already over before it begins.

But when you say something specific — something that could only come from someone who was genuinely paying attention — something different happens. She thinks: who is this person? How did he see that? That curiosity is the door opening.

This is Step 1. The observation opener. Not a compliment. An observation. The difference between those two things is the difference between a man she forgets in ten seconds and a man she thinks about later.

Find something real. Something specific. Something only someone who was truly present would notice. And say it without apology, without hesitation, without needing her to validate it.

That is how you begin.`
  },
  {
    id: '05',
    title: 'The Tease — Live Exchange',
    text: `You have been sitting here a while. Writing something?

People who say they are just thinking are always thinking about something very specific.

You don't give much away, do you.

No. Actually — that is interesting. Most people give everything away in the first thirty seconds. You didn't.

It is a problem sometimes.`
  },
  {
    id: '06',
    title: 'Step 2 — Playful Challenge',
    text: `Did you feel the shift in that exchange?

At the beginning she was a stranger on a beach. By the end of it, there was something else happening. A tension. A curiosity. A sense that this conversation could go somewhere unexpected.

That shift did not happen by accident. That is Step 2. Playful challenge.

Here is what you need to understand about teasing. Most men think teasing means making fun of someone. That is not what this is. Playful challenge means you are not going along with everything she says. You are not nodding, agreeing, performing. You are engaging with her as an equal — sometimes pushing back, sometimes noticing things she did not expect you to notice, sometimes saying the thing she was not expecting.

When I said people who say they are just thinking are always thinking about something very specific — I was not insulting her. I was paying attention. I was curious. And I was showing it in a way that created a small, pleasant friction.

That friction is important. Without it, the conversation stays flat. Polite. Forgettable. With it — she starts to wonder about you.

But here is the part most men miss. Playful challenge is a tool for the early phase only. Its job is to create energy, to break the formal stranger dynamic, to make her feel like she is talking to someone real. Once that energy is there — you stop. You do not keep pushing. You let the conversation breathe.

The men who keep challenging after she is already engaged become predictable. They become exhausting. They confuse a technique with a personality.

Use it to start the fire. Then let it burn on its own.`
  },
  {
    id: '07',
    title: 'The Sensitive Topic — Live Exchange',
    text: `Why — are you trying to figure out if I am worth talking to?

Fair enough. I work in something I am not going to explain at a party because it kills the mood immediately. What I will tell you is that I chose it because it lets me be here on a Tuesday afternoon. That tells you more than the job title would.

I am a careful person. When it matters.`
  },
  {
    id: '08',
    title: 'Step 3 — Owning Your Mystery',
    text: `She asked about my work. A simple question. One that most men answer immediately and completely — name of the company, job title, salary range implied, full resume delivered in ninety seconds.

And the moment they do that, something dies in the conversation. Not because the job is bad. But because of what that answer reveals.

When you rush to explain yourself — when you answer every question fully and immediately — you are sending a signal. The signal says: I need you to approve of me. I need you to think I am good enough. I am filling the silence because I am afraid of what happens if I don't.

Her radar reads that signal instantly. And it files you away.

This is Step 3. Owning your mystery. Not lying. Not being rude. Not refusing to answer. Simply not giving everything away the moment she asks.

Notice what I did. I acknowledged the question. I gave her something real — I told her what my work gives me, not what my work is. And I left something open. Something she would want to know more about.

There will be moments in every conversation where she asks something that could make you feel like you need to prove yourself. Your age. Your job. Where you live. Whether you have been in relationships. These are the moments that separate the men who understand this from the men who do not.

The principle is simple. You do not need her approval. You are not auditioning. Answer in a way that shows you are comfortable — and leave her wanting to know more.

Mystery is not about being cold or distant. It is about understanding that what you do not say is sometimes more powerful than what you do.`
  },
  {
    id: '09',
    title: 'The Verbal Spike — Live Exchange',
    text: `You know what I noticed about you from over there? Before I came over.

You looked like someone who was completely fine being alone. Not lonely. Not waiting for something. Just — present. You don't see that very often.

I find it rare. There is a difference. Rare things are worth paying attention to. That is why I am here.`
  },
  {
    id: '10',
    title: 'Step 4 — The Verbal Spike',
    text: `I want you to go back and listen to what I just said to her.

On the surface — it sounds like a compliment. And it is. But it is doing something much more specific than a compliment. It is communicating something underneath the words. Something she can feel but I never had to say directly.

I told her she was rare. I told her she was worth paying attention to. I told her — without ever saying it — that I am attracted to something real about her, not just how she looks.

And then I told her that is why I am there.

This is Step 4. The verbal spike.

A verbal spike is not flirting in the obvious sense. It is not you are beautiful or I think you are amazing. Those things land flat because they are about her appearance. They tell her nothing about you.

A verbal spike communicates romantic intention through what it implies — not through what it states. The gap between what you say and what you mean — that is where attraction happens. Women are exceptionally sensitive to that gap. Far more sensitive than most men ever realize.

Here is what I want you to understand. Women do not respond to what you say. They respond to what you mean. A man who can communicate through implication — who can make a woman feel something without ever stating it directly — that man occupies a level most men do not even know exists.

You are not telling her you like her. You are making her feel it. The difference between those two things is everything.`
  },
  {
    id: '11',
    title: 'The Close — Live Exchange',
    text: `I have to be honest with you — I did not plan to spend twenty minutes talking to a stranger on a beach today.

No. It is the opposite actually. Look — I am going to be direct because I think you appreciate that more than most people. I would like to continue this conversation somewhere that is not a beach with sand in my shoes. Coffee. A drink. Whenever works for you. No pressure.

Good. Give me your number and I will make it worth your while.

Comfortable. There is a difference.`
  },
  {
    id: '12',
    title: 'Step 5 — The Natural Close',
    text: `You think the close is the hardest part. It is not.

If you have done everything before this correctly — the observation opener, the playful challenge, the mystery, the verbal spike — then by the time you ask for her number, you are not asking a stranger for a favour. You are offering a natural next step to someone who is already interested.

The close fails when men treat it like a performance. When they build up to it nervously. When they drop ten hints and hope she figures it out. When they ask in a way that sounds like they are apologizing for asking.

This is Step 5. The direct, comfortable close.

Notice three things about what I did. First — I was honest about the situation. I said I did not plan this. That honesty signals confidence. A man who is comfortable enough to admit that something surprised him is a man who is secure in himself.

Second — I framed it lightly. Coffee. A drink. Whenever works. No pressure. I am not asking her to commit to anything significant. I am making it easy to say yes.

Third — when she responded warmly, I did not hesitate. I did not say oh great, amazing, thank you so much. I stayed in the same frame I had been in the entire conversation. Comfortable. Slightly playful. In control of myself.

The close is not a moment you survive. It is a moment you lead. And you can only lead it if you have built something worth closing.

Which is exactly what the five steps are for.`
  },
  {
    id: '13',
    title: 'Summary and Send-Off',
    text: `Here is what just happened. And here is what I need you to remember.

She was a stranger. Ten minutes later, she gave me her number and she wanted to. Not because I am special. Not because I got lucky. Because I followed a set of principles that work — consistently, repeatably, with any woman, in any situation.

Let me give you those principles one more time.

Step 1. The observation opener. Do not compliment her appearance. Find something specific and real that only someone paying genuine attention would notice. That is your opening.

Step 2. Playful challenge. Do not go along with everything. Create a small, pleasant friction. Make her feel like she is talking to someone real. Then stop — once the energy is there, let it breathe.

Step 3. Own your mystery. Do not give everything away the moment she asks. Answer in a way that shows you are comfortable and leaves her wanting to know more. You are not auditioning. You do not need her approval.

Step 4. The verbal spike. Communicate your intention through implication, not statement. Make her feel what you mean without saying it directly. Women respond to what you mean — not just what you say.

Step 5. The direct, comfortable close. No hints. No performance. A simple, honest, light ask. And stay in the same frame you have been in all along.

These five steps are the foundation. Everything else we build on top of them.

Now it is your turn. Go to Practice mode. Apply what you just saw. Sofia is there — and this time, she already knows what you should be doing. The only question is whether you do it.

Come back when you are ready for Lesson 2.`
  }
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg, type = 'info') {
  const icons = { info: '→', success: '✓', error: '✗', warn: '⚠' };
  console.log(`${icons[type] || '→'} ${msg}`);
}

// ─── FISH AUDIO TTS ───────────────────────────────────────────────────────────

async function generateAudio(text, segmentId) {
  log(`Generating audio for segment ${segmentId}...`);

  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      reference_id: RYAN_VOICE_ID,
      format: 'mp3',
      mp3_bitrate: 128,
      normalize: true,
      latency: 'normal',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Fish Audio API error for segment ${segmentId}: ${response.status} — ${err}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

// ─── R2 UPLOAD ───────────────────────────────────────────────────────────────

async function uploadToR2(buffer, filename) {
  const key = `${R2_PREFIX}/${filename}`;
  log(`Uploading ${filename} to R2...`);

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000', // 1 year cache — static content never changes
  }));

  return `https://${process.env.R2_PUBLIC_DOMAIN || 'your-r2-domain.com'}/${key}`;
}

// ─── SAVE LOCALLY ────────────────────────────────────────────────────────────

function saveLocally(buffer, filename) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  log(`Saved locally: ${filepath}`, 'success');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  EKLIPSES — Lesson 1 Audio Recording');
  console.log('═══════════════════════════════════════════\n');

  // Validate env vars
  const required = ['FISH_AUDIO_API_KEY', 'FISH_AUDIO_RYAN_VOICE_ID', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`✗ Missing env vars: ${missing.join(', ')}`);
    console.error('  Add them to .env.local and try again.');
    process.exit(1);
  }

  log(`Total segments: ${SEGMENTS.length}`);
  log(`R2 destination: ${R2_BUCKET}/${R2_PREFIX}/\n`);

  const results = [];

  for (const segment of SEGMENTS) {
    const filename = `lesson1_seg${segment.id}.mp3`;
    console.log(`\n[${segment.id}/13] ${segment.title}`);
    console.log('─'.repeat(50));

    try {
      // Generate audio
      const audioBuffer = await generateAudio(segment.text, segment.id);
      log(`Generated: ${(audioBuffer.length / 1024).toFixed(1)} KB`, 'success');

      // Save locally as backup
      saveLocally(audioBuffer, filename);

      // Upload to R2
      const url = await uploadToR2(audioBuffer, filename);
      log(`Uploaded to R2: ${R2_PREFIX}/${filename}`, 'success');

      results.push({ id: segment.id, title: segment.title, filename, url, status: 'success' });

      // Rate limit protection — Fish Audio allows ~10 req/min on most plans
      // Wait 7 seconds between requests to stay safe
      if (segment !== SEGMENTS[SEGMENTS.length - 1]) {
        log('Waiting 7s before next request (rate limit protection)...');
        await sleep(7000);
      }

    } catch (err) {
      log(`FAILED: ${err.message}`, 'error');
      results.push({ id: segment.id, title: segment.title, filename, status: 'failed', error: err.message });
      // Continue with next segment instead of crashing
    }
  }

  // ─── FINAL REPORT ──────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════');
  console.log('  RECORDING COMPLETE — SUMMARY');
  console.log('═══════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  log(`Successful: ${passed.length}/${SEGMENTS.length}`, passed.length === SEGMENTS.length ? 'success' : 'warn');

  if (failed.length > 0) {
    log(`Failed segments:`, 'error');
    failed.forEach(r => console.log(`  - Segment ${r.id} (${r.title}): ${r.error}`));
    console.log('\nTo retry failed segments only, run:');
    console.log(`  node record_lesson1.js --retry ${failed.map(r => r.id).join(',')}`);
  }

  // Write manifest file for Claude Code to reference during UI build
  const manifest = {
    lesson: 'lesson1',
    generatedAt: new Date().toISOString(),
    r2Prefix: R2_PREFIX,
    segments: results.map(r => ({
      id: r.id,
      title: r.title,
      filename: r.filename,
      r2Key: `${R2_PREFIX}/${r.filename}`,
      status: r.status,
    }))
  };

  const manifestPath = path.join(OUTPUT_DIR, 'lesson1_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(`\nManifest written: ${manifestPath}`, 'success');
  log('Claude Code will use this manifest to wire up the lesson player.\n', 'info');

  if (failed.length > 0) process.exit(1);
}

// ─── RETRY MODE ──────────────────────────────────────────────────────────────
// node record_lesson1.js --retry 03,07,11

const retryArg = process.argv.indexOf('--retry');
if (retryArg !== -1 && process.argv[retryArg + 1]) {
  const retryIds = process.argv[retryArg + 1].split(',');
  const filtered = SEGMENTS.filter(s => retryIds.includes(s.id));
  if (filtered.length === 0) {
    console.error('No matching segments found for retry IDs:', retryIds);
    process.exit(1);
  }
  console.log(`\nRetry mode — processing ${filtered.length} segment(s): ${retryIds.join(', ')}`);
  SEGMENTS.length = 0;
  SEGMENTS.push(...filtered);
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err.message);
  process.exit(1);
});
