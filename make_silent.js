const fs = require('fs');

const sampleRate = 44100;
const duration = 10;
const numSamples = sampleRate * duration;
const dataSize = numSamples * 2; // 16-bit mono
const fileSize = 44 + dataSize;

const buf = Buffer.alloc(fileSize);

// RIFF header
buf.write('RIFF', 0, 'ascii');
buf.writeUInt32LE(fileSize - 8, 4);
buf.write('WAVE', 8, 'ascii');

// fmt chunk
buf.write('fmt ', 12, 'ascii');
buf.writeUInt32LE(16, 16);        // chunk size
buf.writeUInt16LE(1, 20);         // PCM
buf.writeUInt16LE(1, 22);         // mono
buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
buf.writeUInt16LE(2, 32);         // block align
buf.writeUInt16LE(16, 34);        // bits per sample

// data chunk
buf.write('data', 36, 'ascii');
buf.writeUInt32LE(dataSize, 40);
// samples are already 0 (silence)

fs.writeFileSync('C:/Users/serge/Downloads/silent_10s.wav', buf);
console.log('✅ Created silent_10s.wav');
