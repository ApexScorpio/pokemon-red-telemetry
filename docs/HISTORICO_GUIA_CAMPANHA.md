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


## 2026-10-27 — Fase 6: 312 treinadores associados ao script original e 54 itens ocultos identificados

- 1. Reanalisadas diretamente as três ROMs locais (Red/Blue/Green International 1.2.1) com parser próprio dos bancos, cabeçalhos de mapa e apontadores de texto de NPCs.
- 2. A relação `NPC Object.textId → TextPointer → TEXT_ASM → LD HL, trainerHeader → CALL TalkToTrainer (direto ou salto JR) → evento em wEventFlags` foi reconstruída a partir dos bytes reais. Foi considerado o endereço diferente de TalkToTrainer nas variantes Red/Blue e Green.
- 3. Foram identificados **346 objetos de treinador** por ROM: **312 flags com ligação de código comprovada**, em **67 mapas**, e **34 scripts especiais por resolver**. A mesma lista de 312 triplos `(mapId, objectOrdinal, eventBitIndex)` foi encontrada nas três versões.
- 4. Substituído o atlas de 17 mapas por atlas de 312 entradas em romTrainerEvents.js, condicionado aos SHA-256 das três ROMs auditadas; os perfis v4 anteriores continuam a funcionar automaticamente, sem novo ZIP.
- 5. Adicionado resolvedor direto dos cabeçalhos de batalha em romWorldData.js para ROMs locais compiladas com a mesma estrutura, guardando `trainerEvents` em cada mapa e metadados globais.
- 6. Corrigido erro semântico antigo: algumas flags podem ser ativadas por scripts ao derrotar um líder de ginásio, mesmo sem ter lutado contra todos os NPCs. O programa agora publica `eventFlagSet`/`battleGateClosed`, e **não afirma a vitória histórica individual sem log do combate**. Atualizados romAreaEvidence.js, romAreaProgress.js e a interface.
- 7. Descoberta a tabela HiddenEventMaps/HiddenEventPointers na ROM. Cruzados os 54 tripletos HiddenItemCoords com os seis bytes do evento da coordenada, o banco e o handler da rotina HiddenItems (Red 1D:6688, Blue 1D:6689, Green 1D:668A).
- 8. **54/54 IDs de itens ocultos** obtidos diretamente dos scripts nas três ROMs, com correspondência exata. Exemplos: Viridian Forest Potion e Antidote, Mt Moon B2F Moon Stone e Ether, Route 4 Great Ball ID 3. A RAM D6F0 continua a determinar o estado de recolha.
- 9. Modificados romEventState.js, retroarchClient.js e public/app.js para usar o ID do script e nome resolvido por ID, sem substituí-los por nomes inventados do catálogo manual.
- 10. Adicionados testes de bytecode direto/JR e asserções de contagem de 312 flags/67 mapas/54 IDs e dos casos especiais de Route 24. Executados testes isolados em JavaScript (incluindo bytecode sintético e atlas) e testes de comparação em Python contra as três ROMs.
- 11. Criada a documentação técnica docs/ROM_TREINADORES_ITENS_SCRIPT_V6.md.
- 12. **Não foi feito o teste end-to-end no RetroArch/SameBoy do iPhone.** Não há prova de execução no PC do utilizador nesta sessão. ROMs, saves, credenciais, tokens Antigravity e C: do utilizador não foram alterados.

**Pendente:** os 34 NPCs de treinador com scripts especiais, todos os efeitos de scripts de ginásio, histórico comprovado de batalhas observadas e decodificação universal de outros ROM hacks.


## 2026-10-27 — Leitura automática do verdadeiro ID dos 54 itens ocultos nas ROMs

- 1. Foi auditado o estado atual de `romTrainerEvents.js`: o repositório **já continha** 312 associações entre objetos de treinador e flags, obtidas por navegação entre ponteiros de texto, rotina e cabeçalho ROM; faltam NPCs especiais. Não se confundem flags de combate desativado com prova histórica de vitória individual.
- 2. Consultadas as fontes originais pret/pokered para `HiddenEventMaps`, `HiddenEventPointers`, `hidden_event`, `HiddenItemCoords` e `HiddenItems`. Cada evento contém Y, X, argumento ID do item, banco da rotina e ponteiro CPU.
- 3. Criado o módulo `romHiddenEvents.js`: procura a tabela de 85 mapas e respetivos ponteiros por assinatura estrutural, descodifica eventos de seis bytes, localiza as 54 coordenadas/índices e valida correspondências de coordenadas e rotina única. Nenhum endereço absoluto específico de Red é assumido.
- 4. Executada a extração local nos três binários originais: em cada ROM, 85 mapas de eventos, 217 registos de eventos e 54 correspondências únicas da lista de itens ocultos. A rotina de tratamento está em banco 1D, CPU 6688 (Red), 6689 (Blue) e 668A (Green). As tabelas de coordenadas estão, respetivamente, nos offsets 766B8, 766B9 e 766BA. Os 54 IDs extraídos coincidem nas três versões.
- 5. Acrescentado o resultado ao `world.hiddenItemScripts` do perfil gerado diretamente pela ROM no `romVariantRegistry.js`, com SHA256 do ficheiro comprovado e coordenadas/eventos de origem.
- 6. Ajustado `romEventState.js` para preferir os IDs extraídos do ficheiro ROM efetivamente analisado e associado ao SHA256 do perfil; continua a existir a tabela exata auditada para as três ROMs no pacote JSON v4 anterior, sem exigir nova extração manual. ROMs desconhecidas sem leitura válida mantêm o estado desconhecido.
- 7. Acrescentado `tests/romHiddenEvents.test.js` com verificações de 54 itens, deslocações do handler nas três ROMs, índice 53 da Route 4 (X40/Y3, item ID 03 Great Ball) e bit RAM de recolha. Os testes que necessitam dos três ficheiros só executam com POKEMON_ROM_DIR (caso contrário ficam explicitamente skipped).
- 8. Verificados localmente os três binários contra o novo algoritmo equivalente em Node: 54 entradas válidas por ROM, identidade de IDs entre as três, posição e ID da Route 4. Não foi realizado teste final contra o SameBoy do iPhone.
- 9. Sem alteração de ROMs, saves, sessão Antigravity, chaves, contas ou ficheiros no disco C: do utilizador. Nenhum binário ROM foi publicado.

**Limites pendentes:** `HiddenCoins` do Game Corner são uma estrutura diferente; restantes interações NPC e scripts especiais ainda não estão todos descodificados. Os nomes dos itens provêm do identificador binário confirmado e da tabela de rótulos Gen I, não de texto ASCII na ROM. O CRC32 da sessão continua a não provar criptograficamente o SHA256 do jogo no iPhone.


## 2026-10-27 — Fase 6: IDs binários de itens ocultos e recolha de moedas

- 1. Revisto o estado atual do repositório antes de qualquer alteração: `romTrainerEvents.js` já continha 312 associações objeto de treinador ↔ flag de evento. A flag ativa pode significar combate desativado por script, não comprova necessariamente que o treinador foi individualmente derrotado.
- 2. Lidas as fontes primárias `pret/pokered/data/events/hidden_events.asm`, `engine/events/hidden_items.asm` e `data/events/hidden_coins.asm` para confirmar formato de seis bytes, índices e mapas de coordenadas.
- 3. Criado `romHiddenEvents.js` para percorrer automaticamente a ROM, localizar a tabela de 85 mapas e 217 eventos, verificar 54 posições ocultas com ponteiros de rotinas e extrair o ID real do item, sem assumir offsets fixos das outras ROMs.
- 4. Testes Node sobre as três ROMs originais: Red, Blue, Green International v1.2.1 reproduzem 54 itens ocultos, 85 mapas de eventos e 217 registos compilados; os 54 IDs coincidem nas três, apesar de os ponteiros da rotina se deslocarem. Route 4 X40/Y3 tem ID 03 (Great Ball).
- 5. Alterado `romVariantRegistry.js` para incluir `world.hiddenItemScripts` no perfil gerado a partir do próprio ficheiro. Alterado `romEventState.js` para dar prioridade a esta estrutura verificada por SHA-256, mantendo compatibilidade com perfis anteriores das três ROMs auditadas.
- 6. Descoberta e validada a tabela das 12 moedas escondidas do Game Corner nas três ROMs, separando-a dos objetos de slot machine que podem partilhar coordenadas. Valores comprovados: 10,10,20,10,10,20,10,10,10,40,100,10 moedas.
- 7. Acrescentado `decodeHiddenCoins` em `romEventState.js`; lê bits próprios em `D6FE..D6FF`, sem confundir com recolhas de item em `D6F0..D6FD`. O `retroarchClient.js` passou a ler os dois bytes e a publicar `romHiddenCoins` na telemetria da área.
- 8. Atualizado `public/app.js` para mostrar as moedas, quantidades, coordenadas e recolha realmente indicada pela flag RAM. Também assinala expressamente quando o atlas de treinadores cobre apenas parte de um mapa.
- 9. Criado `tests/romHiddenEvents.test.js`; reforçados `tests/romEventState.test.js` com casos de moedas e falhas de ROM. Testados localmente os três binários reais com Node e verificada a sintaxe dos sete módulos/testes alterados. A lógica `decodeHiddenCoins` foi executada isoladamente com flags reais simuladas, passando os controlos.
- 10. Adicionada adenda técnica a `docs/PROGRESSO_ZONA_FLAGS_ROM_RAM_V5.md`, mantendo todas as secções anteriores. Nada foi instalado ou modificado no iPhone nesta sessão; a integração ao vivo ainda precisa de verificação.
- 11. Nenhuma ROM, save, token, sessão Antigravity, ficheiro de utilizador no C: ou processo local do jogador foi alterado. A identificação automática permanece baseada nos perfis já disponíveis e no CRC32 anunciado pelo emulador.

**Limites ainda pendentes:** validação ao vivo no SameBoy, interpretação da atividade histórica completa dos treinadores, scripts de NPCs especiais, tipos de interação restantes e cobertura de ROM hacks com dados diferentes.


### 2026-10-27 — Correção adicional no cálculo das moedas ocultas

- 12. Inspecionada diretamente nos três executáveis a sequência de instruções da rotina `HiddenCoins` (banco 1D, Red 6799, Blue 679A, Green International 679B). A comparação `cp 40` salta para a ramificação que atribui **20 moedas**, erro conhecido do motor Gen I, portanto um argumento `COIN+40` não concede 40.
- 13. Alterado `romHiddenEvents.js` para testar a assinatura do próprio código binário antes de concluir que o evento nominal de 40 atribui 20. Para ROMs alteradas sem assinatura, o valor efetivo fica `null`, em vez de ser inventado.
- 14. Alterado `romEventState.js` para transportar em separado `coinAmount` (argumento do script) e `actualAwardIfClaimed` (resultado previsto da rotina). A tabela auditada para os três hashes Red/Blue/Green mantém o fallback de 40 → 20 sem exigir nova instalação manual.
- 15. Alterado `public/app.js` para apresentar ao jogador o valor efetivo (20) e explicar que o script pedia 40, sem confundir uma flag de recolha com créditos efetivamente presentes no Coin Case.
- 16. Reforçados `tests/romHiddenEvents.test.js` e `tests/romEventState.test.js`, e confirmada em Node a assinatura no código dos três binários originais. O teste de integração real no iPhone continua pendente.


## 2026-10-27 — Cruzamento automático dos encontros ROM com capturas da Pokédex

- 1. Revisto o código atual antes de alterar o sistema: o atlas de treinadores já contém 312 associações auditadas nas ROMs Red, Blue e Green, e, por prudência, o código distingue "flag de combate desativado" de "vitória individual comprovada".
- 2. Criado `romCaptureOpportunities.js`: agrega as dez posições de encontro de cada meio (relva/água), calcula níveis e probabilidade **condicional ao encontro** pela soma dos pesos reais da ROM e cruza o número da Pokédex com as flags Owned/Seen que já são lidas da RAM.
- 3. A saída `romCaptureOpportunities` só fica verificada se houver correspondência CRC32 da ROM e leitura da Pokédex da RAM. Dados não confirmados ficam como desconhecidos. Não são confundidas probabilidades de encontro de cada espécie com probabilidade absoluta de captura.
- 4. Integrado no `retroarchClient.js` após carregar a área correspondente da ROM e as listas de espécies capturadas/vistas. Separação entre encontros de relva e de água/Surf.
- 5. Atualizado `public/app.js` para mostrar no cartão da zona as espécies que ainda faltam capturar, os níveis possíveis e a respetiva percentagem condicional; acesso ao terreno/Surf permanece uma condição não verificada.
- 6. Executados dois testes isolados em JavaScript: Oddish com 102/256 de peso é mostrado a 39,84%, nos níveis 13 e 15, visto mas ainda não capturado; ROM sem correspondência não produz factos de captura. Passaram.
- 7. Criado `tests/romCaptureOpportunities.test.js` com estes casos reproduzíveis.
- 8. Não foram modificados saves, ROMs originais, sessões, ficheiros do PC ou o disco C:. Ainda não foi feito teste ponta a ponta no iPhone.


## 2026-10-27 — Fase 6: distinguir treinadores humanos de Pokémon fixos e ler eventos de líderes

- 1. Reabertos os três binários ROM reais enviados (Red, Blue, Green International 1.2.1), os módulos romWorldData.js, romTrainerEvents.js e as provas existentes no GitHub.
- 2. Confirmado pelo source original pret/pokered que o campo object_event de batalha pode conter espécie Pokémon ou classe de treinador. OPP_ID_OFFSET é 200. Encontrados 346 objetos com formato de batalha, dos quais 12 são Pokémon fixos e 334 humanos.
- 3. Auditados diretamente nos 3 binários os scripts especiais dos oito líderes dos ginásios, 7 treinadores de Cinnabar, Giovanni do esconderijo Rocket, Super Nerd do fóssil em Mt Moon e Karate Master no Dojo. Somam 18 índices de flags adicionais. Implementado o catálogo restrito a SHA-256 das 3 ROMs em romTrainerEvents.js.
- 4. Corrigido romWorldData.js para classificar espécie fixa como wildPokemon, não trainer, e extrair a associação do cabeçalho estático da ROM. Encontradas as 12 flags: Power Plant 1121..1129, Articuno 2522, Moltres 1342, Mewtwo 2241.
- 5. Corrigido romTrainerEvents.js para excluir das batalhas humanas os dois encontros de Moltres e Mewtwo anteriormente presentes no atlas de 312 cabeçalhos. Resultado atual: 310 humanos convencionais + 18 casos especiais = 328 associações para 334 humanos (6 casos por auditar), além das 12 flags de Pokémon fixos.
- 6. Implementado romStaticEncounterEvents.js: estado específico de encontros fixos lido a partir da ROM atual quando o perfil foi analisado localmente, ou das 3 ROMs com hash exato em perfis JSON antigos, sempre cruzando wEventFlags. O resultado não afirma captura nem derrota individual.
- 7. Expandido romAreaEvidence.js, romAreaProgress.js, retroarchClient.js e public/app.js para apresentar separadamente Pokémon fixos, espécies, níveis, posição e flag de evento. Captured permanece null até existir evidência histórica.
- 8. Criados romStaticEncounterEvents.test.js e romSpecialTrainerEvents.test.js; corrigidos fixtures e expectativas de romAreaEvidence.test.js, romTrainerEvents.test.js e romWorldData.test.js para classes de treinadores >=201, 310 cabeçalhos convencionais, 12 Pokémon fixos e 18 scripts especiais.
- 9. Executada verificação direta em Python dos 12 cabeçalhos de encontros fixos nos três binários; nenhum falhou. Validados os bits 1128 e 1129 (armazenam offsets 8/9), bem como as 18 verificações de script de líderes e especiais.
- 10. Executado teste isolado em JavaScript do código atualizado com perfil de ROM JSON antigo: mapa Power Plant revelou 9 Pokémon fixos, 0 treinadores humanos, 1 flag encerrada e nenhuma captura declarada; passou. Verificada a sintaxe dos módulos alterados.
- 11. Documentada a investigação e as limitações em docs/AUDITORIA_BATALHAS_E_ENCONTROS_FIXOS_V6.md. Os testes npm test integrais e a execução contra o SameBoy/iPhone ainda não foram executados nesta sessão.
- 12. Nenhum ficheiro do utilizador em C:, save, ROM, processo, token ou sessão Antigravity foi alterado. Só foram criados/alterados ficheiros de código e documentação no repositório GitHub e scripts temporários no ambiente de análise.

**Pendentes:** Cerulean Rival, Rocket da Route 24, Rival no Oak Lab, Rival na S.S. Anne, Rocket do Game Corner e Giovanni na Silph Co 11F: são 6 casos de script especial, sem associação segura nesta fase. É proibido concluir vitória apenas pela presença/ausência do NPC ou por um bit que os scripts possam ativar.


### Adenda fase 6 — validação de regressão e presença de Pokémon fixos

- 13. Corrigido romAreaEvidence.js para não interpretar a ausência de um sprite de Pokémon fixo como ausência no mapa, pois o classificador de sprites RAM atual não identifica essa categoria de forma inequívoca. A visibilidade mantém-se desconhecida até existir prova.
- 14. Verificada a sintaxe de 10 módulos/testes de mundo, batalhas, Pokémon fixos, progresso e interface após as alterações.
- 15. Executados 3 testes isolados adicionais do JavaScript atual: Route 6 (seis treinadores humanos, uma flag ativada); Victory Road 2F (cinco treinadores humanos, Moltres excluído); Power Plant (nove encontros Pokémon fixos, evento de Zapdos ativo, nenhuma captura inferida). Todos passaram no ambiente de teste isolado.
- 16. A execução do pacote completo de testes Node no repositório e a observação do SameBoy real continuam pendentes. Não declarar a integração em produção certificada.


## 2026-10-27 — Equipas e níveis dos 415 treinadores obtidos da ROM

- 1. Comparados os três ficheiros .gb reais fornecidos com a estrutura TrainerDataPointers (47 classes), conforme pret/pokered/data/trainers/parties.asm.
- 2. Localizada uma única tabela válida em cada jogo, offset 0x39D3B. Extraídos e comparados 415 grupos de Pokémon, com IDs internos e níveis. Os três resultados coincidiram.
- 3. Criado romTrainerParties.js: descobre ponteiros dinamicamente e só aceita grupos estruturalmente válidos, ou usa os metadados compactos se o hash corresponder precisamente a Red/Blue/Green International auditados.
- 4. Testado Brock classe 234: Geodude Nv.12, Onix Nv.14; Misty classe 235: Staryu Nv.18 e Starmie Nv.21. Verificada a cadeia compacta por comprimento, hash de controlo e SHA-256 da representação normalizada.
- 5. Criada leitura de TrainerNames para os 47 nomes das classes na própria ROM; no fallback estes nomes só são associados aos três hashes auditados.
- 6. Integrado o leitor em romVariantRegistry.js, retroarchClient.js, romAreaEvidence.js e public/app.js. A interface passa a mostrar o nome da classe, a equipa e os níveis por treinador, distinguindo a previsão da ROM do resultado efetivo da batalha.
- 7. Criado tests/romTrainerParties.test.js com testes de integridade do atlas e leitura das três ROMs quando estão disponíveis.
- 8. Sintaxe validada para os seis ficheiros JavaScript; teste isolado da passagem de equipa por romAreaEvidence.js passou. A integração no SameBoy/iPhone não foi testada em execução.
- 9. Ficheiros temporários de análise local apagados. Nenhuma ROM, save, credencial ou sessão do utilizador foi alterada; histórico anterior preservado.

**Atenção:** equipa/níveis lidos da ROM não provam vitória. Flags de eventos podem indicar que o combate foi desativado por script, e não que foi ganho individualmente.


### Adenda — exceção importante para as equipas do rival

- 13. Verificada na fonte primária pret/pokered a existência de três formações alternativas por batalha de Rival1/Rival2/Rival3, dependentes do inicial e dos ramos dos scripts.
- 14. Corrigido romTrainerParties.js: classes internas 225, 242 e 243 nunca devolvem uma equipa concreta como confirmada sem validar a variante escolhida; devolvem team=null, variantDependent=true e explicação.
- 15. Atualizados romAreaEvidence.js e public/app.js para distinguir visualmente esta incerteza, sem alterar flags ou concluir derrotas.
- 16. Alargados os testes com verificação de que o rival não recebe uma equipa suposta. A integração SameBoy/iPhone permanece sem teste de ponta a ponta.


## 2026-10-27 — Fase 7: completar scripts especiais sem falsificar vitórias

- 1. Reabertos os módulos atuais do GitHub antes de modificar: romWorldData.js já continha extração automática de eventos, romTrainerEvents.js possuía 310 associações humanas convencionais, 18 scripts especiais, 12 encontros fixos e identificava seis casos históricos sem associação segura. Evitou-se substituir esse trabalho por um scanner inferior.
- 2. Revisitadas fontes primárias pret/pokered: scripts/CeruleanCity.asm, Route24.asm, OaksLab.asm, SSAnne2F.asm, GameCorner.asm e SilphCo11F.asm, distinguindo eventos de vitória, de confronto realizado, de partida de navio e de descoberta de esconderijo.
- 3. Analisados os três executáveis Red/Blue/Green da conversa. Procuradas as assinaturas de bytecode SetEvent diretamente em cada banco de mapa: offsets 0x195C1 (Cerulean Rival, bit 152), 0x51432 (Rocket Route24, bit 1345), 0x1CE27 (Oak Lab, bit 35), 0x48EF4 (Game Corner poster, bit 441), 0x6225E (Giovanni Silph 11F, bit 1935). Todas as 15 procuras encontraram exatamente uma ocorrência por banco e por versão.
- 4. Confirmados os ordinais reais dos objetos humanos: mapa 3 objeto 2, mapa 35 objeto 1, mapa 40 objeto 1, mapa 96 objeto 2 (Rival S.S. Anne), mapa 135 objeto 11 (Rocket do Game Corner), mapa 235 objeto 3 (Giovanni Silph).
- 5. Atualizado romTrainerEvents.js com quatro vínculos novos condicionados exclusivamente aos três SHA-256 auditados. Cerulean Rival, Route24 Rocket e Giovanni Silph identificam SetEvent de vitória após controlo LOST_BATTLE; Oak Lab indica confronto disputado, sem resultado confirmado.
- 6. EVENT_SS_ANNE_LEFT (1506) e EVENT_FOUND_ROCKET_HIDEOUT (441) passam a ser apresentados apenas como eventos da história; nenhum pode ser usado para afirmar vitória perante rival ou Rocket.
- 7. Atualizado romAreaEvidence.js para transportar vitória comprovada de script, batalha realizada e proveniência; flags genéricas continuam com defeated=null.
- 8. Atualizado romAreaProgress.js para contar separadamente vitórias de script e batalhas realizadas de resultado desconhecido; necessidades de cabeçalhos tornam-se dependentes do número real de treinadores sem associação na área.
- 9. Atualizado public/app.js para identificar os três estados (vitória de script, batalha realizada sem resultado, e evento/combate genericamente desativado) e apresentar S.S. Anne/Game Corner como progresso, não resultado.
- 10. Atualizado tests/romTrainerEvents.test.js para Route24 Rocket e criado tests/romScriptedBattles.test.js para cenários de scripts especiais, rejeição de ROM desconhecida e assinaturas compiladas das três ROMs (esta última prova depende de POKEMON_ROM_DIR no teste Node futuro).
- 11. Executada validação isolada de sintaxe e sete cenários da implementação atual em motor JS; todos passaram. Executada procura direta dos 15 padrões em três ROMs reais. Não foi feita integração ao vivo no iPhone nem execução integral npm test.
- 12. Criado docs/BATALHAS_ESPECIAIS_ROM_RAM_V7.md com a prova compilada, fontes, limites e semântica exata. Não se tocaram os saves, os tokens, o login Antigravity ou o disco C: do utilizador.

**Pendência real:** a S.S. Anne não possui um evento persistente específico de vitória na luta do rival; o Game Corner só dispõe de evidência persistente de abertura do esconderijo, que não demonstra o resultado da luta. Outras variantes ROM exigem validação dos seus próprios scripts. Integração SameBoy ainda por testar.


