// deploy-worker.js — Deploy eklipses-lesson-audio Cloudflare Worker via API
const fs   = require('fs');
const path = require('path');

// ── Load env ────────────────────────────────────────────────────────────────
function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
      .map(l => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };

const ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID || env.R2_ACCOUNT_ID;
const API_TOKEN  = env.CLOUDFLARE_API_TOKEN;
const SCRIPT     = 'eklipses-lesson-audio';

if (!API_TOKEN) {
  console.error('');
  console.error('ERROR: No CLOUDFLARE_API_TOKEN found in .env or .env.local');
  console.error('');
  console.error('To create one:');
  console.error('  1. Go to https://dash.cloudflare.com/profile/api-tokens');
  console.error('  2. Create Token → Use template "Edit Cloudflare Workers"');
  console.error('  3. Set Account = eklipses, Zone = All zones (or none)');
  console.error('  4. Copy the token and add to .env.local:');
  console.error('     CLOUDFLARE_API_TOKEN=your_token_here');
  console.error('  5. Re-run: node deploy-worker.js');
  console.error('');
  process.exit(1);
}

// ── Read worker source ───────────────────────────────────────────────────────
const workerSrc = fs.readFileSync(
  path.join(__dirname, 'cloudflare-worker', 'lesson-audio-worker.js'),
  'utf8'
);

// ── Build multipart body (required for ES module workers) ───────────────────
const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

const metadata = JSON.stringify({
  main_module: 'worker.js',
  bindings: [
    { type: 'r2_bucket', name: 'EKLIPSES_VIDEOS', bucket_name: 'eklipses-videos' }
  ],
  compatibility_date: '2024-01-01',
});

const body = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="metadata"',
  'Content-Type: application/json',
  '',
  metadata,
  `--${boundary}`,
  'Content-Disposition: form-data; name="worker.js"; filename="worker.js"',
  'Content-Type: application/javascript+module',
  '',
  workerSrc,
  `--${boundary}--`,
].join('\r\n');

// ── Upload ───────────────────────────────────────────────────────────────────
async function deploy() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT}`;
  console.log(`Deploying ${SCRIPT} to account ${ACCOUNT_ID}...`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    console.error('FAILED:', res.status, JSON.stringify(json.errors || json, null, 2));
    process.exit(1);
  }

  console.log('SUCCESS — worker deployed');
  console.log('  ID:      ', json.result?.id);
  console.log('  Etag:    ', json.result?.etag);
  console.log('  Modified:', json.result?.modified_on);
  console.log('  URL:     ', `https://${SCRIPT}.oclaver611.workers.dev`);
}

deploy().catch(e => { console.error('FETCH ERROR:', e.message); process.exit(1); });
