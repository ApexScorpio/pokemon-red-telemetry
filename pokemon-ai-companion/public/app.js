// PokéVision AI Cockpit Client • Pokémon Red Live Companion
let socket = null;
let lastState = null;
let voiceEnabled = false;
let lastSpokenText = '';
let currentCenterTab = 'radar'; // 'battle' ou 'radar'
let userManuallyChoseCenterTab = false;
let isAreaBattlesDrawerOpen = false;

// Elementos DOM HUD
const elConnectionStatus = document.getElementById('connection-status');
const elConnectionPulse = document.getElementById('connection-pulse');
const elCurrentLocation = document.getElementById('current-location');
const elCurrentMoney = document.getElementById('current-money');
const elTrainerNameTag = document.getElementById('trainer-name-tag');
const elBadgesContainer = document.getElementById('badges-container');
const elPlayerCoordsTag = document.getElementById('player-coords-tag');
const elRepelPill = document.getElementById('repel-pill');
const elRepelStepsText = document.getElementById('repel-steps-text');

// Tabs Centrais
const btnTabBattle = document.getElementById('btn-tab-battle');
const btnTabRadar = document.getElementById('btn-tab-radar');
const elBattleIndicatorTag = document.getElementById('battle-indicator-tag');
const elViewBattle = document.getElementById('view-battle');
const elViewRadar = document.getElementById('view-radar');

// Mobile Nav Bar
const mobileNavButtons = document.querySelectorAll('.mobile-nav-btn');
const elMobilePartyCount = document.getElementById('mobile-party-count');

// Mini-Mapa Tático com Névoa de Guerra
const canvasFog = document.getElementById('fog-minimap-canvas');
const ctxFog = canvasFog ? canvasFog.getContext('2d') : null;
const elMinimapTitle = document.getElementById('minimap-title');
const elMinimapStats = document.getElementById('minimap-stats');
const elMinimapCoordsOverlay = document.getElementById('minimap-coords-overlay');
const btnResetMap = document.getElementById('btn-reset-map');

// Memória de Azulejos Revelados por Mapa (Persistente em LocalStorage)
let exploredMaps = {};
try {
  const saved = localStorage.getItem('pokered_fog_maps');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.keys(parsed).forEach(k => {
      exploredMaps[k] = new Set(parsed[k]);
    });
  }
} catch (e) {}

function saveExploredMaps() {
  try {
    const toSave = {};
    Object.keys(exploredMaps).forEach(k => {
      toSave[k] = Array.from(exploredMaps[k]);
    });
    localStorage.setItem('pokered_fog_maps', JSON.stringify(toSave));
  } catch (e) {}
}

if (btnResetMap) {
  btnResetMap.addEventListener('click', () => {
    if (lastState && lastState.mapId !== undefined) {
      delete exploredMaps[lastState.mapId];
      saveExploredMaps();
      renderFogMinimap(lastState);
    }
  });
}

// Batalha
const elPlayerBattleName = document.getElementById('player-battle-name');
const elPlayerBattleLevel = document.getElementById('player-battle-level');
const elPlayerBattleSprite = document.getElementById('player-battle-sprite');
const elPlayerBattleHpText = document.getElementById('player-battle-hp-text');
const elPlayerBattleHpFill = document.getElementById('player-battle-hp-fill');
const elPlayerBattleTypes = document.getElementById('player-battle-types');
const elPlayerBattleMoves = document.getElementById('player-battle-moves');
const elPlayerStatMods = document.getElementById('player-stat-mods');

const elEnemyBattleName = document.getElementById('enemy-battle-name');
const elEnemyBattleLevel = document.getElementById('enemy-battle-level');
const elEnemyBattleSprite = document.getElementById('enemy-battle-sprite');
const elEnemyBattleHpText = document.getElementById('enemy-battle-hp-text');
const elEnemyBattleHpFill = document.getElementById('enemy-battle-hp-fill');
const elEnemyBattleTypes = document.getElementById('enemy-battle-types');
const elEnemyMovesList = document.getElementById('enemy-moves-list');
const elEnemyStatMods = document.getElementById('enemy-stat-mods');

const elMatchupRatingText = document.getElementById('matchup-rating-text');
const elRecMoveTitle = document.getElementById('rec-move-title');
const elRecMoveDesc = document.getElementById('rec-move-desc');
const elTacticalAlerts = document.getElementById('tactical-alerts');
const elCatchCalculator = document.getElementById('catch-calculator');
const elChancePokeball = document.getElementById('chance-pokeball');
const elChanceGreatball = document.getElementById('chance-greatball');
const elChanceUltraball = document.getElementById('chance-ultraball');

// Equipa & Mochila
const elPartyGrid = document.getElementById('party-grid');
const elPartyCountPill = document.getElementById('party-count-pill');
const elInventoryGrid = document.getElementById('inventory-grid');
const elInvCountPill = document.getElementById('inv-count-pill');

// Radar da Área
const elRadarWildCount = document.getElementById('radar-wild-count');
const elWildEncountersList = document.getElementById('wild-encounters-list');
const elAreaItemsList = document.getElementById('area-items-list');

// Modal Definições
const elSettingsModal = document.getElementById('settings-modal');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const cfgIphoneIp = document.getElementById('cfg-iphone-ip');
const cfgPort = document.getElementById('cfg-port');
const btnToggleTest = document.getElementById('btn-toggle-test');

// Configuração de Tabs Centrais (Combate vs Radar)
function switchCenterTab(mode) {
  currentCenterTab = mode;
  if (mode === 'battle') {
    btnTabBattle.classList.add('active');
    btnTabRadar.classList.remove('active');
    elViewBattle.style.display = 'flex';
    elViewRadar.style.display = 'none';
    if (lastState) {
      if (lastState.inBattle && lastState.battle) {
        renderBattle(lastState.battle, lastState.battleType);
      } else {
        renderBattleStandby(lastState);
      }
    }
  } else {
    btnTabRadar.classList.add('active');
    btnTabBattle.classList.remove('active');
    elViewRadar.style.display = 'flex';
    elViewBattle.style.display = 'none';
  }
}

btnTabBattle.addEventListener('click', () => {
  userManuallyChoseCenterTab = true;
  switchCenterTab('battle');
});

btnTabRadar.addEventListener('click', () => {
  userManuallyChoseCenterTab = true;
  switchCenterTab('radar');
});

// Configuração de Tabs Mobile (Combate/Radar, Equipa, Grok & Bag)
mobileNavButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    mobileNavButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const targetTabId = btn.getAttribute('data-tab');
    document.querySelectorAll('.cockpit-col').forEach(col => {
      col.classList.remove('tab-active');
    });

    const targetCol = document.getElementById(targetTabId);
    if (targetCol) {
      targetCol.classList.add('tab-active');
    }
  });
});

// Inicializa coluna ativa no mobile
const initialMobileCol = document.getElementById('tab-center');
if (initialMobileCol) initialMobileCol.classList.add('tab-active');

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    elConnectionStatus.textContent = 'LINK OK';
    elConnectionPulse.classList.add('active');
  };

  socket.onmessage = (event) => {
    try {
      const state = JSON.parse(event.data);
      renderState(state);
    } catch (err) {
      console.error('Erro ao ler estado do jogo:', err);
    }
  };

  socket.onclose = () => {
    elConnectionStatus.textContent = 'DESLIGADO';
    elConnectionPulse.classList.remove('active');
    setTimeout(connectWebSocket, 2000);
  };
}

// Renderização Principal do Cockpit
function renderState(state) {
  if (state.connected) {
    elConnectionStatus.textContent = 'LINK OK';
    elConnectionPulse.classList.add('active');
  } else {
    elConnectionStatus.textContent = 'A AGUARDAR';
    elConnectionPulse.classList.remove('active');
  }

  // Nome e Dinheiro
  if (state.trainerName) elTrainerNameTag.textContent = state.trainerName;
  if (state.money !== undefined) elCurrentMoney.textContent = `${state.money.toLocaleString()} ₽`;

  // Localização
  if (state.mapName) {
    elCurrentLocation.textContent = state.mapName;
  }

  // Coordenadas GPS da Game Boy
  if (state.coords) {
    elPlayerCoordsTag.textContent = `X:${state.coords.x} Y:${state.coords.y}`;
  }

  // Tempo de Jogo da RAM
  const elPlayTime = document.getElementById('hud-play-time');
  if (elPlayTime && state.playTime) {
    elPlayTime.textContent = state.playTime;
  }

  // Nome do Rival da RAM
  const elRival = document.getElementById('hud-rival-name');
  if (elRival && state.rivalName) {
    elRival.textContent = `Rival: ${state.rivalName}`;
  }

  // Pokédex e Pokémon Vivos
  const elDexStats = document.getElementById('hud-pokedex-stats');
  if (elDexStats) {
    const dexOwned = state.pokedexOwnedCount || (state.pokedexOwned ? state.pokedexOwned.length : 0);
    const totalLiving = state.totalPokemonOwned || ((state.partyCount || 0) + (state.pcBox ? state.pcBox.count : 0));
    elDexStats.textContent = `Dex: ${dexOwned}/151 • ${totalLiving} Vivos`;
  }

  // Moedas do Casino
  const elCoinsPill = document.getElementById('hud-coins-pill');
  const elCoinsVal = document.getElementById('hud-coins-val');
  if (elCoinsPill && elCoinsVal) {
    if (state.coins !== undefined && state.coins > 0) {
      elCoinsPill.style.display = 'flex';
      elCoinsVal.textContent = `${state.coins} fichas`;
    } else {
      elCoinsPill.style.display = 'none';
    }
  }

  // Repel Steps
  if (state.repelSteps && state.repelSteps > 0) {
    elRepelPill.style.display = 'flex';
    elRepelStepsText.textContent = `${state.repelSteps} passos`;
  } else {
    elRepelPill.style.display = 'none';
  }

  // Diálogo no Ecrã em Tempo Real
  const elLiveDialogBanner = document.getElementById('live-dialog-banner');
  const elLiveDialogText = document.getElementById('live-dialog-text');
  if (elLiveDialogBanner && elLiveDialogText) {
    if (state.currentDialog && state.currentDialog.trim().length > 0) {
      elLiveDialogBanner.style.display = 'flex';
      elLiveDialogText.textContent = state.currentDialog;
    } else {
      elLiveDialogBanner.style.display = 'none';
    }
  }

  // GitHub Sync Live Indicator
  if (state.githubSyncTime && state.githubSyncTime !== '--:--:--') {
    const elGithubLink = document.getElementById('hud-github-link');
    if (elGithubLink) {
      elGithubLink.textContent = `🌐 GitHub (${state.githubSyncTime})`;
      elGithubLink.title = `Ficheiro sincronizado no GitHub às ${state.githubSyncTime}. Clica para abrir no GitHub!`;
    }
  }

  // Insígnias
  renderBadges(state.badges || []);

  // Mini-Mapa de Exploração com Névoa de Guerra
  renderFogMinimap(state);

  // Equipa e Mochila
  elPartyCountPill.textContent = `${state.partyCount || 0} / 6`;
  if (elMobilePartyCount) elMobilePartyCount.textContent = state.partyCount || 0;
  renderParty(state.party || [], state.battle ? state.battle.playerActive : null);
  renderInventory(state.inventory || []);

  // Radar da Área (Fauna e Itens com RAM bit flags reais)
  renderAreaRadar(state.areaInfo);

  const wasInBattle = lastState && lastState.inBattle;

  // Gestão de Batalha em Tempo Real (Muda automaticamente para combate!)
  if (state.inBattle) {
    elBattleIndicatorTag.textContent = state.battle ? '⚔️ COMBATE REAL' : '⚔️ COMBATE REAL (A SINCRONIZAR...)';
    elBattleIndicatorTag.classList.add('in-battle');

    // Se acabou de entrar em combate ou se não estiver na aba de combate, força a mudança imediata!
    if (!wasInBattle) {
      userManuallyChoseCenterTab = false;
      switchCenterTab('battle');

      // No telemóvel, seleciona automaticamente a coluna central de combate
      mobileNavButtons.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === 'tab-center');
      });
      document.querySelectorAll('.cockpit-col').forEach(col => {
        col.classList.toggle('tab-active', col.id === 'tab-center');
      });
    }

    if (state.battle) {
      renderBattle(state.battle, state.battleType);
    } else {
      renderBattleStandby(state);
    }
  } else {
    elBattleIndicatorTag.textContent = 'MODO EXPLORAÇÃO';
    elBattleIndicatorTag.classList.remove('in-battle');

    // Se a batalha acabou, regressa ao radar de exploração
    if (wasInBattle) {
      userManuallyChoseCenterTab = false;
      switchCenterTab('radar');
    } else if (currentCenterTab === 'battle') {
      renderBattleStandby(state);
    }
  }

  lastState = state;
}