## 2026-10-27 — Auditoria automática de cobertura dos treinadores por ROM

- 1. Revisto o estado atual do repositório. Confirmado que romTrainerEvents.js já tinha 312 cabeçalhos de treinadores e múltiplos scripts especiais, além de regras que distinguem evento desativado de vitória comprovada. Não foi substituído por tabelas menores.
- 2. Criado romTrainerCoverage.js: percorre os mapas válidos de cada perfil ROM, conta os treinadores humanos definidos como objetos e compara os seus ordinais com o atlas de cabeçalhos e scripts. Produz número de associações conhecidas, desconhecidas e lista dos objetos por auditar.
- 3. Ligada a auditoria ao retroarchClient.js, com cache por hash SHA-256 do perfil. Publica romTrainerCoverage na telemetria (contagens globais, estado do mapa atual, posições e classes ainda não mapeadas).
- 4. O dashboard public/app.js passou a apresentar explicitamente a cobertura e os treinadores da zona cujas flags continuam desconhecidas, sem presumir combate realizado ou vitória.
- 5. Criado tests/romTrainerCoverage.test.js. Validado em execução JavaScript um cenário com seis treinadores na Route 6 conhecidos pelo atlas e um treinador sintético num mapa desconhecido: 6 mapeados, 1 por interpretar. Verificada a sintaxe JavaScript dos módulos alterados.
- 6. Não foram alterados binários ROM, saves, credenciais, dados locais do utilizador nem o seu disco C:. O histórico anterior foi preservado integralmente.

**Limite:** auditoria de cobertura de metadados; o teste real ponta a ponta com o SameBoy/iPhone ainda é necessário. A contagem global depende dos mapas descodificados e dos perfis instalados no PC. O passo técnico subsequente é interpretar os scripts dos objetos que a auditoria identifica como incompletos.


## 2026-10-27 — Auditoria independente dos 334 treinadores das três ROMs

- 1. Reabertos e inspecionados os módulos atuais do GitHub antes de alterar código. O projeto já continha atlas com 312 registos, scripts especiais de líderes/rivais, equipas de 47 classes e evidência conservadora de eventos. Não foram repetidas alterações já existentes.
- 2. Corrido scanner Python independente diretamente nos ficheiros Pokémon Red, Blue e Green International v1.2.1 disponíveis nesta conversa. Resultados idênticos em todos: **334 objetos treinador humano**, **310** ligações diretas a cabeçalhos/event flags em **66** mapas, e **24** casos de scripts especiais.
- 3. Confirmado que 18 casos especiais têm índices de evento conhecidos por scripts de líderes/ginásios, quatro outros por scripts particulares e dois não possuem a cadeia direta normal (S.S. Anne 2F e Game Corner). Estes últimos permanecem sem conclusão inferida automaticamente.
- 4. Verificado que o atlas histórico de 312 entradas contém dois encontros de Pokémon fixos (mapas 194 e 227) que não são treinadores humanos. O módulo distingue-os pela classe de objeto, não os conta como batalhas de treinador.
- 5. Corrigido `romTrainerEvents.js` para comparar dados dinâmicos da ROM com o atlas auditado para os três SHA-256 conhecidos; conflitos de eventBitIndex invalidam a leitura do mapa, e ordinais duplicados são recusados. O atlas preenche lacunas apenas de treinadores humanos em ROMs previamente auditadas.
- 6. Criadas três regressões adicionais em `tests/romTrainerEvents.test.js`: conflito ROM/atlas, entradas duplicadas e exclusão de encontros fixos; testado isolamento JS com quatro cenários, todos passaram.
- 7. Criado `tests/romRealTrainerAudit.test.js` com auditoria completa dos três ficheiros reais (requer `POKEMON_ROM_DIR` local quando executado). Exige 310 cadeias ROM + 334 objetos e 332 ligações contabilizando scripts especiais.
- 8. Publicado `docs/AUDITORIA_TREINADORES_ROM_INTEGRAL.md` com endereçamento, fontes e ressalvas. Não houve teste de integração com o RetroArch/SameBoy do iPhone.
- 9. Nenhuma ROM, save, token, sessão Antigravity, ficheiro do utilizador no C: ou processo em execução foi alterado.

**Importante:** flags de eventos não provam vitória. Só os scripts que confirmam o resultado permitem apresentar uma vitória específica como certa. Dois encontros com controlo especial continuam sem prova completa do seu estado.


## 2026-10-27 — Continuação: validação de consistência temporal ROM/RAM

- 1. Reaberto o código efetivo do GitHub em vez de assumir que os anteriores 17 mapas eram a cobertura atual. Confirmado atlas de 312 cabeçalhos, scripts especiais, auditoria declarada de 334 objetos de treinador humano, 310 ligações diretas e 24 casos especiais. A leitura das flags normais já distingue evento desativado de vitória individual.
- 2. Identificado risco concreto nas leituras sequenciais: o ID da zona vinha da RAM $D35E dentro do bloco de jogador $D158 e as flags da zona eram recolhidas mais tarde num bloco diferente. Uma transição podia associar dados de duas zonas numa amostra.
- 3. Criado `pokemon-ai-companion/romSnapshotIntegrity.js`: compara o byte $D35E da leitura inicial com uma releitura final de um byte, recusa bytes inválidos, IDs Gen I fora do intervalo 0..247 e mapas diferentes. Um ID coincidente não prova atomicidade de todos os bytes, e essa limitação é declarada.
- 4. Alterado `retroarchClient.js` para confirmar $D35E imediatamente após recolher os blocos obrigatórios e ANTES de declarar a amostra ligada ou interpretar vitórias, itens e eventos; em caso de erro/transição marca a RAM não verificada, apaga a evidência específica da zona e emite estado desligado, permitindo nova leitura no ciclo seguinte.
- 5. Criado `tests/romSnapshotIntegrity.test.js`, com cenários de mapa estável, mudança Route 6 -> outro mapa, bytes em falta/corrompidos e ID inválido.
- 6. Verificada a sintaxe dos dois módulos e do teste no motor JavaScript; executados seis cenários isolados do descodificador (6/6 passaram). Ainda não foi possível executar o conjunto completo contra o SameBoy/iPhone nesta sessão.
- 7. Nenhuma ROM, save, sessão Antigravity, token, unidade C: nem processo do equipamento do utilizador foi alterado. Este histórico foi apenas acrescentado.

**Estado:** melhoria publicada e testada isoladamente; falta validar a releitura de $D35E com a telemetria real. O requisito de leitura atómica de todos os eventos não está certificado — a verificação de estabilidade do ID do mapa mitiga, mas não elimina, alterações simultâneas noutros bytes.


## 2026-10-27 — Conferência independente de contagem de treinadores nas ROMs reais

- 1. Executada nova leitura Python apenas em memória dos três ficheiros .gb recebidos, percorrendo os 248 IDs de mapa, `MapHeaderPointers` no offset 0x1AE, `MapHeaderBanks` em 0xC23D e os cabeçalhos de objetos por mapa, sem recorrer aos totais escritos no relatório.
- 2. Cada uma das versões Red, Blue e Green International v1.2.1 devolveu **334 objetos de treinador humano em 71 mapas**, **12 Pokémon de encontro fixo** e **22 IDs sem cabeçalho normal validável**. Os três resultados coincidem.
- 3. Esta contagem valida o universo de objetos ROM, mas não prova que todos tenham flags de vitória, estejam acessíveis naquele momento ou já tenham sido vencidos. O mapeamento de flags e a estabilidade da amostra RAM são validados separadamente.
- 4. Nenhum binário original foi alterado ou enviado ao GitHub; não se criaram ficheiros de teste permanentes nem se tocou no equipamento do jogador.


## 2026-10-27 — Objetivo de mapeamento ROM a 100% e primeiro cálculo rigoroso de precisão

- 1. Revistos os módulos reais da aplicação (`gen1EngineMath.js`, `romCaptureOpportunities.js`, `aiAdvisor.js`) e o plano existente de descodificação. Confirmado que a matemática completa do combate ainda não estava implementada; pesos de encontros condicionais já eram apresentados sem confundir taxa de ativação com percentagem.
- 2. Consultada a desmontagem primária pret/pokered: `engine/battle/core.asm` (`CalcHitChance`/`MoveHitTest`) e `data/battle/stat_modifiers.asm`. Confirmados os dois arredondamentos intermédios, a reflexão de evasão `14 - estágio`, a saturação a 255 e a comparação `R < limiar`.
- 3. Implementado, **isoladamente**, `pokemon-ai-companion/gen1StandardHitChance.js`: exige byte de precisão e tabela de rácios da ROM, estágios da RAM e evidência explícita da identidade ROM/consistência da RAM/aplicabilidade do teste. Não faz aconselhamento nem altera runtime atual; não abrange OHKO, X Accuracy, exceções, crítico ou dano.
- 4. Criado `tests/gen1StandardHitChance.test.js`; no ambiente de desenvolvimento Node v22.16.0 executados sete cenários isolados e aprovados (255/256, 216/256, evasão, truncamentos, saturação e falha controlada). A execução do conjunto completo de testes e o confronto com o SameBoy/iPhone continuam pendentes.
- 5. Criado `docs/REQUISITOS_ROM_COMPLETA_E_MECANICAS_GEN1.md` com inventário de mundo, Pokémon, itens ocultos, eventos, encontros/capturas, batalhas, experiências, evoluções, trocas, probabilidades e metas verificáveis por versão. A cobertura sem inventário independente permanece INDETERMINADA: não declarar 100% só por ler os bytes da ROM.
- 6. Não alterados ROMs, saves, aplicações/processos ou sessões do utilizador; nenhuma alteração no disco C: ou na sessão Antigravity. Não houve alteração visual: screenshots do Companion deverão ser capturados e analisados na futura fase de UI.

**Pendente prioritário:** proveniência e descodificação em runtime da precisão e rácios por ROM; cobertura de fórmulas completas de combate/dano/captura/encontro e restantes áreas; integração real com telemetria, bateria de regressões e validação SameBoy/iPhone. Este commit é uma fundação isolada, não certificação de 100%.


## 2026-10-27 — Continuação real: motor probabilístico Gen I, captura e distribuição por nível

- 1. Inspecionados `retroarchClient.js`, `romWorldData.js`, `romCaptureOpportunities.js`, `server.js`, `gen1EngineMath.js` e o estado das tabelas existentes antes de produzir novas alterações.
- 2. Comparados diretamente trechos da desmontagem primária `pret/pokered/engine/battle/core.asm` (`CriticalHitTest`, `CalculateDamage`, `RandomizeDamage`, `MoveHitTest`) e `pret/pokered/engine/items/item_effects.asm` (rotina de lançamento/captura), incluindo o bug de Focus Energy, probabilidades de 1/256, dados de danos com 39 multiplicadores 217..255 e aleatórios inclusivos.
- 3. Publicado `pokemon-ai-companion/gen1CombatProbabilities.js`: crítico por velocidade-base/Focus Energy/golpe especial, distribuição de danos do ramo padrão NEUTRO sem STAB nem efeitos e probabilidade de KO condicional ao acerto. Só opera com provas de ROM, RAM e caminho aplicável; danos de tipos e movimentos especiais permanecem fora do âmbito.
- 4. Publicado `pokemon-ai-companion/gen1CaptureProbability.js`: fórmula da captura Gen I em lançamento legal com taxa real ajustada da RAM, HP/status e Poké/Great/Ultra/Safari/Master Ball. Usa os intervalos reais dos aleatórios (0..255/200/150), o valor W com divisões truncadas, segundo lançamento aleatório com limite inclusivo e bonificações reais de status. Não se aplica automaticamente a fantasmas, treinador, exceções de scripts nem batalhas não verificadas.
- 5. Criado `tests/gen1ProbabilityModules.test.js` com 11 cenários para críticos, Focus Energy, danos, KO, Poké Balls e recusas de evidência. Em Node v22.16.0, no ambiente isolado, a bateria com os sete testes de precisão anteriores passou: **18/18**.
- 6. Alargado `romCaptureOpportunities.js` para fornecer por espécie `conditionalChanceOutOf256` e `byLevel` (pesos exatos/256 por nível), verificando que os pesos do encontro totalizam 256 antes de os apresentar. Diferencia taxa de ativação de encontro, odds condicionais à ocorrência e captura. Acrescentados dois testes a `tests/romCaptureOpportunities.test.js`. A apresentação visual existente ainda não foi alterada.
- 7. Implementado `gen1NeutralTurnForecast.js`, que combina precisão padrão, probabilidade de crítico, distribuição de dano neutro dos dois ramos, risco de falhar e probabilidade total de KO **sob condições do mesmo turno comprovadas**. Publicado `tests/gen1NeutralTurnForecast.test.js` com três novos testes. Foi corrigida somente a asserção numérica do teste para respeitar erro de arredondamento de números IEEE754; algoritmo permaneceu igual. Resultado local: **21/21 testes aprovados** numa bateria isolada com três ficheiros de testes.
- 8. Todos os módulos continuam separados e **não foram ligados ao runtime** porque não está provado que este ofereça ainda os atributos e os caminhos específicos do turno sem suposições; jamais inventar dados, probabilidades ou certificação do SameBoy/iPhone. Não houve alterações de layout e portanto não foram criadas capturas de ecrã da UI nesta fase.
- 9. Nenhuma ROM, save, token, login, backup Antigravity, ficheiro do disco C: ou aplicação do utilizador foi alterado. Os ficheiros temporários de execução existem somente no ambiente de verificação isolado, não no computador do utilizador.

**Pendentes:** comparar todas as fórmulas por variante ROM real (não apenas pret/pokered), extrair os bytes e estados de cada turno diretamente da ROM/RAM validada, implementar STAB, eficácia por tipo, golpes de efeito especial, cenário Safari, mecânica de encontro por passo e restantes oportunidades globais, executar `npm test` integral e testar telemetria do SameBoy. O objetivo de 100% descodificado/certificado continua não atingido.


### Adenda — STAB e tabela de eficácia de tipos da Gen I (27/10/2026)

- 10. Consultada diretamente a rotina primária `AdjustDamageForMoveType` em `pret/pokered/engine/battle/core.asm` e a tabela `pret/pokered/data/types/type_matchups.asm`: STAB acrescenta metade do dano (arredondada para baixo); o motor percorre os pares de tipos na ordem ROM e, por cada correspondência válida, multiplica/trunca separadamente antes de randomizar o dano.
- 11. Publicado `pokemon-ai-companion/gen1TypeDamage.js`: adiciona STAB e fatores 0/0,5/1/2 de modo sequencial, com tipos da RAM, byte do golpe e tabela ordenada **proveniente da ROM validada**. Mantém o caso de dano arredondado a zero (que a Gen I marca como falha). Só é aplicável ao ramo convencional de dano, sem movimentos especiais ou estados cuja mecânica não tenha sido validada.
- 12. Publicado `tests/gen1TypeDamage.test.js`, cobrindo STAB, combinação de fraqueza/resistência, tipo repetido, imunidade e recusa de tabela não comprovada. Executados no ambiente isolado os testes matemáticos conjuntos: **25/25 aprovados**, Node v22.16.0. A tabela sintética dos testes é expressamente um fixture, não uma leitura ROM em execução.
- 13. A apresentação visual e o telemóvel continuam sem alterações; as fórmulas ainda não são usadas para declarar resultados do turno real, pois falta extração/verificação da tabela de tipos e de estados efetivos de batalha em tempo real.

**Pendente:** leitura integral e confronto com os binários exatos da tabela `TypeEffects`, diferenças entre versões e teste diferencial ROM/emulador antes de integração ao vivo. A cobertura do jogo não é 100%.


### Adenda — limites de HP e validação dos módulos isolados (27/10/2026)

- 14. Na rotina de cálculo de captura, restringidos `hpFromRam` e `maxHpFromRam` ao intervalo válido normal 1..999; valores acima deste limite deixam de ser usados para apresentar uma probabilidade supostamente exata. Acrescentado caso de regressão em `tests/gen1ProbabilityModules.test.js`.
- 15. Reexecutados no ambiente isolado os quatro ficheiros de testes de cálculos `gen1StandardHitChance`, `gen1ProbabilityModules`, `gen1NeutralTurnForecast` e `gen1TypeDamage`: **25/25 aprovados**. Não foi executado `npm test` integral contra todos os módulos do repositório nem houve execução no dispositivo.
- 16. Detetada limitação funcional existente no `public/app.js`: a lista de encontros da zona apresenta por agora apenas espécies ainda não capturadas, embora o novo `romCaptureOpportunities.js` forneça probabilidades por nível de todas as espécies. A interface NÃO foi modificada nesta fase porque não havia acesso a uma sessão da aplicação para captar e inspecionar screenshot real; alteração UI permanece pendente, sem alegar validação visual inexistente.
- 17. Observado no `retroarchClient.js` que alguns campos de batalha ainda usam valores de recurso para HP/stats/catch rate (por exemplo `|| 150`). Estes valores não constituem dados comprovados da RAM e **não podem** ser fornecidos ao novo motor exato como entradas verificadas. Não foram alterados aqui, para evitar regressões sem teste de telemetria real, mas o bloqueio fica documentado como prioritário.

**Próximo trabalho obrigatório:** retirar/fazer fail-closed nos valores de recurso do combate, obter os bytes reais do estado do turno incluindo taxa de captura e variantes, provar ROM/estado em tempo real, ligar os módulos ao UI com screenshots analisados, corrigir eventuais incompatibilidades na bateria integral e alargar algoritmos a todos os casos da Gen I. Até lá os cálculos estão isolados e a cobertura 100% NÃO está certificada.


## 2026-10-27 — Fase adicional: leitura conservadora dos blocos de combate

- 1. Inspecionados os trechos reais de `retroarchClient.js`, `data/pokemonData.js`, `public/app.js` e do leitor UDP de memória. Confirmado que o código legado preenche HP, nível, stats e catch rate com valores de substituição e que `analyzeBattle` produz estimativas apresentadas de forma excessivamente confiante. A leitura de três blocos de combate é sequencial, não atómica.
- 2. Publicado `pokemon-ai-companion/romBattleEvidence.js`, interpretador puro de três blocos ROM/RAM (255 bytes em CFE0, 30 em D014, 280 em CC20) com validação de comprimento, hex, HP, níveis, atributos, espécies, golpes e 12 bytes de estágios. Recusa amostras incoerentes; nunca deduz taxa de captura de um offset não certificado; declara `atomicSnapshotVerified:false` e `exactTurnMathReady:false` mesmo com os três blocos completos.
- 3. Sem reiniciar, fechar ou alterar aplicações, credenciais, ROMs, saves, sessões ou backup Antigravity. Código apenas publicado no GitHub; integração em curso.

### 2026-10-27 — Integração conservadora da leitura de combate

- 4. `retroarchClient.js` passou a exigir `romBattleEvidence.js` e a validar a integridade dos três blocos antes de publicar um combate. Respostas UDP incompletas, bytes inválidos, estágios ou atributos incoerentes deixam `battle=null` e expõem o motivo em `battleReadStatus`.
- 5. Se a flag de combate não vier da RAM, a interface deixa de manter o estado anterior como se estivesse confirmado; a deteção de fim de combate só é registada quando a flag foi efetivamente lida.
- 6. Removidos os valores inventados 20/5/150 para HP, nível, stats e taxa de captura das fichas de combate. O campo `catchRate` permanece `null` até existir um endereço comprovado. HP/nível/stats do combatente ativo passam a vir do bloco de batalha validado; os PP não inventam valores de recurso.
- 7. Desativada a estratégia matemática antiga de `analyzeBattle` para os combates reais até existir motor completo e amostra apropriada. A telemetria distingue dados do combate de prova de cálculo exato, marcada `false`. Mantida a rota explícita de simulação separada do combate real. Nenhuma ROM, save, sessão ou perfil Antigravity alterados.

**Limites:** leitura de três blocos é sequencial, não prova atomicidade do turno. Não houve ainda teste ponta a ponta com RetroArch/SameBoy; a interface antiga também precisa limpar campos apresentados de estratégias anteriores.

### 2026-10-27 — Interface e conselheiro sem previsões fictícias

- 8. Alterado `public/app.js`: os resultados legados de dano, críticos, KO, recomendação e captura são apagados quando o campo `strategy.verified` não é estritamente verdadeiro. O painel mostra apenas golpes e PP descritivos quando disponíveis, juntamente com motivo explícito de cálculo indisponível, e deixa de reciclar percentagens de turnos anteriores. Alteração de interface pendente de screenshot/inspeção real — não há sessão visual do programa nesta conversa.
- 9. Alterado `aiAdvisor.js`: tanto o conselho proativo como perguntas diretas recusam recomendações específicas de combate sem `exactTurnMathReady===true` e telemetria atual comprovada. O resto do aconselhamento fora de combate não foi refeito nesta fase.
- 10. Validação de sintaxe JavaScript a partir do conteúdo atual do GitHub concluída para `romBattleEvidence.js`, `retroarchClient.js`, `public/app.js`, `tests/romBattleEvidence.test.js` e `aiAdvisor.js`. Os cinco cenários de `romBattleEvidence.test.js` foram executados num ambiente JS isolado com as fontes atuais: **5/5 aprovados**. Esta verificação NÃO executou o `npm test` integral, a UI nem o SameBoy.

**Limite:** ainda não são produzidas probabilidades de combate em produção porque os pré-requisitos ROM/RAM/turno não são observados de forma simultânea e comprovada. É preferível apresentar `NÃO CONFIRMADO` a resultados fictícios.

### 2026-10-27 — Tabela Moves de 165 golpes descodificada da ROM local

- 11. Inspecionados `romVariantRegistry.js`, `retroarchClient.js` e a fonte primária `pret/pokered/data/moves/moves.asm`; confirmado que cada entrada compilada `move` tem 6 bytes: ID/animação, efeito, potência, tipo, precisão e PP.
- 12. Publicado `romMoveTable.js`, scanner de bancos ROM que identifica de forma única 165 registos sequenciais de seis bytes, com endereços exatos, sem offsets pré-assumidos. Recusa tabelas ausentes, ambíguas, truncadas ou incoerentes e não usa fallback por semelhança de versão.
- 13. Integrado scanner na criação dos perfis locais `romVariantRegistry.js`: expõe `moveStats`, `moveStatsStatus`, `offsets.moveData` e validadores de proveniência, sem alterar ROMs/saves.
- 14. Alterado `retroarchClient.getMoveInfo`: quando a mesma ROM local é identificada por CRC32 e a tabela Moves tem leitura comprovada, potência, PP, byte de precisão e IDs de tipo/efeito vêm dessa ROM, não do catálogo estático. A descrição nominal de tipo/efeito continua identificada como referência externa até ser ligada ao ID da ROM; os cálculos exatos do turno continuam bloqueados.
- 15. Criado `tests/romMoveTable.test.js` com cinco cenários para os 165 golpes, mudança de banco, corrupção, duplicação e ROM inválida. Os testes de sintaxe são passíveis de verificação isolada; integração real contra ROMs no PC/iPhone ainda pendente.

**Ressalva:** detetar a tabela `Moves` numa ROM de perfil local não prova que o iPhone esteja a executar o mesmo SHA-256; o `GET_STATUS` usado atualmente só faz correspondência CRC32. A garantia forte de identidade e a validação visual/funcional no SameBoy permanecem obrigatórias.

### 2026-10-27 — Testes consolidados, área completa e instruções de IA verificáveis

