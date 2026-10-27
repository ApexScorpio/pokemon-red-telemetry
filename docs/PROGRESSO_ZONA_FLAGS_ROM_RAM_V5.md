# Auditoria de progresso por zona: ROM + RAM, sem suposições

**Data:** 27 de outubro de 2026

## Mudanças já publicadas

1. `romEventState.js` — descodifica **wToggleableObjectList** (D5CE, 34 bytes) e **wToggleableObjectFlags** (D5A6, 32 bytes): associação real entre número de objeto no mapa atual, índice global da flag e bit 0/1. O bit prova apenas que o jogo marcou o objeto como **removido**, não que o jogador o recolheu.
2. A tabela **HiddenItemCoords** da ROM foi localizada e comparada byte a byte nos três ficheiros reais recebidos: Red offset `0x766B8`, Blue `0x766B9` e Green International `0x766BA`. São **54 entradas** (tripletos mapa/Y/X) mais terminador `FF`, com conteúdo igual nessas três revisões, mesmo tendo sido deslocada por um e dois bytes.
3. `romEventState.js` associa cada posição oculta da tabela ROM a um bit real de `wObtainedHiddenItemsFlags` (D6F0, 14 bytes). Exemplo efetivo: Route 4, mapa ID 15, posição X40/Y3, índice global 53 = byte 6, bit 5. Apenas os três SHA-256 exatos auditados autorizam esta correspondência. Não se tenta extrapolar o mesmo índice para hacks desconhecidos.
4. `romAreaEvidence.js` associa objeto ROM local à flag de remoção atual, mas mantém `collected=null` e `defeated=null` quando não há prova de recolha/vitória; a ausência do sprite na lista RAM não prova conclusão.
5. `retroarchClient.js` publica `toggleableObjectTelemetry`, `romHiddenItems` e `romAreaProgress`. A área recebe todos os objetos de item definidos na ROM, inclusive os que faltavam ao catálogo manual. O nome de referência e a acessibilidade heurística não se transformam automaticamente em factos ROM.
6. Eliminada a utilização de índices `toggleIndex` manuais para declarar `isCollected` de itens visíveis. A flag de objeto removido é publicada à parte.
7. Neutralizados os campos `isDefeated` e `isMissed` das batalhas manuais no painel de recomendações, até que as flags reais dos cabeçalhos dos treinadores sejam associadas; evita repetir como factual uma luta que pode já ter sido vencida.
8. `romAreaProgress.js` fornece contagens estritamente separadas: itens ocultos comprovadamente recolhidos/não recolhidos, objetos de mapa removidos/por remover e treinadores cuja conclusão permanece **desconhecida**.
9. Testes: `tests/romEventState.test.js`, `tests/romAreaProgress.test.js`; cinco provas isoladas da leitura RAM/ROM passaram no motor JavaScript do ambiente. A sintaxe dos seis módulos e testes alterados foi verificada.

## O que ainda não foi certificado

- **Treinadores:** todos os cabeçalhos de treinador e respetivas flags específicas por mapa ainda não foram ligados automaticamente e validados nas três ROMs. O catálogo de batalhas atual é fonte de sugestões, **não prova de vitórias**.
- **Itens visíveis removidos:** `removedFromMap=true` não é sinónimo de `collected=true` porque os scripts podem esconder entidades por outros motivos.
- **Nomes de itens ocultos:** ainda vêm da lista de referência por coordenadas; a relação itemID/texto do script ROM não foi descodificada integralmente.
- **NPCs e presentes:** falta interpretar scripts, flags e condições de interação.
- **Mapa e estado:** o iPhone não foi testado contra este patch nesta sessão; leituras de RAM podem falhar ou ter diferenças noutras ROMs, caso em que o estado deve ser desconhecido.
- **Universalidade:** o mapeamento exato das 54 posições só foi validado para os três SHA-256 fornecidos, não para qualquer hack.

## Fontes primárias

- `pret/pokered/data/events/hidden_item_coords.asm`: ordem das 54 coordenadas; índice de cada posição é o bit de recolha.
- `pret/pokered/engine/items/itemfinder.asm`: `FlagActionPredef` com índice percorrido em `HiddenItemCoords`.
- `pret/pokered/engine/overworld/toggleable_objects.asm`: relação da lista por sprite com índice global da flag.
- `pret/pokered/data/maps/toggleable_objects.asm`: mapeamento global dos objetos alternáveis e estado inicial.

