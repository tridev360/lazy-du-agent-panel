'use strict';
// carga do PC e da VPS, recibos do motor e do RPC) com o placar curado contra os concorrentes e grava radar.json.
// Uso: node radar-gerar.cjs [--medir] [--agendado] [--estado-root <pasta>] [--saida <arquivo>]
//   --medir: roda antes os medidores opcionais (uso-codex.mjs e uso-maquinas.mjs) da pasta PAINEL_FERRAMENTAS, se existirem.
// So le arquivos do estado e o radar-fontes.json desta pasta. Sem rede, sem chave, sem .env; numero sem fonte vira "?".
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const FERRAMENTAS = (process.env.PAINEL_FERRAMENTAS || require('node:path').join(__dirname, 'demo', 'home', 'ferramentas'));
const POS = ['PIOR', 'IGUAL', 'MELHOR', 'SO NOS'], DIF = ['P', 'M', 'G'], REC = ['AGORA', 'DEPOIS', 'NUNCA'];
const DASH = /[\u2013\u2014]/;
const HORA = 3600e3, MIN = 60e3, VELHO_CREDITO = 2 * HORA, VELHO_MAQUINA = 30 * MIN;

const horaBrt = ms => new Date(ms - 3 * HORA).toISOString().slice(0, 19) + '-03:00';
const ms = v => typeof v === 'string' && v.trim() ? Date.parse(v) : typeof v === 'number' && Number.isFinite(v) ? (v < 1e12 ? v * 1000 : v) : NaN;
const r1 = x => Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
function lerTexto(file, max = 2e6) { try { const st = fs.statSync(file); if (!st.isFile() || st.size > max) return null; return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); } catch { return null; } }
function lerJson(file, max) { const t = lerTexto(file, max); if (t === null) return null; try { return JSON.parse(t); } catch { return null; } }
function idade(at, now) { return Number.isFinite(at) ? Math.max(0, Math.round((now - at) / MIN)) : null; }
function leitura(at, now, limite) { const a = idade(at, now); return { em: Number.isFinite(at) ? horaBrt(at) : null, minutos: a, velha: a === null ? true : a * MIN > limite }; }

