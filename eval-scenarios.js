// eval-scenarios.js — Tests all 6 scenarios end-to-end
// Checks: correct character name, feedback card fields, scenario-specific opener suggestions
// Run with: node eval-scenarios.js

require('dotenv').config();

const VERCEL_URL = process.env.VERCEL_URL || 'https://eklipses.vercel.app';
const DEV_KEY = process.env.DEV_BYPASS_KEY || '';
const DELAY_MS = 3000; // reduced from 12s — dev bypass means no rate limit

const SCENARIOS = [
  { key: 'beach',     title: 'Beach — Cold Open',      expectedCharacter: 'sofia',    expectedCharacterDisplay: 'Sofia',    forbidBeachInOpener: false },
  { key: 'bar',       title: 'Bar — Night Out',         expectedCharacter: 'ava',      expectedCharacterDisplay: 'Ava',      forbidBeachInOpener: true  },
  { key: 'museum',    title: 'Museum — Quiet Opener',   expectedCharacter: 'isabelle', expectedCharacterDisplay: 'Isabelle', forbidBeachInOpener: true  },
  { key: 'gym',       title: 'Gym — Between Sets',      expectedCharacter: 'zoe',      expectedCharacterDisplay: 'Zoe',      forbidBeachInOpener: true  },
  { key: 'bookstore', title: 'Bookstore — Quiet Browse',expectedCharacter: 'nadia',    expectedCharacterDisplay: 'Nadia',    forbidBeachInOpener: true  },
  { key: 'street',    title: 'Street — Quick Stop',     expectedCharacter: 'julia',    expectedCharacterDisplay: 'Julia',    forbidBeachInOpener: true  },
];

function makeConversation(characterName) {
  return [
    { role: 'user',      content: 'hi what is your name' },
    { role: 'assistant', content: `${characterName}.` },
    { role: 'user',      content: `nice to meet you ${characterName} my name is Paul what are you up to` },
    { role: 'assistant', content: 'Just passing time. What about you?' },
    { role: 'user',      content: 'same here I work in IT pretty busy but I like to relax sometimes' },
    { role: 'assistant', content: 'That sounds like a lot. What do you do to unwind?' },
    { role: 'user',      content: 'I come to places like this honestly you seem interesting what do you do' },
    { role: 'assistant', content: 'I have my own thing going on. What made you come over?' },
    { role: 'user',      content: 'I just thought you seemed interesting and wanted to talk maybe we can grab coffee sometime' },
    { role: 'assistant', content: "Maybe. Let's see how this goes first." },
  ];
}

const delay = ms => new Promise(r => setTimeout(r, ms));

function makeHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (DEV_KEY) h['x-dev-key'] = DEV_KEY;
  return h;
}

async function callCharacter(scenarioKey, characterId, userMessage, history = []) {
  const res = await fetch(`${VERCEL_URL}/api/character`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify({ userMessage, scenarioKey, characterId, history }),
  });
  if (!res.ok) throw new Error(`character API ${res.status}`);
  return res.json();
}

async function callCoach(scenarioKey, scenarioTitle, characterName, retries = 2) {
  const conversation = makeConversation(characterName);
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      process.stdout.write(`  (retry ${attempt})... `);
      await delay(6000);
    }
    try {
      const res = await fetch(`${VERCEL_URL}/api/coach`, {
        method: 'POST',
        headers: makeHeaders(),
        body: JSON.stringify({ conversation, scenarioTitle, scenarioKey, opener: 'hi what is your name' }),
      });
      if (!res.ok) { if (attempt < retries) continue; throw new Error(`coach API ${res.status}`); }
      const data = await res.json();
      if (!data.bestMoment || data.bestMoment === 'undefined') { if (attempt < retries) continue; }
      return data;
    } catch (err) {
      if (attempt < retries) continue;
      throw err;
    }
  }
}

function checkCharacter(scenario, response) {
  const results = [];
  const pass = name => results.push({ name, pass: true });
  const fail = (name, detail) => results.push({ name, pass: false, detail });
  const text = (response.response || '').trim();

  if (text.length > 0) pass('response: exists');
  else { fail('response: exists', 'Empty response'); return results; }

  const nameUpper = scenario.expectedCharacterDisplay;
  if (text.toLowerCase().includes(nameUpper.toLowerCase())) pass(`character: responds as ${nameUpper}`);
  else fail(`character: responds as ${nameUpper}`, `Expected "${nameUpper}" in response but got: "${text}"`);

  if (scenario.expectedCharacter !== 'sofia') {
    if (text.toLowerCase().includes('sofia')) fail('character: not Sofia fallback', `Response contains "Sofia": "${text}"`);
    else pass('character: not Sofia fallback');
  }

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 3) pass('response: max 3 sentences');
  else fail('response: max 3 sentences', `Got ${sentences.length} sentences: "${text}"`);

  return results;
}

