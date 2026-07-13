require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'test_segments');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const FISH_KEY      = process.env.FISH_AUDIO_API_KEY;
const RYAN_VOICE    = '44b996214285427697767cb469793647';
const SOFIA_VOICE   = '836513f294d64aec8403226e69268b1b';

// ─── SEGMENTS ────────────────────────────────────────────────────────────────

const ALEX_LINES = [
  { file: 'alex_s3_01', text: "Hey — sorry, one second." },
  { file: 'alex_s3_02', text: "That hairstyle is actually incredible — where do you get it done?" },
  { file: 'alex_s3_03', text: "No seriously — most guys just walk past and don't notice things like that." },
  { file: 'alex_s3_04', text: "I actually notice things." },
];

const SOFIA_LINES = [
  { file: 'sofia_s3_01', text: "...oh. Thank you, that's actually really sweet." },
  { file: 'sofia_s3_02', text: "Most people don't notice things like that." },
];

const RYAN_LINES = [
  { file: 'ryan_s4_01', text: "Stop." },
  { file: 'ryan_s4_02', text: "Did you see what Alex just did?" },
  { file: 'ryan_s4_03', text: "He didn't say you're beautiful." },
  { file: 'ryan_s4_04', text: "Every guy says that." },
  { file: 'ryan_s4_05', text: "She's heard it five times today." },
  { file: 'ryan_s4_06', text: "He found one specific thing — her hairstyle — and commented on it." },
  { file: 'ryan_s4_07', text: "That's Step 1." },
  { file: 'ryan_s4_08', text: "Find one real thing." },
  { file: 'ryan_s4_09', text: "Could be her hairstyle. Her outfit. A bracelet. Her accent. Where she might be from." },
  { file: 'ryan_s4_10', text: "Anything specific." },
  { file: 'ryan_s4_11', text: "Lines you can actually use right now." },
  { file: 'ryan_s4_12', text: "Excuse me — that jacket is amazing, where did you get it?" },
  { file: 'ryan_s4_13', text: "Let me guess where you're from. Italian? French? I can never tell." },
  { file: 'ryan_s4_14', text: "That hairstyle is incredible — where do you get it done?" },
  { file: 'ryan_s4_15', text: "Simple. Specific. Real." },
  { file: 'ryan_s4_16', text: "She feels noticed — not hit on." },
  { file: 'ryan_s4_17', text: "That's the difference." },
  { file: 'ryan_s4_18', text: "Step 1 done. Let's keep going." },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function openaiTTS(text, filename) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'echo', input: text, response_format: 'mp3' }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { file: filename, kb: null, ms: Date.now() - t0, error: `HTTP ${res.status}: ${err.slice(0, 80)}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename + '.mp3'), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null };
  } catch (e) {
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message };
  }
}

async function fishTTS(text, voiceId, filename) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, reference_id: voiceId, format: 'mp3', streaming: false }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { file: filename, kb: null, ms: Date.now() - t0, error: `HTTP ${res.status}: ${err.slice(0, 80)}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, filename + '.mp3'), buf);
    return { file: filename, kb: (buf.length / 1024).toFixed(1), ms: Date.now() - t0, error: null };
  } catch (e) {
    return { file: filename, kb: null, ms: Date.now() - t0, error: e.message };
  }
}

// ─── SEQUENTIAL FISH AUDIO WITH 1s RATE LIMIT ────────────────────────────────

async function runFishSequential(lines, voiceId) {
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await sleep(1000);
    const { file, text } = lines[i];
    process.stdout.write(`  [fish] ${file} ...`);
    const r = await fishTTS(text, voiceId, file);
    process.stdout.write(r.error ? ` ERROR: ${r.error}\n` : ` ${r.kb} KB (${r.ms}ms)\n`);
    results.push(r);
  }
  return results;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n── Alex (OpenAI tts-1-hd / echo) — re-recording changed lines ──');
  const alexResults = await Promise.all(
    ALEX_LINES.map(({ file, text }) => {
      process.stdout.write(`  [openai] ${file} ...\n`);
      return openaiTTS(text, file);
    })
  );

  console.log('\n── Sofia (Fish Audio) — re-recording changed lines ─────────────');
  const sofiaResults = await runFishSequential(SOFIA_LINES, SOFIA_VOICE);

  // Ryan lines unchanged — skipping re-record
  console.log('\n── Ryan (Fish Audio) — unchanged, skipped ──────────────────────');

  // ── Summary table ──────────────────────────────────────────────────────────
  const all = [...alexResults, ...sofiaResults];
  const ok  = all.filter(r => !r.error);
  const err = all.filter(r => r.error);

  console.log('\n┌──────────────────┬──────────┬──────────┬──────────────────────────────────────────┐');
  console.log('│ File             │   KB     │   ms     │ Status                                   │');
  console.log('├──────────────────┼──────────┼──────────┼──────────────────────────────────────────┤');
  for (const r of all) {
    const f = r.file.padEnd(16);
    const k = (r.kb ?? '—').toString().padStart(6);
    const m = r.ms.toString().padStart(6);
    const s = r.error ? ('ERR ' + r.error).slice(0, 40).padEnd(40) : 'OK'.padEnd(40);
    console.log(`│ ${f} │ ${k}   │ ${m}   │ ${s} │`);
  }
  console.log('└──────────────────┴──────────┴──────────┴──────────────────────────────────────────┘');
  console.log(`\n  ${ok.length}/${all.length} re-recorded OK   ${err.length > 0 ? err.length + ' ERRORS' : 'no errors'}   (Ryan s4 unchanged)   → test_segments/`);
})();
