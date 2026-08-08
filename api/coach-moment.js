// api/coach-moment.js — lightweight mid-conversation teachable-moment check for Coached Practice mode
// Checks only the active lesson's mnemonic skills. Returns { teachable, skill, skillName, coaching, betterLine }.
// Conservative by design: only flags unmistakable failures. Fails open on error (no interrupt).
const { checkRateLimit } = require('./ratelimit');

// Curated example lines per skill — shown as "Try this instead" in the interrupt overlay.
// Each entry is { text, opener?: true }.
// opener:true lines only work as first-approach lines and must not be shown mid-conversation.
// Selection filters by context: early (exchange ≤ 2) allows all lines; mid-conv skips opener-only.
// If filtering leaves no eligible lines, the LLM's own betterLine is used as fallback.
const BETTER_LINES = {
  lesson1: {
    O: [
      // universal — observation of present behaviour, works at any exchange
      { text: "You've barely touched your drink." },
      { text: "You have that look like something's on your mind." },
      // opener-only — implies you just noticed her from across the room before approaching
      { text: "I clocked that look from across the room.", opener: true },
      { text: "Something about you looked like you had somewhere to be.", opener: true },
    ],
    T: [
      // all universal — direct replies to her pushback, never approach-specific
      { text: "You're right — and yet here you are." },
      { text: "I've been called worse." },
      { text: "That's fine. Most people don't get it right away." },
    ],
    M: [
      // all universal — replies to direct personal questions at any exchange
      { text: "Something that keeps me out of trouble. Mostly." },
      { text: "I'll tell you once you've earned it." },
      { text: "Bit of everything — nothing worth explaining tonight." },
    ],
    I: [
      // all universal — imply interest without stating it, work at any point
      { text: "Give me your number and we'll see." },
      { text: "Something tells me this isn't the last time we talk." },
      { text: "I have a feeling we're not done yet." },
    ],
    C: [
      // all universal — direct close lines, work whenever she signals the window
      { text: "Give me your number." },
      { text: "Let's grab coffee this week." },
      { text: "Come find me before you leave tonight." },
    ],
  },
  lesson2: {
    F: [
      // all universal — unbothered replies to any test or jab
      { text: "Probably." },
      { text: "You're not wrong." },
      { text: "Fair enough." },
    ],
    R: [
      // all universal — reframe replies, work at any exchange
      { text: "You talk to me just fine." },
      { text: "People say that right before they can't stop talking." },
      { text: "Strangers are just people you haven't figured out yet." },
    ],
    A: [
      // all universal — humor deflections, work at any exchange
      { text: "Appreciate the update." },
      { text: "Bold of you to decide that so fast." },
      { text: "Okay." },
    ],
    M: [
      // all universal — make-her-qualify replies at any exchange
      { text: "Prove it." },
      { text: "I'll be the judge of that." },
      { text: "I've heard that one — convince me." },
    ],
    E: [
      // all universal — exit-move lines, work whenever the window opens
      { text: "Give me your number and we'll pick this up." },
      { text: "I'm heading out — give me your number first." },
      { text: "Let's not drag this out — give me your number." },
    ],
  },
  lesson3: {
    P: [
      // universal — Pause responses to direct feelings/exclusivity questions
      { text: "I haven't decided yet. Ask me again in an hour." },
      { text: "That's a faster question than I expected." },
      { text: "Let's find out." },
    ],
    A: [
      // universal — Ask-back redirects after answering about himself
      { text: "What about you — same question." },
      { text: "Your turn." },
      { text: "I'll ask you the same thing." },
    ],
    C: [
      // universal — Contain lines instead of stacking compliments
      { text: "You already know you're interesting. I don't need to say it." },
      { text: "I've noticed a few things. I'm keeping them to myself for now." },
      { text: "Let's call it noted." },
    ],
    E: [
      // universal — Earn lines instead of early escalation declarations
      { text: "We're not there yet." },
      { text: "Good things earn themselves." },
      { text: "I know what I want. I'm not in a rush about it." },
    ],
  },
  lesson4: {
    C: [
      // universal — signal you heard more than the surface topic
      { text: "Wait — you said something earlier I want to go back to." },
      { text: "There were at least three things in what you just said. I'm choosing one." },
      { text: "I heard the main answer. I'm more interested in the thing you said after it." },
    ],
    H: [
      // universal — signal you picked the emotional thread, not the obvious one
      { text: "Not that part — the other part. The one you said almost like an afterthought." },
      { text: "I heard what you said. But I'm more interested in the feeling under it." },
      { text: "That thing you mentioned casually — it wasn't casual." },
    ],
    A: [
      // universal — single questions that go one layer deeper without jumping topic
      { text: "What did that feel like — not what happened, what it felt like." },
      { text: "Tell me more about that. Not the what. The why." },
      { text: "How long have you felt that way?" },
    ],
    I: [
      // universal — brief reciprocal disclosure, connected to her thread, not a monologue
      { text: "That reminds me of something. I went through something similar — not the same, but close." },
      { text: "I know that feeling. It took me a while to put a word to it." },
      { text: "I don't usually bring this up — but what you said connects to something real for me." },
    ],
    N: [
      // universal — return lines; coming back to what she moved past
      { text: "You mentioned something earlier I keep thinking about — go back to that." },
      { text: "I keep coming back to that thing you mentioned. Go back there." },
      { text: "I want to know more about that — the thing you said before we got off track." },
    ],
  },
  lesson5: {
    T: [
      // universal — demonstrates gaze awareness without clumsiness
      { text: "Don't look away on my account." },
      { text: "You're doing something with how you look at people. I noticed." },
      { text: "I noticed that." },
    ],
    R: [
      // universal — registers and plays with proximity shift
      { text: "We started much further apart." },
      { text: "You moved over here. I noticed." },
      { text: "I'm not moving. But you can keep going." },
    ],
    A: [
      // universal — names the mirroring/alignment dynamic
      { text: "You match the pace of whoever you're talking to." },
      { text: "You adjusted without noticing. That's a tell." },
      { text: "You just did what I did. That's interesting." },
    ],
    C: [
      // universal — responds to touch without flinching or over-reacting
      { text: "You did that on purpose." },
      { text: "That wasn't accidental." },
      { text: "I noticed that too." },
    ],
    E: [
      // universal — the direct ask; statement, not a question
      { text: "I want to keep talking to you. What's your number." },
      { text: "We should continue this somewhere else. Come on." },
      { text: "I'm going to get another drink. You should come." },
    ],
  },
};

