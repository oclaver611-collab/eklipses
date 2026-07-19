// tests/test-coach-outcome.js
// Direct API tests for coach outcome calibration.
//
// TEST C: Coffee-bet session with positive ending (Sofia agrees to coffee).
//   Expected: score >= 7, bestMoment or part text credits the playful bet line.
//
// TEST D: Generic session with clear rejection ending.
//   Expected: score <= 6, part4 reflects the negative outcome.
//
// Run: node tests/test-coach-outcome.js
// Run against prod: node tests/test-coach-outcome.js --base=https://eklipses.vercel.app

const BASE = process.argv.find(a => a.startsWith('--base='))?.slice(7) || 'http://localhost:3000';

// TEST C — coffee-bet line + positive outcome
const CONV_POSITIVE = [
  { role: 'user',      content: "You look like you've been writing that sentence for twenty minutes." },
  { role: 'assistant', content: "Twelve, actually. It keeps changing." },
  { role: 'user',      content: "Let's make it playful — try to guess what I do, and if you get it right, I owe you a coffee." },
  { role: 'assistant', content: "Interesting offer. Okay... architect? No, too obvious. Something with travel. Am I warm?" },
  { role: 'user',      content: "Warmer. One more guess." },
  { role: 'assistant', content: "Marine researcher? You have that look of someone who studies things slowly." },
  { role: 'user',      content: "You get half a point. Enough for an espresso. Come get it with me." },
  { role: 'assistant', content: "Half a point counts. Okay, I'll come." },
];

// TEST D — generic session with explicit rejection ending
const CONV_REJECTION = [
  { role: 'user',      content: "Hey, how's your day going?" },
  { role: 'assistant', content: "Fine. Working." },
  { role: 'user',      content: "Nice weather out here today, right? You come to this beach a lot?" },
  { role: 'assistant', content: "Sometimes." },
  { role: 'user',      content: "You seem really interesting. I think you're really beautiful, I just had to say something." },
  { role: 'assistant', content: "I appreciate that but I'm trying to focus. Good luck." },
  { role: 'user',      content: "Oh okay, no pressure, maybe we could hang out sometime if you want." },
  { role: 'assistant', content: "I don't think so. Have a good day." },
];

async function callCoach(conversation, label) {
  console.log(`\n[${label}] Calling /api/coach...`);
  const res = await fetch(`${BASE}/api/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation,
      scenarioTitle: 'Beach — Sofia',
      scenarioKey: 'beach',
      opener: conversation.find(m => m.role === 'user')?.content || '',
      lesson1Complete: false,
      lesson2Complete: false,
      characterId: 'sofia',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[${label}] HTTP ${res.status}: ${text}`);
    return null;
  }
  return res.json();
}

function mentionsOutcome(feedback, keywords) {
  const haystack = [
    feedback.part1, feedback.part2, feedback.part3, feedback.part4,
    feedback.bestMoment, feedback.spokenSummary,
  ].filter(Boolean).join(' ').toLowerCase();
  return keywords.some(k => haystack.includes(k));
}

async function run() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  COACH OUTCOME CALIBRATION TEST');
  console.log(`  Target: ${BASE}`);
  console.log('══════════════════════════════════════════════════════════════');

  let allPass = true;

  // ── TEST C ────────────────────────────────────────────────────────────────
  const fc = await callCoach(CONV_POSITIVE, 'TEST-C');
  if (!fc) {
    console.error('[TEST-C] FAIL — no response');
    process.exit(1);
  }

  console.log(`\n[TEST-C] score: ${fc.score}/10`);
  console.log(`[TEST-C] spokenSummary: ${fc.spokenSummary}`);
  console.log(`[TEST-C] bestMoment: ${fc.bestMoment}`);
  console.log(`[TEST-C] part4: ${fc.part4}`);

  const cScoreOk = fc.score >= 7;
  const cMentionsBet = mentionsOutcome(fc, ['coffee', 'bet', 'guess', 'owe', 'playful', 'came', 'agreed', 'half a point']);
  console.log(`\n[TEST-C] score >= 7:                  ${cScoreOk ? '✅' : '❌'} (got ${fc.score})`);
  console.log(`[TEST-C] feedback credits key line/outcome: ${cMentionsBet ? '✅' : '❌'}`);
  if (!cScoreOk || !cMentionsBet) allPass = false;

  // ── TEST D ────────────────────────────────────────────────────────────────
  const fd = await callCoach(CONV_REJECTION, 'TEST-D');
  if (!fd) {
    console.error('[TEST-D] FAIL — no response');
    process.exit(1);
  }

  console.log(`\n[TEST-D] score: ${fd.score}/10`);
  console.log(`[TEST-D] spokenSummary: ${fd.spokenSummary}`);
  console.log(`[TEST-D] wouldSheDateHim: ${fd.wouldSheDateHim}`);

  const dScoreOk = fd.score <= 6;
  console.log(`\n[TEST-D] score <= 6 (rejection ends low): ${dScoreOk ? '✅' : '❌'} (got ${fd.score})`);
  if (!dScoreOk) allPass = false;

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  if (allPass) {
    console.log('  ALL TESTS PASSED ✅');
  } else {
    console.log('  SOME TESTS FAILED ❌');
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  process.exit(allPass ? 0 : 1);
}

run().catch(err => {
  console.error('\n[TEST] CRASHED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
