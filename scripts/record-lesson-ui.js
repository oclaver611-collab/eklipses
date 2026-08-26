#!/usr/bin/env node
/**
 * record-lesson-ui.js
 * Records the real LEARN lesson1 player UI (Sofia video, Ryan orb/waveform,
 * progress bar) via Playwright, then post-processes with ffmpeg into
 * lesson1-slice01-of08.mp4, lesson1-slice02-of08.mp4, lesson1-slice03-of08.mp4
 * with burnt-in gold captions and 4s outro card.
 *
 * Run:  node scripts/record-lesson-ui.js
 * Output: lesson1_slices/lesson1-slice0X-of08.mp4 (overwrites synthetic renders)
 */

const { chromium }    = require('playwright');
const { execSync }    = require('child_process');
const fs              = require('fs');
const path            = require('path');
const os              = require('os');

// ── Paths ──────────────────────────────────────────────────────────────────────
const ROOT       = path.resolve(__dirname, '..');
const SLICE_DIR  = path.join(ROOT, 'lesson1_slices');
const PUBLIC_DIR = path.join(ROOT, 'tools', 'video-overlay', 'public');
const TS_DATA    = path.join(ROOT, 'tools', 'video-overlay', 'src', 'LessonSliceData.ts');
const TMP        = path.join(os.tmpdir(), `ek-ui-record-${Date.now()}`);
fs.mkdirSync(TMP, { recursive: true });

const BASE_URL = 'https://eklipses.vercel.app';
const VIEWPORT = { width: 540, height: 960 };  // 9:16 portrait; ffmpeg 2× to 1080×1920

// ── Slice boundaries (seconds from lesson T=0) ─────────────────────────────────
// seg durations (from build-lesson-slices.js DURATIONS):
//   01=85.68, 02=58.67, 03=18.94, 04=76.98, 05=17.92
const SLICES = [
  { num: 1, start:   0.00, audioDur:  85.68, mp3: 'lesson1-slice01.mp3' },
  { num: 2, start:  85.68, audioDur:  77.61, mp3: 'lesson1-slice02.mp3' },  // seg02+03
  { num: 3, start: 163.29, audioDur:  94.90, mp3: 'lesson1-slice03.mp3' },  // seg04+05
];
const TOTAL_RECORD_SEC = 163.29 + 94.90 + 6;  // ~264s — 6s buffer past slice 3 end

// ── Load caption data from LessonSliceData.ts ──────────────────────────────────
function loadCaptionData() {
  const ts = fs.readFileSync(TS_DATA, 'utf8');
  // Strip TypeScript-specific syntax to make it valid JS
  const js = ts
    .replace(/export\s+type\s+\w+\s*=[\s\S]*?\};/, '')
    .replace(/:\s*LessonCaption\[\]/g, '')
    .replace(/export\s+const\s+/g, 'const ');
  // Evaluate to extract the arrays
  // eslint-disable-next-line no-new-func
  const fn = new Function(js + `
    return {
      captions: [SLICE1_CAPTIONS, SLICE2_CAPTIONS, SLICE3_CAPTIONS],
    };
  `);
  return fn().captions;
}

