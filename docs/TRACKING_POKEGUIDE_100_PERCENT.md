# PokéGuide — Tracking de cobertura, execução e provas

**Iniciado:** 2026-10-28  
**Branch de trabalho:** `feature/pokeguide-world-action-tracker-20261028`  
**Regra:** esta página é um painel de acompanhamento; o histórico cronológico e imutável está em [HISTORICO_GUIA_CAMPANHA.md](HISTORICO_GUIA_CAMPANHA.md). Todas as alterações ao histórico são só por acrescento.  
**Critério para CONCLUÍDO:** código no repositório, testes reproduzíveis e evidência funcional exigida pelo requisito. Um teste isolado nunca vale como validação end-to-end.

## Estado dos trabalhos

| ID | Âmbito | Estado | Evidência atual | Próxima condição de aceitação |
|---|---|---|---|---|
| PG-001 | Identidade das 3 ROMs Red/Blue/Green Intl 1.2.1 | PARCIAL | SHA-256 conhecidos em `romKnownSha256.js`; ROMs locais auditadas em relatórios | Confirmar SHA do cartucho *efetivamente carregado* no emulador/iPhone |
| PG-002 | Atlas mundial e ligações | PARCIAL | 248 IDs, 226 cabeçalhos normais, 813 warps e 78 fronteiras por ROM; `romWarpGraph.js` | Resolver LAST_MAP/elevadores/portas e testar transições reais |
| PG-003 | Terreno e movimento | PARCIAL | T31: Cut/Surf/ledge, fronteiras ROM e planeador conservador de empurrões Strength com sprites RAM | Testar empurrões reais, buracos/interruptores, colisões dinâmicas, scripts e transições em emulador |
| PG-004 | Flags e eventos da campanha | PARCIAL | T60: 14 lojas extraídas das ROMs e nomes/preços-base cruzados com auditoria económica por SHA+mapa+IDs; preços atuais, acesso e compras continuam desconhecidos | Interpretar todos os scripts, presentes, diálogos, ramificações e consequências |
| PG-005 | Radar de itens e acessibilidade | PARCIAL | T51: catálogo compacto dos 226 mapas, flags dos 54 itens e 12 fichas ocultas; índice de objetos visíveis de recolha desconhecida, coordenadas remotas e rotas condicionais | Validar caminhos e itens reais em emulador, scripts, NPCs, Cut/Surf/Strength e orçamento |
| PG-006 | Conselheiro universal de ações | EM EXECUÇÃO | T51: conselhos locais + 226 mapas indexados, saída de Cut/Surf/Strength condicional, desvios multimapa e inventário visível de recolha desconhecida | Distinguir provas independentes, testar telemetria real e consequências na UI sem garantias falsas |
| PG-007 | Combate e probabilidades | PARCIAL | `gen1LiveBattlePreview.js` e testes do pipeline com RAM sintética | Todos os handlers, RNG, golpes especiais e confronto diferencial ao vivo |
| PG-008 | Coerência telemetria RAM | PARCIAL | Releituras de mapa, coordenadas e modo; rejeição de divergências | Snapshots atómicos ou barreira equivalente confirmada e expiração de conselhos |
| PG-009 | Testes integrados / visuais | PARCIAL | T54: três ROMs GB originais analisadas em Node.js v22 e Python, SHA-256 e 226 mapas/813 warps/202 sinais/472 NPCs/106 itens por variante verificados; T53: 93/93 regressões isoladas V8 | Executar suite completa com as três ROMs e E2E com RetroArch/SameBoy/iPhone, screenshots por etapa |
| PG-010 | Tracking persistente e histórico | EM EXECUÇÃO | Esta tabela e histórico append-only | Atualizar estado e provas após cada trabalho; nunca apagar entradas anteriores |
| PG-011 | Renderização de conselhos globais | EM EXECUÇÃO | T51: painel mundial já renderiza objetivos por mapa, flags de itens ocultos, coordenadas de objetos visíveis e limites de acesso, com 56/56 testes UI/integração V8 | Painel visível, robusto a offline, stale, dados contraditórios e HTML hostil |
| PG-012 | Cobertura integral da ROM e variantes | PARCIAL | Catálogo de 64 bancos e comparações de binários publicados | Classificação semântica e diferencial dos ramos relevantes, sem declarar 100% só por ler bytes |

