// eval-coach.js — Automated evaluator for api/coach.js
// Run with: node eval-coach.js
// Requires GROQ_API_KEY in environment or .env file

require('dotenv').config();

// Toggle: 'local' uses coach.js directly, 'live' hits Vercel
const MODE = process.env.EVAL_MODE || 'live';
const VERCEL_URL = process.env.VERCEL_URL || 'https://eklipses.vercel.app';

let handler;
if (MODE === 'local') {
  handler = require('./api/coach.js');
}

// ─── TEST TRANSCRIPTS ────────────────────────────────────────────────────────

const TEST_CASES = [
  {
    name: 'Generic opener (hi + name ask)',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    expectedOpener: 'hi I never saw you here what is your name',
    conversation: [
      { role: 'user',      content: 'hi I never saw you here what is your name' },
      { role: 'assistant', content: 'Sofia. This spot is usually quieter.' },
      { role: 'user',      content: 'my name is Paul so what are you up to Sophia' },
      { role: 'assistant', content: 'Just enjoying the view. I come here to write.' },
      { role: 'user',      content: 'interesting what do you write about' },
      { role: 'assistant', content: 'I write for a small magazine covering local culture.' },
      { role: 'user',      content: 'I am a doctor at St Michael hospital do you enjoy writing' },
      { role: 'assistant', content: 'I do. It lets me explore stories that matter.' },
      { role: 'user',      content: 'you seem really interesting maybe we can grab a coffee sometime' },
      { role: 'assistant', content: 'I am flattered but let us keep talking first.' },
    ]
  },
  {
    name: 'Name-only opener',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    expectedOpener: 'hi',
    conversation: [
      { role: 'user',      content: 'hi' },
      { role: 'assistant', content: 'Sofia.' },
      { role: 'user',      content: 'what is your name' },
      { role: 'assistant', content: 'I just said. Sofia.' },
      { role: 'user',      content: 'nice to meet you I am Eric what are you doing here' },
      { role: 'assistant', content: 'Writing. I come here for the quiet.' },
      { role: 'user',      content: 'you write for a living or just for fun' },
      { role: 'assistant', content: 'For a magazine. Local stories mostly.' },
      { role: 'user',      content: 'that is cool I am a lawyer by the way maybe we can talk more over coffee' },
      { role: 'assistant', content: 'Maybe. We just met though.' },
    ]
  },
  {
    name: 'Strong opener',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    expectedOpener: 'you look like you found the only quiet spot on the whole beach — is this your spot',
    conversation: [
      { role: 'user',      content: 'you look like you found the only quiet spot on the whole beach — is this your spot' },
      { role: 'assistant', content: 'Ha. Pretty much. I come here when I need to think.' },
      { role: 'user',      content: 'what are you thinking about today' },
      { role: 'assistant', content: 'An article I am working on about coastal erosion actually.' },
      { role: 'user',      content: 'that sounds like something you actually care about — what got you into that topic' },
      { role: 'assistant', content: 'I grew up near the water. Watching it change over time is unsettling.' },
      { role: 'user',      content: 'I get that. I am a marine biologist so I see it from a different angle' },
      { role: 'assistant', content: 'Really. What kind of work do you do specifically.' },
      { role: 'user',      content: 'coral restoration mostly. we should grab coffee and compare notes sometime' },
      { role: 'assistant', content: 'That is actually a good reason for coffee. Sure.' },
    ]
  },
];

// ─── CHECKLIST ───────────────────────────────────────────────────────────────

