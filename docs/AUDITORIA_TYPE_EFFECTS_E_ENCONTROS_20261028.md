# PokéGuide — auditoria ROM TypeEffects e probabilidade de encontro

Data: **2026-10-28**. ROMs utilizadas: os três binários Red, Blue e Green International v1.2.1 fornecidos pelo utilizador, **sem os publicar**.

## Identidade dos binários validados

| Variante | SHA-256 |
|---|---|
| Red | `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b` |
| Blue | `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d` |
| Green International v1.2.1 | `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db` |

## Matriz TypeEffects descodificada

O scanner independente e o novo `romTypeMatchups.js` localizaram exatamente **82 triplos** ordenados `attackType, defenderType, multiplier` com terminador `FF` em cada ROM. Posição: banco **15**, offset **`0x3E474`**, comprimento **247 bytes** incluindo terminador. SHA-256 idêntico nas três ROMs:
`e55fa25d775c0020e2d36313983584cfbb250b9d0007a9c3cbf24a199a65aba4`.

A verificação incluiu: Ghost→Psychic `0x00`, Ghost→Normal `0x00`, Normal→Ghost `0x00`, Bug→Poison `0x14`, Poison→Bug `0x14` e Fire→Ice `0x14`. Os fatores são armazenados na ROM em décimos (0, 5 ou 20). A ordem dos 82 registos é relevante devido aos arredondamentos sucessivos em `AdjustDamageForMoveType`. Os comportamentos são da **geração I**, não de tabelas de jogos modernos.

**Código publicado:** `pokemon-ai-companion/romTypeMatchups.js` e integração em `romVariantRegistry.js`, que preenche `typeMatchups`, `typeMatchupsStatus` e `offsets.typeMatchups` somente quando a tabela tem estrutura válida e ocorrência única. A falta de correspondência impede apresentá-la como verificada.

**Testes:** `pokemon-ai-companion/tests/romTypeMatchups.test.js`; executados localmente cinco cenários em Node 22.16.0, sendo três contra os três binários anexados e dois contra estrutura ausente, duplicada ou corrompida. **5/5 aprovados**, com hashes reais confirmados. Não é uma prova de funcionamento de RAM ao vivo no iPhone.

## Probabilidade de encontros — correção ao denominador

O código de `TryDoWildEncounter` em `pret/pokered/engine/battle/wild_encounters.asm` lê `hRandomAdd` e só inicia a seleção se o valor for **estritamente inferior** a `wGrassRate` ou `wWaterRate`. O byte aleatório assume os valores `0..255`. Portanto, numa **verificação elegível**, o limiar de ativação é `rateByte/256`.

O byte `hRandomSub` é depois selecionado por limiares de slot definidos por 10 pesos `51,51,39,25,25,25,13,13,11,3`, somando 256.

A probabilidade **por passo efetivo** não pode ser declarada a partir da tabela estática: o caminho de execução depende do terreno/tile, movimento/script, mapa, repelente, nível do primeiro Pokémon e outros estados. A escolha entre relva e água usa ainda o tile da metade inferior do bloco, conforme a rotina ASM, não apenas a capacidade de Surf.

**Código publicado:** `romCaptureOpportunities.js` expõe `eligibleCheckOutOf256` e `eligibleCheckPercent`; `public/app.js` mostra `taxa/256` como **probabilidade condicional de verificação RNG em terreno elegível**, e não como probabilidade por passo. `tests/romCaptureOpportunities.test.js` acrescenta um teste que exige a taxa `15/256` e `perStepChanceVerified=false`. Conjunto de testes de oportunidades de captura e zona: **5/5 aprovados** em execução isolada JS com fontes atuais do GitHub.

## Saídas e limites

Foi gerado o atlas local `pokeguide_rom_audit_v2.json`, que acrescenta `typeEffects` em cada versão e `eligibleEncounterCheck` em cada meio de todos os 248 IDs de mapa, preservando os dados anteriores. O arquivo ZIP atualizado contém apenas dados extraídos, relatório e código de verificação, **não ROMs nem saves**.

O objetivo de 100% do jogo continua **não certificado**. Falta confrontar todas as regras com estados de jogo ao vivo, implementar as exceções completas de dano/captura, provar condições de encontros por passo e executar a bateria integral da aplicação e uma validação visual no SameBoy/iPhone.