- 16. Executados, num ambiente JavaScript V8 isolado a partir das fontes atuais recebidas do GitHub, **39/39 testes aprovados** (7 ficheiros de testes de cálculos/probabilidades, oportunidades da zona, validação dos blocos de combate e leitura dos 165 golpes). O teste do leitor de ROM usa uma implementação isolada de Buffer compatível com `Uint8Array` e ROMs sintéticas; NÃO é uma execução da aplicação real nem prova equivalência com o Game Boy.
- 17. Atualizado `public/app.js` para listar **todas** as espécies nos meios de encontro da zona, inclusive as já capturadas, com cada nível e respetivo peso condicional por 256. A taxa de ativação da ROM continua separada da probabilidade de espécie/nível e da captura. Sintaxe JS verificada; aparência final depende de screenshot de uma sessão real, ainda indisponível aqui.
- 18. Corrigidos os dois prompts de `aiAdvisor.js`, retirando a afirmação falsa de visão total da memória e a limitação exclusiva ao Pokémon Red. A IA agora é orientada para Red, Blue e Green, marca os dados desconhecidos e só aconselha ações comprovadas; também removido texto corrompido por codificação. Verificação sintática concluída.
- 19. Todos os passos nesta adenda foram modificações de código/documentação no GitHub. Não se tocaram ROMs, saves, disco C:, tokens/sessões/backups do Antigravity nem processos locais.

**Ainda não feito:** `npm test` integral com Node e dependências do repositório, ROMs reais ligadas ao emulador do iPhone, testes diferenciais dos algoritmos, amostra de batalha atómica e screenshots da GUI. A percentagem de cobertura total continua indeterminada; não afirmar que o Companion já tem 100% mapeado.

### 2026-10-27 — Identidade das três versões no conselheiro e servidor

- 20. Removido o fallback do conselheiro que substituía silenciosamente um nome de treinador desconhecido por `RED`; o campo permanece `null` quando falta prova e o contexto passou a incluir `romRuntimeIdentity` para distinguir o perfil Red/Blue/Green efetivamente associado.
- 21. Alterado somente o cabeçalho de texto da consola do servidor de `POKÉMON RED` para `POKÉMON GEN I COMPANION — RED / BLUE / GREEN`. A ligação e configuração de servidor não foram alteradas.
- 22. Ficheiros `aiAdvisor.js` e `server.js` passaram validação de sintaxe JavaScript após as mudanças. Sem reiniciar servidor, emulador, aplicações ou sessão do Antigravity e sem afetar a ROM/saves. A bateria isolada de funções matemáticas continua com os últimos resultados 39/39; **não foi reexecutado npm test integral**.


## 2026-10-27 — Auditoria real dos três binários ROM recebidos (Red / Blue / Green International 1.2.1)

- 1. O utilizador anexou os três ficheiros ROM, sendo Red um membro `Pokemon Red.gb` de um ZIP. Os binários foram lidos diretamente no ambiente de análise sem reescrever, extrair para o computador do utilizador, alterar saves ou publicar ROMs.
- 2. SHA-256 e CRC32 confirmados: Red `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b` / `9F7FDD53`; Blue `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d` / `D6DA8A1A`; Green International v1.2.1 `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db` / `3C2DD8AE`. Cada ficheiro tem exatamente 1 MiB e checksum de cabeçalho válido.
- 3. Scanner independente Python percorreu e validou os 165 movimentos, procurando a única tabela de 990 bytes em banco 14/offset `0x38000` em cada ROM. Os bytes de todos os movimentos coincidem nas três. O SHA-256 dos 990 bytes foi `0c0d7a55f01f09c5f4859344d087cc824e516b2facc520e389e4bdcb8d14db1e`.
- 4. Confirmada por cada versão a tabela de encontros `WildDataPointers` (banco 3, offset `0xCEEB`): 248 entradas, 59 blocos de dados únicos, peso dos 10 slots somando 256. Contadas diferenças de slots entre versões, sem inferir chance por passo: Red×Blue 34 mapas em relva (175 slots); Red×Green 31 (122); Blue×Green 29 (83). O segundo grupo de encontros do descodificador mantém os mesmos dados entre as três.
- 5. Auditados `MapHeaderPointers` em `0x1AE` e `MapHeaderBanks` em `0xC23D`: 248 IDs, 226 cabeçalhos normais válidos, 22 IDs sem cabeçalho normal; 334 objetos de treinador humano em 71 mapas, 12 objetos Pokémon fixos, 106 objetos de item e 472 objetos NPC, por ROM.
- 6. Validada a leitura de 190 nomes/slots internos e das 150 fichas BaseStats. Os campos de stats, tipos, catch rate, base EXP e crescimento coincidem nas três ROMs; a Green difere na parte de ponteiros/bytes de gráficos, por isso os blocos BaseStats completos não têm o mesmo SHA.
- 7. Gerados no ambiente de análise (fora do PC do utilizador) um atlas JSON estático por ROM (248 IDs e objetos), CSVs de encontros por nível, itens/objetos, BaseStats e golpes, e relatório de diferenças. Esses resultados não demonstram eventos já executados nem progresso real.
- 8. Publicados `docs/AUDITORIA_ROM_REAIS_RED_BLUE_GREEN_20261027.md` e `pokemon-ai-companion/tests/romThreeRealFiles20261027.test.js`. O teste Node usa caminhos de ROMs locais configurados por variáveis de ambiente e hashes fixos; não publica ROMs e fica SKIP explícito quando não existem caminhos. **O scanner Python foi realmente executado contra os três binários; o teste Node do repositório não foi executado em integração nesta sessão.**
- 9. Nenhum binário ROM, ZIP, save, sessão/token/backup Antigravity, processo ou ficheiro do C: do utilizador foi alterado. Histórico atualizado exclusivamente acrescentando texto, sem modificar entradas anteriores.

**Estado:** resultados estruturais reais e reproduzíveis por SHA-256. Ainda NÃO certifica 100% das mecânicas nem a execução real no iPhone. Pendências prioritárias: fluxos de eventos/itens ocultos, mecânicas de encontros por passo/captura, integração matemática com RAM consistente, testes integrais no repositório e screenshots da interface real.


## 2026-10-28 — Continuação após receber as três ROMs: TypeEffects e taxa/256

1. Confirmadas novamente no ambiente de análise as identidades SHA-256 dos três binários anexados: Red `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b`; Blue `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d`; Green International v1.2.1 `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db`. Leitura exclusiva, sem mudar saves nem as ROMs originais.
2. Consultada a fonte primária `pret/pokered/data/types/type_matchups.asm` e a rotina `AdjustDamageForMoveType`. Scanner sobre os três binários confirmou tabela TypeEffects única no offset `0x3E474`, banco 15, 82 entradas de três bytes + `FF`. SHA-256 dos 247 bytes: `e55fa25d775c0020e2d36313983584cfbb250b9d0007a9c3cbf24a199a65aba4`, idêntico nas três versões. Observadas as diferenças de eficácia Gen I (Ghost→Psychic imune; Bug↔Poison super eficaz).
3. Publicado `pokemon-ai-companion/romTypeMatchups.js`, um leitor que recusa tabelas ausentes, truncadas, duplicadas, corrompidas ou não conformes, sem offsets pressupostos. Código integrado em `romVariantRegistry.js` com `typeMatchups`, `typeMatchupsStatus` e offset no perfil por ROM; a ausência de leitura única não é promovida a valor válido.
4. Criado `pokemon-ai-companion/tests/romTypeMatchups.test.js` e executados **5/5 testes Node 22.16.0** localmente com as ROMs reais e casos sintéticos de rejeição. Uma primeira versão do último teste tinha uma preparação defeituosa (a segunda tabela válida permanecia ao corromper a primeira); foi corrigida a ordem da preparação e repetida a execução completa, com sucesso. Os testes do binário real são provas da tabela estática, não da RAM em tempo real.
5. Consultada a rotina `pret/pokered/engine/battle/wild_encounters.asm` e `data/wild/probabilities.asm`: `hRandomAdd < rate`, onde o aleatório é 0..255. Corrigido o denominador **`rateByte/256`** na nova API `romCaptureOpportunities.js` e na UI `public/app.js`, com aviso de que a taxa é apenas condicional a tentativa de encontro elegível e **NÃO** probabilidade por passo. Acrescentado teste em `tests/romCaptureOpportunities.test.js`; bateria isolada recuperada diretamente das fontes atuais do GitHub: **5/5 testes aprovados** e sintaxe JS válida.
6. Gerado o atlas local `pokeguide_rom_audit_v2.json` com as 82 regras da tabela TypeEffects por versão e o limiar exato `rateByte/256` para cada meio de cada um dos 248 IDs de mapa, com `perStepChanceVerified:false`. Criado o ZIP de dados e verificações `Pokeguide_Auditoria_3_ROMs_Atualizada_20261028.zip`, sem incluir binários ROM ou saves. Os anexos iniciais permaneceram intactos.
7. Publicado `docs/AUDITORIA_TYPE_EFFECTS_E_ENCONTROS_20261028.md` com offsets, SHA, condições, limites e os testes efetuados. Não houve sessão visual da aplicação disponível neste ambiente: alterações na interface **não** foram confirmadas por screenshots, e a execução em RetroArch/SameBoy permanece pendente.
8. Nenhum processo TIMI/Maestro/BonChat, sessão, perfil, token, backup do Antigravity ou ficheiro no C: do utilizador foi acedido ou alterado. Apenas novos commits no GitHub e artefactos no ambiente isolado.

**Pendência obrigatória:** validar o runtime ao vivo contra o perfil ROM efetivamente carregado (a correspondência CRC32 não é SHA-256 do iPhone), leitura coesa do turno, todos os scripts, os itens ocultos/bonus, encontros por passo, cálculos completos de danos e capturas, `npm test` integral e screenshots analisados. Cobertura 100% permanece indeterminada.


## 2026-10-28 — Continuação: captura efetiva em D007, dupla leitura RAM e pesos retirados da ROM

1. Consultados `pret/pokered/macros/ram.asm`, `ram/wram.asm`, `engine/items/item_effects.asm` e o ficheiro de símbolos do projeto. Localizado `wEnemyMonActualCatchRate` em **D007**, diferente da taxa-base `wEnemyMonCatchRate` em **CFEC**. Verificado que a rotina ItemUseBall usa o primeiro campo, sobretudo relevante em taxas alteradas como Safari.
2. Verificadas fisicamente as três ROMs anexadas por SHA-256. Nos três binários, a rotina de captura tem a instrução `FA 07 D0` nos offsets `0xD777` e `0xD797`; isto comprova as duas leituras de D007 para os ficheiros auditados, não o conteúdo de RAM no iPhone.
3. Alterado `romBattleEvidence.js` para ler `CFE9` (status), `CFEA/CFEB` (tipos), `CFEC` (taxa-base) e `D007` (taxa efetiva) do bloco real. A taxa efetiva só é exposta se `battleFlag=1`, `romMatched` e `captureLayoutVerified` forem verdadeiros; treinador, ROM desconhecida e estruturas incoerentes falham fechado. Corrigido `retroarchClient.js` para expor campos lidos e tratar congelamento sem o fallback antigo que o confundia com queimadura.
4. Criado `romBattleSnapshotConsistency.js` com releitura de `CFE5` 40 bytes (inclui D007), `D014` 29 bytes, `CD1A` 26 bytes, `D057` 1 byte e `D35E` 1 byte. Integrado em `retroarchClient.js`: discrepância descarta a ficha e mostra o motivo; duas leituras iguais **não** são prova de atomicidade temporal, pelo que `atomicSnapshotVerified` continua `false`.
5. Consultada a ROM e a desmontagem `data/wild/probabilities.asm`: a tabela `WildMonEncounterSlotChances` está em `0x13918`, com 20 bytes idênticos nas três ROMs e pesos 51,51,39,25,25,25,13,13,11,3. Criado `romEncounterWeights.js` e integrado em `romWorldData.js`; a origem dos pesos passa a ser a ROM concreta, com recusa quando tabela alterada/incompleta/ambígua. O atlas expõe agora `slotWeightsFromRom`.
6. `romCaptureOpportunities.js` passou a recusar slots inválidos sem omissão silenciosa e a preservar percentagens exatas dos pesos `/256`, como 51/256 = 19,921875%. Atualizados os testes de captura, coerência e encontros; criado `tests/romEncounterWeights.test.js` e atualizado `tests/romThreeRealFiles20261027.test.js` para os dois opcodes D007.
7. Criado `romCaptureLayout.js`: identifica o layout de captura somente nas três ROMs SHA-256 auditadas, confirmando os dois opcodes. Integrado em `romVariantRegistry.js` e no guardião de `romBattleEvidence.js`; criado `tests/romCaptureLayout.test.js`. O facto de a ROM local possuir um SHA-256 não comprova a ROM carregada no telemóvel, cuja identidade em runtime ainda depende do CRC32.
8. **Validação real Node v22.16.0**: os ficheiros `romCaptureLayout.js` e `romEncounterWeights.js` foram copiados para ambiente isolado e os seus SHA de blob Git foram confirmados iguais aos publicados (`b1d46150e3567d81696f9522aeddb36fca9a5cfe`, `5e6f2778ae140d56340431646d0f08503f8ff08e`). Executadas ambas as funções com Red, Blue e Green reais: **6/6 verificações de ROM aprovadas**. Um verificador independente Python comprovou ainda os pesos em **58 meios ativos por ROM** (174 no total), sem divergências, e ambos os opcodes em cada ROM.
9. Bateria isolada JavaScript com quatro módulos de RAM/encounters: **24 cenários aprovados e três SKIP**, estes últimos por dependerem de ficheiros ROM locais inacessíveis ao executor JS isolado. Esta bateria antecedeu a última condição `captureLayoutVerified`; a execução da bateria integral `npm test` continua pendente. Não alegar que os testes omitidos passaram.
10. Publicado `docs/AUDITORIA_CAPTURA_D007_E_SLOTS_20261028.md`, com os bytes/offsets e limitações. Não houve alteração visual da UI nesta fase; screenshots não foram realizados, nem se alegam. Todo o trabalho foi feito em isolamento e publicado como código/documentação/testes; não foram modificados ROMs, saves, processos, sessão, tokens/backups do Antigravity nem ficheiros em C: do utilizador.

**Próximo bloqueio:** comparar e validar os efeitos especiais da captura, dados temporais/estatísticas de batalha e identidade ROM do emulador. O motor ainda não pode declarar probabilidades de captura/dano totalmente certificadas em live gameplay; cobertura global 100% permanece não certificada.

### Verificação final da revisão (2026-10-28)

11. Após todas as alterações de proteção de layout ROM, repetida a bateria isolada recuperando os ficheiros da branch `main` do GitHub: **25/25 testes JavaScript aprovados, 3 SKIP dependentes de caminhos de ROM no executor isolado, zero falhas**. Os testes ativos abrangem validação RAM, segunda leitura de consistência, limiares de slots e probabilidades condicionais de encontros. Não confundir com `npm test` integral.
12. Sintaxe JavaScript verificada nos dez módulos/ficheiros de código e testes implicados, incluindo `romWorldData.js`, `romVariantRegistry.js`, `romCaptureLayout.js` e `retroarchClient.js`; nenhuma falha sintática. Confirmada na revisão remota a integração de `slotWeightsFromRom`, `battleCaptureLayout` e histórico exclusivamente acrescentado.
13. Confirmada execução Node direta de dois módulos com SHA de blob Git igual à fonte publicada, contra as três ROMs carregadas, com **6/6 resultados positivos**. A existência de ROMs nesta sessão não elimina os três SKIP de um executor JS diferente sem acesso aos caminhos de ficheiro. Sem executar o emulador do iPhone, a UI ou o servidor ativo.

**Estado de fecho:** tudo o que foi modificado nesta fase está publicado no GitHub, mas a verificação ponta a ponta ao vivo permanece pendente. Não atribuir certificação de 100% à cobertura do jogo.


## 2026-10-28 — Repel e tabelas de batalha verificados em três ROMs

- Confirmado em pret/pokered que Repel com apenas 1 passo restante termina sem sorteio. Nos restantes passos ativos, o nível do primeiro Pokémon filtra os dez slots de encontro.
- Publicado `gen1WildEncounterCheck.js` e o teste `tests/gen1WildEncounterCheck.test.js`: oito testes Node locais aprovados, três deles executados diretamente nas ROMs Red, Blue e Green com SHA-256 verificado. Route 2: 25/256 sem Repel, ou 1025/65536 com Repel ativo e primeiro Pokémon no nível 5, por tentativa elegível e sob o modelo RNG explícito.
- Confirmada a tabela de 13 rácios de precisão no offset `0x3F6CB`, os quatro golpes de crítico elevado na tabela efetiva em `0x3E08E`, e uma cópia não utilizada em `0x3E01E`. Publicado `romBattleRuleTables.js` com validação dos três SHA-256 e cinco testes locais aprovados.
- Integrado o catálogo auditado no perfil de ROM e a proveniência de críticos elevados na descrição dos golpes. Relatório: `docs/AUDITORIA_REPEL_PRECISAO_CRITICOS_20261028.md`.
- Total desta fase: 13/13 testes Node locais aprovados, 0 ignorados. Não foi executado teste integral do Companion, interface real ou emulador; cobertura de 100% não certificada. Originais das ROMs preservados.


## 2026-10-28 — Execução conjunta: auditoria 64 bancos e cobertura verificável das três ROMs

- Criada API `inspectRomBuffer` em `romVariantRegistry.js`, preservando o método anterior `inspectRom(file)`. O conteúdo Red ZIP pode ser analisado em memória, sem extrair ROMs para disco.
- Publicado `romComprehensiveAudit.js`: execução combinada Red/Blue/Green, verificação de SHA-256 e cabeçalho, leitura completa dos 64 bancos por ROM, hash por banco, divergências exatas de bytes e intervalos, classificação conservadora de cada byte, catálogo por espécie/golpe/mapa/encontro/treinador/evento com proveniência quando validada, 14 domínios explicitamente não certificados.
- Resultados diferenciais diretos sobre os três ficheiros reais: Red×Blue 26 670 bytes distintos (14 bancos); Red×Green 147 468 (32 bancos); Blue×Green 162 243 (32 bancos). 3 ROMs de 1 048 576 bytes, total 3 145 728 bytes examinados.
- Executada prova local com adaptador do atlas histórico: 6/6 testes Node aprovados; em cada ROM 24 580 bytes anotados como descodificados, 22 935 bytes com reconhecimento apenas estrutural e 1 001 061 sem classificação por intervalos, sobre este atlas e não sobre uma desmontagem completa. Não é métrica de % das mecânicas entendidas.
- Publicado `tests/romComprehensiveAudit.test.js`: 4/4 testes estáticos aprovados; 3 verificações SHA diretas das três ROMs reais aprovadas quando os caminhos são fornecidos. O teste integrado de todos os leitores do repositório fica condicionado à árvore real do projeto e aos três ficheiros ROM locais; não foi executado neste ambiente.
- Atualizado `package.json` com `npm run audit:roms` e `npm run test:audit:roms`. Gerado inventário JSON local (sem bytes originais) e documentação `docs/AUDITORIA_INTEGRAL_64_BANCOS_3_ROMS_20261028.md`.
- Nenhuma ROM, save, perfil/tokens/sessão Antigravity, dados TIMI/Maestro/BonChat ou ficheiros C: do computador do utilizador foram alterados. Sem GitHub Actions nem automações de consumo de minutos. Histórico atualizado exclusivamente por acrescento.
- A cobertura semântica de 100%, snapshot RAM atómico, scripts completos, efeitos de todos os golpes e validação no iPhone continuam não certificados; não apresentar a execução parcial como 100% de jogabilidade.


## 2026-10-28 — Implementação conjunta dos mapas, scripts, metabloco e guia ao vivo

1. Auditoria em lote das três ROMs SHA-256: 64 bancos em cada ficheiro; acrescentado `romMapCodeAtlas.js` para 226 entradas de scripts por versão (223 endereços únicos), 1 126 referências válidas de texto por versão e grafo candidato de 2 821 instruções/6 331 bytes, registando 7 transferências sem resolução estática por versão. Nenhuma instrução candidata implica execução confirmada.
2. Corrigida a leitura do byte de texto dos objetos: mascarar os bits 0x40/0x80 reservados ao tipo treinador/Pokémon fixo antes de interpretar os 6 bits de índice de texto; após a correção, ponteiros inválidos no conjunto de referência: 0 nas 3 ROMs.
3. Criado `romAreaGuide.js`: 248 fichas por ROM (226 com cabeçalho normal validado), com saídas, placas, NPC, itens visíveis/ocultos quando auditados, equipas estáticas de treinadores quando comprovadas e pesos de encontros por espécie/nível. Flags de recolha, vitória, menus, terreno e passagem permanecem desconhecidas na ausência de RAM atual.
4. Geradas matrizes de IDs de metabloco para os 226 mapas normais por ROM, com dimensões e SHA-256 verificados: 23 783 bytes por variante, 71 349 no total; IDs de bloco não provam colisões, píxeis nem paleta.
5. Integrados `mapScriptsAndCode` e `mapGuides` no `romComprehensiveAudit.js` e exportadas as matrizes de blocos nos dados offline. Atualizado `retroarchClient.js` para gerar `romStaticMapGuide` após leitura confirmada do ID de mapa e invalidá-lo quando os dois valores RAM divergem. Atualizada a UI em `public/app.js` com saídas, placas e NPCs do mapa, sem afirmar estados de eventos não observados.
6. Adicionados testes `romMapCodeAtlas.test.js` e `romAreaGuide.test.js`, e reforçada a integração `romComprehensiveAudit.test.js`. Executados LOCALMENTE **16/16 testes Node aprovados, 0 ignorados**, incluindo seis casos diretamente sobre Red ZIP, Blue e Green SHA-256. A execução integral `npm test` do repositório, a GUI real e o emulador continuam sem prova nesta sessão.
7. Resultados e limites publicados em `docs/AUDITORIA_MAPAS_SCRIPTS_GUIAS_20261028.md`. Ficheiros auxiliares locais (JSON e CSV) gerados exclusivamente com dados derivados, sem ROMs nem saves. Histórico preservado por acrescento; sem GitHub Actions nem acesso ao computador do utilizador.
**Estado:** avanço concreto nos 3 binários e integração runtime/visual publicada. 100% semântica do código, mapas/eventos e combate **não certificada**; testes reais do Companion/RetroArch/SameBoy e snapshots de ecrã não executados.


## 2026-10-28 — Corrigidos os 22 IDs de mapa reservados incorretamente contados como lacunas

1. Na avaliação crítica da auditoria anterior, identificou-se uma falha do próprio processo: 22 IDs sem cabeçalho normal estavam indistintamente apresentados como mapas pendentes, apesar de constarem no `pret/pokered/constants/map_constants.asm` como `UNUSED_MAP_..` (dimensões 0×0). IDs: `11, 105, 106, 107, 109, 110, 111, 112, 114, 115, 116, 117, 204, 205, 206, 231, 237, 238, 241, 242, 243, 244`.
2. Modificado `romAreaGuide.js` para classificar os 22 IDs como `RESERVED_ID_NO_NORMAL_ROM_HEADER` sem afirmar que hacks arbitrários não podem usar essas posições. Novos campos `referenceUnusedSlot`, `referenceSource` e contagens `normalHeadersValidated`, `reservedIdsWithoutHeader`, `unresolvedNonReservedIds`. Os IDs reservados mantêm `verified:false` para não serem apresentados como mapas jogáveis ou como garantia sobre todas as variantes não auditadas.
3. Corrigido `romComprehensiveAudit.js`: novas contagens `reservedMapIdsWithoutHeader` e `unresolvedMapIdsBeyondReserved`; o resumo da CLI mostra separadamente IDs reservados e lacunas de cabeçalhos não reservados. Adicionado teste de regressão em `tests/romAreaGuide.test.js` com 248 IDs e 22 reservas.
4. Executado Node.js v22.16.0 localmente contra os três ficheiros originais enviados: Red lida diretamente do ZIP, Blue e Green International v1.2.1 em `.gb`, e conferência SHA-256 de cada um com os hashes fixados no projeto. Confrontado cada um com o atlas da fase anterior: **226 cabeçalhos normais, 22 IDs reservados pela referência e 0 lacunas de cabeçalho fora dos IDs reservados**, em cada versão. Esta contagem é **sobre o catálogo de mapas** e não certifica scripts, eventos, NPCs, colisões ou estado do emulador.
5. Nenhuma modificação de ROM/save. Histórico atualizado apenas por acrescento. Não foi executada a suite integral nem ensaio do emulador; continuar a marcar essas provas como pendentes. Conclusão: a indicação anterior de «22 mapas por descodificar» era enganadora e foi corrigida, em vez de repetida.


