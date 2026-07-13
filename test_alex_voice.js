require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const TEXT = "Hey — sorry to interrupt for one second. I had to stop. That hairstyle — where do you get it done? It's actually incredible.";

// Fish Audio male voice — "ALEX_CHIKNA": confident energetic young male, public model
const FISH_MALE_VOICE_ID = '52e0660e03fe4f9a8d2336f67cab5440';

async function testOpenAI() {
  const out = path.join(__dirname, 'test_alex_echo.mp3');
  console.log('[openai] Requesting tts-1-hd / echo ...');
  const t0 = Date.now();

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      voice: 'echo',
      input: TEXT,
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[openai] ERROR ${res.status}:`, err);
    return;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log(`[openai] OK — test_alex_echo.mp3  ${(buf.length / 1024).toFixed(1)} KB  (${Date.now() - t0}ms)`);
}

async function testFishAudio() {
  const out = path.join(__dirname, 'test_alex_fish.mp3');
  console.log(`[fish]   Requesting voice ${FISH_MALE_VOICE_ID} ...`);
  const t0 = Date.now();

  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: TEXT,
      reference_id: FISH_MALE_VOICE_ID,
      format: 'mp3',
      streaming: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[fish]   ERROR ${res.status}:`, err);
    return;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log(`[fish]   OK — test_alex_fish.mp3   ${(buf.length / 1024).toFixed(1)} KB  (${Date.now() - t0}ms)`);
}

(async () => {
  await Promise.all([testOpenAI(), testFishAudio()]);
})();
