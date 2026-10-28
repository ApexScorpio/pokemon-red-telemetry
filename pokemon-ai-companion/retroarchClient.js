const fs = require('fs');
const { buildProfiles, getCurrentRom, pokemonFromProfile, moveNameFromProfile } = require('./romLiveResolver');
const { expAtLevel } = require('./gen1EngineMath');
const {nextPartyAlerts,daycareAdvice}=require('./romProgressAdvisor');
const {buildRomAreaEvidence}=require('./romAreaEvidence');
const {staticMapGuide}=require('./romAreaGuide');
const {annotateLastMap}=require('./romLastMapEvidence');
const {inspectTerrainCell}=require('./romTerrainAtlas');
const {terrainWarpHints}=require('./romTerrainRouteHints');
const {inspectMovementOptions}=require('./romTerrainMovement');
const {planItemAccess}=require('./romItemReachability');
const {adviseWorld}=require('./romWorldStateAdvisor');
const {buildCampaignLedger}=require('./romCampaignLedger');
const {buildWarpGraph}=require('./romWarpGraph');
const {decodeToggleables,decodeHiddenItems,decodeHiddenCoins}=require('./romEventState');
const {makeAreaProgress}=require('./romAreaProgress');
const {trainerFlagsForCurrentMap}=require('./romTrainerEvents');
const {auditTrainerCoverage,currentMapTrainerCoverage}=require('./romTrainerCoverage');
const {verifyMapSnapshot}=require('./romSnapshotIntegrity');
const {verifyMapPositionWindow}=require('./romMapPositionConsistency');
const {verifyMovementModeWindow}=require('./romMovementModeConsistency');
const {getTrainerParty}=require('./romTrainerParties');
const {stationaryPokemonEvents}=require('./romStaticEncounterEvents');
const {captureOpportunities}=require('./romCaptureOpportunities');
const {parseRomBattleEvidence}=require('./romBattleEvidence');
const {verifyBattleWindow}=require('./romBattleSnapshotConsistency');
const {buildLiveBattlePreview}=require('./gen1LiveBattlePreview');
const dgram = require('dgram');
const { EventEmitter } = require('events');
const {
  INTERNAL_TO_POKEMON,
  MAP_NAMES,
  ITEM_NAMES,
  MOVES,
  decodeGen1Text,
  decodeBcdMoney,
  decodeBadges,
  calculateExpProgress,
  getGen1LevelFromExp,
  getGen1ExpForLevel,
  analyzeBattle
} = require('./data/pokemonData');
const { getAreaInfo, getUpcomingBossTactics } = require('./data/areaData');
const { getLiveAdvice } = require('./aiAdvisor');
const CANONICAL_LEARNSETS = require('./data/gen1CanonicalLearnsets.json').byDex;
const CANONICAL_WILD = require('./data/gen1CanonicalWildEncounters.json').maps;
const CANONICAL_MAPS = require('./data/gen1CanonicalMaps.json').maps;
const CANONICAL_IDS = require('./data/gen1CanonicalIds.json').internalPokemonIds;
const CANONICAL_TRADES = require('./data/gen1NpcTrades.json').trades;
const CANONICAL_EVENTS = require('./data/exact_events.json');

function getCompass(playerCoords, targetX, targetY) {
  if (!playerCoords || targetX === undefined || targetY === undefined || targetX === null || targetY === null) {
    return null;
  }
  const dx = targetX - playerCoords.x;
  const dy = targetY - playerCoords.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  let arrow = '🎯';
  let direction = 'Aqui';
  if (dist === 0) {
    arrow = '🎯';
    direction = 'No azulejo exato';
  } else if (dx > 0 && dy > 0) {
    arrow = '↘️';
    direction = 'Sudeste';
  } else if (dx > 0 && dy < 0) {
    arrow = '↗️';
    direction = 'Nordeste';
  } else if (dx < 0 && dy > 0) {
    arrow = '↙️';
    direction = 'Sudoeste';
  } else if (dx < 0 && dy < 0) {
    arrow = '↖️';
    direction = 'Noroeste';
  } else if (dx > 0) {
    arrow = '➡️';
    direction = 'Este';
  } else if (dx < 0) {
    arrow = '⬅️';
    direction = 'Oeste';
  } else if (dy > 0) {
    arrow = '⬇️';
    direction = 'Sul';
  } else if (dy < 0) {
    arrow = '⬆️';
    direction = 'Norte';
  }

  return {
    arrow,
    direction,
    dx,
    dy,
    dist,
    badge: `${arrow} ${dist} passos (${direction})`
  };
}

function checkIsItemInInventory(itemName, inventory) {
  if (!itemName || !inventory || !Array.isArray(inventory) || inventory.length === 0) return false;
  const rawTarget = String(itemName).trim().toUpperCase();
  const cleanTarget = rawTarget.replace(/\(.*?\)/g, '').replace(/[^A-Z0-9]/g, '');
  if (!cleanTarget) return false;

  // 1. TMs únicos da primeira geração (TM01..TM50)
  const tmMatch = rawTarget.match(/TM(\d+)/i);
  if (tmMatch) {
    const tmNum = parseInt(tmMatch[1], 10);
    return inventory.some(inv => {
      const invRaw = (inv.name || '').toUpperCase();
      const invTm = invRaw.match(/TM(\d+)/i);
      return invTm && parseInt(invTm[1], 10) === tmNum;
    });
  }

  // 2. HMs únicos (HM01..HM05)
  const hmMatch = rawTarget.match(/HM(\d+)/i);
  if (hmMatch) {
    const hmNum = parseInt(hmMatch[1], 10);
    return inventory.some(inv => {
      const invRaw = (inv.name || '').toUpperCase();
      const invHm = invRaw.match(/HM(\d+)/i);
      return invHm && parseInt(invHm[1], 10) === hmNum;
    });
  }

  // 3. Fósseis e Key Items únicos
  const UNIQUE_KEY_ITEMS = [
    'TOWNMAP', 'BICYCLE', 'BIKEVOUCHER', 'SSTICKET', 'SILPHSCOPE', 'POKEFLUTE',
    'CARDKEY', 'LIFTKEY', 'SECRETKEY', 'GOLDTEETH', 'OLDAMBER', 'HELIXFOSSIL',
    'DOMEFOSSIL', 'COINCASE', 'ITEMFINDER'
  ];

  return UNIQUE_KEY_ITEMS.some(keyItem => {
    if (cleanTarget.includes(keyItem)) {
      return inventory.some(inv => {
        const invClean = (inv.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return invClean.includes(keyItem);
      });
    }
    return false;
  });
}

const STAGE_MULTIPLIERS = {
  1: { stage: -6, mult: 0.25 },
  2: { stage: -5, mult: 0.28 },
  3: { stage: -4, mult: 0.33 },
  4: { stage: -3, mult: 0.40 },
  5: { stage: -2, mult: 0.50 },
  6: { stage: -1, mult: 0.66 },
  7: { stage: 0, mult: 1.0 },
  8: { stage: 1, mult: 1.5 },
  9: { stage: 2, mult: 2.0 },
  10: { stage: 3, mult: 2.5 },
  11: { stage: 4, mult: 3.0 },
  12: { stage: 5, mult: 3.5 },
  13: { stage: 6, mult: 4.0 }
};

const GEN1_SPRITE_PICTURES = {
  1: { name: 'Red', type: 'player', icon: '🧢', spriteFile: 'red' },
  2: { name: 'Blue', type: 'rival', icon: '👦', spriteFile: 'blue' },
  3: { name: 'Prof. Oak', type: 'npc', icon: '👴', spriteFile: 'oak' },
  4: { name: 'Youngster / Bug Catcher', type: 'trainer', icon: '🧢', spriteFile: 'youngster' },
  5: { name: 'Monster / Pokémon', type: 'pokemon', icon: '🐾', spriteFile: 'monster' },
  6: { name: 'Cooltrainer (F)', type: 'trainer', icon: '👟', spriteFile: 'cooltrainer_f' },
  7: { name: 'Cooltrainer (M)', type: 'trainer', icon: '👟', spriteFile: 'cooltrainer_m' },
  8: { name: 'Little Girl / Menina', type: 'npc', icon: '👧', spriteFile: 'little_girl' },
  9: { name: 'Pidgey / Pássaro', type: 'pokemon', icon: '🐦', spriteFile: 'bird' },
  10: { name: 'Middle-Aged Man', type: 'npc', icon: '👨', spriteFile: 'middle_aged_man' },
  11: { name: 'Gambler', type: 'trainer', icon: '🎲', spriteFile: 'gambler' },
  12: { name: 'Super Nerd', type: 'trainer', icon: '🤓', spriteFile: 'super_nerd' },
  13: { name: 'Lass / Menina', type: 'trainer', icon: '👧', spriteFile: 'girl' },
  14: { name: 'Hiker / Montanhista', type: 'trainer', icon: '🧗', spriteFile: 'hiker' },
  15: { name: 'Beauty', type: 'trainer', icon: '💄', spriteFile: 'beauty' },
  16: { name: 'Gentleman', type: 'trainer', icon: '🎩', spriteFile: 'gentleman' },
  17: { name: 'Daisy', type: 'npc', icon: '👧', spriteFile: 'daisy' },
  18: { name: 'Biker', type: 'trainer', icon: '🏍️', spriteFile: 'biker' },
  19: { name: 'Sailor / Marinheiro', type: 'trainer', icon: '⚓', spriteFile: 'sailor' },
  20: { name: 'Cook / Cozinheiro', type: 'npc', icon: '🍳', spriteFile: 'cook' },
  21: { name: 'Bike Shop Clerk', type: 'npc', icon: '🚲', spriteFile: 'bike_shop_clerk' },
  22: { name: 'Mr. Fuji', type: 'npc', icon: '🧙', spriteFile: 'mr_fuji' },
  23: { name: 'Giovanni', type: 'boss', icon: '👔', spriteFile: 'giovanni' },
  24: { name: 'Rocket (Grunt)', type: 'trainer', icon: '🚀', spriteFile: 'rocket' },
  25: { name: 'Channeler', type: 'trainer', icon: '👻', spriteFile: 'channeler' },
  26: { name: 'Waiter', type: 'npc', icon: '☕', spriteFile: 'waiter' },
  27: { name: 'Silph Worker (F)', type: 'npc', icon: '👩‍💼', spriteFile: 'silph_worker_f' },
  28: { name: 'Middle-Aged Woman', type: 'npc', icon: '👩', spriteFile: 'middle_aged_woman' },
  29: { name: 'Brunette Girl', type: 'npc', icon: '👧', spriteFile: 'brunette_girl' },
  30: { name: 'Lance', type: 'boss', icon: '🐉', spriteFile: 'lance' },
  31: { name: 'Scientist', type: 'trainer', icon: '🔬', spriteFile: 'scientist' },
  32: { name: 'Scientist', type: 'trainer', icon: '🔬', spriteFile: 'scientist' },
  33: { name: 'Rocker', type: 'trainer', icon: '🎸', spriteFile: 'rocker' },
  34: { name: 'Swimmer', type: 'trainer', icon: '🏊', spriteFile: 'swimmer' },
  35: { name: 'Safari Zone Worker', type: 'npc', icon: '👷', spriteFile: 'safari_zone_worker' },
  36: { name: 'Gym Guide / Árbitro', type: 'npc', icon: '📢', spriteFile: 'gym_guide' },
  37: { name: 'Gramps / Velhinho', type: 'npc', icon: '👴', spriteFile: 'gramps' },
  38: { name: 'Balconista / Clerk', type: 'npc', icon: '🛒', spriteFile: 'clerk' },
  39: { name: 'Fishing Guru', type: 'npc', icon: '🎣', spriteFile: 'fishing_guru' },
  40: { name: 'Old Woman / Velhinha', type: 'npc', icon: '👵', spriteFile: 'granny' },
  41: { name: 'Nurse Joy', type: 'npc', icon: '👩‍⚕️', spriteFile: 'nurse' },
  42: { name: 'Cable Club Woman', type: 'npc', icon: '👩', spriteFile: 'link_receptionist' },
  43: { name: 'Silph President', type: 'npc', icon: '💼', spriteFile: 'silph_president' },
  44: { name: 'Silph Worker (M)', type: 'npc', icon: '👨‍💼', spriteFile: 'silph_worker_m' },
  45: { name: 'Warden', type: 'npc', icon: '👴', spriteFile: 'warden' },
  46: { name: 'Captain / Capitão', type: 'npc', icon: '🚢', spriteFile: 'captain' },
  47: { name: 'Fisher / Pescador', type: 'trainer', icon: '🎣', spriteFile: 'fisher' },
  48: { name: 'Koga', type: 'boss', icon: '🥷', spriteFile: 'koga' },
  49: { name: 'Guard / Guarda', type: 'npc', icon: '👮', spriteFile: 'guard' },
  50: { name: 'Guard', type: 'npc', icon: '👮', spriteFile: 'guard' },
  51: { name: 'Mom / Mãe', type: 'npc', icon: '👩', spriteFile: 'mom' },
  52: { name: 'Balding Guy', type: 'npc', icon: '🧔', spriteFile: 'balding_guy' },
  53: { name: 'Little Boy / Menino', type: 'npc', icon: '👦', spriteFile: 'little_boy' },
  54: { name: 'GameBoy Kid', type: 'npc', icon: '🎮', spriteFile: 'gameboy_kid' },
  55: { name: 'GameBoy Kid', type: 'npc', icon: '🎮', spriteFile: 'gameboy_kid' },
  56: { name: 'Clefairy', type: 'pokemon', icon: '⭐', spriteFile: 'fairy' },
  57: { name: 'Agatha', type: 'boss', icon: '👵', spriteFile: 'agatha' },
  58: { name: 'Bruno', type: 'boss', icon: '🥋', spriteFile: 'bruno' },
  59: { name: 'Lorelei', type: 'boss', icon: '❄️', spriteFile: 'lorelei' },
  60: { name: 'Seel', type: 'pokemon', icon: '🦭', spriteFile: 'seel' },
  61: { name: 'Item no Chão (Poké Ball)', type: 'item', icon: '🎒', spriteFile: 'poke_ball' },
  62: { name: 'Fóssil (Omanyte)', type: 'item', icon: '🐚', spriteFile: 'fossil' },
  63: { name: 'Rocha (Strength)', type: 'boulder', icon: '🪨', spriteFile: 'boulder' },
  64: { name: 'Folha de Papel', type: 'object', icon: '📄', spriteFile: 'paper' },
  65: { name: 'Livro / Mapa', type: 'object', icon: '📖', spriteFile: 'paper' },
  66: { name: 'Prancheta', type: 'object', icon: '📋', spriteFile: 'clipboard' },
  67: { name: 'Snorlax Adormecido', type: 'pokemon', icon: '💤', spriteFile: 'snorlax' },
  68: { name: 'Mochila / Bag', type: 'item', icon: '🎒', spriteFile: 'poke_ball' },
  69: { name: 'Old Amber', type: 'item', icon: '💎', spriteFile: 'old_amber' },
  70: { name: 'Pokédex', type: 'object', icon: '📱', spriteFile: 'pokedex' }
};

function getPokemonSpriteUrl(name, dex, romSprite = null, side = 'front') {
  if (romSprite?.pixelsDecoded) {
    const encoded = side === 'back' ? romSprite.backPngBase64 : romSprite.frontPngBase64;
    if (encoded && /^[A-Za-z0-9+/=]+$/.test(encoded)) return 'data:image/png;base64,' + encoded;
  }
  if (!name) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex || 1}.png`;
  if (name.includes('♀')) return 'https://play.pokemonshowdown.com/sprites/gen5/nidoranf.png';
  if (name.includes('♂')) return 'https://play.pokemonshowdown.com/sprites/gen5/nidoranm.png';
  if (name.toLowerCase().includes('mime')) return 'https://play.pokemonshowdown.com/sprites/gen5/mrmime.png';
  if (name.toLowerCase().includes('farfetch')) return 'https://play.pokemonshowdown.com/sprites/gen5/farfetchd.png';
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `https://play.pokemonshowdown.com/sprites/gen5/${clean}.png`;
}

