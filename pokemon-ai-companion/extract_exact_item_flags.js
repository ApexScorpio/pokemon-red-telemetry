const fs = require('fs');

async function main() {
  console.log('Fetching toggle_constants.asm and hidden_item_coords.asm...');
  const [toggleRaw, hiddenRaw, mapsRaw] = await Promise.all([
    fetch('https://raw.githubusercontent.com/pret/pokered/master/constants/toggle_constants.asm').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/pret/pokered/master/data/events/hidden_item_coords.asm').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/pret/pokered/master/constants/map_constants.asm').then(r => r.text())
  ]);

  // Parse Map Name to ID
  const mapNameToId = {};
  let currentMapId = 0;
  for (const line of mapsRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('map_const ')) {
      const parts = trimmed.split(/\s+/);
      const name = parts[1].replace(/,$/, '');
      mapNameToId[name] = currentMapId;
      currentMapId++;
    }
  }

  // Parse Visible Items from toggle_constants.asm
  // Format:
  // toggle_consts_for MAP_NAME
  // const TOGGLE_NAME ; HEX
  const visibleItems = [];
  let currentToggleMap = '';
  let toggleIndex = 0;

  for (const line of toggleRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('toggle_consts_for ')) {
      currentToggleMap = trimmed.replace('toggle_consts_for ', '').trim();
    } else if (trimmed.startsWith('const ')) {
      const parts = trimmed.split(/\s+/);
      const constName = parts[1];
      const semiIdx = trimmed.indexOf(';');
      let hexStr = '';
      if (semiIdx !== -1) {
        hexStr = trimmed.slice(semiIdx + 1).trim();
      }
      
      const byteIdx = Math.floor(toggleIndex / 8);
      const bitIdx = toggleIndex % 8;

      visibleItems.push({
        mapName: currentToggleMap,
        mapId: mapNameToId[currentToggleMap],
        constant: constName,
        toggleIndex,
        byteIdx,
        bitIdx
      });
      toggleIndex++;
    }
  }

  // Parse Hidden Items from hidden_item_coords.asm
  // Format: hidden_item MAP_NAME, x, y
  const hiddenItems = [];
  let hIndex = 0;
  for (const line of hiddenRaw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('hidden_item ')) {
      const parts = trimmed.replace('hidden_item ', '').split(',').map(s => s.trim());
      const mapName = parts[0];
      const x = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      const byteIdx = Math.floor(hIndex / 8);
      const bitIdx = hIndex % 8;

      hiddenItems.push({
        mapName,
        mapId: mapNameToId[mapName],
        x,
        y,
        hiddenIndex: hIndex,
        byteIdx,
        bitIdx
      });
      hIndex++;
    }
  }

  console.log(`Parsed ${visibleItems.length} toggleable objects and ${hiddenItems.length} hidden items.`);
  console.log('Sample Visible Items (Viridian Forest & Mt Moon):');
  const vfItems = visibleItems.filter(v => v.mapName.includes('VIRIDIAN_FOREST') || v.mapName.includes('MT_MOON'));
  console.log(vfItems);

  console.log('\nSample Hidden Items (Viridian Forest, Viridian City, Route 25):');
  const sampleHidden = hiddenItems.filter(h => h.mapName.includes('VIRIDIAN') || h.mapName.includes('ROUTE_25'));
  console.log(sampleHidden);

  fs.writeFileSync('data/exact_visible_flags.json', JSON.stringify(visibleItems, null, 2));
  fs.writeFileSync('data/exact_hidden_flags.json', JSON.stringify(hiddenItems, null, 2));
  console.log('Saved flags mapping to JSON!');
}

main().catch(console.error);
