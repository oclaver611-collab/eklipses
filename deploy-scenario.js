// deploy-scenario.js — Eklipses Scenario Deployer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Takes a scenario .txt file from gen-scenario-v2.js and patches
// player.js, scenarios.js, and api/character.js automatically.
//
// USAGE:
//   Full deploy (new avatar assets):
//     node deploy-scenario.js scenario-bookshopRemi.txt
//
//   Test deploy (borrow existing avatar — no new assets needed):
//     node deploy-scenario.js scenario-bookshopRemi.txt --borrow sofia
//     node deploy-scenario.js scenario-bookshopRemi.txt --borrow ava
//
//   Undo last deploy:
//     node deploy-scenario.js --undo
//
// WHAT IT DOES:
//   1. Parses the scenario .txt file (output from gen-scenario-v2.js)
//   2. Patches SCENARIO_CHARACTER_MAP in player.js
//   3. Patches AVATAR_SETS in player.js
//   4. Patches CHARACTERS in api/character.js
//   5. Patches SETTINGS in api/character.js
//   6. Patches charNames map in api/character.js
//   7. Patches window.SCENARIOS in scenarios.js
//   8. Runs npm test
//   9. Git commits + pushes

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLAYER_JS    = path.join(__dirname, 'player.js');
const SCENARIOS_JS = path.join(__dirname, 'scenarios.js');
const CHARACTER_JS = path.join(__dirname, 'api', 'character.js');
const BACKUP_FILE  = path.join(__dirname, '.deploy-backup.json');

// ─── ARG PARSING ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Eklipses Scenario Deployer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USAGE:
  Deploy with new avatar assets (full):
    node deploy-scenario.js scenario-bookshopRemi.txt

  Deploy borrowing an existing avatar (for testing):
    node deploy-scenario.js scenario-bookshopRemi.txt --borrow sofia
    node deploy-scenario.js scenario-bookshopRemi.txt --borrow ava

  Undo last deploy:
    node deploy-scenario.js --undo
