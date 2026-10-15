const fs = require('fs');
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
  analyzeBattle
} = require('./data/pokemonData');
const { getAreaInfo, getUpcomingBossTactics } = require('./data/areaData');
const { getLiveAdvice } = require('./aiAdvisor');

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
  1: { name: 'Red', type: 'player', icon: '🧢' },
  2: { name: 'Blue', type: 'rival', icon: '👦' },
  3: { name: 'Prof. Oak', type: 'npc', icon: '👴' },
  4: { name: 'Bug Catcher', type: 'trainer', icon: '🐛' },
  5: { name: 'Slowbro', type: 'pokemon', icon: '🦥' },
  6: { name: 'Lass / Treinadora', type: 'trainer', icon: '👧' },
  7: { name: 'Blackbelt', type: 'trainer', icon: '🥋' },
  8: { name: 'Boy / Rapaz', type: 'npc', icon: '👦' },
  9: { name: 'Fisherman', type: 'trainer', icon: '🎣' },
  10: { name: 'Cooltrainer (M)', type: 'trainer', icon: '👟' },
  11: { name: 'Cooltrainer (F)', type: 'trainer', icon: '👟' },
  12: { name: 'Beauty', type: 'trainer', icon: '💄' },
  13: { name: 'Swimmer', type: 'trainer', icon: '🏊' },
  14: { name: 'Biker', type: 'trainer', icon: '🏍️' },
  15: { name: 'Sailor', type: 'trainer', icon: '⚓' },
  16: { name: 'Cook', type: 'npc', icon: '🍳' },
  17: { name: 'Bike Shop Clerk', type: 'npc', icon: '🚲' },
  18: { name: 'Mr. Fuji', type: 'npc', icon: '🧙' },
  19: { name: 'Giovanni', type: 'boss', icon: '👔' },
  20: { name: 'Rocket (Grunt)', type: 'trainer', icon: '🚀' },
  21: { name: 'Channeler', type: 'trainer', icon: '👻' },
  22: { name: 'Waiter', type: 'npc', icon: '☕' },
  23: { name: 'Silph Worker (F)', type: 'npc', icon: '👩‍💼' },
  24: { name: 'Middle-Aged Woman', type: 'npc', icon: '👩' },
  25: { name: 'Scientist', type: 'trainer', icon: '🔬' },
  26: { name: 'Rock / Bloco (Strength)', type: 'boulder', icon: '🪨' },
  27: { name: 'Boulder / Pedra', type: 'boulder', icon: '🪨' },
  28: { name: 'Pokédex / Livro', type: 'object', icon: '📖' },
  29: { name: 'Map / Carta', type: 'object', icon: '🗺️' },
  30: { name: 'Clefairy', type: 'pokemon', icon: '⭐' },
  31: { name: 'Bird / Pássaro', type: 'pokemon', icon: '🐦' },
  32: { name: 'Seel', type: 'pokemon', icon: '🦭' },
  33: { name: 'Gym Guide / Árbitro', type: 'npc', icon: '📢' },
  34: { name: 'Gramps / Velhinho', type: 'npc', icon: '👴' },
  35: { name: 'Old Woman / Velhinha', type: 'npc', icon: '👵' },
  36: { name: 'Nurse Joy', type: 'npc', icon: '👩‍⚕️' },
  37: { name: 'Cable Club Woman', type: 'npc', icon: '👩' },
  38: { name: 'Balconista / Clerk', type: 'npc', icon: '🛒' },
  39: { name: 'Super Nerd', type: 'trainer', icon: '🤓' },
  40: { name: 'Hiker / Montanhista', type: 'trainer', icon: '🧗' },
  41: { name: 'Gambler', type: 'trainer', icon: '🎲' },
  42: { name: 'Fat Bald Guy', type: 'npc', icon: '🧔' },
  43: { name: 'Little Girl / Menina', type: 'npc', icon: '👧' },
  44: { name: 'Fat Guy', type: 'npc', icon: '🧔' },
  45: { name: 'Old Amber / Fóssil', type: 'item', icon: '💎' },
  46: { name: 'Old Amber', type: 'item', icon: '💎' },
  47: { name: 'Dome Fossil', type: 'item', icon: '🐚' },
  48: { name: 'Helix Fossil', type: 'item', icon: '🐚' },
  49: { name: 'Snorlax', type: 'pokemon', icon: '💤' },
  50: { name: 'Town Map', type: 'object', icon: '🗺️' },
  51: { name: 'Book / Caderno', type: 'object', icon: '📖' },
  60: { name: 'Item no Chão (Poké Ball)', type: 'item', icon: '🎒' },
  61: { name: 'Item no Chão (Poké Ball)', type: 'item', icon: '🎒' },
  62: { name: 'Clip / Nota', type: 'object', icon: '📋' }
};

