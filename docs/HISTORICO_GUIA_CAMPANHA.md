# Histórico de elaboração do Guia-Mestre Pokémon Red, Blue e Green

> Histórico cumulativo: entradas apenas acrescentadas. Não apagar ou alterar entradas anteriores.

## 2026-10-27 — Criação inicial

- 1. Recolhidas as regras do jogador: Red, Blue e Green em paralelo; Yellow só depois; tracking a cada decisão; optimização da equipa e PC; verificar golpes/evoluções, NPCs úteis, itens, Daycare, MissingNo e caminhos sem retorno.
- 2. Consultada a telemetria pública do GitHub: README datado de **2026-10-16 21:59:33**, logo desatualizado face à data atual; detetados dados de PC inconsistentes e campos impossíveis para o jogo clássico. URL alternativa trycloudflare indisponível no momento da consulta. Nenhuma posição ou equipa atual foi assumida.
- 3. Verificada a Geração I em Bulbapedia e fontes adicionais: Twineedle de Beedrill no nível 20, efeito defeituoso de Focus Energy, evolução e substituição automática de golpes no Daycare, necessidade de trocas entre versões e riscos do MissingNo.
- 4. Criado `docs/GUIA_MESTRE_CAMPANHA_GEN1_PTPT.md` com regras de validação, jogo, calendário Red/Blue/Green, proteção de pontos de não retorno e padrão de respostas concisas.
- 5. Publicado o guia no commit `9050bcd5748b166a736c73e36df36a3ba3b30a9c`; sem alterações a ficheiros de código, saves, credenciais, sessões, C: ou telemetria.
- 6. Verificada a existência do guia no repositório após a publicação.

## Pendências identificadas

- Validar a telemetria realmente em tempo real, porque o README público consultado não corresponde ao estado atual.
- Validar experimentalmente a compatibilidade do Pokémon Green International modificado com Red/Blue ocidentais, usando apenas cópias seguras dos saves.
- Integrar na aplicação, em tarefa separada, os alertas automáticos de movimentos/evoluções e controlo do Daycare; o guia documenta o comportamento, mas não implementa funcionalidades no programa.


## 2026-10-27 — Auditoria da autenticidade da leitura da ROM/RAM

- 1. Revistos os módulos retroarchClient.js, server.js, githubSync.js, pokemonData.js e public/app.js do repositório existente.
- 2. Confirmado que a leitura usa pedidos reais READ_CORE_MEMORY, mas apenas em endereços selecionados; ler 100% da ROM bancária não é possível com as leituras existentes.
- 3. Corrigido o tamanho dos blocos UDP de 1024 para 160 bytes, com validação do número e formato dos bytes e recusa de respostas truncadas/erro.
- 4. Corrigida a declaração ONLINE prematura; todos os 5 blocos principais passam a ser obrigatórios para a validação base.
- 5. Removido o texto fictício de ROM validada; acrescentada tentativa de validação apenas do cabeçalho da ROM, sem alegar verificação da ROM inteira.
- 6. Corrigida a exportação Markdown/GitHub para sinalizar telemetria antiga, parcial ou simulada; a sincronização recusa tais estados.
- 7. Corrigida a separação entre simulação de batalha e jogo real e evitada a persistência de simulações.
- 8. Corrigidos os tipos Fairy da Gen I e a atribuição fictícia de 40 de poder e 100% de precisão a golpes não identificados.
- 9. Identificadas tabelas estáticas de encontros e texto parcial do ecrã com proveniência explícita; não os declarar leitura de diálogos NPC.
- 10. Documentado que a contagem de Pokémon só inclui a equipa e a caixa PC selecionada, não todas as caixas.
- 11. Criado um auditor de ficheiro ROM autónomo, de leitura integral e apenas local, com SHA-256 e checksums, ainda sem execução sobre a ROM real do jogador.
- 12. Criado docs/AUDITORIA_ROM_RAM_TELEMETRIA.md com limites técnicos e testes de aceitação pendentes.
- 13. Foram executados 5 testes isolados da lógica dos blocos UDP, mas NÃO testes de integração com RetroArch/SameBoy ao vivo.
- 14. Verificada a presença das alterações nos ficheiros GitHub. Não foram tocados saves, ROMs, sessões de autenticação, TIMI, Maestro ou outros processos, nem criados novos ficheiros na unidade C: por esta sessão.

**Estado:** corrigidas fontes concretas de dados falsos; a recolha de 100% dos bancos ROM e a validação integral com o iPhone continuam por concluir.

