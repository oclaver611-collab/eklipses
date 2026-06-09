// test-frontend.js — end-to-end API test for all characters
// Usage: node test-frontend.js [base_url]
// Example: node test-frontend.js https://love-eklipses.vercel.app

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const DEV_KEY  = process.env.DEV_BYPASS_KEY || 'ek_dev_2026';

const HEADERS = {
  'Content-Type': 'application/json',
  'x-dev-key': DEV_KEY,
};

const characters = [
  { id: 'sofia',       scenario: 'beach' },
  { id: 'isabelle',    scenario: 'museum' },
  { id: 'zoe',         scenario: 'gym' },
  { id: 'nadia',       scenario: 'bookstore' },
  { id: 'julia',       scenario: 'street' },
  { id: 'sanna',       scenario: 'rooftop' },
  { id: 'sarah',       scenario: 'house_party' },
  { id: 'anna',        scenario: 'coffee_shop' },
  { id: 'leila',       scenario: 'art_gallery' },
  { id: 'fatou',       scenario: 'yoga_studio' },
  { id: 'elena',       scenario: 'airport' },
  { id: 'eden',        scenario: 'supermarket' },
  { id: 'maya_office', scenario: 'office_lobby' },
  { id: 'erika',       scenario: 'train' },
];

function tick(ok, label, ms, detail = '') {
  const icon = ok ? '✅' : '❌';
  const time = `${ms}ms`;
  console.log(`  ${icon} ${label.padEnd(30)} ${time.padStart(6)}  ${detail}`);
  return ok;
}

async function testCharacterStream(id, scenario) {
  const t = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/character-stream`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userMessage: 'hi', characterId: id, scenarioKey: scenario }),
    });
    if (!res.ok) {
      return tick(false, `${id} / SSE`, Date.now() - t, `HTTP ${res.status}`);
    }
    // Read SSE until we get at least one sentence or stream ends
    const text = await res.text();
    const sentences = text.split('\n')
      .filter(l => l.startsWith('data:'))
      .map(l => l.slice(5).trim())
      .filter(l => l && l !== '[DONE]');
    const got = sentences.length > 0;
    const preview = got ? sentences[0].slice(0, 60) : '(no sentences)';
    return tick(got, `${id} / SSE`, Date.now() - t, preview);
  } catch (e) {
    return tick(false, `${id} / SSE`, Date.now() - t, e.message);
  }
}

async function testTTS(id) {
  const t = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/tts`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ text: 'Hi there', characterId: id }),
    });
    if (!res.ok) {
      return tick(false, `${id} / TTS`, Date.now() - t, `HTTP ${res.status}`);
    }
    const ct = res.headers.get('content-type') || '';
    const buf = await res.arrayBuffer();
    const size = buf.byteLength;
    const ok = ct.includes('audio') && size > 1000;
    return tick(ok, `${id} / TTS`, Date.now() - t, `${ct} ${size} bytes`);
  } catch (e) {
    return tick(false, `${id} / TTS`, Date.now() - t, e.message);
  }
}

async function main() {
  console.log(`\nEklipses end-to-end character test`);
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Dev key  : ${DEV_KEY}`);
  console.log(`Characters: ${characters.length}\n`);

  let passed = 0;
  let total  = 0;

  for (const { id, scenario } of characters) {
    console.log(`${id} (${scenario})`);
    const sseOk = await testCharacterStream(id, scenario);
    const ttsOk = await testTTS(id);
    if (sseOk && ttsOk) passed++;
    total++;
    console.log('');
  }

  console.log('─'.repeat(55));
  console.log(`Summary: ${passed}/${total} characters fully passing\n`);
  process.exit(passed === total ? 0 : 1);
}

main();
