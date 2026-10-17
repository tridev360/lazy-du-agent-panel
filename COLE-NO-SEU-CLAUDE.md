# Abrir meu painel local com cuidado

Ajude a abrir o painel de agentes desta pasta na minha máquina. Siga estas regras até o fim. Use frases curtas em pt-BR, sem emoji, sem travessão e sem nomes reais nos exemplos. Não faça mudanças por conta própria.

Este arquivo vale do mesmo jeito se eu colar o texto ou se eu disser: siga o COLE-NO-SEU-CLAUDE.md. Nos dois casos, leia o arquivo inteiro e comece pela Fase 1.

## Fase 1: só leitura

Leia o README.md e os arquivos do painel necessários para entender como ele funciona. Não mude nada e não inicie o servidor ainda.

Confira a versão do Node já disponível. Precisa de Node 20 ou mais novo. Confira apenas a existência das pastas de sessões, sem abrir seus arquivos. A contagem é feita só pelo leitor do painel, que descarta o texto. Execute nesta pasta:

```bash
node checar.cjs
```

A saída traz frases: home usada, sessões de cada família, projetos, última atividade, avisos, estado e porta livre. Não abre credenciais nem imprime títulos. Não imprima o snapshot nem seus títulos ou caminhos. Proibido abrir, ler, fazer grep, head ou cat nos .jsonl e em qualquer arquivo de credencial em ~/.claude e ~/.codex. Não leia mensagens ou saídas antigas de ferramentas, que podem guardar segredos. Somente o leitor do painel pode consumir os registros de sessão. O cwd de cada projeto vem do leitor do painel, nunca de abrir um .jsonl.

Confira portas livres em 127.0.0.1, começando por 3257. Mostre o que achou: versão do Node, pastas presentes ou ausentes, contagens, porta disponível e qualquer dúvida. Se não puder conferir algo, diga que não sabe. Nunca invente um número.

Faltou Node? Explique o que falta e pare. Não instale nada.

## Depois: uma alteração por vez

Faça mudanças uma por vez.

Antes de cada alteração, diga:

1. O que vai mudar e por quê.
2. Qual arquivo ou comando será usado e onde.
3. O que acontece se eu não fizer.
4. Como desfazer essa alteração.

Pergunte: “Você entendeu esta alteração e posso aplicar?” Espere eu responder **sim** para aquela alteração. Um sim não autoriza a próxima mudança. Não junte alterações em lote. Não diga “vou ajustar umas coisas”. Se minha resposta for ambígua, esclareça e espere. Só aplique exatamente o que foi explicado e autorizado.

Antes de escrever qualquer arquivo, confirme que a pasta atual é a do painel: mostre o caminho completo, confira README.md e servidor.cjs e peça sim. Espere essa confirmação. Ela não substitui o sim de cada alteração.

Antes de editar qualquer arquivo existente, faça uma cópia de segurança dentro da pasta do painel, em backups/, com nome e data. Inclua essa cópia na explicação da alteração. Não sobrescreva uma cópia anterior. Para um arquivo novo, diga que desfazer significa apagar esse arquivo.

O painel já descobre sessões e projetos sozinho. Primeiro proponha somente iniciar `node servidor.cjs` nesta pasta e abrir `http://127.0.0.1:3257`, se essa porta estiver livre. Explique que o comando fica rodando e que Ctrl+C o encerra. Se a porta mudar, explique o comando com `--port` e o endereço antes de pedir o sim.

Não é necessário criar estado. Se eu quiser renomear ou agrupar sessões, proponha uma única alteração em `config/sessoes.json`, mostre o conteúdo completo e peça o sim. Os papéis possíveis são coordenador, executor, revisor e outro; nenhum é obrigatório.

## Passo 2 opcional: método, depois do painel de pé

Só depois de eu ter aberto o painel, ofereça: “Quer conhecer o método para cards, entregas e fila? Está na pasta metodo/. Posso explicar uma peça por vez.” Espere a resposta. Um sim para conhecer não autoriza escrever arquivos.