## 2026-10-28 — Economia, trocas, pesca e 83 handlers de itens nas três ROMs

1. Investigados os bytes reais de Red/Blue/Green International v1.2.1 e confrontados com as fontes primárias `pret/pokered`: tabelas `ItemPrices` (83 preços regulares), `TechnicalMachinePrices` (50 preços), scripts de 16 lojas (14 referenciadas na referência, 2 não usadas), `VendingPrices` (3), `TradeMons` (10 registos), `PrizeMenu` (9 prémios), `SuperRodData` (33 mapas), `GoodRodMons` (2) e `ItemUseOldRod` (Pokémon fixo/nível).
2. Detetada e preservada diferença REAL da Green International: a primeira troca Red/Blue 167→168 'TERRY', Green 1→2 'RODIN'; na loja de prémios, custo do primeiro Pokémon 180 moedas Red, 120 Blue, 150 Green. Não substituir informação específica da Green por cânones Red/Blue.
3. Implementado `pokemon-ai-companion/romEconomyTrades.js`, com oito famílias de tabelas SHA-256-gated e validação de estrutura. O despacho `ItemUsePtrTable` foi lido e verificado: 83 itens e 30 handlers, todos com ponteiros de banco 3 correspondentes à mesma tabela nas 3 ROMs. Identificar o handler não prova a sua execução dinâmica completa.
4. Integrado no `romVariantRegistry.js`, `romComprehensiveAudit.js`, `romAreaGuide.js` e `public/app.js`, incluindo lojas, preços, trocas, prémios, vending e pesca por mapa. Todos os estados de aquisição, NPCs ativos, flags e elegibilidade de pesca permanecem explicitamente indeterminados sem RAM.
5. Descoberto e resolvido impedimento em perfis existentes: `romLiveResolver.js` agora pode anexar `data/gen1EconomyTradesAudited.json`, dados derivados diretamente dos três binários e condicionados a SHA-256, CRC32 e tamanho; não inclui ROM nem saves e nunca substitui resultados de leitura direta. A identificação por CRC32 do emulador **não** equivale à prova SHA-256 do binário em execução.
6. Testes reais locais: **10/10 Node aprovados, zero ignorados** com as 3 ROMs e teste de corrupção. Adicionados `tests/romEconomyProfileImport.test.js` e `tests/romEconomyAreaIntegration.test.js` (não foram executados na árvore completa). Métodos efetivamente publicados avaliados isoladamente em V8 para Red/Blue/Green: enriquecimento de três perfis, rejeição de CRC errado, preservação da leitura direta, preços/serviços corretos em mapas. Não houve testes E2E do frontend, SameBoy, RetroArch ou screenshots.
7. Documentação `docs/AUDITORIA_ECONOMIA_TROCAS_PESCA_20261028.md` publicada com fontes, diffs, denominadores e lacunas. ROMs e saves preservados; não acionadas GitHub Actions nem o computador do utilizador; histórico modificado estritamente por acréscimo.
**Estado da meta de 100%:** ainda NÃO comprovado. Restam scripts e ramos dinâmicos, combate e captura completos, condições de exploração, identidade RAM e validação do emulador. Este registo não fecha artificialmente os requisitos.


## 2026-10-28 — Despacho de 165 golpes para 86 efeitos auditado

- Na continuação do lote de economia, extraiu-se de forma binária a `MoveEffectPointerTable` (banco 15, 86 entradas de 2 bytes) das três ROMs exatas, cruzando com 165 entradas de `Moves`. Encontrados 35 destinos de handler, dos quais um é NULL, usado em 7 slots. Nos 165 golpes, 123 têm dispatch através desta tabela; os restantes 42 têm caminho normal ou lógica especial do motor central. O código da tabela e a associação dos 165 golpes são idênticos nos três binários auditados.
- Criado `pokemon-ai-companion/romMoveEffectDispatch.js` com validação SHA-256 obrigatória, falha segura para tabelas e ponteiros fora do layout, e sem atribuição fictícia de resultado de combate. `NULL` não significa ausência de efeito (ex.: Jump Kick). `effectOutcomeCertified=false` permanece obrigatório.
- Executados localmente **5/5 testes Node, nenhum ignorado** em `tests/romMoveEffectDispatch.test.js` com Red no ZIP, Blue e Green de 1 MiB, incluindo rejeição de ROM adulterada, concordância do dispatch e controlo de `NULL`.
- Integrado no `romVariantRegistry.js`, `romComprehensiveAudit.js` e `retroarchClient.js` (`effectHandlerFromAuditedRom`, `effectHandlerPointerCpu`, `effectOutcomeCertified=false`). Criado `data/gen1MoveEffectDispatchAudited.json` somente com metadados derivados das três ROMs, sem binários originais ou saves. `romLiveResolver.js` enriquece perfis existentes condicionados aos hashes SHA-256 + CRC32 + tamanho, preservando a leitura direta quando disponível.
- Métodos efetivamente publicados de enriquecimento testados isoladamente em V8 para as três variantes: perfis recebem 165 golpes, 86 efeitos e 83 itens; não é teste E2E. Reforçados testes de importação; estes testes novos não foram executados na árvore Node completa.
- Relatório publicado em `docs/AUDITORIA_DESPACHO_EFEITOS_GOLPES_20261028.md`. Não executadas GitHub Actions, emulador, screenshots nem interação com o Windows do utilizador. História acrescentada sem substituir entradas anteriores.
- Pendências explícitas: sem prova de execução completa dos 34 handlers concretos, dos casos especiais em `core.asm`, das regras/flags, RNG, turnos e estado em direto. 100% do jogo **não certificado**.


## 2026-10-28 — Continuação: saídas completas, ligações exteriores, elevadores e LAST_MAP por RAM

1. Corrigida incompatibilidade efetiva entre `romWorldData.js` (dados de saída `destinationMap`/`destinationWarp`, classes e níveis em `trainerClassOrItemId`/`trainerNumberOrLevel`) e `romAreaGuide.js` (esperava indevidamente `map`/`warp` e `metadata`). O guia normaliza os campos reais de warp, objeto de item, treinador e encontro fixo, preserva ordinais de objetos e liga índices `eventBitIndex` aos cabeçalhos de treinador e de encontro fixo, sem inferir recolha/vitória a partir da mera presença na ROM.
2. Criado `romWarpGraph.js`: 813 warps de quatro bytes por ROM, com 560 destinos estáticos e índices válidos, 251 saídas dinâmicas `LAST_MAP=FF` e 2 de Silph Co que apontam para o ID reservado 237 e são alteradas pelo script. Comparados byte a byte com os 813 registos originais de Red/Blue/Green, em 226 mapas normais e hashes SHA-256 confirmados. O grafo recusa contagens divergentes.
3. Criado `romOutdoorConnections.js`: descodificação dos 11 bytes de cada ligação de fronteira, respeitando a ordem N/S/W/E e os bits 8/4/2/1. São 78 ligações por ROM, com 78 inversas verificadas e nenhum destino reservado; confrontadas com as três ROMs. Combinadas com warps estáticos, tornam 220/226 mapas alcançáveis a partir de Pallet no grafo restrito, o que NÃO prova acessibilidade na partida real.
4. Criado `romElevatorDestinations.js`: dados reais das tabelas de elevadores Celadon (5 pisos), Rocket Hideout (3) e Silph Co (11), total 19 opções por ROM; IDs dos mapas e índices de chegada verificados nos binários. `wWarpEntries` é reprogramado pelo script; a escolha atual não é deduzida da ROM.
5. Integrados `world.outdoorConnections`, `world.elevatorDestinations` e `world.warpGraph` em `romVariantRegistry.js`; `romLiveResolver.js` acrescenta os dados derivados `data/gen1OutdoorConnectionsAudited.json` e `data/gen1ElevatorsAudited.json` a perfis importados apenas sob SHA-256/CRC32/tamanho validado. `romAreaGuide.js` e `public/app.js` mostram portas, saídas exteriores e elevadores sem afirmar acessibilidade atual. `romComprehensiveAudit.js` preserva os três índices no catálogo offline.
6. Criado `romLastMapEvidence.js` e integrado em `retroarchClient.js`: releitura contígua RAM D35E..D365, confirmação de mapa D35E, comparação do `wLastMap` D365 ao byte do bloco original (offset 525), validação do mapa e índice de warp contra o perfil da ROM, anotação de destino sem sobrescrever o `FF` original. Mapas alterados, bytes contraditórios e índice inválido recusados. A dupla leitura continua não atómica, assinalada explicitamente na UI.
7. TESTES LOCAIS: `romWarpGraph` 5/5, `romOutdoorConnections` 4/4, integração dos dois 3/3, `romElevatorDestinations` 4/4 e `romLastMapEvidence` 3/3: TOTAL **19/19 testes Node aprovados, nenhum ignorado**. Os casos Red/Blue/Green usam os ficheiros efetivos de 1 MiB, Red dentro do ZIP, e inspecionam os bytes ROM originais. Testes sintáticos e de componentes publicados em GitHub; a suite geral do projeto e a execução do cliente RetroArch/SameBoy/iPhone NÃO foram efetuadas nesta sessão.
8. Relatório `docs/AUDITORIA_NAVEGACAO_WARPS_BORDAS_ELEVADORES_20261028.md` criado e complementado. Sem executar Actions, modificar ROMs/saves, mudar dados Windows C:, alterar Antigravity, TIMI/Maestro/BonChat ou divulgar ROMs. Entrada adicionada exclusivamente no fim do histórico; nenhuma entrada anterior foi removida.
**Estado 100%:** ainda não comprovado. Restam semântica integral dos scripts e efeitos, acesso/colisões dependentes de eventos, RAM atomicamente coerente, identidade SHA real do cartucho em execução, testes E2E e capturas visuais.


## 2026-10-28 — Matriz de terreno completa: 24 tilesets, 678 mapas e regras de colisão

1. Descoberto um domínio até aqui ausente: o tileset define **os tiles permitidos para caminhar**, e os metabloco IDs dos mapas precisam ser expandidos em grupos de 4×4 tiles de 8 pixels. Verificaram-se os ponteiros de `Tilesets` banco 3 0x47BE, os blocksets de cada tileset, as listas de tiles de passagem, os bitmaps de 226 mapas por ROM e os índices 0..95 de cada tile.
2. Implementado `romTerrainAtlas.js` com 24 tilesets, 226 mapas e 95 132 posições de 16 pixels por ROM (23 783 metabloco IDs por ROM). Em Red e Blue: 48 504 tiles permitidos por terra e 46 628 bloqueados. Em Green Intl 1.2.1: 48 570 permitidos e 46 562 bloqueados; **66 diferenças efetivas de passagem de base**, sem IDs inválidos nem offsets fora do banco. Matrizes por mapa com tile IDs e bitmap de passagem, ambos com SHA-256; nenhuma ROM inteira ou save foi publicada.
3. Descobertas e validadas no próprio binário as 11 exceções de colisão entre dois tiles de terra e 3 regras equivalentes na água. A busca de percurso de terreno considera as restrições de pares em terra. Não reproduz ainda saltos de ledge, scripts dinâmicos, NPCs, Surf, Cut, Strength ou colisões de sprites.
4. Criados os catálogos apenas de dados derivados `data/romTerrain_red.json`, `romTerrain_blue.json` e `romTerrain_green.json`. `romVariantRegistry.js` descodifica terreno na leitura direta; `romLiveResolver.js` enriquece perfis antigos **apenas** quando SHA-256, CRC32, tamanho ROM e hashes de todos os 226 mapas coincidem. Foi testada isoladamente a integração do método publicado nas três variantes e a rejeição de um único hash alterado.
5. `romAreaGuide.js` apresenta `terrain` somente após compatibilidade com mapa/tileset; `retroarchClient.js` lê o tile da coordenada RAM atual apenas quando as dimensões concordam com a ROM e o mapa foi corroborado. Ao mudar o mapa durante o ciclo, invalida explicitamente o tile e as propostas antigas; nunca afirma atomicidade. `public/app.js` apresenta dimensões, terreno permitido/bloqueado e tile atual com avisos de acessibilidade.
6. `romTerrainRouteHints.js`: até 24 caminhos de terreno hipotéticos até saídas do mapa, com primeiro passo e distância; UI mostra até 6. São propostas do terreno estático, não rotas garantidas. A função `findTerrainRoute` rejeita tiles bloqueados e pares de elevação proibidos, bem como matrizes/hash adulterados. Atualizada `romComprehensiveAudit.js` para incluir os resultados no lote global.
7. Testes Node locais sobre os ficheiros originais Red ZIP, Blue e Green e catálogos derivados: `romTerrainAtlas.test.js` **6/6**, `romTerrainRouteHints.test.js` **4/4**, `romTerrainCatalogueIntegrity.test.js` **3/3**: **13/13 aprovados, zero ignorados**. Verificados 285 396 tiles de colisão, integridade do bitmap e seleção por tileset. O teste geral do Companion, SameBoy/RetroArch/iPhone e prova visual não foram executados.
8. Documentação `docs/AUDITORIA_TERRENO_COLISOES_3_ROMS_20261028.md` criada, com fontes `pret/pokered`, proveniência, hashes e limites. Sem GitHub Actions, alterações de ROMs/saves nem alterações às sessões protegidas Antigravity/TIMI/Maestro/BonChat. Histórico atualizado somente por acrescento.
**Estado 100%:** análise dos tilesets e terreno básico comprovada; continua **não certificada** a totalidade da física de deslocação, scripts, efeitos de combate, RNG/estado RAM atómico e interface no emulador real.


## 2026-10-28 — Fecho verificável da fase de terreno: alterações Green, validador rigoroso e 17 testes

- A análise comparativa de todos os 226 mapas de cada variante mostrou **zero alterações de passagem entre Red e Blue**, mas **642 posições alteradas entre Red/Blue e Green Intl**: 354 ficam permitidas na Green, 288 deixam de o ser, saldo +66. As alterações concentram-se **exclusivamente** em Cerulean Cave 2F (ID 226: 216 alterações), B1F (ID 227: 236) e 1F (ID 228: 190). Não generalizar estas diferenças a outros 223 mapas.
- Criados `romTerrainVariantDiff.js` e `data/gen1TerrainDifferences.json` (apenas coordenadas/flags derivadas, sem binários ROM). Atualizado `romAreaGuide.js` e `public/app.js` para identificar alterações exatas do piso atual quando identidade e matriz SHA estão verificadas. Esta evidência não prova acessibilidade real durante a partida.
- Publicado `scripts/verifyRealRomTerrain.js`: modo rigoroso e apenas leitura. Exige 3 ROMs verdadeiras, SHA + atlas; se faltar algum ficheiro **falha**, nunca converte ausência em teste `skip`. Exposto em `package.json` como `npm run audit:terrain:strict`; `npm run test:terrain` executa as quatro suítes.
- Execução rigorosa local: `RESULTADO=3/3_ROMS_REAIS_VERIFICADAS cells=285396 walkable=145578`. Suite conjunta Node: **17/17 testes aprovados, 0 ignorados**, incluindo comparação das três variantes, recusa de hashes adulterados e matrizes de colisão, caminhos de terreno e mudança de piso.
- `retroarchClient.js` atualizado para invalidar imediatamente `romTerrainCurrentTile` e `romTerrainWarpHints` quando D35E diverge entre leituras, evitando reutilização do mapa anterior. Sem garantia de RAM atómica; permanece explícito.
- Relatório aprofundado: `docs/AUDITORIA_TERRENO_COLISOES_3_ROMS_20261028.md` atualizado por adenda. Todas as ROMs/saves intactos; não executadas GitHub Actions nem testes do emulador. `100%` global do Companion continua **não certificado**.


## 2026-10-28 — Continuação: Surf, pares de colisão em água e prova independente dos tilesets

- Antes de duplicar o trabalho, confirmou-se que `romTerrainAtlas.js`, `romTerrainRouteHints.js` e o painel do Companion **já implementavam** 24 tilesets, 226 mapas, 95 132 células por ROM e percursos condicionais. A nova auditoria `romTerrainCollision.js` foi mantida como **segunda implementação independente apenas para conferência/testes**, retirando-se o seu carregamento redundante do runtime em `romVariantRegistry.js` e `romLiveResolver.js`. Os dados derivados `data/gen1TerrainCollisionAudited.json` ficaram no repositório para verificações cruzadas; não são um segundo motor de recomendações.
- As três ROMs originais SHA-256 conferidas foram lidas localmente. Contagens por versão: **24 tilesets, 226 cabeçalhos normais de mapa, 23 783 metablocos, 95 132 células, 11 pares de colisão em terra e 3 em água**. Células passáveis no terreno base: Red 48 504, Blue 48 504, Green 48 570. Os IDs de tiles da Green diferem em **950 posições** nos mapas 226, 227 e 228; **642 posições mudam de classe de passagem**. Resultados coincidem com a implementação `romTerrainAtlas.js` anterior.
- Acrescentado `romTerrainMovement.js`, que segue `pret/pokered/home/overworld.asm` em `CollisionCheckOnLand` e `CollisionCheckOnWater`, para reconhecer pares proibidos, água (tiles 0x14 e 0x48), exceção do tile 0x32 em Ship Port e transição Surf→terra, em quatro direções por posição. Mantém `actualMovementVerified:false` e `atomicSnapshotVerified:false`.
- Corrigido `retroarchClient.js`: o byte RAM `wWalkBikeSurfState=D700` inválido ou ausente deixava o programa assumir `0=PE A PÉ`. Agora apenas `0,1,2` são aceites como prova; fora desse conjunto `movementMode` indica desconhecido e `romMovementOptions` recusa sugestões. Alteração do ID de mapa invalida também esse campo. `public/app.js` apresenta quatro opções de terreno com avisos explícitos de dinâmica e RAM.
- Validação local feita nesta sessão: **9/9 testes do novo auditor independentes** sobre as três ROMs e alterações de hashes e **5/5 testes de regras Pé/Bicicleta/Surf** com grelhas sintéticas controladas. **14/14 aprovados, zero skips**. Os testes de grelhas são sintéticos, NÃO substituem execução ao vivo. Verificados os módulos JavaScript publicados quanto à sintaxe, mas **não** executada a suite global do repositório, nem RetroArch/SameBoy/iPhone.
- `package.json` atualizado: `npm run test:terrain` inclui os dois módulos novos; `npm run test:terrain:real` exige o verificador estrito das ROMs antes dos testes. Sem GitHub Actions, sem mudanças nas ROMs/saves, Antigravity, TIMI/Maestro/BonChat, Windows C: ou perfis do utilizador. Histórico preservado exclusivamente por acrescento.
- **Estado da meta 100%:** terreno estático amplamente auditado, mas colisões/obstáculos móveis, scripts, turnos de combate completos, identidade SHA da ROM carregada e validação visual real continuam sem certificação. Nunca interpretar bytes lidos como todas as mecânicas conhecidas.


## 2026-10-28 — Verificação independente dos 95 132 tiles de colisão em cada ROM

- O código anterior já continha `romTerrainAtlas.js`/`romTerrainCollision.js`, dados derivados importáveis, testes e heurísticas de movimento. Não se apresenta esta fase como descoberta inicial das colisões; criou-se um **segundo descodificador independente**, `romTilesetCollisionAudit.js`, para confrontar todas as células e tabelas com o leitor existente.
- Reanalisadas **as três ROMs binárias reais**, Red dentro do ZIP e Blue/Green em GB, todas com SHA-256 previamente verificado. Por ROM: 24 cabeçalhos de tileset, 226 mapas normais, 23 783 células de metabloco, 95 132 células de colisão, 11 pares de bloqueio de terra e 3 de água. Red/Blue com 48 504 tiles permitidos pela whitelist estática, Green com 48 570. Em nenhuma versão o cálculo autoriza afirmar que o jogador pode atravessar agora um tile.
- Testes locais `tests/romTilesetCollisionAudit.test.js`: **5/5 PASS e 0 SKIP**, incluindo os três ficheiros originais e testes negativos de ROM truncada/fora de SHA, coordenadas e transição entre pares. A leitura é independente e não altera ROMs.
- Conferidas as SHA-256 por mapa produzidas pelo novo leitor contra os dados já presentes no GitHub. FNV-1a 64-bit sobre a sequência de `mapId:sha256`: Red/Blue `b3a09547f960c6ad`, Green `5a9fe48fa645bd2f`; as três sequências de 226 mapas coincidem. Este fingerprint não dispensa a comparação byte a byte implementada no teste estrito.
- Atualizado `scripts/verifyRealRomTerrain.js` para **recusar a prova integral quando qualquer tile ID, bit do mapa de colisões, lista dos 24 tilesets ou uma das 14 regras por pares divergir** entre os dois leitores. Atualizado `package.json` para incluir o segundo leitor no `test:terrain`. Esta verificação conjunta foi publicada e validada sintaticamente, mas **a suite integrada do repositório não foi executada nesta sessão**.
- Relatório de evidência: `docs/AUDITORIA_DUPLA_COLISOES_ROM_20261028.md`. O ficheiro de dados existente `data/gen1TerrainCollisionAudited.json` foi preservado: não foi substituído por um duplicado maior. Nenhuma ROM/sessão/save foi alterada; sem GitHub Actions nem ficheiros C: do utilizador. Histórico atualizado exclusivamente por acrescento.
- **Pendência para 100%:** validação de todo o motor em execução, flags/scripts, colisões dinâmicas, Surf/Strength/Cut, caminhos de combate e snapshots atómicos. Não há certificação 100% de movimento nem do jogo.


## 2026-10-28 — Saliências direcionais verificadas pela ROM e integradas na movimentação

- Depois da auditoria independente dos 95 132 tiles, localizada na fonte `pret/pokered/engine/overworld/ledges.asm` a rotina `HandleLedges` que consulta a tabela `LedgeTiles`. Os três binários originais contêm o mesmo conjunto de oito entradas (33 bytes terminados em `FF`) no banco 6 CPU `66CF` (offset `0x1A6CF`): três para Sul, duas para Oeste e três para Este; só o tileset OVERWORLD usa a tabela.
- Criados `romLedgeRules.js` e `tests/romLedgeRules.test.js`. Verificação SHA-256 obrigatória, saída segura para bytes/ROM desconhecidos. `ledgeCandidate` distingue o padrão potencial de salto, mas nunca certifica movimento executado sem flags RAM, input e frame coerentes.
- Atualizados `romVariantRegistry.js` (`world.ledgeRules` lida do binário), `romTerrainMovement.js` (campo `ledgeEvidence` e indicação explícita `LAND_LEDGE_HOP_CANDIDATE_REQUIRES_JOYPAD_AND_FLAGS`), `public/app.js` (aviso na direção relevante), `romComprehensiveAudit.js` (índice de oito entradas), `package.json` (teste novo incluído em `test:terrain`), `scripts/verifyRealRomTerrain.js` (verificação dos oito registos como condição da auditoria rigorosa).
- Executados localmente os testes combinados **9/9 PASS, 0 SKIP**, usando Red ZIP, Blue GB e Green International GB enviados, e casos negativos. No teste local foi usado o atlas original em `/mnt/data`; não há prova de execução da suite completa do repositório, nem screenshots do emulador nesta sessão.
- Análise documentada na adenda de `docs/AUDITORIA_DUPLA_COLISOES_ROM_20261028.md`. Nenhuma ROM/save/token/sessão, aplicações Windows ou histórico anterior alterados. Histórico exclusivamente por acrescento. **Meta de 100% ainda não certificada**, sobretudo semântica de scripts completos, colisões com estado em direto, RNG/batalhas e provas E2E.


## 2026-10-28 — Verificação do módulo de terreno existente e correção de alegação obsoleta

