// Teste do kit: o gancho e as 3 ferramentas, com dados inventados em pasta temporária.
// Rode da pasta do kit:  node testes/teste-kit.cjs
// Node 18 ou mais novo, sem dependência, sem rede. Não grava nada fora da pasta temporária, que apaga no fim.
// Saída 0 e "Tests N passed, 0 failed" = verde.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const KIT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const GANCHO = path.join(KIT, 'modelos', '.claude', 'ganchos', 'metodo-kit-barra-comando.mjs');
const FERR = path.join(KIT, 'modelos', 'pasta-de-estado', 'ferramentas');
let ok = 0, falhou = 0;
function confere(nome, cond, extra = '') { if (cond) ok++; else { falhou++; console.log('FALHOU: ' + nome + (extra ? ' :: ' + extra : '')); } }
function roda(arq, args, opts = {}) { return spawnSync(process.execPath, [arq, ...args], { encoding: 'utf8', ...opts }); }

// 1. Gancho: cada comando e a saída esperada (2 = barra, 0 = deixa rodar)
const casos = [
  ['git add -A', 2], ['git add .', 2], ['git add --all', 2], ['git commit -a -m x', 2], ['git commit -am "x"', 2],
  ['git add src/a.ts tests/a.test.ts && git commit -F msg.txt', 0], ['git commit --amend --no-edit', 0],
  ['git push --force origin main', 2], ['git push -f', 2], ['git push origin minha-tarefa', 0],
  ['cat .env', 2], ['type .env.local', 2], ['cat .env.example', 0], ['cat ~/.ssh/id_rsa', 2],
  ['npx vitest run x | grep Tests && git commit -F m', 2], ['npm test || true && git commit -F m', 2],
  ['npx vitest run x > out.txt 2>&1 && git add a && git commit -F m', 0],
  ['rm -rf /', 2], ['rm -rf ~', 2], ['rm -rf .', 2], ['rm -rf *', 2], ['rm -rf dist', 0], ['rm -rf ./dist', 0], ['rm -fr /tmp/x', 0],
  ['ls -la', 0], ['git status', 0],
];
for (const [cmd, esperado] of casos) {
  const r = roda(GANCHO, [], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: cmd }, cwd: KIT }) });
  confere('gancho: ' + cmd + ' -> ' + esperado, r.status === esperado, 'saiu ' + r.status + ' ' + (r.stderr || '').trim());
  if (esperado === 2) confere('gancho explica: ' + cmd, /BARRADO/.test(r.stderr || ''));
}
const gancho = (entrada) => roda(GANCHO, [], { input: typeof entrada === 'string' ? entrada : JSON.stringify(entrada) }).status;
confere('gancho: PowerShell Get-Content .env', gancho({ tool_name: 'PowerShell', tool_input: { command: 'Get-Content .env' } }) === 2);
confere('gancho: ajudante não sobe', gancho({ tool_name: 'Bash', agent_id: 'a1', tool_input: { command: 'npm run deploy' } }) === 2);
confere('gancho: sessão pode rodar deploy (a regra do card fica no CLAUDE.md)', gancho({ tool_name: 'Bash', tool_input: { command: 'npm run deploy' } }) === 0);
confere('gancho: ajudante não faz push no main', gancho({ tool_name: 'Bash', agent_id: 'a1', tool_input: { command: 'git push origin main' } }) === 2);
confere('gancho: Read passa', gancho({ tool_name: 'Read', tool_input: { file_path: '.env' } }) === 0);
confere('gancho: entrada quebrada passa calada', gancho('não é json') === 0);

