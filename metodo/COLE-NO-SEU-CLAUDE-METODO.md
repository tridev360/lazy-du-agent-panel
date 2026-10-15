# Cole no seu Claude Code (método)

Abra o Claude Code na pasta do projeto onde quer começar. Copie tudo o que está entre as duas linhas `---` e cole como primeira mensagem.
Troque `<PASTA_DO_KIT>` pelo caminho da pasta metodo/ do repositório que você clonou (a que tem o GUIA.md).

---

Quero conhecer, e talvez adotar, um jeito de trabalhar com várias sessões do Claude Code. O kit está em `<PASTA_DO_KIT>`: leia `GUIA.md` e `modelos/LEIA-MODELOS.md` agora. Os outros modelos você lê só na hora de oferecer a peça deles.

Fale comigo em pt-BR, frases curtas, sem jargão. Uma pergunta por vez.

## Regras que você segue sempre, sem exceção

1. **Primeiro só olha.** Na fase 1 você não cria, não edita, não move e não apaga nada. Nem pasta.
2. **Uma peça por vez, com o conteúdo na tela.** Para cada peça você me diz: o que é, o que muda na minha rotina, quais arquivos cria ou muda, o que acontece se eu não fizer e como desfazer. Antes do sim, mostre o conteúdo exato que vai gravar em cada arquivo (ou a diferença para o modelo; arquivo copiado sem mudança, diga isso e liste o caminho). Depois pergunte: "Entendeu? Quer aplicar esta peça?". Só aplica com um "sim" claro para aquela peça; resposta que não é um sim claro, pergunte de novo. Depois do sim, mexa só nos arquivos ditos e só no que foi mostrado; precisou de outro arquivo ou de outra mudança, pare e pergunte. "Não" ou "depois": anote e ofereça a próxima. "Pare": vá direto ao resumo final. Nunca aplique em lote. Nunca diga "vou ajustar umas coisas".
3. **Nunca sobrescreve.** CLAUDE.md, settings, ganchos e memória meus não são reescritos. Depois do sim, antes de tocar em qualquer arquivo que já existe, faça uma cópia ao lado: `<arquivo>.antes-metodo-kit-<AAAAMMDD-HHMM>` (hora do relógio da máquina). Em Markdown, acrescente só um bloco no fim, entre marcadores:
   `<!-- metodo-kit: começo (peça N: nome) -->` e `<!-- metodo-kit: fim (peça N) -->`.
   Em JSON não existe comentário: acrescente só a entrada nova, sem mexer nas outras, e a marca é o nome do arquivo do gancho (`metodo-kit-...`). Confira que o JSON continua válido. Arquivo novo com nome que já existe: não substitua, proponha outro nome.
4. **Segredo e rede.** Nunca abra .env, *.env, chave, token, senha, frase-semente nem arquivo de carteira de cripto. Ao ler um settings.json, não mostre o bloco "env" nem valor que pareça chave. Não instale nada (npm, pip, brew, extensão). Não mande nada pela rede (sem curl, sem push, sem post, sem mensagem). Não faça commit. Não mate processo.
5. **No fim, resumo.** Uma tabela: peça | entrou ou não | arquivos | como tirar. E onde ficaram as cópias de segurança.

## Fase 1: só olhar e me mostrar

Leia, sem mudar nada. Em `~/.claude` e `~/.codex`, abra só os arquivos citados abaixo; nunca `.credentials.json`, `auth.json` nem qualquer arquivo de credencial ou de login.
- Versões: `node --version` (as ferramentas do kit pedem Node 20 ou mais novo) e `git --version`.
- `~/.claude/`: tem CLAUDE.md global? No settings.json, quais ganchos existem (só o evento e o comando). Quais agentes em `agents/`. Em `projects/`: quantos projetos, quais têm `memory/MEMORY.md` e de que tamanho. Não abra o conteúdo das conversas (.jsonl): só conte.
- Este projeto (e outros que eu indicar): tem CLAUDE.md (tamanho e seções)? `.claude/agents/`? Ganchos em `.claude/settings.json` ou `settings.local.json`? É repositório git? Qual o comando de teste (scripts do package.json, ou o que houver)? `git worktree list`.
- `~/.codex/`: a pasta existe? (só isso). Tem AGENTS.md nos projetos?
- Já existe pasta de estado? Procure primeiro `estado-local/` dentro da pasta do painel (é a que o painel sugere); depois, uma pasta com `DECISIONS.md` ou `estado/cards/`.

Mostre numa tabela curta: o que achei | o que isso quer dizer para o método. Termine com "Nada foi mudado." e pergunte se quero ver as peças, uma por vez.

## Fase 2: as peças, nesta ordem (pule a que eu já tiver)

Use o que achou na fase 1, mas sempre pela regra 2: o conteúdo exato na tela antes do sim. Os modelos estão em `<PASTA_DO_KIT>/modelos/`.

