// eval-coach-v4.js — Automated evaluator for api/coach.js
// Tests all 6 scenarios with full conversations
// Checks: banned phrases, score floor, HIM_N leaks, card fields, motivational close
// NEW v4: checks for specific endings, tryNextTime quality, stock phrase ban
// Run with: node eval-coach-v4.js

require('dotenv').config();

const VERCEL_URL = process.env.VERCEL_URL || 'https://eklipses.vercel.app';

// ─── BANNED PHRASES TO CHECK ─────────────────────────────────────────────────

const BANNED_PHRASES = [
  "right, so here's where",
  "now watch this moment",
  "now here's the thing",
  "so — putting it all together",
  "putting it all together",
  "here's the bottom line",
  "the bottom line",
  "this is where the conversation shifted",
  "this is the moment i want you to remember",
  "at the end of the day",
  "the fact of the matter",
  "dive deeper",
  "dig deeper",
  "dive into",
  "diving into",
  "dive in",
  "delved",
  "delve into",
  "go out there",
  "aim to",
  "work on that",
  "showcase",
  "demonstrate",
  "i'm giving you a",
  "your score is a",
  "i give you a",
  "a score of",
  "giving you a score",
  // FIX 2: Generic stock endings — banned by name
  "practice is the only way through",
  "every rep makes you sharper",
  "you are closer than you think",
  "one more round and you will feel",
  "you have got something real here",
  "push it further",
  "you will surprise yourself",
  "keep at it",
  "practice makes perfect",
  "keep pushing",
];

// ─── TEST CASES — all 6 scenarios with full conversations ────────────────────

