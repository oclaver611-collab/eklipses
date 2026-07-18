// api/drill-eval.js — Lightweight per-rep warm-up drill evaluation (single exchange)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lessonKey, letter, cue, sofiasLine, userResponse, criteria } = req.body || {};
  if (!letter || !sofiasLine || !userResponse) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'No LLM API key configured' });
  }

  const systemPrompt = `You are Ryan, a concise dating coach. Evaluate one rep of a warm-up drill.
Sofia's line: "${sofiasLine}"
User's reply: "${userResponse}"
Skill: ${letter} — ${cue}
Pass criteria: ${criteria}

Return ONLY valid JSON: {"pass": true/false, "coaching": "<one direct sentence — casual, specific to what they actually said, max 20 words>"}
Be honest. If they passed, name one thing that worked. If they missed, name the one thing to fix.
Never use "engage", "dynamic", "specific" (say "real" instead), "connection". Write like you're talking.`;

  async function callLLM(messages) {
    const body = {
      messages,
      max_tokens: 120,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    };
    if (process.env.GROQ_API_KEY) {
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, model: 'llama-3.3-70b-versatile' }),
        });
        if (resp.ok) {
          const d = await resp.json();
          const content = d.choices?.[0]?.message?.content;
          if (content) return content;
        }
        console.warn('[drill-eval] Groq non-OK:', resp.status);
      } catch (err) { console.warn('[drill-eval] Groq error:', err.message); }
    }
    if (!process.env.OPENAI_API_KEY) throw new Error('No LLM provider available');
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model: 'gpt-4o-mini' }),
    });
    if (!resp.ok) throw new Error('OpenAI error: ' + await resp.text());
    const d = await resp.json();
    return d.choices?.[0]?.message?.content;
  }

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Evaluate this drill rep.' },
    ];
    const raw = await callLLM(messages);
    let result;
    try { result = JSON.parse(raw); }
    catch (_) { return res.status(500).json({ error: 'JSON parse failed' }); }
    if (typeof result.pass !== 'boolean' || !result.coaching) {
      return res.status(500).json({ error: 'Invalid response format' });
    }
    result.coaching = (result.coaching || '').slice(0, 200).trim();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
