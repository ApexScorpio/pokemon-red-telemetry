# Histórico de elaboração do Guia-Mestre Pokémon Red, Blue e Green

> Histórico cumulativo: entradas apenas acrescentadas. Não apagar ou alterar entradas anteriores.

## 2026-10-27 — Criação inicial

- 1. Recolhidas as regras do jogador: Red, Blue e Green em paralelo; Yellow só depois; tracking a cada decisão; optimização da equipa e PC; verificar golpes/evoluções, NPCs úteis, itens, Daycare, MissingNo e caminhos sem retorno.
- 2. Consultada a telemetria pública do GitHub: README datado de **2026-10-16 21:59:33**, logo desatualizado face à data atual; detetados dados de PC inconsistentes e campos impossíveis para o jogo clássico. URL alternativa trycloudflare indisponível no momento da consulta. Nenhuma posição ou equipa atual foi assumida.
- 3. Verificada a Geração I em Bulbapedia e fontes adicionais: Twineedle de Beedrill no nível 20, efeito defeituoso de Focus Energy, evolução e substituição automática de golpes no Daycare, necessidade de trocas entre versões e riscos do MissingNo.
- 4. Criado `docs/GUIA_MESTRE_CAMPANHA_GEN1_PTPT.md` com regras de validação, jogo, calendário Red/Blue/Green, proteção de pontos de não retorno e padrão de respostas concisas.
- 5. Publicado o guia no commit `9050bcd5748b166a736c73e36df36a3ba3b30a9c`; sem alterações a ficheiros de código, saves, credenciais, sessões, C: ou telemetria.
- 6. Verificada a existência do guia no repositório após a publicação.

## Pendências identificadas

- Validar a telemetria realmente em tempo real, porque o README público consultado não corresponde ao estado atual.
- Validar experimentalmente a compatibilidade do Pokémon Green International modificado com Red/Blue ocidentais, usando apenas cópias seguras dos saves.
- Integrar na aplicação, em tarefa separada, os alertas automáticos de movimentos/evoluções e controlo do Daycare; o guia documenta o comportamento, mas não implementa funcionalidades no programa.


## 2026-10-27 — Auditoria da autenticidade da leitura da ROM/RAM

- 1. Revistos os módulos retroarchClient.js, server.js, githubSync.js, pokemonData.js e public/app.js do repositório existente.
- 2. Confirmado que a leitura usa pedidos reais READ_CORE_MEMORY, mas apenas em endereços selecionados; ler 100% da ROM bancária não é possível com as leituras existentes.
- 3. Corrigido o tamanho dos blocos UDP de 1024 para 160 bytes, com validação do número e formato dos bytes e recusa de respostas truncadas/erro.
- 4. Corrigida a declaração ONLINE prematura; todos os 5 blocos principais passam a ser obrigatórios para a validação base.
- 5. Removido o texto fictício de ROM validada; acrescentada tentativa de validação apenas do cabeçalho da ROM, sem alegar verificação da ROM inteira.
- 6. Corrigida a exportação Markdown/GitHub para sinalizar telemetria antiga, parcial ou simulada; a sincronização recusa tais estados.
- 7. Corrigida a separação entre simulação de batalha e jogo real e evitada a persistência de simulações.
- 8. Corrigidos os tipos Fairy da Gen I e a atribuição fictícia de 40 de poder e 100% de precisão a golpes não identificados.
- 9. Identificadas tabelas estáticas de encontros e texto parcial do ecrã com proveniência explícita; não os declarar leitura de diálogos NPC.
- 10. Documentado que a contagem de Pokémon só inclui a equipa e a caixa PC selecionada, não todas as caixas.
- 11. Criado um auditor de ficheiro ROM autónomo, de leitura integral e apenas local, com SHA-256 e checksums, ainda sem execução sobre a ROM real do jogador.
- 12. Criado docs/AUDITORIA_ROM_RAM_TELEMETRIA.md com limites técnicos e testes de aceitação pendentes.
- 13. Foram executados 5 testes isolados da lógica dos blocos UDP, mas NÃO testes de integração com RetroArch/SameBoy ao vivo.
- 14. Verificada a presença das alterações nos ficheiros GitHub. Não foram tocados saves, ROMs, sessões de autenticação, TIMI, Maestro ou outros processos, nem criados novos ficheiros na unidade C: por esta sessão.

