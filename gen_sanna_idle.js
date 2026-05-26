require("dotenv").config();
const fs = require("fs");
const https = require("https");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY || "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const PHOTO_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna.png";
const SILENT_AUDIO_PATH = path.join(__dirname, "silent_10s.wav");
const OUTPUT_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna_idle_v2.mp4";

const PROMPT = "woman listening attentively, eyes looking straight forward at all times, direct forward gaze, mouth completely closed, lips sealed shut, no speaking, no lip movement whatsoever, subtle natural breathing through nose only, slow natural eyelid blinking, slight gentle head stillness, calm composed expression, fully engaged and listening, no hand movement, no shoulder movement, natural skin texture, photorealistic";

function toBase64(filePath) {
  return fs.readFileSync(filePath).toString("base64");
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch(e) { reject(new Error(data)); } });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function getJson(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, headers };
    https.get(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch(e) { reject(new Error(data)); } });
    }).on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("=== Sanna Idle v2 — Attentive Listening ===\n");

  console.log("📸 Loading Sanna photo...");
  const imageBase64 = toBase64(PHOTO_PATH);
  const imageDataUrl = `data:image/png;base64,${imageBase64}`;

  console.log("🔇 Loading silent audio...");
  const audioBase64 = toBase64(SILENT_AUDIO_PATH);
  const audioDataUrl = `data:audio/wav;base64,${audioBase64}`;

  console.log("🚀 Submitting to fal.ai Kling Avatar v2 Pro...");
  const headers = { "Authorization": `Key ${FAL_API_KEY}` };

  const submitRes = await postJson(
    "https://queue.fal.run/fal-ai/kling-video/v2/pro/image-to-video",
    headers,
    {
      image_url: imageDataUrl,
      audio_url: audioDataUrl,
      prompt: PROMPT,
      duration: "10",
      aspect_ratio: "16:9",
    }
  );

  const requestId = submitRes.request_id;
  if (!requestId) {
    console.error("❌ No request_id returned:", JSON.stringify(submitRes));
    process.exit(1);
  }
  console.log(`✅ Submitted. Request ID: ${requestId}`);

  // Poll for result
  console.log("\n⏳ Polling for result (this takes 2-4 minutes)...");
  let attempts = 0;
  while (true) {
    await sleep(15000);
    attempts++;
    process.stdout.write(`  Check ${attempts}...`);

    const statusRes = await getJson(
      `https://queue.fal.run/fal-ai/kling-video/v2/pro/image-to-video/requests/${requestId}/status`,
      headers
    );

    if (statusRes.status === "COMPLETED") {
      console.log(" COMPLETED ✅");
      break;
    } else if (statusRes.status === "FAILED") {
      console.error("\n❌ Generation failed:", JSON.stringify(statusRes));
      process.exit(1);
    } else {
      console.log(` ${statusRes.status || "IN_QUEUE"}...`);
    }

    if (attempts > 30) {
      console.error("\n❌ Timeout after 30 checks");
      process.exit(1);
    }
  }

  // Fetch result
  const resultRes = await getJson(
    `https://queue.fal.run/fal-ai/kling-video/v2/pro/image-to-video/requests/${requestId}`,
    headers
  );

  const videoUrl = resultRes?.video?.url || resultRes?.output?.video?.url;
  if (!videoUrl) {
    console.error("❌ No video URL in result:", JSON.stringify(resultRes));
    process.exit(1);
  }

  console.log(`\n⬇️  Downloading to ${OUTPUT_PATH}...`);
  await downloadFile(videoUrl, OUTPUT_PATH);
  console.log("✅ Sanna_idle_v2.mp4 saved!\n");
  console.log("Next step: review the video, then upload to R2:");
  console.log(`  wrangler r2 object put eklipses-videos/sanna_idle.mp4 --file="${OUTPUT_PATH}" --remote`);
}

main().catch(err => { console.error("Fatal error:", err.message); process.exit(1); });
