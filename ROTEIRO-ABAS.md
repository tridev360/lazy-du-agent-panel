# Roteiro de abas do painel

Use uma pasta nova e vazia. Gere os exemplos com node demo/gerar.cjs. Confira a porta com netstat e abra node demo/apresentar.cjs 3255 (ou outra porta livre). Não encerre servidor de outra pessoa. O endereço abaixo usa 127.0.0.1:3255.

Grave nesta ordem: Agora, Fluxo, Idealizadores, Cérebro; depois o resumo das demais vistas. Troque os temas em Configurações para mostrar Grade, Livro e Folha. A animação obedece Motion off e reduced motion. Ligue Movimento apenas se não houver preferência de movimento reduzido; não prometa som ou animação quando estiverem desligados.

## Agora

URL: http://127.0.0.1:3255/painel-estado#g=agora.agora

Ação: Abrir Agora e clicar numa decisão ou entrega fictícia. A gaveta mostra os detalhes. O modo de exemplo anima a chegada de eventos quando Movimento está ligado.

Fonte: estado/estado-agora.json.

## Meu andamento

URL: http://127.0.0.1:3255/painel-estado#g=agora.andamento

Ação: Abrir Meu andamento e alternar Modo mamífero: só o resumo e Ver tudo. Mostrar os desenhos gerados dos nomes, cartões e trilha. Os sinais e desenhos piscam somente com Movimento ligado.

Fonte: estado/meu-andamento.json.

## Lançamentos

URL: http://127.0.0.1:3255/painel-estado#g=agora.lancamentos

Ação: Trocar o dia e abrir o item fictício de lançamento.

Fonte: estado/cronograma.json.

## Cronograma

URL: http://127.0.0.1:3255/painel-estado#g=agora.cronograma

Ação: Reordenar um item da agenda fictícia e confirmar o pedido.

Fonte: estado/cronograma.json.

## Rotina

URL: http://127.0.0.1:3255/painel-estado#g=agora.rotina

Ação: Abrir a configuração e mostrar o histórico das voltas fictícias.

Fonte: estado/rotina.json.

## Fluxo

URL: http://127.0.0.1:3255/painel-estado#g=equipe.fluxo

Ação: Passar o mouse nos cartões e clicar num ajudante. Abrir Organograma e voltar ao resumo; abrir Segunda tela. Com pedidos ligados, confirmar Dar prioridade registra o pedido.

Fonte: sessões pessoais e frentes.

## Árvore da equipe

URL: http://127.0.0.1:3255/painel-estado#g=equipe.arvore

Ação: Abrir Árvore. Clicar numa sessão ou ajudante para ver o detalhe e acender a ligação.

Fonte: sessões pessoais.

## Sessões

URL: http://127.0.0.1:3255/painel-estado#g=equipe.sessoes

Ação: Na vista Sessões, usar + coluna, mover uma coluna para a esquerda ou direita e abrir a conversa. Registrar um pedido fictício com confirmação; o botão Desfazer cancela durante os quatro segundos antes da gravação. Ctrl+K abre o compositor para as duas famílias. Não chamar registro de execução.

Fonte: conversas pessoais.

## Histórico

URL: http://127.0.0.1:3255/painel-estado#g=equipe.historico

Ação: Mudar o intervalo e selecionar uma ligação. A seleção acende o caminho.

Fonte: histórico pessoal.

## Fila

URL: http://127.0.0.1:3255/painel-estado#g=fila.fila

Ação: Abrir um trabalho, seus passos e a entrega. Mostrar o feedback de passo concluído.

Fonte: tasks pessoais.

## Projetos

URL: http://127.0.0.1:3255/painel-estado#g=fila.projetos

Ação: Trocar o projeto ativo e abrir uma entrega. Mostrar a separação dos exemplos.

Fonte: projetos pessoais.

## Chaves

URL: http://127.0.0.1:3255/painel-estado#g=fila.chaves

Ação: Virar uma chave, mostrar prós e contras, cancelar, depois confirmar e mostrar Desfazer.

Fonte: estado/chaves-tasks.json.

## Ideias (Decidir)

URL: http://127.0.0.1:3255/painel-estado#g=decidir.ideias

Ação: Abrir Ver votos e debate; mostrar votos e depois registrar uma resposta numa ideia fictícia. A resposta usa o mesmo veredito dos Conselheiros.

Fonte: estado/ideias/conselho.json.

## Conselho

URL: http://127.0.0.1:3255/painel-estado#g=decidir.conselho

Ação: Abrir uma ideia e escolher uma opção. Mostrar o lembrete baixar após a resposta. Na primeira visita, mostrar o popup dos Conselheiros.

Fonte: estado/ideias/conselho.json.

## Radar

URL: http://127.0.0.1:3255/painel-estado#g=decidir.radar

Ação: Trocar o filtro de observações e abrir o detalhe.

Fonte: estado/radar.json.

## Revisão

URL: http://127.0.0.1:3255/painel-estado#g=decidir.revisao

Ação: Selecionar um item, escolher Aprovo, Refazer ou Depois e mostrar Desfazer. As escolhas ficam no log local.

