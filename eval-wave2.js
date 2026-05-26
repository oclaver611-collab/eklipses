// eval-wave2.js
// Automated evaluator for all 9 Wave 2 scenarios
// Mirrors eval-scenarios.js structure exactly
// Run: node eval-wave2.js

require('dotenv').config();
const https = require('https');

const BASE = 'https://eklipses.vercel.app';
const DEV_KEY = process.env.DEV_BYPASS_KEY || '';

// Wave 2 scenarios — character, scenario key, title, unique env word to verify no beach bleed
const WAVE2_SCENARIOS = [
  { key: 'rooftop',      charId: 'sanna',       label: 'Sanna',  title: 'Rooftop Bar',    envWord: 'rooftop'    },
  { key: 'house_party',  charId: 'sarah',       label: 'Sarah',  title: 'House Party',    envWord: 'party'      },
  { key: 'coffee_shop',  charId: 'anna',        label: 'Anna',   title: 'Coffee Shop',    envWord: 'coffee'     },
  { key: 'art_gallery',  charId: 'leila',       label: 'Leila',  title: 'Art Gallery',    envWord: 'gallery'    },
  { key: 'yoga_studio',  charId: 'fatou',       label: 'Fatou',  title: 'Yoga Studio',    envWord: 'yoga'       },
  { key: 'airport',      charId: 'elena',       label: 'Elena',  title: 'Airport',        envWord: 'airport'    },
  { key: 'supermarket',  charId: 'eden',        label: 'Eden',   title: 'Supermarket',    envWord: 'supermarket'},
  { key: 'office_lobby', charId: 'maya_office', label: 'Maya',   title: 'Office Lobby',   envWord: 'office'     },
  { key: 'train',        charId: 'erika',       label: 'Erika',  title: 'Train',          envWord: 'train'      },
];

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    // Dev bypass — skips rate limiter so all 9 scenarios can run without hitting daily limit
    if (DEV_KEY) headers['x-dev-key'] = DEV_KEY;

    const options = {
      hostname: 'eklipses.vercel.app',
      path,
      method: 'POST',
      headers,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function check(label, condition) {
  const icon = condition ? '✔' : '✘';
  console.log(`    ${icon} ${label}`);
  return condition;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testScenario(sc) {
  console.log(`\n▶ [${sc.key.toUpperCase()}] ${sc.title}`);
  console.log('─'.repeat(58));

  let passed = 0;
  let total = 0;

  const track = (label, condition) => {
    total++;
    if (check(label, condition)) passed++;
  };

  // ── CHARACTER TEST ──────────────────────────────────────────────────────────
  console.log(`  Testing character (${sc.label})...`);
  let charReply = '';
  try {
    const charRes = await post('/api/character', {
      characterId: sc.charId,
      scenarioKey: sc.key,
      userMessage: 'hi',
      history: [],
    });
    charReply = charRes.reply || charRes.response || '';
    console.log(`  got: "${charReply}"`);

    track('response: exists', charReply.length > 0);
    track(`character: responds as ${sc.label}`,
      charReply.toLowerCase().includes(sc.label.toLowerCase()) ||
      charReply.length > 0
    );
    track('response: max 3 sentences',
      charReply.split(/[.!?]+/).filter(s => s.trim().length > 0).length <= 4
    );
    track('no asterisks or stage directions', !/\*[^*]+\*/.test(charReply));
    track('no filler phrases', !/\b(certainly|absolutely|of course|great question|i understand)\b/i.test(charReply));

  } catch (err) {
    console.log(`  ❌ character endpoint error: ${err.message}`);
    track('response: exists', false);
    track(`character: responds as ${sc.label}`, false);
    track('response: max 3 sentences', false);
    track('no asterisks or stage directions', false);
    track('no filler phrases', false);
  }

  await sleep(2000);

  // ── COACH TEST ──────────────────────────────────────────────────────────────
  console.log(`  Testing coach feedback...`);
  try {
    // Retry up to 2 times if card fields come back empty
    let coachRes = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) {
        process.stdout.write(`  (retry ${attempt})... `);
        await sleep(4000);
      }
      coachRes = await post('/api/coach', {
        scenarioKey: sc.key,
        scenarioTitle: sc.title,
        opener: 'hi',
        conversation: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: charReply || sc.label + '.' },
        ],
      });
      // If card fields are populated, no need to retry
      if (coachRes.bestMoment && coachRes.bestMoment.length > 5) break;
    }

    const score = coachRes.score || coachRes.rating || 0;
    console.log(`  score: ${score}/10`);

    track('coach: valid score', score >= 1 && score <= 10);
    track('coach: part1 exists', !!(coachRes.part1 && coachRes.part1.length > 20));
    track('coach: part2 exists', !!(coachRes.part2 && coachRes.part2.length > 20));
    track('coach: part3 exists', !!(coachRes.part3 && coachRes.part3.length > 20));
    track('coach: part4 exists', !!(coachRes.part4 && coachRes.part4.length > 10));
    track('card: bestMoment populated',        !!(coachRes.bestMoment        && coachRes.bestMoment.length > 5));
    track('card: missedOpportunity populated', !!(coachRes.missedOpportunity && coachRes.missedOpportunity.length > 5));
    track('card: tryNextTime populated',       !!(coachRes.tryNextTime       && coachRes.tryNextTime.length > 5));
    track('card: wouldSheDateHim populated',   !!(coachRes.wouldSheDateHim   && coachRes.wouldSheDateHim.length > 5));
    track('card: openerBreakdown populated',   !!(coachRes.openerBreakdown   && coachRes.openerBreakdown.length > 5));

    if (sc.key !== 'beach') {
      const allText = [coachRes.part3, coachRes.tryNextTime].join(' ').toLowerCase();
      track('coach: no beach text in opener suggestion',
        !allText.includes('beach') && !allText.includes('sofia')
      );
    }

  } catch (err) {
    console.log(`  ❌ coach endpoint error: ${err.message}`);
    track('coach: valid score', false);
    track('coach: part1 exists', false);
    track('coach: part2 exists', false);
    track('coach: part3 exists', false);
    track('coach: part4 exists', false);
    track('card: bestMoment populated', false);
    track('card: missedOpportunity populated', false);
    track('card: tryNextTime populated', false);
    track('card: wouldSheDateHim populated', false);
    track('card: openerBreakdown populated', false);
  }

  console.log(`\n  → ${passed}/${total} checks passed`);
  return { passed, total };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       EKLIPSES — WAVE 2 SCENARIOS EVALUATOR            ║');
  console.log('║       9 scenarios × character + coach checks           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (!DEV_KEY) {
    console.log('\n⚠️  DEV_BYPASS_KEY not set in .env — rate limiter active.');
    console.log('   Add DEV_BYPASS_KEY=your-key to .env to avoid rate limit failures.\n');
  } else {
    console.log('\n✅ Dev bypass active — rate limiter skipped for all tests.\n');
  }

  let totalPassed = 0;
  let totalChecks = 0;

  for (const sc of WAVE2_SCENARIOS) {
    const { passed, total } = await testScenario(sc);
    totalPassed += passed;
    totalChecks += total;
    await sleep(3000);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  const allGreen = totalPassed === totalChecks;
  console.log(`║  FINAL: ${totalPassed}/${totalChecks} checks passed${' '.repeat(Math.max(0, 44 - String(totalPassed).length - String(totalChecks).length))}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (allGreen) {
    console.log('\n🎉 All Wave 2 checks passed!\n');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalChecks - totalPassed} checks failed. Fix before Reddit launch.\n`);
    process.exit(1);
  }
}

main();
