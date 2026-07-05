// api/lesson-audio.js — Proxy for R2 audio_v2 files (avoids CORS on localhost)
const R2_BASE = 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/lessons/lesson1/audio_v2';

const ALLOWED = /^(manifest\.json|[a-z0-9_]+\.mp3)$/i;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { file } = req.query;
  if (!file || !ALLOWED.test(file)) return res.status(400).json({ error: 'Invalid file param' });

  const url = `${R2_BASE}/${file}`;

  try {
    const r2Res = await fetch(url);
    if (!r2Res.ok) return res.status(r2Res.status).json({ error: 'R2 fetch failed: ' + r2Res.status });

    const contentType = file.endsWith('.json') ? 'application/json' : 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buf = Buffer.from(await r2Res.arrayBuffer());
    return res.status(200).send(buf);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream error: ' + err.message });
  }
};
