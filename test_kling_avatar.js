// test_kling_avatar.js
// Run: npm install @fal-ai/client && node test_kling_avatar.js

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const FAL_KEY = "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const PHOTO_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna.png";
const AUDIO_PATH = "C:\\Users\\serge\\Downloads\\sanna_speaking.mp3";
const OUTPUT_PATH = "C:\\Users\\serge\\Downloads\\sanna_speaking_avatar.mp4";

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
    console.log("=== Kling Avatar v2 Pro Test ===\n");

    const imageUrl = await uploadFile(PHOTO_PATH, "image/png");
    const audioUrl = await uploadFile(AUDIO_PATH, "audio/mpeg");

    console.log("\nSubmitting to Kling Avatar v2 Pro...");
    console.log("(This takes 1-3 minutes)\n");

    const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
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

    const videoUrl = result?.video?.url;
    if (videoUrl) {
      console.log(`\nDownloading to ${OUTPUT_PATH}...`);
      await downloadFile(videoUrl, OUTPUT_PATH);
      console.log("✅ Saved!");
    } else {
      console.log("⚠️ No video URL in result.");
    }

  } catch (err) {
    console.error("\n❌ Error:", err.message || err);
    if (JSON.stringify(err).includes("402") || JSON.stringify(err).includes("billing")) {
      console.log("→ No credit left on fal.ai. Switch to WaveSpeed.");
    }
  }
}

main();