`);
  process.exit(0);
}

// ─── UNDO MODE ────────────────────────────────────────────────────────────────

if (args[0] === '--undo') {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error('❌ No backup found. Nothing to undo.');
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  console.log(`\n↩️  Undoing deploy of "${backup.scenarioKey}"...`);
  fs.writeFileSync(PLAYER_JS, backup.player, 'utf8');
  fs.writeFileSync(SCENARIOS_JS, backup.scenarios, 'utf8');
  fs.writeFileSync(CHARACTER_JS, backup.character, 'utf8');
  fs.unlinkSync(BACKUP_FILE);
  console.log('✅ Files restored to pre-deploy state.');

  try {
    execSync('npm test', { stdio: 'inherit' });
    console.log('\n✅ Tests pass after undo.');
  } catch {
    console.error('\n⚠️  Tests failed after undo — check manually.');
  }

  try {
    execSync(`git add -A && git commit -m "revert: remove ${backup.scenarioKey} scenario" && git push`, { stdio: 'inherit' });
    console.log('✅ Reverted and pushed.');
  } catch (e) {
    console.error('⚠️  Git push failed:', e.message);
  }
  process.exit(0);
}

// ─── PARSE ARGS ───────────────────────────────────────────────────────────────

const txtFile = args[0];
const borrowIdx = args.indexOf('--borrow');
const borrowId = borrowIdx !== -1 ? args[borrowIdx + 1] : null;

if (!fs.existsSync(txtFile)) {
  console.error(`❌ File not found: ${txtFile}`);
  process.exit(1);
}

// ─── EXISTING AVATAR DATA ─────────────────────────────────────────────────────
// Used when --borrow is passed — maps id to R2 URLs

const EXISTING_AVATARS = {
  sofia:    { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_thumb.jpg',    speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_speaking.mp4',    idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_idle.mp4'    },
  ava:      { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Ava_thumb.jpg',      speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Ava_speaking.mp4',      idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Ava_idle.mp4'      },
  isabelle: { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Isabelle_thumb.jpg', speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Isabelle_speaking.mp4', idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Isabelle_idle.mp4' },
  zoe:      { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/zoe_thumb.jpg',      speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/zoe_speaking.mp4',      idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/zoe_idle.mp4'      },
  sanna:    { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Sanna_thumb.jpg',    speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sanna_speaking.mp4',    idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sanna_idle.mp4'    },
  anna:     { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Anna_thumb.jpg',     speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/anna_speaking.mp4',     idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/anna_idle.mp4'     },
  elena:    { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Elena_thumb.jpg',    speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/elena_speaking.mp4',    idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/elena_idle.mp4'    },
  erika:    { thumb: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Erika_thumb.jpg',    speaking: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/erika_speaking.mp4',    idle: 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/erika_idle.mp4'    },
};

// ─── PARSE SCENARIO TXT ───────────────────────────────────────────────────────

function parseTxt(content) {
  // Extract key metadata
  const scenarioKeyMatch = content.match(/\*\*SCENARIO KEY:\*\*\s*`?([a-zA-Z0-9_]+)`?/);
  const charNameMatch    = content.match(/\*\*CHARACTER NAME:\*\*\s*([A-Za-z_]+)/);
  const difficultyMatch  = content.match(/\*\*DIFFICULTY:\*\*\s*(Easy|Medium|Hard)/i);
  const coreDynamicMatch = content.match(/\*\*CORE DYNAMIC:\*\*\s*(.+)/);

  if (!scenarioKeyMatch || !charNameMatch) {
    throw new Error('Could not find SCENARIO KEY or CHARACTER NAME in the txt file. Make sure it was generated by gen-scenario-v2.js');
  }

  const scenarioKey  = scenarioKeyMatch[1];
  const charName     = charNameMatch[1];
  const charId       = charName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const difficulty   = difficultyMatch?.[1] || 'Medium';
  const coreDynamic  = coreDynamicMatch?.[1]?.trim() || '';

  // Extract BLOCK 1 — scenarios.js entry (grab the JS object inside ```)
  const block1Match = content.match(/BLOCK 1[^`]*```javascript\s*([\s\S]*?)```/);
  const block3Match = content.match(/BLOCK 3[^`]*```javascript\s*([\s\S]*?)```/);
  const block4Match = content.match(/BLOCK 4[^`]*```javascript\s*([\s\S]*?)```/);
  const block6Match = content.match(/BLOCK 6[^`]*```(?:javascript)?\s*([\s\S]*?)```/);
  const block8Match = content.match(/BLOCK 8[^`]*```javascript\s*([\s\S]*?)```/);
  const block9Match = content.match(/BLOCK 9[^`]*```javascript\s*([\s\S]*?)```/);

  // Extract opening line for HeyGen (block 6 — just the text, no stage directions)
  let openingLine = '';
  if (block6Match) {
    openingLine = block6Match[1]
      .replace(/^\*[^*]+\*\s*/gm, '') // remove *stage directions*
      .replace(/^"([\s\S]*)"$/s, '$1') // strip outer quotes
      .trim();
  }

  // Extract background URL from block 1
  let bgUrl = '';
  if (block1Match) {
    const bgMatch = block1Match[1].match(/backgroundUrl:\s*["']([^"']+)["']/);
    if (bgMatch) bgUrl = bgMatch[1];
  }

  // Extract thumb URL from block 1
  let thumbUrl = '';
  if (block1Match) {
    const thumbMatch = block1Match[1].match(/thumbUrl:\s*["']([^"']+)["']/);
    if (thumbMatch) thumbUrl = thumbMatch[1];
  }

  // Extract title + subtitle from block 1
  let title = '', subtitle = '', characterAge = 27, characterJob = '';
  if (block1Match) {
    const titleMatch    = block1Match[1].match(/title:\s*["']([^"']+)["']/);
    const subMatch      = block1Match[1].match(/subtitle:\s*["']([^"']+)["']/);
    const ageMatch      = block1Match[1].match(/characterAge:\s*(\d+)/);
    const jobMatch      = block1Match[1].match(/characterJob:\s*["']([^"']+)["']/);
    if (titleMatch)  title        = titleMatch[1];
    if (subMatch)    subtitle     = subMatch[1];
    if (ageMatch)    characterAge = parseInt(ageMatch[1]);
    if (jobMatch)    characterJob = jobMatch[1];
  }

  // Extract opening description from block 1
  let openingDescription = '';
  if (block1Match) {
    const descMatch = block1Match[1].match(/openingDescription:\s*["']([^"']+)["']/s);
    if (descMatch) openingDescription = descMatch[1];
  }

  // Extract rescue lines from block 8
  let rescueLines = ['...', '...', '...'];
  if (block8Match) {
    const lineMatches = [...block8Match[1].matchAll(/["']([^"']{10,}?)["']/g)];
    if (lineMatches.length >= 3) rescueLines = lineMatches.slice(0, 3).map(m => m[1]);
  }

  // Extract impatience lines from block 9
  let impatienceLines = ['...', '...', '...'];
  if (block9Match) {
    const lineMatches = [...block9Match[1].matchAll(/["']([^"']{10,}?)["']/g)];
    if (lineMatches.length >= 3) impatienceLines = lineMatches.slice(0, 3).map(m => m[1]);
  }

  // Extract character identity (block 3) — the full text string for CHARACTERS object
  let characterBlock = block3Match?.[1]?.trim() || '';
  // Extract the personality/identity as a text prompt for character.js
  // We'll build a simplified text prompt from the block 3 content
  let characterPrompt = buildCharacterPrompt(characterBlock, charName, characterAge, characterJob, difficulty);

  // Extract setting (block 4)
  let settingPrompt = buildSettingPrompt(block4Match?.[1]?.trim() || '', charName);

  return {
    scenarioKey, charName, charId, difficulty, coreDynamic,
    title, subtitle, characterAge, characterJob, openingDescription,
    bgUrl, thumbUrl, openingLine,
    rescueLines, impatienceLines,
    characterPrompt, settingPrompt,
    rawBlock3: characterBlock,
    rawBlock4: block4Match?.[1]?.trim() || '',
  };
}

