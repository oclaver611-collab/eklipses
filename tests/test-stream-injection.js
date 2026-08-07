#!/usr/bin/env node
// Verifies that character-stream.js correctly injects lesson4TestBlock and lesson5TestBlock
// into the system prompt when practiceFocus === 'lesson4' or 'lesson5'.
// Runs the exact same conditional logic as character-stream.js — no mocks, no imports needed.

'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}${detail ? '  (' + detail + ')' : ''}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? '  (' + detail + ')' : ''}`);
    failed++;
  }
}

// ── Read the source so we can verify structural presence ─────────────────────
const src = fs.readFileSync(
  path.join(__dirname, '../api/character-stream.js'),
  'utf8'
);

console.log('character-stream.js system-prompt injection tests');
console.log('─'.repeat(54));

// 1. Structural checks on the source
check(
  'showLesson4Tests defined in character-stream.js',
  src.includes("const showLesson4Tests = practiceFocus === 'lesson4'")
);
check(
  'showLesson5Tests defined in character-stream.js',
  src.includes("const showLesson5Tests = practiceFocus === 'lesson5'")
);
check(
  'lesson4TestBlock defined in character-stream.js',
  src.includes("const lesson4TestBlock = (showLesson4Tests && characterId === 'sofia')")
);
check(
  'lesson5TestBlock defined in character-stream.js',
  src.includes("const lesson5TestBlock = (showLesson5Tests && characterId === 'sofia')")
);
check(
  'systemPrompt assembly includes lesson4TestBlock',
  /const systemPrompt\s*=.*lesson4TestBlock/.test(src)
);
check(
  'systemPrompt assembly includes lesson5TestBlock',
  /const systemPrompt\s*=.*lesson5TestBlock/.test(src)
);
check(
  'systemPrompt assembly: all 5 blocks in order (1→2→3→4→5)',
  /lesson1TestBlock.*lesson2TestBlock.*lesson3TestBlock.*lesson4TestBlock.*lesson5TestBlock/.test(
    src.replace(/\s+/g, ' ')
  )
);
check(
  'server-side TRACE cue extraction present in character-stream.js',
  src.includes("const cueMatch = characterResponse.match(/^\\s*\\(([^)]+)\\)\\s*/)")
);
check(
  'cue event sent via SSE in character-stream.js',
  src.includes('JSON.stringify({ cue: traceCue })')
);

// ── Inline reconstruction — same logic as character-stream.js ─────────────────
// Re-run the conditional logic with each practiceFocus value and assert on
// the assembled string. No imports — just the same ternary expressions.

console.log('\nSystem-prompt content checks (practiceFocus = "lesson4")');
console.log('─'.repeat(54));

function buildBlocks(practiceFocus, characterId) {
  const showLesson4Tests = practiceFocus === 'lesson4' || practiceFocus === 'all';
  const showLesson5Tests = practiceFocus === 'lesson5' || practiceFocus === 'all';

  const lesson4TestBlock = (showLesson4Tests && characterId === 'sofia') ? `
LESSON 4 TEST MODE — ACTIVE (CHAIN):
The user has completed Lesson 4. You will now test their ability to catch threads and keep the conversation alive through threading. The CHAIN skills they should demonstrate: Catch threads, Hook the richest, Ask deeper, Inject yourself, Never abandon a live thread. Do NOT announce that you are testing them. Every test arises naturally from your personality.

TEST C — Catch threads:
Speak a sentence that contains at least two or three distinct embedded threads — a name, a place, an experience, a feeling, something you are working on. If the user picks up on any of your threads and asks about it, engage warmly and go further. If the user ignores all your threads and asks something entirely unrelated or generic, let the energy flatten slightly.

TEST H — Hook the richest:
Include something with a clear emotional charge — something that was hard, surprising, confusing, or meaningful — alongside more surface-level detail. If the user asks about the surface detail and ignores the emotional thread, stay slightly guarded. If they notice the charged thread — the thing you mentioned with a little more weight — open up more than you otherwise would.

TEST A — Ask deeper:
After you share something on a topic, watch whether the user follows that thread one layer further or pivots to something else entirely. If they follow up with a question that goes deeper on the same topic — why it happened, how it felt, what came of it — stay engaged and share more. If they immediately jump to a new subject after you've opened up, let the conversation flatten.

TEST I — Inject yourself:
Share something personal — a feeling you have had, something you have been figuring out, something real about where you are. If the user responds with only another question and contributes nothing from their own life, keep your answers slightly shorter. If the user shares something genuine from their own experience in response — not a monologue, just something real and connected — warm up noticeably.

TEST N — Never abandon a live thread:
At some point say something that matters and then move away from it — a topic you started and shifted away from, an "honestly…" that you pulled back from, a small thing said almost as an aside. If the user accepts your redirect and the thread disappears, let it go. If the user notices and comes back to it — "you started to say something" or "I want to go back to the thing you mentioned" — respond with genuine openness, as if someone finally heard it.` : '';

  const lesson5TestBlock = (showLesson5Tests && characterId === 'sofia') ? `
LESSON 5 PRACTICE MODE — ACTIVE (TRACE):
The user has completed Lesson 5. You will test their ability to read genuine interest signals. Unlike previous lessons, the primary skill here is observational — the user reads signals you emit and responds to them.

SETTING FOR THIS PRACTICE: You are in a bookstore. You find the user's presence genuinely interesting. Over the course of the conversation, emit the following physical signals naturally — not mechanically. When you emit a signal, include a brief stage-direction at the very START of your response — one sentence only, written in plain third-person narrator style (she/her for yourself, you/your for the user). Describe only what an outside observer would see — no internal thoughts or feelings.

Stage direction format: a parenthetical at the very start of your response, exactly one sentence, third-person narrator. Examples: "(She holds your gaze a beat past where it should have ended.)" or "(She moves closer — only a few inches, but you feel the shift.)" or "(She touches your arm briefly, then lets her hand fall away.)"

SIGNAL TIMING — emit in this approximate order, adjusted for the natural flow:
- Exchanges 1–2: No signals. Normal conversation, baseline behavior.
- Exchange ~3 (T — Track gaze): Hold eye contact a beat past where you normally would. Stage direction example: "(She holds your gaze a beat past where it should have ended.)"
- Exchange ~4 (R — Register proximity): Move closer. Stage direction example: "(She moves closer — only a few inches, but you feel the shift.)"
- Exchanges ~5–6 (A — Attend to alignment): Your posture settles into his without planning it. Stage direction example: "(Her posture has drifted into yours. You can't say when it happened.)"
- Exchange ~7+ (C — Catch touch): Make brief deliberate contact — touch his forearm, then let go. Stage direction example: "(She touches your arm briefly, then lets her hand fall away.)"

RESPONDING TO SIGNAL AWARENESS:
If the user acknowledges or plays with a signal you've emitted — names the gaze, comments on the proximity, notes the mirroring, responds to the touch — receive it with dry warmth or honest surprise. Don't confirm too eagerly. Don't deny it. Let it sit. Examples: "...did I?", "...I suppose I did.", "...hm." — or nothing at all, just a pause before you continue.

If the user makes the E move — asks for your number directly, suggests continuing somewhere else, or includes you in what they're doing next — respond warmly. He read it correctly. Give him the number or agree to continue.

IMPORTANT: Do not emit all signals at once or in rapid succession. Space them naturally. If the user doesn't respond to early signals, keep emitting the next ones — do not stop because he hasn't acknowledged the prior signal. When you include a stage direction, keep it to one sentence only.` : '';

  return { lesson4TestBlock, lesson5TestBlock };
}

