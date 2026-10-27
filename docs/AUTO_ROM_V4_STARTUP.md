# Arranque automático das ROMs — Pokémon Companion (v4)

**27 de outubro de 2026**

## Funcionamento sem configuração manual

O Companion agora chama `buildProfiles()` quando o servidor é criado.

A rotina `romAutoDiscovery.js` procura ficheiros reais `.gb`/`.gbc`, os JSON de perfil e os pacotes `pokemon_gen1_red_blue_green_profiles_v*.zip`, **sem ser necessário descompactar o ZIP**. As origens incluem a pasta da aplicação e pastas `roms`, `rom-profiles`, `data/rom-profiles`, diretórios vizinhos, Downloads, Documents e Desktop do utilizador, e as pastas comuns de jogos no disco S: em Windows. Não percorre um disco inteiro sem limites, não segue links e não escreve nem modifica ROMs, saves ou ZIPs.

O ZIP é lido em memória, com limites de dimensão e verificação de CRC32 das entradas. Os perfis são sujeitos a validação de ID, estrutura, tabelas, tamanho e SHA-256 declarado. O sistema prefere perfis com dados mais completos, incluindo a compatibilidade TM/HM da v4. Uma ROM local lida diretamente tem prioridade perante metadados equivalentes.

Em cada `GET_STATUS`, o RetroArch indica `PLAYING/PAUSED ... crc32=XXXXXXXX`. O Companion seleciona somente um perfil com CRC32 coincidente; se não houver correspondência, apresenta **ROM NÃO IDENTIFICADA**. A aplicação tenta novamente encontrar os ficheiros após 30 segundos se estiver a jogar uma ROM ainda não registada. O processo é automático durante as sessões subsequentes.

**Limite físico:** esta rotina não consegue inventar o conteúdo de uma ROM que esteja só no iPhone e que não tenha cópia/perfil no PC. `READ_CORE_MEMORY` não expõe automaticamente os bancos completos da ROM a partir de `GET_STATUS`. Uma vez que uma ROM ou ZIP tenha sido colocado numa pasta acessível do PC, o Companion encarrega-se do resto.

## Pacote v4 e melhorias

O ZIP v4 fornecido nesta conversa contém três perfis (Red, Blue, Green International v1.2.1) construídos a partir dos ficheiros verdadeiros recebidos. Cada perfil inclui nome e hash, números da Pokédex, níveis, atributos base, movimentos, evoluções, curvas de experiência, encontros selvagens, mapas e warps, posições de NPC, sprites frontais/traseiros PNG e agora os **sete bytes de compatibilidade com TMs/HMs de cada uma das 150 espécies padrão**.

Os 55 bits de compatibilidade (TM01–TM50 e HM01–HM05) são lidos de `BaseStats+20..26` e não de uma lista externa. O Bulbasaur foi verificado nos três ficheiros com a máscara hexadecimal `a40338c0030806`.

## Novos alertas no painel

`romProgressAdvisor.js` lê o `learnset` e as evoluções do **perfil efetivamente selecionado por CRC32**, cruzando os níveis da equipa da RAM. O painel mostra os próximos marcos e avisa dois níveis antes. Quando não há ROM correspondente ou RAM validada, não apresenta conclusões como certas.

O Daycare usa EXP e espécie da RAM e, quando há perfil compatível, aplica os coeficientes de crescimento lidos da ROM. Foi corrigida a interpretação das evoluções Gen I: pedra = `método, item, nível mínimo, espécie`; troca = `método, nível mínimo, espécie`. Exemplo testado: Abra no nível 11 tem aviso de levantamento no nível 14 antes de evoluir a Kadabra no 16; Beedrill no nível 18 avisa de Twineedle no 20.

O painel mostra `romRuntimeIdentity` e `romAutoDiscovery` para transparência sobre a ligação real. `party[].tmHmCompatibility` contém as TMs/HMs confirmadas da própria ROM, quando há um perfil v4 ativo.

## Proteção das atualizações

A rotina de atualização automática (`start.js`) e a atualização manual (`/api/update`) deixaram de executar `git checkout` indiscriminado e deixaram de fazer merges `theirs`. Passam a exigir estado de trabalho versionado limpo e atualização fast-forward; se houver mudanças locais, **não apagam nada**, e assinalam que a atualização está adiada.

## Validação e limitações

- Analisados os três ficheiros ROM verdadeiros, com checksums e tabelas já estudadas. Verificado localmente que o ZIP v4 está íntegro, contém três JSON e as 150 máscaras de TM/HM por jogo.
- Testes isolados do código `romProgressAdvisor.js` executados no motor JavaScript para Twineedle, Abra/Daycare, Moon Stone e evolução por troca; passaram.
- Foram verificados os parse/syntax checks de todos os módulos principais; os testes `npm test` foram adicionados mas **a execução de integração contra o SameBoy do iPhone continua por fazer**.
- Para executar os testes de ZIP com um ficheiro v4 local, `POKEMON_PROFILE_ZIP_TEST_FILE` pode apontar para o ZIP, sem ser necessário alterar a configuração da aplicação.
- O facto de uma espécie poder aprender um HM **não garante** que o HM já esteja na mochila ou que a insígnia necessária tenha sido obtida.
- Sprites são os quatro tons originais, não as paletas personalizadas renderizadas pelo SameBoy. Scripts integrais de eventos e gráficos completos de mapas/tilesets continuam em desenvolvimento.

## Fontes técnicas

- `pokemon-ai-companion/romAutoDiscovery.js`
- `pokemon-ai-companion/romLiveResolver.js`
- `pokemon-ai-companion/romProgressAdvisor.js`
- `pokemon-ai-companion/romVariantRegistry.js`
- `pokemon-ai-companion/retroarchClient.js`
- `pokemon-ai-companion/public/app.js`
- `pokemon-ai-companion/tests/romAutoDiscovery.test.js`
- `pokemon-ai-companion/tests/romProgressAdvisor.test.js`

- <https://docs.libretro.com/development/retroarch/network-control-interface/>
- <https://github.com/pret/pokered/blob/master/data/pokemon/evos_moves.asm>
- <https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_base_stats_data_structure_in_Generation_I>

**Não declarar compatibilidade universal:** a deteção verifica uma família de estruturas Gen I que podem não existir em ROM hacks radicalmente diferentes ou noutras gerações.
