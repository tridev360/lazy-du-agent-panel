# Kit do jeito de trabalhar com várias sessões do Claude Code

O que é: o método que usamos para rodar várias sessões do Claude Code (e o Codex) sem se atropelarem, em peças soltas.
Vem junto do painel de agentes, que mostra sessões, ajudantes e o que espera você.

Ordem sugerida (ou só o que quiser):
1. Painel primeiro: clone o repositório (git clone), rode npm start na pasta dele e siga o COLE-NO-SEU-CLAUDE.md da raiz. Ele lê as suas sessões e só grava na pasta dele e na pasta de estado, quando você responde um card ou muda o cronograma. `PAINEL_SO_LEITURA=1` desliga essas gravações.
2. `GUIA.md`: as 9 ideias do método, 5 minutos de leitura.
3. `COLE-NO-SEU-CLAUDE-METODO.md`: cole no seu Claude Code. Ele olha antes, mostra cada mudança e só aplica com o seu "sim". Use a mesma pasta de estado do painel.
4. `modelos/`: as peças prontas. `node testes/teste-kit.cjs` testa o gancho e as ferramentas. Nada se instala sozinho, nada vai para a rede, cada peça se desfaz.