// Cache de Imagens de Mapas Oficiais do Pokémon Red
const loadedMapImages = {};

// Paleta quente avermelhada para aproximar o aspeto do Game Boy Color usado pelo jogador.
// É aplicada apenas à arte do mapa; marcadores, textos e sprites da interface mantêm as cores.
function drawMapImageTinted(ctx, ...args) {
  // Mantém as cores originais da cartografia; não aplicar uma tonalidade inventada.
  ctx.drawImage(...args);
}

function drawLiveVramMap(ctx, state, x, y, width, height) {
  const video = state && state.videoMemory;
  if (!ctx || !video || !video.tilePatterns || !video.bgTileMap) return false;

  const tileData = video.tilePatterns;
  const tileMap = video.bgTileMap;
  const lcdc = Number(video.lcdc || 0);
  const scrollX = Number(video.scrollX || 0) & 0xFF;
  const scrollY = Number(video.scrollY || 0) & 0xFF;
  const bgp = Number(video.bgPalette || 0xE4);
  // Paleta quente vermelho-rosada para reproduzir o filtro/aura do SameBoy.
  const colors = ['#fff0e8', '#f3b7b0', '#d87878', '#702d3a'];
  const image = ctx.createImageData(160, 144);
  const pixels = image.data;

  for (let sy = 0; sy < 144; sy++) {
    const worldY = (sy + scrollY) & 0xFF;
    const tileY = worldY >> 3;
    const pixelY = worldY & 7;
    for (let sx = 0; sx < 160; sx++) {
      const worldX = (sx + scrollX) & 0xFF;
      const tileX = worldX >> 3;
      const pixelX = worldX & 7;
      const tileId = tileMap[(tileY * 32 + tileX) & 1023] || 0;
      let tileOffset;
      if (lcdc & 0x10) {
        tileOffset = tileId * 16;
      } else {
        const signedId = tileId < 128 ? tileId : tileId - 256;
        tileOffset = 0x1000 + signedId * 16;
      }
      if (tileOffset < 0 || tileOffset + pixelY * 2 + 1 >= tileData.length) continue;
      const lo = tileData[tileOffset + pixelY * 2] || 0;
      const hi = tileData[tileOffset + pixelY * 2 + 1] || 0;
      const bit = 7 - pixelX;
      const rawShade = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
      const shade = (bgp >> (rawShade * 2)) & 3;
      const rgb = colors[shade];
      const hex = parseInt(rgb.slice(1), 16);
      const i = (sy * 160 + sx) * 4;
      pixels[i] = (hex >> 16) & 255;
      pixels[i + 1] = (hex >> 8) & 255;
      pixels[i + 2] = hex & 255;
      pixels[i + 3] = 255;
    }
  }

  const liveCanvas = document.createElement('canvas');
  liveCanvas.width = 160;
  liveCanvas.height = 144;
  liveCanvas.getContext('2d').putImageData(image, 0, 0);

  ctx.fillStyle = '#090d13';
  ctx.fillRect(x, y, width, height);
  const scale = Math.min(width / 160, height / 144);
  const drawW = 160 * scale;
  const drawH = 144 * scale;
  const drawX = x + (width - drawW) / 2;
  const drawY = y + (height - drawH) / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(liveCanvas, drawX, drawY, drawW, drawH);

  // Marcador central: a vista reconstruída corresponde ao ecrã atual do jogo.
  const markerX = drawX + drawW / 2;
  const markerY = drawY + drawH / 2;
  ctx.strokeStyle = '#00d9ff';
  ctx.lineWidth = Math.max(1.5, scale * 1.5);
  ctx.beginPath();
  ctx.arc(markerX, markerY, Math.max(4, scale * 4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#00d9ff';
  ctx.beginPath();
  ctx.arc(markerX, markerY, Math.max(1.5, scale * 1.5), 0, Math.PI * 2);
  ctx.fill();
  return true;
}

function getMapImage(mapId) {
  if (loadedMapImages[mapId]) return loadedMapImages[mapId];
  const img = new Image();
  img.src = `/maps/map_${mapId}.png?v=20261015_3`;
  loadedMapImages[mapId] = img;
  const redraw = () => {
    if (lastState && lastState.mapId === mapId) {
      renderFogMinimap(lastState);
      if (isGtaMapOpen) renderGtaFullMap(lastState);
    }
  };
  img.onload = redraw;
  img.onerror = redraw;
  return img;
}

// Estado do Mapa Tático GTA
let isGtaMapOpen = false;
let gtaZoom = 1.75;
let gtaPan = { x: 0, y: 0 };
let gtaFogEnabled = true;
let isGtaDragging = false;
let gtaDragStart = { x: 0, y: 0 };
let gtaHoveredEntity = null;

// Elementos DOM do Mapa GTA
const gtaMapModal = document.getElementById('gta-map-modal');
const gtaCanvas = document.getElementById('gta-fullmap-canvas');
const ctxGta = gtaCanvas ? gtaCanvas.getContext('2d') : null;
const gtaViewport = document.getElementById('gta-viewport-container');
const elGtaHeading = document.getElementById('gta-map-heading');
const elGtaSubInfo = document.getElementById('gta-map-sub-info');
const elGtaFogState = document.getElementById('gta-fog-state');
const gtaTooltip = document.getElementById('gta-map-tooltip');

const btnOpenGtaMap = document.getElementById('btn-open-gta-map');
const minimapContainer = document.getElementById('minimap-canvas-container');
const btnCloseGtaMap = document.getElementById('btn-close-gta-map');
const btnGtaZoomIn = document.getElementById('btn-gta-zoom-in');
const btnGtaZoomOut = document.getElementById('btn-gta-zoom-out');
const btnGtaCenter = document.getElementById('btn-gta-center');
const btnGtaToggleFog = document.getElementById('btn-gta-toggle-fog');

// Memória de entidades por mapa: mantém ghosts quando sprites/items desaparecem da RAM.
const mapEntityHistory = new Map();

function getMapEntitySnapshot(state) {
  const mapId = state.mapId !== undefined ? state.mapId : 0;
  if (!mapEntityHistory.has(mapId)) mapEntityHistory.set(mapId, new Map());
  const history = mapEntityHistory.get(mapId);
  const active = state.mapEntities || [];

  active.forEach(ent => {
    const key = `${ent.spriteIndex ?? 'x'}:${ent.pictureId ?? ent.name ?? ent.type}`;
    history.set(key, {
      ...ent,
      mapId,
      lastX: ent.x,
      lastY: ent.y,
      seenAt: Date.now(),
      isGhost: false
    });
  });

  const currentKeys = new Set(active.map(ent => `${ent.spriteIndex ?? 'x'}:${ent.pictureId ?? ent.name ?? ent.type}`));
  const ghosts = [];
  history.forEach((ent, key) => {
    if (!currentKeys.has(key)) ghosts.push({ ...ent, x: ent.lastX, y: ent.lastY, isGhost: true });
  });
  return { active, ghosts };
}

function drawMapEntity(ctx, ent, x, y, scale, forceGhost = false) {
  const ghost = forceGhost || ent.isGhost || ent.isCollected || ent.isDefeated;
  const size = Math.max(10, 15 * scale);
  ctx.save();
  ctx.globalAlpha = ghost ? 0.36 : 1;

  // Sprite visual: usa o ícone associado ao picture ID lido da RAM, em vez de pontos abstratos.
  const icon = ent.icon || (ent.isItem ? '🎒' : ent.isTrainer ? '🧍' : '👤');
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!ghost) {
    ctx.fillStyle = ent.isItem ? 'rgba(255,208,0,0.28)' : ent.isTrainer ? 'rgba(255,59,92,0.22)' : 'rgba(0,240,255,0.2)';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ghost) {
    ctx.setLineDash([2 * scale, 2 * scale]);
    ctx.strokeStyle = ent.isItem ? '#ffd000' : ent.isTrainer ? '#ff6b83' : '#8bd8e8';
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillText(icon, x, y);
  if (ent.facing && !ghost && scale >= 1.2) {
    const len = 8 * scale;
    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (ent.facing.includes('Norte')) ctx.lineTo(x, y - len);
    else if (ent.facing.includes('Sul')) ctx.lineTo(x, y + len);
    else if (ent.facing.includes('Este')) ctx.lineTo(x + len, y);
    else if (ent.facing.includes('Oeste')) ctx.lineTo(x - len, y);
    ctx.stroke();
  }
  ctx.restore();
}

// Renderizador do Mini-Mapa Tático com Tiles Reais do Game Boy
function renderFogMinimap(state) {
  if (!canvasFog || !ctxFog) return;

  const mapId = state.mapId !== undefined ? state.mapId : 0;
  const mapName = state.mapName || 'Mapa Atual';
  const coords = state.coords || { x: 0, y: 0 };
  const dir = state.playerDirection || 'Sul';
  const mapImg = getMapImage(mapId);

  // Muitos interiores ainda não têm arte estática. Nesses casos, reconstrói o ecrã
  // visível a partir dos tiles e da paleta BGP lidos da VRAM real do RetroArch.
  if (state.videoMemory && ([59, 60, 61, 68].includes(Number(mapId)) || (mapImg && mapImg.complete && mapImg.naturalWidth === 0))) {
    ctxFog.fillStyle = '#03060f';
    ctxFog.fillRect(0, 0, canvasFog.width, canvasFog.height);
    if (drawLiveVramMap(ctxFog, state, 0, 0, canvasFog.width, canvasFog.height)) {
      if (elMinimapTitle) elMinimapTitle.textContent = `${mapName.toUpperCase()} • VISTA RAM`;
      if (elMinimapStats) elMinimapStats.textContent = 'Ecrã real do jogo • cores da paleta RAM';
      if (elMinimapCoordsOverlay) elMinimapCoordsOverlay.textContent = `X:${coords.x} Y:${coords.y}`;
      if (isGtaMapOpen) renderGtaFullMap(state);
      return;
    }
  }

  const dims = state.mapDimensions || { width: 30, height: 30 };
  let mapW = (mapImg && mapImg.complete && mapImg.naturalWidth > 0)
    ? Math.round(mapImg.naturalWidth / 16)
    : (dims.width > 40 ? dims.width : (dims.width || 30) * 2);
  let mapH = (mapImg && mapImg.complete && mapImg.naturalHeight > 0)
    ? Math.round(mapImg.naturalHeight / 16)
    : (dims.height > 20 ? dims.height : (dims.height || 18) * 2);

  if (!exploredMaps[mapId]) {
    exploredMaps[mapId] = new Set();
  }
  const visited = exploredMaps[mapId];

  // Regista todos os metatiles que cabem no ecrã da Game Boy (160x144):
  // o mapa de fundo usa metatiles de 16x16 px, logo são aprox. 10x9 visíveis.
  // Guardamos cada tile revelado, sem substituir a imagem por uma grelha artificial.
  const px = coords.x;
  const py = coords.y;
  const visibleLeft = px - 5;
  const visibleTop = py - 4;
  for (let dx = 0; dx < 10; dx++) {
    for (let dy = 0; dy < 9; dy++) {
      const tx = visibleLeft + dx;
      const ty = visibleTop + dy;
      if (tx >= 0 && tx < mapW && ty >= 0 && ty < mapH) {
        visited.add(`${tx},${ty}`);
      }
    }
  }
  // Garante que o azulejo do jogador está sempre revelado
  if (px >= 0 && px < mapW && py >= 0 && py < mapH) visited.add(`${px},${py}`);
  saveExploredMaps();

  // Atualiza cabeçalho e estatísticas
  const totalTiles = Math.max(1, mapW * mapH);
  const pct = Math.min(100, Math.round((visited.size / totalTiles) * 100));
  if (elMinimapTitle) elMinimapTitle.textContent = `${mapName.toUpperCase()}`;
  if (elMinimapStats) elMinimapStats.textContent = `${pct}% Revelado • ${visited.size} azulejos`;
  if (elMinimapCoordsOverlay) elMinimapCoordsOverlay.textContent = `X:${px} Y:${py}`;

  // Dimensões do Canvas
  const cw = canvasFog.width;
  const ch = canvasFog.height;

  // Tamanho do azulejo desenhado no minimapa
  const tileSize = 14;
  const camX = Math.round(cw / 2 - px * tileSize - tileSize / 2);
  const camY = Math.round(ch / 2 - py * tileSize - tileSize / 2);

  // 1. Limpa com fundo escuro de névoa de guerra
  ctxFog.fillStyle = '#03060f';
  ctxFog.fillRect(0, 0, cw, ch);

  // 2. Desenha os TILES REAIS DA ROM para todos os azulejos já visitados
  if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
    visited.forEach(tileKey => {
      const [tx, ty] = tileKey.split(',').map(Number);
      const sx = camX + tx * tileSize;
      const sy = camY + ty * tileSize;

      if (sx >= -tileSize && sx <= cw && sy >= -tileSize && sy <= ch) {
        const srcX = tx * 16;
        const srcY = ty * 16;
        if (srcX >= 0 && srcX + 16 <= mapImg.naturalWidth && srcY >= 0 && srcY + 16 <= mapImg.naturalHeight) {
          drawMapImageTinted(ctxFog, mapImg, srcX, srcY, 16, 16, sx, sy, tileSize, tileSize);
        } else {
          ctxFog.fillStyle = '#0c1b2c';
          ctxFog.fillRect(sx, sy, tileSize, tileSize);
        }
        ctxFog.strokeStyle = 'rgba(0, 240, 255, 0.05)';
        ctxFog.strokeRect(sx, sy, tileSize, tileSize);
      }
    });
  } else {
    // Fallback cyber-grid enquanto a imagem do mapa descarrega
    visited.forEach(tileKey => {
      const [tx, ty] = tileKey.split(',').map(Number);
      const sx = camX + tx * tileSize;
      const sy = camY + ty * tileSize;
      if (sx >= -tileSize && sx <= cw && sy >= -tileSize && sy <= ch) {
        ctxFog.fillStyle = '#0a1424';
        ctxFog.fillRect(sx, sy, tileSize, tileSize);
        ctxFog.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ctxFog.strokeRect(sx, sy, tileSize, tileSize);
      }
    });
  }

  // Itens conhecidos: ícone no mapa; quando recolhidos, ficam como ghost.
  const items = [
    ...(state.areaInfo?.visibleItems || []),
    ...(state.areaInfo?.hiddenItems || [])
  ];
  items.forEach(it => {
    if (it.x === undefined || it.y === undefined) return;
    const ix = camX + it.x * tileSize + tileSize / 2;
    const iy = camY + it.y * tileSize + tileSize / 2;
    if (ix >= -16 && ix <= cw + 16 && iy >= -16 && iy <= ch + 16) {
      drawMapEntity(ctxFog, { ...it, icon: it.icon || '🎒', isItem: true, isGhost: !!it.isCollected }, ix, iy, 0.85, !!it.isCollected);
    }
  });

  // Treinadores conhecidos: mantêm o marcador fantasma depois de derrotados.
  const battles = state.areaInfo?.upcomingBoss?.battles || [];
  battles.forEach(bt => {
    if (bt.x === undefined || bt.y === undefined) return;
    const bx = camX + bt.x * tileSize + tileSize / 2;
    const by = camY + bt.y * tileSize + tileSize / 2;
    if (bx >= -16 && bx <= cw + 16 && by >= -16 && by <= ch + 16) {
      drawMapEntity(ctxFog, { ...bt, icon: bt.icon || '🧍', isTrainer: true, isGhost: !!bt.isDefeated }, bx, by, 0.85, !!bt.isDefeated);
    }
  });

  // Entidades atuais e ghosts (última posição conhecida de sprites que desapareceram).
  const entitySnapshot = getMapEntitySnapshot(state);
  [...entitySnapshot.active, ...entitySnapshot.ghosts].forEach(ent => {
    if (ent.x === undefined || ent.y === undefined) return;
    const ex = camX + ent.x * tileSize + tileSize / 2;
    const ey = camY + ent.y * tileSize + tileSize / 2;
    if (ex >= -16 && ex <= cw + 16 && ey >= -16 && ey <= ch + 16) {
      drawMapEntity(ctxFog, ent, ex, ey, 0.9, ent.isGhost);
    }
  });

  // 5. Desenha o Jogador Centralizado
  const playerScreenX = camX + px * tileSize + tileSize / 2;
  const playerScreenY = camY + py * tileSize + tileSize / 2;

  ctxFog.fillStyle = 'rgba(0, 240, 255, 0.25)';
  ctxFog.beginPath();
  ctxFog.arc(playerScreenX, playerScreenY, 11, 0, Math.PI * 2);
  ctxFog.fill();

  ctxFog.fillStyle = '#00f0ff';
  ctxFog.beginPath();
  ctxFog.arc(playerScreenX, playerScreenY, 4.5, 0, Math.PI * 2);
  ctxFog.fill();

  // Seta de Orientação
  ctxFog.strokeStyle = '#ffd000';
  ctxFog.lineWidth = 2.5;
  ctxFog.beginPath();
  ctxFog.moveTo(playerScreenX, playerScreenY);
  if (dir.includes('Norte') || dir.includes('Cima')) {
    ctxFog.lineTo(playerScreenX, playerScreenY - 12);
  } else if (dir.includes('Sul') || dir.includes('Baixo')) {
    ctxFog.lineTo(playerScreenX, playerScreenY + 12);
  } else if (dir.includes('Este') || dir.includes('Direita')) {
    ctxFog.lineTo(playerScreenX + 12, playerScreenY);
  } else if (dir.includes('Oeste') || dir.includes('Esquerda')) {
    ctxFog.lineTo(playerScreenX - 12, playerScreenY);
  } else {
    ctxFog.lineTo(playerScreenX, playerScreenY - 12);
  }
  ctxFog.stroke();

  // Moldura do Radar
  ctxFog.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  ctxFog.lineWidth = 1;
  ctxFog.strokeRect(1, 1, cw - 2, ch - 2);

  // Se o Mapa GTA em ecrã completo estiver aberto, atualiza-o também
  if (isGtaMapOpen) {
    renderGtaFullMap(state);
  }
}

// Renderizador do Mapa Completo com Zoom e Navegação Livre (Estilo GTA)
function renderGtaFullMap(state) {
  if (!gtaCanvas || !ctxGta || !gtaViewport) return;

  const rect = gtaViewport.getBoundingClientRect();
  if (gtaCanvas.width !== Math.round(rect.width) || gtaCanvas.height !== Math.round(rect.height)) {
    gtaCanvas.width = Math.round(rect.width);
    gtaCanvas.height = Math.round(rect.height);
  }

  const cw = gtaCanvas.width;
  const ch = gtaCanvas.height;
  const mapId = state.mapId !== undefined ? state.mapId : 0;
  const mapName = state.mapName || 'Mapa Atual';
  const coords = state.coords || { x: 0, y: 0 };
  const dir = state.playerDirection || 'Sul';
  const px = coords.x;
  const py = coords.y;
  // Corrige o ecrã preto: mapImg era usado abaixo sem ser declarado nesta função.
  const mapImg = getMapImage(mapId);

  if (state.videoMemory && ([59, 60, 61, 68].includes(Number(mapId)) || (mapImg && mapImg.complete && mapImg.naturalWidth === 0))) {
    ctxGta.fillStyle = '#020408';
    ctxGta.fillRect(0, 0, cw, ch);
    if (drawLiveVramMap(ctxGta, state, 0, 0, cw, ch)) {
      if (elGtaHeading) elGtaHeading.textContent = `${mapName} • Vista RAM ao vivo`;
      if (elGtaSubInfo) elGtaSubInfo.textContent = 'Vista do ecrã atual reconstruída a partir da VRAM';
      return;
    }
  }

  const dims = state.mapDimensions || { width: 30, height: 30 };
  let mapW = (mapImg && mapImg.complete && mapImg.naturalWidth > 0)
    ? Math.round(mapImg.naturalWidth / 16)
    : (dims.width > 40 ? dims.width : (dims.width || 30) * 2);
  let mapH = (mapImg && mapImg.complete && mapImg.naturalHeight > 0)
    ? Math.round(mapImg.naturalHeight / 16)
    : (dims.height > 20 ? dims.height : (dims.height || 18) * 2);

  const visited = exploredMaps[mapId] || new Set();
  const totalTiles = Math.max(1, mapW * mapH);
  const pct = Math.min(100, Math.round((visited.size / totalTiles) * 100));

  if (elGtaHeading) elGtaHeading.textContent = mapName;
  if (elGtaSubInfo) elGtaSubInfo.textContent = `${pct}% Explorado • Coordenadas: X:${px} Y:${py} • Zoom: ${Math.round(gtaZoom * 100)}%`;

  // Limpa fundo com tema escuro de mapa satélite
  ctxGta.fillStyle = '#020408';
  ctxGta.fillRect(0, 0, cw, ch);

  const tilePx = 16 * gtaZoom;
  const originX = gtaPan.x;
  const originY = gtaPan.y;

  // 1. Desenho do Mapa
  if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
    if (!gtaFogEnabled) {
      // Se névoa estiver desligada: desenha todo o mapa
      drawMapImageTinted(ctxGta, mapImg, originX, originY, mapImg.naturalWidth * gtaZoom, mapImg.naturalHeight * gtaZoom);
      // Escurece ligeiramente zonas não visitadas para dar profundidade tática
      for (let tx = 0; tx < mapW; tx++) {
        for (let ty = 0; ty < mapH; ty++) {
          if (!visited.has(`${tx},${ty}`)) {
            ctxGta.fillStyle = 'rgba(2, 4, 10, 0.65)';
            ctxGta.fillRect(originX + tx * tilePx, originY + ty * tilePx, tilePx + 0.5, tilePx + 0.5);
          }
        }
      }
    } else {
      // Névoa ligada: desenha estritamente os azulejos que já foram explorados!
      visited.forEach(tileKey => {
        const [tx, ty] = tileKey.split(',').map(Number);
        const sx = originX + tx * tilePx;
        const sy = originY + ty * tilePx;

        if (sx >= -tilePx && sx <= cw && sy >= -tilePx && sy <= ch) {
          const srcX = tx * 16;
          const srcY = ty * 16;
          if (srcX >= 0 && srcX + 16 <= mapImg.naturalWidth && srcY >= 0 && srcY + 16 <= mapImg.naturalHeight) {
            drawMapImageTinted(ctxGta, mapImg, srcX, srcY, 16, 16, sx, sy, tilePx + 0.5, tilePx + 0.5);
          } else {
            ctxGta.fillStyle = '#0c1b2c';
            ctxGta.fillRect(sx, sy, tilePx, tilePx);
          }
          ctxGta.strokeStyle = 'rgba(0, 240, 255, 0.04)';
          ctxGta.strokeRect(sx, sy, tilePx, tilePx);
        }
      });
    }
  } else {
    // Grelha genérica
    visited.forEach(tileKey => {
      const [tx, ty] = tileKey.split(',').map(Number);
      const sx = originX + tx * tilePx;
      const sy = originY + ty * tilePx;
      ctxGta.fillStyle = '#0b1626';
      ctxGta.fillRect(sx, sy, tilePx, tilePx);
      ctxGta.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      ctxGta.strokeRect(sx, sy, tilePx, tilePx);
    });
  }

  // Itens conhecidos na área, incluindo ghosts dos que já foram recolhidos.
  const items = [
    ...(state.areaInfo?.visibleItems || []),
    ...(state.areaInfo?.hiddenItems || [])
  ];
  items.forEach(it => {
    if (it.x === undefined || it.y === undefined) return;
    const ix = originX + it.x * tilePx + tilePx / 2;
    const iy = originY + it.y * tilePx + tilePx / 2;
    if (ix >= -24 && ix <= cw + 24 && iy >= -24 && iy <= ch + 24) {
      drawMapEntity(ctxGta, { ...it, icon: it.icon || '🎒', isItem: true, isGhost: !!it.isCollected }, ix, iy, gtaZoom, !!it.isCollected);
    }
  });

  // Treinadores conhecidos; derrotados ficam como ghosts no mapa.
  const battles = state.areaInfo?.upcomingBoss?.battles || [];
  battles.forEach(bt => {
    if (bt.x === undefined || bt.y === undefined) return;
    const bx = originX + bt.x * tilePx + tilePx / 2;
    const by = originY + bt.y * tilePx + tilePx / 2;
    if (bx >= -24 && bx <= cw + 24 && by >= -24 && by <= ch + 24) {
      drawMapEntity(ctxGta, { ...bt, icon: bt.icon || '🧍', isTrainer: true, isGhost: !!bt.isDefeated }, bx, by, gtaZoom, !!bt.isDefeated);
    }
  });

  // Sprites da RAM em movimento + ghosts na última posição quando desaparecem.
  const entitySnapshot = getMapEntitySnapshot(state);
  [...entitySnapshot.active, ...entitySnapshot.ghosts].forEach(ent => {
    if (ent.x === undefined || ent.y === undefined) return;
    const ex = originX + ent.x * tilePx + tilePx / 2;
    const ey = originY + ent.y * tilePx + tilePx / 2;
    if (ex >= -32 && ex <= cw + 32 && ey >= -32 && ey <= ch + 32) {
      drawMapEntity(ctxGta, ent, ex, ey, gtaZoom, ent.isGhost);
    }
  });

  // 4. Jogador (Marcador Tático com Farol de Luz e Seta)
  const playerScreenX = originX + px * tilePx + tilePx / 2;
  const playerScreenY = originY + py * tilePx + tilePx / 2;

  // Cone de visão do jogador
  ctxGta.fillStyle = 'rgba(0, 240, 255, 0.12)';
  ctxGta.beginPath();
  ctxGta.arc(playerScreenX, playerScreenY, 24 * gtaZoom, 0, Math.PI * 2);
  ctxGta.fill();

  ctxGta.fillStyle = 'rgba(0, 240, 255, 0.35)';
  ctxGta.beginPath();
  ctxGta.arc(playerScreenX, playerScreenY, 12 * gtaZoom, 0, Math.PI * 2);
  ctxGta.fill();

  ctxGta.fillStyle = '#00f0ff';
  ctxGta.beginPath();
  ctxGta.arc(playerScreenX, playerScreenY, 6 * gtaZoom, 0, Math.PI * 2);
  ctxGta.fill();
  ctxGta.strokeStyle = '#fff';
  ctxGta.lineWidth = 2;
  ctxGta.stroke();

  // Seta de direção dourada
  ctxGta.strokeStyle = '#ffd000';
  ctxGta.lineWidth = 3;
  ctxGta.beginPath();
  ctxGta.moveTo(playerScreenX, playerScreenY);
  const pointerLen = 16 * gtaZoom;
  if (dir.includes('Norte') || dir.includes('Cima')) {
    ctxGta.lineTo(playerScreenX, playerScreenY - pointerLen);
  } else if (dir.includes('Sul') || dir.includes('Baixo')) {
    ctxGta.lineTo(playerScreenX, playerScreenY + pointerLen);
  } else if (dir.includes('Este') || dir.includes('Direita')) {
    ctxGta.lineTo(playerScreenX + pointerLen, playerScreenY);
  } else if (dir.includes('Oeste') || dir.includes('Esquerda')) {
    ctxGta.lineTo(playerScreenX - pointerLen, playerScreenY);
  } else {
    ctxGta.lineTo(playerScreenX, playerScreenY - pointerLen);
  }
  ctxGta.stroke();
}

