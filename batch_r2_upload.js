const { execSync } = require("child_process");
const path = require("path");

const SOURCE_DIR = "C:\\Users\\serge\\Downloads\\dames";
const BUCKET = "eklipses-videos";

const characters = [
  { name: "sanna",  speaking: "sanna_speaking2.mp4", idle: "sanna_idle.mp4",       thumb: "Sanna.png" },
  { name: "sarah",  speaking: "Sarah_speaking.mp4",  idle: "Sarah_idle_v3.mp4",    thumb: "Sarah.png" },
  { name: "anna",   speaking: "Anna_speaking.mp4",   idle: "Anna_idle.mp4",         thumb: "Anna.png"  },
  { name: "leila",  speaking: "Leila_speaking.mp4",  idle: "Leila_idle.mp4",        thumb: "Leila.png" },
  { name: "fatou",  speaking: "Fatou_speaking.mp4",  idle: "Fatou_idle.mp4",        thumb: "Fatou.png" },
  { name: "elena",  speaking: "Elena_speaking.mp4",  idle: "Elena_idle.mp4",        thumb: "Elena.png" },
  { name: "eden",   speaking: "Eden_speaking.mp4",   idle: "Eden_idle.mp4",         thumb: "Eden.png"  },
  { name: "maya",   speaking: "Maya_speaking.mp4",   idle: "Maya_idle.mp4",         thumb: "Maya.jpg"  },
  { name: "erika",  speaking: "Erika_speaking.mp4",  idle: "Erika_idle.mp4",        thumb: "Erika.png" },
];

function upload(r2Key, localFile) {
  const filePath = path.join(SOURCE_DIR, localFile);
  const cmd = `wrangler r2 object put ${BUCKET}/${r2Key} --file="${filePath}" --remote`;
  console.log(`  Uploading ${r2Key}...`);
  try {
    execSync(cmd, { stdio: "inherit" });
    console.log(`  ✅ Done: ${r2Key}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${r2Key}`);
  }
}

console.log("=== Eklipses Wave 2 — Batch R2 Upload ===\n");

for (const char of characters) {
  console.log(`\n--- ${char.name.toUpperCase()} ---`);
  upload(`${char.name}_speaking.mp4`, char.speaking);
  upload(`${char.name}_idle.mp4`,     char.idle);
  upload(`${char.name.charAt(0).toUpperCase() + char.name.slice(1)}_thumb.jpg`, char.thumb);
}

console.log("\n=== All uploads complete ===");
