# Auditoria RAM/ROM — Pokémon Gen 1

**Data:** 2026-10-27
**Estado:** Correções de código publicadas; validação de ponta a ponta com o iPhone pendente.

## A ROM inteira está a ser lida? NÃO.

O programa usa READ_CORE_MEMORY para consultar endereços específicos no RetroArch/SameBoy. Isso demonstra a existência de pedidos reais de memória, mas NÃO demonstra que os valores devolvidos são sempre válidos.

O Game Boy apresenta ROM por bancos: $0000-$3FFF corresponde ao banco fixo e $4000-$7FFF é apenas um banco selecionado. Ler o espaço de endereços da CPU não significa ler todos os bytes da ROM. A aplicação recolhe regiões parciais de WRAM, VRAM, OAM e registos, além de dados estáticos de apoio. Também não lê todas as caixas do PC.

Foi criado um scanner autónomo e só de leitura: pokemon-ai-companion/romAudit.js. Usá-lo sobre uma ROM local produz SHA-256, checksums e cobertura de 100% do FICHEIRO ROM, sem alterar ou enviar a ROM para lugar nenhum. Não prova que esse ficheiro é o efetivamente carregado no iPhone.

Exemplo de utilização na pasta da aplicação:

    node romAudit.js "S:\ROMs\PokemonRed.gb"

## Problemas encontrados e correções aplicadas

- **UDP:** fragmentos de 1024 bytes substituídos por 160; número exato de bytes e formato hexadecimal verificados, repetição limitada; dados truncados ou erros -1 são rejeitados.
- **ONLINE prematuro:** agora exige cinco blocos RAM principais recebidos e validados antes de apresentar a leitura como atual.
- **Identidade da ROM inventada:** substituída por tentativa de leitura de 80 bytes de cabeçalho e verificação do checksum; indisponibilidade e cobertura incompleta são assinaladas.
- **README antigo apresentado como vivo:** agora distingue hora da última leitura RAM e hora do relatório e assinala explicitamente telemetria não confirmada.
- **Cache antiga:** sem conectividade e validação recente o sistema deixa de sincronizar dados para o GitHub como atuais.
- **Batalha simulada:** identificada em separado, sem persistência ou sincronização como batalha real.
- **Fauna:** o painel distingue encontro lido da RAM de tabela estática de referência.
- **Texto de ecrã:** é uma amostra não classificada; já não é automaticamente tratado como diálogo NPC e é limpo quando ausente.
- **Tabela de Pokémon:** tipos Fairy, que não existem na Geração I, corrigidos.
- **Golpes:** já não atribuir tipo Normal, poder 40 e precisão 100 a IDs desconhecidos.
- **Flags:** leitura direta do estado de batalha e Repel exige resposta hexadecimal válida.
- **Contagem do PC:** relatório deixa claro que só a caixa selecionada foi lida.

## NÃO está ainda comprovado

1. Acesso real à memória RetroArch/SameBoy no iPhone durante estes testes: não foi possível deste ambiente.
2. ROM integral carregada no iPhone: não foi disponibilizada. A ferramenta para auditoria integral do ficheiro foi criada mas não executada com a ROM real.
3. Verificação de todos os offsets, todas as caixas do PC, todos os itens no PC, Daycare e todos os estados gráficos: incompleta.
4. Recomendações da IA, estimativas de batalha, NPCs identificados por proximidade e itens deduzidos: podem continuar a ser inferências; NÃO são leituras diretas de bytes ROM/RAM.
5. Codecheck de ponta a ponta: ainda não efetuado. Foram verificadas as alterações no repositório e realizados testes isolados da rotina de leitura, mas não um teste funcional completo com o jogo.

## Testes obrigatórios antes de certificar o jogo