function buildCharacterPrompt(block3, charName, age, job, difficulty) {
  // Extract key fields from the block 3 JS object to build the character text prompt
  const personalityMatch = block3.match(/personality[:\s]+(?:\[)?([\s\S]*?)(?:\]|conversationStyle)/);
  const styleMatch = block3.match(/conversationStyle[:\s"']+([^"',\n]+(?:[^"']*)?)/);
  const interestsMatch = [...(block3.matchAll(/["']([^"']{15,}?)["']/g))].map(m => m[1]).slice(0, 5);
  const dealbreakersMatch = [...(block3.matchAll(/dealBreakers[:\s\[]*["']([^"']+)["']/g))].map(m => m[1]);

  return `Your name is ${charName}. You are ${age}.
${job ? `You work as a ${job}.` : ''}

YOUR PERSONALITY:
${personalityMatch ? personalityMatch[1].replace(/["',\[\]]/g, '').replace(/\s+/g, ' ').trim() : 'Intelligent, self-contained, curious about people who earn your attention.'}

HOW YOU TALK:
${styleMatch ? styleMatch[1].trim() : 'Direct and measured. You respond to what\'s real, not what\'s performed.'}

WHAT INTERESTS YOU:
${interestsMatch.slice(0, 4).map(i => `- ${i}`).join('\n')}

WHAT PUTS YOU OFF:
${dealbreakersMatch.slice(0, 3).map(d => `- ${d}`).join('\n') || '- Trying too hard\n- Generic openers\n- Being put on a pedestal'}

HOW YOU TALK:
- 1-2 sentences maximum. Always.
- IRREGULAR rhythm. One word. A trailing thought. A redirect mid-sentence.
- NOT a question machine. Sometimes just an observation. Let silence sit.
- No filler words. No "Oh wow!" or "That's amazing!"
- SPOKEN WORDS ONLY. No asterisks. No stage directions.`;
}

