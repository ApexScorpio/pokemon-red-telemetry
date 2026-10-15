// MÃƒÂ³dulo de SincronizaÃƒÂ§ÃƒÂ£o AutomÃƒÂ¡tica com o GitHub (ApexScorpio/pokemon-red-telemetry)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'ApexScorpio';
const REPO_NAME = 'pokemon-red-telemetry';
const FILE_PATH = 'README.md';

const { INTERNAL_TO_POKEMON } = require('./data/pokemonData');

let lastSyncTime = 0;

// Formata todos os dados da RAM do jogo em Markdown limpo, estruturado e organizado em 3 partes para o ChatGPT
function formatTelemetryMarkdown(state) {
  if (!state) return '# Ã°Å¸Å½Â® PokÃƒÂ©mon Red Ã¢â‚¬Â¢ Telemetria IndisponÃƒÂ­vel\n';

  const dateStr = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const isBattle = state.inBattle && state.battle;
  const party = state.party || [];
  const inv = state.inventory || [];
  const badges = state.badges || [];
  const area = state.areaInfo || {};
  const boss = area.upcomingBoss || null;
  const pc = state.pcBox || { boxNum: 1, count: 0, freeSlots: 20, pokemon: [] };

  let md = `# Ã°Å¸Å½Â® PokÃƒÂ©mon Red Ã¢â‚¬Â¢ Telemetria ao Vivo (Gen 1)\n`;
  md += `> **ROM Validada:** \`${state.romValidation || 'PokÃƒÂ©mon Red (USA/Europe) - Game Boy SGB Enhanced (Gen 1)'}\`\n`;
  md += `> **Sincronizado diretamente da memÃƒÂ³ria RAM via RetroArch** Ã¢â‚¬Â¢ **Data:** **${dateStr}**\n\n`;

  // =========================================================================
  // PARTE A: ESTADO ATUAL (TELEMETRIA VIVA)
  // =========================================================================
  md += `# Ã°Å¸Å¸Â¢ PARTE A: ESTADO ATUAL (Telemetria Viva)\n\n`;

  // 1. LocalizaÃƒÂ§ÃƒÂ£o e Estado Exato do Jogo
  md += `## Ã°Å¸Â§Â­ 1. LocalizaÃƒÂ§ÃƒÂ£o e Estado Exato do Jogo\n`;
  md += `- **Treinador:** \`${state.trainerName || 'RED'}\` | **Rival:** \`${state.rivalName || 'BLUE'}\`\n`;
  md += `- **LocalizaÃƒÂ§ÃƒÂ£o Atual:** **${state.mapName || 'Desconhecido'}** (ID Interno: \`0x${(state.mapId || 0).toString(16).toUpperCase()}\`)\n`;
  if (state.coords) {
    md += `- **Coordenadas do Mapa (Azulejo / Tile):** X: \`${state.coords.x}\`, Y: \`${state.coords.y}\`\n`;
  }
  md += `- **DireÃƒÂ§ÃƒÂ£o de RED:** **${state.playerDirection || 'Sul (Baixo Ã¢Â¬â€¡Ã¯Â¸Â)'}**\n`;
  md += `- **Estado Atual do Jogador:** **${state.playerMode || 'Ã°Å¸â€”ÂºÃ¯Â¸Â ExploraÃƒÂ§ÃƒÂ£o Livre a PÃƒÂ©'}**\n`;
  if (state.playTime) {
    md += `- **Tempo de Jogo:** \`${state.playTime}\`\n`;
  }
  if (state.currentDialog) {
    md += `- **Ã°Å¸â€™Â¬ DiÃƒÂ¡logo / Mensagem no EcrÃƒÂ£:** \`${state.currentDialog}\`\n`;
  }
  md += `- **Dinheiro:** **${(state.money || 0).toLocaleString()} Ã¢â€šÂ½**${state.coins !== undefined ? ` Ã¢â‚¬Â¢ **Fichas do Casino:** \`${state.coins}\`` : ''}\n`;
  if (state.stepCounter !== undefined) {
    md += `- **Contador de Passos de Encontro:** \`${state.stepCounter}\` passos\n`;
  }
  if (state.repelSteps && state.repelSteps > 0) {
    md += `- **Repelente Ativo:** Ã°Å¸Â§Â´ \`${state.repelSteps}\` passos restantes\n`;
  }
  md += `\n`;

  // 2. Batalha em Tempo Real
  md += `## Ã¢Å¡â€Ã¯Â¸Â 2. Batalha em Tempo Real\n`;
  if (isBattle) {
    const b = state.battle;
    const enemy = b.enemy;
    const player = b.playerActive;
    const strat = b.strategy;

    md += `- **Modo de Combate:** Ã¢Å¡â€Ã¯Â¸Â **EM BATALHA REAL (${state.battleType === 'Trainer' ? 'Treinador' : 'Selvagem'})**\n`;
    md += `- **Turno Atual:** \`Turno #${b.turn || 1}\`\n`;
    if (b.lastPlayerMove) md += `- **ÃƒÅ¡ltimo Golpe Usado por RED:** \`${b.lastPlayerMove}\`\n`;
    if (b.lastEnemyMove) md += `- **ÃƒÅ¡ltimo Golpe Usado pelo AdversÃƒÂ¡rio:** \`${b.lastEnemyMove}\`\n`;

    if (enemy) {
      md += `\n### Ã°Å¸â€Â´ AdversÃƒÂ¡rio em Campo: **${enemy.name}** (Lv. ${enemy.level})\n`;
      md += `- **Tipos:** ${(enemy.types || []).join('/')}\n`;
      md += `- **HP:** **${enemy.hp} / ${enemy.maxHp}** (${Math.round((enemy.hp / enemy.maxHp) * 100)}%)\n`;
      md += `- **Stats de Batalha:** ATK: ${enemy.stats?.attack || '--'} | DEF: ${enemy.stats?.defense || '--'} | SPD: ${enemy.stats?.speed || '--'} | SPC: ${enemy.stats?.special || '--'}\n`;
      if (enemy.moves && enemy.moves.length > 0) {
        md += `- **Os 4 Golpes do AdversÃƒÂ¡rio:**\n`;
        enemy.moves.forEach(m => {
          if (typeof m === 'object') {
            md += `  - **${m.name}** (${m.type}) Ã¢â‚¬Â¢ PP: ${m.pp} Ã¢â‚¬Â¢ Poder: ${m.power || '--'} Ã¢â‚¬Â¢ PrecisÃƒÂ£o: ${m.accuracy || 100}%\n`;
          } else {
            md += `  - **${m}**\n`;
          }
        });
      }
      if (strat && strat.enemyThreats && strat.enemyThreats.length > 0) {
        md += `- **Ã¢Å¡Â Ã¯Â¸Â PrevisÃƒÂ£o de Dano do AdversÃƒÂ¡rio no Teu PokÃƒÂ©mon:**\n`;
        strat.enemyThreats.forEach(t => {
          md += `  - **${t.name}** (${t.type}) Ã¢Å¾â€ ${t.threatLabel}\n`;
        });
      }
    }

    if (player) {
      md += `\n### Ã°Å¸â€Âµ O Teu PokÃƒÂ©mon em Campo: **${player.name}** (Lv. ${player.level})\n`;
      md += `- **Tipos:** ${(player.types || []).join('/')}\n`;
      md += `- **HP:** **${player.hp} / ${player.maxHp}** (${player.status || 'HEALTHY'})\n`;
      md += `- **Stats com Modificadores:** ATK: ${player.stats?.attack || '--'} (${player.statMods?.attack?.label || '0'}) | DEF: ${player.stats?.defense || '--'} (${player.statMods?.defense?.label || '0'}) | SPD: ${player.stats?.speed || '--'} (${player.statMods?.speed?.label || '0'}) | SPC: ${player.stats?.special || '--'} (${player.statMods?.special?.label || '0'})\n`;
    }

    if (strat) {
      md += `\n### Ã°Å¸Å½Â¯ AnÃƒÂ¡lise TÃƒÂ¡tica MatemÃƒÂ¡tica & DecisÃƒÂ£o\n`;
      md += `- **ClassificaÃƒÂ§ÃƒÂ£o do Confronto:** **${strat.matchupRating || 'EQUILIBRADO'}**\n`;
      if (strat.bestMove) {
        md += `- **Ã¢Â­Â Melhor Golpe MatemÃƒÂ¡tico:** **${strat.bestMove.name}** (${strat.bestMove.type}) Ã¢Å¾â€ Dano: **${strat.bestMove.dmgMin}-${strat.bestMove.dmgMax} HP** (${strat.bestMove.effectiveness}x eficÃƒÂ¡cia)${strat.bestMove.hitsToKo === 1 ? ' Ã¢â‚¬Â¢ K.O. GARANTIDO EM 1 GOLPE!' : ` Ã¢â‚¬Â¢ ~${strat.bestMove.hitsToKo} turnos para K.O.`}\n`;
      }
      if (strat.optimalCombo) {
        md += `\n#### Ã¢Å¡Â¡ SequÃƒÂªncia Ãƒâ€œtima de Ataques (SobrevivÃƒÂªncia: ${strat.optimalCombo.survivalPercent}%)\n`;
        strat.optimalCombo.sequence.forEach(s => {
          md += `- Ã¢Å¾â€ ${s}\n`;
        });
        md += `> **Resumo TÃƒÂ¡tico:** ${strat.optimalCombo.summary}\n`;
      }
      if (strat.switchAdvisor) {
        const sw = strat.switchAdvisor;
        md += `\n#### Ã°Å¸â€â€ž Conselheiro de Troca: **${sw.actionTitle}**\n`;
        md += `- **DecisÃƒÂ£o:** ${sw.shouldSwitch ? 'Ã°Å¸Å¡Â¨ DEVES MUDAR DE POKÃƒâ€°MON' : 'Ã¢Å“â€¦ DEVES MANTER O POKÃƒâ€°MON ATUAL'}\n`;
        if (sw.targetMon) {
          md += `- **Substituto Sugerido:** **${sw.targetMon.name} (Lv. ${sw.targetMon.level})** [${sw.targetMon.hp}/${sw.targetMon.maxHp} HP]\n`;
        }
        md += `- **Motivo:** ${sw.reason}\n`;
        if (sw.expCandidate) {
          md += `- **Ã¢Â­Â Prioridade de Treino (EXP):** **${sw.expCandidate.name} (Lv. ${sw.expCandidate.level})** ÃƒÂ© o mais fraco da tua equipa e deve receber prioridade de EXP quando for seguro!\n`;
        }
      }
      if (strat.catchChance && state.battleType === 'Wild') {
        md += `\n- **Probabilidade de Captura com HP Atual:** PokÃƒÂ© Ball: **${strat.catchChance.pokeball}%** | Great Ball: **${strat.catchChance.greatball}%** | Ultra Ball: **${strat.catchChance.ultraball}%**\n`;
        md += `  - *Se adormeceres o inimigo:* **~${strat.catchChance.withSleep || 45}%** | *Com HP no vermelho:* **~${strat.catchChance.withRedHp || 60}%**\n`;
      }
    }
  } else {
    md += `- **Estado:** Ã°Å¸â€”ÂºÃ¯Â¸Â **Fora de Combate (ExploraÃƒÂ§ÃƒÂ£o Livre)**\n`;
    if (boss && boss.battles && boss.battles.length > 0) {
      const nextB = boss.battles.find(b => !b.isDefeated && !b.isMissed);
      if (nextB) {
        md += `- **Ã°Å¸Å½Â¯ PrÃƒÂ³ximo Alvo de Batalha na ÃƒÂrea:** **${nextB.name}** (${nextB.location})\n`;
        md += `  - **Equipa AdversÃƒÂ¡ria:** ${nextB.enemyRoster}\n`;
        md += `  - **Lead Recomendado:** ${nextB.optimalLead}\n`;
        md += `  - **EstratÃƒÂ©gia:** ${nextB.strategyText}\n`;
      }
    }
  }
  md += `\n`;

  // 3. Equipa Atual (Party)
  md += `## Ã°Å¸â€˜Â¥ 3. Equipa Atual (${party.length}/6 PokÃƒÂ©mon) Ã¢â‚¬Â¢ Vagas Livres: **${6 - party.length}**\n`;
  if (party.length === 0) {
    md += `*Equipa a carregar da memÃƒÂ³ria...*\n\n`;
  } else {
    party.forEach((p, idx) => {
      md += `### ${idx + 1}. **${p.name}** (Lv. ${p.level})${p.isInBattle ? ' Ã¢Å¡â€Ã¯Â¸Â [EM COMBATE]' : ''}\n`;
      md += `- **Tipos:** ${(p.types || []).join('/')} | **HP:** ${p.hp} / ${p.maxHp} ${p.hp === 0 ? 'Ã¢ÂÅ’ (FAINTED)' : p.status !== 'HEALTHY' ? `Ã¢Å¡Â Ã¯Â¸Â (${p.status})` : 'Ã¢Å“â€¦ (SAUDÃƒÂVEL)'}\n`;
      if (p.stats) {
        md += `- **Stats Reais:** ATK: ${p.stats.attack} | DEF: ${p.stats.defense} | SPD: ${p.stats.speed} | SPC: ${p.stats.special}\n`;
      }
      if (p.dvs) {
        md += `- **DVs Gen 1 (0Ã¢â‚¬â€œ15):** Ataque: ${p.dvs.attack} | Defesa: ${p.dvs.defense} | Velocidade: ${p.dvs.speed} | Especial: ${p.dvs.special} | HP: ${p.dvs.hp}\n`;
      }
      if (p.statExp) {
        md += `- **Stat Experience (0Ã¢â‚¬â€œ65.535):** Atk: ${p.statExp.attack} | Def: ${p.statExp.defense} | Spd: ${p.statExp.speed} | Spc: ${p.statExp.special} | HP: ${p.statExp.hp}\n`;
      }
      if (p.exp) {
        md += `- **ExperiÃƒÂªncia:** ${p.exp.current.toLocaleString()} EXP (Progresso: ${p.exp.percent}%, faltam ${p.exp.needed > 0 ? `${p.exp.needed} p/ Lv.${p.level + 1}` : '0'})\n`;
      }
      if (p.moves && p.moves.length > 0) {
        md += `- **Golpes & PPs:**\n`;
        p.moves.forEach(m => {
          md += `  - **${m.name}** (${m.type}) Ã¢â‚¬â€ PP: ${m.pp} | Poder: ${m.power || '--'} | PrecisÃƒÂ£o: ${m.accuracy || 100}%\n`;
        });
      }
      md += `\n`;
    });
  }

  // 4. Mochila & Recursos
  const cap = state.inventoryCapacity || { total: 20, occupied: inv.length, free: Math.max(0, 20 - inv.length) };
  md += `## Ã°Å¸Å½â€™ 4. Mochila & Recursos Ã¢â‚¬Â¢ Capacidade: **${cap.occupied} / ${cap.total} slots** (${cap.free} vagas livres)\n`;
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
  md += `# Ã°Å¸Ââ€ºÃ¯Â¸Â PARTE B: PROGRESSO PERMANENTE\n\n`;

  // 5. PokÃƒÂ©dex Completa
  const ownedCount = state.pokedexOwnedCount || (state.pokedexOwned ? state.pokedexOwned.length : 0);
  const seenCount = state.pokedexSeenCount || (state.pokedexSeen ? state.pokedexSeen.length : 0);
  const totalLiving = state.totalPokemonOwned || (party.length + pc.count);
  md += `## Ã°Å¸â€œâ€“ 5. ColeÃƒÂ§ÃƒÂ£o da PokÃƒÂ©dex (Kanto Gen 1)\n`;
  md += `- **EspÃƒÂ©cies Registadas na PokÃƒÂ©dex:** **${ownedCount} / 151** (EspÃƒÂ©cies Desbloqueadas)\n`;
  md += `- **EspÃƒÂ©cies Vistas na PokÃƒÂ©dex:** **${seenCount} / 151**\n`;
  md += `- **Total de PokÃƒÂ©mon Individuais Ativos:** **${totalLiving} espÃƒÂ©cimes** (${party.length} na Equipa + ${pc.count} no PC)\n`;
  if (state.pokedexOwned && state.pokedexOwned.length > 0) {
    const ownedNames = state.pokedexOwned.map(dex => {
      const entry = Object.values(INTERNAL_TO_POKEMON).find(pk => pk.dex === dex);
      return entry ? `#${dex} ${entry.name}` : `#${dex}`;
    });
    md += `- **EspÃƒÂ©cies Registadas na PokÃƒÂ©dex:** ${ownedNames.join(', ')}\n`;
  }
  md += `\n`;

  // 6. PokÃƒÂ©mon no PC
  md += `## Ã°Å¸â€™Â¾ 6. PokÃƒÂ©mon Guardados no PC (${pc.count} / 20 na Caixa ${pc.boxNum}) Ã¢â‚¬Â¢ Vagas Livres: **${pc.freeSlots}**\n`;
  if (!pc.pokemon || pc.pokemon.length === 0) {
    md += `*Caixa ${pc.boxNum} vazia.*\n\n`;
  } else {
    pc.pokemon.forEach((p, idx) => {
      md += `- #${idx + 1}: **${p.name}** (Dex: #${p.dex})\n`;
    });
    md += `\n`;
  }

  // 7. InsÃƒÂ­gnias de GinÃƒÂ¡sio (8 Oficiais de Kanto)
  const officialBadges = [
    { name: 'Boulder Badge', city: 'Pewter City', leader: 'Brock', type: 'Rocha' },
    { name: 'Cascade Badge', city: 'Cerulean City', leader: 'Misty', type: 'ÃƒÂgua' },
    { name: 'Thunder Badge', city: 'Vermilion City', leader: 'Lt. Surge', type: 'ElÃƒÂ©trico' },
    { name: 'Rainbow Badge', city: 'Celadon City', leader: 'Erika', type: 'Planta' },
    { name: 'Soul Badge', city: 'Fuchsia City', leader: 'Koga', type: 'Veneno' },
    { name: 'Marsh Badge', city: 'Saffron City', leader: 'Sabrina', type: 'PsÃƒÂ­quico' },
    { name: 'Volcano Badge', city: 'Cinnabar Island', leader: 'Blaine', type: 'Fogo' },
    { name: 'Earth Badge', city: 'Viridian City', leader: 'Giovanni', type: 'Terra' }
  ];

  md += `## Ã°Å¸Ââ€  7. InsÃƒÂ­gnias de GinÃƒÂ¡sio (8 Oficiais de Kanto)\n`;
  officialBadges.forEach((bDef, idx) => {
    const isGot = badges.some(b => b.name && b.name.includes(bDef.name) && b.obtained);
    const statusMark = isGot ? 'Ã¢Å“â€¦ [CONQUISTADA]' : idx === 0 ? 'Ã¢Å¡â€Ã¯Â¸Â [POR CONQUISTAR - Faz Agora!]' : 'Ã¢ÂÂ³ [BLOQUEADA]';
    md += `- **${idx + 1}. ${bDef.name}** (${bDef.city} Ã¢â‚¬Â¢ ${bDef.leader} Ã¢â‚¬Â¢ Tipo: ${bDef.type}): ${statusMark}\n`;
  });
  md += `\n`;

  // 8. Progresso da HistÃƒÂ³ria & Treinadores Derrotados
  md += `## Ã°Å¸â€”ÂºÃ¯Â¸Â 8. Progresso da HistÃƒÂ³ria & Treinadores Derrotados\n`;
  if (boss && boss.battles && boss.battles.length > 0) {
    boss.battles.forEach((bt, idx) => {
      const compassTag = bt.compass ? `[${bt.compass.arrow} ${bt.compass.dist} passos ${bt.compass.direction}] ` : '';
      md += `### #${idx + 1}. ${compassTag}**${bt.name}** (${bt.location}) Ã¢â‚¬Â¢ **${bt.statusLabel}**\n`;
      md += `- **Dificuldade:** ${bt.difficulty}\n`;
      md += `- **Roster Inimigo:** ${bt.enemyRoster}\n`;
      md += `- **Lead Recomendado:** ${bt.optimalLead}\n`;
      if (bt.idealLineup && bt.idealLineup.length > 0) {
        md += `- **Ordem Ideal da Equipa (Slots 1 a 6):**\n`;
        bt.idealLineup.forEach(l => {
          md += `  - **Slot #${l.slot}**: **${l.name}** (Lv. ${l.level}) Ã¢â‚¬â€ *${l.role}*: ${l.note}\n`;
        });
      }
      md += `- **EstratÃƒÂ©gia:** ${bt.strategyText}\n\n`;
    });
  }

  // =========================================================================
  // PARTE C: HISTÃƒâ€œRICO RECENTE & LOGS DE BATALHA
  // =========================================================================
  md += `# Ã°Å¸â€œÅ“ PARTE C: HISTÃƒâ€œRICO RECENTE & LOGS DE BATALHA\n\n`;

  // Log de AÃƒÂ§ÃƒÂµes e Batalhas em Tempo Real (Turno a Turno)
  const actionHistory = state.actionHistory || [];
  if (actionHistory.length > 0) {
    md += `## Ã¢Å¡â€Ã¯Â¸Â Registo de AÃƒÂ§ÃƒÂµes e Batalhas (Turno a Turno)\n`;
    actionHistory.slice(0, 8).forEach(a => {
      if (a.type === 'BATTLE_ACTION') {
        md += `- [${a.time}] **Turno #${a.turn}**: ${a.playerActive ? `${a.playerActive.name} (${a.playerActive.hp}/${a.playerActive.maxHp} HP)` : 'RED'} vs ${a.enemy ? `${a.enemy.name} (${a.enemy.hp}/${a.enemy.maxHp} HP)` : 'Inimigo'}${a.lastPlayerMove ? ` Ã¢â‚¬Â¢ Golpe RED: \`${a.lastPlayerMove}\`` : ''}${a.lastEnemyMove ? ` Ã¢â‚¬Â¢ Golpe Inimigo: \`${a.lastEnemyMove}\`` : ''}\n`;
      } else if (a.type === 'BATTLE_END') {
        md += `- [${a.time}] Ã°Å¸ÂÂ **${a.summary}** (${a.enemy})\n`;
      }
    });
    md += `\n`;
  }

  const history = state.recentHistory || [];
  if (history.length === 0) {
    md += `- [${dateStr.split(' ')[1] || 'Recente'}] SincronizaÃƒÂ§ÃƒÂ£o inicial com o emulador RetroArch concluÃƒÂ­da com sucesso.\n`;
  } else {
    history.forEach(h => {
      md += `- [${h.time}] ${h.text}\n`;
    });
  }
  md += `\n`;

  // HistÃƒÂ³rico de DiÃƒÂ¡logos & Mensagens do Jogo
  const dialogHistory = state.dialogHistory || [];
  if (dialogHistory.length > 0) {
    md += `### Ã°Å¸â€™Â¬ ÃƒÅ¡ltimos DiÃƒÂ¡logos & Mensagens com NPCs (MemÃƒÂ³ria do EcrÃƒÂ£):\n`;
    dialogHistory.slice(0, 10).forEach(d => {
      md += `- [${d.time}] \`${d.text}\`\n`;
    });
    md += `\n`;
  }

  // Grok AI Live Strategy Box
  if (state.aiAdvice) {
    md += `## Ã°Å¸Â§Â  Conselho TÃƒÂ¡tico do Grok AI\n`;
    md += `> "${state.aiAdvice}"\n\n`;
  }

  md += `---\n*Link permanente deste ficheiro:* [https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/README.md](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/README.md)\n`;
  return md;
}

let isSyncing = false;
let pendingStateToSync = null;
let syncTimeout = null;
let lastSyncTimeString = 'Nunca';

// Sincroniza o ficheiro README.md no repositÃƒÂ³rio GitHub ApexScorpio/pokemon-red-telemetry
async function syncToGitHub(state) {
  if (!GITHUB_TOKEN) return false;
  try {
    const markdown = formatTelemetryMarkdown(state);
    const contentBase64 = Buffer.from(markdown, 'utf-8').toString('base64');

    // ObtÃƒÂ©m sempre o SHA mais recente diretamente da API para evitar erros 409 Conflict
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

// Disparo periÃƒÂ³dico e seguro (evita starvation do clearTimeout a cada 650ms)
function triggerDebouncedSync(state) {
  pendingStateToSync = state;
  if (isSyncing) return;

  const now = Date.now();
  const timeSinceLast = now - lastSyncTime;
  const MIN_INTERVAL = 10000; // MÃƒÂ¡ximo 1 commit a cada 10 segundos

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
    await syncToGitHub(state);
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
