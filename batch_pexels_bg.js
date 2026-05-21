require("dotenv").config();
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const DOWNLOAD_DIR = "C:\\Users\\serge\\Downloads\\dames\\backgrounds";
const BUCKET = "eklipses-videos";

if (!PEXELS_API_KEY) {
  console.error("❌ PEXELS_API_KEY not found in .env");
  process.exit(1);
}

// Create download dir if it doesn't exist
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  console.log(`📁 Created folder: ${DOWNLOAD_DIR}`);
}

const scenarios = [
  { key: "rooftop",     r2name: "rooftop_bg.jpg",     query: "rooftop bar city night lights" },
  { key: "house_party", r2name: "party_bg.jpg",        query: "house party living room evening" },
  { key: "coffee_shop", r2name: "coffee_bg.jpg",       query: "cozy coffee shop interior warm" },
  { key: "art_gallery", r2name: "gallery_bg.jpg",      query: "modern art gallery white walls" },
  { key: "yoga_studio", r2name: "yoga_bg.jpg",         query: "bright yoga studio interior" },
  { key: "airport",     r2name: "airport_bg.jpg",      query: "airport terminal departure lounge" },
  { key: "supermarket", r2name: "supermarket_bg.jpg",  query: "supermarket aisle fresh produce" },
  { key: "office_lobby",r2name: "office_bg.jpg",       query: "modern office lobby interior" },
  { key: "train",       r2name: "train_bg.jpg",        query: "train interior passenger car window" },
];

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const options = { headers };
    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function processScenario(scenario) {
  const { key, r2name, query } = scenario;
  const localPath = path.join(DOWNLOAD_DIR, r2name);

  console.log(`\n--- ${key.toUpperCase()} ---`);
  console.log(`  🔍 Searching Pexels: "${query}"`);

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.pexels.com/v1/search?query=${encodedQuery}&per_page=5&orientation=landscape`;
    const data = await fetchJson(url, { Authorization: PEXELS_API_KEY });

    if (!data.photos || data.photos.length === 0) {
      console.error(`  ❌ No photos found for: ${query}`);
      return;
    }

    // Pick the highest quality landscape photo
    const photo = data.photos[0];
    const imageUrl = photo.src.large2x || photo.src.large;
    console.log(`  📸 Found: "${photo.alt || photo.photographer}" (${photo.width}x${photo.height})`);

    // Download
    console.log(`  ⬇️  Downloading...`);
    await downloadFile(imageUrl, localPath);
    console.log(`  ✅ Saved: ${localPath}`);

    // Upload to R2
    console.log(`  ☁️  Uploading to R2...`);
    execSync(
      `wrangler r2 object put ${BUCKET}/${r2name} --file="${localPath}" --remote`,
      { stdio: "inherit" }
    );
    console.log(`  ✅ R2 upload done: ${r2name}`);

  } catch (err) {
    console.error(`  ❌ Error for ${key}:`, err.message);
  }
}

async function main() {
  console.log("=== Eklipses — Pexels Background Auto-Download + R2 Upload ===\n");

  for (const scenario of scenarios) {
    await processScenario(scenario);
  }

  console.log("\n=== All backgrounds processed ===");
  console.log(`📁 Local copies saved in: ${DOWNLOAD_DIR}`);
}

main();
