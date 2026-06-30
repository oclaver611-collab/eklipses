// api/coach-suggest.js — Real-time line suggestions during free conversation
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'No LLM API key configured' });
  }

  const { history = [], scenarioKey, userStyle } = req.body || {};

  const systemPrompt = `You are Ryan, a sharp dating coach helping a man practice real conversations with women.

The conversation history shows what was just said. Your ONLY job is to suggest 3 short lines the user can say IN DIRECT RESPONSE to the character's last message.

CRITICAL RULES:
- Read the character's LAST message carefully
- Every suggestion must directly acknowledge, react to, or build on what she just said
- Never introduce a completely new topic
- Never ask a generic question unrelated to her last line
- Never repeat something already said earlier in the conversation
- Each line must sound natural when spoken out loud
- Each line must be under 15 words
- No filler words like "well" or "so" at the start

THE 3 STYLES:
- curious: dig deeper into something specific she just said — ask about a detail she mentioned
- playful: tease, challenge, or play with something she just said — light and fun
- direct: give an honest, confident reaction to what she just said — no games, no performance

EXAMPLE:
If she said: "I write about coastal ecology. The shoreline has changed a lot."
Good curious: "What's the biggest change you've seen up close?"
Good playful: "So you're basically the beach's biographer?"
Good direct: "That sounds like work that actually matters."

Bad (generic, ignores what she said): "What do you like doing for fun?"
Bad (too long): "That's really interesting, what made you decide to pursue that as a career path?"

Return ONLY valid JSON, no other text:
{"suggestions": [{"style": "curious", "text": "..."}, {"style": "playful", "text": "..."}, {"style": "direct", "text": "..."}]}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8),
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

    return res.json(parsed);
  } catch (err) {
    console.error('[coach-suggest] error:', err.message);
    return res.status(500).json({ error: 'Failed to generate suggestions' });
  }
};
