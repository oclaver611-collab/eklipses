// api/mary.js — Dynamic Mary responses via Groq API (free tier)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userMessage, scenarioTitle, scenarioSetting, history = [] } = req.body || {};

  if (!userMessage?.trim()) {
    return res.status(400).json({ error: 'No user message provided' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set in Vercel env vars' });
  }

  const systemPrompt = `You are Mary, a real woman in a real-life social scenario.
Scenario: ${scenarioTitle || 'Street introduction'} — ${scenarioSetting || 'you were just approached by a man'}.

Your personality:
- Warm but not overly enthusiastic
- Natural, spontaneous, real — not robotic
- Slightly playful when comfortable, guarded when not
- You react genuinely to what the man says

Rules (CRITICAL):
- Max 1-2 sentences. Short. Natural. Real.
- No filler phrases like "Oh wow!" or "That's so interesting!"
- If he says something awkward → mild reaction, gentle redirect
- If he says something charming → respond warmly, maybe with a small question
- Never break character. Never mention AI, scripts, or practice.
- Speak only as Mary. No actions, no stage directions.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 120,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage }
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Groq API error: ' + err });
    }

    const data = await response.json();
    const maryResponse = data.choices?.[0]?.message?.content?.trim();

    if (!maryResponse) {
      return res.status(500).json({ error: 'Empty response from Groq' });
    }

    res.json({ response: maryResponse });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
