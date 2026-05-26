const fs = require('fs');

const sampleRate = 16000;
const numChannels = 1;
const bitsPerSample = 16;
const duration = 10;
const numSamples = sampleRate * duration;
const dataSize = numSamples * numChannels * (bitsPerSample / 8);
const fileSize = 44 + dataSize;

const buf = Buffer.alloc(fileSize, 0);
let o = 0;

// RIFF header
buf.write('RIFF', o); o += 4;
buf.writeUInt32LE(fileSize - 8, o); o += 4;
buf.write('WAVE', o); o += 4;

// fmt chunk
buf.write('fmt ', o); o += 4;
buf.writeUInt32LE(16, o); o += 4;          // chunk size
buf.writeUInt16LE(1, o); o += 2;           // PCM
buf.writeUInt16LE(numChannels, o); o += 2;
buf.writeUInt32LE(sampleRate, o); o += 4;
buf.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, o); o += 4;
buf.writeUInt16LE(numChannels * bitsPerSample / 8, o); o += 2;
buf.writeUInt16LE(bitsPerSample, o); o += 2;

// data chunk
buf.write('data', o); o += 4;
buf.writeUInt32LE(dataSize, o); o += 4;
// rest is already zeros = silence

fs.writeFileSync('silent_10s.wav', buf);
console.log('✅ silent_10s.wav created (' + fileSize + ' bytes)');