**Estado:** corrigidas fontes concretas de dados falsos; a recolha de 100% dos bancos ROM e a validação integral com o iPhone continuam por concluir.

## 2026-10-27 — Segunda auditoria: IDs, eventos, catálogo de Kanto e Daycare

- 1. Encontrado erro crítico de geração dos índices de eventos: valores decimais de `const_skip` no código `pret/pokered` eram anteriormente interpretados como hexadecimais, corrompendo **186 dos 507** identificadores. Corrigido `data/exact_events.json`.
- 2. Rocket da casa roubada em Cerulean: flag **167**, não 173; Misty: **191**, não 203. Substituídas **110 referências numéricas** em `data/areaData.js` por constantes oficiais nomeadas. A página deixa de depender de números escritos à mão para essas flags.
- 3. Registados os **320 bytes de wEventFlags ($D747)** e os **507 estados de eventos nomeados**, indicando que as etiquetas só estão plenamente certificadas quando a ROM carregada for identificada.
- 4. Corrigida a tipagem de **15 golpes**: `Psychic_type` passou a `Psychic`. Revistos os 165 golpes contra `pret/pokered/data/moves/moves.asm`, incluindo efeitos, poder, precisão e PP.
- 5. Enriquecido `data/gen1CanonicalSpecies.json` com **151/151 fichas** obtidas da fonte oficial e grupos de crescimento de cada espécie. Construídos `gen1CanonicalLearnsets.json` (151 espécies) e `gen1CanonicalWildEncounters.json` (59 tabelas; 10 slots por grupo com pesos exatos sobre 256).
- 6. Acrescentadas as **248 entradas de mapas** e as **9 trocas NPC efetivamente utilizáveis**, associadas aos IDs corretos dos mapas. Na Route 11, a troca oficial é Nidorino por Nidorina, não Drowzee por Farfetch'd. O radar usa agora a tabela oficial.
- 7. Corrigidos o offset inicial dos Pokémon no PC ($DA96, não $DA95) e os offsets do tempo ($DA41/$DA43/$DA44); incluídos 50 slots de itens no PC e nicknames/OT da caixa atual, com validação de IDs.
- 8. Criado `pokemon-ai-companion/saveAudit.js` para **ler as 12 caixas, equipa de caixas, itens e Pokédex de um ficheiro .sav local**, sem o modificar. O .sav é um instantâneo do último save, **não** a memória em direto. Teste sintético: 12 caixas verificadas, Abra reconhecido, itens mochila/PC reconhecidos, contagem impossível rejeitada.
- 9. O Daycare passou a calcular nível a partir de EXP da RAM e crescimento canónico, e a emitir aviso **dois níveis antes** de um golpe/evolução; adicionado cartão visual ao dashboard iPhone/PC com indicação de leitura válida ou offline.
- 10. Detetado e corrigido erro gravíssimo: texto literal `\\n` em comentário fazia com que a declaração `CHUNK_SIZE=160` também ficasse comentada e provocasse erro de execução. Testada a leitura isolada de 530 bytes em quatro pacotes de 160/160/160/50, com repetição limitada e rejeição de dados inválidos.
- 11. Alterado o fingerprint de sincronização GitHub para refletir níveis, equipa, golpes, caixas do PC, Daycare, itens, Pokédex, badges e eventos mesmo com o jogador parado.
- 12. Removida a inferência falsa de "item da rota recolhido" baseada na simples posse de uma cópia igual; dados de itens com flag não calibrada ficam explicitamente marcados como tal.
- 13. O conselheiro da IA passou a receber progresso de eventos e a rejeitar estados RAM antigos. Probabilidades de captura deixam de inventar uma taxa por defeito e estimativas de dano ignoram efeitos especiais ainda não modelados.
- 14. Acrescentada validação semântica: não aceitar contagens impossíveis de equipa/caixa, espécie inconsistente entre lista e ficha PC, ou flag Daycare fora do intervalo.
- 15. A sintaxe dos módulos JS modificados foi verificada. Teste de UI simulado: Daycare com Abra no nível 14 gera alerta, e situação offline mostra aviso de dados antigos; **não** equivale a inspeção visual no iPhone.
- 16. `verifyGen1Ids.js` passou a verificar 151 IDs, 165 golpes, 95 IDs de itens, 39 índices MissingNo, 18 endereços fundamentais, 507 eventos, 151 crescimento/learnsets, 59 tabelas de encontros, 248 mapas e 9 trocas.
- 17. **Sem acesso remoto ao RetroArch/SameBoy e sem o save do jogador**, não foi executada validação ponta a ponta e **não há certificação de 100% do que o jogador possui em tempo real**. Faltam teste do painel real, confirmação da ROM por hash e integração regular do save completo para as 12 caixas.
- 18. Nenhum processo, ROM, save, credencial, sessão Antigravity/TIMI/MAESTRO/BonChat ou ficheiro da unidade C: do utilizador foi alterado.

