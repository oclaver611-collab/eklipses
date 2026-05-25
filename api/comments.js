// api/comments.js — per-scenario comment storage via JSONBin.io
// Free tier: unlimited bins, 10K reads/day, 1K writes/day — plenty for launch
// Setup: create a free account at jsonbin.io, get your API key and Master Key
// Add to Vercel env vars: JSONBIN_MASTER_KEY, JSONBIN_ACCESS_KEY
//
// Each scenario gets its own bin, created automatically on first comment.
// Bin IDs are stored in a separate index bin.

const JSONBIN_API = 'https://api.jsonbin.io/v3';

async function getBinIndex() {
  const indexId = process.env.JSONBIN_INDEX_BIN_ID;
  if (!indexId) return {};
  try {
    const res = await fetch(`${JSONBIN_API}/b/${indexId}/latest`, {
      headers: { 'X-Master-Key': process.env.JSONBIN_MASTER_KEY },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.record || {};
  } catch { return {}; }
}

async function updateBinIndex(index) {
  const indexId = process.env.JSONBIN_INDEX_BIN_ID;
  if (!indexId) return;
  try {
    await fetch(`${JSONBIN_API}/b/${indexId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': process.env.JSONBIN_MASTER_KEY,
      },
      body: JSON.stringify(index),
    });
  } catch {}
}

async function getOrCreateBin(scenarioKey, index) {
  if (index[scenarioKey]) return index[scenarioKey];
  // Create new bin for this scenario
  try {
    const res = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': process.env.JSONBIN_MASTER_KEY,
        'X-Bin-Name': `eklipses-comments-${scenarioKey}`,
        'X-Bin-Private': 'false',
      },
      body: JSON.stringify({ comments: [] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const binId = data.metadata?.id;
    if (binId) {
      index[scenarioKey] = binId;
      await updateBinIndex(index);
    }
    return binId;
  } catch { return null; }
}

async function getComments(binId) {
  try {
    const res = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': process.env.JSONBIN_MASTER_KEY },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.record?.comments || [];
  } catch { return []; }
}

async function saveComments(binId, comments) {
  try {
    await fetch(`${JSONBIN_API}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': process.env.JSONBIN_MASTER_KEY,
      },
      body: JSON.stringify({ comments }),
    });
  } catch {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { method } = req;
  const { scenarioKey, text, score, name } = req.body || {};
  const scenarioKeyGet = req.query?.scenario;

  if (!process.env.JSONBIN_MASTER_KEY || !process.env.JSONBIN_INDEX_BIN_ID) {
    // Graceful degradation — if not configured, return empty
    if (method === 'GET') return res.status(200).json({ comments: [] });
    return res.status(200).json({ ok: true });
  }

  // ── GET comments for a scenario ──────────────────────────────────────────
  if (method === 'GET') {
    const key = scenarioKeyGet;
    if (!key) return res.status(400).json({ error: 'scenario required' });
    const index = await getBinIndex();
    const binId = index[key];
    if (!binId) return res.status(200).json({ comments: [] });
    const comments = await getComments(binId);
    return res.status(200).json({ comments: comments.slice(-50) }); // last 50
  }

  // ── POST a new comment ────────────────────────────────────────────────────
  if (method === 'POST') {
    if (!scenarioKey || !text?.trim()) {
      return res.status(400).json({ error: 'scenarioKey and text required' });
    }
    if (text.trim().length > 500) {
      return res.status(400).json({ error: 'Comment too long (max 500 chars)' });
    }

    const index = await getBinIndex();
    const binId = await getOrCreateBin(scenarioKey, index);
    if (!binId) return res.status(500).json({ error: 'Storage error' });

    const comments = await getComments(binId);
    const newComment = {
      id: Date.now(),
      text: text.trim(),
      name: (name || 'Anonymous').trim().slice(0, 30),
      score: score || null,
      ts: new Date().toISOString(),
    };
    comments.push(newComment);

    // Keep last 100 comments per scenario
    if (comments.length > 100) comments.splice(0, comments.length - 100);

    await saveComments(binId, comments);
    return res.status(200).json({ ok: true, comment: newComment });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
