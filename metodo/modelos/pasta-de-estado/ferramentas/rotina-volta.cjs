// metodo-kit: uma volta da rotina de 15 min em 1 comando.
// Sem argumento: só mede e mostra (hora, CPU, memória livre, cards sem resposta, tasks paradas, idade das entregas).
// Com argumento: também grava 1 linha em estado/rotina-voltas.jsonl (o nome que o painel lê).
//   node <pasta-de-estado>/ferramentas/rotina-volta.cjs
//   node <pasta-de-estado>/ferramentas/rotina-volta.cjs acelerou "revisão do backend foi para um ajudante"
//   node <pasta-de-estado>/ferramentas/rotina-volta.cjs manteve "tudo que podia andar em paralelo já anda"
// Variável opcional: ESTADO_RAIZ (padrão: a pasta acima de ferramentas/). Nada aqui usa rede.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RAIZ = path.resolve(process.env.ESTADO_RAIZ || path.join(__dirname, '..'));
const PARADA_MIN = 30;

const [resultado, detalhe] = process.argv.slice(2);
if (resultado && !['acelerou', 'manteve'].includes(resultado)) { console.error('resultado: acelerou ou manteve'); process.exit(1); }

const lerJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const listar = d => { try { return fs.readdirSync(d); } catch { return []; } };
const tempoCpu = () => os.cpus().reduce((t, c) => { const s = Object.values(c.times).reduce((x, y) => x + y, 0); return { ocioso: t.ocioso + c.times.idle, total: t.total + s }; }, { ocioso: 0, total: 0 });

(async () => {
  const antes = tempoCpu();
  await new Promise(r => setTimeout(r, 500));
  const depois = tempoCpu();
  const cpu = Math.round(100 * (1 - (depois.ocioso - antes.ocioso) / Math.max(1, depois.total - antes.total)));
  const livre = Math.round(100 * os.freemem() / os.totalmem());

  // cards sem resposta (o que espera o dono)
  const pastaCards = path.join(RAIZ, 'estado', 'cards'), semResposta = [], ilegiveis = [];
  for (const f of listar(pastaCards).filter(f => f.endsWith('.json'))) {
    try { const c = lerJson(path.join(pastaCards, f)); if (!c.respondido && !(typeof c.resposta === 'string' && c.resposta.trim())) semResposta.push(f.slice(0, -5)); }
    catch { ilegiveis.push(f); }
  }
  // tasks andando sem mexer há mais de 30 min (pela data do arquivo): quem é dono é cobrado
  const pastaTasks = path.join(RAIZ, 'tasks'), paradas = [];
  for (const f of listar(pastaTasks).filter(f => f.endsWith('.md'))) {
    const arq = path.join(pastaTasks, f), txt = fs.readFileSync(arq, 'utf8');
    if (!/^estado:\s*(andando|aberta)\s*$/m.test(txt)) continue;
    const min = Math.round((Date.now() - fs.statSync(arq).mtimeMs) / 60000);
    if (min > PARADA_MIN) paradas.push(`${f.slice(0, -3)} (dono: ${(/^dono:\s*(.+)$/m.exec(txt) || [])[1] || '?'}, ${min} min)`);
  }
  let entregas = '?';
  try { entregas = Math.round((Date.now() - Date.parse(lerJson(path.join(RAIZ, 'estado', 'entregas.json')).atualizadoEm)) / 60000) + ' min'; } catch {}

  const agora = new Date();
  console.log(`hora ${agora.toLocaleString()} | CPU ${cpu}% | memória livre ${livre}%`);
  console.log('cards sem resposta: ' + (semResposta.join(', ') || 'nenhum') + (ilegiveis.length ? ' | ilegíveis: ' + ilegiveis.join(', ') : ''));
  console.log('tasks paradas há mais de ' + PARADA_MIN + ' min: ' + (paradas.join('; ') || 'nenhuma'));
  console.log('entregas escritas há: ' + entregas);

  if (resultado) {
    const linha = { em: agora.toISOString(), resultado, detalhe: String(detalhe || '').slice(0, 300), cpu, memoriaLivre: livre, cardsSemResposta: semResposta.length };
    fs.mkdirSync(path.join(RAIZ, 'estado'), { recursive: true });
    fs.appendFileSync(path.join(RAIZ, 'estado', 'rotina-voltas.jsonl'), JSON.stringify(linha) + '\n');
    console.log('volta gravada: ' + resultado);
  }
})();
