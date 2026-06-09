# EKLIPSES — Avatar Generation Manual
## Last updated: June 8, 2026

---

## THE GOLDEN RULES

### Rule #1: Always use a real reference photo
Never generate from scratch. Find a real photo of a beautiful woman on Pinterest, Instagram, Google Images or any social media that matches the character's ethnicity and vibe. Use it as the style reference in the prompt with "same face as reference, same style as reference". Results are dramatically better every time.

**Best sources for references:**
- Pinterest (search: "beautiful [ethnicity] woman portrait")
- Instagram model pages
- Google Images ("beautiful [ethnicity] actress")
- TikTok, Twitter/X

### Rule #2: Change only clothes + background + context
Keep face, hair, skin exactly as reference. Only change outfit and background to match the character's scenario location.

### Rule #3: Never try to fix facial proportions in the prompt
DALL-E will make it worse. If the face is 90% right, accept it and move on.

### Rule #4: Direct eye contact is non-negotiable
Always include: "looking DIRECTLY into the camera, full frontal face, eyes straight ahead"
Any character looking sideways will produce a broken speaking video — the user loses the connection feeling entirely.

### Rule #5: Age 22-24 always
Always specify 22-24 years old. Anything older generates older-looking results.

### Rule #6: Emphasize beauty explicitly
Include phrases like: "extraordinarily beautiful", "flawless glowing skin", "effortlessly stunning", "the most beautiful woman in the room without trying"

### Rule #7: Never over-specify facial features
Do not try to describe chin shape, jaw width, nose size etc. DALL-E interprets these poorly and makes it worse. Let the reference photo guide the face.

---

## PROMPT TEMPLATE
Photorealistic portrait of an extraordinarily beautiful [ethnicity] woman, 23 years old, same face and style as reference: [hair description], [eye color] eyes looking DIRECTLY into the camera with [expression], flawless [skin tone] glowing skin, [jewelry], wearing [outfit matching scenario], [lighting description], [blurred scenario background] bokeh behind her, cinematic photography, ultra-realistic skin and hair texture, 16:9 composition, face and upper chest centered, [personality one-liner]

---

## VIDEO GENERATION PIPELINE

### Speaking video
- Tool: fal.ai Kling Avatar v2 Standard
- Endpoint: fal-ai/kling-video/ai-avatar/v2/standard
- Input: photo URL + ElevenLabs TTS audio URL
- Cost: ~$0.56 per 10s video
- Quality check: lip sync, eye contact with camera

### Idle video
- Tool: fal.ai Kling v2.1 Standard image-to-video
- Endpoint: fal-ai/kling-video/v2.1/standard/image-to-video
- Prompt: "eyes open and alive, natural micro-blinking only, soft focus gaze forward, subtle breathing, slight natural head movement, hair gently moving, calm and present expression, photorealistic portrait, eyes never fully close"
- Duration: 5 seconds (loops in player)
- Cost: ~$0.40 per 5s video
- Known issue: sometimes does slow eye close on loop — regenerate if this happens

### Batch script
- Location: scripts/heygen-batch.js
- Usage: node scripts/heygen-batch.js [character names...]
- Resume: automatically skips completed characters (tracked in heygen-done.json)
- Idle only: node scripts/heygen-batch.js [name] --idle-only
- Output: scripts/heygen-output/[name]_speaking.mp4, [name]_idle.mp4, [name]_thumb.jpg
- Auto-uploads to R2: eklipses-videos bucket

### R2 URL pattern
- Thumb: https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/[name]_thumb.jpg
- Speaking: https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/[name]_speaking.mp4
- Idle: https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/[name]_idle.mp4

---

## COST REFERENCE (June 2026)

| Item | Tool | Cost |
|------|------|------|
| Photo generation | DALL-E 3 via ChatGPT | ~$0.04/image |
| Speaking video 10s | fal.ai Kling Avatar v2 Standard | ~$0.56 |
| Idle video 5s | fal.ai Kling v2.1 Standard | ~$0.40 |
| TTS audio | ElevenLabs Flash v2.5 | ~$0.01 |
| R2 storage | Cloudflare R2 | ~$0.001 |
| **Total per character** | | **~$1.00** |

40 characters = ~$40 total

---

## TOOLS & CREDENTIALS

- fal.ai account: obafemibanana6622@gmail.com
- HeyGen: CANCELLED June 2026 (poor API quality, use fal.ai instead)
- R2 bucket: eklipses-videos
- Photos folder: %USERPROFILE%\Downloads\dames\[Name].png (capital first letter)
