require("dotenv").config();
const fs = require("fs");
const https = require("https");
const path = require("path");
const { fal } = require("@fal-ai/client");

const FAL_API_KEY = process.env.FAL_API_KEY || "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const PHOTO_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna.png";
const SILENT_AUDIO_PATH = path.join(__dirname, "silent_10s.wav");
const OUTPUT_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna_idle_v2.mp4";

const PROMPT = "woman listening attentively, eyes looking straight forward at all times, direct forward gaze, mouth completely closed, lips sealed shut, no speaking, no lip movement whatsoever, subtle natural breathing through nose only, slow natural eyelid blinking, calm composed expression, fully engaged and listening, no hand movement, no shoulder movement, photorealistic";

function toDataUrl(filePath, mimeType) {
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function downloadFile(url, dest, redirects) {
  redirects = redirects || 0;
  if (redirects > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith("https") ? https : require("http");
    get.get(url, (res) => {
      console.log(`  Download HTTP ${res.statusCode} from ${url.slice(0,80)}`);
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        file.close();
        fs.unlinkSync(dest);
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
    }).on("error", err => { try { fs.unlinkSync(dest); } catch(e){} reject(err); });
  });
}

async function main() {
  console.log("=== Sanna Idle v2 — Attentive Listening ===\n");
  fal.config({ credentials: FAL_API_KEY });

  console.log("📸 Loading photo...");
  const imageDataUrl = toDataUrl(PHOTO_PATH, "image/png");

  console.log("🔇 Loading silent audio...");
  const audioDataUrl = toDataUrl(SILENT_AUDIO_PATH, "audio/wav");

  console.log("🚀 Submitting...");
  const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
    input: {
      image_url: imageDataUrl,
      audio_url: audioDataUrl,
      prompt: PROMPT,
      duration: "10",
      aspect_ratio: "16:9",
    },
    logs: true,
    onQueueUpdate: (update) => {
      console.log(`  Status: ${update.status}${update.queue_position !== undefined ? ` (pos: ${update.queue_position})` : ''}`);
    },
  });

  console.log("\n✅ Done! Full result:");
  console.log(JSON.stringify(result, null, 2));

  // Try every possible path
  const videoUrl =
    result?.video?.url ||
    result?.data?.video?.url ||
    result?.data?.video ||
    result?.output?.video?.url ||
    result?.output?.video ||
    (typeof result === "string" ? result : null);

  if (!videoUrl) {
    console.error("❌ Could not find video URL in result above.");
    process.exit(1);
  }

  console.log(`\n⬇️  Downloading from: ${videoUrl}`);
  await downloadFile(videoUrl, OUTPUT_PATH);
  console.log(`✅ Saved: ${OUTPUT_PATH}`);
  console.log(`\nUpload:\n  wrangler r2 object put eklipses-videos/sanna_idle.mp4 --file="${OUTPUT_PATH}" --remote`);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
