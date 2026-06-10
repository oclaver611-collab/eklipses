// test-wave3.js — Wave 3 character smoke test
// Calls api/character.js handler directly (no HTTP server needed)
// Uses Groq (no OpenAI key required)
// Usage: node test-wave3.js

require('dotenv').config();
const handler = require('./api/character');

// ── Character → scenario map ────────────────────────────────────────────────
const WAVE3 = [
  { id: 'camille',   scenario: 'farmers_market',      name: 'camille'   },
  { id: 'priya',     scenario: 'rooftop_pool',         name: 'priya'     },
  { id: 'valentina', scenario: 'wine_bar',             name: 'valentina' },
  { id: 'mei',       scenario: 'night_market',         name: 'mei'       },
  { id: 'amara',     scenario: 'dance_studio',         name: 'amara'     },
  { id: 'ingrid',    scenario: 'running_trail',        name: 'ingrid'    },
  { id: 'solene',    scenario: 'jazz_bar',             name: 'solène' },
  { id: 'keiko',     scenario: 'cherry_blossom_park',  name: 'keiko'     },
  { id: 'rania',     scenario: 'rooftop_terrace',      name: 'rania'     },
  { id: 'bianca',    scenario: 'pool_party',           name: 'bianca'    },
  { id: 'chloe',     scenario: 'university_library',   name: 'chloe'     },
  { id: 'nour',      scenario: 'spice_market',         name: 'nour'      },
  { id: 'astrid',    scenario: 'climbing_wall',        name: 'astrid'    },
  { id: 'layla',     scenario: 'sunday_brunch',        name: 'layla'     },
  { id: 'ines',      scenario: 'photography_exhibit',  name: 'inès' },
  { id: 'zara',      scenario: 'skate_park',           name: 'zara'      },
  { id: 'talia',     scenario: 'cooking_class',        name: 'talia'     },
  { id: 'miriam',    scenario: 'book_fair',            name: 'miriam'    },
  { id: 'suki',      scenario: 'flower_shop',          name: 'suki'      },
  { id: 'cara',      scenario: 'dog_park',             name: 'cara'      },
  { id: 'elif',      scenario: 'hammam_lobby',         name: 'elif'      },
  { id: 'aisha',     scenario: 'community_garden',     name: 'aisha'     },
  { id: 'fiona',     scenario: 'record_shop',          name: 'fiona'     },
  { id: 'celeste',   scenario: 'observatory_deck',     name: 'celeste'   },
  { id: 'naomi',     scenario: 'jazz_club',            name: 'naomi'     },
  { id: 'zola',      scenario: 'rooftop_filmmaker',    name: 'zola'      },
  { id: 'imani',     scenario: 'open_mic',             name: 'imani'     },
  { id: 'nia',       scenario: 'art_studio',           name: 'nia'       },
  { id: 'cleo',      scenario: 'beachside_cafe',       name: 'cleo'      },
  { id: 'sage',      scenario: 'independent_bookshop', name: 'sage'      },
  { id: 'kaia',      scenario: 'airport_gate',         name: 'kaia'      },
];

// Sofia bleedthrough markers — if any appear, character fell back to sofia
const SOFIA_MARKERS = ['sofia', 'beach', 'shoreline', 'writing'];

// Normalize: strip accents, lowercase
function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Mock the handler — returns { status, data }
function callHandler(scenarioKey, characterId, userMessage, history = []) {
  return new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      body: { userMessage, scenarioKey, characterId, history, useModel: '70b' },
      headers: {
        'x-dev-key': process.env.DEV_BYPASS_KEY || '',
        'x-forwarded-for': '127.0.0.1',
      },
      socket: { remoteAddress: '127.0.0.1' },
      query: {},
    };

    let statusCode = 200;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { resolve({ status: statusCode, data }); },
      setHeader() { return this; },
      end(data) { resolve({ status: statusCode, data: data || {} }); },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Test runner ──────────────────────────────────────────────────────────────
async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         WAVE 3 CHARACTER SMOKE TEST                     ║');
  console.log(`║         ${WAVE3.length} characters × 2 checks each                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const char of WAVE3) {
    process.stdout.write(`  ${char.id.padEnd(12)}`);

    // ── Check 1: "hi" → own name, no sofia bleedthrough ──
    let hiResult, hiReply;
    try {
      hiResult = await callHandler(char.scenario, char.id, 'hi');
      hiReply = (hiResult.data?.response || '').trim();
    } catch (e) {
      hiReply = '';
    }

    const hiChecks = {
      notEmpty:    hiReply.length > 0,
      noSofia:     !SOFIA_MARKERS.some(m => hiReply.toLowerCase().includes(m)),
      hasName:     norm(hiReply).includes(norm(char.name)),
    };

    await sleep(800); // Groq rate limit buffer

    // ── Check 2: "what's your name" → name in response ──
    let nameResult, nameReply;
    try {
      nameResult = await callHandler(
        char.scenario, char.id, "What is your name"
        // no history — fresh context so character introduces herself cleanly
      );
      nameReply = (nameResult.data?.response || '').trim();
    } catch (e) {
      nameReply = '';
    }

    const nameChecks = {
      notEmpty:    nameReply.length > 0,
      hasName:     norm(nameReply).includes(norm(char.name)),
    };

    await sleep(1200);

    // ── Tally ──
    const allPass = Object.values(hiChecks).every(Boolean) &&
                    Object.values(nameChecks).every(Boolean);

    if (allPass) {
      passed++;
      console.log(`  PASS  hi="${hiReply.slice(0,40)}"`);
    } else {
      failed++;
      const why = [];
      if (!hiChecks.notEmpty)  why.push('hi:empty');
      if (!hiChecks.noSofia)   why.push(`hi:sofia-bleed("${hiReply.slice(0,50)}")`);
      if (!hiChecks.hasName)   why.push(`hi:no-name("${hiReply.slice(0,50)}")`);
      if (!nameChecks.notEmpty) why.push('name:empty');
      if (!nameChecks.hasName)  why.push(`name:no-name("${nameReply.slice(0,50)}")`);
      console.log(`  FAIL  ${why.join(' | ')}`);
      failures.push({ char: char.id, why, hiReply, nameReply });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`  ${passed} passed  /  ${failed} failed  /  ${WAVE3.length} total`);

  if (failures.length) {
    console.log('\n  FAILURES DETAIL:');
    for (const f of failures) {
      console.log(`\n  ${f.char}:`);
      f.why.forEach(w => console.log(`    • ${w}`));
      if (f.hiReply)   console.log(`    hi reply:   "${f.hiReply}"`);
      if (f.nameReply) console.log(`    name reply: "${f.nameReply}"`);
    }
  }

  console.log('──────────────────────────────────────────────────────────\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
