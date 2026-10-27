# ROMs reais: Red, Blue e Green International — perfis e identificação

**Análise dos três ficheiros recebidos em 27 de outubro de 2026.** O código lê o binário da ROM e procura as tabelas por padrões estruturais; não assume que o offset é igual em todas as versões.

| ROM | CRC32 | SHA-256 | Tamanho |
| --- | --- | --- | --- |
| Pokémon Red | `9F7FDD53` | `5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b` | 1 048 576 |
| Pokémon Blue | `D6DA8A1A` | `2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d` | 1 048 576 |
| Green International v1.2.1 | `3C2DD8AE` | `aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db` | 1 048 576 |

Todos os ficheiros têm 64 bancos de 16 KiB e passaram a verificação dos checksums do cabeçalho e globais.

## Tabelas encontradas nos bytes das ROMs

| Tabela | Red/Blue (offset ficheiro) | Green (offset ficheiro) |
| --- | --- | --- |
| Nomes de Pokémon | `0x1C21E` | `0x1C21E` |
| IDs internos para Pokédex | `0x41024` | `0x41956` |
| Atributos base | `0x383DE` | `0x383DE` |
| Curvas de EXP | `0x5901D` | `0x5901D` |
| Evoluções e golpes por nível | `0x3B05C` | `0x3B05C` |
| Nomes dos 165 golpes | `0xB0000` | `0xB0000` |

Os campos extraídos incluem 190 IDs internos, 165 golpes e fórmulas de crescimento. As entradas de Red e Blue para espécies/learnsets comparadas são iguais nesta análise; a Green tem ponteiros gráficos diferentes em muitas espécies. **Os sprites comprimidos e paletas continuam por descodificar**, e não são servidos como imagens originais pelo dashboard atual.

## Utilizar três perfis em simultâneo

Foi acrescentado suporte à variável de ambiente `POKEMON_ROM_PROFILE_DIR`:

1. Extrair apenas os JSON `pokemon_red_rom_profile.json`, `pokemon_blue_rom_profile.json`, `pokemon_green_rom_profile.json` para uma pasta de dados, preferencialmente em S:.
2. Antes de iniciar o Companion, no mesmo PowerShell, executar `$env:POKEMON_ROM_PROFILE_DIR = "S:\tmp\pokemon-rom-profiles"`.
3. Iniciar a aplicação com a versão de código mais recente. Os perfis são importados para memória; não são ROMs nem alteram saves.
4. Em `/api/state`, validar `romRuntimeIdentity.matched`, `reportedCRC32`, `profileSha256`, `tablesValidated`. O perfil só é usado quando o `GET_STATUS` reporta o CRC32 correspondente.
5. Trocar Red → Blue → Green no RetroArch. A consulta da identidade ocorre periodicamente; se não houver correspondência, a aplicação informa que os dados de referência não estão confirmados nessa ROM.
6. O teste `node --test tests/romThreeVersions.test.js` verifica reconhecimento simultâneo quando os perfis estão instalados.

A aplicação também pode usar `POKEMON_ROM_DIR` para analisar ficheiros ROM reais em pasta local. Os **binários ROM nunca devem ser enviados ao GitHub**.

## Limites a não ocultar

- A verificação do CRC32 do RetroArch é uma correspondência de conteúdo, **não prova que a RAM é compatível com offsets de outra versão**. Falta validar cada estrutura de RAM com a Green Internacional e outras modificações.
- Existem seis tabelas ROM estruturalmente verificadas; isto **não significa 100% dos elementos do cartucho descodificados**.
- O mapa completo, os sprites originais, paletas SameBoy, scripts de eventos, itens, encontros específicos e todas as operações internas ainda exigem leitores próprios.
- As imagens e alguns atributos apresentados pelo dashboard ainda podem vir de referências externas; distinguir a origem na telemetria.
- **Não foi feito um teste de integração contra o iPhone ao vivo** nesta sessão, embora os três ficheiros ROM tenham sido efetivamente analisados em ambiente local.
- Para hacks de Pokémon com estruturas diferentes ou outras gerações, o detetor deverá declarar `não suportado` até haver um parser próprio.

## Código

- [romVariantRegistry.js](../pokemon-ai-companion/romVariantRegistry.js)
- [romLiveResolver.js](../pokemon-ai-companion/romLiveResolver.js)
- [retroarchClient.js](../pokemon-ai-companion/retroarchClient.js)
- [romThreeVersions.test.js](../pokemon-ai-companion/tests/romThreeVersions.test.js)
