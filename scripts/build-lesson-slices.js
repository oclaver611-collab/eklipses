/**
 * build-lesson-slices.js
 * Generates lesson1 marketing short-video slices (test batch: slices 1-3).
 *
 * Run: node scripts/build-lesson-slices.js
 *
 * Outputs:
 *   tools/video-overlay/public/lesson1-slice01.mp3  (single-seg concat)
 *   tools/video-overlay/public/lesson1-slice02.mp3  (multi-seg concat)
 *   tools/video-overlay/public/lesson1-slice03.mp3  (multi-seg concat)
 *   tools/video-overlay/src/LessonSliceData.ts      (generated caption timing)
 *   lesson1_slices/lesson1-cutmap.json              (already written)
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT        = path.resolve(__dirname, '..');
const AUDIO_DIR   = path.join(ROOT, 'lesson1_audio');
const PUBLIC_DIR  = path.join(ROOT, 'tools', 'video-overlay', 'public');
const SRC_DIR     = path.join(ROOT, 'tools', 'video-overlay', 'src');

// ── SCRIPTS (verbatim from record_lesson1.js) ────────────────────────────────

const SCRIPTS = {
  '01': `What you are about to see is something most men spend their entire lives never figuring out.
They see a woman like this. They feel that pull. And they do nothing. They walk past. They go home. They tell themselves next time will be different. And next time — they do the exact same thing.
Here is what those men do not understand. The problem is never confidence. The problem is never looks. The problem is never what to say. The problem is that nobody ever showed them how this actually works.
Today I am going to show you.
You are going to watch a real approach from start to finish. How to stop her. How to make her stay. How to build something real in a matter of minutes with a complete stranger. And I am going to stop along the way and show you exactly what is happening beneath the surface — because what you see on the outside and what is actually going on underneath are two completely different things.
By the time this lesson ends, you will have a set of principles you can use anywhere. Not tricks. Not lines. Principles. Things that work because they are based on how attraction actually functions — not on what society tells you, not on what movies show you, but on what is real.
There is one rule before we begin. Watch everything. Not just what I say — watch how I say it. Watch the timing. Watch what I do not say. Because sometimes the most important move is the one you cannot hear.
She is right there. Let us begin.`,

  '02': `Before I take a single step toward her, I want you to notice what I am not doing.
I am not rehearsing a line in my head. I am not waiting for the perfect moment. I am not asking myself whether she will like me or whether I am good enough.
I am observing.
This is the first thing most men get completely wrong. They spend so much time inside their own heads — planning, calculating, worrying — that by the time they are ready, the moment is gone. And they use that as an excuse. They say the moment passed. The truth is they killed it themselves.
There is something I want you to remember for the rest of your life. The woman standing in front of you is not thinking about you. She is in her own world. She does not know you exist yet. That means you have something most men waste — a blank slate. No judgment. No expectations. Nothing.
What you do in the next thirty seconds will determine everything.
I am going to walk over there now. Watch what I say — and more importantly, watch what I do not say.`,

  '03': `Hey — sorry to interrupt. Can I tell you something for just a second?
I was walking past and I had to stop. You have this energy — like you belong somewhere else entirely. Not here. Somewhere quieter. More interesting. I don't know why but that caught my attention.
Strange things are usually the most true.`,

  '04': `Stop. Right there.
Did you notice what just happened? I did not tell her she was beautiful. I did not tell her she had a nice smile. I did not say any of the things that every other man who has ever approached her has said.
I made a specific observation. Something real. Something that showed I was actually paying attention to her — not just to how she looks, but to who she is in that moment.
Here is why this matters more than anything else you will learn today.
When you compliment a woman's appearance, her radar receives that signal and immediately files it into a category. She has heard it a thousand times. She knows exactly what it means and exactly what you want. The conversation is already over before it begins.
But when you say something specific — something that could only come from someone who was genuinely paying attention — something different happens. She thinks: who is this person? How did he see that? That curiosity is the door opening.
This is Step 1. The observation opener. Not a compliment. An observation. The difference between those two things is the difference between a man she forgets in ten seconds and a man she thinks about later.
Find something real. Something specific. Something only someone who was truly present would notice. And say it without apology, without hesitation, without needing her to validate it.
That is how you begin.`,

  '05': `You have been sitting here a while. Writing something?
People who say they are just thinking are always thinking about something very specific.
You don't give much away, do you.
No. Actually — that is interesting. Most people give everything away in the first thirty seconds. You didn't.
It is a problem sometimes.`,
};

const DURATIONS = {
  '01': 85.68,
  '02': 58.67,
  '03': 18.94,
  '04': 76.98,
  '05': 17.92,
};

// ── TEST SLICES (segments to concatenate) ────────────────────────────────────

const TEST_SLICES = [
  { num: 1, segments: ['01'] },
  { num: 2, segments: ['02', '03'] },
  { num: 3, segments: ['04', '05'] },
];

// ── TEXT CHUNKING ────────────────────────────────────────────────────────────

/**
 * Splits a script string into caption chunks of ~targetWords words.
 * Prefers sentence boundaries, then em-dash/comma boundaries.
 */
