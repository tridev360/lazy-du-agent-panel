# O jeito de trabalhar com várias sessões do Claude Code

Nove ideias. Cada uma nasceu de um erro que custou caro. Pegue só as que fizerem sentido para você.

## 1. Uma sessão coordena, as outras têm área própria
Uma sessão conversa com você, divide o trabalho e confere. Cada outra sessão é dona de uma lista de pastas e não toca no resto.
- Exemplo: coordenadora (não coda), frontend (`src/ui/`), backend (`src/api/`, `db/`). Tarefa pontual vai para um ajudante numa worktree própria, que nasce para ela e morre ao entregar.
- Por que: duas sessões no mesmo arquivo se atropelam. E a coordenadora que também coda perde a visão do todo e ninguém confere nada.

## 2. O estado mora no disco, e o disco vence a memória
Tudo o que importa fica em arquivos simples numa pasta de estado. Antes de agir, a sessão lê. Antes de editar, relê.
- Exemplo: `DECISIONS.md` (só acrescenta), `estado/backend.md` (o que faz agora), `tasks/busca-nova.md` com `dono: backend`. Número só com o comando que mediu. Não medido vira "?", nunca 0.
- Por que: o contexto acaba, a conversa renova, a conta troca. O que não está no disco some e você repete o pedido. E a memória diz o estado de quando foi escrita, não o de agora.

## 3. Decisão perigosa só por card, com a pergunta exata e a prova
Toda pergunta a você vira um card num lugar só. Subir, chave e dinheiro só valem se a sua resposta está gravada na conversa, presa à mesma pergunta do card.
- Exemplo: `estado/cards/subir-busca-nova.json`, recomendada primeiro. A coordenadora mostra a tela de escolha com a frase igual, você clica, a ferramenta grava a prova. Quem sobe roda `prova-card.mjs conferir <id> "<opção que autoriza>"` e só age com saída 0. Se você escolheu "Esperar", a saída é 1.
- Por que: pergunta espalhada em cinco chats se perde. "O outro chat disse que você autorizou" é repasse, não prova. Card editado à mão também não é.

## 4. Quem escreve não revisa
O revisor nasce em contexto limpo, recebe só a tarefa, o hash e a lente, trabalha numa cópia e devolve uma nota cuja 1a linha é CONFERE ou SEGURA.
- Exemplo: "SEGURA sev 2 em d4e5f6a: o limite falha aberto quando a API cai. Conserto: tratar erro como limite estourado." O ok vale só para aquele hash. SEGURA depois de um CONFERE, no mesmo hash, bloqueia.
- Por que: o autor lê o que quis escrever, não o que escreveu. E a explicação do autor contamina quem revisa, por isso "o autor acha que" se ignora.

## 5. Teste primeiro, e o portão decide o commit
Toda obra nova começa pelo teste que falha. O commit só roda se o teste saiu com código 0.
- Exemplo: `npx vitest run tests/busca > saida.txt 2>&1 && git add src/busca/a.ts tests/busca/a.test.ts && git commit -F msg.txt`. Depois, exija "Tests N passed" no `saida.txt`. Mutação: tire a trava nova e veja o teste ficar vermelho. O kit segue isso: `node testes/teste-kit.cjs`.
- Por que: `teste | grep && commit` gravou vermelho mais de uma vez (o grep sai com 0 mesmo achando falha). E `git add -A` levou para o commit arquivo que ninguém olhou.

## 6. O pesado e isolado vai para outro agente, em paralelo
Tarefa com começo, fim e entrega clara vai para o Codex, um ajudante ou outra máquina, enquanto a sessão segue.
- Exemplo: "Codex: teste primeiro; escopo só a pasta `relatorio/`; entrega = NOTAS.md + testes verdes; sem commit." Antes de uma decisão grande, peça a ele uma 2a opinião em 3 linhas.
- Por que: uma sessão fazendo tudo em fila fica lenta. Um agente orquestrando muitos ajudantes vira bagunça. Uma tarefa isolada por vez funciona.

## 7. Rotina de 15 min que mede, acelera e cobra
A cada 15 min a coordenadora roda a mesma volta: hora real, cards sem resposta, o que está parado e por quê, o que dá para pôr em paralelo. Age no que não depende de você e grava 1 linha.
- Exemplo de linha: `{"resultado":"acelerou","detalhe":"revisão da busca foi para um ajudante"}`. Parado 30 min, cobra a dona. 60 min, avisa você.
- Por que: sem rotina, a coordenadora só acelera quando você pergunta. E frente parada some em silêncio.

## 8. Memória curta com erros já pagos, 1 linha cada
O índice `MEMORY.md` tem uma linha por regra. Cada regra tem um arquivo com o que aconteceu, por que importa e como aplicar.
- Exemplo: `- [Portão antes do commit](portao.md): ERRO: pipe entre teste e commit gravou vermelho; teste > arq && commit`
- Por que: memória longa ninguém lê, e regra sem o erro que a gerou é ignorada. Erro que se repetiu duas vezes vira gancho (um script que barra o comando antes de rodar), não mais uma linha.

## 9. Um painel que lê esse estado
O painel que vem junto lê as sessões do Claude Code e do Codex (`~/.claude`, `~/.codex`) e, se você apontar, a pasta de estado: cards esperando você, entregas, tasks, decisões, a coordenação e as voltas da rotina.
- Exemplo: aponte o painel para a pasta de estado (a mesma que o método usa) e abra no navegador. A aba de cronograma usa um arquivo a mais, com modelo na pasta do painel. O passo a passo está no prompt de instalação dele.
- Por que: com cinco sessões abertas, você não deveria abrir cinco chats para saber o que espera por você.
