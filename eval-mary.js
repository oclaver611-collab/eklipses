// eval-mary.js — Automated evaluator for api/mary.js (v2)
// Run with: node eval-mary.js
// Requires GROQ_API_KEY in .env

require('dotenv').config();

const VERCEL_URL = process.env.VERCEL_URL || 'https://eklipses.vercel.app';
const DELAY_MS = 3000; // delay between tests to respect TPM limit

// ─── TEST CASES ───────────────────────────────────────────────────────────────
// Each test case can define:
//   userMessage   — what the user says
//   history       — prior conversation turns
//   checks        — array of check names to run (default: all)
//   expectName    — name Sofia MUST use in her response
//   forbidNames   — names Sofia must NEVER use
//   expectClarify — true if response should be a clarifying question

const TEST_CASES = [

  // ── EXISTING TESTS (keep all 6) ───────────────────────────────────────────

  {
    name: 'Beach — strong opener',
    scenarioKey: 'beach',
    userMessage: 'you look like you found the only quiet spot on the whole beach — is this your spot',
    history: [],
  },
  {
    name: 'Beach — name only',
    scenarioKey: 'beach',
    userMessage: 'hi',
    history: [],
  },
  {
    name: 'Beach — follow-up question',
    scenarioKey: 'beach',
    userMessage: 'what do you write about',
    history: [
      { role: 'user',      content: 'you look like you found the only quiet spot on the whole beach' },
      { role: 'assistant', content: 'Pretty much. I come here when I need to think.' },
    ],
  },
  {
    name: 'Bar — generic opener',
    scenarioKey: 'bar',
    userMessage: 'can I buy you a drink',
    history: [],
  },
  {
    name: 'Bar — funny situational',
    scenarioKey: 'bar',
    userMessage: 'I counted three people trying to order the same drink — I think the bartender is about to quit',
    history: [],
  },
  {
    name: 'Variation check — same opener twice (beach)',
    scenarioKey: 'beach',
    userMessage: 'what do you write about',
    history: [
      { role: 'user',      content: 'what do you write about' },
      { role: 'assistant', content: 'Local culture mostly. Whatever feels overlooked.' },
      { role: 'user',      content: 'interesting — what drew you to that' },
      { role: 'assistant', content: 'Stories that do not get told unless someone bothers to look.' },
      { role: 'user',      content: 'what do you write about' },
    ],
  },

  // ── NEW TESTS: NAME HANDLING ──────────────────────────────────────────────

  {
    name: 'Beach — name introduced in opener (must acknowledge)',
    scenarioKey: 'beach',
    userMessage: 'hi my name is Paul I never saw you here what is your name',
    history: [],
    // Sofia's SECOND response (after she gives her name) must contain Paul.
    // We test this by giving her the opener + her "Sofia." reply already in history,
    // then sending a follow-up — this is the turn where acknowledgment should happen.
    // Actually we test turn-2 directly:
    userMessage: 'nice to meet you Sofia',
    history: [
      { role: 'user',      content: 'hi my name is Paul I never saw you here what is your name' },
      { role: 'assistant', content: 'Sofia.' },
    ],
    expectName: 'Paul',   // Sofia MUST use this name in her response
  },
  {
    name: 'Beach — name must not be hallucinated (no name given)',
    scenarioKey: 'beach',
    userMessage: 'what are you up to today',
    history: [
      { role: 'user',      content: 'hey what is your name' },
      { role: 'assistant', content: 'Sofia.' },
    ],
    forbidNames: ['Daniel', 'Michael', 'James', 'David', 'John', 'Alex', 'Chris'],
  },
  {
    name: 'Beach — name must not be repeated after first use',
    scenarioKey: 'beach',
    userMessage: 'so what kind of stories do you cover',
    history: [
      { role: 'user',      content: 'hi my name is Paul' },
      { role: 'assistant', content: 'Sofia. Nice to meet you, Paul.' }, // name already used
      { role: 'user',      content: 'nice spot you found here' },
      { role: 'assistant', content: 'It is the quietest part of the beach.' },
    ],
    forbidName: 'Paul', // name should NOT appear again
  },

  // ── NEW TEST: INCOHERENT INPUT ────────────────────────────────────────────

  {
    name: 'Beach — incoherent/garbled input should get clarifying question',
    scenarioKey: 'beach',
    userMessage: 'we give',  // the exact garbled input from today's session
    history: [
      { role: 'user',      content: 'hi my name is Paul' },
      { role: 'assistant', content: 'Sofia. Nice to meet you, Paul.' },
    ],
    expectClarify: true,  // response should be a question, not a monologue
  },

];

