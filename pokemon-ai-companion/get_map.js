const https = require('https');
const fs = require('fs');

const url = 'https://archives.bulbagarden.net/wiki/File:Mt_Moon_1F_RBY.png';
const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const m = body.match(/https:\/\/archives\.bulbagarden\.net\/media\/upload\/[^"'>]+\/Mt_Moon_1F_RBY\.png/i);
    console.log('Result:', m ? m[0] : 'No match', 'Status:', res.statusCode);
  });
});
req.on('error', (e) => console.error(e));
