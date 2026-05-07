// scripts/test-human.js
// ALL HUMAN-REQUIRED TESTS — needs your eyes, phone, or judgment
// Run with: npm run test:human
// Go through each item, mark pass/fail

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (q) => new Promise(resolve => rl.question(q, resolve));

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║         EKLIPSES — HUMAN TEST CHECKLIST                 ║');
console.log('║         Needs your eyes, phone, or judgment.            ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Open https://eklipses.vercel.app in a browser before starting.\n');

const checks = [

  // ── VIDEO / AVATAR ────────────────────────────────────────────────────────
  {
    category: '🎥 VIDEO & AVATAR',
    items: [
      'Sofia idle video loads cleanly when scenario starts — no speaking video flicker',
      'Speaking video switches ON at same time as audio (not 1-2 seconds early)',
      'Speaking video switches OFF immediately when audio ends — no lip movement after',
      'Avatar picker shows all 5 characters with correct photos and names',
      'Selecting an avatar does NOT auto-launch a scenario',
    ]
  },

  // ── CONVERSATION ──────────────────────────────────────────────────────────
  {
    category: '💬 CONVERSATION',
    items: [
      'Say "hi" — Sofia responds with "Sofia." (not "how are you")',
      'Say "my name is Paul" — Sofia acknowledges "Paul" in next response',
      'Say something garbled — Sofia asks clarifying question',
      'Have 3-minute conversation — Sofia stays in character throughout',
      'Sofia does not repeat the same phrase twice in a session',
    ]
  },

  // ── COACH FEEDBACK ────────────────────────────────────────────────────────
  {
    category: '🎯 COACH FEEDBACK',
    items: [
      'After session: Ryan gives 4-part feedback (opener, middle, mistake, verdict)',
      'Score varies correctly — weak opener gets lower score than strong opener',
      'Feedback card shows YOUR PROGRESS bar chart',
      'Stat bar shows streak + best score + session count under Ryan name',
      '"Would Sofia date you?" section shows honest answer',
    ]
  },

  // ── ONBOARDING ────────────────────────────────────────────────────────────
  {
    category: '🚀 ONBOARDING',
    items: [
      'Open in incognito — 3-screen onboarding appears',
      'All 3 screens navigate correctly',
      '"Start my first session" launches the app',
      'Open normally (not incognito) — onboarding is skipped',
    ]
  },

  // ── MOBILE ────────────────────────────────────────────────────────────────
  {
    category: '📱 MOBILE (needs phone)',
    items: [
      'Open on iPhone Safari — layout looks correct',
      'Open on Android Chrome — layout looks correct',
      'Mic button is easy to tap on mobile',
      'Avatar video displays correctly on small screen',
      'Coach feedback card is readable on mobile',
      'Scenario cards scroll horizontally on mobile',
    ]
  },

  // ── VISUAL ────────────────────────────────────────────────────────────────
  {
    category: '🎨 VISUAL QUALITY',
    items: [
      'Avatar picker looks premium — photos are sharp and beautiful',
      'Beach background video loads behind Sofia',
      'No broken images (404s) on main scenarios',
      'Score color is green for 7+, yellow for 5-6, red for below 5',
    ]
  },

];

async function run() {
  let totalPass = 0;
  let totalFail = 0;
  const failed = [];

  for (const section of checks) {
    console.log(`\n${'═'.repeat(58)}`);
    console.log(`${section.category}`);
    console.log('═'.repeat(58));

    for (const item of section.items) {
      const answer = await ask(`\n  [ ] ${item}\n      Pass? (y/n/s to skip): `);
      if (answer.toLowerCase() === 'y') {
        console.log('      ✅ Passed');
        totalPass++;
      } else if (answer.toLowerCase() === 'n') {
        console.log('      ❌ Failed');
        totalFail++;
        failed.push(`${section.category}: ${item}`);
      } else {
        console.log('      ⏭  Skipped');
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         HUMAN TEST RESULTS                              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  ✅ Passed: ${totalPass}`);
  console.log(`  ❌ Failed: ${totalFail}`);

  if (failed.length > 0) {
    console.log('\n  Failed items:');
    failed.forEach(f => console.log(`    • ${f}`));
  }

  if (totalFail === 0) {
    console.log('\n🎉 All human checks passed. App is ready.\n');
  } else {
    console.log(`\n⚠️  ${totalFail} items need fixing.\n`);
  }

  rl.close();
}

run();
