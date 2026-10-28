# PokéGuide — auditoria da taxa de captura RAM e dos slots de encontros

Data: **2026-10-28**. Fonte primária: três ROMs locais anexadas à conversa, identificadas por SHA-256. Não são publicadas nem alteradas.

## Identidade dos ficheiros binários

| Versão | SHA-256 |
|---|---|
| Red | `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b` |
| Blue | `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d` |
| Green International v1.2.1 | `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db` |

### Captura: a taxa utilizada está em D007, não em CFEC

A desmontagem `pret/pokered/macros/ram.asm` define `battle_struct`; os símbolos em `pokemon-ai-companion/data/pokered.sym` associam:
- `wEnemyMon` a `CFE5`;
- `wEnemyMonHP` a `CFE6`;
- `wEnemyMonStatus` a `CFE9`;
- `wEnemyMonType1/2` a `CFEA/CFEB`;
- `wEnemyMonCatchRate` (base) a `CFEC`;
- `wEnemyMonMaxHP` a `CFF4`;
- `wEnemyMonActualCatchRate` (efetiva) a **`D007`**.

A rotina `ItemUseBall` em `pret/pokered/engine/items/item_effects.asm` faz duas leituras desta taxa efetiva. Na ROM de cada versão foram confirmados os bytes `FA 07 D0` — instrução `LD A,[D007]` — nos offsets **`0xD777` e `0xD797`**. Blue/Red têm a mesma janela de 320 bytes da rotina; Green tem diferenças noutros bytes mas preserva ambas as leituras da taxa efetiva. **Não assumir código integralmente idêntico entre versões.**

`romCaptureLayout.js` exige SHA-256 integral de uma das três ROMs e confirma os dois opcodes. O perfil ROM guarda `battleCaptureLayout`. `romBattleEvidence.js` só permite disponibilizar `actualCatchRate` quando há combate selvagem, perfil correspondente e layout auditado, usando o byte **39** do bloco `CFE0` (CFE0 + 39 = D007). Status e tipos são lidos do mesmo bloco. A rotina rejeita estados incompatíveis ou estruturas incompletas.

### Coerência temporal da RAM

O leitor `retroarchClient.js` já valida a estrutura dos blocos CFE0 (255 bytes), D014 (30 bytes) e CC20 (280 bytes). A partir desta revisão, uma **segunda ronda de leitura** compara:
- `CFE5` (40 bytes): mon adversário e campo D007;
- `D014` (29 bytes): mon ativo do jogador;
- `CD1A` (26 bytes): estágios de atributos dos dois combatentes;
- `D057` (1 byte): flag de combate;
- `D35E` (1 byte): mapa atual.

Se qualquer elemento mudar, não se publica a ficha do combate como amostra coerente. A verificação marca sempre `atomicSnapshotVerified:false`. Duas leituras coincidentes **não** demonstram que se obteve um estado atómico do emulador ou a execução do mesmo binário SHA-256 no iPhone. A calculadora de captura mantém `legalThrowVerified:false` e não inventa probabilidades quando falta legalidade/contexto.

### Pesos dos dez slots diretamente da ROM

A tabela `WildMonEncounterSlotChances`, documentada em `pret/pokered/data/wild/probabilities.asm`, ocupa **20 bytes** na ROM, banco 4, offset **`0x13918`**. Nas três ROMs auditadas:
- bytes: `320065028c04a506be08d70ae40cf10efc10ff12`;
- SHA-256 dos 20 bytes: `cc7c8d55c379dd3bfcefd538aff7db3b479a9df12c5013469e8af40e4f1b6009`;
- pesos por slot: **51, 51, 39, 25, 25, 25, 13, 13, 11, 3** (total 256).

Antes, `romWorldData.js` atribuia estes pesos como uma constante. Agora `romEncounterWeights.js` extrai os dez limiares inclusivos da ROM; `romWorldData.js` recusa tabelas ausentes ou ambíguas e inclui `slotWeightsFromRom` no atlas. Uma ROM modificada que altere a assinatura inicial precisa de auditoria própria; o código não lhe atribui silenciosamente pesos da versão original.

`romCaptureOpportunities.js` deixou de ignorar slots malformados e deixou de arredondar as frações de encontro a duas casas decimais. Exemplo: **51/256 = 19,921875%**, condicionado a um encontro desse meio. Continua sem afirmar probabilidade por passo quando faltam condições de movimento e terreno.

### Validação realmente executada

- **Node v22.16.0**: cópias dos ficheiros `romCaptureLayout.js` e `romEncounterWeights.js` idênticas aos blobs publicados (SHA Git: `b1d46150e3567d81696f9522aeddb36fca9a5cfe` e `5e6f2778ae140d56340431646d0f08503f8ff08e`) foram executadas contra os três binários reais: **6 verificações diretas aprovadas** (duas por ROM: layout de captura e slots).
- **Python independente**: confrontados os bytes da tabela de slots e as duas leituras de D007 com cada ROM e os **58 meios de encontro ativos por versão** (55 relva, 3 água); todos os 174 meios ativos coincidem com os pesos dos dez slots do atlas anterior.
- **JavaScript isolado (fonte atual GitHub)**: 24 cenários aprovados e três testes com ROM em `tests/romEncounterWeights.test.js` corretamente assinalados como SKIP nesse ambiente. Os testes foram executados antes da última atualização do guardião de layout; não reivindicar cobertura integral do `npm test`.
- As verificações são de código e ROM. **Não** houve teste ponta a ponta do RetroArch/SameBoy no iPhone nem screenshot da interface, pois não houve mudança visual nesta fase.

### Pendências

- Provar correspondência de SHA-256 **no próprio emulador**, não apenas CRC32 versus perfil local.
- Certificar estado de turno consistente/atómico, os efeitos, exceções de captura (fantasmas, Safari, treinador, etc.) e a legalidade da bola.
- Executar o `npm test` integral do projeto e validar UI na sessão real.
- Prosseguir com dano, ordem de turnos, precisão, críticos e scripts de eventos, sem alegar 100% até haver contadores verificáveis por categoria.
