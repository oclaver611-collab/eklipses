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
//
// Cases 1-5: original suite (Exit false-positive regression guard)
// Cases 6-12: extended question-detection coverage (Exit gate edge cases)
const cases = [
  // ── 1. The original bug: Sofia asking an engaged follow-up question ─────
  {
    label: '1. Sofia original bug — engaged question must NOT fire Exit',
    expectTeachable: false,
    body: {
      userMessage: "The beach has a good vibe, yeah. I come here when I need to think.",
      characterResponse: "The beach is quieter in the afternoons. What about you? Do you hang out here often?",
      practiceFocus: 'lesson2',
      exchangeCount: 3,
      scenarioKey: 'beach',
    },
  },
  // ── 2. Genuine exit: she said she needed to go, student keeps chatting ──
  {
    label: '2. She said she needs to go, student keeps talking — genuine Exit',
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
  // ── 3. Neutral mid-conversation — no failure, no exit ───────────────────
  {
    label: '3. Neutral exchange, no skill failure — no interrupt expected',
    expectTeachable: false,
    body: {
      userMessage: "Yeah the evenings are better here. Way less crowded.",
      characterResponse: "Agreed. The light is better too. Much nicer.",
      practiceFocus: 'lesson2',
      exchangeCount: 4,
      scenarioKey: 'beach',
    },
  },
  // ── 4. Context comment + question back ──────────────────────────────────
  {
    label: '4. She adds context and asks about him — not Exit',
    expectTeachable: false,
    body: {
      userMessage: "Yeah I like the quiet here, it helps me think.",
      characterResponse: "Same honestly. The beach is quieter in the afternoons. Do you come here a lot?",
      practiceFocus: 'lesson2',
      exchangeCount: 4,
      scenarioKey: 'beach',
    },
  },
  // ── 5. Explicit "I have to run" + student hedges ────────────────────────
  {
    label: '5. Explicit "I have to run", student hedges the close — fires Exit',
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

  // ── 6. NEW PRODUCTION BUG: "What are you into?" must NOT fire Exit ───────
  // This is the exact case that recurred in production (Sofia engaging with a question).
  {
    label: '6. New Sofia bug — "What are you into?" must NOT fire Exit',
    expectTeachable: false,
    body: {
      userMessage: "The beach has a great vibe. I come here when I need to think.",
      characterResponse: "How about you share something first? What are you into?",
      practiceFocus: 'lesson2',
      exchangeCount: 4,
      scenarioKey: 'beach',
    },
  },
  // ── 7. Question embedded after a statement ───────────────────────────────
  {
    label: '7. Statement then question — not Exit',
    expectTeachable: false,
    body: {
      userMessage: "Yeah I come here most evenings. It clears my head.",
      characterResponse: "That makes sense. The afternoons are quieter here. What do you usually do on weekends?",
      practiceFocus: 'lesson2',
      exchangeCount: 4,
      scenarioKey: 'beach',
    },
  },
  // ── 8. Question-only short response ─────────────────────────────────────
  {
    label: '8. Short question-only response — not Exit',
    expectTeachable: false,
    body: {
      userMessage: "Yeah I know this beach well. Good spot to think.",
      characterResponse: "Oh really? What brings you here?",
      practiceFocus: 'lesson2',
      exchangeCount: 3,
      scenarioKey: 'beach',
    },
  },
  // ── 9. Long engaged response, no exit language, no question ─────────────
  // Purely descriptive — she's sharing, not leaving. Gate rule 3 blocks E.
  {
    label: '9. Long engaged response, no exit language — not Exit',
    expectTeachable: false,
    body: {
      userMessage: "Yeah the light here at dusk is something else.",
      characterResponse: "The evenings here are actually the best. Way less crowded, the light is different, the whole vibe changes when the tourists clear out.",
      practiceFocus: 'lesson2',
      exchangeCount: 4,
      scenarioKey: 'beach',
    },
  },
  // ── 10. Mixed: exit language AND a question — question wins ─────────────
  // She says she should get back but also asks a question. The question mark means
  // the gate blocks E — she's still showing interest even while signalling she may leave.
  {
    label: '10. Exit phrase + question in same response — question wins, not Exit',
    expectTeachable: false,
    body: {
      userMessage: "Yeah I tend to lose track of time here. It's peaceful.",
      characterResponse: "I should get back to my friends, but what's your name though?",
      practiceFocus: 'lesson2',
      exchangeCount: 5,
      scenarioKey: 'beach',
    },
  },
  // ── 11. "head off" genuine exit + student extends ────────────────────────
  {
    label: '11. "head off" genuine exit, student keeps chatting — fires Exit',
    expectTeachable: true,
    expectSkill: 'E',
    body: {
      userMessage: "Yeah well anyway, there's a really good spot just round the corner, you should check it out some time, I think you'd like it.",
      characterResponse: "Yeah I have to head off actually, but it was nice meeting you.",
      practiceFocus: 'lesson2',
      exchangeCount: 5,
      scenarioKey: 'beach',
    },
  },
  // ── 12. "heading out" genuine exit + student extends ─────────────────────
  {
    label: '12. "heading out" genuine exit, student extends without making a move — fires Exit',
    expectTeachable: true,
    expectSkill: 'E',
    body: {
      userMessage: "For sure, yeah, anyway the sunsets here are incredible, you should come back in the evening, it's a completely different vibe.",
      characterResponse: "Yeah I'm heading out now, it was nice talking to you.",
      practiceFocus: 'lesson2',
      exchangeCount: 6,
      scenarioKey: 'beach',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PACE (Lesson 3) test cases — cases 13-22
  // ══════════════════════════════════════════════════════════════════════════

  // ── FALSE-POSITIVE REPRO TESTS — must NOT fire any PACE moment ───────────
  // These reproduce the class of bug that broke Exit-gate in L2 production:
  // Sofia asking an engaged/curious question that has nothing to do with PACE.

  // ── 13. FP: Sofia asks general work question — no PACE moment ────────────
  // Student correctly redirects back, so no A failure. P can't fire (not feelings question).
  {
    label: '13. FP repro — general work question with redirect, must NOT trigger any PACE moment',
    expectTeachable: false,
    body: {
      userMessage: "Architecture — been in it a few years, mostly commercial now. What about you, what do you do?",
      characterResponse: "Architecture — do you design the whole thing or just specific parts of it?",
      practiceFocus: 'lesson3',
      exchangeCount: 3,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── 14. FP: Sofia engaged follow-up, student correctly redirects — no PACE moment ──
  {
    label: '14. FP repro — engaged follow-up with redirect, must NOT fire any PACE moment',
    expectTeachable: false,
    body: {
      userMessage: "Vietnam was incredible — three months mostly in the south. What about you, have you travelled much?",
      characterResponse: "What was the best part of Vietnam for you?",
      practiceFocus: 'lesson3',
      exchangeCount: 4,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── 15. FP: Single mild compliment directed at her — must NOT fire C ─────
  // Single, general compliment directed at her (not stacked, not self-answering)
  {
    label: '15. FP repro — single compliment directed at her must NOT fire C (not stacked)',
    expectTeachable: false,
    body: {
      userMessage: "You clearly know this place well.",
      characterResponse: "I've been coming here for two years. What made you pick the same place?",
      practiceFocus: 'lesson3',
      exchangeCount: 4,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── TRUE POSITIVE TESTS — should fire the named PACE skill ───────────────

  // ── 16. P fires: she asks "do you like me" and he declares immediately ───
  {
    label: '16. P fires — he answers direct feelings question too eagerly',
    expectTeachable: true,
    expectSkill: 'P',
    body: {
      userMessage: "Yeah honestly I really like you, I've been thinking about you since we met on the beach and I think there's something real here.",
      characterResponse: "Do you actually like me, or is this just something to do?",
      practiceFocus: 'lesson3',
      exchangeCount: 3,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── 17. A fires: she asks about his work, he answers with nothing back ───
  {
    label: '17. A fires — she asks about him, he answers fully with no redirect',
    expectTeachable: true,
    expectSkill: 'A',
    body: {
      userMessage: "I've been in product management for about four years now. Started at a startup, moved to a bigger company last year. It's fine — good team, decent work.",
      characterResponse: "What kind of products do you work on?",
      practiceFocus: 'lesson3',
      exchangeCount: 3,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── 18. C fires: he stacks multiple romantic compliments ─────────────────
  {
    label: '18. C fires — student stacks two romantic compliments in one message',
    expectTeachable: true,
    expectSkill: 'C',
    body: {
      userMessage: "I mean you're genuinely beautiful and I really like you — I keep thinking about our conversation from last time.",
      characterResponse: "That's sweet.",
      practiceFocus: 'lesson3',
      exchangeCount: 3,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── 19. E fires: early date declaration before she's invested ─────────────
  {
    label: '19. E fires — early date proposal in exchange 2 before she\'s invested',
    expectTeachable: true,
    expectSkill: 'E',
    body: {
      userMessage: "I'd really like to take you out properly sometime this week if you're free, I think we should go on an actual date.",
      characterResponse: "You're easy to talk to.",
      practiceFocus: 'lesson3',
      exchangeCount: 2,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── GATE BOUNDARY TESTS ───────────────────────────────────────────────────

  // ── 20. P blocked: personal-history question must NOT trigger P ───────────
  // Student correctly asks back here, so A also cannot fire — clean exchange.
  {
    label: '20. P gate — personal-history question with redirect, must NOT fire any PACE moment',
    expectTeachable: false,
    body: {
      userMessage: "Yeah I grew up in the north — moved here for university. Been here about six years. What about you, are you from here?",
      characterResponse: "Where did you grow up? You seem like you're not originally from here.",
      practiceFocus: 'lesson3',
      exchangeCount: 3,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── 21. E blocked: past exchange 4, E cannot fire even with escalation ────
  {
    label: '21. E gate — exchange 5, E gate blocks even if escalation language present',
    expectTeachable: false,
    body: {
      userMessage: "I feel like I'd really like to take you out and see where this goes.",
      characterResponse: "That's a nice idea.",
      practiceFocus: 'lesson3',
      exchangeCount: 5,
      scenarioKey: 'coffee_shop_second_meeting',
    },
  },

  // ── 22. Neutral L3 exchange — no failure expected ─────────────────────────
  // characterResponse is a statement (no ?) → A gate blocks; no romantic terms → C blocks;
  // no escalation language → E blocks; no feelings question → P blocks. All 4 gates active.
  {
    label: '22. Neutral L3 exchange — no PACE moment expected',
    expectTeachable: false,
    body: {
      userMessage: "The coffee here is pretty good actually. I'm a bit particular about it.",
      characterResponse: "This place has been around for a long time. The flat white is the one to order.",
      practiceFocus: 'lesson3',
      exchangeCount: 4,
      scenarioKey: 'coffee_shop_second_meeting',
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
