# PokéGuide — inventário integral por banco, Red / Blue / Green

**Data:** 2026-10-28. **Estado:** implementação e auditoria estruturada de cobertura parcial; NÃO é um certificado de 100% de mecânicas. **Nenhum ficheiro ROM ou save é publicado.**

## Implementação no repositório

- `romVariantRegistry.inspectRomBuffer(Buffer, nome)` — permite reutilizar todos os leitores do projeto diretamente sobre uma ROM em memória, incluindo o membro `.gb` do ZIP Red, sem extrair para disco.
- `romComprehensiveAudit.js` — pipeline de três variantes num só comando, SHA-256 obrigatório, verificação de cabeçalho, 64 bancos por ROM, SHA de cada banco, inventário de intervalos de bytes compreendidos/estruturados/não classificados, apontadores, perfis de Pokémon, golpes e nomes, tabelas de encontros, mapas, atores, warps, equipas, eventos ocultos, regras de batalha e taxas de captura **apenas quando a prova já está no perfil**. Inclui um catálogo JSON por versão sem copiar ROMs/saves/sprites binários.
- `tests/romComprehensiveAudit.test.js` — testes do balanço de bytes, falsos positivos, comparador byte a byte, SHA-256 das três ROMs e execução integrada condicional aos três caminhos locais. `npm test` executa testes estáticos sem guardar ROMs no GitHub. O teste integrado só é executado quando as três ROMs estão presentes; caso contrário fica `SKIP` explícito.
- `npm run audit:roms -- --red "..." --blue "..." --green "..." --out "D:\\PokeGuide\\Relatorios"` — comando para criar o relatório JSON integral. O diretório de destino tem de existir; o ficheiro nunca é substituído silenciosamente (`wx`). Sem `--out` os resultados resumidos são mostrados no terminal e não se cria ficheiro.

## ROMs analisadas nesta sessão, diretamente em modo leitura

| Variante | SHA-256 | Bytes | Bancos de 16 KiB |
|---|---|---:|---:|
| Red | `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b` | 1 048 576 | 64 |
| Blue | `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d` | 1 048 576 | 64 |
| Green International v1.2.1 | `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db` | 1 048 576 | 64 |

### Diferenças byte a byte entre as ROMs

| Comparação | Bytes diferentes | Bytes iguais | Bancos com diferenças | Intervalos de diferença |
|---|---:|---:|---:|---:|
| Red × Blue | 26 670 | 1 021 906 | 14 | 2 362 |
| Red × Green | 147 468 | 901 108 | 32 | 8 148 |
| Blue × Green | 162 243 | 886 333 | 32 | 9 414 |

### Cobertura com o atlas histórico conservador

Foi executado um teste local com os **três binários originais** e o atlas já produzido anteriormente no projeto (`pokeguide_rom_audit_v2.json`). O adaptador de validação inclui mapas, objetos, encontros, nomes, stats, golpes e regras de tipos. Esta execução local **não é equivalente à execução integrada de todos os leitores `romVariantRegistry`**, que requer a árvore do repositório com as dependências.

Por ROM, o registo de intervalos nesta execução conservadora ficou em:

| Estado do byte | Contagem |
|---|---:|
| Intervalos associados a estruturas descodificadas neste atlas | 24 580 |
| Intervalos associados apenas a estruturas reconhecidas | 22 935 |
| Sem classificação nesta camada de inventário | 1 001 061 |
| Total auditado | **1 048 576** |

**Estes números não são uma taxa de progresso da mecânica do jogo**: um byte que pertence a código executável ou compressão gráfica pode estar parcialmente compreendido noutro módulo e ainda não estar classificado nesta prova de intervalos. O sistema inclui os intervalos *todos*, por banco; a cobertura semântica global permanece **indeterminada**.

Dados de estrutura comprovados nas três ROMs no atlas: 190 IDs internos, 150 fichas BaseStats normais, 165 golpes, 82 regras de eficácia de tipos, 248 IDs de mapa, 226 cabeçalhos normais validados, 334 objetos de treinador humano, 106 objetos de itens no chão e 12 encontros fixos. Estes totais não garantem todas as condições de script/flags.

### Testes que foram realmente executados

- **6/6** testes locais Node aprovados com os três binários reais e o adaptador do atlas histórico. Incluíram o membro da ROM Red dentro do ZIP, sem extração, e a comparação de bancos.
- **4/4** testes portáveis estáticos aprovados para o código a integrar; os 4 testes dependentes das ROMs ficam explicitamente `SKIP` quando os caminhos não são definidos.
- **3/3** verificações SHA-256 locais, usando o ficheiro portátil em modo de seleção de testes.
- Não houve execução integral `npm test` sobre a árvore real do GitHub, nem integração com o SameBoy/iPhone, nem screenshot validada nesta sessão.

### Condições que ainda impedem os 100% pedidos

O JSON da auditoria lista nominalmente os 14 domínios sem certificação: controlo de fluxo CPU, scripts, condições de eventos ocultos, diálogos, paletas, todos os efeitos de golpes, captura/Safari, pesca/trocas/presentes, lojas, colisões/triggers, RAM/SRAM e estado da equipa, coerência temporal da memória, identidade da ROM realmente carregada, e validação ponta a ponta/visual.

**A partir desta entrega, cada próximo trabalho deve reduzir lacunas do inventário completo com offsets e testes**, e nunca ser apresentado como um recurso isolado sem impacto mensurável sobre a cobertura. Não se tratam bytes por «achismo» ou por correspondência apenas do título da ROM.

### Proteções

Só leitura dos ficheiros ROM de entrada; nenhum upload de `.gb`, nenhum save copiado, nenhum ficheiro criado em C: do utilizador, nenhum processo nem sessão do Antigravity alterado, nenhum link simbólico/junction. O pipeline falha perante SHA-256 inesperado, ZIP ambíguo ou suspeito e tentativa de sobrepor relatórios.