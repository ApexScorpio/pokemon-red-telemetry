# ROMs diferentes, identificação em tempo real — Pokémon AI Companion

**27-10-2026 — Implementação inicial validada com um ficheiro real Green International v1.2.1.** A estrutura das tabelas é detetada por padrões e verificação de integridade, não por offsets universais.

## Exemplo real analisado

Ficheiro fornecido pelo utilizador: Pokémon Green International v1.2.1.gb

- Tamanho: 1 048 576 bytes (64 bancos de 16 KiB).
- CRC32: `3C2DD8AE`.
- SHA-256: `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db`.
- Cabeçalho `POKEMON GREEN`, checksum de cabeçalho e checksum global válidos.
- `MonsterNames`: banco 07, CPU `421E`, offset no ficheiro `0x1C21E`.
- `PokedexOrder`: banco 10, CPU `5956`, offset no ficheiro **`0x41956`**.
- `BaseStats`: banco 0E, CPU `43DE`, offset no ficheiro `0x383DE`.
- `GrowthRateTable`: banco 16, CPU `501D`, offset `0x5901D`.
- `EvosMovesPointerTable`: banco 0E, CPU `705C`, offset `0x3B05C`.
- `MoveNames`: banco 2C, CPU `4000`, offset `0xB0000`.

**Demonstração de divergência real:** o `pokered.sym` já existente coloca `PokedexOrder` em banco 10 / CPU `5024` (`0x41024`). Para esta Green tal localização está ERRADA. O scanner encontra `0x41956` e valida a permutação dos 151 números + 39 entradas vazias.

Nas tabelas lidas desta ROM: 190 IDs internos, 165 golpes, Abra evolui no nível 16, Beedrill aprende Twineedle no nível 20, Charmeleon evolui no nível 36. A autoria do patch indica ainda adaptações de sprites/paletas japoneses Green e encontros da Blue; os sprites e encontros ainda NÃO foram extraídos integralmente pelo scanner.

## Como ativar no PC (não requer copiar a ROM para o GitHub)

Temos três opções de fonte, por ordem de facilidade:

**A. Utilizar perfil JSON preparado com a ROM enviada** — copiar o perfil JSON de auditoria para o disco S:, apontar a variável de ambiente `POKEMON_ROM_PROFILE_PATH` para o seu caminho completo e iniciar/reiniciar o Companion. O perfil contém tabelas de dados e hashes; **não inclui o binário da ROM**.

**B. Ler diretamente a ROM no PC** — definir `POKEMON_ROM_PATH` com o caminho para o ficheiro `.gb` existente no PC e iniciar a aplicação.

**C. Descoberta automática de todas as ROMs na mesma pasta** — definir `POKEMON_ROM_DIR` para uma pasta no disco S: com ficheiros `.gb`/`.gbc`; ao iniciar, são inspecionados em memória, sem alterações. Quando o RetroArch muda de ROM, consulta-se `GET_STATUS` de quatro em quatro segundos e compara-se o CRC32 do jogo carregado com os perfis locais. Se uma ROM nova for colocada na pasta, a lista é atualizada enquanto a aplicação está a correr (com intervalo mínimo de 30 segundos).

Nunca copiar ROMs, saves ou tokens para o GitHub. A importação do perfil mantém o conteúdo binário original fora do repositório.

## O que está dinâmico agora

- Deteção de título, tamanho, SHA-256 e CRC32 da ROM local.
- Procura do endereço real de seis tabelas por padrões estruturais, sem atribuir automaticamente símbolos de outra build.
- ID interno -> nome -> Pokédex -> atributos base na ROM efetivamente identificada.
- Nomes de 165 ataques, listas de golpes por nível e evoluções da ROM.
- Coeficientes de crescimento extraídos da ROM e usados para calcular EXP necessária quando o perfil corresponde à ROM em execução.
- Cruzamento em tempo real entre `GET_STATUS crc32=...` e hash do perfil, antes de substituir nomes provenientes da referência estática.
- Tabelas de proveniência em `/api/state`: `romRuntimeIdentity.matched`, `profileSha256`, `tablesValidated`; o relatório `/telemetria.md` apresenta a identidade e a origem.
- Os nomes e os atributos variam conforme o perfil carregado, mas os valores mutáveis dos Pokémon continuam a ser lidos por `READ_CORE_MEMORY`.

## O que ainda NÃO funciona genericamente

- A leitura *sem cópia local nem perfil* de uma ROM completa no iPhone: o comando READ_CORE_MEMORY só dá acesso aos bancos atualmente mapeados pela CPU; não consegue extrair automaticamente todos os 64 bancos sem operações adicionais intrusivas.
- ROMs de jogos de outra geração ou hacks que alteram a disposição/estrutura dos dados: requerem um descodificador próprio. Neste caso a aplicação marca o perfil como não reconhecido e não atribui um offset por palpite.
- O perfil não certifica automaticamente os endereços da RAM de uma ROM alterada. As leituras da RAM exigem confirmação com o jogo real.
- Sprites comprimidos, mapas completos, scripts de todos os eventos, paletas reais SameBoy, fórmulas de todas as mecânicas e o estado completo de todas as caixas/Daycare: **ainda por implementar/testar**.
- Atributos de ataque (poder, tipo, precisão) ainda vêm de referências estáticas; apenas o **nome** do golpe foi ligado ao perfil ROM nesta fase. São rotulados separadamente.
- Imagens da equipa atualmente mostradas pelo dashboard vêm de fornecedores externos; não são os sprites originais Green. Há campo de proveniência explícito.
- Nem toda a RAM/VRAM/SRAM é lida. **100% dos bytes do ficheiro ROM analisados não é o mesmo que 100% dos elementos descodificados**.

## Testes e verificação no iPhone

1. Usar um dos métodos A/B/C de registo do perfil no PC e reiniciar a aplicação caso necessário.
2. Confirmar no endpoint `/api/state` o campo `romRuntimeIdentity.matched === true`, o CRC `3C2DD8AE` para esta Green e `tablesValidated` com seis tabelas confirmadas.
3. Confirmar níveis/movimentos/nomes no jogo enquanto se fazem ações reais; exemplos: Beedrill/Twineedle, Abra/evolução, Charmeleon/evolução.
4. Trocar para Red ou Blue. O sistema deve atualizar CRC, título e perfil; **não reutilizar as informações Green** se o CRC não coincidir.
5. Se `GET_STATUS` falhar ou a ROM não estiver registada, o sistema rotula explicitamente `romRuntimeIdentity.matched=false`.
6. Se a ROM usar tabelas com outra estrutura, não declarar perfil funcional; registar os offsets e regras que faltam estudar.

**Aviso de segurança:** não alterar os bancos de ROM, gravar RAM, carregar save states ou modificar o RetroArch para realizar esta identificação. A auditoria é somente de leitura.

Código:
- `pokemon-ai-companion/romVariantRegistry.js` — parser e deteção de offsets.
- `pokemon-ai-companion/romLiveResolver.js` — seleção por CRC32, via perfil ou ROM local.
- `pokemon-ai-companion/retroarchClient.js` — ligação à RAM e GET_STATUS.
- `pokemon-ai-companion/tests/romVariantRegistry.test.js` — verificações.
