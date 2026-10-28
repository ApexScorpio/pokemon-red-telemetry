# PokéGuide — Validação independente do atlas de colisões Gen I

**Data:** 28 de outubro de 2026. **Estado:** segunda implementação independente e validação com os três ficheiros ROM reais. **Não constitui prova de navegação em emulador nem de 100% do jogo.**

## Objetivo e razão desta alteração

O projeto já possuía leitores de terreno (`romTerrainAtlas.js`, `romTerrainCollision.js`) e lógica de movimento (`romTerrainMovement.js`). Repetir a mesma contagem de tiles não provaria correção. Foi por isso adicionado **um descodificador independente**, `romTilesetCollisionAudit.js`, para verificar a correspondência de **cada célula** e cada regra estática, não apenas os totais publicados.

O novo leitor confronta os 24 cabeçalhos binários de tileset de 12 bytes (banco 3, `0xC7BE`), listas terminadas em `0xFF` de tiles atravessáveis por terra, matrizes de metabloco dos 226 mapas normais, tiles `4×4` por metabloco (amostragem de colisão Gen I no tile inferior esquerdo de cada subcélula `2×2`) e as tabelas de proibição de pares `TilePairCollisionsLand` (`0x0C7E`) e `TilePairCollisionsWater` (`0x0CA0`). São **11 pares terrestres e 3 aquáticos por versão**. O estado atual do jogador não é deduzido de nenhum destes bytes.

## Resultados comprovados nos três ficheiros originais

| Métrica (por ROM) | Red | Blue | Green International v1.2.1 |
|---|---:|---:|---:|
| Bancos do cartucho de 16 KiB | 64 | 64 | 64 |
| Tilesets estruturados | 24 | 24 | 24 |
| Mapas normais verificados | 226 | 226 | 226 |
| IDs de metabloco utilizados (contagem de células) | 23 783 | 23 783 | 23 783 |
| Posições lógicas de colisão `16×16` | 95 132 | 95 132 | 95 132 |
| Posições admitidas pela lista estática de tiles de terra | 48 504 | 48 504 | 48 570 |
| Posições não admitidas nessa lista | 46 628 | 46 628 | 46 562 |
| Metablocos distintos utilizados nos 24 tilesets, somados | 1 194 | 1 194 | 1 193 |
| Pares de colisão terrestres / aquáticos | 11 / 3 | 11 / 3 | 11 / 3 |

**Proveniência dos originais** (sem publicação da ROM): Red SHA-256 `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b`; Blue `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d`; Green `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db`.

**Cross-check independente dos 226 mapas por versão:** calculou-se localmente SHA-256 sobre o vetor completo de tile IDs de cada mapa gerado pelo novo leitor e confrontou-se a impressão digital agregada FNV-1a 64-bit da sequência `mapId:sha256` com o catálogo derivado que já estava publicado no GitHub. Resultados coincidentes: Red/Blue `b3a09547f960c6ad`; Green `5a9fe48fa645bd2f`. **FNV não substitui SHA-256 criptográfico**: a auditoria estrita implementada a seguir compara diretamente todos os bytes de cada mapa.

## Alterações publicadas

- `pokemon-ai-companion/romTilesetCollisionAudit.js`: descodificador independente, consulta da lista de passagem estática por coordenada `terrainAt`, verificação de pares `pairBoundaryBlocked`, rejeição de SHA-256 fora das três ROMs e validação de ponteiros, dimensões e hashes de mapa.
- `pokemon-ai-companion/tests/romTilesetCollisionAudit.test.js`: testes dos três cartuchos reais, pares de colisão de terra e água, limites de coordenadas, rejeição de ROM desconhecida e proibição de declarar movimento em direto.
- `pokemon-ai-companion/scripts/verifyRealRomTerrain.js`: auditoria estrita passou a confrontar **byte a byte os 95 132 tiles e os bitmaps de colisão de cada ROM** entre o leitor existente `romTerrainAtlas` e o novo leitor, além das 24 listas de tile ID e das 14 regras por pares. Qualquer diferença faz o comando terminar com erro, sem declaração de sucesso.
- `pokemon-ai-companion/package.json`: `test:terrain` inclui o novo teste; `audit:terrain:strict` e `test:terrain:real` reaproveitam automaticamente a comparação dupla.

## Provas e limites reais

- Teste executado localmente: `POKEMON_ROM_DIR=/mnt/data POKEGUIDE_ATLAS_JSON=/mnt/data/pokeguide-atlas-v4-tres-roms.json node --test tests/romTilesetCollisionAudit.test.js`. **5/5 PASS, 0 SKIP**, sobre os três ficheiros originais; os negativos e casos de exclusão também passaram.
- A correspondência independente dos *fingerprints* dos 678 mapas foi conferida com o JSON atual no GitHub.
- A verificação de sintaxe do novo ficheiro e dos testes passou. O **comando rigoroso conjunto que compara dois descodificadores inteiros dentro do repositório** foi implementado, mas **não executado ponta a ponta** neste ambiente; requer a árvore Node real e os três caminhos locais das ROMs.
- O critério estático **não** cobre colisões de NPCs/objetos, movimento forçado, Cut/Strength, Surf, ledges direcionais, interrupts, scripts ou snapshots atómicos da RAM. Uma célula na lista de tiles passáveis **não** é garantia de acesso efetivo. O resultado de `terrainAt` conserva `currentlyWalkable:null` e o motor de rotas continua a assinalar a sua incerteza.

**Fonte técnica:** `pret/pokered/home/overworld.asm` (`DrawTileBlock`, `CheckTilePassable` e colisões entre pares); `pret/pokered/engine/overworld/player_state.asm` (amostragem do tile sob jogador); `pret/pokered/data/tilesets/{tileset_headers,collision_tile_ids,pair_collision_tile_ids}.asm`.

**Proteções:** não foram adicionados binários ROM, saves, dados pessoais ou tokens. Nenhuma alteração ao Windows, às aplicações protegidas ou aos ficheiros originais. Todos os resultados só autorizam alegações sobre os bytes das três ROMs específicas.