// Deterministic hard gate for Exit (E) skill — code-enforced, not LLM-dependent.
// Returns true when Exit CANNOT fire: either she asked a question (still engaged)
// or she used no exit language (never signalled she's leaving).
function exitCannotFire(characterResponse) {
  // Any question mark → she's asking him something → engaged, not leaving
  if (/\?/.test(characterResponse)) return true;

  const r = (characterResponse || '').toLowerCase();
  const hasExitLanguage =
    r.includes('have to go')   || r.includes('need to go')   || r.includes('should go')  ||
    r.includes('getting late') || r.includes('get back to')  || r.includes('have to run') ||
    r.includes('head off')     || r.includes('head out')     || r.includes('gotta go')    ||
    r.includes('got to go')    || r.includes('should head')  || r.includes('have to leave') ||
    r.includes('need to leave') || r.includes("i'm heading") || r.includes('heading out') ||
    r.includes('heading off')  || /\bleave\b/.test(r)        || /\bleaving\b/.test(r);

  return !hasExitLanguage; // no exit language → she never said she's leaving → Exit cannot fire
}

// ── PACE (Lesson 3) deterministic gates — code-enforced, not LLM-dependent ─
// Each returns true when the corresponding skill CANNOT fire.
// Goal: block PACE moments from misfiring on Sofia's engaged/curious questions,
// mirroring the exitCannotFire pattern that fixed the L2 production bug.