const TEST_CASES = [
  {
    name: 'Beach — generic opener + coffee ask',
    scenarioKey: 'beach',
    scenarioTitle: 'Beach — Cold Open',
    opener: 'hi nice to meet you what is your name',
    expectedScoreMin: 5,
    conversation: [
      { role: 'user',      content: 'hi nice to meet you what is your name' },
      { role: 'assistant', content: 'Sofia. Nice to meet you.' },
      { role: 'user',      content: 'my name is Paul so what are you writing about' },
      { role: 'assistant', content: 'Coastal erosion. How this beach has lost eight meters of sand in twenty years.' },
      { role: 'user',      content: 'that sounds important for the environment right' },
      { role: 'assistant', content: 'Yes. People do not notice until it is too late.' },
      { role: 'user',      content: 'so is this your passion or just work' },
      { role: 'assistant', content: 'A bit of both. I like the freedom it gives me.' },
      { role: 'user',      content: 'I think we can maybe go grab some coffee sometime what do you think' },
      { role: 'assistant', content: 'You have known me a few minutes. That is not enough.' },
    ]
  },
  {
    name: 'Bar — strong opener, holds ground',
    scenarioKey: 'bar',
    scenarioTitle: 'Bar — Night Out',
    opener: 'everyone here is trying too hard except you',
    expectedScoreMin: 5,
    conversation: [
      { role: 'user',      content: 'everyone here is trying too hard except you' },
      { role: 'assistant', content: 'Ava. Is that your opener or do you actually mean it.' },
      { role: 'user',      content: 'I mean it. You look like you are actually here not performing.' },
      { role: 'assistant', content: 'Fair. Most people in here are performing. What about you.' },
      { role: 'user',      content: 'I am a surgeon. I spend all day being serious so I come here to not think.' },
      { role: 'assistant', content: 'That is surprisingly honest. What kind of surgery.' },
      { role: 'user',      content: 'cardiac. the kind where you cannot afford to be off.' },
      { role: 'assistant', content: 'I bet that follows you around even when you are not working.' },
      { role: 'user',      content: 'always. what do you do' },
      { role: 'assistant', content: 'Brand strategy. I make things sound better than they are.' },
    ]
  },
  {
    name: 'Museum — missed intellectual door',
    scenarioKey: 'museum',
    scenarioTitle: 'Museum — Quiet Opener',
    opener: 'you have been standing in front of that one for a while',
    expectedScoreMin: 5,
    conversation: [
      { role: 'user',      content: 'you have been standing in front of that one for a while' },
      { role: 'assistant', content: 'Isabelle. Yes. I keep finding new things in it.' },
      { role: 'user',      content: 'what are you finding' },
      { role: 'assistant', content: 'The tension in the empty spaces. The objects feel like they are holding their breath.' },
      { role: 'user',      content: 'that is interesting so do you come here often' },
      { role: 'assistant', content: 'Often enough. It depends on what I need to think through.' },
      { role: 'user',      content: 'what do you do for work' },
      { role: 'assistant', content: 'Art history. I lecture at the university.' },
      { role: 'user',      content: 'wow that sounds fascinating I would love to learn more about that' },
      { role: 'assistant', content: 'It is more interesting than it sounds in a course catalogue.' },
    ]
  },
  {
    name: 'Gym — direct opener, number ask',
    scenarioKey: 'gym',
    scenarioTitle: 'Gym — Between Sets',
    opener: 'shoulder press is the hardest thing to isolate what weight are you on',
    expectedScoreMin: 5,
    conversation: [
      { role: 'user',      content: 'shoulder press is the hardest thing to isolate what weight are you on' },
      { role: 'assistant', content: 'Zoe. Twenty kilos. My weak point.' },
      { role: 'user',      content: 'same for me. I have been working on it for months.' },
      { role: 'assistant', content: 'What changed for you.' },
      { role: 'user',      content: 'dropped the weight and focused on form first. what are you training for' },
      { role: 'assistant', content: 'Nothing specific. Just want to feel like I am in control of something.' },
      { role: 'user',      content: 'that is honest. I train for the same reason actually.' },
      { role: 'assistant', content: 'Most people say competition or a race. Nobody says that.' },
      { role: 'user',      content: 'maybe we can exchange numbers and train together sometime' },
      { role: 'assistant', content: 'You are moving fast. Let us see how this conversation goes first.' },
    ]
  },
  {
    name: 'Bookstore — wordplay opener',
    scenarioKey: 'bookstore',
    scenarioTitle: 'Bookstore — Quiet Browse',
    opener: 'you have picked that up twice and put it back down',
    expectedScoreMin: 5,
    conversation: [
      { role: 'user',      content: 'you have picked that up twice and put it back down' },
      { role: 'assistant', content: 'Nadia. The first page is not convincing me yet.' },
      { role: 'user',      content: 'what does a convincing first page feel like to you' },
      { role: 'assistant', content: 'Like someone is not trying to impress you. Just talking.' },
      { role: 'user',      content: 'that is a good way to put it. what do you usually read' },
      { role: 'assistant', content: 'Mostly fiction. Some psychology when I am trying to understand something.' },
      { role: 'user',      content: 'what are you trying to understand right now' },
      { role: 'assistant', content: 'Why people say one thing and mean another. Professionally useful.' },
      { role: 'user',      content: 'what do you do' },
      { role: 'assistant', content: 'Copywriter. I make words do things they were not designed to do.' },
    ]
  },
  {
    name: 'Street — quick stop, honest opener',
    scenarioKey: 'street',
    scenarioTitle: 'Street — Quick Stop',
    opener: 'I have ten seconds before this gets awkward so here it is',
    expectedScoreMin: 5,
    conversation: [
      { role: 'user',      content: 'I have ten seconds before this gets awkward so here it is' },
      { role: 'assistant', content: 'Julia. You already used three of them.' },
      { role: 'user',      content: 'fair. I noticed you from across the street and figured I would regret not saying something.' },
      { role: 'assistant', content: 'That is honest at least. What did you notice.' },
      { role: 'user',      content: 'you looked like you were somewhere else in your head while walking.' },
      { role: 'assistant', content: 'I was. Work thing. How did you read that from across the street.' },
      { role: 'user',      content: 'I am a photographer. I notice how people carry themselves.' },
      { role: 'assistant', content: 'What do you photograph.' },
      { role: 'user',      content: 'people mostly. faces in public spaces. the unguarded moments.' },
      { role: 'assistant', content: 'That is either very beautiful or very invasive depending on the person.' },
    ]
  },
];

// ─── EVALUATOR ───────────────────────────────────────────────────────────────