function chunkText(text, targetWords = 7) {
  // Normalise whitespace
  const clean = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // Split into sentences (at .  !  ? followed by space or end)
  const rawSentences = clean.split(/(?<=[.!?])\s+/);
  const sentences = rawSentences.map(s => s.trim()).filter(Boolean);

  const chunks = [];
  let accumWords = [];

  const flush = () => {
    if (accumWords.length > 0) {
      chunks.push(accumWords.join(' '));
      accumWords = [];
    }
  };

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);

    // If adding this sentence stays within ~1.5× target, accumulate
    if (accumWords.length + words.length <= targetWords * 1.6) {
      accumWords.push(...words);
    } else {
      // Flush what we have, then handle this sentence
      flush();

      if (words.length <= targetWords * 1.6) {
        // Sentence fits as its own chunk
        accumWords = words;
      } else {
        // Long sentence: split at em-dash or comma first
        const parts = sentence.split(/(?<=—|,)\s*/);
        for (const part of parts) {
          const pWords = part.trim().split(/\s+/);
          if (accumWords.length + pWords.length <= targetWords * 1.6) {
            accumWords.push(...pWords);
          } else {
            flush();
            // Still too long? force-split at targetWords
            for (let i = 0; i < pWords.length; i += targetWords) {
              const slice = pWords.slice(i, i + targetWords);
              if (i + targetWords < pWords.length) {
                chunks.push(slice.join(' '));
              } else {
                accumWords = slice;
              }
            }
          }
        }
      }
    }
  }
  flush();
  return chunks;
}

/**
 * Generates proportional caption timing for one or more script segments
 * concatenated together.
 */
function generateCaptions(segmentIds) {
  const captions = [];
  let timeOffset = 0;

  for (const id of segmentIds) {
    const rawText = SCRIPTS[id];
    const duration = DURATIONS[id];
    const clean = rawText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const chunks = chunkText(clean, 7);
    const totalChars = clean.length;

    let charPos = 0;
    for (const chunk of chunks) {
      const chunkChars = chunk.length + 1; // +1 for trailing space
      const startS = timeOffset + (charPos / totalChars) * duration;
      const endS = timeOffset + ((charPos + chunkChars) / totalChars) * duration;
      captions.push({
        startS: Math.round(startS * 100) / 100,
        endS: Math.round(endS * 100) / 100,
        text: chunk,
      });
      charPos += chunkChars;
    }

    timeOffset += duration;
  }

  return captions;
}

// ── AUDIO CONCATENATION ──────────────────────────────────────────────────────

function concatAudio(segmentIds, outputFile) {
  if (segmentIds.length === 1) {
    // Single segment — just copy
    const src = path.join(AUDIO_DIR, `lesson1_seg${segmentIds[0]}.mp3`);
    fs.copyFileSync(src, outputFile);
    console.log(`  copied  ${path.basename(outputFile)}`);
    return;
  }

  // Write ffmpeg concat list to temp file
  const tmpList = path.join(os.tmpdir(), `ek-concat-${Date.now()}.txt`);
  const lines = segmentIds.map(id =>
    `file '${path.join(AUDIO_DIR, `lesson1_seg${id}.mp3`).replace(/\\/g, '/')}'`
  );
  fs.writeFileSync(tmpList, lines.join('\n'));

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${tmpList}" -c copy "${outputFile}"`,
    {stdio: 'inherit'}
  );
  fs.unlinkSync(tmpList);
  console.log(`  concat  ${path.basename(outputFile)}`);
}

// ── GENERATE LessonSliceData.ts ──────────────────────────────────────────────

function buildDataFile(slices) {
  const sliceBlocks = slices.map(({num, segments}) => {
    const captions = generateCaptions(segments);
    const audioFile = `lesson1-slice${String(num).padStart(2,'0')}.mp3`;
    const totalAudio = segments.reduce((s, id) => s + DURATIONS[id], 0);
    const totalWithOutro = totalAudio + 4; // 4s outro

    const captionLines = captions
      .map(c =>
        `  { startS: ${c.startS}, endS: ${c.endS}, text: ${JSON.stringify(c.text)} },`
      )
      .join('\n');

    return `
// ── Slice ${num} ─────────────────────────────────────────────────────────────────
export const SLICE${num}_AUDIO = '${audioFile}';
export const SLICE${num}_TOTAL_SEC = ${Math.round(totalWithOutro * 100) / 100};
export const SLICE${num}_CAPTIONS: LessonCaption[] = [
${captionLines}
];`;
  });

  return `// LessonSliceData.ts — AUTO-GENERATED by scripts/build-lesson-slices.js
// Do not edit by hand. Re-run the build script to regenerate.

export type LessonCaption = {
  startS: number;
  endS: number;
  text: string;
};
${sliceBlocks.join('\n')}
`;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════');
console.log('  LESSON 1 SLICE BUILDER — test batch 1-3');
console.log('══════════════════════════════════════════\n');

// 1. Concatenate audio
console.log('[ 1/3 ] Concatenating audio...');
for (const {num, segments} of TEST_SLICES) {
  const out = path.join(PUBLIC_DIR, `lesson1-slice${String(num).padStart(2,'0')}.mp3`);
  concatAudio(segments, out);
}

// 2. Generate LessonSliceData.ts
console.log('\n[ 2/3 ] Generating caption timing data...');
const dataTs = buildDataFile(TEST_SLICES);
const dataPath = path.join(SRC_DIR, 'LessonSliceData.ts');
fs.writeFileSync(dataPath, dataTs, 'utf8');
console.log(`  wrote   ${dataPath}`);

console.log('\n[ 3/3 ] Done. Run Remotion renders next:');
TEST_SLICES.forEach(({num}) => {
  const padded = String(num).padStart(2, '0');
  console.log(`  cd tools/video-overlay && npx remotion render LessonSlice${num} out/lesson1-slice${padded}-of08.mp4`);
});
console.log('');