// P (Pause) cannot fire unless her response contains a direct question about
// feelings, interest, or exclusivity. General personal-history questions ("what
// do you do?", "where are you from?") are Mystery territory (L1) — never P.
function pauseCannotFire(characterResponse) {
  const r = (characterResponse || '').toLowerCase();
  const hasFeelingQuestion =
    // "do you (actually/really/...) like me"
    /do you\s+(\w+\s+)?like\s+(me|us)\b/.test(r)  ||
    // "like me?" anywhere in the response
    /\blike\s+me\b/.test(r)                         ||
    // "are you seeing / dating anyone / someone"
    /are you\s+(\w+\s+)?seeing\s+(anyone|someone)\b/.test(r) ||
    /are you\s+(\w+\s+)?dating\s+(anyone|someone)\b/.test(r) ||
    /\bwhat are we\b/.test(r)                       ||
    /do you have feelings/.test(r)                  ||
    /how do you feel (about|for) (me|us)/.test(r)   ||
    /\binterested in me\b/.test(r)                  ||
    r.includes('are you seeing anyone')             ||
    r.includes('are you seeing someone')            ||
    r.includes('seeing other people')               ||
    r.includes('exclusive')                         ||
    r.includes('what is this')                      ||
    r.includes('what are we doing')                 ||
    r.includes('do you like me')                    ||
    r.includes('feel about me');
  return !hasFeelingQuestion;
}

// A (Ask-back) cannot fire unless she asked him something about himself.
// If her response has no "?" or no reference to "you", she didn't ask → A blocked.
function askbackCannotFire(characterResponse) {
  if (!/\?/.test(characterResponse)) return true; // no question at all → A cannot fire
  const r = (characterResponse || '').toLowerCase();
  // Question must reference him — check for second-person pronoun in her question
  return !/\byou\b/.test(r); // no "you" in her response → she didn't ask about him
}

// C (Contain) cannot fire unless the student's message stacks multiple distinct
// romantic/attraction-specific terms. Single casual compliments and general banter
// are Tease territory (L1) and must not be flagged here.
function containCannotFire(userMessage) {
  const u = (userMessage || '').toLowerCase();
  const romanticPatterns = [
    /\bbeautiful\b/, /\bstunning\b/, /\bgorgeous\b/, /\battractive\b/,
    /\bi\s+(really\s+)?like\s+you\b/, /\bi\s+(really\s+)?love\s+you\b/,
    /\bfalling\s+for\s+you\b/, /\byou['']?re\s+so\s+(beautiful|gorgeous|pretty|amazing|perfect)\b/,
    /\bi\s+(really\s+)?(like|adore|fancy)\s+you\b/,
  ];
  const matchCount = romanticPatterns.filter(p => p.test(u)).length;
  return matchCount < 2; // need ≥2 distinct romantic terms to qualify as stacked
}

