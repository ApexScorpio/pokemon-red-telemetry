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