## Critérios de prova e restrições

- **Estático ROM:** uma saída, item ou NPC existe no mapa auditado. Não implica que esteja acessível.
- **Estado RAM confirmado:** item oculto recolhido, posição atual, flag de treinador ou sprite presente requer leitura e correspondência ao objeto específico.
- **Percurso condicional:** geometria permite uma hipótese, mas o estado pode mudar por diálogo, animação, porta, NPC, obstáculo ou script.
- **Consequência provada:** exige extração semântica do script e, se relevante, confirmação na execução.
- **Desconhecido é resultado legítimo:** nenhuma conclusão de vitória/recolha se pode basear só na ausência de sprite ou numa flag de outro domínio.
- **Testes dependentes de ROM:** se o ficheiro real não estiver presente devem reportar bloqueio/skip, não ser convertidos em aprovação.
- **Segurança:** não publicar ROMs nem saves; não tocar em sessões Antigravity/TIMI/MAESTRO/BonChat; não escrever no disco C: do utilizador.
- **Capturas:** em testes de interface, guardar e examinar screenshot após cada passo quando houver acesso ao browser, com indicação do ambiente. Sem acesso ao emulador/iPhone, não alegar screenshots reais.

## Registo de entregas

- **2026-10-28 — T0:** branch criada a partir de `main` no ponto de retoma; tracking inicial instituído, lacunas e critérios definidos. **A execução funcional ainda não foi validada.**

## Indicadores que NÃO podem ser inventados

- Percentagem geral de conclusão: **indeterminada** enquanto os critérios não estiverem todos auditados.
- Estado end-to-end iPhone/emulador: **não demonstrado nesta fase**.
- Cobertura total dos scripts e efeitos: **não demonstrada**.


### T1 — 2026-10-28: associação global de acessibilidade e flags

- **PG-006 EM EXECUÇÃO:** `romWorldStateAdvisor.js` passou a diferenciar flags ocultas e de treinadores e a anexar percurso condicional apenas por chave ROM/mapa/índice/posição validada. Commit `6d1682b`.
- **PG-005 EM EXECUÇÃO:** `retroarchClient.js` envia o resultado de `planItemAccess` ao conselheiro global; mapa divergente apaga a projeção antiga. Commit `30283d4`.
- **Falta:** testes positivos/negativos, UI de ações, visual real, scripts completos, percurso multimapa.


### T2/T3 — 2026-10-28: painel, expiração e fichas ocultas

- **PG-011 — CÓDIGO IMPLEMENTADO / E2E PENDENTE:** novo painel por mapa. Estados textuais separados, sem `innerHTML`, expiração RAM, corte imediato no WebSocket; necessita screenshot da aplicação real e testes integrados.
- **PG-006 — CÓDIGO PARCIAL VALIDADO:** flags de itens/treinadores/fichas independentes, percurso condicional associado, UI mostra resultados sem assumir final de script. 6 testes de lógica isolados aprovados com dependências substituídas; suíte do projeto não executada.
- **PG-004 — PARCIAL:** inseridas 12 fichas ocultas, mantendo D6FE independente de D6F0; continua a faltar descodificar todos os NPC scripts e resultados de eventos.
- **PG-009 — PARCIAL:** novos 13 testes de regressão publicados, **por executar no checkout completo**; pré-visualização sintética em Chromium analisada, não é screenshot do jogo.
- **Bloqueios remanescentes:** acesso às ROMs reais e emulador ativo para E2E, integridade atómica da RAM, scripts e regras dinâmicas, navegação multimapa.


### T4 — 2026-10-28: síntese de Kanto em vez de apenas o mapa atual