1. Verificar connected=true, memoryReadStatus.verified=true, isSimulation=false e lastUpdate recente.
2. Capturar a RAM e ecrã em conjunto em duas localizações; confirmar mudança X/Y depois de um passo.
3. Confirmar HP, níveis, golpes e PP antes/depois de combate, e mochila antes/depois de consumir um item.
4. Confirmar flag D057 fora e dentro de combate e o estado de Repel D0DB.
5. Confirmar equipa e caixa PC com 2 ou mais Pokémon, especialmente HPs e níveis; rejeitar resultados impossíveis.
6. Desligar o RetroArch; o painel deve ficar offline e o GitHub deve deixar de atualizar. Testar também a simulação.
7. Fazer auditoria local ao ficheiro ROM completo e comparar o hash com a cópia usada no iPhone.
8. Só certificar os campos cujos offsets e respostas foram confirmados; NUNCA alegar cobertura de 100% quando a coleta é parcial.

## Fontes

- https://docs.libretro.com/development/retroarch/network-control-interface/
- https://gbdev.io/pandocs/Memory_Map.html
- https://gbdk.org/docs/api/docs_rombanking_mbcs.html

**Conclusão:** há leitura real de memória, mas não existe ainda prova de leitura integral da ROM nem garantia de 100% de exatidão em toda a telemetria.

## Adenda — 27/10/2026: segunda auditoria de IDs e progresso

**Atualizações efetuadas:** corrigidos os quatro IDs de espécie errados, os 15 tipos de golpes Psíquicos inválidos e **186 índices de eventos** calculados erradamente por misturar decimal e hexadecimal nos `const_skip` da desmontagem. Todas as **110 referências** a bits de evento em `areaData.js` passaram a constantes nomeadas do catálogo, pelo que o Rocket da casa roubada usa agora `EVENT_BEAT_CERULEAN_ROCKET_THIEF = 167` e Misty usa `EVENT_BEAT_MISTY = 191`.

Foi verificada, nas fontes do `pret/pokered`, uma base de referência de **151 espécies, 165 golpes, 507 eventos, 59 tabelas de áreas selvagens, 248 IDs de mapas e 9 trocas NPC disponíveis**. No formato da RAM, o código distingue valores observados (bytes), valores calculados (nível pelo grupo de crescimento) e tabelas estáticas da ROM; os valores dependentes de uma ROM modificada continuam condicionados à identidade da ROM real.

**Testes isolados executados:** leitura UDP de 530 bytes em 160/160/160/50, rejeição de erro e truncamento; validação estrutural de 12 caixas de um save sintético, incluindo rejeição de contagem superior a 20; renderização isolada do cartão Daycare com alerta e estado offline; validação sintática dos módulos alterados; teste automático dos dicionários de constantes e curvas de experiência. O código do dashboard foi atualizado no GitHub.

**Requisitos ainda NÃO concluídos:** não foi lida a ROM inteira do iPhone; não foi possível comparar byte a byte a memória viva com imagens captadas do jogo; a cópia mais recente da página no PC e do `.sav` do iPhone não foram inspecionadas. Um ficheiro `.sav` permite auditar todas as 12 caixas do último save; **não garante o que foi alterado após esse save**. A atualização e inspeção reais do painel continuam pendentes.

**Limites das probabilidades:** as posições de encontros usam pesos exatos `[51,51,39,25,25,25,13,13,11,3]/256`; isso descreve a distribuição *condicional a um encontro válido*. A probabilidade por passo depende ainda da taxa da zona e das regras de encontro, Repel, localização, método de pesca e situação de jogo. Probabilidades de captura ou dano são cálculos dependentes da espécie, HP/estado e dos efeitos da Geração I, nunca observações diretas da RAM; onde a fórmula não estiver validada, o sistema não deve afirmar garantias.

Referências dos módulos novos:
- [IDs canónicos](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/pokemon-ai-companion/data/gen1CanonicalIds.json)
- [Eventos e bits](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/pokemon-ai-companion/data/exact_events.json)
- [Species e crescimento](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/pokemon-ai-companion/data/gen1CanonicalSpecies.json)
- [Encontros por área](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/pokemon-ai-companion/data/gen1CanonicalWildEncounters.json)
- [Golpes e evolução](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/pokemon-ai-companion/data/gen1CanonicalLearnsets.json)
- [12 caixas de save](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/pokemon-ai-companion/saveAudit.js)
- [Teste automático de IDs e progresso](https://github.com/ApexScorpio/pokemon-red-telemetry/blob/main/pokemon-ai-companion/verifyGen1Ids.js)