// ─── CHECKLIST ────────────────────────────────────────────────────────────────

function evaluate(testCase, responseText) {
  const results = [];
  const pass = (name) => results.push({ name, pass: true });
  const fail = (name, detail) => results.push({ name, pass: false, detail });
  const lower = responseText.toLowerCase();

  // 1. Response exists
  if (responseText && responseText.trim().length > 0) pass('response: exists');
  else { fail('response: exists', 'Empty response'); return results; }

  // 2. Length: 1-2 sentences
  const sentenceCount = responseText.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
  if (sentenceCount <= 3) pass('length: max 3 sentences');
  else fail('length: max 3 sentences', `Got ~${sentenceCount} sentences: "${responseText.slice(0, 120)}"`);

  // 3. No asterisks / stage directions
  if (!/\*/.test(responseText)) pass('no asterisks or stage directions');
  else fail('no asterisks or stage directions', `"${responseText.slice(0, 120)}"`);

  // 4. No banned filler phrases
  const fillerPhrases = ['oh wow', "that's amazing", "what's caught your eye", 'absolutely', 'certainly', 'of course!', 'great question'];
  const foundFiller = fillerPhrases.find(p => lower.includes(p));
  if (foundFiller) fail('no filler phrases', `Contains "${foundFiller}"`);
  else pass('no filler phrases');

  // 5. Comma splice check
  // A true splice: both sides of the comma are independent clauses (subject + verb).
  // False positives to exclude:
  //   - tag phrases: ", I guess" ", I think" ", I suppose" (fragment, not a clause)
  //   - relative/subordinate clauses: ", which" ", because" etc.
  //   - short trailing fragments under 4 words
  //   - participial phrases: ", mostly" ", just" ", really"
  const TAG_PHRASES = /,\s+(I guess|I think|I suppose|I mean|I hope|I know|you know|right|maybe|actually|honestly|really|just|mostly|mostly about|for now|for sure|kind of|sort of|I\s+\'m sure)/i;
  const commaSplicePattern = /[a-z][^.!?]*,\s+(?:I|it|that|this|he|she|they|we|you|there|here)[^.!?]*[.!?]/gi;
  const splices = responseText.match(commaSplicePattern) || [];
  const realSplices = splices.filter(s => {
    if (TAG_PHRASES.test(s)) return false; // tag phrase — not a splice
    const parts = s.split(',');
    const beforeComma = parts[0].trim();
    const afterComma = parts.slice(1).join(',').trim();
    const wordsBefore = beforeComma.split(/\s+/).length;
    const wordsAfter = afterComma.split(/\s+/).length;
    if (wordsBefore <= 3) return false; // short prefix — not independent clause
    if (wordsAfter <= 3) return false;  // short suffix — likely a fragment not a clause
    if (/\b(which|who|because|although|since|when|if|but|and|or|as|while|after|before|though)\b/i.test(afterComma.split(' ').slice(0,3).join(' '))) return false;
    return true;
  });
  if (realSplices.length === 0) pass('no comma splices');
  else fail('no comma splices', `Splice found: "${realSplices[0].slice(0, 100)}"`);

  // 6. No character break
  const breakWords = ['ai', 'language model', 'coaching', 'simulation', 'practice', 'script', 'character'];
  const foundBreak = breakWords.find(w => lower.includes(w));
  if (foundBreak) fail('no character break', `Contains "${foundBreak}"`);
  else pass('no character break');

  // 7. Not too short
  // Exempt: single-word openers (e.g. "hi" → "Sofia." is correct)
  // Exempt: single-word complete answers (e.g. "Writing." is a valid terse response)
  const isShortOpener = (testCase.userMessage || '').trim().split(/\s+/).length <= 1;
  const isSingleWordAnswer = responseText.trim().split(/\s+/).length <= 2;
  if (responseText.trim().length >= 10 || isShortOpener || isSingleWordAnswer) pass('response: not too short');
  else fail('response: not too short', `Only ${responseText.trim().length} chars: "${responseText}"`);

  // 8. No repeated opening from history
  const historyAssistantLines = (testCase.history || [])
    .filter(m => m.role === 'assistant')
    .map(m => m.content.toLowerCase().slice(0, 20));
  const responseStart = responseText.toLowerCase().slice(0, 20);
  const isRepeat = historyAssistantLines.some(prev => prev === responseStart);
  if (isRepeat) fail('no repeated opening', `Same as previous: "${responseText.slice(0, 40)}"`);
  else pass('no repeated opening');

  // 9. NAME: must use expected name (if test requires it)
  if (testCase.expectName) {
    const nameFound = lower.includes(testCase.expectName.toLowerCase());
    if (nameFound) pass(`name: uses "${testCase.expectName}" in response`);
    else fail(`name: uses "${testCase.expectName}" in response`,
      `Expected "${testCase.expectName}" but got: "${responseText}"`);
  }

  // 10. NAME: must not use forbidden names (hallucination check)
  if (testCase.forbidNames && testCase.forbidNames.length > 0) {
    const hallucinated = testCase.forbidNames.find(n => lower.includes(n.toLowerCase()));
    if (hallucinated) fail('name: no hallucinated name',
      `Used invented name "${hallucinated}" in: "${responseText}"`);
    else pass('name: no hallucinated name');
  }

  // 11. NAME: must not repeat name (overuse check)
  if (testCase.forbidName) {
    const nameUsed = lower.includes(testCase.forbidName.toLowerCase());
    if (nameUsed) fail(`name: must not repeat "${testCase.forbidName}"`,
      `Name repeated unnecessarily: "${responseText}"`);
    else pass(`name: must not repeat "${testCase.forbidName}"`);
  }

  // 12. INCOHERENT INPUT: response should be a clarifying question
  if (testCase.expectClarify) {
    const isQuestion = responseText.trim().endsWith('?');
    const isShort = responseText.trim().split(/\s+/).length <= 12;
    if (isQuestion && isShort) pass('incoherent input: asks short clarifying question');
    else fail('incoherent input: asks short clarifying question',
      `Expected short question, got: "${responseText}"`);
  }

  return results;
}

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function callMary(body) {
  const response = await fetch(`${VERCEL_URL}/api/character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { code: response.status, data };
}

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        EKLIPSES CHARACTER EVALUATOR v2                       ║');
  console.log(`║        ${TEST_CASES.length} tests  •  hitting ${VERCEL_URL.replace('https://','')}  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not set. Add it to .env file.');
    process.exit(1);
  }

  let totalPass = 0, totalFail = 0;
  const failedTests = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    console.log(`\n▶ [${i+1}/${TEST_CASES.length}] ${testCase.name}`);
    console.log('─'.repeat(58));

    try {
      const { code, data } = await callMary({
        userMessage: testCase.userMessage,
        scenarioTitle: testCase.scenarioTitle || testCase.scenarioKey,
        scenarioKey: testCase.scenarioKey,
        history: testCase.history || [],
      });

      if (code !== 200 || data.error) {
        console.log(`  ❌ API ERROR: ${data.error || 'unknown'} (HTTP ${code})`);
        totalFail++;
        failedTests.push(testCase.name);
        continue;
      }

      const responseText = data.response || '';
      console.log(`  User : "${testCase.userMessage.slice(0, 70)}"`);
      console.log(`  Sofia: "${responseText}"`);

      const results = evaluate(testCase, responseText);
      let testPass = 0, testFail = 0;

      console.log('\n  Checks:');
      for (const r of results) {
        if (r.pass) {
          console.log(`    ✓ ${r.name}`);
          totalPass++; testPass++;
        } else {
          console.log(`    ✗ ${r.name}`);
          if (r.detail) console.log(`      → ${r.detail}`);
          totalFail++; testFail++;
        }
      }

      if (testFail > 0) failedTests.push(`${testCase.name} (${testFail} fail)`);
      console.log(`\n  → ${testPass}/${testPass+testFail} checks passed`);

    } catch (err) {
      console.log(`  ❌ EXCEPTION: ${err.message}`);
      totalFail++;
      failedTests.push(testCase.name);
    }

    // Delay between tests to respect Groq TPM limit
    if (i < TEST_CASES.length - 1) {
      process.stdout.write(`\n  ⏳ waiting ${DELAY_MS/1000}s before next test...`);
      await new Promise(r => setTimeout(r, DELAY_MS));
      process.stdout.write(' done\n');
    }
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  const total = totalPass + totalFail;
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  FINAL: ${totalPass}/${total} checks passed                              ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (totalFail === 0) {
    console.log('\n🎉 All checks passed! Characters are clean.\n');
  } else {
    console.log(`\n⚠️  ${totalFail} checks failed:\n`);
    failedTests.forEach(t => console.log(`  • ${t}`));
    console.log('');
    process.exit(1);
  }
}

runAll();