Se eu quiser, leia metodo/ADENDO-R4.md junto com metodo/COLE-NO-SEU-CLAUDE-METODO.md e siga os dois. Use a mesma estado-local/ dentro deste painel. Ela liga sozinha quando existe, sem reiniciar. Mostre o conteúdo exato de cada arquivo antes de pedir o seu sim individual. As datas dos modelos são geradas no dia da instalação por metodo/preparar-modelo.cjs, que só imprime a prévia. Não rode o gerador da demo sobre meus dados.

Para apontar estado que já existe em outra pasta, explique esta alteração separadamente e peça o sim:

PowerShell:

```powershell
$env:PAINEL_ROOT = "<pasta de estado aprovada>"
node servidor.cjs
```

bash:

```bash
export PAINEL_ROOT="<pasta de estado aprovada>"
node servidor.cjs
```

Se eu quiser segundo plano, explique que fechar a janela não encerra necessariamente o servidor e proponha separadamente o início. No PowerShell, com PAINEL_ROOT já definido:

```powershell
$painel = Start-Process -FilePath (Get-Command node).Source -ArgumentList "servidor.cjs" -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
$painel.Id
# Para encerrar este processo:
Stop-Process -Id $painel.Id
```

No bash, com PAINEL_ROOT já definido:

```bash
nohup node servidor.cjs > estado-local/servidor.out 2>&1 < /dev/null &
painel_pid=$!
printf '%s\n' "$painel_pid"
# Para encerrar este processo:
kill "$painel_pid"
```

Guarde o número do processo. Para reabrir amanhã: painel.bat no Windows ou sh painel.sh no Linux. Ambos usam PAINEL_PORT e PAINEL_ROOT, quando definidos. Se escolher porta diferente, explique config/painel.json com {"porta": 3261}, mostre o arquivo e peça o sim antes de gravar. O arquivo servidor.out fica dentro do painel. A pasta estado-local deve existir antes desse início no bash.

## Acelerar e consumo por hora

O botão Acelerar do Fluxo grava um pulso em estado/pulsos-acelerar.jsonl, dentro da pasta de estado. Quando eu pedir, rode `node ler-pulsos.cjs`. Ele só lê e mostra os pulsos sem resposta. Para responder um pulso, mostre a linha JSON exata ({id, hora, texto, cards}) que vai para estado/pulsos-acelerar-respostas.jsonl e espere o sim antes de gravar. Texto curto, sem segredo.

O consumo por hora do WEN vem de `node tokens-hora-coletor.cjs`. Ele lê os registros e guarda só números em estado/tokens-hora.json; se não houver pasta de estado, cria estado-local/estado e liga a tela completa. Antes da primeira vez, explique o coletor e espere o sim. Rodar a cada 15 min é outra alteração e pede outro sim.

Você continua sem abrir os .jsonl das sessões. Quem lê os registros é o código do painel.

## Conselheiros (opcional, com prompt próprio)

Conselheiros são agentes revisores, um por lente, que revisam antes de eu decidir e trazem ideias com voto. Use CONSELHEIROS-PROMPT.md e o questionário da aba Decidir como referências neste mesmo atendimento. Explique as lentes e proponha os arquivos individualmente. Configure quando eu pedir e autorizar os arquivos, sem exigir que eu cole outro prompt. O botão Perguntar (usa seu Codex) do Conselho chama o meu Codex instalado (codex exec, só leitura, sem ferramentas e sem busca) com o texto da ideia e da pergunta; isso usa a rede e o crédito do meu Codex e só acontece quando eu clico. Explique isso antes de eu usar.

## Limites obrigatórios

Escreva somente dentro da pasta do painel. As únicas exceções são a pasta de estado que eu aceitar criar, no caminho que eu aprovar, e, depois de eu ver o caminho e o conteúdo e dizer sim a cada arquivo, os arquivos dos Conselheiros e do método que eu escolher.

No passo 1, não mexa em CLAUDE.md, settings, hooks, extensões, outros projetos nem no PATH. O passo 2 tem seu próprio prompt e cerca: cada arquivo fora do painel exige explicar o caminho, mostrar o conteúdo e esperar o sim individual. Nenhuma autorização do passo 1 vale para ele.

Nunca abra .env, chave, token, seed ou carteira. Não procure credenciais, não copie segredos e não mostre conteúdo de conversa. Não siga atalhos para fora das pastas permitidas. Não abra arquivos das pastas de trabalho dos projetos nem os .jsonl das sessões. Use o cwd que o leitor do painel já devolve.