class RetroArchClient extends EventEmitter {
  constructor(ip = '192.168.1.145', port = 55355) {
    super();
    this.ip = ip;
    this.port = port;
    this.socket = null;
    this.isPolling = false;
    this.pollInterval = 700; // ms
    this.timer = null;
    this.isSimulatingBattle = false;
    // ROM local é lida apenas em memória. Nunca alteramos os ficheiros do jogador.
    this.romRegistry = buildProfiles();
    console.log('[ROM Auto] '+this.romRegistry.profiles.length+' perfil(is): '+
      this.romRegistry.profiles.map(p=>p.title+' '+p.hash.crc32).join(', '));
    if(this.romRegistry.errors.length)console.warn('[ROM Auto] Fontes recusadas:',this.romRegistry.errors.slice(0,8));
    this.activeRomProfile = null;
    this.trainerCoverageCache = new Map();
    this.lastRomStatusReadAt = 0;
    this.lastRomRegistryRefreshAt = Date.now();

    const cachedState = this.loadPersistedState();
    this.latestState = cachedState || {
      connected: false,
      lastUpdate: null,
      romValidation: 'ROM não verificada (a aguardar leitura do cabeçalho)',
      trainerName: 'RED',
      rivalName: 'BLUE',
      playerDirection: 'Sul (Baixo ⬇️)',
      playerMode: '🗺️ Exploração Livre a Pé',
      money: 0,
      coins: 0,
      playTime: '0h 0m 0s',
      badges: [],
      inventory: [],
      inBattle: false,
      battleType: 'None',
      mapId: 0,
      mapName: 'Desconhecido',
      areaInfo: null,
      partyCount: 0,
      party: [],
      pcBox: { boxNum: 1, count: 0, freeSlots: 20, pokemon: [] },
      totalPokemonOwned: 0,
      pokedexOwned: [],
      pokedexOwnedCount: 0,
      pokedexSeen: [],
      pokedexSeenCount: 0,
      recentHistory: [],
      actionHistory: this.loadPersistedActionHistory(),
      dialogHistory: this.loadPersistedDialogHistory(),
      battle: null,
      aiAdvice: 'A sincronizar com a memória do Game Boy...'
    };

    // Um estado persistido nunca demonstra uma ROM validada agora.
    this.latestState.isSimulation = false;
    this.latestState.romAutoDiscovery=this.romRegistry.discovery || {
      mode:'AUTOMÁTICO_NO_ARRANQUE',profilesLoaded:this.romRegistry.profiles.length
    };
    this.latestState.romRuntimeIdentity = {
      matched: false, source: 'RetroArch GET_STATUS + ROM local',
      localProfiles: this.romRegistry.profiles.length,
      profileLoadErrors: this.romRegistry.errors
    };
    this.latestState.romValidation = 'ROM não verificada nesta sessão';
    this.latestState.romHeader = { fullRomVerified: false };
    this.latestState.memoryReadStatus = { verified: false, completeness: 'selected-address-ranges-only' };
    if (cachedState) {
      this.latestState.actionHistory = this.loadPersistedActionHistory();
      this.latestState.dialogHistory = this.loadPersistedDialogHistory();
    }

    this.lastBattleKey = null;
    this.lastVideoReadAt = 0;
    this.videoReadInProgress = false;
    this.pendingResolves = new Map();
  }

  loadPersistedState() {
    try {
      const p = require('path').join(__dirname, 'data', 'last_known_state.json');
      if (fs.existsSync(p)) {
        const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (saved && saved.party && saved.party.length > 0) {
          saved.connected = false;
          return saved;
        }
      }
    } catch (e) {}
    return null;
  }

  persistState(state) {
    if (!state || !state.party || state.party.length === 0) return;
    if (!state.connected || state.isSimulation === true) return;
    if (!state.trainerName || state.trainerName === '9' || state.trainerName === 'Desconhecido') return;
    if (!state.areaInfo || !state.areaInfo.name || state.areaInfo.name === 'Desconhecido') return;
    if (state.mapId === 0 && (state.badges && state.badges.some(b => b.obtained))) return;
    try {
      const p = require('path').join(__dirname, 'data', 'last_known_state.json');
      fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
      const rootP = require('path').join(__dirname, '..', 'data', 'last_known_state.json');
      fs.writeFileSync(rootP, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {}
  }

  loadPersistedActionHistory() {
    try {
      const p = require('path').join(__dirname, 'data', 'battle_history_log.jsonl');
      if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
        return lines.slice(-25).map(l => {
          try { return JSON.parse(l); } catch (e) { return null; }
        }).filter(Boolean).reverse();
      }
    } catch (e) {}
    return [];
  }

  loadPersistedDialogHistory() {
    try {
      const p = require('path').join(__dirname, 'data', 'dialog_history_log.jsonl');
      if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
        return lines.slice(-25).map(l => {
          try { return JSON.parse(l); } catch (e) { return null; }
        }).filter(Boolean).reverse();
      }
    } catch (e) {}
    return [];
  }

  persistDialogEntry(entry) {
    try {
      const p = require('path').join(__dirname, 'data', 'dialog_history_log.jsonl');
      fs.appendFileSync(p, JSON.stringify(entry) + '\n');
    } catch (e) {}
  }

  isValidDialogText(text) {
    if (!text || text.length < 3) return false;
    const trimmed = text.trim();
    const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
    if (letters < 3) return false;
    if (/^(POK[EÉ]DEX|POK[EÉ]MON|ITEM|SAVE|OPTION|RESET|TRAINER|SWITCH|CANCEL|TIME\s*\d)/i.test(trimmed)) return false;
    if (/(.)\1{4,}/.test(trimmed)) return false;
    const digits = (trimmed.match(/\d/g) || []).length;
    if (digits > letters) return false;
    return true;
  }

  addHistoryEvent(eventText) {
    if (!this.latestState.recentHistory) this.latestState.recentHistory = [];
    const time = new Date().toLocaleTimeString('pt-PT');
    if (this.latestState.recentHistory.length > 0 && this.latestState.recentHistory[0].text === eventText) return;
    this.latestState.recentHistory.unshift({ time, text: eventText });
    if (this.latestState.recentHistory.length > 6) {
      this.latestState.recentHistory.pop();
    }
  }

