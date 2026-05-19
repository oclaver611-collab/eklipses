const https = require('https');

const body = JSON.stringify({
  scenarioKey: 'bar',
  scenarioTitle: 'Bar — Night Out',
  opener: 'hi',
  conversation: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'Ava.' }
  ]
});

const options = {
  hostname: 'eklipses.vercel.app',
  path: '/api/coach',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log('RAW RESPONSE:', data);
    }
  });
});

req.on('error', e => console.error('Error:', e));
req.write(body);
req.end();