- **PG-004 PARCIAL:** `romCampaignLedger.js` reúne flags dos 226 mapas normais para 54 itens ocultos, 12 fichas, treinadores com evento associado e encontros fixos; distingue evento encerrado de vitória/captura. Falta a semântica completa de scripts e presentes/itens visíveis.
- **PG-006 PARCIAL:** painel já cruza conselho local, percursos condicionais e progresso global, sem deduzir acessibilidade imediata nem consequências garantidas.
- **PG-008 PARCIAL:** livro global falha fechado em ROM/RAM não comprovadas, mas a leitura sequencial não certifica instantâneo atómico nem SHA da ROM ativa no emulador.
- **PG-009 PARCIAL:** **18 novos casos de teste publicados no repositório, ainda por executar com dependências reais**; num ambiente isolado com dependências simuladas correram **12/12 testes**. Screenshot sintético analisado; falta prova de interface verdadeira e três ROMs originais nesta execução.
- **PG-011 CÓDIGO IMPLEMENTADO / E2E PENDENTE:** síntese de 226 mapas apresentada apenas com identidade SHA coincidente; `textContent` protege texto não fiável; expiração/offline invalida informação.
- **Meta 100%:** mantém-se **NÃO CERTIFICADA**. Sem percentagem inventada. Próximas entregas: correr testes reais, concluir scripts e efeitos, navegação dinâmica multimapa e E2E do Companion com RetroArch/SameBoy/iPhone.


### T5 — 2026-10-28: PR de integração e proteção da versão principal

- **PR de trabalho:** <https://github.com/ApexScorpio/pokemon-red-telemetry/pull/1>, estado **Draft**, porque falta execução do checkout real, testes das três ROMs e prova visual em RetroArch/SameBoy/iPhone.
- **Branch:** `feature/pokeguide-world-action-tracker-20261028`; `main` permanece inalterada até integração validada. Alterações não substituíram a versão principal.
- **Critérios de desbloqueio:** 18 regressões novas + suite anterior a passar no checkout completo, testes ROM SHA reais com falha explícita se faltar binário, confirmação de ausência de falsos conselhos sob deslocação/fecho da ligação, screenshots reais e correção dos casos encontrados.
- **Pendências depois da integração do PR:** scripts de todos os NPCs, efeitos especiais de movimentos, navegação multimapa com portas dinâmicas, coerência temporal RAM e paridade de resultados de eventos ao vivo.


### T6/T7/T8 — 2026-10-29: teste dos módulos, reconexão, prioridades de todo o Kanto

- **PG-006 — CÓDIGO AMPLIADO / E2E PENDENTE:** o conselheiro separa flags e percursos condicionais; o novo `romCampaignObjectives.js` usa as 226 fichas mundiais para sugerir mapas com flags pendentes e eventos por esclarecer. Cada distância é número de transições estáticas, nunca acesso comprovado.
- **PG-002 — PARCIAL:** o planeador de objetivos usa BFS de warps e fronteiras estáticas sobre índices validados. LAST_MAP, elevadores, Cut/Surf/Strength, scripts e portas dinâmicas continuam por certificar.
- **PG-009 — PARCIAL (provas):** 26/26 testes das quatro suites executados diretamente do código publicado no GitHub em **V8 isolado com APIs Node simuladas**; 0 falhas. Isto não substitui `npm test` nem ROMs reais; `git clone` falhou devido a DNS. O teste de reconexão impede reaparecimento de conselhos antigos.
- **PG-011 — CÓDIGO IMPLEMENTADO / E2E PENDENTE:** novo painel de objetivos mundiais e respetivos estados; corrigida flexão singular/plural; imagem sintética antes/depois capturada e analisada (NÃO é o Companion no emulador).
- **PG-008 — PARCIAL:** ao desligar o WebSocket, `lastState.connected=false` é persistido para impedir que verificações periódicas reapresentem dados antigos. Atomicidade RAM não demonstrada.
- **Próximo critério de integração:** testes Node reais com dependências originais, 3 ROMs auditadas, screenshots em RetroArch/SameBoy e comparação de flags/rotas reais. Enquanto faltarem, manter o PR como Draft e `main` protegida.


