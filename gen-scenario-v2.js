// gen-scenario.js — Eklipses Scenario Generator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USAGE:
//   Single video (auto transcript via yt-dlp):
//     node gen-scenario.js https://www.youtube.com/watch?v=VIDEO_ID
//
//   Single video (manual transcript fallback):
//     node gen-scenario.js --file transcript.txt https://www.youtube.com/watch?v=VIDEO_ID
//
//   Channel batch — top N videos by view count:
//     node gen-scenario.js --channel "https://www.youtube.com/@DarkNeedle" --top 10
//     node gen-scenario.js --channel "https://www.youtube.com/@DarkNeedle" --top 50
//
// REQUIREMENTS:
//   - yt-dlp installed: winget install yt-dlp  (or choco install yt-dlp)
//   - ANTHROPIC_API_KEY in .env
//   - npm install @anthropic-ai/sdk dotenv (if not already installed)

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── ARGUMENT PARSING ────────────────────────────────────────────────────────

function parseArgs(args) {
  const result = { mode: null, url: null, file: null, channel: null, top: 10, urls: [] };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") {
      result.file = args[++i];
      result.mode = "file";
    } else if (args[i] === "--channel") {
      result.channel = args[++i];
      result.mode = "channel";
    } else if (args[i] === "--top") {
      result.top = parseInt(args[++i]) || 10;
    } else if (args[i] === "--urls") {
      result.mode = "urls";
      // Collect all following args that look like URLs
      while (i + 1 < args.length && (args[i + 1].startsWith("http") || args[i + 1].startsWith("youtu"))) {
        result.urls.push(args[++i].trim());
      }
    } else if (args[i].startsWith("http")) {
      result.url = args[i].replace(/^https:\/\/www\.youtube\.com\/watch\?v=https:\/\/www\.youtube\.com\/watch\?v=/, "https://www.youtube.com/watch?v="); // fix doubled URLs
    }
  }

  if (!result.mode) {
    result.mode = result.url ? "url" : null;
  }

  return result;
}

// ─── YT-DLP CHECK ────────────────────────────────────────────────────────────

function checkYtDlp() {
  try {
    execSync("yt-dlp --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ─── TRANSCRIPT FETCHING ─────────────────────────────────────────────────────

function fetchTranscriptYtDlp(url) {
  const tmpDir = path.join(__dirname, "_transcript_tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  // Extract video ID for filename
  const videoId = url.match(/[?&]v=([^&]+)/)?.[1] || "video";
  const outTemplate = path.join(tmpDir, videoId);

  try {
    // Try manual subtitles first, then auto-generated
    const cmd = [
      "yt-dlp",
      "--write-subs",
      "--write-auto-subs",
      "--sub-lang", "en",
      "--sub-format", "vtt",
      "--skip-download",
      "--no-playlist",
      "-o", `"${outTemplate}"`,
      `"${url}"`
    ].join(" ");

    execSync(cmd, { stdio: "pipe", timeout: 30000 });

    // Find the downloaded .vtt file
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(videoId) && f.endsWith(".vtt"));
    if (files.length === 0) return null;

    const vttContent = fs.readFileSync(path.join(tmpDir, files[0]), "utf8");

    // Clean up
    files.forEach(f => fs.unlinkSync(path.join(tmpDir, f)));

    return cleanVtt(vttContent);
  } catch (err) {
    // Clean up on error
    try {
      const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(videoId));
      files.forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
    } catch {}
    return null;
  }
}

function cleanVtt(vttContent) {
  // Remove VTT timestamps, tags, and duplicate lines
  const lines = vttContent.split("\n");
  const textLines = [];
  const seen = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headers, timestamps, empty lines, positioning tags
    if (!trimmed) continue;
    if (trimmed.startsWith("WEBVTT")) continue;
    if (trimmed.match(/^\d{2}:\d{2}:\d{2}/)) continue;
    if (trimmed.match(/^NOTE/)) continue;
    if (trimmed.match(/^align:|^position:|^line:/)) continue;

    // Remove inline tags like <00:00:01.000>, <c>, </c>
    const cleaned = trimmed
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    textLines.push(cleaned);
  }

  return textLines.join(" ").replace(/\s+/g, " ").trim();
}

// ─── CHANNEL: GET TOP N VIDEOS BY VIEW COUNT ─────────────────────────────────

function getTopChannelVideos(channelUrl, topN) {
  console.log(`\n📡 Fetching video list from channel...`);
  console.log(`   ${channelUrl}`);
  console.log(`   Getting top ${topN} by view count (this may take 30-60 seconds)\n`);

  try {
    // Use sort=p to get YouTube Popular tab order (no need for view counts)
    // spawnSync avoids Windows shell pipe interpretation issues
    const result = spawnSync("yt-dlp", [
      "--flat-playlist",
      "--playlist-end", String(topN),
      "--print", "%(webpage_url)s",
      "--print", "%(title)s",
      "--print", "---END---",
      `${channelUrl}/videos?view=0&sort=p`
    ], { encoding: "utf8", timeout: 120000, maxBuffer: 10 * 1024 * 1024 });

    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr || "yt-dlp failed");

    const output = result.stdout;

    // Parse blocks of 3 lines: url, title, ---END---
    const blocks = output.split("---END---\n").filter(b => b.trim());
    const videos = blocks
      .map(block => {
        const lines = block.trim().split("\n");
        if (lines.length < 2) return null;
        return {
          url: lines[0]?.trim(),
          title: lines[1]?.trim()
        };
      })
      .filter(v => v && v.url)
      .slice(0, topN);

    return videos;
  } catch (err) {
    console.error(`❌ Failed to fetch channel videos: ${err.message}`);
    return [];
  }
}

