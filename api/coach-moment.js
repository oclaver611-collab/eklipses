// api/coach-moment.js — lightweight mid-conversation teachable-moment check for Coached Practice mode
// Checks only the active lesson's mnemonic skills. Returns { teachable, skill, skillName, coaching, betterLine }.
// Conservative by design: only flags unmistakable failures. Fails open on error (no interrupt).

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
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
  if (!isLesson1 && !isLesson2) { console.log(`[coach-moment] skip — focus="${practiceFocus}" not lesson-specific`); return res.json({ teachable: false }); }

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

M — Make Her Qualify: When she brought up something about herself, did he miss the chance to make her prove it?
FAIL = immediately compliments her, says "I'm sure you are", or agrees without creating any tension.

E — Exit: When she clearly signals she is leaving or has already signalled it and he keeps talking instead of making a move.
FAIL = student keeps extending the conversation AFTER she has explicitly said she needs to go — he does not make a move.

HARD RULES — if ANY of these are true, return teachable:false for E, no exceptions:
  1. Her response contains a direct question aimed at him (e.g. "What about you?", "Where else do you go?", "What was the best part?") — questions mean she wants to keep talking.
  2. Her response is longer than 10 words without mentioning she needs to leave.
  3. Her response does not contain any of: "have to go", "need to go", "should go", "getting late", "get back to", "have to run", "head off", "head out", "leave", "leaving", "gotta go", "got to go".
  4. She is still contributing new information, asking about him, or showing curiosity.

A genuine Exit signal requires her to EXPLICITLY state she is leaving ("I should probably get back to my friends", "I actually have to run"). Topic changes, context about the setting, and questions back to him are NOT exit signals — they are engagement.

When in doubt: return teachable:false. Missing an Exit is better than interrupting an engaged conversation.`;

  const skillDefs = isLesson1 ? lesson1SkillDefs : lesson2SkillDefs;
  const lessonLabel = isLesson1 ? 'OTIMC (Lesson 1 — The Approach)' : 'FRAME (Lesson 2 — Holding Your Ground)';

  const systemPrompt = `You are Ryan, a direct dating coach reviewing a student's last message in a practice session.

Lesson being tested: ${lessonLabel}

SKILL DEFINITIONS:
${skillDefs}

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

    if (!parsed.teachable) {
      console.log('[coach-moment] → not teachable');
      return res.json({ teachable: false });
    }

    // Validate required fields before passing to client
    if (!parsed.skill || !parsed.coaching || !parsed.betterLine) {
      console.warn('[coach-moment] → teachable but missing fields, discarding', JSON.stringify(parsed));
      return res.json({ teachable: false });
    }

    // Library lookup — filter by conversation context, then pick at random.
    // opener:true lines are only shown when exchangeCount <= 2 (still early enough to be the approach).
    // If filtering leaves nothing, fall back to the LLM's own betterLine which can reply to her actual words.
    const lessonKey  = isLesson1 ? 'lesson1' : 'lesson2';
    const allLines   = BETTER_LINES[lessonKey]?.[String(parsed.skill)] || [];
    const isEarly    = exchangeCount <= 2;
    const pool       = isEarly ? allLines : allLines.filter(l => !l.opener);
    const betterLine = pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)].text
      : String(parsed.betterLine).slice(0, 120); // LLM fallback — contextual reply to her words

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