## 2026-10-27 — Segunda auditoria: IDs, eventos, catálogo de Kanto e Daycare

- 1. Encontrado erro crítico de geração dos índices de eventos: valores decimais de `const_skip` no código `pret/pokered` eram anteriormente interpretados como hexadecimais, corrompendo **186 dos 507** identificadores. Corrigido `data/exact_events.json`.
- 2. Rocket da casa roubada em Cerulean: flag **167**, não 173; Misty: **191**, não 203. Substituídas **110 referências numéricas** em `data/areaData.js` por constantes oficiais nomeadas. A página deixa de depender de números escritos à mão para essas flags.
- 3. Registados os **320 bytes de wEventFlags ($D747)** e os **507 estados de eventos nomeados**, indicando que as etiquetas só estão plenamente certificadas quando a ROM carregada for identificada.
- 4. Corrigida a tipagem de **15 golpes**: `Psychic_type` passou a `Psychic`. Revistos os 165 golpes contra `pret/pokered/data/moves/moves.asm`, incluindo efeitos, poder, precisão e PP.
- 5. Enriquecido `data/gen1CanonicalSpecies.json` com **151/151 fichas** obtidas da fonte oficial e grupos de crescimento de cada espécie. Construídos `gen1CanonicalLearnsets.json` (151 espécies) e `gen1CanonicalWildEncounters.json` (59 tabelas; 10 slots por grupo com pesos exatos sobre 256).
- 6. Acrescentadas as **248 entradas de mapas** e as **9 trocas NPC efetivamente utilizáveis**, associadas aos IDs corretos dos mapas. Na Route 11, a troca oficial é Nidorino por Nidorina, não Drowzee por Farfetch'd. O radar usa agora a tabela oficial.
- 7. Corrigidos o offset inicial dos Pokémon no PC ($DA96, não $DA95) e os offsets do tempo ($DA41/$DA43/$DA44); incluídos 50 slots de itens no PC e nicknames/OT da caixa atual, com validação de IDs.
- 8. Criado `pokemon-ai-companion/saveAudit.js` para **ler as 12 caixas, equipa de caixas, itens e Pokédex de um ficheiro .sav local**, sem o modificar. O .sav é um instantâneo do último save, **não** a memória em direto. Teste sintético: 12 caixas verificadas, Abra reconhecido, itens mochila/PC reconhecidos, contagem impossível rejeitada.
- 9. O Daycare passou a calcular nível a partir de EXP da RAM e crescimento canónico, e a emitir aviso **dois níveis antes** de um golpe/evolução; adicionado cartão visual ao dashboard iPhone/PC com indicação de leitura válida ou offline.
- 10. Detetado e corrigido erro gravíssimo: texto literal `\\n` em comentário fazia com que a declaração `CHUNK_SIZE=160` também ficasse comentada e provocasse erro de execução. Testada a leitura isolada de 530 bytes em quatro pacotes de 160/160/160/50, com repetição limitada e rejeição de dados inválidos.
- 11. Alterado o fingerprint de sincronização GitHub para refletir níveis, equipa, golpes, caixas do PC, Daycare, itens, Pokédex, badges e eventos mesmo com o jogador parado.
- 12. Removida a inferência falsa de "item da rota recolhido" baseada na simples posse de uma cópia igual; dados de itens com flag não calibrada ficam explicitamente marcados como tal.
- 13. O conselheiro da IA passou a receber progresso de eventos e a rejeitar estados RAM antigos. Probabilidades de captura deixam de inventar uma taxa por defeito e estimativas de dano ignoram efeitos especiais ainda não modelados.
- 14. Acrescentada validação semântica: não aceitar contagens impossíveis de equipa/caixa, espécie inconsistente entre lista e ficha PC, ou flag Daycare fora do intervalo.
- 15. A sintaxe dos módulos JS modificados foi verificada. Teste de UI simulado: Daycare com Abra no nível 14 gera alerta, e situação offline mostra aviso de dados antigos; **não** equivale a inspeção visual no iPhone.
- 16. `verifyGen1Ids.js` passou a verificar 151 IDs, 165 golpes, 95 IDs de itens, 39 índices MissingNo, 18 endereços fundamentais, 507 eventos, 151 crescimento/learnsets, 59 tabelas de encontros, 248 mapas e 9 trocas.
- 17. **Sem acesso remoto ao RetroArch/SameBoy e sem o save do jogador**, não foi executada validação ponta a ponta e **não há certificação de 100% do que o jogador possui em tempo real**. Faltam teste do painel real, confirmação da ROM por hash e integração regular do save completo para as 12 caixas.
- 18. Nenhum processo, ROM, save, credencial, sessão Antigravity/TIMI/MAESTRO/BonChat ou ficheiro da unidade C: do utilizador foi alterado.