// E (Earn) cannot fire after the first 4 exchanges (she's had time to invest)
// or when the student's message contains no escalation language.
function earnCannotFire(exchangeCount, userMessage) {
  if (exchangeCount > 4) return true; // past the early-game window
  const u = (userMessage || '').toLowerCase();
  const escalationPatterns = [
    /\bi\s+(really\s+)?(like|love)\s+you\b/,
    /\bgo\s+out\b/, /\btake\s+you\s+out\b/,
    /\bask\s+you\s+out\b/, /\bproper\s+date\b/, /\bactual\s+date\b/,
    /\bi\s+(feel|felt)\s+something\b/,
    /\bfalling\s+for\s+you\b/,
    /\bspecial\s+(to\s+me|connection)\b/,
    /\bnever\s+felt\s+this\b/, /\bhaven'?t\s+felt\s+this\b/,
  ];
  return !escalationPatterns.some(p => p.test(u));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  const {
    userMessage   = '',
    characterResponse = '',
    practiceFocus = 'free',
    exchangeCount = 0,
    scenarioKey   = 'beach',
  } = req.body || {};

  // Client-side filters already gate these, but double-check server-side
  const wordCount = userMessage.trim().split(/\s+/).length;
  if (!userMessage.trim()) { console.log('[coach-moment] skip — empty'); return res.json({ teachable: false }); }
  if (wordCount < 5) { console.log(`[coach-moment] skip — too short (${wordCount} words)`); return res.json({ teachable: false }); }
  if (exchangeCount <= 1) { console.log(`[coach-moment] skip — first exchange (count=${exchangeCount})`); return res.json({ teachable: false }); }

  const isLesson1 = practiceFocus === 'lesson1';
  const isLesson2 = practiceFocus === 'lesson2';
  const isLesson3 = practiceFocus === 'lesson3';
  const isLesson4 = practiceFocus === 'lesson4';
  const isLesson5 = practiceFocus === 'lesson5';
  if (!isLesson1 && !isLesson2 && !isLesson3 && !isLesson4 && !isLesson5) { console.log(`[coach-moment] skip — focus="${practiceFocus}" not lesson-specific`); return res.json({ teachable: false }); }

  // Pre-compute exit gate (L2): deterministic check that overrides any LLM decision on skill E
  const exitBlocked = isLesson2 && exitCannotFire(characterResponse);
  if (exitBlocked) console.log('[coach-moment] exit gate active — skill E is blocked for this exchange');

  // Pre-compute PACE gates (L3): code-enforced overrides per skill
  const pauseBlocked   = isLesson3 && pauseCannotFire(characterResponse);
  const askbackBlocked = isLesson3 && askbackCannotFire(characterResponse);
  const containBlocked = isLesson3 && containCannotFire(userMessage);
  const earnBlocked    = isLesson3 && earnCannotFire(exchangeCount, userMessage);
  if (isLesson3) {
    if (pauseBlocked)   console.log('[coach-moment] PACE gate: P (Pause) blocked — no feelings/exclusivity question in her response');
    if (askbackBlocked) console.log('[coach-moment] PACE gate: A (Ask-back) blocked — she did not ask about him');
    if (containBlocked) console.log('[coach-moment] PACE gate: C (Contain) blocked — not enough romantic terms to be stacked');
    if (earnBlocked)    console.log('[coach-moment] PACE gate: E (Earn) blocked — no escalation language or past early window');
  }

  // Pre-compute CHAIN gate (L4): N (Never abandon) cannot fire in the first 3 exchanges —
  // there is no established live thread to abandon that early.
  const neverBlocked = isLesson4 && exchangeCount <= 3;
  if (isLesson4 && neverBlocked) console.log('[coach-moment] CHAIN gate: N (Never abandon) blocked — exchange too early for an established thread');

  console.log(`[coach-moment] checking — focus:${practiceFocus} exchange:${exchangeCount} words:${wordCount} | "${userMessage.slice(0, 80)}"`);

  if (!process.env.OPENAI_API_KEY) { console.warn('[coach-moment] skip — OPENAI_API_KEY not set'); return res.json({ teachable: false }); }

  // ── Skill definitions (condensed — see coach.js for full definitions) ──────
  const lesson1SkillDefs = `
O — Observation opener: Did they open with something specific about the scene/what she's doing, OR reference it in their first few messages?
FAIL = purely generic opener (compliment on looks, "you're beautiful", "hey", nothing scene-specific) AND no scene reference in first 2-3 messages.

T — Tease / Hold frame: When she pushed back or challenged him, did he fold?
FAIL = apologizes, caves immediately, over-explains, says "I didn't mean to offend", tries to justify himself.

M — Mystery: When asked a personal question (job, why he's there, where he's from), did he over-share?
FAIL = full resume: job title + company + years + hobbies all in one message with nothing withheld.

I — Imply / Verbal spike: Did he state attraction directly with no subtext?
FAIL = "I think you're really attractive and I'd like to ask you out." Direct statement of attraction with zero subtext.

C — Close: Did his close have hedge language?
FAIL = used "no pressure", "only if you want", "maybe", "if you're interested", "I don't know", or any qualifier that softens the ask. OR ended with no move at all when it was clearly the close moment.
PASS = any direct confident ask (coffee/number/walk) with no hedges.`;

  const lesson2SkillDefs = `
F — Feel Nothing: When she tested or challenged him, did he get defensive or explain himself?
FAIL = defensive response, justifying himself, explaining why he's actually cool/different, apologizing, flustered energy.

R — Reframe: When she made a limiting statement ("I don't talk to strangers", "I'm probably boring"), did he accept her frame?
FAIL = accepts it, backs off, agrees with her limiting statement instead of offering a different read.

A — Add Humor: When she challenged his confidence directly ("you seem sure of yourself"), did he take it seriously?
FAIL = defends himself earnestly, gets stiff, explains logically why he's confident, apologizes.

M — Make Her Qualify: When she EXPLICITLY claimed something about herself ("I'm really fun", "I'm well-traveled", "I'm kind of a big deal"), did he immediately validate or agree instead of making her prove it?
FAIL = immediately compliments her ("I'm sure you are", "Wow that's amazing"), or agrees without any push-back.
NOT M = she asked him a question, made a neutral observation, or said nothing about herself. A question directed at him is NEVER an M failure — do not flag M when her response is or contains a question.

E — Exit: When she clearly signals she is leaving or has already signalled it and he keeps talking instead of making a move.
FAIL = student keeps extending the conversation AFTER she has explicitly said she needs to go — he does not make a move.

HARD RULES — if ANY of these are true, return teachable:false for E, no exceptions:
  1. Her response contains a direct question aimed at him (e.g. "What about you?", "Where else do you go?", "What was the best part?") — questions mean she wants to keep talking.
  2. Her response is longer than 10 words without mentioning she needs to leave.
  3. Her response does not contain any of: "have to go", "need to go", "should go", "getting late", "get back to", "have to run", "head off", "head out", "leave", "leaving", "gotta go", "got to go".
  4. She is still contributing new information, asking about him, or showing curiosity.

A genuine Exit signal requires her to EXPLICITLY state she is leaving ("I should probably get back to my friends", "I actually have to run"). Topic changes, context about the setting, and questions back to him are NOT exit signals — they are engagement.

When in doubt: return teachable:false. Missing an Exit is better than interrupting an engaged conversation.`;

  const lesson3SkillDefs = `
P — Pause: When she asked a DIRECT question about his feelings, interest, or exclusivity ("do you like me?", "are you seeing anyone?", "what are we doing here?", "what is this?"), did he answer too eagerly or directly?
FAIL = immediately confirms feelings ("yes I like you", "no I'm not seeing anyone") — gives her the answer before she's made to wait for it.
NOT P = she asked about his job, hobbies, travel, friends, or any personal-history topic. Those are Mystery territory (Lesson 1) — NEVER flag P for those questions.

A — Ask-back: When she asked him something about himself (his work, interests, experiences, opinions), did he answer but end without ANY question or redirect back to her?
FAIL = his message is entirely about himself with zero curiosity directed back at her — no question mark, no "what about you", no "your turn", no redirect. The turn ends completely on him.
EXAMPLE FAIL: "I've been in product management for four years. Started at a startup, moved to a bigger company. It's fine — good team, decent work." ← no question back, clear A failure.
EXAMPLE PASS: "Four years in product management. Started in startups. What about you — what do you do?" ← redirected back.
NOT A = she made a statement (not a question directed at him), or he did ask a question or redirect.

C — Contain: Did he stack multiple romantic or attraction-specific compliments in one message?
FAIL = uses two or more of: "you're beautiful", "you're gorgeous", "I really like you", "I'm falling for you", "you're stunning/amazing/perfect" — stacked in one turn.
NOT C = a single casual compliment, general banter, playful tease, or humor. Those are Tease territory (Lesson 1) — NEVER flag C for normal banter.

E — Earn: In the FIRST 3-4 exchanges, did he make a premature declaration of strong interest, a date proposal, or romantic escalation?
FAIL = "I really like you", "I want to take you out", "I feel something with you" — declared before she has shown clear investment.
NOT E = after exchange 4 (she's had time to invest and he's responded), or when he's clearly responding to her unmistakable signal.

IMPORTANT BOUNDARY RULES — never cross these:
- P fires ONLY on direct feelings/exclusivity questions. If she asked "what do you do?" or "where are you from?" or any job/life question, that is NOT a P moment.
- A fires ONLY when she asked him something. If her response is a statement with no question, A cannot fire.
- C fires ONLY when compliments are stacked (2+). One compliment is not C.
- E fires ONLY in the first 4 exchanges with clear escalation language. After exchange 4, E cannot fire.

PRIORITY RULE — when her response contains a direct feelings/exclusivity question (e.g. "do you like me?", "do you actually like me?", "what are we doing here?", "are you seeing anyone?"), check P FIRST. If the student answered too directly/eagerly, return P — not E. E is only for escalation that happens WITHOUT her asking directly.

When in doubt: return teachable:false. A missed moment is better than a false interrupt.`;

  const lesson4SkillDefs = `
C — Catch threads: When she spoke, did the user ignore all the embedded topics she offered and pivot to something entirely unrelated?
FAIL = her message contained 2+ distinct threads (names, events, feelings, experiences) and the user's reply references none of them — asks a generic question or changes the subject entirely.
NOT C = the user picked any thread she actually offered, even the most obvious one. C only fires when ALL threads are abandoned.

H — Hook the richest: When she spoke, did the user pick the obvious/safe topic rather than the thread with the most emotional charge?
FAIL = her message had a clearly marked emotional thread (something she described as weird, hard, surprising, meaningful, or that she said with feeling) AND the user asked about a surface detail instead — the date, location, basic fact — not the emotional content.
NOT H = she gave only surface-level information with no emotional thread to pick. H cannot fire if there was no richer thread available.

A — Ask deeper: After picking a thread, did the user pivot to a completely different topic instead of going one layer further?
FAIL = user picked up a thread, she responded with more, and then user's next message jumps to an entirely new subject — does not ask a follow-up on the same thread, does not go deeper.
NOT A = the user asked any follow-up question on the same general topic, even imperfect ones. A only fires on full topic abandonment after a thread opened.

I — Inject yourself: When she shared something personal, did the user stay entirely in question mode without sharing anything from their own life?
FAIL = she disclosed something real (a feeling, a struggle, a personal experience) and the user responded with another question only — no brief personal share, no "I know that feeling", no real connection offered.
NOT I = the user shared anything about themselves, even briefly. I only fires when the user contributes nothing personal after she has opened up.

N — Never abandon a live thread: Did the user accept her redirect and drop a thread she had visibly lit up about?
FAIL = earlier in the conversation she said something with clear engagement ("honestly…", lit up on a topic, started to share and pulled back) AND when she changed the subject or redirected, the user followed the redirect and never returned to it.
NOT N = the exchange is exchange 3 or earlier (no established thread yet), or she never showed visible engagement on any prior topic.

IMPORTANT: CHAIN skills are about what the user does with her words — not about whether the user says something good or impressive. A witty reply that ignores her content fails C. A deep personal question that pivots off-topic fails A. Evaluate strictly on whether the user tracked and responded to what she actually offered.

When in doubt: return teachable:false. Missing a CHAIN moment is better than interrupting a conversation that was already tracking.`;

  const lesson5SkillDefs = `
T — Track gaze: When Sofia's response included a stage direction describing her holding eye contact longer than normal (e.g. "(You realize you've been holding his gaze a beat longer than the sentence required.)"), did the user acknowledge, name, or play with the gaze dynamic?
PASS = user said something that names or engages the gaze: "don't look away on my account", "I noticed that", any line that plays with the eye contact dynamic rather than ignoring it.
FAIL = the gaze stage direction was clearly present in Sofia's prior response AND the user's reply made no reference to it — responded only to conversational content.
NOT T = Sofia's prior response contained no gaze stage direction. Do not fire T.

R — Register proximity: When Sofia's response included a stage direction describing her moving closer (e.g. "(Without deciding to, you've moved to the same shelf...)"), did the user acknowledge the proximity shift?
PASS = user named it ("we started much further apart", "you moved over here") or played with it without pulling back.
FAIL = the proximity stage direction was clearly present AND the user ignored it entirely.
NOT R = Sofia's prior response contained no proximity stage direction.

A — Attend to alignment: When Sofia's response included a stage direction describing mirroring his posture (e.g. "(You notice you're leaning the same way he is...)"), did the user notice or name it?
PASS = user named the mirroring ("you match the pace of whoever you're with"), pointed it out, or acknowledged it in any way.
FAIL = the mirroring stage direction was present AND the user made no acknowledgment.
NOT A = Sofia's prior response contained no alignment stage direction.

C — Catch touch: When Sofia's response included a stage direction describing brief deliberate touch (e.g. "(Your hand rests on his forearm for a moment...)"), did the user respond without ignoring or over-reacting?
PASS = user acknowledged it directly ("you did that on purpose", "that wasn't accidental") or responded with any line that plays with the touch signal.
FAIL = the touch stage direction was clearly present AND the user completely ignored it in their reply.
NOT C = Sofia's prior response contained no touch stage direction.

E — Enter on the cluster: Did the user make a direct move — ask for her number, suggest continuing somewhere else, or include her in what they're doing — with no hedge language?
PASS = direct statement with no hedge language: "I want to keep talking to you — what's your number", "come get a drink with me", "we should continue this somewhere else."
FAIL = user used hedge language ("maybe we could..."); OR asked permission rather than made a statement.
NOT E = conversation too early or short to expect the move.

IMPORTANT: T, R, A, C can only fire when the corresponding signal appeared in Sofia's MOST RECENT response. Only the current exchange matters — do not fire based on stage directions from earlier exchanges. When in doubt: return teachable:false.`;

  const skillDefs = isLesson1 ? lesson1SkillDefs : isLesson2 ? lesson2SkillDefs : isLesson3 ? lesson3SkillDefs : isLesson4 ? lesson4SkillDefs : lesson5SkillDefs;
  const lessonLabel = isLesson1 ? 'OTIMC (Lesson 1 — The Approach)' : isLesson2 ? 'FRAME (Lesson 2 — Holding Your Ground)' : isLesson3 ? 'PACE (Lesson 3 — The Long Game)' : isLesson4 ? 'CHAIN (Lesson 4 — The Thread)' : 'TRACE (Lesson 5 — The Read)';

  // Belt-and-suspenders: also tell the LLM when gates are active (code overrides below are the real guards)
  let finalSkillDefs = skillDefs;
  if (exitBlocked) {
    finalSkillDefs += '\n\nGATE ACTIVE FOR THIS EXCHANGE: Her response contains a direct question OR no exit language. Skill E (Exit) is DETERMINISTICALLY BLOCKED — do not return skill=E.';
  }
  if (isLesson3) {
    const blocked = [];
    if (pauseBlocked)   blocked.push('P (Pause) — her response had no feelings/exclusivity question');
    if (askbackBlocked) blocked.push('A (Ask-back) — she asked him no question');
    if (containBlocked) blocked.push('C (Contain) — student message had fewer than 2 romantic terms');
    if (earnBlocked)    blocked.push('E (Earn) — no escalation language or past exchange 4');
    if (blocked.length) finalSkillDefs += '\n\nPACE GATES ACTIVE: The following skills are DETERMINISTICALLY BLOCKED this exchange — do not return them:\n' + blocked.map(b => '  • ' + b).join('\n');

    // When A is unblocked, the student's message has no "?", AND the message is clearly

    // a first-person self-answer (starts with I/Yeah I/So I and is substantive) →
    // add an explicit A hint. This avoids firing on compliments directed at her.
    const studentHasNoQuestion = !/\?/.test(userMessage);
    const u = userMessage.trim().toLowerCase();
    const studentAnsweringAboutSelf = /^(i\b|yeah,?\s+i\b|so i\b|well,?\s+i\b)/.test(u) && userMessage.trim().split(/\s+/).length >= 8;
    if (!askbackBlocked && studentHasNoQuestion && studentAnsweringAboutSelf) {
      finalSkillDefs += '\n\nPACE SIGNAL — A (Ask-back): She asked him a question about himself (confirmed by gate). His reply is a first-person self-description with NO question mark and no redirect back to her. This is a textbook A failure. Return skill=A.';
    }
  }
  if (isLesson4 && neverBlocked) {
    finalSkillDefs += '\n\nCHAIN GATE ACTIVE: Skill N (Never abandon) is DETERMINISTICALLY BLOCKED — exchange is too early for an established live thread. Do not return skill=N.';
  }

  const systemPrompt = `You are Ryan, a direct dating coach reviewing a student's last message in a practice session.

Lesson being tested: ${lessonLabel}

SKILL DEFINITIONS:
${finalSkillDefs}

YOUR JOB: Look at the student's last message ONLY. Check if it contains a CLEAR, unmistakable failure on one of these skills.

Be CONSERVATIVE. Only flag failures that are obvious. When in doubt → teachable: false.
Do NOT flag imperfect lines, missed opportunities, or things that "could be better" — only flag clear violations of the skill definitions above.

If a clear failure exists, return:
{"teachable":true,"skill":"X","skillName":"Full Skill Name","coaching":"...","betterLine":"A short line they could say right now in direct reply to her last message (max 12 words)."}

COACHING FORMAT — 1-2 short sentences, max 30 words total:
Sentence 1: What she is doing psychologically RIGHT NOW (frame it as her move, not the student's mistake).
Sentence 2: Name the skill plainly using "This is a ___ moment."

Good examples:
- "She's testing whether you'll fold under a light jab. This is a Tease moment."
- "She's seeing if you'll accept her frame or offer your own. This is a Reframe moment."
- "She put something on the table — now she needs to earn your attention. This is a Make Her Qualify moment."
- "She's signalling the window is open. This is a Close moment."
- "She threw a test to see if you'll get rattled. This is a Feel Nothing moment."

Write about what SHE is doing. Name the skill in the second sentence. Max 30 words.

If no clear failure, return:
{"teachable":false}

Return ONLY valid JSON. No markdown, no preamble.`;

  const userContent = `Student's last message: "${userMessage.slice(0, 300)}"
Practice partner's response (for context): "${characterResponse.slice(0, 200)}"
Exchange number: ${exchangeCount}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:      'gpt-4o-mini',
        max_tokens: 220,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!resp.ok) return res.json({ teachable: false });

    const data  = await resp.json();
    const raw   = data.choices?.[0]?.message?.content?.trim() || '{}';
    const clean = raw.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim();

    let parsed;
    try { parsed = JSON.parse(clean); } catch { return res.json({ teachable: false }); }

    // Deterministic Exit gate override (L2) — catches cases where LLM fires E despite hard rules in the prompt.
    // This is the real enforcement layer; the prompt note above is belt-and-suspenders only.
    if (exitBlocked && parsed.teachable && parsed.skill === 'E') {
      console.log('[coach-moment] → Exit gate override: LLM returned E but characterResponse has a question or no exit language — suppressing');
      return res.json({ teachable: false });
    }

    // Deterministic PACE gate overrides (L3) — suppress any skill the code-gate already blocked.
    if (isLesson3 && parsed.teachable) {
      const skill = String(parsed.skill).toUpperCase();
      if ((skill === 'P' && pauseBlocked) || (skill === 'A' && askbackBlocked) ||
          (skill === 'C' && containBlocked) || (skill === 'E' && earnBlocked)) {
        console.log(`[coach-moment] → PACE gate override: LLM returned skill=${skill} but gate is active — suppressing`);
        return res.json({ teachable: false });
      }
    }

    // Deterministic CHAIN gate override (L4) — N cannot fire in early exchanges.
    if (isLesson4 && parsed.teachable && String(parsed.skill).toUpperCase() === 'N' && neverBlocked) {
      console.log('[coach-moment] → CHAIN gate override: LLM returned N but exchange too early — suppressing');
      return res.json({ teachable: false });
    }

    if (!parsed.teachable) {
      console.log('[coach-moment] → not teachable');
      return res.json({ teachable: false });
    }

    // Validate required fields before passing to client (betterLine checked after library lookup)
    if (!parsed.skill || !parsed.coaching) {
      console.warn('[coach-moment] → teachable but missing skill/coaching, discarding', JSON.stringify(parsed));
      return res.json({ teachable: false });
    }

    // Library lookup — filter by conversation context, then pick at random.
    // opener:true lines are only shown when exchangeCount <= 2 (still early enough to be the approach).
    // If filtering leaves nothing, fall back to the LLM's own betterLine which can reply to her actual words.
    const lessonKey  = isLesson1 ? 'lesson1' : isLesson2 ? 'lesson2' : isLesson3 ? 'lesson3' : isLesson4 ? 'lesson4' : 'lesson5';
    const allLines   = BETTER_LINES[lessonKey]?.[String(parsed.skill)] || [];
    const isEarly    = exchangeCount <= 2;
    const pool       = isEarly ? allLines : allLines.filter(l => !l.opener);
    const betterLine = pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)].text
      : parsed.betterLine ? String(parsed.betterLine).slice(0, 120) : null;

    // Discard if we have no betterLine from either source
    if (!betterLine) {
      console.warn('[coach-moment] → teachable but no betterLine (library empty, LLM omitted), discarding');
      return res.json({ teachable: false });
    }

    const betterLineSource = pool.length > 0 ? 'library' : 'llm-fallback';
    console.log(`[coach-moment] → TEACHABLE skill:${parsed.skill} (${parsed.skillName}) | "${String(parsed.coaching).slice(0, 80)}" | betterLine:${betterLineSource}${pool.length === 0 ? ` (no eligible library lines at exchange ${exchangeCount})` : ''}`);
    return res.json({
      teachable:  true,
      skill:      String(parsed.skill).slice(0, 5),
      skillName:  String(parsed.skillName || parsed.skill).slice(0, 60),
      coaching:   String(parsed.coaching).slice(0, 200),
      betterLine,
    });

  } catch (err) {
    console.error('[coach-moment] error:', err.message);
    return res.json({ teachable: false });
  }
};
