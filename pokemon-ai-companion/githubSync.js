const fs = require('fs');
const path = require('path');

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    return process.env.GITHUB_TOKEN.trim();
  }
  const tokenPaths = [
    path.join(__dirname, '.github_token'),
    path.join(__dirname, '..', '.github_token')
  ];
  for (const p of tokenPaths) {
    if (fs.existsSync(p)) {
      try {
        const val = fs.readFileSync(p, 'utf8').trim();
        if (val) return val;
      } catch (e) {}
    }
  }
  return '';
}

const GITHUB_TOKEN = getGitHubToken();
const REPO_OWNER = 'ApexScorpio';
const REPO_NAME = 'pokemon-red-telemetry';
const FILE_PATH = 'README.md';

const { INTERNAL_TO_POKEMON } = require('./data/pokemonData');

let lastSyncTime = 0;

function saveLocalTelemetryFiles(markdown) {
  if (!markdown) return;
  const targets = [
    path.join(__dirname, 'README.md'),
    path.join(__dirname, 'telemetria.md'),
    path.join(__dirname, 'public', 'telemetria.md'),
    path.join(__dirname, 'public', 'telemetria.txt'),
    path.join(__dirname, '..', 'README.md'),
    path.join(__dirname, '..', 'telemetria.md'),
    path.join(__dirname, '..', 'public', 'telemetria.md'),
    path.join(__dirname, '..', 'public', 'telemetria.txt')
  ];
  targets.forEach(p => {
    try {
      fs.writeFileSync(p, markdown, 'utf8');
    } catch (e) {}
  });
}

