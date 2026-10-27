const EVENT_FLAGS = require('./exact_events.json');
// Base de Dados Oficial e Completa de Kanto • Pokémon Red
// Telemetria em direto via RAM:
// - Itens Visíveis (chão): wToggleableObjectFlags ($D5A6, 32 bytes)
// - Itens Ocultos (blocos secretos): wObtainedHiddenItemsFlags ($D6F0, 7 bytes)
// - Pokédex Capturados: wPokedexOwned ($D2F7, 19 bytes)

const AREA_DATABASE = {
  // Pallet Town (0 / 0x00)
  0: {
    name: 'Pallet Town',
    wild: [],
    npcTrades: [],
    npcGifts: [
      { name: 'Bulbasaur / Charmander / Squirtle', dex: 1, type: 'gift', hint: 'Laboratório do Prof. Oak', importance: 'Escolha inicial do teu parceiro de jornada.' }
    ],
    npcItems: [
      { name: 'Pokédex & 5 Poké Balls', hint: 'Prof. Oak após entregares o Oak\'s Parcel de Viridian.', importance: 'Desbloqueia o registo oficial de Kanto.' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Viridian City (1 / 0x01)
  1: {
    name: 'Viridian City',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'Oak\'s Parcel', hint: 'Pokémart (recebes ao falar com o balconista).', importance: 'Leva ao Prof. Oak em Pallet Town para desbloquear a Pokédex.' },
      { name: 'TM42 (Dream Eater)', hint: 'Homem no terraço isolado a sudoeste (requer Surf).', importance: 'Golpe psíquico devastador contra alvos adormecidos.' }
    ],
    visibleItems: [],
    hiddenItems: [
      { name: 'Potion', type: 'hidden', x: 14, y: 4, hint: 'Canto noroeste, escondido atrás da árvore de Cut.', importance: 'Cura 20 HP grátis.', hiddenIndex: 35 }
    ]
  },

  // Route 1 (12 / 0x0C)
  12: {
    name: 'Route 1',
    wild: [
      { name: 'Pidgey', dex: 16, minLv: 2, maxLv: 5, chance: 55, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spc: 35 }, rec: 'Comum. Bom no início; evolui para Pidgeotto (Lv. 18) e Pidgeot (Lv. 36).' },
      { name: 'Rattata', dex: 19, minLv: 2, maxLv: 4, chance: 45, types: ['Normal'], baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spc: 25 }, rec: 'Muito rápido; aprende Hyper Fang no Lv. 14 com dano brutal.' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'Potion Grátis', hint: 'Fala com o balconista do Pokémart no caminho norte da Rota 1.', importance: 'Amostra grátis para curar 20 HP.' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Viridian Forest (51 / 0x33)
  51: {
    name: 'Viridian Forest',
    wild: [
      { name: 'Caterpie', dex: 10, minLv: 3, maxLv: 5, chance: 35, types: ['Bug'], baseStats: { hp: 45, atk: 30, def: 35, spd: 45, spc: 20 }, rec: 'Evolui muito rápido para Butterfree no Lv. 10 (Confusion ajuda contra Brock).' },
      { name: 'Metapod', dex: 11, minLv: 4, maxLv: 6, chance: 20, types: ['Bug'], baseStats: { hp: 50, atk: 20, def: 55, spd: 30, spc: 25 }, rec: 'Apenas usa Harden; bom para treinar dano.' },
      { name: 'Weedle', dex: 13, minLv: 3, maxLv: 5, chance: 25, types: ['Bug', 'Poison'], baseStats: { hp: 40, atk: 35, def: 30, spd: 50, spc: 20 }, rec: 'Cuidado com Poison Sting.' },
      { name: 'Kakuna', dex: 14, minLv: 4, maxLv: 6, chance: 15, types: ['Bug', 'Poison'], baseStats: { hp: 45, atk: 25, def: 50, spd: 35, spc: 25 }, rec: 'Evolui para Beedrill no Lv. 10 (Twineedle).' },
      { name: 'Pikachu', dex: 25, minLv: 3, maxLv: 5, chance: 5, types: ['Electric'], baseStats: { hp: 35, atk: 55, def: 30, spd: 90, spc: 50 }, rec: '⭐ RARO (5%) E OBRIGATÓRIO! Essencial para derrotar o ginásio de água da Misty!' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [
      { name: 'Antidote', type: 'visible', x: 25, y: 11, hint: 'Perto da entrada sul da floresta.', importance: 'Cura envenenamento dos Weedles.', toggleIndex: 100 },
      { name: 'Potion', type: 'visible', x: 12, y: 29, hint: 'No caminho central entre os labirintos de árvores.', importance: 'Cura 20 HP.', toggleIndex: 101 },
      { name: 'Poké Ball', type: 'visible', x: 1, y: 31, hint: 'No canto noroeste perto da saída para Pewter City.', importance: 'Útil para apanhar o Pikachu.', toggleIndex: 102 }
    ],
    hiddenItems: [
      { name: 'Antidote', type: 'hidden', x: 1, y: 18, hint: 'Num ponto cego no canto inferior esquerdo da floresta.', importance: 'Cura de emergência.', hiddenIndex: 0 },
      { name: 'Potion', type: 'hidden', x: 16, y: 42, hint: 'Numa árvore logo ao lado do caminho central.', importance: 'Cura 20 HP oculta.', hiddenIndex: 1 }
    ]
  },

  // Route 2 (13 / 0x0D)
  13: {
    name: 'Route 2',
    wild: [
      { name: 'Pidgey', dex: 16, minLv: 3, maxLv: 5, chance: 40, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spc: 35 }, rec: 'Comum.' },
      { name: 'Rattata', dex: 19, minLv: 2, maxLv: 5, chance: 40, types: ['Normal'], baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spc: 25 }, rec: 'Comum.' },
      { name: 'Nidoran♀', dex: 29, minLv: 4, maxLv: 6, chance: 10, types: ['Poison'], baseStats: { hp: 55, atk: 47, def: 52, spd: 41, spc: 40 }, rec: '⭐ RECOMENDADO! Nidoqueen aprende Surf, Thunderbolt e Earthquake.' },
      { name: 'Nidoran♂', dex: 32, minLv: 4, maxLv: 6, chance: 10, types: ['Poison'], baseStats: { hp: 46, atk: 57, def: 40, spd: 50, spc: 40 }, rec: '⭐ TOP TIER! Nidoking é um dos Pokémon mais poderosos de todo o jogo.' }
    ],
    npcTrades: [
      { give: 'Abra', receive: 'Mr. Mime', nickname: 'MARCEL', dex: 122, hint: 'Casa perto da saída sul do Túnel de Diglett', importance: '⭐ Único Mr. Mime do jogo! Psíquico de topo com grande Special.' }
    ],
    npcGifts: [],
    npcItems: [
      { name: 'HM05 (Flash)', hint: 'Assistente do Prof. Oak na casa sul da Rota 2.', condition: 'Requer 10 Pokémon capturados na Pokédex.', importance: '⭐ ESSENCIAL para iluminar o interior do Rock Tunnel.' }
    ],
    visibleItems: [
      { name: 'Moon Stone', type: 'visible', x: 13, y: 54, hint: 'Na secção leste da Rota 2 (acessível pelo túnel de Diglett após Cut).', importance: 'Evolui Nidorino para Nidoking ou Clefairy para Clefable!', toggleIndex: 25 },
      { name: 'HP Up', type: 'visible', x: 13, y: 45, hint: 'Na secção sul perto da casa do assistente do Prof. Oak.', importance: 'Aumenta permanentemente o HP base.', toggleIndex: 26 }
    ],
    hiddenItems: []
  },

  // Route 22 (33 / 0x21)
  33: {
    name: 'Route 22',
    wild: [
      { name: 'Rattata', dex: 19, minLv: 2, maxLv: 4, chance: 45, types: ['Normal'], baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spc: 25 }, rec: 'Comum.' },
      { name: 'Nidoran♂', dex: 32, minLv: 2, maxLv: 4, chance: 40, types: ['Poison'], baseStats: { hp: 46, atk: 57, def: 40, spd: 50, spc: 40 }, rec: '⭐ MUITO COMUM NO RED (40%)! Com a Moon Stone de Mt. Moon tens Nidoking logo no início.' },
      { name: 'Spearow', dex: 21, minLv: 3, maxLv: 5, chance: 10, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 60, def: 30, spd: 70, spc: 31 }, rec: 'Mais agressivo que Pidgey com Peck e Drill Peck mais tarde.' },
      { name: 'Nidoran♀', dex: 29, minLv: 3, maxLv: 4, chance: 5, types: ['Poison'], baseStats: { hp: 55, atk: 47, def: 52, spd: 41, spc: 40 }, rec: '⭐ RARO NO RED (5%)! Defensivo e versátil.' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'Rival Battle #2', hint: 'No caminho oeste para a Liga Pokémon.', importance: 'Batalha opcional contra o teu Rival antes de Brock ou após a Boulder Badge.' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter City (2 / 0x02)
  2: {
    name: 'Pewter City',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'Old Amber (Aerodactyl)', hint: 'Cientista nas traseiras do Museu de Pewter (requer cortar arbusto com Cut).', importance: '⭐ Leva ao laboratório de Cinnabar para reviver o Aerodactyl!' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter Gym (54 / 0x36)
  54: {
    name: 'Pewter Gym',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'TM34 (Bide)', hint: 'Recompensa ao derrotar o Líder Brock.', importance: 'Dá a Boulder Badge (+12.5% Ataque) e o TM34.' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter Museum 1F (55 / 0x37)
  55: {
    name: 'Pewter Museum (1F)',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter Museum 2F (56 / 0x38)
  56: {
    name: 'Pewter Museum (2F)',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter Pokémart (57 / 0x39)
  57: {
    name: 'Pewter Pokémart',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter Pokécenter (58 / 0x3A)
  58: {
    name: 'Pewter Pokécenter',
    wild: [],
    npcTrades: [],
    npcGifts: [
      { name: 'PC de Bill (Armazenamento)', hint: 'Terminal do PC no canto superior direito do Centro Pokémon.', importance: 'Guarda o Nidoran♂ ou outros Pokémon para teres vaga livre na equipa.' }
    ],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter Speech House (115 / 0x73)
  115: {
    name: 'Pewter City (Casa)',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Pewter Nidoran House (116 / 0x74)
  116: {
    name: 'Pewter City (Casa do Nidoran)',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Route 3 (14 / 0x0E)
  14: {
    name: 'Route 3',
    wild: [
      { name: 'Pidgey', dex: 16, minLv: 6, maxLv: 8, chance: 45, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spc: 35 }, rec: 'Comum.' },
      { name: 'Spearow', dex: 21, minLv: 6, maxLv: 8, chance: 45, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 60, def: 30, spd: 70, spc: 31 }, rec: 'Grande poder de ataque físico.' },
      { name: 'Jigglypuff', dex: 39, minLv: 3, maxLv: 7, chance: 10, types: ['Normal'], baseStats: { hp: 115, atk: 45, def: 20, spd: 20, spc: 45 }, rec: '⭐ RARO (10%)! Aprende Sing para adormecer Pokémon selvagens facilitando capturas.' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Mt Moon Pokecenter (68 / 0x44)
  68: {
    name: 'Mt. Moon Pokecenter',
    wild: [],
    npcTrades: [],
    npcGifts: [
      { name: 'Magikarp (500₽)', dex: 129, type: 'gift', hint: 'Vendedor suspeito dentro do Pokecenter.', importance: '⭐ ESSENCIAL! Evolui no Lv. 20 para o lendário e temível Gyarados!' }
    ],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Mt Moon 1F (59 / 0x3B)
  59: {
    name: 'Mt. Moon (1F)',
    wild: [
      { name: 'Zubat', dex: 41, minLv: 7, maxLv: 10, chance: 55, types: ['Poison', 'Flying'], baseStats: { hp: 40, atk: 45, def: 35, spd: 55, spc: 40 }, rec: 'Comum. Cuidado com Supersonic.' },
      { name: 'Geodude', dex: 74, minLv: 7, maxLv: 9, chance: 25, types: ['Rock', 'Ground'], baseStats: { hp: 40, atk: 80, def: 100, spd: 20, spc: 30 }, rec: '⭐ DEFENSOR ABSOLUTO! Imune a eletricidade, excelente contra fogo/pássaros.' },
      { name: 'Paras', dex: 46, minLv: 8, maxLv: 8, chance: 15, types: ['Bug', 'Grass'], baseStats: { hp: 35, atk: 70, def: 55, spd: 25, spc: 55 }, rec: 'Aprende Spore mais tarde (100% de chance de adormecer!).' },
      { name: 'Clefairy', dex: 35, minLv: 8, maxLv: 8, chance: 5, types: ['Normal'], baseStats: { hp: 70, atk: 45, def: 48, spd: 35, spc: 60 }, rec: '⭐ RARO (5%)! Consegue aprender quase todos os TMs do jogo, versátil!' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [
      { name: 'Potion', type: 'visible', x: 2, y: 20, hint: 'Perto da entrada esquerda no piso 1F.', importance: 'Cura 20 HP.', toggleIndex: 103 },
      { name: 'Moon Stone', type: 'visible', x: 2, y: 2, hint: 'No canto superior esquerdo.', importance: '⭐ ESSENCIAL! Usar no Nidorino/Nidorina/Clefairy!', toggleIndex: 104 },
      { name: 'Rare Candy', type: 'visible', x: 35, y: 31, hint: 'No canto superior direito numa plataforma.', importance: 'Sobe 1 nível instantaneamente.', toggleIndex: 105 },
      { name: 'Escape Rope', type: 'visible', x: 36, y: 23, hint: 'Perto das escadas no centro da caverna.', importance: 'Teleporta logo para fora da caverna.', toggleIndex: 106 },
      { name: 'Potion', type: 'visible', x: 20, y: 33, hint: 'No corredor inferior.', importance: 'Cura 20 HP.', toggleIndex: 107 },
      { name: 'TM12 (Water Gun)', type: 'visible', x: 5, y: 32, hint: 'No canto inferior esquerdo.', importance: 'Ensina Water Gun (ótimo para Mankey/Rattata).', toggleIndex: 108 }
    ],
    hiddenItems: []
  },

  // Mt Moon B1F (60 / 0x3C)
  60: {
    name: 'Mt. Moon (B1F)',
    wild: [
      { name: 'Zubat', dex: 41, minLv: 8, maxLv: 11, chance: 65, types: ['Poison', 'Flying'], baseStats: { hp: 40, atk: 45, def: 35, spd: 55, spc: 40 }, rec: 'Comum. Cuidado com Supersonic.' },
      { name: 'Geodude', dex: 74, minLv: 9, maxLv: 10, chance: 20, types: ['Rock', 'Ground'], baseStats: { hp: 40, atk: 80, def: 100, spd: 20, spc: 30 }, rec: '⭐ DEFENSOR ABSOLUTO! Resistente a dano físico e imune a eletricidade.' },
      { name: 'Paras', dex: 46, minLv: 10, maxLv: 12, chance: 15, types: ['Bug', 'Grass'], baseStats: { hp: 35, atk: 70, def: 55, spd: 25, spc: 55 }, rec: 'Planta/Inseto. Fraco a Fogo e Voador.' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Mt Moon B2F (61 / 0x3D)
  61: {
    name: 'Mt. Moon (B2F)',
    wild: [
      { name: 'Zubat', dex: 41, minLv: 9, maxLv: 13, chance: 65, types: ['Poison', 'Flying'], baseStats: { hp: 40, atk: 45, def: 35, spd: 55, spc: 40 }, rec: 'Comum.' },
      { name: 'Geodude', dex: 74, minLv: 10, maxLv: 11, chance: 20, types: ['Rock', 'Ground'], baseStats: { hp: 40, atk: 80, def: 100, spd: 20, spc: 30 }, rec: 'Resistente.' },
      { name: 'Paras', dex: 46, minLv: 11, maxLv: 13, chance: 10, types: ['Bug', 'Grass'], baseStats: { hp: 35, atk: 70, def: 55, spd: 25, spc: 55 }, rec: 'Planta/Inseto.' },
      { name: 'Clefairy', dex: 35, minLv: 12, maxLv: 12, chance: 5, types: ['Normal'], baseStats: { hp: 70, atk: 45, def: 48, spd: 35, spc: 60 }, rec: '⭐ RARO (5%)!' }
    ],
    npcTrades: [],
    npcGifts: [
      { name: 'Fóssil Dome (Kabuto) OU Fóssil Helix (Omanyte)', dex: 140, type: 'gift', hint: 'Derrota o Super Nerd antes da saída.', importance: 'Ressuscita no laboratório de Cinnabar.' }
    ],
    npcItems: [],
    visibleItems: [
      { name: 'HP Up', type: 'visible', x: 25, y: 21, hint: 'Na secção sul perto dos Rockets (X:25 Y:21).', importance: 'Aumenta HP permanente.', toggleIndex: 111 },
      { name: 'TM01 (Mega Punch)', type: 'visible', x: 29, y: 5, hint: 'No canto superior direito após descer as escadas (X:29 Y:5).', importance: 'Golpe físico potente de 80 Power.', toggleIndex: 112 }
    ],
    hiddenItems: [
      { name: 'Moon Stone', type: 'hidden', x: 17, y: 12, hint: 'Pedra no canto superior direito num bloco isolado.', importance: '⭐ SEGUNDA MOON STONE! Permite evoluir outro Pokémon!', hiddenIndex: 2 },
      { name: 'Ether', type: 'hidden', x: 33, y: 9, hint: 'Perto das escadas centrais numa rocha.', importance: 'Recupera 10 PP.', hiddenIndex: 49 }
    ]
  },

  // Route 4 (15 / 0x0F) - Secção Leste (Saída de Mt. Moon para Cerulean)
  15: {
    name: 'Route 4 (Leste - Saída Mt. Moon / Cerulean)',
    wild: [
      { name: 'Rattata', dex: 19, minLv: 8, maxLv: 12, chance: 35, types: ['Normal'], baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spc: 25 }, rec: 'Comum.' },
      { name: 'Spearow', dex: 21, minLv: 8, maxLv: 12, chance: 35, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 60, def: 30, spd: 70, spc: 31 }, rec: 'Voador agressivo.' },
      { name: 'Ekans', dex: 23, minLv: 6, maxLv: 12, chance: 30, types: ['Poison'], baseStats: { hp: 35, atk: 60, def: 44, spd: 55, spc: 40 }, rec: '⭐ EXCLUSIVO DE POKÉMON RED! Aprende Wrap e Glare; evolui para Arbok no Lv. 22.' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [
      { name: 'TM04 (Whirlwind)', type: 'visible', x: 57, y: 3, hint: 'Num planalto acessível descendo de Mt. Moon.', importance: 'Golpe de vento.', toggleIndex: 27 }
    ],
    hiddenItems: [
      { name: 'Great Ball', type: 'hidden', x: 40, y: 3, hint: 'Na rocha no planalto a leste perto de Cerulean.', importance: 'Taxa de captura superior.', hiddenIndex: 53 }
    ]
  },

  // Cerulean City (3 / 0x03)
  3: {
    name: 'Cerulean City',
    wild: [],
    npcTrades: [
      { give: 'Poliwhirl', receive: 'Jynx', nickname: 'LOLA', dex: 124, hint: 'Casa ao lado do Centro Pokémon', importance: '⭐ Gelo/Psíquico com Blizzard e Psychic devastadores!' }
    ],
    npcGifts: [],
    npcItems: [
      { name: 'Bicycle (1,000,000₽ / Bike Voucher)', hint: 'Miracle Cycle Shop (troca pelo Bike Voucher).', importance: '⭐ Duplica a tua velocidade de deslocação em Kanto.' },
      { name: 'TM28 (Dig)', hint: 'Derrota o Team Rocket atrás da casa arrombada.', importance: '⭐ Golpe de Terra de 60 Power e teleporte de fuga de cavernas.' }
    ],
    visibleItems: [],
    hiddenItems: [
      { name: 'Rare Candy', type: 'hidden', x: 15, y: 8, hint: 'No canteiro de flores atrás da casa arrombada.', importance: 'Sobe 1 nível grátis.', hiddenIndex: 52 }
    ]
  },

  // Cerulean Gym (65 / 0x41)
  65: {
    name: 'Cerulean Gym',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'TM11 (BubbleBeam) & Cascade Badge', hint: 'Derrota a Líder Misty.', importance: '⭐ Permite usar Cut fora de combate e ensina BubbleBeam de 65 Power!' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Route 24 (Nugget Bridge) (35 / 0x23)
  35: {
    name: 'Route 24',
    wild: [
      { name: 'Bellsprout', dex: 69, minLv: 12, maxLv: 14, chance: 35, types: ['Grass', 'Poison'], baseStats: { hp: 50, atk: 75, def: 35, spd: 40, spc: 70 }, rec: '⭐ EXCLUSIVO DE RED! Aprende Sleep Powder e Vine Whip; evolui para Victreebel.' },
      { name: 'Oddish', dex: 43, minLv: 12, maxLv: 14, chance: 35, types: ['Grass', 'Poison'], baseStats: { hp: 45, atk: 50, def: 55, spd: 30, spc: 75 }, rec: 'Planta e Veneno.' },
      { name: 'Pidgey', dex: 16, minLv: 11, maxLv: 13, chance: 20, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spc: 35 }, rec: 'Comum.' },
      { name: 'Abra', dex: 63, minLv: 9, maxLv: 9, chance: 10, types: ['Psychic'], baseStats: { hp: 25, atk: 20, def: 15, spd: 90, spc: 105 }, rec: '⭐ DEUS DA GEN 1! Alakazam é praticamente invencível na primeira geração. Usa Sleep ou Great Ball porque ele usa Teleport no 1º turno!' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'Nugget (5,000₽)', hint: 'Derrota os 5 treinadores da Nugget Bridge.', importance: 'Vende no Pokémart por 5,000₽.' }
    ],
    visibleItems: [
      { name: 'TM45 (Thunder Wave)', type: 'visible', hint: 'No planalto perto do início da rota.', importance: 'Paralisação garantida sem falhar.', toggleIndex: 28 }
    ],
    hiddenItems: []
  },

  // Route 25 (36 / 0x24)
  36: {
    name: 'Route 25',
    wild: [
      { name: 'Bellsprout', dex: 69, minLv: 12, maxLv: 14, chance: 35, types: ['Grass', 'Poison'], baseStats: { hp: 50, atk: 75, def: 35, spd: 40, spc: 70 }, rec: 'Exclusivo Red.' },
      { name: 'Pidgey', dex: 16, minLv: 12, maxLv: 14, chance: 35, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spc: 35 }, rec: 'Comum.' },
      { name: 'Oddish', dex: 43, minLv: 12, maxLv: 14, chance: 20, types: ['Grass', 'Poison'], baseStats: { hp: 45, atk: 50, def: 55, spd: 30, spc: 75 }, rec: 'Planta.' },
      { name: 'Abra', dex: 63, minLv: 10, maxLv: 12, chance: 10, types: ['Psychic'], baseStats: { hp: 25, atk: 20, def: 15, spd: 90, spc: 105 }, rec: '⭐ Psíquico de topo!' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'S.S. Ticket', hint: 'Fala com o Bill na Sea Cottage no final da rota.', importance: '⭐ ESSENCIAL para entrar no navio S.S. Anne em Vermilion City!' }
    ],
    visibleItems: [
      { name: 'TM19 (Seismic Toss)', type: 'visible', hint: 'No canteiro de flores perto do labirinto de treinadores.', importance: 'Dano fixo igual ao nível do teu Pokémon.', toggleIndex: 29 }
    ],
    hiddenItems: [
      { name: 'Elixer', type: 'hidden', x: 38, y: 3, hint: 'Cerca à direita da casa do Bill.', importance: 'Recupera 10 PP de todos os golpes.', hiddenIndex: 3 }
    ]
  },

  // Vermilion City (5 / 0x05)
  5: {
    name: 'Vermilion City',
    wild: [],
    npcTrades: [
      { give: 'Spearow', receive: 'Farfetch\'d', nickname: 'DUX', dex: 83, hint: 'Casa ao lado do Centro Pokémon', importance: '⭐ Único Farfetch\'d do jogo! Excelente utilitário com Cut e Fly e bom ataque com Slash.' }
    ],
    npcGifts: [],
    npcItems: [
      { name: 'Bike Voucher', hint: 'Ouve a história do Presidente no Pokémon Fan Club.', importance: '⭐ Troca na Bike Shop de Cerulean por uma Bicicleta grátis!' },
      { name: 'Old Rod', hint: 'Pescador na casa ao lado do Centro Pokémon.', importance: 'Permite pescar Magikarps em qualquer lago ou mar.' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // S.S. Anne (62 / 0x3E)
  62: {
    name: 'S.S. Anne (Navio)',
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'HM01 (Cut)', hint: 'Fala com o Capitão do navio no convés superior e faz-lhe uma massagem nas costas.', importance: '⭐ OBRIGATÓRIO! Permite cortar arbustos para aceder ao Ginásio de Vermilion e Rota 9.' }
    ],
    visibleItems: [
      { name: 'TM08 (Body Slam)', type: 'visible', hint: 'Num camarote do 1º andar.', importance: '⭐ Um dos melhores golpes físicos do jogo (85 Power + 30% Paralisia).' }
    ],
    hiddenItems: [
      { name: 'Hyper Potion', type: 'hidden', x: 3, y: 1, hint: 'No chão da cozinha do navio no caixote do lixo.', importance: 'Cura 200 HP.', hiddenIndex: 8 }
    ]
  },

  // Route 5 (16 / 0x10) - Mankey real location in Red!
  16: {
    name: 'Route 5',
    wild: [
      { name: 'Pidgey', dex: 16, minLv: 13, maxLv: 16, chance: 40, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spc: 35 }, rec: 'Comum.' },
      { name: 'Mankey', dex: 56, minLv: 10, maxLv: 16, chance: 25, types: ['Fighting'], baseStats: { hp: 40, atk: 80, def: 35, spd: 70, spc: 35 }, rec: '⭐ AQUI SIM! EXCLUSIVO DE POKÉMON RED! 25% de taxa de encontro; excelente atacante de combate.' },
      { name: 'Bellsprout', dex: 69, minLv: 13, maxLv: 16, chance: 25, types: ['Grass', 'Poison'], baseStats: { hp: 50, atk: 75, def: 35, spd: 40, spc: 70 }, rec: '⭐ EXCLUSIVO DE POKÉMON RED! Aprende Sleep Powder e Vine Whip.' },
      { name: 'Rattata', dex: 19, minLv: 14, maxLv: 14, chance: 10, types: ['Normal'], baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spc: 25 }, rec: 'Comum.' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [
      { name: 'Day Care', hint: 'Casa de Day Care na Route 5.', importance: 'Deixa 1 Pokémon para subir de nível passivamente enquanto andas.' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Route 6 (17 / 0x11)
  17: {
    name: 'Route 6',
    wild: [
      { name: 'Pidgey', dex: 16, minLv: 13, maxLv: 16, chance: 40, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spc: 35 }, rec: 'Comum.' },
      { name: 'Mankey', dex: 56, minLv: 10, maxLv: 16, chance: 25, types: ['Fighting'], baseStats: { hp: 40, atk: 80, def: 35, spd: 70, spc: 35 }, rec: '⭐ EXCLUSIVO DE RED! 25% de taxa de encontro.' },
      { name: 'Bellsprout', dex: 69, minLv: 13, maxLv: 16, chance: 25, types: ['Grass', 'Poison'], baseStats: { hp: 50, atk: 75, def: 35, spd: 40, spc: 70 }, rec: 'Exclusivo Red.' },
      { name: 'Rattata', dex: 19, minLv: 14, maxLv: 16, chance: 10, types: ['Normal'], baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spc: 25 }, rec: 'Comum.' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  },

  // Route 11 (22 / 0x16)
  22: {
    name: 'Route 11',
    wild: [
      { name: 'Drowzee', dex: 96, minLv: 9, maxLv: 15, chance: 25, types: ['Psychic'], baseStats: { hp: 60, atk: 48, def: 45, spd: 42, spc: 90 }, rec: '⭐ MUITO FORTE! Psíquico com Hypnosis e grande Special (Base 90).' },
      { name: 'Ekans', dex: 23, minLv: 11, maxLv: 15, chance: 25, types: ['Poison'], baseStats: { hp: 35, atk: 60, def: 44, spd: 55, spc: 40 }, rec: '⭐ EXCLUSIVO DE RED!' },
      { name: 'Spearow', dex: 21, minLv: 13, maxLv: 17, chance: 35, types: ['Normal', 'Flying'], baseStats: { hp: 40, atk: 60, def: 30, spd: 70, spc: 31 }, rec: 'Comum.' },
      { name: 'Rattata', dex: 19, minLv: 12, maxLv: 15, chance: 15, types: ['Normal'], baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spc: 25 }, rec: 'Comum.' }
    ],
    npcTrades: [
      { give: 'Nidorino', receive: 'Nidorina', nickname: 'TERRY', dex: 30, hint: '2.º andar do posto de controlo da Rota 11', importance: 'Troca oficial da Geração I conforme pret/pokered' }
    ],
    npcGifts: [],
    npcItems: [
      { name: 'Itemfinder', hint: 'Assistente do Prof. Oak no 2º andar do portão leste.', condition: 'Requer 30 Pokémon capturados.', importance: '⭐ Deteta itens ocultos enterrados no chão!' }
    ],
    visibleItems: [],
    hiddenItems: []
  },

  // Diglett's Cave (46, 52, 53)
  46: {
    name: 'Diglett\'s Cave',
    wild: [
      { name: 'Diglett', dex: 50, minLv: 15, maxLv: 22, chance: 95, types: ['Ground'], baseStats: { hp: 10, atk: 55, def: 25, spd: 95, spc: 45 }, rec: '⭐ SUPER RÁPIDO! Aprende Slash com críticos garantidos e Dig.' },
      { name: 'Dugtrio', dex: 51, minLv: 29, maxLv: 31, chance: 5, types: ['Ground'], baseStats: { hp: 35, atk: 80, def: 50, spd: 120, spc: 70 }, rec: '⭐⭐⭐ O MONSTRO DA GEN 1! Nível 31 logo no início! Base Speed 120 (Slash é 100% Crítico!). Mata o Surge sozinho!' }
    ],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  }
};

// Adiciona requisitos a itens e eventos bloqueados
if (AREA_DATABASE[1]) {
  // Viridian City
  AREA_DATABASE[1].npcItems[1].requires = 'SURF';
  AREA_DATABASE[1].npcItems[1].lockReason = 'Requer HM03 (Surf) e a Soul Badge para atravessar o lago sudoeste.';
  AREA_DATABASE[1].hiddenItems[0].requires = 'CUT';
  AREA_DATABASE[1].hiddenItems[0].lockReason = 'Requer HM01 (Cut) e a Cascade Badge para cortar o arbusto.';
}
if (AREA_DATABASE[13]) {
  // Route 2
  AREA_DATABASE[13].npcItems[0].requires = 'POKEDEX_10';
  AREA_DATABASE[13].npcItems[0].lockReason = 'Requer 10 Pokémon capturados na Pokédex.';
  AREA_DATABASE[13].visibleItems[0].requires = 'CUT_OR_DIGLETT';
  AREA_DATABASE[13].visibleItems[0].lockReason = 'Secção leste inacessível: requer HM01 (Cut) ou aceder via Túnel de Diglett.';
  AREA_DATABASE[13].visibleItems[1].requires = 'CUT_OR_DIGLETT';
  AREA_DATABASE[13].visibleItems[1].lockReason = 'Secção leste inacessível: requer HM01 (Cut) ou aceder via Túnel de Diglett.';
}
if (AREA_DATABASE[2]) {
  // Pewter City
  AREA_DATABASE[2].npcItems[0].requires = 'CUT';
  AREA_DATABASE[2].npcItems[0].lockReason = 'Requer HM01 (Cut) para aceder às traseiras do Museu.';
}
if (AREA_DATABASE[22]) {
  // Route 11
  AREA_DATABASE[22].npcItems[0].requires = 'POKEDEX_30';
  AREA_DATABASE[22].npcItems[0].lockReason = 'Requer 30 Pokémon capturados na Pokédex.';
}

function getAreaInfo(mapId, coords = null) {
  if (mapId === 15) {
    // A Route 4 está dividida geograficamente pelo Mt. Moon:
    // - Secção Oeste (X < 30): Entrada da montanha e Centro Pokémon. Não tem relva alta nem itens no chão.
    // - Secção Leste (X >= 30): Saída da montanha com relva alta (Rattata, Spearow, Ekans), TM04 e Great Ball.
    if (!coords || coords.x < 30) {
      return {
        name: 'Route 4 (Oeste - Entrada Mt. Moon)',
        isWestRoute4: true,
        wild: [
          { name: 'Zubat', dex: 41, minLv: 7, maxLv: 10, chance: 79, types: ['Poison', 'Flying'], baseStats: { hp: 40, atk: 45, def: 35, spd: 55, spc: 40 }, rec: '🦇 Mt. Moon (Entrada ao lado X:18 Y:5): Muito comum na caverna. Confunde com Supersonic.' },
          { name: 'Geodude', dex: 74, minLv: 8, maxLv: 10, chance: 15, types: ['Rock', 'Ground'], baseStats: { hp: 40, atk: 80, def: 100, spd: 20, spc: 30 }, rec: '🛡️ Mt. Moon: Defesa física 100 maciça. Usa Butterfree com Confusion para derrotar!' },
          { name: 'Paras', dex: 46, minLv: 8, maxLv: 8, chance: 5, types: ['Bug', 'Grass'], baseStats: { hp: 35, atk: 70, def: 55, spd: 25, spc: 55 }, rec: '🍄 Mt. Moon: Tipo Inseto/Planta. Fraco contra Fogo e Voador.' },
          { name: 'Clefairy', dex: 35, minLv: 8, maxLv: 8, chance: 1, types: ['Normal'], baseStats: { hp: 70, atk: 45, def: 48, spd: 35, spc: 60 }, rec: '⭐ RARO (1%)! Apanha e usa a Moon Stone da caverna para evoluir em Clefable!' }
        ],
        npcTrades: [],
        npcGifts: [
          { name: 'Magikarp (500₽)', dex: 129, type: 'gift', x: 11, y: 5, hint: 'Dentro do Centro Pokémon logo ao teu lado (X:11 Y:5)', importance: '⭐ ESSENCIAL! Evolui no Lv. 20 para o lendário Gyarados!' }
        ],
        npcItems: [
          { name: 'Entrada do Mt. Moon', x: 18, y: 5, hint: 'Caverna a Este (X:18 Y:5)', importance: 'Entra na montanha para avançar rumo a Cerulean City.' },
          { name: 'Centro Pokémon de Mt. Moon', x: 11, y: 5, hint: 'Edifício logo ao teu lado (X:11 Y:5)', importance: 'Cura a equipa e tem PC para gerir Pokémon.' }
        ],
        visibleItems: [], // TM04 fica do lado leste após atravessar a montanha
        hiddenItems: []  // Great Ball fica no planalto leste perto de Cerulean
      };
    }
  }

  if (AREA_DATABASE[mapId]) {
    return AREA_DATABASE[mapId];
  }
  return {
    name: `Área #0x${mapId.toString(16).toUpperCase()}`,
    wild: [],
    npcTrades: [],
    npcGifts: [],
    npcItems: [],
    visibleItems: [],
    hiddenItems: []
  };
}

// Calculador da Ordem Ideal da Equipa (Slot 1 Lead, Slot 2 EXP para os mais fracos, etc.)
function computeIdealPartyLineup(party = [], primaryLeadDex = null, preferredWeakTypes = []) {
  if (!party || party.length === 0) return [];
  const living = party.filter(p => p.hp > 0);
  if (living.length === 0) return [];

  // 1. Identifica o Lead Ideal
  let lead = null;
  if (primaryLeadDex) {
    lead = living.find(p => p.dex === primaryLeadDex);
  }
  if (!lead) {
    // Escolhe quem tem maior nível ou vantagem
    lead = [...living].sort((a, b) => b.level - a.level)[0];
  }

  // 2. Identifica o Pokémon mais fraco para prioridade de EXP
  const remaining = living.filter(p => p.name !== lead.name);
  remaining.sort((a, b) => a.level - b.level); // Mais fracos primeiro

  const weakestForExp = remaining.length > 0 ? remaining[0] : null;
  const backups = remaining.slice(1);

  const lineup = [];
  lineup.push({
    slot: 1,
    name: lead.name,
    level: lead.level,
    role: '⭐ SLOT 1 (LEAD / COMBATENTE PRINCIPAL)',
    note: 'Inicia a batalha para anular a maior ameaça e garantir vitória rápida sem risco.'
  });

  if (weakestForExp) {
    lineup.push({
      slot: 2,
      name: weakestForExp.name,
      level: weakestForExp.level,
      role: '📈 SLOT 2 (PRIORIDADE DE EXP / TREINO)',
      note: 'Pokémon mais fraco da equipa. Se o adversário estiver enfraquecido, troca para ele dar o golpe final e recolher EXP!'
    });
  }

  backups.forEach((bMon, idx) => {
    const isAnchor = idx === backups.length - 1;
    lineup.push({
      slot: idx + 3,
      name: bMon.name,
      level: bMon.level,
      role: isAnchor ? '🛡️ ÂNCORA DE SEGURANÇA' : '👥 RESERVA DE COMBATE',
      note: isAnchor ? 'Reserva de nível alto pronta caso algo corra mal.' : 'Suporte tático pronto a entrar.'
    });
  });

  return lineup;
}

// Avaliador de Pokémon da Equipa para Depositar no PC (Para Criar Espaço)
function suggestPartyMemberToDeposit(party = [], protectedDexList = [], bossWeakTypes = [], bossImmuneTypes = [], bossTitle = '') {
  if (!party || party.length === 0) return null;

  const candidates = party.map(p => {
    let score = 0;
    let reasons = [];
    const types = p.types || [];

    // Nunca sugerir depositar o atacante principal recomendado
    if (protectedDexList.includes(p.dex)) {
      return { ...p, score: -9999, reason: 'É o atacante principal recomendado!' };
    }

    // 1. Imunidade do chefe (ex: Electric contra Rocha/Terra do Brock)
    const isImmune = types.some(t => bossImmuneTypes.includes(t));
    if (isImmune) {
      score += 150;
      reasons.push(`Ataques do tipo ${types.join('/')} causam 0 de dano devido à imunidade de Terra/Rocha`);
    }

    // 2. Fraqueza defensiva crítica ao chefe
    const isWeak = types.some(t => bossWeakTypes.includes(t));
    if (isWeak) {
      score += 70;
      reasons.push(`O teu tipo (${types.join('/')}) tem fraqueza defensiva contra os golpes do ${bossTitle}`);
    }

    // 3. Normal / Veneno sem golpe forte
    if (types.includes('Normal') && !types.includes('Fighting')) {
      score += 35;
      reasons.push('Golpes Normais são pouco eficazes (0.5x) contra a armadura do adversário');
    }
    if (types.includes('Poison') && !types.includes('Fighting') && !types.includes('Bug')) {
      score += 25;
      reasons.push('Tipo Veneno tem desvantagem ofensiva contra o chefe');
    }

    // 4. Nível baixo
    if (p.level < 14) {
      score += (16 - p.level) * 3;
    }

    return {
      name: p.name,
      dex: p.dex,
      level: p.level,
      types: p.types,
      score,
      reason: reasons.length > 0 ? reasons.join('. ') + '.' : `Menor utilidade tática na batalha contra ${bossTitle}.`
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  const bestCandidate = candidates[0];
  if (!bestCandidate || bestCandidate.score <= -999) return null;

  return {
    name: bestCandidate.name,
    level: bestCandidate.level,
    types: bestCandidate.types,
    reason: bestCandidate.reason
  };
}

// Analisador Tático de Próxima Grande Batalha (Líder / Rival)
function getUpcomingBossTactics(mapId, badges = [], party = [], pokedexOwned = [], inventory = [], eventFlagsChecker = null, coords = null) {
  const badgeCount = badges.filter(b => b.obtained).length;
  const hasBoulderBadge = badges.some(b => b.name && b.name.includes('Boulder') && b.obtained);
  const hasCascadeBadge = badges.some(b => b.name && b.name.includes('Cascade') && b.obtained);
  const hasThunderBadge = badges.some(b => b.name && b.name.includes('Thunder') && b.obtained);
  const hasRainbowBadge = badges.some(b => b.name && b.name.includes('Rainbow') && b.obtained);
  const hasSoulBadge = badges.some(b => b.name && b.name.includes('Soul') && b.obtained);
  const hasMarshBadge = badges.some(b => b.name && b.name.includes('Marsh') && b.obtained);
  const hasVolcanoBadge = badges.some(b => b.name && b.name.includes('Volcano') && b.obtained);
  const hasEarthBadge = badges.some(b => b.name && b.name.includes('Earth') && b.obtained);
  const partyDexList = party.map(p => p.dex);
  const ownedDexSet = new Set(pokedexOwned);

  // Verifica se tem items na mochila
  const potionsCount = inventory.filter(i => i.name && i.name.includes('Potion')).reduce((acc, it) => acc + (it.qty || 1), 0);
  const antidotesCount = inventory.filter(i => i.name && i.name.includes('Antidote')).reduce((acc, it) => acc + (it.qty || 1), 0);

  // 1. ANTES DA PRIMEIRA INSÍGNIA (BROCK - GINÁSIO DE PEWTER / RIVAL #2)
  if (badgeCount === 0) {
    const isAtRoute22 = mapId === 33;
    const bossTitle = isAtRoute22 ? 'Rival #2 (Opcional) & Brock (Ginásio de Pewter)' : 'Líder Brock (Ginásio de Pewter)';
    const targetLvl = 'Lv. 11 a 14';

    const bossImmuneTypes = ['Electric'];
    const bossWeakTypes = ['Fire', 'Flying'];
    const protectedDexList = [12, 10, 11, 4, 5]; // Butterfree line e Charmander
    const depositAdvice = suggestPartyMemberToDeposit(party, protectedDexList, bossWeakTypes, bossImmuneTypes, 'Líder Brock');

    const recommendations = [];
    const warnings = [];

    // Avalia Butterfree (Caterpie dex 10, Metapod 11, Butterfree 12)
    const hasButterfree = party.find(p => p.dex === 12);
    const hasCaterpieInParty = party.find(p => p.dex === 10 || p.dex === 11);
    const ownsCaterpieLine = ownedDexSet.has(10) || ownedDexSet.has(11) || ownedDexSet.has(12);

    if (hasButterfree) {
      recommendations.push({
        pokemon: hasButterfree.name,
        level: hasButterfree.level >= 10 ? `Lv. ${hasButterfree.level} (Pronto!)` : `Lv. ${hasButterfree.level} ➔ Treina até Lv. 10!`,
        status: 'party',
        statusLabel: '👥 NA TUA EQUIPA',
        role: '⭐ MELHOR ATACANTE CONTRA BROCK!',
        reason: 'Confusion (Psíquico) ataca a defesa especial que é fraquíssima no Geodude e Onix (base Special de apenas 30!). No Pokémon Red original, o Brock NÃO tem ataques de tipo Rocha (o Geodude só tem Tackle/Def Curl e o Onix tem Tackle/Screech/Bide), por isso a Butterfree NÃO sofre 4x dano de Rocha neste combate.'
      });
    } else if (hasCaterpieInParty) {
      recommendations.push({
        pokemon: `${hasCaterpieInParty.name} ➔ Butterfree`,
        level: `Lv. ${hasCaterpieInParty.level} ➔ Treina até Lv. 10`,
        status: 'party',
        statusLabel: '👥 NA TUA EQUIPA',
        role: '⭐ EVOLUI P/ BUTTERFREE (Lv. 10)!',
        reason: 'Evolui muito rápido para Butterfree no nível 10 e ganha Confusion para bater o Brock facilmente.'
      });
    } else if (ownsCaterpieLine) {
      recommendations.push({
        pokemon: 'Caterpie / Metapod',
        level: 'Treina até Lv. 10 (Butterfree)',
        status: 'pc',
        statusLabel: '💾 NA TUA POKÉDEX / PC',
        role: '🌟 TIRA DO PC!',
        reason: 'Já tens na Pokédex/PC! Coloca na equipa e sobe a Lv. 10 para teres Butterfree com Confusion.',
        depositAdvice
      });
    }

    // Avalia Starter (Charmeleon / Charmander)
    const char = party.find(p => p.dex === 4 || p.dex === 5);
    if (char) {
      recommendations.push({
        pokemon: char.name,
        level: `Lv. ${char.level}`,
        status: 'party',
        statusLabel: '👥 NA TUA EQUIPA',
        role: '⚔️ ATACANTE SECUNDÁRIO',
        reason: 'Mesmo causando dano reduzido (0.5x), o Ember ataca no lado especial onde Geodude e Onix têm base de apenas 30 Special. Causa 8-12 de dano consistente.'
      });
      warnings.push({
        pokemon: char.name,
        text: `🚨 CUIDADO COM O BIDE DO ONIX: Se o Onix usar Bide (acumular energia), NÃO ATAQUES com Charmeleon ou Butterfree! Usa golpes de status (Growl, Leer, String Shot) ou cura com Poção para não levares com o dobro do dano devolvido.`
      });
    }

    // Clarificação Rigorosa sobre Nidoran em Pokémon Red (Regras Canónicas)
    const nidoranMale = party.find(p => p.dex === 32);
    const nidoranFemale = party.find(p => p.dex === 29);

    if (nidoranMale && nidoranFemale) {
      recommendations.push({
        pokemon: 'Nidoran♀ vs Nidoran♂ (Regras Red)',
        level: `Lv. ${nidoranFemale.level} / Lv. ${nidoranMale.level}`,
        status: 'party',
        statusLabel: '👥 TENS OS DOIS NA EQUIPA',
        role: '⚠️ ESCOLHE APENAS UM (GUARDA O MACHO NO PC)',
        reason: 'No Pokémon Red original, o Nidoran NÃO aprende Double Kick no nível 12 (apenas no Lv. 43; o nível 12 foi apenas em Pokémon Yellow). Como ambos são tipo Veneno e sofrem contra Terra, guarda o Nidoran♂ no PC para libertares espaço útil na equipa.',
        depositAdvice: {
          name: nidoranMale.name,
          level: nidoranMale.level,
          reason: 'Não precisas de dois Pokémon de tipo Veneno repetidos na equipa. Guarda o Nidoran♂ no PC do Centro Pokémon.'
        }
      });
    } else if (nidoranFemale || nidoranMale) {
      const mon = nidoranFemale || nidoranMale;
      warnings.push({
        pokemon: mon.name,
        text: `ℹ️ REGRA POKÉMON RED: ${mon.name} só aprende Double Kick no Lv. 43 nesta versão (Lv. 12 era só no Yellow). Não tentes treiná-lo para lutar com Brock; foca na Butterfree com Confusion.`
      });
    }

    const pika = party.find(p => p.dex === 25);
    if (pika) {
      warnings.push({
        pokemon: 'Pikachu',
        text: `🚫 NÃO USES Pikachu contra Geodude ou Onix! Os golpes elétricos causam 0 de dano devido à imunidade absoluta do tipo Terra. Deixa o Pikachu no banco.`
      });
    }

    const invTactics = [];
    if (potionsCount > 0) {
      invTactics.push(`🎒 Tens x${potionsCount} Poções: Guarda para curar Butterfree ou Charmeleon se o Onix usar Bide.`);
    } else {
      invTactics.push(`⚠️ Mochila sem Poções: Compra 2 ou 3 Poções no Pokémart de Viridian antes de desafiar o Ginásio.`);
    }

    // Verificação REAL da Memória RAM das Batalhas Feitas / Pendentes
    // Eventos: 0x525 (Rival 2), 0x072 (Jr. Trainer Pewter Gym), 0x077 (Brock)
    const isRivalBeat = eventFlagsChecker ? eventFlagsChecker(0x525) : false;
    const isJrTrainerBeat = eventFlagsChecker ? eventFlagsChecker(0x072) : false;
    const isBrockBeat = hasBoulderBadge || (eventFlagsChecker ? eventFlagsChecker(0x077) : false);
    const isRivalMissed = !isRivalBeat && isBrockBeat;

    const battles = [
      {
        id: 'route22_rival',
        name: 'Rival Blue #2',
        location: 'Rota 22 (Portão da Liga)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 1,
        isDefeated: isRivalBeat,
        isMissed: isRivalMissed,
        statusLabel: isRivalBeat ? '✅ VENCIDO' : isRivalMissed ? '🚫 EXPIRADO (Brock derrotado)' : '⚔️ POR VENCER (Faz Agora!)',
        badgeTag: 'RIVAL BLUE (OPCIONAL)',
        enemyRoster: 'Pidgey (Lv. 9) • Squirtle (Lv. 8)',
        targetLevel: 'Lv. 9+',
        optimalLead: 'Charmeleon ou Butterfree',
        idealLineup: computeIdealPartyLineup(party, 5), // Charmeleon lead
        strategyText: isRivalMissed
          ? 'Esta batalha expirou porque derrotaste o Brock antes de passar na Rota 22.'
          : '⚠️ OBRIGATÓRIO FAZER ANTES DO BROCK! Se derrotares o Brock primeiro, este combate desaparece para sempre. Usa Charmeleon/Butterfree para ganhar EXP fácil.'
      },
      {
        id: 'pewter_gym_trainer_1',
        name: 'Jr. Trainer♂',
        location: 'Ginásio de Pewter (Guardião)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 2,
        isDefeated: isJrTrainerBeat,
        isMissed: false,
        statusLabel: isJrTrainerBeat ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'GUARDIÃO DO GINÁSIO',
        enemyRoster: 'Diglett (Lv. 11 - Terra) • Sandshrew (Lv. 11 - Terra)',
        targetLevel: 'Lv. 11+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12), // Butterfree lead
        strategyText: isJrTrainerBeat
          ? 'Treinador do ginásio já derrotado com sucesso.'
          : 'Treinador que guarda o Brock. Ambos são Terra puro. A Confusion da Butterfree ataca a defesa especial e é imune a ataques de Terra.'
      },
      {
        id: 'pewter_gym_leader_brock',
        name: 'Líder Brock',
        location: 'Ginásio de Pewter (Chefe)',
        difficulty: 'Chefe / Difícil',
        diffClass: 'diff-hard',
        difficultyScore: 3,
        isDefeated: isBrockBeat,
        isMissed: false,
        statusLabel: isBrockBeat ? '✅ CONQUISTADO (Insígnia)' : '⚔️ POR VENCER',
        badgeTag: '🏆 INSÍGNIA BOULDER',
        enemyRoster: 'Geodude (Lv. 12 - Rocha/Terra) • Onix (Lv. 14 - Rocha/Terra)',
        targetLevel: 'Lv. 12 a 14',
        optimalLead: 'Butterfree (Confusion) & Charmeleon (Ember)',
        idealLineup: computeIdealPartyLineup(party, 12), // Butterfree lead
        strategyText: isBrockBeat
          ? 'Insígnia Boulder conquistada! Podes seguir para a Rota 3 rumo ao Mt. Moon.'
          : 'Confusion da Butterfree ignora a carcaça de pedra (Special base 30). SE O ONIX USAR BIDE, NÃO ATAQUES: usa String Shot ou Poção para não morrer com dano devolvido!'
      }
    ];

    // Ordenação garantida da mais fácil para a mais difícil
    battles.sort((a, b) => a.difficultyScore - b.difficultyScore);

    return {
      bossTitle,
      enemyRoster: 'Geodude (Lv. 12) & Onix (Lv. 14)',
      targetLevel: targetLvl,
      partyFull: party.length >= 6,
      defaultDepositAdvice: depositAdvice,
      recommendations,
      warnings,
      invTactics,
      battles
    };
  }

  // 2. ANTES DA SEGUNDA INSÍGNIA (MISTY - GINÁSIO DE CERULEAN / RIVAL #3)
  if (badgeCount === 1) {
    const bossWeakTypes = ['Fire', 'Rock', 'Ground'];
    const bossImmuneTypes = [];
    const protectedDexList = [25, 43, 69, 1, 2, 3]; // Pikachu, Oddish, Bellsprout, Bulbasaur line
    const depositAdvice = suggestPartyMemberToDeposit(party, protectedDexList, bossWeakTypes, bossImmuneTypes, 'Líder Misty');

    const recommendations = [];
    const warnings = [];

    const pika = party.find(p => p.dex === 25);
    const ownsPika = ownedDexSet.has(25);

    if (pika) {
      recommendations.push({
        pokemon: 'Pikachu',
        level: `Lv. ${pika.level} (Ideal: Lv. 20)`,
        status: 'party',
        statusLabel: '👥 NA TUA EQUIPA',
        role: '⭐ ATACANTE PRINCIPAL!',
        reason: 'Ataques elétricos são 2x Super Efetivos contra Staryu e Starmie. Usa Thunder Wave para paralisar e quebrar a velocidade extrema do Starmie (Base 115 Speed).'
      });
    } else if (ownsPika) {
      recommendations.push({
        pokemon: 'Pikachu',
        level: 'Treina até Lv. 20 (Thundershock)',
        status: 'pc',
        statusLabel: '💾 NA TUA POKÉDEX / PC',
        role: '🌟 TIRA DO PC!',
        reason: 'Elétrico é a melhor arma contra o ginásio de água da Misty.',
        depositAdvice
      });
    } else {
      recommendations.push({
        pokemon: 'Pikachu',
        level: 'Apanha na Viridian Forest (5%)',
        status: 'wild',
        statusLabel: '📍 VIRIDIAN FOREST (5%)',
        role: '⭐ APANHA SE PUDERES!',
        reason: 'Raro na floresta inicial (5%), mas Thundershock e Thunder Wave facilitam muito contra a Misty.',
        depositAdvice
      });
    }

    const grassMon = party.find(p => p.dex === 43 || p.dex === 69);
    const ownsGrass = ownedDexSet.has(43) || ownedDexSet.has(69);

    if (grassMon) {
      recommendations.push({
        pokemon: grassMon.name,
        level: `Lv. ${grassMon.level}`,
        status: 'party',
        statusLabel: '👥 NA TUA EQUIPA',
        role: '⭐ RESISTÊNCIA A ÁGUA',
        reason: 'Planta resiste aos ataques aquáticos mortais da Misty (BubbleBeam) e contra-ataca com Vine Whip super efetivo.'
      });
    } else if (ownsGrass) {
      recommendations.push({
        pokemon: 'Bellsprout / Oddish',
        level: 'Treina até Lv. 18',
        status: 'pc',
        statusLabel: '💾 NA TUA POKÉDEX / PC',
        role: '🌟 TIRA DO PC!',
        reason: 'Excelente suporte defensivo vegetal contra água.',
        depositAdvice
      });
    } else {
      recommendations.push({
        pokemon: 'Bellsprout',
        level: 'Apanha na Rota 24 / 25 e sobe a Lv. 18',
        status: 'wild',
        statusLabel: '📍 DISPONÍVEL NA ROTA 24 / 25 (35%)',
        role: '⭐ APANHA AO NORTE DE CERULEAN!',
        reason: 'Exclusivo do Pokémon Red (35% na Nugget Bridge). Resiste ao BubbleBeam e ataca com Vine Whip.',
        depositAdvice
      });
    }

    const char = party.find(p => p.dex === 4 || p.dex === 5);
    if (char) {
      warnings.push({
        pokemon: char.name,
        text: `🚨 PERIGO EXTREMO: Charmeleon é super fraco a Água. O BubbleBeam do Starmie causa K.O. imediato em 1 turno. Mantém no banco ou guarda no PC temporariamente!`
      });
    }

    // Determina o foco da área atual
    const isAtRoute3 = mapId === 14;
    const isAtRoute4West = mapId === 15 && (!coords || coords.x < 30);
    const ceruleanMapIds = [3, 16, 35, 36, 41, 63, 64, 65, 66, 67, 72, 73, 88];
    const isAtCeruleanArea = ceruleanMapIds.includes(mapId) || (mapId === 15 && coords && coords.x >= 30);

    // Contextualização tática imediata de acordo com a localização do jogador
    if (isAtRoute3 || isAtMtMoon) {
      if (pika) {
        warnings.push({
          pokemon: 'Pikachu',
          text: `⚠️ TÁTICA DO TRAJETO: Pikachu é o atacante principal contra a Líder Misty mais à frente, MAS NÃO O COLOQUES COMO LEAD NO MT. MOON! A caverna tem Geodudes (Terra/Rocha) que são 100% imunes a ataques elétricos. Coloca Butterfree (Confusion) ou Charmeleon (Ember) como Lead para a travessia!`
        });
      }
    }

    if (isAtRoute3) {
      recommendations.unshift({
        pokemon: 'Jigglypuff',
        level: 'Apanha na Rota 3 (10% de spawn)',
        status: ownsDex(39) ? 'party' : 'wild',
        statusLabel: ownsDex(39) ? '👥 NA TUA POKÉDEX' : '📍 ROTA 3 (10% NA RELVA)',
        role: '💤 ESPECIALISTA EM CAPTURA',
        reason: '⭐ EXCLUSIVO DA ROTA 3! O golpe Sing adormece os Pokémon selvagens facilitando capturas sem risco de K.O. Além disso, com a Moon Stone do Mt. Moon evolui para Wigglytuff com HP gigantesco.'
      });
    }

    if (isAtMtMoon) {
      recommendations.unshift({
        pokemon: 'Butterfree / Geodude',
        level: 'Lead recomendado para Mt. Moon',
        status: 'party',
        statusLabel: '🛡️ TÁTICA DO MT. MOON',
        role: '⭐ LEAD IDEAL NA CAVERNA',
        reason: 'Confusion da Butterfree destrói os Zubats e contorna a Defesa maciça dos Geodudes. Geodude na equipa resiste a quase todos os golpes físicos da caverna.'
      });
    }

    function ownsDex(d) {
      return ownedDexSet.has(d);
    }

    const bossTitle = isAtRoute3 ? 'Treinadores da Rota 3 (Rumo ao Mt. Moon)' :
                      isAtMtMoon ? 'Exploração do Mt. Moon (Fósseis & Team Rocket)' :
                      'Líder Misty (Ginásio de Cerulean)';
    const targetLvl = isAtRoute3 ? 'Lv. 10 a 14' : isAtMtMoon ? 'Lv. 12 a 16' : 'Lv. 18 a 21';

    // Batalhas da Rota 3 (8 Treinadores Oficiais - Event Flags 0x3E2 a 0x3E9 na RAM)
    const route3Battles = [
      {
        id: 'r3_bug_1',
        name: 'Bug Catcher Colton',
        location: 'Rota 3 (Entrada Oeste)',
        difficulty: 'Muito Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 1,
        x: 10, y: 6,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E2) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E2)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR DE INSETOS',
        enemyRoster: 'Caterpie (Lv. 10) • Metapod (Lv. 10)',
        targetLevel: 'Lv. 10+',
        optimalLead: 'Charmeleon (Ember) / Pidgey',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ember elimina cada inseto num só golpe.'
      },
      {
        id: 'r3_youngster_1',
        name: 'Youngster Ben',
        location: 'Rota 3 (Caminho Superior)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 2,
        x: 14, y: 4,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E3) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E3)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR',
        enemyRoster: 'Rattata (Lv. 11) • Ekans (Lv. 11)',
        targetLevel: 'Lv. 11+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion é super eficaz contra Ekans (Veneno). Cuidado com Poison Sting.'
      },
      {
        id: 'r3_lass_1',
        name: 'Lass Janice',
        location: 'Rota 3 (Centro)',
        difficulty: 'Muito Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 3,
        x: 16, y: 9,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E4) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E4)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADORA',
        enemyRoster: 'Pidgey (Lv. 9) • Pidgey (Lv. 9)',
        targetLevel: 'Lv. 10+',
        optimalLead: 'Pikachu / Butterfree',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Usa ataques elétricos ou Confusion para vencer sem sofrer dano.'
      },
      {
        id: 'r3_bug_2',
        name: 'Bug Catcher Greg',
        location: 'Rota 3 (Perto do Centro)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 4,
        x: 19, y: 5,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E5) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E5)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR DE INSETOS',
        enemyRoster: 'Caterpie (Lv. 9) • Weedle (Lv. 9) • Caterpie (Lv. 9)',
        targetLevel: 'Lv. 10+',
        optimalLead: 'Charmeleon (Ember)',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ember do Charmeleon limpa facilmente a equipa inteira.'
      },
      {
        id: 'r3_lass_2',
        name: 'Lass Sally',
        location: 'Rota 3 (Caminho Sul)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 5,
        x: 23, y: 4,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E6) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E6)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADORA',
        enemyRoster: 'Rattata (Lv. 10) • Nidoran♀ (Lv. 10)',
        targetLevel: 'Lv. 11+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion elimina Nidoran♀ rapidamente.'
      },
      {
        id: 'r3_youngster_2',
        name: 'Youngster Calvin',
        location: 'Rota 3 (Labirinto)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 6,
        x: 22, y: 9,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E7) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E7)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR',
        enemyRoster: 'Spearow (Lv. 14)',
        targetLevel: 'Lv. 13+',
        optimalLead: 'Pikachu (Thundershock) ou Geodude',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Spearow é rápido e bate forte com Peck. Pikachu derrota com facilidade.'
      },
      {
        id: 'r3_bug_3',
        name: 'Bug Catcher James',
        location: 'Rota 3 (Perto de Mt. Moon)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 7,
        x: 24, y: 6,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E8) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E8)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR DE INSETOS',
        enemyRoster: 'Weedle (Lv. 9) • Kakuna (Lv. 9) • Caterpie (Lv. 9) • Metapod (Lv. 9)',
        targetLevel: 'Lv. 10+',
        optimalLead: 'Charmeleon (Ember)',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Equipa de 4 insetos. Charmeleon limpa facilmente a equipa inteira.'
      },
      {
        id: 'r3_lass_3',
        name: 'Lass Robin',
        location: 'Rota 3 (Canto Nordeste)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 8,
        x: 33, y: 10,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x3E9) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x3E9)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADORA',
        enemyRoster: 'Jigglypuff (Lv. 14)',
        targetLevel: 'Lv. 13+',
        optimalLead: 'Charmeleon / Beedrill',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'CUIDADO COM SING! O Jigglypuff adormece o teu Pokémon. Derrota-o depressa.'
      }
    ];

    // Batalhas de Mt. Moon (12 Treinadores com Event Flags e Coordenadas Reais da ROM pret/pokered)
    const mtMoonBattles = [
      {
        id: 'mtmoon_hiker_1',
        name: 'Hiker Marcos',
        location: 'Mt. Moon 1F (Noroeste)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 1,
        x: 5, y: 6,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x571) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x571)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'MONTANHISTA',
        enemyRoster: 'Geodude (Lv. 10) • Geodude (Lv. 10) • Onix (Lv. 10)',
        targetLevel: 'Lv. 12+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'A carcaça de pedra deles é vulnerável a Confusion (Special). NÃO uses Charmeleon nem Pikachu!'
      },
      {
        id: 'mtmoon_youngster_1',
        name: 'Youngster Josh',
        location: 'Mt. Moon 1F (Centro-Oeste)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 2,
        x: 12, y: 16,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x572) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x572)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR',
        enemyRoster: 'Rattata (Lv. 11) • Zubat (Lv. 11)',
        targetLevel: 'Lv. 11+',
        optimalLead: 'Butterfree / Pikachu',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Pikachu ou Butterfree anulam o Zubat facilmente.'
      },
      {
        id: 'mtmoon_lass_1',
        name: 'Lass Iris',
        location: 'Mt. Moon 1F (Nordeste)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 3,
        x: 30, y: 4,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x573) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x573)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADORA',
        enemyRoster: 'Clefairy (Lv. 14)',
        targetLevel: 'Lv. 12+',
        optimalLead: 'Charmeleon / Nidorino',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Cuidado com Metronome e Sing. Ataca depressa com dano físico.'
      },
      {
        id: 'mtmoon_nerd_1',
        name: 'Super Nerd Jovan',
        location: 'Mt. Moon 1F (Sudeste)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 4,
        x: 24, y: 31,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x574) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x574)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'CIENTISTA',
        enemyRoster: 'Magnemite (Lv. 11) • Voltorb (Lv. 11)',
        targetLevel: 'Lv. 12+',
        optimalLead: 'Charmeleon (Ember)',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ember e golpes de Terra destroem Magnemite e Voltorb.'
      },
      {
        id: 'mtmoon_lass_2',
        name: 'Lass Miriam',
        location: 'Mt. Moon 1F (Centro-Sul)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 5,
        x: 16, y: 23,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x575) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x575)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADORA',
        enemyRoster: 'Oddish (Lv. 11) • Bellsprout (Lv. 11)',
        targetLevel: 'Lv. 12+',
        optimalLead: 'Charmeleon / Butterfree',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ataques de Fogo e Voador dão 2x dano super eficaz.'
      },
      {
        id: 'mtmoon_bug_2',
        name: 'Bug Catcher Robby',
        location: 'Mt. Moon 1F (Sudoeste)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 6,
        x: 7, y: 22,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x576) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x576)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR DE INSETOS',
        enemyRoster: 'Caterpie (Lv. 10) • Metapod (Lv. 10) • Caterpie (Lv. 10)',
        targetLevel: 'Lv. 11+',
        optimalLead: 'Charmeleon / Beedrill',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Combate rápido para recolher EXP com qualquer Pokémon.'
      },
      {
        id: 'mtmoon_bug_1',
        name: 'Bug Catcher Kent',
        location: 'Mt. Moon 1F (Leste)',
        difficulty: 'Muito Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 7,
        x: 30, y: 27,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x577) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x577)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR DE INSETOS',
        enemyRoster: 'Weedle (Lv. 11) • Kakuna (Lv. 11)',
        targetLevel: 'Lv. 10+',
        optimalLead: 'Charmeleon (Ember) / Butterfree',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ember elimina ambos os insetos num só golpe.'
      },
      {
        id: 'mtmoon_super_nerd',
        name: 'Super Nerd Miguel',
        location: 'Mt. Moon B2F (Guardião dos Fósseis)',
        difficulty: 'Chefe / Média',
        diffClass: 'diff-medium',
        difficultyScore: 8,
        x: 12, y: 8,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x579) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x579)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'DISPUTA DE FÓSSEIS',
        enemyRoster: 'Grimer (Lv. 12) • Voltorb (Lv. 12) • Koffing (Lv. 12)',
        targetLevel: 'Lv. 14+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Guardião dos fósseis (Dome ou Helix Fossil). Confusion aniquila Grimer e Koffing (Veneno).'
      },
      {
        id: 'mtmoon_rocket_grunt_1',
        name: 'Team Rocket Grunt #1',
        location: 'Mt. Moon B2F (Oeste)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 9,
        x: 11, y: 16,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x57A) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x57A)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TEAM ROCKET',
        enemyRoster: 'Sandshrew (Lv. 11) • Rattata (Lv. 11) • Zubat (Lv. 11)',
        targetLevel: 'Lv. 13+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Butterfree é imune a ataques de Terra do Sandshrew e bate forte no Zubat.'
      },
      {
        id: 'mtmoon_rocket_grunt_2',
        name: 'Team Rocket Grunt #2',
        location: 'Mt. Moon B2F (Centro-Sul)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 10,
        x: 15, y: 22,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x57B) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x57B)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TEAM ROCKET',
        enemyRoster: 'Zubat (Lv. 12) • Ekans (Lv. 12)',
        targetLevel: 'Lv. 13+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Ambos são tipo Veneno. Confusion é 2x super eficaz contra os dois.'
      },
      {
        id: 'mtmoon_rocket_grunt_3',
        name: 'Team Rocket Grunt #3',
        location: 'Mt. Moon B2F (Leste-Norte)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 11,
        x: 29, y: 11,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x57C) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x57C)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TEAM ROCKET',
        enemyRoster: 'Raticate (Lv. 13)',
        targetLevel: 'Lv. 14+',
        optimalLead: 'Charmeleon / Geodude',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Cuidado com Hyper Fang. Raticate tem alta velocidade e ataque rápido.'
      },
      {
        id: 'mtmoon_rocket_exit',
        name: 'Team Rocket Grunt #4 (Saída)',
        location: 'Mt. Moon B2F (Porta da Saída)',
        difficulty: 'Difícil',
        diffClass: 'diff-hard',
        difficultyScore: 12,
        x: 29, y: 17,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(0x57D) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(0x57D)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TEAM ROCKET (SAÍDA)',
        enemyRoster: 'Raticate (Lv. 16)',
        targetLevel: 'Lv. 15+',
        optimalLead: 'Charmeleon / Geodude',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'CUIDADO COM HYPER FANG! O Raticate causa dano massivo. Um tipo Rocha (Geodude) reduz o dano drasticamente.'
      }
    ];

    // Batalhas de Cerulean, Rota 24, Rota 25 e Ginásio de Cerulean (16 Treinadores com Event Flags Reais da ROM)
    const ceruleanBattles = [
      {
        id: 'cerulean_rival',
        name: 'Rival Blue #3',
        location: 'Rota 24 (Entrada da Ponte)',
        difficulty: 'Chefe / Difícil',
        diffClass: 'diff-hard',
        difficultyScore: 11,
        x: 10, y: 15,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_RIVAL) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_RIVAL)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'RIVAL BLUE',
        enemyRoster: 'Pidgeotto (Lv. 18) • Abra (Lv. 15) • Rattata (Lv. 15) • Wartortle (Lv. 17)',
        targetLevel: 'Lv. 18+',
        optimalLead: 'Pikachu (Pidgeotto/Wartortle)',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Pikachu neutraliza Pidgeotto e Wartortle. Butterfree ou Charmeleon limpam o resto.'
      },
      // Rota 24 (Ponte Nugget - 5 Treinadores + Rocket Grunt)
      {
        id: 'r24_bridge_1',
        name: 'Bug Catcher Cale',
        location: 'Rota 24 (Ponte #1)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 5,
        x: 11, y: 15,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_0) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_0)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'PONTE NUGGET',
        enemyRoster: 'Caterpie (Lv. 10) • Weedle (Lv. 10)',
        targetLevel: 'Lv. 12+',
        optimalLead: 'Charmeleon (Ember) / Butterfree',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ataques de Fogo ou Voador derrotam os insetos instantaneamente.'
      },
      {
        id: 'r24_bridge_2',
        name: 'Lass Ali',
        location: 'Rota 24 (Ponte #2)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 6,
        x: 10, y: 19,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_1) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_1)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'PONTE NUGGET',
        enemyRoster: 'Pidgey (Lv. 12) • Oddish (Lv. 12) • Bellsprout (Lv. 12)',
        targetLevel: 'Lv. 13+',
        optimalLead: 'Pikachu / Charmeleon',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Pikachu para Pidgey; Charmeleon com Ember para Oddish e Bellsprout.'
      },
      {
        id: 'r24_bridge_3',
        name: 'Youngster Timmy',
        location: 'Rota 24 (Ponte #3)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 7,
        x: 11, y: 23,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_2) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_2)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'PONTE NUGGET',
        enemyRoster: 'Sandshrew (Lv. 14) • Ekans (Lv. 14)',
        targetLevel: 'Lv. 14+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion é super eficaz contra Ekans e causa dano especial a Sandshrew.'
      },
      {
        id: 'r24_bridge_4',
        name: 'Lass Reli',
        location: 'Rota 24 (Ponte #4)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 8,
        x: 10, y: 27,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_3) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_3)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'PONTE NUGGET',
        enemyRoster: 'Nidoran♀ (Lv. 16) • Nidoran♂ (Lv. 16)',
        targetLevel: 'Lv. 15+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Ambos os Nidorans são Poison; Confusion causa 2x dano super eficaz.'
      },
      {
        id: 'r24_bridge_5',
        name: 'Jr. Trainer♂ Shane',
        location: 'Rota 24 (Ponte #5)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 9,
        x: 11, y: 31,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_4) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_4)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'PONTE NUGGET',
        enemyRoster: 'Mankey (Lv. 18)',
        targetLevel: 'Lv. 16+',
        optimalLead: 'Butterfree (Confusion) / Pidgeotto',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Mankey é Lutador puro: fraqueza a Psíquico e Voador. Cuidado com Karate Chop.'
      },
      {
        id: 'r24_rocket',
        name: 'Team Rocket Grunt (Nugget)',
        location: 'Rota 24 (Fim da Ponte)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 10,
        x: 10, y: 33,
        isDefeated: eventFlagsChecker ? (eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE24_ROCKET) || eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5)) : false,
        statusLabel: (eventFlagsChecker && (eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE24_ROCKET) || eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5))) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TEAM ROCKET',
        enemyRoster: 'Ekans (Lv. 15) • Zubat (Lv. 15)',
        targetLevel: 'Lv. 16+',
        optimalLead: 'Butterfree / Pikachu',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Pikachu destrói o Zubat com Thundershock; Confusion elimina o Ekans.'
      },
      {
        id: 'r24_grass_trainer',
        name: 'Jr. Trainer♂ Ethan',
        location: 'Rota 24 (Relva Noroeste)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 7,
        x: 7, y: 7,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TREINADOR',
        enemyRoster: 'Rattata (Lv. 14) • Ekans (Lv. 14)',
        targetLevel: 'Lv. 14+',
        optimalLead: 'Butterfree / Charmeleon',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion e ataques normais limpam este treinador rapidamente.'
      },
      // Rota 25 (Caminho até Bill - 9 Treinadores)
      {
        id: 'r25_trainer_0',
        name: 'Youngster Joey',
        location: 'Rota 25 (Início)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 6,
        x: 14, y: 7,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_0) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_0)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Rattata (Lv. 15) • Spearow (Lv. 15)',
        targetLevel: 'Lv. 15+',
        optimalLead: 'Geodude / Pikachu',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Pikachu derrota o Spearow; Geodude resiste aos ataques normais.'
      },
      {
        id: 'r25_trainer_1',
        name: 'Youngster Dan',
        location: 'Rota 25 (Caminho)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 7,
        x: 18, y: 5,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_1) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_1)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Slowpoke (Lv. 17)',
        targetLevel: 'Lv. 16+',
        optimalLead: 'Pikachu (Thundershock)',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Slowpoke tem HP alto mas fraqueza crítica a Electric. Pikachu vence com facilidade.'
      },
      {
        id: 'r25_trainer_2',
        name: 'Jr. Trainer♂ Flint',
        location: 'Rota 25 (Labirinto)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 6,
        x: 24, y: 4,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_2) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_2)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Rattata (Lv. 14) • Ekans (Lv. 14)',
        targetLevel: 'Lv. 15+',
        optimalLead: 'Butterfree / Charmeleon',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion e golpes fortes físicos.'
      },
      {
        id: 'r25_trainer_3',
        name: 'Lass Haley',
        location: 'Rota 25 (Centro)',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 6,
        x: 18, y: 7,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_3) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_3)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Oddish (Lv. 15) • Pidgey (Lv. 15) • Oddish (Lv. 15)',
        targetLevel: 'Lv. 15+',
        optimalLead: 'Charmeleon (Ember)',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ember elimina Oddish rapidamente. Pikachu trata do Pidgey.'
      },
      {
        id: 'r25_trainer_4',
        name: 'Hiker Franklin',
        location: 'Rota 25 (Perto da Casa)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 8,
        x: 32, y: 3,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_4) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_4)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Machop (Lv. 15) • Geodude (Lv. 15)',
        targetLevel: 'Lv. 16+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion destrói o Machop e ataca a baixa Special do Geodude.'
      },
      {
        id: 'r25_trainer_5',
        name: 'Youngster Chad',
        location: 'Rota 25',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 6,
        x: 37, y: 4,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_5) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_5)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Ekans (Lv. 14) • Sandshrew (Lv. 14)',
        targetLevel: 'Lv. 15+',
        optimalLead: 'Butterfree',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Golpes psíquicos limpam ambos os alvos.'
      },
      {
        id: 'r25_trainer_6',
        name: 'Hiker Wayne',
        location: 'Rota 25',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 8,
        x: 40, y: 7,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_6) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_6)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Onix (Lv. 17)',
        targetLevel: 'Lv. 16+',
        optimalLead: 'Butterfree / Golpes Especiais',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Onix tem Defesa gigante mas Special muito baixa. Não uses golpes físicos ou elétricos!'
      },
      {
        id: 'r25_trainer_7',
        name: 'Lass Robin',
        location: 'Rota 25',
        difficulty: 'Fácil',
        diffClass: 'diff-easy',
        difficultyScore: 6,
        x: 45, y: 3,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_7) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_7)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Bellsprout (Lv. 13) • Pidgey (Lv. 13) • Oddish (Lv. 13)',
        targetLevel: 'Lv. 14+',
        optimalLead: 'Charmeleon (Ember)',
        idealLineup: computeIdealPartyLineup(party, 5),
        strategyText: 'Ember do Charmeleon derrota a equipa toda.'
      },
      {
        id: 'r25_trainer_8',
        name: 'Hiker Nob',
        location: 'Rota 25 (Junto à Casa de Bill)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 8,
        x: 51, y: 7,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_8) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_8)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'ROTA 25',
        enemyRoster: 'Geodude (Lv. 13) x2 • Machop (Lv. 13)',
        targetLevel: 'Lv. 15+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion vence todos os 3 alvos facilmente.'
      },
      // Cerulean City: Rocket Thief com TM28 Dig
      {
        id: 'cerulean_rocket_thief',
        name: 'Team Rocket Ladrão (TM28 Dig)',
        location: 'Cerulean City (Atrás da Casa Roubada)',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 9,
        x: 30, y: 7,
        isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_ROCKET_THIEF) : false,
        statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_ROCKET_THIEF)) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'TEAM ROCKET',
        enemyRoster: 'Machop (Lv. 17) • Drowzee (Lv. 17)',
        targetLevel: 'Lv. 17+',
        optimalLead: 'Butterfree (Confusion)',
        idealLineup: computeIdealPartyLineup(party, 12),
        strategyText: 'Confusion é super eficaz contra o Machop. Derrota-o para recuperar o TM28 Dig!'
      },
      // Ginásio de Cerulean
      {
        id: 'cerulean_gym_swimmer',
        name: 'Swimmer Luis',
        location: 'Ginásio de Cerulean',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 8,
        x: 4, y: 7,
        isDefeated: hasCascadeBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_0) : false),
        statusLabel: (hasCascadeBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_0))) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'GINÁSIO',
        enemyRoster: 'Horsea (Lv. 16) • Shellder (Lv. 16)',
        targetLevel: 'Lv. 16+',
        optimalLead: 'Pikachu (Thundershock)',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Golpes elétricos derrotam ambos num só ataque.'
      },
      {
        id: 'cerulean_gym_jr_trainer',
        name: 'Jr. Trainer♀ Diana',
        location: 'Ginásio de Cerulean',
        difficulty: 'Média',
        diffClass: 'diff-medium',
        difficultyScore: 9,
        x: 2, y: 3,
        isDefeated: hasCascadeBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_1) : false),
        statusLabel: (hasCascadeBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_1))) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: 'GINÁSIO',
        enemyRoster: 'Goldeen (Lv. 19)',
        targetLevel: 'Lv. 18+',
        optimalLead: 'Pikachu (Thundershock)',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'Usa Pikachu com Thundershock para vencer antes que a Goldeen use Horn Attack.'
      },
      {
        id: 'cerulean_gym_misty',
        name: 'Líder Misty',
        location: 'Ginásio de Cerulean (Chefe)',
        difficulty: 'Chefe / Difícil',
        diffClass: 'diff-hard',
        difficultyScore: 12,
        x: 5, y: 3,
        isDefeated: hasCascadeBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_MISTY) : false),
        statusLabel: (hasCascadeBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_MISTY))) ? '✅ VENCIDO' : '⚔️ POR VENCER',
        badgeTag: '🏆 INSÍGNIA CASCADE',
        enemyRoster: 'Staryu (Lv. 18 - Water) • Starmie (Lv. 21 - Water/Psychic)',
        targetLevel: 'Lv. 19 a 22',
        optimalLead: 'Pikachu / Bellsprout',
        idealLineup: computeIdealPartyLineup(party, 25),
        strategyText: 'PERIGO EXTREMO COM BUBBLEBEAM! Pikachu ou Planta são obrigatórios. Não uses Charmeleon ou Geodude!'
      }
    ];

    let floorMtMoonBattles = mtMoonBattles;
    if (mapId === 59) {
      // Piso 1F: apenas os 7 treinadores de 1F
      floorMtMoonBattles = mtMoonBattles.filter(b => b.location.includes('1F'));
    } else if (mapId === 61) {
      // Cave B2F: apenas os 5 treinadores de B2F
      floorMtMoonBattles = mtMoonBattles.filter(b => b.location.includes('B2F'));
    }

    let battles = isAtRoute3 ? route3Battles :
                  isAtMtMoon ? floorMtMoonBattles :
                  mapId === 35 ? ceruleanBattles.filter(b => b.location.includes('Rota 24')) :
                  mapId === 36 ? ceruleanBattles.filter(b => b.location.includes('Rota 25')) :
                  mapId === 65 ? ceruleanBattles.filter(b => b.location.includes('Ginásio')) :
                  isAtCeruleanArea ? ceruleanBattles :
                  [...route3Battles, ...mtMoonBattles, ...ceruleanBattles];

    battles.sort((a, b) => a.difficultyScore - b.difficultyScore);

    return {
      bossTitle,
      enemyRoster: isAtRoute3 ? 'Treinadores da Rota 3' : isAtMtMoon ? (mapId === 59 ? 'Treinadores do Mt. Moon (1F)' : 'Team Rocket & Super Nerd (B2F)') : 'Staryu (Lv. 18) & Starmie (Lv. 21)',
      targetLevel: targetLvl,
      partyFull: party.length >= 6,
      defaultDepositAdvice: depositAdvice,
      recommendations,
      warnings,
      invTactics: (isAtRoute3 || isAtMtMoon) ? ['🎒 Cura no Pokécenter de Pewter ou no Mt. Moon se o HP estiver baixo. Compra Escape Ropes se precisares.'] : ['🎒 Compra Super Potions no Pokémart de Cerulean City para aguentar o BubbleBeam.'],
      battles
    };
  }

  // 3. APÓS A SEGUNDA INSÍGNIA (CERULEAN COMPLETO / ROTA 5-6 / VERMILION / LT. SURGE)
  if (badgeCount === 2) {
    const ceruleanMapIds = [3, 16, 35, 36, 41, 63, 64, 65, 66, 67, 72, 73, 88];
    const isAtCeruleanArea = ceruleanMapIds.includes(mapId) || (mapId === 15 && coords && coords.x >= 30);
    
    // Treinadores da Rota 6 (Vermilion Norte)
    const route6Battles = [
      { id: 'r6_jr_0', name: 'Jr. Trainer♂ Ricky', location: 'Rota 6', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 6, x: 9, y: 15, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_0) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_0)) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Squirtle (Lv. 20)', targetLevel: 'Lv. 19+', optimalLead: 'Pikachu (Thundershock)', strategyText: 'Pikachu neutraliza facilmente o Squirtle.' },
      { id: 'r6_jr_1', name: 'Jr. Trainer♀ Nancy', location: 'Rota 6', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 6, x: 19, y: 15, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_1) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_1)) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Rattata (Lv. 16) • Pikachu (Lv. 16)', targetLevel: 'Lv. 18+', optimalLead: 'Geodude / Butterfree', strategyText: 'Geodude é imune a Electric e resiste a Normal.' },
      { id: 'r6_bug_0', name: 'Bug Catcher Keigo', location: 'Rota 6', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 5, x: 19, y: 26, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_2) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_2)) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Butterfree (Lv. 20)', targetLevel: 'Lv. 19+', optimalLead: 'Pikachu / Charmeleon', strategyText: 'Pikachu ou fogo derrotam Butterfree.' },
      { id: 'r6_jr_2', name: 'Jr. Trainer♂ Jeff', location: 'Rota 6', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 7, x: 9, y: 21, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_3) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_3)) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Spearow (Lv. 16) • Raticate (Lv. 16)', targetLevel: 'Lv. 18+', optimalLead: 'Pikachu / Geodude', strategyText: 'Cuidado com Hyper Fang do Raticate.' },
      { id: 'r6_jr_3', name: 'Jr. Trainer♀ Izzy', location: 'Rota 6', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 7, x: 15, y: 21, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_4) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_4)) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Pidgey (Lv. 16) • Pidgey (Lv. 16) • Pidgey (Lv. 16)', targetLevel: 'Lv. 17+', optimalLead: 'Pikachu', strategyText: 'Pikachu limpa os três pássaros.' },
      { id: 'r6_bug_1', name: 'Bug Catcher Elijah', location: 'Rota 6', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 5, x: 11, y: 31, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_5) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_6_TRAINER_5)) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Weedle (Lv. 16) • Caterpie (Lv. 16) • Weedle (Lv. 16)', targetLevel: 'Lv. 17+', optimalLead: 'Charmeleon', strategyText: 'Ember limpa os insetos.' }
    ];

    // Ginásio de Vermilion (Lt. Surge)
    const surgeGymBattles = [
      { id: 'surge_sailor', name: 'Sailor Dwayne', location: 'Ginásio de Vermilion', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 7, x: 5, y: 3, isDefeated: hasThunderBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_VERMILION_GYM_TRAINER_0) : false), statusLabel: (hasThunderBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_VERMILION_GYM_TRAINER_0))) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Pikachu (Lv. 21) • Pikachu (Lv. 21)', targetLevel: 'Lv. 20+', optimalLead: 'Diglett (Dig)', strategyText: 'Diglett é 100% imune a ataques elétricos.' },
      { id: 'surge_rocker', name: 'Rocker Perry', location: 'Ginásio de Vermilion', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 7, x: 2, y: 3, isDefeated: hasThunderBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_VERMILION_GYM_TRAINER_1) : false), statusLabel: (hasThunderBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_VERMILION_GYM_TRAINER_1))) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Voltorb (Lv. 20) • Magnemite (Lv. 20)', targetLevel: 'Lv. 20+', optimalLead: 'Diglett (Dig)', strategyText: 'Dig destrói ambos num único turno.' },
      { id: 'surge_gentleman', name: 'Gentleman Tucker', location: 'Ginásio de Vermilion', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 8, x: 5, y: 8, isDefeated: hasThunderBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_VERMILION_GYM_TRAINER_2) : false), statusLabel: (hasThunderBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_VERMILION_GYM_TRAINER_2))) ? '✅ VENCIDO' : '⚔️ POR VENCER', enemyRoster: 'Pikachu (Lv. 23)', targetLevel: 'Lv. 21+', optimalLead: 'Diglett (Dig)', strategyText: 'Diglett vence facilmente sem sofrer dano.' },
      { id: 'surge_leader', name: 'Líder Lt. Surge', location: 'Ginásio de Vermilion (Líder)', difficulty: 'Chefe / Difícil', diffClass: 'diff-hard', difficultyScore: 12, x: 5, y: 1, isDefeated: hasThunderBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_LT_SURGE) : false), statusLabel: (hasThunderBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_LT_SURGE))) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: '⚡ INSÍGNIA THUNDER', enemyRoster: 'Voltorb (Lv. 21) • Pikachu (Lv. 18) • Raichu (Lv. 24 - Thunderbolt)', targetLevel: 'Lv. 22 a 25', optimalLead: 'Diglett / Dugtrio', strategyText: '100% Imune a Electric! Usa Dig no Raichu para aniquilar sem sofrer dano.' }
    ];

    if (isAtCeruleanArea) {
      // Jogador ainda está em Cerulean City, Rota 24, Rota 25 ou casa de Bill
      const ceruleanAllBattles = [
        { id: 'cerulean_rival', name: 'Rival Blue #3', location: 'Rota 24 (Entrada da Ponte)', difficulty: 'Chefe', diffClass: 'diff-hard', difficultyScore: 11, x: 10, y: 15, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_RIVAL) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_RIVAL)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'RIVAL BLUE', enemyRoster: 'Pidgeotto (Lv. 18) • Abra (Lv. 15) • Rattata (Lv. 15) • Wartortle (Lv. 17)', targetLevel: 'Lv. 18+', optimalLead: 'Pikachu', strategyText: 'Pikachu neutraliza Pidgeotto e Wartortle.' },
        { id: 'r24_bridge_1', name: 'Bug Catcher Cale', location: 'Rota 24 (Ponte #1)', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 5, x: 11, y: 15, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_0) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_0)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'PONTE NUGGET', enemyRoster: 'Caterpie (Lv. 10) • Weedle (Lv. 10)', targetLevel: 'Lv. 12+', optimalLead: 'Charmeleon', strategyText: 'Ember elimina os insetos.' },
        { id: 'r24_bridge_2', name: 'Lass Ali', location: 'Rota 24 (Ponte #2)', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 6, x: 10, y: 19, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_1) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_1)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'PONTE NUGGET', enemyRoster: 'Pidgey (Lv. 12) • Oddish (Lv. 12) • Bellsprout (Lv. 12)', targetLevel: 'Lv. 13+', optimalLead: 'Pikachu', strategyText: 'Pikachu e Charmeleon limpam.' },
        { id: 'r24_bridge_3', name: 'Youngster Timmy', location: 'Rota 24 (Ponte #3)', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 7, x: 11, y: 23, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_2) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_2)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'PONTE NUGGET', enemyRoster: 'Sandshrew (Lv. 14) • Ekans (Lv. 14)', targetLevel: 'Lv. 14+', optimalLead: 'Butterfree', strategyText: 'Confusion contra Ekans e Sandshrew.' },
        { id: 'r24_bridge_4', name: 'Lass Reli', location: 'Rota 24 (Ponte #4)', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 8, x: 10, y: 27, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_3) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_3)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'PONTE NUGGET', enemyRoster: 'Nidoran♀ (Lv. 16) • Nidoran♂ (Lv. 16)', targetLevel: 'Lv. 15+', optimalLead: 'Butterfree', strategyText: 'Confusion causa 2x dano.' },
        { id: 'r24_bridge_5', name: 'Jr. Trainer♂ Shane', location: 'Rota 24 (Ponte #5)', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 9, x: 11, y: 31, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_4) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_4)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'PONTE NUGGET', enemyRoster: 'Mankey (Lv. 18)', targetLevel: 'Lv. 16+', optimalLead: 'Butterfree', strategyText: 'Fraqueza a Psíquico e Voador.' },
        { id: 'r24_rocket', name: 'Team Rocket Grunt (Nugget)', location: 'Rota 24 (Fim da Ponte)', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 10, x: 10, y: 33, isDefeated: eventFlagsChecker ? (eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE24_ROCKET) || eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5)) : false, statusLabel: (eventFlagsChecker && (eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE24_ROCKET) || eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5))) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'TEAM ROCKET', enemyRoster: 'Ekans (Lv. 15) • Zubat (Lv. 15)', targetLevel: 'Lv. 16+', optimalLead: 'Pikachu', strategyText: 'Pikachu e Butterfree.' },
        { id: 'r24_grass_trainer', name: 'Jr. Trainer♂ Ethan', location: 'Rota 24 (Relva)', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 7, x: 7, y: 7, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_24_TRAINER_5)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'TREINADOR', enemyRoster: 'Rattata (Lv. 14) • Ekans (Lv. 14)', targetLevel: 'Lv. 14+', optimalLead: 'Butterfree', strategyText: 'Ataques rápidos.' },
        { id: 'r25_trainer_0', name: 'Youngster Joey', location: 'Rota 25', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 6, x: 14, y: 7, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_0) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_0)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Rattata (Lv. 15) • Spearow (Lv. 15)', targetLevel: 'Lv. 15+', optimalLead: 'Pikachu', strategyText: 'Pikachu para Spearow.' },
        { id: 'r25_trainer_1', name: 'Youngster Dan', location: 'Rota 25', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 7, x: 18, y: 5, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_1) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_1)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Slowpoke (Lv. 17)', targetLevel: 'Lv. 16+', optimalLead: 'Pikachu', strategyText: 'Fraqueza a Electric.' },
        { id: 'r25_trainer_2', name: 'Jr. Trainer♂ Flint', location: 'Rota 25', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 6, x: 24, y: 4, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_2) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_2)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Rattata (Lv. 14) • Ekans (Lv. 14)', targetLevel: 'Lv. 15+', optimalLead: 'Butterfree', strategyText: 'Confusion e golpes fortes.' },
        { id: 'r25_trainer_3', name: 'Lass Haley', location: 'Rota 25', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 6, x: 18, y: 7, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_3) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_3)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Oddish (Lv. 15) • Pidgey (Lv. 15) • Oddish (Lv. 15)', targetLevel: 'Lv. 15+', optimalLead: 'Charmeleon', strategyText: 'Ember elimina Oddish.' },
        { id: 'r25_trainer_4', name: 'Hiker Franklin', location: 'Rota 25', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 8, x: 32, y: 3, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_4) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_4)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Machop (Lv. 15) • Geodude (Lv. 15)', targetLevel: 'Lv. 16+', optimalLead: 'Butterfree', strategyText: 'Confusion destrói Machop.' },
        { id: 'r25_trainer_5', name: 'Youngster Chad', location: 'Rota 25', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 6, x: 37, y: 4, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_5) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_5)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Ekans (Lv. 14) • Sandshrew (Lv. 14)', targetLevel: 'Lv. 15+', optimalLead: 'Butterfree', strategyText: 'Golpes psíquicos.' },
        { id: 'r25_trainer_6', name: 'Hiker Wayne', location: 'Rota 25', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 8, x: 40, y: 7, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_6) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_6)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Onix (Lv. 17)', targetLevel: 'Lv. 16+', optimalLead: 'Butterfree', strategyText: 'Ataca no lado Especial.' },
        { id: 'r25_trainer_7', name: 'Lass Robin', location: 'Rota 25', difficulty: 'Fácil', diffClass: 'diff-easy', difficultyScore: 6, x: 45, y: 3, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_7) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_7)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Bellsprout (Lv. 13) • Pidgey (Lv. 13) • Oddish (Lv. 13)', targetLevel: 'Lv. 14+', optimalLead: 'Charmeleon', strategyText: 'Ember limpa.' },
        { id: 'r25_trainer_8', name: 'Hiker Nob', location: 'Rota 25', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 8, x: 51, y: 7, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_8) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_ROUTE_25_TRAINER_8)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'ROTA 25', enemyRoster: 'Geodude (Lv. 13) x2 • Machop (Lv. 13)', targetLevel: 'Lv. 15+', optimalLead: 'Butterfree', strategyText: 'Confusion.' },
        { id: 'cerulean_rocket_thief', name: 'Team Rocket Ladrão (TM28 Dig)', location: 'Cerulean City (Atrás da Casa Roubada)', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 9, x: 30, y: 7, isDefeated: eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_ROCKET_THIEF) : false, statusLabel: (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_ROCKET_THIEF)) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'TEAM ROCKET', enemyRoster: 'Machop (Lv. 17) • Drowzee (Lv. 17)', targetLevel: 'Lv. 17+', optimalLead: 'Butterfree (Confusion)', strategyText: 'Confusion destrói o Machop. Recupera o TM28 Dig!' },
        { id: 'cerulean_gym_swimmer', name: 'Swimmer Luis', location: 'Ginásio de Cerulean', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 8, x: 4, y: 7, isDefeated: hasCascadeBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_0) : false), statusLabel: (hasCascadeBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_0))) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'GINÁSIO', enemyRoster: 'Horsea (Lv. 16) • Shellder (Lv. 16)', targetLevel: 'Lv. 16+', optimalLead: 'Pikachu (Thundershock)', strategyText: 'Golpes elétricos.' },
        { id: 'cerulean_gym_jr_trainer', name: 'Jr. Trainer♀ Diana', location: 'Ginásio de Cerulean', difficulty: 'Média', diffClass: 'diff-medium', difficultyScore: 9, x: 2, y: 3, isDefeated: hasCascadeBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_1) : false), statusLabel: (hasCascadeBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_GYM_TRAINER_1))) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: 'GINÁSIO', enemyRoster: 'Goldeen (Lv. 19)', targetLevel: 'Lv. 18+', optimalLead: 'Pikachu (Thundershock)', strategyText: 'Thundershock.' },
        { id: 'cerulean_gym_misty', name: 'Líder Misty', location: 'Ginásio de Cerulean (Líder)', difficulty: 'Chefe', diffClass: 'diff-hard', difficultyScore: 12, x: 5, y: 3, isDefeated: hasCascadeBadge || (eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_MISTY) : false), statusLabel: (hasCascadeBadge || (eventFlagsChecker && eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_MISTY))) ? '✅ VENCIDO' : '⚔️ POR VENCER', badgeTag: '🏆 INSÍGNIA CASCADE', enemyRoster: 'Staryu (Lv. 18) • Starmie (Lv. 21)', targetLevel: 'Lv. 19 a 22', optimalLead: 'Pikachu', strategyText: 'Insignia Cascade obtida!' }
      ];

      const rocketDefeated = eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_BEAT_CERULEAN_ROCKET_THIEF) : false;
      const billHelped = eventFlagsChecker ? eventFlagsChecker(EVENT_FLAGS.EVENT_GOT_SS_TICKET) : false;
      const pendingBattles = ceruleanAllBattles.filter(b => !b.isDefeated);

      let activeBattles = mapId === 35 ? ceruleanAllBattles.filter(b => b.location.includes('Rota 24')) :
                          mapId === 36 ? ceruleanAllBattles.filter(b => b.location.includes('Rota 25')) :
                          mapId === 65 ? ceruleanAllBattles.filter(b => b.location.includes('Ginásio')) :
                          ceruleanAllBattles;

      return {
        bossTitle: !rocketDefeated ? 'Cerulean City: Apanha o Rocket Ladrão (TM28 Dig)' : (!billHelped ? 'Rota 25: Visita a Casa do Bill (Obtém o S.S. Ticket)' : 'Cerulean City Concluído! Segue para Sul rumo a Vermilion'),
        enemyRoster: pendingBattles.length > 0 ? `${pendingBattles[0].name}: ${pendingBattles[0].enemyRoster}` : '🏆 Todos os Treinadores de Cerulean Vencidos!',
        targetLevel: 'Lv. 18 a 22',
        partyFull: party.length >= 6,
        defaultDepositAdvice: null,
        recommendations: [
          {
            pokemon: 'Diglett / Dugtrio',
            level: 'Apanha na Diglett\'s Cave logo à entrada de Vermilion',
            status: 'wild',
            statusLabel: '📍 PRÓXIMO GINÁSIO: VERMILION',
            role: '⭐ COUNTER DO LT. SURGE',
            reason: 'Imunidade total a Electric. Vence o Surge sozinho.'
          }
        ],
        warnings: [],
        invTactics: ['🎒 Ensina o TM28 Dig a um Pokémon ou usa-o para abrir atalhos.'],
        battles: activeBattles
      };
    }

    const hasDiglett = party.find(p => p.dex === 50 || p.dex === 51);
    const ownsDiglett = ownedDexSet.has(50) || ownedDexSet.has(51);

    const bossWeakTypes = ['Flying', 'Water'];
    const bossImmuneTypes = [];
    const protectedDexList = [50, 51];
    const depositAdvice = suggestPartyMemberToDeposit(party, protectedDexList, bossWeakTypes, bossImmuneTypes, 'Líder Lt. Surge');

    const recommendations = [];
    if (hasDiglett) {
      recommendations.push({
        pokemon: hasDiglett.name,
        level: `Lv. ${hasDiglett.level}`,
        status: 'party',
        statusLabel: '👥 NA TUA EQUIPA',
        role: '⭐ O MELHOR COUNTER DO JOGO!',
        reason: '100% Imune a todos os ataques elétricos do Surge. Usa Dig e aniquila o Raichu sem sofrer dano.'
      });
    } else if (ownsDiglett) {
      recommendations.push({
        pokemon: 'Diglett / Dugtrio',
        level: 'Tira do PC (Dig)',
        status: 'pc',
        statusLabel: '💾 NA TUA POKÉDEX / PC',
        role: '🌟 TIRA DO PC!',
        reason: 'O melhor counter de eletricidade da primeira geração.',
        depositAdvice
      });
    } else {
      recommendations.push({
        pokemon: 'Diglett / Dugtrio',
        level: 'Apanha na Diglett\'s Cave (Lv. 15 a 31)',
        status: 'wild',
        statusLabel: '📍 DISPONÍVEL NA DIGLETT\'S CAVE (AO LADO!)',
        role: '⭐ ENTRA NO TÚNEL AO LADO DO GINÁSIO!',
        reason: '95% Diglett e 5% Dugtrio a nível 29-31 logo na caverna ao lado de Vermilion! Imunidade total a Electric e vence o Surge sozinho.',
        depositAdvice
      });
    }

    const vermilionBattles = [
      ...route6Battles,
      ...surgeGymBattles
    ];

    return {
      bossTitle: 'Líder Lt. Surge (Ginásio de Vermilion)',
      enemyRoster: 'Voltorb (Lv. 21), Pikachu (Lv. 18) & Raichu (Lv. 24 - Thunderbolt)',
      targetLevel: 'Lv. 22 a 25',
      partyFull: party.length >= 6,
      defaultDepositAdvice: depositAdvice,
      recommendations,
      warnings: [
        {
          pokemon: 'Pidgeotto / Butterfree',
          text: '🚨 Fraqueza crítica a Electric. O Thunderbolt do Raichu elimina pássaros e insetos instantaneamente. Deixa no PC durante este ginásio.'
        }
      ],
      invTactics: ['🎒 Tem Parlyz Heals na mochila caso o Raichu use Thunder Wave.'],
      battles: vermilionBattles
    };
  }

  return null;
}

module.exports = {
  AREA_DATABASE,
  getAreaInfo,
  getUpcomingBossTactics
};