// Funções de Interação com o Mapa GTA
function openGtaMap() {
  if (!gtaMapModal) return;
  isGtaMapOpen = true;
  gtaMapModal.style.display = 'flex';

  // Centraliza o mapa no jogador
  if (lastState && lastState.coords) {
    centerGtaMapOnPlayer(lastState);
  }
}

function closeGtaMap() {
  if (!gtaMapModal) return;
  isGtaMapOpen = false;
  gtaMapModal.style.display = 'none';
  if (gtaTooltip) gtaTooltip.style.display = 'none';
}

function centerGtaMapOnPlayer(state) {
  if (!state || !state.coords || !gtaViewport) return;
  const rect = gtaViewport.getBoundingClientRect();
  const cw = rect.width || 800;
  const ch = rect.height || 600;
  const tilePx = 16 * gtaZoom;
  gtaPan.x = Math.round(cw / 2 - state.coords.x * tilePx - tilePx / 2);
  gtaPan.y = Math.round(ch / 2 - state.coords.y * tilePx - tilePx / 2);
  renderGtaFullMap(state);
}

// Event Listeners do Mapa GTA
if (minimapContainer) {
  minimapContainer.addEventListener('click', openGtaMap);
}
if (btnOpenGtaMap) {
  btnOpenGtaMap.addEventListener('click', (e) => {
    e.stopPropagation();
    openGtaMap();
  });
}
if (btnCloseGtaMap) {
  btnCloseGtaMap.addEventListener('click', closeGtaMap);
}

