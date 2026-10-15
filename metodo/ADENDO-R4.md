# Antes de usar o prompt do método

Os arquivos do método continuam iguais. Este adendo complementa as regras do prompt COLE-NO-SEU-CLAUDE-METODO.md e deve ser lido junto dele.

1. Uma prova de Esperar não autoriza subir. Quem executa sempre pede a opção que autoriza, nunca Esperar. Saída 0 confirma a opção pedida.
2. Desfazer segue a mesma regra: mostre o que vai apagar e espere o sim claro para cada arquivo. Faça cópia antes de editar.
3. Nos settings, extraia só hooks por um comando local que imprime evento e comando. Nunca abra o arquivo inteiro na conversa; descarte env e mascare valores que pareçam segredo antes de imprimir.
4. A rotina só age dentro das regras do CLAUDE.md. O que apaga, sobe, instala ou manda mensagem vira card e espera autorização.
5. O painel grava quando você responde card, muda cronograma ou usa os pedidos de ordem. PAINEL_SO_LEITURA=1 desliga essas gravações.
6. Nas peças 5 a 8, explique em três linhas o que o código faz e ofereça mostrar o arquivo inteiro. O revisor de código cria uma worktree em ../worktrees e grava em revisoes/. Mostre esses caminhos antes do sim.
7. Antes de oferecer qualquer peça, rode node testes/texto-r4.cjs. Ele confere sim claro, credencial, desfazer e a forma do texto, além de preservar os modelos aprovados.

Use estado-local/ dentro do painel como a única pasta de estado. Ela é reconhecida ao atualizar a página, sem variável e sem reiniciar o painel.

As datas de 2025 são inventadas. Use a data gerada também nos nomes de tasks e revisoes. Antes de pedir o sim para cada modelo, gere a prévia com node preparar-modelo.cjs <arquivo-relativo>. A saída usa a data local do dia da instalação, mantendo o texto. O comando só imprime, não grava nada. Mostre a prévia e só depois do sim grave o arquivo de destino. Nunca execute sobre dados existentes. Os exemplos de Cronograma e Ideias estão em ../modelos-estado/. Para a prévia deles, use o caminho a partir da pasta do painel, por exemplo node metodo/preparar-modelo.cjs modelos-estado/ideias.jsonl.
