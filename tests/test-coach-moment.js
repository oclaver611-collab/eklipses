// tests/test-coach-moment.js
// Direct-invocation test for the coach-moment classifier.
// Loads the handler from api/coach-moment.js, passes mock req/res, hits real OpenAI API.
// Run: node tests/test-coach-moment.js
//
// Requires OPENAI_API_KEY in .env or environment.

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local'), override: false });

const handler = require('../api/coach-moment.js');

// ── mock req/res ──────────────────────────────────────────────────────────────
function makeReq(body) {
  return { method: 'POST', body };
}
function makeRes() {
  const obj = {
    _status: 200, _body: null,
    status(code) { this._status = code; return this; },
    json(body)  { this._body = body; return this; },
  };
  return obj;
}

async function classify(body) {
  const req = makeReq(body);
  const res = makeRes();
  await handler(req, res);
  return res._body;
}

// ── test cases ────────────────────────────────────────────────────────────────
// Each case: { label, body, expectTeachable, expectSkill? }
// expectTeachable: true = should fire | false = should NOT fire
const cases = [
  // ── The real bug: Sofia asking an engaged follow-up question ──────────────
  {
    label: 'Sofia original bug — engaged question must NOT fire Exit',
    expectTeachable: false,
    body: {
      userMessage: "The beach has a good vibe, yeah. I come here when I need to think.",
      characterResponse: "The beach is quieter in the afternoons. What about you? Do you hang out here often?",
      practiceFocus: 'lesson2',
      exchangeCount: 3,
      scenarioKey: 'beach',
    },
  },
  // ── Genuine exit: she said she needed to go, student keeps chatting ───────
  // (Exit fires on what the STUDENT does AFTER her exit signal — so the student
  //  message here is his reply to her "I should get back", where he keeps talking.)
  {
    label: 'She said she needs to go, student keeps talking — genuine Exit',
    expectTeachable: true,
    expectSkill: 'E',
    body: {
      userMessage: "Oh no worries, yeah anyway there's also this great spot I was going to mention, you should check it out sometime, it's just round the corner from here.",
      characterResponse: "Haha okay. Yeah I should get back to my friends.",
      practiceFocus: 'lesson2',
      exchangeCount: 5,
      scenarioKey: 'beach',
    },
  },
  // ── Neutral mid-conversation exchange — no failure, no exit ─────────────
  // Student makes a plain neutral statement; Sofia agrees and mirrors. No test,
  // no challenge, no claim from her to validate, no exit language. Should be clean.
  {
    label: 'Neutral exchange, no skill failure — no interrupt expected',
    expectTeachable: false,
    body: {
      userMessage: "Yeah the evenings are better here. Way less crowded.",
      characterResponse: "Agreed. The light is better too. Much nicer.",
      practiceFocus: 'lesson2',
      exchangeCount: 4,
      scenarioKey: 'beach',
    },
  },
  // ── Context comment + question back — must NOT fire Exit ─────────────────
  {
    label: 'She adds context and asks about him — not Exit',
    expectTeachable: false,
    body: {
      userMessage: "Yeah I like the quiet here, it helps me think.",
      characterResponse: "Same honestly. The beach is quieter in the afternoons. Do you come here a lot?",
      practiceFocus: 'lesson2',
      exchangeCount: 4,
      scenarioKey: 'beach',
    },
  },
  // ── She explicitly says she needs to leave — student still didn't make a move
  {
    label: 'Explicit "I have to run", student hedges the close — fires Exit',
    expectTeachable: true,
    expectSkill: 'E',
    body: {
      userMessage: "Yeah no pressure, maybe we'll run into each other again sometime, who knows.",
      characterResponse: "Yeah I actually have to run — nice talking to you.",
      practiceFocus: 'lesson2',
      exchangeCount: 6,
      scenarioKey: 'beach',
    },
  },
];

// ── runner ────────────────────────────────────────────────────────────────────
const results = [];

function report(label, passed, detail = '') {
  results.push({ label, passed });
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${label}`);
  if (detail) console.log(`      ${detail}`);
}

async function run() {
  console.log('\nCoach-Moment Classifier Tests (live OpenAI call)');
  console.log('─'.repeat(60));

  for (const tc of cases) {
    process.stdout.write(`  … ${tc.label}\n`);
    let result;
    try {
      result = await classify(tc.body);
    } catch (e) {
      report(tc.label, false, `error: ${e.message}`);
      continue;
    }

    const teachable = result?.teachable === true;
    const skill     = result?.skill;
    const coaching  = result?.coaching || '';

    if (!tc.expectTeachable) {
      // Should NOT fire
      const passed = !teachable;
      report(
        tc.label,
        passed,
        teachable
          ? `UNEXPECTED FIRE: skill=${skill}  "${coaching}"`
          : `clean — no interrupt`
      );
    } else {
      // Should fire
      if (!teachable) {
        report(tc.label, false, `did not fire (expected skill ${tc.expectSkill || '?'})`);
      } else if (tc.expectSkill && skill !== tc.expectSkill) {
        report(tc.label, false, `fired on wrong skill: got ${skill}, expected ${tc.expectSkill}  "${coaching}"`);
      } else {
        report(tc.label, true, `fired skill=${skill}  "${coaching}"`);
      }
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log('\n' + '─'.repeat(60));
  console.log(`${passed}/${results.length} PASS${failed > 0 ? `, ${failed} FAIL` : ''}`);

  if (failed > 0) {
    console.log('\nFailed cases:');
    results.filter(r => !r.passed).forEach(r => console.log(`  ✗ ${r.label}`));
    process.exit(1);
  }
}

run().catch(e => { console.error('Runner error:', e.message); process.exit(1); });
