# Modelos: o que é cada arquivo e para onde vai

Nada aqui se instala sozinho. O prompt COLE-NO-SEU-CLAUDE-METODO.md oferece uma peça por vez, mostra o conteúdo exato e só grava com o seu "sim".

| Arquivo | Para onde vai | Peça do método |
| --- | --- | --- |
| `pasta-de-estado/` | a mesma pasta de estado do painel (ele sugere `estado-local/` dentro da pasta dele) | Estado no disco |
| `CLAUDE.md` | bloco acrescentado no fim do CLAUDE.md do projeto | Áreas, regras duras |
| `memoria/MEMORY.md` e `portao-antes-do-commit.md` | `~/.claude/projects/<projeto>/memory/` | Memória curta |
| `.claude/agents/revisor-codigo.md`, `revisor-texto.md` | `.claude/agents/` do projeto (ou `~/.claude/agents/` para todos) | Quem escreve não revisa |
| `.claude/ganchos/metodo-kit-barra-comando.mjs` | `.claude/ganchos/` do projeto | Gancho que barra comando perigoso |
| `.claude/settings-gancho-exemplo.json` | entrada acrescentada no `.claude/settings.json` do projeto | Liga o gancho |
| `card-exemplo.json` | `estado/cards/` da pasta de estado | Decisão por card |
| `pasta-de-estado/ferramentas/*` | vão junto com a pasta de estado | Prova de card, entregas, rotina |
| `rotina-15-min.md` | texto para o `/loop 15m` da coordenadora | Rotina de 15 min |
| `../testes/teste-kit.cjs` | fica no kit: `node testes/teste-kit.cjs` | Confere o gancho e as ferramentas |

## A pasta de estado
- `DECISIONS.md`: decisões do dono, só acrescenta.
- `estado/coordenacao.md`: o que a coordenadora faz agora, o que espera você, a passagem. As outras sessões: `estado/<sessão>.md`.
- `estado/cards/<id>.json`: perguntas a você. `estado/entregas.json`: passos de cada entrega.
- `estado/rotina-voltas.jsonl`: 1 linha por volta da rotina.
- `tasks/<id>.md`: uma tarefa por arquivo, com `dono:`, "pode tocar", "pronto quando" e um Log.
- `revisoes/`: um arquivo por veredito. `termos-proibidos.txt`: o que nunca pode sair em texto.
- `ferramentas/`: Node 18 ou mais novo, sem dependência, sem rede. Acham a pasta sozinhas (a pasta acima delas) ou pela variável `ESTADO_RAIZ`.

## O que o painel mostra desta pasta
Os nomes acima são os que o painel lê: cards (responde os comuns pelo clique), entregas, tasks, `DECISIONS.md`, o bloco "PARA O OPERADOR" do `estado/coordenacao.md` e as voltas da rotina (as dos últimos 3 dias).
Não vêm no kit: `estado/cronograma.json` (aba de cronograma) e `estado/ideias/` (aba de ideias). Os modelos deles estão em `demo/estado` da pasta do painel.
`revisoes/`, `termos-proibidos.txt` e `ferramentas/` são do método; o painel não usa.

## Os campos do card
- `id`: igual ao nome do arquivo. `sessao`: quem perguntou. `criado`: hora em ISO (a prova compara com ela).
- `pergunta`: a frase exata. A tela de escolha no chat tem de usar a MESMA frase, letra por letra.
- `opcoes`: `label` (curto) e `descricao` (o que acontece). A recomendada primeiro, com `"recomendada": true`.
- `tipo` e `perigoso`: subir, env, chave ou dinheiro = `"perigoso": true`. O painel não deixa responder esse pelo clique. Ele também trata como perigoso card que fala em senha, pagamento ou deploy.
- `porque` e `destrava`: por que a pergunta existe e o que anda quando você responde.
- Depois da resposta com prova, a ferramenta grava:
  `"respondido": "<hora> Subir agora (com prova)"`, `"respondidoEm": "<hora>"` e
  `"prova": { "conversa": "<id da conversa>", "uuid": "<id da linha>", "hora": "<hora>", "resposta": "Subir agora" }`.

## Como a prova funciona, em 3 passos
1. A coordenadora mostra a tela de escolha (AskUserQuestion) com a pergunta igual à do card. Você clica.
2. Ela roda `node <pasta-de-estado>/ferramentas/prova-card.mjs responder <id> "<opção>"`, da pasta do projeto dela. A ferramenta acha a sua resposta na conversa gravada em `~/.claude/projects/` e escreve a prova no card.
3. Quem executa roda `prova-card.mjs conferir <id> "<opção que autoriza>"` antes de agir. A opção é obrigatória. Saída 0 = pode. Saída 1 = não age (sem prova, outra escolha ou sem a opção). Prova com "Esperar" nunca sai 0.
   Rodando de outra pasta ou de uma worktree, ponha `PROVA_PROJETO=<~/.claude/projects/pasta da coordenadora>` na frente do comando. Sem isso a conversa não é achada e a saída é 1.
