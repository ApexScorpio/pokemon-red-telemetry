# PokéGuide — despacho dos 165 golpes para os efeitos da ROM

**28 de outubro de 2026.** Red, Blue e Green International v1.2.1 (três SHA-256 verificados). A leitura de dados binários é estática e não prova a execução de um turno.

## Implementação real

- `pokemon-ai-companion/romMoveEffectDispatch.js` utiliza a tabela `Moves` de 165 × 6 bytes e `MoveEffectPointerTable` de 86 × 2 bytes, no banco 15 do cartucho, a partir do próprio ficheiro ROM. Rejeita ROMs desconhecidas, tabelas truncadas, IDs fora de intervalo ou destinos de handler não reconhecidos.
- Foram identificados **86 slots de efeito**, **35 destinos distintos (incluindo NULL)**, com **7 slots NULL**.
- Nos 165 golpes, **123** possuem uma rotina de efeito nessa tabela; **42** usam o caminho de efeito normal ou um tratamento especial no motor principal.
- Os 165 registos de golpe, 86 slots e destinos são binariamente iguais nas três ROMs auditadas. Isto **não** prova igualdade de comportamento de todo o motor entre versões.
- `romVariantRegistry.js` associa a tabela ao perfil da ROM exata.
- `data/gen1MoveEffectDispatchAudited.json` publica apenas **dados derivados** verificados nas três ROMs, sem distribuir ROM ou save.
- `romLiveResolver.js` anexa estes dados a perfis importados antigos somente depois das validações de SHA-256, CRC32 e tamanho; perfis lidos diretamente da ROM mantêm prioridade.
- `romComprehensiveAudit.js` inclui o mapeamento completo no inventário conjunto; `retroarchClient.js` expõe o handler por golpe, mas mantém `effectOutcomeCertified=false`.

## Proteções semânticas

Um destino `NULL` na tabela **não significa que o golpe seja ineficaz**. Por exemplo, Jump Kick tem tratamento no código principal, apesar de a sua entrada apontar para NULL. Outros ramos especiais dependem de combate, sorte, estado e máquina de estados. Nenhum efeito é marcado como reproduzido dinamicamente apenas por se ter encontrado o ponteiro.

A fonte primária é `pret/pokered/data/moves/effects_pointers.asm`, `constants/move_effect_constants.asm`, `data/moves/moves.asm` e os bytes reais das três ROMs.

## Provas

- `tests/romMoveEffectDispatch.test.js`: **5/5 testes locais aprovados, sem skips**, incluindo Red ZIP, Blue GB e Green International GB; perfis falsos rejeitados.
- Execução isolada da função de enriquecimento de `romLiveResolver.js` obtida diretamente do GitHub: três versões com 165 golpes e 83 itens e zero alegações de RAM em direto.
- Tests extra de importação de perfil adicionados. A **suite integral Node, emulador SameBoy/RetroArch, sessão real e screenshots não foram executados** nesta sessão.

**Ainda por validar:** todas as ramificações dos 34 handlers não nulos, todos os casos especiais do motor central, interações de status, RNG, prioridade de turno, dano condicional, scripts, capturas e RAM coerente. Por isso, 100% de semântica **não está certificado**.