// api/coach-moment.js — lightweight mid-conversation teachable-moment check for Coached Practice mode
// Checks only the active lesson's mnemonic skills. Returns { teachable, skill, skillName, coaching, betterLine }.
// Conservative by design: only flags unmistakable failures. Fails open on error (no interrupt).

// Curated example lines per skill — shown as "Try this instead" in the interrupt overlay.
// 3 options per skill; one is picked at random each interrupt so it doesn't feel scripted.
const BETTER_LINES = {
  lesson1: {
    O: [
      "You've barely touched your drink.",
      "I clocked that look from across the room.",
      "Something about you looked like you had somewhere to be.",
    ],
    T: [
      "You're right — and yet here you are.",
      "I've been called worse.",
      "That's fine. Most people don't get it right away.",
    ],
    M: [
      "Something that keeps me out of trouble. Mostly.",
      "I'll tell you once you've earned it.",
      "Bit of everything — nothing worth explaining tonight.",
    ],
    I: [
      "Give me your number and we'll see.",
      "Something tells me this isn't the last time we talk.",
      "I have a feeling we're not done yet.",
    ],
    C: [
      "Give me your number.",
      "Let's grab coffee this week.",
      "Come find me before you leave tonight.",
    ],
  },
  lesson2: {
    F: [
      "Probably.",
      "You're not wrong.",
      "Fair enough.",
    ],
    R: [
      "You talk to me just fine.",
      "People say that right before they can't stop talking.",
      "Strangers are just people you haven't figured out yet.",
    ],
    A: [
      "Appreciate the update.",
      "Bold of you to decide that so fast.",
      "Okay.",
    ],
    M: [
      "Prove it.",
      "I'll be the judge of that.",
      "I've heard that one — convince me.",
    ],
    E: [
      "Give me your number and we'll pick this up.",
      "I'm heading out — give me your number first.",
      "Let's not drag this out — give me your number.",
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

E — Exit: When she signals she needs to go or pulls back, did he chase?
FAIL = keeps talking, extends unnecessarily after she signals exit, waits for her to decide, doesn't make a move.`;

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
{"teachable":true,"skill":"X","skillName":"Full Skill Name","coaching":"One sentence — exactly what went wrong (max 18 words)."}

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
        max_tokens: 200,
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
    if (!parsed.skill || !parsed.coaching) {
      console.warn('[coach-moment] → teachable but missing fields, discarding', JSON.stringify(parsed));
      return res.json({ teachable: false });
    }

    // Library lookup — pick a random curated line for this skill; fall back to LLM's betterLine
    const lessonKey   = isLesson1 ? 'lesson1' : 'lesson2';
    const skillLines  = BETTER_LINES[lessonKey]?.[String(parsed.skill)];
    const betterLine  = skillLines
      ? skillLines[Math.floor(Math.random() * skillLines.length)]
      : String(parsed.betterLine || '').slice(0, 120);

    if (!betterLine) {
      console.warn('[coach-moment] → teachable but no betterLine (missing from library and LLM), discarding');
      return res.json({ teachable: false });
    }

    console.log(`[coach-moment] → TEACHABLE skill:${parsed.skill} (${parsed.skillName}) | "${String(parsed.coaching).slice(0, 80)}" | betterLine source:${skillLines ? 'library' : 'llm'}`);
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