- Inspecionados os módulos já publicados `romTerrainAtlas.js`, `romVariantRegistry.js` e `romAreaGuide.js`: o repositório **já** continha extração de metabloco 4×4, 24 cabeçalhos de tileset, colisões por tile e pares de colisão e ligação do resultado à ficha do mapa através do campo `terrain` com validação de SHA-256. Não era correto afirmar que esses descodificadores ainda estavam por implementar.
- Corrigido o texto/estrutura de `validatedBlockGrid()` em `romAreaGuide.js`: os IDs de metabloco continuam separados do mapa estático de passabilidade em `terrain`; este último permanece condicionado às provas da ROM e não equivale a acessibilidade instantânea na partida.
- Verificada sintaxe JavaScript do ficheiro alterado. **Não** foi executada nesta operação a suite Node integral do repositório, uma sessão do emulador ou captura de interface. Nenhuma ROM ou save alterado. Histórico preservado por acrescento.


## 2026-10-28 — Coerência RAM das coordenadas e do modo de deslocação

1. Foi revista a estrutura de terreno já existente (`romTerrainAtlas.js`, `romTerrainCollision.js`, `romTilesetCollisionAudit.js`, `romTerrainMovement.js`); não foram criados descodificadores redundantes no repositório. Uma leitura independente local dos três binários Red ZIP, Blue GB e Green International 1.2.1 GB reproduziu o atlas: 24 tilesets, 226 mapas, 23 783 metabloco e 95 132 células por variante, com whitelist land Red=48 504, Blue=48 504, Green=48 570; 11 pares terrestres e 3 aquáticos. **6/6 testes locais aprovados, 0 ignorados**. Os ponteiros das tabelas Green diferem dos Red/Blue e devem ser lidos da própria ROM.
2. Identificado defeito efetivo de sincronização: `retroarchClient.js` confirmava D35E mas aceitava coordenadas D361/D362 de leitura anterior, mesmo quando o jogador se deslocava no mesmo mapa. Criado `romMapPositionConsistency.js`, comparando mapa/Y/X de D35E/D361/D362 da leitura inicial com bytes 0/3/4 do bloco repetido D35E..D365. A igualdade não prova atomicidade, mas a divergência invalida as recomendações de tile, direções e percursos. **6/6 testes Node locais aprovados, 0 ignorados**.
3. Corrigido segundo risco temporal: D700 (`wWalkBikeSurfState`) podia mudar entre leituras; criado `romMovementModeConsistency.js` para exigir duas observações iguais e válidas 0/1/2 (WALK/BIKE/SURF) antes das recomendações de movimento. A segunda observação é obtida via `readMemoryBlock('D700',1)`. Caso contrário, o modo passa a desconhecido e os conselhos de movimento são bloqueados. **4/4 testes Node locais aprovados, 0 ignorados**.
4. `public/app.js` apresenta o motivo de rejeição explícito para coordenadas ou modo de deslocação incoerentes. Novos testes integrados na suite Node através de `npm run test:ram:consistency` no `package.json`. Relatório completo: `docs/AUDITORIA_COHERENCIA_COORDENADAS_RAM_20261028.md`.
5. Garantias e limitações: não foi executada a suite integral na árvore completa do projeto, nem o Companion real no emulador/iPhone; não há snapshot RAM atómico certificado. Nenhuma ROM, save ou perfil protegido foi alterado. Histórico preservado exclusivamente por acrescento. **O projeto não está certificado a 100%.**


## 2026-10-28 — Recusa de SHA-256 inventado nas fórmulas Gen I
- Defeito reproduzido nos quatro módulos existentes: uma string de 64 zeros e `evidence` booleana fabricada produzia `verified:true` para captura, precisão, crítico e encontros. `romKnownSha256.js` centraliza os três SHA-256 exatos Red, Blue e Green International v1.2.1; os módulos de captura, precisão, crítico/dano e encontros agora exigem pertença ao catálogo.
- Em ensaio isolado sobre o texto dos quatro módulos atualizados, 16/16 asserções V8 aprovadas: hash inventado recusado, três hashes reconhecidos admitidos por cada módulo. Criado `tests/gen1KnownRomProvenance.test.js` para seis ramos e documentação `docs/AUDITORIA_PROVENIENCIA_FORMULAS_GEN1_20261028.md`. Suite completa Node, interface, iPhone e screenshots não executados.
- Não confundir hash conhecido com prova da ROM no emulador ou snapshot RAM atómico. Todas as ROMs/saves/sessões Antigravity e restantes aplicações intactas; sem operações no PC do utilizador nem GitHub Actions. Histórico anterior preservado por acrescento.


## 2026-10-28 — Auditoria estrita, com 3 ROMs reais, das tabelas de batalha
1. Recuperadas as três ROMs originais de 1 MiB para ambiente isolado; verificados SHA-256 completos e checksums dos cabeçalhos. Nenhuma ROM ou save foi modificado.
2. Comparados byte a byte, nas três ROMs, os 990 bytes dos 165 golpes, 172 bytes do despacho de 86 efeitos, 26 bytes dos 13 rácios de modificadores e as duas listas de 5 bytes HighCriticalMoves/UnusedHighCriticalMoves. Todas as cinco regiões são idênticas entre as três variantes. Relatório com hashes por região: `docs/AUDITORIA_PARIDADE_BATALHA_3_ROMS_20261028.md`.
3. Criados `scripts/verifyRealRomBattleTables.js` (leitura estrita, recusa ficheiros ausentes, links, SHA incorreto, estruturas inválidas e divergências) e `scripts/verifyBattleTablesStrict.cjs`. Com as três ROMs reais: **6/6 testes Node aprovados, zero ignorados**; testados casos negativos de ROM modificada, truncada, trocada e ausente. Sem as ROMs, a auditoria falha em vez de sugerir cobertura.
4. Acrescentados comandos explícitos `audit:battle:real` e `test:battle:real` a `pokemon-ai-companion/package.json`, sem ativar GitHub Actions e sem forçar a suite normal a necessitar de ROMs. Não há prova nesta fase da interface GUI/emulador/iPhone nem da execução integral de todas as rotinas de efeito. Histórico preservado só por acrescento e sessões Antigravity/TIMI/Maestro/BonChat intactas.


## 2026-10-28 — Integração direta de dados de combate no painel
- Criado `gen1LiveBattlePreview.js`: recebe os quatro golpes/PP e estágios efetivamente lidos na RAM, tabela de 165 golpes, rácios de precisão da ROM local e verificação da segunda leitura; mostra precisão **condicional** para golpes com efeito simples e percentagens de captura condicionais apenas para combate selvagem com `D007` verificado.
- Integrado `buildLiveBattlePreview` no `retroarchClient.js` e painel de batalha `public/app.js`. Corrigida origem do PP durante a batalha: `wBattleMon` lido agora, não estado antigo da equipa.
- Todos estes valores são rotulados `verified:false` porque RetroArch fornece CRC32, não SHA256 dos bytes de execução, e as duas amostras RAM não são atómicas. Não são disponibilizadas previsões não fundamentadas de dano, crítico, KO ou melhor golpe.
- Testes unitários em `tests/gen1LiveBattlePreview.test.js` distinguem RAM/ROM recusada, efeitos especiais, compatibilidade com motores de precisão/captura e batalha de treinador. Não existem testes reais do emulador/iPhone nesta alteração.


## 2026-10-28 — Interface sem probabilidades inventadas em espera
- Removido fallback de `100%` de precisão quando o golpe da equipa não traz o respetivo byte validado; mostra agora `não validada` e distingue precisão base sem modificadores.
- Em standby deixa de prometer que IA já calcula dano/KO exato de imediato e oculta a caixa de captura sem alvo selvagem atual.
- Confirmada sintaxe do `public/app.js`; testes de interface em dispositivo continuam por realizar.


## 2026-10-28 — Motor de batalha: dano por tipos, STAB e KO condicional
- `gen1LiveBattlePreview.js` agora integra o dano padrão para efeitos 0, tipos físicos/especiais da Gen I, STAB, regras ordenadas dos 82 pares TypeEffects, escalonamento da Gen I quando ataque/defesa >255, 39 resultados da rolagem 217–255, probabilidade condicional de KO sem crítico, precisão e base crítica sem Focus Energy.
- Os quatro golpes do jogador e os golpes disponíveis do adversário são tratados independentemente. É identificado apenas um candidato de maior dano médio **entre golpes calculáveis**, sem alegar ser ótimo com críticos/efeitos. Efeitos especiais, burn físico, estágios relevantes alterados, ROM não auditada ou RAM incoerente recusam cálculo sem estimativas inventadas.
- `public/app.js` apresenta dano min–max, chance condicional de KO, crítico teórico e ameaças adversárias; cada rótulo indica explicitamente os pressupostos. Não permite marcar `exactTurnMathReady:true` nem `verified:true` com CRC32, nem pretende detetar Reflect/Light Screen sem flags RAM.
- Testes unitários acrescentados em `tests/gen1LiveBattleAdvisor.test.js` (9 casos), incluindo dano tipado, imunidade, escalonamento, burn, boosts, KO, captura, crítico, recusa de prova e compatibilidade com os motores pré-existentes. Estes testes usaram fixture de valores de combate e não são uma execução do emulador/iPhone.


## 2026-10-28 — Perfil importado: tabelas de combate disponíveis sem ROM relida
- Corrigido `romLiveResolver.js`: perfis conhecidos (SHA256, CRC32 e tamanho de 1 MiB coincidentes com catálogo auditado) passam a receber movimentos/efeitos/tipos/rácios/layout de captura quando não trazem essas tabelas e não existe uma ROM local. São 165 movimentos do catálogo de despacho auditado e 82 pares TypeEffects derivados iguais nas três ROMs.
- Perfis reais que contêm tabelas validadas mantêm-nas inalteradas. Campo `basePp:null` é explícito porque o catálogo derivado não preserva PP base. Sem provas falsas de SHA runtime ou de instantâneo RAM atómico.
- Testes Node em `tests/romImportedBattleTables.test.js` incluem três variantes, recusas SHA/CRC/tamanho e preservação dos dados de ROM local. Não há teste visual no iPhone/emulador nesta fase.


## 2026-10-28 — Ampliação do dano condicional a golpes com efeitos secundários
- O painel anterior calculava apenas golpes cujo effect byte era 0, deixando de fora grande parte dos ataques mais comuns. A mesma fórmula de **dano de um acerto** passa a abranger a lista estrita de efeitos 0,2,3,4,5,6,16,31,33,34,36,37,48,68,69,70,71,76, cujos ataques iniciais percorrem o ramo padrão. Efeitos secundários (veneno, burn, recoil, flinch, drops) permanecem explicitamente fora do cálculo.
- OHKO, golpes múltiplos, carga, trapping, dano fixo e efeitos não classificados continuam bloqueados: não são falsamente representados como golpe único. O candidato 'melhor golpe' limita-se aos efeitos 0 sem secundários, embora os intervalos condicionais apareçam para outros.
- Regressão de duas suites com fixtures: `tests/gen1LiveBattleAdvisor.test.js` e `tests/gen1LiveBattlePreview.test.js`. Nenhuma prova de emulador/iPhone.


## 2026-10-28 — Teste integrado do pipeline RAM → motor de batalha
- Testes em `tests/gen1BattleRamToUiPipeline.test.js`: constroem blocos HEX completos com offsets `CFE0/D014/CC20`, executam `parseRomBattleEvidence → verifyBattleWindow → buildLiveBattlePreview` e verificam precisão/dano/PP/efeitos/captura nas três variantes, usando catálogos ROM SHA-fixados.
- Testadas rejeições de HP/estágios divergentes, amostra de mapa não validada e SHA alterado; nenhuma regressão permite reutilizar previsão obsoleta. Blocos de RAM são **fixtures sintéticas**, não snapshots reais de emulador, e não se alega E2E em iPhone.


## 2026-10-28 — Exceção de Struggle e visibilidade do handler ROM
- A rotina de recoil inclui o golpe 165 (Struggle), que na Gen I não segue a eficácia de tipo normal. O painel deixa de aplicar a fórmula de dano de tipo/STAB a Struggle por engano.
- O painel mostra o nome do handler de efeitos da ROM auditada para cada golpe com efeito não trivial, mas marca `effectOutcomeCertified:false`; não confunde reconhecimento do nome da rotina com prova do resultado dos seus ramos.
- Acrescentados dois testes e reexecutadas as suites isoladas de pré-visualização de combate. Sem acesso E2E ao emulador/iPhone.


## 2026-10-28 — Radar de itens integrado com navegação ROM/RAM
- `retroarchClient.js` chama `planItemAccess` com grelha/posição, 2.ª leitura RAM, sprites, modo de deslocação, capacidades Cut/Surf verificadas na equipa e insígnias. O resultado por item inclui `accessStatus`, motivo e próximo tile teórico; não confunde recolha, remoção, itens ocultos e caminho acessível.
- `public/app.js` rotula cada item como percurso condicional, necessidade hipotética de Cut/Surf, rota inexistente neste mapa, possível Strength ou estado desconhecido. Remove a apresentação enganadora de «disponível já» e de presentes de NPC sem requisitos verificados.
- Removido `getAreaInfo` da divisão manual de Route 4 pela coordenada X=30, que escondia itens e apresentava encontros de Mt. Moon como se fossem da relva exterior. Agora os itens conhecidos da Route 4 permanecem no mapa; o acesso é calculado pelo motor.
- Nota: testes visuais do RetroArch/iPhone ainda pendentes; cálculo Cut/Surf/ledge depende das condições do motor e não prova roteiro multi-mapa ou execução atual.


## 2026-10-28 — Presença ROM antes do cálculo de acesso a itens
- Correção fail-closed: referências manuais sem `romItemCoordinatesVerified` recebem `UNVERIFIED_ROM_ITEM`, mesmo que exista um caminho no terreno. Ligação à ROM obtida de objeto validado ou de item oculto com scripts/flags ROM/RAM. Não confundir uma rota para coordenadas manuais com a presença de um item.
- Teste de regressão adicionado. Sem manipulação de ROMs, perfis ou saves.


## 2026-10-28 — Itemfinder ordenado pelo percurso ROM/RAM
- O alvo do radar de itens ocultos deixa de ser escolhido exclusivamente pela distância Manhattan: dá prioridade aos objetos que possuem percurso local condicional calculado, depois a rotas com Cut/Surf hipotéticos e finalmente aos desconhecidos. Confronta flags `isCollected===false` e preserva estado/caminho/motivo sem afirmar acesso confirmado.
- Distância geométrica mantém-se como referência, sem confundir com o número de passos. `isHot` é desativado por não demonstrar alcance de interação durante o frame real.


## 2026-10-28 — Síntese de mundo global integrada na leitura RAM
- `retroarchClient.js` invoca `adviseWorld` em cada ciclo normal para qualquer ID de mapa, a partir do perfil ROM, objetos, itens ocultos, treinadores e transições. Resultado disponibilizado em `latestState.worldAdvisor`; flags e consequências condicionais não são tratadas como resultados garantidos.
- Limite explícito: o motor de scripts/eventos não está completo; ainda não foi validado num emulador real.


## 2026-10-28 — PokéGuide T0/T1: tracking persistente e provas independentes no conselheiro mundial

- Criada branch de trabalho `feature/pokeguide-world-action-tracker-20261028` a partir da branch principal e instituído `docs/TRACKING_POKEGUIDE_100_PERCENT.md` com 12 entregáveis, critérios de prova e estados PARCIAL/EM EXECUÇÃO/PENDENTE. Não foram apagadas entradas anteriores.
- Corrigido `romWorldStateAdvisor.js`: flags de itens ocultos não são utilizadas para inferir vitória nem estado de treinadores. A classificação separa `VICTORY_SCRIPT_FLAG`, `BATTLE_PLAYED_SCRIPT_FLAG`, `TRAINER_GATE_CLOSED`, `TRAINER_GATE_OPEN` e `UNKNOWN`, exigindo fonte de prova de treinador.
- Ligados os resultados de `romItemReachability.js` às observações globais apenas quando SHA-256, mapa, índice de origem, coordenadas e verificação ROM coincidem. Duplicados de coordenadas do mesmo tipo são ambíguos e não herdam acesso. As rotas continuam condicionais, nunca acessibilidade garantida.
- `retroarchClient.js` injeta explicitamente os índices da lista original e evidência por domínio; quando a verificação do mapa falha, descarta conselhos e rotas do mapa antigo.
- Evidência: commits `6d1682b` e `30283d4` na branch de trabalho. **Não houve suite completa ou E2E de emulador/iPhone nesta etapa; integração ainda sujeita a testes.**


## 2026-10-28 — PokéGuide T2/T3: painel global, fichas ocultas e regressões

- Publicados `public/index.html` e `public/app.js` com painel «POKÉGUIDE — AÇÕES DESTA ZONA». A interface enumera todas as observações locais do conselheiro, por tipo, estado, coordenadas, percurso condicional, motivo e consequência não garantida. Renderiza apenas com `textContent` para não interpretar HTML das fontes ROM/RAM.
- O painel recusa mostrar o estado se a ligação estiver desligada, a leitura exceder 15 segundos, a posição não tiver dupla confirmação, o mapa não corresponder ao da amostra, ou a identidade ROM não corresponder. O fecho do WebSocket limpa o conteúdo imediatamente; uma reavaliação passiva a cada 5 segundos impede que uma ligação silenciosa conserve conselhos antigos.
- `romWorldStateAdvisor.js` e `retroarchClient.js` incluem agora as **12 fichas ocultas** do Game Corner como domínio `HIDDEN_COIN`, com estado de recolha proveniente apenas da leitura `romHiddenCoins.verified` (bitmap RAM D6FE distinto de D6F0). Os valores dependem do catálogo de ROM verificado; nenhum valor é inventado quando não há prova.
- Acrescentadas as suites `tests/romWorldStateAdvisor.test.js` (9 casos) e `tests/worldAdvisorPanel.test.js` (4 casos), incluindo flags separadas, associações seguras de itens, coordenadas duplicadas, mapa/ROM inconsistentes, expiração do painel e HTML potencialmente hostil.
- **Validação realizada aqui:** versão de ensaio isolado de `romWorldStateAdvisor.js` com stubs de dependências auditadas, `node --test`: **6/6 testes aprovados**; não substitui executar a suite real no checkout completo. Foi criada e capturada uma pré-visualização local sintética de HTML em Chromium, analisada visualmente (legibilidade básica, quebras de linha) e o renderizador do repositório foi melhorado com espaçamento entre ações. A screenshot é de *maqueta isolada*, NÃO do Companion ligado ao jogo.
- **Ainda sem prova:** `npm test` completo no repositório atual, testes com as três ROMs reais neste ambiente, screenshot da aplicação ativa, RetroArch/SameBoy/iPhone ao vivo, handlers/scripts e acesso multimapa. Não utilizar os testes isolados como certificação de 100%.


## 2026-10-28 — PokéGuide T4: livro global de eventos auditados (226 mapas) e validação limitada

- Implementado `romCampaignLedger.js`, ligado a `retroarchClient.js`: após comprovação da identidade do perfil ROM e janela RAM do mapa, resume em modo estritamente de leitura o progresso de **226 mapas com cabeçalho normal**, cruzando os **54 itens ocultos** (D6F0), as **12 fichas ocultas** (D6FE), flags individuais de portões de treinadores e flags de encontros fixos (D747). Mapa ou bitmap incompleto, identidade não confirmada, contagens inconsistentes ou SHA desconhecido invalidam o resumo sem inventar valores.
- O livro distingue portão de treinador fechado, vitória confirmada apenas por script, evento fixo encerrado e captura não demonstrada. O campo `progressCompleteness` continua `PARTIAL`; a leitura RAM sequencial não demonstra atomicidade nem que a ROM carregada no iPhone coincide criptograficamente com o perfil analisado.
- Atualizado `public/app.js` para exibir a síntese mundial apenas quando o livro está verificado, contém 226 mapas e o SHA corresponde ao conselheiro da zona atual. O painel não afirma que os caminhos ou eventos são atualmente acessíveis; casos sem prova mostram estado desconhecido.
- Publicada `tests/romCampaignLedger.test.js` com 4 testes de contratos de integração e ampliada `tests/worldAdvisorPanel.test.js` com uma prova de não misturar ROMs na apresentação do resumo. Há **18 testes novos no repositório**, ainda **sem execução da suite integral deste checkout**.
- **Validação isolada nesta operação:** cópia dos motores de lógica e função da UI numa pasta temporária isolada, com dependências substituídas por fixtures/stubs, foi sujeita a `node --test`: **12/12 PASS, zero falhas e zero skips**. Esta prova é dos trechos isolados e **não** certifica os módulos com as dependências originais, os três binários ROM em execução nem a aplicação inteira.
- **Verificação visual:** criada maqueta HTML com estado sintético, capturada e inspecionada imagem no Chromium; foram corrigidas quebras de linha, contagens e explicações. Não foi retirada nem analisada captura da interface real com emulador/iPhone nesta etapa.
- **Pendências globais:** execução `npm test` no checkout completo, auditorias rigorosas com os três ficheiros originais, snapshot RAM coerente/atómico, confirmação criptográfica da ROM ativa, caminhos multidestino com scripts/portas dinâmicas, interpretação exaustiva dos scripts e handlers, testes diferenciais e screenshots reais de cada passo.
- Nenhuma ROM/save foi publicada ou alterada. Sem alterações a sessões Antigravity, TIMI/Maestro/BonChat nem ao disco Windows C: do utilizador. Histórico mantido exclusivamente por acrescento.


## 2026-10-28 — PokéGuide T5: revisão Git e proposta de integração protegida

- Comparação GitHub `main...feature/pokeguide-world-action-tracker-20261028` confirmou branch adiantada **25 commits e zero atrás** antes da criação do PR, com 10 ficheiros alterados, incluindo dois históricos/trackers, três ficheiros de testes e integração do livro global. A branch base continuava em `d52d6dad10219a28cee28c4ec7ccb81332ce97bf`.
- Aberto o **PR #1, em modo Draft**, para revisão da integração sem sobrepor automaticamente `main`: <https://github.com/ApexScorpio/pokemon-red-telemetry/pull/1>.
- A publicação na branch e a abertura do PR são comprovadas pelo GitHub, mas não equivalem à passagem de testes do checkout completo nem à validação do cliente em execução; a versão principal permanece preservada. Ainda não é adequado declarar os 100% solicitados ou fundir sem evidência adicional.
- Os bloqueios e as provas de T0–T4 ficam documentados no tracking. Histórico atualizado **apenas com novas linhas**, sem reescrever as anteriores.


## 2026-10-29 — T6: correção de reconexão e testes reais do código JavaScript publicado

1. Testada diretamente em JavaScript V8 a versão atual dos ficheiros de `romWorldStateAdvisor.js`, `romWarpGraph.js`, `romKnownSha256.js` e `tests/romWorldStateAdvisor.test.js` obtidos do GitHub: **9/9 casos aprovados**. Foi utilizado um adaptador mínimo de `require`/`node:test`/`assert`, sem ROM ou emulador, pelo que não substitui `npm test`.
2. Executadas as versões publicadas de `romCampaignLedger.js`, `tests/romCampaignLedger.test.js`, `public/app.js` e `tests/worldAdvisorPanel.test.js`, com emulação controlada das APIs `fs`/`path`/`vm` do Node. Identificada uma asserção obsoleta de contagem de fichas, corrigida para a etiqueta «Fichas: 1» no commit `663d18d`.
3. Detetado defeito funcional adicional: `socket.onclose` escondia o painel mas preservava `lastState.connected=true`; a revalidação periódica podia ressuscitar conselhos antigos. Corrigido persistindo `connected:false` no `lastState` (commit `811e14c`) e acrescentada prova específica de regressão no teste do painel (commit `1b61654`).
4. Após correção de harness para reproduzir atribuições ao contexto de `vm`, **10/10 testes publicados das suites de progresso/painel aprovados** no V8 isolado. A simulação de APIs Node e os testes sintéticos não são provas de execução E2E.
5. Tentativa de `git clone` do repositório público no contentor falhou por DNS (`Could not resolve host: github.com`). O checkout integral não ficou disponível; nenhum ficheiro foi criado no disco C: do utilizador nem foi tocada qualquer sessão de terceiros.

## 2026-10-29 — T7: prioridades de todo o Kanto e navegação por ligações estáticas

