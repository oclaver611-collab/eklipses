// eval-tts.js — Tests /api/tts for all 16 character IDs
// Checks: Content-Type audio/mpeg, body size > 0 (real audio returned)
// Run with: node eval-tts.js
// NOTE: Makes 16 ElevenLabs API calls — costs quota. Run sparingly.

require('dotenv').config();

const BASE = process.env.VERCEL_URL || 'https://eklipses.vercel.app';

// ─── CHARACTER LIST — must match ELEVENLABS_VOICES in api/tts.js ─────────────
const CHARACTERS = [
  'sofia', 'anna', 'sarah', 'eden', 'ava', 'elena',
  'erika', 'fatou', 'zoe', 'sanna', 'isabelle', 'leila',
  'maya_office', 'nadia', 'julia', 'remi',
];

// Short test phrase — keeps audio small, faster to download
const TEST_TEXT = 'Hey.';

// ─── CALL TTS ─────────────────────────────────────────────────────────────────
async function callTTS(characterId) {
  const start = Date.now();

  let res;
  try {
    res = await fetch(`${BASE}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: TEST_TEXT, characterId }),
    });
  } catch (e) {
    return { ok: false, error: 'fetch failed: ' + e.message, contentType: '', bytes: 0, ms: Date.now() - start };
  }

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 100)}`, contentType, bytes: 0, ms: Date.now() - start };
  }

  // Drain body to get byte count
  const reader = res.body.getReader();
  let bytes = 0;
  while (true) {
    let chunk;
    try { chunk = await reader.read(); } catch { break; }
    if (chunk.done) break;
    bytes += chunk.value.length;
  }

  return { ok: true, contentType, bytes, ms: Date.now() - start };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   TTS EVAL — /api/tts for all 16 characters             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Target: ${BASE}`);
  console.log(`  Text:   "${TEST_TEXT}"`);
  console.log(`  NOTE:   Each call hits ElevenLabs — uses quota.\n`);

  let passed = 0;
  let failed = 0;

  for (const charId of CHARACTERS) {
    process.stdout.write(`  ${charId.padEnd(14)} `);

    const { ok, error, contentType, bytes, ms } = await callTTS(charId);

    const hasAudio = contentType.includes('audio/mpeg');
    const hasBytes = bytes > 0;
    const allGood  = ok && hasAudio && hasBytes;

    if (allGood) {
      console.log(`✅  ${ms}ms  ${(bytes / 1024).toFixed(1)}KB  ${contentType}`);
      passed++;
    } else {
      const reasons = [];
      if (!ok)       reasons.push(error || 'request failed');
      if (!hasAudio) reasons.push(`wrong Content-Type: "${contentType}"`);
      if (!hasBytes) reasons.push('0 bytes received');
      console.log(`❌  ${reasons.join(' | ')}`);
      failed++;
    }

    // Small pause between calls — be a good API citizen
    await new Promise(r => setTimeout(r, 200));
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '─'.repeat(58));
  console.log(`  TTS eval: ${passed}/${total} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  ✅ All TTS checks passed.\n');
    process.exit(0);
  } else {
    console.log('  ❌ Some TTS checks failed.\n');
    process.exit(1);
  }
})();
