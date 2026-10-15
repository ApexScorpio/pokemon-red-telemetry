const fs = require('fs');

const rawMaps = JSON.parse(fs.readFileSync('C:/Users/lopes/.gemini/antigravity-ide/scratch/pokemon-ai-companion/data/raw_maps.json'));
const exactPokemon = JSON.parse(fs.readFileSync('C:/Users/lopes/.gemini/antigravity-ide/scratch/pokemon-ai-companion/data/exact_pokemon_internal.json'));
const exactItems = JSON.parse(fs.readFileSync('C:/Users/lopes/.gemini/antigravity-ide/scratch/pokemon-ai-companion/data/exact_items.json'));

const internalToPokemon = exactPokemon;
const prettyItems = exactItems;

const fileContent = `// Dicionário Oficial 100% Exato de Pokémon Red (pret/pokered)
const INTERNAL_TO_POKEMON = ${JSON.stringify(internalToPokemon, null, 2)};

const MAP_NAMES = ${JSON.stringify(rawMaps, null, 2)};

const ITEM_NAMES = ${JSON.stringify(prettyItems, null, 2)};

const MOVES = {
  1: { name: 'Pound', type: 'Normal', power: 40, acc: 100 },
  2: { name: 'Karate Chop', type: 'Normal', power: 50, acc: 100 },
  3: { name: 'Double Slap', type: 'Normal', power: 15, acc: 85 },
  10: { name: 'Scratch', type: 'Normal', power: 40, acc: 100 },
  14: { name: 'Swords Dance', type: 'Normal', power: 0, acc: 100 },
  15: { name: 'Cut', type: 'Normal', power: 50, acc: 95 },
  16: { name: 'Gust', type: 'Normal', power: 40, acc: 100 },
  17: { name: 'Wing Attack', type: 'Flying', power: 35, acc: 100 },
  20: { name: 'Bind', type: 'Normal', power: 15, acc: 75 },
  21: { name: 'Slam', type: 'Normal', power: 80, acc: 75 },
  22: { name: 'Vine Whip', type: 'Grass', power: 35, acc: 100 },
  28: { name: 'Sand Attack', type: 'Normal', power: 0, acc: 100 },
  30: { name: 'Bite', type: 'Normal', power: 60, acc: 100 },
  33: { name: 'Tackle', type: 'Normal', power: 35, acc: 95 },
  34: { name: 'Body Slam', type: 'Normal', power: 85, acc: 100 },
  36: { name: 'Take Down', type: 'Normal', power: 90, acc: 85 },
  39: { name: 'Tail Whip', type: 'Normal', power: 0, acc: 100 },
  40: { name: 'Poison Sting', type: 'Poison', power: 15, acc: 100 },
  41: { name: 'Twineedle', type: 'Bug', power: 25, acc: 100 },
  42: { name: 'Pin Missile', type: 'Bug', power: 14, acc: 85 },
  43: { name: 'Leer', type: 'Normal', power: 0, acc: 100 },
  45: { name: 'Growl', type: 'Normal', power: 0, acc: 100 },
  52: { name: 'Ember', type: 'Fire', power: 40, acc: 100 },
  53: { name: 'Flamethrower', type: 'Fire', power: 95, acc: 100 },
  55: { name: 'Water Gun', type: 'Water', power: 40, acc: 100 },
  56: { name: 'Hydro Pump', type: 'Water', power: 120, acc: 80 },
  57: { name: 'Surf', type: 'Water', power: 95, acc: 100 },
  58: { name: 'Ice Beam', type: 'Ice', power: 95, acc: 100 },
  59: { name: 'Blizzard', type: 'Ice', power: 120, acc: 90 },
  60: { name: 'Psybeam', type: 'Psychic', power: 65, acc: 100 },
  61: { name: 'Bubble Beam', type: 'Water', power: 65, acc: 100 },
  64: { name: 'Peck', type: 'Flying', power: 35, acc: 100 },
  65: { name: 'Drill Peck', type: 'Flying', power: 80, acc: 100 },
  71: { name: 'Absorb', type: 'Grass', power: 20, acc: 100 },
  72: { name: 'Mega Drain', type: 'Grass', power: 40, acc: 100 },
  73: { name: 'Leech Seed', type: 'Grass', power: 0, acc: 90 },
  75: { name: 'Razor Leaf', type: 'Grass', power: 55, acc: 95 },
  76: { name: 'Solar Beam', type: 'Grass', power: 120, acc: 100 },
  77: { name: 'Poison Powder', type: 'Poison', power: 0, acc: 75 },
  78: { name: 'Stun Spore', type: 'Grass', power: 0, acc: 75 },
  79: { name: 'Sleep Powder', type: 'Grass', power: 0, acc: 75 },
  81: { name: 'String Shot', type: 'Bug', power: 0, acc: 95 },
  84: { name: 'Thunder Shock', type: 'Electric', power: 40, acc: 100 },
  85: { name: 'Thunderbolt', type: 'Electric', power: 95, acc: 100 },
  86: { name: 'Thunder Wave', type: 'Electric', power: 0, acc: 100 },
  87: { name: 'Thunder', type: 'Electric', power: 120, acc: 70 },
  88: { name: 'Rock Throw', type: 'Rock', power: 50, acc: 65 },
  89: { name: 'Earthquake', type: 'Ground', power: 100, acc: 100 },
  90: { name: 'Fissure', type: 'Ground', power: 0, acc: 0 },
  91: { name: 'Dig', type: 'Ground', power: 100, acc: 100 },
  92: { name: 'Toxic', type: 'Poison', power: 0, acc: 85 },
  93: { name: 'Confusion', type: 'Psychic', power: 50, acc: 100 },
  94: { name: 'Psychic', type: 'Psychic', power: 90, acc: 100 },
  95: { name: 'Hypnosis', type: 'Psychic', power: 0, acc: 60 },
  98: { name: 'Quick Attack', type: 'Normal', power: 40, acc: 100 },
  99: { name: 'Rage', type: 'Normal', power: 20, acc: 100 },
  103: { name: 'Screech', type: 'Normal', power: 0, acc: 85 },
  104: { name: 'Double Team', type: 'Normal', power: 0, acc: 100 },
  105: { name: 'Recover', type: 'Normal', power: 0, acc: 100 },
  106: { name: 'Harden', type: 'Normal', power: 0, acc: 100 },
  110: { name: 'Withdraw', type: 'Water', power: 0, acc: 100 },
  111: { name: 'Defense Curl', type: 'Normal', power: 0, acc: 100 },
  115: { name: 'Reflect', type: 'Psychic', power: 0, acc: 100 },
  120: { name: 'Self-Destruct', type: 'Normal', power: 130, acc: 100 },
  126: { name: 'Fire Blast', type: 'Fire', power: 120, acc: 85 },
  143: { name: 'Sky Attack', type: 'Flying', power: 140, acc: 90 },
  149: { name: 'Flash', type: 'Normal', power: 0, acc: 70 },
  153: { name: 'Explosion', type: 'Normal', power: 170, acc: 100 },
  157: { name: 'Rock Slide', type: 'Rock', power: 75, acc: 90 },
  165: { name: 'Struggle', type: 'Normal', power: 50, acc: 100 }
};

const TYPE_CHART_GEN1 = {
  Normal: { Rock: 0.5, Ghost: 0 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2.0, Ice: 2.0, Bug: 2.0, Rock: 0.5, Dragon: 0.5 },
  Water: { Fire: 2.0, Water: 0.5, Grass: 0.5, Ground: 2.0, Rock: 2.0, Dragon: 0.5 },
  Electric: { Water: 2.0, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2.0, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2.0, Grass: 0.5, Poison: 0.5, Ground: 2.0, Flying: 0.5, Bug: 0.5, Rock: 2.0, Dragon: 0.5 },
  Ice: { Water: 0.5, Grass: 2.0, Ice: 0.5, Ground: 2.0, Flying: 2.0, Dragon: 2.0 },
  Fighting: { Normal: 2.0, Ice: 2.0, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2.0, Ghost: 0 },
  Poison: { Grass: 2.0, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Bug: 2.0 },
  Ground: { Fire: 2.0, Electric: 2.0, Grass: 0.5, Poison: 2.0, Flying: 0, Bug: 0.5, Rock: 2.0 },
  Flying: { Electric: 0.5, Grass: 2.0, Fighting: 2.0, Bug: 2.0, Rock: 0.5 },
  Psychic: { Fighting: 2.0, Poison: 2.0, Psychic: 0.5 },
  Bug: { Fire: 0.5, Grass: 2.0, Fighting: 0.5, Poison: 2.0, Flying: 0.5, Psychic: 2.0, Ghost: 0.5 },
  Rock: { Fire: 2.0, Ice: 2.0, Fighting: 0.5, Ground: 0.5, Flying: 2.0, Bug: 2.0 },
  Ghost: { Normal: 0, Psychic: 0, Ghost: 2.0 },
  Dragon: { Dragon: 2.0 }
};

const GEN1_CHAR_MAP = {
  0x7F: ' ',
  0x80: 'A', 0x81: 'B', 0x82: 'C', 0x83: 'D', 0x84: 'E', 0x85: 'F', 0x86: 'G', 0x87: 'H', 0x88: 'I',
  0x89: 'J', 0x8A: 'K', 0x8B: 'L', 0x8C: 'M', 0x8D: 'N', 0x8E: 'O', 0x8F: 'P', 0x90: 'Q', 0x91: 'R',
  0x92: 'S', 0x93: 'T', 0x94: 'U', 0x95: 'V', 0x96: 'W', 0x97: 'X', 0x98: 'Y', 0x99: 'Z',
  0xA0: 'a', 0xA1: 'b', 0xA2: 'c', 0xA3: 'd', 0xA4: 'e', 0xA5: 'f', 0xA6: 'g', 0xA7: 'h', 0xA8: 'i',
  0xA9: 'j', 0xAA: 'k', 0xAB: 'l', 0xAC: 'm', 0xAD: 'n', 0xAE: 'o', 0xAF: 'p', 0xB0: 'q', 0xB1: 'r',
  0xB2: 's', 0xB3: 't', 0xB4: 'u', 0xB5: 'v', 0xB6: 'w', 0xB7: 'x', 0xB8: 'y', 0xB9: 'z',
  0xF6: '0', 0xF7: '1', 0xF8: '2', 0xF9: '3', 0xFA: '4', 0xFB: '5', 0xFC: '6', 0xFD: '7', 0xFE: '8', 0xFF: '9'
};

function decodeGen1Text(hexArr) {
  let str = '';
  for (const h of hexArr) {
    const b = typeof h === 'string' ? parseInt(h, 16) : h;
    if (b === 0x50) break;
    str += GEN1_CHAR_MAP[b] || '';
  }
  return str.trim();
}

function decodeBcdMoney(b1, b2, b3) {
  const h1 = b1.toString(16).padStart(2, '0');
  const h2 = b2.toString(16).padStart(2, '0');
  const h3 = b3.toString(16).padStart(2, '0');
  return parseInt(h1 + h2 + h3, 10);
}

const BADGES_LIST = [
  { name: 'Boulder Badge', leader: 'Brock', city: 'Pewter City', icon: '🪨' },
  { name: 'Cascade Badge', leader: 'Misty', city: 'Cerulean City', icon: '💧' },
  { name: 'Thunder Badge', leader: 'Lt. Surge', city: 'Vermilion City', icon: '⚡' },
  { name: 'Rainbow Badge', leader: 'Erika', city: 'Celadon City', icon: '🌈' },
  { name: 'Soul Badge', leader: 'Koga', city: 'Fuchsia City', icon: '💜' },
  { name: 'Marsh Badge', leader: 'Sabrina', city: 'Saffron City', icon: '👁️' },
  { name: 'Volcano Badge', leader: 'Blaine', city: 'Cinnabar Island', icon: '🌋' },
  { name: 'Earth Badge', leader: 'Giovanni', city: 'Viridian City', icon: '🌍' }
];

function decodeBadges(byte) {
  const b = typeof byte === 'string' ? parseInt(byte, 16) : byte;
  return BADGES_LIST.map((badge, idx) => ({
    ...badge,
    obtained: (b & (1 << idx)) !== 0
  }));
}

function getEffectiveness(attackType, defenderTypes) {
  if (!attackType || !defenderTypes || defenderTypes.length === 0) return 1.0;
  let mult = 1.0;
  for (const defType of defenderTypes) {
    if (TYPE_CHART_GEN1[attackType] && TYPE_CHART_GEN1[attackType][defType] !== undefined) {
      mult *= TYPE_CHART_GEN1[attackType][defType];
    }
  }
  return mult;
}

function analyzeBattle(playerMon, enemyMon, isWild) {
  if (!playerMon || !enemyMon) return null;
  const playerTypes = playerMon.types || ['Normal'];
  const enemyTypes = enemyMon.types || ['Normal'];

  const moveAnalyses = (playerMon.moves || []).map(move => {
    if (!move || !move.id) return null;
    const moveData = MOVES[move.id] || { name: 'Golpe #' + move.id, type: 'Normal', power: 40, acc: 100 };
    const effectiveness = getEffectiveness(moveData.type, enemyTypes);
    const hasStab = playerTypes.includes(moveData.type);
    const stabMultiplier = hasStab ? 1.5 : 1.0;
    const score = (moveData.power || 10) * effectiveness * stabMultiplier * (moveData.acc / 100);

    return {
      id: move.id,
      name: moveData.name,
      type: moveData.type,
      power: moveData.power,
      accuracy: moveData.acc,
      pp: move.pp,
      effectiveness,
      hasStab,
      score,
      label: effectiveness > 1.5 ? 'SUPER EFETIVO! 💥' :
             effectiveness === 0 ? 'SEM EFEITO! ❌' :
             effectiveness < 1.0 ? 'POUCO EFETIVO 🛡️' : 'DANO NORMAL ⚔️'
    };
  }).filter(Boolean);

  moveAnalyses.sort((a, b) => b.score - a.score);
  const bestMove = moveAnalyses[0];

  const alerts = [];
  const playerHpPercent = Math.round((playerMon.hp / playerMon.maxHp) * 100);

  if (playerHpPercent <= 25) {
    alerts.push({ level: 'critical', text: 'HP Crítico (' + playerHpPercent + '%)! Risco iminente de desmaio.' });
  }

  if (bestMove && bestMove.effectiveness >= 2.0) {
    alerts.push({ level: 'advantage', text: 'Vantagem massiva com ' + bestMove.name + '! Dano x' + bestMove.effectiveness + '.' });
  }

  let catchChance = null;
  if (isWild && enemyMon.hp > 0) {
    const catchRate = enemyMon.catchRate || 150;
    const maxHp = enemyMon.maxHp || 30;
    const currHp = enemyMon.hp;
    const factor = Math.max(1, Math.min(255, Math.floor(((maxHp * 255) / 12) / Math.max(1, (currHp / 4)))));
    const chancePokeball = Math.min(99, Math.round((factor / 255) * (catchRate / 255) * 100));
    catchChance = {
      pokeball: Math.max(5, chancePokeball),
      greatball: Math.min(99, Math.round(chancePokeball * 1.5)),
      ultraball: Math.min(99, Math.round(chancePokeball * 2.0))
    };
  }

  return {
    bestMove,
    moves: moveAnalyses,
    alerts,
    catchChance,
    matchupRating: bestMove ? (bestMove.effectiveness >= 2 ? 'FAVORÁVEL (+80%)' : bestMove.effectiveness < 1 ? 'DESFAVORÁVEL (-50%)' : 'EQUILIBRADO') : 'NEUTRO'
  };
}

module.exports = {
  INTERNAL_TO_POKEMON,
  MAP_NAMES,
  ITEM_NAMES,
  MOVES,
  decodeGen1Text,
  decodeBcdMoney,
  decodeBadges,
  getEffectiveness,
  analyzeBattle
};
`;

fs.writeFileSync('C:/Users/lopes/.gemini/antigravity-ide/scratch/pokemon-ai-companion/data/pokemonData.js', fileContent);
console.log('pokemonData.js escrito com perfeição!');
