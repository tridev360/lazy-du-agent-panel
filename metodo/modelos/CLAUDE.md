<!-- metodo-kit: começo (modelo de CLAUDE.md) -->
<!-- Troque o que está entre < >. Apague a linha "Ex.:" que não servir. Curto vence completo: cada linha aqui entra em toda conversa. -->
# <nome do projeto>: <o que é, em 1 linha>. <onde roda e a versão do runtime>
Ex.: # receitas: app de receitas (web e API). Produção em contêiner, Node 20.

## Sessões e áreas
- <coordenadora>: conversa com o dono, divide o trabalho, confere por outro caminho e guarda o estado. Não escreve código de área, não sobe.
- <frontend>: dona de <src/ui/, public/>.
- <backend>: dona de <src/api/, db/, scripts/>. A única que sobe.
- Ajudante (subagente): nasce para 1 tarefa, trabalha numa worktree própria, morre ao entregar. Nunca sobe, nunca faz commit no main.
Ex.: frontend precisou mexer em src/api/: para e devolve o pedido à coordenadora.

## Antes de agir
- Leia <pasta-de-estado>/DECISIONS.md, estado/<sua sessão>.md (a coordenadora: estado/coordenacao.md) e as tasks com "dono: <sua sessão>".
- O disco vence a memória: releia o arquivo antes de editar (outras sessões escrevem junto).
- Número só medido, com o comando que mediu. Não medido vira "?", nunca 0. Hora só do relógio da máquina.

## Nunca
- Abrir .env, *.env, chave, token ou frase-semente. Imprimir segredo ou URL com segredo.
- git add -A, git add . ou git commit -a. Sempre git add <arquivos>.
- Pipe entre o teste e o commit.
- Mandar mensagem a alguém (email, chat, post). "Responda" = escrever o texto para o dono mandar.
- Matar processo que você não criou.
- <a sua regra dura>. Ex.: rodar migração no banco de produção.

## Decisão do dono: só por card
- Pergunta ao dono vira card em <pasta-de-estado>/estado/cards/<id>.json (modelo: card-exemplo.json), recomendada primeiro. Siga no que não depende e leia o "respondido" do card depois.
- Card perigoso (subir, env, chave, dinheiro) só vale com prova: node <pasta-de-estado>/ferramentas/prova-card.mjs conferir <id> "<opção que autoriza>" com saída 0. Sem prova, não aja.

## Subir
- Só a <backend>, com card perigoso respondido com prova.
- <comando exato de subir e de qual pasta>. Antes: testes verdes e revisão CONFERE no hash exato. Depois: <como conferir que subiu> e um aviso curto ao dono com o que subiu e como voltar atrás.
- Nunca em <horário proibido>. Ex.: sexta depois das 18h, ou com outra subida na fila.

## Revisão antes do card
- Lista fixa: <pagamento, login, migração, deploy>. Tocou um: revisor-codigo em contexto limpo, nunca quem escreveu, na cópia destacada no hash.
- Texto para fora, tela, CLAUDE.md e prompt: revisor-texto.
- SEGURA depois de um CONFERE, no mesmo hash, bloqueia.

## Worktree, prévia, teste
- Tarefa nova: worktree em <../worktrees/<tarefa>>.
- Prévia local: portas <3001-3009> para ajudante (a <3000> é a do dono). No máximo 1 prévia sua; desligue no fim.
- Teste primeiro: o teste que falha sai antes do código; o relatório mostra o vermelho e depois o verde.
- Portão: <npx vitest run arquivos> > saida.txt 2>&1 && git add <arquivos> && git commit -F msg.txt. Depois, exija "Tests N passed" no saida.txt.
- Ajudante em fatia curta: quando a tarefa fica longa, para num ponto natural, grava PONTO.md (feito, falta, próximo passo exato) e devolve "PONTO: continua". Quem chamou abre outro do mesmo tipo com o PONTO.

## Texto
- <idioma da tela, tom, formato de data e hora>. Ex.: textos da interface em português; datas como 14/03; mensagem de erro diz o que fazer a seguir.
- Promete só o que o código cumpre.
<!-- metodo-kit: fim (modelo de CLAUDE.md) -->
