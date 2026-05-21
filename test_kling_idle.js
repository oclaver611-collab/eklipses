// test_kling_idle.js
// Run: node test_kling_idle.js

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const FAL_KEY = "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const PHOTO_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna.png";
const AUDIO_PATH = "C:\\Users\\serge\\Downloads\\silent_10s.wav";
const OUTPUT_PATH = "C:\\Users\\serge\\Downloads\\sanna_idle_v3.mp4";

fal.config({ credentials: FAL_KEY });

async function uploadFile(filePath, mimeType) {
  const fileName = path.basename(filePath);
  console.log(`Uploading ${fileName}...`);
  const file = new File([fs.readFileSync(filePath)], fileName, { type: mimeType });
  const url = await fal.storage.upload(file);
  console.log(`✅ Uploaded: ${url}`);
  return url;
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
    console.log("=== Kling Idle Test v3 (mouth closed) ===\n");

    const imageUrl = await uploadFile(PHOTO_PATH, "image/png");
    const audioUrl = await uploadFile(AUDIO_PATH, "audio/wav");

    console.log("\nSubmitting to Kling Avatar v2 Pro...");
    console.log("(This takes 1-3 minutes)\n");

    const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        prompt: "mouth closed at all times, lips sealed, no speaking, no lip movement, subtle breathing through nose, natural eye blinks, slight head movement, still shoulders, no hand movement, calm and composed, listening",
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`Status: ${update.status}`);
        if (update.logs) {
          update.logs.forEach(log => console.log(" >", log.message));
        }
      },
    });

    console.log("\n✅ Done! Result:", JSON.stringify(result, null, 2));

    const videoUrl = result?.data?.video?.url || result?.video?.url;
    if (videoUrl) {
      console.log(`\nDownloading to ${OUTPUT_PATH}...`);
      await downloadFile(videoUrl, OUTPUT_PATH);
      console.log("✅ Saved!");
    } else {
      console.log("⚠️ No video URL in result.");
    }

  } catch (err) {
    console.error("\n❌ Error:", err.message || err);
  }
}

main();
