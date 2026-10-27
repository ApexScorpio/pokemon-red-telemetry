# Descarga real de mapas, encontros e sprites — Red, Blue e Green (27/10/2026)

## Prova com os três binários fornecidos

Foram examinadas diretamente as ROMs fornecidas pelo jogador: Red CRC32 9F7FDD53, Blue D6DA8A1A e Green International v1.2.1 3C2DD8AE. Cada ROM contém 1 MiB, 64 bancos, e os checksums verificados anteriormente são válidos. Os binários não foram enviados para o repositório.

### Mundos e encontros

- **WildDataPointers**: tabela localizada por assinatura e validação de **248 ponteiros** por mapa, no offset do ficheiro `0xCEEB` nas três ROMs. As referências compreendem **59 tabelas de encontros distintas**, incluindo `NothingWildMons`. Existem 57 mapas com encontros não vazios. Cada entrada guarda taxas reais de encontros em relva/água e dez posições com nível e ID interno. O peso de cada slot (soma 256) vem da mecânica Gen I e não de aleatoriedade inventada.
- **MapHeaderPointers**: na `0x01AE` do banco fixo, cruzada com **MapHeaderBanks** que foi localizada por verificação das dimensões dos primeiros mapas na `0xC23D`.
- **226 cabeçalhos de mapa** passaram a validação estrutural (de 248 IDs; os restantes incluem mapas não utilizados e outros que não coincidem com o esquema). Foram extraídos em cada ROM **23 783 bytes de blocos dos mapas**; tamanhos/dimensões, tileset ID, ponteiros de scripts e texto; objetos de mapa, warps, placas e NPCs, incluindo classificações de treinador e item.
- As listas representam a **definição imutável na ROM**. Não afirmam se um treinador foi derrotado, se um item já foi recolhido, se um NPC está visível ou se uma passagem está acessível agora. Isso depende da RAM, flags e scripts que continuam por integrar e validar.

**Exemplo real — Route 5 (primeiros quatro slots):**

| ROM | Espécies |
|---|---|
| Red | Oddish Lv13, Pidgey Lv13, Pidgey Lv15, Mankey Lv10 |
| Blue | Bellsprout Lv13, Pidgey Lv13, Pidgey Lv15, Meowth Lv10 |
| Green International | Oddish Lv13, Pidgey Lv13, Pidgey Lv15, Meowth Lv10 |

Isto confirma que a Green International não deve herdar mecanicamente os encontros da Red ou da Blue.

### Imagens dos Pokémon

Verificados os **dois ponteiros comprimidos (frontal e traseiro) para cada uma das 150 espécies normais**. A presença das dimensões do sprite comprimido (`0x55`/`0x66`/`0x77`) e do cabeçalho traseiro `0x44` permite identificar o banco sem ambiguidade em todas as 150 espécies, nas três ROMs analisadas.

O pacote v3 contém **300 PNGs descodificados por ROM (900 no total)**, armazenados em base64 dentro dos perfis JSON, sem ficheiros gráficos externos. Foram testados ambos os lados para cada espécie e descodificados sem erro nos três jogos, com os algoritmos de RLE, differential decode e XOR do `pret/pokered/home/uncompress.asm`.

**Green tem deslocações reais de bancos de sprites em 10 espécies** em comparação com Red, incluindo Tangela, Moltres, Beedrill, Pidgeot, Starmie, Gloom, Vileplume, Bellsprout, Weepinbell e Victreebel. O detetor verifica o banco de cada espécie independentemente.

Os PNGs são sprites originais em quatro tons neutros. **Não contêm as cores finais de SameBoy**, que podem depender da paleta do core. Sprites dos NPCs e blocos de tileset no mapa ainda exigem rotinas distintas.

## Implementação publicada

- `pokemon-ai-companion/romWorldData.js`: analisa byte a byte os ponteiros e estruturas de mapas, objetos e encontros da ROM.
- `pokemon-ai-companion/romSpriteDecoder.js`: descodifica o formato comprimido Gen I de 2 planos e converte para PNG com biblioteca nativa Node, sem dependências externas.
- `pokemon-ai-companion/romVariantRegistry.js`: integra ambos no perfil de cada ROM, incluindo prova por dois cabeçalhos para selecionar os bancos dos sprites.
- `pokemon-ai-companion/romLiveResolver.js`: carrega o perfil que corresponder ao CRC32 do jogo realmente carregado no RetroArch; expõe PNGs e dados da variante.
- `pokemon-ai-companion/retroarchClient.js`: em cada leitura, publica `romMap`, `romWildEncounters`, identificação da ROM, origem dos encontros e URLs `data:image/png;base64` dos sprites originais.
- `pokemon-ai-companion/tests/romWorldData.test.js`, `tests/romSpriteDecoder.test.js`: testes reproduzíveis para as três ROMs verdadeiras mediante `POKEMON_ROM_DIR` apontado para a pasta local que as contém.

## Instalação do pacote v3

O ZIP v3 (fornecido ao jogador nesta conversa) contém apenas três JSONs e as instruções; não contém os ficheiros ROM.

Extrair os três JSON para `S:\tmp\pokemon-rom-profiles`. No **mesmo PowerShell** onde o Companion é iniciado:

```powershell
$env:POKEMON_ROM_PROFILE_DIR = 'S:\tmp\pokemon-rom-profiles'
npm start
```

Depois verificar no endpoint local `/api/state`:
- `romRuntimeIdentity.matched === true` e `reportedCRC32` correspondente à ROM carregada;
- `romWildEncounters.source` e `romMap.source` com indicação do perfil;
- `party[].spriteSource` com `SPRITE_FRONTAL_DESCODIFICADO_DA_ROM`.

Alternativamente, utilizar `POKEMON_ROM_DIR` apontado para os ficheiros ROM originais que o jogador mantém no PC (sem os copiar para GitHub).

## Limites e testes ainda necessários

1. Teste de integração em tempo real contra o RetroArch/SameBoy do iPhone, observando um mapa, troca de versão e combate. Não foi feito remotamente.
2. Os endereços de WRAM/SRAM e o significado de flags devem ser revistos por versão; CRC32 idêntico a um perfil **não é prova criptográfica de SHA-256 no iPhone**.
3. Eventos dependentes de scripts e flags, sprites de NPCs, tilesets gráficos/mapas renderizados e paletas reais de SameBoy ainda não estão a 100%.
4. A IA deve distinguir claramente dados de ROM, RAM, cálculos reproduzidos, referências manuais e valores não conhecidos.
5. Ficheiros de versões/ROM hacks com estrutura diferente devem ser **rejeitados sem extrapolação** até existir descodificador específico.

**Resultado desta fase:** 900 sprites Pokémon de batalha, encontros selvagens e 226 cabeçalhos de mapa por ROM reconstruídos a partir dos bytes originais das três versões efetivamente recebidas. Não se afirma que todo o cartucho esteja semanticamente descodificado.
