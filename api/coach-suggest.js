// api/coach-suggest.js — Real-time line suggestions during free conversation
const { checkRateLimit } = require('./ratelimit');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, res);
  if (!rl.allowed) return;

  if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'No LLM API key configured' });
  }

  const { history = [], scenarioKey, userStyle } = req.body || {};

  // Extract the character's last message explicitly for anchor injection
  const recentHistory = history.slice(-8);
  const lastCharMessage = [...recentHistory].reverse().find(m => m.role === 'assistant')?.content?.trim() || '';

  // Diagnostic: log received history shape and resolved anchor so stale-history bugs are traceable in Vercel logs
  console.log('[coach-suggest] history len:', history.length,
    '| last role:', history.length ? history[history.length - 1].role : 'none',
    '| anchor (first 100):', lastCharMessage.slice(0, 100));

  const lastCharAnchor = lastCharMessage
    ? `\n\nHer last message (the one you are responding to): "${lastCharMessage}"\n\nSTEP 1: Identify the single most specific word, phrase, or thing she revealed — not the general topic, but the exact detail.\nSTEP 2: Build each suggestion around THAT specific detail. The line should only make sense as a reply to HER exact message — not as a generic reply to any woman.`
    : '';

  // Setting context so suggestions feel grounded in the environment
  const scenarioLabels = {
    beach: 'a beach', bookstore: 'a bookstore', 'house-party': 'a house party',
    'coffee-shop': 'a coffee shop', supermarket: 'a supermarket', train: 'a commuter train',
    museum: 'a museum', gym: 'a gym', rooftop: 'a rooftop', 'yoga-studio': 'a yoga studio',
    airport: 'an airport', 'office-lobby': 'an office lobby', street: 'a street',
    'art-gallery': 'an art gallery opening',
  };
  const scenarioLabel = scenarioKey ? (scenarioLabels[scenarioKey] || scenarioKey) : null;
  const scenarioContext = scenarioLabel
    ? `\n\nSETTING: This conversation is happening at ${scenarioLabel}. Suggestions must feel natural and plausible for this specific place.`
    : '';

  // If the user has declared a preferred style, boost that suggestion
  const styleBoost = userStyle
    ? `\n\nSTYLE PRIORITY: The user's chosen style is "${userStyle}". Make the ${userStyle} suggestion the most vivid and specific of the three — it's what they'll most likely say.`
    : '';

  const systemPrompt = `You are Ryan, a sharp dating coach helping a man practice real conversations with women.

Your ONLY job: suggest 3 short lines the user can say IN DIRECT RESPONSE to the character's last message.

HOW TO BUILD EACH SUGGESTION:
1. Find the single most specific word, phrase, or thing she just revealed — not the topic, the specific detail
2. Build your line around THAT — reference it directly or react to its exact subtext
3. The line must only work as a reply to her specific words — not as a generic reply to any woman in any conversation
4. Under 15 words. Natural when spoken aloud. No filler words ("well", "so", "I mean") at the start.

WHAT TO AVOID:
- Generic questions or lines that could follow anything she says ("What do you like doing for fun?")
- Repeating what was already said earlier in the conversation
- Introducing a completely new topic
- Lines that work in dozens of other conversations — if you could copy-paste it elsewhere, it's too vague

THE 3 STYLES:
- curious: ask about the most specific thing she just said — the unusual detail, the word she chose, the thing she hinted at
- playful: tease or flip something specific she said — light and unexpected, grounded in her exact words
- direct: give a short honest reaction to what she actually revealed — not what she said, but what it means

EXAMPLE:
She said: "I write about coastal ecology. The shoreline has changed a lot."
Good curious: "What's the biggest change you've documented up close?"
Good playful: "So you're basically the shoreline's biographer."
Good direct: "That sounds like work that actually means something."

Bad (generic): "What do you like doing for fun?"
Bad (topic not her specific words): "So you care about the environment?"
${scenarioContext}${styleBoost}${lastCharAnchor}

Return ONLY valid JSON, no other text:
{"suggestions": [{"style": "curious", "text": "..."}, {"style": "playful", "text": "..."}, {"style": "direct", "text": "..."}]}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory,
    { role: 'user', content: 'Suggest 3 lines I could say next.' },
  ];

  async function callLLM(url, key, model) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 300 }),
    });
    if (!resp.ok) throw new Error(`LLM ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content;
  }

  try {
    let raw = null;

    if (process.env.OPENAI_API_KEY) {
      try {
        raw = await callLLM('https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY, 'gpt-4o-mini');
      } catch (err) {
        console.warn('[coach-suggest] OpenAI error:', err.message);
      }
    }

    if (!raw && process.env.GROQ_API_KEY) {
      try {
        raw = await callLLM('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, 'llama-3.3-70b-versatile');
      } catch (err) {
        console.warn('[coach-suggest] Groq error:', err.message);
      }
    }

    if (!raw) return res.status(502).json({ error: 'All LLM providers failed' });

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.suggestions) || parsed.suggestions.length !== 3) {
      return res.status(502).json({ error: 'Invalid suggestions format' });
    }

    console.log('[coach-suggest] suggestions:', parsed.suggestions.map(s => s.style + ': ' + s.text).join(' | '));
    return res.json(parsed);
  } catch (err) {
    console.error('[coach-suggest] error:', err.message);
    return res.status(500).json({ error: 'Failed to generate suggestions' });
  }
};
