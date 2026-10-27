// AI Tactical Advisor via Groq API (LLaMA 3.3 70B Versatile)
const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function queryGroq(messages, temperature = 0.6) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages,
        temperature,
        max_tokens: 300
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Groq API Error]:', errText);
      return null;
    }

    const data = await res.json();
    return data.choices && data.choices[0] ? data.choices[0].message.content : null;
  } catch (err) {
    console.error('[Groq Network Error]:', err.message);
    return null;
  }
}

let lastAdviceTime = 0;
let cachedAdvice = null;

async function getLiveAdvice(state, force = false) {
  if (!state || !state.connected || !state.memoryReadStatus?.verified || state.isSimulation ||
      !state.lastUpdate || !Number.isFinite(Date.parse(state.lastUpdate)) ||
      Date.now() - Date.parse(state.lastUpdate) < 0 ||
      Date.now() - Date.parse(state.lastUpdate) >= 15000)
    return 'Telemetria RAM indisponível ou incompleta; não emitir decisões sobre dados antigos ou simulados.';
  // Não converter estimativas legadas ou ROM/RAM incompletas em conselhos táticos de combate.
  if (state.inBattle && (!state.battle || state.battle.exactTurnMathReady !== true)) {
    return 'Combate detetado, mas probabilidades e recomendações exatas estão suspensas até verificar os dados deste turno e as fórmulas desta ROM.';
  }
  const now = Date.now();
  if (!force && now - lastAdviceTime < 15000) {
    return cachedAdvice;
  }
  lastAdviceTime = now;

  const context = {
    trainer: state.trainerName || 'RED',
    location: state.mapName,
    money: state.money,
    badges: (state.badges || []).filter(b => b.obtained).map(b => b.name),
    inventory: (state.inventory || []).map(i => `${i.name} (x${i.qty})`),
    pcStoredItems: (state.pcItems || []).map(i => `${i.name} (x${i.qty})`),
    pcCurrentBox: (state.pcBox?.pokemon || []).map(p => ({ name:p.name, level:p.level, dex:p.dex, verified:p.valuesVerified })),
    daycare: state.daycare || null,
    pokedexOwned: state.pokedexOwned || [],
    progressEventFlags: state.eventFlagTelemetry?.verifiedRamCoverage ?
      state.eventFlagTelemetry.completeNamedStates : null,
    eventMappingSource: state.eventFlagTelemetry?.source || 'desconhecida',
    eventRomIdentityProved: state.eventFlagTelemetry?.mappingRomIdentityConfirmed === true,
    memoryProvenance: { connected: state.connected, verified: state.memoryReadStatus?.verified,
      lastRead: state.lastUpdate, rom: state.romValidation,
      pcAllBoxesRead: false, isSimulation: !!state.isSimulation },
    areaReference: { wildSource: state.areaInfo?.wildSource, canonicalWildReference: state.areaInfo?.canonicalWildReference,
      canonicalNpcTrades: state.areaInfo?.canonicalNpcTrades || [] },
    party: (state.party || []).map(p => ({
      name: p.name,
      level: p.level,
      hp: `${p.hp}/${p.maxHp}`,
      types: p.types,
      moves: (p.moves || []).map(m => m.name)
    })),
    battle: state.inBattle && state.battle ? {
      enemy: `${state.battle.enemy.name} (Lv. ${state.battle.enemy.level}, HP: ${state.battle.enemy.hp}/${state.battle.enemy.maxHp}, Tipos: ${state.battle.enemy.types.join('/')})`,
      playerActive: state.battle.playerActive ? `${state.battle.playerActive.name} (HP: ${state.battle.playerActive.hp}/${state.battle.playerActive.maxHp})` : 'Nenhum',
      type: state.battleType
    } : null
  };

  const systemPrompt = `És o conselheiro do Pokémon AI Companion para Pokémon Red, Blue e Green (geração I).
A variante só é conhecida quando o perfil da ROM estiver identificado; não assumas que a ROM Green é igual à Red ou Blue.
Distingue os dados estáticos e as fórmulas descodificadas da ROM, as leituras atuais verificadas da RAM, e o que é apenas referência externa.
A leitura é parcial e sequencial: nunca afirmes visão total do jogo, do PC nem de todo o estado do emulador.
Nunca inventes itens, encontros, acesso a áreas, capturas, vitórias, probabilidades ou golpes. Se faltar prova, diz NÃO CONFIRMADO.
Não apresentes previsões de dano, crítico, precisão ou captura como números exatos sem o motor verificado e os dados contemporâneos do turno.
Se aconselhares trocar Pokémon ou comprar/usar itens, verifica disponibilidade atual; considera custos, requisitos e limitações.
Fala em português de Portugal. Responde de forma concisa e fundamentada nos campos recebidos.`;

  const userPrompt = `Estado atual do jogo:\n${JSON.stringify(context, null, 2)}\n\nDá uma recomendação fundamentada para este estado, indicando o que não está confirmado.`;

  const reply = await queryGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  if (reply) cachedAdvice = reply;
  return reply;
}

