# Auditoria integral dos treinadores — Red, Blue e Green

Data: 2026-10-27

## ROMs realmente analisadas

- Red SHA-256 `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b`
- Blue SHA-256 `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d`
- Green International v1.2.1 SHA-256 `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db`

Os três ficheiros originais foram lidos localmente num scanner **independente** da função JavaScript da aplicação; as contagens e bits coincidem entre as versões.

## Contagens extraídas das ROMs

| Tipo | Quantidade | Como foi identificado |
| --- | ---: | --- |
| Objetos de treinadores humanos nos mapas válidos | **334** | Objetos do mapa, com `OPP_ID_OFFSET=200` |
| Cadeias diretas até cabeçalho e flag | **310** | textId → text pointer → `text_asm` → `LD HL` → `TalkToTrainer` → ponteiro `wEventFlags` |
| Scripts especiais de ginásios/bosses | **18** | Mapeamento de eventos especiais específico das três ROMs |
| Scripts especiais de rival/Rocket/Silph/Oak | **4** | Estado de evento distinto de prova de vitória |
| Scripts de luta sem esta correspondência direta | **2** | S.S. Anne 2F (mapa 96) e Game Corner (mapa 135) |
| Ligações de objeto a evento no conjunto | **332/334** | 310 + 18 + 4; não é o número de vitórias |

A tabela histórica `romTrainerEvents.js` tem **312** registos, mas inclui **dois encontros de Pokémon fixos** (não treinadores humanos, mapas 194 e 227). O código filtra estas entradas para que não contaminem a contagem de treinadores.

## Ajuste de integridade introduzido

Antes desta revisão, um perfil ROM derivado automaticamente podia substituir as associações do atlas auditado sem uma comparação explícita entre ambos. Agora:

- Cada par `(objectOrdinal,eventBitIndex)` derivado da ROM é validado e não admite ordinais duplicados.
- Para os três SHA-256 auditados, as entradas dinamicamente extraídas são comparadas com o atlas histórico. Se um bit divergir, a leitura do mapa é recusada como `CONFLITO_ATLAS_VS_CABECALHO_ROM`.
- Se a ROM fornecer um subconjunto, as entradas independentes do atlas para **treinadores humanos** podem completar as lacunas, com proveniência explícita; Pokémon fixos nunca contam como treinadores.
- Perfis de novas ROMs não recebem as flags específicas Red/Blue/Green por aproximação.
- Mesmo uma flag ligada corretamente significa apenas que o combate foi marcado pelo script; não declara uma vitória sem provar essa semântica.

## Regressões

- `tests/romTrainerEvents.test.js`: conflito entre ROM e atlas, duplicações, reconciliação válida e exclusão de Pokémon fixos.
- `tests/romRealTrainerAudit.test.js`: testes de ponta a ponta da extração ROM para os 3 ficheiros reais, quando `POKEMON_ROM_DIR` aponta para a pasta que os contém. Verifica 334 objetos, 310 cadeias normais e 332 ligações no total.
- Foi feito um teste isolado em JavaScript com o módulo publicado, confirmando os quatro casos de reconciliação.
- Foi executado scanner local independente em Python contra os **três binários** e confirmou 310 cabeçalhos normais idênticos, 334 objetos humanos e os dois casos sem cabeçalho direto.

**Não foi feita ligação ao SameBoy real do iPhone nesta sessão.** Os testes automatizados que exigem ficheiros ROM locais ficam dependentes da disponibilidade deles no ambiente onde se executa `npm test`.

## Fontes primárias

- [Desmontagem original pret/pokered](https://github.com/pret/pokered)
- [SSAnne2F: batalha do rival controlada pelo script](https://github.com/pret/pokered/blob/master/scripts/SSAnne2F.asm)
- [GameCorner: Rocket controlado pelo script](https://github.com/pret/pokered/blob/master/scripts/GameCorner.asm)
