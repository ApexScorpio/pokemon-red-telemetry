const https = require('https');
const fs = require('fs');
const path = require('path');

const downloads = [
  { id: 15, url: 'https://archives.bulbagarden.net/media/upload/1/11/Kanto_Route_4_RBY.png' },
  { id: 14, url: 'https://archives.bulbagarden.net/media/upload/6/65/Kanto_Route_3_RBY.png' },
  { id: 12, url: 'https://archives.bulbagarden.net/media/upload/a/a2/Kanto_Route_1_RBY.png' },
  { id: 13, url: 'https://archives.bulbagarden.net/media/upload/a/ab/Kanto_Route_2_RBY.png' },
  { id: 16, url: 'https://archives.bulbagarden.net/media/upload/8/87/Kanto_Route_5_RBY.png' },
  { id: 17, url: 'https://archives.bulbagarden.net/media/upload/3/30/Kanto_Route_6_RBY.png' },
  { id: 24, url: 'https://archives.bulbagarden.net/media/upload/e/ee/Kanto_Route_24_RBY.png' },
  { id: 25, url: 'https://archives.bulbagarden.net/media/upload/5/5f/Kanto_Route_25_RBY.png' }
];

async function download(item) {
  const dest = path.join(__dirname, 'public', 'maps', `map_${item.id}.png`);
  return new Promise((resolve) => {
    https.get(item.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            const stats = fs.statSync(dest);
            console.log(`Saved map_${item.id}.png (${stats.size} bytes)`);
            resolve(true);
          });
        });
      } else {
        console.log(`Failed map_${item.id}.png: HTTP ${res.statusCode}`);
        resolve(false);
      }
    }).on('error', (e) => {
      console.error(e);
      resolve(false);
    });
  });
}

async function run() {
  for (const it of downloads) {
    await download(it);
  }
  console.log('Done!');
}
run();