// 2. Prova de card: conversa inventada no formato do Claude Code
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-'));
const raiz = path.join(tmp, 'estado-raiz'), proj = path.join(tmp, 'projeto');
const cardsDir = path.join(raiz, 'estado', 'cards');
fs.mkdirSync(cardsDir, { recursive: true }); fs.mkdirSync(proj);
const agora = Date.now(), iso = m => new Date(agora + m * 60000).toISOString();
const card = (id, extra = {}) => fs.writeFileSync(path.join(cardsDir, id + '.json'), JSON.stringify({ id, sessao: 'backend', criado: iso(-10), tipo: 'subida', perigoso: true, pergunta: 'Subo a versao 2 da busca?', opcoes: [{ label: 'Subir agora', recomendada: true }, { label: 'Esperar' }], ...extra }, null, 2));
card('c1'); card('c2'); card('c3', { respondido: 'Subir agora (escrito a mao)' }); card('c4', { pergunta: 'Pergunta que ninguem viu?' });
card('c5', { criado: iso(-1), pergunta: 'Subo a versao 3?' }); card('ce', { pergunta: 'Subo a versao 4?' });
const conv = crypto.randomUUID();
let seq = 0;
const tela = (pergunta, resposta, min) => {
  const a = 'a-' + (++seq), u = 'u-' + seq, tu = 'tu' + seq;
  return [
    { type: 'assistant', uuid: a, isSidechain: false, sessionId: conv, timestamp: iso(min), message: { content: [{ type: 'tool_use', id: tu, name: 'AskUserQuestion', input: { questions: [{ question: pergunta }] } }] } },
    { type: 'user', uuid: u, isSidechain: false, sessionId: conv, timestamp: iso(min), sourceToolAssistantUUID: a, toolUseResult: { answers: { [pergunta]: resposta } }, message: { content: [{ type: 'tool_result', tool_use_id: tu }] } },
  ];
};
const linhas = [...tela('Subo a versao 2 da busca?', 'Subir agora', -4), ...tela('Subo a versao 3?', 'Subir agora', -6), ...tela('Subo a versao 4?', 'Esperar', -3)];
fs.writeFileSync(path.join(proj, conv + '.jsonl'), linhas.map(l => JSON.stringify(l)).join('\n') + '\n');
const PROVA = path.join(FERR, 'prova-card.mjs');
const env = { ...process.env, ESTADO_RAIZ: raiz, PROVA_PROJETO: proj };
const prova = (...args) => roda(PROVA, args, { env });
let r = prova('responder', 'c1', 'Subir agora');
confere('prova: responder c1', r.status === 0, r.stdout + r.stderr);
const c1 = JSON.parse(fs.readFileSync(path.join(cardsDir, 'c1.json'), 'utf8'));
confere('prova: card ganhou prova', c1.prova && c1.prova.uuid === 'u-1' && /Subir agora/.test(c1.respondido));
r = prova('conferir', 'c1', 'Subir agora'); confere('prova: conferir c1 com a opção que autoriza', r.status === 0 && /PROVA OK/.test(r.stdout), r.stdout);
r = prova('conferir', 'c1'); confere('prova: conferir sem a opção que autoriza sai 1', r.status === 1 && /uso/.test(r.stdout), r.stdout);
r = prova('conferir', 'c1', 'Esperar'); confere('prova: conferir c1 pedindo Esperar sai 1', r.status === 1, r.stdout);
r = prova('responder', 'ce', 'Esperar'); confere('prova: responder Esperar grava a prova', r.status === 0, r.stdout);
r = prova('conferir', 'ce'); confere('prova: card respondido Esperar, conferir sem opção sai 1', r.status === 1, r.stdout);
r = prova('conferir', 'ce', 'Subir agora'); confere('prova: card respondido Esperar não autoriza subir', r.status === 1, r.stdout);
r = prova('conferir', 'c2', 'Subir agora'); confere('prova: c2 sem resposta sai 1', r.status === 1, r.stdout);
r = prova('conferir', 'c3', 'Subir agora'); confere('prova: c3 escrito à mão sai 1', r.status === 1, r.stdout);
r = prova('responder', 'c4', 'Subir agora'); confere('prova: c4 sem tela de escolha não responde', r.status === 1, r.stdout);
r = prova('responder', 'c5', 'Subir agora'); confere('prova: c5 resposta mais velha que o card', r.status === 1, r.stdout);
r = prova('responder', 'c2', 'Opcao inventada'); confere('prova: opção fora do card', r.status === 1, r.stdout);
fs.writeFileSync(path.join(cardsDir, 'c1.json'), JSON.stringify({ ...c1, pergunta: 'Subo a versao 9?' }));
r = prova('conferir', 'c1', 'Subir agora'); confere('prova: pergunta trocada depois sai 1', r.status === 1, r.stdout);
fs.writeFileSync(path.join(cardsDir, 'c1.json'), JSON.stringify(c1));
r = prova('conferir', '../fora', 'Subir agora'); confere('prova: id com barra recusado', r.status === 1);
r = roda(PROVA, ['conferir', 'c1', 'Subir agora'], { env: { ...process.env, ESTADO_RAIZ: raiz, PROVA_PROJETO: path.join(tmp, 'outra-pasta') } });
confere('prova: de outra pasta sem PROVA_PROJETO certo, falha fechada', r.status === 1, r.stdout);