### T9 — 2026-10-29: checkpoint verificável para retoma

- **Branch/PR:** `feature/pokeguide-world-action-tracker-20261028` / <https://github.com/ApexScorpio/pokemon-red-telemetry/pull/1>. Via API: 42 commits à frente de `main`, 0 atrás, 12 ficheiros alterados; PR aberto **Draft**, não fundido. `main` preservada em `d52d6dad`.
- **Testes desta fase:** 26/26 publicados aprovados no executor **V8 isolado com simulação das APIs Node**; seis módulos com parsing válido e nove verificações de integração de strings/ordem. **Pendente**: suite integral `npm test`, ROMs reais, E2E de cliente e screenshots do jogo.
- **Tracking visual:** imagem sintética final capturada e inspecionada; HTML/imagem de teste provisórios apagados. Imagem não corresponde a partida real.
- **Ponto de retoma seguinte:** obter checkout/test runner Node real sem depender de GitHub Actions esgotadas; validar a suite toda e os três ficheiros ROM contra o SHA esperado; corrigir falhas; depois testar o Companion no emulador real e atacar scripts/handlers/rotas dinâmicas por cobertura e evidência, nunca por alegação.


### T10–T14 — 2026-10-29: navegação física, eventos ROM e progresso entre leituras

| Entrega | Estado atualizado | Evidência de código | Ainda falta para fechar |
|---|---|---|---|
| PG-002/003 | PARCIAL | `romCampaignObjectives.js` prioriza primeiro warp por percurso terrestre da ROM corroborado com posição RAM; rejeita hints fora do mapa/SHA | Interior dos outros mapas, Cut/Surf/Strength dinâmico, portas, scripts, elevadores e saída exterior |
| PG-004 | PARCIAL | `romCampaignDelta.js` distingue aumentos de flags em seis domínios e anula a inferência se houver regressão de contagens; `SIGN` expõe eventos textuais | Semântica completa de cada script, vínculo ação→evento, histórico exato por bit individual e snapshot atómico |
| PG-005 | PARCIAL | `romCrossMapItemRoute.js` pesquisa itinerários hipotéticos de terreno e warps para itens sem caminho local; cache e invalidação na telemetria | Validar passagem real/warps dinâmicos e atualizações frame a frame |
| PG-006 | PARCIAL | `romWorldStateAdvisor.js` inclui sinais e tabelas de encontros condicionais por espécie+nível, para quaisquer mapas normais auditados | Consequências dos NPCs, encontros realmente elegíveis no frame e efeitos de escolhas |
| PG-008 | PARCIAL | `activeRomSha256Verified:false` explícito; a UI distingue SHA do perfil local de CRC32 do RetroArch | Provar SHA256 da ROM executada; confirmar estado RAM atómico/coerente |
| PG-009 | PARCIAL | **45/45 testes das 6 suites novas passaram no V8 isolado** com APIs Node/digest simulados; sintaxe e ligações verificadas | `npm test` nativo, três binários reais, testes E2E e screenshots do jogo |
| PG-011 | CÓDIGO IMPLEMENTADO / E2E PENDENTE | UI apresenta primeiro warp condicional, fauna por pesos ROM, sinais e mudanças de flags na sessão | Verificar interface real com emulador em movimento e testes visuais por etapa |
| PG-012 | PARCIAL | 226 mapas normais e 813 warps catalogados anteriormente | Todos os scripts, comportamentos, handlers e condições reais de gameplay interpretados e comparados |
 
**Checkpoint técnico:** <https://github.com/ApexScorpio/pokemon-red-telemetry/pull/1>, **Draft** não fundido; `main` preservada. A conclusão global continua **NÃO CERTIFICADA / percentagem indeterminada**. Nenhum resultado de teste sintético equivale a uma validação com ROMs originais/emulador ou a 100% de jogabilidade.

