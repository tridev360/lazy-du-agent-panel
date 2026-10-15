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

## Privacidade

- A leitura das sessões é só de metadados: campos escalares conhecidos dos registros. Mensagens e saídas de ferramentas são descartadas; arquivos privados, atalhos, `.credentials.json` e `auth.json` não são abertos.
- Conversas, voz, música e o registro de pesquisa começam desligados e só ligam por escolha sua.
- Nada sai do seu computador, com duas exceções que você liga: Perguntar (usa seu Codex), em Decidir > Conselho, roda o seu Codex instalado, só leitura, com o texto da ideia, e só quando você clica; a rádio lofi carrega o YouTube só se você puser rádios em `estado/lofi.json` e apertar o play.
- Os nomes que você listar em `config/nomes-ocultar.json` são mascarados em toda resposta.

## Ajustes opcionais

| Variável | Padrão | Uso |
| --- | --- | --- |
| PAINEL_HOME | sua home | pasta com .claude e .codex |
| PAINEL_HOMES | uma home | array JSON de homes, ou caminhos separados por ponto e vírgula |
| CLAUDE_CONFIG_DIR | .claude da home | pasta real de configuração do Claude, com projects/ |
| CODEX_HOME | .codex da home | pasta real do Codex, com sessions/ |
| PAINEL_ROOT | estado-local, se existir | outra pasta de estado |
| PAINEL_PORT | 3257 | porta local, também `--port 3261` |
| PAINEL_SO_LEITURA | desligado | 1 desliga toda gravação no estado |

## Licença

MIT. Veja [LICENSE](LICENSE). As fontes incluídas (Geist, Inter, JetBrains Mono, Silkscreen) mantêm as próprias licenças OFL em `letras/`.
