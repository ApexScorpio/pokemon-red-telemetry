# PokéGuide — Auditoria integral do terreno e das colisões básicas das três ROMs

Data: **28 de outubro de 2026**. Fontes: os três ficheiros ROM fornecidos pelo utilizador, 1 048 576 bytes por versão, identificados por SHA-256. Esta auditoria **não** certifica toda a física do jogo nem um percurso real no emulador.

## O que foi descodificado

- Todos os **24 cabeçalhos de tileset** de cada ROM, com bancos, ponteiros para blocksets e listas de tiles de passagem.
- Os **226 mapas definidos** em cada versão, com matriz de 23 783 metabloco IDs por ROM.
- A composição 4×4 de tiles de 8 píxeis de cada metabloco. A posição de colisão dos passos de 16 píxeis usa o tile inferior esquerdo de cada quadrante 2×2.
- A grelha resultante de **95 132 posições de 16 píxeis por ROM**, com tile ID, bit de passagem e hashes SHA-256 das matrizes.
- **11 regras de colisão por pares de tiles em terra** e **3 em água**, validadas nos três binários. A função de percurso estático já respeita os 11 pares de terra.
- Rejeição de bytes alterados, mapa sem SHA condizente, ponteiros de metabloco fora do banco e grids/tile IDs adulterados.

| Indicador | Red | Blue | Green International v1.2.1 |
|---|---:|---:|---:|
| Tilesets | 24 | 24 | 24 |
| Mapas | 226 | 226 | 226 |
| Metablocos | 23 783 | 23 783 | 23 783 |
| Posições | 95 132 | 95 132 | 95 132 |
| Posições com tile atravessável por terra | 48 504 | 48 504 | 48 570 |
| Posições bloqueadas por tile estático | 46 628 | 46 628 | 46 562 |
| Referências a tiles gráficos inválidas | 0 | 0 | 0 |

**Diferença real da Green International:** 66 posições a mais com tile base permitido, relativamente a Red/Blue. As listas de tiles de passagem por tileset são idênticas nos três binários; a diferença resulta dos dados gráficos/de mapas, não de uma regra fictícia.

## Integração publicada

- `romTerrainAtlas.js`: descodifica as três ROMs originais, verifica todos os 226 mapas e produz tilesets, quadrículas, hashes e pares de colisão. Exporta `readRomTerrain`, `inspectTerrainCell` e `findTerrainRoute`.
- `data/romTerrain_{red,blue,green}.json`: catálogos derivados dos ficheiros reais. Contêm IDs de tiles e bitmaps compactos; não contêm as ROMs originais, sprites em bruto nem saves.
- `romVariantRegistry.js`: incorpora a auditoria do terreno nas novas leituras ROM.
- `romLiveResolver.js`: anexa estes catálogos a perfis importados com SHA-256, CRC32, 1 MiB e **226 hashes de mapas concordantes**. Não altera perfis de outras ROMs.
- `romAreaGuide.js`: adiciona a matriz de terreno ao mapa atual apenas se houver concordância entre SHA e ID do tileset.
- `retroarchClient.js`: descodifica o tile sob as coordenadas RAM somente quando o mapa D35E foi corroborado e as dimensões RAM concordam com a ROM. Calcula percursos estáticos para as saídas e descarta a informação anterior se as leituras do mapa divergirem.
- `romTerrainRouteHints.js`: calcula percursos mínimos de *terreno estático*, incluindo as 11 exceções de pares de tiles. Devolve até 24 candidatos, com o primeiro passo e distância em grelha, mas **não autoriza afirmar que o jogador os pode percorrer**.
- `public/app.js`: mostra tamanho da grelha, número de posições passáveis/bloqueadas e até seis saídas com passos e primeira direção, sempre como sugestões condicionais.
- `romComprehensiveAudit.js`: adiciona as 95 132 posições e os dados à auditoria geral.

## Testes executados

Executados com Node.js v22.16.0 sobre os três binários reais (Red lida em memória diretamente do ZIP, sem extrair o ficheiro) com SHA-256 verificada:

- `tests/romTerrainAtlas.test.js`: **6/6 testes aprovados**, 0 ignorados. Três testes completos de ROM, dois de alterações inválidas/corrompidas e um de colisão entre pares de tiles.
- `tests/romTerrainRouteHints.test.js`: **4/4 testes aprovados**, 0 ignorados, com simulação de percurso nos mapas originais das três versões e rejeição de identidade falsa.
- `tests/romTerrainCatalogueIntegrity.test.js`: **3/3 testes aprovados**, 0 ignorados, percorrendo **todas as 285 396 posições de colisão lógica** dos três catálogos derivados e verificando hash, tile, bitmap e listas de tilesets.
- Enriquecimento do `romLiveResolver.js` publicado validado isoladamente em V8 para os três perfis: 226 mapas carregados por variante; alteração maliciosa de um só hash de mapa rejeitada. Não é teste end-to-end.

**Total desta fase: 13/13 testes Node locais aprovados, sem skips**, incluindo o catálogo completo derivado. As verificações estáticas de sintaxe dos módulos atualizados foram efetuadas separadamente.

## O que ainda impede 100%

**Não certificado:** colisões de sprites em movimento, saltos de ledge e estados de deslocação comandados por scripts, Cut/Strength e obstáculos de história, colisões de água de Surf em execução, capturas/combatentes, interação com menus, RAM atómica e cartucho em execução verificado criptograficamente, e suite completa em RetroArch/SameBoy ou screenshots do Companion.

A grelha mede um **passo em terreno permitido pela tabela da ROM**, não a possibilidade de atravessar a casa, route, parede ou NPC *agora*. A inexistência de caminho pelo terreno estático não prova que o destino seja inacessível por mecanismos especiais.

Fontes canónicas: `pret/pokered/data/tilesets/tileset_headers.asm`, `collision_tile_ids.asm`, `pair_collision_tile_ids.asm`, `gfx/tilesets.asm`, `home/overworld.asm` (rotinas `CheckTilePassable` e `CheckForTilePairCollisions`). Binários reais confirmados por SHA-256 em cada teste.

Sem modificação de ROMs, saves ou perfis do Windows; sem GitHub Actions, minutos de CI ou pastas C:.

## Verificação rigorosa sem falsos resultados

Foi publicado `pokemon-ai-companion/scripts/verifyRealRomTerrain.js`, que exige **as três ROMs verdadeiras e um atlas por SHA-256**. Na falta de qualquer ficheiro, devolve erro e código de saída não zero — não apresenta testes ignorados como prova de execução. O comando no diretório `pokemon-ai-companion` é `npm run audit:terrain:strict`, após configurar `POKEMON_ROM_DIR` e `POKEGUIDE_ATLAS_JSON` (ou os caminhos individuais das três ROMs). O comando `npm run test:terrain` executa os testes de regressão e integridade sem gastar minutos de Actions.

Execução rigorosa local neste ambiente: `RESULTADO=3/3_ROMS_REAIS_VERIFICADAS cells=285396 walkable=145578`. Apenas leitura; sem novos ficheiros nas unidades do computador do utilizador.


## Adenda — a diferença de 66 posições na Green foi localizada exatamente

A diferença líquida de 66 células **não significa que apenas 66 células mudaram**. A comparação dos bitmaps de passagem célula a célula em 226 mapas demonstra:

| Mapa | Nome | Células com classificação alterada | Bloqueado em Red/Blue → permitido em Green | Permitido em Red/Blue → bloqueado em Green |
|---|---|---:|---:|---:|
| 226 | Cerulean Cave 2F | 216 | 115 | 101 |
| 227 | Cerulean Cave B1F | 236 | 138 | 98 |
| 228 | Cerulean Cave 1F | 190 | 101 | 89 |
| **Total** | | **642** | **354** | **288** |

Todos os restantes **223 mapas** têm a mesma classificação de tiles atravessáveis. **Red × Blue: 0 diferenças**. **Blue × Green: as mesmas 642 alterações**.

Publicados `romTerrainVariantDiff.js`, `data/gen1TerrainDifferences.json` (coordenadas de todas as 642 alterações e hashes dos binários) e testes. O guia e a interface identificam estas diferenças nos três pisos da Cerulean Cave apenas quando o perfil e o terreno estiverem validados, sem presumir que uma célula está acessível naquele momento.

