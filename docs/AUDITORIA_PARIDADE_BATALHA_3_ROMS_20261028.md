# PokéGuide — Paridade binária das tabelas de batalha nas três ROMs
Data: 2026-10-28

## Prova diretamente nos três ficheiros originais
Recuperados e lidos os três GB originais de 1 048 576 bytes, Red, Blue e Green International 1.2.1. SHA-256 completo validado de cada um: Red `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b`, Blue `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d`, Green `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db`. Três checksums de cabeçalho aprovados.

| Região da ROM | Offset | Bytes | Registos | SHA-256 idêntico nas 3 |
|---|---|---:|---:|---|
| Moves | 0x38000 | 990 | 165 | 0c0d7a55f01f09c5f4859344d087cc824e516b2facc520e389e4bdcb8d14db1e |
| MoveEffectPointerTable | 0x3f150 | 172 | 86 | d96d631d05ad0c272754eaf0f958b4779dff0e42e701757ff1f3d93c2eff338d |
| StatModifierRatios | 0x3f6cb | 26 | 13 | 33e376efc53ef98b4445197cbf00df4209637897d0a596391a9b0a559234561f |
| HighCriticalMoves | 0x3e08e | 5 | 4 + FF | 5da5f586f20cfaac9f7410e1a64ba024fd3fc216f06b33b988315ae5cac367f5 |
| UnusedHighCriticalMoves | 0x3e01e | 5 | 4 + FF | 5da5f586f20cfaac9f7410e1a64ba024fd3fc216f06b33b988315ae5cac367f5 |

## Código, testes e limites
A auditoria independente `scripts/verifyRealRomBattleTables.js` exige 3 ROMs com SHA-256 exato, checksum de cabeçalho, 165 IDs consecutivos e PP legítimo, 86 apontadores (35 destinos distintos, 7 NULL), rácios e lista de críticos reais. Compara byte a byte as cinco regiões e imprime JSON com hashes das tabelas; não escreve dados de jogo.

`POKEMON_ROM_DIR=<pasta-com-os-3-gb> npm run audit:battle:real` e `npm run test:battle:real` exigem ficheiros originais; sem ROMs terminam em erro, sem testes ignorados. O segundo executa o teste em `scripts/verifyBattleTablesStrict.cjs`, intencionalmente fora da descoberta de testes sem ROMs do comando `npm test`.

**Execução efetiva no ambiente isolado** (Node 22): auditoria `verified:true` e 6/6 testes aprovados, 0 ignorados. Testes negativos incluíram ROM adulterada, truncada, omitida ou trocada. Não se executou a suite global do repositório nem o Companion ao vivo; não foram capturados screenshots de interface.

**Não significa 100% de combate:** estas tabelas são idênticas, mas handlers, código fora destes intervalos, flags, movimento, itens, RNG e timings não foram todos comprovados. Não prova identidade criptográfica da ROM ativa no iPhone nem snapshot RAM atómico. ROMs/saves e perfis protegidos nunca foram modificados, sem GitHub Actions e sem operações no disco C: do utilizador.