// ── ASS subtitle helpers ────────────────────────────────────────────────────────
function assTime(s) {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs  = Math.round((s % 1) * 100);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

const ASS_STYLES_HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial Black,62,&H0054A0D9,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,80,80,220,1
Style: OutroTag,Arial,46,&H00C8A0A0,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,5,80,80,0,1
Style: OutroUrl,Arial Black,70,&H0054A0D9,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,5,80,80,0,1
Style: OutroSub,Arial,38,&H00888888,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

function buildCaptionASS(captions) {
  const dialogues = captions.map(c =>
    `Dialogue: 0,${assTime(c.startS)},${assTime(c.endS)},Caption,,0,0,0,,${c.text}`
  );
  return ASS_STYLES_HEADER + '\n' + dialogues.join('\n');
}

// Outro ASS: 4-second dark card — text timed across 0-4s
function buildOutroASS() {
  return ASS_STYLES_HEADER + '\n' +
    // \pos(x,y) + alignment 5 (middle-center): anchor at screen center offset by y
    'Dialogue: 0,0:00:00.20,0:00:04.00,OutroTag,,0,0,0,,{\\pos(540,830)}Want to try this yourself?\n' +
    'Dialogue: 0,0:00:00.50,0:00:04.00,OutroUrl,,0,0,0,,{\\pos(540,960)}eklipses.com\n' +
    'Dialogue: 0,0:00:01.00,0:00:04.00,OutroSub,,0,0,0,,{\\pos(540,1090)}2 free sessions · no card required';
}

// ── ffmpeg helper ───────────────────────────────────────────────────────────────
// cwd lets us use relative paths in filter strings so Windows drive-letter colons
// (C:/...) don't get mis-parsed as option separators by libavfilter.
function ffmpeg(args, label, cwd) {
  console.log(`  [ffmpeg] ${label}`);
  execSync(`ffmpeg -y ${args}`, { stdio: ['pipe', 'pipe', 'inherit'], cwd });
}

// ── Main ────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n════════════════════════════════════════════');
  console.log('  LESSON 1 UI RECORDER');
  console.log('════════════════════════════════════════════\n');

  // 1. Load caption data ────────────────────────────────────────────────────────
  console.log('[ 1 ] Loading caption data from LessonSliceData.ts...');
  let captionData;
  try {
    captionData = loadCaptionData();
    console.log(`  ✓ ${captionData[0].length} / ${captionData[1].length} / ${captionData[2].length} captions loaded`);
  } catch (e) {
    console.error('  ✗ Failed to load captions:', e.message);
    process.exit(1);
  }

  // 2. Playwright recording ─────────────────────────────────────────────────────
  console.log(`\n[ 2 ] Recording LEARN UI at ${BASE_URL}...`);
  console.log(`  Viewport: ${VIEWPORT.width}×${VIEWPORT.height} | Duration: ~${Math.ceil(TOTAL_RECORD_SEC)}s`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
    ],
  });

  const recordDir = TMP;
  let videoPathTmp = null;
  let t0Wall = null;
  let tContextWall = null;

  try {
    tContextWall = Date.now();

    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: {
        dir: recordDir,
        size: VIEWPORT,
      },
    });

    // Set dev key BEFORE navigation so the app picks it up immediately
    await context.addInitScript(() => {
      localStorage.setItem('ek-dev-key', 'ek_dev_2026');
      // Reset lesson progress so lesson starts from the beginning
      localStorage.removeItem('eklipses_lesson1_complete');
      localStorage.removeItem('eklipses_lesson1_progress');
    });

    const page = await context.newPage();

    // Listen for [lesson] START to capture T=0
    const lessonStarted = new Promise(resolve => {
      page.on('console', msg => {
        if (!t0Wall && msg.text().includes('[lesson] START')) {
          t0Wall = Date.now();
          console.log(`  ✓ [lesson] START detected at +${((t0Wall - tContextWall)/1000).toFixed(1)}s from context`);
          resolve();
        }
      });
      // Fallback: if no START log in 60s, give up
      setTimeout(() => { if (!t0Wall) { t0Wall = Date.now(); resolve(); } }, 60000);
    });

    // Navigate
    console.log('  → Navigating...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Dismiss hero overlay by clicking the Start (→) button
    console.log('  → Dismissing hero...');
    await page.waitForSelector('#ek-h6-start', { timeout: 15000 });
    await page.locator('#ek-h6-start').click();
    await page.waitForSelector('#ek-hero-v6', { state: 'detached', timeout: 30000 });
    console.log('  ✓ Hero dismissed');

    // Inject CSS to clean up the recording:
    //   - hide native captions (replaced by burnt-in gold captions)
    //   - hide playback control buttons (keep progress bar and avatars)
    //   - hide close button
    await page.evaluate(() => {
      const s = document.createElement('style');
      s.textContent = `
        #elp-caption  { display: none !important; }
        .elp-controls { display: none !important; }
        .elp-close    { display: none !important; }
      `;
      document.head.appendChild(s);
    });

    // Start lesson 1
    console.log('  → Starting Lesson 1...');
    await page.waitForSelector('#ek-start-lesson1', { timeout: 15000 });
    await page.locator('#ek-start-lesson1').click();
    await page.waitForSelector('#ek-lesson-player', { state: 'visible', timeout: 10000 });
    console.log('  ✓ Lesson player open');

    // Wait for [lesson] START console log (T=0)
    console.log('  → Waiting for first segment to begin playing...');
    await lessonStarted;

    // Record for the required duration plus buffer
    console.log(`  → Recording ${TOTAL_RECORD_SEC}s of lesson content...`);
    await page.waitForTimeout(TOTAL_RECORD_SEC * 1000);
    console.log('  ✓ Recording complete');

    // Save video
    const videoFile = await page.video();
    await context.close();
    videoPathTmp = await videoFile.path();
    console.log(`  ✓ Video saved: ${videoPathTmp}`);

  } finally {
    await browser.close();
  }

  if (!videoPathTmp || !fs.existsSync(videoPathTmp)) {
    console.error('  ✗ Video file not found — recording failed');
    process.exit(1);
  }

  // Calculate trim offset: seconds from recording start to lesson T=0
  const trimOffset = (t0Wall - tContextWall) / 1000;
  console.log(`\n  Trim offset: ${trimOffset.toFixed(2)}s (lead-in before lesson audio started)`);

  // 3. Generate ASS files ───────────────────────────────────────────────────────
  console.log('\n[ 3 ] Generating ASS subtitle files...');

  const outroAssPath = path.join(TMP, 'outro.ass').replace(/\\/g, '/');
  fs.writeFileSync(outroAssPath, buildOutroASS(), 'utf8');
  console.log('  ✓ outro.ass');

  const assFiles = [];
  for (let i = 0; i < 3; i++) {
    const assPath = path.join(TMP, `slice${i+1}.ass`).replace(/\\/g, '/');
    fs.writeFileSync(assPath, buildCaptionASS(captionData[i]), 'utf8');
    assFiles.push(assPath);
    console.log(`  ✓ slice${i+1}.ass (${captionData[i].length} entries)`);
  }

  // 4. ffmpeg post-processing ───────────────────────────────────────────────────
  console.log('\n[ 4 ] Post-processing slices with ffmpeg...');

  // Convert the webm recording path to use forward slashes for ffmpeg
  const recPath = videoPathTmp.replace(/\\/g, '/');

  for (const slice of SLICES) {
    const { num, start, audioDur, mp3 } = slice;
    const trimStart = trimOffset + start;
    const tag       = String(num).padStart(2, '0');
    const audioIn   = path.join(PUBLIC_DIR, mp3).replace(/\\/g, '/');
    const outFile   = path.join(SLICE_DIR, `lesson1-slice${tag}-of08.mp4`).replace(/\\/g, '/');
    // Relative ASS names — resolved against cwd=TMP to avoid Windows drive-letter
    // colon being mis-parsed as a filter-option separator by libavfilter.
    const captionAss = `slice${num}.ass`;
    const outroAss   = 'outro.ass';

    console.log(`\n  Slice ${num}: ${audioDur}s audio + 4s outro → ${path.basename(outFile)}`);

    // Single pass: trim + scale + fps-normalise + burn captions, concat 4s dark
    // outro card with promotional text, mux slice audio.
    // All filter-string ASS paths are relative; cwd=TMP resolves them.
    ffmpeg(
      `-ss ${trimStart.toFixed(3)} -i "${recPath}" ` +
      `-f lavfi -i "color=c=0x15171C:s=1080x1920:r=30:d=4" ` +
      `-i "${audioIn}" ` +
      `-filter_complex ` +
        `"[0:v]trim=duration=${audioDur},setpts=PTS-STARTPTS,` +
        `scale=w=1080:h=1920:flags=lanczos,fps=30,` +
        `ass='${captionAss}'[lesson];` +
        `[1:v]fps=30,ass='${outroAss}'[outro];` +
        `[lesson][outro]concat=n=2:v=1:a=0[outv]" ` +
      `-map "[outv]" -map "2:a" ` +
      `-c:v libx264 -crf 18 -preset fast ` +
      `-c:a aac -b:a 192k -shortest ` +
      `-movflags +faststart ` +
      `"${outFile}"`,
      `Slice ${num} — trim/scale/captions/outro/audio`,
      TMP  // cwd so relative ASS paths resolve correctly
    );

    const stat = fs.statSync(outFile.replace(/\//g, path.sep));
    console.log(`  ✓ ${path.basename(outFile)} (${(stat.size / 1e6).toFixed(1)} MB)`);
  }

  // 5. Cleanup temp files ───────────────────────────────────────────────────────
  console.log('\n[ 5 ] Cleaning up temp files...');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  console.log('  ✓ Done');

  console.log('\n════════════════════════════════════════════');
  console.log('  OUTPUT FILES:');
  for (const { num } of SLICES) {
    const tag = String(num).padStart(2, '0');
    const f = path.join(SLICE_DIR, `lesson1-slice${tag}-of08.mp4`);
    const mb = (fs.statSync(f).size / 1e6).toFixed(1);
    console.log(`  ${f}  (${mb} MB)`);
  }
  console.log('════════════════════════════════════════════\n');
})().catch(err => { console.error('\n✗ Fatal:', err.message); process.exit(1); });