**Critério de segurança:** só declarar concluído quando um bit/sinal de RAM prova essa conclusão e quando a sua identidade foi validada para a ROM realmente carregada. Um item possuído, sprite ausente ou NPC próximo não bastam.


## Adenda — treinadores auditados posteriormente (27/10/2026)

A limitação relativa a treinadores foi **parcialmente ultrapassada** após a publicação inicial deste documento:

- **17 mapas e 50 treinadores** foram cruzados com cabeçalhos de treinador presentes nos três ficheiros ROM recebidos, e com o dicionário de flags `EVENT_BEAT_*` da desmontagem, sem recorrer a resultados presumidos.
- O ficheiro `romTrainerEvents.js` indica o `eventBitIndex` apenas para estes mapas e só quando o SHA-256 do perfil coincide exatamente com uma das três ROMs analisadas.
- A RAM `wEventFlags` fornece o bit atual de cada treinador verificado. O painel distingue VENCIDO / POR VENCER dos restantes, que permanecem ESTADO DESCONHECIDO.
- Teste de exemplo: Route 6, mapa 17, 6 treinadores, índices 1041 a 1046. Duas flags em 1 produzem exatamente duas vitórias e quatro batalhas pendentes.
- Ainda faltam os outros mapas e a verificação da ligação em execução no iPhone. A presença na ROM não prova que um treinador esteja visível ou acessível nesse instante.


## Adenda — Identificação automática dos 54 itens e 12 moedas ocultas (27/10/2026)

- O novo `romHiddenEvents.js` analisa o próprio binário ROM sem escrever dados: identifica a tabela `HiddenEventMaps` (85 mapas), o conjunto de 217 eventos compilados, os ponteiros das rotinas e a `HiddenItemCoords` (54 tripletos mapa/Y/X). Compara cada coordenada com o seu evento de seis bytes e extrai o **item ID verdadeiro** do argumento da rotina, recusando duplicações e referências ambíguas.
- Validado em Red, Blue e Green International v1.2.1: 54 IDs iguais, com deslocações dos endereços: `HiddenItemCoords` em `0x766B8 / 0x766B9 / 0x766BA`; rotina `HiddenItems` em `1D:6688 / 1D:6689 / 1D:668A`. O item oculto da Route 4 em X40/Y3 é **item ID 03 (Great Ball)**, e a flag de recolha continua a ser lida da RAM `D6F0`.
- `romVariantRegistry.js` guarda os resultados com hash em `world.hiddenItemScripts` nos perfis produzidos a partir de uma ROM local. `romEventState.js` prefere esta extração quando o SHA-256 coincide; para os três perfis antigos Red/Blue/Green mantém a tabela de IDs anteriormente auditada, sem exigir uma instalação manual adicional.
- Foram também identificadas **12 moedas ocultas** no Game Corner. Distinguem-se dos itens e das slot machines mesmo quando partilham uma coordenada. A tabela de coordenadas está em `0x76822 / 0x76823 / 0x76824` e a rotina no banco `1D` nos endereços `6799 / 679A / 679B`. Os valores comprovados por ROM são `10,10,20,10,10,20,10,10,10,40,100,10`.
- Os bits de recolha das moedas vêm de `wObtainedHiddenCoinsFlags` (`D6FE..D6FF`) e são lidos em separado dos bits de itens (`D6F0..D6FD`), através de `retroarchClient.js`. O painel `public/app.js` mostra quantidades e estado de cada moeda do mapa.
- Adicionados testes de regressão aos ficheiros `tests/romHiddenEvents.test.js` e `tests/romEventState.test.js`; efetuados testes locais reais nas três ROMs (54 itens, 12 moedas, endereços distintos) e execução isolada da lógica de flags. Verificada sintaxe de todos os módulos alterados. A execução integral no iPhone ainda não foi testada.
- **Não confundir** recolha real com posse de objetos/quantidades na mochila ou Coin Case; o bitmap marca o evento de recolha. Paletas, scripts completos dos NPCs e os restantes eventos especiais ainda exigem verificação.

Fontes técnicas: <https://github.com/pret/pokered/blob/master/data/events/hidden_events.asm>, <https://github.com/pret/pokered/blob/master/engine/events/hidden_items.asm> e <https://github.com/pret/pokered/blob/master/data/events/hidden_coins.asm>.