// 3. Entregas
const ENT = path.join(FERR, 'entregas.cjs');
const ARQ_ENT = path.join(raiz, 'estado', 'entregas.json');
fs.writeFileSync(ARQ_ENT, JSON.stringify({ atualizadoEm: iso(-120), entregas: [{ id: 'busca', projeto: 'App', nome: 'Busca', dono: 'backend', adianta: '', passos: [{ nome: 'Indice novo', peso: 3, feito: false }, { nome: 'Dono decide se sobe', peso: 0.2, feito: false, dependeDele: true, card: 'c1' }, { nome: 'Card escrito a mao', peso: 0.1, feito: false, dependeDele: true, card: 'c3' }] }] }));
const ent = (...args) => roda(ENT, args, { env });
r = ent('idade'); confere('entregas: idade velha sai 3', r.status === 3, r.stdout);
r = ent('feito', 'busca', 'indice'); confere('entregas: feito', r.status === 0, r.stdout + r.stderr);
r = ent('sincronizar'); confere('entregas: sincronizar', r.status === 0, r.stdout + r.stderr);
let ej = JSON.parse(fs.readFileSync(ARQ_ENT, 'utf8'));
confere('entregas: passos feitos', ej.entregas[0].passos.slice(0, 2).every(p => p.feito), JSON.stringify(ej.entregas[0].passos));
confere('entregas: card sem prova não fecha passo', ej.entregas[0].passos[2].feito === false, JSON.stringify(ej.entregas[0].passos));
r = ent('idade'); confere('entregas: idade fresca sai 0', r.status === 0, r.stdout);
r = ent('nova', 'login', 'App', 'Tela de login', 'frontend'); confere('entregas: nova', r.status === 0, r.stderr);
r = ent('passo', 'login', 'Teste que falha', '1'); confere('entregas: passo', r.status === 0, r.stderr);
r = ent('passo', 'login', 'Voce escolhe o layout', '?', 'voce', 'card=c2'); confere('entregas: passo do dono', r.status === 0, r.stderr);
ej = JSON.parse(fs.readFileSync(ARQ_ENT, 'utf8'));
const lg = ej.entregas.find(e => e.id === 'login');
confere('entregas: passo do dono gravado', lg && lg.passos[1].dependeDele === true && lg.passos[1].peso === null && lg.passos[1].card === 'c2', JSON.stringify(lg));
// erro dentro da trava: sai com o código certo e solta a trava (a próxima escrita não espera)
r = ent('feito', 'nao-existe', 'x'); confere('entregas: id inexistente sai 2', r.status === 2, r.stderr);
confere('entregas: erro solta a trava (id inexistente)', !fs.existsSync(ARQ_ENT + '.trava'));
r = ent('passo', 'login', 'Horas erradas', 'abc'); confere('entregas: horas inválidas sai 2', r.status === 2, r.stderr);
confere('entregas: erro solta a trava (horas inválidas)', !fs.existsSync(ARQ_ENT + '.trava'));
r = ent('feito', 'login', 'passo que nao existe'); confere('entregas: passo inexistente sai 2', r.status === 2, r.stderr);
const t0 = Date.now(); r = ent('adianta', 'login', 'Layout pode andar junto do teste');
confere('entregas: escrita logo depois de um erro passa sem esperar', r.status === 0 && Date.now() - t0 < 3000, (Date.now() - t0) + ' ms ' + r.stderr);
r = ent('lista'); confere('entregas: lista', r.status === 0 && /login/.test(r.stdout), r.stdout);

// 4. Rotina de 15 min
const ROT = path.join(FERR, 'rotina-volta.cjs');
fs.mkdirSync(path.join(raiz, 'tasks'));
fs.writeFileSync(path.join(raiz, 'tasks', 't1.md'), '---\nid: t1\ndono: backend\nestado: andando\n---\n# T1\n');
const velho = new Date(agora - 45 * 60000); fs.utimesSync(path.join(raiz, 'tasks', 't1.md'), velho, velho);
const VOLTAS = path.join(raiz, 'estado', 'rotina-voltas.jsonl');
r = roda(ROT, [], { env }); confere('rotina: mede sem gravar', r.status === 0 && /c2/.test(r.stdout) && !fs.existsSync(VOLTAS), r.stdout + r.stderr);
confere('rotina: mostra task parada', /t1/.test(r.stdout) && /parad/i.test(r.stdout), r.stdout);
confere('rotina: card respondido não aparece como pendente', !/\bc1\b/.test(r.stdout.split('\n').find(l => /sem resposta/i.test(l)) || ''), r.stdout);
r = roda(ROT, ['acelerou', 'revisao foi para um ajudante'], { env }); confere('rotina: grava volta', r.status === 0, r.stderr);
const v = fs.readFileSync(VOLTAS, 'utf8').trim().split('\n').map(JSON.parse);
confere('rotina: linha no formato do painel', v.length === 1 && v[0].resultado === 'acelerou' && v[0].detalhe === 'revisao foi para um ajudante' && !isNaN(Date.parse(v[0].em)), JSON.stringify(v));
r = roda(ROT, ['qualquer', 'x'], { env }); confere('rotina: resultado inválido sai 1', r.status === 1);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Tests ${ok} passed, ${falhou} failed`);
process.exit(falhou ? 1 : 0);
