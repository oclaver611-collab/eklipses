// api/coach.js — Ryan's post-session coaching via Groq
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conversation, scenarioTitle } = req.body || {};

  if (!conversation?.length) {
    return res.status(400).json({ error: 'No conversation provided' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set' });
  }

  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'HIM' : 'MARY'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `You are Ryan, a brutally honest but encouraging dating coach.
Analyze this practice conversation and give real feedback.

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 1-10>,
  "spokenSummary": "<2-3 sentences Ryan says out loud — conversational, direct, specific>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": ["<specific thing to fix 1>", "<specific thing to fix 2>"],
  "tryThisLine": "<one specific better line he could have used>"
}

Rules:
- Be specific, reference actual things he said
- Score honestly — most beginners get 4-6
- spokenSummary is what Ryan SAYS OUT LOUD — keep it under 40 words, punchy
- tryThisLine should be natural, not cheesy
- No filler, no generic advice`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Scenario: ${scenarioTitle}\n\nConversation:\n${transcript}` }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Groq error: ' + err });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    const feedback = JSON.parse(raw);
    res.json(feedback);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