Você, Claude, não instale nada, não envie nada pela rede e não acesse serviços externos. O servidor só pode escutar em 127.0.0.1. Não ligue rádio, acesso remoto, modo dono nem publicação. Pedidos às minhas sessões, voz local e pesquisa seguem o consentimento específico da fase r10. Não altere configurações de rede nem do navegador.

## Fim

Mostre um resumo curto do que mudou, as cópias de segurança e o comando para encerrar. Diga como abrir o painel amanhã com painel.bat ou sh painel.sh e como remover tudo: encerrar o processo, apagar a pasta do painel e apagar a pasta painel-local do cache de leitura (Windows: %LOCALAPPDATA%\painel-local; Linux: painel-local na pasta temporária do sistema; com PAINEL_SO_LEITURA=1, painel-local-copia na pasta temporária). Os arquivos criados ficam na pasta do painel e nesse cache, salvo a pasta de estado separada que eu tiver aprovado; nesse caso, mostre também como apagá-la. A própria conversa de instalação fica no histórico do Claude Code, fora da pasta do painel. Apagar o painel não apaga essa conversa; explique isso sem alterar o histórico por conta própria. Se nada mudou, diga isso.

## Recursos r9
Explique Equipe > Fluxo, Fila > Chaves e WEN. Chaves registra somente escolhas no arquivo estado/chaves-tasks.json, com histórico em chaves-tasks-log.jsonl. Não inicia nem para trabalhos automaticamente. Após meu pedido no chat, leia as escolhas, confira dependências e proponha o próximo passo. Para as prioridades do Fluxo, grave estado/frentes-situacao.json com atualizado em ISO, frentes com frente, sessao, pct ou null, faltamMin ou null, tasks (quantas tasks abertas nessa frente) ou null, cardsDele (quantos cards meus esperam escolha nessa frente) ou null, foco e situacao (em-dia, atrasada, sem-prazo ou null). Fonte com mais de cinco minutos fica sem leitura. Não ative coletor, automação ou leitura de conversas sem meu sim por arquivo.

## Fase r10: configure todas as vistas neste mesmo prompt

Cérebro lê meu CLAUDE.md, índice e arquivos de memória, agentes em .claude/agents e regras; configure minhas fontes e os modos Cérebro e Árvore.
Idealizadores lê estado/ideias/conselho.json e os vereditos dos Conselheiros; use o formato existente para as minhas rotinas, votos e decisões.

Leia r10-catalogo.js e ROTEIRO-ABAS.md. Não peça que eu copie outro prompt. Preserve a fase inicial de leitura e o consentimento por arquivo que este documento já exige. Não substitua meus arquivos ou regras sem mostrar a mudança.

