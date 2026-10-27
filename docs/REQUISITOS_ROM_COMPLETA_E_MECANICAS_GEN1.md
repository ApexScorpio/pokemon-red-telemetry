# PokéGuide / Pokémon AI Companion — cobertura integral da ROM e cálculo de mecânicas

Data: 2026-10-27. Esta especificação formaliza o objetivo do utilizador, NÃO certifica que já foi implementado.

## Objetivo e critérios não negociáveis

Construir um companion para Pokémon Red, Blue e Green (cada ficheiro e variante identificado por SHA-256 real), que conheça o conteúdo total de cada jogo a partir dos seus próprios bytes, scripts, mapas e fórmulas; combine esse conhecimento com leituras contemporâneas e verificadas do estado do emulador; e apresente, em português de Portugal, tudo o que um local, combate, Pokémon, objeto ou evento oferece **àquele jogador naquele instante**.

Não basta ler 100% dos bytes: é necessário descodificar as estruturas, reproduzir efeitos mecânicos, validar as condições, provar a cobertura e confrontar resultados com a execução. Nunca mostrar percentagens falsas de cobertura, números fictícios ou vitórias inferidas de flags ambíguas.

### Áreas de cobertura obrigatória

1. **ROM, versões e proveniência:** checksum/hash da ROM executada; bancos, ponteiros, tabelas, código, variantes, alterações, diferenças entre Red/Blue/Green; estado `desconhecido` para binários não auditados.
2. **Mundo por área/mapa/posição:** mapas, coordenadas, tiles e passagens, encontros por terreno e método, taxas de ativação e distribuições por espécie/nível; repels e condições; acessibilidade ao vivo.
3. **Objetos e recursos:** itens visíveis/ocultos, TM/HM, presentes, compras, preços, vendas, depósitos, moedas, recompensas, reutilização e recolha; eventos únicos, recursos renováveis e disponibilidade.
4. **NPCs e progressão:** textos e scripts, obstáculos, missões, puzzles, ginásios, insígnias, triggers, treinadores, trocas, ofertas, requisitos, estados e conteúdo perdível; distinguir script executado de vitória comprovada.
5. **Pokémon:** Pokédex, base stats, tipos, DVs, Stat Exp, stats efetivas, experiência, crescimento, aprendizagem, evoluções (nível/pedra/troca), compatibilidade TM/HM, distribuição por versão e localização.
6. **Encontros/capturas:** probabilidade de iniciar encontro e distribuição condicional de espécies/níveis separadas; captura com algoritmo Gen I, bola, HP, estado, Safari e condições especiais; probabilidades rigorosas (não adaptar fórmulas Gen III+).
7. **Batalhas:** determinação de ordem/prioridade, precisão efetiva e exceções, crítico, tipo/STAB, imunes, dano mínimo/máximo e distribuição dos resultados, efeitos secundários, status, boosts, modificadores, itens, PP, substituições, turnos múltiplos, batalhas especiais, derrotas, dinheiro e EXP; contemplar os comportamentos/bugs da Gen I realmente aplicáveis à variante.
8. **Probabilidade e estratégia:** para cada ação legal num turno real, resultados e probabilidades condicionais, KO/risco/impacto no turno seguinte; aconselhamento nunca pode substituir cálculos do motor ou inventar RNG futuro.
9. **Integração e interface:** interpretar ROM + amostra RAM/SRAM/VRAM e contexto pertinente sem alterar saves/sessões; leitura temporal estável; painel zona e combate, origem de cada valor, avisos de incerteza, histórico e screenshots verificados quando houver mudanças visuais.

### Modelo de evidência por campo