// Formata todos os dados da RAM do jogo em Markdown limpo, estruturado e organizado em 3 partes para o ChatGPT
function formatTelemetryMarkdown(state) {
  if (!state) return '# 🎮 Pokémon Red • Telemetria Indisponível\n';

  const dateStr = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const isBattle = state.inBattle && state.battle;
  const party = state.party || [];
  const inv = state.inventory || [];
  const badges = state.badges || [];
  const area = state.areaInfo || {};
  const boss = area.upcomingBoss || null;
  const pc = state.pcBox || { boxNum: 1, count: 0, freeSlots: 20, pokemon: [] };

  let md = `# 🎮 Pokémon Red • Telemetria ao Vivo (Gen 1)\n`;
  md += `> **ROM Validada:** \`${state.romValidation || 'Pokémon Red (USA/Europe) - Game Boy SGB Enhanced (Gen 1)'}\`\n`;
  md += `> **Sincronizado diretamente da memória RAM via RetroArch** • **Data:** **${dateStr}**\n\n`;

  // =========================================================================
  // PARTE A: ESTADO ATUAL (TELEMETRIA VIVA)
  // =========================================================================
  md += `# 🟢 PARTE A: ESTADO ATUAL (Telemetria Viva)\n\n`;

  // 1. Localização e Estado Exato do Jogo
  md += `## 🧭 1. Localização e Estado Exato do Jogo\n`;
  md += `- **Treinador:** \`${state.trainerName || 'RED'}\` | **Rival:** \`${state.rivalName || 'BLUE'}\`\n`;
  md += `- **Localização Atual:** **${state.mapName || 'Desconhecido'}** (ID Interno: \`0x${(state.mapId || 0).toString(16).toUpperCase()}\`)\n`;
  if (state.coords) {
    md += `- **Coordenadas do Mapa (Azulejo / Tile):** X: \`${state.coords.x}\`, Y: \`${state.coords.y}\`\n`;
  }
  md += `- **Direção de RED:** **${state.playerDirection || 'Sul (Baixo ⬇️)'}**\n`;
  md += `- **Estado Atual do Jogador:** **${state.playerMode || '🗺️ Exploração Livre a Pé'}**\n`;
  if (state.playTime) {
    md += `- **Tempo de Jogo:** \`${state.playTime}\`\n`;
  }
  if (state.currentDialog) {
    md += `- **💬 Diálogo / Mensagem no Ecrã:** \`${state.currentDialog}\`\n`;
  }
  md += `- **Dinheiro:** **${(state.money || 0).toLocaleString()} ₽**${state.coins !== undefined ? ` • **Fichas do Casino:** \`${state.coins}\`` : ''}\n`;
  if (state.stepCounter !== undefined) {
    md += `- **Contador de Passos de Encontro:** \`${state.stepCounter}\` passos\n`;
  }
  if (state.repelSteps && state.repelSteps > 0) {
    md += `- **Repelente Ativo:** 🧴 \`${state.repelSteps}\` passos restantes\n`;
  }
  md += `\n`;

  // 2. Batalha em Tempo Real
  md += `## ⚔️ 2. Batalha em Tempo Real\n`;
  if (isBattle) {
    const b = state.battle;
    const enemy = b.enemy;
    const player = b.playerActive;
    const strat = b.strategy;

    md += `- **Modo de Combate:** ⚔️ **EM BATALHA REAL (${state.battleType === 'Trainer' ? 'Treinador' : 'Selvagem'})**\n`;
    md += `- **Turno Atual:** \`Turno #${b.turn || 1}\`\n`;
    if (b.lastPlayerMove) md += `- **Último Golpe Usado por RED:** \`${b.lastPlayerMove}\`\n`;
    if (b.lastEnemyMove) md += `- **Último Golpe Usado pelo Adversário:** \`${b.lastEnemyMove}\`\n`;

    if (enemy) {
      md += `\n### 🔴 Adversário em Campo: **${enemy.name}** (Lv. ${enemy.level})\n`;
      md += `- **Tipos:** ${(enemy.types || []).join('/')}\n`;
      md += `- **HP:** **${enemy.hp} / ${enemy.maxHp}** (${Math.round((enemy.hp / enemy.maxHp) * 100)}%)\n`;
      md += `- **Stats de Batalha:** ATK: ${enemy.stats?.attack || '--'} | DEF: ${enemy.stats?.defense || '--'} | SPD: ${enemy.stats?.speed || '--'} | SPC: ${enemy.stats?.special || '--'}\n`;
      if (enemy.moves && enemy.moves.length > 0) {
        md += `- **Os 4 Golpes do Adversário:**\n`;
        enemy.moves.forEach(m => {
          if (typeof m === 'object') {
            md += `  - **${m.name}** (${m.type}) • PP: ${m.pp} • Poder: ${m.power || '--'} • Precisão: ${m.accuracy || 100}%\n`;
          } else {
            md += `  - **${m}**\n`;
          }
        });
      }
      if (strat && strat.enemyThreats && strat.enemyThreats.length > 0) {
        md += `- **⚠️ Previsão de Dano do Adversário no Teu Pokémon:**\n`;
        strat.enemyThreats.forEach(t => {
          md += `  - **${t.name}** (${t.type}) ➔ ${t.threatLabel}\n`;
        });
      }
    }

    if (player) {
      md += `\n### 🔵 O Teu Pokémon em Campo: **${player.name}** (Lv. ${player.level})\n`;
      md += `- **Tipos:** ${(player.types || []).join('/')}\n`;
      md += `- **HP:** **${player.hp} / ${player.maxHp}** (${player.status || 'HEALTHY'})\n`;
      md += `- **Stats com Modificadores:** ATK: ${player.stats?.attack || '--'} (${player.statMods?.attack?.label || '0'}) | DEF: ${player.stats?.defense || '--'} (${player.statMods?.defense?.label || '0'}) | SPD: ${player.stats?.speed || '--'} (${player.statMods?.speed?.label || '0'}) | SPC: ${player.stats?.special || '--'} (${player.statMods?.special?.label || '0'})\n`;
    }

    if (strat) {
      md += `\n### 🎯 Análise Tática Matemática & Decisão\n`;
      md += `- **Classificação do Confronto:** **${strat.matchupRating || 'EQUILIBRADO'}**\n`;
      if (strat.bestMove) {
        md += `- **⭐ Melhor Golpe Matemático:** **${strat.bestMove.name}** (${strat.bestMove.type}) ➔ Dano: **${strat.bestMove.dmgMin}-${strat.bestMove.dmgMax} HP** (${strat.bestMove.effectiveness}x eficácia)${strat.bestMove.hitsToKo === 1 ? ' • K.O. GARANTIDO EM 1 GOLPE!' : ` • ~${strat.bestMove.hitsToKo} turnos para K.O.`}\n`;
      }
      if (strat.optimalCombo) {
        md += `\n#### ⚡ Sequência Ótima de Ataques (Sobrevivência: ${strat.optimalCombo.survivalPercent}%)\n`;
        strat.optimalCombo.sequence.forEach(s => {
          md += `- ➔ ${s}\n`;
        });
        md += `> **Resumo Tático:** ${strat.optimalCombo.summary}\n`;
      }
      if (strat.switchAdvisor) {
        const sw = strat.switchAdvisor;
        md += `\n#### 🔄 Conselheiro de Troca: **${sw.actionTitle}**\n`;
        md += `- **Decisão:** ${sw.shouldSwitch ? '🚨 DEVES MUDAR DE POKÉMON' : '✅ DEVES MANTER O POKÉMON ATUAL'}\n`;
        if (sw.targetMon) {
          md += `- **Substituto Sugerido:** **${sw.targetMon.name} (Lv. ${sw.targetMon.level})** [${sw.targetMon.hp}/${sw.targetMon.maxHp} HP]\n`;
        }
        md += `- **Motivo:** ${sw.reason}\n`;
        if (sw.expCandidate) {
          md += `- **⭐ Prioridade de Treino (EXP):** **${sw.expCandidate.name} (Lv. ${sw.expCandidate.level})** é o mais fraco da tua equipa e deve receber prioridade de EXP quando for seguro!\n`;
        }
      }
      if (strat.catchChance && state.battleType === 'Wild') {
        md += `\n- **Probabilidade de Captura com HP Atual:** Poké Ball: **${strat.catchChance.pokeball}%** | Great Ball: **${strat.catchChance.greatball}%** | Ultra Ball: **${strat.catchChance.ultraball}%**\n`;
        md += `  - *Se adormeceres o inimigo:* **~${strat.catchChance.withSleep || 45}%** | *Com HP no vermelho:* **~${strat.catchChance.withRedHp || 60}%**\n`;
      }
    }
  } else {
    md += `- **Estado:** 🗺️ **Fora de Combate (Exploração Livre)**\n`;
    if (boss && boss.battles && boss.battles.length > 0) {
      const nextB = boss.battles.find(b => !b.isDefeated && !b.isMissed);
      if (nextB) {
        md += `- **🎯 Próximo Alvo de Batalha na Área:** **${nextB.name}** (${nextB.location})\n`;
        md += `  - **Equipa Adversária:** ${nextB.enemyRoster}\n`;
        md += `  - **Lead Recomendado:** ${nextB.optimalLead}\n`;
        md += `  - **Estratégia:** ${nextB.strategyText}\n`;
      }
    }
  }
  md += `\n`;

  // 3. Equipa Atual (Party)
  md += `## 👥 3. Equipa Atual (${party.length}/6 Pokémon) • Vagas Livres: **${6 - party.length}**\n`;
  if (party.length === 0) {
    md += `*Equipa a carregar da memória...*\n\n`;
  } else {
    party.forEach((p, idx) => {
      md += `### ${idx + 1}. **${p.name}** (Lv. ${p.level})${p.isInBattle ? ' ⚔️ [EM COMBATE]' : ''}\n`;
      md += `- **Tipos:** ${(p.types || []).join('/')} | **HP:** ${p.hp} / ${p.maxHp} ${p.hp === 0 ? '❌ (FAINTED)' : p.status !== 'HEALTHY' ? `⚠️ (${p.status})` : '✅ (SAUDÁVEL)'}\n`;
      if (p.stats) {
        md += `- **Stats Reais:** ATK: ${p.stats.attack} | DEF: ${p.stats.defense} | SPD: ${p.stats.speed} | SPC: ${p.stats.special}\n`;
      }
      if (p.dvs) {
        md += `- **DVs Gen 1 (0–15):** Ataque: ${p.dvs.attack} | Defesa: ${p.dvs.defense} | Velocidade: ${p.dvs.speed} | Especial: ${p.dvs.special} | HP: ${p.dvs.hp}\n`;
      }
      if (p.statExp) {
        md += `- **Stat Experience (0–65.535):** Atk: ${p.statExp.attack} | Def: ${p.statExp.defense} | Spd: ${p.statExp.speed} | Spc: ${p.statExp.special} | HP: ${p.statExp.hp}\n`;
      }
      if (p.exp) {
        md += `- **Experiência:** ${p.exp.current.toLocaleString()} EXP (Progresso: ${p.exp.percent}%, faltam ${p.exp.needed > 0 ? `${p.exp.needed} p/ Lv.${p.level + 1}` : '0'})\n`;
      }
      if (p.moves && p.moves.length > 0) {
        md += `- **Golpes & PPs:**\n`;
        p.moves.forEach(m => {
          md += `  - **${m.name}** (${m.type}) — PP: ${m.pp} | Poder: ${m.power || '--'} | Precisão: ${m.accuracy || 100}%\n`;
        });
      }
      md += `\n`;
    });
  }

  // 4. Mochila & Recursos
  const cap = state.inventoryCapacity || { total: 20, occupied: inv.length, free: Math.max(0, 20 - inv.length) };
  md += `## 🎒 4. Mochila & Recursos • Capacidade: **${cap.occupied} / ${cap.total} slots** (${cap.free} vagas livres)\n`;
  if (inv.length === 0) {
    md += `*Mochila vazia.*\n\n`;
  } else {
    inv.forEach(it => {
      md += `- **${it.name}** x${it.qty}\n`;
    });
    md += `\n`;
  }

  // =========================================================================
  // PARTE B: PROGRESSO PERMANENTE
  // =========================================================================
  md += `# 🏛️ PARTE B: PROGRESSO PERMANENTE\n\n`;

  // 5. Pokédex Completa
  const ownedCount = state.pokedexOwnedCount || (state.pokedexOwned ? state.pokedexOwned.length : 0);
  const seenCount = state.pokedexSeenCount || (state.pokedexSeen ? state.pokedexSeen.length : 0);
  const totalLiving = state.totalPokemonOwned || (party.length + pc.count);
  md += `## 📖 5. Coleção da Pokédex (Kanto Gen 1)\n`;
  md += `- **Espécies Registadas na Pokédex:** **${ownedCount} / 151** (Espécies Desbloqueadas)\n`;
  md += `- **Espécies Vistas na Pokédex:** **${seenCount} / 151**\n`;
  md += `- **Total de Pokémon Individuais Ativos:** **${totalLiving} espécimes** (${party.length} na Equipa + ${pc.count} no PC)\n`;
  if (state.pokedexOwned && state.pokedexOwned.length > 0) {
    const ownedNames = state.pokedexOwned.map(dex => {
      const entry = Object.values(INTERNAL_TO_POKEMON).find(pk => pk.dex === dex);
      return entry ? `#${dex} ${entry.name}` : `#${dex}`;
    });
    md += `- **Espécies Registadas na Pokédex:** ${ownedNames.join(', ')}\n`;
  }
  md += `\n`;

  // 6. Pokémon no PC
  md += `## 💾 6. Pokémon Guardados no PC (${pc.count} / 20 na Caixa ${pc.boxNum}) • Vagas Livres: **${pc.freeSlots}**\n`;
  if (!pc.pokemon || pc.pokemon.length === 0) {
    md += `*Caixa ${pc.boxNum} vazia.*\n\n`;
  } else {
    pc.pokemon.forEach((p, idx) => {
      const typeStr = (p.types && p.types.length > 0) ? ` • Tipos: ${p.types.join('/')}` : '';
      const lvlStr = p.level ? ` (Lv. ${p.level})` : '';
      const hpStr = (p.curHp !== undefined && p.curHp !== null && p.curHp > 0) ? ` • HP: ${p.curHp}` : '';
      const movesStr = (p.moves && p.moves.length > 0) ? ` • Golpes: ${p.moves.join(', ')}` : '';
      md += `- #${idx + 1}: **${p.name}**${lvlStr}${typeStr} (Dex: #${p.dex})${hpStr}${movesStr}\n`;
    });
    md += `\n`;
  }

  // 7. Insígnias de Ginásio (8 Oficiais de Kanto)
  const officialBadges = [
    { name: 'Boulder Badge', city: 'Pewter City', leader: 'Brock', type: 'Rocha' },
    { name: 'Cascade Badge', city: 'Cerulean City', leader: 'Misty', type: 'Água' },
    { name: 'Thunder Badge', city: 'Vermilion City', leader: 'Lt. Surge', type: 'Elétrico' },
    { name: 'Rainbow Badge', city: 'Celadon City', leader: 'Erika', type: 'Planta' },
    { name: 'Soul Badge', city: 'Fuchsia City', leader: 'Koga', type: 'Veneno' },
    { name: 'Marsh Badge', city: 'Saffron City', leader: 'Sabrina', type: 'Psíquico' },
    { name: 'Volcano Badge', city: 'Cinnabar Island', leader: 'Blaine', type: 'Fogo' },
    { name: 'Earth Badge', city: 'Viridian City', leader: 'Giovanni', type: 'Terra' }
  ];

  md += `## 🏆 7. Insígnias de Ginásio (8 Oficiais de Kanto)\n`;
  officialBadges.forEach((bDef, idx) => {
    const isGot = badges.some(b => b.name && b.name.includes(bDef.name) && b.obtained);
    const statusMark = isGot ? '✅ [CONQUISTADA]' : idx === 0 ? '⚔️ [POR CONQUISTAR - Faz Agora!]' : '⏳ [BLOQUEADA]';
    md += `- **${idx + 1}. ${bDef.name}** (${bDef.city} • ${bDef.leader} • Tipo: ${bDef.type}): ${statusMark}\n`;
  });
  md += `\n`;

  // 8. Progresso da História & Treinadores Derrotados
  md += `## 🗺️ 8. Progresso da História & Treinadores Derrotados\n`;
  if (boss && boss.battles && boss.battles.length > 0) {
    boss.battles.forEach((bt, idx) => {
      const compassTag = bt.compass ? `[${bt.compass.arrow} ${bt.compass.dist} passos ${bt.compass.direction}] ` : '';
      md += `### #${idx + 1}. ${compassTag}**${bt.name}** (${bt.location}) • **${bt.statusLabel}**\n`;
      md += `- **Dificuldade:** ${bt.difficulty}\n`;
      md += `- **Roster Inimigo:** ${bt.enemyRoster}\n`;
      md += `- **Lead Recomendado:** ${bt.optimalLead}\n`;
      if (bt.idealLineup && bt.idealLineup.length > 0) {
        md += `- **Ordem Ideal da Equipa (Slots 1 a 6):**\n`;
        bt.idealLineup.forEach(l => {
          md += `  - **Slot #${l.slot}**: **${l.name}** (Lv. ${l.level}) — *${l.role}*: ${l.note}\n`;
        });
      }
      md += `- **Estratégia:** ${bt.strategyText}\n\n`;
    });
  }

  // 9. Itens no Chão e Ocultos na Área Atual
  const visItems = area.visibleItems || [];
  const hidItems = area.hiddenItems || [];
  if (visItems.length > 0 || hidItems.length > 0) {
    md += `## 🎒 9. Itens da Área (${area.name || state.mapName || 'Local'})\n`;
    if (visItems.length > 0) {
      md += `### Itens no Chão (Poké Balls visíveis):\n`;
      visItems.forEach(it => {
        md += `- **${it.name}** (X: ${it.x}, Y: ${it.y}) • Estado: ${it.isCollected ? '✅ Já Recolhido' : '🔴 Por Apanhar'}${it.hint ? ` — *${it.hint}*` : ''}\n`;
      });
      md += `\n`;
    }
    if (hidItems.length > 0) {
      md += `### Itens Ocultos (Invisíveis no chão):\n`;
      hidItems.forEach(it => {
        md += `- **${it.name}** (X: ${it.x}, Y: ${it.y}) • Estado: ${it.isCollected ? '✅ Já Recolhido' : '🔴 Por Apanhar'}${it.hint ? ` — *${it.hint}*` : ''}\n`;
      });
      md += `\n`;
    }
  }

  // =========================================================================
  // PARTE C: HISTÓRICO RECENTE & LOGS DE BATALHA
  // =========================================================================
  md += `# 📜 PARTE C: HISTÓRICO RECENTE & LOGS DE BATALHA\n\n`;

  // Log de Ações e Batalhas em Tempo Real (Turno a Turno)
  let actionHistory = state.actionHistory || [];
  if (actionHistory.length === 0) {
    try {
      const p = path.join(__dirname, 'data', 'battle_history_log.jsonl');
      if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
        actionHistory = lines.slice(-20).map(l => JSON.parse(l)).reverse();
      }
    } catch (e) {}
  }

  if (actionHistory.length > 0) {
    md += `## ⚔️ Registo de Ações e Batalhas (Turno a Turno)\n`;
    actionHistory.slice(0, 15).forEach(a => {
      if (a.type === 'BATTLE_ACTION') {
        md += `- [${a.time}] **Turno #${a.turn}**: ${a.playerActive ? `${a.playerActive.name} (${a.playerActive.hp}/${a.playerActive.maxHp} HP)` : 'RED'} vs ${a.enemy ? `${a.enemy.name} (Lv. ${a.enemy.level || '--'} • ${a.enemy.hp}/${a.enemy.maxHp} HP)` : 'Inimigo'}${a.lastPlayerMove ? ` • Golpe RED: \`${a.lastPlayerMove}\`` : ''}${a.lastEnemyMove ? ` • Golpe Inimigo: \`${a.lastEnemyMove}\`` : ''}\n`;
      } else if (a.type === 'BATTLE_END') {
        md += `- [${a.time}] 🏁 **${a.summary}** (${a.enemy})\n`;
      }
    });
    md += `\n`;
  }

  const history = state.recentHistory || [];
  if (history.length === 0) {
    md += `- [${dateStr.split(' ')[1] || 'Recente'}] Sincronização inicial com o emulador RetroArch concluída com sucesso.\n`;
  } else {
    history.forEach(h => {
      md += `- [${h.time}] ${h.text}\n`;
    });
  }
  md += `\n`;

  // Histórico de Diálogos & Mensagens do Jogo
  let dialogHistory = state.dialogHistory || [];
  if (dialogHistory.length === 0) {
    try {
      const p = path.join(__dirname, 'data', 'dialog_history_log.jsonl');
      if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
        dialogHistory = lines.slice(-20).map(l => JSON.parse(l)).reverse();
      }
    } catch (e) {}
  }

  if (dialogHistory.length > 0) {
    md += `### 💬 Últimos Diálogos & Mensagens com NPCs (Memória do Ecrã):\n`;
    dialogHistory.slice(0, 15).forEach(d => {
      md += `- [${d.time}] \`${d.text}\`\n`;
    });
    md += `\n`;
  }

  // Grok AI Live Strategy Box
  if (state.aiAdvice) {
    md += `## 🧠 Conselho Tático do Grok AI\n`;
    md += `> "${state.aiAdvice}"\n\n`;
  }

  md += `---\n*Link permanente deste ficheiro:* [https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/README.md](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/README.md)\n`;
  saveLocalTelemetryFiles(md);
  return md;
}

let isSyncing = false;
let pendingStateToSync = null;
let syncTimeout = null;
let lastSyncTimeString = 'Nunca';

// Sincroniza o ficheiro README.md no repositório GitHub ApexScorpio/pokemon-red-telemetry
async function syncToGitHub(state) {
  if (!GITHUB_TOKEN) return false;
  try {
    const markdown = formatTelemetryMarkdown(state);
    const contentBase64 = Buffer.from(markdown, 'utf-8').toString('base64');

    // Obtém sempre o SHA mais recente diretamente da API para evitar erros 409 Conflict
    let currentSha = null;
    try {
      const getRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'User-Agent': 'Pokemon-AI-Companion',
          'Cache-Control': 'no-cache'
        }
      });
      if (getRes.ok) {
        const getData = await getRes.json();
        currentSha = getData.sha;
      }
    } catch (e) {
      // Ignora erro de get
    }

    const timeStr = new Date().toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon' });
    const body = {
      message: `Live Telemetry [${timeStr}]: ${state.mapName || 'Map'} - ${state.inBattle ? 'Combat' : 'Exploration'}`,
      content: contentBase64
    };
    if (currentSha) {
      body.sha = currentSha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Pokemon-AI-Companion'
      },
      body: JSON.stringify(body)
    });

    if (putRes.ok) {
      lastSyncTime = Date.now();
      lastSyncTimeString = timeStr;
      console.log(`[GitHubSync] Telemetria sincronizada com sucesso em ${REPO_OWNER}/${REPO_NAME} (${timeStr})`);
      return { success: true, timestamp: timeStr };
    } else {
      const err = await putRes.text();
      console.error('[GitHubSync Error]:', err);
      return { success: false, error: err };
    }
  } catch (err) {
    console.error('[GitHubSync Network Error]:', err.message);
    return { success: false, error: err.message };
  }
}

