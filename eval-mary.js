// eval-mary.js — Automated evaluator for api/mary.js
// Run with: node eval-mary.js

require('dotenv').config();

const VERCEL_URL = process.env.VERCEL_URL || 'https://eklipses.vercel.app';

// ─── TEST CASES ───────────────────────────────────────────────────────────────

const TEST_CASES = [
  {
    name: 'Beach — strong opener',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    userMessage: 'you look like you found the only quiet spot on the whole beach — is this your spot',
    history: [],
  },
  {
    name: 'Beach — name only',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    userMessage: 'hi',
    history: [],
  },
  {
    name: 'Beach — follow-up question',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    userMessage: 'what do you write about',
    history: [
      { role: 'user',      content: 'you look like you found the only quiet spot on the whole beach' },
      { role: 'assistant', content: 'Pretty much. I come here when I need to think.' },
    ],
  },
  {
    name: 'Bar — generic opener',
    scenarioKey: 'bar',
    scenarioTitle: 'Bar — Friday Night',
    userMessage: 'can I buy you a drink',
    history: [],
  },
  {
    name: 'Bar — funny situational',
    scenarioKey: 'bar',
    scenarioTitle: 'Bar — Friday Night',
    userMessage: 'I counted three people trying to order the same drink — I think the bartender is about to quit',
    history: [],
  },
  {
    name: 'Variation check — same opener twice (beach)',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    userMessage: 'what do you write about',
    history: [
      { role: 'user',      content: 'what do you write about' },
      { role: 'assistant', content: 'Local culture mostly. Whatever feels overlooked.' },
      { role: 'user',      content: 'interesting — what drew you to that' },
      { role: 'assistant', content: 'Stories that do not get told unless someone bothers to look.' },
      { role: 'user',      content: 'what do you write about' }, // repeat to test variation
    ],
  },
];

// ─── CHECKLIST ────────────────────────────────────────────────────────────────

function evaluate(testCase, responseText) {
  const results = [];
  const pass = (name) => results.push({ name, pass: true });
  const fail = (name, detail) => results.push({ name, pass: false, detail });

  // 1. Response exists and is non-empty
  if (responseText && responseText.trim().length > 0) pass('response: exists');
  else { fail('response: exists', 'Empty response'); return results; }

  // 2. Length check — 1-2 sentences, not a wall of text
  const sentenceCount = responseText.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
  if (sentenceCount <= 3) pass('length: 1-2 sentences');
  else fail('length: 1-2 sentences', `Got ~${sentenceCount} sentences: "${responseText.slice(0, 120)}"`);

  // 3. No asterisks / stage directions
  if (!/\*/.test(responseText)) pass('no asterisks or stage directions');
  else fail('no asterisks or stage directions', `Contains asterisk: "${responseText.slice(0, 120)}"`);

  // 4. No banned filler phrases
  const fillerPhrases = ["oh wow", "that's amazing", "what's caught your eye", "absolutely", "certainly", "of course!", "great question"];
  const lower = responseText.toLowerCase();
  const foundFiller = fillerPhrases.find(p => lower.includes(p));
  if (foundFiller) fail('no filler phrases', `Contains "${foundFiller}"`);
  else pass('no filler phrases');

  // 5. Comma splice check — the main recurring bug
  // Detect: "word, word" where both sides look like independent clauses
  const commaSplicePattern = /[a-z][^.!?]*,\s+(?:I|it|that|this|he|she|they|we|you|there|here)[^.!?]*[.!?]/gi;
  const splices = responseText.match(commaSplicePattern) || [];
  // Filter out false positives:
  // - subordinate clauses (which/who/because/etc.)
  // - short interjections before comma (e.g. "No thanks," "Sure," "Yeah,") — 3 words or fewer
  const realSplices = splices.filter(s => {
    const beforeComma = s.split(',')[0].trim();
    const wordsBefore = beforeComma.split(/\s+/).length;
    if (wordsBefore <= 3) return false;
    if (/\b(which|who|because|although|since|when|if|but|and|or)\b/i.test(s.split(',')[1])) return false;
    return true;
  });
  if (realSplices.length === 0) pass('no comma splices');
  else fail('no comma splices', `Possible splice: "${realSplices[0].slice(0, 100)}"`);

  // 6. No breaking character (mentions AI, coaching, practice, script)
  const breakWords = ['ai', 'language model', 'coaching', 'simulation', 'practice', 'script', 'character'];
  const foundBreak = breakWords.find(w => lower.includes(w));
  if (foundBreak) fail('no character break', `Contains "${foundBreak}"`);
  else pass('no character break');

  // 7. Not too short — exception for single-word openers (e.g. 'hi' -> 'Sofia.' is correct)
  const isShortOpener = testCase.userMessage.trim().split(/\s+/).length <= 1;
  if (responseText.trim().length >= 10 || isShortOpener) pass('response: not too short');
  else fail('response: not too short', `Only ${responseText.trim().length} chars: "${responseText}"`);

  // 8. No repetition of exact opening phrase from history
  const historyAssistantLines = (testCase.history || [])
    .filter(m => m.role === 'assistant')
    .map(m => m.content.toLowerCase().slice(0, 20));
  const responseStart = responseText.toLowerCase().slice(0, 20);
  const isRepeat = historyAssistantLines.some(prev => prev === responseStart);
  if (isRepeat) fail('no repeated opening', `Response starts same as a previous line: "${responseText.slice(0, 40)}"`);
  else pass('no repeated opening');

  return results;
}

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function callMary(body) {
  const response = await fetch(`${VERCEL_URL}/api/mary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { code: response.status, data };
}

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          EKLIPSES MARY EVALUATOR                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not set. Add it to .env file.');
    process.exit(1);
  }

  let totalPass = 0, totalFail = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\n▶ TEST: ${testCase.name}`);
    console.log('─'.repeat(54));

    try {
      const { code, data } = await callMary({
        userMessage: testCase.userMessage,
        scenarioTitle: testCase.scenarioTitle,
        scenarioKey: testCase.scenarioKey,
        history: testCase.history,
      });

      if (code !== 200 || data.error) {
        console.log(`  ❌ API ERROR: ${data.error || 'unknown'}`);
        totalFail++;
        continue;
      }

      const responseText = data.response || '';
      console.log(`  User: "${testCase.userMessage.slice(0, 60)}"`);
      console.log(`  Mary: "${responseText}"`);

      const results = evaluate(testCase, responseText);
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
      console.log(`  ❌ EXCEPTION: ${err.message}`);
      totalFail++;
    }

    // Small delay to avoid hammering rate limit
    await new Promise(r => setTimeout(r, 6000));
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${totalPass} passed, ${totalFail} failed${' '.repeat(29 - String(totalPass + totalFail).length)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (totalFail === 0) {
    console.log('🎉 All checks passed! Mary is working correctly.\n');
  } else {
    console.log(`⚠️  ${totalFail} checks failed. Review output above.\n`);
    process.exit(1);
  }
}

runAll();
