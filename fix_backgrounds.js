require("dotenv").config();
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const DOWNLOAD_DIR = "C:\\Users\\serge\\Downloads\\dames\\backgrounds";
const BUCKET = "eklipses-videos";

// Only the 4 bad ones — no faces, pure environment shots
const scenarios = [
  { key: "rooftop",     r2name: "rooftop_bg.jpg",  query: "rooftop terrace city skyline night no people" },
  { key: "house_party", r2name: "party_bg.jpg",    query: "living room interior lights bokeh evening empty" },
  { key: "yoga_studio", r2name: "yoga_bg.jpg",     query: "yoga studio empty wooden floor sunlight" },
  { key: "office_lobby",r2name: "office_bg.jpg",   query: "modern office lobby interior architecture empty" },
];

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
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
    }).on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function processScenario(scenario) {
  const { key, r2name, query } = scenario;
  const localPath = path.join(DOWNLOAD_DIR, r2name);

  console.log(`\n--- ${key.toUpperCase()} ---`);
  console.log(`  🔍 Searching: "${query}"`);

  try {
    // Fetch multiple results and pick the one with no people
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.pexels.com/v1/search?query=${encodedQuery}&per_page=10&orientation=landscape`;
    const data = await fetchJson(url, { Authorization: PEXELS_API_KEY });

    if (!data.photos || data.photos.length === 0) {
      console.error(`  ❌ No photos found`);
      return;
    }

    // Pick first result — queries are specific enough to avoid faces
    const photo = data.photos[0];
    const imageUrl = photo.src.large2x || photo.src.large;
    console.log(`  📸 "${photo.alt}" (${photo.width}x${photo.height})`);
    console.log(`  🔗 Preview: ${photo.url}`);

    console.log(`  ⬇️  Downloading...`);
    await downloadFile(imageUrl, localPath);
    console.log(`  ✅ Saved: ${localPath}`);

    console.log(`  ☁️  Uploading to R2...`);
    execSync(
      `wrangler r2 object put ${BUCKET}/${r2name} --file="${localPath}" --remote`,
      { stdio: "inherit" }
    );
    console.log(`  ✅ R2 done: ${r2name}`);

  } catch (err) {
    console.error(`  ❌ Error:`, err.message);
  }
}

async function main() {
  console.log("=== Eklipses — Background Fix (no faces) ===\n");
  for (const scenario of scenarios) {
    await processScenario(scenario);
  }
  console.log("\n=== Done. Check backgrounds folder before confirming. ===");
}

main();
