# Auditoria de batalhas por zona — fase 6 (27/10/2026)

## Problema encontrado e corrigido

O formato de objeto com `textId & 0x40` em Pokémon Gen I representa um evento de **batalha**, não necessariamente um treinador humano. A Geração I usa `OPP_ID_OFFSET = 200`: IDs de oponente de classes de treinadores começam em 201 e os valores inferiores, quando correspondem a espécies, são encontros Pokémon fixos. Referências originais: `pret/pokered/constants/trainer_constants.asm` e `data/maps/objects/PowerPlant.asm`.

Em três ROMs completas fornecidas pelo jogador (Red, Blue e Green International v1.2.1) foram verificados:

- **346 objetos originalmente marcados como “trainer” pela máscara do campo de texto**;
- **334 são treinadores humanos**;
- **12 são encontros fixos de Pokémon**: 8 Voltorb/Electrode na Power Plant, Zapdos, Articuno, Moltres e Mewtwo.
- O parser anterior tinha **312** associações em 67 mapas, mas duas pertenciam a encontros fixos (Moltres e Mewtwo). Agora são **310 associações genéricas de humanos**.
- Foram auditados **18 scripts especiais** dos três binários: líderes de oito ginásios, sete treinadores do Cinnabar Gym, Giovanni no esconderijo Rocket, Super Nerd dos fósseis de Mt. Moon e Karate Master do Fighting Dojo.
- Resultado **328 associações de humanos em 334 objetos humanos identificados**, ficando **6 casos especiais ainda sem vínculo comprovado**. Não declarar batalhas vencidas pelo simples estado de um bit.
- **12 cabeçalhos de encontros fixos** ligados aos respetivos bits na ROM e à `wEventFlags` da RAM (D747).

### Encontros fixos extraídos da ROM

| Mapa ID | Evento | Nível | Bits de evento |
|---|---|---|---|
| 83 — Power Plant | 6 Voltorb, 2 Electrode e Zapdos | 40, 43, 50 | 1121–1129 |
| 162 — Seafoam Islands B4F | Articuno | 50 | 2522 |
| 194 — Victory Road 2F | Moltres | 50 | 1342 |
| 227 — Cerulean Cave B1F | Mewtwo | 70 | 2241 |

O código lê diretamente o cabeçalho `text_asm` do objeto, o apontador para o cabeçalho da batalha, o índice e a flag de `wEventFlags`. Os bits 8 e 9 da Power Plant usam o mesmo byte RAM de base mais o offset de bit 8/9; **não se podem reduzir com `& 7` antes de somar ao endereço base**.

**Nunca deduzir captura a partir da flag.** `encounterGateClosed=true` apenas indica que o evento foi marcado como concluído/desativado no jogo. A Pokédex Owned informa se o jogador possuiu a espécie, não em qual encontro a capturou.

### Ligação em tempo real

- `romWorldData.js` marca `wildPokemon` e `trainer` separadamente com base no formato de classes Gen I; recolhe os 12 cabeçalhos dos encontros fixos diretamente da ROM quando o binário está disponível.
- `romStaticEncounterEvents.js` aceita a extração dinâmica de um perfil local compatível ou um atlas comprovado para os três SHA-256 fornecidos, incluindo perfis JSON antigos v4 sem necessidade de instalação manual.
- `romTrainerEvents.js` exclui os objetos Pokémon fixos das contagens humanas e junta os 18 scripts especiais validados.
- `romAreaEvidence.js`, `romAreaProgress.js`, `retroarchClient.js` e `public/app.js` passam a apresentar os encontros fixos separadamente, com nível, espécie, coordenadas e estado da flag.
- Foram criados testes `tests/romStaticEncounterEvents.test.js` e `tests/romSpecialTrainerEvents.test.js`. Foram também atualizados `romWorldData.test.js`, `romAreaEvidence.test.js` e `romTrainerEvents.test.js` para a distinção de classes com IDs reais.

### Validação desta fase

- **Testes sobre os bytes reais:** todos os 16 scripts especiais iniciais foram confirmados em Red, Blue e Green; os scripts do Super Nerd (bit 1401) e Karate Master (bit 849) foram depois confirmados nas três versões. Os 12 cabeçalhos de Pokémon fixos foram lidos nos três binários, incluindo bits 1128 e 1129 da Power Plant.
- **Teste isolado da lógica JavaScript:** o código atualizado foi carregado em ambiente isolado com um perfil JSON antigo. Na Power Plant retornou 0 treinadores humanos, 9 encontros fixos, 1 flag de evento ativa e 0 afirmações de captura. Passou.
- **Sinta​​xe:** verificados os módulos alterados durante as edições. Os testes completos `npm test` e o teste com RetroArch/SameBoy do iPhone **não foram executados** neste ambiente; isto continua pendente.
- As ROMs, saves, sessões de autenticação, tokens, disco C: e servidor do utilizador não foram alterados.

### Próximos casos humanos ainda sem flag de evento auditada

Cerulean City (Rival), Route 24 (Rocket do Nugget), Oak's Lab (Rival), S.S. Anne 2F (Rival), Game Corner (Rocket do poster) e Silph Co 11F (Giovanni). Estes scripts têm estruturas alternativas; é necessário derivar e testar separadamente as suas condições e resultados, sem inferência por título ou ordem.

**Requisito permanente:** os estados devem distinguir existência na ROM, presença na RAM, flag ativada, combate desativado e captura/vitória historicamente comprovada. São evidências diferentes.
