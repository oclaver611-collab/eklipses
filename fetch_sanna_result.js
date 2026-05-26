require("dotenv").config();
const https = require("https");
const fs = require("fs");

const FAL_API_KEY = process.env.FAL_API_KEY || "97361853-c81a-4722-a1b0-8c60cc2b6657:a94ebac79d379106fc4e559ad2b07cff";
const REQUEST_ID = "019e514f-3d7f-7530-bca0-a8dbb2ea56dc";
const OUTPUT_PATH = "C:\\Users\\serge\\Downloads\\dames\\Sanna_idle_v2.mp4";

function getJson(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, headers };
    https.get(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        console.log(`  HTTP ${res.statusCode}`);
        console.log(`  Raw: ${data.slice(0, 500)}`);
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error(data)); }
      });
    }).on("error", (e) => { console.error("Network error:", e.message); reject(e); });
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
  const headers = { "Authorization": `Key ${FAL_API_KEY}` };
  console.log(`Checking status of request: ${REQUEST_ID}\n`);

  let attempts = 0;
  while (true) {
    console.log(`Check ${++attempts}...`);
    const statusRes = await getJson(
      `https://queue.fal.run/fal-ai/kling-video/v2/pro/image-to-video/requests/${REQUEST_ID}/status`,
      headers
    );

    const status = (statusRes.status || statusRes.state || "").toUpperCase();
    if (status === "COMPLETED") { console.log("✅ COMPLETED"); break; }
    if (status === "FAILED") { console.error("❌ FAILED"); process.exit(1); }
    if (attempts > 20) { console.error("Timeout"); process.exit(1); }
    console.log(`Status: ${status} — waiting 15s...`);
    await sleep(15000);
  }

  console.log("\nFetching result...");
  const resultRes = await getJson(
    `https://queue.fal.run/fal-ai/kling-video/v2/pro/image-to-video/requests/${REQUEST_ID}`,
    headers
  );

  const videoUrl = resultRes?.video?.url || resultRes?.output?.video?.url;
  if (!videoUrl) { console.error("❌ No video URL. Full:", JSON.stringify(resultRes)); process.exit(1); }

  console.log(`\n⬇️  Downloading...`);
  await downloadFile(videoUrl, OUTPUT_PATH);
  console.log(`✅ Saved: ${OUTPUT_PATH}`);
  console.log(`\nUpload:\n  wrangler r2 object put eklipses-videos/sanna_idle.mp4 --file="${OUTPUT_PATH}" --remote`);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
