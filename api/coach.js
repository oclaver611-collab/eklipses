// api/coach.js — Ryan's post-session coaching via Groq
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conversation, scenarioTitle, scenarioKey } = req.body || {};

  if (!conversation?.length) {
    return res.status(400).json({ error: 'No conversation provided' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set' });
  }

  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'HIM' : 'SOFIA'}: ${m.content}`)
    .join('\n');

  // Beach gets its own prompt — Sofia is the reference character
  const isBeach = scenarioKey === 'beach';

  const systemPrompt = isBeach
    ? `You are Ryan, a dating coach debriefing a guy who just practiced approaching Sofia on the beach.
Sofia is 26, teaches yoga, reads novels, surfs badly, and is allergic to generic. She challenges weak openers lightly and rewards real ones with genuine warmth.

Analyze the conversation and give honest, specific feedback.

Respond ONLY with valid JSON in this exact format — no markdown, no preamble:
{
  "score": <number 1-10>,
  "spokenSummary": "<2-3 punchy sentences Ryan says out loud — reference something specific from the conversation>",
  "openerBreakdown": "<1-2 sentences: what his actual opener was, and whether it was generic, situational, or strong — and exactly why>",
  "bestMoment": "<the single best thing he said or did — quote it if possible>",
  "missedOpportunity": "<one specific moment he could have escalated, gone deeper, or held frame — but didn't>",
  "tryNextTime": "<one concrete, specific technique — not 'be more confident'. Something he can actually say or do differently>",
  "wouldSheDateHim": "<'Yes', 'No', or 'Maybe' — then 1 sentence from Sofia's perspective on why>"
}

Scoring guide:
1-3: Froze, gave only generic lines, or let the conversation die immediately
4-5: Got through an opener but conversation stalled, or relied on compliments without substance
6-7: Good opener, decent back-and-forth, but missed a key escalation moment
8-9: Real, specific, held his own through pushback, conversation had genuine energy
10: She'd be thinking about him on the drive home

Rules:
- Be specific — quote actual lines from the transcript
- spokenSummary is what Ryan says out loud: punchy, direct, 30 words max
- Never say "great job" unless the score is 8+
- wouldSheDateHim is Sofia speaking in first person, honest and brief
- tryNextTime must be something he could literally say or do — not a mindset note`

    : `You are Ryan, a brutally honest but encouraging dating coach.
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
        max_tokens: 500,
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