Fonte: estado/revisao-itens.json.

## Aprendizados

URL: http://127.0.0.1:3255/painel-estado#g=cerebro.aprendizados

Ação: Em Aprendizados, passar o mouse em uma região, clicar em Skills ou Lições e escolher um item. Para onda de chegada, rodar node demo/cena.cjs aprendizado e clicar Conferir leitura. Usar Tudo se Hoje estiver vazio.

Fonte: fontes pessoais Markdown.

## Mapa de memórias

URL: http://127.0.0.1:3255/painel-estado#g=cerebro.mapa

Ação: Selecionar um ponto e passar o mouse sobre uma ligação; abrir o detalhe e seus vizinhos.

Fonte: fontes pessoais Markdown.

## Alimente sua IA

URL: http://127.0.0.1:3255/painel-estado#g=cerebro.habitos

Ação: Abrir uma dica e alimentar a IA do exemplo. Mostrar o feedback, respeitando Mudo e Motion off.

Fonte: estado/ia-tips.json.

## Linha do tempo

URL: http://127.0.0.1:3255/painel-estado#g=cerebro.historia

Ação: Abrir os registros e a visão por semanas. Mostrar apenas o exemplo fictício.

Fonte: estado/timeline-semanas.json.

## Cérebro e Árvore

URL: http://127.0.0.1:3255/painel-estado#g=cerebro.mapa-antigo

Ação: Clicar num ponto e em uma memória ligada; arrastar, usar zoom e Enquadrar. Trocar Cérebro por Árvore e explorar uma regra. Os pulsos de uso só aparecem quando a fonte registra a ligação explicitamente.

Fonte: CLAUDE.md, memória, agentes e regras pessoais.

## Finanças pessoais

URL: http://127.0.0.1:3255/painel-estado#g=caixa.financas

Ação: Abrir o exemplo pessoal e os detalhes. Não há operação de dinheiro no kit.

Fonte: estado/financas.json.

## Consumo

URL: http://127.0.0.1:3255/painel-estado#g=caixa.consumo

Ação: Abrir um registro de uso e seu horário de leitura. Sem fonte, mostrar ? com a solução.

Fonte: crédito e tokens pessoais.

## Teclas e controles globais

As teclas 1 a 7 escolhem as abas principais na ordem mostrada no menu: 1 Agora, 2 Fluxo, 3 Idealizadores, 4 Cérebro, 5 Fila, 6 Decidir, 7 Caixa. W abre WEN; Esc fecha os diálogos. A configuração também abre o seletor de tema, idioma, Mudo e Movimento. Se o foco estiver num campo, primeiro saia dele para usar atalhos.

Conversas e pedidos abre as conversas pessoais autorizadas, o campo de pedido e, se ligada, a fita de atividade. Recursos pessoais permite ligar ou desligar conversas, pedidos, fita, voz e Grok com confirmação. Voz e Grok começam desligados. A marcha do cabeçalho abre o controle de ritmo, fases e minutos medidos. Escolher uma marcha dá quatro segundos para Desfazer e registra uma preferência local. Música abre o player local; a demo tem um pulso original, sem faixa de terceiro. O som começa mudo e nenhum áudio toca antes de clique.

Para mostrar WEN: pressione W e mostre frentes, percentuais, horários e ? nas fontes ausentes. Acelerar registra pulsos locais; a sessão precisa ler e responder antes de aparecer como execução. Não use dados reais na gravação.

## Última cena: um único prompt

Feche o painel, mostre a pasta nova e vazia, abra o Claude Code nela e cole: siga o COLE-NO-SEU-CLAUDE.md. Mostre que o arquivo faz o inventário das fontes pessoais, apresenta os arquivos propostos e configura cada aba depois do consentimento. Nenhum segundo prompt de instalação é necessário. O roteiro mostra configuração, não uma instalação já executada no computador de outra pessoa.

## Feed, imagens, voz e pesquisa

Em Sessões, + coluna escolhe uma conversa, as setas mudam a ordem e Tirar coluna remove a coluna. Ctrl+K abre o compositor para as duas famílias. Anexar imagem, Ctrl+V ou arrastar aceita até três imagens locais de 8 MB. Enviar pede confirmação e mostra quatro segundos para Desfazer. O recibo inicial diz registrado; a resposta exige arquivo da rotina pessoal.

Para demonstrar voz e Grok, use Recursos pessoais, confirme a ativação e recarregue. Na demo, Grok mostra uma pesquisa fictícia encerrada. Voz e texto abre o widget; Ligar voz autoriza a leitura, Falar só funciona se o navegador já tiver reconhecimento local. Sem esse suporte, digite o texto e registre o pedido. Mudo e Parar leitura controlam apenas vozes locais. Desligue ambos após a demonstração.

A galeria de Meu andamento usa somente seus vídeos locais autorizados. Na demo ela fica vazia. Com mídia própria configurada, abrir Meus vídeos e Tocar usa o player local, mudo e sem autoplay. Nunca use vídeo de outra equipe na gravação.