function getPokemonSpriteUrl(name, dex) {
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

    this.latestState = {
      connected: false,
      lastUpdate: null,
      romValidation: 'Pokémon Red (USA/Europe) - Game Boy SGB Enhanced (Gen 1)',
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
      battle: null,
      aiAdvice: 'A sincronizar com a memória do Game Boy...'
    };

    this.lastBattleKey = null;
    this.pendingResolves = new Map();
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
      this.handleResponse(msg.toString().trim(), rinfo);
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

  normalizeResponseKey(command, address) {
    const cmd = String(command || '').trim().toUpperCase();
    const rawAddress = String(address || '').trim().replace(/^0X/i, '');
    const parsedAddress = Number.parseInt(rawAddress, 16);
    const normalizedAddress = Number.isFinite(parsedAddress)
      ? parsedAddress.toString(16).toUpperCase()
      : rawAddress.toUpperCase();
    return `${cmd} ${normalizedAddress}`;
  }

  sendRaw(cmd) {
    return new Promise((resolve) => {
      if (!this.socket) return resolve(null);

      const parts = cmd.trim().split(/\s+/);
      const key = this.normalizeResponseKey(parts[0], parts[1]);
      let settled = false;

      // O RetroArch pode demorar a responder a leituras grandes de RAM.
      // Um prazo curto de 400 ms fazia perder respostas válidas em alguns ciclos.
      const timeout = setTimeout(() => {
        if (this.pendingResolves.get(key) === finish) {
          this.pendingResolves.delete(key);
        }
        finish(null);
      }, 1200);

      const finish = (data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(data);
      };

      this.pendingResolves.set(key, finish);

      const buf = Buffer.from(cmd + '\n');
      this.socket.send(buf, 0, buf.length, this.port, this.ip, (err) => {
        if (err) {
          if (this.pendingResolves.get(key) === finish) this.pendingResolves.delete(key);
          finish(null);
        }
      });
    });
  }

  handleResponse(str, rinfo) {
    const parts = String(str || '').trim().split(/\s+/);
    if (parts.length < 2) return;

    const key = this.normalizeResponseKey(parts[0], parts[1]);
    const cb = this.pendingResolves.get(key);
    if (cb) {
      this.pendingResolves.delete(key);
      cb(parts.slice(2));
      return;
    }

    // Se houver resposta UDP mas não corresponder ao pedido, registar o formato
    // recebido para podermos corrigir o parser sem alterar IPs/portas do utilizador.
    const now = Date.now();
    if (!this.lastUnmatchedUdpLogAt || now - this.lastUnmatchedUdpLogAt >= 2000) {
      this.lastUnmatchedUdpLogAt = now;
      console.warn('[RetroArchClient] Resposta UDP sem pedido correspondente:', JSON.stringify({
        response: String(str || '').slice(0, 180),
        from: rinfo ? `${rinfo.address}:${rinfo.port}` : null,
        pending: Array.from(this.pendingResolves.keys()).slice(0, 5)
      }));
    }
  }

  // Leitura Exaustiva de Blocos de Memória Contíguos
  async readMemoryBlock(startAddrHex, length) {
    const CHUNK_SIZE = 160;
    const startAddr = parseInt(startAddrHex, 16);
    const chunks = [];
    for (let offset = 0; offset < length; offset += CHUNK_SIZE) {
      const curAddrHex = (startAddr + offset).toString(16).toUpperCase();
      const curLen = Math.min(CHUNK_SIZE, length - offset);
      chunks.push({ addr: curAddrHex, len: curLen });
    }

    const allBytes = [];
    for (const c of chunks) {
      let res = await this.sendRaw(`READ_CORE_MEMORY ${c.addr} ${c.len}`);
      if (!res) {
        // Tentativa de recuperação caso o pacote UDP sofra jitter
        res = await this.sendRaw(`READ_CORE_MEMORY ${c.addr} ${c.len}`);
      }
      if (!res) return null;
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

  async fetchGameState() {
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

    this.latestState.connected = true;
    this.latestState.lastUpdate = new Date().toISOString();

    // BLOCO 2: Mundo, Eventos (320 bytes), Itens Ocultos, Fauna Selvagem e Equipa Inimiga ($D5A0..$D8AF, 784 bytes)
    const blockWorldEvents = await this.readMemoryBlock('D5A0', 784);

    // BLOCO 3: Tempo de Jogo e Caixa do PC ($DA40..$DAFF, 192 bytes)
    const blockBoxTime = await this.readMemoryBlock('DA40', 192);

    // BLOCO 4: Sprites e Entidades no Overworld ($C100..$C2FF, 512 bytes)
    const blockSprites = await this.readMemoryBlock('C100', 512);

    // BLOCO 5: Screen Tilemap Completo 20x18 ($C3A0..$C507, 360 bytes)
    const blockTilemap = await this.readMemoryBlock('C3A0', 360);

    // =========================================================================
    // 1. DESCODIFICAÇÃO DO BLOCO DO JOGADOR, EQUIPA E MOCHILA (BLOCO 1 - $D158)
    // =========================================================================
    // Nome do Treinador ($D158, 11 bytes)
    const trainerName = decodeGen1Text(blockPlayerParty.slice(0, 11)) || 'RED';
    this.latestState.trainerName = trainerName;

    // Número de Pokémon na Equipa ($D163, offset 11)
    let partyCount = parseInt(blockPlayerParty[11], 16) || 0;
    if (partyCount > 6) partyCount = 6;
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

      const pkInfo = INTERNAL_TO_POKEMON[speciesId] || { name: `Pokémon #${speciesId}`, dex: 0, types: ['Normal'] };
      const displayName = nickname && nickname !== pkInfo.name.toUpperCase() ? `${nickname} (${pkInfo.name})` : pkInfo.name;

      const moveList = moves.map((mId, mIdx) => {
        if (!mId) return null;
        const mData = MOVES[mId] || { name: `Golpe #${mId}`, type: 'Normal', power: 40, acc: 100, pp: 20 };
        return {
          id: mId,
          name: mData.name,
          type: mData.type,
          power: mData.power,
          accuracy: mData.acc,
          pp: pp[mIdx] !== undefined ? pp[mIdx] : 10,
          maxPp: mData.pp || 20
        };
      }).filter(Boolean);

      const expProgress = calculateExpProgress(level, exp, pkInfo.dex);

      party.push({
        partyIndex: i,
        speciesId,
        name: displayName,
        rawName: pkInfo.name,
        nickname,
        otName,
        dex: pkInfo.dex,
        types: pkInfo.types,
        hp,
        maxHp: maxHp || hp,
        level: level || 1,
        status: statusVal === 0 ? 'HEALTHY' : (statusVal & 0x7 ? 'SLEEP' : (statusVal & 0x8 ? 'POISON' : (statusVal & 0x40 ? 'PARALYSIS' : 'BURN'))),
        stats: { attack, defense, speed, special },
        statExp: { hp: hpExp, attack: atkExp, defense: defExp, speed: spdExp, special: spcExp },
        dvs: { hp: hpDv, attack: atkDv, defense: defDv, speed: spdDv, special: spcDv },
        exp: expProgress,
        moves: moveList,
        spriteUrl: getPokemonSpriteUrl(pkInfo.name, pkInfo.dex),
        artworkUrl: pkInfo.dex ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkInfo.dex}.png` : ''
      });
    }
    this.latestState.party = party;

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

    // =========================================================================
    // 2. DESCODIFICAÇÃO DO BLOCO DO MUNDO E EVENTOS (BLOCO 2 - $D5A0)
    // =========================================================================
    let eventFlagsRaw = [];
    let wildGrassRaw = [];
    let enemyPartyRaw = [];
    let toggleRaw = [];
    let hiddenRaw = [];

    if (blockWorldEvents && blockWorldEvents.length >= 784) {
      // Caixa do PC Atual ($D5A0, offset 0)
      const currentBoxNum = (parseInt(blockWorldEvents[0], 16) & 0x7F) + 1;

      // Moedas do Casino ($D5A4, offset 4..5)
      this.latestState.coins = decodeBcdMoney(0, parseInt(blockWorldEvents[4], 16), parseInt(blockWorldEvents[5], 16));

      // Itens no chão / Entidades Missable ($D5A6, offset 6..37, 32 bytes)
      toggleRaw = blockWorldEvents.slice(6, 38);

      // Itens Ocultos ($D6F0, offset 336..343, 8 bytes)
      hiddenRaw = blockWorldEvents.slice(336, 344);

      // Modo de Deslocação ($D700, offset 352: 0 = Pé, 1 = Bicicleta, 2 = Surf)
      const walkBikeSurf = parseInt(blockWorldEvents[352], 16) || 0;
      this.latestState.movementMode = walkBikeSurf === 1 ? '🚲 Bicicleta' : walkBikeSurf === 2 ? '🌊 A Surfar' : '🚶 A Pé';

      // EVENT FLAGS COMPLETAS ($D747, offset 423..742 = 320 BYTES = 2,560 EVENT BITS!)
      eventFlagsRaw = blockWorldEvents.slice(423, 743);

      // WILD GRASS ENCOUNTERS DA ÁREA ($D887, offset 743..763, 21 bytes)
      wildGrassRaw = blockWorldEvents.slice(743, 764);

      // EQUIPA INIMIGA COMPLETA DO TREINADOR ($D89C, offset 764..771, 7 bytes)
      enemyPartyRaw = blockWorldEvents.slice(764, 772);
    }

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

    // =========================================================================
    // 3. DESCODIFICAÇÃO DO BLOCO DE TEMPO E PC BOX (BLOCO 3 - $DA40)
    // =========================================================================
    let boxCount = 0;
    if (blockBoxTime && blockBoxTime.length >= 100) {
      const hours = (parseInt(blockBoxTime[0], 16) << 8) | parseInt(blockBoxTime[1], 16);
      const minutes = parseInt(blockBoxTime[2], 16);
      const seconds = parseInt(blockBoxTime[3], 16);
      this.latestState.playTime = `${hours}h ${minutes}m ${seconds}s`;

      boxCount = parseInt(blockBoxTime[64], 16) || 0;
      const boxSpecies = [];
      for (let i = 0; i < Math.min(boxCount, 20); i++) {
        const spId = parseInt(blockBoxTime[65 + i], 16);
        if (spId === 0xFF || !spId) break;
        const pk = INTERNAL_TO_POKEMON[spId] || { name: `Pokémon #${spId}`, dex: 0 };
        boxSpecies.push({ speciesId: spId, name: pk.name, dex: pk.dex });
      }
      const currentBoxNum = (blockWorldEvents && blockWorldEvents[0]) ? ((parseInt(blockWorldEvents[0], 16) & 0x7F) + 1) : 1;
      this.latestState.pcBox = {
        boxNum: currentBoxNum,
        count: boxCount,
        freeSlots: Math.max(0, 20 - boxCount),
        pokemon: boxSpecies
      };
    }

    // Total de Pokémon Individuais Atuais (Equipa + PC)
    this.latestState.totalPokemonOwned = partyCount + boxCount;

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
          const isItem = [45, 46, 47, 48, 60, 61].includes(picId) || sprInfo.type === 'item';

          mapEntities.push({
            spriteIndex: s,
            pictureId: picId,
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

      if (onScreenDialog && onScreenDialog.length > 1) {
        this.latestState.currentDialog = onScreenDialog;
        if (!this.latestState.dialogHistory) this.latestState.dialogHistory = [];
        const isDuplicate = this.latestState.dialogHistory.length > 0 && this.latestState.dialogHistory[0].text === onScreenDialog;
        if (!isDuplicate) {
          const time = new Date().toLocaleTimeString('pt-PT');
          this.latestState.dialogHistory.unshift({ time, text: onScreenDialog });
          if (this.latestState.dialogHistory.length > 20) {
            this.latestState.dialogHistory.pop();
          }
        }
      }
    }

    // =========================================================================
    // 6. FAUNA SELVAGEM CARREGADA NA RAM DA ÁREA ATUAL ($D887)
    // =========================================================================
    const areaData = getAreaInfo(this.latestState.mapId, this.latestState.coords);
    const partyDexList = (this.latestState.party || []).map(p => p.dex);
    const inventoryNames = (this.latestState.inventory || []).map(i => i.name.toUpperCase());

    let effectiveWild = [];
    if (!areaData.isWestRoute4 && wildGrassRaw && wildGrassRaw.length >= 21) {
      const grassRate = parseInt(wildGrassRaw[0], 16);
      if (grassRate > 0) {
        const slotChances = [20, 20, 15, 10, 10, 10, 5, 5, 4, 1];
        const speciesMap = {};
        for (let s = 0; s < 10; s++) {
          const lv = parseInt(wildGrassRaw[1 + s * 2], 16);
          const spId = parseInt(wildGrassRaw[2 + s * 2], 16);
          if (spId && spId !== 0xFF && INTERNAL_TO_POKEMON[spId]) {
            const pInfo = INTERNAL_TO_POKEMON[spId];
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

    if (effectiveWild.length === 0 && !areaData.isWestRoute4) {
      effectiveWild = areaData.wild || [];
    }

    // Itens Ocultos e Radar de Itemfinder
    const hiddenList = (areaData.hiddenItems || []).map(item => {
      let isCollected = false;
      if (item.hiddenIndex !== undefined && hiddenRaw && hiddenRaw.length >= 7) {
        const b = Math.floor(item.hiddenIndex / 8);
        const bit = item.hiddenIndex % 8;
        const val = parseInt(hiddenRaw[b], 16);
        isCollected = (val & (1 << bit)) !== 0;
      }
      return {
        ...item,
        isCollected,
        inInventory: inventoryNames.some(invName => item.name.toUpperCase().includes(invName) || invName.includes(item.name.toUpperCase()))
      };
    });

    let itemfinderRadar = null;
    if (this.latestState.coords) {
      const px = this.latestState.coords.x;
      const py = this.latestState.coords.y;
      const uncollectedHidden = hiddenList.filter(h => !h.isCollected && h.x !== undefined && h.y !== undefined);
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
    const hasCut = hasCascadeBadge && (hasCutInParty || inventoryNames.includes('HM01'));
    const hasSurf = hasSoulBadge && inventoryNames.includes('HM03');
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
      let isCollected = false;
      if (item.toggleIndex !== undefined && toggleRaw && toggleRaw.length >= 32) {
        const b = Math.floor(item.toggleIndex / 8);
        const bit = item.toggleIndex % 8;
        const val = parseInt(toggleRaw[b], 16);
        isCollected = (val & (1 << bit)) !== 0;
      }
      const accInfo = checkAccessibility(item);
      const compass = getCompass(this.latestState.coords, item.x, item.y);
      return {
        ...item,
        isCollected,
        inInventory: inventoryNames.some(invName => item.name.toUpperCase().includes(invName) || invName.includes(item.name.toUpperCase())),
        isLocked: !accInfo.accessible,
        lockReason: accInfo.reason,
        compass
      };
    });

    const allHiddenItems = hiddenList.map(item => {
      const accInfo = checkAccessibility(item);
      const compass = getCompass(this.latestState.coords, item.x, item.y);
      return {
        ...item,
        isLocked: !accInfo.accessible,
        lockReason: accInfo.reason,
        compass
      };
    });

    const allNpcItems = (areaData.npcItems || []).map(item => {
      const accInfo = checkAccessibility(item);
      const compass = getCompass(this.latestState.coords, item.x, item.y);
      return {
        ...item,
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
      });
    }

    this.latestState.areaInfo = {
      name: areaData.name,
      wild: effectiveWild.map(w => ({
        ...w,
        isCaughtInDex: ownedDexSet.has(w.dex),
        isInParty: partyDexList.includes(w.dex)
      })),
      npcTrades: (areaData.npcTrades || []).map(t => ({
        ...t,
        isCaughtInDex: ownedDexSet.has(t.dex),
        isInParty: partyDexList.includes(t.dex)
      })),
      npcGifts: (areaData.npcGifts || []).map(g => ({
        ...g,
        isCaughtInDex: ownedDexSet.has(g.dex),
        isInParty: partyDexList.includes(g.dex),
        compass: getCompass(this.latestState.coords, g.x, g.y)
      })),
      npcItems: allNpcItems.filter(i => !i.isLocked),
      lockedNpcItems: allNpcItems.filter(i => i.isLocked),
      visibleItems: allVisItems.filter(i => !i.isLocked),
      hiddenItems: allHiddenItems.filter(i => !i.isLocked),
      lockedItems: [...allVisItems.filter(i => i.isLocked), ...allHiddenItems.filter(i => i.isLocked)],
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
        } else {
          // Procura correspondência com treinadores conhecidos da área
          const matchedBt = battles.find(bt => Math.abs(bt.x - ent.x) <= 2 && Math.abs(bt.y - ent.y) <= 2);
          if (matchedBt) {
            ent.isTrainer = true;
            ent.trainerName = matchedBt.name;
            ent.name = `⚔️ ${matchedBt.name}`;
            ent.enemyRoster = matchedBt.enemyRoster;
            ent.optimalLead = matchedBt.optimalLead;
            ent.isDefeated = matchedBt.isDefeated;
            ent.statusLabel = matchedBt.statusLabel;
            ent.difficulty = matchedBt.difficulty;
          }
        }
      });
    }

    // =========================================================================
    // 7. LEITURA EXAUSTIVA DE COMBATE E BATALHA (BLOCOS $CFE0 E $CC20)
    // =========================================================================
    const blockCombat = await this.readMemoryBlock('CFE0', 255);
    const blockBattleMods = await this.readMemoryBlock('CC20', 280);

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
        rawBattleFlag: blockCombat && blockCombat.length > 119 ? blockCombat[119] : null,
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

    if (blockCombat && blockCombat.length >= 255) {
      const rawBattleFlag = blockCombat[119];
      const inBattleVal = Number.parseInt(rawBattleFlag, 16);
      if (!this.isSimulatingBattle) {
        inBattle = inBattleVal === 1 || inBattleVal === 2;
        battleType = inBattleVal === 1 ? 'Wild' : inBattleVal === 2 ? 'Trainer' : 'None';
        this.latestState.inBattle = inBattle;
        this.latestState.battleType = battleType;
      }
    }

    const isDialog = this.latestState.currentDialog && this.latestState.currentDialog.length > 0;
    if (this.latestState.inBattle) {
      this.latestState.playerMode = `⚔️ Em Combate (${this.latestState.battleType === 'Trainer' ? 'Treinador' : 'Selvagem'})`;
    } else if (isDialog) {
      this.latestState.playerMode = '💬 Em Diálogo / Menu / Evento';
    } else {
      this.latestState.playerMode = `🗺️ Exploração Livre (${this.latestState.movementMode || 'A Pé'})`;
    }

    if (this.latestState.inBattle && !this.isSimulatingBattle && blockCombat && blockBattleMods) {
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

      const eInfo = INTERNAL_TO_POKEMON[eSpecies] || { name: `Inimigo #${eSpecies}`, dex: 0, types: ['Normal'], baseHp: 30 };

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
        return (INTERNAL_TO_POKEMON[id] || { name: `Pokémon #${id}` }).name;
      }) : [];

      const enemyMon = {
        speciesId: eSpecies,
        name: eInfo.name,
        dex: eInfo.dex,
        types: eInfo.types,
        hp: eHp,
        maxHp: eMaxHp || eHp || eInfo.baseHp || 20,
        level: eLevel || 5,
        catchRate: parseInt(blockCombat[12], 16) || 150,
        baseStats: { spd: eInfo.baseSpeed || 50 },
        stats: { attack: eAttack || 20, defense: eDefense || 20, speed: eSpeed || 20, special: eSpecial || 20 },
        statMods: eMods,
        spriteUrl: getPokemonSpriteUrl(eInfo.name, eInfo.dex),
        moves: eMoves.map((m, idx) => {
          if (!m || !MOVES[m]) return null;
          return {
            id: m,
            name: MOVES[m].name,
            type: MOVES[m].type,
            power: MOVES[m].power,
            accuracy: MOVES[m].acc,
            pp: ePPs[idx] !== undefined ? ePPs[idx] : (MOVES[m].pp || 20)
          };
        }).filter(Boolean)
      };

      // Pokémon Ativo do Jogador ($D014, offset 52 de blockCombat)
      const bSpecies = parseInt(blockCombat[52], 16);
      const bHp = (parseInt(blockCombat[53], 16) << 8) | parseInt(blockCombat[54], 16);
      const bStatusVal = parseInt(blockCombat[56], 16);
      const bMoves = [
        parseInt(blockCombat[60], 16),
        parseInt(blockCombat[61], 16),
        parseInt(blockCombat[62], 16),
        parseInt(blockCombat[63], 16)
      ];
      const bLevel = parseInt(blockCombat[66], 16);
      const bMaxHp = (parseInt(blockCombat[67], 16) << 8) | parseInt(blockCombat[68], 16);
      const bAttack = (parseInt(blockCombat[69], 16) << 8) | parseInt(blockCombat[70], 16);
      const bDefense = (parseInt(blockCombat[71], 16) << 8) | parseInt(blockCombat[72], 16);
      const bSpeed = (parseInt(blockCombat[73], 16) << 8) | parseInt(blockCombat[74], 16);
      const bSpecial = (parseInt(blockCombat[75], 16) << 8) | parseInt(blockCombat[76], 16);
      const bPPs = [
        parseInt(blockCombat[77], 16),
        parseInt(blockCombat[78], 16),
        parseInt(blockCombat[79], 16),
        parseInt(blockCombat[80], 16)
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

      const pInfo = INTERNAL_TO_POKEMON[bSpecies] || { name: `Pokémon #${bSpecies}`, dex: 0, types: ['Normal'] };
      const partyMon = (this.latestState.party && this.latestState.party[realPartyPos]) ? this.latestState.party[realPartyPos] : null;

      const moveList = bMoves.map((mId, mIdx) => {
        if (!mId) return null;
        const mData = MOVES[mId] || { name: `Golpe #${mId}`, type: 'Normal', power: 40, acc: 100, pp: 20 };
        const currentLivePP = (partyMon && partyMon.moves && partyMon.moves[mIdx]) ? partyMon.moves[mIdx].pp : (bPPs[mIdx] !== undefined ? bPPs[mIdx] : 10);
        return {
          id: mId,
          name: mData.name,
          type: mData.type,
          power: mData.power,
          accuracy: mData.acc,
          pp: currentLivePP,
          maxPp: mData.pp || 20
        };
      }).filter(Boolean);

      const activeMon = {
        speciesId: bSpecies,
        name: partyMon ? partyMon.name : pInfo.name,
        rawName: pInfo.name,
        dex: pInfo.dex,
        types: pInfo.types,
        hp: bHp,
        maxHp: bMaxHp || bHp || 20,
        level: bLevel || 5,
        partyPos: realPartyPos,
        status: bStatusVal === 0 ? 'HEALTHY' : (bStatusVal & 0x7 ? 'SLEEP' : (bStatusVal & 0x8 ? 'POISON' : (bStatusVal & 0x40 ? 'PARALYSIS' : 'BURN'))),
        stats: { attack: bAttack, defense: bDefense, speed: bSpeed, special: bSpecial },
        statMods: pMods,
        moves: moveList,
        spriteUrl: getPokemonSpriteUrl(pInfo.name, pInfo.dex),
        artworkUrl: pInfo.dex ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pInfo.dex}.png` : ''
      };

      const strategy = analyzeBattle(
        activeMon,
        enemyMon,
        this.latestState.battleType === 'Wild',
        this.latestState.badges || [],
        this.latestState.inventory || [],
        this.latestState.party || []
      );

      const currentTurn = parseInt(blockBattleMods[181], 16) || 1;
      const lastPlayerMove = MOVES[parseInt(blockBattleMods[188], 16)] ? MOVES[parseInt(blockBattleMods[188], 16)].name : null;
      const lastEnemyMove = MOVES[parseInt(blockBattleMods[189], 16)] ? MOVES[parseInt(blockBattleMods[189], 16)].name : null;

      this.latestState.battle = {
        enemy: enemyMon,
        playerActive: activeMon,
        turn: currentTurn,
        lastPlayerMove,
        lastEnemyMove,
        strategy,
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
        this.lastBattleKey = currentBattleKey;
        getLiveAdvice(this.latestState).then(advice => {
          if (advice) {
            this.latestState.aiAdvice = advice;
            this.emit('update', this.latestState);
          }
        });
      }
    }

    // Só registar o fim quando há transição de combate para exploração.
    if (!this.latestState.inBattle && this.wasInBattle) {
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

    this.emit('update', this.latestState);
  }
}

module.exports = RetroArchClient;
