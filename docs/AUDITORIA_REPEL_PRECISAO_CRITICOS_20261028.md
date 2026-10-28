# Auditoria 2026-10-28 — Repel, encontros e tabelas ROM de precisão/críticos

A origem são os três ficheiros ROM anexados pelo utilizador, analisados **em modo de leitura** no ambiente de execução, sem publicação dos binários nem dos saves.

## Versões efetivamente verificadas

| Versão | SHA-256 completo |
|---|---|
| Red | `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b` |
| Blue | `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d` |
| Green International v1.2.1 | `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db` |

## Probabilidade com Repel

Em `pret/pokered/engine/battle/wild_encounters.asm`, `TryDoWildEncounter` valida condições de movimento/mapa, consulta `wRepelRemainingSteps` e, se elegível, compara `hRandomAdd` (0..255) com a taxa do meio. O byte `hRandomSub` escolhe um dos dez slots de pesos **51,51,39,25,25,25,13,13,11,3**, totalizando 256. Se o Repel ainda está ativo, um Pokémon selvagem de nível **inferior** ao do **primeiro Pokémon da equipa** é rejeitado. Quando restava precisamente 1 passo, o código decrementa para 0, mostra a mensagem de fim e regressa **antes** de fazer o sorteio; é um ramo próprio.

Sob o modelo teórico explícito de bytes RNG uniformes/independentes, e **condicional a estarem confirmados terreno, movimento e demais verificações preliminares**:

- Sem Repel, probabilidade de encontro aceite numa verificação elegível = `rate/256`.
- Com Repel e mais de um passo restante, `P(espécie,nível por verificação) = rate × soma_pesos_slots_elegíveis / 65536`.
- Quando resta exatamente um passo de Repel, `P(encontro nessa chamada) = 0`, pois essa chamada termina antes de testar o RNG.
- Probabilidade **por passo genérico** continua desconhecida sem contexto completo; estas fórmulas não antecipam o RNG do próximo frame.

Na **Route 2 (mapa 13)** a taxa de relva é 25 nas três ROMs. Sem Repel, **25/256 = 9,765625%** por verificação elegível. Com Repel e primeiro Pokémon no **nível 5**, e 2 ou mais passos restantes, apenas **41/256** do peso dos slots é elegível: **1025/65536 = 1,56402587890625%** de encontro aceite por verificação. A espécie depende da variante: a Red contém Weedle onde Blue e Green contêm Caterpie.

Módulo publicado: `pokemon-ai-companion/gen1WildEncounterCheck.js`. Exige todas as condições de proveniência declaradas; não é ativado automaticamente como certeza no ecrã live. Regressão `tests/gen1WildEncounterCheck.test.js`, com **8/8 testes Node reais aprovados** (3 deles leram diretamente os três binários com SHA-256 verificado). A versão no repositório guarda as mesmas regras e condições dos testes; a execução integrada de `npm test` no repositório continua pendente.

## Precisão/evasão e críticos de elevada probabilidade

A desmontagem `pret/pokered/data/battle/stat_modifiers.asm` e o ficheiro de símbolos `data/pokered.sym` distinguem:

- `StatModifierRatios` no banco 15, endereço CPU `0x76CB`, offset ROM **`0x3F6CB`**: 13 pares numerador/denominador, **26 bytes**, uma ocorrência exata em cada ROM.
- `HighCriticalMoves` efetivo no banco 15, CPU `0x608E`, offset **`0x3E08E`**: IDs **2 (Karate Chop), 75 (Razor Leaf), 152 (Crabhammer), 163 (Slash)** e `FF`.
- `UnusedHighCriticalMoves` no mesmo banco, CPU `0x601E`, offset **`0x3E01E`**: contém a mesma sequência, mas é uma cópia **não utilizada**. Não é seguro selecionar a primeira correspondência de bytes sem seguir o símbolo e a rotina.

As três ROMs têm bytes idênticos nestas estruturas. Novo `romBattleRuleTables.js` aceita **apenas** os três SHA-256 auditados, valida ambas as posições de críticos e a tabela completa de 13 pares, e recusa variantes não comprovadas. A função `inspectRom` adiciona `battleRuleTables` ao perfil local e `getMoveInfo` passa a expor a propriedade `highCriticalFromAuditedRom` com a devida proveniência e valor `null` quando não comprovado. Nenhum desses campos afirma que o estado do turno já é válido.

Regressão `tests/romBattleRuleTables.test.js`: **5/5 testes aprovados em Node com os três binários**, incluindo recusa de ROM estranha e detecção de alteração. Total desta fase: **13/13 testes aprovados, 0 ignorados**.

## Limites e pendências

Os módulos não estão ainda habilitados para produzir prognósticos de combate live: o Companion deve verificar a ROM carregada, os estados contemporâneos da RAM, os efeitos especiais e o ramo de execução concreto. Testes isolados não substituem a suite `npm test` integral, testes contra SameBoy/RetroArch ou inspeção visual da interface. Não se certifica mapeamento completo da ROM nem de eventos/trades/itens ocultos nesta adenda.
