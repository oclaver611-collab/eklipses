// batch_kling_idle.js
// Generates idle videos for all characters using fal.ai Kling Avatar v2 Pro
// Correct endpoint: fal-ai/kling-video/ai-avatar/v2/pro
// Correct result path: result.data.video.url
// Run: node batch_kling_idle.js

require("dotenv").config();
const fs = require("fs");
const https = require("https");
const path = require("path");
const { fal } = require("@fal-ai/client");

const FAL_API_KEY = process.env.FAL_API_KEY || "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const PHOTO_DIR   = "C:\\Users\\serge\\Downloads\\dames";
const OUTPUT_DIR  = "C:\\Users\\serge\\Downloads\\dames";
const SILENT_AUDIO = path.join(__dirname, "silent_10s.wav");

// Best prompt — confirmed working (attentive listening, no lip movement, forward gaze)
const IDLE_PROMPT = "woman listening attentively, eyes looking straight forward at all times, direct forward gaze, mouth completely closed, lips sealed shut, no speaking, no lip movement whatsoever, subtle natural breathing through nose only, slow natural eyelid blinking, slight gentle head stillness, calm composed expression, fully engaged and listening, no hand movement, no shoulder movement, photorealistic";

const characters = [
  { name: "sanna",  photo: "Sanna.png",  output: "Sanna_idle.mp4"  },
  { name: "sarah",  photo: "Sarah.png",  output: "Sarah_idle.mp4"  },
  { name: "anna",   photo: "Anna.png",   output: "Anna_idle.mp4"   },
  { name: "leila",  photo: "Leila.png",  output: "Leila_idle.mp4"  },
  { name: "fatou",  photo: "Fatou.png",  output: "Fatou_idle.mp4"  },
  { name: "elena",  photo: "Elena.png",  output: "Elena_idle.mp4"  },
  { name: "eden",   photo: "Eden.png",   output: "Eden_idle.mp4"   },
  { name: "maya",   photo: "Maya.jpg",   output: "Maya_idle.mp4"   },
  { name: "erika",  photo: "Erika.png",  output: "Erika_idle.mp4"  },
];

function toDataUrl(filePath, mimeType) {
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function downloadFile(url, dest, redirects) {
  redirects = redirects || 0;
  if (redirects > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if ([301, 302, 307].includes(res.statusCode)) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        downloadFile(res.headers.location, dest, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", err => { try { fs.unlinkSync(dest); } catch(e) {} reject(err); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateIdle(char) {
  const photoPath  = path.join(PHOTO_DIR, char.photo);
  const outputPath = path.join(OUTPUT_DIR, char.output);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    console.log(`  ⏭️  Skipping ${char.name} — ${char.output} already exists`);
    return true;
  }

  if (!fs.existsSync(photoPath)) {
    console.error(`  ❌ Photo not found: ${photoPath}`);
    return false;
  }

  const mimeType = char.photo.endsWith(".jpg") ? "image/jpeg" : "image/png";
  const imageDataUrl = toDataUrl(photoPath, mimeType);
  const audioDataUrl = toDataUrl(SILENT_AUDIO, "audio/wav");

  console.log(`  🚀 Submitting ${char.name}...`);

  try {
    const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
      input: {
        image_url: imageDataUrl,
        audio_url: audioDataUrl,
        prompt: IDLE_PROMPT,
        duration: "10",
        aspect_ratio: "16:9",
      },
      logs: false,
      onQueueUpdate: (update) => {
        process.stdout.write(`\r  Status: ${update.status}${update.queue_position !== undefined ? ` (pos: ${update.queue_position})` : ''}    `);
      },
    });

    console.log(`\n  ✅ Generation complete`);

    const videoUrl = result?.data?.video?.url || result?.video?.url || result?.output?.video?.url;
    if (!videoUrl) {
      console.error(`  ❌ No video URL. Result: ${JSON.stringify(result).slice(0, 200)}`);
      return false;
    }

    console.log(`  ⬇️  Downloading...`);
    await downloadFile(videoUrl, outputPath);
    const size = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`  ✅ Saved: ${char.output} (${size} MB)`);
    return true;

  } catch (err) {
    console.error(`\n  ❌ Error for ${char.name}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("=== Eklipses — Batch Idle Generator ===");
  console.log(`Endpoint: fal-ai/kling-video/ai-avatar/v2/pro`);
  console.log(`Cost: ~$1.15 per video\n`);

  if (!fs.existsSync(SILENT_AUDIO)) {
    console.error(`❌ silent_10s.wav not found. Run: node make_silent_v2.js first`);
    process.exit(1);
  }

  fal.config({ credentials: FAL_API_KEY });

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const char of characters) {
    console.log(`\n--- ${char.name.toUpperCase()} ---`);
    const existed = fs.existsSync(path.join(OUTPUT_DIR, char.output));
    const ok = await generateIdle(char);
    if (existed) { skipped++; }
    else if (ok) { passed++; }
    else { failed++; }

    // Wait between submissions to avoid rate limits
    if (!existed) await sleep(3000);
  }

  console.log("\n=== Batch Complete ===");
  console.log(`✅ Generated: ${passed}`);
  console.log(`⏭️  Skipped:   ${skipped}`);
  console.log(`❌ Failed:    ${failed}`);

  if (passed > 0) {
    console.log("\nUpload all to R2:");
    for (const char of characters) {
      console.log(`  wrangler r2 object put eklipses-videos/${char.name}_idle.mp4 --file="${path.join(OUTPUT_DIR, char.output)}" --remote`);
    }
  }
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
