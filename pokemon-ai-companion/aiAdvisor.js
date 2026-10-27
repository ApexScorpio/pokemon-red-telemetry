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

  const systemPrompt = `REGRAS INVIOLÁVEIS DE FIABILIDADE: Só afirmar itens, Pokémon, conquistas, golpes e eventos efetivamente confirmados pela RAM recente; o PC tem mais caixas que não foram lidas; uma Pokédex registada não garante exemplar disponível. Distinguir sempre dados estáticos da ROM, números calculados, probabilidades estimadas, e observações da RAM. Se existir dúvida, diz NÃO CONFIRMADO e não inventes. Nunca garantir vitória ou captura a 100% sem prova matemática completa. Os encontros e trocas devem respeitar Red/Blue Gen 1; Green modificado é desconhecido até validar.
` + `Ãƒâ€°s o Conselheiro EstratÃƒÂ©gico de Elite de PokÃƒÂ©mon Red (Grok/Groq AI).
Tens visÃƒÂ£o total em tempo real da memÃƒÂ³ria RAM do jogo no telemÃƒÂ³vel do jogador.
Regras da tua resposta:
- Fala em portuguÃƒÂªs de Portugal ou neutro de forma entusiasmante, direta e ultra-estratÃƒÂ©gica como um campeÃƒÂ£o da Liga PokÃƒÂ©mon.
- MantÃƒÂ©m a resposta muito concisa (mÃƒÂ¡ximo 2 a 3 frases de impacto).
- Em batalha: diz exatamente qual o melhor golpe a usar, se deves usar itens da mochila (como Potion/Antidote) ou se deves trocar de PokÃƒÂ©mon para ter vantagem de tipo.
- Fora de batalha: diz qual o prÃƒÂ³ximo objetivo, onde treinar ou que itens comprar com o dinheiro disponÃƒÂ­vel.
- Se sugerires tirar um PokÃƒÂ©mon do PC ou apanhar um novo, indica SEMPRE com clareza qual PokÃƒÂ©mon da equipa atual ele deve meter no PC para criar espaÃƒÂ§o, justificando com a fraqueza de tipo ou menor utilidade contra o prÃƒÂ³ximo desafio.`;

  const userPrompt = `Estado atual do jogo:\n${JSON.stringify(context, null, 2)}\n\nDÃƒÂ¡ o teu melhor conselho estratÃƒÂ©gico imediato para este momento exato.`;

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

  const systemPrompt = `REGRAS INVIOLÁVEIS DE FIABILIDADE: Só afirmar itens, Pokémon, conquistas, golpes e eventos efetivamente confirmados pela RAM recente; o PC tem mais caixas que não foram lidas; uma Pokédex registada não garante exemplar disponível. Distinguir sempre dados estáticos da ROM, números calculados, probabilidades estimadas, e observações da RAM. Se existir dúvida, diz NÃO CONFIRMADO e não inventes. Nunca garantir vitória ou captura a 100% sem prova matemática completa. Os encontros e trocas devem respeitar Red/Blue Gen 1; Green modificado é desconhecido até validar.
` + `Ãƒâ€°s o Conselheiro EstratÃƒÂ©gico de PokÃƒÂ©mon Red com telemetria direta da RAM.
O jogador estÃƒÂ¡ a jogar no seu telemÃƒÂ³vel e fez-te uma pergunta.
Usa todo o contexto real da equipa, itens e local para responder com a melhor estratÃƒÂ©gia de Gen 1 possÃƒÂ­vel.`;

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