if (btnGtaZoomIn) {
  btnGtaZoomIn.addEventListener('click', () => {
    gtaZoom = Math.min(5.0, gtaZoom * 1.25);
    if (lastState) renderGtaFullMap(lastState);
  });
}
if (btnGtaZoomOut) {
  btnGtaZoomOut.addEventListener('click', () => {
    gtaZoom = Math.max(0.4, gtaZoom / 1.25);
    if (lastState) renderGtaFullMap(lastState);
  });
}
if (btnGtaCenter) {
  btnGtaCenter.addEventListener('click', () => {
    if (lastState) centerGtaMapOnPlayer(lastState);
  });
}
if (btnGtaToggleFog) {
  btnGtaToggleFog.addEventListener('click', () => {
    gtaFogEnabled = !gtaFogEnabled;
    if (elGtaFogState) elGtaFogState.textContent = gtaFogEnabled ? 'LIGADA' : 'DESLIGADA';
    if (lastState) renderGtaFullMap(lastState);
  });
}

// Zoom com Roda do Rato no Viewport GTA
if (gtaViewport) {
  gtaViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const oldZoom = gtaZoom;
    gtaZoom = Math.max(0.4, Math.min(5.0, gtaZoom * factor));

    // Ajusta o pan para fazer zoom centrado no ponteiro do rato
    const rect = gtaViewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    gtaPan.x = mouseX - (mouseX - gtaPan.x) * (gtaZoom / oldZoom);
    gtaPan.y = mouseY - (mouseY - gtaPan.y) * (gtaZoom / oldZoom);

    if (lastState) renderGtaFullMap(lastState);
  }, { passive: false });

  // Pan / Arrastar Mapa com o Rato
  gtaViewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isGtaDragging = true;
    gtaDragStart.x = e.clientX - gtaPan.x;
    gtaDragStart.y = e.clientY - gtaPan.y;
  });

  window.addEventListener('mousemove', (e) => {
    if (isGtaDragging && isGtaMapOpen) {
      gtaPan.x = e.clientX - gtaDragStart.x;
      gtaPan.y = e.clientY - gtaDragStart.y;
      if (lastState) renderGtaFullMap(lastState);
    }

    // Tooltip de Hover sobre Itens ou Treinadores
    if (isGtaMapOpen && lastState && gtaTooltip) {
      const rect = gtaViewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const tilePx = 16 * gtaZoom;

      let found = null;
      // 1. Procura Entidades em Tempo Real na RAM (NPCs e Itens no Chão)
      const entities = lastState.mapEntities || [];
      for (const ent of entities) {
        if (ent.x !== undefined && ent.y !== undefined) {
          const ex = gtaPan.x + ent.x * tilePx + tilePx / 2;
          const ey = gtaPan.y + ent.y * tilePx + tilePx / 2;
          if (Math.hypot(mx - ex, my - ey) < 14 * gtaZoom) {
            if (ent.isItem) {
              found = `<b>${ent.name}</b> (RAM ao Vivo)<br>📍 Coordenadas: X:${ent.x} Y:${ent.y}<br>📏 Distância: ${ent.compass ? ent.compass.badge : ''}<br>💡 ${ent.importance || 'Item no chão. Aproxima-te para recolher!'}`;
            } else if (ent.isTrainer) {
              found = `<b>${ent.name}</b> (Treinador Ativo)<br>📍 Coordenadas: X:${ent.x} Y:${ent.y} • Virado a: ${ent.facing || 'Sul'}<br>👥 ${ent.enemyRoster || 'Equipa de Treinador'}<br>⭐ Lead: ${ent.optimalLead || 'Pronto a combater'}<br>Estado: ${ent.isDefeated ? '✅ Já Vencido' : '⚔️ Pronto a Combater'}`;
            } else {
              found = `<b>${ent.icon || '👤'} ${ent.name}</b> (NPC no Mapa)<br>📍 Coordenadas: X:${ent.x} Y:${ent.y} • Virado a: ${ent.facing || 'Sul'}<br>📏 Distância: ${ent.compass ? ent.compass.badge : ''}`;
            }
            break;
          }
        }
      }

      // 2. Procura Treinador próximo da base estática
      if (!found) {
        const battles = lastState.areaInfo?.upcomingBoss?.battles || [];
        for (const bt of battles) {
          if (bt.x !== undefined && bt.y !== undefined) {
            const bx = gtaPan.x + bt.x * tilePx + tilePx / 2;
            const by = gtaPan.y + bt.y * tilePx + tilePx / 2;
            if (Math.hypot(mx - bx, my - by) < 14 * gtaZoom) {
              found = `<b>${bt.name}</b> (${bt.location})<br>👥 ${bt.enemyRoster}<br>⭐ Lead: ${bt.optimalLead}<br>Estado: ${bt.statusLabel}`;
              break;
            }
          }
        }
      }

      // 3. Procura Item estático próximo
      if (!found) {
        const items = [...(lastState.areaInfo?.visibleItems || []), ...(lastState.areaInfo?.hiddenItems || [])];
        for (const it of items) {
          if (it.x !== undefined && it.y !== undefined) {
            const ix = gtaPan.x + it.x * tilePx + tilePx / 2;
            const iy = gtaPan.y + it.y * tilePx + tilePx / 2;
            if (Math.hypot(mx - ix, my - iy) < 14 * gtaZoom) {
              found = `<b>${it.name}</b> (${it.type === 'hidden' ? 'Item Oculto' : 'No Chão'})<br>📍 ${it.hint}<br>💡 ${it.importance || ''}<br>Estado: ${it.isCollected ? '✅ Já Apanhado' : '🔴 Por Apanhar'}`;
              break;
            }
          }
        }
      }

      if (found) {
        gtaTooltip.style.display = 'block';
        gtaTooltip.innerHTML = found;
        gtaTooltip.style.left = `${mx}px`;
        gtaTooltip.style.top = `${my}px`;
      } else {
        gtaTooltip.style.display = 'none';
      }
    }
  });

  window.addEventListener('mouseup', () => {
    isGtaDragging = false;
  });

  // Suporte a Touch no Telemóvel / Tablet
  let touchStart = { x: 0, y: 0 };
  gtaViewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isGtaDragging = true;
      touchStart.x = e.touches[0].clientX - gtaPan.x;
      touchStart.y = e.touches[0].clientY - gtaPan.y;
    }
  });
  gtaViewport.addEventListener('touchmove', (e) => {
    if (isGtaDragging && e.touches.length === 1) {
      gtaPan.x = e.touches[0].clientX - touchStart.x;
      gtaPan.y = e.touches[0].clientY - touchStart.y;
      if (lastState) renderGtaFullMap(lastState);
    }
  });
  gtaViewport.addEventListener('touchend', () => {
    isGtaDragging = false;
  });
}

// Fechar com tecla ESC
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isGtaMapOpen) {
    closeGtaMap();
  }
});

// Renderizador de Insígnias
function renderBadges(badges) {
  elBadgesContainer.innerHTML = '';
  badges.forEach(b => {
    const el = document.createElement('div');
    el.className = `badge-item ${b.obtained ? 'obtained' : ''}`;
    el.innerHTML = `<span>${b.icon}</span>`;
    el.title = `${b.name} (${b.leader} - ${b.city}) • ${b.obtained ? 'CONQUISTADA' : 'POR DERROTAR'}`;
    elBadgesContainer.appendChild(el);
  });
}