1. **Pasta de estado.** Uma pasta com `DECISIONS.md`, `estado/`, `estado/coordenacao.md`, `estado/cards/`, `tasks/`, `revisoes/` e `ferramentas/`, copiada de `modelos/pasta-de-estado/` (os nomes são os que o painel lê). Se eu já criei a pasta de estado na instalação do painel, use a mesma e acrescente só o que falta, sem substituir nada. Se não, sugira a mesma do painel: `estado-local/` dentro da pasta do painel. Mostre a lista de arquivos e pergunte se quero os exemplos inventados ou só a estrutura. Rotina: toda sessão lê esta pasta antes de agir. Sem ela, as peças 7 a 9 não têm onde morar. Desfazer: apagar o que foi criado; nada fora da pasta muda.
2. **Bloco no CLAUDE.md do projeto.** Antes, pergunte: quais sessões eu rodo e de quais pastas cada uma é dona, quem pode subir e com que comando, quais arquivos são sensíveis. Monte o bloco a partir de `modelos/CLAUDE.md`, só com o que eu respondi, e mostre o bloco inteiro. Desfazer: apagar do marcador de começo ao de fim, ou voltar a cópia.
3. **Memória curta.** Acrescenta no `MEMORY.md` deste projeto (em `~/.claude/projects/<projeto>/memory/`) o bloco de `modelos/memoria/MEMORY.md` e cria `portao-antes-do-commit.md` ao lado. Mostre os dois textos. Rotina: erro que custou caro vira 1 linha ali, com o arquivo do porquê. Desfazer: apagar o bloco e o arquivo novo.
4. **Teste primeiro e portão.** Um bloco no CLAUDE.md com a regra: obra nova começa pelo teste que falha; commit só pelo código de saída do teste (`<meu comando de teste> > saida.txt 2>&1 && git add <arquivos> && git commit`), nunca com pipe. Escreva o bloco com o meu comando de teste de verdade e mostre o bloco inteiro antes do sim. Desfazer: apagar o bloco.
5. **Revisores.** Copia `modelos/.claude/agents/revisor-codigo.md` e `revisor-texto.md` para `.claude/agents/` do projeto (ou `~/.claude/agents/`, se eu quiser em todos), trocando `<pasta-de-estado>` pelo caminho da peça 1. Mostre a diferença para o modelo. Rotina: antes de commit sensível ou de subir, a sessão chama o revisor, que devolve CONFERE ou SEGURA num arquivo em `revisoes/`. Desfazer: apagar os dois arquivos.
6. **Gancho que barra comando perigoso.** Copia `modelos/.claude/ganchos/metodo-kit-barra-comando.mjs` para `.claude/ganchos/` do projeto e acrescenta a entrada de `modelos/.claude/settings-gancho-exemplo.json` no `.claude/settings.json` (ou no `settings.local.json`, se eu não quiser no git). Mostre a entrada e como o JSON fica. Antes de ligar, teste com 3 entradas falsas pela linha de comando (ex.: `git add -A` deve sair 2, `git status` deve sair 0) e me mostre. Explique que o Claude Code lê os ganchos ao abrir a sessão; numa sessão já aberta, pelo menu `/hooks`. Desfazer: tirar a entrada cujo comando tem `metodo-kit` (ou voltar a cópia) e apagar o arquivo.
7. **Cards de decisão com prova.** Precisa da peça 1. Um bloco no CLAUDE.md com a regra: pergunta a mim vira card em `estado/cards/`; card perigoso (subir, env, chave, dinheiro) só vale com `ferramentas/prova-card.mjs conferir <id> "<opção que autoriza>"` saindo 0. Mostre o bloco inteiro antes do sim. Explique os 3 passos da prova (LEIA-MODELOS.md), que a ferramenta só lê as conversas locais em `~/.claude/projects/` e que, de outra pasta, precisa de `PROVA_PROJETO`. Desfazer: apagar o bloco; os cards são arquivos soltos.
8. **Entregas para o painel.** Precisa da peça 1. Um bloco no CLAUDE.md com a regra: cada sessão roda `ferramentas/entregas.cjs feito <id> "<passo>"` quando fecha um passo. Mostre o bloco inteiro antes do sim. Desfazer: apagar o bloco e, se quiser, `estado/entregas.json`.
9. **Rotina de 15 min.** Precisa da peça 1. Mostre `modelos/rotina-15-min.md` com o caminho da minha pasta já trocado. Eu ligo digitando `/loop 15m` com esse texto na sessão coordenadora; você não cria tarefa agendada sozinho. Desfazer: eu digo "para" ou fecho a sessão; nada fica instalado.
10. **Ligar o painel.** Só explique: o painel roda sem a pasta de estado, e com ela mostra cards, entregas e a coordenação (é a pasta da peça 1 que eu aponto na instalação dele). A instalação do painel tem prompt próprio, na pasta do painel.

## Fim

Mostre o resumo da regra 5. Diga em 1 linha qual peça eu deveria olhar de novo daqui a uma semana, pelo que viu na fase 1.

---
