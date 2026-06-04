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

  // Character name map for transcript labels
  const CHARACTER_NAME_MAP = {
    beach: 'SOFIA', bar: 'AVA', museum: 'ISABELLE',
    gym: 'ZOE', bookstore: 'NADIA', street: 'JULIA',
    rooftop: 'SANNA', house_party: 'SARAH', coffee_shop: 'ANNA',
    art_gallery: 'LEILA', yoga_studio: 'FATOU', airport: 'ELENA',
    supermarket: 'EDEN', office_lobby: 'MAYA', train: 'ERIKA',
  };
  const characterLabel = CHARACTER_NAME_MAP[scenarioKey] || 'HER';

  // Build transcript
  let himCount = 0;
  const transcript = conversation
    .map(m => {
      if (m.role === 'user') {
        himCount++;
        return `HIM_${himCount}: ${m.content.trim()}`;
      } else {
        return `${characterLabel}: ${m.content.trim()}`;
      }
    })
    .join('\n');

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

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
    rooftop: {
      name: 'Sanna',
      profile: `Sanna is 27, works in events. She wasn't sure about coming tonight but the city view won her over. She's in a rare open mood — the kind where she'll actually talk to a stranger. She responds to people who notice the real things, not the obvious ones. She has a quiet warmth but she doesn't hand it out for free.`,
      whatWorks: `Noticing something specific about the moment — not the view in general but something particular. Asking a real question that shows curiosity about her, not just her situation. Being present — not performing.`,
      whatKills: `Generic compliments about the view or her looks. Trying to be impressive. Moving too fast. Filling silences with noise instead of letting them breathe.`,
      missedOpportunityExamples: `If she said she wasn't sure about coming and he didn't ask why — free door missed. If she pointed something out about the city and he agreed generically instead of building on it — wrong. If she went quiet and he rushed to restart instead of holding the moment.`,
    },
    house_party: {
      name: 'Sarah',
      profile: `Sarah is 25. She stepped outside because it's a good party but she doesn't know many people there — slight social overload, looking for one real conversation to make the night worth it. She is warm but she's been approached by enough guys at parties to know the difference between someone trying a move and someone actually talking to her.`,
      whatWorks: `Being honest about your own party experience — not pretending you're more comfortable than you are. Asking something real about her night. Finding the shared absurdity of the situation.`,
      whatKills: `Smooth opener that sounds like a line. Complimenting her immediately. Trying to be charming rather than real. Moving to the number ask before the conversation has had a real moment.`,
      missedOpportunityExamples: `If she said she doesn't know many people and he didn't follow that thread — missed the opening. If she said something self-deprecating and he reassured her instead of playing along — wrong register. If she went quiet and he tried a new angle instead of sitting with the moment.`,
    },
    coffee_shop: {
      name: 'Anna',
      profile: `Anna is 26. She's been waiting so long she's started to make peace with going home. She has dry humor about her own situation. She is calm, slightly inward, and rewards someone who matches her dry register. She doesn't need to be cheered up — she needs someone to appreciate the absurdity of the wait with her.`,
      whatWorks: `Matching her dry tone. Finding the shared absurdity instead of trying to fix it. Not being too energetic. Saying something unexpected and precise.`,
      whatKills: `Trying to be upbeat or reassuring. Generic sympathy. Moving too fast. Asking obvious questions about what she's waiting for.`,
      missedOpportunityExamples: `If she made a dry joke and he responded sincerely — wrong register. If she said something about the universe telling her to leave and he didn't run with it — missed. If she went quiet and he filled it with a question instead of letting it sit.`,
    },
    art_gallery: {
      name: 'Leila',
      profile: `Leila is 28, curator. She's been standing in front of one piece for a while — genuinely trying to understand something she can't quite name. She is patient, precise, and completely uninterested in small talk about art. She rewards people who engage with what's actually in front of them, not what they think they should say about it.`,
      whatWorks: `Saying something honest about what the piece does to you — even if you don't understand it. Disagreeing slightly with something she says. Admitting uncertainty. Following a thread she opens instead of changing the subject.`,
      whatKills: `"Do you come here often." Complimenting her taste. Asking what her favorite piece is. Trying to sound knowledgeable when you're not. Moving to a close before the conversation has earned it.`,
      missedOpportunityExamples: `If she said there's something she can't explain about the piece and he asked a surface question instead of sitting with that — missed. If she offered an interpretation and he agreed instead of pushing back slightly — wrong. If she went quiet looking at the work and he interrupted it.`,
    },
    yoga_studio: {
      name: 'Fatou',
      profile: `Fatou is 29, yoga instructor. Hip flexors have been going all week — occupational reality she's honest about. She teaches all day and sometimes forgets to practice what she teaches. She is warm, direct, and has a low tolerance for performance. She responds to people who are real about their own limitations and curious about hers.`,
      whatWorks: `Asking about the teaching versus practicing gap — she'll have a real answer. Being honest about your own body or training. Not trying to impress her with fitness knowledge. Asking a follow-up question that shows you actually listened.`,
      whatKills: `Complimenting her body or flexibility. Trying to sound like you know about yoga when you don't. Moving too fast. Generic wellness talk.`,
      missedOpportunityExamples: `If she mentioned the body not caring how many classes you teach and he didn't dig into that — missed. If she said something about her students and he asked a surface question — wrong. If she went quiet and he tried a new topic instead of staying with what she'd said.`,
    },
    airport: {
      name: 'Elena',
      profile: `Elena is 30. Two hours delayed. She has moved through frustration and acceptance and is now in bargaining with the departure board. She has a dry, precise sense of humor about the situation. She is not looking to be cheered up — she's looking for someone who appreciates the specific absurdity of airports the way she does.`,
      whatWorks: `Finding the shared absurdity without overdoing it. Being precise — not "delays are the worst" but something specific and real. Asking a genuine question. Matching her dry register.`,
      whatKills: `Trying to cheer her up. Generic delay sympathy. Being too energetic. Moving to a close before you've earned any real time.`,
      missedOpportunityExamples: `If she named her stage of grief about the delay and he didn't run with the bit — missed. If she said something dry and he responded sincerely — wrong register. If she went quiet watching the board and he interrupted it.`,
    },
    supermarket: {
      name: 'Eden',
      profile: `Eden is 26, reads people for a living — UX research. She came in with a list and the mangoes derailed it. She has warmth and she gives real feedback fast — she'll tell him directly if something isn't working. She responds to honesty, observational humor, and someone who doesn't try too hard. She will know immediately if he's performing.`,
      whatWorks: `Being honest and warm. Finding something real in the shared mundane situation. Not trying to be impressive. Following what she says instead of redirecting to yourself.`,
      whatKills: `Performing confidence. Being too smooth. Generic openers. Asking where she's from. Moving to the number ask before anything real has happened between them.`,
      missedOpportunityExamples: `If she said she abandoned her list and he didn't play along — missed the warmth. If she gave him direct feedback and he got defensive — wrong. If she made an observation about her own situation and he turned it back to himself.`,
    },
    office_lobby: {
      name: 'Maya',
      profile: `Maya is 28, floor twelve. She's seen him in the lobby before. She was being professional — but now the elevator is broken and she has three minutes. She responds to wit, directness, and someone who acknowledges the awkward reality of the situation instead of pretending it's a normal meet. She will close the door fast on anyone trying to be impressive.`,
      whatWorks: `Acknowledging the months of professional not-talking directly. Being honest about the situation. Wit over smoothness. Asking something real. Not trying to pack too much into the three minutes.`,
      whatKills: `Trying to impress her. Complimenting her. Being too eager. Not acknowledging the obvious awkwardness. Moving to a number ask before she's curious about you.`,
      missedOpportunityExamples: `If she said "for the record I was being professional" and he didn't build on that — missed the wit invitation. If she asked him a direct question and he deflected — wrong. If she held a silence and he rushed to fill it.`,
    },
    train: {
      name: 'Erika',
      profile: `Erika is 27. She bonds over shared absurdity — the world is full of it and she finds it genuinely funny. She's been counting how many times the person at the end of the car has played the same song. She is warm and quick and she will match your energy and raise it if you give her something real. She loses interest fast if someone goes flat or generic.`,
      whatWorks: `Noticing the same specific thing she noticed. Running with the bit instead of explaining it. Matching her energy. Asking a real question that goes somewhere unexpected.`,
      whatKills: `Explaining the joke. Being too earnest. Generic small talk. Not following a thread she opens. Going flat after a good opener.`,
      missedOpportunityExamples: `If she said "both" about something being funny and sad and he didn't sit with that — missed. If she made an observation and he agreed instead of adding to it — wrong. If she ran with a bit and he went literal — completely wrong register.`,
    },
  };

  const charProfile = CHARACTER_PROFILES[scenarioKey] || CHARACTER_PROFILES['beach'];
  if (!CHARACTER_PROFILES[scenarioKey]) {
    console.warn(`[coach] Unknown scenarioKey: "${scenarioKey}" — falling back to beach profile`);
  }
  const girlName = charProfile.name;

  const systemPrompt = `You are Ryan, a dating coach doing a spoken debrief after a practice session.
You talk directly to the guy — second person, casual, no fluff.
You are honest but fair: your job is to make him better, not protect his feelings.
When something worked, say it cleanly and say why. When something didn't, call it out and show him the better version.
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

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "score": <number 1-10>,
  "spokenSummary": "<One punchy sentence. Max 20 words. MUST quote or directly reference a specific line from the transcript — his words or her words. No general statements about confidence or effort.>",

  "part1": "<Ryan's GENUINE opening reaction to this conversation. 60-80 words. Quote his actual first line verbatim — it is explicitly labeled HIM_1 in the transcript AND provided separately above as HIS OPENING LINE. You MUST reference HIM_1, not any other exchange., then react honestly and directly. Was it good? Say so and say exactly why it worked with ${girlName}. Was it bad? Say so and say what it cost him in THIS conversation. Do NOT start with 'Alright', 'Okay', or 'So'. Start with something real and specific about what happened. No generic opener coaching — this is a direct reaction to THIS conversation.>",

  "part2": "<THE MIDDLE. 90-120 words. Pick the TWO most revealing exchanges from the middle of the conversation. For each one, quote his EXACT words and ${girlName}'s EXACT words verbatim from the transcript. Tell him what each exchange reveals about his instincts — was he chasing approval, missing a thread she handed him, or actually reading her? Be specific about what she was signaling and what he failed to catch. Connect directly to who ${girlName} is.>",

  "part3": "<THE KEY MISTAKES. 100-130 words. The TWO moments that cost him the most. For each: quote both his line and her response exactly from the transcript. Write the EXACT alternative line he should have said — not advice, actual words. Format each as: 'Instead of [his exact line], say: [exact replacement] — because [one sentence why it works with ${girlName} specifically].' Be surgical.>",

  "part4": "<THE TAKEAWAY. 80-100 words. Name TWO concrete patterns from this conversation to fix — be precise, not generic. Give him a mental model he can carry into the next session. Quote something specific from the transcript for each pattern. End with ONE motivational line referencing something SPECIFIC from this session. BANNED ENDINGS: 'Practice is the only way through', 'every rep makes you sharper', 'you are closer than you think', 'one more round', 'you will feel the difference', 'you have got something real here', 'push it further', 'you will surprise yourself', 'keep at it', 'practice makes perfect', 'keep pushing'. BANNED WORDS: 'go out there', 'dive deeper', 'aim to', 'work on that', 'dig into', 'push deeper', 'delve', 'delved', 'engage', 'dynamic', 'showcase', 'score is a', 'giving you a', 'I give you'.>",

  "openerBreakdown": "<One sentence on why his opening line (HIM_1 in the transcript) worked or didn't with ${girlName}. Quote it. No banned words.>",
  "bestMoment": "<Quote the single best thing he said verbatim. One sentence on why it landed with ${girlName}. No banned words.>",
  "missedOpportunity": "<Quote the moment he lost the most ground — his exact line and ${girlName}'s exact response. One sentence on what he should have done instead. No banned words.>",
  "tryNextTime": "<THREE specific lines the user should try in a FUTURE conversation — not quotes of what he already said, but better alternatives tailored to this character and scenario. Each line should feel natural and be something he could actually say next time he's in this situation. Number them 1, 2, 3. Format: '1. [line] 2. [line] 3. [line]' Each line must be specific to ${girlName}'s personality and the scenario — not generic advice that could apply anywhere. Never use 'Tell me more about that' or any generic curiosity prompt. AUTOMATIC FAIL if any of these phrases appear: 'Say something real', 'Ask about the specific', 'Reference what actually happened', 'Tell me more about that'.>",
  "wouldSheDateHim": "<'Yes', 'No', or 'Maybe' — then one sentence from ${girlName}'s point of view in first person, about something specific he said or did. No banned words.>"
}

MANDATORY: All four parts (part1, part2, part3, part4) must always be present. Never return fewer than 4 parts regardless of conversation length.

SCORING — 1-10 based on these qualities:
- Quality of questions (does he ask things that invite real answers, or dead-ends?)
- Emotional intelligence (does he read her responses and adjust, or barrel ahead?)
- Confidence (does he hold his ground when she pushes back, or fold and apologize?)
- Genuine interest (does he follow what she says, or redirect to himself?)
- Humor (does anything land, or is it forced/absent?)
- Avoiding validation-seeking (does he fish for approval, or just say what he means?)
- Creating tension/intrigue (does she want to know more about him, or is he an open book?)

SCORE TIERS — CALIBRATE TO THESE:
1-3 (Bad): He was generic, approval-seeking, or said almost nothing real. A 1: barely spoke or was offensive. A 2: every message was a compliment or fishing for validation, no real questions asked. A 3: asked surface questions but showed zero genuine curiosity about her answers, no content of his own, no moment where he actually engaged with what she said.
4-5 (Average): He showed up and had a real exchange. He asked at least one genuine question AND followed her thread at least once. Some things landed, some didn't. He wasn't chasing approval the whole time but wasn't memorable either. A 4: curious but clunky, missed most threads. A 5: showed real interest, had one good moment, but no tension created and no real pull.
6-7 (Good): He asked real questions and followed her threads. He said something that made her respond with more than one sentence. He held his ground at least once. Something he said was real and showed he actually noticed her.
8-10 (Excellent): She is still thinking about him. He created genuine pull — said things she didn't predict, held tension without filling every silence, made her work slightly for his approval instead of the other way around. A 10 means she'd cancel plans.

Score honestly. Do NOT apply a score floor. If someone was bad, they get a 2. If average, a 5.

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
- All parts are spoken out loud — no bullet points, no headers, just natural speech.
- Every part must hit its minimum word count. Do not cut it short.
- Never say "great job" unless score is 8+.
- wouldSheDateHim is ${girlName} speaking in first person.
- tryNextTime is actual words for this specific conversation, not general advice.
- Only use things that actually appear in the transcript. Do not invent context.
- ALL card fields must be filled. No empty strings, no null.`;

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
          { role: 'user', content: `Scenario: ${scenarioTitle}\n\nHIS OPENING LINE (HIM_1): "${conversation.find(m => m.role === 'user')?.content?.trim() || ''}"\n\nFull conversation transcript:\n${transcript}` }
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
    let feedback;
    try {
      feedback = JSON.parse(raw);
    } catch(parseErr) {
      // Model returned malformed JSON — retry once with stricter instruction
      console.warn('[coach] JSON parse failed, retrying with stricter prompt...');
      const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            { role: 'user', content: `Scenario: ${scenarioTitle}\n\nHIS OPENING LINE (HIM_1): "${conversation.find(m => m.role === 'user')?.content?.trim() || ''}"\n\nFull conversation transcript:\n${transcript}\n\nCRITICAL: Return ONLY valid JSON. No markdown, no backticks, no preamble. Start with { and end with }.` }
          ],
          response_format: { type: 'json_object' }
        }),
      });
      const retryData = await retryResponse.json();
      const retryRaw = retryData.choices?.[0]?.message?.content;
      feedback = JSON.parse(retryRaw);
    }

    // Guard: if card fields came back undefined/null, fill with fallbacks
    const cardFields = ['part1', 'part2', 'part3', 'part4', 'openerBreakdown', 'bestMoment', 'missedOpportunity', 'tryNextTime', 'wouldSheDateHim', 'spokenSummary'];
    for (const field of cardFields) {
      if (!feedback[field] || feedback[field] === 'undefined' || feedback[field].length < 5) {
        console.warn(`[coach] Field "${field}" missing — filling fallback`);
        if (field === 'wouldSheDateHim') feedback[field] = 'Maybe. You had some real moments but needed to go further into what she opened.';
        else if (field === 'tryNextTime') feedback[field] = '1. Say something real about what she mentioned. 2. Ask about the specific thing she brought up. 3. Reference what actually happened in the conversation.';
        else if (field === 'spokenSummary') feedback[field] = 'You showed up and had a real conversation — now make it sharper.';
        else if (field === 'part1') feedback[field] = 'You showed up. That is the first step. Now let\'s look at what happened.';
        else feedback[field] = 'See the feedback above.';
      }
    }

    // Quality check — tryNextTime must contain transcript-specific content
    const GENERIC_TNT = [
      'say something real about',
      'ask about the specific thing',
      'reference what actually happened',
      'tell me more about that',
    ];
    const tntGeneric = !feedback.tryNextTime ||
      GENERIC_TNT.some(p => feedback.tryNextTime.toLowerCase().includes(p));

    if (tntGeneric) {
      console.warn('[coach] tryNextTime is generic — retrying for just that field');
      try {
        const tntRetry = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 200,
            messages: [
              { role: 'system', content: `You are Ryan, a dating coach. Return ONLY valid JSON: {"tryNextTime":"..."}\n\ntryNextTime must be THREE lines the user should try in a FUTURE conversation — not quotes of what he already said, but better alternatives tailored to this character and scenario. Number them 1, 2, 3. Each line must be specific to the character's personality and scenario — not generic advice. BANNED: "Say something real", "Ask about the specific", "Reference what actually happened", "Tell me more about that".` },
              { role: 'user', content: `Scenario: ${scenarioTitle}\n\nTranscript:\n${transcript}` },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        if (!tntRetry.ok) {
          const errBody = await tntRetry.text();
          console.error('[coach] tryNextTime retry non-OK:', tntRetry.status, errBody);
          feedback.tryNextTime = '';
        } else {
          const tntData = await tntRetry.json();
          const tntParsed = JSON.parse(tntData.choices?.[0]?.message?.content);
          const stillGeneric = !tntParsed.tryNextTime ||
            GENERIC_TNT.some(p => tntParsed.tryNextTime.toLowerCase().includes(p));
          feedback.tryNextTime = stillGeneric ? '' : tntParsed.tryNextTime;
          if (stillGeneric) console.warn('[coach] tryNextTime retry still generic — leaving blank');
        }
      } catch (tntErr) {
        console.warn('[coach] tryNextTime retry failed:', tntErr.message);
        feedback.tryNextTime = '';
      }
    }

    // Quote check — reject tryNextTime if any line is a direct user quote (>15 chars)
    if (feedback.tryNextTime) {
      const himTexts = conversation
        .filter(m => m.role === 'user')
        .map(m => m.content.trim().toLowerCase());
      const tntLines = feedback.tryNextTime.toLowerCase().split(/\d+\.\s+/).filter(Boolean);
      const isDirectQuote = himTexts.some(himText =>
        tntLines.some(line => {
          for (let i = 0; i <= himText.length - 25; i++) {
            if (line.includes(himText.slice(i, i + 25))) return true;
          }
          return false;
        })
      );
      if (isDirectQuote) {
        console.warn('[coach] tryNextTime contains direct user quote — rejecting');
        feedback.tryNextTime = '';
      }
    }

    // Inject hardcoded transitions — model generates part1 itself
    feedback.transition2 = transition2;
    feedback.transition3 = transition3;
    feedback.transition4 = transition4;

    // Clamp score to valid range — no floor, honest scoring
    feedback.score = Math.min(10, Math.max(1, Math.round(Number(feedback.score) || 5)));
    console.log(`[coach] score=${feedback.score}`);

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
        .replace(/\bdig(?:s|ging)?\s+(?:deeper|into)\b/gi, 'go further into')
        .replace(/\bget(?:ting)?\s+deeper\s+into\b/gi, 'get more into')
        .replace(/\bgo(?:ing)?\s+deeper\b/gi, 'go further')
        .replace(/\bdelved?\b/gi, 'got into')
        .replace(/\bengage(?:d|s|ment)?\b/gi, 'connect')
        .replace(/\bdynamic\b/gi, 'situation')
        .replace(/\bshowcase(?:d|s)?\b/gi, 'show')
        .replace(/\bdemonstrate(?:d|s)?\b/gi, 'show')
        .replace(/\bseizing\b/gi, 'taking')
        .replace(/\bconnection\b/gi, 'something real')
        .replace(/\btoo safe\b/gi, 'too cautious')
        .replace(/\baim to\b/gi, 'try to')
        .replace(/\bwork on that\b/gi, 'fix that')
        // Score mentions in spoken parts
        .replace(/\bI['']m giving you a \d+\b/gi, '')
        .replace(/\byour score is a? \d+\b/gi, '')
        .replace(/\bI give you a \d+\b/gi, '')
        .replace(/\ba score of \d+\b/gi, '')
        // FIX A: Stock endings — replace with placeholder, model regenerates on retry
        // These leak through despite prompt bans — JS replace is the only reliable fix
        .replace(/you have got something real here[^.!?]*[.!?]/gi, 'Go again — the next rep will be sharper.')
        .replace(/you are closer than you think[^.!?]*[.!?]/gi, 'The gap is smaller than it feels — go again.')
        .replace(/one more round and you will feel the difference[^.!?]*/gi, 'One more session and you will notice the shift.')
        .replace(/push it further[^.!?]*[.!?]/gi, 'Take what worked here and build on it.')
        .replace(/you will surprise yourself[^.!?]*[.!?]/gi, 'Go again and see what lands differently.')
        .replace(/every rep makes you sharper[^.!?]*/gi, 'Each session builds on the last.')
        .replace(/practice is the only way through[^.!?]*/gi, 'The only way forward is another rep.')
        .replace(/keep at it[^.!?]*[.!?]/gi, 'Go again.')
        .replace(/practice makes perfect[^.!?]*[.!?]/gi, 'Another session, another step.')
        // Clean up double spaces from removals
        .replace(/\s{2,}/g, ' ')
        .trim();
    };

    // Apply to all spoken fields
    feedback.part1 = cleanText(feedback.part1);
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
