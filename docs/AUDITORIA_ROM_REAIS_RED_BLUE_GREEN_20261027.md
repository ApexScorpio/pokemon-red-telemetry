# Auditoria direta das ROMs Red, Blue e Green International v1.2.1

Data: **2026-10-27**. Fonte: **três binários de ROM que o utilizador anexou nesta conversa**. Foram lidos em memória, exclusivamente em modo de leitura, por um scanner Python independente. A ROM Red foi lida de dentro do ZIP sem alterar o arquivo.

**Não inclui nem disponibiliza ficheiros .gb/.zip. Não contém saves, tokens ou outros dados pessoais.**

## Identidade e integridade verificadas

| Variante | SHA-256 integral | CRC32 | Título ROM |
|---|---|---|---|
| Red | `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b` | `9F7FDD53` | POKEMON RED |
| Blue | `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d` | `D6DA8A1A` | POKEMON BLUE |
| Green International v1.2.1 | `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db` | `3C2DD8AE` | POKEMON GREEN |

Cada ROM: **1 048 576 bytes**; checksum interno do cabeçalho **válido**. A identificação é a identidade real do ficheiro analisado; não comprova qual ROM está carregada no iPhone.

## Estruturas extraídas e contadas em cada uma das três ROMs

| Estrutura | Red | Blue | Green |
|---|---:|---:|---:|
| Entradas da tabela Moves (6 bytes) | 165 | 165 | 165 |
| IDs de mapas | 248 | 248 | 248 |
| Cabeçalhos normais de mapas descodificados | 226 | 226 | 226 |
| IDs sem cabeçalho normal | 22 | 22 | 22 |
| Treinadores humanos definidos como objetos | 334 | 334 | 334 |
| Pokémon fixos em objetos de mapa | 12 | 12 | 12 |
| Objetos de itens de chão | 106 | 106 | 106 |
| NPCs definidos como objetos de mapa | 472 | 472 | 472 |
| Registos únicos de tabelas selvagens | 59 | 59 | 59 |

Offsets confirmados diretamente: **Moves** `0x38000` (banco 14); **WildDataPointers** `0xCEEB` (banco 3); **MapHeaderPointers** `0x1AE`; **MapHeaderBanks** `0xC23D`; **BaseStats** `0x383DE` (150 registos de 28 bytes).

Os 990 bytes de registos de movimentos são **idênticos** entre as três ROMs: SHA-256 da tabela `0c0d7a55f01f09c5f4859344d087cc824e516b2facc520e389e4bdcb8d14db1e`.

Foram descodificados, por cada ficheiro, os 190 slots de espécies internas, as 150 fichas BaseStats, os encontros por mapa (espécie, nível e peso condicionado a encontro) e os objetos/posições dos mapas validados. Nos campos mecânicos de BaseStats — atributos-base, tipos, catch rate, base EXP e curva de crescimento — não foram encontradas diferenças entre as três variantes. A tabela binária BaseStats da Green difere nos ponteiros gráficos e no byte final, pelo que **não é correto assumir equivalência de todos os 28 bytes**.

## Diferenças reais dos encontros

| Comparação | Mapas com encontros de relva diferentes | Slots diferentes |
|---|---:|---:|
| Red vs Blue | 34 | 175 |
| Red vs Green | 31 | 122 |
| Blue vs Green | 29 | 83 |

Não foram encontradas diferenças nos slots do **segundo grupo de encontros** que o descodificador ROM classifica como `water`. A semântica exata da ativação do encontro por passo, pelo método de deslocação, repelente e outros estados exige auditoria adicional ao código ASM da variante.

Exemplo auditado: **mapa 13 — Route 2**. Na Red, Weedle de níveis 3, 4 e 5 ocupa 39/256 = **15,234375%** dos resultados condicionais aos encontros desse meio. Na Blue e na Green, os mesmos três slots são Caterpie, com o mesmo peso. Este valor **não** é a probabilidade de aparecer por passo nem a probabilidade de captura.

### Regressão publicada

`pokemon-ai-companion/tests/romThreeRealFiles20261027.test.js` valida:
- os três SHA-256 exatos, tamanho, 165 movimentos e respetivos bytes;
- 248 IDs, 226 cabeçalhos, 334 treinadores humanos, 106 itens de chão e 12 Pokémon fixos;
- distribuição de 256 pesos por meio com encontros;
- diferenças por zona: 34/31/29 mapas em relva e igualdade do segundo grupo.

O teste está preparado para ser executado no próprio repositório com `POKEMON_RED_ROM`, `POKEMON_BLUE_ROM`, `POKEMON_GREEN_ROM`, apontados para **ficheiros .gb locais**; se não forem indicados, o teste fica explicitamente **SKIP**. Não faz upload nem modifica os binários.

**Estado dos testes**: a auditoria independente Python foi realmente executada sobre os três ficheiros recebidos e os totais acima foram verificados; a nova regressão Node/GitHub ainda não foi executada no ambiente do utilizador ou com a árvore completa do repositório nesta sessão.

## Cobertura não certificada

Esta auditoria **não** demonstra um jogo 100% mapeado. Faltam interpretar e validar todos os scripts/eventos, os itens ocultos e obtenções, a ativação exata dos encontros, os cálculos completos de combate e captura com todas as exceções, a RAM/SRAM real, saves, e a integração observada com RetroArch/SameBoy no iPhone. Os 22 IDs sem cabeçalho normal não são automaticamente "22 mapas incompletos"; representam IDs sem cabeçalho normal identificável nestes binários.