// ---------- uso medido ----------
function claude(estado, now) {
  const linhas = (lerTexto(path.join(estado, 'credito-claude.jsonl')) || '').split(/\r?\n/).map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(o => o && Number.isFinite(o.semana) && Number.isFinite(ms(o.hora)));
  const usoJ = lerJson(path.join(estado, 'uso-claude.json'), 64000);
  let ultimo = linhas.length ? linhas.reduce((a, b) => ms(b.hora) >= ms(a.hora) ? b : a) : null;
  if (usoJ && Number.isFinite(usoJ.semana_pct) && Number.isFinite(ms(usoJ.hora)) && (!ultimo || ms(usoJ.hora) > ms(ultimo.hora)))
    ultimo = { hora: usoJ.hora, conta: usoJ.conta, semana: usoJ.semana_pct, janela5h: usoJ.janela5h_pct, zeraSemana: usoJ.semana_zera, zeraJanela: usoJ.janela5h_zera };
  if (!ultimo) return { estado: 'sem leitura', solucao: 'Falta estado/credito-claude.jsonl com o uso da conta do Claude.' };
  const tU = ms(ultimo.hora), mesma = linhas.filter(o => o.conta === ultimo.conta && o.zeraSemana === ultimo.zeraSemana && ms(o.hora) <= tU && tU - ms(o.hora) <= 24 * HORA);
  const primeiro = mesma.length ? mesma.reduce((a, b) => ms(b.hora) < ms(a.hora) ? b : a) : null, horas = primeiro ? (tU - ms(primeiro.hora)) / HORA : 0;
  let ritmo = null;
  if (primeiro && horas >= 2 && mesma.length >= 2) {
    const porHora = (ultimo.semana - primeiro.semana) / horas;
    const r = { pontosPorHora: r1(porHora), horas: r1(horas), n: mesma.length, desde: horaBrt(ms(primeiro.hora)) };
    const zera = ms(ultimo.zeraSemana);
    if (porHora > 0) { const acaba = tU + (100 - ultimo.semana) / porHora * HORA; r.acabaEm = horaBrt(acaba); r.acabaAntesDeZerar = Number.isFinite(zera) ? acaba < zera : null; }
    ritmo = r;
  }
  return { estado: 'ok', conta: ultimo.conta || '?', semanaPct: ultimo.semana, janela5hPct: Number.isFinite(ultimo.janela5h) ? ultimo.janela5h : null,
    zeraSemana: Number.isFinite(ms(ultimo.zeraSemana)) ? horaBrt(ms(ultimo.zeraSemana)) : null, leitura: leitura(tU, now, VELHO_CREDITO), ritmo,
    fonte: 'estado/credito-claude.jsonl e estado/uso-claude.json (get_usage do COORDENADOR)' };
}
function codex(estado, now) {
  const j = lerJson(path.join(estado, 'uso-codex.json'), 64000);
  if (!j || !Number.isFinite(j.semana_pct)) return { estado: 'sem leitura', solucao: 'Falta estado/uso-codex.json com semana_pct.' };
  const at = ms(j.lidoEm || j.atualizado);
  return { estado: 'ok', plano: j.plano || null, semanaPct: j.semana_pct, zeraSemana: Number.isFinite(ms(j.zera_semana)) ? horaBrt(ms(j.zera_semana)) : null,
    leitura: leitura(at, now, VELHO_CREDITO), fonte: 'estado/uso-codex.json (lido das conversas do Codex)' };
}
function maquinas(estado, now) {
  const j = lerJson(path.join(estado, 'uso-maquinas.json'), 4e6), at = ms(j?.atualizado);
  if (!j || !Array.isArray(j.maquinas)) return [{ id: 'pc-1', nome: 'PC', estado: 'sem leitura', solucao: 'Falta estado/uso-maquinas.json.' }];
  return j.maquinas.slice(0, 4).map(m => {
    const base = { id: m.id, nome: m.id === 'pc-1' ? 'PC' : m.id === 'vps-1' ? 'VPS' : String(m.nome || m.id).slice(0, 24), leitura: leitura(at, now, VELHO_MAQUINA) };
    if (m.erro || !Number.isFinite(m.nucleos_em_uso)) return { ...base, estado: 'sem leitura', nucleosTotal: m.nucleos_total ?? null,
      solucao: m.id === 'pc-1' ? 'O medidor do PC passou de 9 s (PC carregado); a próxima rodada agendada tenta de novo.' : 'O ssh da VPS não respondeu; a próxima rodada agendada tenta de novo.' };
    const trabalho = (m.funcoes || []).filter(f => f && f.quem !== 'outros' && Number.isFinite(f.nucleos)).sort((a, b) => b.nucleos - a.nucleos || (b.ram_gb || 0) - (a.ram_gb || 0)).slice(0, 3)
      .map(f => ({ nome: String(f.nome).slice(0, 32), quem: f.quem, nucleos: r1(f.nucleos), ramGb: r1(f.ram_gb) }));
    return { ...base, estado: 'ok', nucleos: r1(m.nucleos_em_uso), nucleosTotal: m.nucleos_total, ramGb: r1(m.ram_em_uso_gb), ramTotalGb: r1(m.ram_total_gb), discoLivreGb: r1(m.disco_livre_gb), mais: trabalho };
  });
}
// ---------- custos (registro do dono em estado/financas.json; moedas nunca convertidas) ----------
function custos(estado, extra) {
  const j = lerJson(path.join(estado, 'financas.json'), 2e6), itens = [];
  if (j && Array.isArray(j.lancamentos)) {
    // r11: lancamento de demonstracao (fonte ficticia) nunca sai como registro do dono
    const tipoDe = l => /fict[ií]ci|demo|inventad/i.test(String(l && l.fonte || '')) ? 'registro fictício (aprox.)' : 'registro do dono (aprox.)';
    const gastos = j.lancamentos.filter(l => l && l.tipo === 'gasto');
    const claudes = gastos.filter(l => /^claude-/.test(l.id || '') && Number.isFinite(l.valor) && l.recorrencia === 'mensal');
    if (claudes.length) itens.push({ id: 'claude-max', nome: 'Claude Max, ' + claudes.length + ' contas', moeda: 'BRL', mes: claudes.reduce((s, l) => s + l.valor, 0), tipo: claudes.every(l => tipoDe(l) !== 'registro do dono (aprox.)') ? 'registro fictício (aprox.)' : 'registro do dono (aprox.)', fonte: 'estado/financas.json' });
    for (const l of gastos) {
      if (claudes.includes(l)) continue;
      const nome = String(l.descricao || l.id || '?').replace(/\s*\(aprox\.[^)]*\)/, '').slice(0, 60);
      if (Number.isFinite(l.valor) && (l.recorrencia === 'mensal' || l.recorrencia === 'anual')) itens.push({ id: l.id, nome, moeda: 'BRL', mes: l.recorrencia === 'anual' ? Math.round(l.valor / 12) : l.valor, nota: l.recorrencia === 'anual' ? 'R$ ' + l.valor + ' por ano, dividido por 12' : null, tipo: tipoDe(l), fonte: 'estado/financas.json' });
      else if (Number.isFinite(l.valor_usd)) itens.push({ id: l.id, nome, moeda: 'USD', mes: null, texto: 'US$ ' + l.valor_usd + ' (período: ' + (l.recorrencia || '?') + ')', nota: 'o dono confirma se é por mês', tipo: tipoDe(l), fonte: 'estado/financas.json' });
    }
  }
  // custo curado com valor por mes (valorMes) entra na conta como os do registro; o resto fica como texto, sem conversao
  for (const e of extra || []) if (Number.isFinite(e.valorMes)) itens.push({ id: e.id, nome: e.nome, moeda: 'BRL', mes: e.valorMes, nota: e.nota || null, tipo: e.tipo, fonte: e.fonte });
  itens.sort((a, b) => (b.mes ?? -1) - (a.mes ?? -1));
  for (const e of (extra || []).filter(e => !Number.isFinite(e.valorMes))) itens.push({ id: e.id, nome: e.nome, moeda: 'USD', mes: null, texto: e.mes, nota: null, tipo: e.tipo, fonte: e.fonte });
  return { itens, lido: !!j, solucao: j ? null : 'Registrar os custos em estado/financas.json pelo formulário da aba Finanças.' };
}
// ---------- placar curado ----------
function validar(f) {
  const erros = [], texto = (v, onde) => { if (typeof v === 'string' && DASH.test(v)) erros.push('texto proibido em ' + onde); };
  if (!f || f.versao !== 1 || !Array.isArray(f.placar) || !Array.isArray(f.medidas) || !Array.isArray(f.semMedida)) return ['radar-fontes.json sem o formato 1'];
  const ids = new Set();
  for (const r of f.placar) {
    const onde = 'placar ' + (r && r.id);
    if (!r || typeof r.id !== 'string' || ids.has(r.id)) { erros.push('id repetido ou vazio: ' + onde); continue; } ids.add(r.id);
    if (!(POS.includes(r.posicao) || (r.posicao === null && r.area === 'casa'))) erros.push('posicao em ' + onde); if (r.alvo !== null && r.alvo !== undefined && !POS.includes(r.alvo)) erros.push('alvo em ' + onde);
    if (!DIF.includes(r.dificuldade)) erros.push('dificuldade em ' + onde); if (!REC.includes(r.recomendacao)) erros.push('recomendacao em ' + onde);
    if (!Number.isInteger(r.ordem)) erros.push('ordem em ' + onde);
    for (const k of ['feature', 'concorrente', 'como', 'pratica', 'porque']) if (typeof r[k] !== 'string' || !r[k].trim()) erros.push(k + ' vazio em ' + onde);
    if (r.curto !== undefined && (typeof r.curto !== 'string' || r.curto.length > 48)) erros.push('curto em ' + onde);
    if (!r.custo || ['credito', 'horas', 'servico'].some(k => typeof r.custo[k] !== 'string')) erros.push('custo em ' + onde);
    if (!Array.isArray(r.fonte) || !r.fonte.length || r.fonte.some(x => typeof x?.arquivo !== 'string')) erros.push('fonte em ' + onde);
  }
  (function andar(v, onde) { if (typeof v === 'string') texto(v, onde); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) andar(x, onde + '.' + k); })(f, 'fontes');
  return erros;
}
const ordemRec = r => REC.indexOf(r.recomendacao) * 1000 + r.ordem;
function placar(f, root, now) {
  const linhas = [...f.placar].sort((a, b) => ordemRec(a) - ordemRec(b)).map(r => ({ ...r, fonte: r.fonte.map(x => ({ ...x, existe: fs.existsSync(path.join(root, x.arquivo)) })) }));
  const contagem = Object.fromEntries(POS.map(p => [p, linhas.filter(r => r.posicao === p).length]));
  const comparadas = linhas.filter(r => r.posicao !== null), jogo = comparadas.filter(r => r.recomendacao !== 'NUNCA'), atras = jogo.filter(r => r.posicao === 'PIOR');
  const curado = ms(f.curadoEm), novas = [];
  for (const arq of f.fontesPlacar || []) { try { const st = fs.statSync(path.join(root, arq)); if (Number.isFinite(curado) && st.mtimeMs > curado + MIN) novas.push(arq); } catch { novas.push(arq + ' (sumiu)'); } }
  const sintese = f.sinteseEsperada && !(f.fontesPlacar || []).includes(f.sinteseEsperada) && fs.existsSync(path.join(root, f.sinteseEsperada)) ? f.sinteseEsperada : null;
  const avisos = [];
  if (sintese) avisos.push({ tipo: 'sintese', texto: 'Saiu a SINTESE.md.', solucao: 'O COORDENADOR refaz o placar com ela (é nosso, não precisa de você).', arquivo: sintese });
  if (novas.length) avisos.push({ tipo: 'fonte-nova', texto: 'Fonte do placar mudou depois da curadoria.', solucao: 'O COORDENADOR confere as linhas e atualiza o radar-fontes.json.', arquivos: novas });
  const semFonte = linhas.filter(r => r.fonte.some(x => !x.existe)).map(r => r.id);
  if (semFonte.length) avisos.push({ tipo: 'fonte-sumiu', texto: 'Linha com fonte que não existe mais: ' + semFonte.join(', '), solucao: 'O COORDENADOR troca a fonte ou tira a linha.' });
  return { curadoEm: f.curadoEm, curadoPor: f.curadoPor, regra: f.regra, escalaCusto: f.escalaCusto, contagem, total: linhas.length,
    comparadas: comparadas.length, noJogo: jogo.length, atras: atras.length, fora: comparadas.length - jogo.length, consolidado: f.consolidado || null, top3: linhas.filter(r => r.recomendacao === 'AGORA').slice(0, 3).map(r => r.id),
    linhas, avisos, idadeCuradoria: idade(curado, now) };
}
// ---------- montagem ----------
function montar({ root, dir = __dirname, now = Date.now(), origem = 'painel' } = {}) {
  const estado = path.join(root, 'estado'), fontes = lerJson(path.join(dir, 'radar-fontes.json'), 1e6), erros = validar(fontes);
  if (erros.length) throw Object.assign(new Error('radar-fontes.json invalido: ' + erros.slice(0, 5).join('; ')), { erros });
  const medidas = fontes.medidas.map(m => ({ ...m, fonte: m.fonte.map(x => ({ ...x, existe: fs.existsSync(path.join(root, x.arquivo)) })), idadeMin: idade(ms(m.quando), now) }));
  const uso = { claude: claude(estado, now), codex: codex(estado, now), maquinas: maquinas(estado, now) };
  const custo = custos(estado, fontes.custosExtra), p = placar(fontes, root, now);
  const top = p.linhas.find(r => r.id === p.top3[0]) || null, maisCaro = custo.itens.find(i => Number.isFinite(i.mes)) || null, puxado = medidas.find(m => m.destaque) || medidas.find(m => m.id === 'radar-provedor') || null;
  // a medida curada traz o proprio destaque (titulo, valor, unidade); a rota so aparece quando a medida diz qual e
  const destaque = puxado && puxado.destaque && typeof puxado.destaque.valor === 'string' ? puxado.destaque : null;
  const herois = {
    maisPuxado: destaque ? { titulo: destaque.titulo || puxado.nome, valor: destaque.valor, unidade: destaque.unidade || '', tipo: puxado.tipo, rota: destaque.rota || null } : puxado ? { titulo: 'Radar de rede', valor: '?', unidade: 'créditos por dia pela provedor', tipo: puxado.tipo, rota: { valor: '?', solucao: 'contador por rota no servidor: fase 2, por card' } } : { titulo: '?', valor: '?', solucao: 'A ASSISTENTE registra a medida do radar.' },
    custaMais: maisCaro ? { titulo: maisCaro.nome, valor: 'R$ ' + maisCaro.mes.toLocaleString('pt-BR'), unidade: 'por mês', tipo: maisCaro.tipo } : { titulo: '?', valor: '?', solucao: custo.solucao || 'Registrar custos na aba Finanças.' },
    atras: { valor: p.atras, de: p.noJogo, fora: p.fora },
    primeiro: top ? { id: top.id, titulo: top.curto || top.feature, dificuldade: top.dificuldade, porque: top.porque } : null
  };
  return { versao: 1, geradoEm: horaBrt(now), geradoPor: origem, herois, uso, medidas, custos: custo, semMedida: fontes.semMedida, placar: p };
}
function medirAntes() {
  const out = [];
  for (const [arq, limite] of [['uso-codex.mjs', 30000], ['uso-maquinas.mjs', 40000]]) {
    try { const linha = execFileSync(process.execPath, [path.join(FERRAMENTAS, arq)], { timeout: limite, windowsHide: true, encoding: 'utf8', maxBuffer: 1e7, stdio: ['ignore', 'pipe', 'pipe'] }).trim().split(/\r?\n/).pop(); out.push(arq + ': ' + String(linha || '').slice(0, 160)); }
    catch (e) { out.push(arq + ': falhou (' + (e.killed ? 'passou do tempo' : 'saida ' + (e.status ?? '?')) + ')'); }
  }
  return out;
}
function gravar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = arquivo + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(dados, null, 1) + '\n'); fs.renameSync(tmp, arquivo);
}
function opcoes(argv, env = process.env) {
  const o = { medir: false, agendado: false, root: env.PAINEL_ROOT || path.resolve(__dirname, '../../..'), saida: path.join(__dirname, '.cache', 'radar.json') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--medir') o.medir = true;
    else if (argv[i] === '--agendado') o.agendado = true;
    else if (argv[i] === '--estado-root' && argv[i + 1]) o.root = argv[++i];
    else if (argv[i] === '--saida' && argv[i + 1]) o.saida = path.resolve(argv[++i]);
    else throw new Error('argumento invalido: ' + argv[i]);
  }
  return o;
}
if (require.main === module) {
  try {
    const o = opcoes(process.argv.slice(2)), medidos = o.medir ? medirAntes() : [];
    const dados = montar({ root: o.root, dir: __dirname, now: Date.now(), origem: o.agendado ? 'agendamento' : 'a mao' });
    gravar(o.saida, dados);
    for (const l of medidos) console.log(l);
    console.log('radar ' + dados.geradoEm.slice(11, 16) + ' | placar ' + dados.placar.total + ' linhas, ' + dados.placar.atras + ' atras de ' + dados.placar.noJogo + ' | ' + o.saida);
  } catch (e) { console.error('radar-gerar falhou: ' + (e.message || e)); process.exitCode = 1; }
}
module.exports = { montar, validar, claude, codex, maquinas, custos, placar, opcoes, horaBrt };
