// scripts/test-auto.js
// ALL AUTOMATED TESTS — no human needed
// Run with: npm test
// Runs all evaluators back to back, fails if anything breaks

const { execSync } = require('child_process');

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║         EKLIPSES — AUTOMATED TEST SUITE                 ║');
console.log('║         No human needed. Run before every push.         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const tests = [
  {
    name: 'Sofia / Character Evaluator (84 checks)',
    cmd: 'node eval-mary.js',
    description: 'Tests Sofia responses — comma splices, name handling, incoherent input, length, character break'
  },
  {
    name: 'Coach Evaluator (30 checks)',
    cmd: 'node eval-coach-v2.js',
    description: 'Tests Ryan coaching — opener analysis, score calibration, motivational close, no hallucinations'
  },
  {
    name: 'All-Scenarios Evaluator — Wave 1 (6 scenarios)',
    cmd: 'node eval-scenarios.js',
    description: 'Tests all 6 Wave 1 characters for correct name, feedback card fields, scenario-specific opener suggestions'
  },
  {
    name: 'All-Scenarios Evaluator — Wave 2 (9 scenarios)',
    cmd: 'node eval-wave2.js',
    description: 'Tests all 9 Wave 2 characters for correct name, feedback card fields, no scenario bleed'
  },
];

let allPassed = true;
const results = [];

for (const test of tests) {
  console.log(`▶ Running: ${test.name}`);
  console.log(`  ${test.description}`);
  console.log('─'.repeat(58));

  try {
    const output = execSync(test.cmd, { encoding: 'utf8', stdio: 'pipe', timeout: 300000 });
    console.log(output);

    const passed = output.includes('All') && (output.includes('passed') || output.includes('0 failed'));
    results.push({ name: test.name, passed });
    if (!passed) allPassed = false;

  } catch (err) {
    console.log(err.stdout || err.message);
    results.push({ name: test.name, passed: false });
    allPassed = false;
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║         AUTOMATED TEST RESULTS                          ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

for (const r of results) {
  console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
}

if (allPassed) {
  console.log('\n🎉 All automated tests passed. Safe to push.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Fix before pushing.\n');
  process.exit(1);
}
