# Deploy Eklipses Lesson Audio Worker

Deploy `cloudflare-worker/lesson-audio-worker.js` as a Cloudflare Worker bound to the `eklipses-videos` R2 bucket.

---

## Option A — Cloudflare Dashboard (no wrangler login needed)

### Step 1 — Create the Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select your account → **Workers & Pages** → **Create application** → **Create Worker**
3. Name it: `eklipses-lesson-audio`
4. Click **Deploy** (ignore the default hello-world code for now)

### Step 2 — Paste the worker code

1. Click **Edit code** on the worker you just created
2. Delete all existing code in the editor
3. Paste the entire contents of `cloudflare-worker/lesson-audio-worker.js`
4. Click **Deploy**

### Step 3 — Bind the R2 bucket

1. On the worker page → **Settings** → **Bindings** → **Add binding**
2. Choose **R2 bucket**
3. Variable name: `EKLIPSES_VIDEOS`
4. Bucket: `eklipses-videos`
5. Click **Save**
6. Click **Deploy** again (binding takes effect on next deploy)

### Step 4 — Note your worker URL

The URL will be:
```
https://eklipses-lesson-audio.YOUR_SUBDOMAIN.workers.dev
```

Replace `YOUR_SUBDOMAIN` with your Cloudflare workers subdomain (visible on the Workers dashboard overview page).

For the Eklipses account it should be:
```
https://eklipses-lesson-audio.oclaver611.workers.dev
```

### Step 5 — Test it

```
curl "https://eklipses-lesson-audio.oclaver611.workers.dev?file=manifest.json"
```

Should return JSON. Then:

```
curl -I "https://eklipses-lesson-audio.oclaver611.workers.dev?file=ryan_seg00.mp3"
```

Should return `Content-Type: audio/mpeg` and `Access-Control-Allow-Origin: *`.

---

## Option B — wrangler CLI (requires interactive login)

```bash
cd cloudflare-worker
npx wrangler login          # opens browser to authenticate
npx wrangler deploy
```

---

## After deployment — update lesson-player.js

In `lesson-player.js` lines 8–10, change to:

```js
const WORKER_BASE   = 'https://eklipses-lesson-audio.oclaver611.workers.dev';
const R2_BASE       = 'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev';
const SOFIA_IDLE    = R2_BASE + '/sofia_idle.mp4';
const SOFIA_SPEAK   = R2_BASE + '/sofia_speaking.mp4';
```

And in the audio URL builder (~line 302–306), change to route ALL audio through the worker:

```js
const url = WORKER_BASE + '?file=' + encodeURIComponent(f.file);
```

This replaces both the direct R2 route (ryan) and the Vercel proxy route (alex/sofia).
Then commit + deploy to Vercel.