O comando `npm run test:terrain` inclui agora todas as quatro baterias. **Execução local conjunta: 17/17 testes Node aprovados, 0 ignorados**. A verificação rigorosa `npm run audit:terrain:strict` passou sobre **3/3 ROMs originais** neste ambiente. Continuam pendentes a suite global e os testes da interface no emulador real.


## Adenda — verificação independente e transições Pé/Bicicleta/Surf D700

- Reconheceu-se que **o leitor completo de terreno e os percursos já estavam implementados** em `romTerrainAtlas.js`, com `romTerrainRouteHints.js` e ligação ao cliente. Para não instalar dois motores redundantes, as novas chamadas que duplicavam `world.terrainAtlas` foram retiradas de `romVariantRegistry.js` e `romLiveResolver.js`. Foi mantido `romTerrainCollision.js` apenas como **auditoria independente e de regressão**, não como segunda origem de recomendações ao jogador.
- Essa auditoria lê os 24 cabeçalhos do banco 3, segue os ponteiros reais de colisão do banco 0 e consulta as matrizes de blocos de cada mapa diretamente nos três ficheiros originais. A validação independente confirmou **226 mapas, 23 783 metablocos, 95 132 células e 11+3 pares de colisão por ROM**. Red e Blue têm tiles idênticos; Green altera 950 IDs de tiles em três mapas, correspondendo a 642 diferenças efetivas na classificação de passagem. Os ficheiros derivados `data/gen1TerrainCollisionAudited.json` permitem confirmar os 226 hashes de origem sem redistribuir cartuchos.
- Foi implementado `romTerrainMovement.js` sobre o **único** motor principal existente: para um mapa, posição e modo RAM `D700` corroborados, identifica as quatro direções e aplica as regras genéricas `CollisionCheckOnLand` / `CollisionCheckOnWater`. Inclui os casos Surf dos tiles `0x14`, `0x48` e `0x32` (exceção do tileset Ship Port), a entrada em terra/desmontagem e as colisões de pares de tiles em água. As saliências, NPCs, Cut, Strength, scripts e leituras UDP não atómicas continuam **sem prova de passagem real**.
- Corrigido `retroarchClient.js`: quando a leitura `D700` está ausente, adulterada ou fora dos valores `0, 1, 2`, a aplicação **não assume que o jogador está a pé**. Guarda estado desconhecido e bloqueia as sugestões desse ciclo. No mapa com geometria ROM/RAM conferida, produz `romMovementOptions` (quatro direções) sem declarar `actualMovementVerified=true`. Se o mapa `D35E` muda entre leituras, invalida as sugestões anteriores.
- Atualizada `public/app.js` para apresentar, separadamente, deslocação permitida pela tabela estática, bloqueios de pares, transições Surf/terra e saídas de mapa. São sempre previsões condicionais, não trajetos garantidos.
- Testes locais novos: **9/9** da auditoria binária independente contra Red ZIP (lida localmente sem alterar o original), Blue GB e Green International GB, e **5/5** do motor de transições Pé/Bicicleta/Surf com grelhas de ensaio: **14/14 aprovados, 0 ignorados**. Estes **não** incluem suite integral Node, verificação de vídeo nem execução do jogo num emulador. Os casos sintéticos são assinalados como tal, não confundidos com a validação de bytes originais.
- `npm run test:terrain:real` foi acrescentado: antes da bateria do terreno executa `verifyRealRomTerrain.js`, que **falha com erro** se faltarem as 3 ROMs ou o atlas; assim, não substitui provas verdadeiras por skips. `npm run test:terrain` mantém os testes unitários e agora inclui as novas verificações.

**Pendência impeditiva:** simulação completa dos eventos que alteram o terreno, ledges/colisões móveis, confirmação do modo de deslocação no mesmo frame da posição, e testes no RetroArch/SameBoy e na interface iPhone. Mesmo quando `romMovementOptions.verified=true`, `actualMovementVerified=false` e `atomicSnapshotVerified=false`.
