// metodo-kit: gancho PreToolUse que barra comando perigoso ANTES de ele rodar.
//
// Como funciona, em 4 frases:
// 1. O Claude Code chama este arquivo antes de cada comando do Bash ou do PowerShell (o settings.json diz isso).
// 2. Ele manda pela entrada padrão um JSON com tool_name, tool_input.command, cwd e, quando quem chama é um
//    ajudante (subagente), o campo agent_id.
// 3. Saída 0 = deixa rodar. Saída 2 = barra; o texto que vai para o stderr volta para o Claude, que lê o motivo
//    e muda o plano sozinho, sem abrir janela para você.
// 4. É um cinto de segurança, não um cofre: pega o erro honesto e repetido, não quem quer burlar.
//
// Regra do método: erro que se repetiu 2 vezes vira trava aqui, não vira mais uma linha de memória.
// Teste sem ligar nada:  echo '{"tool_name":"Bash","tool_input":{"command":"git add -A"}}' | node metodo-kit-barra-comando.mjs
// (deve sair com código 2 e imprimir BARRADO).

import { readFileSync } from 'node:fs'; // só lê a entrada padrão; nada de rede, nada de escrita

// Regras para todo mundo. Cada uma tem o padrão e a frase que volta para o Claude, sempre com o próximo passo.
const REGRAS = [
  {
    // "git add -A", "git add --all" e "git add ." levam arquivo que ninguém olhou (rascunho, saída de teste, segredo).
    padrao: /\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/,
    motivo: 'git add -A ou git add . leva arquivo que ninguém olhou. Use git add <arquivo1> <arquivo2>.',
  },
  {
    // "git commit -a" ou "-am" faz o mesmo pelo outro lado. "--amend" (dois traços) passa.
    padrao: /\bgit\s+commit\b[^|;&]*\s-(?!-)[a-zA-Z]*a/,
    motivo: 'git commit -a leva tudo que mudou. Faça git add <arquivos> e depois git commit.',
  },
  {
    // Push forçado apaga o trabalho de outra pessoa ou de outra sessão no remoto.
    padrao: /\bgit\s+push\b[^|;&]*\s(--force|-f)(\s|$)/,
    motivo: 'push forçado reescreve o remoto. Se precisa mesmo, peça ao dono por card.',
  },
  {
    // Pipe ou "||" entre o teste e o commit: o grep (ou o "|| true") sai com 0 mesmo com teste vermelho,
    // e o commit entra quebrado. O certo: teste > saida.txt 2>&1 && git add ... && git commit ...
    padrao: /\b(vitest|jest|mocha|pytest|npm\s+(run\s+)?test|pnpm\s+test|yarn\s+test|go\s+test|cargo\s+test)\b[^;]*\|[^;]*\bgit\s+commit\b/,
    motivo: 'pipe ou || entre o teste e o commit deixa passar teste vermelho. Rode: teste > saida.txt 2>&1 && git add <arquivos> && git commit, e depois confira "passed" no saida.txt.',
  },
  {
    // Arquivo de segredo. O .env.example (modelo sem valor) passa.
    padrao: /(^|[\s"'=/\\])\.env(?!\.(example|sample)\b)(\.[\w-]+)?(?=$|[\s"'>|;)])|\b(id_rsa|id_ed25519)\b|\b[\w-]+\.pem\b/,
    motivo: 'comando toca arquivo de segredo (.env, chave ssh, .pem). Não abra segredo; se precisa do nome de uma variável, pergunte ao dono.',
  },
  {
    // rm -rf na raiz, na home, na pasta atual ou em tudo (*). "rm -rf dist" ou "rm -rf ./dist" passam.
    padrao: /\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(\/|~|\$HOME|\*|\.\.?)\/?(\s|$)/,
    motivo: 'rm -rf em pasta grande demais (raiz, home, pasta atual ou *). Apague só a pasta certa, pelo nome.',
  },
];

// Regras só para ajudante (subagente): ele nasce para uma tarefa e não sobe nada.
// Troque pelos comandos de subir do seu projeto.
const SO_SESSAO = [
  /\bnpm\s+run\s+deploy\b/,
  /\bvercel\b[^|;&]*--prod\b/,
  /\bfly\s+deploy\b/,
  /\bgit\s+push\b[^|;&]*\b(main|master)\b/,
];

let entrada;
try {
  entrada = JSON.parse(readFileSync(0, 'utf8')); // lê o JSON que o Claude Code mandou
} catch {
  process.exit(0); // entrada quebrada: passa calado (um gancho com defeito nunca pode travar a sessão)
}

if (!['Bash', 'PowerShell'].includes(entrada?.tool_name)) process.exit(0); // só olha comandos de terminal
const comando = String(entrada?.tool_input?.command ?? '');

for (const regra of REGRAS) {
  if (regra.padrao.test(comando)) barrar(regra.motivo);
}

// agent_id vem quando quem chama é um ajudante. Se a sua versão do Claude Code não mandar esse campo,
// esta parte só não dispara (a regra continua escrita no CLAUDE.md).
if (entrada.agent_id && SO_SESSAO.some(p => p.test(comando))) {
  barrar('ajudante não sobe nem faz push no main. Devolva o pedido para a sessão que chamou.');
}

// Quer exigir card com prova antes de subir? Chame aqui a ferramenta de prova
// (node <pasta-de-estado>/ferramentas/prova-card.mjs conferir <id> "<opção que autoriza>") e barre se ela sair com 1.

process.exit(0); // nada casou: deixa rodar

function barrar(motivo) {
  process.stderr.write('BARRADO pelo gancho do método: ' + motivo + '\n'); // o Claude lê esta linha
  process.exit(2); // 2 = barra o comando
}
