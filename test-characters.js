// test-characters.js — tests every character's API response
// Usage: node test-characters.js

const characters = [
  { id: 'sofia', scenario: 'beach' },
  { id: 'ava', scenario: 'bar' },
  { id: 'isabelle', scenario: 'museum' },
  { id: 'zoe', scenario: 'gym' },
  { id: 'nadia', scenario: 'bookstore' },
  { id: 'julia', scenario: 'street' },
  { id: 'sanna', scenario: 'rooftop' },
  { id: 'sarah', scenario: 'house_party' },
  { id: 'anna', scenario: 'coffee_shop' },
  { id: 'leila', scenario: 'art_gallery' },
  { id: 'fatou', scenario: 'yoga_studio' },
  { id: 'elena', scenario: 'airport' },
  { id: 'eden', scenario: 'supermarket' },
  { id: 'maya_office', scenario: 'office_lobby' },
  { id: 'erika', scenario: 'train' },
];

async function testCharacter(id, scenario) {
  try {
    const res = await fetch('https://eklipses.vercel.app/api/character-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-key': 'ek_dev_2026' },
      body: JSON.stringify({
        userMessage: 'hi',
        scenarioKey: scenario,
        characterId: id,
        history: []
      })
    });
    const text = await res.text();
    const lines = text.split('\n').filter(l => l.startsWith('data: '));
    const sentences = lines.map(l => { try { return JSON.parse(l.slice(6)).sentence; } catch { return null; } }).filter(Boolean);
    if (sentences.length > 0) {
      console.log(`✅ ${id}: "${sentences[0]}"`);
    } else {
      console.log(`❌ ${id}: no response — raw: ${text.slice(0, 100)}`);
    }
  } catch (err) {
    console.log(`❌ ${id}: ERROR — ${err.message}`);
  }
}

(async () => {
  console.log('Testing all characters...\n');
  for (const { id, scenario } of characters) {
    await testCharacter(id, scenario);
    await new Promise(r => setTimeout(r, 500)); // avoid rate limiting
  }
  console.log('\nDone.');
})();