1. Criado e publicado `romCampaignObjectives.js` com seleção dos **226 mapas normais** a partir do livro de flags auditado. Apresenta mapas com itens ocultos/fichas por recolher segundo flag, portões de treinadores e encontros fixos ainda abertos e eventos sem flag conhecida. Estes domínios não são tratados como confirmação de acesso, de vitória ou de necessidade de combate.
2. O planeador executa uma **única BFS** sobre transições ROM estáticas e fronteiras exteriores corroboradas; requer SHA coincidente, 226 cabeçalhos e exatamente 813 warps originais para autorizar distâncias em transições. Rotas desconhecidas ficam `null`, nunca «bloqueadas» por dedução. LAST_MAP, elevadores, portas/scripts e capacidade de transitar continuam explicitamente não certificados.
3. `retroarchClient.js` publica `latestState.globalCampaignObjectives` após a geração do livro global, descartando resultados quando o mapa RAM muda. `public/app.js` mostra até oito destinos com pendências, incertezas e número de transições estáticas, sem garantir acesso (commits `1837267`, `17d73f2`, `6713027`, `e499065`).
4. Criados `tests/romCampaignObjectives.test.js` com **6/6 testes aprovados** na execução isolada da versão publicada no GitHub: ordem de prioridades, BFS, travessia exterior auditada, ROM/SHA divergentes, duplicados e ausência de rota não significar bloqueio real. Adicionada regressão da UI para lista global e incompatibilidade SHA.
5. Corrigida a flexão do texto português: «1 item oculto» e «1 evento por esclarecer». Código e teste atualizados (commits `a3dc3fc` e `92948e8`).

## 2026-10-29 — T8: verificação conjunta de código e pré-visualização visual

1. Obtidos os **10 ficheiros efetivos** das quatro suites/motores da branch e executados os respetivos corpos de testes num único executor V8 com adaptações explícitas das APIs Node: **26/26 aprovações, 0 falhas** (9 conselheiro, 4 livro global, 6 prioridades, 7 interface). Todos os 10 ficheiros passaram o parsing JavaScript V8. **Não foi executado `node --test` nativo nem `npm test` integral com dependências reais.**
2. Verificadas sintaxe e ligações de `retroarchClient.js`, `public/app.js`, `romCampaignLedger.js`, `romCampaignObjectives.js`, `romWorldStateAdvisor.js` e presença dos IDs no `public/index.html`. Confirmada a ordem no ciclo RAM: livro global → prioridades → conselheiro; invalidação do planeador em mudança de mapa; sincronização do estado desligado e expiração periódica.
3. Gerada no contentor uma **maqueta HTML com dados exclusivamente sintéticos** para verificar visualmente o painel; capturas antes/depois com Chromium. Analisadas ambas as imagens: legibilidade e espaçamento básicos aceitáveis, desambiguação de «SIMULAÇÃO — DADOS NÃO REAIS», singular/plural corrigidos. Não foram capturas da interface real nem do emulador. Imagem final conservada apenas como evidência de layout sintético.
4. **Limites persistentes:** não se pôde obter checkout via rede, nem acesso ao RetroArch/SameBoy/iPhone e aos três binários ROM. Continuam pendentes `npm test`, provas RAM reais, ROM SHA em execução, scripts/efeitos completos, rotas dinâmicas e evidência visual real. Nenhuma percentagem geral de conclusão é legítima neste ponto.


## 2026-10-29 — T9: fecho verificável da etapa T6–T8, limpeza de temporários e PR preservado

- Confirmados no GitHub **42 commits à frente de `main`**, zero atrás, e 12 ficheiros alterados na branch `feature/pokeguide-world-action-tracker-20261028`; `main` manteve-se em `d52d6dad10219a28cee28c4ec7ccb81332ce97bf`. PR #1 confirmado via API como **open/draft**, não fundido.
- Validação de sintaxe V8 dos seis módulos relevantes de cliente/UI/motores passou; nove verificações de integração textual confirmaram o import do planeador, ordem de produção livro → objetivos → conselheiro, rejeição em mapa desatualizado, IDs de DOM, rendering e expiração de dados. **26/26 casos de teste dos quatro ficheiros de regressão passaram em V8 isolado**, não na suite Node integral.
- Captura sintética final `objectives-preview-after.png` verificada no contentor, aberta e examinada visualmente. Texto «1 item oculto» e «1 evento por esclarecer» corrigido e sem desbordamento aparente na pré-visualização. Esta imagem não é prova de RetroArch/SameBoy/iPhone.
- Eliminados o HTML temporário e a imagem intermédia desta fase; conservada apenas a captura final para referência de UI. Não foram removidos backups, ROMs, saves, sessões ou outros ficheiros do utilizador.
- **Estado da meta: PARCIAL; 100% não certificado.** Continuam como bloqueios `npm test` no checkout verdadeiro, ROMs e emulador ativos, scripts/handlers integrais, dinâmica de acessibilidade, snapshot RAM e comparação visual do jogo real.


## 2026-10-29 — T10: planeamento de saídas com terreno da ROM verificado

- `romCampaignObjectives.js` passou a aceitar `firstMapTerrainHints` e a posição RAM corroborada, usando 3 ondas BFS por tipo de prova do PRIMEIRO warp: caminho terrestre teórico, ausência de prova, ou falta de caminho terrestre sem inferir bloqueio permanente. `retroarchClient.js` transmite os hints e a posição RAM; o painel distingue estas situações.
- Se o índice ROM, os warps, a posição RAM ou o SHA não coincidirem, os hints são ignorados. Isto NÃO valida Cut, Surf, Strength, NPCs dinâmicos, portas, scripts nem a geometria das ligações restantes.
- Acrescentados 2 testes de prioridade do primeiro warp e rejeição de hints desatualizados. Suite de prioridades: **8/8 no V8 isolado**, NÃO `npm test` integral.

## 2026-10-29 — T11: conteúdo ROM mundial — sinais e fauna

- O `romWorldStateAdvisor.js` passou a expor sinais ROM de texto como `SIGN/SCRIPT_UNRESOLVED`, com posição e identificador de texto, sem presumir interação acessível ou consequência do script.
- As tabelas `wildEncounters` da ROM auditada entram como `WILD_ENCOUNTER` apenas após validação dos 10 slots e pesos `[51,51,39,25,25,25,13,13,11,3]` por meio (relva/água). A interface apresenta percentagens condicionais por espécie interna+nível, agregando slots repetidos, **não** probabilidade efetiva por passo.
- Criados testes para sinais, pesos alterados e percentagens condicionais. Falta validar existência real de encontros no frame, Repel, capacidades e flags em todas as condições.

## 2026-10-29 — T12: percurso geométrico multimapa para itens inacessíveis localmente

- Novo `romCrossMapItemRoute.js`: BFS limitada a 120 estados em execução live (máximo 10 warps), a partir de posição RAM corroborada, em grelhas ROM SHA verificadas. Reutiliza `terrainBytes`, `computeReach` e `candidatePath` existentes; só usa warps com destino+posição validados, sem inferir portas/scripts desbloqueados. Conserva no resultado `accessibleNow:null`, `routeNavigableNowProven:false`.
- Integrado em `retroarchClient.js` apenas para um item do mapa com `NO_SAME_MAP_PATH` e coordenadas realmente associadas à ROM; cache por posição, capacidades, modo e sprites; invalida em mapa incoerente. O painel indica primeira saída, transições e passos *teóricos*, sem prometer recuperação do TM04 ou de outro item.
- Adicionados 6 testes de terreno+warps incluindo desvio de dois warps, ausência de saída, limite de saltos, ROM SHA errada, sprite obstrutivo. **6/6 aprovados em executor V8 isolado com `Buffer` simulado e hash determinístico não criptográfico**. Não são prova SHA nativa nem emulador real.

## 2026-10-29 — T13: mudanças de progresso observadas entre leituras

- Criado `romCampaignDelta.js` para comparar dois resumos mundiais compatíveis. Detecta mudanças nas contagens de flags de itens/fichas ocultas, portões de treinadores, vitórias especificamente codificadas no script, batalhas e encontros fixos, mantendo cada significado separado. Uma diminuição de contagem bloqueia a inferência e indica possível carregamento de save/amostra inconsistente; SHA diferente ou ausência de baseline também bloqueia.
- A telemetria guarda até 80 mudanças de flags observadas nesta sessão, com identificação do mapa, sem atribuir causalidade a uma ação ou declarar captura/vitória sem semântica própria. A UI apresenta as últimas seis e explicita que são diferenças RAM não atómicas.
- Acrescentados 6 testes de alterações, regressões de save, SHA divergente e ausência de mudança; 2 testes de UI para desvio multimapa e histórico. **6/6 no V8 isolado** para o novo módulo.

## 2026-10-29 — T14: prova agregada e honestidade da identidade ROM

- Reexecutados os ficheiros atuais publicados na branch, incluindo motores de mapa/terreno, planeamento, advisor, progresso, timeline e UI: **45/45 testes das seis suites novas aprovados em executor V8 com APIs Node simuladas, zero falhas**. Para o terreno foi utilizado um substituto de digest reprodutível e NÃO um SHA256 criptográfico nativo; não foi executado `npm test` completo nem o emulador com os três binários.
- Verificada sintaxe JavaScript de `retroarchClient.js`, `romCrossMapItemRoute.js`, `romCampaignDelta.js`, `romWorldStateAdvisor.js` e `public/app.js` e confirmadas ligações de módulos, cache e UI. Corrigida a proteção da lista de sprites opcional, evitando iterar `undefined`.
- Corrigida a legenda enganadora: o SHA256 é do **perfil ROM local auditado**; a ROM em execução foi apenas associada por CRC32 do RetroArch. `activeRomSha256Verified:false` é explícito e o painel informa «ativo associado por CRC32».
- Confirmado no GitHub PR #1 **Draft aberto, não fundido**, branch com 68 commits à frente de `main` (`d52d6dad`), 16 ficheiros alterados nesta comparação antes do presente registo. O conteúdo da branch é real; não há E2E da aplicação.
- **Ainda pendente para 100%:** scripts/bifurcações/eventos e todas as consequências, handlers de combate/captura e probabilidades sob RNG real, itens visíveis com prova específica de recolha, rotas exteriores/warps dinâmicos/elevadores/Strength, snapshot RAM atómico, confirmação SHA do binário realmente em execução, `npm test` integral, ROMs 3×1MiB e screenshots ao vivo da aplicação. **Sem certificado 100%.**


## 2026-10-29 — T15: eliminar falsos eventos após arranque ou perda de ligação

- Auditoria da integração `retroarchClient.js` revelou que `previousGlobalLedger=this.latestState.globalCampaignLedger` podia usar uma leitura **persistida da sessão anterior** como ponto de partida. Isso podia gerar falsas «mudanças» após reabrir a aplicação, entrar noutra ROM ou recuperar de uma quebra de leitura RAM.
- Criado `romCampaignSession.js` com `CampaignFlagSession`: primeira leitura validada da sessão gera **apenas baseline**, a seguinte pode produzir deltas; alterações de identidade ROM, mapa inconsistente, GET_STATUS CONTENTLESS, bloco RAM ausente/incompleto e erro UDP invalidam baseline e timeline. Diminuição de contagem limpa os eventos e reinicia baseline como possível carregamento de save.
- `retroarchClient.js` atualizado com `invalidateWorldEvidence`, reset no arranque e nestas transições, sem tocar em `actionHistory` e `dialogHistory`. Não volta a comparar um `globalCampaignLedger` guardado em disco com a RAM corrente.
- Adicionados 8 testes de regressão de sessão: primeiro baseline, incrementos, desconexão, mudança Red→Blue, save carregado, capacidade de 80 eventos, mapas não corroborados e cópia dos dados de saída. **8/8 aprovados em V8 isolado com código publicado no GitHub**.

## 2026-10-29 — T16: flags individuais em vez de apenas contagens

- O livro de 226 mapas ganhou `flagRecords` independentes por mapa: itens ocultos, fichas ocultas, treinadores humanos mapeados e encontros Pokémon fixos. Cada registo contém identificador ROM, bit efetivo, flag e coordenada, quando conhecidos. Não presume estado de eventos sem bit mapeado.
- `romCampaignDelta.js` agora compara os identificadores e bits, recusando mapas incompletos, atlas divergente ou bit que voltou de 1→0 **mesmo quando o total nesse mapa permanece igual**. Usa `EXACT_ROM_EVENT_BIT` se as 452 fichas (226 por amostra) trazem arrays completos; `MAP_COUNTER_ONLY` é identificado nos formatos legados sem estes registos.
- Uma subida de flag de portão de treinador normal não é rotulada como vitória. Só os casos com `outcomeEvidence:'SCRIPT_VICTORY'` têm o evento `SCRIPT_VICTORY_FLAG_RAISED`; os casos de batalha apenas realizada são separados.
- Adicionados 4 testes específicos de bits (coordenada, troca de flags com contagem igual, vitória de script e rejeição de atlas parcial) e 1 teste de integração entre o livro global e o comparador. Foi detetada uma incoerência entre `eventFlagSet` e `encounterGateClosed` para Pokémon fixos; a construção de `flagRecords.stationaryPokemon` usa agora a mesma propriedade `encounterGateClosed` que o total global (commit `d2a8fca`). Os **5 testes do livro global aprovaram após a correção**.

## 2026-10-29 — T17: reduzir estado persistido obsoleto e testar métodos reais do cliente

- `persistState(state)` já não grava `globalCampaignLedger`, `globalCampaignObjectives`, `globalCampaignDelta`, `worldRecentFlagChanges`, `worldAdvisor` nem `romCrossMapItemRoute` nas duas caches JSON preexistentes. Continua a conservar a informação histórica e restante estado para retoma. Isto reduz dados redundantes e impede que evidência temporal seja transportada como se fosse recente.
- Criado `tests/romClientCampaignIntegration.test.js` com 3 provas sobre os métodos efetivos extraídos de `retroarchClient.js`: serialização das duas caches sem telemetria volátil, invalidação que preserva os históricos e guardas de arranque/ROM/desconexão. **3/3 testes no V8 isolado**; não foram efetuadas escritas no computador do utilizador.

## 2026-10-29 — T18: execução agregada após correções

- Confirmado o código efetivo na branch do GitHub: **61/61 testes** nas oito suites novas passaram num executor **V8 isolado**, com substituições explícitas das APIs Node para módulos, `vm`, `Buffer` e hash de testes não criptográfico. **20/20 ficheiros JavaScript analisados passaram o parsing.** Um erro inicial de sintaxe no *harness* foi corrigido antes desta execução; não foi contabilizado como teste aprovado.
- PR #1 confirmado por API como `open/draft`, não fundido, **81 commits à frente da `main`**, nenhum atrás, 19 ficheiros alterados antes destes dois documentos; a `main` permaneceu em `d52d6dad10219a28cee28c4ec7ccb81332ce97bf`.
- **Limites de prova**: não foi possível obter checkout completo com dependências, executar `npm test` com Node sem shims, nem validar as ROMs Red/Blue/Green (binários originais) e o emulador vivo. A SHA256 da ROM *executada* continua sem certificação direta; só o perfil local é auditado e o RetroArch foi associado por CRC32. O estado mundial **não é 100% completo**; scripts, interações, combate, captura, warps dinâmicos e navegação por restrições precisam de validação integral.


## 2026-10-29 — T19: checkpoint anterior integrado no histórico permanente

- Retomado o checkpoint local `POKEGUIDE_T19_CHECKPOINT_2026-10-29.md`. O trabalho dessa fase foi publicado na branch: `romWorldEventAtlas.js`, `data/exact_events.json` (507 constantes) e `data/exact_visible_flags.json` (228 toggles), ligação RAM `D747` (320 bytes) e `D5A6` (32 bytes), e respetiva apresentação na UI. **Estas são referências de constantes, não interpretação integral dos scripts nem prova de ação do jogador.**
- A comparação `romCampaignDelta.js` passou a validar a coerência de contadores com registos por bit. `romCampaignSession.js` invalida histórico em amostras contraditórias. Os testes adicionais de T19 foram posteriormente executados nesta sessão de trabalho: 21/21 nas suites de delta/sessão e 13/13 na suite UI, incluídas as novas verificações.
- O checkpoint local permanece separado do GitHub; esta entrada é uma transcrição técnica resumida, **acrescentada sem apagar o histórico anterior**.

## 2026-10-29 — T20: alterações de eventos nomeados e pisos de elevadores

- **Novo `romWorldReferenceSession.js`**: compara as 507 flags de evento e 228 toggles a cada duas leituras válidas, identifica transições 0→1 e 1→0 com nome e bit correspondente. Primeira leitura cria somente baseline; perda de integridade/ROM nova reinicia histórico; cap de 80 alterações. A interpretação permanece `actionConfirmed:false` e `scriptEffectsComplete:false` (não inventa vitória, captura ou cumprimento de missão).
- `retroarchClient.js` passa a publicar `romWorldReferenceDelta` e `worldRecentNamedChanges`, e invalida ambos quando falha a RAM, ligação ou identidade da ROM. O estado persistido exclui esses campos. `public/app.js` mostra até 6 alterações recentes e diferencia transição de flag de ação real.
- **Novo `romElevatorChoices.js`**: integra `data/gen1ElevatorsAudited.json` dos três SHA auditados. Valida 226 cabeçalhos normais, os 3 elevadores (mapas 127, 203, 236), 19 escolhas de pisos e os índices de entrada dos destinos ROM. Mostra menu de possibilidades, nunca piso selecionado nem acesso atual garantido. Publicado na telemetria e no painel, excluído da cache e invalidado em falha da RAM.
- **Testes desta continuação (resultados isolados, sem afirmar `npm test`)**: `romWorldReferenceSession.test.js` **8/8**; `worldAdvisorPanel.test.js` **13/13**; `romCampaignDelta.test.js`+`romCampaignSession.test.js` **21/21**; `romClientCampaignIntegration.test.js` **4/4**; `romElevatorChoices.test.js` **6/6**, incluindo Red/Blue/Green. Total **52/52** casos executados em suites separadas com código efetivo do GitHub e adaptadores Node em JavaScript V8. **7/7 módulos principais passaram o parsing JavaScript**, e as ligações de telemetria/UI/invalidação foram confirmadas por inspeção automatizada.
- **Provas ausentes:** checkout integral e `npm test` nativo, três binários ROM originais disponíveis para ensaios SHA256, leitura RAM por emulador real, screenshots E2E, validação de scripts/menus e consequências de gameplay, todas as mecânicas e acessibilidade dinâmica. Assim o projeto continua **PARCIAL, não 100%**. O PR mantém-se em modo Draft; não foi integrado na `main`.


## 2026-10-29 — T21: saídas condicionais para todos os mapas normais, sem inventar acesso

- Criado `pokemon-ai-companion/romLocalExitAccess.js`, executado com SHA do perfil ROM local, grelha de terreno auditada, posição/mode RAM reconfirmados, inventário de sprites e capacidades atuais de Cut/Surf. Inspeciona os warps do mapa atual e o terreno até cada entrada; distingue caminho estático, caminho condicionado a Cut/Surf, capacidade desconhecida, sprite observado e ausência de caminho local sem inferir bloqueio definitivo.
- Inclui ligações exteriores dos 78 descritores recíprocos da ROM e opções de elevador somente como transições possíveis sem coordenadas de travessia nem prova de seleção; `accessibleNow:null` e `routeNavigableNowProven:false` mantidos.
- Integrado no `retroarchClient.js`, `public/app.js` e `romCampaignObjectives.js`: objetivos globais passam a privilegiar a primeira saída com terreno e capacidade Cut/Surf corroborados na RAM (sem afirmar ação executada) e rejeitam hints de mapa, posição ou SHA diferentes.
- Criado `romWorldDetourCycles.js` para investigar ciclos de retorno a um mapa cujo item ficou sem percurso local: grafo de 813 warps estáticos/condicionais e até 78 fronteiras auditadas, pesquisa com limites, rejeição de regressos triviais pela mesma porta ou fronteira e associação pelo ID de mapa/coordenadas exatas do item. O painel indica **voltas entre mapas para investigar**, nunca caminhos provados até ao outro lado do desnível.
- Guardas de cache: saída e ciclos não se persistem, são invalidados quando a identidade/memória do emulador deixa de ser fiável; ciclos são recalculados quando mudam posição, item ou condições das saídas.

## 2026-10-29 — T22: associação da geometria à variante Red/Blue/Green e LAST_MAP RAM

- Criado `romTerrainVariantGuard.js`: compara, por ID e por fingerprint de blocos, tiles e colisões, as **226 grelhas do perfil ativo** com os arquivos auditados `romTerrain_red.json`, `romTerrain_blue.json`, `romTerrain_green.json`. Total **95 132 células**. Red e Blue são iguais em terreno estático; Green International difere nos mapas **226, 227 e 228**. Um mapa Red inserido por engano no perfil Green é recusado antes de gerar sugestões de terreno.
- A telemetria passa a desativar conselhos de células, ações Cut/Surf, acessos a itens e desvios se as matrizes da variante não coincidirem. Isto NÃO substitui ler o SHA-256 do binário efetivamente executado no emulador; a associação do jogo ativo continua por CRC32 do RetroArch.
- Os warps `LAST_MAP` (ROM 0xFF, 251 entradas no atlas) podem agora mostrar o destino **apenas** quando `romLastMapEvidence.js` confirmou duas leituras sequenciais consistentes de D365 e os índices/coordenadas do destino existem no mapa ROM. A UI identifica a origem `RAM_SEQUENTIAL_LAST_MAP`, continua `accessibleNow:null` e não pressupõe que a porta foi atravessada.
- Erro de fixture corrigido: o arquivo compacto contém 226 mapas normais mas os IDs NÃO são índices sequenciais (há mapas reservados); os testes procuram por `mapId`. O primeiro ensaio da suite de variantes teve 5/6 devido a essa fixture e, após correção, terminou 6/6.
- **Verificação desta execução:** 56/56 testes nos seis ficheiros `romLocalExitAccess.test.js`, `romWorldDetourCycles.test.js`, `romCampaignObjectives.test.js`, `worldAdvisorPanel.test.js`, `romClientCampaignIntegration.test.js`, `romTerrainVariantGuard.test.js`, reexecutados em conjunto sobre os ficheiros atuais da branch. Todos os JS carregados passaram o parsing. A execução utilizou V8 isolado com equivalentes de APIs Node (fs/vm/Buffer/crypto); o digest nos testes de grelha sintética foi substituído por cálculo determinístico NÃO SHA256, ao passo que a correspondência dos metadados dos três arquivos de terreno foi testada com os próprios JSON reais do repositório.
- **Bloqueios persistentes para 100%:** `npm test` nativo sobre checkout completo, SHA do binário ROM ativo, três ROMs originais para novos ensaios E2E, screenshots no emulador em movimento, geometrias de fronteiras exteriores/rotas reais, warps dinâmicos além das leituras corroboradas, scripts e efeitos, combate/captura/evolução/trocas e casos interativos completos. **Sem certificação de 100%**.
- API GitHub antes dos commits do histórico: PR #1 ainda `open/draft`, **135 commits à frente / 0 atrás**, `main` preservada em `d52d6dad10219a28cee28c4ec7ccb81332ce97bf`, 31 ficheiros alterados. Nenhum merge realizado. Operações não mexeram em aplicações ou sessões locais do utilizador.


## 2026-10-29 — T23: geometrias de borda candidatas, 78 descritores auditados e Route 4