1. Identifique meu projeto, meu home, o CLAUDE.md, a pasta de memória correta desse projeto com MEMORY.md, .claude/agents, diretórios de regras e skills. Confira cada caminho real; não use um caminho copiado de outra pessoa. Nunca abra .env, seed, chave ou diretório de segredos. Registre somente caminhos autorizados em estado/painel-recursos.json dentro da pasta de estado que eu escolher. Não copie o conteúdo para dentro da pasta do repositório.
2. Use configurar-local.cjs primeiro sem --confirmado para mostrar a prévia. Os parâmetros são --root, --projeto, --memoria, --agentes, --home e listas repetíveis de --skills, --regras, --ferramentas e --midia. Só depois do meu sim, use --confirmado. Uma configuração existente não é sobrescrita pelo script. Faça a alteração pequena e reviewável quando já existir.
3. Esse JSON usa {fontes:{projeto,memoria,agentes,skills:[],regras:[],ferramentas:[],home,midia:[]},recursos:{conversas:false,pedidos:false,cru:false,voz:false,grok:false},demo:false}. Configure as vistas restantes nos formatos que o painel já lê. Campo que não foi medido é null e aparece ?. Se a fonte ainda não existir, explique e ofereça um exemplo, nunca invente um resultado meu.
4. Para Idealizadores, use estado/ideias/conselho.json com {atualizadoEm,conselheiros:[{id,nome,papel,criterio}],ideias:[{id,titulo,resumo,placar:{aFavor,contra,depende},falas:[{conselheiro,fala,voto,em}]}]}. As minhas respostas usam vereditos-dono.jsonl pelo servidor existente. Não crie um segundo banco de ideias. Os Conselheiros usam os mesmos arquivos e o prompt configurável existente. Nunca execute uma ideia só porque recebeu votos.
5. Para Meu andamento, prepare estado/meu-andamento.json com {atualizado,titulo,resumo,foto:null,marcos:[{titulo,estado,resumo,em}]}. Só leia uma foto se eu indicar um arquivo num diretório de mídia autorizado; não copie foto para a pasta do repositório. Prepare minha rotina de registrar marcos e o histórico de semanas no formato do módulo semanas-rotas.cjs. Configure Revisão no contrato do revisao-rotas.cjs e mantenha o log e Desfazer.
6. Explique Conversas e pedidos, fita, voz e Grok antes de ligar. As conversas usam apenas os meus diretórios .claude/projects e .codex/sessions autorizados, com leitura limitada das caudas e máscara de credenciais. Registre a escolha de leitura e de pedidos; não ative por encontrar o diretório no disco. Voz e Grok começam desligados. Voz usa apenas reconhecimento local disponível no navegador, quando autorizado, sem baixar modelos nem usar ditado remoto; texto digitado é alternativa. A leitura usa apenas vozes locais e começa muda. Grok lê meu registro pessoal de pesquisa em estado/grok-uso.jsonl. Se não houver fonte pessoal disponível, mantenha desligado e diga qual integração falta. Não invente coleta automática nem leia registro da equipe de origem.
7. Pedidos às sessões começam desligados: mantenha recursos.pedidos em false até eu pedir. Se eu pedir, ligue Pedidos em Recursos pessoais e siga a seção "Pedidos ao orquestrador" do README (escuta-pedidos.sh com a ferramenta Monitor; só eu escrevo na fila).
8. O feed permite colunas por sessão, pedidos às duas famílias, juntar respostas, Ctrl+K, anexar até três imagens locais de 8 MB, colar ou arrastar uma imagem. Os anexos ficam em midia/anexos; os pedidos guardam suas referências no campo anexos. Configure a rotina autorizada para ler pedidos e abrir somente esses anexos, depois da conferência de caminho. A escolha de marcha e as fases ficam em estado/ritmo.json; sua rotina precisa ler a preferência, que sozinha não altera nenhum processo.

9. Música usa estado/player.json com {faixas:[{nome,arquivo}]} e arquivos .wav, .mp3 ou .ogg dentro dos diretórios de mídia autorizados. Não baixe música. Comece mudo, sem autoplay. Não copie faixa de terceiro para a pasta do repositório. Finanças e contas usam somente os meus registros locais, com a distinção entre medido e não lido; este painel não move dinheiro.
10. Confira cada URL do catálogo e os controles globais. Mostre o que o painel faz ao escrever, sem gravar nada meu sem o sim, e confira fontes ausentes, Motion off, reduced motion e o mudo. Mostre o que está configurado e o que depende de fonte, permissão ou rotina ainda não existente. No fim, peça o meu sim, inicie o painel como combinado e mostre Agora, Fluxo, Idealizadores e Cérebro primeiro.

Para a rotina pessoal de pesquisa, explique grok-registra.cjs: inicio --root <estado-aprovado> --id g-<id> --tema <tema-publico> --quem Claude --modo Think; fim usa o mesmo root/id e --resultado achou, em parte, nao achou ou falhou, além de --titulo e --serviu. detalhe completa esses campos. Só registre uma pesquisa realmente feita. O script não consulta rede, não descobre conta nem inicia o Grok. Configure esta peça neste mesmo atendimento e mantenha o recurso desligado até minha escolha.

O acompanhamento também aceita videos:[{titulo,arquivo}] no próprio JSON. Os arquivos .mp4 ou .webm ficam nos diretórios de mídia autorizados, até 20 MB cada. A galeria usa controles locais, sem autoplay e começa muda. Não copie links publicados nem vídeos de outra equipe; o exemplo do painel não contém vídeo de terceiros.