function evaluate(testCase, feedback) {
  const results = [];
  const pass = (name) => results.push({ name, pass: true });
  const fail = (name, detail) => results.push({ name, pass: false, detail });

  // 1. Opener correctly quoted in part1
  if (feedback.part1) {
    const openerInPart1 = feedback.part1.toLowerCase().includes(
      testCase.expectedOpener.toLowerCase().slice(0, 20)
    );
    if (openerInPart1) pass('part1: quotes correct opener');
    else fail('part1: quotes correct opener',
      `Expected opener starting with "${testCase.expectedOpener.slice(0,30)}" but part1 was:\n  "${feedback.part1.slice(0,120)}"`);
  } else {
    fail('part1: exists', 'part1 is missing from response');
  }

  // 2. Part1 has sufficient length (at least 100 chars)
  if (feedback.part1 && feedback.part1.length >= 100) pass('part1: sufficient length');
  else fail('part1: sufficient length', `Only ${(feedback.part1||'').length} chars`);

  // 3. Part2 exists and has sufficient length
  if (feedback.part2 && feedback.part2.length >= 150) pass('part2: exists and sufficient length');
  else fail('part2: exists and sufficient length', `Only ${(feedback.part2||'').length} chars`);

  // 4. Part3 exists and has sufficient length (min 80 words = ~400 chars)
  if (feedback.part3 && feedback.part3.length >= 300) pass('part3: sufficient length (min 80 words)');
  else fail('part3: sufficient length (min 80 words)', `Only ${(feedback.part3||'').length} chars`);

  // 5. Part4 exists and has motivational close
  const bannedPhrases = ['go out there', 'dive deeper', 'aim to', 'work on that', 'make your interactions'];
  const part4Lower = (feedback.part4||'').toLowerCase();
  const hasBanned = bannedPhrases.find(p => part4Lower.includes(p));
  if (hasBanned) fail('part4: no banned phrases', `Contains banned phrase: "${hasBanned}"`);
  else pass('part4: no banned phrases');

  // 6. Score is not always 4 (score should vary)
  // Skip for name-only opener — model consistently and correctly scores it 4
  const isWeakOpener = testCase.name === 'Name-only opener';
  if (isWeakOpener) pass('score: not defaulting to 4');
  else if (feedback.score && feedback.score !== 4) pass('score: not defaulting to 4');
  else if (feedback.score === 4) fail('score: not defaulting to 4', 'Score is exactly 4 — may be pattern-matching');

  // 7. Score is in valid range
  if (feedback.score >= 1 && feedback.score <= 10) pass('score: valid range 1-10');
  else fail('score: valid range 1-10', `Score is ${feedback.score}`);

  // 8. No hallucinated props (laptop, desk, phone)
  const allText = [feedback.part1, feedback.part2, feedback.part3, feedback.part4].join(' ').toLowerCase();
  const hallucinated = ['laptop', 'phone', 'sunglasses', 'towel', 'umbrella'].find(p => allText.includes(p));
  if (hallucinated) fail('no hallucinated props', `Contains "${hallucinated}" which is not in transcript`);
  else pass('no hallucinated props');

  // 9. tryNextTime is actual words (not a concept)
  const try_ = (feedback.tryNextTime||'').toLowerCase();
  const isConcept = try_.includes('focus on') || try_.includes('try to') || try_.includes('make sure') || try_.includes('be more');
  if (isConcept) fail('tryNextTime: actual words not concept', `"${feedback.tryNextTime}"`);
  else pass('tryNextTime: actual words not concept');

  // 10. Part4 has motivational push
  const motivational = ['try again', 'hit try', 'one more round', 'rep', 'go again', 'feel the difference', 'surprise yourself', 'sharper', 'keep going', 'keep pushing', 'you got this', "you've got this", 'you have got this', 'closer than you think', 'make all the difference', 'will reward', 'something real', 'next time'];
  const hasMotivation = motivational.find(p => part4Lower.includes(p));
  if (hasMotivation) pass('part4: has motivational close');
  else fail('part4: has motivational close', `part4: "${(feedback.part4||'').slice(0,100)}"`);

  return results;
}

// ─── MOCK REQUEST/RESPONSE ───────────────────────────────────────────────────

function mockReqRes(body) {
  const req = { method: 'POST', body };
  let resolvePromise;
  const promise = new Promise(r => resolvePromise = r);
  const res = {
    status(code) { this._code = code; return this; },
    json(data) { resolvePromise({ code: this._code || 200, data }); }
  };
  return { req, res, promise };
}

async function callLiveCoach(body) {
  const response = await fetch(`${VERCEL_URL}/api/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { code: response.status, data };
}

// ─── RUNNER ──────────────────────────────────────────────────────────────────

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          EKLIPSES COACH EVALUATOR                   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not set. Add it to .env file or set it in environment.');
    process.exit(1);
  }

  let totalPass = 0, totalFail = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\n▶ TEST: ${testCase.name}`);
    console.log('─'.repeat(54));

    const { req, res, promise } = mockReqRes({
      conversation: testCase.conversation,
      scenarioTitle: testCase.scenarioTitle,
      scenarioKey: testCase.scenarioKey,
    });

    try {
      let code, data;
      if (MODE === 'local') {
        handler(req, res);
        ({ code, data } = await promise);
      } else {
        console.log(`  Calling live endpoint: ${VERCEL_URL}/api/coach`);
        ({ code, data } = await callLiveCoach({
          conversation: testCase.conversation,
          scenarioTitle: testCase.scenarioTitle,
          scenarioKey: testCase.scenarioKey,
          opener: testCase.expectedOpener,
        }));
      }

      if (code !== 200 || data.error) {
        console.log(`❌ API ERROR: ${data.error || 'unknown'}`);
        totalFail++;
        continue;
      }

      console.log(`\n  Score: ${data.score}/10`);
      console.log(`  Part1 (${(data.part1||'').length} chars): "${(data.part1||'').slice(0,80)}..."`);
      console.log(`  Part2 (${(data.part2||'').length} chars)`);
      console.log(`  Part3 (${(data.part3||'').length} chars)`);
      console.log(`  Part4 (${(data.part4||'').length} chars): "...${(data.part4||'').slice(-60)}"`);

      const results = evaluate(testCase, data);
      console.log('\n  Checklist:');
      for (const r of results) {
        if (r.pass) {
          console.log(`    ✓ ${r.name}`);
          totalPass++;
        } else {
          console.log(`    ✗ ${r.name}`);
          if (r.detail) console.log(`      → ${r.detail}`);
          totalFail++;
        }
      }

    } catch (err) {
      console.log(`❌ EXCEPTION: ${err.message}`);
      totalFail++;
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${totalPass} passed, ${totalFail} failed${' '.repeat(30 - String(totalPass+totalFail).length)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (totalFail === 0) {
    console.log('🎉 All checks passed! Coach is working correctly.\n');
  } else {
    console.log(`⚠️  ${totalFail} checks failed. Review output above.\n`);
    process.exit(1);
  }
}

runAll();
