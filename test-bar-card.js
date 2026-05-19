const https = require('https');

const conversation = [
  { role: 'user', content: 'hi what is your name' },
  { role: 'assistant', content: 'Ava.' },
  { role: 'user', content: 'nice to meet you Ava my name is Paul what are you up to' },
  { role: 'assistant', content: 'Just passing time. What about you?' },
  { role: 'user', content: 'same here I work in IT pretty busy but I like to relax sometimes' },
  { role: 'assistant', content: 'That sounds like a lot. What do you do to unwind?' },
  { role: 'user', content: 'I come to places like this honestly you seem interesting what do you do' },
  { role: 'assistant', content: 'I have my own thing going on. What made you come over?' },
  { role: 'user', content: 'I just thought you seemed interesting and wanted to talk maybe we can grab coffee sometime' },
  { role: 'assistant', content: "Maybe. Let's see how this goes first." },
];

const body = JSON.stringify({
  scenarioKey: 'bar',
  scenarioTitle: 'Bar — Night Out',
  opener: 'hi what is your name',
  conversation
});

const options = {
  hostname: 'eklipses.vercel.app',
  path: '/api/coach',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('bestMoment:', parsed.bestMoment);
      console.log('missedOpportunity:', parsed.missedOpportunity);
      console.log('tryNextTime:', parsed.tryNextTime);
      console.log('wouldSheDateHim:', parsed.wouldSheDateHim);
      console.log('openerBreakdown:', parsed.openerBreakdown);
    } catch(e) {
      console.log('RAW:', data.substring(0, 500));
    }
  });
});
req.on('error', e => console.error(e));
req.write(body);
req.end();
