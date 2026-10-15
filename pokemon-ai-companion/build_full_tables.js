const fs = require('fs');
const https = require('https');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve, reject);
      }
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading official pokered disassembly files...');
  const [moveNamesRaw, movesDataRaw, itemNamesRaw] = await Promise.all([
    fetchText('https://raw.githubusercontent.com/pret/pokered/master/data/moves/names.asm'),
    fetchText('https://raw.githubusercontent.com/pret/pokered/master/data/moves/moves.asm'),
    fetchText('https://raw.githubusercontent.com/pret/pokered/master/data/items/names.asm')
  ]);

  // 1. Move Names
  const moveNames = [];
  for (const line of moveNamesRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('li "')) {
      const name = trimmed.substring(4, trimmed.length - 1);
      moveNames.push(name);
    }
  }

  // 2. Move Attributes from moves.asm
  const moves = {};
  const moveLines = movesDataRaw.split('\n');
  let currentMoveIdx = 1;

  for (const line of moveLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('move ')) {
      const parts = trimmed.substring(5).split(',').map(p => p.trim());
      if (parts.length >= 6) {
        const rawName = moveNames[currentMoveIdx - 1] || `Move #${currentMoveIdx}`;
        const formattedName = rawName.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
        const power = parseInt(parts[2], 10) || 0;
        let type = parts[3].toLowerCase();
        type = type.charAt(0).toUpperCase() + type.slice(1);
        const accuracy = Math.round((parseInt(parts[4], 10) / 255) * 100);
        const pp = parseInt(parts[5], 10) || 0;

        moves[currentMoveIdx] = {
          name: formattedName,
          type: type,
          power: power,
          acc: accuracy > 100 ? 100 : accuracy,
          pp: pp
        };
        currentMoveIdx++;
      }
    }
  }

  // 3. Item Names
  const items = {};
  let itemIdx = 1;
  for (const line of itemNamesRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('li "')) {
      let rawName = trimmed.substring(4, trimmed.length - 1);
      const semi = rawName.indexOf(';');
      if (semi !== -1) rawName = rawName.slice(0, semi).trim();
      if (rawName && rawName !== '?????') {
        const formatted = rawName
          .toLowerCase()
          .replace(/poké/g, 'Poké')
          .replace(/(^|\s)\S/g, l => l.toUpperCase());
        items[itemIdx] = formatted;
      }
      itemIdx++;
    }
  }

  // Add HMs (196 to 200) and TMs (201 to 251)
  const hmNames = [
    'HM01 (Cut)',
    'HM02 (Fly)',
    'HM03 (Surf)',
    'HM04 (Strength)',
    'HM05 (Flash)'
  ];
  for (let i = 0; i < hmNames.length; i++) {
    items[196 + i] = hmNames[i];
  }

  const tmNames = [
    'TM01 (Mega Punch)',
    'TM02 (Razor Wind)',
    'TM03 (Swords Dance)',
    'TM04 (Whirlwind)',
    'TM05 (Mega Kick)',
    'TM06 (Toxic)',
    'TM07 (Horn Drill)',
    'TM08 (Body Slam)',
    'TM09 (Take Down)',
    'TM10 (Double-Edge)',
    'TM11 (BubbleBeam)',
    'TM12 (Water Gun)',
    'TM13 (Ice Beam)',
    'TM14 (Blizzard)',
    'TM15 (Hyper Beam)',
    'TM16 (Pay Day)',
    'TM17 (Submission)',
    'TM18 (Counter)',
    'TM19 (Seismic Toss)',
    'TM20 (Rage)',
    'TM21 (Mega Drain)',
    'TM22 (SolarBeam)',
    'TM23 (Dragon Rage)',
    'TM24 (Thunderbolt)',
    'TM25 (Thunder)',
    'TM26 (Earthquake)',
    'TM27 (Fissure)',
    'TM28 (Dig)',
    'TM29 (Psychic)',
    'TM30 (Teleport)',
    'TM31 (Mimic)',
    'TM32 (Double Team)',
    'TM33 (Reflect)',
    'TM34 (Bide)',
    'TM35 (Metronome)',
    'TM36 (Selfdestruct)',
    'TM37 (Egg Bomb)',
    'TM38 (Fire Blast)',
    'TM39 (Swift)',
    'TM40 (Skull Bash)',
    'TM41 (Softboiled)',
    'TM42 (Dream Eater)',
    'TM43 (Sky Attack)',
    'TM44 (Rest)',
    'TM45 (Thunder Wave)',
    'TM46 (Psywave)',
    'TM47 (Explosion)',
    'TM48 (Rock Slide)',
    'TM49 (Tri Attack)',
    'TM50 (Substitute)'
  ];
  for (let i = 0; i < tmNames.length; i++) {
    items[201 + i] = tmNames[i];
  }

  console.log(`Parsed ${Object.keys(moves).length} moves.`);
  console.log('Move 31:', moves[31]);
  console.log('Move 158:', moves[158]);
  console.log(`Parsed ${Object.keys(items).length} items.`);
  console.log('Item 212 (0xD4):', items[212]);
  console.log('Item 234 (0xEA):', items[234]);

  fs.writeFileSync('data/exact_moves.json', JSON.stringify(moves, null, 2));
  fs.writeFileSync('data/exact_items.json', JSON.stringify(items, null, 2));
  console.log('Successfully saved data/exact_moves.json and data/exact_items.json!');
}

main().catch(console.error);
