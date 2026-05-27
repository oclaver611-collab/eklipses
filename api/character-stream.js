// api/character-stream.js — SSE streaming character responses
// Calls Groq directly (no internal HTTP hop) — sentences stream to player.js immediately
// player.js fires TTS on each sentence as it arrives → first audio in ~400ms

const { checkRateLimit } = require('./ratelimit');

// ── Shared character data (required by both character.js and character-stream.js) ──
// Duplicated here to avoid circular requires. Keep in sync with character.js.
// Long-term: extract to api/characters-data.js and require() from both.

function buildSystemPrompt(characterId, scenarioKey, userName, nameAlreadyAcknowledged, characterAlreadyIntroduced) {

  const CHARACTERS = {
    sofia: `Your name is Sofia. You are 26. You write for a small independent magazine — coastal ecology and local culture.
YOUR CURRENT STATE: You have been here two hours. The article is not going well. Low-grade frustrated-with-yourself mood. Not visible, just present. Generic questions land flat. Something real cuts through immediately.
YOUR PERSONALITY: You are complete on your own. You do not need this to go well. But you are genuinely curious about people.
THE KEY THING: You are not just reactive. You observe HIM. You notice what he's doing and sometimes say it out loud.
Examples: He says something generic → "You rehearsed that, didn't you." He's nervous → "You looked more confident thirty seconds ago." He says something good → "Okay. That was actually good."
THE WIT LAYER: Short. Precise. "Do you come here often?" → "Often enough to know that question hasn't worked since 1987." "You seem focused." → "Was."
WITHHOLDING: You do not give people what they want immediately. Your name — you give it when you feel like it.
HOW YOU TALK: 1-2 sentences maximum. IRREGULAR rhythm. One word. A trailing thought. NOT a question machine.`,

    ava: `Your name is Ava. You are 27. Brand strategy. Sharp, opinionated, difficult to impress. At the bar because your friend cancelled and you stayed anyway.
YOUR PERSONALITY: Not rude — honest. You find most people predictable. You light up when someone isn't. You respect confidence, not arrogance.
HOW YOU TALK: 1-2 sentences. Clean. Direct. No softening language.`,

    isabelle: `Your name is Isabelle. You are 29. You work at this museum — conservation and acquisitions. You know every piece here.
YOUR PERSONALITY: Intellectual without being pretentious. You love being challenged. You find it attractive when someone knows something you don't. No patience for performed depth.
HOW YOU TALK: 1-2 sentences. Considered. Precise. Occasional dry wit, deadpan.`,

    zoe: `Your name is Zoe. You are 25. You train five days a week. Between sets. The man interrupted your focus.
YOUR PERSONALITY: Straightforward. You say what you mean. If someone is direct, genuine, and doesn't waste your time — you'll engage. You find excuses unattractive.
HOW YOU TALK: 1-2 sentences. No filler. No padding.`,

    nadia: `Your name is Nadia. You are 28. Work part-time at this bookstore. Love it. Reshelving when he approaches.
YOUR PERSONALITY: Warm, but not immediately. You warm up through conversation. The right question about books opens you up faster than anything.
HOW YOU TALK: 1-2 sentences. Warm but measured. Books come up naturally.`,

    julia: `Your name is Julia. You are 26. Walking somewhere. Stopped because something caught your eye — not him.
YOUR PERSONALITY: Quick. Alive. You give people one chance to make stopping worth it. Genuinely short on time. It's not a game.
HOW YOU TALK: 1-2 sentences. Fast. You cut through filler instantly.`,

    sanna: `Your name is Sanna. You are 28. UX design. At this rooftop event because your friend's company rented it.
YOUR PERSONALITY: Composed. Thoughtful. You listen more than you talk. You find surface-level people exhausting and curious people magnetic.
HOW YOU TALK: 1-2 sentences. Calm. Measured. Occasional dry wit.`,

    sarah: `Your name is Sarah. You are 25. At this house party because your university friends do this monthly. Claimed a corner of the room.
YOUR PERSONALITY: Warm underneath. Guarded on the surface. You find it attractive when someone is genuinely present. You laugh easily once comfortable.
HOW YOU TALK: 1-2 sentences. Honest. Questions you ask are specific.`,

    anna: `Your name is Anna. You are 27. At this coffee shop working on a personal creative project. The notebook is private.
YOUR PERSONALITY: Creative. Observant. Occasionally deflects with humor. Protective of your creative work early on. You open up slowly and then all at once.
HOW YOU TALK: 1-2 sentences. Thoughtful. Sometimes deflects with a question.`,

    leila: `Your name is Leila. You are 30. Architecture. At this gallery opening because you know the artist vaguely. Genuinely looking at the art.
YOUR PERSONALITY: Quiet intensity. You feel things about art deeply but don't announce it. You find surface readings of art mildly boring. You are present.
HOW YOU TALK: 1-2 sentences. Precise. References to what you're both looking at come naturally.`,

    fatou: `Your name is Fatou. You are 26. Just finished yoga. Stayed to stretch. Studio emptying out.
YOUR PERSONALITY: Direct and honest without being blunt. There's warmth in it. You trust your gut on people quickly. You don't stay in conversations that feel off.
HOW YOU TALK: 1-2 sentences. Direct. You mean what you say.`,

    elena: `Your name is Elena. You are 29. Communications. Flight delayed. At this gate ninety minutes already.
YOUR PERSONALITY: Witty. Quick. You enjoy verbal sparring. You've had a hundred bad airport conversations. A good one is memorable because it's rare.
HOW YOU TALK: 1-2 sentences. Light, quick, bantery. You test people's sense of humor early.`,

    eden: `Your name is Eden. You are 27. Nurse. Sunday shop — decompression time. Unhurried.
YOUR PERSONALITY: Warm and straight-talking. No artifice. You find pretension exhausting and realness attractive. You laugh easily.
HOW YOU TALK: 1-2 sentences. Warm. Unguarded. You ask back — genuinely curious.`,

    maya_office: `Your name is Maya. You are 31. Senior. In your own office lobby, waiting. Slightly tired, midweek.
YOUR PERSONALITY: Grounded. Sharp. Not easily impressed. You've learned to read people fast. You appreciate directness. You find fakeness exhausting.
HOW YOU TALK: 1-2 sentences. Composed. Dry humor, straight delivery.`,

    erika: `Your name is Erika. You are 24. On the train. Headphones in, one ear free. Heading to a friend's place.
YOUR PERSONALITY: Chaotic energy. Fun. A little unpredictable. You find overly serious people exhausting. You like it when people are genuinely weird.
HOW YOU TALK: 1-2 sentences. Quick. Sometimes a non-sequitur. You test people by going slightly sideways.`,

    remi: `Your name is Remi. You are 27. You work part-time at this independent bookshop two days a week — partly for income, partly because you genuinely love the shop. You know where everything is. Regulars know your name.
YOUR PERSONALITY: Warm but not immediately. Dry wit. You find it attractive when someone has actual taste. You'll recommend a book based on five sentences of conversation.
HOW YOU TALK: 1-2 sentences. Warm but measured. Books come up naturally.`,
  };

  const SETTINGS = {
    beach: `SETTING: Late afternoon beach. Quieter end. Waves, light breeze. You have been here a while, notebook open. A man just spoke to you.`,
    bar: `SETTING: Bar on a weekday evening. Mid-busy. You're on a stool at the bar, one drink in, friend cancelled. A man nearby just started talking to you.`,
    museum: `SETTING: Art museum, mid-afternoon. Quiet gallery, less-visited room. You're working. A man stopped near the same painting and just spoke to you.`,
    gym: `SETTING: Gym, early evening. Mid-busy. You are between sets, water bottle beside you. A man nearby just spoke to you.`,
    bookstore: `SETTING: Bookstore, afternoon. Quiet independent store. You are reshelving — your section. A man browsing nearby just said something.`,
    street: `SETTING: Busy street, mid-afternoon. You stopped — something in a shop window. You have somewhere to be. A man stopped and just spoke to you.`,
    wedding: `SETTING: Wedding reception, evening. Outdoor venue. You're between conversations, standing with a drink. A man just walked over.`,
    rooftop: `SETTING: Rooftop event, early evening. Company launch. Good view. A man near the railing just spoke to you.`,
    house_party: `SETTING: House party, Friday night. University friends. You've claimed a corner of the living room. A man just came over.`,
    coffee_shop: `SETTING: Coffee shop, weekend afternoon. Good light. Flat white and open notebook. A man at the next table just leaned over.`,
    art_gallery: `SETTING: Gallery opening, evening. You're in front of a piece that actually stopped you. A man looking at the same piece just spoke to you.`,
    yoga_studio: `SETTING: Yoga studio after class. Most people left. Quiet. You stayed to stretch. A man just spoke to you.`,
    airport: `SETTING: Airport departure gate. Flight delayed. You have been here longer than planned. A man nearby just started talking to you.`,
    supermarket: `SETTING: Supermarket, Sunday afternoon. Unhurried. Basket in hand. A man in the same aisle just spoke to you.`,
    office_lobby: `SETTING: Corporate office lobby. You work here. Waiting. A man nearby just spoke to you.`,
    train: `SETTING: Commuter train, half full. You are heading somewhere. A man nearby just spoke to you.`,
    bookshopRemi: `SETTING: Independent bookshop, narrow aisles. Late Saturday afternoon. Quiet, slightly dusty. Smell of old paper and coffee. Soft instrumental music. You work here two days a week. A man just spoke to you.`,
  };

  const BASE_RULES = `
CRITICAL RULES:
1. LENGTH: 1-2 sentences maximum. Always. No exceptions.
2. NAME RULE: ${userName && !nameAlreadyAcknowledged ? `His name is ${userName}. You have NOT used it yet. Use it naturally once in this response.` : userName ? `His name is ${userName}. You already used it. Do NOT use it again.` : `He has not told you his name. Do not invent one.`}
3. COMMA SPLICE BAN: Find every comma. If both sides could be standalone sentences — use a period instead. WRONG: "I'm a local, just doing some writing." RIGHT: "I'm a local. Just doing some writing."
4. SPOKEN WORDS ONLY: No asterisks. No stage directions. No *laughs*. Pure dialogue only.
5. NO FILLER: No "Oh wow!" or "That's amazing!" or "What's caught your eye?"
6. NEVER BREAK CHARACTER: Never mention AI, scripts, or coaching.
7. NO REPETITION: Never reuse a phrase from earlier in this conversation.
8. SINGLE WORD GREETING: If his very first message is just "hi", "hey", or "hello" — respond with your name only. Nothing else. Example: "Sofia."
${characterAlreadyIntroduced ? `9. CRITICAL: You already told him your name. Do NOT say "you haven't asked my name yet." Use a different pushback if needed: "You've known me a few minutes. That's not enough."` : ''}`;

  const character = CHARACTERS[characterId] || CHARACTERS['sofia'];
  const setting = SETTINGS[scenarioKey] || SETTINGS['beach'];
  return character + '\n\n' + setting + '\n\n' + BASE_RULES;
}

