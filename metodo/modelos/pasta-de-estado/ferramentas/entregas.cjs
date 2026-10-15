// metodo-kit: entregas. Cada sessão marca o próprio passo em estado/entregas.json na hora em que ele fecha;
// o painel lê esse arquivo e mostra quanto falta e o que depende de você.
// Uso: node <pasta-de-estado>/ferramentas/entregas.cjs <comando> ...
//   lista [id]                                       entregas e passos
//   idade                                            minutos desde a última escrita (saída 3 se passou de 60)
//   nova <id> "<projeto>" "<nome>" <dono>
//   passo <id> "<nome>" <horas|?> [voce] [card=<id>] acrescenta passo no fim ("voce" = depende do dono)
//   feito <id> "<trecho do nome do passo>"
//   adianta <id> "<o que dá para adiantar agora>"
//   sincronizar                                      passo com card=<id> fica feito quando o card tem resposta COM prova
//                                                    (qualquer opção: o passo é a decisão do dono, não o "sim")
// Variável opcional: ESTADO_RAIZ (padrão: a pasta acima de ferramentas/).
// Texto sem segredo, endereço nem nome de pessoa: o painel mostra o que está aqui.
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(process.env.ESTADO_RAIZ || path.join(__dirname, '..'));
const ARQ = path.join(RAIZ, 'estado', 'entregas.json');
const TRAVA = ARQ + '.trava';
const VELHA_MIN = 60;

const ler = () => JSON.parse(fs.readFileSync(ARQ, 'utf8').replace(/^\uFEFF/, ''));
const idadeMin = d => Math.round((Date.now() - Date.parse(d.atualizadoEm)) / 60000);
const ACENTOS = new RegExp('[' + String.fromCharCode(768) + '-' + String.fromCharCode(879) + ']', 'g'); // marcas de acento soltas depois do NFD
const sem = s => String(s || '').normalize('NFD').replace(ACENTOS, '').toLowerCase();
// Erro vira exceção (nunca process.exit aqui dentro): assim o finally da trava roda e solta a trava.
// Quem imprime a mensagem e sai com o código é o bloco de fora, lá embaixo.
function sair(msg, cod) { const e = new Error(msg); e.codigo = cod; throw e; }
function achar(d, id) { const e = d.entregas.find(x => x.id === id); if (!e) sair('sem entrega ' + id + ' (lista: ' + d.entregas.map(x => x.id).join(' ') + ')', 2); return e; }

// Duas sessões gravando ao mesmo tempo: a trava é um arquivo criado com "wx" (falha se já existe).
function comTrava(fn) {
  for (let i = 0; ; i++) {
    try { fs.writeFileSync(TRAVA, String(process.pid), { flag: 'wx' }); break; }
    catch {
      try { if (Date.now() - fs.statSync(TRAVA).mtimeMs > 30000) fs.unlinkSync(TRAVA); } catch {}
      if (i >= 49) sair('trava ocupada: ' + TRAVA, 1);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try { return fn(); } finally { try { fs.unlinkSync(TRAVA); } catch {} }
}
// atualizadoEm só muda quando algo mudou de verdade (painel com dado velho fingindo fresco é pior que "?").
function gravar(d) {
  d.atualizadoEm = new Date().toISOString();
  const tmp = ARQ + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 1) + '\n');
  JSON.parse(fs.readFileSync(tmp, 'utf8'));
  fs.renameSync(tmp, ARQ);
}

const [cmd, ...a] = process.argv.slice(2);
try { principal(); } catch (e) { console.error(e.message); process.exit(e.codigo || 1); }

function principal() {
if (!cmd || cmd === 'idade' || cmd === 'lista') {
  const d = ler(), m = idadeMin(d);
  if (cmd === 'lista') for (const e of d.entregas.filter(e => !a[0] || e.id === a[0])) {
    console.log(e.id + ' | ' + e.projeto + ' | ' + e.nome + ' | ' + e.dono);
    for (const p of e.passos) console.log('   ' + (p.feito ? '[x] ' : '[ ] ') + p.nome + (p.dependeDele ? ' (VOCÊ)' : '') + (p.card ? ' card=' + p.card : ''));
  }
  console.log('entregas: ' + d.entregas.length + ', escrita há ' + m + ' min' + (m > VELHA_MIN ? ' -> VELHA: refazer' : ''));
  process.exit(m > VELHA_MIN ? 3 : 0);
}
comTrava(() => {
  const d = ler();
  if (cmd === 'nova') {
    if (d.entregas.some(x => x.id === a[0])) sair('já existe ' + a[0], 2);
    d.entregas.push({ id: a[0], projeto: a[1], nome: String(a[2] || '').slice(0, 200), dono: a[3] || null, passos: [], adianta: '' });
    gravar(d); console.log('nova: ' + a[0]);
  } else if (cmd === 'passo') {
    const e = achar(d, a[0]), peso = a[2] === '?' ? null : Number(a[2]);
    if (a[2] !== '?' && !(peso >= 0)) sair('horas inválidas: ' + a[2], 2);
    const p = { nome: String(a[1] || '').slice(0, 160), peso, feito: false };
    for (const x of a.slice(3)) { if (x === 'voce') p.dependeDele = true; else if (x.startsWith('card=')) p.card = x.slice(5); }
    e.passos.push(p); gravar(d); console.log('passo novo em ' + e.id + ': ' + p.nome);
  } else if (cmd === 'feito') {
    const e = achar(d, a[0]), p = e.passos.find(p => !p.feito && sem(p.nome).includes(sem(a[1])));
    if (!p) sair('nenhum passo aberto com "' + a[1] + '" em ' + a[0], 2);
    p.feito = true; gravar(d); console.log('feito: ' + e.id + ' / ' + p.nome);
  } else if (cmd === 'adianta') {
    const e = achar(d, a[0]); e.adianta = String(a[1] || '').slice(0, 300); gravar(d); console.log('adianta: ' + e.id);
  } else if (cmd === 'sincronizar') {
    let mudou = 0;
    for (const e of d.entregas) for (const p of e.passos) {
      if (p.feito || !p.card) continue;
      try {
        const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'estado', 'cards', p.card + '.json'), 'utf8').replace(/^\uFEFF/, ''));
        if (c.respondido && c.prova) { p.feito = true; mudou++; console.log('card respondido: ' + e.id + ' / ' + p.nome); }
      } catch {}
    }
    if (mudou) gravar(d);
    console.log('sincronizar: ' + mudou + ' passo(s) mudado(s); escrita há ' + idadeMin(d) + ' min');
  } else sair('comando desconhecido: ' + cmd, 1);
});
}
