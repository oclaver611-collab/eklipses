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

  // Character name map for transcript labels
  const CHARACTER_NAME_MAP = {
    beach: 'SOFIA', bar: 'AVA', museum: 'ISABELLE',
    gym: 'ZOE', bookstore: 'NADIA', street: 'JULIA',
  };
  const characterLabel = CHARACTER_NAME_MAP[scenarioKey] || 'HER';

  // Build transcript — number HIM lines, capture character's first response for context
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
        return `${characterLabel}: ${text}`;
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
  
  // Scenario-specific better opener suggestions — calibrated to each character's personality
  const betterOpeners = {
    beach:     'You look like you found the only quiet corner of this whole beach on purpose — is this your spot, or did you just get lucky?',
    bar:       'Everyone here is either on their phone or working too hard at being casual. You\'re the only one who actually looks like you\'re here.',
    museum:    'You\'ve been standing in front of that one longer than anyone else today — what is it doing to you?',
    gym:       'Shoulder press between sets — I was going to ask if the rack is free but honestly I\'m more curious what you\'re training for.',
    bookstore: 'You\'ve picked that up twice and put it back down. Either the first page is bad or you\'re deciding something.',
    street:    'I\'ve got about ten seconds before this gets awkward — I figured I\'d use them honestly.',
  };
  const betterOpener = betterOpeners[scenarioKey] || 'Something specific and observational that gives her something real to respond to.';

  // Multiple variations to avoid identical phrasing every session
  const herReplyVariants = sofiaFirstResponse ? [
    ` She came back with "${sofiaFirstResponse}" — short answer, because the opener didn't give her much to work with.`,
    ` She responded with "${sofiaFirstResponse}" — she stayed brief because there was nothing specific to grab onto.`,
    ` Her reply: "${sofiaFirstResponse}" — polite, but she's waiting for something real.`,
  ] : [''];
  const herReplyGoodVariants = sofiaFirstResponse ? [
    ` She came back with "${sofiaFirstResponse}" — the door was open.`,
    ` She replied "${sofiaFirstResponse}" — real engagement, which means you had something to build on.`,
    ` Her response: "${sofiaFirstResponse}" — that's a green light. The question is what came next.`,
  ] : [''];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const herReply = pick(herReplyVariants);
  const herReplyGood = pick(herReplyGoodVariants);

  const nameOnlyVariants = [
    `You showed up — that already puts you ahead of the guys who freeze. But your opener was just "${openerLine}". One word. She has nothing to respond to — you made her do all the work. Try something that opens a door instead: "${betterOpener}" Specific, curious, gives her something real to say. You have the nerve. Now give it some substance.`,
    `Walking up takes guts. But "${openerLine}" leaves her with nothing — she has to carry the whole thing from zero. Next time give her something to react to: "${betterOpener}" That's the difference between a door and a wall.`,
    `You went for it — good. But "${openerLine}" is a dead end. She can only say hi back. Give her something to work with: "${betterOpener}" One specific observation beats ten generic openers every time.`,
  ];
  const genericVariants = [
    `You walked up and said something — that matters. But "${openerLine}" could have come from anyone in that room.${herReply} Compare that to: "${betterOpener}" — specific, observational, gives her something real to respond to. The nerve was there. Build on it.`,
    `Showing up is step one and you did it. The opener — "${openerLine}" — was the step that needed work.${herReply} Something like "${betterOpener}" would have given her an actual reason to turn toward you. Keep the confidence, sharpen the entry.`,
    `You opened. That counts. But "${openerLine}" is generic — she's heard a version of that before.${herReply} The fix: "${betterOpener}" Specific beats smooth every time with her. You've got the foundation. Work on what you build on top of it.`,
  ];
  const goodVariants = [
    `Solid opener — "${openerLine}" showed genuine intent and gave her something to react to.${herReplyGood} The start was real. The question is whether you kept that energy through the middle.`,
    `Good start. "${openerLine}" — that's specific enough to feel like you actually noticed her.${herReplyGood} The foundation was there. Let's talk about what you built on top of it.`,
    `You opened well — "${openerLine}" is the kind of thing that doesn't sound rehearsed.${herReplyGood} That's the hardest part for most guys. Now let's look at what came after.`,
  ];

  let part1;
  if (nameOnly) {
    part1 = pick(nameOnlyVariants);
  } else if (isGeneric) {
    part1 = pick(genericVariants);
  } else {
    part1 = pick(goodVariants);
  }

  // Character profiles — who she is, what she responds to, what kills it
  const CHARACTER_PROFILES = {
    beach: {
      name: 'Sofia',
      profile: `Sofia is 26. She writes for an indie magazine — coastal ecology. She has been here two hours, the article isn't going well, she's in a low-grade frustrated mood she's not showing. She is allergic to generic openers and compliments. She rewards specificity, genuine curiosity, and someone who notices real things. She observes HIM — she calls out his moves directly. She gives short answers to generic questions and longer ones when something earns it. Her wit is dry and precise. She does not perform warmth.`,
      whatWorks: `Being specific about something real. Noticing something she said and going deeper. Disagreeing with her slightly. Asking about the article with genuine curiosity. Saying something unexpected that doesn't fit the script.`,
      whatKills: `Generic compliments. "You're beautiful." Asking for her number too early. Stacking questions. Approval-seeking energy. Telling her she seems interesting without showing why you think so.`,
      missedOpportunityExamples: `If she mentioned her article and he didn't follow up — that was a free door. If she said something dry and he responded generically — he missed the wit invitation. If she went quiet and he panicked and asked another question — wrong move.`,
    },
    bar: {
      name: 'Ava',
      profile: `Ava is 27, brand strategy. She's been at the bar twenty minutes, turned down two generic guys already. She is waiting to be surprised, not impressed. She has a filter and she uses it fast. She names what he's doing — calls the play directly. Generic opener gets flat energy and one more shot. Something real or funny and she actually turns toward him.`,
      whatWorks: `Something specific and observational. Not trying to be smooth. Being direct about what you want without packaging it. Saying something that she didn't predict. Self-awareness — acknowledging the awkwardness of a bar approach instead of pretending it's natural.`,
      whatKills: `"You're beautiful / stunning / gorgeous." Offering to buy a drink as an opener. Asking where she's from. Stacking questions. Over-explaining yourself. Approval-seeking. Going quiet when she pushes back.`,
      missedOpportunityExamples: `If she called out his move and he got defensive — he should have agreed with her. If she said something dry and he laughed it off instead of building on it — missed. If she went quiet and he tried to restart with another opener — wrong read.`,
    },
    museum: {
      name: 'Isabelle',
      profile: `Isabelle is 29, art history lecturer. She came alone — this is her thinking time. She is mid-thought about a painting she doesn't fully understand yet. Small talk feels like sand in the gears. She rewards: genuine engagement with the art, disagreeing with her interpretation, admitting you don't know something, asking a specific question about what she just said. She observes HIM — she notices when someone is asking surface questions as a strategy.`,
      whatWorks: `Engaging with the actual painting — not "what's your favorite" but "what does that specific thing do to you." Disagreeing slightly with something she said. Admitting uncertainty: "I don't know what I'm looking at but I can't stop looking." Following a thread she opened instead of changing the subject.`,
      whatKills: `"You seem really deep / intellectual." Generic art questions. Complimenting her thinking instead of engaging with it. Jumping to asking to meet before the conversation has earned it. Offering your number or asking for hers before she's curious about you.`,
      missedOpportunityExamples: `If she said "the emptiness carries as much weight as the objects" and he didn't engage with that specific idea — missed. If she asked him what he thinks of the painting and he deflected — missed. If she went quiet after a generic comment — she was waiting for something better.`,
    },
    gym: {
      name: 'Zoe',
      profile: `Zoe is 25, personal trainer. Between sets, shoulder press — her weak point. One earbud out. She has zero patience for smooth talk or flattery. She calls BS instantly — not aggressively, just reflexively. She opens up when someone is direct, honest, or says something real without packaging it. She is emotionally honest to the point it startles people. She will tell him exactly what she thinks.`,
      whatWorks: `Being direct about why you came over — without the packaging. Engaging with what she's actually doing. Admitting something real about yourself. Asking a specific question about training with actual knowledge behind it. Not flinching when she pushes back.`,
      whatKills: `"You're so dedicated / impressive." Complimenting her body. Asking if she's a model. Trying to be smooth. Negotiating for her number. Saying you're an open book — that's a tell. Going generic after she calls something out.`,
      missedOpportunityExamples: `If she said "shoulder press, my weak point" and he didn't use that — free door, missed. If she pushed back and he apologized instead of holding — lost the frame. If she said "you haven't said anything real yet" and he tried another angle instead of being honest — wrong move.`,
    },
    bookstore: {
      name: 'Nadia',
      profile: `Nadia is 27, freelance copywriter. She's been standing in the same aisle for twenty minutes — rainy Saturday, slightly inward. She reads everything, has strong opinions about sentences, finds bad writing physically uncomfortable. She rewards wordplay, genuine curiosity, self-deprecating humor. She notices when someone picks up a book near her just to have a reason to talk. She has the "psychology books" read on men immediately.`,
      whatWorks: `Saying something about the book she's holding — specifically. Wordplay or a line that's precise and slightly unexpected. Admitting something real without packaging it. Asking about what she writes with actual follow-up. Being comfortable with slow pace — not rushing to close.`,
      whatKills: `Generic "do you come here often." Complimenting her immediately. Asking for her number before the conversation has earned it. Stacking questions. Going for the close when the conversation hasn't had a real moment yet. Trying to be impressive instead of interesting.`,
      missedOpportunityExamples: `If she said something about the book and he asked a generic follow-up — missed the thread. If she made a dry observation and he agreed pleasantly instead of building on it — missed. If she used wordplay and he responded literally — wrong register entirely.`,
    },
    street: {
      name: 'Julia',
      profile: `Julia is 28, photographer — street and portrait work. She notices everything. She is heading somewhere and he stopped her. She's decided in the first thirty seconds whether this is worth thirty more. She has two layers running: surface conversation and the real one underneath. She calls out rehearsed lines immediately. She warms when someone says something she didn't predict, or admits something real without trying to look good doing it.`,
      whatWorks: `Being honest about why you stopped her — without the smooth packaging. Saying something observational that shows you actually noticed her, not just that she exists. Holding the subtext layer — responding to what she's implying, not just what she said. Not filling every silence.`,
      whatKills: `"I just had to say something." Complimenting her immediately. Over-explaining why you stopped her. Asking generic questions. Trying to extend the conversation with filler. Negotiating for her time instead of earning it.`,
      missedOpportunityExamples: `If she said something with subtext and he responded to the surface — he's not playing the right game. If she held a beat of silence and he rushed to fill it — wrong. If she made an observation about him and he deflected instead of engaging — missed.`,
    },
  };

  const charProfile = CHARACTER_PROFILES[scenarioKey] || CHARACTER_PROFILES['beach'];
  const girlName = charProfile.name;

  const systemPrompt = `You are Ryan, a sharp dating coach doing a verbal debrief after a practice session.
You talk directly to the guy — second person, conversational, zero fluff.
You are honest but calibrated: your job is to make him better, not crush him.
Small mistakes get direct correction with the better version shown.
Big mistakes — approval-chasing, going completely generic, freezing — get called out harder because he needs to feel those to change them.
When something genuinely worked, acknowledge it cleanly before pushing for more. Never fake praise.
Your tone is like a good sports coach reviewing game film: calm, sharp, specific, forward-looking.

WHO SHE IS — READ THIS CAREFULLY:
${charProfile.profile}

WHAT WORKS WITH HER SPECIFICALLY:
${charProfile.whatWorks}

WHAT KILLS IT WITH HER SPECIFICALLY:
${charProfile.whatKills}

MISSED OPPORTUNITY PATTERNS FOR THIS SCENARIO:
${charProfile.missedOpportunityExamples}

CRITICAL: Your feedback must be scenario-specific. Generic dating advice ("be more confident", "show genuine curiosity") is useless here. Reference the actual transcript. Quote actual lines. Show him the exact better version using what she said and who she is.

Walk him through the conversation in chronological order — like watching game film. Quote him, quote her, react, show the better version in her specific context.

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "score": <number 1-10>,
  "spokenSummary": "<One punchy sentence for the card. Max 20 words. Reference something specific that actually happened.>",

  "part2": "<MIDDLE OF CONVERSATION. Minimum 70 words, maximum 90 words. Pick the most revealing exchange in the middle — quote what he said and what ${girlName} said back verbatim. Explain what that moment showed about his approach: was he chasing approval, going generic, or did he show something real? Connect your analysis to who ${girlName} specifically is — what was she waiting for that he didn't give her? What door did she open that he walked past? Stay in the transcript. No generic advice.>",

  "part3": "<THE KEY MISTAKE. Minimum 80 words. Find the single moment where he lost the most ground with ${girlName} specifically. Quote exactly what he said and exactly what she said back verbatim. Call out what went wrong and WHY it doesn't work with her in particular — not just generally. Then give him the exact words he should have said instead, calibrated to ${girlName}'s personality. Do not truncate — fully develop the correction.>",

  "part4": "<CLOSE + VERDICT. Target 350-430 characters. Restate one genuine strength from this session. Deliver the score honestly in one sentence. Name the single fix that would change his results most with ${girlName} specifically. Then close with a motivational line that makes him want to go again RIGHT NOW — pick based on score: score 3-4: 'Practice is the only way through. Hit Try Again — every rep makes you sharper.' Score 5-6: 'You are closer than you think. One more round and you will feel the difference.' Score 7+: 'You have got something real here. Go again and push it further — you will surprise yourself.' Or write your own variation that fits. BANNED PHRASES: 'go out there', 'dive deeper', 'aim to', 'work on that', 'dig into', 'push deeper', 'delve'. The motivational close MUST be the LAST sentence of part4.>",

  "openerBreakdown": "<Quote his exact first message verbatim. One sentence on why it worked or failed specifically with ${girlName}.>",
  "bestMoment": "<Quote the single best thing he said verbatim. One sentence on why it landed with ${girlName}.>",
  "missedOpportunity": "<Quote the moment he lost the most ground — his line and ${girlName}'s response. One sentence on what he should have done specifically.>",
  "tryNextTime": "<One concrete line he can literally say next time in this scenario. Actual words that would work with ${girlName}, not a mindset concept.>",
  "wouldSheDateHim": "<'Yes', 'No', or 'Maybe' — then one sentence from ${girlName}'s perspective in first person, referencing something specific he said or did.>"
}

Scoring — be honest but generous with effort:
1-2: Froze completely, barely spoke, let it die with zero recovery
3: Almost entirely generic — only compliments and approval-seeking, circled the point without ever saying anything real, she had to ask him to be direct four times and he never was
4: Mostly generic with one small genuine moment — still mostly approval-seeking, didn't follow any door she opened
5-6: Had a real conversation — asked at least one genuine question, followed at least one thread she opened, showed some actual curiosity even if the close was weak
7-8: Specific throughout, held frame when she pushed back, made her work a little, clear moments of connection
9-10: She is thinking about him after — earned real interest, not just survived the conversation

CALIBRATION — THIS IS THE MOST IMPORTANT SECTION:
Default score for someone who showed up and had a full conversation: 5.
The score goes DOWN from 5 if he was mostly generic or approval-seeking.
The score goes UP from 5 if he said something specific, followed a thread, held frame, or made her laugh.
A 3 is a failing grade — reserve it for conversations where he genuinely said nothing real the entire time.
A 4 means he tried but barely landed anything. Use it sparingly.
Most beginners who complete a full session land between 5-6. That is correct and honest.
Never default to 3-4 just because he didn't nail the close. Scoring too low kills motivation and they leave.
A score that's slightly generous but accurate to effort keeps them coming back — that's the goal.

LANGUAGE VARIABILITY — MANDATORY:
Never use the same transition phrases twice across part1, part2, part3, part4.
Do NOT use: "Right, so here's where", "Now watch this moment", "Now here's the thing", "So — putting it all together", "That could have come from anyone", "she kept it short because".
Every debrief must sound fresh. Vary your openers, transitions, and closes. You are a coach, not a script.

RULES — non-negotiable:
- QUOTE actual lines verbatim. Do not paraphrase or invent.
- All four parts are spoken out loud — flowing natural speech, no bullet points, no headers.
- Every part must meet its minimum word count — do not truncate.
- Never say great job unless score is 8+.
- wouldSheDateHim is ${girlName} speaking in first person.
- tryNextTime is actual words calibrated to this specific scenario and character.
- Only reference details that appear in the transcript. Do not hallucinate props or context.
- ALL FIVE card fields MUST be populated. Never return empty strings or null.
- The transcript labels HIM lines as HIM_2, HIM_3 etc. (HIM_1 was the opener — already handled separately). Navigate chronologically from HIM_2 onward.
- Do not reference or quote HIM_1 — start analysis from HIM_2.`;

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