- **Novo `romOutdoorBoundaryCandidates.js`**: em cada direção exterior conhecida, percorre a primeira/última linha ou coluna do terreno ROM da zona atual e usa BFS por cenários de capacidade atual, Cut hipotético, Surf hipotético e Cut+Surf. Devolve tiles de **origem** alcançáveis no terreno, primeiro passo teórico, classificação e ordenação por caminho/ações necessários. Cada resultado mantém `sourceBorderLandingProven:false`, `neighborAlignmentVerified:false`, `accessibleNow:null`. Não inventa coordenadas de chegada ao mapa seguinte.
- **Integração** em `romLocalExitAccess.js` e `public/app.js`: cada fronteira pode mostrar até quatro tiles candidatos e até dois na interface; quando só há hipótese Cut/Surf ou nenhum tile alcançável o estado é explicitamente separado de passagem livre. Um teste antigo com estado `BORDER_CROSSING_TILE_NOT_VERIFIED` falhou após a implementação porque o estado passou a trazer análise real; foi atualizado e comprovado.
- **`romWorldDetourCycles.js` e UI**: os ciclos que retornam ao mesmo mapa trazem agora `firstExitEvidence`, primeiro passo de terreno e, quando há borda exterior, o primeiro tile de origem candidato. A referência a região de destino permanece desconhecida, sem dar a volta como «acesso já desbloqueado». Pistas de mapa, direção e destino são verificadas contra a entrada atual.
- **Novo `romOutdoorReferenceGuard.js`**: compara as 78 ligações do grafo em execução com o catálogo auditado pelo SHA da variante, incluindo `sourceMapId`, `destinationMapId`, direção, offsets e ponteiros/width dos descritores de 11 bytes. Red, Blue e Green têm **78/78 referências idênticas de topologia e descritor**. Se um registro diverge, a telemetria remove o subgrafo de fronteiras exteriores, mantendo independente o grafo de warps estáticos. Os dados transitórios e a referência não são persistidos; invalidam-se na perda de coerência RAM.
- **Route 4 real, as três ROMs**: matriz de **90×18 tiles**, **10 tiles estáticos caminháveis na borda sul** (referência `ROUTE_3`, mapa 14) e **8 na borda este** (`CERULEAN_CITY`, mapa 3). Posições de exemplo na matriz: sul `(6,17)` e este `(89,4)` são caminháveis nos arquivos auditados. **Não são coordenadas RAM observadas numa partida real, nem a prova da transição para o mapa seguinte.** O novo `tests/romRoute4RealTerrainBorders.test.js` cruza a matriz real com o catálogo das 78 ligações em cada uma das três variantes.
- **Testes executados nesta continuação**: `romLocalExitAccess.test.js`, `romWorldDetourCycles.test.js` e `worldAdvisorPanel.test.js` juntos **41/41**; `romOutdoorReferenceGuard.test.js` + `romClientCampaignIntegration.test.js` **13/13**; `romRoute4RealTerrainBorders.test.js` **3/3**. Resultados de **57/57 casos distintos**, distribuídos por três execuções V8 com código exato e arquivos JSON atuais do GitHub. Os testes de geometria sintética utilizam digest simulado; o ensaio com terreno Route4 utiliza uma tabela de correspondência entre bytes e hashes previamente auditados, NÃO SHA256 real executado pelo Node. Foi necessário corrigir dois cenários de fixture após o primeiro ensaio 30/32; o rerun passou 32/32 e o grupo expandido 41/41. Não foi executado `npm test` nativo nem E2E num emulador.
- **Limite fundamental**: o arquivo público de ligações guarda direções, offsets e identificadores, mas não preserva no relatório completo os 11 bytes necessários para certificar o alinhamento lateral entre mapas. Assim a lista de tiles candidatos na borda não prova que todos esses tiles efetuam realmente a passagem. Falta verificar o bytecode/ROM binária, scripts e ações em emulador, movimentos frame a frame, Cut/Surf/Strength em jogo real, combates, captura, evolução e itens até 100%.
- API GitHub antes da escrita deste registo: PR #1 **aberto/Draft, não fundido**, **152 commits à frente** da `main`, `main` preservada no SHA `d52d6dad10219a28cee28c4ec7ccb81332ce97bf`. Nenhuma aplicação local ou sessão protegida foi alterada.


## 2026-10-29 — T24: offset físico das 78 fronteiras de Kanto, confirmado por ponteiros ROM

- Foram consultadas diretamente as **36 fontes oficiais de cabeçalhos** de mapas em `pret/pokered/data/maps/headers/*.asm`. A macro `connection` em `pret/pokered/macros/scripts/maps.asm` define o offset em blocos da zona vizinha e os ponteiros de tiras de ligação. A nova tabela `data/gen1OutdoorConnectionOffsetsReference.json` guarda as **78 referências recíprocas**, com `sourceMapId`, `destinationMapId`, direção e deslocamento assinado em blocos; não copia scripts, só os dados estruturados necessários.
- **Novo `romOutdoorAlignment.js`:** para cada fronteira valida o offset contra os valores ROM auditados `destinationBlockPointerCpu`, `destinationWidthBlocks`, dimensão do mapa de destino e o ponteiro `blocksPointerCpu` do cabeçalho desse mapa na ROM do perfil ativo. Uma divergência suspende os 78 alinhamentos. As 78 ligações concordaram nas três variantes; **34 dos 36 mapas de destino** têm o ponteiro de blocos inferido de forma independente por pelo menos duas ligações recíprocas/incoming, sem discrepâncias. A ausência dos três binários atuais impede demonstrar o SHA-256 da ROM efetivamente executada, pelo que a associação ao emulador continua dependente do CRC32.
- Coordenadas de origem→destino seguem a rotina Gen I documentada (`xDest=xSource−2×offset` em N/S; `yDest=ySource−2×offset` em E/W, e outra coordenada colocada na borda de chegada). **Route 4**: sul `offset=-25`, `(7,17)→Route3 (57,0)`; este `offset=-4`, `(89,4)→Cerulean (0,12)`. O tile de origem sul `(6,17)` permanece caminhável, mas o seu destino `(56,0)` na Route 3 não tem passagem terrestre na grelha ROM e deixou de ser oferecido como candidato de passagem terrestre.
- `romOutdoorBoundaryCandidates.js` e `romLocalExitAccess.js` passam a avaliar simultaneamente as grelhas ROM de origem e destino, retirar candidatos que estejam fora da sobreposição ou caiam num tile de destino estático incompatível e distinguir casos de terreno terrestre, arbusto Cut, água Surf e terreno ainda bloqueado. **É uma prova de alinhamento de referência e de terreno**, não uma prova de travessia pelo jogador. `destinationCanEnterNowProven:false`, `borderTransitionProven:false`, `accessibleNow:null` permanecem.
- **Novo `romOutdoorOverlapIndex.js`**: prepara uma auditoria mundial para todas as ligações exteriores a partir dos 226 mapas do arquivo SHA da variante ativa, incluindo **78 ligações com sobreposição**, **1 484 pares de tiles sobrepostos**, **400 pares com terreno estático terrestre caminhável dos dois lados**, **70 fronteiras com ao menos um par terrestre**, **8 sem par terrestre**, **24 fronteiras com tiles de água** (Red, Blue e Green coincidem nestes totais). As 8 fronteiras não são declaradas permanentemente bloqueadas; podem depender de água, Cut, passagem com script ou outra condição.
- A telemetria guarda o índice mundial em memória por SHA do perfil, invalida quando a ROM muda, exclui os campos transitórios da cache JSON e partilha o índice com `romCampaignObjectives.js`. A interface mostra as estatísticas mundiais, as condições de acesso da primeira transição e os tiles de origem e destino de referência; `romWorldDetourCycles.js` acrescenta à hipótese de desvio o ponto de chegada **apenas do primeiro salto**, sem assumir acesso ao item ou às transições posteriores.
- **Testes executados na presente etapa:** `romOutdoorAlignment.test.js` 6/6; `romRoute4RealTerrainBorders.test.js` 5/5; `romOutdoorOverlapIndex.test.js` 6/6; `romLocalExitAccess.test.js` 14/14; suites `romCampaignObjectives.test.js`, `romWorldDetourCycles.test.js`, `worldAdvisorPanel.test.js`, `romClientCampaignIntegration.test.js` agregadas 54/54. Total **85/85 casos distintos aprovados**, divididos por testes V8 isolados com código e arquivos JSON publicados no GitHub. As suites de geometria sintética usam SHA substituído por hash de teste; as suites de arquivos reais usam os hashes previamente auditados obtidos pelos próprios bytes base64 (não SHA256 nativo do Node). **Não foi executado `npm test` nativo nem houve acesso a um emulador/ROM binário em execução.**
- Erros de teste encontrados e corrigidos: comparação `0` vs `-0` na reciprocidade e expectativa desatualizada de alinhamento da Route4; uma execução do executor V8 tinha Base64 incompleto, corrigido antes do rerun. Estes problemas não constituem provas de gameplay. Histórico append-only preservado.
- **Estado:** Navegação exterior melhorada para as 78 fronteiras, mas Scripts/Strength, leitura em frame, travessia real, combate, captura, evolução, itens e certeza de progresso em todo o jogo ainda **não estão 100% validados**. Não fundir PR #1 antes de provas E2E.


## 2026-10-29 — T24: terreno de chegada nas ligações exteriores

- Ao retomar T23, o HEAD da branch já continha `romOutdoorAlignment.js`, `gen1OutdoorConnectionOffsetsReference.json` e `romOutdoorOverlapIndex.js`, acrescentados entretanto. O alinhamento usa offsets do pret/pokered corroborados pelos ponteiros de bloco do cabeçalho ROM para 78 ligações, mas não prova passagem efetiva. Esta etapa não reivindica ter criado essa implementação anterior.
- Corrigido `romOutdoorBoundaryCandidates.js`: a análise da borda distingue explicitamente terreno de chegada `STATIC_LAND_POSSIBLE`, `CUT_NOT_AVAILABLE`, `CUT_ABILITY_KNOWN_ACTION_UNOBSERVED`, `SURF_NOT_AVAILABLE`, `SURF_ABILITY_KNOWN_ACTION_UNOBSERVED` e capacidades desconhecidas. As propriedades `destinationRequiresCut`, `destinationRequiresSurf` e `destinationEntryUsableNow:null` impedem confundir alinhamento ROM com acesso funcional em jogo.
- `public/app.js` apresenta agora o requisito de capacidade no tile de destino, além do tipo de terreno e do aviso de que a transferência não foi comprovada.
- Criado `tests/romOutdoorDestinationCapability.test.js` com três casos para água de destino, Cut de destino e terra comum, todos mantendo `borderTransitionProven:false`. **3/3 aprovados em V8 isolado com simulação explícita dos módulos de procura de percurso e de alinhamento; não são provas E2E nem substituem Node/ROM reais.**
- A validação com binário ROM ativo e emulador continua pendente. O projeto permanece PARCIAL.


## 2026-10-29 — T25: rotas multimapa através de fronteiras alinhadas

- A busca geométrica `romCrossMapItemRoute.js` passa a considerar as 78 fronteiras exteriores de Kanto, além dos warps, quando a identidade SHA, as referências ROM, os offsets e a dimensão dos mapas coincidem. O tile de origem só é elegível com caminho local; o destino tem de ser terreno terrestre caminhável. Água, Cut e scripts dinâmicos na chegada não são fingidos como passagem livre.
- `retroarchClient.js` passa o alinhamento ROM já disponível e invalida a cache quando a prova de alinhamento muda; `public/app.js` mostra separadamente warps, fronteiras e coordenada de chegada teórica, sem afirmar travessia observada.
- Acrescentados três testes de regressão em `tests/romCrossMapItemRoute.test.js`: desvio exterior com duas transições, SHA incoerente, chegada sobre água. Corrigida a indicação de esgotamento do orçamento da busca. Mantêm-se `accessibleNow:null` e `routeNavigableNowProven:false`.
- Verificação desta etapa: parsing JavaScript dos ficheiros alterados; testes de regressão acrescentados mas `npm test` nativo e E2E com ROM/emulador continuam pendentes. O progresso do projeto continua PARCIAL.

## 2026-10-29 — T25b: ordem dos tiles candidatos e prova de teste isolado

- O primeiro teste isolado do código T25 passou 8/9 casos. A nova prova de desvio exterior falhou porque a pesquisa colocava o tile de borda de Y=0 na fila antes do tile de Y=2, junto à posição RAM sintética, embora ambos dessem duas transições. Os outros 8 casos passaram.
- Corrigido `romCrossMapItemRoute.js` para ordenar as hipóteses de travessia de cada fronteira pelo comprimento geométrico do caminho local antes de as colocar na BFS; desempate estável por Y/X. Sem alteração à prova de acesso: as transições continuam condicionais.
- Teste nativo Node e funcionamento real em emulador continuam pendentes. A falha e a correção foram acrescentadas sem apagar entradas anteriores.

## 2026-10-29 — T25c: reexecução do código já publicado após correção

- Reobtidos os seis ficheiros atuais diretamente da revisão GitHub `6198a19ecfd6cd5ea65a4de7ce5310b1a1403961`: `romCrossMapItemRoute.js`, `romItemReachability.js`, `romKnownSha256.js`, `romLedgeRules.js`, `romOutdoorAlignment.js` e `tests/romCrossMapItemRoute.test.js`.
- Executadas as nove funções de teste da suite publicada, sem alterações ao texto dos testes, num V8 isolado que carregou o JS real dos módulos; `Buffer`, `node:test` e `node:crypto` foram simulados. **Resultado: 9/9 PASS**, incluindo os três casos novos da T25; 0 falhas. O cálculo de hash de teste é explicitamente NÃO SHA-256 criptográfico.
- Não houve execução nativa de `node --test` num checkout com ROMs reais, nem validação com RetroArch/SameBoy/iPhone ou captura de ecrã do jogo. Não considerar 9/9 V8 prova de integração ou de 100%.


## 2026-10-29 — T26: pesquisa multimapa partilhada para os itens da zona

- Antes só o primeiro item ROM com `NO_SAME_MAP_PATH` recebia análise. O motor `romCrossMapItemRoute.js` agora aceita até 64 alvos em `findCrossMapItemPaths` e reutiliza uma só BFS de warps e ligações exteriores alinhadas. O resultado mantém correspondência individual mapa/coordenada e `accessibleNow:null`, sem assumir travessia observada. API singular preservada.
- O motor diferencia `maxStatesExceeded` de ausência de percurso e não confunde os resultados de itens distintos. O cliente transmite todos os itens elegíveis, calcula a pesquisa uma vez por alteração da RAM/posição/itens e expõe `romCrossMapItemRoutes`; `public/app.js` usa o resultado específico do item. Invalidação de RAM e exclusão de cache persistente atualizadas.
- Quatro testes acrescentados: múltiplos alvos, separação entre resultados, rejeição de entrada inválida e orçamento insuficiente. Antes da publicação, **13/13** passaram em teste isolado V8 com adaptadores simulados para Buffer/crypto. Não equivale a Node nativo nem E2E real.
- Neste ambiente a tentativa de obter o checkout através do GitHub falhou por indisponibilidade DNS; a escrita foi efetuada por ligação GitHub. ROMs, saves, sessões e armazenamento local do utilizador não foram alterados. Ficam por validar a cobertura e o desempenho reais no emulador.


## 2026-10-29 — T27: prova de isolamento entre itens visíveis e ocultos no painel

- A pesquisa T26 indexava rotas por posição e tipo de item, mas `public/app.js` comparava apenas mapa/X/Y. A interface passou a exigir também `target.hidden` igual ao tipo do evento ROM (`ITEM` ou `HIDDEN_ITEM`), evitando atribuir o percurso de um objeto visível a um item oculto nas mesmas coordenadas.
- Acrescentado teste de regressão à suite `worldAdvisorPanel.test.js` para colisão de coordenadas entre tipos. A suite `romClientCampaignIntegration.test.js` passou a exigir exclusão de `romCrossMapItemRoutes` das duas caches persistentes e invalidação dos resultados numa sessão RAM incoerente.
- Verificação real desta etapa: secção de renderização obtida do `app.js` efetivo e executada em V8 com estado sintético; uma rota visível produz uma sugestão, uma rota oculta produz uma, ambas produzem duas e SHA divergente produz zero. Parsing JS dos três ficheiros alterados aprovado. Sem screenshot de gameplay, teste nativo integral ou validação em emulador.


## 2026-10-29 — T28: resultados multimapa inconclusivos, diferenças Green e mensagens explícitas

- `public/app.js` passa a distinguir, por item ROM da zona, procura interrompida devido a limite de estados versus procura geométrica concluída sem rota demonstrada. Ambos mantêm acesso por confirmar, nunca «bloqueado para sempre». Mensagens só aparecem quando mapa, SHA, tipo e coordenadas correspondem ao mesmo resultado de `romCrossMapItemRoutes`.
- Novo teste em `worldAdvisorPanel.test.js` cobre os dois estados e a remoção das mensagens quando o SHA da ROM diverge. A execução da função real de renderização num V8 isolado comprovou os três cenários; **não** é screenshot do emulador.
- Auditoria independente dos três JSONs de terreno do repositório: Red/Blue têm 226 mapas, 95 132 células, 48 504 caminháveis e 46 628 bloqueadas; Green tem as mesmas 95 132 células, 48 570 caminháveis e 46 562 bloqueadas. A primeira hipótese de totais Red=Green era errada; os próprios metadados Green explicam a diferença de 66 células, concentrada nos IDs 226, 227, 228. Já existem testes específicos em `romTerrainCatalogueIntegrity.test.js` e `romTerrainVariantDiff.test.js`; não foram criadas duplicações.
- Sem execução em RetroArch/SameBoy, sem binário ROM ativo verificado, sem teste nativo Node completo. O progresso continua PARCIAL.


## 2026-10-29 — T29: exploração com grelhas reais Red/Blue/Green e teste reproduzível

