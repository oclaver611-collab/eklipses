// api/coach.js — Ryan's post-session coaching via OpenAI
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conversation, scenarioTitle, scenarioKey, opener } = req.body || {};

  if (!conversation?.length) {
    return res.status(400).json({ error: 'No conversation provided' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  }

  // Use the opener passed directly from player.js — this is the true first thing the user said
  // If not passed, fall back to extracting from conversation
  let sofiaFirstResponse = null;
  let openerLine = (opener || '').trim();

  // Build transcript — number HIM lines, capture Sofia's first response for context
  let himCount = 0;
  let sofiaCount = 0;
  const transcript = conversation
    .map(m => {
      if (m.role === 'user') {
        himCount++;
        return `HIM_${himCount}: ${m.content.trim()}`;
      } else {
        sofiaCount++;
        const text = m.content.trim();
        if (sofiaCount === 1) sofiaFirstResponse = text;
        return `SOFIA: ${text}`;
      }
    })
    .join('\n');

  // If no opener was passed, extract from conversation as fallback
  if (!openerLine) {
    openerLine = conversation.find(m => m.role === 'user')?.content || '';
  }

  // Generate part1 directly in JS — guaranteed correct opener
  const openerLower = openerLine.trim().toLowerCase();
  const openerWords = openerLine.trim().split(/\s+/);
  // nameOnly = opener is just a greeting with nothing else
  const nameOnly = openerWords.length <= 2 && /^(hi|hey|hello)/i.test(openerLower);
  // isGeneric = starts with greeting, asks for name, or is very short and generic
  const isGeneric = !nameOnly && (
    /^(hi|hey|hello)\b/i.test(openerLower) ||
    openerLower.includes('what is your name') ||
    openerLower.includes("what's your name") ||
    openerLower.includes('never saw you here') ||
    openerWords.length <= 5
  );
  
  // Scenario-specific better opener suggestions
  const betterOpeners = {
    beach:     'You look like you have found the only quiet spot on this whole beach — is this your spot?',
    bar:       'I have been watching this end of the bar — everyone is either on their phone or trying too hard. You are the only one who looks like you are actually here.',
    museum:    'You have been standing in front of that one longer than anyone else — what is it doing to you?',
    gym:       'I was going to ask if that machine is free but honestly I am more curious what you are training for.',
    bookstore: 'You look like someone who actually reads the back cover before deciding — that already makes you more interesting than most people in here.',
    street:    'You look like you are on your way somewhere specific — I figured I had about ten seconds to say something worth your time.',
  };
  const betterOpener = betterOpeners[scenarioKey] || 'Something specific and observational that gives her something real to respond to.';

  let part1;
  const herReply = sofiaFirstResponse ? ' She responded with "' + sofiaFirstResponse + '" — she kept it short because you gave her nothing specific to work with.' : '';
  const herReplyGood = sofiaFirstResponse ? ' She came back with "' + sofiaFirstResponse + '" — that is a real response, which means the door was open.' : '';
  if (nameOnly) {
    part1 = 'You showed up — that already puts you ahead of the guys who freeze. But your opener was just "' + openerLine + '". One word. She has nothing to respond to — you made her do all the work. Next time try something that opens a door: "' + betterOpener + '" That is specific, curious, and gives her something real to say. You have the nerve. Now give it some substance.';
  } else if (isGeneric) {
    part1 = 'First thing — you walked up and said something. That matters. But your opener was "' + openerLine + '". That could have come from anyone.' + herReply + ' A better opener: "' + betterOpener + '" Specific, observational, gives her something real to respond to. Build on the confidence you already showed.';
  } else {
    part1 = 'Good start — you opened with "' + openerLine + '". That showed genuine intent and gave her something to respond to.' + herReplyGood + ' The foundation was solid. The question is what you built on top of it.';
  }

  const isBeach = scenarioKey === 'beach';
  const girlName = isBeach ? 'Sofia' : 'her';

  const systemPrompt = `You are Ryan, a sharp dating coach doing a verbal debrief after a practice session.
You talk directly to the guy — second person, conversational, zero fluff.
You are honest but calibrated: your job is to make him better, not crush him.
Small mistakes get direct correction with the better version shown.
Big mistakes — approval-chasing, going completely generic, freezing — get called out harder because he needs to feel those to change them.
When something genuinely worked, acknowledge it cleanly before pushing for more. Never fake praise.
Your tone is like a good sports coach reviewing game film: calm, sharp, specific, forward-looking.

${isBeach ? `Sofia is 26, writes for an indie magazine, reads novels, allergic to generic openers and compliments. She rewards specificity and genuine curiosity. She is on the beach — not on a laptop, not at a desk.` : `The woman in this scenario rewards genuine curiosity and specificity. She pushes back on generic lines.`}

CRITICAL: Only reference things that actually appear in the transcript. Do not invent context, props, or details that are not in the conversation.

Walk him through the conversation in chronological order — like watching game film. Quote him, react, show the better version.

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "score": <number 1-10>,
  "spokenSummary": "<One punchy sentence for the card. Max 20 words. Reference something specific that actually happened.>",

  "part2": "<MIDDLE OF CONVERSATION. Minimum 70 words, maximum 90 words. Pick the most revealing exchange in the middle — quote what he said and what she said back verbatim. Explain what that moment showed about his approach: was he chasing approval, going generic, or did he show something real? If he did something right here, say so cleanly. Then point to what was missing or what he could have pushed further. No generic advice — stay in the transcript.>",

  "part3": "<THE KEY MISTAKE. Minimum 80 words. Find the single moment where he lost the most ground. Quote exactly what he said and exactly what she said back verbatim. Call out what went wrong — apologetic energy, over-explaining, listing status, whatever it was. Calibrate tone to the size of the mistake. Then give him the exact words he should have said instead. Do not truncate — fully develop the correction.>",

  "part4": "<CLOSE + VERDICT. Target 350-430 characters. Restate one genuine strength from this session. Deliver the score honestly in one sentence. Name the single fix that would change his results most. Then close with a motivational line that makes him want to go again RIGHT NOW — pick based on score: score 3-4 use something like 'Practice is the only way through. Hit Try Again — every rep makes you sharper.' Score 5-6 use something like 'You are closer than you think. One more round and you will feel the difference.' Score 7+ use something like 'You have got something real here. Go again and push it further — you will surprise yourself.' Or write your own variation that fits — warm, specific, genuinely encouraging, makes going again feel obvious. BANNED: 'go out there', 'dive deeper', 'aim to', 'work on that'. Never end flat.>",

  "openerBreakdown": "<Quote his exact first message verbatim. One sentence on why it worked or failed.>",
  "bestMoment": "<Quote the single best thing he said verbatim. One sentence on why it landed.>",
  "missedOpportunity": "<Quote the moment he lost the most ground — his line and her response. One sentence on what he should have done.>",
  "tryNextTime": "<One concrete line he can literally say next time. Actual words, not a concept.>",
  "wouldSheDateHim": "<'Yes', 'No', or 'Maybe' — then one sentence from ${girlName}'s perspective in first person, referencing something specific he said.>"
}

Scoring:
1-3: Froze, went fully generic, let it die with no recovery
4-5: Got through it but relied on compliments or status — no real curiosity shown
6-7: Some real moments but missed key escalation or stalled out
8-9: Specific, held frame, genuine energy, made her work a little
10: She is thinking about him on the drive home

RULES — non-negotiable:
- QUOTE actual lines verbatim. Do not paraphrase or invent.
- His OPENER is his very FIRST message in the transcript — not any later line.
- All four parts are spoken out loud — flowing natural speech, no bullet points, no headers.
- Every part must meet its minimum word count — do not truncate.
- Never say great job unless score is 8+.
- wouldSheDateHim is ${girlName} speaking in first person.
- tryNextTime is actual words he can say, not a mindset concept.
- Only reference details that appear in the transcript. Do not hallucinate props or context.
- The transcript labels HIM lines as HIM_2, HIM_3 etc. (HIM_1 was the opener — already handled separately above the transcript). Navigate chronologically from HIM_2 onward.
- Do not reference or quote HIM_1 — it is not in the transcript. Start analysis from HIM_2.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Scenario: ${scenarioTitle}\n\nNote: HIM_1 (the opener) was already handled separately. The transcript below starts from HIM_2 onward.\n\nFull conversation transcript:\n${transcript}` }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'OpenAI error: ' + err });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    const feedback = JSON.parse(raw);
    // Inject JS-generated part1 — guaranteed correct opener
    feedback.part1 = part1;
    res.json(feedback);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