function checkCoach(scenario, feedback) {
  const results = [];
  const pass = name => results.push({ name, pass: true });
  const fail = (name, detail) => results.push({ name, pass: false, detail });

  if (feedback.score >= 1 && feedback.score <= 10) pass('coach: valid score');
  else fail('coach: valid score', `Score is ${feedback.score}`);

  if (feedback.part1) pass('coach: part1 exists'); else fail('coach: part1 exists', 'part1 missing');
  if (feedback.part2) pass('coach: part2 exists'); else fail('coach: part2 exists', 'part2 missing');
  if (feedback.part3) pass('coach: part3 exists'); else fail('coach: part3 exists', 'part3 missing');
  if (feedback.part4) pass('coach: part4 exists'); else fail('coach: part4 exists', 'part4 missing');

  if (feedback.bestMoment        && feedback.bestMoment !== '---')        pass('card: bestMoment populated');        else fail('card: bestMoment populated',        `Got: "${feedback.bestMoment}"`);
  if (feedback.missedOpportunity && feedback.missedOpportunity !== '---') pass('card: missedOpportunity populated'); else fail('card: missedOpportunity populated', `Got: "${feedback.missedOpportunity}"`);
  if (feedback.tryNextTime       && feedback.tryNextTime !== '---')       pass('card: tryNextTime populated');       else fail('card: tryNextTime populated',       `Got: "${feedback.tryNextTime}"`);
  if (feedback.wouldSheDateHim   && feedback.wouldSheDateHim !== '---')   pass('card: wouldSheDateHim populated');   else fail('card: wouldSheDateHim populated',   `Got: "${feedback.wouldSheDateHim}"`);

  if (scenario.forbidBeachInOpener) {
    const part1Lower = (feedback.part1 || '').toLowerCase();
    if (part1Lower.includes('whole beach') || part1Lower.includes('quiet spot on this whole beach'))
      fail('coach: no beach text in opener suggestion', `part1 contains beach-specific text in ${scenario.key} scenario`);
    else pass('coach: no beach text in opener suggestion');
  }

  if (feedback.openerBreakdown && feedback.openerBreakdown !== '---') pass('card: openerBreakdown populated');
  else fail('card: openerBreakdown populated', `Got: "${feedback.openerBreakdown}"`);

  return results;
}

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       EKLIPSES — ALL-SCENARIOS EVALUATOR                ║');
  console.log('║       6 scenarios × character + coach checks            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!DEV_KEY) {
    console.log('⚠️  DEV_BYPASS_KEY not set — rate limiter active, last scenarios may fail.\n');
  } else {
    console.log('✅ Dev bypass active — rate limiter skipped for all tests.\n');
  }

  let totalPass = 0, totalFail = 0;

  for (const scenario of SCENARIOS) {
    console.log(`\n▶ [${scenario.key.toUpperCase()}] ${scenario.title}`);
    console.log('─'.repeat(58));

    try {
      process.stdout.write(`  Testing character (${scenario.expectedCharacterDisplay})... `);
      const charData = await callCharacter(scenario.key, scenario.expectedCharacter, 'hi', []);
      console.log(`got: "${(charData.response||'').slice(0, 50)}"`);
      const charResults = checkCharacter(scenario, charData);
      for (const r of charResults) {
        if (r.pass) { console.log(`    ✔ ${r.name}`); totalPass++; }
        else { console.log(`    ✘ ${r.name}`); if (r.detail) console.log(`      → ${r.detail}`); totalFail++; }
      }
    } catch (err) {
      console.log(`❌ CHARACTER ERROR: ${err.message}`);
      totalFail++;
    }

    await delay(DELAY_MS);

    try {
      process.stdout.write(`  Testing coach feedback... `);
      const coachData = await callCoach(scenario.key, scenario.title, scenario.expectedCharacterDisplay);
      console.log(`score: ${coachData.score}/10`);
      const coachResults = checkCoach(scenario, coachData);
      for (const r of coachResults) {
        if (r.pass) { console.log(`    ✔ ${r.name}`); totalPass++; }
        else { console.log(`    ✘ ${r.name}`); if (r.detail) console.log(`      → ${r.detail}`); totalFail++; }
      }
    } catch (err) {
      console.log(`❌ COACH ERROR: ${err.message}`);
      totalFail++;
    }

    await delay(DELAY_MS);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  FINAL: ${totalPass} passed, ${totalFail} failed${' '.repeat(35 - String(totalPass + totalFail).length)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (totalFail === 0) {
    console.log('🎉 All scenario checks passed!\n');
  } else {
    console.log(`⚠️  ${totalFail} checks failed. Review output above.\n`);
    process.exit(1);
  }
}

runAll();
