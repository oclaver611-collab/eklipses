// tests/test-coach-suggest.js — Validates /api/coach-suggest returns 3 grounded suggestions
const BASE = 'https://eklipses.vercel.app';

const HISTORY = [
  { role: 'user',      content: "Hi, I couldn't help but notice you've been here a while." },
  { role: 'assistant', content: 'Twenty minutes. I am working on something.' },
  { role: 'user',      content: 'What are you writing about?' },
  { role: 'assistant', content: 'Coastal ecology. The shoreline has changed a lot over the years.' },
];

function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

async function run() {
  console.log('=== Coach Suggest Test ===\n');
  console.log('Last character line: "Coastal ecology. The shoreline has changed a lot over the years."\n');

  const res = await fetch(`${BASE}/api/coach-suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: HISTORY, scenarioKey: 'beach', userStyle: 'direct' }),
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  console.log('Raw response:');
  console.log(JSON.stringify(data, null, 2));
  console.log();

  const { suggestions } = data;
  if (!Array.isArray(suggestions) || suggestions.length !== 3) {
    console.error('FAIL — expected 3 suggestions, got:', suggestions?.length);
    process.exit(1);
  }

  const EXPECTED_STYLES = ['curious', 'playful', 'direct'];
  let allPass = true;

  suggestions.forEach((s, i) => {
    const wc = wordCount(s.text);
    const styleOk = s.style === EXPECTED_STYLES[i];
    const lengthOk = wc <= 15;
    const hasText = s.text?.trim().length > 0;
    const pass = styleOk && lengthOk && hasText;
    if (!pass) allPass = false;

    const mark = pass ? '✅' : '❌';
    console.log(`${mark} [${s.style}] "${s.text}" (${wc} words)`);
    if (!styleOk)   console.log(`   Style mismatch — expected ${EXPECTED_STYLES[i]}, got ${s.style}`);
    if (!lengthOk)  console.log(`   Too long — ${wc} words (limit 15)`);
    if (!hasText)   console.log(`   Empty text`);
  });

  console.log();
  if (allPass) {
    console.log('✅ PASS — 3 suggestions returned, all under 15 words');
  } else {
    console.log('❌ FAIL — one or more checks failed');
    process.exit(1);
  }
}

run().catch(err => { console.error(err.message); process.exit(1); });