**Resultado desta fase:** correções e dados canónicos publicados no GitHub; testes locais/mocados passaram nos casos descritos. Permanecem explicitamente em aberto a validação no iPhone e a sincronização automática das 12 caixas.

## 2026-10-27 — Continuação: verificação cruzada do guia e das tabelas canónicas

- 1. Reconfirmado no GitHub que o leitor de RAM já contém as correções de HM de campo: possuir HM01/HM03 não equivale a ter um Pokémon capaz de usar Cut/Surf.
- 2. Reconfirmado que possuir Great Ball, TM ou outro item igual na mochila ou PC NÃO prova que uma Poké Ball concreta do mapa foi recolhida. Os campos de recolha baseiam-se em flags e o README assinala que a interpretação dos bits exige validação.
- 3. Auditados de novo os seis recursos canónicos de dados: **151/151 espécies**, **151/151 learnsets e evoluções**, **59/59 tabelas de encontros**, **248 mapas**, **9 trocas NPC utilizáveis** e mapeamento entre IDs internos e Dex. Cruzados por ID, mapa, espécies, pesos de encontro e métodos de evolução: **zero inconsistências nesses cruzamentos estáticos**.
- 4. Revisto o caso Abra/Kadabra: Abra #63 evolui a 16; Kadabra #64 tem Confusion a 16, e o tracking deve antecipar o levantamento da creche quando faltarem 2 níveis. A RAM fornece EXP; o nível da ficha depositada não é o nível atual adquirido por passos.
- 5. Estado de aceitação ainda pendente: não foi executado teste de integração contra RetroArch/SameBoy real no iPhone; não foi verificado um hash do ficheiro ROM do jogador; outras caixas de PC em SRAM ainda não são lidas. Não declarar conhecimento 100% do save.
- 6. Nenhuma alteração a ROM, save, C:, credenciais ou processos. Histórico atualizado exclusivamente por acréscimo.



## 2026-10-27 — Início da descodificação integral ROM, ponteiros e motor

- 1. Verificadas fontes primárias pret/pokered (MonsterNames, PokedexOrder, BaseStats, GrowthRateTable, scripts de eventos) e a especificação Pan Docs de mapeamento/bancos de memória.
- 2. Confirmados no ficheiro pokered.sym desta compilação os símbolos: MonsterNames 07:421E, PokedexOrder 10:5024, BaseStats 0E:43DE, GrowthRateTable 16:501D, EvosMovesPointerTable 0E:705C e MapHeaderPointers 00:01AE. Estes endereços NÃO foram assumidos válidos para a ROM do utilizador.
- 3. Criado romAtlas.js: leitura completa dos bytes de ROM local, hashes por banco, verificação de cobertura, endereços banco/CPU, charmap dos nomes, IDs internos, Pokédex, atributos e ponteiros gráficos sem descodificação fictícia.
- 4. Adicionada proteção contra aplicação de .sym a uma ROM sem SHA-256 de referência coincidente, e aviso de que o hash fornecido ainda não valida por si só a origem da .sym.
- 5. Acrescentada extração de coeficientes de crescimento reais de GrowthRateTable quando a ROM e símbolos são compatíveis.
- 6. Criado gen1EngineMath.js: funções puras de EXP, atributos Gen I, HP DV e eventos; rejeitam entradas RAM/ROM em falta.
- 7. Criado tests/romAtlas.test.js com cenários sintéticos: varrimento completo dos bancos, bloqueio de símbolos não validados, descodificação ID/nome/n.º Pokédex/atributos, cálculos XP/HP e flags.
- 8. Criado docs/PLANO_DECODIFICACAO_ROM_INTEGRAL.md com roadmap e separação entre ROM, RAM, scripts, VRAM, imagem SameBoy e interpretação semântica.
- 9. Nenhuma ROM foi descarregada, copiada, modificada ou publicada; o servidor do Pokémon Companion, saves e sessão Antigravity não foram alterados nesta fase.
- 10. A ROM real do SameBoy não foi disponibilizada. **Não declarar 100% de elementos descodificados ou que os testes sintéticos substituem validação com a ROM real.**