- `ROM_VERIFICADA`: extraído da ROM identificada, com banco, offset, tabela/script, tipo e regras de descodificação.
- `RAM_VERIFICADA`: estado atual lido com proveniência, momento, identificador do mapa/batalha e controlo de consistência.
- `CALCULO_EXATO`: entradas ROM/RAM verificadas + algoritmo Gen I reproduzido com arredondamento, ordem de operações, overflow e exceções confirmados.
- `CONDICIONAL`: válido apenas após condição explícita (e.g. relva, Surf, hora do ciclo, estado de script, turno, tipo de golpe), com denominador claramente declarado.
- `NAO_CONFIRMADO`: falta qualquer origem, requisito, leitura estável ou prova diferencial. NÃO preencher por aproximação de outras gerações ou variantes.

As probabilidades teóricas condicionais não revelam antecipadamente o RNG que sairá no próximo turno. Se o comportamento de uma ação contornar a fórmula padrão (ex.: X Accuracy, OHKO, acertos especiais), o cálculo genérico não pode ser apresentado como válido.

### Critério de 100% certificado, separado por versão

Medição por categoria e denominador extraído da própria ROM, sem reduzir o universo para aumentar artificialmente a percentagem:
- Mapas/estruturas acessíveis e scripts/eventos referenciados: `descodificados/total`.
- Encontros/slots e métodos: `validados/total`; distinguir pesos dos slots, hipótese de ativação e disponibilidade.
- Itens ocultos/visíveis e variantes de obtenção: `validados/total`.
- Treinadores e Pokémon estáticos: objeto identificado, equipa/variante, eventos e evidência de vitória **medidos separadamente**.
- Espécies, formas válidas, movimentos, evoluções, TM/HM, recompensas: `validados/total`.
- Classes mecânicas (precisão, dano, captura, críticos, status, turnos, Safari, EXP, bugs): `casos com testes diferenciais/total de casos mapeados`.
- Integração real: amostras observadas em cada ROM identificada e testes contra o emulador; resultados de fixtures sintéticas não substituem teste real.

Enquanto não há inventário completo provado, comunicar cobertura como **INDETERMINADA**, não `100%`.

### Sequência técnica

1. Inventariar módulos/cobertura atual e as três ROMs por SHA-256; congelar evidência dos binários sem os republicar.
2. Mapear tabelas ROM, scripts de mundo, encontros, itens, evoluções, golpes, características e condições, preservando variantes.
3. Implementar matemática por módulos puros (com casos especiais), testados contra as fontes primárias e diferencialmente contra ROM/emulador.
4. Integrar apenas resultados com evidência suficiente na telemetria e no dashboard; nunca atribuir valores antigos ao turno atual.
5. Criar auditorias e contadores de cobertura reais por versão/categoria e executar regressões completas e screenshots da interface a cada alteração visível.

### Primeiro módulo isolado

`pokemon-ai-companion/gen1StandardHitChance.js` calcula **só** o teste normal de precisão `CalcHitChance/MoveHitTest`, com byte do golpe e 13 rácios provenientes da ROM e estágios reais da RAM. Exige evidência afirmativa da ROM, snapshot e aplicabilidade. Devolve fração exata por 256. Não calcula dano, críticos, OHKO, bypass, efeitos de status, nem prevê o RNG. Não foi ligado ao runtime ou UI nesta revisão.

### Fontes primárias

- https://github.com/pret/pokered/tree/master/engine/battle
- https://github.com/pret/pokered/blob/master/engine/battle/core.asm
- https://github.com/pret/pokered/blob/master/data/battle/stat_modifiers.asm
- https://github.com/pret/pokered/blob/master/macros/data.asm
- https://github.com/pret/pokered/tree/master/scripts
- https://github.com/pret/pokered/tree/master/data
- Documentação existente: `docs/PLANO_DECODIFICACAO_ROM_INTEGRAL.md`, `docs/AUDITORIA_TREINADORES_ROM_INTEGRAL.md`.

A desmontagem pret/pokered é evidência de referência para Red/Blue; para Green International ou ROMs modificadas a tabela, o código e a equivalência funcional têm de ser validados contra o binário exato.
