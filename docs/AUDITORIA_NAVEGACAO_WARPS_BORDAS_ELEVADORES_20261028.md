# PokéGuide — navegação integral dos mapas estáticos (Red, Blue, Green)

**Data:** 28 de outubro de 2026. **Amostra:** as três ROMs de 1 MiB fornecidas pelo utilizador, com SHA-256 confirmado em testes locais. O termo «integral» neste relatório significa **todos os warps e todas as ligações de fronteira nos cabeçalhos normais de mapa**, não toda a semântica dos jogos nem um percurso jogável garantido.

## Resultados idênticos nas três versões

| Indicador, por ROM | Resultado |
|---|---:|
| Bancos lidos | 64 |
| IDs de mapa examinados | 248 |
| Cabeçalhos normais validados | 226 |
| IDs `UNUSED_MAP` da referência | 22 |
| Warps das tabelas de objetos (4 bytes cada) | 813 |
| Warps com destino e índice de chegada estáticos válidos | 560 |
| Warps para `LAST_MAP`/`wLastMap` dinâmico | 251 |
| Warps do elevador Silph Co com destino alterado pelo script | 2 |
| Ligações de fronteira N/S/E/W (descritor 11 bytes) | 78 |
| Ligações de fronteira com par inverso | 78 |
| Elevadores com tabelas de pisos | 3 |
| Opções de piso descodificadas | 19 |
| Mapas atingíveis de Pallet Town pelo grafo estático de warps+fronteiras | 220 / 226 |

Os 6 mapas não atingíveis através **deste grafo restrito** não devem ser rotulados como impossíveis: o modelo exclui explicitamente `LAST_MAP`, seleção de pisos e outras mudanças dependentes de scripts e RAM.

## Correções efetivas da aplicação

- Corrigida a diferença entre os campos reais do leitor `romWorldData.js` e o consumo do `romAreaGuide.js`: `destinationMap`/`destinationWarp`, `trainerClassOrItemId`/`trainerNumberOrLevel`, `wildSpeciesInternalId`/`wildLevel` e identificadores de evento por índice de objeto. Sem esta alteração, itens, treinadores e warps apareciam com identificadores ausentes, apesar de estarem presentes na ROM.
- `romWarpGraph.js` valida **os 813 warps de cada variante** e mantém separados os 560 destinos fixos, os 251 `LAST_MAP` e os 2 casos reprogramados pelo script. Um grafo com contagens divergentes é rejeitado. A função de percurso combina portas e fronteiras, mas nunca afirma que se consegue atravessar o trajeto na partida atual.
- `romOutdoorConnections.js` lê diretamente cada descritor de 11 bytes dos cabeçalhos de mapa e verifica os 78 pares opostos nas três ROMs.
- `romElevatorDestinations.js` descodifica as escolhas dos elevadores de Celadon Mart (5), Rocket Hideout (3) e Silph Co (11), validando IDs e índices de chegada contra os mapas. Os pisos são **opções ROM**: não revelam a escolha atual sem RAM.
- `romVariantRegistry.js` inclui ligações exteriores, elevadores e grafo no perfil; `romLiveResolver.js` acrescenta dados auditados aos perfis importados quando a identidade SHA+CRC+tamanho coincide; `romAreaGuide.js` entrega os destinos ao mapa atual e `public/app.js` mostra as saídas sem confundir dados estáticos e estado vivo.
- `romComprehensiveAudit.js` inclui o grafo de warps, fronteiras e pisos, sem distribuir bytes originais das ROMs.

## Fontes e testes

- `pret/pokered/macros/scripts/maps.asm` — `warp_event`, `connection` e ordem norte/sul/oeste/este.
- `pret/pokered/scripts/{SilphCoElevator,CeladonMartElevator,RocketHideoutElevator}.asm` e `pret/pokered/engine/events/elevator.asm` — scripts e alterações a `wWarpEntries`.
- **16/16 testes Node locais aprovados, 0 ignorados**: `romWarpGraph` (5), `romOutdoorConnections` (4), `romWorldNavigationIntegration` (3), `romElevatorDestinations` (4). Os testes das três variantes comparam os bytes originais Red ZIP, Blue GB e Green GB, não apenas exemplos sintéticos.
- O patch do descodificador e as ligações UI foram validados por sintaxe e testes de componentes isolados. **A suite integral do repositório, testes do emulador em execução e screenshots do ecrã real não foram executados.** Não confundir isso com validação ponta a ponta.

## Obstáculos ainda não ultrapassados

A identidade real da ROM a correr no emulador, a atomicidade de RAM, flags de scripts, obstáculos e colisões, caminhos dependentes da história, os efeitos internos de todos os golpes e itens e validação da UI no iPhone/RetroArch permanecem por certificar. Uma rede estática completa de saídas não é sinónimo de 100% das mecânicas de jogo.

**Proteções:** os originais das ROMs, saves, perfis, sessões e tokens do utilizador não foram modificados; sem GitHub Actions, nem operações no Windows do utilizador, nem ficheiros temporários criados em C:.

## Adenda — resolução segura dos 251 warps LAST_MAP

Foi implementado `romLastMapEvidence.js`: a partir do campo `wLastMap = D365`, compara o byte do primeiro bloco RAM com o da releitura de `D35E..D365` (8 bytes contíguos), exigindo também que `D35E` conserve o mesmo ID de mapa e que o mapa de destino e o índice de warp existam no perfil ROM auditado. A resolução altera **apenas a anotação** do guia estático, preservando o byte original `destinationMap=255`; não transforma `LAST_MAP` num destino estático. Leituras divergentes, mapas reservados e índices inexistentes são rejeitados. A igualdade de duas amostras UDP **não é atomicidade temporal**.

O `retroarchClient.js` foi atualizado para solicitar uma única releitura contígua de `D35E..D365` em vez de reler só `D35E`. Se o mapa não coincidir, descarta-se a amostra antiga e o destino `LAST_MAP`. Se for coerente, `romStaticMapGuide` recebe `resolvedMapId` por warp, com `atomicSnapshotVerified=false`, e o painel indica expressamente que a origem é a RAM repetida. Dados temporais do próprio turno continuam sem certificação.

**3/3 testes locais específicos de `romLastMapEvidence` aprovados, 0 ignorados**: caso positivo, divergência de D365/mapa, ROM desconhecida e índice de warp inválido. O total das **cinco** novas baterias de navegação desta fase é **19/19 testes locais aprovados** (5 warps + 4 fronteiras + 3 integração + 4 elevadores + 3 LAST_MAP). As integrações do cliente em execução no emulador e os screenshots não foram testados.
