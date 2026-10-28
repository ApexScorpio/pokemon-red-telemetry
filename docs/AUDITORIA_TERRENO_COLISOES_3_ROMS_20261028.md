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
