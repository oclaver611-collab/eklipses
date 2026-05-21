// test_wavespeed_avatar.js
// Run: node test_wavespeed_avatar.js

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const WAVESPEED_KEY = "d743287055a267c8c89ca5c12cbcf6c495a6c28e0ecb38bedf3cdf5e9a8584f3";
const PHOTO_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna.png";
const AUDIO_PATH = "C:\\Users\\serge\\Downloads\\sanna_speaking.mp3";
const OUTPUT_PATH = "C:\\Users\\serge\\Downloads\\sanna_wavespeed_speaking.mp4";

const BASE_URL = "https://api.wavespeed.ai/api/v3";

function toBase64(filePath, mimeType) {
  const data = fs.readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${data}`;
}

async function submitJob(imageB64, audioB64) {
  console.log("Submitting to WaveSpeed Kling v2 Avatar Pro...");

  const res = await fetch(`${BASE_URL}/kwaivgi/kling-v2-ai-avatar-pro`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WAVESPEED_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: imageB64,
      audio: audioB64,
      prompt: "natural talking avatar, realistic facial expressions, smooth lip sync",
    }),
  });

  const text = await res.text();
  console.log("Submit response:", text.slice(0, 300));

  const data = JSON.parse(text);
  if (!res.ok) throw new Error(`Submit failed: ${JSON.stringify(data)}`);
  const jobId = data?.data?.id || data?.id;
  console.log(`✅ Job submitted. ID: ${jobId}`);
  return jobId;
}

async function pollResult(jobId) {
  console.log("\nPolling for result...\n");

  while (true) {
    await new Promise(r => setTimeout(r, 10000));

    const res = await fetch(`${BASE_URL}/predictions/${jobId}/result`, {
      headers: { "Authorization": `Bearer ${WAVESPEED_KEY}` },
    });

    const text = await res.text();
    const data = JSON.parse(text);
    const status = data?.data?.status;
    console.log(`Status: ${status}`);

    if (status === "completed") return data.data;
    if (status === "failed") throw new Error(`Job failed: ${JSON.stringify(data)}`);
  }
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(outputPath);
    protocol.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

async function main() {
  try {
    console.log("=== WaveSpeed Kling v2 Avatar Pro Test ===\n");

    console.log("Encoding photo...");
    const imageB64 = toBase64(PHOTO_PATH, "image/png");
    console.log("✅ Photo encoded");

    console.log("Encoding audio...");
    const audioB64 = toBase64(AUDIO_PATH, "audio/mpeg");
    console.log("✅ Audio encoded\n");

    const jobId = await submitJob(imageB64, audioB64);
    const result = await pollResult(jobId);

    console.log("\n✅ Done! Result:", JSON.stringify(result, null, 2));

    const videoUrl = result?.outputs?.[0] || result?.output?.[0] || result?.url;
    if (videoUrl) {
      console.log(`\nDownloading to ${OUTPUT_PATH}...`);
      await downloadFile(videoUrl, OUTPUT_PATH);
      console.log("✅ Saved!");
    } else {
      console.log("⚠️ No video URL found. Check result above.");
    }

  } catch (err) {
    console.error("\n❌ Error:", err.message || err);
  }
}

main();