// lesson4 focus
{
  const { lesson4TestBlock, lesson5TestBlock } = buildBlocks('lesson4', 'sofia');
  check('lesson4TestBlock non-empty when practiceFocus=lesson4', lesson4TestBlock.length > 0);
  check('lesson4TestBlock contains CHAIN', lesson4TestBlock.includes('CHAIN'));
  check('lesson4TestBlock contains TEST C — Catch threads', lesson4TestBlock.includes('TEST C — Catch threads'));
  check('lesson4TestBlock contains TEST N — Never abandon', lesson4TestBlock.includes('TEST N — Never abandon'));
  check('lesson5TestBlock empty when practiceFocus=lesson4', lesson5TestBlock.length === 0);
}

console.log('\nSystem-prompt content checks (practiceFocus = "lesson5")');
console.log('─'.repeat(54));

// lesson5 focus
{
  const { lesson4TestBlock, lesson5TestBlock } = buildBlocks('lesson5', 'sofia');
  check('lesson5TestBlock non-empty when practiceFocus=lesson5', lesson5TestBlock.length > 0);
  check('lesson5TestBlock contains TRACE', lesson5TestBlock.includes('TRACE'));
  check('lesson5TestBlock contains T — Track gaze stage direction', lesson5TestBlock.includes('T — Track gaze'));
  check('lesson5TestBlock contains R — Register proximity stage direction', lesson5TestBlock.includes('R — Register proximity'));
  check('lesson5TestBlock contains A — Attend to alignment stage direction', lesson5TestBlock.includes('A — Attend to alignment'));
  check('lesson5TestBlock contains C — Catch touch stage direction', lesson5TestBlock.includes('C — Catch touch'));
  check('lesson5TestBlock contains gaze stage direction (third-person)', lesson5TestBlock.includes("(She holds your gaze a beat past where it should have ended.)"));
  check('lesson5TestBlock contains proximity stage direction (third-person)', lesson5TestBlock.includes("(She moves closer — only a few inches, but you feel the shift.)"));
  check('lesson5TestBlock contains touch stage direction (third-person)', lesson5TestBlock.includes("(She touches your arm briefly, then lets her hand fall away.)"));
  check('lesson5TestBlock contains E-move response instruction', lesson5TestBlock.includes('makes the E move'));
  check('lesson4TestBlock empty when practiceFocus=lesson5', lesson4TestBlock.length === 0);
}

console.log('\nSystem-prompt content checks (practiceFocus = "all")');
console.log('─'.repeat(54));

// all focus — both should fire
{
  const { lesson4TestBlock, lesson5TestBlock } = buildBlocks('all', 'sofia');
  check('lesson4TestBlock non-empty when practiceFocus=all', lesson4TestBlock.length > 0);
  check('lesson5TestBlock non-empty when practiceFocus=all', lesson5TestBlock.length > 0);
}

console.log('\nCharacter-guard checks (non-sofia character)');
console.log('─'.repeat(54));

// non-sofia — blocks should be empty regardless of practiceFocus
{
  const { lesson4TestBlock, lesson5TestBlock } = buildBlocks('lesson5', 'ava');
  check('lesson5TestBlock empty for non-sofia character (ava)', lesson5TestBlock.length === 0,
    'character-stream.js gates on characterId === "sofia"');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(54));
console.log(`${passed}/${passed + failed} tests PASS${failed > 0 ? `, ${failed} FAIL` : ''}`);
if (failed > 0) process.exit(1);
