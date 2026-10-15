const https = require('https');
const fs = require('fs');
const path = require('path');

const mapsDir = path.join(__dirname, 'public', 'maps');
if (!fs.existsSync(mapsDir)) {
  fs.mkdirSync(mapsDir, { recursive: true });
}

const mapFiles = [
  { id: 59, name: 'Mt_Moon_1F_RBY.png', wiki: 'File:Mt_Moon_1F_RBY.png' },
  { id: 60, name: 'Mt_Moon_B1F_RBY.png', wiki: 'File:Mt_Moon_B1F_RBY.png' },
  { id: 61, name: 'Mt_Moon_B2F_RBY.png', wiki: 'File:Mt_Moon_B2F_RBY.png' },
  { id: 15, name: 'Route_4_RBY.png', wiki: 'File:Route_4_RBY.png' },
  { id: 14, name: 'Route_3_RBY.png', wiki: 'File:Route_3_RBY.png' },
  { id: 2, name: 'Pewter_City_RBY.png', wiki: 'File:Pewter_City_RBY.png' },
  { id: 3, name: 'Cerulean_City_RBY.png', wiki: 'File:Cerulean_City_RBY.png' },
  { id: 0, name: 'Pallet_Town_RBY.png', wiki: 'File:Pallet_Town_RBY.png' },
  { id: 1, name: 'Viridian_City_RBY.png', wiki: 'File:Viridian_City_RBY.png' },
  { id: 12, name: 'Route_1_RBY.png', wiki: 'File:Route_1_RBY.png' },
  { id: 13, name: 'Route_2_RBY.png', wiki: 'File:Route_2_RBY.png' },
  { id: 51, name: 'Viridian_Forest_RBY.png', wiki: 'File:Viridian_Forest_RBY.png' },
  { id: 54, name: 'Pewter_Gym_RBY.png', wiki: 'File:Pewter_Gym_RBY.png' },
  { id: 68, name: 'Mt_Moon_Pokecenter_RBY.png', wiki: 'File:Pokemon_Center_1_RBY.png' }
];

async function fetchDirectUrl(wikiPage, fileName) {
  return new Promise((resolve) => {
    const url = `https://archives.bulbagarden.net/wiki/${wikiPage}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const re = new RegExp('https://archives\\.bulbagarden\\.net/media/upload/[^"\'>]+/' + fileName, 'i');
        const m = body.match(re);
        resolve(m ? m[0] : null);
      });
    }).on('error', () => resolve(null));
  });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        resolve(false);
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      resolve(false);
    });
  });
}

async function run() {
  for (const item of mapFiles) {
    const destPath = path.join(mapsDir, `map_${item.id}.png`);
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      if (stats.size > 2000) {
        console.log(`Map ${item.id} already exists (${stats.size} bytes)`);
        continue;
      } else {
        fs.unlinkSync(destPath);
      }
    }
    console.log(`Fetching direct URL for ${item.wiki} (${item.name})...`);
    const directUrl = await fetchDirectUrl(item.wiki, item.name);
    if (directUrl) {
      console.log(`Downloading ${directUrl} -> map_${item.id}.png`);
      await downloadFile(directUrl, destPath);
    } else {
      console.log(`Could not find direct URL for ${item.wiki}`);
    }
  }
  console.log('Finished downloading maps!');
}

run();
