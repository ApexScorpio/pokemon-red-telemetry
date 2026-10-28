# PokéGuide — Proveniência obrigatória do SHA nas fórmulas (2026-10-28)

## Defeito confirmado antes da correção
Quatro módulos calculavam `verified:true` quando recebiam `romSha256='0000…0000'` (64 algarismos zero), com indicadores booleanos verdadeiros. O código exigia apenas formato hexadecimal, não que esse SHA correspondesse a uma das três ROMs realmente auditadas. O ensaio isolado com o conteúdo efetivo da revisão `main` reproduziu o problema nos ramos de captura, precisão, crítico e encontros.

## Correção num só lote
Criado `pokemon-ai-companion/romKnownSha256.js`, com SHA-256 Red, Blue e Green International v1.2.1, tal como identificados na auditoria das três ROMs. Aplicada a validação `isKnownAuditedRomSha` em `gen1CaptureProbability.js`, `gen1StandardHitChance.js`, `gen1CombatProbabilities.js` (crítico e dano) e `gen1WildEncounterCheck.js`. Os três SHA válidos continuam aceites; hashes desconhecidos deixam de produzir `verified:true`, mesmo quando o chamador declara todas as outras evidências verdadeiras.

Novo teste de regressão `tests/gen1KnownRomProvenance.test.js` cobre seis ramos: Master Ball, Poké Ball normal, precisão, críticos, dano e encontros. Abrange três SHA aceites, SHA inventado, entradas malformadas e RAM não confirmada. A suite `node --test` inteira está **por executar**; execução isolada real por avaliação V8 dos quatro módulos alterados: **16/16 asserções aprovadas** (um falso SHA + três SHA conhecidos por módulo).

## Limitações que não foram eliminadas
Um SHA admitido pelo catálogo NÃO comprova que os mesmos bytes estão a correr no iPhone, pois o CRC32 reportado pelo emulador não é prova criptográfica do SHA-256 da ROM ativa. Uma evidência booleana autodeclarada também não autentica a RAM; comparar leituras sequenciais não garante simultaneidade. Esta alteração é uma barreira de segurança do motor de cálculo, não a conclusão da implementação integral das ROMs. Não foram executados emulador, interface gráfica nem screenshots; nenhum save, ROM, token, perfil, aplicação protegida ou disco do computador do utilizador foi modificado. Sem GitHub Actions.
