// batch_kling_idle.js
// Generates idle videos for all 9 Wave 2 characters
// Run: node batch_kling_idle.js

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const FAL_KEY = "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const PHOTOS_DIR = "C:\\Users\\serge\\Downloads\\dames";
const SILENT_AUDIO = "C:\\Users\\serge\\Downloads\\silent_10s.wav";
const OUTPUT_DIR = "C:\\Users\\serge\\Downloads\\dames";

const CHARACTERS = [
  { name: "Sanna",  photo: "Sanna.png"  },
  { name: "Sarah",  photo: "Sarah.png"  },
  { name: "Anna",   photo: "Anna.png"   },
  { name: "Leila",  photo: "Leila.png"  },
  { name: "Fatou",  photo: "Fatou.png"  },
  { name: "Elena",  photo: "Elena.png"  },
  { name: "Eden",   photo: "Eden.png"   },
  { name: "Maya",   photo: "Maya.jpg"   },
  { name: "Erika",  photo: "Erika.png"  },
];

const IDLE_PROMPT = "mouth closed at all times, lips sealed, no speaking, no lip movement, subtle breathing through nose, natural eye blinks, slight head movement, still shoulders, no hand movement, calm and composed, listening";

fal.config({ credentials: FAL_KEY });

async function uploadFile(filePath, mimeType) {
  const fileName = path.basename(filePath);
  const file = new File([fs.readFileSync(filePath)], fileName, { type: mimeType });
  const url = await fal.storage.upload(file);
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

async function generateIdle(character) {
  const photoPath = path.join(PHOTOS_DIR, character.photo);
  const outputPath = path.join(OUTPUT_DIR, `${character.name}_idle.mp4`);

  console.log(`\n[${character.name}] Starting...`);

  // Skip if already done
  if (fs.existsSync(outputPath)) {
    console.log(`[${character.name}] ✅ Already exists, skipping.`);
    return;
  }

  const mimeType = character.photo.endsWith(".jpg") ? "image/jpeg" : "image/png";

  console.log(`[${character.name}] Uploading photo...`);
  const imageUrl = await uploadFile(photoPath, mimeType);

  console.log(`[${character.name}] Uploading silent audio...`);
  const audioUrl = await uploadFile(SILENT_AUDIO, "audio/wav");

  console.log(`[${character.name}] Submitting to Kling Avatar v2 Pro...`);

  const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
    input: {
      image_url: imageUrl,
      audio_url: audioUrl,
      prompt: IDLE_PROMPT,
    },
    logs: false,
    onQueueUpdate: (update) => {
      process.stdout.write(`\r[${character.name}] Status: ${update.status}     `);
    },
  });

  const videoUrl = result?.data?.video?.url || result?.video?.url;
  if (videoUrl) {
    console.log(`\n[${character.name}] Downloading...`);
    await downloadFile(videoUrl, outputPath);
    console.log(`[${character.name}] ✅ Saved: ${outputPath}`);
  } else {
    console.log(`\n[${character.name}] ⚠️ No video URL. Result: ${JSON.stringify(result)}`);
  }
}

async function main() {
  console.log("=== Kling Idle Batch — All 9 Wave 2 Characters ===\n");
  console.log(`Processing ${CHARACTERS.length} characters sequentially...\n`);

  const results = { success: [], failed: [] };

  for (const character of CHARACTERS) {
    try {
      await generateIdle(character);
      results.success.push(character.name);
    } catch (err) {
      console.error(`\n[${character.name}] ❌ Error: ${err.message}`);
      results.failed.push(character.name);
    }
  }

  console.log("\n=== BATCH COMPLETE ===");
  console.log(`✅ Success: ${results.success.join(", ")}`);
  if (results.failed.length > 0) {
    console.log(`❌ Failed: ${results.failed.join(", ")}`);
  }
}

main();
