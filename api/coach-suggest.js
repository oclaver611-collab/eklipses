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
    ? `\n\nANCHOR — her last message: "${lastCharMessage}"\n\nBefore writing: find the single word or short phrase in ANCHOR that is most specific to THIS message. Your suggestions must directly echo or callback to that word/phrase — not just the topic. A suggestion that could follow a completely different thing she might have said is too generic and must be rewritten.`
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

MANDATORY PROCESS:
1. Read the ANCHOR line (quoted at the bottom of this prompt)
2. Identify the single most specific word or phrase in it — something only SHE said in THIS specific message, not just the general topic
3. Each suggestion must directly echo or callback to that word/phrase — if you removed it, the line would feel wrong as a reply
4. Apply the generic test: "Could this line work as a response to something completely different she might have said?" If yes — it is too vague. Rewrite.

CONSTRAINTS:
- Under 15 words. Natural when spoken aloud.
- No filler words at the start: never begin with "So", "Well", "I mean", "That's", "Wow"
- Never repeat what was already said earlier in the conversation
- Never introduce a completely new topic

THE 3 STYLES:
- curious: ask about the most specific thing she just said — echo the unusual word she used, the detail she revealed, the thing she hinted at
- playful: take a specific word or phrase she used and flip or tease it — wry, unexpected, grounded in her exact wording
- direct: react to what she actually revealed about herself — not the words, but the fact underneath them

EXAMPLE:
ANCHOR: "I keep coming back to this one. Something about the negative space — like the painter left room for you to put yourself in."
Good curious (echoes "negative space"): "The negative space — what do you see when you step in?"
Good playful (echoes "keep coming back"): "So you've basically moved in here."
Good direct (reacts to the reveal): "Most people walk past that. You keep finding it."

Bad (generic — could follow many things): "What's your favorite piece here?"
Bad (topic but not her words): "You must come to museums a lot."
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
      body: JSON.stringify({ model, messages, temperature: 0.65, max_tokens: 300 }),
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