function evaluate(testCase, feedback) {
  const results = [];
  const pass = (name) => results.push({ name, pass: true });
  const fail = (name, detail) => results.push({ name, pass: false, detail });

  const allSpoken = [feedback.part1, feedback.part2, feedback.part3, feedback.part4].filter(Boolean).join(' ');
  const allText = [allSpoken, feedback.missedOpportunity, feedback.bestMoment, feedback.tryNextTime, feedback.wouldSheDateHim, feedback.spokenSummary].filter(Boolean).join(' ');
  const allLower = allText.toLowerCase();

  // 1. All four parts exist
  ['part1','part2','part3','part4'].forEach(p => {
    if (feedback[p] && feedback[p].length > 50) pass(`${p}: exists and has content`);
    else fail(`${p}: exists and has content`, `Got: "${String(feedback[p]).slice(0,60)}"`);
  });

  // 2. Part lengths
  if ((feedback.part1||'').length >= 100) pass('part1: min length');
  else fail('part1: min length', `Only ${(feedback.part1||'').length} chars`);

  if ((feedback.part2||'').length >= 150) pass('part2: min length');
  else fail('part2: min length', `Only ${(feedback.part2||'').length} chars`);

  if ((feedback.part3||'').length >= 300) pass('part3: min 80 words');
  else fail('part3: min 80 words', `Only ${(feedback.part3||'').length} chars`);

  // 3. Banned phrases — check every single one
  const foundBanned = BANNED_PHRASES.filter(phrase => allLower.includes(phrase.toLowerCase()));
  if (foundBanned.length === 0) pass('no banned phrases in any field');
  else foundBanned.forEach(phrase => fail(`banned phrase: "${phrase}"`, `Found in output`));

  // 4. HIM_N leak — Ryan should never say "HIM_1", "HIM_2" etc in spoken output
  const himLeak = allSpoken.match(/\bHIM_\d+\b/);
  if (!himLeak) pass('no HIM_N leak in spoken parts');
  else fail('no HIM_N leak in spoken parts', `Found: "${himLeak[0]}"`);

  // 5. Score floor — full conversation should be 5+
  if (feedback.score >= testCase.expectedScoreMin) pass(`score: at least ${testCase.expectedScoreMin}`);
  else fail(`score: at least ${testCase.expectedScoreMin}`, `Got score ${feedback.score}`);

  // 6. Score in valid range
  if (feedback.score >= 1 && feedback.score <= 10) pass('score: valid range 1-10');
  else fail('score: valid range 1-10', `Got: ${feedback.score}`);

  // 7. Score NOT spoken in part4
  const scoreMentioned = /\b(giving you a|your score is a?|i give you a|a score of|score is)\s*\d+\b/i.test(feedback.part4||'');
  if (!scoreMentioned) pass('part4: score number not spoken');
  else fail('part4: score number not spoken', `part4 contains score number — should be on card only`);

  // 8. Motivational close in part4
  const motivational = ['try again', 'hit try', 'one more round', 'go again', 'feel the difference', 'surprise yourself', 'sharper', 'keep going', 'keep pushing', 'closer than you think', 'get her interested', 'will respond', 'you have got this', 'you got this', "you've got this", 'pay off', 'next time', 'you are learning', "you're learning", 'lean in', 'follow that', 'build on', 'go further', 'notice', 'each session', 'step forward', 'last one', 'rep will', 'go again', "you'll see", "you will see", 'she will', "she'll", 'will land', 'will work', 'open up', 'reactions', 'best reactions', 'difference', 'that works', 'that will', 'works better', 'works well', 'the difference', 'different result', 'different reaction', 'better result', 'is earned', 'earns', 'you earn', 'will get', "you'd get", 'that gets', 'start there', 'start with', 'use that', 'lead with', 'come back', 'worth trying', 'try that', 'try it', "don't let", 'do not let', 'pass by', 'let it pass', 'when she shows', 'shows interest', 'when she opens', 'when she asks', 'she opens', 'she asks', 'take that', 'take it'];
  const hasMotivation = motivational.some(p => (feedback.part4||'').toLowerCase().includes(p));
  if (hasMotivation) pass('part4: motivational close present');
  else fail('part4: motivational close present', `part4: "${(feedback.part4||'').slice(-80)}"`);

  // 9. All card fields populated
  ['openerBreakdown','bestMoment','missedOpportunity','tryNextTime','wouldSheDateHim'].forEach(field => {
    const val = feedback[field];
    if (val && val !== 'undefined' && val.length > 10) pass(`card: ${field} populated`);
    else fail(`card: ${field} populated`, `Got: "${val}"`);
  });

  // 10. tryNextTime is actual words not a concept
  const try_ = (feedback.tryNextTime||'').toLowerCase();
  const isConcept = ['focus on','try to','make sure','be more','next time, try','next time you'].some(p => try_.startsWith(p));
  if (!isConcept) pass('tryNextTime: actual words not concept');
  else fail('tryNextTime: actual words not concept', `"${feedback.tryNextTime}"`);

  // 11. wouldSheDateHim starts with Yes/No/Maybe
  const wsd = (feedback.wouldSheDateHim||'').trim();
  if (/^(yes|no|maybe)/i.test(wsd)) pass('wouldSheDateHim: starts with Yes/No/Maybe');
  else fail('wouldSheDateHim: starts with Yes/No/Maybe', `Got: "${wsd.slice(0,60)}"`);

  // 12. part3 quotes a real line from the conversation
  const conversationWords = testCase.conversation.map(t => t.content.toLowerCase().split(' ')).flat();
  const part3Lower = (feedback.part3||'').toLowerCase();
  const part3QuotesReal = conversationWords.some(word => word.length > 5 && part3Lower.includes(word));
  if (part3QuotesReal) pass('part3: references real conversation content');
  else fail('part3: references real conversation content', 'part3 may be hallucinating — no words from transcript found');

  // 13. FIX 2: part4 ending is specific — not a stock phrase
  const stockEndings = [
    'practice is the only way through',
    'every rep makes you sharper',
    'you are closer than you think',
    'one more round and you will feel',
    'you have got something real here',
    'push it further',
    'you will surprise yourself',
    'keep at it',
    'practice makes perfect',
  ];
  const part4End = (feedback.part4||'').toLowerCase().slice(-200);
  const hasStock = stockEndings.find(s => part4End.includes(s));
  if (hasStock) fail('part4: specific ending (not stock phrase)', `Found stock ending: "${hasStock}"`);
  else pass('part4: specific ending (not stock phrase)');

  // 14. FIX 5: tryNextTime is a real usable line (not a meta-instruction)
  const tryNext = (feedback.tryNextTime||'').trim();
  const tryLower = tryNext.toLowerCase();
  const isMetaInstruction = [
    'focus on', 'try to be', 'make sure', 'be more', 'work on',
    'you should', 'instead of', 'next time focus', 'aim to'
  ].some(p => tryLower.startsWith(p));
  const isQuotable = tryNext.length > 15 && !isMetaInstruction;
  if (isQuotable) pass('tryNextTime: quotable real line');
  else fail('tryNextTime: quotable real line', `Got: "${tryNext.slice(0, 80)}"`);

  // 15. spokenSummary references something specific
  const summaryLower = (feedback.spokenSummary||'').toLowerCase();
  const transcriptWords = testCase.conversation
    .map(t => t.content.toLowerCase().split(/\s+/))
    .flat()
    .filter(w => w.length > 5);
  const summaryIsSpecific = transcriptWords.some(w => summaryLower.includes(w));
  if (summaryIsSpecific) pass('spokenSummary: references transcript content');
  else fail('spokenSummary: references transcript content', `Got: "${feedback.spokenSummary}"`);

  return results;
}