**Retoma objetiva:** suite Node completa no checkout real, SHA das três ROMs fornecidas, screenshots de execução, diferenciais de combate e scripts, multi-rota com portas/warps exteriores, e ligação causal entre eventos do jogo e flags verificadas. O histórico `HISTORICO_GUIA_CAMPANHA.md` é exclusivamente append-only.


### T15–T18 — 2026-10-29: precisão das flags, isolamento de sessão e 61 testes

| Área | Resultado real desta etapa | Limite atual |
|---|---|---|
| PG-004 — Progresso factual | `romCampaignLedger.js` publica `flagRecords` de itens, fichas, treinadores e Pokémon fixos; `romCampaignDelta.js` compara bits individuais, distingue vitória de script e rejeita trocas 1→0 ocultadas por totais iguais | Só flags com correspondência ROM auditada; scripts e eventos sem bit continuam desconhecidos |
| PG-008 — Segurança da telemetria | `CampaignFlagSession` cria baseline apenas com leitura RAM desta sessão, limpa após desconexão/ROM nova/falha e não reutiliza JSON guardado | Leituras RAM continuam sequenciais, não snapshot atómico; mudanças não são prova causal de ação do jogador |
| PG-009 — Testes | **61/61 testes em 8 suites novas passaram com código da branch, em V8 isolado e APIs Node simuladas**; **20 ficheiros JS com parsing válido**; um teste de integração real entre saídas do ledger e detector de bits | `npm test` real, 3 ROMs originais, emulador ativo, screenshots e prova de SHA256 ativa ainda pendentes |
| PG-011 — Interface e cache | `persistState` deixa de escrever a telemetria mundial transitória nas duas caches existentes; os históricos de ação e diálogo permanecem | Testes no cliente e visualização real em RetroArch/SameBoy ainda pendentes |
 
**Ponto de retoma verificável:** PR #1 <https://github.com/ApexScorpio/pokemon-red-telemetry/pull/1> permanece **Draft**, sem integração na `main`. No último compare verificado: **81 commits à frente, 0 atrás, 19 ficheiros alterados** antes deste registo. Nenhuma percentagem de conclusão global deve ser atribuída sem auditoria dos sistemas de combate, scripts, itens, evolução, mapas dinâmicos e RAM com as ROMs originais.

**Critérios seguintes:** executar as suites na stack Node verdadeira e corrigir discrepâncias; confirmar ROM exata da partida ativa, comparar flags após ação real (incluindo save reload), instrumentar scripts sem estado conhecido e ligar restrições dinâmicas a cada movimento/mudança de mapa. Preservar histórico append-only.


### T19/T20 — 2026-10-29: 507 flags, 228 toggles, transições e 19 escolhas de elevadores

- **PG-004 — PARCIAL (mais cobertura observável):** `romWorldEventAtlas.js` utiliza as 507 constantes de eventos e os 228 toggles referenciados nos dados do próprio projeto, cruzando-os com RAM quando verificada. `romWorldReferenceSession.js` deteta diferenças nomeadas entre leituras, incluindo desativações; mantém até 80 alterações e reinicia ao mudar ROM/desligar. Nenhuma mudança recebe causalidade ou resultado de história sem prova dos scripts.
- **PG-002/PG-003 — PARCIAL:** `romElevatorChoices.js` expõe, nas três ROMs conhecidas, **3 elevadores e 19 destinos opcionais dos menus** validados contra cabeçalhos/warps ROM. Os destinos são teóricos: `selectedNow:null`, `accessibleNow:null`, `routeNavigableNowProven:false`. Falta observar seleção real de piso, portas/script, Cut/Surf/Strength e movimentos dinâmicos.
- **PG-008 — PARCIAL:** invalidação de `romWorldReferenceDelta`, `worldRecentNamedChanges`, `romElevatorOptions` em leituras inseguras e exclusão destas informações transitórias da cache persistente. Continua sem snapshot RAM totalmente atómico nem prova de SHA da ROM efetivamente executada.
- **PG-009 — TESTES PARCIAIS:** **52/52** testes de cinco grupos executados separadamente a partir dos ficheiros publicados na branch: 8 sessão de flags nomeadas, 13 painel, 21 delta/sessão mundial, 4 cliente/cache, 6 elevadores com JSON das três variantes. Executor V8 isolado com substitutos de APIs Node; 7 módulos com parsing válido. NÃO é `npm test` e NÃO houve E2E.
- **PG-011 — CÓDIGO NOVO / E2E PENDENTE:** painel mostra mudanças nos eventos nomeados e os destinos de elevadores como possibilidades condicionais; não afirma conclusão de objetivo ou percurso desbloqueado.
- **Critério próximo:** Node nativo + checkout completo; validação de CRC/SHA e amostras RAM originais; seguir os scripts de cada evento e verificar efeitos, navegar com menus de elevador e bordas condicionais, depois cobrir combate/captura/evolução/itens/trocas em jogo ativo. Não atribuir percentagem 100% sem essas provas.