## 2026-10-27 — Alargamento do atlas ROM a ataques e evoluções

- 1. Consultada a desmontagem pret/pokered para confirmar formato binário de EvosMovesPointerTable, MoveNames e constantes EVOLVE_LEVEL=1, EVOLVE_ITEM=2, EVOLVE_TRADE=3; sem adaptar dados de FireRed nem de gerações posteriores.
- 2. Adicionado em romAtlas.js o descodificador de 190 ponteiros de evolução/learnsets; valida terminadores, endereços do banco, limites e IDs; não inventa eventos quando os dados são inválidos.
- 3. Adicionada leitura de 165 nomes de golpes a partir de MoveNames, com charmap parcial e valores nulos para caracteres não identificados.
- 4. Alargado tests/romAtlas.test.js com testes sintéticos de evolução e ataques por nível.
- 5. Atualizado docs/PLANO_DECODIFICACAO_ROM_INTEGRAL.md com o alcance técnico desta segunda fase.
- 6. Confirmada a presença dos novos ficheiros no GitHub. Os testes ainda exigem execução Node e a ROM do jogador não esteve acessível nesta sessão.
- 7. Confirmado na documentação do SameBoy que as cores finais também podem depender do firmware/modelo emulado e da correção de cor, não só da ROM.
- 8. Não se efetuaram alterações ao servidor em execução, sessões, tokens, saves, ficheiros da ROM ou ficheiros em C:.

Pendência que bloqueia a certificação: obter acesso ao binário exato .gb/.gbc que o SameBoy carrega no iPhone e validar SHA-256 e proveniência dos símbolos para essa versão. 100% de bytes examinados não constitui 100% dos elementos descodificados.


## 2026-10-27 — ROM Green International v1.2.1 fornecida; perfil por versão em tempo real

- 1. Analisado o ficheiro ROM enviado pelo utilizador exclusivamente em ambiente de análise local, sem publicar ou alterar o binário. 1 048 576 bytes, 64 bancos, header POKEMON GREEN, checksums válidos, CRC32 3C2DD8AE, SHA256 aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db.
- 2. Confirmado por bytes reais que PokedexOrder está no offset 0x41956, NÃO 0x41024 como indica a .sym original. Confirmadas também as outras cinco tabelas e a descodificação de 190 IDs, 165 nomes de golpes, listas de evolução/ataques.
- 3. Implementado romVariantRegistry.js para procurar e validar tabelas por padrões, inspecionar bancos completos, devolver os bytes transformados em dados verificáveis e hash.
- 4. Implementado romLiveResolver.js que regista ficheiros em POKEMON_ROM_PATH/POKEMON_ROM_DIR ou metadados em POKEMON_ROM_PROFILE_PATH; compara GET_STATUS/CRC32 da ROM em execução e só então aplica o perfil respetivo.
- 5. Atualizado retroarchClient.js para GET_STATUS, seleção de ROMs quando se muda de jogo, atribuição de nomes/atributos base por ROM, identificação de proveniência e cálculo de EXP com coeficientes extraídos do jogo; taxas adicionais permanecem explicitamente classificadas como referências.
- 6. Atualizado githubSync.js para nome da ROM e correspondência CRC32 no relatório vivo; o URL permanece o mesmo.
- 7. Corrigido charmap do módulo romAtlas.js: letras maiúsculas e minúsculas estavam invertidas e o símbolo de género era incorreto; corrigidos também os fixtures correspondentes.
- 8. Gerado e validado um perfil JSON separado para o Green enviado, sem o binário original. Mantido fora do GitHub e disponível ao utilizador na resposta da conversa.
- 9. Adicionados testes Node para CRC32, recusa de identificação pela aparência e inspeção de um ficheiro de ROM real, e documentada a ativação das fontes local/ficheiro/pasta.
- 10. Realizados testes efetivos na ROM fornecida com ferramenta Node local equivalente: identificados nomes, IDs, 190 entradas, 165 golpes, todas as seis tabelas e espécies/learnsets específicos. NÃO foi efetuado teste end-to-end com o SameBoy ligado ao iPhone, nem foi declarada compatibilidade com qualquer hack arbitrário.
- 11. Nenhum save, binário ROM, token, sessão Antigravity ou ficheiro no disco C foi alterado no PC do utilizador.

