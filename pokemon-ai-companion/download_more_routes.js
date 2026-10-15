const https = require('https');
const fs = require('fs');
const path = require('path');

const targets = [
  { id: 12, wiki: 'File:Kanto_Route_1_RBY.png', name: 'Kanto_Route_1_RBY.png' },
  { id: 13, wiki: 'File:Kanto_Route_2_RBY.png', name: 'Kanto_Route_2_RBY.png' },
  { id: 16, wiki: 'File:Kanto_Route_5_RBY.png', name: 'Kanto_Route_5_RBY.png' },
  { id: 24, wiki: 'File:Kanto_Route_24_RBY.png', name: 'Kanto_Route_24_RBY.png' },
  { id: 25, wiki: 'File:Kanto_Route_25_RBY.png', name: 'Kanto_Route_25_RBY.png' },
  { id: 4, wiki: 'File:Vermilion_City_RBY.png', name: 'Vermilion_City_RBY.png' },
  { id: 68, wiki: 'File:Pokemon_Center_1_RBY.png', name: 'Pokemon_Center_1_RBY.png' }
];

async function fetchAndDownload(item) {
  const url = `https://archives.bulbagarden.net/wiki/${item.wiki}`;
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        const matches = [...b.matchAll(/https:\/\/archives\.bulbagarden\.net\/media\/upload\/[^"'>]+\.png/gi)].map(m => m[0]);
        const good = matches.find(m => m.includes(item.name) && !m.includes('thumb'));
        if (good) {
          console.log(`Found ${item.name}: ${good}`);
          const dest = path.join(__dirname, 'public', 'maps', `map_${item.id}.png`);
          const file = fs.createWriteStream(dest);
          https.get(good, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res2) => {
            res2.pipe(file);
            file.on('finish', () => {
              file.close(() => {
                console.log(`Saved map_${item.id}.png (${fs.statSync(dest).size} bytes)`);
                resolve(true);
              });
            });
          });
        } else {
          console.log(`No direct image for ${item.wiki}`);
          resolve(false);
        }
      });
    }).on('error', () => resolve(false));
  });
}

async function run() {
  for (const t of targets) {
    await fetchAndDownload(t);
  }
}
run();
