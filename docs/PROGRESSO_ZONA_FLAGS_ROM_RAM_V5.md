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