**Limites ainda explícitos:** reconhecimento automático sujeito ao esquema Gen I; outras versões com layouts radicalmente diferentes necessitam de descodificadores novos. Sprites originais, scripts completos, múltiplas caixas e RAM variável ainda aguardam validação.


## 2026-10-27 — Análise dos ficheiros reais Pokémon Red e Pokémon Blue

- 1. Recebidos do jogador os ficheiros Pokemon Red.gb e Pokemon Blue.gb; analisados diretamente em sandbox, sem alterar, publicar ou copiar os binários para o GitHub.
- 2. Checksums de cabeçalho e checksums globais válidos para ambos; 1 048 576 bytes e 64 bancos de 16 KiB por ficheiro.
- 3. Hashes calculados: Red CRC32 9F7FDD53 / SHA256 5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b; Blue CRC32 D6DA8A1A / SHA256 2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d.
- 4. Descobertas e verificadas por estrutura seis tabelas ROM para cada ficheiro: MonsterNames 0x1C21E, PokedexOrder 0x41024, BaseStats 0x383DE, GrowthRateTable 0x5901D, EvosMovesPointerTable 0x3B05C, MoveNames 0xB0000. A Green International usa 0x41956 para PokedexOrder, demonstrando a necessidade de perfis distintos.
- 5. Obtidos perfis JSON Red e Blue com 190 IDs internos, 165 nomes de golpes, atributos, evoluções, learnsets e crescimento; comparados com o perfil Green analisado anteriormente.
- 6. Criado um pacote ZIP para o jogador com os três perfis JSON (sem os binários ROM) e instruções de instalação no disco S:.
- 7. Expandido romLiveResolver.js para ler simultaneamente JSONs de POKEMON_ROM_PROFILE_DIR e revalidar CRC32 reportado por GET_STATUS. Corrigido o filtro da extensão .json.
- 8. Atualizado retroarchClient.js para reaprender novos perfis quando se muda de jogo, mesmo que estejam numa pasta de metadados, sem reiniciar o programa para cada troca de ROM.
- 9. Criado tests/romThreeVersions.test.js e docs/ROMS_RED_BLUE_GREEN_PERFIS.md com validação de hash, localizações distintas de PokedexOrder e instruções.
- 10. Não foi possível executar um teste end-to-end no RetroArch/iPhone a partir deste ambiente. Os perfis foram testados com os bytes recebidos; o reconhecimento via rede necessita de prova no equipamento real.
- 11. Não foram alterados saves, sessões Antigravity, chaves, nem ficheiros do projeto original no C:.


## 2026-10-27 — ROMs Red/Blue/Green: mapas, encontros, objetos e sprites originais (v3)

- 1. Analisados os três ficheiros binários reais recebidos nesta conversa, sem publicar os ficheiros de jogo no GitHub.
- 2. Encontrada por assinatura e validação a tabela WildDataPointers em 0xCEEB, com 248 índices de mapa, 59 referências de dados distintas, 57 mapas com encontros; extraídas taxas, níveis e IDs internos reais de cada versão.
- 3. Verificadas as tabelas MapHeaderPointers 0x1AE e MapHeaderBanks 0xC23D; 226 cabeçalhos de mapa válidos em cada ROM, 23 783 bytes de blocos de mapas, warps, placas e objetos como definidos no ficheiro.
- 4. Comparadas as diferenças reais da Route 5: Red inclui Oddish/Mankey, Blue inclui Bellsprout/Meowth, Green International inclui Oddish/Meowth nos primeiros slots.
- 5. Descoberta de bancos de sprites por dupla assinatura (frente 0x55/0x66/0x77 e costas 0x44), obtendo 150 correspondências únicas em cada ROM. Na Green existem 10 diferenças de banco face a Red/Blue.
- 6. Implementado decompressor de imagens comprimidas da Geração I conforme pret/pokered/home/uncompress.asm, incluindo RLE, differential decode, XOR e exportação PNG usando Node nativo; sem imagens externas, para a versão com perfil correspondente.
- 7. Confirmados testes locais em Python e Node com 900 descodificações (150 frontais + 150 traseiras por ROM), sem erros de stream ou dimensão, com verificações de variações dos pixels e resultados visualmente reconhecíveis.
- 8. Atualizado romVariantRegistry.js para incluir os dados de mundo e sprites por versão, romLiveResolver.js para expor sprites de perfil confirmado, e retroarchClient.js para enviar os dados do mapa/encounters e as imagens originais para a equipa e combate.
- 9. Construído pacote v3 com os três perfis JSON ampliados: 900 imagens PNG em base64, mapas, encontros e os restantes metadados. Nenhum binário ROM é incluído; ficheiro ZIP no sandbox do ChatGPT.
- 10. Criados tests/romWorldData.test.js e tests/romSpriteDecoder.test.js, que são reproduzíveis com ROMs locais no PC. Não se executou integração remota no iPhone / RetroArch; continuam por validar aí a seleção de ROM, RAM e aparência das paletas.
- 11. As imagens são quatro tons Gen I; coloração exata do SameBoy, gráficos de NPCs/tilesets, scripts integrais de eventos e todas as mecânicas continuam sem certificação.
- 12. Foi preservada a regra append-only deste histórico; nenhum save, credencial, sessão do utilizador ou unidade C: foi tocado nesta fase.

