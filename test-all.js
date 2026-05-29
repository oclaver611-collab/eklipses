// test-all.js — Master test runner: all 4 evals in sequence
// Run with: node test-all.js
//
// Evals:
//   1. eval-pipeline.js  — character-stream response quality (beach/sofia)
//   2. eval-tts.js       — TTS audio for all 16 characters
//   3. eval-coach-v4.js  — Ryan coaching: banned phrases, score, card fields
//   4. eval-wave2.js     — Wave 2 characters: correct name, no bleed, card fields

const { execSync } = require('child_process');

const EVALS = [
  {
    name: 'Pipeline Eval — /api/character-stream (beach/sofia)',
    cmd: 'node eval-pipeline.js',
    desc: '5 messages, checks length / banned phrases / latency < 3s',
    timeout: 60_000,
  },
  {
    name: 'TTS Eval — /api/tts for all 16 characters',
    cmd: 'node eval-tts.js',
    desc: 'Content-Type: audio/mpeg, body size > 0 per character',
    timeout: 120_000,
  },
  {
    name: 'Coach Eval v4 — Ryan feedback quality',
    cmd: 'node eval-coach-v4.js',
    desc: 'Banned phrases, score calibration, card fields, motivational close',
    timeout: 300_000,
  },
  {
    name: 'Wave 2 Eval — 9 new scenarios',
    cmd: 'node eval-wave2.js',
    desc: 'Correct character names, no scenario bleed, feedback card fields',
    timeout: 300_000,
  },
];

const PASS_SIGNALS = ['all pipeline checks passed', 'all tts checks passed', 'all tests passed', '0 failed'];

function didPass(output) {
  const lower = (output || '').toLowerCase();
  return PASS_SIGNALS.some(s => lower.includes(s));
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║           EKLIPSES — MASTER TEST RUNNER                 ║');
console.log('║           4 evals  •  run before every deploy           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const results = [];

for (let i = 0; i < EVALS.length; i++) {
  const ev = EVALS[i];
  console.log(`▶  [${i + 1}/${EVALS.length}] ${ev.name}`);
  console.log(`   ${ev.desc}`);
  console.log('   ' + '─'.repeat(54));

  let output = '';
  let passed = false;

  try {
    output = execSync(ev.cmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: ev.timeout,
    });
    console.log(output.trimEnd());
    passed = didPass(output);
  } catch (err) {
    output = err.stdout || err.message || '';
    console.log(output.trimEnd());
    if (err.stderr) console.error(err.stderr.trimEnd());
    passed = didPass(output);
  }

  results.push({ name: ev.name, passed });
  console.log('');
}

// ── Final summary ─────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                 FINAL RESULTS                           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

let allPassed = true;
for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`  ${icon}  ${r.name}`);
  if (!r.passed) allPassed = false;
}

const passCount = results.filter(r => r.passed).length;
console.log(`\n  ${passCount}/${results.length} evals passed`);

if (allPassed) {
  console.log('  🎉 All clear — safe to deploy.\n');
  process.exit(0);
} else {
  console.log('  ⚠️  Failures above — fix before deploying.\n');
  process.exit(1);
}
