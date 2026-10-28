# PokéGuide — auditoria integrada de lojas, preços, trocas, prémios, pesca e utilização de itens

**Data:** 28 de outubro de 2026. **ROMs efetivamente lidas:** Red, Blue e Green International v1.2.1, cada uma com 1 048 576 bytes; SHA-256 individual confirmado. **Estado:** módulos estáticos auditados e integrados; não há certificado de 100% das mecânicas nem teste end-to-end do emulador.

## Código publicado

- `pokemon-ai-companion/romEconomyTrades.js`: sete conjuntos de dados originais mais a tabela de dispatch de utilização de itens, todos extraídos diretamente dos 3 binários por estrutura e SHA-256, sem dados fictícios.
- `romVariantRegistry.js`: anexa `economyTrades` ao perfil da ROM quando o binário está disponível.
- `data/gen1EconomyTradesAudited.json`: catálogo derivado, guardado no repositório **sem os bytes dos cartuchos ou saves**, associado a SHA-256 e CRC32 de cada ROM.
- `romLiveResolver.js`: enriquece perfis JSON previamente guardados **apenas** se o SHA-256, CRC32, tamanho total e bytes declarados coincidirem; não substitui um perfil que já contém leitura direta.
- `romComprehensiveAudit.js`: inclui estas tabelas no inventário único e contabiliza os handlers.
- `romAreaGuide.js`: acrescenta lojas/preços, ofertas de troca, Game Corner, vending e pesca específicos do mapa e da variante; separa referências de localização canónica da confirmação dos scripts reais, especialmente na Green International.
- `public/app.js`: mostra estas informações no painel de área depois de a RAM confirmar o mapa, sem declarar compras efetuadas ou disponibilidade atual.
- Testes: `tests/romEconomyTrades.test.js`, `tests/romEconomyProfileImport.test.js` e `tests/romEconomyAreaIntegration.test.js`.

## Cobertura estática comprovada por ROM

| Categoria | Conteúdo confirmado |
|---|---|
| Itens regulares | 83 preços BCD de 3 bytes |
| TMs | 50 preços da tabela de nibbles |
| Lojas | 16 scripts de inventário; 14 referenciados na desmontagem canónica, 2 identificados como não utilizados |
| Vending | 3 produtos/preços |
| Trocas NPC | 10 registos, incluindo um não utilizado segundo referência |
| Game Corner | 9 prémios, 6 níveis de Pokémon e os custos em moedas |
| Pesca | 33 mapas Super Rod e os seus grupos, mais a dupla Good Rod e o Pokémon fixo da Old Rod |
| Despacho de utilização de itens | 83 entradas e 30 handlers distintos, todos com ponteiro de banco validado |

Os handler pointers indicam onde o motor salta ao usar um item; **não garantem que todas as decisões e efeitos dentro desses 30 handlers tenham sido reproduzidos**. A taxa de pesca apresentada refere-se apenas a uma **tentativa elegível**, e não à probabilidade de pescar em qualquer posição do mapa. A Old Rod utiliza o valor imediato do código de execução da ROM, verificado nas três versões.

## Diferenças de versão comprovadas

- O primeiro registo de troca em Red/Blue: Pokémon interno 167 em troca do 168, alcunha `TERRY`.
- O primeiro registo de troca em Green International: Pokémon interno 1 em troca do 2, alcunha `RODIN`.
- Na Route 2 Trade House (mapa canónico 48), a alcunha extraída do índice de troca é `MARCEL` em Red/Blue e `VICTOR` em Green. A localização é **referência canónica**, não prova de que a Green modificada mantém o script do NPC.
- O primeiro prémio do Game Corner custa **180 moedas (Red)**, **120 (Blue)** ou **150 (Green)**; os níveis também diferem e são lidos da ROM.
- Os custos de TMs, as lojas e a tabela de despacho dos 83 itens coincidem nos três ficheiros auditados, conforme os bytes e as estruturas verificadas.

## Testes, proveniência e limites

- **10/10 testes Node.js locais aprovados, 0 ignorados**, com Red lida do ZIP em memória e Blue/Green lidas dos ficheiros de 1 MiB; a comparação inclui corrupção deliberada para impedir falsos perfis.
- Execução isolada dos métodos **efetivamente publicados** `enrichKnownEconomyProfile` e `staticServicesForMap` em V8: três versões corretas, CRC incorreto rejeitado e perfil de leitura direta preservado. Essa execução isolada não é uma suite completa Node nem prova de emulador.
- Foram adicionados testes de integração para importação e mapa ao repositório. **A suite integral do repositório não foi executada neste contexto**; os testes integrados com dependências reais e o frontend em execução continuam por validar.
- Não houve screenshots do Companion nem leitura da RAM do emulador nesta sessão.
- O jogo em execução é identificado inicialmente através de CRC32 no RetroArch; o catálogo derivado conserva o SHA-256 da **ROM local que originou os dados**, o que **não prova criptograficamente** o SHA-256 do cartucho carregado no iPhone.
- Os restantes impedimentos para a meta de 100% continuam a incluir: descodificação de todos os branches/handlers, estados de scripts e flags, todos os efeitos dos 165 ataques, collision/tileset, regras especiais e RNG em execução, snapshots RAM e verificação end-to-end.

**Fontes primárias:** `pret/pokered` `data/items/{marts,prices,tm_prices,vending_prices}.asm`, `data/events/{trades,prizes,prize_mon_levels}.asm`, `data/wild/{good_rod,super_rod}.asm`, `engine/items/item_effects.asm`; bytes reais das 3 ROMs SHA-256 auditadas. Nenhuma ROM original, save, sessão ou token foi alterado ou publicado.