**Estado do requisito de integridade:** 100% dos bytes dos três ficheiros ROM já foi examinado; 100% dos elementos e cálculos NÃO está ainda descodificado. A telemetria vivo ainda tem de ser testada com o emulador.


## 2026-10-27 — Arranque automático e melhorias ROM v4

- 1. Implementado `romAutoDiscovery.js`: procura automaticamente ROMs, JSONs e o ZIP v3/v4 em Downloads, pastas do projeto e pastas comuns no disco S: do Windows, sem tocar em saves nem exigir variáveis de ambiente.
- 2. Implementada leitura segura do ZIP em memória, com limites de tamanho, cabeçalhos e CRC32; ficheiros nunca são extraídos ou alterados pelo Companion.
- 3. Alterado `romLiveResolver.js` para importar vários perfis automaticamente, preferir os mais completos e dar prioridade aos bits TM/HM da v4. O perfil ativo continua a depender do CRC32 da ROM realmente reportada no RetroArch.
- 4. Alterado `retroarchClient.js` para anunciar a descoberta no estado da telemetria, tentar novamente de 30 em 30 segundos quando falta um perfil e expor os novos alertas de golpes/evoluções.
- 5. Criado `romProgressAdvisor.js`: Beedrill/Twineedle dois níveis antes, Abra/Daycare antes do 16, evoluções por pedra/troca com parâmetros corretos extraídos dos dados RGB. Executados 6 testes isolados de lógica no motor JavaScript, passaram.
- 6. Daycare deixou de atribuir níveis ou marcos por curva de referência de outra ROM: usa o perfil CRC32 correspondente ou indica que não há curva comprovada.
- 7. Acrescentada leitura real das máscaras de 7 bytes de 50 TMs + 5 HMs por espécie em `romVariantRegistry.js`, `romLiveResolver.js` e telemetria da equipa. Bulbasaur verificado com `a40338c0030806` nos três binários.
- 8. Criado ZIP v4 com os três perfis analisados, 900 sprites PNG, mapas, encontros e máscaras TM/HM (150 espécies por jogo); verificada a integridade do ZIP e os CRC32/sha declarados dos perfis. Este ZIP foi entregue como anexo na conversa, não enviado para GitHub.
- 9. Dashboard atualizado com estado visível da ROM reconhecida/não identificada e painel de próximos golpes/evoluções, incluindo rótulos de proveniência e incerteza.
- 10. Corrigidos o supervisor `start.js` e o endpoint `/api/update` para não descartarem alterações locais automaticamente: só aceitam fast-forward quando o código versionado está limpo.
- 11. Adicionados `tests/romAutoDiscovery.test.js`, `tests/romProgressAdvisor.test.js`, `npm test` e documentação `docs/AUTO_ROM_V4_STARTUP.md`.
- 12. Verificados os ficheiros alterados no GitHub e a sintaxe dos módulos principais; NÃO houve teste de integração remota com o iPhone nem instalação direta dos perfis na máquina do utilizador. Se a ROM ou um perfil não estiver acessível ao PC, o Companion indica falta de correspondência.
- 13. Não foram alterados os binários ROM, saves, tokens, processos do utilizador ou unidades externas. O historial continua append-only.

