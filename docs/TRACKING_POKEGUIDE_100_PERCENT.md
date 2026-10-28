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
| PG-003 | Terreno e movimento | PARCIAL | 24 tilesets, 95 132 células por ROM; Cut/Surf/ledge com percurso condicional | Validar colisões dinâmicas, Strength, regras de scripts, frames e desvio multimapa |
| PG-004 | Flags e eventos da campanha | PARCIAL | `romEventState.js`, `romTrainerEvents.js`; flags específicas limitadas | Interpretar todos os scripts, presentes, diálogos, ramificações e consequências |
| PG-005 | Radar de itens e acessibilidade | PARCIAL | `romItemReachability.js`; acesso geométrico local e flags de itens ocultos | Caminhos multimapa e prova ao vivo com objetos/NPCs dinâmicos |
| PG-006 | Conselheiro universal de ações | EM EXECUÇÃO | `romWorldStateAdvisor.js` publica observações por mapa | Distinguir provas independentes e ligar ações, bloqueios e resultados na UI, sem garantias falsas |
| PG-007 | Combate e probabilidades | PARCIAL | `gen1LiveBattlePreview.js` e testes do pipeline com RAM sintética | Todos os handlers, RNG, golpes especiais e confronto diferencial ao vivo |
| PG-008 | Coerência telemetria RAM | PARCIAL | Releituras de mapa, coordenadas e modo; rejeição de divergências | Snapshots atómicos ou barreira equivalente confirmada e expiração de conselhos |
| PG-009 | Testes integrados / visuais | PENDENTE | Existem 62 ficheiros de testes (contagem em main em 28/10); auditorias parciais | Executar suite completa com as três ROMs e E2E com RetroArch/SameBoy/iPhone, screenshots por etapa |
| PG-010 | Tracking persistente e histórico | EM EXECUÇÃO | Esta tabela e histórico append-only | Atualizar estado e provas após cada trabalho; nunca apagar entradas anteriores |
| PG-011 | Renderização de conselhos globais | EM EXECUÇÃO | `worldAdvisor` calculado na telemetria, mas não renderizado em painel dedicado | Painel visível, robusto a offline, stale, dados contraditórios e HTML hostil |
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