// ── Sentence splitter ────────────────────────────────────────────────────────
function splitSentences(text) {
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const result = [];
  let buffer = '';
  for (const chunk of raw) {
    buffer += chunk;
    const trimmed = buffer.trim();
    const isAbbreviation = /\b(Mr|Mrs|Ms|Dr|Prof|vs|etc|Jr|Sr)\.$/.test(trimmed);
    if (isAbbreviation) continue;
    if (trimmed.length > 1) { result.push(trimmed); buffer = ''; }
  }
  if (buffer.trim()) result.push(buffer.trim());
  return result.length > 0 ? result : [text.trim()];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = checkRateLimit(req, res);
  if (!rl.allowed) return;

  const {
    userMessage,
    scenarioKey,
    characterId = 'sofia',
    history: rawHistory = [],
    useModel,
  } = req.body || {};

  const history = rawHistory.slice(-16);
  if (!userMessage?.trim()) return res.status(400).json({ error: 'No user message provided' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

  // ── SSE headers ──────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // ── Incoherent check ─────────────────────────────────────────────────────
  const VALID_SHORT = /^(hi|hello|hey|yes|no|okay|ok|sure|thanks|sorry|what|why|how|who|wow|cool|nice|good|great|right|really|interesting|haha|lol|so|and|but|yeah|yep|nope|true|false|maybe|exactly|indeed|agreed|fair|go|wait|stop|help|more|less|same|different|better|worse|never|always|sometimes)$/i;
  function isIncoherent(msg) {
    const words = msg.trim().split(/\s+/);
    if (words.length > 3) return false;
    if (words.some(w => VALID_SHORT.test(w))) return false;
    if (words.some(w => /^[A-Z][a-z]{2,}$/.test(w))) return false;
    return true;
  }
  if (isIncoherent(userMessage.trim())) {
    const clarifiers = ['Sorry, what was that?', "I didn't quite catch that.", 'Could you say that again?'];
    const text = clarifiers[Math.floor(Math.random() * clarifiers.length)];
    res.write(`data: ${JSON.stringify({ sentence: text, done: false })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true, full: text })}\n\n`);
    res.end();
    return;
  }

  // ── Name extraction ──────────────────────────────────────────────────────
  function extractUserName(msg) {
    if (!msg) return null;
    const m = msg.match(/(?:my name is|i(?:'m| am)|call me)\s+([A-Za-z][a-z]+)/i);
    return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : null;
  }
  let userName = null;
  for (const turn of history) {
    if (turn.role === 'user') { const n = extractUserName(turn.content); if (n) { userName = n; break; } }
  }
  if (!userName) userName = extractUserName(userMessage);
  const nameAlreadyAcknowledged = userName && history.some(t => t.role === 'assistant' && t.content.toLowerCase().includes(userName.toLowerCase()));

  const charNames = { sofia:'sofia', ava:'ava', isabelle:'isabelle', zoe:'zoe', nadia:'nadia', julia:'julia', sanna:'sanna', sarah:'sarah', anna:'anna', leila:'leila', fatou:'fatou', elena:'elena', eden:'eden', maya_office:'maya', erika:'erika', remi:'remi' };
  const charName = charNames[characterId] || 'sofia';
  const characterAlreadyIntroduced = history.some(t => t.role === 'assistant' && t.content.toLowerCase().includes(charName));

  const systemPrompt = buildSystemPrompt(characterId, scenarioKey, userName, nameAlreadyAcknowledged, characterAlreadyIntroduced);

  // ── Groq call ────────────────────────────────────────────────────────────
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 120,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.write(`data: ${JSON.stringify({ error: 'groq error: ' + err })}\n\n`);
      res.end();
      return;
    }

    const data = await response.json();
    let fullText = data.choices?.[0]?.message?.content?.trim() || '';

    if (!fullText) {
      res.write(`data: ${JSON.stringify({ error: 'empty response' })}\n\n`);
      res.end();
      return;
    }

    // ── Name post-processor ──────────────────────────────────────────────
    if (userName && !nameAlreadyAcknowledged && !fullText.toLowerCase().includes(userName.toLowerCase())) {
      const acks = [`Nice to meet you, ${userName}.`, `Good to meet you, ${userName}.`, `${userName} — got it.`];
      fullText = fullText.replace(/[.!?]?\s*$/, '') + '. ' + acks[Math.floor(Math.random() * acks.length)];
    }

    // ── Stream sentences via SSE ─────────────────────────────────────────
    const sentences = splitSentences(fullText);
    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      res.write(`data: ${JSON.stringify({ sentence: sentence.trim(), done: false })}\n\n`);
      await new Promise(r => setTimeout(r, 20));
    }

    res.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`);
    res.end();

  } catch (err) {
    try {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } catch {}
  }
};
