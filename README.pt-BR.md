# Lazy Du Agent Panel 2.1.1

## O que o painel resolve

- Pegou trabalho demais e se perdeu? Veja as sessões do Claude Code e do Codex deste computador lado a lado, num lugar só.
- Não lembra quem começou o quê? A Equipe mostra quem começou cada sessão e os ajudantes de cada uma.
- Perdeu o fio de um agente? A linha do tempo mostra as ferramentas que ele usou e a última atividade.
- Esqueceu uma sessão aberta? A Equipe separa as sessões com atividade recente das que estão em pausa ou concluídas.
- Quer saber como está tudo agora? O WEN abre o resumo atual em seis linhas.
- Gastou mais do que achava? O Consumo mostra os tokens da semana e de hoje e quanto do crédito já foi usado.
- Tudo fica no seu computador. Sem conta, sem chave, e ele lê só metadados, nunca as suas conversas.

Acompanhe suas sessões do Claude Code e Codex em um painel local. Comece pequeno e troque de modo quando precisar de mais detalhes.

![Time fictício maior no computador](docs/v2.1/home-pt-1440.png)
![Time fictício maior no celular](docs/v2.1/home-pt-390.png)

[English](README.md) · [Lazy Du](https://lazy-du.com)

## Abrir em menos de um minuto

Precisa de Node.js 20 ou mais recente. Baixe e extraia este repositório. Na pasta extraída:

~~~sh
node src/open.cjs
~~~

O atalho abre o navegador em http://127.0.0.1:3251. No Windows, você pode abrir panel.bat com dois cliques. No Mac, rode bash panel.command ou use o comando acima.

Escolha o tamanho do projeto e depois o que quer acompanhar. Um clique por escolha. Pode pular. Em Mais → Preferências, você troca o modo, o idioma e as opções de leitura quando quiser.

Sem conta, chave de API, instalação de pacote ou configuração do projeto. Claude Code ou Codex neste computador fornece os metadados reais. Se o perfil estiver vazio, o painel abre um exemplo fictício, identificado, depois de terminar a leitura. Em Mais → Exemplo, escolha uma pessoa ou um time maior.

Para ver só o exemplo, sem ler sessões locais:

~~~sh
node src/open.cjs --demo
~~~

Tudo fica neste computador. Fechar painel no rodapé encerra um atalho que tenha o fechamento habilitado. Fechar apenas a aba deixa o servidor ligado. Ctrl+C encerra o servidor aberto pelo código.

## Se uma IA for rodar o comando

É um servidor local. Rode uma vez: o atalho mantém o servidor em segundo plano. Se a porta 3251 já responder com esta versão, abra só http://127.0.0.1:3251. Pode fechar o terminal; use Fechar painel no rodapé para encerrar o servidor. Para mensagens em português, acrescente --lang pt; espanhol, --lang es.

Para atualizar, feche o painel no rodapé, rode git pull na pasta do painel e abra o painel de novo.

## O que sai do seu computador

Metadados e preferências ficam locais. Mensagens do autor vêm desligadas e só buscam o arquivo público quando você permite. Música e links externos só abrem no clique. Feedback abre uma issue com texto fixo; você escolhe se envia no GitHub. Ver se tem versão nova consulta somente o package.json público do repositório oficial, no clique, sem enviar metadados. Nenhuma instalação ou atualização é automática. A página bloqueia conexões externas fora desses recursos permitidos.

Para desligar mensagens do autor, checagem de versão, música, feedback e links externos:

~~~sh
node src/open.cjs --offline --lang pt
~~~

Se já houver um painel online nessa porta, feche pelo rodapé antes de abrir no modo offline.

## Três modos

| Modo | Resumo inicial |
| --- | --- |
| BEGINNER | Até dois agentes, com seu próximo passo primeiro |
| EXPLORER | Até seis agentes, para um time pequeno |
| PRO | O projeto inteiro e os agentes disponíveis |

Todos mantêm acesso a Equipe, com os vínculos de origem conhecidos, Sessões, Consumo, Fila e Alimente sua IA. O modo muda o resumo inicial. Não cria, encerra nem envia ordens a agentes.

A abertura mostra sessões com atividade recente e seis linhas curtas. Atividade recente não comprova processo rodando. Conversa encerrada não é tarefa entregue. Tarefa concluída precisa de data registrada; exemplos fictícios identificam o progresso simulado. Crédito ausente aparece como Não disponível. Porcentagens dizem se são usadas ou restantes. Tokens e crédito são unidades diferentes.

Equipe mostra você no topo e o Claude Code e o Codex lado a lado, com cada sessão e os ajudantes que os metadados ligam a ela. Os fios levam pontinhos no sentido de quem mandou, na cor de quem mandou; fio parado fica sem pontos, e Movimento desligado ou movimento reduzido não mostram pontos. Clique num fio para ler quem trabalha com quem, em palavras simples.

Sessões mostra uma coluna por sessão só com metadados: estado, ação atual, ferramentas, modelo, tokens e projeto. Não lê nem manda mensagens. Consumo começa com uma linha de resumo, depois o total da semana, os copos, a estimativa lúdica de água e os anéis de crédito; Como calculamos explica cada número.

WEN abre o resumo atual. AUTOMATIZAR prepara um plano para copiar no chat da sua IA. Copiar o plano não inicia um agente. ACELERAR traz uma lista reutilizável, marchas selecionáveis, fases em ordem e esperas que você marca. Marcar uma fase ou escolher uma marcha só salva neste painel: não publica código, não muda sua conta de IA e não avisa seus agentes. Os minutos são esperas informadas por você, sem alegar ganho de velocidade medido.

## Ensinar minha IA e o sino

Ensinar minha IA começa com um botão: Copiar e colar no Claude Code. Uso o Codex troca o pedido copiado para o Codex. Cole numa conversa que roda no seu computador, no app ou no terminal. O painel só copia um pedido; sua IA salva as regras se você permitir a edição do arquivo. Uma conversa na nuvem deve parar se não alcançar sua pasta pessoal. As regras valem para todos os projetos por ~/.claude/CLAUDE.md ou ~/.codex/AGENTS.md. Outras opções fica fechado e inclui a escolha só para um projeto e quem faz o quê.

### Regras copiadas, texto exato (Claude Code, todos os projetos)

~~~text
Salve as regras abaixo no meu ~/.claude/CLAUDE.md global, para valerem em todos os meus projetos. Coloque numa seção que começa com o título "## Lazy Du Agent Panel". Se essa seção já existir, troque só ela: a linha do título e as linhas que começam com "- " logo abaixo. Crie o arquivo se ele não existir. Não apague nem mude mais nada. Depois confirme em 1 linha. Se daqui você não alcança a minha pasta pessoal (por exemplo, numa sessão na nuvem), diga isso em 1 linha e pare.

## Lazy Du Agent Panel: minhas regras de trabalho (para tirar, apague esta seção)
- Coordenar: a IA onde eu começo o trabalho coordena e divide em tarefas; a outra IA confere o plano.
- Escrever código: Claude Code e Codex em paralelo nas tarefas independentes (tarefas que mexem nos mesmos arquivos vão uma depois da outra), com o modelo mais forte e esforço alto.
- Revisar: a outra IA revisa cada mudança; ninguém revisa o próprio trabalho.
- Analisar e medir: um modelo menor com esforço baixo.
- Subir para produção: só depois do meu ok explícito, pela IA que roda as checagens mais seguras deste projeto.
- Escrever texto público: uma IA escreve, a outra revisa e eu aprovo antes de sair.
- Nos projetos que têm uma pasta tasks/, mantenha ali um arquivo Markdown por tarefa.
- Fases: new, open, doing, ready, review, released, done. Quando a tarefa terminar, use phase: done e acrescente completed_at: com a data e a hora em ISO.
- Perguntas que precisam da minha decisão vão em tasks/decisions.md como títulos numerados, como ## 1. Qual música combina com o menu? Acrescente DONE quando eu responder.
~~~


O sino lista as novidades da versão e as dicas feitas neste computador, o que espera você e as decisões pedidas pelas suas IAs. As marcas de lido, e as telas que você abriu (usadas só para sugerir um recurso que você ainda não usou, no máximo um por dia), ficam neste navegador. As mensagens do autor vêm desligadas. Quando você liga, ou aperta Ver mensagens do autor, o servidor local baixa https://raw.githubusercontent.com/tridev360/lazy-du-agent-panel/main/news.json com um GET simples: sem identificador, sem cookie, com limite de 5 segundos e no máximo uma vez por dia quando ligado. O GitHub vê o seu IP como em qualquer download. Mandar feedback abre uma issue nova no GitHub no seu navegador; nada é enviado até você enviar por lá.

## Segurança

O leitor projeta uma lista fixa de metadados de ~/.claude/projects e ~/.codex/sessions: datas, identificadores de sessão resumidos por hash, pais conhecidos, modelo, esforço, nome do projeto, nomes e contagens de ferramentas, contadores de tokens e janelas de crédito disponíveis. Nunca decodifica corpos de conversa nem argumentos de ferramentas. Não lê .env, auth.json nem arquivos de credenciais.

O painel salva as escolhas do acelerador em ~/.lazy-du-panel/ e o cache de metadados projetados em .panel-cache/ dentro da pasta do painel. As escolhas do navegador ficam no localStorage. Ligar uma pasta de tarefas permite ler os títulos e campos Markdown documentados abaixo. Ele nunca altera seus arquivos de instrução: Ensinar minha IA copia um pedido, e sua IA pode salvar as regras depois que você permitir a edição do arquivo.

O servidor escuta em 127.0.0.1:3251 e confere Host e Origin; a página usa uma Content Security Policy. Os dois destinos públicos de download do servidor são news.json do autor (desligado até você ligar ou clicar) e package.json (conferência de versão no clique). Música opcional e links externos só abrem no clique. Nenhum metadado de sessão sai. Use --offline para desligar esses recursos.

Para manter esta versão, use uma cópia com tag ou rode npx github:tridev360/lazy-du-agent-panel#v2.1.1 depois que essa tag for publicada. Você escolhe quando atualizar.

## Privacidade

O servidor escuta só no localhost. Lê metadados permitidos de .codex/sessions e .claude/projects no seu perfil: identificadores, origem conhecida, datas, modelo, esforço, nomes de ferramentas e contadores de tokens. Projeta esses campos sem decodificar corpos de conversas ou argumentos de ferramentas. Identificadores de sessão são resumidos por hash. O nome da pasta do projeto pode aparecer; o caminho completo fica privado. Sem telemetria nem credenciais: esta versão não manda dado de uso.

Consumo e preferências ficam locais. O cache guarda metadados projetados; esta versão invalida o cache anterior de conversas. As preferências do acelerador ficam em .lazy-du-panel/acceleration.json no seu perfil. Arquivo corrompido mostra erro sem ser sobrescrito.

Uma pasta opcional de tarefas pode ser ligada em Ligar minha pasta de tarefas, por exemplo na Fila. O painel lê arquivos .md que começam com um cabeçalho curto:

~~~md
---
phase: doing
---
# Desenhar o menu
~~~

Fases: new, open, doing, ready, review, released e done, ou nova, aberta, andando, pronta, revisão, liberado, feito e no ar. Campos opcionais do cabeçalho: title, owner, executor (claude ou codex), project, deadline, started_at e completed_at (datas ISO). Tarefa concluída só conta como entrega com completed_at. Arquivo sem cabeçalho fica de fora. Um decisions.md opcional lista uma decisão pendente por título numerado, como ## 1. Qual música combina com o menu? Títulos marcados com DONE ficam de fora. Não depende de serviço externo de estado.

Inglês, português e espanhol disponíveis. Respeita movimento desligado e movimento reduzido. A música opcional só conecta ao provedor depois do clique.

## Conferir

~~~sh
node --test --test-concurrency=1 test/*.test.cjs
~~~

Para conferir no navegador, use Playwright Core e Chromium já instalados em um executor isolado:

~~~sh
node tools/validate-public.cjs --playwright /caminho/playwright-core --browser /caminho/chromium --out /caminho/saida
~~~

OUTPUT_DIR também escolhe a pasta. PLAYWRIGHT_MODULE e CHROMIUM_PATH substituem os argumentos. O script grava tests.txt, validation.json e fotos fictícias em 1440, 768, 390 e 375 pixels. Usa perfis temporários vazios e metadados sintéticos, nunca suas sessões reais. Teste vermelho mantém a saída de erro, mesmo quando as fotos foram produzidas para revisão.

A build portátil do Windows é separada do uso pelo código. Precisa de Node 24 na máquina de build e postject em pasta isolada. Veja tools/build-windows.cjs. Este código não inclui executável; precisa de Node para rodar.

Autor: github.com/tridev360 · X @hallstrid

Licença MIT.
