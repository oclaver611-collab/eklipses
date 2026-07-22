// api/coach-moment.js — lightweight mid-conversation teachable-moment check for Coached Practice mode
// Checks only the active lesson's mnemonic skills. Returns { teachable, skill, skillName, coaching, betterLine }.
// Conservative by design: only flags unmistakable failures. Fails open on error (no interrupt).

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
  if (!userMessage.trim()) return res.json({ teachable: false });
  if (userMessage.trim().split(/\s+/).length < 5) return res.json({ teachable: false });
  if (exchangeCount <= 1) return res.json({ teachable: false }); // never interrupt the opening

  const isLesson1 = practiceFocus === 'lesson1';
  const isLesson2 = practiceFocus === 'lesson2';
  if (!isLesson1 && !isLesson2) return res.json({ teachable: false });

  if (!process.env.OPENAI_API_KEY) return res.json({ teachable: false }); // fail open

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
{"teachable":true,"skill":"X","skillName":"Full Skill Name","coaching":"One sentence — exactly what went wrong (max 18 words).","betterLine":"A concrete replacement line they could say right now (max 14 words)."}

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

    if (!parsed.teachable) return res.json({ teachable: false });

    // Validate required fields before passing to client
    if (!parsed.skill || !parsed.coaching || !parsed.betterLine) return res.json({ teachable: false });

    return res.json({
      teachable:  true,
      skill:      String(parsed.skill).slice(0, 5),
      skillName:  String(parsed.skillName || parsed.skill).slice(0, 60),
      coaching:   String(parsed.coaching).slice(0, 200),
      betterLine: String(parsed.betterLine).slice(0, 120),
    });

  } catch {
    // Fail open — network error, timeout, etc.
    return res.json({ teachable: false });
  }
};
