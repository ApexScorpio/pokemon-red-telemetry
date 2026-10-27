# Batalhas especiais — auditoria ROM e RAM (fase 7)

**27 de outubro de 2026 • Red, Blue, Green International v1.2.1**

## Contexto e princípio

O atlas já existente contém **310 associações de cabeçalhos de treinadores humanos + 18 scripts especiais**, isto é, **328 dos 334 objetos de treinadores humanos** destas três ROMs. Os restantes seis casos não seguem todos a mesma semântica de batalha. As flags normais `EVENT_BEAT_*` podem ser ativadas por scripts, por exemplo após derrotar um líder; por isso, a aplicação **não deve afirmar vitória individual só por encontrar um bit ligado**.

Esta fase resolveu quatro associações de script e identificou dois marcos de história que não são uma prova de vitória.

## Resultados verificados

| Mapa ID | Objeto ordinal | Evento RAM | Código de origem | Interpretação |
|---|---:|---|---|---|
| 3 — Cerulean City | 2 | `EVENT_BEAT_CERULEAN_RIVAL` = **152** | `CeruleanCityRivalDefeatedScript` | A flag é ativada após a ramificação `LOST_BATTLE`: vitória assinalada |
| 35 — Route 24 | 1 | `EVENT_BEAT_ROUTE24_ROCKET` = **1345** | `Route24AfterRocketBattleScript` | Vitória assinalada pelo script |
| 40 — Oak's Lab | 1 | `EVENT_BATTLED_RIVAL_IN_OAKS_LAB` = **35** | `OaksLabRivalEndBattleScript` | Batalha realizada; **não** determina quem venceu |
| 235 — Silph Co 11F | 3 | `EVENT_BEAT_SILPH_CO_GIOVANNI` = **1935** | `SilphCo11FGiovanniAfterBattleScript` | Vitória assinalada pelo script |
| 96 — S.S. Anne 2F | 2 | `EVENT_SS_ANNE_LEFT` = **1506** | `SSAnne2FRivalAfterBattleScript` | O navio partiu; **não** é flag de vitória do rival |
| 135 — Game Corner | 11 | `EVENT_FOUND_ROCKET_HIDEOUT` = **441** | `GameCornerRocketText` | Poster/esconderijo revelado; **não** comprova vitória contra o Rocket |

### Prova nos binários fornecidos

Foram reabertos os três ficheiros `.gb` com os SHA-256 auditados anteriormente (Red `5ca7ba...b7b`, Blue `2a9513...52d`, Green International `aafa14...bdb`). A estrutura compilada de `SetEvent` foi confirmada em cada um dos bancos dos cinco mapas com flags:

`21 <low byte de (D747 + bitIndex/8)> <high byte> CB <C6 + 8*(bitIndex % 8)>`

Os offsets de origem verificados nas três ROMs são:

| Mapa | Offset do `SetEvent` no ficheiro |
|---|---|
| Cerulean Rival | `0x195C1` |
| Route 24 Rocket | `0x51432` |
| Oak's Lab Rival | `0x1CE27` |
| Game Corner / esconderijo | `0x48EF4` |
| Silph Co 11F Giovanni | `0x6225E` |

Cada assinatura foi encontrada **uma única vez no banco correspondente**, a partir da entrada do script do mapa. A interpretação de cada bit foi conferida contra o fluxo lógico nos scripts fonte `pret/pokered`. Uma assinatura por si só não provaria que a flag só pode ser ativada depois de vencer: isso exige verificar as condições anteriores no script.

## Código integrado

- `romTrainerEvents.js`: catálogo das quatro relações de batalha, condicionado a um dos três SHA-256 exatos; separa vitória assinalada, batalha realizada e mero encerramento do combate.
- `romAreaEvidence.js`: transporta `victoryRecorded`, `battleWasPlayed` e, **apenas nos três scripts de vitória comprovados**, `defeated=true`.
- `romAreaProgress.js`: conta separadamente `scriptedVictoriesConfirmed` e `scriptedBattlesPlayedConfirmed`, sem converter as restantes flags em vitórias.
- `public/app.js`: mostra estes estados e os eventos S.S. Anne/Game Corner explicitamente como progresso de história, não vitórias.
- `tests/romScriptedBattles.test.js`: testes de correspondência dos eventos, ausência de falsa vitória, ROM desconhecida e, quando a pasta de ROMs é fornecida, da assinatura no binário.
- `tests/romTrainerEvents.test.js`: atualizado o teste de Route 24: o Rocket especial deixa de ser uma lacuna do atlas.

## Validação realizada

- As cinco assinaturas `SetEvent` foram localizadas na ROM Red, Blue e Green Internacional: **15 correspondências exatas** e nenhuma ambígua no banco de cada mapa.
- Sete cenários isolados foram executados no motor JavaScript: as três vitórias assinaladas, o confronto sem resultado no Oak's Lab, os dois eventos de progresso sem vitória e a rejeição de SHA-256 desconhecido. **Passaram**.
- Os módulos JavaScript modificados e a interface passaram a validação de sintaxe no motor de teste isolado.
- **Não foi executado o conjunto completo `npm test` nem teste ao vivo com SameBoy/iPhone nesta sessão.** O resultado do painel real permanece pendente.

## Limitações

- A S.S. Anne não regista um bit persistente específico para a vitória do rival; `EVENT_SS_ANNE_LEFT` não serve como substituto.
- No Game Corner, o evento de abertura do esconderijo não equivale à conclusão da luta Rocket.
- As variantes Red/Blue/Green fornecidas são reconhecidas pelo SHA-256 do perfil e correspondência CRC32 com o RetroArch; outros hacks necessitam de análise do seu próprio script.
- `EVENT_BEAT_*` genérico pode marcar uma luta desativada por outro script; sem semântica de vitória comprovada, mostrar apenas o estado do evento.
- A ausência do sprite no ecrã, uma mochila com item ou uma flag de remoção não comprovam que a batalha ocorreu.

### Fontes primárias

- <https://github.com/pret/pokered/blob/master/scripts/CeruleanCity.asm>
- <https://github.com/pret/pokered/blob/master/scripts/Route24.asm>
- <https://github.com/pret/pokered/blob/master/scripts/OaksLab.asm>
- <https://github.com/pret/pokered/blob/master/scripts/SSAnne2F.asm>
- <https://github.com/pret/pokered/blob/master/scripts/GameCorner.asm>
- <https://github.com/pret/pokered/blob/master/scripts/SilphCo11F.asm>

Nenhum save, ROM, token, sessão, processo do utilizador ou ficheiro no disco C: foi alterado.