**Estado:** arranque de descoberta automatizado e testes de lógica concluídos; a aceitação final exige abrir o Companion no PC e verificar `/api/state` e os CRC32 enquanto se alternam Red, Blue e Green no SameBoy.


## 2026-10-27 — Corrigir a prioridade: estado verdadeiro da zona antes de aperfeiçoamentos gráficos

- 1. Reconhecido o erro de prioridade: tinham sido implementados extração ROM e sprites, mas não a ligação completa entre cada treinador/item, seu script ROM e flags atuais da RAM.
- 2. Criado `romAreaEvidence.js`: mapa e objetos específicos da ROM reconhecida (CRC32), IDs de item, classe/número de treinador e coordenadas; tenta relacionar só sprites RAM compatíveis em tipo/pictureId/coordenada. Um sprite ausente nunca implica recolha/derrota.
- 3. Integrado o novo objeto `romAreaEvidence` no estado publicado pelo `retroarchClient.js`; sem perfil correspondente ou RAM validada não fabrica estados.
- 4. Corrigido `retroarchClient.js` para não definir `isCollected=false` sem um índice de flag existente; valor agora `null` (desconhecido), mantendo rótulos de proveniência e ressalvando que a associação dos índices da base manual à ROM não está ainda certificada.
- 5. Corrigido radar Itemfinder para considerar apenas itens cujo bit sugere não recolhido e cujo índice é conhecido, sem identificar todos os outros como pendentes.
- 6. Corrigido `public/app.js` para não ocultar um item só por existir outro exemplar na mochila/PC e para distinguir três estados: indicação do bit RAM (com associação por verificar), possibilidade de estar pendente e estado totalmente desconhecido.
- 7. Corrigida a listagem dos treinadores de referência para não chamar "vencidos" ou "por vencer" a flags não validadas para esta ROM. As propostas de combate continuam disponíveis como referência tática, mas sem estatuto de prova.
- 8. Acrescentado ao painel um cartão de evidências ROM/RAM por zona, com a lista de objetos e treinadores efetivamente definidos no mapa da ROM e presença observada na RAM quando foi comprovada.
- 9. Criados `tests/romAreaEvidence.test.js` e efetuadas 7 verificações isoladas da função: presença, ausência, identidade ROM, campos de conclusão nulos e classificação por tipo/posição. Sintaxe dos ficheiros alterados verificada no repositório.
- 10. Limite ainda não resolvido: não existe ligação completa entre flags de conclusão e scripts ROM para todos os treinadores, itens ocultos e NPCs. Não é possível afirmar o histórico total das ações antes dessa descodificação, nem foi testado o resultado num SameBoy/iPhone em tempo real.
- 11. As ROMs, saves, credenciais e a sessão local do utilizador não foram alterados. O histórico mantém entradas anteriores sem apagá-las.

**Próxima prioridade:** extrair o mapeamento script ROM → flag RAM de cada objeto e testar diferenças entre Red/Blue/Green antes de atribuir estados recolhido/derrotado definitivos.


## 2026-10-27 — Fase 5: progresso da zona com flags ROM + RAM efetivas