  init() {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      const raw = msg.toString().trim();
      console.log('[RetroArchClient] UDP recebido:', JSON.stringify({
        from: `${rinfo.address}:${rinfo.port}`,
        bytes: msg.length,
        response: raw.slice(0, 180)
      }));
      this.handleResponse(raw);
    });

    this.socket.on('error', (err) => {
      console.error('[RetroArch UDP Error]:', err.message);
      this.latestState.connected = false;
      this.emit('update', this.latestState);
    });

    this.socket.bind(0, () => {
      console.log(`[RetroArchClient] Socket local ativo na porta ${this.socket.address().port}`);
      this.startPolling();
    });
  }

  sendRaw(cmd) {
    return new Promise((resolve) => {
      if (!this.socket) return resolve(null);

      const parts = cmd.trim().split(' ');
      const key = (parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1]}`).toUpperCase();

      const timeout = setTimeout(() => {
        if (this.pendingResolves.has(key)) {
          this.pendingResolves.delete(key);
          resolve(null);
        }
      }, 400);

      this.pendingResolves.set(key, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });

      const buf = Buffer.from(cmd + '\n');
      this.socket.send(buf, 0, buf.length, this.port, this.ip, (err) => {
        if (!this.lastUdpSendLogAt) {
          this.lastUdpSendLogAt = Date.now();
          console.log('[RetroArchClient] Primeiro envio UDP:', JSON.stringify({
            target: `${this.ip}:${this.port}`,
            local: `${this.socket.address().address}:${this.socket.address().port}`,
            command: cmd,
            bytes: buf.length,
            sendError: err ? err.message : null
          }));
        }
        if (err) {
          console.error('[RetroArchClient] Erro ao enviar UDP:', err.message);
          clearTimeout(timeout);
          this.pendingResolves.delete(key);
          resolve(null);
        }
      });
    });
  }

  handleResponse(str) {
    const parts = str.split(' ');
    if (parts.length < 2) return;

    const key = parts[0].toUpperCase() === 'GET_STATUS'
      ? 'GET_STATUS'
      : `${parts[0]} ${parts[1]}`.toUpperCase();
    if (this.pendingResolves.has(key)) {
      const cb = this.pendingResolves.get(key);
      this.pendingResolves.delete(key);
      cb(parts[0].toUpperCase() === 'GET_STATUS' ? parts.slice(1) : parts.slice(2));
    } else if (!this.lastUnmatchedUdpLogAt || Date.now() - this.lastUnmatchedUdpLogAt >= 2000) {
      this.lastUnmatchedUdpLogAt = Date.now();
      console.warn('[RetroArchClient] UDP sem pedido correspondente:', JSON.stringify({
        response: String(str || '').slice(0, 180),
        pending: Array.from(this.pendingResolves.keys()).slice(0, 5)
      }));
    }
  }

  // Leitura Exaustiva de Blocos de Memória Contíguos
  async readMemoryBlock(startAddrHex, length) {
    // Blocos UDP limitados a 160 bytes; nunca aceitar respostas incompletas.
    const CHUNK_SIZE = 160;
    const startAddr = parseInt(startAddrHex, 16);
    if (!Number.isInteger(length) || length < 0 ||
        !Number.isInteger(startAddr) || startAddr < 0 || startAddr + length > 0x10000) return null;
    const chunks = [];
    for (let offset = 0; offset < length; offset += CHUNK_SIZE) {
      const curAddrHex = (startAddr + offset).toString(16).toUpperCase();
      const curLen = Math.min(CHUNK_SIZE, length - offset);
      chunks.push({ addr: curAddrHex, len: curLen });
    }

    const allBytes = [];
    for (const c of chunks) {
      const cmd = `READ_CORE_MEMORY ${c.addr} ${c.len}`;
      const valid = bytes => Array.isArray(bytes) && bytes.length === c.len &&
        bytes.every(byte => /^[0-9A-Fa-f]{2}$/.test(byte));
      let res = await this.sendRaw(cmd);
      if (!valid(res)) {
        // Uma resposta -1, truncada ou com bytes inválidos NÃO é memória real.
        res = await this.sendRaw(cmd);
      }
      if (!valid(res)) return null;
      allBytes.push(...res);
    }
    return allBytes;
  }

  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;

    const poll = async () => {
      try {
        await this.fetchGameState();
      } catch (err) {
        const now = Date.now();
        if (!this.lastPollingErrorAt || now - this.lastPollingErrorAt >= 2000) {
          this.lastPollingErrorAt = now;
          console.error('[RetroArchClient] Erro em fetchGameState:', err && err.stack ? err.stack : err);
        }
      }
      if (this.isPolling) {
        this.timer = setTimeout(poll, this.pollInterval);
      }
    };

    poll();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.timer) clearTimeout(this.timer);
  }

  setTarget(ip, port = 55355) {
    this.ip = ip;
    this.port = port;
    console.log(`[RetroArchClient] Alvo atualizado para ${this.ip}:${this.port}`);
  }

  parseStatStages(stageByte) {
    if (!stageByte) return { raw: 7, stage: 0, mult: 1.0, label: '0' };
    const stage = parseInt(stageByte, 16) || 7;
    const info = STAGE_MULTIPLIERS[stage] || { mult: 1.0, stage: stage - 7 };
    return {
      raw: stage,
      stage: info.stage,
      mult: info.mult,
      label: info.stage > 0 ? `+${info.stage}` : info.stage < 0 ? `${info.stage}` : '0'
    };
  }

  getPokemonInfo(id) {
    // Dados reais da ROM carregada têm prioridade apenas após CRC32 confirmado.
    return pokemonFromProfile(this.activeRomProfile, id) ||
      (INTERNAL_TO_POKEMON[id] ? { ...INTERNAL_TO_POKEMON[id], source: 'REFERÊNCIA_ESTÁTICA_NÃO_VERIFICADA_NESTA_ROM' } : null);
  }

  getMoveInfo(id) {
    const romName=moveNameFromProfile(this.activeRomProfile,id);
    const reference=MOVES[id]||null;
    const exact=Number.isInteger(id) && this.activeRomProfile?.moveStats?.[id-1];
    const romMove=exact && exact.id===id ? exact : null;
    const effectRecord=this.activeRomProfile?.moveEffectDispatch?.verified===true&&Number.isInteger(id)?
      this.activeRomProfile.moveEffectDispatch.moves?.[id-1]:null;
    if(romMove) {
      return {
        ...(reference||{}),
        name:romName||(reference?.name||'Golpe #'+id),
        nameSource:romName?'PERFIL_ROM_LOCAL_CRC32':'REFERÊNCIA_EXTERN_NÃO_COMPROVADA',
        power:romMove.powerByte,pp:romMove.basePp,
        typeId:romMove.typeByte,effectByte:romMove.effectByte,
        effectHandlerFromAuditedRom:effectRecord?.moveId===id?effectRecord.handler:null,
        effectHandlerPointerCpu:effectRecord?.moveId===id?effectRecord.pointerCpu:null,
        effectHandlerDispatchSource:effectRecord?.moveId===id?
          'SHA256_ROM_LOCAL_MOVE_EFFECT_POINTER_TABLE':'NÃO_COMPROVADO',
        effectOutcomeCertified:false,
        accuracyByte:romMove.accuracyByte,
        // Proveniência dos críticos: tabela efetiva HighCriticalMoves validada
        // pela SHA256 da ROM LOCAL; não prova o estado do turno no emulador.
        highCriticalFromAuditedRom:this.activeRomProfile?.battleRuleTables?.verified===true?
          this.activeRomProfile.battleRuleTables.highCriticalMoveIdsFromRom.includes(id):null,
        highCriticalDataSource:this.activeRomProfile?.battleRuleTables?.verified===true?
          'HIGH_CRITICAL_MOVES_ROM_LOCAL_SHA256_VERIFICADA':'NÃO_COMPROVADO',
        // Indicador nominal derivado do byte, NÃO probabilidade efetiva do turno.
        acc:romMove.accuracyByte*100/255,
        accuracySource:'BYTE_ROM_A_APLICAR_A_ESTAGIOS_DO_TURNO',
        attributesSource:'MOVES_DA_ROM_LOCAL_CRC32 (6 BYTES POR GOLPE)',
        typeSource:'NOME_DE_TIPO_DA_REFERENCIA_A_CONFRONTAR_COM_ID_ROM',
        effectSource:'ID_DE_EFEITO_ROM; NOME_DE_REFERENCIA_A_VALIDAR'
      };
    }
    // O catálogo estático não prova os valores de uma ROM modificada.
    return romName ? {
      ...(reference||{}),name:romName,
      nameSource:'PERFIL_ROM_LOCAL_CRC32',
      attributesSource:'REFERÊNCIA_ESTÁTICA_NÃO_VERIFICADA_NESTA_ROM'
    } : reference ? {...reference,nameSource:'REFERÊNCIA_ESTÁTICA_NÃO_VERIFICADA_NESTA_ROM'} : null;
  }

  async fetchGameState() {
    if (!this.lastRomStatusReadAt || Date.now()-this.lastRomStatusReadAt > 4000) {
      this.lastRomStatusReadAt = Date.now();
      const reply = await this.sendRaw('GET_STATUS');
      const status = reply ? 'GET_STATUS '+reply.join(' ') : null;
      let match = getCurrentRom(status,this.romRegistry.profiles);
      if (!match && Date.now()-this.lastRomRegistryRefreshAt > 30000) {
        // Descoberta inteiramente automática: ZIP/ROM copiado para Downloads
        // depois do arranque é detetado sem reiniciar nem configurar variáveis.
        this.lastRomRegistryRefreshAt = Date.now();
        this.romRegistry = buildProfiles(); // procura ROMs e ZIPs novos sem reiniciar
        this.latestState.romAutoDiscovery=this.romRegistry.discovery;
        match = getCurrentRom(status,this.romRegistry.profiles);
      }
      this.activeRomProfile = match;
      const crcMatch = status && status.match(/crc32=([0-9a-f]{8})/i);
      this.latestState.romRuntimeIdentity = {
        source:'RetroArch GET_STATUS',
        reportedCRC32:crcMatch ? crcMatch[1].toUpperCase() : null,
        matched:!!this.activeRomProfile,
        profileSha256:this.activeRomProfile?.hash?.sha256||null,
        title:this.activeRomProfile?.title||null,
        addressesFromRom:!!this.activeRomProfile,
        identityVerification:'CRC32_DO_RETROARCH (não é prova de SHA256 da ROM no iPhone)',
        localProfiles:this.romRegistry.profiles.length,
        tablesValidated:this.activeRomProfile?.validated||null,
        reason:this.activeRomProfile ? 'CRC32 da ROM carregada coincide com ficheiro local analisado' :
          'Não há ficheiro ROM local coincidente ou GET_STATUS indisponível'
      };
      if (status && /GET_STATUS\s+CONTENTLESS/i.test(status)) {
        this.latestState.connected=false;
        this.latestState.lastReadError='RetroArch sem ROM carregada.';
        this.emit('update',this.latestState);
        return;
      }
    }
    // =========================================================================
    // ARQUITETURA DE LEITURA EXAUSTIVA DA MEMÓRIA RAM DO GAME BOY (GEN 1)
    // Lê blocos contíguos completos sem deixar bytes por ler.
    // =========================================================================

    // BLOCO 1: Jogador, Equipa Completa (6 Mons), Mochila, Pokédex e Mapa ($D158..$D369, 530 bytes)
    const blockPlayerParty = await this.readMemoryBlock('D158', 530);

    if (!blockPlayerParty || blockPlayerParty.length < 530) {
      const now = Date.now();
      if (!this.lastInitialReadDebugAt || now - this.lastInitialReadDebugAt >= 3000) {
        this.lastInitialReadDebugAt = now;
        console.error('[RetroArchClient] Falha na leitura inicial da RAM:', JSON.stringify({
          target: `${this.ip}:${this.port}`,
          requestedAddress: '$D158',
          expectedBytes: 530,
          receivedBytes: blockPlayerParty ? blockPlayerParty.length : null,
          socketBound: !!(this.socket && this.socket.address && this.socket.address().port)
        }));
      }
      if (this.latestState.connected) {
        this.latestState.connected = false;
        this.emit('update', this.latestState);
      }
      return;
    }

    // Não marcar ONLINE até todas as zonas essenciais serem lidas corretamente.
    // BLOCO 2: Mundo, Eventos (320 bytes), Itens Ocultos, Fauna Selvagem e Equipa Inimiga ($D5A0..$D8AF, 784 bytes)
    const blockWorldEvents = await this.readMemoryBlock('D5A0', 784);
    // wNumBoxItems ($D53A) e wBoxItems ($D53B): 50 pares item/quantidade + terminador.
    const blockPcItems = await this.readMemoryBlock('D53A', 102);

    // BLOCO 3: Tempo de Jogo e Caixa do PC com detalhes de todos os 20 Pokémon ($DA40..$DD30, 750 bytes)
    const blockBoxTime = await this.readMemoryBlock('DA40', 750);
    // $DD2A: 20 OT names (220B); $DE06: 20 nicknames (220B).
    const blockPcBoxNames = await this.readMemoryBlock('DD2A', 440);

    // BLOCO 4: Sprites e Entidades no Overworld ($C100..$C2FF, 512 bytes)
    const blockSprites = await this.readMemoryBlock('C100', 512);

    // BLOCO 5: Screen Tilemap Completo 20x18 ($C3A0..$C507, 360 bytes)
    const blockTilemap = await this.readMemoryBlock('C3A0', 360);

    const baseReadStatus = {
      playerAndParty: !!(blockPlayerParty && blockPlayerParty.length === 530),
      worldAndEvents: !!(blockWorldEvents && blockWorldEvents.length === 784),
      storedPcItems: !!(blockPcItems && blockPcItems.length === 102),
      currentPcBox: !!(blockBoxTime && blockBoxTime.length === 750),
      currentPcBoxNames: !!(blockPcBoxNames && blockPcBoxNames.length === 440),
      overworldSprites: !!(blockSprites && blockSprites.length === 512),
      screenTilemap: !!(blockTilemap && blockTilemap.length === 360)
    };
    const baseReadComplete = Object.values(baseReadStatus).every(Boolean);
    this.latestState.memoryReadStatus = {
      source: 'RetroArch READ_CORE_MEMORY',
      completeness: 'selected-address-ranges-only',
      blocks: baseReadStatus,
      verified: baseReadComplete,
      checkedAt: new Date().toISOString()
    };
    if (!baseReadComplete) {
      this.latestState.connected = false;
      this.latestState.lastReadError = 'Leitura incompleta: os valores antigos não são telemetria atual.';
      this.emit('update', this.latestState);
      return;
    }
    // Verificar se o mapa mudou durante as leituras sequenciais. Se mudou,
    // nunca publicar flags de eventos, itens e treinadores sob o ID antigo.
    // D35E..D365 contiguous: second map ID and wLastMap from same UDP read.
    // Still NOT an atomic snapshot of all game memory.
    const repeatMapAndLastMap=await this.readMemoryBlock('D35E',8);
    const mapConfirmation = verifyMapSnapshot(
      blockPlayerParty[518],Array.isArray(repeatMapAndLastMap)&&
      repeatMapAndLastMap.length===8?[repeatMapAndLastMap[0]]:[]
    );
    this.latestState.memoryReadStatus.mapSnapshot=mapConfirmation;
    // D35E is unchanged even when the player moves INSIDE the same map.
    // Also corroborate D361/D362 before recommending tile or direction.
    const positionWindow=verifyMapPositionWindow({
      firstMapByte:blockPlayerParty[518],
      firstYByte:blockPlayerParty[521],
      firstXByte:blockPlayerParty[522],
      secondMapAndLastMapBytes:repeatMapAndLastMap
    });
    this.latestState.memoryReadStatus.positionWindow=positionWindow;
    this.latestState.romTerrainPositionWindow=positionWindow;
    if(!mapConfirmation.verified){
      this.latestState.memoryReadStatus.verified=false;
      this.latestState.connected=false;
      this.latestState.lastReadError=mapConfirmation.reason+
        ': descartar esta amostra e reler o mapa.';
      this.latestState.romStaticMapGuide={verified:false,
        reason:'Amostra RAM de mapas diferentes; descartar guia estático anterior'};
      this.latestState.romTerrainCurrentTile={verified:false,
        reason:'Mapa RAM incoerente; tile do terreno anterior descartado'};
      this.latestState.romTerrainWarpHints={verified:false,
        reason:'Mapa RAM incoerente; percursos do terreno anterior descartados'};
      this.latestState.romMovementOptions={verified:false,
        reason:'Mapa RAM incoerente; descartar direções anteriores'};
      this.latestState.romLastMapEvidence={verified:false,
        reason:'Mapa mudou entre leituras; destino D365 descartado',atomicSnapshotVerified:false};
      this.latestState.romAreaEvidence={verified:false,
        source:'AMOSTRA_RAM_DE_MAPAS_DIFERENTES',items:[],trainers:[],npcs:[]};
      this.latestState.romTrainerFlags={verified:false,entries:[],
        source:'AMOSTRA_RAM_DE_MAPAS_DIFERENTES'};
      this.latestState.romHiddenItems={verified:false,items:[],
        reason:'AMOSTRA_RAM_DE_MAPAS_DIFERENTES'};
      this.latestState.romAreaProgress={verified:false,
        source:'AMOSTRA_RAM_DE_MAPAS_DIFERENTES'};
      this.latestState.romItemAccess={verified:false,results:[],
        reason:'Mapa RAM incoerente; todos os percursos antigos descartados'};
      this.latestState.worldAdvisor={verified:false,observations:[],
        reason:'Mapa RAM incoerente; conselhos do mapa anterior descartados'};
      this.latestState.globalCampaignLedger={verified:false,mapProgress:[],
        reason:'Mapa RAM incoerente; progresso global anterior descartado'};
      this.latestState.romWildEncounters=null;
      this.latestState.romMap=null;
      this.latestState.mapEntities=[];
      this.emit('update',this.latestState);
      return;
    }
    this.latestState.lastReadError = null;
    this.latestState.connected = true;
    this.latestState.lastUpdate = new Date().toISOString();

    // A ROM tem bancos: esta leitura opcional valida SOMENTE o cabeçalho
    // atualmente mapeado; não lê nem certifica a ROM integral.
    if (!this.lastRomHeaderCheckAt || Date.now() - this.lastRomHeaderCheckAt > 30000) {
      this.lastRomHeaderCheckAt = Date.now();
      const romHeader = await this.readMemoryBlock('0100', 80);
      if (romHeader && romHeader.length === 80) {
        const h = romHeader.map(b => Number.parseInt(b, 16));
        let checksum = 0;
        for (let i = 0x34; i <= 0x4C; i++) checksum = (checksum - h[i] - 1) & 0xFF;
        const title = String.fromCharCode(...h.slice(0x34, 0x44))
          .split('\0')[0].replace(/[^\x20-\x7E]/g, '').trim();
        const valid = checksum === h[0x4D] && title.length > 0;
        this.latestState.romHeader = {
          source: 'ROM bank 0 / 0x0100-0x014F',
          title: valid ? title : null,
          checksumValid: valid,
          romSizeCode: h[0x48],
          readBytes: 80,
          fullRomVerified: false
        };
        this.latestState.romValidation = valid ?
          `Cabeçalho válido: ${title} (ROM integral NÃO verificada)` :
          'Cabeçalho da ROM inválido ou não reconhecido';
      } else {
        this.latestState.romHeader = { source: '0x0100-0x014F', available: false, fullRomVerified: false };
        this.latestState.romValidation = 'ROM não verificada (cabeçalho inacessível)';
      }
    }

    // =========================================================================
    // 1. DESCODIFICAÇÃO DO BLOCO DO JOGADOR, EQUIPA E MOCHILA (BLOCO 1 - $D158)
    // =========================================================================
    // Nome do Treinador ($D158, 11 bytes)
    const trainerName = decodeGen1Text(blockPlayerParty.slice(0, 11)) || 'RED';
    this.latestState.trainerName = trainerName;

    // Número de Pokémon na Equipa ($D163, offset 11)
    const partyCount = parseInt(blockPlayerParty[11], 16);
    if (!Number.isInteger(partyCount) || partyCount > 6) {
      this.latestState.connected = false;
      this.latestState.lastReadError = 'Contagem da equipa inválida: não aceitar ou cortar silenciosamente valores da RAM.';
      this.emit('update', this.latestState);
      return;
    }
    this.latestState.partyCount = partyCount;

    // Espécies da Equipa ($D164, offset 12..18)
    // Estruturas Completas dos 6 Pokémon ($D16B, offset 19..282, 6 * 44 = 264 bytes)
    const party = [];
    for (let i = 0; i < partyCount; i++) {
      const monOffset = 19 + i * 44;
      const speciesId = parseInt(blockPlayerParty[monOffset], 16);
      const hp = (parseInt(blockPlayerParty[monOffset + 1], 16) << 8) | parseInt(blockPlayerParty[monOffset + 2], 16);
      const statusVal = parseInt(blockPlayerParty[monOffset + 4], 16);
      const moves = [
        parseInt(blockPlayerParty[monOffset + 8], 16),
        parseInt(blockPlayerParty[monOffset + 9], 16),
        parseInt(blockPlayerParty[monOffset + 10], 16),
        parseInt(blockPlayerParty[monOffset + 11], 16)
      ];
      const exp = (parseInt(blockPlayerParty[monOffset + 14], 16) << 16) | (parseInt(blockPlayerParty[monOffset + 15], 16) << 8) | parseInt(blockPlayerParty[monOffset + 16], 16);

      const hpExp = (parseInt(blockPlayerParty[monOffset + 17], 16) << 8) | parseInt(blockPlayerParty[monOffset + 18], 16);
      const atkExp = (parseInt(blockPlayerParty[monOffset + 19], 16) << 8) | parseInt(blockPlayerParty[monOffset + 20], 16);
      const defExp = (parseInt(blockPlayerParty[monOffset + 21], 16) << 8) | parseInt(blockPlayerParty[monOffset + 22], 16);
      const spdExp = (parseInt(blockPlayerParty[monOffset + 23], 16) << 8) | parseInt(blockPlayerParty[monOffset + 24], 16);
      const spcExp = (parseInt(blockPlayerParty[monOffset + 25], 16) << 8) | parseInt(blockPlayerParty[monOffset + 26], 16);

      const dv1 = parseInt(blockPlayerParty[monOffset + 27], 16) || 0;
      const dv2 = parseInt(blockPlayerParty[monOffset + 28], 16) || 0;
      const atkDv = (dv1 >> 4) & 0xF;
      const defDv = dv1 & 0xF;
      const spdDv = (dv2 >> 4) & 0xF;
      const spcDv = dv2 & 0xF;
      const hpDv = ((atkDv & 1) << 3) | ((defDv & 1) << 2) | ((spdDv & 1) << 1) | (spcDv & 1);

      const pp = [
        parseInt(blockPlayerParty[monOffset + 29], 16),
        parseInt(blockPlayerParty[monOffset + 30], 16),
        parseInt(blockPlayerParty[monOffset + 31], 16),
        parseInt(blockPlayerParty[monOffset + 32], 16)
      ];
      const level = parseInt(blockPlayerParty[monOffset + 33], 16);
      const maxHp = (parseInt(blockPlayerParty[monOffset + 34], 16) << 8) | parseInt(blockPlayerParty[monOffset + 35], 16);
      const attack = (parseInt(blockPlayerParty[monOffset + 36], 16) << 8) | parseInt(blockPlayerParty[monOffset + 37], 16);
      const defense = (parseInt(blockPlayerParty[monOffset + 38], 16) << 8) | parseInt(blockPlayerParty[monOffset + 39], 16);
      const speed = (parseInt(blockPlayerParty[monOffset + 40], 16) << 8) | parseInt(blockPlayerParty[monOffset + 41], 16);
      const special = (parseInt(blockPlayerParty[monOffset + 42], 16) << 8) | parseInt(blockPlayerParty[monOffset + 43], 16);

      // Nickname e Nome do OT ($D273 e $D2B5)
      const otName = decodeGen1Text(blockPlayerParty.slice(283 + i * 11, 283 + (i + 1) * 11)) || trainerName;
      const nickname = decodeGen1Text(blockPlayerParty.slice(349 + i * 11, 349 + (i + 1) * 11)) || '';

      const pkInfo = this.getPokemonInfo(speciesId) || { name: `Pokémon #${speciesId} (não identificado)`, dex: 0, types: [] };
      const displayName = nickname && nickname !== pkInfo.name.toUpperCase() ? `${nickname} (${pkInfo.name})` : pkInfo.name;

      const moveList = moves.map((mId, mIdx) => {
        if (!mId) return null;
        const mData = this.getMoveInfo(mId) || { name: `Golpe #${mId} (não identificado)`, type: 'Desconhecido', power: null, acc: null, pp: null };
        return {
          id: mId,
          name: mData.name,
          type: mData.type,
          power: mData.power,
          accuracy: mData.acc,
          pp: pp[mIdx] !== undefined ? pp[mIdx] : null,
          maxPp: Number.isInteger(mData.pp) ? mData.pp : null,
          nameSource: mData.nameSource || 'DESCONHECIDO',
          attributesSource: mData.attributesSource || 'REFERÊNCIA_ESTÁTICA_NÃO_VERIFICADA_NESTA_ROM'
        };
      }).filter(Boolean);

      let expProgress = calculateExpProgress(level, exp, pkInfo.dex);
      expProgress = {...expProgress,source:'REFERÊNCIA_ESTÁTICA_NÃO_VERIFICADA_NESTA_ROM'};
      const romSpecies = this.activeRomProfile?.species?.[speciesId-1];
      const rateId = romSpecies?.stats?.growthRateId;
      const growth = Number.isInteger(rateId) ? this.activeRomProfile?.growthRates?.[rateId] : null;
      if (growth && level>=1 && level<=100) {
        try {
          const start=expAtLevel(growth,level),next=expAtLevel(growth,Math.min(100,level+1));
          expProgress={
            current:exp,next,needed:level===100?0:Math.max(0,next-exp),
            percent:level===100?100:Math.max(0,Math.min(100,
              Math.round((exp-start)/Math.max(1,next-start)*100))),
            source:'FÓRMULA_EXTRAÍDA_DA_ROM+EXP_RAM'
          };
        } catch(e) {expProgress={current:exp,next:null,needed:null,percent:null,source:'FÓRMULA_ROM_INVÁLIDA'};}
      }

      party.push({
        partyIndex: i,
        speciesId,
        name: displayName,
        rawName: pkInfo.name,
        nickname,
        otName,
        dex: pkInfo.dex,
        types: pkInfo.types,
        speciesSource: pkInfo.source || 'NÃO_VALIDADO',
        tmHmCompatibility: pkInfo.tmHmFromRom || null,
        hp,
        maxHp: maxHp || hp,
        level: level || 1,
        status: statusVal === 0 ? 'HEALTHY' : (statusVal & 0x7 ? 'SLEEP' : (statusVal & 0x8 ? 'POISON' : (statusVal & 0x40 ? 'PARALYSIS' : 'BURN'))),
        stats: { attack, defense, speed, special },
        statExp: { hp: hpExp, attack: atkExp, defense: defExp, speed: spdExp, special: spcExp },
        dvs: { hp: hpDv, attack: atkDv, defense: defDv, speed: spdDv, special: spcDv },
        exp: expProgress,
        moves: moveList,
        spriteUrl: getPokemonSpriteUrl(pkInfo.name, pkInfo.dex, pkInfo.spriteRom),
        spriteSource: pkInfo.spriteRom?.pixelsDecoded ?
          'SPRITE_FRONTAL_DESCODIFICADO_DA_ROM (4 tons neutros)' :
          'IMAGEM_EXTERNA_GEN5_NÃO_EXTRAÍDA_DA_ROM',
        originalBackSpriteUrl: pkInfo.spriteRom?.pixelsDecoded ?
          getPokemonSpriteUrl(pkInfo.name, pkInfo.dex, pkInfo.spriteRom,'back') : null,
        artworkUrl: pkInfo.dex ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkInfo.dex}.png` : ''
      });
    }
    this.latestState.party = party;
    this.latestState.romProgressAlerts=nextPartyAlerts(this.activeRomProfile,party);

    // Pokédex Capturados (151 bits em 19 bytes, offset 415..433)
    const ownedDexSet = new Set();
    for (let byteIdx = 0; byteIdx < 19; byteIdx++) {
      const val = parseInt(blockPlayerParty[415 + byteIdx], 16);
      for (let bit = 0; bit < 8; bit++) {
        if ((val & (1 << bit)) !== 0) {
          const dexNum = byteIdx * 8 + bit + 1;
          if (dexNum <= 151) ownedDexSet.add(dexNum);
        }
      }
    }
    this.latestState.pokedexOwned = Array.from(ownedDexSet);
    this.latestState.pokedexOwnedCount = ownedDexSet.size;

    // Pokédex Vistos (151 bits em 19 bytes, offset 434..452)
    const seenDexSet = new Set();
    for (let byteIdx = 0; byteIdx < 19; byteIdx++) {
      const val = parseInt(blockPlayerParty[434 + byteIdx], 16);
      for (let bit = 0; bit < 8; bit++) {
        if ((val & (1 << bit)) !== 0) {
          const dexNum = byteIdx * 8 + bit + 1;
          if (dexNum <= 151) seenDexSet.add(dexNum);
        }
      }
    }
    this.latestState.pokedexSeen = Array.from(seenDexSet);
    this.latestState.pokedexSeenCount = seenDexSet.size;

    // Mochila Completa (42 bytes, offset 453..494)
    const numBagItems = parseInt(blockPlayerParty[453], 16) || 0;
    const inventory = [];
    for (let i = 0; i < Math.min(numBagItems, 20); i++) {
      const itemId = parseInt(blockPlayerParty[454 + i * 2], 16);
      const qty = parseInt(blockPlayerParty[455 + i * 2], 16);
      if (itemId === 0xFF || !itemId) break;
      inventory.push({
        id: itemId,
        name: ITEM_NAMES[itemId] || `Item #${itemId}`,
        qty: qty || 1
      });
    }
    this.latestState.inventory = inventory;

    // Armazenamento do PC: independência entre itens na mochila e itens no PC.
    const pcItemCountRaw = Number.parseInt(blockPcItems[0], 16);
    if (pcItemCountRaw > 50) {
      this.latestState.connected = false;
      this.latestState.lastReadError = 'PC de itens: contagem inválida (possível offset ou RAM errados).';
      this.emit('update', this.latestState);
      return;
    }
    const pcItems = [];
    for (let i = 0; i < pcItemCountRaw; i++) {
      const id = Number.parseInt(blockPcItems[1 + i * 2], 16);
      const qty = Number.parseInt(blockPcItems[2 + i * 2], 16);
      if (!id || id === 0xFF || !qty) {
        this.latestState.connected = false;
        this.latestState.lastReadError = `PC de itens: ID/quantidade inválidos no slot ${i + 1}`;
        this.emit('update', this.latestState);
        return;
      }
      pcItems.push({ id, name: ITEM_NAMES[id] || `Item #${id} (não identificado)`, qty });
    }
    this.latestState.pcItems = pcItems;
    this.latestState.pcItemsCapacity = {
      total: 50, occupied: pcItems.length, free: 50 - pcItems.length
    };
    this.latestState.inventoryCapacity = {
      total: 20,
      occupied: inventory.length,
      free: Math.max(0, 20 - inventory.length)
    };

    // Dinheiro ($D347, offset 495..497)
    this.latestState.money = decodeBcdMoney(
      parseInt(blockPlayerParty[495], 16),
      parseInt(blockPlayerParty[496], 16),
      parseInt(blockPlayerParty[497], 16)
    );

    // Nome do Rival ($D34A, offset 498..508)
    this.latestState.rivalName = decodeGen1Text(blockPlayerParty.slice(498, 509)) || 'BLUE';

    // Insígnias ($D356, offset 510)
    this.latestState.badges = decodeBadges(blockPlayerParty[510]);

    // Mapa ID ($D35E, offset 518) e Dimensões
    const mapId = parseInt(blockPlayerParty[518], 16);
    this.latestState.mapId = mapId;
    // Guia estático derivado da ROM local, válido apenas após reler/confirmar D35E.
    // Não afirmar que itens, treinadores ou Pokémon já foram tratados na partida.
    this.latestState.romStaticMapGuide=(this.activeRomProfile&&mapConfirmation.verified)?
      staticMapGuide(this.activeRomProfile,mapId):
      {verified:false,reason:'ROM local ou mapa RAM não confirmados'};
    if(this.latestState.romStaticMapGuide?.verified&&
       this.latestState.romStaticMapGuide.warps.some(w=>w.map===255)){
      const lastMapProof=annotateLastMap(this.latestState.romStaticMapGuide,
        this.activeRomProfile,{
          firstByte:blockPlayerParty[525],
          secondByte:repeatMapAndLastMap?.[7],
          mapSnapshotVerified:mapConfirmation.verified
        });
      if(lastMapProof.verified)this.latestState.romStaticMapGuide=lastMapProof.guide;
      this.latestState.romLastMapEvidence={
        verified:lastMapProof.verified,
        lastMapId:lastMapProof.verified?lastMapProof.resolvedLastMapId:null,
        resolvedWarps:lastMapProof.verified?lastMapProof.resolvedWarpCount:0,
        reason:lastMapProof.reason||null,atomicSnapshotVerified:false
      };
    }else{
      this.latestState.romLastMapEvidence={
        verified:false,reason:'Área sem warp LAST_MAP validado',atomicSnapshotVerified:false
      };
    }
    const mapName = MAP_NAMES[mapId] || `Mapa #0x${mapId.toString(16).toUpperCase()}`;
    if (this.latestState.mapName !== mapName && this.latestState.mapName !== 'Desconhecido') {
      this.addHistoryEvent(`Entrou em ${mapName}`);
    }
    this.latestState.mapName = mapName;

    // Coordenadas do Jogador ($D361 = Y, $D362 = X, offset 521 e 522)
    this.latestState.coords = {
      y: parseInt(blockPlayerParty[521], 16) || 0,
      x: parseInt(blockPlayerParty[522], 16) || 0
    };
    const rawMapH = parseInt(blockPlayerParty[528], 16) || 0;
    const rawMapW = parseInt(blockPlayerParty[529], 16) || 0;
    this.latestState.mapDimensions = {
      blockHeight: rawMapH,
      blockWidth: rawMapW,
      height: rawMapH * 2,
      width: rawMapW * 2
    };
    // Terrain geometry is derived from the actual SHA-audited ROM.
    // Never treat LAND tile passability as proof of free movement right now.
    const terrain=this.latestState.romStaticMapGuide?.terrain;
    const pos=this.latestState.coords;
    const coordsAgree=terrain?.verified===true && positionWindow.verified===true &&
      terrain.width===this.latestState.mapDimensions.width &&
      terrain.height===this.latestState.mapDimensions.height &&
      Number.isInteger(pos.x)&&Number.isInteger(pos.y)&&
      pos.x>=0&&pos.y>=0&&pos.x<terrain.width&&pos.y<terrain.height;
    this.latestState.romTerrainCurrentTile=coordsAgree?
      inspectTerrainCell(terrain,pos.x,pos.y):
      {verified:false,reason:positionWindow.verified===false?
        'Coordenadas mudaram ou não foram confirmadas entre leituras RAM: '+positionWindow.reason:
        'Geometria ROM, dimensões RAM ou posição não coincidem'};
    this.latestState.romTerrainWarpHints=coordsAgree&&
      this.latestState.romTerrainCurrentTile?.verified===true?
      terrainWarpHints(this.latestState.romStaticMapGuide,pos):
      {verified:false,reason:'Matriz ROM ou coordenadas RAM não corroboradas'};
    if(this.latestState.romTerrainCurrentTile?.verified)
      this.latestState.romTerrainCurrentTile={
        ...this.latestState.romTerrainCurrentTile,
        ramMapCorroborated:mapConfirmation.verified,
        ramPositionCorroborated:positionWindow.verified,
        liveMovementPassableVerified:false,
        atomicSnapshotVerified:false
      };

    // =========================================================================
    // 2. DESCODIFICAÇÃO DO BLOCO DO MUNDO E EVENTOS (BLOCO 2 - $D5A0)
    // =========================================================================
    let eventFlagsRaw = [];
    let wildGrassRaw = [];
    let enemyPartyRaw = [];
    let toggleRaw = [];
    let toggleListRaw = [];
    let hiddenRaw = [];
    let hiddenCoinsRaw = [];
    let walkBikeSurf = null;

    if (blockWorldEvents && blockWorldEvents.length >= 784) {
      // Caixa do PC Atual ($D5A0, offset 0)
      const currentBoxNum = (parseInt(blockWorldEvents[0], 16) & 0x7F) + 1;

      // Moedas do Casino ($D5A4, offset 4..5)
      this.latestState.coins = decodeBcdMoney(0, parseInt(blockWorldEvents[4], 16), parseInt(blockWorldEvents[5], 16));

      // Itens no chão / Entidades Missable ($D5A6, offset 6..37, 32 bytes)
      toggleRaw = blockWorldEvents.slice(6, 38);
      // wToggleableObjectList $D5CE: mapa atual, 17 pares (sprite local, flag global).
      toggleListRaw = blockWorldEvents.slice(46, 80);

      // Itens Ocultos ($D6F0, offset 336..349, 14 bytes cobrindo todos os 54 itens ocultos)
      hiddenRaw = blockWorldEvents.slice(336, 350);
      // wObtainedHiddenCoinsFlags: D6FE..D6FF (12 moedas escondidas).
      hiddenCoinsRaw = blockWorldEvents.slice(350, 352);

      // Modo de Deslocação ($D700, offset 352: 0 = Pé, 1 = Bicicleta, 2 = Surf)
      const movementByte=blockWorldEvents[352];
      walkBikeSurf=typeof movementByte==='string'&&/^[a-f0-9]{2}$/i.test(movementByte)?
        parseInt(movementByte,16):null;
      if(![0,1,2].includes(walkBikeSurf))walkBikeSurf=null;
      this.latestState.movementMode=walkBikeSurf===1?'🚲 Bicicleta':
        walkBikeSurf===2?'🌊 A Surfar':walkBikeSurf===0?'🚶 A Pé':'Desconhecido (RAM D700 não validada)';

      // EVENT FLAGS COMPLETAS ($D747, offset 423..742 = 320 BYTES = 2,560 EVENT BITS!)
      eventFlagsRaw = blockWorldEvents.slice(423, 743);

      // WILD GRASS ENCOUNTERS DA ÁREA ($D887, offset 743..763, 21 bytes)
      wildGrassRaw = blockWorldEvents.slice(743, 764);

      // EQUIPA INIMIGA COMPLETA DO TREINADOR ($D89C, offset 764..771, 7 bytes)
      enemyPartyRaw = blockWorldEvents.slice(764, 772);
    }

    // The original D700 byte came from a large sequential world-data block.
    // Re-read D700 just before predicting movement to reject Surf/bike state drift.
    const modeWindow=verifyMovementModeWindow({
      firstModeByte:blockWorldEvents?.[352],
      secondModeBytes:await this.readMemoryBlock('D700',1)
    });
    this.latestState.romMovementModeWindow=modeWindow;
    if(!modeWindow.verified)
      this.latestState.movementMode='❔ Modo de deslocação alterado ou não confirmado';
    this.latestState.romMovementOptions=
      inspectMovementOptions(
        this.latestState.romStaticMapGuide?.terrain,
        this.activeRomProfile?.world?.terrainAtlas,
        this.latestState.coords,
        modeWindow.verified?modeWindow.modeByte:null,
        {mapSnapshotVerified:mapConfirmation.verified&&positionWindow.verified&&modeWindow.verified}
      );
    // Only static rules are inferred. These UDP reads are not atomic.
    // Verificador Canónico de Event Flags da RAM
    const checkEventFlag = (eventId) => {
      if (eventId === undefined || eventId === null || !eventFlagsRaw || eventFlagsRaw.length === 0) return false;
      const byteIdx = Math.floor(eventId / 8);
      const bitIdx = eventId % 8;
      if (byteIdx >= 0 && byteIdx < eventFlagsRaw.length) {
        const val = parseInt(eventFlagsRaw[byteIdx], 16);
        return (val & (1 << bitIdx)) !== 0;
      }
      return false;
    };

    // Estes estados RAM existem mesmo sem atribuir nomes de scripts não validados.
    const toggleableEvidence=decodeToggleables(toggleRaw,toggleListRaw);
    this.latestState.toggleableObjectTelemetry={
      verified:toggleableEvidence.verified,
      source:toggleableEvidence.source||'RAM D5A6 + D5CE',
      reason:toggleableEvidence.reason||null,
      entries:toggleableEvidence.entries
    };

    // Todos os 320 bytes de wEventFlags são obtidos diretamente da WRAM.
    // Os 507 nomes são um dicionário estático baseado em pret/pokered (Red/Blue).
    const eventEntries = Object.entries(CANONICAL_EVENTS).map(([name, bitIndex]) => ({
      name, bitIndex, set: checkEventFlag(bitIndex)
    }));
    this.latestState.eventFlagTelemetry = {
      source: 'RAM D747 (320 bytes) + dicionário pret/pokered',
      bytesRead: eventFlagsRaw.length,
      expectedBytes: 320,
      dictionaryEntries: eventEntries.length,
      verifiedRamCoverage: eventFlagsRaw.length === 320,
      mappingRomIdentityConfirmed: this.latestState.romHeader?.fullRomVerified === true,
      activeEventNames: eventEntries.filter(e => e.set).map(e => e.name),
      completeNamedStates: Object.fromEntries(eventEntries.map(e => [e.name,e.set])),
      rawHex: eventFlagsRaw.join('').toUpperCase()
    };

    // =========================================================================
    // 3. DESCODIFICAÇÃO DO BLOCO DE TEMPO E PC BOX (BLOCO 3 - $DA40)
    // =========================================================================
    let boxCount = 0;
    if (blockBoxTime && blockBoxTime.length >= 100) {
      // Símbolos pret/pokered: wPlayTimeHours=DA41, Minutes=DA43, Seconds=DA44.
      // DA40 NÃO é o byte alto das horas; DA42 é wPlayTimeMaxed.
      const hours = parseInt(blockBoxTime[1], 16);
      const minutes = parseInt(blockBoxTime[3], 16);
      const seconds = parseInt(blockBoxTime[4], 16);
      this.latestState.playTime = `${hours}h ${minutes}m ${seconds}s`;

      boxCount = parseInt(blockBoxTime[64], 16);
      if (!Number.isInteger(boxCount) || boxCount > 20) {
        this.latestState.connected = false;
        this.latestState.lastReadError = 'Contagem de Pokémon na caixa atual impossível (>20 ou inválida).';
        this.emit('update', this.latestState);
        return;
      }
      const boxSpecies = [];
      for (let i = 0; i < Math.min(boxCount, 20); i++) {
        const spId = parseInt(blockBoxTime[65 + i], 16);
        if (spId === 0xFF || !spId) {
          this.latestState.connected = false;
          this.latestState.lastReadError = 'ID do Pokémon no PC inválido na lista de espécies.';
          this.emit('update', this.latestState);
          return;
        }
        const pk = this.getPokemonInfo(spId) || { name: `Pokémon #${spId}`, dex: 0, types: [] };
        let level = null;
        let curHp = null;
        const moves = [];
        // $DA96 - $DA40 = 86. $DA95 é o marcador final da lista de espécies.
        const monOffset = 86 + i * 33;
        const structSpeciesId = parseInt(blockBoxTime[monOffset], 16);
        if (structSpeciesId !== spId) {
          this.latestState.connected = false;
          this.latestState.lastReadError = 'ID do Pokémon na estrutura PC não coincide com a lista: offset inválido.';
          this.emit('update', this.latestState);
          return;
        }
        if (blockBoxTime.length >= monOffset + 12) {
          curHp = (parseInt(blockBoxTime[monOffset + 1], 16) << 8) | parseInt(blockBoxTime[monOffset + 2], 16);
          level = parseInt(blockBoxTime[monOffset + 3], 16) || null;
          for (let m = 0; m < 4; m++) {
            const mId = parseInt(blockBoxTime[monOffset + 8 + m], 16);
            if (mId > 0 && this.getMoveInfo(mId)) {
              moves.push(this.getMoveInfo(mId).name);
            }
          }
        }
        const otName = decodeGen1Text(blockPcBoxNames.slice(i * 11, (i + 1) * 11));
        const nickname = decodeGen1Text(blockPcBoxNames.slice(220 + i * 11, 220 + (i + 1) * 11));
        const displayName = nickname && nickname.toUpperCase() !== pk.name.toUpperCase()
          ? `${nickname} (${pk.name})` : pk.name;
        const plausible = level >= 1 && level <= 100 && curHp >= 0 && curHp <= 999;
        boxSpecies.push({
          speciesId: spId,
          name: displayName,
          rawName: pk.name,
          nickname,
          otName,
          dex: pk.dex,
          level: plausible ? level : null,
          curHp: plausible ? curHp : null,
          valuesVerified: plausible && pk.dex > 0,
          validationError: plausible ? null : 'Dados inválidos: rever offset/ROM e bloco do PC',
          types: pk.types || [],
          moves
        });
      }
      const currentBoxNum = (blockWorldEvents && blockWorldEvents[0]) ? ((parseInt(blockWorldEvents[0], 16) & 0x7F) + 1) : 1;
      this.latestState.pcBox = {
        boxNum: currentBoxNum,
        count: boxCount,
        freeSlots: Math.max(0, 20 - boxCount),
        pokemon: boxSpecies
      };
    }

    // Daycare em RAM: wDayCareInUse=DA48, wDayCareMon=DA5F,
    // wDayCareMonBoxLevel=DA62, wDayCareMonMoves=DA67,
    // wDayCareMonExp=DA6D, wDayCareMonPP=DA7C.
    const daycareInUse = parseInt(blockBoxTime[8], 16);
    if (daycareInUse !== 0 && daycareInUse !== 1) {
      this.latestState.connected = false;
      this.latestState.lastReadError = 'Flag do Daycare fora do intervalo esperado (0/1).';
      this.emit('update', this.latestState);
      return;
    }
    if (daycareInUse === 1) {
      const off = 31; // DA5F - DA40
      const speciesId = parseInt(blockBoxTime[off], 16);
      const info = this.getPokemonInfo(speciesId) || null;
      const exp = (parseInt(blockBoxTime[off + 14], 16) << 16) |
        (parseInt(blockBoxTime[off + 15], 16) << 8) |
        parseInt(blockBoxTime[off + 16], 16);
      const moves = [0, 1, 2, 3].map(i => {
        const moveId = parseInt(blockBoxTime[off + 8 + i], 16);
        if (!moveId) return null;
        return {
          id: moveId,
          name: this.getMoveInfo(moveId)?.name || `Golpe #${moveId} (não identificado)`,
          pp: parseInt(blockBoxTime[off + 29 + i], 16) & 0x3F
        };
      }).filter(Boolean);
      const depositedLevel = parseInt(blockBoxTime[off + 3], 16);
      const computed=daycareAdvice(this.activeRomProfile,{
        speciesId,experience:exp,depositedLevel
      });
      this.latestState.daycare = {
        occupied:true,speciesId,
        name:info?.name || `Pokémon #${speciesId} (não identificado)`,
        dex:info?.dex||null,depositedLevel,totalExpNow:exp,moves,
        currentLevel:computed.verified?computed.currentLevel:null,
        levelSource:computed.verified?computed.source:'CURVA_NÃO_VERIFICADA_NESTA_ROM',
        milestones:computed.verified?computed.milestones:[],
        nextMilestone:computed.verified?computed.nextMilestone:null,
        overdueMilestones:computed.verified?computed.overdueMilestones:[],
        pickupAtLevel:computed.verified?computed.pickupAtLevel:null,
        expUntilPickup:computed.verified?computed.expUntilPickup:null,
        stepsUntilPickupEstimate:computed.verified?computed.stepsUntilPickupEstimate:null,
        pickupAlert:computed.verified?computed.pickupAlert:null,
        readFromRam:true,romMilestonesVerified:computed.verified,
        note:computed.verified?
          'Alerta calculado com a EXP RAM e os marcos extraídos da ROM CRC32 correspondente.':
          'A RAM do Daycare foi lida, mas a curva/marcos desta ROM não puderam ser validados.'
      };
    } else {
      this.latestState.daycare = {
        occupied: false,
        readFromRam: daycareInUse === 0,
        error: daycareInUse === 0 ? null : 'Flag Daycare inválida'
      };
    }

    // Total de Pokémon Individuais Atuais (Equipa + PC)
    // Apenas uma caixa do PC é lida neste código; não afirmar total global.
    this.latestState.totalPokemonOwned = partyCount + boxCount;
    this.latestState.totalPokemonOwnedScope = 'equipa + caixa do PC atualmente selecionada (outras caixas por ler)';

    // =========================================================================
    // 4. DESCODIFICAÇÃO DOS SPRITES E ENTIDADES NO MAPA (BLOCO 4 - $C100)
    // =========================================================================
    if (blockSprites && blockSprites.length >= 512) {
      // Direção do Jogador (Sprite 0, offset +9)
      const dirVal = parseInt(blockSprites[9], 16) || 0;
      const dirMap = { 0: 'Sul (Baixo ⬇️)', 4: 'Norte (Cima ⬆️)', 8: 'Oeste (Esquerda ⬅️)', 12: 'Este (Direita ➡️)' };
      this.latestState.playerDirection = dirMap[dirVal] || 'Sul (Baixo ⬇️)';

      // Posições dos NPCs e Itens no Mapa (Sprites 1..15 em $C100 e $C200)
      const mapEntities = [];
      for (let s = 1; s <= 15; s++) {
        const sprOffset1 = s * 16;
        const sprOffset2 = 256 + s * 16;
        const picId = parseInt(blockSprites[sprOffset1], 16);
        const rawY = parseInt(blockSprites[sprOffset2 + 4], 16);
        const rawX = parseInt(blockSprites[sprOffset2 + 5], 16);
        // Em Gen 1, as coordenadas de wSpriteStateData2 ($C200) têm um offset de +4
        const y = rawY - 4;
        const x = rawX - 4;

        if (picId > 0 && y >= 0 && x >= 0 && y < 150 && x < 150) {
          const facingVal = parseInt(blockSprites[sprOffset1 + 9], 16) || 0;
          const facingMap = { 0: 'Sul ⬇️', 4: 'Norte ⬆️', 8: 'Oeste ⬅️', 12: 'Este ➡️' };
          const facing = facingMap[facingVal] || 'Sul ⬇️';

          const sprInfo = GEN1_SPRITE_PICTURES[picId] || { name: `Entidade #${picId}`, type: 'npc', icon: '👤' };
          const isItem = [61, 62, 68, 69].includes(picId) || sprInfo.type === 'item';

          mapEntities.push({
            spriteIndex: s,
            pictureId: picId,
            spriteFile: sprInfo.spriteFile || (isItem ? 'poke_ball' : 'red'),
            name: sprInfo.name,
            icon: sprInfo.icon,
            type: isItem ? 'item' : sprInfo.type,
            isItem,
            isTrainer: sprInfo.type === 'trainer',
            x,
            y,
            facing,
            compass: getCompass(this.latestState.coords, x, y)
          });
        }
      }
      this.latestState.mapEntities = mapEntities;
    }

    // =========================================================================
    // 5. DESCODIFICAÇÃO DO ECRÃ DE DIÁLOGO E TEXTO DO TILEMAP (BLOCO 5 - $C3A0)
    // =========================================================================
    if (blockTilemap && blockTilemap.length >= 360) {
      // Linhas de diálogo no Game Boy: Linha 13 (offset 261..278) e Linha 15 (offset 301..318)
      const line1 = decodeGen1Text(blockTilemap.slice(261, 279)).trim();
      const line2 = decodeGen1Text(blockTilemap.slice(301, 319)).trim();
      const onScreenDialog = [line1, line2].filter(Boolean).join(' ');

      // Um texto do tilemap também pode ser um menu ou a lista de golpes.
      // Limpar a amostra anterior quando deixar de aparecer no ecrã.
      this.latestState.currentDialog = this.isValidDialogText(onScreenDialog) ? onScreenDialog : null;
      this.latestState.currentTextSource = 'screen-tilemap (unclassified: dialogue-or-menu)';
      if (this.latestState.currentDialog) {
        if (!this.latestState.dialogHistory) this.latestState.dialogHistory = [];
        const isDuplicate = this.latestState.dialogHistory.length > 0 && this.latestState.dialogHistory[0].text === onScreenDialog;
        if (!isDuplicate) {
          const time = new Date().toLocaleTimeString('pt-PT');
          const entry = { time, text: onScreenDialog };
          this.latestState.dialogHistory.unshift(entry);
          if (this.latestState.dialogHistory.length > 25) {
            this.latestState.dialogHistory.pop();
          }
          this.persistDialogEntry(entry);
        }
      }
    }

    // =========================================================================
    // 6. FAUNA SELVAGEM CARREGADA NA RAM DA ÁREA ATUAL ($D887)
    // =========================================================================
    const areaData = getAreaInfo(this.latestState.mapId, this.latestState.coords);
    const mapSpec = CANONICAL_MAPS[this.latestState.mapId] || null;
    const romWorld = this.activeRomProfile?.world;
    const romMap = romWorld?.maps?.valid ? romWorld.maps.data[this.latestState.mapId] : null;
    const romWild = romWorld?.wildEncounters?.valid ? romWorld.wildEncounters.data[this.latestState.mapId] : null;
    // Dados de ROM: estáticos para ESTA compilação, não dizem se um NPC/item já foi concluído.
    this.latestState.romMap = romMap?.valid ? {
      ...romMap, source: 'PERFIL_ROM_COM_CRC32_CORRESPONDENTE',
      objectFlagsChecked: false
    } : null;
    const resolveSlots = slots => (slots || []).map(slot => ({
      ...slot,
      speciesName: this.getPokemonInfo(slot.internalId)?.name || null,
      dex: this.getPokemonInfo(slot.internalId)?.dex || null
    }));
    this.latestState.romTrainerFlags=trainerFlagsForCurrentMap(
      this.activeRomProfile,romMap,eventFlagsRaw
    );
    const currentSha=this.activeRomProfile?.hash?.sha256;
    let coverage=currentSha ? this.trainerCoverageCache.get(currentSha) : null;
    if(currentSha&&!coverage){
      coverage=auditTrainerCoverage(this.activeRomProfile);
      this.trainerCoverageCache.set(currentSha,coverage);
    }
    this.latestState.romTrainerCoverage=coverage?.verified ? {
      verified:true,source:coverage.source,
      mapsWithTrainers:coverage.mapsWithTrainers,
      mapsFullyMapped:coverage.mapsFullyMapped,
      humanTrainerObjects:coverage.humanTrainerObjects,
      trainerEventLinksMapped:coverage.trainerEventLinksMapped,
      trainerEventLinksUnknown:coverage.trainerEventLinksUnknown,
      currentMap:currentMapTrainerCoverage(coverage,this.latestState.mapId)
    } : {verified:false,reason:coverage?.reason||'ROM não identificada'};

    this.latestState.romStationaryPokemonFlags=stationaryPokemonEvents(
      this.activeRomProfile,romMap,eventFlagsRaw
    );
    this.latestState.romAreaEvidence=buildRomAreaEvidence(romMap,
      this.latestState.mapEntities,ITEM_NAMES,{
        romIdentityMatched:!!this.activeRomProfile,
        spritesVerified:!!this.latestState.memoryReadStatus?.blocks?.overworldSprites,
        toggleables:toggleableEvidence,
        trainerFlags:this.latestState.romTrainerFlags,
        trainerPartyForObject:object=>getTrainerParty(this.activeRomProfile,
          object.trainerClassOrItemId,object.trainerNumberOrLevel),
        stationaryPokemon:this.latestState.romStationaryPokemonFlags,
        speciesName:id=>this.activeRomProfile?.species?.[id-1]?.name||null
      });
    this.latestState.romWildEncounters = romWild ? {
      mapId: this.latestState.mapId,
      source: 'PERFIL_ROM_COM_CRC32_CORRESPONDENTE',
      grass: {...romWild.grass, slots: resolveSlots(romWild.grass.slots)},
      water: {...romWild.water, slots: resolveSlots(romWild.water.slots)}
    } : null;
    this.latestState.romCaptureOpportunities=captureOpportunities(
      this.latestState.romWildEncounters,
      this.latestState.pokedexOwned,
      this.latestState.pokedexSeen,
      {romMatched:!!this.activeRomProfile,
        partyRamVerified:!!this.latestState.memoryReadStatus?.blocks?.playerAndParty}
    );
    const headerTitle = this.latestState.romHeader?.title || '';
    const romVariant = this.latestState.romHeader?.checksumValid && /POKEMON RED/i.test(headerTitle) ? 'red'
      : this.latestState.romHeader?.checksumValid && /POKEMON BLUE/i.test(headerTitle) ? 'blue'
      : null;
    const wildRef = Object.values(CANONICAL_WILD).find(entry =>
      (entry.mapIds || []).includes(this.latestState.mapId)) || null;
    // Referência externa da ROM, nunca confundir com encontros observados na RAM.
    const canonicalWildReference = romVariant && wildRef ? {
      source: 'pret/pokered ROM static tables',
      variant: romVariant,
      mapId: this.latestState.mapId,
      rateBytes: wildRef.encounterRateByte,
      grass: wildRef.variants[romVariant].grass.map(slot => ({
        ...slot,
        chancePercent: slot.weight * 100 / slot.outOf,
        internalId: Number(Object.keys(CANONICAL_IDS).find(key => CANONICAL_IDS[key].symbol === slot.species)) || null
      })),
      water: wildRef.variants[romVariant].water.map(slot => ({
        ...slot,
        chancePercent: slot.weight * 100 / slot.outOf,
        internalId: Number(Object.keys(CANONICAL_IDS).find(key => CANONICAL_IDS[key].symbol === slot.species)) || null
      }))
    } : null;
    this.latestState.mapReference = romMap?.valid ? {
      source:'PERFIL_ROM_COM_CRC32_CORRESPONDENTE', mapId:this.latestState.mapId,
      tileWidth:romMap.widthTiles, tileHeight:romMap.heightTiles,
      tilesetId:romMap.tilesetId, blockSha256:romMap.blockSha256,
      dimensionsMatchRam:this.latestState.mapDimensions?.width === romMap.widthTiles &&
        this.latestState.mapDimensions?.height === romMap.heightTiles
    } : mapSpec ? {
      source:'TABELA_EXTERNA_PRET_POKERED_NÃO_CONFIRMADA_NESTA_ROM', symbol:mapSpec.symbol,
      tileWidth:mapSpec.tileWidth,tileHeight:mapSpec.tileHeight,
      dimensionsMatchRam:null
    } : null;
    const partyDexList = (this.latestState.party || []).map(p => p.dex);
    const inventoryNames = (this.latestState.inventory || []).map(i => i.name.toUpperCase());
    const inventoryAndPcItems = [...(this.latestState.inventory || []), ...(this.latestState.pcItems || [])];

    let effectiveWild = [];
    if (!areaData.isWestRoute4 && wildGrassRaw && wildGrassRaw.length >= 21) {
      const grassRate = parseInt(wildGrassRaw[0], 16);
      if (grassRate > 0) {
        const slotChances = [51, 51, 39, 25, 25, 25, 13, 13, 11, 3].map(n => n * 100 / 256);
        const speciesMap = {};
        for (let s = 0; s < 10; s++) {
          const lv = parseInt(wildGrassRaw[1 + s * 2], 16);
          const spId = parseInt(wildGrassRaw[2 + s * 2], 16);
          if (spId && spId !== 0xFF && this.getPokemonInfo(spId)) {
            const pInfo = this.getPokemonInfo(spId);
            if (!speciesMap[spId]) {
              const staticMatch = (areaData.wild || []).find(w => w.dex === pInfo.dex);
              speciesMap[spId] = {
                name: pInfo.name,
                dex: pInfo.dex,
                types: pInfo.types,
                minLv: lv,
                maxLv: lv,
                chance: 0,
                baseStats: staticMatch ? staticMatch.baseStats : null,
                rec: staticMatch ? staticMatch.rec : 'Carregado diretamente da memória RAM da ROM.'
              };
            }
            speciesMap[spId].chance += slotChances[s];
            if (lv < speciesMap[spId].minLv) speciesMap[spId].minLv = lv;
            if (lv > speciesMap[spId].maxLv) speciesMap[spId].maxLv = lv;
          }
        }
        effectiveWild = Object.values(speciesMap);
      }
    }

    const wildFromCurrentRam = effectiveWild.length > 0;
    // Quando a RAM não fornece uma tabela válida, a ROM exata identificada por CRC32
    // fornece a referência daquele mapa; jamais usar encontros de outra variante.
    let wildFromVerifiedRom = false;
    if (!wildFromCurrentRam && romWild?.grass?.slots?.length) {
      const bySpecies = new Map();
      for (const slot of romWild.grass.slots) {
        const p = this.getPokemonInfo(slot.internalId);
        if (!p) continue;
        const key = slot.internalId;
        if (!bySpecies.has(key)) bySpecies.set(key, {
          name:p.name, dex:p.dex, types:p.types,
          minLv:slot.level, maxLv:slot.level, chance:0,
          baseStats:null,
          rec:'Extraído do ficheiro da ROM exata, não é um encontro observado.'
        });
        const row=bySpecies.get(key);
        row.chance += slot.rollWeight*100/256;
        row.minLv=Math.min(row.minLv,slot.level);
        row.maxLv=Math.max(row.maxLv,slot.level);
      }
      effectiveWild = Array.from(bySpecies.values());
      wildFromVerifiedRom = true;
    }

    // Itens Ocultos e Radar de Itemfinder
    const hiddenItemEvidence=decodeHiddenItems(this.activeRomProfile,this.latestState.mapId,hiddenRaw,ITEM_NAMES);
    this.latestState.romHiddenItems=hiddenItemEvidence;
    this.latestState.romHiddenCoins=decodeHiddenCoins(
      this.activeRomProfile,this.latestState.mapId,hiddenCoinsRaw
    );
    this.latestState.romAreaProgress=makeAreaProgress(
      this.latestState.romAreaEvidence,hiddenItemEvidence,
      this.latestState.romRuntimeIdentity
    );
    // Nas três ROMs auditadas, o ordinal da coordenada na tabela ROM corresponde
    // ao bit de wObtainedHiddenItemsFlags. O ID/nome do item AINDA depende de scripts.
    const hiddenList = hiddenItemEvidence.verified
      ? hiddenItemEvidence.items.map(item=>{
          const manual=(areaData.hiddenItems||[]).find(r=>r.x===item.x&&r.y===item.y);
          return {
            ...item,
            name:item.itemName,
            nameSource:item.itemNameSource,
            source:'ROM_COORDENADA+SCRIPT_ITEM_ID+RAM_FLAG',
            inInventory:checkIsItemInInventory(item.itemName,inventoryAndPcItems),
            requires:manual?.requires||null,
            lockReason:manual?.lockReason||null
          };
        })
      : (areaData.hiddenItems||[]).map(item=>({
          ...item,isCollected:null,
          collectionEvidence:'ROM_OU_FLAG_RAM_NÃO_VALIDADA',
          referenceSource:'LISTA_MANUAL_NÃO_CONFIRMADA_NESTA_ROM',
          inInventory:checkIsItemInInventory(item.name,inventoryAndPcItems)
        }));

    let itemfinderRadar = null;
    if (this.latestState.coords) {
      const px = this.latestState.coords.x;
      const py = this.latestState.coords.y;
      const uncollectedHidden = hiddenList.filter(h => h.isCollected === false &&
        h.x !== undefined && h.y !== undefined);
      if (uncollectedHidden.length > 0) {
        uncollectedHidden.sort((a, b) => {
          const distA = Math.abs(a.x - px) + Math.abs(a.y - py);
          const distB = Math.abs(b.x - px) + Math.abs(b.y - py);
          return distA - distB;
        });
        const nearest = uncollectedHidden[0];
        const compass = getCompass(this.latestState.coords, nearest.x, nearest.y);
        itemfinderRadar = {
          targetName: nearest.name,
          distance: compass ? compass.dist : 0,
          direction: compass ? compass.direction : '',
          badge: compass ? compass.badge : '',
          isHot: compass && compass.dist <= 3
        };
      }
    }

    const hasCascadeBadge = (this.latestState.badges || []).some(b => (b.name && b.name.includes('Cascade')) && b.obtained);
    const hasSoulBadge = (this.latestState.badges || []).some(b => (b.name && b.name.includes('Soul')) && b.obtained);
    const hasCutInParty = (this.latestState.party || []).some(p => (p.moves || []).some(m => m.name === 'Cut'));
    const hasSurfInParty = (this.latestState.party || []).some(p => (p.moves || []).some(m => m.name === 'Surf'));
    // Ter o HM na mochila não significa que um Pokémon o saiba utilizar em campo.
    const hasCut = hasCascadeBadge && hasCutInParty;
    const hasSurf = hasSoulBadge && hasSurfInParty;
    const dexCount = ownedDexSet.size;

    const checkAccessibility = (item) => {
      if (!item.requires) return { accessible: true, reason: '' };
      if (item.requires === 'SURF' && !hasSurf) return { accessible: false, reason: item.lockReason || 'Requer HM03 (Surf) e a Soul Badge' };
      if (item.requires === 'CUT' && !hasCut) return { accessible: false, reason: item.lockReason || 'Requer HM01 (Cut) e a Cascade Badge' };
      if (item.requires === 'CUT_OR_DIGLETT' && !hasCut) return { accessible: false, reason: item.lockReason || 'Secção leste inacessível sem Cut ou passar pelo Túnel de Diglett' };
      if (item.requires === 'POKEDEX_10' && dexCount < 10) return { accessible: false, reason: `Requer 10 Pokémon na Pokédex (Tens ${dexCount}/10)` };
      if (item.requires === 'POKEDEX_30' && dexCount < 30) return { accessible: false, reason: `Requer 30 Pokémon na Pokédex (Tens ${dexCount}/30)` };
      return { accessible: true, reason: '' };
    };

    const allVisItems = (areaData.visibleItems || []).map(item => {
      const romObject=this.latestState.romAreaEvidence?.items?.find(o=>o.x===item.x&&o.y===item.y);
      const romItemName=romObject?.itemName && !romObject.itemName.includes('não confirmado') ?
        romObject.itemName : null;
      const itemName=romItemName||item.name;
      const accInfo=checkAccessibility(item);
      return {
        ...item,name:itemName,itemId:romObject?.itemId??null,
        nameSource:romItemName?'ITEM_ID_ROM + NOMES_LOCAIS_NÃO_COMPROVADOS_NO_BINÁRIO':'REFERÊNCIA_MANUAL_NÃO_VERIFICADA',
        isCollected:null, // flag de remoção nunca prova uma recolha específica
        romItemCoordinatesVerified:!!romObject&&this.latestState.romAreaEvidence?.verified===true,
        removedFromMap:romObject?.removedFromMap??null,
        toggleableFlagIndex:romObject?.toggleableFlagIndex??null,
        collectionEvidence:romObject?.removedSource||'SEM_VÍNCULO_ROM_RAM',
        referenceSource:romObject?.source||'LISTA_MANUAL_NÃO_EXTRAÍDA_DA_ROM',
        inInventory:checkIsItemInInventory(itemName,inventoryAndPcItems),
        isLocked:!accInfo.accessible,lockReason:accInfo.reason,
        compass:getCompass(this.latestState.coords,item.x,item.y)
      };
    });
    // Acrescentar todos os objetos de item existentes na ROM deste mapa,
    // inclusive os que não estão no antigo catálogo manual.
    const extraRomItems=(this.latestState.romAreaEvidence?.items||[])
      .filter(o=>!allVisItems.some(m=>m.x===o.x&&m.y===o.y))
      .map(o=>({
        name:o.itemName||'Item no mapa (ID não identificado)',
        nameSource:o.itemName?'ITEM_ID_ROM + NOMES_LOCAIS_NÃO_COMPROVADOS_NO_BINÁRIO':'NÃO_IDENTIFICADO',
        itemId:o.itemId,x:o.x,y:o.y,
        isCollected:null,removedFromMap:o.removedFromMap,
        romItemCoordinatesVerified:this.latestState.romAreaEvidence?.verified===true,
        toggleableFlagIndex:o.toggleableFlagIndex,
        collectionEvidence:o.removedSource,
        referenceSource:o.source,
        inInventory:null,isLocked:false,lockReason:null,
        observedInRam:o.observedInRam,
        compass:getCompass(this.latestState.coords,o.x,o.y)
      }));

    const allHiddenItems = hiddenList.map(item => {
      const inInventory = checkIsItemInInventory(item.name, inventoryAndPcItems);
      const isCollected = item.isCollected;
      const accInfo = checkAccessibility(item);
      const compass = getCompass(this.latestState.coords, item.x, item.y);
      return {
        ...item,
        isCollected,
        inInventory,
        romItemCoordinatesVerified:hiddenItemEvidence.verified===true,
        isLocked: !accInfo.accessible,
        lockReason: accInfo.reason,
        compass
      };
    });

    // Classificação efetiva do percurso: índices de itens da ROM, terreno,
    // sprites e posição RAM. Uma rota local nunca é garantia de acesso real.
    const accessInput=[...allVisItems,...extraRomItems,...allHiddenItems];
    const accessBadge=(this.latestState.badges||[]);
    const partyConfirmed=this.latestState.memoryReadStatus?.blocks?.playerAndParty===true;
    const badgeConfirmed=partyConfirmed&&this.latestState.memoryReadStatus?.mapSnapshot?.verified===true;
    const knowsMove=(id,name)=> (this.latestState.party||[]).some(p=>
      (p.moves||[]).some(m=>m?.id===id||String(m?.name||'').toUpperCase()===name));
    const abilityCut=badgeConfirmed?
      (accessBadge.some(b=>b.obtained&&/cascade/i.test(b.name||''))&&knowsMove(15,'CUT')):null;
    const abilitySurf=badgeConfirmed?
      (accessBadge.some(b=>b.obtained&&/soul/i.test(b.name||''))&&knowsMove(57,'SURF')):null;
    const itemAccess=planItemAccess({
      terrain:this.latestState.romStaticMapGuide?.terrain,
      romSha256:this.activeRomProfile?.hash?.sha256,
      position:this.latestState.coords,
      items:accessInput,
      mapSnapshotVerified:mapConfirmation.verified,
      positionVerified:positionWindow.verified,
      modeByte:modeWindow.verified?modeWindow.modeByte:null,
      spritesVerified:this.latestState.memoryReadStatus?.blocks?.overworldSprites===true,
      mapEntities:this.latestState.mapEntities,
      canCut:abilityCut,canSurf:abilitySurf
    });
    this.latestState.romItemAccess=itemAccess;
    const accessSummary=itemAccess.results||[];
    const withPath=accessInput.map((entry,i)=>{
      const access=accessSummary[i]||null;
      const status=access?.accessStatus||'UNKNOWN';
      const withinMapBlocked=['NEEDS_CUT','NEEDS_SURF','NEEDS_CUT_AND_SURF_POSSIBLY']
        .includes(status);
      return {...entry,
        // Um requisito manual não é prova de bloqueio físico.
        manualRequirementHint:entry.requires||null,
        isLocked:withinMapBlocked,
        accessStatus:status,
        accessReason:access?.reason||'Sem leitura de percurso confirmada',
        accessRoute:access?.route||null,
        accessScope:'PERCURSO_NESTE_MAPA_SEM_WARPS',
        accessibleNow:null,
        lockReason:withinMapBlocked?access?.reason:null};
    });
    const visibleWithPath=withPath.slice(0,allVisItems.length+extraRomItems.length);
    const hiddenWithPath=withPath.slice(allVisItems.length+extraRomItems.length);
    // A ordem do Itemfinder dá prioridade a caminhos locais condicionalmente
    // calculados; nunca a um item mais próximo apenas por distância Manhattan.
    const candidatesHidden=hiddenWithPath.filter(i=>i.isCollected===false);
    if(candidatesHidden.length&&this.latestState.coords){
      candidatesHidden.sort((left,right)=>{
        const rank=i=>i.accessStatus==='CONDITIONAL_PATH'?0:
          i.accessRoute?1:2;
        const r=rank(left)-rank(right);
        if(r!==0)return r;
        const leftSteps=left.accessRoute?.steps??Infinity;
        const rightSteps=right.accessRoute?.steps??Infinity;
        if(leftSteps!==rightSteps)return leftSteps-rightSteps;
        const distance=i=>Math.abs(i.x-this.latestState.coords.x)+
          Math.abs(i.y-this.latestState.coords.y);
        return distance(left)-distance(right);
      });
      const chosen=candidatesHidden[0];
      const compass=getCompass(this.latestState.coords,chosen.x,chosen.y);
      itemfinderRadar={
        targetName:chosen.name,geometricDistance:compass?.dist??null,
        distance:compass?.dist??null,direction:compass?.direction||'',
        badge:compass?.badge||'',isHot:false,
        routeSteps:chosen.accessRoute?.steps??null,
        nextStep:chosen.accessRoute?.nextStep||null,
        accessStatus:chosen.accessStatus||'UNKNOWN',
        routeVerifiedNow:false,
        reason:'O alvo tem distância geométrica e/ou percurso ROM condicional; não prova que está acessível agora.'
      };
    }

    const allNpcItems = (areaData.npcItems || []).map(item => {
      const inInventory = checkIsItemInInventory(item.name, inventoryAndPcItems);
      const isCollected = null; // Conclusão da interação NPC ainda não confirmada por evento.
      const accInfo = checkAccessibility(item);
      const compass = getCompass(this.latestState.coords, item.x, item.y);
      return {
        ...item,
        isCollected,
        inInventory,
        isLocked: !accInfo.accessible,
        lockReason: accInfo.reason,
        compass
      };
    });

    const upcomingBoss = getUpcomingBossTactics(
      this.latestState.mapId,
      this.latestState.badges || [],
      this.latestState.party || [],
      this.latestState.pokedexOwned || [],
      this.latestState.inventory || [],
      checkEventFlag,
      this.latestState.coords
    );

    if (upcomingBoss && upcomingBoss.battles) {
      upcomingBoss.battles.forEach(bt => {
        bt.compass = getCompass(this.latestState.coords, bt.x, bt.y);
        // O motor de conselhos da área inclui lutas exemplificativas e associações
        // manuais de flags; não prova qual destes treinadores foi efetivamente vencido.
        bt.isDefeated = null;
        bt.isMissed = null;
        bt.statusLabel = 'ESTADO DESCONHECIDO — falta validar cabeçalho e flag na ROM';
        bt.statusSource = 'CONSELHO_MANUAL_SEM_FLAG_TREINADOR_VALIDADA_NA_ROM';
      });
    }

    this.latestState.areaInfo = {
      name: areaData.name,
      wildSource: wildFromCurrentRam ? 'RAM (tabela de encontros atual)' :
        wildFromVerifiedRom ? 'ROM_EXATA_CRC32 (tabela de relva desta versão; não é observação)' :
        romWild && romWild.grass.rateByte === 0 ? 'ROM_EXATA_CRC32 (sem encontros de relva neste mapa)' :
        'Nenhum encontro de relva confirmado na RAM/ROM',
      canonicalWildReference,
      canonicalNpcTrades: CANONICAL_TRADES.filter(t => t.available && t.mapId === this.latestState.mapId).map(t => ({
        ...t,
        confirmedCompleted: null,
        completionSource: 'NÃO CONFIRMADO: sem flag de troca validada',
        offerRegisteredInPokedex: ownedDexSet.has(t.give.dex),
        offerInParty: party.some(p => p.dex === t.give.dex),
        offerInCurrentPcBox: (this.latestState.pcBox?.pokemon || []).some(p => p.dex === t.give.dex),
        otherPcBoxesInspected: false
      })),
      referenceProvenance: { areaGuidance: 'TABELA MANUAL / não integralmente verificada', itemStatus: 'flags RAM quando disponíveis; posse de item não comprova recolha deste objeto' },
      wild: effectiveWild.map(w => ({
        ...w,
        isCaughtInDex: ownedDexSet.has(w.dex),
        isInParty: partyDexList.includes(w.dex)
      })),
      npcTrades: CANONICAL_TRADES.filter(t => t.available && t.mapId === this.latestState.mapId).map(t => ({
        give: this.getPokemonInfo(t.give.internalId)?.name || t.giveSymbol,
        receive: this.getPokemonInfo(t.receive.internalId)?.name || t.receiveSymbol,
        dex: t.receive.dex,
        nickname: t.nickname,
        hint: 'Troca NPC registada na desmontagem pret/pokered: ' + t.mapSymbol,
        importance: 'A conclusão desta troca NÃO está confirmada apenas por esta tabela.',
        source: 'pret/pokered/data/events/trades.asm',
        completed: null,
        isCaughtInDex: ownedDexSet.has(t.receive.dex),
        isInParty: partyDexList.includes(t.receive.dex),
        offerAvailableInParty: partyDexList.includes(t.give.dex)
      })),
      npcGifts: (areaData.npcGifts || []).map(g => ({
        ...g,
        isCaughtInDex: ownedDexSet.has(g.dex),
        isInParty: partyDexList.includes(g.dex),
        compass: getCompass(this.latestState.coords, g.x, g.y)
      })),
      npcItems: allNpcItems.filter(i => !i.isLocked),
      lockedNpcItems: allNpcItems.filter(i => i.isLocked),
      visibleItems: visibleWithPath.filter(i => !i.isLocked),
      hiddenItems: hiddenWithPath.filter(i => !i.isLocked),
      lockedItems: [...visibleWithPath,...hiddenWithPath].filter(i=>i.isLocked),
      itemAccessSummary:{verified:itemAccess.verified,counts:itemAccess.counts||{},
        currentMapRouteVerified:false,accessibleNowGuaranteed:false},
      itemfinder: itemfinderRadar,
      upcomingBoss
    };

    // =========================================================================
    // ENRIQUECIMENTO DAS ENTIDADES DO MAPA (ITENS E TREINADORES IDENTIFICADOS)
    // =========================================================================
    if (this.latestState.mapEntities && this.latestState.mapEntities.length > 0) {
      const visItems = this.latestState.areaInfo.visibleItems || [];
      const battles = (this.latestState.areaInfo.upcomingBoss && this.latestState.areaInfo.upcomingBoss.battles) ? this.latestState.areaInfo.upcomingBoss.battles : [];

      this.latestState.mapEntities.forEach(ent => {
        if (ent.isItem) {
          // Procura correspondência nos itens de chão da área
          const matchedItem = visItems.find(it => Math.abs(it.x - ent.x) <= 2 && Math.abs(it.y - ent.y) <= 2);
          if (matchedItem) {
            ent.name = `🎒 ${matchedItem.name}`;
            ent.itemName = matchedItem.name;
            ent.hint = matchedItem.hint;
            ent.importance = matchedItem.importance;
            ent.isCollected = matchedItem.isCollected;
          } else {
            ent.name = `🎒 Item no Chão (Poké Ball)`;
          }
          // Não marcar como recolhido apenas porque existe uma cópia na mochila/PC.
        } else {
          // Procura correspondência com treinadores conhecidos da área (tolerância até 4 tiles para NPCs em patrulha)
          let matchedBt = null;
          let bestDist = 999;
          for (const bt of battles) {
            const dist = Math.abs(bt.x - ent.x) + Math.abs(bt.y - ent.y);
            if (dist <= 4 && dist < bestDist) {
              bestDist = dist;
              matchedBt = bt;
            }
          }
          if (matchedBt) {
            ent.isTrainer = true;
            ent.trainerName = matchedBt.name;
            ent.name = `⚔️ ${matchedBt.name}`;
            ent.enemyRoster = matchedBt.enemyRoster;
            ent.optimalLead = matchedBt.optimalLead;
            ent.isDefeated = null; // não deduzir vitória pela lista manual
            ent.statusLabel = 'BATALHA NÃO CONFIRMADA (FLAG AINDA SEM VÍNCULO ROM)';
            ent.difficulty = matchedBt.difficulty;
          }
        }
      });
    }

    // =========================================================================
    // 7. LEITURA EXAUSTIVA DE COMBATE E BATALHA (BLOCOS $CFE0 E $CC20)
    // =========================================================================
    const blockCombat = await this.readMemoryBlock('CFE0', 255);
    // O Pokémon ativo do jogador fica em $D014, fora do bloco $CFE0.
    const blockPlayerBattle = await this.readMemoryBlock('D014', 30);
    const blockBattleMods = await this.readMemoryBlock('CC20', 280);

    // Ler o sinalizador diretamente: o bloco CFE0 atravessa a fronteira CFFF/D000
    // e a leitura em bloco pode falhar antes de chegar a D057.
    const battleFlagRead = await this.sendRaw('READ_CORE_MEMORY D057 1');
    const directBattleFlag = battleFlagRead && battleFlagRead.length === 1 &&
      /^[0-9A-Fa-f]{2}$/.test(battleFlagRead[0]) ? battleFlagRead[0] : null;
    this.latestState.battleFlagVerified = directBattleFlag !== null;

    // Leitura Direta de Repelente ($D0DB, 1 byte) da RAM
    const repelRead = await this.sendRaw('READ_CORE_MEMORY D0DB 1');
    const repelVerified = !!(repelRead && repelRead.length === 1 && /^[0-9A-Fa-f]{2}$/.test(repelRead[0]));
    const repelSteps = repelVerified ? parseInt(repelRead[0], 16) : null;
    this.latestState.repelSteps = repelSteps;
    this.latestState.repelVerified = repelVerified;

    let inBattle = false;
    let battleType = 'None';

    // Diagnóstico temporário: também registar falhas de leitura, que antes eram silenciosas.
    const now = Date.now();
    if (!this.lastBattleDebugAt || now - this.lastBattleDebugAt >= 2000) {
      this.lastBattleDebugAt = now;
      const diagnostic = {
        timestamp: new Date().toISOString(),
        requestedCombatBlock: '$CFE0',
        combatBlockLength: blockCombat ? blockCombat.length : null,
        requestedBattleModsBlock: '$CC20',
        battleModsBlockLength: blockBattleMods ? blockBattleMods.length : null,
        rawBattleFlag: directBattleFlag,
        enemySpeciesRaw: blockCombat && blockCombat.length > 5 ? blockCombat[5] : null,
        playerMode: this.latestState.playerMode || null,
        inBattleBeforeUpdate: !!this.latestState.inBattle
      };
      try {
        const debugPath = require('path').join(__dirname, 'data', 'battle_detection_debug.jsonl');
        fs.appendFileSync(debugPath, JSON.stringify(diagnostic) + '\n');
      } catch (err) {
        console.warn('[BattleDetectionDebug] Não foi possível gravar diagnóstico:', err.message);
      }
      console.log('[BattleDetectionDebug]', JSON.stringify(diagnostic));
    }

    if (directBattleFlag !== null && directBattleFlag !== undefined) {
      const inBattleVal = Number.parseInt(directBattleFlag, 16);
      if (!this.isSimulatingBattle) {
        inBattle = inBattleVal === 1 || inBattleVal === 2;
        battleType = inBattleVal === 1 ? 'Wild' : inBattleVal === 2 ? 'Trainer' : 'None';
        this.latestState.inBattle = inBattle;
        this.latestState.battleType = battleType;
      }
    } else if (!this.isSimulatingBattle) {
      this.latestState.inBattle=false;
      this.latestState.battleType='Unknown';
      this.latestState.battle=null;
    }
    const battleEvidence=parseRomBattleEvidence({
      combatBlock:blockCombat,playerBlock:blockPlayerBattle,modifierBlock:blockBattleMods,
      battleFlag:directBattleFlag===null?null:Number.parseInt(directBattleFlag,16),
      romMatched:!!this.activeRomProfile,
      captureLayoutVerified:!!this.activeRomProfile?.battleCaptureLayout?.verified,
      mapSnapshotVerified:!!this.latestState.memoryReadStatus?.mapSnapshot?.verified
    });
    // Segunda leitura independente: os valores podem alterar-se enquanto
    // o emulador executa. Nunca considerar blocos sequenciais como atómicos.
    let battleWindow={verified:false,reason:'Sem releitura confirmatória'};
    if(this.latestState.inBattle&&!this.isSimulatingBattle&&battleEvidence.verified){
      const rereadEnemy=await this.readMemoryBlock('CFE5',40);
      const rereadPlayer=await this.readMemoryBlock('D014',29);
      const rereadStages=await this.readMemoryBlock('CD1A',26);
      const rereadFlag=await this.readMemoryBlock('D057',1);
      const rereadMapId=await this.readMemoryBlock('D35E',1);
      battleWindow=verifyBattleWindow({
        combatBlock:blockCombat,playerBlock:blockPlayerBattle,modifierBlock:blockBattleMods,
        battleFlag:Number.parseInt(directBattleFlag,16),mapId:this.latestState.mapId,
        rereadEnemy,rereadPlayer,rereadStages,rereadFlag,rereadMapId
      });
    }
    battleEvidence.consistentWindowVerified=battleWindow.verified;
    const battleReadingVerified=battleEvidence.verified&&battleWindow.verified;
    this.latestState.battleReadStatus={
      verified:battleReadingVerified,
      structureVerified:battleEvidence.verified,
      captureLayoutVerified:!!this.activeRomProfile?.battleCaptureLayout?.verified,
      consistentWindowVerified:battleWindow.verified,
      reason:!battleEvidence.verified?battleEvidence.reason:!battleWindow.verified?
        battleWindow.reason:battleEvidence.exactTurnMathReason,
      source:battleEvidence.source||'RetroArch READ_CORE_MEMORY',
      atomicSnapshotVerified:false,exactTurnMathReady:false
    };
    if(this.latestState.inBattle&&!this.isSimulatingBattle&&!battleReadingVerified){
      this.latestState.battle=null;
      this.latestState.aiAdvice='Dados de combate indisponíveis: '+
        this.latestState.battleReadStatus.reason;
    }

    const isDialog = this.latestState.currentDialog && this.latestState.currentDialog.length > 0;
    if (this.latestState.inBattle) {
      this.latestState.playerMode = `⚔️ Em Combate (${this.latestState.battleType === 'Trainer' ? 'Treinador' : 'Selvagem'})`;
    } else if (isDialog) {
      this.latestState.playerMode = '💬 Em Diálogo / Menu / Evento';
    } else {
      this.latestState.playerMode = `🗺️ Exploração Livre (${this.latestState.movementMode || 'A Pé'})`;
    }

    if (this.latestState.inBattle && !this.isSimulatingBattle && battleReadingVerified) {
      // Repel steps ($D0DB, offset 251)
      this.latestState.repelSteps = parseInt(blockCombat[251], 16) || 0;

      // Inimigo Ativo ($CFE5, offset 5..32)
      const eSpecies = parseInt(blockCombat[5], 16);
      const eHp = (parseInt(blockCombat[6], 16) << 8) | parseInt(blockCombat[7], 16);
      const eMoves = [
        parseInt(blockCombat[13], 16),
        parseInt(blockCombat[14], 16),
        parseInt(blockCombat[15], 16),
        parseInt(blockCombat[16], 16)
      ];
      const eLevel = parseInt(blockCombat[19], 16);
      const eMaxHp = (parseInt(blockCombat[20], 16) << 8) | parseInt(blockCombat[21], 16);
      const eAttack = (parseInt(blockCombat[22], 16) << 8) | parseInt(blockCombat[23], 16);
      const eDefense = (parseInt(blockCombat[24], 16) << 8) | parseInt(blockCombat[25], 16);
      const eSpeed = (parseInt(blockCombat[26], 16) << 8) | parseInt(blockCombat[27], 16);
      const eSpecial = (parseInt(blockCombat[28], 16) << 8) | parseInt(blockCombat[29], 16);
      const ePPs = [
        parseInt(blockCombat[30], 16),
        parseInt(blockCombat[31], 16),
        parseInt(blockCombat[32], 16),
        parseInt(blockCombat[33], 16)
      ];

      const eInfo = this.getPokemonInfo(eSpecies) || { name: `Inimigo #${eSpecies} (não identificado)`, dex: 0, types: [], baseHp: null };

      // Modificadores de Stats do Inimigo ($CD2E, offset 270 de blockBattleMods)
      const eMods = {
        attack: this.parseStatStages(blockBattleMods[270]),
        defense: this.parseStatStages(blockBattleMods[271]),
        speed: this.parseStatStages(blockBattleMods[272]),
        special: this.parseStatStages(blockBattleMods[273]),
        accuracy: this.parseStatStages(blockBattleMods[274]),
        evasion: this.parseStatStages(blockBattleMods[275])
      };

      // Modificadores de Stats do Jogador ($CD1A, offset 250 de blockBattleMods)
      const pMods = {
        attack: this.parseStatStages(blockBattleMods[250]),
        defense: this.parseStatStages(blockBattleMods[251]),
        speed: this.parseStatStages(blockBattleMods[252]),
        special: this.parseStatStages(blockBattleMods[253]),
        accuracy: this.parseStatStages(blockBattleMods[254]),
        evasion: this.parseStatStages(blockBattleMods[255])
      };

      const enemyTrainerCount = (enemyPartyRaw && enemyPartyRaw.length > 0) ? parseInt(enemyPartyRaw[0], 16) : null;
      const enemyTrainerSpecies = (enemyPartyRaw && enemyPartyRaw.length > 1) ? enemyPartyRaw.slice(1, 1 + (enemyTrainerCount || 0)).map(s => {
        const id = parseInt(s, 16);
        return (this.getPokemonInfo(id) || { name: `Pokémon #${id}` }).name;
      }) : [];

      const enemyMon = {
        speciesId: eSpecies,
        name: eInfo.name,
        dex: eInfo.dex,
        types: eInfo.types,
        hp: eHp,
        maxHp:eMaxHp,
        level:eLevel,
        catchRate:battleEvidence.actualCatchRate,
        catchRateSource:battleEvidence.actualCatchRateVerified?
          'D007_RAM_TAXA_EFETIVA_AMOSTRA_SEQUENCIAL':'NÃO_CONFIRMADO',
        catchRateVerified:battleEvidence.actualCatchRateVerified,
        captureInputs:battleEvidence.captureInputs,
        // CFE9 é o estado realmente lido, sem inferências da espécie.
        status:battleEvidence.catchStatusFromRam,
        statusByte:battleEvidence.enemy.statusByte,
        typeIds:battleEvidence.enemy.typeIds,
        baseStats:{spd:this.activeRomProfile&&String(eInfo.source||'').includes('ROM') ? (eInfo.baseSpeed??null) : null},
        stats:{attack:eAttack,defense:eDefense,speed:eSpeed,special:eSpecial},
        statMods: eMods,
        spriteUrl: getPokemonSpriteUrl(eInfo.name, eInfo.dex, eInfo.spriteRom),
        moves: eMoves.map((m, idx) => {
          if (!m || !this.getMoveInfo(m)) return null;
          return {
            id: m,
            name: this.getMoveInfo(m).name,
            type: this.getMoveInfo(m).type || 'Desconhecido',
            power: this.getMoveInfo(m).power ?? null,
            accuracy: this.getMoveInfo(m).acc ?? null,
            pp: ePPs[idx] !== undefined ? ePPs[idx] : null
          };
        }).filter(Boolean)
      };

      // Pokémon Ativo do Jogador ($D014, bloco próprio)
      const bSpecies = parseInt(blockPlayerBattle[0], 16);
      const bHp = (parseInt(blockPlayerBattle[1], 16) << 8) | parseInt(blockPlayerBattle[2], 16);
      const bStatusVal = parseInt(blockPlayerBattle[4], 16);
      const bMoves = [
        parseInt(blockPlayerBattle[8], 16),
        parseInt(blockPlayerBattle[9], 16),
        parseInt(blockPlayerBattle[10], 16),
        parseInt(blockPlayerBattle[11], 16)
      ];
      const bLevel = parseInt(blockPlayerBattle[14], 16);
      const bMaxHp = (parseInt(blockPlayerBattle[15], 16) << 8) | parseInt(blockPlayerBattle[16], 16);
      const bAttack = (parseInt(blockPlayerBattle[17], 16) << 8) | parseInt(blockPlayerBattle[18], 16);
      const bDefense = (parseInt(blockPlayerBattle[19], 16) << 8) | parseInt(blockPlayerBattle[20], 16);
      const bSpeed = (parseInt(blockPlayerBattle[21], 16) << 8) | parseInt(blockPlayerBattle[22], 16);
      const bSpecial = (parseInt(blockPlayerBattle[23], 16) << 8) | parseInt(blockPlayerBattle[24], 16);
      const bPPs = [
        parseInt(blockPlayerBattle[25], 16),
        parseInt(blockPlayerBattle[26], 16),
        parseInt(blockPlayerBattle[27], 16),
        parseInt(blockPlayerBattle[28], 16)
      ];

      // Índice da equipa combatente (offset 15 de blockBattleMods)
      let realPartyPos = parseInt(blockBattleMods[15], 16) || 0;
      if (this.latestState.party && this.latestState.party.length > 0) {
        if (!this.latestState.party[realPartyPos] || this.latestState.party[realPartyPos].speciesId !== bSpecies) {
          const foundLiving = this.latestState.party.findIndex(p => p.speciesId === bSpecies && p.hp > 0);
          if (foundLiving !== -1) realPartyPos = foundLiving;
        }
        this.latestState.party.forEach((p, idx) => {
          p.isInBattle = (idx === realPartyPos);
        });
      }

      const pInfo = this.getPokemonInfo(bSpecies) || { name: `Pokémon #${bSpecies} (não identificado)`, dex: 0, types: [] };
      const partyMon = (this.latestState.party && this.latestState.party[realPartyPos]) ? this.latestState.party[realPartyPos] : null;

      const moveList = bMoves.map((mId, mIdx) => {
        if (!mId) return null;
        const mData = this.getMoveInfo(mId) || { name: `Golpe #${mId} (não identificado)`, type: 'Desconhecido', power: null, acc: null, pp: null };
        const currentLivePP = bPPs[mIdx] !== undefined ? (bPPs[mIdx] & 63) : null; // PP efetivo do BattleMon, não valor anterior da equipa
        return {
          id: mId,
          name: mData.name,
          type: mData.type,
          power: mData.power,
          accuracy: mData.acc,
          pp: currentLivePP,
          maxPp: Number.isInteger(mData.pp) ? mData.pp : null
        };
      }).filter(Boolean);

      const activeMon = {
        speciesId: bSpecies,
        name: partyMon ? partyMon.name : pInfo.name,
        rawName: pInfo.name,
        dex: pInfo.dex,
        types: pInfo.types,
        // HP e estado são lidos da estrutura de combate; os restantes dados
        // vêm da ficha real da equipa para evitar offsets incorretos no BattleMon.
        hp: bHp,
        maxHp:bMaxHp,
        level:bLevel,
        partyPos: realPartyPos,
        status:{NONE:'HEALTHY',SLP:'SLEEP',PSN:'POISON',BRN:'BURN',FRZ:'FREEZE',PAR:'PARALYSIS'}[
          battleEvidence.player.status
        ],
        statusByte:bStatusVal,
        typeIds:battleEvidence.player.typeIds,
        stats:{attack:bAttack,defense:bDefense,speed:bSpeed,special:bSpecial},
        statMods: pMods,
        moves: partyMon ? partyMon.moves : moveList,
        spriteUrl: getPokemonSpriteUrl(pInfo.name, pInfo.dex, pInfo.spriteRom,'back'),
        artworkUrl: pInfo.dex ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pInfo.dex}.png` : ''
      };

      // Pré-visualização RAM/ROM condicional, sem reativar a estratégia antiga.
      const strategy=null;
      const preview=buildLiveBattlePreview({romProfile:this.activeRomProfile,
        battleEvidence,battleWindow,battleType:this.latestState.battleType});

      const currentTurn = parseInt(blockBattleMods[181], 16) || 1;
      const lastPlayerMove = this.getMoveInfo(parseInt(blockBattleMods[188], 16))?.name || null;
      const lastEnemyMove = this.getMoveInfo(parseInt(blockBattleMods[189], 16))?.name || null;

      this.latestState.battle = {
        evidence:battleEvidence,exactTurnMathReady:false,
        exactTurnMathReason:battleEvidence.exactTurnMathReason,
        enemy: enemyMon,
        playerActive: activeMon,
        turn: currentTurn,
        lastPlayerMove,
        lastEnemyMove,
        strategy,preview,
        trainerPartyCount: enemyTrainerCount,
        trainerPartySpecies: enemyTrainerSpecies
      };

      // Registo Persistente de Ações de Combate
      if (!this.latestState.actionHistory) this.latestState.actionHistory = [];
      const battleLogKey = `${enemyMon.speciesId}-${enemyMon.level}-T${currentTurn}-${enemyMon.hp}-${activeMon ? activeMon.hp : 0}`;
      if (this.lastBattleLogKey !== battleLogKey) {
        this.lastBattleLogKey = battleLogKey;
        const logEntry = {
          timestamp: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-PT'),
          type: 'BATTLE_ACTION',
          turn: currentTurn,
          enemy: { name: enemyMon.name, level: enemyMon.level, hp: enemyMon.hp, maxHp: enemyMon.maxHp },
          playerActive: activeMon ? { name: activeMon.name, level: activeMon.level, hp: activeMon.hp, maxHp: activeMon.maxHp } : null,
          lastPlayerMove,
          lastEnemyMove,
          suggestedMove: (strategy && strategy.bestMove) ? strategy.bestMove.name : null
        };
        this.latestState.actionHistory.unshift(logEntry);
        if (this.latestState.actionHistory.length > 25) this.latestState.actionHistory.pop();
        try {
          fs.appendFileSync('data/battle_history_log.jsonl', JSON.stringify(logEntry) + '\n');
        } catch (e) {}
      }

      const currentBattleKey = `${enemyMon.name}-${enemyMon.level}-${enemyMon.hp}`;
      if (this.lastBattleKey !== currentBattleKey) {
        this.lastBattleKey=currentBattleKey;
        this.latestState.aiAdvice='Cálculos e recomendações de combate indisponíveis até validação dos dados do turno e mecânicas desta ROM.';
      }
    }

    // Só registar o fim quando há transição de combate para exploração.
    if (!this.latestState.inBattle && this.wasInBattle && this.latestState.battleFlagVerified) {
      const exitEntry = {
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString('pt-PT'),
        type: 'BATTLE_END',
        summary: 'Combate terminado ou fuga com sucesso.',
        enemy: this.lastBattleEnemy || 'Adversário'
      };
      if (!this.latestState.actionHistory) this.latestState.actionHistory = [];
      this.latestState.actionHistory.unshift(exitEntry);
      if (this.latestState.actionHistory.length > 25) this.latestState.actionHistory.pop();
      try {
        fs.appendFileSync('data/battle_history_log.jsonl', JSON.stringify(exitEntry) + '\n');
      } catch (e) {}
      this.latestState.battle = null;
      this.lastBattleKey = null;
    }

    // Conselho tático proativo apenas fora de combate.
    if (!this.latestState.inBattle) {
      const now = Date.now();
      const needsInitialAdvice = !this.latestState.aiAdvice || this.latestState.aiAdvice.includes('A sincronizar');
      const timeSinceAdvice = now - (this.lastExplorationAdviceTime || 0);
      if (needsInitialAdvice || timeSinceAdvice > 30000) {
        this.lastExplorationAdviceTime = now;
        getLiveAdvice(this.latestState).then(advice => {
          if (advice) {
            this.latestState.aiAdvice = advice;
            this.emit('update', this.latestState);
          }
        });
      }
    }

    if (this.latestState.battle && this.latestState.battle.enemy) {
      this.lastBattleEnemy = `${this.latestState.battle.enemy.name} (Lv. ${this.latestState.battle.enemy.level})`;
    }

    // =========================================================================
    // 8. EFEITOS DE CAMPO, ITENS DE ROTA E ANÁLISE DE REPEL DA MEMÓRIA RAM
    // =========================================================================
    const currentParty = this.latestState.party || [];
    const leadMon = currentParty.length > 0 ? currentParty[0] : null;
    const leadLevel = leadMon ? (leadMon.level || 1) : 0;
    const leadName = leadMon ? leadMon.name : 'Nenhum';

    const currentInv = this.latestState.inventory || [];
    const repelItem = currentInv.find(i => i.id === 30 || (i.name && i.name.toLowerCase() === 'repel'));
    const superRepelItem = currentInv.find(i => i.id === 56 || (i.name && i.name.toLowerCase().includes('super repel')));
    const maxRepelItem = currentInv.find(i => i.id === 57 || (i.name && i.name.toLowerCase().includes('max repel')));
    const escapeRopeItem = currentInv.find(i => i.id === 29 || (i.name && i.name.toLowerCase().includes('escape rope')));
    const bicycleItem = currentInv.find(i => i.id === 6 || (i.name && i.name.toLowerCase().includes('bicycle')));

    const repelsInBag = {
      regular: repelItem ? repelItem.qty : 0,
      super: superRepelItem ? superRepelItem.qty : 0,
      max: maxRepelItem ? maxRepelItem.qty : 0,
      total: (repelItem ? repelItem.qty : 0) + (superRepelItem ? superRepelItem.qty : 0) + (maxRepelItem ? maxRepelItem.qty : 0)
    };

    const slotChances = [51, 51, 39, 25, 25, 25, 13, 13, 11, 3].map(n => n * 100 / 256);
    let totalEncounterWeight = 0;
    let blockedEncounterWeight = 0;
    const blockedSlots = [];
    const bypassSlots = [];
    let hasWildEncounters = false;

    if (wildGrassRaw && wildGrassRaw.length >= 21) {
      const grassRate = parseInt(wildGrassRaw[0], 16);
      if (grassRate > 0) {
        hasWildEncounters = true;
        for (let s = 0; s < 10; s++) {
          const lv = parseInt(wildGrassRaw[1 + s * 2], 16);
          const spId = parseInt(wildGrassRaw[2 + s * 2], 16);
          const chance = slotChances[s] || 0;
          if (spId && spId !== 0xFF && this.getPokemonInfo(spId)) {
            const pName = this.getPokemonInfo(spId).name;
            const pDex = this.getPokemonInfo(spId).dex;
            totalEncounterWeight += chance;
            // Na Gen 1: Repel bloqueia se e só se wild_level < lead_level
            if (leadLevel > 0 && lv < leadLevel) {
              blockedEncounterWeight += chance;
              const existing = blockedSlots.find(b => b.name === pName && b.level === lv);
              if (existing) {
                existing.chance += chance;
              } else {
                blockedSlots.push({ name: pName, dex: pDex, level: lv, chance });
              }
            } else {
              const existing = bypassSlots.find(b => b.name === pName && b.level === lv);
              if (existing) {
                existing.chance += chance;
              } else {
                bypassSlots.push({ name: pName, dex: pDex, level: lv, chance });
              }
            }
          }
        }
      }
    }

    let efficiencyPercent = null;
    let efficiencyLabel = 'Sem relva / encontros';
    if (hasWildEncounters && totalEncounterWeight > 0) {
      efficiencyPercent = Math.round((blockedEncounterWeight / totalEncounterWeight) * 100);
      efficiencyLabel = `${efficiencyPercent}% bloqueados`;
    }

    const currentMapLower = (this.latestState.mapName || '').toLowerCase();
    const isDungeon = /cave|tunnel|mt|forest|hideout|tower|mansion|islands|safari/.test(currentMapLower);

    this.latestState.fieldItemsStatus = {
      repel: {
        stepsRemaining: this.latestState.repelSteps || 0,
        isActive: (this.latestState.repelSteps || 0) > 0,
        leadLevel,
        leadName,
        thresholdText: leadLevel > 0 ? `< Nv. ${leadLevel} (${leadName})` : 'Sem líder',
        hasWildEncounters,
        efficiencyPercent,
        efficiencyLabel,
        blockedSlots,
        bypassSlots,
        inBag: repelsInBag
      },
      movement: {
        mode: this.latestState.movementMode || '🚶 A Pé',
        rawState: typeof walkBikeSurf !== 'undefined' ? walkBikeSurf : 0,
        isBiking: (typeof walkBikeSurf !== 'undefined' ? walkBikeSurf : 0) === 1,
        isSurfing: (typeof walkBikeSurf !== 'undefined' ? walkBikeSurf : 0) === 2,
        hasBicycle: !!bicycleItem
      },
      escapeRope: {
        count: escapeRopeItem ? escapeRopeItem.qty : 0,
        isUsableHere: isDungeon
      }
    };

    // A VRAM é recolhida em segundo plano para todos os mapas, sem bloquear a leitura principal.
    // Amostragem da VRAM a 4 Hz; o canvas do mapa completo é redesenhado a 60 Hz.
    const nowVideo = Date.now();
    if (!this.videoReadInProgress && nowVideo - this.lastVideoReadAt >= 250) {
      this.lastVideoReadAt = nowVideo;
      this.videoReadInProgress = true;
      (async () => {
        try {
          const [tilePatterns, bgTileMap, regs, oam] = await Promise.all([
            this.readMemoryBlock('8000', 6144),
            this.readMemoryBlock('9800', 1024),
            this.readMemoryBlock('FF40', 12),
            this.readMemoryBlock('FE00', 160)
          ]);
          if (tilePatterns && tilePatterns.length >= 6144 &&
              bgTileMap && bgTileMap.length >= 1024 && regs && regs.length >= 8) {
            const bytes = a => a.map(v => typeof v === 'string' ? parseInt(v, 16) : Number(v));
            const r = bytes(regs);
            this.latestState.videoMemory = {
              tilePatterns: bytes(tilePatterns),
              bgTileMap: bytes(bgTileMap),
              lcdc: r[0] || 0,
              scrollY: r[2] || 0,
              scrollX: r[3] || 0,
              bgPalette: r[7] === undefined ? 0xE4 : r[7],
              obp0: r[8] === undefined ? 0xE4 : r[8],
              obp1: r[9] === undefined ? 0xE4 : r[9],
              oam: oam && oam.length >= 160 ? bytes(oam) : []
            };
            this.emit('update', this.latestState);
          }
        } catch (e) {
          // Falha de VRAM não deve interromper a telemetria normal.
        } finally {
          this.videoReadInProgress = false;
        }
      })();
    }

    // Síntese global para qualquer mapa normal da ROM, atualizada a cada leitura.
    // Só as flags comprovadas são conclusivas; não inferir scripts concluídos.
    if (this.activeRomProfile) {
      const sha=this.activeRomProfile.hash?.sha256;
      if (this._warpGraphSha!==sha || !this._warpGraph) {
        this._warpGraph=buildWarpGraph(this.activeRomProfile);
        this._warpGraphSha=sha;
      }
      this.latestState.romWarpGraph=this._warpGraph;
    } else {
      this._warpGraph=null;
      this._warpGraphSha=null;
      this.latestState.romWarpGraph={verified:false,reason:'ROM não identificada'};
    }
    this.latestState.globalCampaignLedger=buildCampaignLedger({
      profile:this.activeRomProfile,
      romIdentityMatched:this.latestState.romRuntimeIdentity?.matched===true,
      mapWindowVerified:mapConfirmation.verified===true&&
        positionWindow.verified===true,
      eventFlagsHex:eventFlagsRaw,
      hiddenItemHex:hiddenRaw,
      hiddenCoinHex:hiddenCoinsRaw
    });
    this.latestState.worldAdvisor=adviseWorld({
      profile:this.activeRomProfile,
      mapId:this.latestState.mapId,
      position:this.latestState.coords,
      positionVerified:positionWindow.verified===true,
      areaEvidence:this.latestState.romAreaEvidence,
      hiddenItems:this.latestState.romHiddenItems?.items||[],
      hiddenCoins:this.latestState.romHiddenCoins?.coins||[],
      trainers:[],
      warpGraph:this.latestState.romWarpGraph,
      itemAccess:this.latestState.romItemAccess,
      itemAccessInputs:accessInput,
      hiddenStartIndex:allVisItems.length+extraRomItems.length,
      hiddenFlagsVerified:this.latestState.romHiddenItems?.verified===true,
      coinFlagsVerified:this.latestState.romHiddenCoins?.verified===true,
      trainerFlagsVerified:this.latestState.romTrainerFlags?.verified===true&&
        this.latestState.romAreaEvidence?.trainerEventRamVerified===true
    });
    this.persistState(this.latestState);
    this.emit('update', this.latestState);
  }
}

module.exports = RetroArchClient;
