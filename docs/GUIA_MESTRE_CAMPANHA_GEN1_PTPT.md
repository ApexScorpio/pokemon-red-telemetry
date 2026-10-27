# GUIA-MESTRE — Pokémon Red, Blue e Green (Geração I)

**Versão:** 1.0 • **Criado:** 2026-10-27 • **Idioma:** português de Portugal  
**Âmbito:** acompanhamento tático do jogo, Pokédex de Kanto, telemetria RetroArch/SameBoy, gestão da equipa e coordenação de versões.  
**Regra central:** **uma instrução concreta e comprovada é melhor do que cinco palpites.**

> Este documento é um guia operacional, NÃO um relatório do estado atual da partida. Os números de HP, níveis, localização e itens são sempre obtidos de telemetria recente e validada. Não substituir a telemetria por este documento.

## 1. Objetivo e limites acordados

- Completar a Pokédex da Geração I através de **Red, Blue e Green em paralelo**.
- **Yellow fica para depois** de concluído o plano principal dos três jogos.
- Maximizar capturas, evoluções e recompensas sem refazer percursos; controlar decisões irreversíveis.
- Usar as caixas do PC e os Pokémon já capturados para otimizar a equipa; nunca sugerir capturar/treinar outro exemplar sem verificar primeiro se já existe.
- Preparar os jogos de origem para troca por exclusividade, escolhas de inicial, fósseis, presentes e evolução por troca.
- **Mew (#151) não é normalmente obtido através das mesmas capturas dos restantes 150**; definir estratégia própria verificada para ele e não prometer acesso legítimo automático.

## 2. Protocolo obrigatório ANTES de cada resposta sobre a partida

1. Consultar a fonte de telemetria mais recente realmente acessível, de preferência a vista viva autenticada e com carimbo horário; se indisponível, consultar o `README.md` do GitHub sem confundir instantâneo antigo com estado presente. Comparar o timestamp com o dia/hora atual.
2. Ler **localização, mapa/piso, coordenadas, movimento, batalha e diálogo**, mas apenas quando a respetiva leitura tem dados plausíveis e atualizados.
3. Rever **os seis Pokémon da equipa**, ordem, nível, HP/estado, quatro golpes e PP; depois **Pokémon no PC** (e não só a primeira caixa).
4. Rever **Pokédex capturados/vistos**, **mochila + itens no PC**, Daycare, TMs/HMs, itens de missão, insignias, flags de treinadores, itens recolhidos e histórico de eventos.
5. Cruzar nomes, níveis de golpes, evoluções, itens e encontros com **fontes exclusivas da Geração I e da ROM efetivamente usada**, distinguindo Red/Blue ocidentais, Green japonês e ROM modificada.
6. Verificar o ponto em que estamos **nos três jogos**: exclusividades em falta, cópias necessárias, trocas possíveis e próximas decisões irreversíveis.
7. Dar **o próximo passo exato**, incluindo a decisão tática e um aviso de perda de acesso se existir. Evitar instruções de navegação precisas quando não houver geometria/mapa comprovado.
8. Se a telemetria não estiver fresca ou estiver incoerente: dizer **"não consigo confirmar agora"**, explicar a única informação em falta e nunca inventar estatísticas, diálogo, derrotas, capturas ou itens.

### Classificação de fiabilidade da telemetria

- **CONFIRMADO:** valor bruto plausível da RAM, log de alteração inequívoco e/ou item efetivamente presente no inventário, com atualização recente.
- **INDICADO PELO TRACKER:** interpretação do README não confirmada independentemente; dizer que é hipótese.
- **DESATUALIZADO:** registo antigo, anterior aos eventos descritos pelo jogador.
- **INVÁLIDO:** impossibilidades (ex.: tipo Fairy no Pokémon Red original, HP absurdos, nomes de ataques não identificados). Não usar para recomendar trocas, níveis, golpes ou capturas.
- **RELATO DO JOGADOR:** conta como observação direta (ex.: já venceu Rocket, já saltou muro). Não contrariar só porque o README está atrasado.

**Caso documentado em 2026-10-27:** o README da branch `main`, obtido neste dia, declarava uma sincronização de 2026-10-16 21:59:33 e continha valores inválidos de Pokémon no PC. Não o usar como "estado atual" de 27 de outubro.

## 3. Formato das respostas durante o jogo

Por padrão, **máximo de 2–4 frases curtas**, sem tabelas repetidas da equipa.

- **Ação:** "Beedrill: aprende Twineedle e substitui Focus Energy."
- **Razão decisiva:** "Twineedle dá dano; Focus Energy tem um bug na Geração I."
- **Próximo aviso:** somente quando houver risco real (evolução/golpe, item perdido, escolha exclusiva ou rota sem regresso).

Não pedir ao jogador para voltar a ler valores já acessíveis na telemetria. Se os valores forem inacessíveis, assumir a limitação.

## 4. Ataques, evolução, TMs e equipa

Para QUALQUER mensagem "quer aprender o golpe X?":

1. Obter os **quatro golpes efetivos** do Pokémon agora, não de uma fotografia antiga.
2. Consultar o **learnset da Geração I**, especificamente RGB, e o efeito de cada ataque **na Geração I** (precisão, tipo, categoria, bug).
3. Responder imediatamente **APRENDER / NÃO APRENDER** e **qual golpe apagar**.
4. Proteger golpes irrecuperáveis e decidir se a evolução prematura cancela aprendizagens posteriores.
5. Não gastar TM, Rare Candy ou Moon Stone sem avaliar a oportunidade e disponibilidade nas outras versões.
6. Rever a equipa para o próximo desafio com todos os Pokémon que a pessoa JÁ POSSUI, incluindo PC, e sua vida/PP.

### Caso concreto: Beedrill / Twineedle

- **Red/Blue Geração I:** Beedrill aprende **Twineedle no nível 20**, 25 de poder por golpe × 2, 100% de precisão; pode envenenar.
- O ataque **Focus Energy funciona ao contrário** nas versões portáteis originais de Geração I: reduz a probabilidade de crítico para cerca de um quarto do normal.
- **Decisão tática:** aprender **Twineedle** e **apagar Focus Energy**, *desde que Focus Energy esteja entre os quatro golpes atuais*. Caso a equipa real mostre outros quatro golpes, rever essa substituição sem inventar.
- Não confundir com dados das gerações VI, VII ou posteriores.

### Evoluções relevantes

- Abra evolui para Kadabra no nível 16; Kadabra evolui para Alakazam por troca.
- Nidorino → Nidoking e Nidorina → Nidoqueen com Moon Stone. Antes de usar, verificar os últimos golpes desejados que as pré-evoluções podem aprender em RGB; **não adiar só para aprender um golpe fraco/inútil**.
- Kadabra → Alakazam, Machoke → Machamp, Graveler → Golem, Haunter → Gengar exigem troca.
- Alertar **2 níveis antes** de um marco importante de aprendizagem ou evolução, e não no próprio nível.
- Comparar o valor de esperar pelo golpe versus evoluir já; não automatizar uma regra cega de "evoluir só no nível X".

## 5. Daycare / Creche: monitorização preventiva

- Um Pokémon depositado ganha **1 EXP por passo contado**; não evolui no Daycare.
- Quando aprende um golpe com quatro slots ocupados, substitui automaticamente o golpe mais antigo. A ausência do jogador é um risco real.
- Se o tracker conseguir ler espécie, nível, EXP e golpes depositados, registar um **objetivo de levantamento**, por exemplo "retirar a nível 14 para controlar a evolução a 16".
- Mostrar o aviso **"IR BUSCAR AGORA: faltam 2 níveis para [marco]"**, indicar EXP ou passos estimados e disparar alerta mais urgente a 1 nível.
- Só considerar o alerta **ATIVO** depois de a leitura RAM do Daycare ter sido efetivamente validada. Caso contrário, é uma meta manual.
- No caso do Abra, tirar antes de chegar a 16 e evoluir manualmente em batalha para controlar a aprendizagem de Confusion.
- DVs não são modificados pelo treino no Daycare, mas os Pokémon deixam de ganhar Stat Exp de combates enquanto lá estão.

## 6. Exploração, NPCs, itens e decisões sem retorno

Antes de aconselhar sair de **cada piso/rota/interior**, verificar:
- capturas possíveis **ainda em falta** na coleção global;
- itens no chão, escondidos e dependentes de Cut/Surf/Strength;
- treinadores ainda ativos e recompensas;
- acessos de **sentido único** (muros para saltar, descidas, navios que partem);
- portas, escadas e caminhos opcionais que não foram percorridos;
- próximos confrontos e utilidade do melhor Pokémon disponível.

NPCs: **só interagir** se concedem item, HM/TM, troca útil, Pokémon, serviço, avanço obrigatório ou informação crucial. Evitar diálogos vazios.

**Erros desta sessão que NÃO se repetem:**
- Route 4: salto de muros impede regressar imediatamente à zona superior; confirmar a TM04 e os itens ANTES de saltar.
- Cerulean: Rocket atrás da casa roubada concede **TM28 Dig**; não mandar para Route 5 sem verificar esse evento **ou o item no PC**.
- Route 25: não prometer recolher TM19 sem verificar acesso por Cut.
- S.S. Anne: não sair definitivamente sem conferir HM01 Cut, treinadores e itens no navio.
- Mt. Moon: primeiro decidir quais escadas servem as secções por explorar; não repetir o 1F concluído; decidir fóssil em coordenação com Blue/Green.

**Repel:** usar apenas quando as capturas da rota estiverem asseguradas e o objetivo for atravessar com eficiência; ter em conta o nível do primeiro Pokémon.

## 7. Planeamento Red + Blue + Green

Manter uma matriz **por espécie**, com colunas:
`espécie | Red (capturado/PC/party) | Blue | Green | evolução | disponibilidade | cópia necessária? | troca destino | prioridade`.

### Decisões por versão

- Os **exclusivos da versão Red ocidental** e da **Blue ocidental** são diferentes. Verificar tabela oficial de disponibilidade antes de indicar qualquer encontro. Red e Blue ocidentais têm distribuições equivalentes às japonesas Red e Green, respetivamente.
- A ROM **Green International modificada** não deve ser tratada como Green japonês inalterado sem consultar a documentação da ROM e testar a compatibilidade de trocas; nunca presumir que uma ROM japonesa original troca com uma ocidental sem risco.
- Partilhar a escolha de **Helix / Dome Fossil** entre jogos; confirmar qual já foi escolhido no Red e ainda poderá ser escolhido no Blue/Green.
- Reservar iniciais diferentes entre os três jogos **se as escolhas ainda estiverem disponíveis**, assegurando Charmander, Squirtle e Bulbasaur e respetivas evoluções.
- Coordenar presentes únicos, Hitmonlee/Hitmonchan, Eevee e evoluções com pedras, fósseis, Pokémon de NPCs e trocas por evolução.
- **Iniciar Blue e Green em paralelo** antes da próxima decisão que dependa deles, sem sacrificar o progresso já feito no Red. Conferir trocas entre ROMs e saves com cópias de segurança antes de usar Pokémon valiosos.
- Yellow só entra **depois** do objetivo principal com Red/Blue/Green, como solicitado.

### Meta da Pokédex

Distinguir **registo de espécies por jogo**, espécies capturadas somadas nos vários jogos e espécies efetivamente transferidas para o jogo onde se pretende concluir a Pokédex. Mew exige estratégia própria e não se deve prometer que será obtido por troca normal ou captura convencional.

## 8. MissingNo e multiplicação de itens

- Está planeado utilizar MissingNo para duplicar itens, mas **o inventário atual nunca deve antecipar itens ainda não duplicados**.
- O glitch afeta a **quantidade do sexto slot da mochila**, não simplesmente a sexta unidade de um item. Confirmar a ordem antes de executar.
- Pode afetar o Hall of Fame e outros dados. Fazer cópia verificada dos saves e estados **fora de C:** e preservar os originais; testar numa cópia antes de afetar o save principal.
- Usar o glitch não elimina a necessidade de respeitar marcos de golpes e decisões irreversíveis.

## 9. Falhas do tracker: controlo de qualidade

O guia não pode tratar o README como infalível. Exigir testes específicos:
- leitura RAM de 160 bytes com resposta UDP válida antes de tentar otimizar VRAM;
- campos de PC realmente correspondem a Pokémon e itens válidos;
- tipo Fairy é impossível na Geração I clássica;
- HP maior que os limites plausíveis e níveis que divergem do jogo são erros de descodificação;
- estado da batalha (flag) deve ser verificado em RAM e comparado com o jogo real;
- diálogo parcial ("SCRATCH GROWL") NÃO é o texto que aparece no ecrã;
- datas e timestamps devem ser atuais. Se a ligação falhar, não apresentar progresso antigo como novo.

A telemetria é evidência quando válida; **não é verdade absoluta por estar publicada**.

## 10. Procedimento ao fim de cada segmento de jogo

1. Verificar evolução do estado: posição, treinador derrotado, captura, item, ataque ou badge.
2. Comparar com objetivo da área e com a matriz Red/Blue/Green.
3. Evitar repetir qualquer ação concluída.
4. Indicar apenas **uma próxima ação principal**, o Pokémon e ataque quando útil, e avisos de perda de acesso.
5. Se houver lacuna de informação, documentar "não confirmado" e nunca preencher a lacuna por intuição.
6. Em trabalho de desenvolvimento de telemetria, manter registo `.md` **append-only**. Não apagar entradas antigas. Sempre que houver UI, obter e analisar captura de ecrã para validar o efeito da mudança. Não tocar em sessões Antigravity/TIMI/Maestro/BonChat nem em C: sem necessidade absoluta.

## 11. Fontes de verificação (por versão/geração)

- Bulbapedia — Beedrill Geração I: https://bulbapedia.bulbagarden.net/wiki/Beedrill_(Pok%C3%A9mon)/Generation_I_learnset
- Bulbapedia — Twineedle: https://bulbapedia.bulbagarden.net/wiki/Twineedle_(move)
- Bulbapedia — Focus Energy (bug Geração I): https://bulbapedia.bulbagarden.net/wiki/Focus_Energy_(move)
- Bulbapedia — Day Care: https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Day_Care
- Bulbapedia — evolução por troca: https://bulbapedia.bulbagarden.net/wiki/Trade_Evolution
- Bulbapedia — exclusivos: https://bulbapedia.bulbagarden.net/wiki/Version-exclusive_Pok%C3%A9mon
- Bulbapedia — Red/Blue e compatibilidade entre línguas: https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Red_and_Blue_Versions
- Bulbapedia — MissingNo.: https://bulbapedia.bulbagarden.net/wiki/MissingNo.
- Bulbapedia — Cerulean / Route 5: https://bulbapedia.bulbagarden.net/wiki/Appendix:Red_and_Blue_walkthrough/Section_5
- Telemetria pública, **apenas quando atual**: https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/README.md
- Telemetria alternativa disponibilizada pelo jogador, **apenas se acessível e datada**: https://calculator-dozen-bow-recommendation.trycloudflare.com/telemetria.md

---
**Regra final:** antes de guiar um movimento, aprender um ataque ou decidir uma evolução, responder a três perguntas: **O que é comprovado? O que podemos perder? Qual a melhor ação agora?**
