#!/usr/bin/env node
// ============================================================
// gen-scenario.js — YouTube → Eklipses Scenario Generator
//
// Usage option 1 (auto transcript):
//   node gen-scenario.js <youtube-url>
//
// Usage option 2 (manual transcript file):
//   node gen-scenario.js --file transcript.txt <youtube-url>
//
// To get transcript manually:
//   1. Open video on YouTube
//   2. Click "..." below video → "Show transcript"
//   3. Copy all text → save as transcript.txt in EK7 folder
// ============================================================

require('dotenv').config();
const https = require('https');
const fs = require('fs');

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return 'unknown';
}

function fetchTranscriptDirect(videoId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.youtube.com',
      path: `/watch?v=${videoId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const captionMatch = data.match(/"captionTracks":\[{"baseUrl":"([^"]+)"/);
        if (!captionMatch) { reject(new Error('No captions found')); return; }
        const captionUrl = captionMatch[1].replace(/\\u0026/g, '&');
        https.get(captionUrl, (r) => {
          let xml = '';
          r.on('data', c => xml += c);
          r.on('end', () => {
            const texts = [...xml.matchAll(/<text[^>]*>([^<]+)<\/text>/g)]
              .map(m => m[1]
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>'))
              .join(' ');
            if (texts.length > 200) resolve(texts);
            else reject(new Error('Captions too short'));
          });
        }).on('error', reject);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function generateScenario(transcript, videoUrl) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const prompt = `You are a scenario designer for Eklipses — an AI social simulation platform where men practice real conversations with AI video avatars and get coaching feedback. Users have a 10 minute free conversation with the avatar then get scored and coached by Ryan.

I will give you a YouTube video transcript about dating, social skills, attraction, or conversation. Your job is to transform the core insight into a complete Eklipses scenario.

VIDEO URL: ${videoUrl}

TRANSCRIPT:
${transcript.slice(0, 7000)}

---

Analyze the transcript and output ONLY a valid JSON object. No markdown, no explanation, no code fences. Just the raw JSON.

{
  "scenarioKey": "snake_case_unique_key (e.g. coffee_shop_mixed_signals)",
  "title": "Location — Emotional Hook (e.g. Coffee Shop — She Pulls Back)",
  "emotionalCore": "One sentence: the real fear or pain point this video addresses",
  "difficulty": 2,
  "category": "dating",
  "characterName": "A woman first name that fits her personality",
  "characterAge": 26,
  "characterVibe": "3-4 words for avatar card (e.g. 'Warm but tests you')",
  "setting": "Describe where the encounter takes place — 1 vivid sentence",
  "speakingScript": "Her opening line to the user — natural speech, under 30 words, immediately creates the emotional dynamic from the video. She speaks first.",
  "coachIntro": [
    "Ryan line 1 — vivid scene setter, 1 sentence",
    "Ryan line 2 — what emotional challenge awaits, 1 sentence",
    "Ryan line 3 — what most men do wrong in this exact situation",
    "Ryan line 4 — the ONE thing to try"
  ],
  "rescueLines": [
    "What she says if user freezes at the start — slightly provocative",
    "Second rescue line — more impatient",
    "Third — drier humor",
    "Fourth — almost giving up",
    "Fifth — last chance tone"
  ],
  "impatienceLines": [
    "Short line when conversation stalls mid-session",
    "Second impatience line",
    "Third impatience line"
  ],
  "characterSystemPrompt": "Full character system prompt for api/character.js — 280-320 words. Must include: her name and age, her job and why she is in this location today, her current emotional state, her personality in detail, how she responds to generic vs genuine openers, what makes her genuinely open up, what makes her go cold, her humor style, example exchange showing her at her best, banned phrases she would never say, response length rule (1-2 sentences max). The dynamic must directly reflect the emotional lesson from the video.",
  "backgroundSuggestion": "Describe the ideal background image — location details, time of day, lighting mood, atmosphere. No people. For ChatGPT image generation."
}`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text;
          if (!text) throw new Error('No content: ' + data.slice(0, 300));
          resolve(text);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(40000, () => { req.destroy(); reject(new Error('Claude timed out')); });
    req.write(postData);
    req.end();
  });
}

function formatOutput(raw, videoUrl) {
  const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  const s = JSON.parse(cleaned);
  const SEP = '═'.repeat(62);
  const charKey = s.characterName.toLowerCase();

  return `
${SEP}
  EKLIPSES SCENARIO GENERATOR — OUTPUT
  Video: ${videoUrl}
  Emotional core: ${s.emotionalCore}
${SEP}

━━━ 1. ADD TO scenarios.js (inside the SCENARIOS object) ━━━

  ${s.scenarioKey}: {
    title: "${s.title}",
    bg: "https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/${s.scenarioKey}_bg.jpg?v=1",
    coldOpen: true,
    category: "${s.category}",
    difficulty: ${s.difficulty},
    duration_min: 10,
    practice: [
      { speaker:"Ryan", text:"${s.coachIntro[0]}" },
      { speaker:"Ryan", text:"${s.coachIntro[1]}" },
      { speaker:"Ryan", text:"${s.coachIntro[2]}" },
      { speaker:"Ryan", text:"${s.coachIntro[3]}" }
    ]
  },

━━━ 2. ADD TO SCENARIO_CHARACTER_MAP in player.js ━━━

  ${s.scenarioKey}: '${charKey}',

━━━ 3. ADD TO CHARACTERS in api/character.js ━━━

    ${charKey}: \`${s.characterSystemPrompt}\`,

━━━ 4. ADD TO SETTINGS in api/character.js ━━━

    ${s.scenarioKey}: \`SETTING: ${s.setting}\`,

━━━ 5. ADD TO AVATAR_SETS in player.js ━━━

  {
    id:'${charKey}',
    label:'${s.characterName}',
    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/${s.characterName}_thumb.jpg',
    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/${charKey}_speaking.mp4',
    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/${charKey}_idle.mp4',
    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/${charKey}_idle.mp4',
    vibe:'${s.characterVibe}',
    scenario:'${s.title.split(' —')[0]}'
  },

━━━ 6. HER SPEAKING SCRIPT — paste into HeyGen ━━━

${s.speakingScript}

━━━ 7. BACKGROUND IMAGE PROMPT — paste into ChatGPT ━━━

${s.backgroundSuggestion}
Style: cinematic photorealistic, 16:9, 1920x1080, no people.

━━━ 8. RESCUE LINES — add to freeConversation rescuesByScenario ━━━

          ${s.scenarioKey}: [
${s.rescueLines.map(l => `            "${l}"`).join(',\n')}
          ],

━━━ 9. IMPATIENCE LINES — add to freeConversation impatience ━━━

            ${s.scenarioKey}: [
${s.impatienceLines.map(l => `              "${l}"`).join(',\n')}
            ],

${SEP}
  NEXT STEPS
  1. Generate ${s.characterName} photo in ChatGPT (use prompt in step 7)
  2. Generate speaking video in HeyGen (use script in step 6)
  3. Generate idle video via fal.ai
  4. Upload all 3 assets + background to R2
  5. Paste all code blocks above into their files
  6. Run npm test — all 346+ checks should pass
${SEP}
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage:');
    console.error('  node gen-scenario.js <youtube-url>');
    console.error('  node gen-scenario.js --file transcript.txt <youtube-url>');
    process.exit(1);
  }

  let videoUrl, transcriptFile;
  if (args[0] === '--file') {
    transcriptFile = args[1];
    videoUrl = args[2];
  } else {
    videoUrl = args[0];
  }

  if (!videoUrl) { console.error('❌ No YouTube URL provided'); process.exit(1); }

  console.log('\n🎬 Eklipses Scenario Generator');
  console.log('━'.repeat(42));
  console.log('Video:', videoUrl);

  const videoId = extractVideoId(videoUrl);
  console.log('Video ID:', videoId);

  let transcript;

  // Manual file mode
  if (transcriptFile) {
    if (!fs.existsSync(transcriptFile)) {
      console.error('❌ File not found:', transcriptFile);
      process.exit(1);
    }
    transcript = fs.readFileSync(transcriptFile, 'utf-8');
    // Clean YouTube transcript format (remove timestamps)
    transcript = transcript.replace(/^\d+:\d+\n/gm, '').replace(/\n{2,}/g, ' ').trim();
    console.log(`✅ Loaded transcript from file — ${transcript.length} chars`);
  } else {
    // Auto fetch
    console.log('\n⏳ Fetching transcript from YouTube...');
    try {
      transcript = await fetchTranscriptDirect(videoId);
      console.log(`✅ Transcript fetched — ${transcript.length} chars`);
    } catch(e) {
      console.log('⚠️  Auto-fetch failed:', e.message);
      console.log('\n📋 Manual transcript option:');
      console.log('   1. Open the video on YouTube');
      console.log('   2. Click "..." below video → "Show transcript"');
      console.log('   3. Copy all text → save as transcript.txt in EK7 folder');
      console.log('   4. Run: node gen-scenario.js --file transcript.txt ' + videoUrl);
      process.exit(1);
    }
  }

  console.log('\n⏳ Generating scenario with Claude...');
  let raw;
  try {
    raw = await generateScenario(transcript, videoUrl);
    console.log('✅ Scenario generated');
  } catch(e) {
    console.error('❌ Claude failed:', e.message);
    process.exit(1);
  }

  let output;
  try {
    output = formatOutput(raw, videoUrl);
  } catch(e) {
    console.error('❌ JSON parse failed. Raw output saved to raw-output.txt');
    fs.writeFileSync('raw-output.txt', raw);
    console.log('Raw:', raw.slice(0, 500));
    process.exit(1);
  }

  console.log(output);

  const s = JSON.parse(raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());
  const filename = `scenario-${s.scenarioKey}.txt`;
  fs.writeFileSync(filename, output);
  console.log(`💾 Saved to: ${filename}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