- 1. Inspecionado o estado atual do código no repositório, incluindo retroarchClient.js, romAreaEvidence.js, romWorldData.js, exact_events.json e pokered.sym.
- 2. Confirmadas pela desmontagem original pret/pokered as estruturas D5A6 (32 bytes de flags de objetos removíveis), D5CE (lista local de 34 bytes), D6F0 (14 bytes de flags de itens ocultos) e D747 (320 bytes de eventos).
- 3. Localizada a tabela real HiddenItemCoords nas três ROMs enviadas: Red 0x766B8, Blue 0x766B9 e Green International v1.2.1 0x766BA; comparadas 54 entradas com terminador 0xFF; todas as entradas são equivalentes nos três ficheiros.
- 4. Implementado romEventState.js, com validação de bytes hexadecimais e terminação da lista RAM, leitura de flags de remoção por sprite e bitmap de itens ocultos indexado pelos 54 tripletos ROM.
- 5. Validado por execução isolada que o item oculto Route 4 X40/Y3 é o índice 53 (byte 6, bit 5) e que cada flag deriva da ROM auditada e da RAM, não da mochila; comprovado que ROMs com hash desconhecido são recusadas.
- 6. Atualizado romAreaEvidence.js para anotar flag e remoção dos objetos sem transformar ausência de sprite ou remoção em recolha/vitória.
- 7. Atualizado retroarchClient.js para apresentar itens ocultos obtidos/pendentes, recolher os objetos de item efetivamente definidos na ROM e não usar os toggleIndex manuais como prova de que o jogador apanhou um exemplar específico.
- 8. Neutralizados os campos de resultado das batalhas do catálogo manual até haver associação auditada dos cabeçalhos dos treinadores às event flags da ROM. Não se afirma que o treinador foi vencido ou que a luta expirou apenas porque consta de uma tabela manual.
- 9. Criado romAreaProgress.js com resumos de itens ocultos comprovados, objetos removidos e treinadores de estado ainda desconhecido. Criados testes romEventState.test.js e romAreaProgress.test.js.
- 10. Verificada a sintaxe do cliente RetroArch e dos módulos/testes novos. Executados testes isolados em JavaScript, incluindo a ligação ROM/RAM e a separação entre recolha, remoção e derrota; passaram. Não foi executado teste de ponta a ponta contra o iPhone nesta fase.
- 11. Criado docs/PROGRESSO_ZONA_FLAGS_ROM_RAM_V5.md com o detalhe técnico e limitações pendentes. Não foram editados saves, binários ROM, sessões Antigravity, credenciais ou ficheiros no C: do utilizador.

**Pendente:** descodificar e validar a correspondência entre cada treinador da ROM e a sua flag de derrota, os scripts dos NPCs e os identificadores de cada item oculto. Manter estados desconhecidos até haver prova.


## 2026-10-27 — Extensão fase 5: flags de vitória certificadas em 17 mapas

- 1. Foram inspecionados os cabeçalhos reais de treinador nas três ROMs fornecidas; a estrutura Gen I usa o bit no primeiro byte e o endereço wEventFlags apontado pelo campo word+2. Foram comparados bytes das versões Red, Blue e Green.
- 2. Um scanner local encontrou 37 mapas candidatos com sequência de cabeçalhos única junto ao script do mapa. Destes, **apenas 17 mapas/50 treinadores** apresentaram também correspondência exata com os EVENT_BEAT_* do dicionário pret/pokered e foram admitidos como comprovados. Os 20 mapas restantes foram recusados nesta fase (alguns têm convenções de nomes de scripts diferentes).
- 3. Criado romTrainerEvents.js com os 17 mapas, 50 índices reais de flags de batalha e os SHA-256 das três ROMs auditadas. Nenhuma outra ROM recebe esta atribuição.
- 4. Adicionado à ramificação ROM/RAM do retroarchClient.js o campo romTrainerFlags e integração em romAreaEvidence.js, ligando a ordem dos treinadores definidos na ROM à flag lida em D747 (320 bytes). Só marca defeated true/false quando o número de objetos da ROM, hash da ROM e leitura RAM coincidem.
- 5. Atualizado romAreaProgress.js para somar vitórias e batalhas por vencer apenas onde há prova; mapas desconhecidos conservam estados null, em vez de listas manuais de treinos inferidas.
- 6. Criado tests/romTrainerEvents.test.js, executada prova isolada em JavaScript na Route 6: 6 treinadores, bits 1041-1046, dois bits ativos => 2 vencidos e 4 pendentes. Mapas ou ROMs sem equivalência são recusados.
- 7. Atualizado public/app.js: cartão de provas ROM/RAM apresenta itens ocultos obtidos/pendentes, objetos visíveis marcados removidos/não removidos, batalhas concretamente vencidas/pendentes e contagens desconhecidas. Nomes de itens provenientes do catálogo manual continuam rotulados como não verificados na ROM.
- 8. Revalidada a sintaxe dos sete ficheiros JavaScript envolvidos. Teste de ligação ao iPhone/SameBoy ainda não executado. As versões além das três ROMs auditadas continuam sem garantia.
- 9. Nenhuma ROM, save, sessão, token, serviço ou ficheiro do disco C: foi alterado no equipamento do utilizador.

**Próximos passos pendentes:** identificar cabeçalhos de treinadores nos restantes mapas (incluindo ginásios e áreas especiais); extrair os nomes dos itens ocultos diretamente dos scripts ROM; confirmar os resultados no emulador real.
