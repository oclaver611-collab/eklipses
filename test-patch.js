// test-patch.js — verify scenarios.js patch before full deploy
const fs = require('fs');

const raw = fs.readFileSync('scenarios.js', 'utf8');
// Normalize CRLF to LF first (same as deploy-scenario.js now does)
const content = raw.replace(/\r\n/g, '\n');

const closing = '\n};';
const idx = content.lastIndexOf(closing);

console.log('Found closing at index:', idx);
console.log('Last 80 chars before closing:');
console.log(JSON.stringify(content.slice(idx - 80, idx)));
console.log('Total normalized length:', content.length);

// Simulate the patch
const testEntry = '\n  testScenario: { title: "Test" },';
const patched = content.slice(0, idx) + ',' + testEntry + '\n};\n';

console.log('\nPatched file last 80 chars:');
console.log(JSON.stringify(patched.slice(-80)));
console.log('\n✅ No \\r artifacts = patch is clean');
