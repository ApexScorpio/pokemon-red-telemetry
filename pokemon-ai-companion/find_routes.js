const https = require('https');

async function checkUrl(wiki) {
  return new Promise((resolve) => {
    https.get(`https://archives.bulbagarden.net/wiki/${wiki}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const matches = [...body.matchAll(/https:\/\/archives\.bulbagarden\.net\/media\/upload\/[^"'>]+\.png/gi)].map(m => m[0]);
        const good = matches.filter(m => !m.includes('logo') && !m.includes('Project') && !m.includes('80px') && !m.includes('20px'));
        resolve(good);
      });
    }).on('error', () => resolve([]));
  });
}

async function run() {
  const pages = ['File:Route_4_RBY.png', 'File:Kanto_Route_4_RBY.png', 'File:Route_4.png', 'File:Route_3_RBY.png', 'File:Kanto_Route_3_RBY.png'];
  for (const p of pages) {
    const urls = await checkUrl(p);
    console.log(p, '->', urls);
  }
}
run();
