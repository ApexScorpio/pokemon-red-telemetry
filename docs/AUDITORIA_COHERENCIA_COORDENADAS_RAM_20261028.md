# PokéGuide — posição e modo de movimento corroborados pela RAM

**Data:** 2026-10-28. **Âmbito:** evitar previsões de terreno e movimento baseadas em coordenadas ou modo desatualizados na mesma zona do jogo.

## Defeito real corrigido

O ciclo anterior confirmava uma segunda vez o byte `wCurMap=D35E`, mas não confirmava os valores `wYCoord=D361` e `wXCoord=D362`. O jogador pode deslocar-se dentro do mesmo mapa durante leituras sequenciais UDP; nessa situação, a análise de terreno e os percursos passavam a referir-se a coordenadas desatualizadas, embora o mapa continuasse a corresponder.

O leitor já repetia `D35E..D365` num bloco de oito bytes. Essa mesma releitura permite verificar as coordenadas **sem criar outro pedido de RAM**.

- Criado `romMapPositionConsistency.js`: compara o primeiro ID de mapa, X e Y (offsets 518, 521 e 522 no bloco do jogador) com a releitura `D35E..D365` (offsets 0, 3 e 4). Rejeita alterações do mapa, alterações de X/Y, IDs de mapa inválidos, bytes incompletos e leituras malformadas.
- Atualizado `retroarchClient.js`: guarda `romTerrainPositionWindow`, bloqueia `romTerrainCurrentTile`, `romTerrainWarpHints` e `romMovementOptions` quando as coordenadas não foram corroboradas. A informação estática da ROM pode continuar a ser apresentada se o mapa estiver confirmado.
- Criado `romMovementModeConsistency.js`: compara a primeira leitura de `wWalkBikeSurfState=D700` com uma segunda leitura desse byte antes das sugestões de movimento. Apenas `0=WALK`, `1=BIKE` e `2=SURF` são aceites e devem coincidir entre leituras.
- Se `D700` mudar ou estiver indisponível, o modo apresentado fica desconhecido e as recomendações de movimento são bloqueadas.
- Atualizado `public/app.js` para mostrar o motivo específico quando X/Y ou D700 deixam de ser comprovados.
- Adicionados `tests/romMapPositionConsistency.test.js` e `tests/romMovementModeConsistency.test.js`. Novo comando `npm run test:ram:consistency` inclui os testes de mapa, posição, modo de movimento, janela de combate e terreno.

## Provas desta execução

- **10/10 testes locais Node, zero ignorados:** 6 de consistência de posição e 4 de modo de movimento; testes de casos coerentes, mapa alterado, movimento no mesmo mapa, alteração de X ou Y, D700 alterado, bytes incompletos e valores fora de intervalo.
- **6/6 testes locais adicionais, zero ignorados**, com os três ficheiros ROM originais enviados, executados por um verificador independente de tilesets e matrizes. Resultados: 24 tilesets, 226 mapas, 23 783 metabloco, 95 132 células de terreno por ROM, 11 regras de pares de tiles terrestres e 3 aquáticas. O número de células na whitelist básica é 48 504 em Red, 48 504 em Blue e 48 570 em Green International. Isto reproduz os totais já publicados no projeto, **não constitui uma nova funcionalidade de colisões**.
- Código remoto verificado sintaticamente após as alterações. **Não foi executado `npm test` integral nem `npm run test:ram:consistency` na árvore completa do repositório**. O emulador e o iPhone não foram acedidos.

## Provas que continuam em falta

Duas leituras UDP que coincidem **não constituem um snapshot atómico de um único frame**. A identidade SHA-256 da ROM efetivamente carregada no emulador, as ações temporais, os scripts dinâmicos, o RNG e a validação visual do Companion não ficaram certificados nesta execução. Nenhuma ROM, save ou sessão foi alterada.

**Fontes de endereços:** `pokemon-ai-companion/data/pokered.sym`: `D35E wCurMap`, `D361 wYCoord`, `D362 wXCoord`, `D365 wLastMap`, `D700 wWalkBikeSurfState`.

**Estado:** correção publicada e testada localmente. Não declarar o PokéGuide 100% concluído.