### T21–T22 — 2026-10-29: navegação condicionada por Cut/Surf + variantes ROM

| Área | Implementação real publicada | Testes/provas | Ainda não concluído |
|---|---|---|---|
| PG-002 / PG-003 | `romLocalExitAccess.js`: todos os warps do mapa atual avaliados por terreno e capacidades Cut/Surf com posição RAM corroborada; fronteiras exteriores e elevadores rotulados sem coordenadas/acesso provados | Módulo e UI com regressões de Cut, Surf, sprites, destinos dinâmicos e RAM antiga | Geometria exata nas 78 fronteiras, scripts/portas, Strength, atravessar o ecrã e validar cada transição no emulador |
| PG-005 | `romWorldDetourCycles.js`: ciclos multimapa por 560 warps ROM de destino estático + fronteiras exteriores verificadas, com limite de estados e exclusão de voltas recíprocas triviais; associado a item de mapa/coordenadas corretos | Testes de ciclos, recíprocos, limites, identidade e UI | Provar que o regresso atinge a região acessível do item; diferenciar caminhos verdadeiros de hipóteses topológicas |
| PG-008 | `romTerrainVariantGuard.js`: 226 matrizes/95 132 células vinculadas ao SHA local exato Red/Blue/Green; mapas Green 226–228 diferem e não podem ser substituídos por matrizes Red | Os 3 arquivos JSON auditados passam; amostra Green contaminada por Red é rejeitada; mapa identificado por ID, não índice | SHA do binário carregado no emulador, snapshot RAM atómico e revalidação temporal contra movimentos reais |
| PG-003 | `LAST_MAP`: mapa de destino dinâmico incluído na lista de saídas quando **D365 foi relido com valor igual** e o destino ROM foi conferido | Testes para destino corroborado e para dados D365 desatualizados/incoerentes; UI apresenta prova sequencial | Provar passagem executada e destino no mesmo frame, bem como elevadores e todos os scripts dinâmicos |
| PG-009 | **56/56 testes relevantes aprovados**, em seis suites de regressão publicadas, todas reexecutadas sobre o código atual da branch, parsing sem erros | Executor V8 isolado, APIs Node simuladas, arquivos reais de terreno Red/Blue/Green, fixtures de geometria separadas | `npm test` nativo, ROMs binárias e emulador E2E, screenshots, simulação de jogo completo |
| PG-011 | A interface mostra condições por warp, capacidade Cut/Surf, fronteira, elevador, LAST_MAP relido e voltas para investigar sem prometer acessibilidade | Testes UI e de cliente/cache aprovados no mesmo executor | Observação visual e interativa ao vivo, ações e consequências em todos os mapas |
 
**Checkpoint:** PR #1 <https://github.com/ApexScorpio/pokemon-red-telemetry/pull/1>, branch `feature/pokeguide-world-action-tracker-20261028` ainda Draft, `main` não alterada. Projeto **PARCIAL, não 100%**. Retoma por validar a suite Node/ROM/emulador e, depois, os scripts, colisões dinâmicas e mecânicas de combate/captura restantes. Todas as alterações a este tracking e a `HISTORICO_GUIA_CAMPANHA.md` são append-only.