// ─── RUNNER ──────────────────────────────────────────────────────────────────

async function callCoach(body) {
  const response = await fetch(`${VERCEL_URL}/api/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { code: response.status, data };
}

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       EKLIPSES COACH EVALUATOR v3                        ║');
  console.log('║       6 scenarios — banned phrases — score — card fields ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let totalPass = 0, totalFail = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\n▶ [${testCase.scenarioKey.toUpperCase()}] ${testCase.name}`);
    console.log('─'.repeat(60));

    try {
      console.log(`  Calling: ${VERCEL_URL}/api/coach`);
      const { code, data } = await callCoach({
        conversation: testCase.conversation,
        scenarioTitle: testCase.scenarioTitle,
        scenarioKey: testCase.scenarioKey,
        opener: testCase.opener,
      });

      if (code !== 200 || data.error) {
        console.log(`  ❌ API ERROR: ${data.error || 'HTTP ' + code}`);
        totalFail++;
        continue;
      }

      console.log(`  Score: ${data.score}/10`);
      console.log(`  Part1: "${(data.part1||'').slice(0,70)}..."`);
      console.log(`  Part2 (${(data.part2||'').length}ch) Part3 (${(data.part3||'').length}ch) Part4 (${(data.part4||'').length}ch)`);

      const results = evaluate(testCase, data);
      console.log('\n  Checklist:');
      for (const r of results) {
        if (r.pass) {
          console.log(`    ✓ ${r.name}`);
          totalPass++;
        } else {
          console.log(`    ✗ ${r.name}`);
          if (r.detail) console.log(`      → ${r.detail}`);
          totalFail++;
        }
      }

      // Delay between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 4000));

    } catch (err) {
      console.log(`  ❌ EXCEPTION: ${err.message}`);
      totalFail++;
    }
  }

  const total = totalPass + totalFail;
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  FINAL: ${totalPass}/${total} checks passed${' '.repeat(35 - String(totalPass).length - String(total).length)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (totalFail === 0) {
    console.log('🎉 All checks passed! Ryan is clean.\n');
  } else {
    console.log(`⚠️  ${totalFail} checks failed. Review output above.\n`);
    process.exit(1);
  }
}

runAll();