// Renderizador da Mochila
function renderInventory(items) {
  elInvCountPill.textContent = `${items.length} ITENS`;
  elInventoryGrid.innerHTML = '';
  if (items.length === 0) {
    elInventoryGrid.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:10px; font-size:0.75rem;">Mochila vazia.</div>`;
    return;
  }
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'inv-item-row';
    const icon = it.name.includes('Ball') ? '🔴' : it.name.includes('Potion') ? '🧪' : it.name.includes('Map') ? '🗺️' : '💊';
    row.innerHTML = `
      <span class="inv-name">${icon} ${it.name}</span>
      <span class="inv-qty">x${it.qty}</span>
    `;
    elInventoryGrid.appendChild(row);
  });
}

// Renderizador da Equipa (Party Cards Compactos com Status Overlay, EXP Bar e DVs)
let lastPartySig = '';
function renderParty(party, activeBattleMon) {
  const activePos = activeBattleMon ? activeBattleMon.partyPos : -1;
  const currentSig = party.map((mon, index) => {
    const isAct = mon.isInBattle || (index === activePos);
    return `${mon.dex}_${mon.name}_${mon.hp}_${mon.maxHp}_${mon.level}_${mon.status}_${mon.exp ? mon.exp.current : 0}_${isAct ? 1 : 0}_${mon.spriteUrl}`;
  }).join('|');

  // Se a equipa e status não mudaram, não recria os nós do DOM para evitar qualquer efeito de flicker/piscar
  if (lastPartySig === currentSig && elPartyGrid.children.length === party.length) {
    return;
  }
  lastPartySig = currentSig;

  elPartyGrid.innerHTML = '';
  if (party.length === 0) {
    elPartyGrid.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 15px; font-size: 0.75rem;">A ler equipa...</div>`;
    return;
  }

  party.forEach((mon, index) => {
    const card = document.createElement('div');
    
    // Verifica se este Pokémon é o que está ativamente em combate
    const isActiveInBattle = mon.isInBattle || (activeBattleMon && activeBattleMon.partyPos === index);
    card.className = `party-card ${isActiveInBattle ? 'is-active-mon' : ''}`;

    const hpPercent = mon.maxHp > 0 ? Math.round((mon.hp / mon.maxHp) * 100) : 0;
    const hpColor = hpPercent > 50 ? '#00e676' : hpPercent > 20 ? '#ffd000' : '#ff3b5c';
    const typesHtml = (mon.types || []).map(t => `<span class="type-pill type-${t}">${t}</span>`).join('');
    const stats = mon.stats || { attack: '--', defense: '--', speed: '--', special: '--' };

    // Camada de Estado Visual por cima do Sprite
    const isFainted = mon.hp === 0;
    const statusClass = isFainted ? 'status-fainted' : (mon.status && mon.status !== 'HEALTHY' ? `status-${mon.status}` : '');
    const statusOverlay = isFainted
      ? `<span class="ko-stamp">K.O.</span>`
      : mon.status === 'POISON' ? `<span class="sprite-overlay-badge" title="Envenenado">☠️</span>`
      : mon.status === 'PARALYSIS' ? `<span class="sprite-overlay-badge" title="Paralisado">⚡</span>`
      : mon.status === 'SLEEP' ? `<span class="sprite-overlay-badge" title="A dormir">💤</span>`
      : mon.status === 'BURN' ? `<span class="sprite-overlay-badge" title="Queimado">🔥</span>`
      : '';

    // DVs Reais de Gen 1 da memória (0 a 15)
    const ivBadge = mon.dvs ? `<span class="party-iv-tag" title="DVs Gen 1 (0–15): Ataque: ${mon.dvs.attack} | Defesa: ${mon.dvs.defense} | Velocidade: ${mon.dvs.speed} | Especial: ${mon.dvs.special} | HP: ${mon.dvs.hp}">DVs: A:${mon.dvs.attack} D:${mon.dvs.defense} S:${mon.dvs.speed} Sp:${mon.dvs.special}</span>` : '';

    // Barra de EXP da RAM
    const expBarHtml = mon.exp ? `
      <div class="party-exp-line" title="EXP Atual: ${mon.exp.current.toLocaleString()} • Próximo Nível: ${mon.exp.next.toLocaleString()}">
        <span class="pexp-label">${mon.exp.current.toLocaleString()} XP</span>
        <div class="pexp-bar">
          <div class="pexp-fill" style="width: ${mon.exp.percent}%;"></div>
        </div>
        <span class="pexp-val">${mon.exp.needed > 0 ? `${mon.exp.needed} p/ Lv.${mon.level + 1}` : 'NÍVEL MAX'}</span>
      </div>
    ` : '';

    // DVs e Stat EXP compactos
    const dvsText = mon.dvs ? `HP:${mon.dvs.hp} A:${mon.dvs.attack} D:${mon.dvs.defense} S:${mon.dvs.speed} Sp:${mon.dvs.special}` : 'DVs: --';
    const totalStatExp = mon.statExp ? (mon.statExp.hp + mon.statExp.attack + mon.statExp.defense + mon.statExp.speed + mon.statExp.special) : 0;
    const statExpText = totalStatExp > 0 ? `EXP:${Math.round(totalStatExp / 1000)}k` : '';

    // Golpes com PP
    const movesHtml = (mon.moves && mon.moves.length > 0) ? `
      <div class="party-moves-chips">
        ${mon.moves.map(m => `
          <div class="party-move-chip" title="${m.name} (${m.type} • Pwr ${m.power || '--'})">
            <span>${m.name}</span>
            <b style="color:${m.pp <= 2 ? '#ff3b5c' : '#ffd000'};">${m.pp}</b>
          </div>
        `).join('')}
      </div>
    ` : '';

    card.innerHTML = `
      <div class="party-card-top-row">
        <div class="party-main-info">
          <div class="sprite-wrapper ${statusClass}">
            <img class="party-thumb" src="${mon.spriteUrl}" alt="${mon.name}" onerror="if (this.src !== '${mon.artworkUrl}') { this.src='${mon.artworkUrl}'; } else { this.onerror = null; }">
            ${statusOverlay}
          </div>
          <div class="party-meta">
            <div class="party-name-row">
              <span class="party-mon-name">${mon.name}</span>
              ${isActiveInBattle ? `<span class="party-active-tag">⚔️ ATIVO</span>` : ''}
            </div>
            <div class="types-row">${typesHtml}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
          <span class="level-pill">Lv. ${mon.level}</span>
          <span class="status-badge status-${mon.status}">${isFainted ? 'KO' : mon.status}</span>
        </div>
      </div>

      <div class="party-hp-line">
        <span style="font-weight:700;">HP</span>
        <div class="party-hp-bar">
          <div class="party-hp-fill" style="width: ${hpPercent}%; background: ${hpColor};"></div>
        </div>
        <span style="min-width:40px; text-align:right;">${mon.hp}/${mon.maxHp}</span>
      </div>

      ${expBarHtml}

      <div class="party-dvs-row" title="DVs Gen 1 (0 a 15) e Stat EXP total">
        <span>${dvsText}</span>
        ${statExpText ? `<b style="color:var(--text-muted);">${statExpText}</b>` : ''}
      </div>

      ${movesHtml}
    `;
    elPartyGrid.appendChild(card);
  });
}

// Renderizador de Chips de Modificadores de Stats em Combate
function renderStatChips(container, stats, mods) {
  if (!container) return;
  container.innerHTML = '';

  const statDefs = [
    { key: 'attack', name: 'ATK' },
    { key: 'defense', name: 'DEF' },
    { key: 'speed', name: 'SPD' },
    { key: 'special', name: 'SPC' },
    { key: 'accuracy', name: 'ACC' },
    { key: 'evasion', name: 'EVA' }
  ];

  statDefs.forEach(s => {
    const mod = mods ? mods[s.key] : null;
    const stage = mod ? mod.stage : 0;
    const val = stats && stats[s.key] !== undefined && stats[s.key] !== 0 ? stats[s.key] : '--';

    let chipClass = 'stat-mod-chip';
    let badgeText = '0';
    if (stage > 0) {
      chipClass += ' stat-boosted';
      badgeText = `+${stage}`;
    } else if (stage < 0) {
      chipClass += ' stat-lowered';
      badgeText = `${stage}`;
    }

    const chip = document.createElement('div');
    chip.className = chipClass;
    chip.innerHTML = `
      <div class="stat-chip-top">
        <span>${s.name}</span>
        <span>${badgeText}</span>
      </div>
      <div class="stat-chip-val">${val}</div>
    `;
    container.appendChild(chip);
  });
}

