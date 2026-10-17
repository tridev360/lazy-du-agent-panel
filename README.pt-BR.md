# Lazy Du Agent Panel

Um painel local para as suas sessões do Claude Code e do Codex: quem espera você, quem trabalha agora, projetos, ajudantes e consumo. Roda no seu computador, sem conta, sem chave de API e sem dependências. Node 20 ou mais novo.

[English](README.md)

> A versão 3 é uma base nova. A tela está quase toda em português por enquanto; inglês e espanhol cobrem parte das telas. A versão 2.2.8 continua disponível na tag `v2.2.8`.

## Comece por aqui

1. Clone ou baixe este repositório numa pasta nova.
2. Rode `node checar.cjs` para conferir a instalação em frases legíveis e depois `node servidor.cjs`.
3. Abra http://127.0.0.1:3257. Leia Comece aqui e faça o tour de um minuto, ou pule.
4. Olhe Esperando você, responda na sessão do Claude Code ou do Codex e confira Trabalhando agora.

Para abrir de novo: `painel.bat` no Windows ou `sh painel.sh` no Linux. O servidor escuta só em 127.0.0.1. Ctrl+C encerra o servidor iniciado no terminal.

Quer ver antes? `npm run example` (ou `npm run example:win`) abre um estado fictício, sem sessões reais.

## O que tem

- Agora: o que espera você, agentes trabalhando agora e a idade de cada leitura. Leitura que falta aparece como "?" com a solução, nunca zero inventado.
- Fluxo: coordenador, sessões e ajudantes numa vista vertical, com quem envia e quem recebe.
- Ideias: ideias com votos e decisão em um toque. Revisores opcionais (Conselheiros) dão o veredito antes de você decidir.
- Cérebro: seu CLAUDE.md, memória, agentes e regras, quando você autoriza essas fontes.
- Cronograma, entregas, cards e fila quando você liga uma pasta de estado opcional (veja `metodo/GUIA.md`).
- WEN: uma linha por frente, com progresso, minutos que faltam e quem trabalha agora.
- Temas Grade, Livro e Folha. A animação respeita o movimento reduzido.

## Pedidos ao orquestrador e atalho da sessão