async function askAdvisor(question, state) {
  if (!state || !state.connected || !state.memoryReadStatus?.verified || state.isSimulation) {
    return 'Telemetria real indisponível. Não posso calcular ou recomendar com dados antigos ou simulados.';
  }
  if (state.inBattle && (!state.battle || state.battle.exactTurnMathReady !== true)) {
    return 'Não há cálculos de combate certificados para este turno; aguardo dados e fórmulas ROM/RAM verificados antes de recomendar golpes, capturas ou riscos.';
  }
  const context = {
    trainer: state.trainerName || 'RED',
    location: state.mapName,
    money: state.money,
    badges: (state.badges || []).filter(b => b.obtained).map(b => b.name),
    inventory: (state.inventory || []).map(i => `${i.name} (x${i.qty})`),
    pcStoredItems: (state.pcItems || []).map(i => `${i.name} (x${i.qty})`),
    pcCurrentBox: (state.pcBox?.pokemon || []).map(p => ({ name:p.name, level:p.level, dex:p.dex, verified:p.valuesVerified })),
    daycare: state.daycare || null,
    pokedexOwned: state.pokedexOwned || [],
    progressEventFlags: state.eventFlagTelemetry?.verifiedRamCoverage ?
      state.eventFlagTelemetry.completeNamedStates : null,
    eventMappingSource: state.eventFlagTelemetry?.source || 'desconhecida',
    eventRomIdentityProved: state.eventFlagTelemetry?.mappingRomIdentityConfirmed === true,
    memoryProvenance: { connected: state.connected, verified: state.memoryReadStatus?.verified,
      lastRead: state.lastUpdate, rom: state.romValidation,
      pcAllBoxesRead: false, isSimulation: !!state.isSimulation },
    areaReference: { wildSource: state.areaInfo?.wildSource, canonicalWildReference: state.areaInfo?.canonicalWildReference,
      canonicalNpcTrades: state.areaInfo?.canonicalNpcTrades || [] },
    party: (state.party || []).map(p => ({
      name: p.name,
      level: p.level,
      hp: `${p.hp}/${p.maxHp}`,
      types: p.types,
      moves: (p.moves || []).map(m => `${m.name} (${m.type})`)
    }))
  };

  const systemPrompt = `És o conselheiro do Pokémon AI Companion para Red, Blue e Green (geração I).
Usa apenas o contexto autenticado e verificado apresentado, distinguindo dados ROM, RAM, cálculo e referência externa.
Não assumes que a ROM Green corresponde à Red/Blue, nem que tens acesso a todas as caixas, scripts e regiões.
Nunca inventes probabilidades, danos, vitórias, itens, capturas ou ações disponíveis. O desconhecido deve ficar NÃO CONFIRMADO.
Recomendações específicas de combate só são válidas quando o motor e a leitura do turno estão certificados.
Fala em português de Portugal, explica a condição relevante e evita certezas não sustentadas.`;

  const reply = await queryGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Contexto do jogo atual:\n${JSON.stringify(context, null, 2)}\n\nPergunta do Treinador: "${question}"` }
  ]);

  return reply || 'NÃƒÂ£o consegui contactar a rede neural do Grok neste momento.';
}

module.exports = {
  getLiveAdvice,
  askAdvisor
};