### T23 — 2026-10-29: fronteiras físicas na ROM e propostas de primeira saída

| Componente | Estado implementado | Prova disponível | O que ainda falta |
|---|---|---|---|
| PG-002/PG-003 — Bordas de todos os mapas | `romOutdoorBoundaryCandidates.js`: inspeciona os tiles na borda do mapa atual, calcula passos geométricos e Cut/Surf condicional; `romLocalExitAccess.js` expõe origem, número de candidatos e classificação | 41/41 testes das suites locais, ciclos e interface após atualização; Route4 conferida nos três arquivos | Alinhamento do destino entre mapas, scripts que impedem travessia, observação da RAM/posição no mesmo frame |
| PG-005 — Voltas para itens isolados | `romWorldDetourCycles.js` identifica primeiro passo e tile de borda candidato associado à volta, sem afirmar que a volta chega do lado necessário do item | Casos com e sem Cut, fronteiras sem prova de chegada e validação de item/mapa/ROM | Navegação efetiva em todos os segmentos; comprovar a região de chegada ao mapa do item |
| PG-008 — Integridade das fronteiras | `romOutdoorReferenceGuard.js`: verifica os **78 descritores** contra o arquivo específico de Red, Blue ou Green e suspende o subgrafo exterior se houver divergência | 13/13 testes com cliente, incluindo casos de adulteração, mistura de ROM e invalidação de cache | Provar SHA256 da ROM realmente em execução; voltar a ler os bytes completos de cada descritor e sincronizar leitura ROM/RAM |
| PG-012 — Route 4 | Bordas ROM: mapa 15, 90×18; 10 células estáticas caminháveis a sul para mapa 14 (Route3) e 8 a este para mapa 3 (Cerulean). Exemplos só estáticos: (6,17) e (89,4) | 3/3 testes com dados dos três arquivos de terreno e 78 ligações, usando V8 e digest de teste pré-mapeado | Não interpretar exemplos como posição do jogador nem passagem confirmada; Cut/desníveis/itens específicos ainda precisam de prova contextual |
| PG-009 — Execução de testes | **57/57 casos de teste distintos passaram** nos três grupos mencionados, com o código publicado no GitHub | Executor V8 isolado, Node fs/crypto/Buffer/vm simulados, dados JSON reais das três variantes | `npm test` nativo, SHA256 criptográfico no teste, três binários ROM originais e E2E com emulador |
 
**Estado:** PROGRESSO REAL / **NÃO 100%**. O PR #1 continua em Draft; `main` intacta. O arquivo de referência das ligações não basta para inventar coordenadas de chegada à zona seguinte. A próxima etapa de navegação precisa dos bytes da ROM original e testes de transição real; continuamos a não afirmar acessibilidade sem essa evidência.


### T24 — 2026-10-29: 78 fronteiras ROM alinhadas com destino e compatibilidade terrestre global

