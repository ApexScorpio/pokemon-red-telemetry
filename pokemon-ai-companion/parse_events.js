const fs = require('fs');

const raw = fs.readFileSync('data/event_constants.asm', 'utf8');
const lines = raw.split('\n');

const events = {};
let currentId = 0;

for (let line of lines) {
  line = line.split(';')[0].trim();
  if (!line) continue;
  
  if (line.startsWith('const_def')) {
    const parts = line.split(/\s+/);
    currentId = parts[1] ? parseInt(parts[1].replace('$', '0x'), 16) : 0;
  } else if (line.startsWith('const_next')) {
    const expr = line.replace('const_next', '').trim();
    try {
      const cleaned = expr.replace(/\$([0-9a-fA-F]+)/g, '0x$1');
      currentId = Function(`"use strict"; return (${cleaned});`)();
    } catch(e) {
      console.error('Failed to eval const_next:', line, e);
    }
  } else if (line.startsWith('const_skip')) {
    const expr = line.replace('const_skip', '').trim();
    const count = expr ? (parseInt(expr.replace('$', '0x'), 16) || 1) : 1;
    currentId += count;
  } else if (line.startsWith('const ')) {
    const parts = line.split(/\s+/);
    const name = parts[1];
    events[name] = currentId;
    currentId++;
  }
}

fs.writeFileSync('data/exact_events.json', JSON.stringify(events, null, 2));
console.log('Parsed exact events count:', Object.keys(events).length);
['EVENT_BEAT_BROCK', 'EVENT_BEAT_PEWTER_GYM_TRAINER_0', 'EVENT_BEAT_ROUTE_3_TRAINER_0', 'EVENT_BEAT_ROUTE_3_TRAINER_1', 'EVENT_BEAT_ROUTE_22_RIVAL_1ST_BATTLE', 'EVENT_GOT_TOWN_MAP'].forEach(e => {
  console.log(e, '=> 0x' + (events[e] || 0).toString(16), 'dec:', events[e], 'byte:', Math.floor((events[e]||0)/8), 'bit:', (events[e]||0)%8);
});
