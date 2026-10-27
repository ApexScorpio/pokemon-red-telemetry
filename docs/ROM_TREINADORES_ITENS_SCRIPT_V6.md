# ROM + RAM — treinador a treinador e IDs reais de itens ocultos

**Fase 6 — 27 de outubro de 2026**

## Descobertas verificadas nos três binários

Foram analisados byte a byte os três ficheiros fornecidos pelo utilizador (Red, Blue, Green International v1.2.1) e comparados os SHA-256 conhecidos. **Não se publicou nem alterou nenhuma ROM ou save.**

### Treinadores

Para cada objeto classificado como treinador na ROM, a análise segue **o apontador de texto do objeto do mapa → bloco TEXT_ASM → instrução LD HL do cabeçalho de treinador → CALL TalkToTrainer (direto ou via JR partilhado) → ponteiro para o byte de wEventFlags e índice do bit**. O formato de um cabeçalho de treinador é de 12 bytes: bit relativo, distância de visão, endereço da memória de eventos e quatro ponteiros de texto. Nas ROMs Red/Blue, a rotina de diálogo é diferente da Green, pelo que o resolvedor valida a estrutura em vez de reutilizar cegamente um endereço.

- **346** objetos classificados como treinadores nos mapas legíveis de cada ROM.
- **312** objetos com flag associada diretamente à instrução do respetivo NPC, em **67 mapas**. A tripla `mapId, objectOrdinal, eventBitIndex` coincidiu nas três ROMs.
- **34** objetos com scripts especiais ou sem ligação única: mantêm o estado por confirmar.
- Route 6 (mapa 17): seis objetos e flags 1041–1046.
- Route 24 (mapa 35): o primeiro NPC é especial; os objetos 2–7 têm flags 1346–1351, sem inventar uma flag para o primeiro.

O `romTrainerEvents.js` contém um atlas compacto com 312 associações, ativado **só para os SHA-256 exatos** das três ROMs. Não exige substituir ZIPs anteriores; portanto, o arranque automático do Companion continua compatível com perfis v4. Para ROMs novas analisadas diretamente no PC, `romWorldData.js` descodifica agora também as associações do próprio binário para o perfil correspondente.

**Limitação semântica crítica:** no motor Gen I, o bit de um treinador pode ser ativado por um script de outra batalha (por exemplo, após derrotar um líder de ginásio). Portanto, `eventFlagSet=true` é prova de que **a flag de batalha foi ativada / a luta está desativada pela flag**, **não é prova de que o jogador combateu esse NPC individualmente**. Os campos `defeated` de histórico individual mantêm-se `null` enquanto não houver observação gravada do combate. O dashboard mostra `combate desativado`, `flag não ativada` ou `desconhecido`; não fabrica vitórias.

### Itens ocultos

Localizado o índice `HiddenEventMaps` e os seus apontadores de eventos na ROM (banco 0x11). Para cada uma das **54** entradas de `HiddenItemCoords`, o respetivo registo de evento tem a estrutura `[Y, X, itemId, bank, handlerCpu]`. Foi exigida a coincidência de mapa e coordenadas e a validação do endereço da rotina `HiddenItems` em cada versão (Red 1D:6688, Blue 1D:6689, Green 1D:668A).

**54 de 54 posições coincidem com um ID de item único nas três ROMs.** Exemplos reais:

- Viridian Forest (mapa 51): Potion ID 20 e Antidote ID 11.
- Mt. Moon B2F (mapa 61): Moon Stone ID 10 e Ether ID 80.
- Route 4 (mapa 15): Great Ball ID 3, na coordenada X40/Y3, índice de flag 53.

O `romEventState.js` associa agora a posição à identidade do item no script, além da flag de recolha `wObtainedHiddenItemsFlags`. O nome mostrado vem do ID real da ROM com o dicionário de texto local; esta distinção fica assinalada na proveniência. Os três hashes exatos autorizam o catálogo auditado; outras ROMs não herdam estes 54 IDs automaticamente.

### Integração e interface

- `romTrainerEvents.js`: atlas auditado + prioridades de dados extraídos em perfis novos, com estados `eventFlagSet`, `battleGateClosed` e `defeated:null`.
- `romWorldData.js`: novo descodificador de scripts de texto de treinador por apontadores do mapa e código Game Boy.
- `romEventState.js`: lista de 54 IDs extraídos de scripts ROM.
- `retroarchClient.js`: aplica nomes e IDs de itens ocultos da ROM.
- `romAreaEvidence.js` e `romAreaProgress.js`: não confundem bit de evento com histórico de batalhas.
- `public/app.js`: mostra flags ativas/inativas, casos desconhecidos, itens ocultos com ID real, recolhidos e por recolher.

### Testes

Foram executadas comparações locais em Python contra os três ficheiros binários: 312 vínculos de treinadores e 54 IDs de itens coincidentes em todas as versões. Foram também executados testes isolados em JavaScript, incluindo Route 6, Route 24, itens da Viridian Forest e Great Ball da Route 4, leitura de cabeçalho sintético direto e através de salto JR. Acrescentados `romTrainerBytecode.test.js` e novas asserções nos testes existentes.

**Ainda não executado:** teste end-to-end com a ROM atualmente carregada no RetroArch do iPhone. Não se afirma que a telemetria esteja 100% certificada no equipamento.

**Pendente:** 34 scripts especiais de treinador, históricos de combates realmente observados, interpretação integral de scripts de NPC/quest e auditoria de outros hacks e versões diferentes.

## Referências

- <https://github.com/pret/pokered/tree/master/scripts>
- <https://github.com/pret/pokered/blob/master/engine/overworld/hidden_events.asm>
- <https://github.com/pret/pokered/blob/master/data/events/hidden_item_coords.asm>
- <https://github.com/pret/pokered/blob/master/data/events/hidden_events.asm>