| Área | Implementado e publicado | Prova disponível | Pendente |
|---|---|---|---|
| PG-002/PG-003 — Fronteiras Kanto | `data/gen1OutdoorConnectionOffsetsReference.json` com 78 offsets retirados de 36 cabeçalhos da desmontagem; `romOutdoorAlignment.js` confere offsets com ponteiros de blocos ROM | 78 descritores recíprocos × 3 perfis; 34/36 mapas de destino com múltiplos ponteiros independentes consistentes; 6/6 testes | ROM binário ativo, frame RAM atómico, NPCs e scripts que impedem saída |
| PG-003 — Percurso tile→tile exterior | `romOutdoorBoundaryCandidates.js` elimina pontos fora da sobreposição ou sem destino estático compatível; apresenta tile de destino e classe Cut/Surf/terra, sem afirmar execução | 5/5 testes com Route4, Route3 e Cerulean das três variantes, incluindo `(7,17)→(57,0)` e `(89,4)→(0,12)`; `(6,17)` excluído por destino estático bloqueado | Jogo real, ponto de entrada pós-transição, flags dinâmicas e empurrões Strength |
| PG-004 — Atlas mundial de transições | `romOutdoorOverlapIndex.js` calcula 78 ligações, 1484 pares de tiles alinhados, 400 pares terrestres estáticos, 70 fronteiras com par terrestre, 8 sem par e 24 com candidatos de água | 6/6 testes usando as matrizes arquivadas Red/Blue/Green; em memória por variante SHA, sem persistir como prova RAM | Interpretar as 8 zonas sem terra e atravessar cada zona no jogo, scripts/portas |
| PG-005 — Objetivos e desvios | Rotas globais recebem contagem de sobreposição terrestre/água; primeiro salto do desvio entre mapas mostra tile de destino quando o offset está corroborado | 54/54 testes das suites de objetivos, ciclos, painel e cache | Confirmar cada salto e lado exato de regresso ao item |
| PG-009 — Regressão desta etapa | **85/85 casos distintos aprovados** em grupos V8 usando código da branch + arquivos JSON auditados e SHA simulado/mapeado de teste | Parsing JS e asserts de testes relevantes | `npm test` nativo, hashes executados por Node real, ROMs binários e emulador ativo |
 
**Situação:** PR #1 continua Draft, `main` não fundida. O avanço T24 é geométrico e de auditoria ROM, não afirma jogabilidade já provada ou finalização a 100%. A utilização de `pret/pokered` é referência independente: <https://github.com/pret/pokered/blob/master/macros/scripts/maps.asm>. Ações futuras exigem execução nativa e amostras ROM/RAM originais.


### T24 — 2026-10-29: capacidades exigidas no tile de destino

- O cálculo de pares de coordenadas de fronteira já existente na branch é complementado com classificação de **Cut/Surf na zona de chegada**, independente de poder alcançar a borda na zona de origem. Novos campos: `destinationRequiresCut`, `destinationRequiresSurf`, `destinationCapabilityStatus`, `destinationEntryUsableNow:null`.
- A interface apresenta estes estados sem declarar transição executada. Novo ensaio de regressão `romOutdoorDestinationCapability.test.js`: **3/3**, V8 isolado com dependências simuladas, não `npm test` real.
- Limites: atravessamento real, scripts, capacidades temporárias, colisões com atores, SHA do binário efetivamente carregado e navegação E2E ainda por provar. **NÃO 100%.**

 
### T61 — 2026-10-29: texto literal ROM dos NPCs/sinais no conselheiro mundial

- **PG-004 / PG-012 — PARCIAL:** `romStaticDialogue.js` reconhece apenas a primeira cadeia `TX_START` de um ponteiro `TX_FAR` comprovado, com limites físicos dos bancos e charmap inglesa Gen I. Mostra variáveis `<PLAYER>`/`<RIVAL>` como marcadores; não decifra os restantes comandos, scripts nem escolhas.
- **PG-006 / PG-011 — PARCIAL:** prévia tipada integrada no índice mundial e no painel de NPCs/sinais. Nunca afirma diálogo executado, evento concluído ou acesso disponível; a interface mostra texto via `textContent`. Plural de transições corrigido.
- **PG-009 — VALIDAÇÃO LIMITADA:** sete testes equivalentes de descodificador passaram em Node 22.16.0 com ROMs sintéticas; oito ficheiros publicados passaram o parsing em JavaScript V8 e quatro verificações de integração `TX_FAR → ledger → UI` foram aprovadas no mesmo ambiente isolado; após a correção de plural, seis verificações dirigidas adicionais do painel passaram. As regressões novas estão publicadas, mas **não** houve `npm test` integral sobre checkout real, três ROMs originais nesta execução, nem screenshot E2E. Tentativa de screenshot sintético em Chromium falhou por timeout.
- **Integridade:** histórico detalhado append-only em `docs/HISTORICO_GUIA_CAMPANHA.md` nas entradas T61a/T61b. `main` não foi alterada; PR #1 mantém-se sem autorização para integração enquanto faltam provas reais. **100% NÃO CERTIFICADO**.