let lastSyncedFingerprint = '';

function getStateFingerprint(state) {
  if (!state) return '';
  return `${state.mapId || 0}_${state.coords ? `${state.coords.x},${state.coords.y}` : ''}_${state.playerDirection || ''}_${state.inBattle}_${state.battle ? `${state.battle.turn}_${state.battle.enemy ? state.battle.enemy.hp : ''}_${state.battle.playerActive ? state.battle.playerActive.hp : ''}` : ''}_${state.currentDialog || ''}_${state.money || 0}`;
}

// Disparo periódico e seguro com deteção de alterações
function triggerDebouncedSync(state) {
  if (!state) return;

  // Atualização em disco local em tempo real (a cada ~700ms)
  try {
    const md = formatTelemetryMarkdown(state);
    saveLocalTelemetryFiles(md);
  } catch (e) {}

  const currentFingerprint = getStateFingerprint(state);
  // Se não houve alteração no jogo desde o último envio para o GitHub, evita pedidos redundantes
  if (currentFingerprint === lastSyncedFingerprint && !state.inBattle) {
    return;
  }

  pendingStateToSync = state;
  if (isSyncing) return;

  const now = Date.now();
  const timeSinceLast = now - lastSyncTime;
  // Intervalo rápido de 3 segundos quando há alterações ativas (evita bloqueio secundário da API do GitHub)
  const MIN_INTERVAL = state.inBattle ? 2500 : 3500;

  if (timeSinceLast >= MIN_INTERVAL) {
    executeQueuedSync();
  } else if (!syncTimeout) {
    syncTimeout = setTimeout(() => {
      syncTimeout = null;
      executeQueuedSync();
    }, MIN_INTERVAL - timeSinceLast);
  }
}

async function executeQueuedSync() {
  if (!pendingStateToSync || isSyncing) return;
  isSyncing = true;
  const state = pendingStateToSync;
  pendingStateToSync = null;

  try {
    const res = await syncToGitHub(state);
    if (res && res.success) {
      lastSyncedFingerprint = getStateFingerprint(state);
    }
  } finally {
    isSyncing = false;
    lastSyncTime = Date.now();
    if (pendingStateToSync) {
      triggerDebouncedSync(pendingStateToSync);
    }
  }
}

function getLastSyncTimeString() {
  return lastSyncTimeString || '--:--:--';
}

module.exports = {
  formatTelemetryMarkdown,
  syncToGitHub,
  triggerDebouncedSync,
  getLastSyncTimeString,
  GITHUB_FILE_URL: `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/${FILE_PATH}`,
  GITHUB_RAW_URL: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`
};
