# Eklipses — Task Queue

## How to use this file
Start every session by reading this file. Work top to bottom. Move completed tasks to Done. Add new tasks at the bottom of the relevant priority section.

---

## 🔴 P1 — Critical (do these first)
- [ ] Test caption sync fix live — confirm text appears with audio not before (v-stable-june3-caption-sync)
- [ ] Investigate score always showing 3/10 in real sessions despite +1 correction — run 3 test conversations with coach API one-liner and check raw scores

## 🟡 P2 — Important
- [ ] Fix Remi character — check api/character.js and player.js for what's broken
- [ ] Re-apply rate limit increase (was lost in a previous reset)
- [ ] Re-apply dev key capture fix in index.html
- [ ] Fix Ryan dead air gaps between lines (blob buffering — MediaSource approach failed, need new strategy)

## 🟢 P3 — Nice to have
- [ ] Switch Sofia TTS to Fish Audio or Chatterbox — cheaper than ElevenLabs at scale
- [ ] Add more scenario variety — new characters or locations
- [ ] Ryan feedback: investigate why part2/part3 sometimes references wrong exchanges

## 🔵 Future / Research
- [ ] Chatterbox Turbo — emotion tags [laugh] [sigh] for more natural character responses
- [ ] Fish Audio as ElevenLabs backup
- [ ] Kokoro on paid Render tier — keep warm, no cold starts

---

## Fast Test Commands

### Test coach API (no full session needed):
node -e "fetch('https://eklipses.vercel.app/api/coach', {method:'POST',headers:{'Content-Type':'application/json','x-dev-key':'ek_dev_2026'},body:JSON.stringify({scenarioTitle:'Beach — Cold Open',scenarioKey:'beach',conversation:[{role:'user',content:'hey never saw you here'},{role:'assistant',content:'I come here to think. What about you?'},{role:'user',content:'same actually. what are you writing?'},{role:'assistant',content:'Something I probably won t finish.'},{role:'user',content:'the unfinished ones are usually the most honest'},{role:'assistant',content:'That s... actually true.'}]})}).then(r=>r.json()).then(d=>console.log('SCORE:',d.score,'PART1:',d.part1?.slice(0,150))).catch(console.error)"

### Deploy:
deploy.bat "your message"

### Manual deploy:
git push origin HEAD
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_l6CBJ6apO3R4vIkcoaXzZO89zXFH/dzoXAksvJp?buildCache=false"

---

## ✅ Done

### June 3, 2026
- [x] Upgraded Vercel to Pro
- [x] ElevenLabs now primary TTS (Kokoro disabled)
- [x] Fixed Sofia audio (frontend timeout, audio.play errors)
- [x] Ryan opener nuclear fix — always HIM_1
- [x] Score +1 correction for gpt-4o-mini
- [x] Removed broken Practice Mode and Mic buttons
- [x] Removed duplicate Ryan intro in train scenario
- [x] Ryan encouragement — more emotional
- [x] Caption sync — text shows with audio not before
- [x] Created TECHNICAL_ISSUES_LOG.md

## Current Stack
- Live: https://eklipses.vercel.app
- Dev: https://eklipses.vercel.app?dev=ek_dev_2026
- TTS: ElevenLabs primary → OpenAI fallback
- Ryan: OpenAI onyx via KokoroSpeech
- LLM: gpt-4o-mini
- Vercel: Pro, 30s timeout
- Latest stable: v-stable-june3-caption-sync
