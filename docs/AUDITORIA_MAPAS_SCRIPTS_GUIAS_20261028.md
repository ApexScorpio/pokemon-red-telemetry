# PokéGuide — Execução conjunta: mapas, scripts e guia utilizável das 3 ROMs

**Data:** 28 de outubro de 2026. **Origem:** ficheiros locais fornecidos pelo utilizador, com SHA-256 completo validado. **Estado:** avanço comprovado da descodificação estática. **Não é certificação de 100% dos scripts, das mecânicas nem da RAM do emulador.**

## Desenvolvimento publicado

- `romMapCodeAtlas.js`: interpreta instruções candidatas LR35902 e caminhos de controlo conservadores a partir dos ponteiros `mapScriptPointer` dos mapas com cabeçalho normal. Segue chamadas/saltos apenas quando o banco pode ser identificado sem especulação; regista transferências indiretas e saltos para banco desconhecido.
- `romAreaGuide.js`: ficha estática por mapa derivada das tabelas **da ROM identificada**, incluindo warps, placas, NPCs, treinadores, itens visíveis, itens ocultos quando auditados, Pokémon fixos e encontros por espécie/nível. Nenhum estado de item recolhido ou vitória é presumido sem RAM.
- `romComprehensiveAudit.js`: integra agora **os 248 guias de mapa por variante**, os ponteiros para scripts/textos, o grafo de código candidato e o inventário completo dos 64 bancos numa execução conjunta.
- `retroarchClient.js`: disponibiliza `romStaticMapGuide` apenas depois de confirmar o mapa RAM em duas leituras. Quando a segunda leitura contradiz a primeira, invalida o guia anterior.
- `public/app.js`: apresenta na secção da área as saídas, coordenadas das placas e contagens de NPCs/objetos com avisos sobre condições ainda não interpretadas.
- `tests/romMapCodeAtlas.test.js`, `tests/romAreaGuide.test.js`, `tests/romComprehensiveAudit.test.js`: testes unitários e integração condicional com ROMs Red/Blue/Green; aceitam a Red **diretamente dentro do ZIP**, sem a extrair.

## Resultados locais diretos sobre as três ROMs

| Indicador, por versão | Red | Blue | Green International v1.2.1 |
|---|---:|---:|---:|
| Tamanho ROM validado | 1 048 576 | 1 048 576 | 1 048 576 |
| Bancos de 16 KiB examinados | 64 | 64 | 64 |
| IDs de mapa catalogados | 248 | 248 | 248 |
| Cabeçalhos normais de mapa validados | 226 | 226 | 226 |
| Entradas de scripts de mapa | 226 | 226 | 226 |
| Ponteiros de scripts únicos | 223 | 223 | 223 |
| Referências a textos de mapa | 1 126 | 1 126 | 1 126 |
| Ponteiros de texto inválidos após corrigir os bits de objetos | 0 | 0 | 0 |
| Instruções **candidatas** no grafo de scripts | 2 821 | 2 821 | 2 821 |
| Bytes abrangidos por essas instruções candidatas | 6 331 | 6 331 | 6 331 |
| Transferências sem resolução estática | 7 | 7 | 7 |
| Cabeçalhos de mapa não normais/não validados | 22 | 22 | 22 |

A maioria do binário permanece **sem descodificação semântica exaustiva comprovada**. Os números de instruções candidatas **não** provam todos os ramos de execução: o jogo usa transferências indiretas, código executado em bancos comutáveis, handlers e efeitos dependentes do estado e do hardware.

**Correção importante:** nos objetos do mapa, os bits `0x40` e `0x80` do byte de texto marcam metadados de treinador ou Pokémon fixo. A referência real ao índice de texto usa os 6 bits inferiores. Sem a máscara, a leitura inventava referências para além da tabela. Com a máscara comprovada pelos dados dos três binários, a contagem passou para **1 126 referências, 0 inválidas por versão**.

**Testes da nova fase:** `node --test` local com os novos ficheiros, **15/15 aprovados sem skips**, incluindo seis casos diretos com os três binários SHA-256 verificados. O teste integrado local usou um adaptador conservador do atlas ROM previamente validado; **não substitui executar os módulos completos do repositório**. Não foram executados GitHub Actions, nem testes de iPhone/SameBoy/RetroArch ou screenshots da interface ao vivo.

## Ficheiros auxiliares gerados localmente

- `pokeguide-atlas-v4-tres-roms.json`: cobertura por banco, catálogo estático, 744 guias de mapa, referências de scripts/textos e diferenças entre três ROMs;
- `pokeguide-mapas-3-roms.csv`: 744 registos (248 por versão) com objetos, saídas, taxa de encontros e distribuição condicional por espécie/nível;
- `pokeguide-mapas-sem-cabecalho.csv`: 66 registos (22 por ROM) sem cabeçalho normal comprovado;
- `pokeguide-branches-indiretas.csv`: 21 referências (7 por ROM) sem destino estático seguro.

Os ficheiros de auditoria **não** incluem os bytes originais dos jogos ou saves. O código não modifica ROMs, ficheiros de partida nem perfis de aplicações do utilizador.

## O que ainda impede 100%

1. Fluxo de controlo bancado e handlers/rotinas não alcançados pelos 226 ponteiros iniciais; decomposição dos 64 bancos por código, dados, texto, mapas e gráficos com prova semântica.
2. Todos os efeitos de movimentos, itens, pesca, Safari, presentes, trocas, lojas, scripts e exceções específicas das variantes, incluindo Green modificada.
3. Interpretação de **todos** os scripts de eventos, condições, flags e consequências, com testes diferenciais de execução.
4. Estados atuais do jogador: identidade SHA do binário efetivamente executado, snapshot coerente/atómico da RAM, RNG, menu, inventário, equipa e batalhas.
5. Suite integral real do projeto, comparação com emulador e validação visual da interface.

**Proibição de alegações falsas:** 100% dos bytes **lidos** não equivale a 100% das regras **entendidas** nem 100% do jogo **acompanhado em direto**.

## Adenda — matrizes completas de blocos dos mapas normais

Para os três binários SHA-256 confirmados, foi possível reconstruir e conferir, sem modificar o jogo, a sequência de IDs de metabloco dos **226 mapas normais por versão**. São **23 783 bytes de blocos por ROM**, com dimensões verificadas pelos cabeçalhos de cada mapa, totalizando **71 349 bytes de metabloco nos três ficheiros**. Cada matriz da ficha do mapa inclui a sua própria SHA-256; se os bytes não coincidirem com a dimensão e o hash, `layout.blockGrid.verified=false` e a interface não deve apresentar a matriz como válida.

Importante: a matriz dos IDs dos metabloco **não é ainda o mapa gráfico final**, nem prova a colisão dos tiles, eventos no terreno ou paletas do SameBoy. O atlas de trabalho local da fase contém os IDs completos, sem incluir ROMs originais nem saves. O código `romAreaGuide.js` exporta `layout.blockGrid` para os perfis onde a tabela de blocos se encontra comprovada; `romComprehensiveAudit.js` preserva esses blocos no catálogo offline, por versão.

Teste adicional de integridade e rejeição de hash adulterado: aprovado. Total da nova bateria de módulos de mapas/scripts/guia: **16 testes Node aprovados, sem skips**, com os três ficheiros originais, incluindo Red diretamente dentro do ZIP. Os testes do servidor ativo, iPhone e emulador continuam por executar.