- Em Esperando você, cada sessão traz um atalho: "Abrir sessão ↗" abre a conversa no app Claude ou no Codex; sessão só no terminal ganha "Copiar comando" (`claude --resume <id>`).
- Pedidos começam desligados e ficam na tela completa (http://127.0.0.1:3257/painel-estado, que precisa da pasta de estado do passo 2 em `metodo/`). Em Recursos pessoais, clique em Ligar pedidos: o que você manda pelo painel, para uma sessão ou para o orquestrador (a sessão que coordena as outras por você), vira uma linha em `estado/pedidos-sessoes.jsonl`. O painel não fala com a sessão sozinho.
- Para o orquestrador ler a fila: na sessão do Claude Code que coordena, peça para rodar `bash ferramentas/escuta-pedidos.sh` com a ferramenta Monitor (no Windows, pelo Git Bash). Cada pedido novo chega como uma linha `PEDIDO: {...}`, inclusive os endereçados a uma sessão. Na primeira vez a escuta começa do fim da fila (pedidos antigos não chegam); depois continua de onde parou, inclusive os pedidos feitos com ela desligada, e cada pedido chega uma vez só. Se a sua pasta de estado não for `estado-local`, rode com o mesmo `PAINEL_ROOT`.
- Só você deve escrever nessa fila: o texto de cada pedido vira instrução para o agente que coordena (risco de injeção de prompt). Não deixe outro programa ou pessoa gravar linhas em `estado/pedidos-sessoes.jsonl` e peça ao agente para confirmar no chat dele antes de algo arriscado. A escuta só passa linhas no formato que o painel grava e nunca reescreve a fila.
- Para a resposta aparecer no painel, com a voz ligada (Ligar voz, em Recursos pessoais), o orquestrador grava uma linha `{"ts":"<hora ISO>","texto":"..."}` em `estado/voz-respostas.jsonl`. Para responder dentro da aba de uma sessão, acrescente `"sessao":"<id do pedido>"`.

## Monitores

Crie `config/monitores.json` a partir de `config/monitores.exemplo.json`, ou escolha outro caminho com `PAINEL_MONITORES`. O arquivo fica fora do git (`.gitignore`). Cada item tem `id` (a-z, 0-9 e hífen), `nome` curto e `tipo`:

- `http`: GET de `url` ou `urlEnv`, com `esperar` opcional (padrão 200 a 399) e `timeoutMs` (padrão 5000, máximo 15000). URL com chave só por `urlEnv`, que contém o nome da variável de ambiente. URLs literais com credenciais, parâmetros de segredo ou trecho do caminho com cara de chave são recusadas. Redirecionamento só é seguido para o mesmo host e porta, ou de http na porta 80 para https na porta 443 do mesmo host. A tela mostra apenas o host ou o nome da variável.
- `comando`: executável em `comando` e lista de textos em `args`, sem shell. Só o código de saída é usado; a saída é descartada. `timeoutMs`: padrão 10000, máximo 30000; no tempo esgotado o comando e o que ele abriu são encerrados (no Windows, processos deixados em segundo plano por um script do Git Bash podem continuar rodando). No Windows, arquivos `.cmd` e `.bat` não rodam (Node 20.12.2 ou mais novo).
- `batimento`: `arquivo` relativo a `PAINEL_ROOT` (a pasta de estado escolhida) ou absoluto; lê só a data de modificação. `maxIdadeSegundos`: padrão 300.

`intervaloSegundos` tem mínimo de 60 s. As checagens começam quando a tela simples ou a Agora do tema Livro pede os monitores, seguem uma por vez enquanto o painel estiver aberto e releem a configuração quando sua data de modificação muda. A demo e o exemplo nunca leem esse arquivo. Nada configurado = a seção some na tela simples; o tema Livro mostra "Nenhum monitor configurado". Sem leitura aparece "?". Um monitor que caiu também aparece em "Esperando você". Configurar HTTP ou um comando autoriza essas checagens, inclusive conexões ao destino escolhido.

## Privacidade

- A leitura das sessões é só de metadados: campos escalares conhecidos dos registros. Mensagens e saídas de ferramentas são descartadas; arquivos privados, atalhos, `.credentials.json` e `auth.json` não são abertos.
- Conversas, voz, música e o registro de pesquisa começam desligados e só ligam por escolha sua.
- Nada sai do seu computador, com exceções que você liga: Perguntar (usa seu Codex), em Decidir > Conselho, roda o seu Codex instalado, só leitura, com o texto da ideia, e só quando você clica; a rádio lofi carrega o YouTube só se você puser rádios em `estado/lofi.json` e apertar o play; os monitores configurados fazem checagens HTTP ou executam comandos, que podem conectar aos destinos escolhidos.
- Os nomes que você listar em `config/nomes-ocultar.json` são mascarados em toda resposta.

## Ajustes opcionais

| Variável | Padrão | Uso |
| --- | --- | --- |
| PAINEL_HOME | sua home | pasta com .claude e .codex |
| PAINEL_HOMES | uma home | array JSON de homes, ou caminhos separados por ponto e vírgula |
| CLAUDE_CONFIG_DIR | .claude da home | pasta real de configuração do Claude, com projects/ |
| CODEX_HOME | .codex da home | pasta real do Codex, com sessions/ |
| PAINEL_ROOT | estado-local, se existir | outra pasta de estado |
| PAINEL_MONITORES | config/monitores.json | outro arquivo de monitores |
| PAINEL_PORT | 3257 | porta local, também `--port 3261` |
| PAINEL_SO_LEITURA | desligado | 1 desliga toda gravação no estado |

## Licença

MIT. Veja [LICENSE](LICENSE). As fontes incluídas (Geist, Inter, JetBrains Mono, Silkscreen) mantêm as próprias licenças OFL em `letras/`.