// ─── CLAUDE: GENERATE SCENARIO ───────────────────────────────────────────────

async function generateScenario(transcript, videoUrl, videoTitle) {
  const prompt = `You are a scenario designer for Eklipses, an AI social simulation platform where users practice real-life conversations with AI video avatars and get coaching feedback. The platform is focused on dating scenarios.

I'm going to give you a YouTube video transcript from the dating/social skills niche. Your job is to extract the core emotional/social dynamic from the video and turn it into a complete, ready-to-deploy Eklipses scenario.

VIDEO URL: ${videoUrl}
VIDEO TITLE: ${videoTitle || "Unknown"}

TRANSCRIPT:
${transcript.slice(0, 8000)}

Generate a complete scenario with ALL 9 of the following code blocks. Each block must be clearly labeled and ready to copy-paste directly into the codebase. Use a UNIQUE character name and setting that fits the video's theme — do NOT reuse Sofia, Ava, Isabelle, Zoe, Nadia, Julia, Sanna, Anna, Leila, Fatou, Elena, Eden, Maya, or Erika.

---

**BLOCK 1 — scenarios.js entry**
A JavaScript object for the scenarios array. Include: key (camelCase), title, subtitle, backgroundUrl (use placeholder: "https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/SCENARIO_bg.jpg?v=2"), thumbUrl (placeholder: "https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/CHARACTERNAME_thumb.jpg"), characterName, characterAge (25-32), characterJob, and openingDescription (2-3 sentences setting the scene).

**BLOCK 2 — SCENARIO_CHARACTER_MAP entry (player.js)**
One line: "scenarioKey": "characterName"

**BLOCK 3 — CHARACTERS entry (api/character.js)**
Full character object with: name, age, job, personality (detailed, 4-6 traits), conversationStyle, interests (3-5), dealBreakers (2-3), responseStyle guidance.

**BLOCK 4 — SETTINGS entry (api/character.js)**
The scenario setting object with: location, atmosphere, timeOfDay, socialContext, and why she's there.

**BLOCK 5 — AVATAR_SETS entry (player.js)**
Object with characterName as key, containing: speaking (placeholder URL), idle (placeholder URL), thumb (placeholder URL).

**BLOCK 6 — HeyGen speaking script**
Her opening line when the user approaches. 1-3 natural sentences, conversational, not too long. Should immediately establish her personality and create an interesting dynamic for the user to respond to.

**BLOCK 7 — Background image prompt (for ChatGPT image generation)**
A detailed prompt to generate a photorealistic 16:9 1920x1080 background image for this scenario location. No people in the image.

**BLOCK 8 — Rescue lines (player.js freeConversation)**
3 rescue lines she says if the conversation stalls. Array format, strings only.

**BLOCK 9 — Impatience lines (player.js freeConversation)**
3 impatience lines she says if the user takes too long to respond. Array format, strings only.

---

After all 9 blocks, add:
**SCENARIO KEY:** (the camelCase key you used)
**CHARACTER NAME:** (the character name)
**CORE DYNAMIC:** (1 sentence — what social/emotional skill this scenario trains)
**DIFFICULTY:** Easy / Medium / Hard

Make everything feel real, specific, and emotionally interesting. The character should feel like a real person, not a stereotype.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }]
  });

  return response.content[0].text;
}

// ─── PROCESS ONE VIDEO ────────────────────────────────────────────────────────

async function processVideo(url, title, opts = {}) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`🎬 Processing: ${title || url}`);
  console.log(`   ${url}`);

  let transcript = null;

  // Mode: manual file
  if (opts.file) {
    if (!fs.existsSync(opts.file)) {
      console.error(`❌ File not found: ${opts.file}`);
      return null;
    }
    const raw = fs.readFileSync(opts.file, "utf8");
    // Strip timestamps if present (YouTube copy-paste format)
    transcript = raw
      .replace(/^\d+:\d+\n/gm, "")
      .replace(/\[\d+:\d+\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    console.log(`📄 Loaded transcript from file (${transcript.length} chars)`);
  }

  // Mode: auto via yt-dlp
  if (!transcript) {
    console.log(`⏳ Fetching transcript via yt-dlp...`);
    transcript = fetchTranscriptYtDlp(url);

    if (transcript && transcript.length > 200) {
      console.log(`✅ Transcript fetched (${transcript.length} chars)`);
    } else {
      console.log(`⚠️  Auto-transcript failed or too short.`);
      console.log(`   To use manual transcript:`);
      console.log(`   1. Open video → click "..." → "Show transcript" → copy all`);
      console.log(`   2. Save as transcript.txt in EK7 folder`);
      console.log(`   3. Run: node gen-scenario.js --file transcript.txt "${url}"`);
      return null;
    }
  }

  // Generate scenario with Claude
  console.log(`🤖 Generating scenario with Claude...`);
  const output = await generateScenario(transcript, url, title);

  // Extract scenario key for filename
  const keyMatch = output.match(/\*\*SCENARIO KEY:\*\*\s*([a-zA-Z0-9_]+)/);
  const charMatch = output.match(/\*\*CHARACTER NAME:\*\*\s*([a-zA-Z]+)/);
  const scenarioKey = keyMatch?.[1] || "scenario_" + Date.now();
  const characterName = charMatch?.[1] || "character";

  const outputFile = path.join(__dirname, `scenario-${scenarioKey}.txt`);
  const fileContent = [
    `EKLIPSES SCENARIO GENERATOR OUTPUT`,
    `Generated: ${new Date().toISOString()}`,
    `Video: ${url}`,
    `Title: ${title || "Unknown"}`,
    `${"=".repeat(60)}`,
    "",
    output
  ].join("\n");

  fs.writeFileSync(outputFile, fileContent, "utf8");

  console.log(`\n✅ Done! Saved to: scenario-${scenarioKey}.txt`);
  console.log(`   Character: ${characterName}`);

  // Print summary to console
  console.log("\n" + "─".repeat(50));
  console.log(output);

  return { scenarioKey, characterName, outputFile };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Eklipses Scenario Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USAGE:
  Single video (auto transcript):
    node gen-scenario-v2.js https://www.youtube.com/watch?v=VIDEO_ID

  Single video (manual transcript fallback):
    node gen-scenario-v2.js --file transcript.txt https://www.youtube.com/watch?v=VIDEO_ID

  Channel URL — grab top N (paste Popular tab URL from browser):
    node gen-scenario-v2.js --channel "https://www.youtube.com/@TheDarkNeedle/videos?view=0&sort=p" --top 10

  Hand-picked URLs — paste specific videos you chose from Popular tab:
    node gen-scenario-v2.js --urls "https://youtu.be/ABC" "https://youtu.be/DEF" "https://youtu.be/GHI"

REQUIREMENTS:
  - yt-dlp: winget install yt-dlp
  - ANTHROPIC_API_KEY in .env
`);
    process.exit(0);
  }

  const opts = parseArgs(args);

  // Check yt-dlp for auto-transcript modes
  if (opts.mode !== "file") {
    if (!checkYtDlp()) {
      console.log(`\n⚠️  yt-dlp not found. Install it with:`);
      console.log(`   winget install yt-dlp`);
      console.log(`   (or: choco install yt-dlp)`);
      console.log(`\n   Then re-run this script.`);
      console.log(`\n   Alternative — use manual transcript mode:`);
      console.log(`   node gen-scenario.js --file transcript.txt "URL"`);
      process.exit(1);
    }
  }

  // ── CHANNEL MODE ──
  if (opts.mode === "channel") {
    if (!opts.channel) {
      console.error("❌ --channel requires a YouTube channel URL");
      process.exit(1);
    }

    const videos = getTopChannelVideos(opts.channel, opts.top);

    if (videos.length === 0) {
      console.error("❌ No videos found for this channel.");
      process.exit(1);
    }

    console.log(`\n📋 Top ${videos.length} most popular videos:`);
    videos.forEach((v, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${v.title}`);
    });

    console.log(`\n🚀 Starting batch generation...`);
    const results = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      console.log(`\n[${i + 1}/${videos.length}]`);
      try {
        const result = await processVideo(video.url, video.title, opts);
        if (result) results.push({ ...result, video });
        // Small delay between API calls
        if (i < videos.length - 1) await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`❌ Failed for "${video.title}": ${err.message}`);
      }
    }

    console.log(`\n${"═".repeat(50)}`);
    console.log(`✅ Batch complete: ${results.length}/${videos.length} scenarios generated`);
    results.forEach(r => console.log(`  • ${r.characterName} → ${path.basename(r.outputFile)}`));

  // ── URLS MODE — hand-picked list of video URLs ──
  } else if (opts.mode === "urls") {
    if (opts.urls.length === 0) {
      console.error("❌ --urls requires at least one YouTube URL.");
      process.exit(1);
    }

    console.log(`\n📋 Processing ${opts.urls.length} hand-picked videos:`);
    opts.urls.forEach((u, i) => console.log(`  ${String(i + 1).padStart(2)}. ${u}`));
    console.log(`\n🚀 Starting batch generation...`);

    const results = [];
    for (let i = 0; i < opts.urls.length; i++) {
      const url = opts.urls[i];
      console.log(`\n[${i + 1}/${opts.urls.length}]`);
      try {
        const result = await processVideo(url, null, opts);
        if (result) results.push(result);
        if (i < opts.urls.length - 1) await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`❌ Failed for ${url}: ${err.message}`);
      }
    }

    console.log(`\n${"═".repeat(50)}`);
    console.log(`✅ Batch complete: ${results.length}/${opts.urls.length} scenarios generated`);
    results.forEach(r => console.log(`  • ${r.characterName} → ${path.basename(r.outputFile)}`));

  // ── SINGLE VIDEO MODES ──
  } else if (opts.mode === "url" || opts.mode === "file") {
    if (!opts.url) {
      console.error("❌ Please provide a YouTube URL.");
      process.exit(1);
    }

    await processVideo(opts.url, null, opts);

  } else {
    console.error("❌ Could not determine mode. Run without arguments to see usage.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