function buildSettingPrompt(block4, charName) {
  const locationMatch = block4.match(/location[:\s"']+([^"',\n}]+)/);
  const atmosphereMatch = block4.match(/atmosphere[:\s"']+([^"',\n}]+)/);
  const timeMatch = block4.match(/timeOfDay[:\s"']+([^"',\n}]+)/);
  const whyMatch = block4.match(/why[A-Za-z]*[:\s"']+([^"']+?)["']/);

  return `SETTING: ${locationMatch ? locationMatch[1].trim() : 'A public place'}.
${atmosphereMatch ? atmosphereMatch[1].trim() + '.' : ''}
${timeMatch ? timeMatch[1].trim() + '.' : ''}
${whyMatch ? charName + ' is here because: ' + whyMatch[1].trim() : ''}
A man just spoke to you.`;
}

// ─── BACKUP ───────────────────────────────────────────────────────────────────

function makeBackup(scenarioKey) {
  const backup = {
    scenarioKey,
    timestamp: new Date().toISOString(),
    player:    fs.readFileSync(PLAYER_JS, 'utf8'),
    scenarios: fs.readFileSync(SCENARIOS_JS, 'utf8'),
    character: fs.readFileSync(CHARACTER_JS, 'utf8'),
  };
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup), 'utf8');
  console.log(`  💾 Backup saved to .deploy-backup.json`);
}

// ─── PATCH FUNCTIONS ──────────────────────────────────────────────────────────

function patchScenarioCharacterMap(content, scenarioKey, charId) {
  // Insert after the last entry before the closing };
  const target = `  train:        'erika',\n};`;
  const replacement = `  train:        'erika',\n  ${scenarioKey}:  '${charId}',\n};`;
  if (content.includes(`${scenarioKey}:`)) {
    console.log(`  ⚠️  ${scenarioKey} already in SCENARIO_CHARACTER_MAP — skipping`);
    return content;
  }
  return content.replace(target, replacement);
}

function patchAvatarSets(content, scenario, borrowUrls) {
  const { charId, charName, thumbUrl, difficulty } = scenario;
  const thumb    = borrowUrls ? borrowUrls.thumb    : thumbUrl;
  const speaking = borrowUrls ? borrowUrls.speaking : `https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/${charName}_speaking.mp4`;
  const idle     = borrowUrls ? borrowUrls.idle     : `https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/${charName}_idle.mp4`;

  const newEntry = `  { id:'${charId}', label:'${charName}', thumb:'${thumb}', maryVideo:'${speaking}', maryIdleVideo:'${idle}', danielVideo:'${idle}', vibe:'${difficulty} scenario', scenario:'${scenario.title}' },`;

  // Insert before the closing ];
  const target = `];\n\nconst AVATARS`;
  if (content.includes(`id:'${charId}'`)) {
    console.log(`  ⚠️  ${charId} already in AVATAR_SETS — skipping`);
    return content;
  }
  return content.replace(target, `${newEntry}\n];\n\nconst AVATARS`);
}

function patchCharacterJs(content, scenario) {
  const { charId, charName, characterPrompt, settingPrompt, scenarioKey } = scenario;

  // 1. Add to CHARACTERS object — insert before the closing };  of CHARACTERS
  const charsEnd = `\n  };\n\n  // ════════════════════════════════════════════════════════════════════════════\n  // LAYER 2`;
  if (!content.includes(`${charId}:\``)) {
    const newChar = `\n\n    ${charId}: \`${characterPrompt}\`,`;
    content = content.replace(charsEnd, newChar + charsEnd);
  } else {
    console.log(`  ⚠️  ${charId} already in CHARACTERS — skipping`);
  }

  // 2. Add to SETTINGS object — insert before the closing };  of SETTINGS
  const settingsEnd = `\n  };\n\n  // ════════════════════════════════════════════════════════════════════════════\n  // LAYER 3`;
  if (!content.includes(`${scenarioKey}:\``)) {
    const newSetting = `\n\n    ${scenarioKey}: \`${settingPrompt}\`,`;
    content = content.replace(settingsEnd, newSetting + settingsEnd);
  } else {
    console.log(`  ⚠️  ${scenarioKey} already in SETTINGS — skipping`);
  }

  // 3. Add to charNames map
  const charNamesEnd = `  };\n  const charName`;
  if (!content.includes(`${charId}:`)) {
    const newCharName = `    ${charId}: '${charName.toLowerCase()}',\n  `;
    content = content.replace(charNamesEnd, newCharName + charNamesEnd);
  }

  return content;
}

function patchScenariosJs(content, scenario) {
  const { scenarioKey, title, subtitle, thumbUrl, bgUrl, difficulty, openingDescription, rescueLines, impatienceLines, openingLine, charName } = scenario;

  const diffNum = difficulty === 'Easy' ? 1 : difficulty === 'Hard' ? 3 : 2;

  const newScenario = `
  ${scenarioKey}: {
    title: "${title}",
    subtitle: "${subtitle}",
    thumb: "${thumbUrl}",
    bg: "${bgUrl}",
    coldOpen: true,
    category: "dating",
    difficulty: ${diffNum},
    duration_min: 10,
    demo: [
      { speaker:"Ryan",   text:"${openingDescription.slice(0, 120).replace(/"/g, "'")}" },
      { speaker:"Ryan",   text:"Watch how this goes." },
      { speaker:"Mary",   text:"${openingLine.slice(0, 150).replace(/"/g, "'")}" },
      { speaker:"Ryan",   text:"Pay attention to how she opened. What does it tell you about her?" }
    ],
    practice: [
      { speaker:"Ryan", text:"${openingDescription.slice(0, 120).replace(/"/g, "'")}" },
      { speaker:"Ryan", text:"${charName} is right there. The moment is yours." },
      { speaker:"Ryan", text:"What do you do?" }
    ],
    freeConversation: {
      rescueLines: ${JSON.stringify(rescueLines, null, 6).replace(/\n/g, '\n      ')},
      impatienceLines: ${JSON.stringify(impatienceLines, null, 6).replace(/\n/g, '\n      ')},
    },
    seedViews: ${Math.floor(Math.random() * 800) + 200},
    seedLikes: ${Math.floor(Math.random() * 80) + 20},
  },`;

  // Insert before closing }; of window.SCENARIOS
  const target = `\n};\n`;
  if (content.includes(`  ${scenarioKey}:`)) {
    console.log(`  ⚠️  ${scenarioKey} already in scenarios.js — skipping`);
    return content;
  }
  return content.replace(target, newScenario + `\n};\n`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Eklipses Scenario Deployer`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📄 Input file: ${txtFile}`);

  if (borrowId) {
    console.log(`🎭 Borrowing avatar: ${borrowId} (test mode)`);
    if (!EXISTING_AVATARS[borrowId]) {
      console.error(`❌ Unknown borrow avatar "${borrowId}". Available: ${Object.keys(EXISTING_AVATARS).join(', ')}`);
      process.exit(1);
    }
  }

  // 1. Parse the txt file
  console.log(`\n📖 Parsing scenario file...`);
  const content = fs.readFileSync(txtFile, 'utf8');
  let scenario;
  try {
    scenario = parseTxt(content);
  } catch (e) {
    console.error(`❌ Parse error: ${e.message}`);
    process.exit(1);
  }

  console.log(`  ✅ Scenario key: ${scenario.scenarioKey}`);
  console.log(`  ✅ Character:    ${scenario.charName} (id: ${scenario.charId})`);
  console.log(`  ✅ Title:        ${scenario.title}`);
  console.log(`  ✅ Difficulty:   ${scenario.difficulty}`);

  // 2. Backup all files
  console.log(`\n💾 Backing up current files...`);
  makeBackup(scenario.scenarioKey);

  // 3. Read files
  let playerContent    = fs.readFileSync(PLAYER_JS, 'utf8');
  let scenariosContent = fs.readFileSync(SCENARIOS_JS, 'utf8');
  let characterContent = fs.readFileSync(CHARACTER_JS, 'utf8');

  const borrowUrls = borrowId ? EXISTING_AVATARS[borrowId] : null;

  // 4. Patch player.js
  console.log(`\n🔧 Patching player.js...`);
  playerContent = patchScenarioCharacterMap(playerContent, scenario.scenarioKey, scenario.charId);
  playerContent = patchAvatarSets(playerContent, scenario, borrowUrls);
  fs.writeFileSync(PLAYER_JS, playerContent, 'utf8');
  console.log(`  ✅ SCENARIO_CHARACTER_MAP updated`);
  console.log(`  ✅ AVATAR_SETS updated`);

  // 5. Patch api/character.js
  console.log(`\n🔧 Patching api/character.js...`);
  try {
    characterContent = patchCharacterJs(characterContent, scenario);
    fs.writeFileSync(CHARACTER_JS, characterContent, 'utf8');
    console.log(`  ✅ CHARACTERS updated`);
    console.log(`  ✅ SETTINGS updated`);
    console.log(`  ✅ charNames updated`);
  } catch (e) {
    console.error(`  ❌ character.js patch failed: ${e.message}`);
    console.log(`  ⚠️  Continuing — patch manually if needed`);
  }

  // 6. Patch scenarios.js
  console.log(`\n🔧 Patching scenarios.js...`);
  scenariosContent = patchScenariosJs(scenariosContent, scenario);
  fs.writeFileSync(SCENARIOS_JS, scenariosContent, 'utf8');
  console.log(`  ✅ window.SCENARIOS updated`);

  // 7. npm test
  console.log(`\n🧪 Running npm test...`);
  try {
    execSync('npm test', { stdio: 'inherit' });
    console.log(`\n✅ All tests pass!`);
  } catch {
    console.error(`\n❌ Tests failed! Rolling back...`);
    const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    fs.writeFileSync(PLAYER_JS, backup.player, 'utf8');
    fs.writeFileSync(SCENARIOS_JS, backup.scenarios, 'utf8');
    fs.writeFileSync(CHARACTER_JS, backup.character, 'utf8');
    console.log(`↩️  Rollback complete. Fix the issue and try again.`);
    process.exit(1);
  }

  // 8. Git commit + push
  console.log(`\n📦 Committing and pushing...`);
  try {
    const borrowNote = borrowId ? ` (test: borrowed ${borrowId} avatar)` : '';
    execSync(`git add -A && git commit -m "feat: add ${scenario.scenarioKey} scenario — ${scenario.charName}${borrowNote}" && git push`, { stdio: 'inherit' });
    console.log(`✅ Pushed to Vercel!`);
  } catch (e) {
    console.error(`⚠️  Git push failed: ${e.message}`);
  }

  // 9. Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ DEPLOY COMPLETE`);
  console.log(`   Scenario: ${scenario.scenarioKey}`);
  console.log(`   Character: ${scenario.charName}`);
  if (borrowId) {
    console.log(`   ⚠️  Using ${borrowId}'s avatar (test mode)`);
    console.log(`   To undo: node deploy-scenario.js --undo`);
  }
  console.log(`\n   Check live at: https://eklipses.vercel.app`);
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
