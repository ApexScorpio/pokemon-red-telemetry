const fs = require('fs');

async function main() {
  console.log('Fetching official data from pret/pokered...');
  const [namesRaw, dexRaw, itemsRaw, pkmConstantsRaw] = await Promise.all([
    fetch('https://raw.githubusercontent.com/pret/pokered/master/data/pokemon/names.asm').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/pret/pokered/master/data/pokemon/dex_order.asm').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/pret/pokered/master/data/items/names.asm').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/pret/pokered/master/constants/pokemon_constants.asm').then(r => r.text())
  ]);

  // Monster Names (1-indexed)
  const monsterNames = {};
  let mIndex = 1;
  for (const line of namesRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('dname ')) {
      const name = trimmed.replace('dname ', '').replace(/"/g, '').trim();
      monsterNames[mIndex] = name;
      mIndex++;
    }
  }

  // Dex Order (1-indexed)
  const dexOrder = {};
  let dIndex = 1;
  for (const line of dexRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('db DEX_')) {
      const dexConst = trimmed.replace('db DEX_', '').trim();
      dexOrder[dIndex] = dexConst;
      dIndex++;
    }
  }

  // Item Names (1-indexed, starts at 1 = MASTER_BALL)
  const itemNames = {};
  let iIndex = 1;
  for (const line of itemsRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('li ')) {
      let rawName = trimmed.replace('li ', '').trim();
      const semi = rawName.indexOf(';');
      if (semi !== -1) rawName = rawName.slice(0, semi).trim();
      rawName = rawName.replace(/"/g, '').trim();
      if (rawName && rawName !== '?????') {
        // Formata de POKé BALL para Poké Ball, MOON STONE para Moon Stone
        const formatted = rawName
          .toLowerCase()
          .replace(/poké/g, 'Poké')
          .replace(/\b\w/g, c => c.toUpperCase());
        itemNames[iIndex] = formatted;
      }
      iIndex++;
    }
  }

  // Pokedex 151 clean data for types & base stats
  const dex151 = JSON.parse(fs.readFileSync('C:/Users/lopes/.gemini/antigravity-ide/scratch/pokemon-ai-companion/data/clean_pokedex_151.json'));

  // Map each internal ID to full Pokémon Info
  const internalToPokemon = {};
  for (let id = 1; id < mIndex; id++) {
    const name = monsterNames[id];
    if (!name || name === 'MISSINGNO') {
      internalToPokemon[id] = { name: 'MissingNo.', dex: 0, types: ['Normal'], baseHp: 33 };
      continue;
    }

    // Procura no dex151
    let foundDex = 0;
    let foundInfo = null;

    const normName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (const [dNum, dData] of Object.entries(dex151)) {
      const dNorm = dData.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (dNorm === normName || dNorm.startsWith(normName) || normName.startsWith(dNorm)) {
        foundDex = parseInt(dNum, 10);
        foundInfo = dData;
        break;
      }
    }

    // Normaliza nomes especiais (ex: NIDORAN♂ / NIDORAN♀, MR. MIME)
    let prettyName = name;
    if (name === 'NIDORAN♂') prettyName = 'Nidoran♂';
    else if (name === 'NIDORAN♀') prettyName = 'Nidoran♀';
    else if (name === 'MR.MIME') prettyName = 'Mr. Mime';
    else {
      prettyName = name.charAt(0) + name.slice(1).toLowerCase();
    }

    internalToPokemon[id] = {
      name: foundInfo ? foundInfo.name : prettyName,
      dex: foundDex,
      types: foundInfo ? foundInfo.types : ['Normal'],
      baseHp: foundInfo ? foundInfo.baseHp : 40
    };
  }

  console.log('Sample Pokemon Mappings:');
  console.log('ID 84 (0x54):', internalToPokemon[84]);
  console.log('ID 124 (0x7C):', internalToPokemon[124]);
  console.log('ID 113 (0x71):', internalToPokemon[113]);
  console.log('ID 165 (0xA5):', internalToPokemon[165]);
  console.log('ID 36 (0x24):', internalToPokemon[36]);
  console.log('ID 176 (0xB0):', internalToPokemon[176]);

  console.log('\nSample Item Mappings:');
  console.log('Item 1 (0x01):', itemNames[1]);
  console.log('Item 2 (0x02):', itemNames[2]);
  console.log('Item 3 (0x03):', itemNames[3]);
  console.log('Item 4 (0x04):', itemNames[4]);
  console.log('Item 5 (0x05):', itemNames[5]);
  console.log('Item 20 (0x14):', itemNames[20]);

  fs.writeFileSync('data/exact_pokemon_internal.json', JSON.stringify(internalToPokemon, null, 2));
  fs.writeFileSync('data/exact_items.json', JSON.stringify(itemNames, null, 2));
  console.log('\nSaved exact tables successfully!');
}

main().catch(console.error);