// Renderizador da Arena em Modo de Espera (Quando o utilizador vê a arena fora de combate)
function renderBattleStandby(state) {
  if (!state) return;
  const party = state.party || [];
  const leadMon = party.find(p => p.hp > 0) || party[0] || null;

  // Combatente do Jogador (Lead da Equipa)
  if (leadMon) {
    elPlayerBattleName.textContent = leadMon.name;
    elPlayerBattleLevel.textContent = `Lv. ${leadMon.level} • Lead da Equipa`;
    elPlayerBattleSprite.src = leadMon.spriteUrl;
    elPlayerBattleSprite.onerror = () => { elPlayerBattleSprite.src = leadMon.artworkUrl; };

    const playerWrapper = document.getElementById('player-battle-sprite-wrapper');
    if (playerWrapper) {
      const isFainted = leadMon.hp === 0;
      const statusClass = isFainted ? 'status-fainted' : (leadMon.status && leadMon.status !== 'HEALTHY' ? `status-${leadMon.status}` : '');
      playerWrapper.className = `sprite-wrapper ${statusClass}`;
    }

    const hpPercent = leadMon.maxHp > 0 ? Math.round((leadMon.hp / leadMon.maxHp) * 100) : 0;
    elPlayerBattleHpText.textContent = `${leadMon.hp} / ${leadMon.maxHp}`;
    elPlayerBattleHpFill.style.width = `${hpPercent}%`;
    elPlayerBattleTypes.innerHTML = (leadMon.types || []).map(t => `<span class="type-pill type-${t}">${t}</span>`).join('');

    renderStatChips(elPlayerStatMods, leadMon.stats, null);

    if (leadMon.moves && leadMon.moves.length > 0) {
      elPlayerBattleMoves.innerHTML = leadMon.moves.map(m => `
        <div class="move-row">
          <div style="min-width: 0; width: 100%;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="move-name">${m.name}</div>
              <span class="move-eff-tag eff-none">${m.type} • Pwr ${m.power || '--'}</span>
            </div>
            <div class="move-pp" style="margin-top:2px;">
              <span>PP: <b>${m.pp}</b></span> • <span>Precisão: ${m.accuracy || 100}%</span>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      elPlayerBattleMoves.innerHTML = `<div style="color:var(--text-dim); font-size:0.75rem; text-align:center; padding:10px;">Sem golpes registados.</div>`;
    }
  }

  const upcomingBoss = (state.areaInfo && state.areaInfo.upcomingBoss) ? state.areaInfo.upcomingBoss : null;
  const nextBattle = upcomingBoss && upcomingBoss.battles ? upcomingBoss.battles.find(b => !b.isDefeated && !b.isMissed) : null;

  // Combatente Inimigo em Standby / Previsão do Próximo Alvo
  if (nextBattle) {
    elEnemyBattleName.textContent = nextBattle.name;
    elEnemyBattleLevel.textContent = `${nextBattle.difficulty} • Meta: ${nextBattle.targetLevel}`;
    // Sprite temático
    if (nextBattle.id && nextBattle.id.includes('brock')) {
      elEnemyBattleSprite.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/95.png'; // Onix de Brock
      elEnemyBattleTypes.innerHTML = '<span class="type-pill type-Rock">Rock</span><span class="type-pill type-Ground">Ground</span>';
    } else if (nextBattle.id && nextBattle.id.includes('trainer')) {
      elEnemyBattleSprite.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/27.png'; // Sandshrew
      elEnemyBattleTypes.innerHTML = '<span class="type-pill type-Ground">Ground</span>';
    } else {
      elEnemyBattleSprite.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png'; // Eevee / Rival
      elEnemyBattleTypes.innerHTML = '<span class="type-pill" style="background:#eab308; color:#000;">RIVAL</span>';
    }
    const enemyWrapper = document.getElementById('enemy-battle-sprite-wrapper');
    if (enemyWrapper) enemyWrapper.className = 'sprite-wrapper';
    elEnemyBattleHpText.textContent = nextBattle.badgeTag || nextBattle.statusLabel;
    elEnemyBattleHpFill.style.width = '100%';
    renderStatChips(elEnemyStatMods, null, null);
    if (elEnemyMovesList) {
      elEnemyMovesList.innerHTML = `<span style="color:var(--text-main); font-size:0.75rem; font-weight:700;">Equipa: ${nextBattle.enemyRoster}</span>`;
    }

    // Painel de Recomendação Tática
    elMatchupRatingText.textContent = nextBattle.statusLabel || 'PRÓXIMO ALVO';
    elRecMoveTitle.textContent = `Lead: ${nextBattle.optimalLead}`;
    elRecMoveDesc.textContent = nextBattle.strategyText;
  } else {
    elEnemyBattleName.textContent = 'Radar de Combate';
    elEnemyBattleLevel.textContent = 'Em Espera';
    elEnemyBattleSprite.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
    const enemyWrapper = document.getElementById('enemy-battle-sprite-wrapper');
    if (enemyWrapper) enemyWrapper.className = 'sprite-wrapper';
    elEnemyBattleHpText.textContent = 'Sem Combate';
    elEnemyBattleHpFill.style.width = '100%';
    elEnemyBattleTypes.innerHTML = '<span class="type-pill" style="background:rgba(255,255,255,0.08); color:var(--text-muted);">STANDBY</span>';
    renderStatChips(elEnemyStatMods, null, null);
    if (elEnemyMovesList) elEnemyMovesList.innerHTML = '<span style="color:var(--text-dim); font-size:0.7rem;">Inicia um combate na Game Boy para ler a RAM do adversário</span>';

    // Painel de Recomendação Tática
    elMatchupRatingText.textContent = 'MODO DE ESPERA';
    elRecMoveTitle.textContent = leadMon ? `Líder: ${leadMon.name} (Lv. ${leadMon.level})` : 'Equipa a Sincronizar...';
    elRecMoveDesc.textContent = 'Quando entrares na relva alta ou desafiares um treinador, a IA calcula instantaneamente o dano exato, fraquezas, probabilidades de K.O. e chances de captura da 1ª Geração!';
  }

  // Alertas Táticos & Lista Resumida de Batalhas da Área
  const alerts = [];
  if (nextBattle && nextBattle.idealLineup && nextBattle.idealLineup.length > 0) {
    const lineupStr = nextBattle.idealLineup.map(l => `#${l.slot} ${l.name} (Lv.${l.level})`).join(' ➔ ');
    alerts.push({ level: 'advantage', text: `👥 Ordem Ideal da Equipa: ${lineupStr}` });
  }

  if (upcomingBoss && upcomingBoss.battles && upcomingBoss.battles.length > 0) {
    const battlesSummary = upcomingBoss.battles.map(b => `${b.name} (${b.statusLabel})`).join(' • ');
    alerts.push({ level: 'info', text: `⚔️ Batalhas da Área: ${battlesSummary}` });
  }

  if (leadMon && leadMon.hp <= 5 && leadMon.hp > 0) {
    alerts.push({ level: 'critical', text: `⚠️ Cuidado! ${leadMon.name} está apenas com ${leadMon.hp} HP! Cura-o antes de batalhar.` });
  }
  const faintedCount = party.filter(p => p.hp === 0).length;
  if (faintedCount > 0) {
    alerts.push({ level: 'warning', text: `Tens ${faintedCount} Pokémon(s) K.O. na equipa. Visita um Centro Pokémon.` });
  }

  elTacticalAlerts.innerHTML = alerts.map(a => `
    <div class="alert-item alert-${a.level}">
      <span>${a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : '⚡'}</span>
      <span>${a.text}</span>
    </div>
  `).join('');

  elCatchCalculator.style.display = 'block';
  elChancePokeball.textContent = '--%';
  elChanceGreatball.textContent = '--%';
  elChanceUltraball.textContent = '--%';
}

// Renderizador da Arena de Combate com Razões Matemáticas Reais de RAM
function renderBattle(battle, battleType) {
  const { enemy, playerActive, strategy, trainerPartyCount } = battle;

  // Inimigo
  if (enemy) {
    elEnemyBattleName.textContent = enemy.name;
    const trainerTag = (battleType === 'Trainer' && trainerPartyCount) ? ` • Roster: ${trainerPartyCount} Pokémons` : '';
    elEnemyBattleLevel.textContent = `Lv. ${enemy.level}${trainerTag}`;
    elEnemyBattleSprite.src = enemy.spriteUrl;
    elEnemyBattleSprite.onerror = () => { elEnemyBattleSprite.src = enemy.artworkUrl; };

    const enemyHpPercent = enemy.maxHp > 0 ? Math.round((enemy.hp / enemy.maxHp) * 100) : 100;
    elEnemyBattleHpText.textContent = `${enemy.hp} / ${enemy.maxHp}`;
    elEnemyBattleHpFill.style.width = `${enemyHpPercent}%`;
    elEnemyBattleTypes.innerHTML = (enemy.types || []).map(t => `<span class="type-pill type-${t}">${t}</span>`).join('');
    
    // Status overlay no adversário
    const enemyWrapper = document.getElementById('enemy-battle-sprite-wrapper');
    if (enemyWrapper) {
      enemyWrapper.className = `sprite-wrapper ${enemy.hp === 0 ? 'status-fainted' : ''}`;
    }

    renderStatChips(elEnemyStatMods, enemy.stats, enemy.statMods);

    if (strategy && strategy.enemyThreats && strategy.enemyThreats.length > 0) {
      elEnemyMovesList.innerHTML = strategy.enemyThreats.map(t => `
        <div style="background: rgba(255,255,255,0.04); border: 1px solid ${t.canKo ? 'rgba(239,68,68,0.5)' : t.isBide ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 4px 8px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: var(--text-main); font-size: 0.75rem;">${t.name}</strong>
            <span style="font-size: 0.65rem; color: var(--text-muted); margin-left: 4px;">(${t.type})</span>
          </div>
          <span style="font-size: 0.7rem; font-weight: 700; color: ${t.canKo ? '#ef4444' : t.isBide ? '#f59e0b' : 'var(--text-light)'};">${t.threatLabel}</span>
        </div>
      `).join('');
    } else if (enemy.moves && enemy.moves.length > 0) {
      elEnemyMovesList.innerHTML = enemy.moves.map(m => `<span class="level-pill">${typeof m === 'object' ? m.name : m}</span>`).join('');
    } else {
      elEnemyMovesList.innerHTML = '<span style="color: var(--text-dim); font-size: 0.7rem;">Golpes ainda não revelados</span>';
    }
  }

  // Combatente Ativo do Jogador (lido diretamente de wBattleMon + wPlayerMonNumber)
  if (playerActive) {
    elPlayerBattleName.textContent = playerActive.name;
    elPlayerBattleLevel.textContent = `Lv. ${playerActive.level}`;
    elPlayerBattleSprite.src = playerActive.spriteUrl;
    elPlayerBattleSprite.onerror = () => { elPlayerBattleSprite.src = playerActive.artworkUrl; };

    // Status overlay no combatente ativo do jogador
    const playerWrapper = document.getElementById('player-battle-sprite-wrapper');
    if (playerWrapper) {
      const isFainted = playerActive.hp === 0;
      const statusClass = isFainted ? 'status-fainted' : (playerActive.status && playerActive.status !== 'HEALTHY' ? `status-${playerActive.status}` : '');
      playerWrapper.className = `sprite-wrapper ${statusClass}`;
    }

    const playerHpPercent = playerActive.maxHp > 0 ? Math.round((playerActive.hp / playerActive.maxHp) * 100) : 0;
    elPlayerBattleHpText.textContent = `${playerActive.hp} / ${playerActive.maxHp}`;
    elPlayerBattleHpFill.style.width = `${playerHpPercent}%`;
    elPlayerBattleTypes.innerHTML = (playerActive.types || []).map(t => `<span class="type-pill type-${t}">${t}</span>`).join('');

    renderStatChips(elPlayerStatMods, playerActive.stats, playerActive.statMods);

    // Matriz de Golpes com Dano Previsto (Min-Max), PP e Probabilidade de Crítico & Conselho de Captura
    if (strategy && strategy.moves) {
      elPlayerBattleMoves.innerHTML = strategy.moves.map(m => {
        const isBest = strategy.bestMove && strategy.bestMove.id === m.id;
        const effClass = m.effectiveness >= 2 ? 'eff-super' : m.effectiveness < 1 ? 'eff-not' : 'eff-none';
        const koText = m.hitsToKo === 1 ? '⚡ K.O. em 1 turno!' : m.hitsToKo ? `${m.hitsToKo} turnos para K.O.` : '';
        const dmgText = m.dmgMax > 0 ? `Dano: ${m.dmgMin}-${m.dmgMax}` : 'Status';
        const critText = m.critChance ? `Crit: ${m.critChance}%` : '';
        const ppClass = (m.pp !== undefined && m.pp <= 2) ? 'pp-critical' : '';

        const catchAdviceHtml = m.catchAdvice ? `
          <div class="catch-advice-tag catch-${m.catchAdvice.type}">${m.catchAdvice.label}: ${m.catchAdvice.desc}</div>
        ` : '';

        return `
          <div class="move-row ${isBest ? 'is-best' : ''}">
            <div style="min-width: 0; width: 100%;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="move-name">${isBest ? '⭐ ' : ''}${m.name}</div>
                <span class="move-eff-tag ${effClass}">${m.label}</span>
              </div>
              <div class="move-pp" style="margin-top:2px;">
                <span class="${ppClass}">PP: <b>${m.pp}</b>/${m.maxPp || 20}</span> • <span>${dmgText}</span> • <span style="color:#ffd000;">${critText}</span>
              </div>
              ${catchAdviceHtml}
              ${koText ? `<div style="font-size:0.62rem; font-weight:700; color:#00e676; margin-top:2px;">${koText}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Recomendações Estratégicas e Cálculo de Captura
  if (strategy) {
    elMatchupRatingText.textContent = strategy.matchupRating || 'EQUILIBRADO';
    if (strategy.bestMove) {
      const koNote = strategy.bestMove.hitsToKo === 1 ? ' • DERROTA GARANTIDA EM 1 GOLPE' : '';
      const ppNote = strategy.bestMove.isPpConserving ? ' • 💡 POUPA PP' : '';
      elRecMoveTitle.textContent = `Usa ${strategy.bestMove.name} (${strategy.bestMove.type})`;
      elRecMoveDesc.textContent = `Dano: ${strategy.bestMove.dmgMin}-${strategy.bestMove.dmgMax} HP (${strategy.bestMove.effectiveness}x)${koNote}${ppNote} (PP: ${strategy.bestMove.pp}/${strategy.bestMove.maxPp}).`;
    }

    let alertsHtml = '';

    // 1. CONSELHEIRO DINÂMICO DE TROCA (Manter vs Mudar & Prioridade de Treino aos Mais Fracos)
    if (strategy.switchAdvisor) {
      const sw = strategy.switchAdvisor;
      const isFainted = sw.action === 'SWITCH_FAINTED';
      const isExp = sw.action === 'SWITCH_EXP';
      const isAdv = sw.action === 'SWITCH_ADVANTAGE';
      const cardClass = isFainted ? 'switch-card-critical' : isExp ? 'switch-card-exp' : isAdv ? 'switch-card-adv' : 'switch-card-keep';

      alertsHtml += `
        <div class="switch-advisor-card ${cardClass}">
          <div class="switch-adv-header">
            <span class="switch-adv-badge">${sw.actionTitle}</span>
            ${sw.targetMon ? `<span class="switch-target-tag">Substituto: <b>${sw.targetMon.name} (Lv. ${sw.targetMon.level})</b> [${sw.targetMon.hp}/${sw.targetMon.maxHp} HP]</span>` : ''}
          </div>
          <div class="switch-adv-reason">${sw.reason}</div>
        </div>
      `;
    }

    // 2. COMBINAÇÃO ÓTIMA DE ATAQUES (Vitória Rápida + Sobrevivência Máxima)
    if (strategy.optimalCombo) {
      const combo = strategy.optimalCombo;
      const survColor = combo.survivalPercent >= 85 ? '#00e676' : combo.survivalPercent >= 60 ? '#ffd000' : '#ff5252';
      alertsHtml += `
        <div class="optimal-combo-card">
          <div class="combo-top">
            <span class="combo-title">⚡ SEQUÊNCIA ÓTIMA DE VITÓRIA</span>
            <span class="combo-surv-badge" style="color:${survColor};">🛡️ ${combo.survivalPercent}% Sobrevivência</span>
          </div>
          <div class="combo-steps-list">
            ${combo.sequence.map(s => `<div class="combo-step-item">➔ ${s}</div>`).join('')}
          </div>
          <div class="combo-summary-text">${combo.summary}</div>
        </div>
      `;
    }

    // Alertas complementares
    alertsHtml += (strategy.alerts || []).map(a => `
      <div class="alert-item alert-${a.level}">
        <span>${a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : '⚡'}</span>
        <span>${a.text}</span>
      </div>
    `).join('');

    elTacticalAlerts.innerHTML = alertsHtml;

    if (strategy.catchChance && battleType === 'Wild') {
      elCatchCalculator.style.display = 'block';
      elChancePokeball.textContent = `${strategy.catchChance.pokeball}%`;
      elChanceGreatball.textContent = `${strategy.catchChance.greatball}%`;
      elChanceUltraball.textContent = `${strategy.catchChance.ultraball}%`;

      // Atualiza dica extra de status e vida vermelha se existir container
      let extraOdds = document.getElementById('catch-extra-odds');
      if (!extraOdds) {
        extraOdds = document.createElement('div');
        extraOdds.id = 'catch-extra-odds';
        extraOdds.style.cssText = 'font-size:0.68rem; color:var(--text-muted); margin-top:6px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.08);';
        elCatchCalculator.appendChild(extraOdds);
      }
      extraOdds.innerHTML = `💤 Com Sono: <b>~${strategy.catchChance.withSleep || 45}%</b> • 🩸 Com HP Vermelho (15%): <b>~${strategy.catchChance.withRedHp || 60}%</b>`;
    } else {
      elCatchCalculator.style.display = 'none';
    }
  }
}

// Renderizador do Radar da Área (Fauna Selvagem, NPCs, Trocas, Doações, Itens & Itemfinder)
function renderAreaRadar(areaInfo) {
  if (!areaInfo) return;

  const wildList = areaInfo.wild || [];
  const tradesList = areaInfo.npcTrades || [];
  const giftsList = areaInfo.npcGifts || [];
  const npcItemsList = areaInfo.npcItems || [];

  elRadarWildCount.textContent = `${wildList.length} Espécies`;
  elWildEncountersList.innerHTML = '';

  const elRadarBossContainer = document.getElementById('radar-boss-container');
  if (elRadarBossContainer) elRadarBossContainer.innerHTML = '';

  // 0. Preparação Tática de Combate do Próximo Chefe / Líder da Área (Ultra-Compacto & Glanceable)
  if (areaInfo.upcomingBoss) {
    const b = areaInfo.upcomingBoss;
    const battles = b.battles || [];
    const defeatedCount = battles.filter(bt => bt.isDefeated).length;
    const allDefeated = battles.length > 0 && defeatedCount === battles.length;
    const pendingBattles = battles.filter(bt => !bt.isDefeated);
    const nextBattle = pendingBattles.length > 0 ? pendingBattles[0] : null;

    const bossCard = document.createElement('div');
    bossCard.className = 'upcoming-boss-card';
    bossCard.innerHTML = `
      <div class="boss-card-header-row">
        <div class="boss-title-wrap">
          <span class="boss-tag">🎯 OBJETIVO:</span>
          <strong class="boss-title-text">${b.bossTitle}</strong>
          <span class="level-pill" style="font-size:0.65rem;">Meta: <b>${b.targetLevel}</b></span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          ${battles.length > 0 ? (allDefeated
            ? `<span class="area-clean-badge">✅ ${defeatedCount}/${battles.length} VENCIDOS</span>`
            : `<span class="area-pending-badge">⚔️ ${defeatedCount}/${battles.length} Vencidos • Próximo: <b>${nextBattle ? nextBattle.name : ''}</b></span>`
          ) : ''}
          ${battles.length > 0 ? `
            <button class="btn-toggle-battles" id="btn-toggle-area-battles" title="Clica para ver ou ocultar os detalhes de cada treinador">
              ${isAreaBattlesDrawerOpen ? '▲ Ocultar Treinadores' : '▼ Ver Treinadores'}
            </button>
          ` : ''}
        </div>
      </div>

      <div class="boss-battles-section" id="area-battles-drawer" style="display:${isAreaBattlesDrawerOpen ? 'block' : 'none'}; max-height:220px; overflow-y:auto; margin-top:6px; border-top:1px solid rgba(255,255,255,0.08); padding-top:6px;">
        <div class="boss-battles-title" style="font-size:0.7rem; margin-bottom:4px; color:var(--text-muted);">⚔️ COMBATES NA ÁREA (DA MAIS FÁCIL À MAIS DIFÍCIL):</div>
        <div class="boss-battles-grid" style="display:flex; flex-direction:column; gap:4px;">
          ${battles.map((bt, idx) => `
            <div class="area-battle-card ${bt.diffClass || ''} ${bt.isDefeated ? 'is-defeated' : bt.isMissed ? 'is-missed' : 'is-pending'}" style="padding:4px 8px; font-size:0.7rem;">
              <div class="abattle-top" style="margin-bottom:2px;">
                <div class="abattle-title-row">
                  <span class="abattle-order">#${idx + 1}</span>
                  ${bt.compass ? `<span class="compass-badge compass-battle" title="Distância: ${bt.compass.dist} passos a ${bt.compass.direction}">${bt.compass.arrow} ${bt.compass.dist}p</span>` : ''}
                  <strong class="abattle-name">${bt.name}</strong>
                  <span class="abattle-loc">(${bt.location})</span>
                </div>
                <div style="display:flex; gap:4px; align-items:center;">
                  <span class="diff-badge ${bt.diffClass || ''}">${bt.difficulty}</span>
                  <span class="battle-status-badge ${bt.isDefeated ? 'status-won' : bt.isMissed ? 'status-missed' : 'status-todo'}">${bt.statusLabel}</span>
                </div>
              </div>
              <div class="abattle-details" style="font-size:0.65rem;">
                <span>👥 <b>Equipa:</b> ${bt.enemyRoster}</span> • <span>⭐ <b>Lead:</b> ${bt.optimalLead}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="boss-compact-tactics-row">
        ${(b.warnings && b.warnings.length > 0) ? b.warnings.map(w => `
          <div class="tactical-chip chip-warning" style="font-size:0.68rem; padding:2px 6px;">
            <span>${w.text}</span>
          </div>
        `).join('') : ''}
        ${b.recommendations.slice(0, 1).map(r => `
          <div class="tactical-chip" style="font-size:0.68rem; padding:2px 6px;">
            <span class="tchip-role">${r.role}</span>
            <span class="tchip-desc"><b>${r.pokemon}:</b> ${r.reason}</span>
          </div>
        `).join('')}
      </div>
    `;

    if (elRadarBossContainer) {
      elRadarBossContainer.appendChild(bossCard);
      const btnToggle = document.getElementById('btn-toggle-area-battles');
      if (btnToggle) {
        btnToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          isAreaBattlesDrawerOpen = !isAreaBattlesDrawerOpen;
          const drawer = document.getElementById('area-battles-drawer');
          if (drawer) {
            drawer.style.display = isAreaBattlesDrawerOpen ? 'block' : 'none';
          }
          btnToggle.textContent = isAreaBattlesDrawerOpen ? '▲ Ocultar Treinadores' : '▼ Ver Treinadores';
        });
      }
    } else {
      elWildEncountersList.appendChild(bossCard);
    }
  }

  // 1. Bloco de Proximidade do Itemfinder Virtual
  if (areaInfo.itemfinder) {
    const ifBox = document.createElement('div');
    ifBox.className = `itemfinder-radar-box ${areaInfo.itemfinder.isHot ? 'is-hot' : ''}`;
    ifBox.innerHTML = `
      <div>
        <div class="ifinder-title">📡 RADAR ITEMFINDER: <strong>${areaInfo.itemfinder.targetName}</strong></div>
        <div style="font-size:0.65rem; color:var(--text-muted);">Item secreto mais próximo no mapa</div>
      </div>
      <div style="text-align:right;">
        <span class="ifinder-dest">${areaInfo.itemfinder.distance} passos</span>
        <div style="font-size:0.65rem; color:var(--primary-yellow); font-weight:700;">${areaInfo.itemfinder.direction}</div>
      </div>
    `;
    elWildEncountersList.appendChild(ifBox);
  }

  // 2. Doações de Pokémon por NPCs na Área
  if (giftsList.length > 0) {
    const title = document.createElement('div');
    title.className = 'radar-category-title';
    title.innerHTML = '🎁 POKÉMONS DADOS POR NPCS / EVENTOS:';
    elWildEncountersList.appendChild(title);

    giftsList.forEach(g => {
      const card = document.createElement('div');
      card.className = `wild-item-card ${g.isInParty ? 'is-captured' : g.isCaughtInDex ? 'is-captured' : 'is-recommended'}`;
      const badge = g.isInParty ? `<span class="level-pill" style="color:var(--success-green);">✅ NA EQUIPA</span>`
                  : g.isCaughtInDex ? `<span class="level-pill" style="color:var(--primary-cyan);">💾 NO PC / REGISTADO</span>`
                  : `<span class="level-pill" style="color:var(--primary-yellow); background:rgba(255,208,0,0.15);">⭐ DISPONÍVEL!</span>`;
      card.innerHTML = `
        <div class="wild-top-row">
          <div>
            ${g.compass ? `<span class="compass-badge" title="Distância: ${g.compass.dist} passos a ${g.compass.direction}">${g.compass.arrow} ${g.compass.dist}p</span>` : ''}
            <span class="wild-mon-name">${g.name}</span>
          </div>
          <div>${badge}</div>
        </div>
        <div class="item-hint-box" style="margin-top:2px;">📍 <b>Onde:</b> ${g.hint}</div>
        <div class="item-importance-box" style="margin-top:2px;">💡 <b>Utilidade:</b> ${g.importance}</div>
      `;
      elWildEncountersList.appendChild(card);
    });
  }

  // 3. Trocas com NPCs na Área
  if (tradesList.length > 0) {
    const title = document.createElement('div');
    title.className = 'radar-category-title';
    title.innerHTML = '🤝 TROCAS DE POKÉMON COM NPCS:';
    elWildEncountersList.appendChild(title);

    tradesList.forEach(t => {
      const card = document.createElement('div');
      card.className = `wild-item-card ${t.isInParty ? 'is-captured' : t.isCaughtInDex ? 'is-captured' : 'is-recommended'}`;
      const badge = t.isInParty ? `<span class="level-pill" style="color:var(--success-green);">✅ NA EQUIPA</span>`
                  : t.isCaughtInDex ? `<span class="level-pill" style="color:var(--primary-cyan);">💾 JÁ OBTIDO</span>`
                  : `<span class="level-pill" style="color:var(--primary-yellow); background:rgba(255,208,0,0.15);">⭐ TROCA DISPONÍVEL!</span>`;
      card.innerHTML = `
        <div class="wild-top-row">
          <div>
            <span class="wild-mon-name">${t.receive} ("${t.nickname}")</span>
            <span class="wild-level-tag">Dá: <b>${t.give}</b></span>
          </div>
          <div>${badge}</div>
        </div>
        <div class="item-hint-box" style="margin-top:2px;">📍 <b>Local:</b> ${t.hint}</div>
        <div class="item-importance-box" style="margin-top:2px;">💡 <b>Utilidade:</b> ${t.importance}</div>
      `;
      elWildEncountersList.appendChild(card);
    });
  }

  // 4. Fauna Selvagem na Relva
  if (wildList.length > 0) {
    const title = document.createElement('div');
    title.className = 'radar-category-title';
    title.innerHTML = '🌿 FAUNA SELVAGEM (POKÉDEX AO VIVO):';
    elWildEncountersList.appendChild(title);

    wildList.forEach(w => {
      const card = document.createElement('div');
      const isParty = w.isInParty;
      const isDex = w.isCaughtInDex;
      const isRec = !isDex && !isParty && (w.rec.includes('RECOMENDADO') || w.rec.includes('TOP TIER') || w.rec.includes('DEVES APANHAR') || w.rec.includes('ESSENCIAL') || w.rec.includes('DEUS'));
      card.className = `wild-item-card ${isParty ? 'is-captured' : isDex ? 'is-captured' : isRec ? 'is-recommended' : ''}`;

      const badgeHtml = isParty
        ? `<span class="level-pill" style="color:var(--success-green); font-weight:800;">👥 NA EQUIPA</span>`
        : isDex
        ? `<span class="level-pill" style="color:var(--primary-cyan); font-weight:800;">✅ POKÉDEX (CAPTURADO)</span>`
        : isRec
        ? `<span class="level-pill" style="color:var(--primary-yellow); background:rgba(255,208,0,0.15); font-weight:800;">⭐ DEVES APANHAR!</span>`
        : `<span class="level-pill">🎯 POR CAPTURAR</span>`;

      const typesHtml = (w.types || []).map(t => `<span class="type-pill type-${t}">${t}</span>`).join('');
      const base = w.baseStats || { hp: 40, atk: 40, def: 40, spd: 40, spc: 40 };

      card.innerHTML = `
        <div class="wild-top-row">
          <div>
            <span class="wild-mon-name">${w.name}</span>
            <span class="wild-level-tag">Lv. ${w.minLv} - ${w.maxLv}</span>
            <div class="types-row" style="margin-top:2px;">${typesHtml}</div>
          </div>
          <div>${badgeHtml}</div>
        </div>

        <div class="wild-chance-container">
          <span class="wild-chance-label">Taxa Encontro:</span>
          <div class="wild-chance-bar">
            <div class="wild-chance-fill" style="width: ${w.chance}%;"></div>
          </div>
          <span class="wild-chance-pct">${w.chance}%</span>
        </div>

        <div class="wild-stats-row">
          <span>HP:<b>${base.hp}</b></span>
          <span>ATK:<b>${base.atk}</b></span>
          <span>DEF:<b>${base.def}</b></span>
          <span>SPD:<b>${base.spd}</b></span>
          <span>SPC:<b>${base.spc}</b></span>
        </div>

        <div class="wild-rec-box">💡 ${w.rec}</div>
      `;
      elWildEncountersList.appendChild(card);
    });
  } else {
    const noGrassMsg = document.createElement('div');
    noGrassMsg.style.cssText = 'color:var(--text-muted); text-align:center; padding:12px; font-size:0.75rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px; margin-top:8px; background:rgba(255,255,255,0.02);';
    noGrassMsg.innerHTML = '🌿 <b>Sem relva ou encontros selvagens nesta secção exterior.</b><br><span style="font-size:0.68rem; color:var(--text-dim);">Entra no Mt. Moon (X:18 Y:5) para explorar a caverna e encontrar Pokémon selvagens!</span>';
    elWildEncountersList.appendChild(noGrassMsg);
  }

  // 5. Itens da Área e Presentes de NPCs
  elAreaItemsList.innerHTML = '';
  const vis = areaInfo.visibleItems || [];
  const hid = areaInfo.hiddenItems || [];

  // Presentes de NPCs (TMs, HMs, Chaves, Vouchers)
  if (npcItemsList.length > 0) {
    const npcTitle = document.createElement('div');
    npcTitle.className = 'radar-category-title';
    npcTitle.innerHTML = '📜 ITENS DADOS POR NPCS & EVENTOS:';
    elAreaItemsList.appendChild(npcTitle);

    npcItemsList.forEach(item => {
      const card = document.createElement('div');
      card.className = 'area-item-card item-available';
      card.innerHTML = `
        <div class="item-top-row">
          <div class="item-name-block">
            <span>🎁</span>
            ${item.compass ? `<span class="compass-badge" title="Distância: ${item.compass.dist} passos a ${item.compass.direction}">${item.compass.arrow} ${item.compass.dist}p</span>` : ''}
            <span class="item-title">${item.name}</span>
          </div>
          <span class="item-badge-pill" style="background:rgba(255,208,0,0.15); color:var(--primary-yellow); border:1px solid rgba(255,208,0,0.3);">EVENTO NPC</span>
        </div>
        <div class="item-hint-box">📍 <b>Como Obter:</b> ${item.hint}</div>
        ${item.condition ? `<div style="font-size:0.68rem; color:#69f0ae;">🔒 <b>Condição:</b> ${item.condition}</div>` : ''}
        ${item.importance ? `<div class="item-importance-box">💡 <b>Utilidade:</b> ${item.importance}</div>` : ''}
      `;
      elAreaItemsList.appendChild(card);
    });
  }

  // Itens Visíveis e Secretos (Filtragem Estrita: Apenas Pendentes em Destaque!)
  const uncollectedVis = vis.filter(item => !item.isCollected);
  const collectedVis = vis.filter(item => item.isCollected);
  const uncollectedHid = hid.filter(item => !item.isCollected);
  const collectedHid = hid.filter(item => item.isCollected);
  const allCollected = [...collectedVis, ...collectedHid];

  // Itens Disponíveis para Apanhar Agora
  const pendingItems = [
    ...uncollectedVis.map(i => ({ ...i, kind: 'visible' })),
    ...uncollectedHid.map(i => ({ ...i, kind: 'hidden' }))
  ];

  if (pendingItems.length > 0) {
    const pendTitle = document.createElement('div');
    pendTitle.className = 'radar-category-title';
    pendTitle.innerHTML = `🔴 ITENS POR APANHAR NESTA ZONA (${pendingItems.length}):`;
    elAreaItemsList.appendChild(pendTitle);

    pendingItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'area-item-card item-available';
      const icon = item.kind === 'hidden' ? '🕵️' : '🔴';
      const tagText = item.kind === 'hidden' ? 'OCULTO (Carrega A)' : 'NO CHÃO';
      const tagClass = item.kind === 'hidden' ? 'item-badge-hidden' : 'item-badge-visible';

      card.innerHTML = `
        <div class="item-top-row">
          <div class="item-name-block">
            <span>${icon}</span>
            ${item.compass ? `<span class="compass-badge ${item.kind === 'hidden' ? 'compass-hidden' : ''}" title="Distância: ${item.compass.dist} passos a ${item.compass.direction}">${item.compass.arrow} ${item.compass.dist}p</span>` : ''}
            <span class="item-title">${item.name}</span>
          </div>
          <span class="item-badge-pill ${tagClass}">${tagText}</span>
        </div>
        <div class="item-hint-box">📍 <b>Local:</b> ${item.hint}</div>
        ${item.importance ? `<div class="item-importance-box">💡 <b>Utilidade:</b> ${item.importance}</div>` : ''}
      `;
      elAreaItemsList.appendChild(card);
    });
  }

  // Barra Resumida de Itens Já Apanhados (Poupa Espaço Precioso!)
  if (allCollected.length > 0) {
    const collBox = document.createElement('div');
    collBox.className = 'collected-items-chip';
    collBox.style.cssText = 'background:rgba(0,230,118,0.06); border:1px solid rgba(0,230,118,0.2); border-radius:6px; padding:4px 8px; font-size:0.68rem; color:#69f0ae; margin-top:6px;';
    collBox.innerHTML = `✅ <b>${allCollected.length} Itens Já Apanhados:</b> ${allCollected.map(c => c.name).join(' • ')}`;
    elAreaItemsList.appendChild(collBox);
  } else if (pendingItems.length === 0 && vis.length === 0 && hid.length === 0) {
    const noItemsBox = document.createElement('div');
    noItemsBox.style.cssText = 'color:var(--text-dim); text-align:center; padding:10px; font-size:0.75rem;';
    noItemsBox.textContent = 'Sem itens no chão neste mapa.';
    elAreaItemsList.appendChild(noItemsBox);
  }

  // 6. Secção Especial: Itens e Eventos Bloqueados / Inacessíveis Nesta Área
  const lockedItems = areaInfo.lockedItems || [];
  const lockedNpcs = areaInfo.lockedNpcItems || [];
  const allLocked = [...lockedItems, ...lockedNpcs];

  if (allLocked.length > 0) {
    const lockedTitle = document.createElement('div');
    lockedTitle.className = 'radar-category-title locked-category-title';
    lockedTitle.innerHTML = '🔒 BLOQUEADO / INACESSÍVEL NESTE MOMENTO:';
    elAreaItemsList.appendChild(lockedTitle);

    allLocked.forEach(item => {
      const card = document.createElement('div');
      card.className = 'area-item-card is-locked-card';
      card.innerHTML = `
        <div class="item-top-row">
          <div class="item-name-block">
            <span>🔒</span>
            <span class="item-title">${item.name}</span>
          </div>
          <span class="item-badge-pill" style="background:rgba(255,82,82,0.15); color:#ff5252; border:1px solid rgba(255,82,82,0.3);">BLOQUEADO</span>
        </div>
        <div class="item-hint-box">📍 <b>Local:</b> ${item.hint || ''}</div>
        ${item.importance ? `<div class="item-importance-box">💡 <b>Utilidade:</b> ${item.importance}</div>` : ''}
        <div class="aitem-lock-reason">⛔ ${item.lockReason || 'Requisito em falta'}</div>
      `;
      elAreaItemsList.appendChild(card);
    });
  }

  if (vis.length === 0 && hid.length === 0 && npcItemsList.length === 0 && allLocked.length === 0) {
    elAreaItemsList.innerHTML = `<div style="color:var(--text-dim); text-align:center; padding:15px; font-size:0.75rem;">Sem itens registados nesta área.</div>`;
  }
}

// Modal Definições RetroArch
btnOpenSettings.addEventListener('click', () => { elSettingsModal.style.display = 'flex'; });
btnCloseSettings.addEventListener('click', () => { elSettingsModal.style.display = 'none'; });
btnCancelSettings.addEventListener('click', () => { elSettingsModal.style.display = 'none'; });

btnSaveSettings.addEventListener('click', async () => {
  const ip = cfgIphoneIp.value.trim();
  const port = parseInt(cfgPort.value.trim(), 10) || 55355;
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    if (res.ok) {
      elSettingsModal.style.display = 'none';
    }
  } catch (err) {
    alert('Erro ao guardar definições');
  }
});

btnToggleTest.addEventListener('click', async () => {
  userManuallyChoseCenterTab = false;
  try {
    const res = await fetch('/api/test-battle', { method: 'POST' });
    const data = await res.json();
    console.log('Simulação de Batalha:', data.inBattle ? 'ATIVADA' : 'DESATIVADA');
  } catch (e) {
    console.error(e);
  }
});

// Exportar Dados para Clipboard (ChatGPT) & Atualização no GitHub
const btnExportTelemetry = document.getElementById('btn-export-telemetry');
const elExportBtnLabel = document.getElementById('export-btn-label');

if (btnExportTelemetry) {
  btnExportTelemetry.addEventListener('click', async () => {
    btnExportTelemetry.disabled = true;
    if (elExportBtnLabel) elExportBtnLabel.textContent = 'A sincronizar GitHub...';
    try {
      const res = await fetch('/api/export-markdown');
      const data = await res.json();
      if (data.markdown) {
        await navigator.clipboard.writeText(data.markdown);
        btnExportTelemetry.classList.add('copied');
        const ts = data.timestamp || new Date().toLocaleTimeString('pt-PT');
        if (elExportBtnLabel) elExportBtnLabel.textContent = `✅ Copiado & GitHub (${ts})!`;

        const elGithubLink = document.getElementById('hud-github-link');
        if (elGithubLink) {
          elGithubLink.textContent = `🌐 GitHub (${ts})`;
          elGithubLink.title = `Última sincronização no GitHub: ${ts}`;
        }

        setTimeout(() => {
          btnExportTelemetry.classList.remove('copied');
          if (elExportBtnLabel) elExportBtnLabel.textContent = 'Exportar Dados';
          btnExportTelemetry.disabled = false;
        }, 3500);
      }
    } catch (err) {
      console.error('Erro ao exportar telemetria:', err);
      if (elExportBtnLabel) elExportBtnLabel.textContent = 'Erro ao copiar';
      setTimeout(() => {
        if (elExportBtnLabel) elExportBtnLabel.textContent = 'Exportar Dados';
        btnExportTelemetry.disabled = false;
      }, 2000);
    }
  });
}

// Inicia ligação WebSocket
connectWebSocket();