**Resultado desta fase:** correções e dados canónicos publicados no GitHub; testes locais/mocados passaram nos casos descritos. Permanecem explicitamente em aberto a validação no iPhone e a sincronização automática das 12 caixas.

## 2026-10-27 — Continuação: verificação cruzada do guia e das tabelas canónicas

- 1. Reconfirmado no GitHub que o leitor de RAM já contém as correções de HM de campo: possuir HM01/HM03 não equivale a ter um Pokémon capaz de usar Cut/Surf.
- 2. Reconfirmado que possuir Great Ball, TM ou outro item igual na mochila ou PC NÃO prova que uma Poké Ball concreta do mapa foi recolhida. Os campos de recolha baseiam-se em flags e o README assinala que a interpretação dos bits exige validação.
- 3. Auditados de novo os seis recursos canónicos de dados: **151/151 espécies**, **151/151 learnsets e evoluções**, **59/59 tabelas de encontros**, **248 mapas**, **9 trocas NPC utilizáveis** e mapeamento entre IDs internos e Dex. Cruzados por ID, mapa, espécies, pesos de encontro e métodos de evolução: **zero inconsistências nesses cruzamentos estáticos**.
- 4. Revisto o caso Abra/Kadabra: Abra #63 evolui a 16; Kadabra #64 tem Confusion a 16, e o tracking deve antecipar o levantamento da creche quando faltarem 2 níveis. A RAM fornece EXP; o nível da ficha depositada não é o nível atual adquirido por passos.
- 5. Estado de aceitação ainda pendente: não foi executado teste de integração contra RetroArch/SameBoy real no iPhone; não foi verificado um hash do ficheiro ROM do jogador; outras caixas de PC em SRAM ainda não são lidas. Não declarar conhecimento 100% do save.
- 6. Nenhuma alteração a ROM, save, C:, credenciais ou processos. Histórico atualizado exclusivamente por acréscimo.



## 2026-10-27 — Início da descodificação integral ROM, ponteiros e motor

- 1. Verificadas fontes primárias pret/pokered (MonsterNames, PokedexOrder, BaseStats, GrowthRateTable, scripts de eventos) e a especificação Pan Docs de mapeamento/bancos de memória.
- 2. Confirmados no ficheiro pokered.sym desta compilação os símbolos: MonsterNames 07:421E, PokedexOrder 10:5024, BaseStats 0E:43DE, GrowthRateTable 16:501D, EvosMovesPointerTable 0E:705C e MapHeaderPointers 00:01AE. Estes endereços NÃO foram assumidos válidos para a ROM do utilizador.
- 3. Criado romAtlas.js: leitura completa dos bytes de ROM local, hashes por banco, verificação de cobertura, endereços banco/CPU, charmap dos nomes, IDs internos, Pokédex, atributos e ponteiros gráficos sem descodificação fictícia.
- 4. Adicionada proteção contra aplicação de .sym a uma ROM sem SHA-256 de referência coincidente, e aviso de que o hash fornecido ainda não valida por si só a origem da .sym.
- 5. Acrescentada extração de coeficientes de crescimento reais de GrowthRateTable quando a ROM e símbolos são compatíveis.
- 6. Criado gen1EngineMath.js: funções puras de EXP, atributos Gen I, HP DV e eventos; rejeitam entradas RAM/ROM em falta.
- 7. Criado tests/romAtlas.test.js com cenários sintéticos: varrimento completo dos bancos, bloqueio de símbolos não validados, descodificação ID/nome/n.º Pokédex/atributos, cálculos XP/HP e flags.
- 8. Criado docs/PLANO_DECODIFICACAO_ROM_INTEGRAL.md com roadmap e separação entre ROM, RAM, scripts, VRAM, imagem SameBoy e interpretação semântica.
- 9. Nenhuma ROM foi descarregada, copiada, modificada ou publicada; o servidor do Pokémon Companion, saves e sessão Antigravity não foram alterados nesta fase.
- 10. A ROM real do SameBoy não foi disponibilizada. **Não declarar 100% de elementos descodificados ou que os testes sintéticos substituem validação com a ROM real.**
