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

  let sofiaFirstResponse = null;
  let openerLine = (opener || '').trim();

  // Character name map for transcript labels
  const CHARACTER_NAME_MAP = {
    beach: 'SOFIA', bar: 'AVA', museum: 'ISABELLE',
    gym: 'ZOE', bookstore: 'NADIA', street: 'JULIA',
  };
  const characterLabel = CHARACTER_NAME_MAP[scenarioKey] || 'HER';

  // Build transcript
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

  if (!openerLine) {
    openerLine = conversation.find(m => m.role === 'user')?.content || '';
  }

  // Part1 — generated in JS, guaranteed correct opener
  const openerLower = openerLine.trim().toLowerCase();
  const openerWords = openerLine.trim().split(/\s+/);
  const nameOnly = openerWords.length <= 2 && /^(hi|hey|hello)/i.test(openerLower);
  const isGeneric = !nameOnly && (
    /^(hi|hey|hello)\b/i.test(openerLower) ||
    openerLower.includes('what is your name') ||
    openerLower.includes("what's your name") ||
    openerLower.includes('never saw you here') ||
    openerWords.length <= 5
  );

  // Non-sequitur detection — opener references things that don't exist in the scenario
  const nonSequiturTerms = {
    beach: ['boat', 'car', 'dog', 'coffee', 'drink'],
    bar: ['book', 'dog', 'boat'],
    museum: ['dog', 'boat', 'car'],
    gym: ['dog', 'boat', 'car'],
    bookstore: ['dog', 'boat', 'car'],
    street: ['dog', 'boat', 'car'],
  };
  const scenarioNonSequiturs = nonSequiturTerms[scenarioKey] || [];
  const isNonSequitur = scenarioNonSequiturs.some(term => openerLower.includes(term));

  // Scenario-specific better openers
  const betterOpeners = {
    beach:     'You look like you found the only quiet corner of this whole beach on purpose — is this your spot, or did you just get lucky?',
    bar:       'Everyone here is either on their phone or working too hard at being casual. You\'re the only one who actually looks like you\'re here.',
    museum:    'You\'ve been standing in front of that one longer than anyone else today — what is it doing to you?',
    gym:       'Shoulder press between sets — I was going to ask if the rack is free but honestly I\'m more curious what you\'re training for.',
    bookstore: 'You\'ve picked that up twice and put it back down. Either the first page is bad or you\'re deciding something.',
    street:    'I\'ve got about ten seconds before this gets awkward — I figured I\'d use them honestly.',
  };
  const betterOpener = betterOpeners[scenarioKey] || 'Something specific and real that gives her something to respond to.';

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const herReplyVariants = sofiaFirstResponse ? [
    ` She came back with "${sofiaFirstResponse}" — short, because you didn't give her much to work with.`,
    ` She said "${sofiaFirstResponse}" — polite, but she's waiting for something real.`,
    ` Her reply: "${sofiaFirstResponse}" — she kept it brief because nothing in your opener pulled her in.`,
  ] : [''];
  const herReplyGoodVariants = sofiaFirstResponse ? [
    ` She came back with "${sofiaFirstResponse}" — the door was open.`,
    ` She said "${sofiaFirstResponse}" — that's real engagement. You had something to build on.`,
    ` Her response: "${sofiaFirstResponse}" — green light. The question is what you did next.`,
  ] : [''];

  const herReply = pick(herReplyVariants);
  const herReplyGood = pick(herReplyGoodVariants);

  const nameOnlyVariants = [
    `You showed up — that already puts you ahead of the guys who freeze. But "${openerLine}" gives her nothing to grab onto. She can only say hi back, and now she's doing all the work. Try this instead: "${betterOpener}" One real observation beats ten safe openers. You have the guts. Now give it some words.`,
    `Walking up is the hard part and you did it. But "${openerLine}" is a dead end — she has nothing to react to. Give her something: "${betterOpener}" That's the difference between starting a conversation and just standing there.`,
    `You went for it — good. But "${openerLine}" puts all the pressure on her. She has to carry it from zero. Next time: "${betterOpener}" Specific, curious, real. One line like that changes everything.`,
  ];

  const genericVariants = [
    `You walked up and said something — that counts. But "${openerLine}" is the kind of thing anyone would say.${herReply} Try this instead: "${betterOpener}" — something she didn't see coming. The courage was there. Now build on it.`,
    `You showed up. That matters. But "${openerLine}" didn't stand out.${herReply} Something like "${betterOpener}" would have made her actually turn toward you. Keep the nerve, sharpen what you say.`,
    `You opened — good. But "${openerLine}" is something she's heard before.${herReply} The fix: "${betterOpener}" Something real beats something smooth every time. You've got the start. Work on what comes out of your mouth.`,
  ];

  const goodVariants = [
    `Good opener — "${openerLine}" felt real and gave her something to react to.${herReplyGood} The hard part was done. The question is what you did with it after.`,
    `Solid start. "${openerLine}" — that's specific enough that she knew you actually noticed her, not just that she exists.${herReplyGood} The door was open. Let's see what happened next.`,
    `You opened well — "${openerLine}" didn't sound like a line.${herReplyGood} That's the hardest part for most guys. What came after is what we need to look at.`,
  ];

  let part1;
  if (nameOnly) {
    part1 = pick(nameOnlyVariants);
  } else if (isNonSequitur || isGeneric) {
    part1 = pick(genericVariants);
  } else {
    part1 = pick(goodVariants);
  }

  // Hardcoded transitions between parts — prevents dead air and bans filler phrases at the source
  const transitions2 = [
    'Let me show you what happened in the middle.',
    'Here is what the middle of that conversation looked like.',
    'Now — the middle.',
    'Let me take you to the moment that told me the most.',
    'Here is where it gets interesting.',
  ];
  const transitions3 = [
    'The biggest mistake.',
    'One moment cost you the most.',
    'Here is the thing that hurt you.',
    'One moment. This is the one.',
    'Here is what I want to focus on.',
  ];
  const transitions4 = [
    'Alright — the verdict.',
    'Here is where you stand.',
    'Last thing.',
    'Here is my honest read.',
    'To wrap it up.',
  ];

  const transition2 = pick(transitions2);
  const transition3 = pick(transitions3);
  const transition4 = pick(transitions4);

  // Character profiles
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

  const systemPrompt = `You are Ryan, a dating coach doing a spoken debrief after a practice session.
You talk directly to the guy — second person, casual, no fluff.
You are honest but fair: your job is to make him better, not crush him.
Small mistakes get a quick fix with the better version shown.
Big mistakes — chasing approval, going completely flat, freezing — get called out harder because he needs to feel those to change.
When something worked, say it cleanly. Never fake praise.
Your tone is like a good friend who has seen a lot of these conversations and tells it straight.

VOICE — THIS IS CRITICAL:
Talk like a real person, not a coach with a certificate.
Use short sentences. Simple words. Say what you mean directly.
Bad: "Your approach lacked specificity in engaging her conversational threads."
Good: "She told you exactly what she cares about. You walked right past it."
Bad: "Focus on making direct connections with specific comments that invite her to share more."
Good: "Next time she gives you something real — grab it. Don't let it slide."
Never use the words: "engage", "connection", "specific" (say "real" or "particular" instead), "approach" (say "what you did" instead), "dynamic", "energy" (unless quoting someone), "showcase", "demonstrate", "utilize".
Use plain everyday words. If a 16-year-old wouldn't say it in conversation, don't write it.

WHO SHE IS — READ THIS CAREFULLY:
${charProfile.profile}

WHAT WORKS WITH HER:
${charProfile.whatWorks}

WHAT KILLS IT WITH HER:
${charProfile.whatKills}

MOMENTS GUYS USUALLY MISS WITH HER:
${charProfile.missedOpportunityExamples}

CRITICAL: Your feedback must be about THIS conversation. Reference what actually happened. Quote real lines. Show him the exact better version using what she actually said.

Go through the conversation in order — like watching it back on film. Quote him, quote her, react, show what he should have said.

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "score": <number 1-10>,
  "spokenSummary": "<One punchy sentence. Max 20 words. Reference something that actually happened in the session.>",

  "part2": "<MIDDLE OF CONVERSATION. Min 70 words, max 90 words. Pick the most telling exchange from the middle — quote exactly what he said and exactly what ${girlName} said back. Tell him what that moment showed. Was he trying too hard to impress her? Did he miss something she handed him? Connect it to who ${girlName} is — what was she waiting for? What did she open up and he walked past? Stay in the transcript. No general advice.>",

  "part3": "<THE KEY MISTAKE. Min 80 words. Find the single moment that cost him the most with ${girlName}. PRIORITY: (1) If he asked for coffee, a number, or to meet up before he earned it — that is ALWAYS the key mistake. Quote her exact response to it. Tell him what was missing. What needed to happen first before that ask would have landed? Give him the exact words he should have used instead. (2) If no premature close happened, find the biggest door she opened that he walked past. Quote both lines exactly. Tell him what went wrong and why it doesn't work with ${girlName} in particular. Then give him the exact words he should have said. Write it out fully — do not cut it short.>",

  "part4": "<CLOSE + VERDICT. Target 350-430 characters. Name one real thing he did well. DO NOT say the score number — it is shown separately on the card. Give one honest sentence about the overall effort. Name the one thing that would change his results most with ${girlName}. End with a motivational line that makes him want to go again right now. If session was weak: 'Practice is the only way through. Hit Try Again — every rep makes you sharper.' If session was decent: 'You are closer than you think. One more round and you will feel the difference.' If session was strong: 'You have got something real here. Go again and push it further — you will surprise yourself.' Or write your own that fits. BANNED WORDS IN PART4: 'go out there', 'dive deeper', 'aim to', 'work on that', 'dig into', 'push deeper', 'delve', 'delved', 'engage', 'dynamic', 'showcase', 'score is a', 'giving you a', 'I give you'. The motivational line MUST be the last sentence.>",

  "openerBreakdown": "<The opener was: '${openerLine}'. One sentence on why it worked or didn't with ${girlName}. Do not use HIM_1 label. No banned words.>",
  "bestMoment": "<Quote the single best thing he said verbatim. One sentence on why it landed with ${girlName}. No banned words.>",
  "missedOpportunity": "<Quote the moment he lost the most ground — his line and ${girlName}'s response. One sentence on what he should have done. No banned words — say 'gone deeper into' as 'asked more about', say 'delved' as 'got into'.>",
  "tryNextTime": "<One real line he can actually say next time in this scenario. Real words that would work with ${girlName}, not a concept. No banned words.>",
  "wouldSheDateHim": "<'Yes', 'No', or 'Maybe' — then one sentence from ${girlName}'s point of view in first person, about something specific he said or did. No banned words.>"
}

SCORING:
1-2: Barely spoke. Froze. Let it die.
3: Said almost nothing real the whole time — only compliments and approval-seeking the entire conversation
4: Tried but barely landed anything real. Mostly flat.
5-6: Had a real conversation — asked at least one real question, followed at least one thread she opened, showed some actual curiosity even if the close was weak
7-8: Stayed specific the whole way, held his ground when she pushed back, had clear moments where she was actually interested
9-10: She is still thinking about him after — he earned real interest, didn't just survive

SCORING RULES — FOLLOW THESE EXACTLY:
Default score for anyone who showed up and had a full conversation: 5.
Score goes DOWN from 5 only if he was mostly chasing approval OR said almost nothing real the entire time.
Score goes UP from 5 if he asked a real question, followed a thread she opened, held his ground, or said something that made her respond with more than one sentence.
A 3 means he said nothing real the ENTIRE conversation — only compliments and approval-seeking from start to finish. Reserve it for that only.
A 4 means he barely landed anything real. Use it sparingly — only if the whole conversation was mostly flat.
If he asked about her work, followed up on something she said, or had any real back and forth — that is a 5 minimum.
Most beginners who finish a full session land 5-6. That is right and honest.
NEVER give 3 or 4 just because he went for coffee too early or didn't nail the close. The close is one moment. Score the whole conversation.
Low scores kill motivation and they quit. A score that fits the effort keeps them coming back.

BANNED PHRASES AND WORDS — if any of these appear anywhere in your output, rewrite that sentence:
"Right, so here's where", "Now watch this moment", "Now here's the thing", "So — putting it all together",
"That could have come from anyone", "she kept it short because", "this is where the conversation shifted",
"this is the moment I want you to remember", "here's the bottom line", "Now watch this", "Here's where",
"let's talk about", "let's look at", "putting it all together", "the bottom line", "Here's where it",
"what we have here", "at the end of the day", "the fact of the matter",
"dig deeper", "dive deeper", "dive into", "delve", "delved", "seizing", "effectively", "engage", "dynamic", "showcase", "demonstrate",
"connection" (say "moment" or "something real" instead), "approach" (say "what you did" instead),
"generic" (say "flat" or "safe" or "by the book" instead), "specific" (say "real" or "particular" instead).
Read every sentence before you write it. If a banned phrase or word is in there — rewrite it.

RULES:
- Quote actual lines from the transcript. Do not make up lines.
- All four parts are spoken out loud — no bullet points, no headers, just natural speech.
- Every part must hit its minimum word count. Do not cut it short.
- Never say "great job" unless score is 8+.
- wouldSheDateHim is ${girlName} speaking in first person.
- tryNextTime is actual words for this specific scenario and character.
- Only use things that actually appear in the transcript. Do not invent context.
- ALL card fields must be filled. No empty strings, no null.
- Transcript labels HIM lines as HIM_2, HIM_3 etc. HIM_1 was the opener — already handled. Start from HIM_2.
- Do not quote or reference HIM_1.`;

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

    // Inject JS-generated part1 and hardcoded transitions — model never touches these
    feedback.part1 = part1;
    feedback.transition2 = transition2;
    feedback.transition3 = transition3;
    feedback.transition4 = transition4;

    // Enforce score floor — full conversation always gets minimum 5
    const turnCount = conversation.length;
    const rawScore = Number(feedback.score) || 4;
    const finalScore = (turnCount >= 4 && rawScore < 5) ? 5 : rawScore;
    console.log(`[coach] turns=${turnCount} rawScore=${rawScore} finalScore=${finalScore}`);
    feedback.score = finalScore;

    // Post-process — guaranteed banned phrase removal
    // Model keeps regenerating these regardless of prompt instructions
    // JS replace is the only 100% reliable fix
    const cleanText = (text) => {
      if (!text || typeof text !== 'string') return text;
      return text
        // Banned transition phrases
        .replace(/right,?\s*so here['']s where\b/gi, 'Here is where')
        .replace(/now watch this moment[^.!?]*/gi, 'One moment stands out.')
        .replace(/now here['']s the thing/gi, 'The thing is')
        .replace(/so\s*[—-]\s*putting it all together/gi, 'To wrap it up')
        .replace(/here['']s the bottom line/gi, 'The verdict')
        .replace(/this is where the conversation shifted/gi, 'The conversation changed here')
        .replace(/this is the moment I want you to remember/gi, 'This is the one to remember')
        .replace(/at the end of the day/gi, 'ultimately')
        .replace(/the fact of the matter/gi, 'the truth')
        // Banned vocabulary
        .replace(/\bdiv(?:e[sd]?|ing)\s+(?:deeper|into|in)\b/gi, 'get into')
        .replace(/\bdig(?:s|ging)?\s+deeper\b/gi, 'go further')
        .replace(/\bget(?:ting)?\s+deeper\s+into\b/gi, 'get more into')
        .replace(/\bgo(?:ing)?\s+deeper\b/gi, 'go further')
        .replace(/\bdelved?\b/gi, 'got into')
        .replace(/\bengage(?:d|s|ment)?\b/gi, 'connect')
        .replace(/\bdynamic\b/gi, 'situation')
        .replace(/\bshowcase(?:d|s)?\b/gi, 'show')
        .replace(/\bdemonstrate(?:d|s)?\b/gi, 'show')
        .replace(/\bseizing\b/gi, 'taking')
        .replace(/\bgeneric\b/gi, 'flat')
        .replace(/\btoo safe\b/gi, 'too cautious')
        // Score mentions in spoken parts
        .replace(/\bI['']m giving you a \d+\b/gi, '')
        .replace(/\byour score is a? \d+\b/gi, '')
        .replace(/\bI give you a \d+\b/gi, '')
        .replace(/\ba score of \d+\b/gi, '')
        // Clean up double spaces from removals
        .replace(/\s{2,}/g, ' ')
        .trim();
    };

    // Apply to all spoken fields
    feedback.part2 = cleanText(feedback.part2);
    feedback.part3 = cleanText(feedback.part3);
    feedback.part4 = cleanText(feedback.part4);
    feedback.spokenSummary = cleanText(feedback.spokenSummary);
    feedback.missedOpportunity = cleanText(feedback.missedOpportunity);
    feedback.bestMoment = cleanText(feedback.bestMoment);
    feedback.wouldSheDateHim = cleanText(feedback.wouldSheDateHim);

    res.json(feedback);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
