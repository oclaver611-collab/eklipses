// test_kling_idle_sarah2.js
// Run: node test_kling_idle_sarah2.js

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const FAL_KEY = "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const PHOTO_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sarah.png";
const AUDIO_PATH = "C:\\Users\\serge\\Downloads\\silent_10s.wav";
const OUTPUT_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sarah_idle_v3.mp4";

fal.config({ credentials: FAL_KEY });

async function uploadFile(filePath, mimeType) {
  const fileName = path.basename(filePath);
  const file = new File([fs.readFileSync(filePath)], fileName, { type: mimeType });
  const url = await fal.storage.upload(file);
  console.log(`✅ Uploaded: ${fileName}`);
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
    console.log("=== Sarah Idle v3 ===\n");

    const imageUrl = await uploadFile(PHOTO_PATH, "image/png");
    const audioUrl = await uploadFile(AUDIO_PATH, "audio/wav");

    console.log("\nSubmitting...\n");

    const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        prompt: "eyes looking straight forward at all times, slow natural eyelid movement, soft gentle blinks, no fast eye movement, no robotic motion, mouth closed, lips sealed, no lip movement, subtle breathing through nose, very slight natural head movement, still shoulders, no hand movement, calm relaxed expression, not looking down, photorealistic natural motion",
      },
      logs: false,
      onQueueUpdate: (update) => {
        process.stdout.write(`\rStatus: ${update.status}     `);
      },
    });

    const videoUrl = result?.data?.video?.url || result?.video?.url;
    if (videoUrl) {
      console.log(`\nDownloading...`);
      await downloadFile(videoUrl, OUTPUT_PATH);
      console.log(`✅ Saved: ${OUTPUT_PATH}`);
    } else {
      console.log("\n⚠️ No video URL found.");
    }

  } catch (err) {
    console.error("\n❌ Error:", err.message || err);
  }
}

main();