- Carregadas, sem modificar, as 226 matrizes estáticas e 95 132 células de cada `romTerrain_red.json`, `romTerrain_blue.json` e `romTerrain_green.json`. Em V8 isolado o motor T26 recebeu as 78 referências exteriores pret/pokered, dimensões originais dos mapas, e uma grelha de 813 warps sem destinos utilizáveis para isolar a travessia exterior.
- Com posição **sintética** de teste no tile caminhável real da Route 4 (mapa #15, X89/Y4), o destino de referência da borda Este para Cerulean City (mapa #3) foi X0/Y12 em todas as variantes; pesquisa terminou em 2 estados por variante e `found:true`, `kind:OUTDOOR_BORDER` e `routeNavigableNowProven:false`. O tile de destino é um **alvo de ensaio**, não se afirma existir lá um item.
- Os bytes de terreno usados no ensaio foram comparados por igualdade exata Base64 com os arquivos e hashes publicados; o adaptador V8 não recalculou SHA-256 criptográfico. Não é uma prova de que a partida em execução realizou a travessia.
- Criado `tests/romCrossMapRealTerrainBorders.test.js` para execução nativa futura com os arquivos JSON reais do repositório e `node:test`: três casos reais de fronteira e um caso de SHA incoerente. O teste reconstrói o alinhamento através de 78 descritores/pointers ROM e da rotina `validateOutdoorAlignment`, sem atribuir resultados a ROMs não verificadas. Não executado em Node nativo nesta sessão devido à falta de checkout por DNS.
- A implementação continua em Draft, sem merge, com Cut/Surf em destinos, scripts e prova E2E pendentes.


## 2026-10-29 — T30: correção de ReferenceError após pesquisa partilhada

- Revisão da execução T26–T29 identificou bug real de integração: a declaração singular `detourTarget` fora removida ao introduzir `detourTargets`, mas o cálculo posterior `suggestWorldDetours` continuava a referenciá-la. O JS passava no parsing e falharia em execução com `ReferenceError` na passagem do estado RAM.
- Restaurada ligação explícita `const detourTarget=detourTargets.find(...)`, selecionando o **primeiro alvo ainda sem rota** no resultado ordenado da pesquisa partilhada. O ciclo topológico deixa de ser ignorado apenas porque outro item encontrou percurso. Quando todas as rotas já têm hipótese, não cria ciclo redundante.
- Teste de regressão `romClientCampaignIntegration.test.js` extrai e executa a seleção real do cliente com um item encontrado, um não encontrado e nenhum pendente; também verifica que a guarda posterior usa a variável ligada. Prova isolada local do próprio excerto em V8: seleção 2/nenhum/1 correta; parsing completo dos módulos alterados aprovado. Não foi executado `npm test` em Node nativo nem telemetria real.
- Sem alterações na `main`, ROMs, saves ou aplicações do utilizador. Histórico preservado por acrescento.


## 2026-10-29 — T31: planeador local conservador de Strength baseado em ROM + sprites RAM

- Investigada a rotina original `pret/pokered` em `engine/overworld/push_boulder.asm`, `engine/overworld/player_state.asm` e `engine/menus/start_sub_menus.asm`: Strength requer Rainbow Badge e golpe n.º 46, ativação de flag de campo, duas tentativas de empurrão iniciais e colisão de terreno/sprites antes do movimento. Fonte identificável no código desassemblado público, não dedução de um guia externo.
- Novo `romStrengthPushPlanner.js`: BFS de estados `posiçãoJogador|posiçõesOrdenadasRochas`, máximo de 8 rochas, 8 empurrões e orçamento limitado de estados. Só recebe mapa de colisões do SHA conhecido, coordenadas RAM corroboradas e sprites confirmados; rejeita água, arbustos Cut, escadas, pares de tiles incompatíveis, sprites imóveis, rochas sobrepostas e destinos fora da zona. Regista direção/origem/destino dos empurrões sem alegar ação, animação, ativação ou acessibilidade comprovada.
- `retroarchClient.js` calcula Rainbow Badge + Strength no grupo apenas quando equipa/insígnias estão corroboradas. Se o radar já sinalizar `POSSIBLE_STRENGTH_BARRIER`, procura uma sequência teórica e devolve `STRENGTH_SEQUENCE_HYPOTHESIS`, `NEEDS_STRENGTH` ou `STRENGTH_CAPABILITY_UNKNOWN`. Sem leitura da flag `BIT_STRENGTH_ACTIVE`: `strengthActivationVerified:false`.
- `public/app.js` distingue capacidade e empurrões teóricos, sem garantia de recolha. Adicionados `romStrengthPushPlanner.test.js` e novos cenários em `worldAdvisorPanel.test.js` e `romClientCampaignIntegration.test.js`.
- Verificação executada: parsing dos seis ficheiros JS alterados e quatro cenários runtime do novo planeador em V8, usando `terrainBytes` simulado com grelha sintética: sequência encontrada, NPC bloqueante rejeitado, limite de empurrões e SHA errado rejeitados. Não equivale à suite nativa nem a execução real no emulador. Não foram criadas capturas do jogo porque não há ligação a um emulador autenticado nesta sessão.
- As situações de buracos, interruptores, correntes e scripts que dependem da posição da rocha continuam PENDENTES. Nada foi alterado nos saves, sessões protegidas ou no disco C:.


## 2026-10-29 — T32: incapacidade Strength corretamente marcada como bloqueio local

- Corrigido `retroarchClient.js`: `NEEDS_STRENGTH` não integrava `withinMapBlocked`, o que deixava `isLocked:false` apesar de o utilizador ainda não ter Rainbow Badge ou um Pokémon com Strength. Agora o motivo de bloqueio condicional acompanha a rota teórica.
- Uma sequência `STRENGTH_SEQUENCE_HYPOTHESIS` com capacidade conhecida permanece condicional e não é certificada acessível; `STRENGTH_CAPABILITY_UNKNOWN` permanece indeterminada, não declarada bloqueio comprovado. A propriedade independente `accessibleNow` continua `null`.
- Regressão acrescentada à integração: extração/execução real do bloco `withPath` em V8 com cinco estados resultou `[true,false,false,true,false]` para `isLocked`, como esperado; parsing validado. Sem `npm test` nativo e sem gameplay observado.


## 2026-10-29 — T33: procurar desvios mundiais quando o bloqueio local é Cut/Surf/Strength

- Até T32, `detourTargets` incluía só `NO_SAME_MAP_PATH`, excluindo itens com bloqueio conhecido ou capacidade incerta de Cut/Surf/Strength. Um bloqueio **local** não prova que não exista outra entrada por warp ou fronteira exterior.
- Agora são enviados ao motor de pesquisa partilhada, com limites existentes de 64 alvos e 250 estados, os itens ROM validados nos estados `NEEDS_CUT`, `NEEDS_SURF`, capacidades desconhecidas, Cut+Surf hipotético, `POSSIBLE_STRENGTH_BARRIER`, `NEEDS_STRENGTH`, `STRENGTH_CAPABILITY_UNKNOWN`, `STRENGTH_SEQUENCE_HYPOTHESIS` e `NO_SAME_MAP_PATH`. Um `CONDITIONAL_PATH` local não exige pesquisa global adicional. Itens recolhidos/sem coordenadas ROM auditadas continuam excluídos.
- Teste de integração adicionado: executa a seleção exata extraída de `retroarchClient.js` com 12 estados, espera os 10 bloqueios condicionais e rejeita itens recolhidos ou sem referência ROM. V8 verificou 10/10 selecionados e parsing de cliente/testes aprovado. Sem alegação de acesso real ou teste Node nativo.
- O resultado global mantém `accessibleNow:null`, pois as sequências entre mapas não comprovam portas, scripts, movimento do jogador ou batalhas. Histórico acrescentado sem apagar entradas antigas.


## 2026-10-29 — T34: cache de Strength e prevenção de falsas instruções de marcha

- O cálculo T31 fazia BFS até 1400 estados em cada leitura RAM por item dependente de rocha. Implementada uma cache **apenas em memória**, indexada por SHA, mapa, posição, capacidade Strength, confiança nos sprites e todas as posições/tipos/pictureIds observados. Cada alvo é identificado também por X/Y e pelo seu tipo oculto/visível. Limite máximo de 64 entradas; invalidação obrigatória em falhas de mapa e `invalidateWorldEvidence`. Não persiste informações transitórias no disco.
- `entry.route.nextStep` de um plano de Strength passa a `null`: o primeiro tile do plano pode ser ocupado pela própria rocha e não é seguro apresentá-lo no Itemfinder como um passo de caminhada. A rota fornece separadamente `firstPush` com direção e origem/destino como **empurrão teórico**, mostrado no painel.
- Adicionados casos à integração e testes da interface. Verificação V8 da secção real do cliente: duas leituras iguais executaram a procura **uma vez**, mudança do sprite executou nova procura (total 2); parsing cliente/UI/testes validado. Sem teste nativo Node completo, ROM ativa ou screenshot do emulador.


## 2026-10-29 — T35: correção de item visível com sprite na RAM como destino de Strength

- Revisão do novo planeador T31 encontrou um falso negativo: `itemContact` rejeitava qualquer sprite em `target`, incluindo o próprio item visível da ROM que deve ser alcançado por adjacência. Isso impedia a maioria das rotas com Poké Ball realmente presente no ecrã.
- `romStrengthPushPlanner.js` mantém sprites de itens na colisão física de caminhar e empurrar, mas permite interação por tile adjacente quando o objeto na coordenada alvo é explicitamente `type:'item'`. Um NPC ou sprite genérico sobre esse alvo continua a ser impeditivo; item oculto sob um sprite continua sem caminho demonstrado.
- Três testes novos em `tests/romStrengthPushPlanner.test.js` cobrem rocha deslocada para um nicho, item visível presente no alvo, NPC substituto e item oculto na mesma coordenada.
- A execução em V8 do módulo JavaScript efetivamente editado, com adaptador local do terreno, passou os três cenários: um empurrão norte para abrir o corredor, NPC sem caminho, item oculto sem caminho; sintaxe do módulo e testes passou. O adaptador não realiza SHA-256, nem emulador, pelo que **não** conta como testes nativos integrais.
- Esta alteração não mexe na `main`, nos ficheiros ROM/saves nem noutras aplicações protegidas.


## 2026-10-29 — T36: ler diretamente o bit de ativação Strength em D728

- `pret/pokered ram/wram.asm` e `constants/ram_constants.asm`: `wStatusFlags1` fica em **D728** e `BIT_STRENGTH_ACTIVE` é o bit 0. O bloco de RAM existente D5A0–D8AF já inclui o byte no offset **0x188/392**, sem novos pedidos ao emulador.
- Novo módulo `romStrengthFieldEvidence.js` exige SHA conhecida, identidade da ROM ativa, janela do mapa e coordenadas corroboradas, bloco de 784 bytes completo e hexadecimal válido. Devolve `activeAtSample` verdadeiro/falso ou `null` quando falta prova; conserva `snapshotAtomicVerified:false` e `pushObserved:false`.
- O cliente integra a flag com os resultados de Strength e publica `romStrengthFieldEvidence` apenas como dado transitório, invalidado e não persistido em caches. A interface distingue flag ativa, inativa ou desconhecida, sem confundir esse bit com um empurrão realmente executado.
- Testes de decoder, ligação RAM→cliente e renderização adicionados. Em V8 a rotina efetivamente editada distinguiu corretamente 00/02 (inativo), 01/81 (ativo) e rejeitou mapa incoerente; parsing de seis ficheiros concluído. Não foi executado `npm test` nativo nem prova E2E da ROM ativa.


## 2026-10-29 — T37: distinguir desvio por percurso local inexistente de capacidade condicional

- Após T33, os ciclos de retorno `suggestWorldDetours` eram chamados com `localPathAbsent:true` para **todos** os itens, incluindo os que têm caminho local condicional (Cut, Surf ou Strength). Corrigida essa falsa premissa.
- O motor aceita agora duas provas mutuamente exclusivas: `localPathAbsent:true` para `NO_SAME_MAP_PATH`, ou `localPathConditional:true` para capacidades/obstáculos locais que ainda podem ter alternativa via mapa adjacente. Ambos os modos continuam hipóteses topológicas, sem `targetAccessProven`.
- O cliente envia o modo de forma explícita por `accessStatus` e inclui o estado na chave de cache, evitando reutilizar uma hipótese anterior com premissa diferente. O resultado publicado inclui `localPathEvidence: NO_SAME_MAP_PATH|CONDITIONAL_LOCAL_BARRIER`.
- Adicionados testes à suite do motor e à integração. Verificação em V8 com módulo efetivo: ciclo de três mapas encontrado nos dois modos, ambos os modos ausentes ou ambos presentes rejeitados, e sem acesso garantido. Parsing JS completo dos quatro ficheiros validado. Teste nativo Node integral e emulador continuam não realizados.


## 2026-10-29 — T38: regressão conjunta UI + integração e atualização da asserção multimapa

- Reexecutados em V8 os testes existentes `tests/worldAdvisorPanel.test.js` e `tests/romClientCampaignIntegration.test.js` com código literal extraído da branch. Um primeiro adaptador de `vm.runInNewContext` não conservava variáveis globais e não devolvia expressões, gerando falsos negativos; adaptador corrigido preservou as mutações de contexto.
- Após corrigir o adaptador, **43/44** passaram. A única falha real era uma asserção desatualizada à mensagem antiga `Desvio multimapa TEÓRICO: 2 warps`; desde T25 o painel corretamente mostra `2 transições (2 warps, 0 fronteiras)`.
- Teste alterado para conferir a formatação nova, sem relaxar os controlos de mesma SHA, mapa, coordenadas e acesso não garantido. A alteração afeta a suite de regressão, não altera o jogo nem altera o resultado da UI.
- Motor Strength/flag RAM/ciclos: regressão conjunta anterior foi de **21/21** em V8, usando fontes publicadas, `Buffer` e hash simulados. Suite de UI/integração utiliza `fs`/`vm` simulados; ambas continuam distintas do teste Node nativo, cuja execução sobre o checkout completo está pendente.


## 2026-10-29 — T38b: correção da asserção e validação 44/44 UI/integração

- A primeira edição T38 tinha escapado duas vezes os parênteses no regex JavaScript, introduzindo uma falha no teste novo apesar da saída correta do painel. O erro foi reproduzido em V8.
- Substituída por duas asserções independentes, para `2 transições` e `2 warps, 0 fronteiras`, evitando escapes frágeis. A suite `worldAdvisorPanel.test.js` + `romClientCampaignIntegration.test.js`, usando as fontes literais da branch e adaptadores para `vm`/`fs`, terminou com **44/44 PASS**, sem regressões.
- O teste continua isolado em V8; Node nativo com dependências de projeto e UI no emulador não foram executados nesta sessão. A `main` e o histórico prévio permanecem intactos.


## 2026-10-29 — T39: Strength exige terreno da variante ROM e cache ligada aos hashes

- Corrigido o desfasamento entre `planItemAccess` e o motor Strength: antes um plano Strength podia usar terreno do guia estático sem exigir `romVariantTerrainEvidence.verified`. Agora exige `verified=true`, SHA igual à identidade ROM ativa e terreno com `verified=true`, senão conserva `POSSIBLE_STRENGTH_BARRIER` sem proposta de empurrão.
- A cache inclui os fingerprints `tileIdsSha256` e `walkingBitsSha256`; quando muda a grelha é recalculada, e um estado de variante não validada não utiliza resultados antigos.
- Teste adicionado à integração com o bloco real extraído de `retroarchClient.js`. Em V8: duas leituras iguais executam 1 pesquisa, alteração do hash executa uma segunda, invalidação da variante interrompe novas pesquisas e não promove o estado. Parser JS aprovado. Não foram executados `npm test` nativo nem provas de emulador.


## 2026-10-29 — T40a: alvos exatos de itens ocultos por recolher em Kanto

- Novo `romGlobalFlagItemRoutes.js` com `selectGlobalFlagTargets`: usa o ledger de 226 mapas validado contra a SHA da ROM, flags D6F0/D6FE e objetivos globais para selecionar até quatro posições específicas de itens e fichas ocultas **fora do mapa atual**. Só escolhe registros com `flagSet:false` e `mapHopCount` estático conhecido; nunca inventa item, coordenada ou flag.
- `planGlobalFlagItemRoutes` chama o motor multimapa partilhado com as coordenadas ROM dos alvos, mantendo `accessibleNow:null` e `routeNavigableNowProven:false`. Sem prova da posição RAM e sem matriz ROM válida, rejeita a pesquisa em vez de afirmar bloqueio ou acesso.
- Criados cinco testes em `tests/romGlobalFlagItemRoutes.test.js`: seleção exata, exclusão de recolhidos/locais, limitação de quantidade, rejeição de SHA/mapa mal combinados e ausência de posição. Execução em V8 do módulo real com motor de rotas simulado passou os cenários principais; os testes foram publicados, mas ainda não executados em Node nativo.


## 2026-10-29 — T40b: ligar alvos remotos por flags ao companion e ao painel

- `retroarchClient.js` passa a selecionar até 4 itens ocultos/fichas pendentes **noutros mapas** usando o ledger e as metas mundiais, e a procurar hipóteses de percurso até coordenadas ROM exatas com `planGlobalFlagItemRoutes`. O motor só é chamado após `romVariantTerrainEvidence.verified` e SHA da variante ativa correspondentes.
- A pesquisa partilhada fica limitada a 180 estados e 10 transições, com cache dependente da posição, mapa, flags selecionadas, capacidades, sprites e alinhamento das fronteiras. `globalFlagItemRoutes` é invalidado com a sessão RAM e excluído de ambas as caches em disco.
- `public/app.js` mostra até quatro alvos remotos, o mapa, coordenadas ROM, número teórico de warps/fronteiras e primeira saída candidata. Nunca apresenta acesso ou recolha garantidos. SHA ou mapa divergente suprimem a secção.
- Adicionados testes à integração e ao painel, com parsing JS aprovado. Estes testes foram publicados para execução; não equivalem a `npm test` nativo nem ao emulador ativo.


## 2026-10-29 — T41: invalidação de rotas mundiais ao perder prova RAM/ROM

- A cache T40b era sensível a mapa/posição/flags e bool do alinhamento exterior, mas a perda de `romWarpGraph.verified` ou a inconsistência da janela RAM não estavam explicitamente contempladas na prontidão da pesquisa. Corrigido `retroarchClient.js`: `remoteSearchReady` exige terreno da variante, grafo da mesma SHA, mapa e coordenadas corroborados.
- A chave de cache inclui `remoteSearchReady`, validade do grafo ROM e prova de referência das conexões exteriores; a perda de prova descarta resultados antigos e devolve `verified:false` em vez de mostrar percursos de uma leitura passada.
- Regressão acrescentada à suite de integração com execução do bloco real do cliente: 2 leituras iguais usam 1 pesquisa, perda de grafo invalida, restituição reexecuta (2), perda de posição invalida novamente. V8/parsing aprovados; não equivale a Node ou gameplay nativo.


## 2026-10-29 — T42: verificar identidade exata das rotas globais de itens ocultos

- Endurecida `romGlobalFlagItemRoutes.js`: o resultado global da pesquisa de terreno exige agora `verified:true`, mesma SHA e mapa de origem. Cada rota individual tem ainda de apresentar o mesmo mapa/X/Y/hidden do alvo pedido, com `accessibleNow:null` e `routeNavigableNowProven:false`. Um índice de array já não é, por si, prova de correspondência de objetivo.
- Regressão acrescentada à suite para um item oculto remoto ligado por warp estático num atlas sintético de 226 mapas e 813 entradas de warp. Espera um desvio geométrico até à coordenada do item, mantendo acesso não comprovado. A execução nativa desta regressão continua pendente.
- Prova isolada do módulo em V8 com pesquisa injetada: resposta válida aceite; resposta com coordenada do item alterada rejeitada com `verified:false`. Parsing de módulo e testes aprovado. Histórico acrescentado; `main` intacta.


## 2026-10-29 — T42b: fixture multimapa corrigida e regressão isolada integral 6/6

- A primeira fixture de `romGlobalFlagItemRoutes.test.js` era internamente impossível: o item remoto estava em X5, mas o atlas sintético tinha apenas 5 colunas (X0..X4). A geometria do ensaio foi corrigida para 7×5 tiles com 35 células por mapa, sem alterar os alvos ROM do teste.
- Reexecutado o teste literal completo do repositório com `romGlobalFlagItemRoutes.js`, `romCrossMapItemRoute.js`, `romItemReachability.js` e `romLedgeRules.js` originais da branch, usando adaptadores V8 para `Buffer` e SHA-256. **6/6 casos passaram**, incluindo uma rota real do algoritmo através de um warp estático de mapa 0 para mapa 10, até ao item remoto na coordenada X5/Y4; continua `accessibleNow:null`.
- O teste com atlas de 226 mapas é sintético; estas provas não substituem Node nativo, a verificação SHA criptográfica nem a telemetria de jogo. A alteração foi só na fixture e no histórico acrescentado.


## 2026-10-29 — T43: seleção de objetivos mundiais diversificada por mapa

- O limite conservador de quatro alvos de T40 podia ser consumido por quatro flags não recolhidas no mesmo mapa, não deixando aparecer mapas próximos com outros objetivos. `romGlobalFlagItemRoutes.js` passou a agrupar as flags pendentes por mapa, percorrer uma vez cada mapa candidato na ordem estática do conselheiro e só depois repetir mapas com novos objetivos.
- Continua a usar exclusivamente `flagSet:false`, posições ROM auditadas e mapas com rota topológica conhecida; não aumenta o orçamento de pesquisa nem declara acesso confirmado. A origem e os objetivos já recolhidos continuam excluídos.
- Regressões adaptadas à nova ordenação e acrescentado cenário de três mapas e quatro vagas que exige `[10,20,30,10]`. A seleção efetiva passou em V8, e parsing do módulo e testes foi aprovado. Testes nativos, recolha de gameplay e screenshots reais continuam pendentes.


## 2026-10-29 — T44: catálogo mundial de objetivos sem corte silencioso aos 12 mapas

- Identificado limite estrutural: `romCampaignObjectives.js` restringia `maxResults` a 50 e `retroarchClient.js` pedia apenas 12; o novo `romGlobalFlagItemRoutes.js` consultava exclusivamente esses 12, podendo nunca receber itens ocultos pendentes em mapas posteriores.
- `campaignObjectives` permite agora catálogo até **226 mapas**, reportando `totalObjectives` e `catalogueTruncated`; o cliente solicita os 226 mapas normais. O painel mantém no máximo oito objetivos visíveis e a pesquisa multimapa permanece limitada a **quatro alvos**, **180 estados** e **10 transições**. Não se pretende afirmar cobertura semântica total dos scripts.
- Teste nativo em fonte `romCampaignObjectives.test.js` e regressão de integração adicionados. A execução em V8 da própria função comprovou 226/226 objetivos com `maxResults:226` e 12/226 com `maxResults:12`, assinalando truncagem. Sintaxe dos quatro ficheiros JavaScript passou. Suite completa `node --test` e emulador ainda não executados.


## 2026-10-29 — T45: manter itens pendentes sem ligação estática identificada

- O seletor mundial descartava mapas com `mapHopCount:null`; desapareciam do radar itens ocultos e fichas com flags de recolha explicitamente pendentes. Agora conserva-os como `staticRouteKnown:false`, com coordenadas e flag do ledger ROM/RAM.
- O planeador só pesquisa alvos com ligação topológica conhecida e deixa os restantes com `route:null` e `routeNotAttemptedReason:NO_STATIC_MAP_ROUTE`. Não gasta estados nem afirma que a zona está bloqueada. O painel mostra 'ligação estática entre mapas por determinar; procura não executada — NÃO prova bloqueio'.
- Testes de módulo e UI acrescentados. Execução em V8 do módulo real com 226 mapas sintéticos confirmou alvo preservado, 0 pesquisas e `accessibleNow:null`. Parsing completo dos quatro ficheiros JavaScript alterados passou. Validação nativa e em jogo continua pendente.


## 2026-10-29 — T46: cache de rotas remotas segue mudanças de conectividade

- A T45 preserva itens cuja `mapHopCount` era `null`, mas a cache do cliente só usava tipo/mapa/X/Y/bit da flag. Se a mesma coordenada passasse de 'sem rota estática' para 'rota estática conhecida' (ou vice-versa) sem mudar de posição, a cache podia continuar a mostrar uma conclusão antiga.
- `retroarchClient.js` acrescentou `mapHopCount` e `staticRouteKnown` de cada objetivo à chave de cache. Teste de integração e execução do bloco real em V8 comprovaram 4 leituras: desconhecida, desconhecida (cache), rota identificada (recalcula), desconhecida (recalcula). Foram efetuadas 3 pesquisas em vez de 4, sem servir estados antigos.
- O histórico permanece append-only e a `main` intocada. Os ensaios continuam isolados e não substituem `node --test` nem leitura de jogo real.


## 2026-10-29 — T47: cobertura mundial explícita, sem confundir quatro sugestões com o total

- Os quatro alvos da pesquisa multimapa eram um orçamento de CPU, não uma contagem do backlog; o painel não diferenciava isso. `selectGlobalFlagTargets` agora calcula `totalPendingRemote` de todos os itens/fichas com flags pendentes e coordenadas auditadas nos mapas do catálogo, `mapsWithPendingRemote` e `totalWithoutStaticRoute` antes de limitar os alvos visíveis.
- `public/app.js` passa a indicar quantos objetivos remotos existem e quantos mostra (por exemplo, 1 de 17), bem como os que continuam sem rota estática identificada, distinguindo desconhecimento de bloqueio. Não inventa números: mostra os contadores apenas quando os recebe de uma seleção validada.
- Regressões acrescentadas ao módulo e à interface. Execução V8 com 226 mapas sintéticos confirmou 3 alvos pendentes em 2 mapas, 1 sem rota estática e só 2 selecionados. Parsing dos quatro ficheiros passou. Ainda não há prova de jogo/emulador ou suite nativa.


## 2026-10-29 — T48: índice compacto dos 226 mapas sem inflacionar a telemetria

- Após T44, `retroarchClient.js` publicava 226 objetivos completos no WebSocket, cada um podendo incluir uma sequência longa de warps e metadados estáticos, apesar de o painel só utilizar 8. Corrigido o custo sem voltar a perder cobertura.
- `romCampaignObjectives.js` acrescenta `remoteObjectiveIndex` (apenas `mapId` e `mapHopCount`, até 226) e `objectiveIndexCount` enquanto mantém `objectives` detalhado condicionado por `maxResults:12`. `selectGlobalFlagTargets` consulta o índice completo quando presente, valida contagem, IDs únicos e valores de passos e falha fechado perante índice contraditório. Retrocompatibilidade com testes/consumidores sem índice preservada.
- O cliente voltou a pedir só 12 objetivos detalhados; o radar remoto continua a poder selecionar flags no 226.º mapa, sem alterar o limite de 4 pesquisas por leitura. UI continua a mostrar 8 sugestões detalhadas e o total real de pendências.
- Adicionados testes do catálogo, seleção depois da 12.ª posição e integração. Prova V8 com dados sintéticos: 12 detalhes, 226 entradas compactas e item pendente do mapa #80 selecionado corretamente. Parsing dos seis ficheiros JS aprovado. A medição real de serialização e `npm test` nativo continuam pendentes.


## 2026-10-29 — T48b: ajustar regressão ao catálogo compacto e validar UI/integração

- Após T48, dois testes de integração ainda assumiam o formato anterior: `maxResults:226` nos dados detalhados e uma janela de inspeção de 450 caracteres que não incluía o literal `maxResults:12`. Corrigidas ambas as asserções para distinguir índice mundial de 226 mapas e preview detalhada de 12 objetivos.
- Os 53 testes de `worldAdvisorPanel.test.js` e `romClientCampaignIntegration.test.js` foram reexecutados a partir dos ficheiros efetivamente publicados na branch com adaptação V8 de `node:vm` e `node:fs`: **53/53 aprovados**. Nenhum dado real de ROM, RAM ou cliente foi alterado nesta correção. Sem prova Node nativa.


## 2026-10-29 — T48c: atualizar teste de limites 100→226 após auditoria conjunta

- A execução conjunta dos testes do índice mundial e objetivos de itens apontou **24/25**: teste pré-T44 ainda tratava `maxResults:100` como inválido, apesar de o motor agora suportar até 226 mapas. Conferido que o código efetivo rejeita 227 e aceita 100 sem violar os limites da ROM.
- Asserção antiga corrigida para exigir `maxResults:100` válido e `maxResults:227` inválido. A suite será reexecutada depois da alteração. Sem mudança de lógica funcional ou de saves; a `main` permanece intocada.


## 2026-10-29 — T49: invalidação da cache quando muda qualquer flag remota pendente

- T47 deu ao painel contadores de todas as flags remotas, mas a cache do cliente T46 dependia apenas dos quatro itens selecionados e da conectividade desses alvos. Uma flag num quinto item podia mudar e deixar o contador stale, mesmo com RAM e SHA válidas.
- `selectGlobalFlagTargets` emite `pendingSignature`, identificação textual exata de **todos** os alvos pendentes no catálogo, antes de consumir os quatro lugares. A chave de cache remota depende agora dessa assinatura além do estado dos alvos exibidos. Usa os próprios IDs/bitIndex/mapa/posição/ligação, sem hashes aproximados e sem criar dados fictícios.
- Testes de módulo e integração adicionados. Ensaio V8 do módulo real: os dois alvos selecionados ficaram iguais, a flag de um terceiro passou a recolhida e o total mudou 4→3, com assinatura diferente. Parsing dos quatro ficheiros JavaScript passou. Sem `node --test` integral ou gameplay real.


## 2026-10-29 — T50: inventário mundial dos itens visíveis da ROM, sem falsa recolha

- O ledger de 226 mapas continha flags de itens ocultos/fichas/treinadores/Pokémon fixos, mas não um inventário mundial dos objetos de tipo `item` presentes nos cabeçalhos da ROM. Sem este domínio, o PokéGuide podia omitir objetos visíveis de um mapa inteiro.
- `romCampaignLedger.js` percorre agora todos os objetos `kind:'item'` dos mapas auditados, valida X/Y, regista `mapId`, ordinal, coordenadas e ID de item ROM quando existe. Cada objeto fica com `collected:null` e `removedFromCurrentMap:null`; **não** existe flag global de recolha comprovada neste módulo. Os totais são calculados dos objetos reais, não inventados.
- `romCampaignObjectives.js` acrescenta `visibleItems` aos desconhecidos dos mapas; a UI mostra 'itens visíveis na ROM (recolha por confirmar)' em vez de 'por recolher'. Estes objetivos entram no índice compacto dos 226 mapas, mas nunca como pendências confirmadas.
- Testes de ledger, objetivos mundiais e UI acrescentados. Em V8 com código real e perfil ROM sintético de 248 entradas/226 mapas válidos: 2 itens visíveis num mapa contabilizados como 2 desconhecidos e 0 recolhas afirmadas; parsing dos seis JS aprovado. Falta execução Node nativa e prova no jogo.
