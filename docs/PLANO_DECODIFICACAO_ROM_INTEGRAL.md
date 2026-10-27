# Plano de descodificação integral da ROM — Pokémon Red / Blue / Green (Gen I)

Data: 2026-10-27. Estado: leitura integral de bytes de um ficheiro ROM implementada; descodificação integral e validação em execução ainda não realizadas.

## Três objetivos diferentes

1. **100% do ficheiro ROM LIDO:** todos os bytes são lidos localmente, verificados por banco de 16 KiB e hash SHA-256.
2. **100% dos elementos ROM DESCODIFICADOS:** exige conhecer exatamente o layout da mesma ROM e descodificar código, tabelas, compressão gráfica e scripts. Ainda por alcançar.
3. **100% do estado do jogo:** acrescenta leitura da RAM/VRAM/OAM/SRAM e do contexto do CPU, eventos, RNG e estado do emulador; nem tudo fica persistente na ROM.
4. **CORES finais no SameBoy:** exigem paletas SGB/CGB, a configuração do núcleo e/ou acesso ao framebuffer final; o jogo pode não guardar explicitamente RGB para todos os elementos.

Não temos o ficheiro ROM efetivamente carregado no iPhone. Não é possível assegurar correspondência com o ficheiro do PC sem verificar a sua identidade. Não interferir com os bancos da ROM em execução.

## As tabelas existem na ROM, não são suposições

- MonsterNames: nome a partir do ID interno, com 190 posições incluindo MissingNo.
- PokedexOrder: tradução de ID interno para número da Pokédex.
- BaseStats: 28 bytes por espécie normal na tabela RGB (Mew é especial), incluindo base stats, tipos, captura, EXP, ponteiros e crescimento.
- EvosMovesPointerTable e MoveNames: evolução, ataques e respetivos nomes.
- GrowthRateTable: coeficientes da curva de experiência, de acordo com o motor do jogo.
- MapHeaderPointers e scripts: mapas, objetos, NPCs, ações e condições de eventos.
- wEventFlags (RAM): resultado atual de eventos, verificado por bit; o significado de cada bit depende das constantes/scripts da ROM.

Offsets existem porque o cartucho é um programa binário em bancos e ponteiros, não um JSON. O símbolo 07:421e MonsterNames é da compilação geradora do ficheiro pokered.sym no repositório e não prova o layout da ROM efetivamente utilizada.

## Implementação publicada

### pokemon-ai-companion/romAtlas.js

- Lê todos os bytes do ficheiro ROM em memória, sem upload e sem o modificar.
- Calcula SHA-256 global e SHA-256 de cada banco; confirma cobertura de 100% dos bytes do ficheiro.
- Só aceita uma tabela de símbolos quando fornecido um hash de referência independente coincidente. Mesmo assim, requer prova de proveniência da tabela.
- Extrai IDs, nomes, números Pokédex, BaseStats, ponteiros de sprites (brutos, sem mentir sobre pixels), e os 6 coeficientes de crescimento se a .sym corresponder.
- A percentagem de elementos semanticamente descodificados continua indefinida: ler bytes não significa compreender cada byte.

### pokemon-ai-companion/gen1EngineMath.js

Implementa com valores validados:
- limiares e progresso de EXP com os coeficientes lidos da ROM;
- fórmula de atributos Gen I, DVs/Stat Exp e DV de HP;
- consulta de flags de evento da RAM segundo as operações byte/bit da desmontagem.

Isto NÃO reproduz ainda todo o motor de combate, todas as evoluções, a RNG, os scripts, o decompressor gráfico ou as cores do SameBoy.

### pokemon-ai-companion/tests/romAtlas.test.js

Testes sintéticos de indexação bancária, relações ID/nome/Pokédex/stats, fórmulas EXP e integridade dos resultados. Ainda falta executar e validar com o ficheiro ROM real carregado no iPhone.

## Como usar sem alterar o jogo

Na pasta instalada no disco S, depois de obter estas atualizações:

    node --test tests/romAtlas.test.js
    node romAtlas.js "S:\ROMs\PokemonRed.gb"

O segundo comando imprime JSON no terminal. Não cria cópias ROM, não faz upload, não usa C: como destino de ficheiros. Um resultado de 100% bytes com 0% ou percentagem indeterminada de elementos descodificados é esperado nesta fase.

## Próximas fases (ordem e testes exigidos)

1. Obter acesso ao ficheiro binário ROM exato, identificar a versão por SHA-256, e provar que é o que o SameBoy executa.
2. Associar a .sym à mesma compilação comprovadamente. Recolher estruturas por banco, não por offsets assumidos.
3. Descobrir todos os sprites e seus bancos, descodificar a compressão real.
4. Descodificar encontros, mapas, trainers, itens, NPCs e scripts a partir da ROM, usando a RAM apenas para o estado atual.
5. Reproduzir todos os algoritmos relevantes de batalha, captura, nível, DVs e eventos com testes diferenciais contra o jogo em execução. Sem RNG real, não afirmar resultados determinísticos.
6. Expor a origem de cada campo: ROM, RAM, cálculo com fórmula verificada, estimativa ou indisponível.
7. Obter o framebuffer do SameBoy (se houver interface confiável) para reproduzir as cores reais e melhorar mapas e sprites.
8. Monitorizar taxa real de leitura e limitar o tráfego; 60 fps de render não é 60 fps de bytes novos do jogo.

## Referências

https://github.com/pret/pokered/blob/master/data/pokemon/names.asm
https://github.com/pret/pokered/blob/master/data/pokemon/dex_order.asm
https://github.com/pret/pokered/blob/master/constants/pokemon_data_constants.asm
https://github.com/pret/pokered/blob/master/data/growth_rates.asm
https://github.com/pret/pokered/blob/master/engine/pokemon/experience.asm
https://github.com/pret/pokered/blob/master/macros/scripts/events.asm
https://gbdev.io/pandocs/Memory_Map.html
https://gbdev.io/pandocs/Tile_Data.html

Critério final: nunca confundir bytes examinados, dados estruturados descodificados, cálculos reproduzidos e estado realmente verificado no emulador.
