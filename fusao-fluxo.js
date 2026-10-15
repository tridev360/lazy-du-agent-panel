/* Resumo, consumo, entregas e pulso de aceleracao na aba Fluxo.
   fechadas de hoje, espelho das Entregas, LED dos projetos e o botao Acelerar (quando o painel aceita gravar). O Agora segue como esta (este arquivo so le dele).
   Dados sem conta nova: /api/agora (credito), /api/contas-claude (reserva), /api/livro/dias, /api/obra, PainelGrade.esperaProjeto()/anda(), o clone das Entregas.
   Regra: "?" com a solucao, "none" quando nada aconteceu, nunca 0 inventado. So busca com o Fluxo na tela. */
(function (root, fabrica) {
  const api = fabrica(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else { root.PainelFusaoFluxo = api; api.start(root); }
})(typeof window === 'object' ? window : globalThis, function (root) {
  const SOL = {
    consumo: 'o painel relê o uso a cada 60 s; se seguir sem número, rode node checar.cjs',
    conta: 'rode /usage no Claude Code para conferir esta conta',
    espera: 'o painel relê sozinho a cada 15 s',
    travou: 'o painel relê sozinho a cada 15 s',
    anda: 'esta cópia usa só metadados. Confira Trabalhando agora na primeira tela',
    fechadas: 'o painel relê o histórico do estado a cada 2 min; a contagem precisa de git na pasta de estado'
  };
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  const pad = n => String(n).padStart(2, '0');
  const slug = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const PD = root.PainelProjetoDe || (typeof require === 'function' ? (() => { try { return require('./projeto-de.cjs'); } catch (e) { return null; } })() : null);

  // ---------- consumo ----------
  const zeraDe = iso => { const t = Date.parse(iso); if (!Number.isFinite(t)) return null; const d = new Date(t); return 'zera ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  function linhaConsumo(chave, nome, o) {
    const pct = o ? num(o.pct) : null;
    return { chave, nome, pct, texto: pct === null ? '?' : (o.texto || pct + '% usado'), daVez: !!(o && o.daVez), zera: pct === null ? null : (o.zera || null), solucao: pct === null ? (o && o.solucao) || SOL.conta : null, velho: pct === null, ultimo: pct === null && o ? o.ultimo || null : null, lido: o ? o.lido || null : null };
  }
  // as contas do Claude que existem nesta leitura (uma ou varias); nenhuma = 1 linha "Claude" com "?" e a solucao
  const contasDe = lista => (Array.isArray(lista) ? lista : []).filter(c => c && typeof c.conta === 'string' && c.conta.trim()).slice(0, 8);
  function modeloConsumo(cred, contas) {
    if (cred && cred.ok !== false && (cred.claude || cred.codex)) {
      const cs = contasDe(cred.claude && cred.claude.contas);
      const linhas = cs.length ? cs.map(c => linhaConsumo(c.conta, cs.length === 1 ? 'Claude' : 'Claude ' + c.conta, { pct: c.usadoPct, texto: c.texto, daVez: c.daVez, zera: c.zeraCurto || c.zeraTexto, solucao: c.solucao, ultimo: c.ultimoTexto, lido: c.lidoTexto })) : [linhaConsumo('claude', 'Claude', null)];
      const x = cred.codex;
      linhas.push(linhaConsumo('codex', 'Codex', x ? { pct: x.usadoPct, texto: x.texto, daVez: x.daVez, zera: x.zeraCurto || x.zeraTexto, solucao: x.solucao, ultimo: x.ultimoTexto, lido: x.lidoTexto } : null));
      return { fonte: 'agora', vazio: false, linhas };
    }
    if (contas && contas.ok !== false && Array.isArray(contas.contas)) {
      const cs = contasDe(contas.contas), linhas = cs.length ? cs.map(c => linhaConsumo(c.conta, cs.length === 1 ? 'Claude' : 'Claude ' + c.conta, { pct: c.semana, daVez: c.atual === true, zera: zeraDe(c.zeraSemana), solucao: SOL.conta })) : [linhaConsumo('claude', 'Claude', null)];
      linhas.push(linhaConsumo('codex', 'Codex', null));
      return { fonte: 'contas', vazio: false, linhas };
    }
    return { fonte: null, vazio: true, linhas: [], solucao: SOL.consumo };
  }

  // ---------- resumo ----------
  const soSolucao = (s, padrao) => { const m = /Solu[cç][aã]o:\s*(.+)$/i.exec(String(s || '')); return m ? txt(m[1], 160) : padrao; };
  function celula(n, nada, um, varios, sol, extra) {
    if (n === null) return { valor: '?', texto: '?', solucao: sol, classe: 'sem' };
    if (n === 0) return { valor: nada.valor, texto: nada.texto, solucao: null, classe: 'zero' };
    return { valor: String(n), texto: extra || (n === 1 ? um : varios.replace('%n', n)), solucao: null, classe: 'n' };
  }
  // N3: o texto do Travou nao pode abrir com "Nada travado" quando o numero diz que travou
  const SEM_TRAVA = /^Nada\s+travad[oa]s?(?:\s+por\s+voc[eê])?(?:\s+agora)?\s*[.:;,-]?\s*/i;
  function resumo({ k, travado, conta, semLeituraTravado, filtrado } = {}) {
    const kk = k && typeof k === 'object' ? k : {}, trav = Array.isArray(travado) ? travado : [];
    const e = celula(num(kk.espera), { valor: 'LIMPO', texto: 'nada espera você' }, '1 coisa espera você', '%n coisas esperam você', SOL.espera);
    const nt = num(kk.trava), resto = trav.length ? txt(trav[0], 140).replace(SEM_TRAVA, '') : '';
    const t = celula(nt, { valor: 'none', texto: 'nada travou' }, '1 coisa travou', '%n coisas travaram', soSolucao(semLeituraTravado, SOL.travou), nt > 0 && resto ? (nt === 1 ? '1 coisa travou: ' : nt + ' coisas travaram: ') + resto : null);
    // N2: fora de Todos o numero e do projeto e a frase da conta e do painel inteiro: so entra em Todos
    const frase = !filtrado && conta && typeof conta.frase === 'string' && conta.frase ? txt(conta.frase, 160) : null;
    const a = celula(num(kk.anda), { valor: 'none', texto: 'nada anda agora' }, '1 anda agora', '%n andam agora', SOL.anda, frase);
    return { espera: e, travou: t, anda: a };
  }

  // ---------- fechadas ----------
  const dia = (s, d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null; const x = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + d * 86400000); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); };
  function fechadas(d) {
    if (!d || d.lido !== true || !d.dias || typeof d.dias !== 'object' || !dia(d.hoje, 0)) return { hoje: null, ontem: null, diff: null, texto: 'sem histórico', vs: null, solucao: SOL.fechadas };
    const ontemKey = dia(d.hoje, -1), hoje = num(d.dias[d.hoje]) || 0;
    const ontem = d.primeiroDia && ontemKey < d.primeiroDia ? null : (num(d.dias[ontemKey]) || 0);
    const diff = ontem === null ? null : hoje - ontem;
    return { hoje, ontem, diff, texto: hoje ? String(hoje) : 'none', vs: diff === null ? 'ontem: ?' : diff > 0 ? '+' + diff + ' vs ontem' : diff < 0 ? diff + ' vs ontem' : 'igual a ontem', solucao: null };
  }

  // ---------- filtro do Vendo ----------
  function filtrarObra(obra, PG) {
    if (!obra || !Array.isArray(obra.projects) || !PG || typeof PG.atual !== 'function' || PG.atual() === 'todos') return obra;
    return Object.assign({}, obra, { projects: obra.projects.filter(p => PG.casa({ projeto: slug(p && p.name), titulo: p && p.name })) });
  }
  const notaTodos = PG => (PG && typeof PG.atual === 'function' && PG.atual() !== 'todos' ? 'conta todos os projetos' : '');

  // ---------- textos do pulso ----------
  const textos = {
    // so o que aconteceu (gravou) e quem responde; nenhum prazo que nada cumpre. Depois de 15 min sem resposta (sem = true) a linha de cima so diz que gravou
    enviado: (h, sem) => 'Pulso gravado ' + h + '.' + (sem ? '' : ' Seu Claude lê com node ler-pulsos.cjs e responde aqui.'),
    semResposta: () => '? sem resposta do seu Claude. Solução: peça a ele para rodar node ler-pulsos.cjs e responder.',
    // a tela esquece o pulso depois de 1 h
    semPulso: 'none: nenhum pulso na última hora neste projeto',
    // o 403 diz o proximo passo
    semPermissao: 'o painel não aceitou o Acelerar nesta cópia. Solução: abra o painel neste computador, sem PAINEL_SO_LEITURA=1',
    contagem: s => (num(s) && s > 0 ? 'Acelerar · ' + Math.floor(s / 60) + ':' + pad(Math.floor(s % 60)) : 'Acelerar'),
    alvo: a => (a.projeto === 'todos' ? 'Todos' : PD ? PD.nomeDe(a.projeto) : a.projeto) + ' · ' + txt(a.comando, 80),
    resposta: n => (n ? 'seu Claude respondeu' : 'sem resposta ainda')
  };
  const textoLedVazio = filtrado => (filtrado ? 'none neste projeto. Para ver todos: escolha Todos no seletor' : 'none: nenhum projeto nesta leitura');
  const botaoVisivel = ({ aceita, fluxo } = {}) => aceita === true && fluxo === true;
  const deveLer = ({ gNew, oculto } = {}) => gNew === 'fluxo' && !oculto;

  const _teste = { modeloConsumo, resumo, fechadas, filtrarObra, notaTodos, slug, textos, textoLedVazio, botaoVisivel, deveLer, SOL };
  let LEITURA = null; // a última leitura já pintada, para o pé do Fluxo (fluxo-tela.js; só leitura)

  // ====================================================================================================
  // NAVEGADOR
  // ====================================================================================================
  function start(win) {
    const doc = win.document; if (!doc || !doc.documentElement) return false;
    const html = doc.documentElement;
    const S = { aceita: false, agora: null, contas: null, dias: null, obra: null, em: {}, pulso: null, restaS: {}, restaEm: 0, aberto: false, erro: null, token: '', cardsUi: null, cardsProj: null, cardsCit: '', cardsBox: null, linhasBox: null, assinatura: {} };
    let sec = null, corpo = null, led = null, btn = null, pollPulso = null;

    const h = (tag, cls, ...kids) => { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) if (k !== null && k !== undefined && k !== false) n.append(k.nodeType ? k : doc.createTextNode(String(k))); return n; };
    const getJSON = async url => { const r = await win.fetch(url, { cache: 'no-store', redirect: 'error' }); if (!r.ok) throw new Error('http ' + r.status); return r.json(); };
    async function postJSON(url, corpoJson, cab) {
      const r = await win.fetch(url, { method: 'POST', cache: 'no-store', redirect: 'error', headers: Object.assign({ 'Content-Type': 'application/json' }, cab || {}), body: JSON.stringify(corpoJson) });
      let j = null; try { j = await r.json(); } catch (e) { j = null; }
      return { status: r.status, j };
    }
    // no modo exemplo toda busca leva ?exemplo=1, como o agora.js; a rota devolve o exemplo e nunca o dado real
    let SUF = ''; try { SUF = new URLSearchParams(String((win.location && win.location.search) || '')).get('exemplo') === '1' ? '?exemplo=1' : ''; } catch (e) { SUF = ''; }
    const PG = () => win.PainelProjetoGlobal || null;
    const atual = () => { const p = PG(); try { return p ? p.atual() : 'todos'; } catch (e) { return 'todos'; } };
    const visivel = () => deveLer({ gNew: html.dataset.gNew, oculto: doc.hidden === true });

    // ---------- montagem ----------
    function montar() {
      const fluxo = doc.getElementById('g-fluxo'); if (!fluxo || !fluxo.parentNode) return false;
      if (sec && sec.isConnected) return true;
      sec = h('section', 'fz-fusao'); sec.id = 'fz-fusao'; sec.dataset.dsOwned = 'fusao'; sec.setAttribute('aria-label', 'Resumo do Fluxo');
      const pulso = h('div', 'fz-pulso'); pulso.id = 'fz-pulso'; pulso.hidden = true;
      const topo = h('div', 'fz-topo'); topo.id = 'fz-topo';
      for (const id of ['fz-resumo', 'fz-consumo', 'fz-fechadas']) { const c = h('div', 'fz-caixa'); c.id = id; topo.append(c); }
      corpo = h('div', 'fz-corpo'); corpo.id = 'fz-corpo';
      const lado = h('aside', 'fz-lado'); lado.id = 'fz-lado'; lado.setAttribute('aria-label', 'Entregas e projetos');
      const ent = h('div', 'fz-caixa fz-entregas'); ent.id = 'fz-entregas'; const ledBox = h('div', 'fz-caixa fz-led'); ledBox.id = 'fz-led'; lado.append(ent, ledBox);
      const acao = h('div', 'fz-acao'); acao.id = 'fz-acao'; sec.append(acao, pulso, topo, corpo);
      fluxo.before(sec); corpo.append(fluxo, lado);
      S.assinatura = {}; led = null; S.cardsBox = null;
      return true;
    }
    function arrumar() {
      if (!montar()) return;
      const fluxo = doc.getElementById('g-fluxo'), lado = doc.getElementById('fz-lado');
      if (fluxo && fluxo.parentNode !== corpo) corpo.prepend(fluxo);
      for (const irmao of Array.from(corpo.children)) if (irmao !== fluxo && irmao !== lado) sec.after(irmao); // ex.: o bloco do Livro vem junto do Fluxo
      colocarBotao();
    }

    // ---------- pintura ----------
    function pintar(id, chave, montarNo) {
      const el = doc.getElementById(id); if (!el) return;
      const ass = JSON.stringify(chave); if (S.assinatura[id] === ass) return; S.assinatura[id] = ass;
      el.replaceChildren(...montarNo().filter(Boolean));
    }
    function leituraGrade() {
      const G = win.PainelGrade; let k = null, conta = null;
      try { k = G && typeof G.esperaProjeto === 'function' ? G.esperaProjeto() : null; } catch (e) { k = null; }
      try { conta = G && typeof G.anda === 'function' ? G.anda() : null; } catch (e) { conta = null; }
      const a = S.agora && S.agora.agora ? S.agora.agora : null, p = PG();
      let trav = a && Array.isArray(a.travado) ? a.travado : [];
      if (p && atual() !== 'todos') trav = trav.filter(t => p.casa({ titulo: String(t), texto: String(t) }));
      const sem = a && a.semLeitura && typeof a.semLeitura.travado === 'string' ? a.semLeitura.travado : null;
      return { k, travado: trav, conta, semLeituraTravado: sem, filtrado: !!p && atual() !== 'todos' };
    }
    function pintarResumo() {
      const r = resumo(leituraGrade());
      pintar('fz-resumo', r, () => [h('h2', 'fz-h', 'Resumo'), h('div', 'fz-tres', ...[['Espera', r.espera], ['Travou', r.travou], ['Anda', r.anda]].map(([nome, c]) =>
        h('div', 'fz-cel is-' + c.classe, h('span', 'fz-lab', nome), h('b', 'fz-val', c.valor), h('span', 'fz-sub', c.texto), c.solucao ? h('span', 'fz-sol', 'Solução: ' + c.solucao) : null)))]);
    }
    function pintarConsumo() {
      const m = modeloConsumo(S.agora && S.agora.credito, S.contas), nota = notaTodos(PG());
      pintar('fz-consumo', [m, nota], () => {
        if (m.vazio) return [h('h2', 'fz-h', 'Consumo'), h('p', 'fz-vazio', '? sem leitura do consumo. Solução: ' + m.solucao)];
        return [h('h2', 'fz-h', 'Consumo da semana'), h('ul', 'fz-uso', ...m.linhas.map(l => {
          const i = h('i', 'fz-barra-i'); i.style.width = (l.pct === null ? 0 : Math.max(0, Math.min(100, l.pct))) + '%';
          const li = h('li', 'fz-lin' + (l.daVez ? ' is-davez' : '') + (l.pct === null ? ' is-sem' : ''), h('span', 'fz-nome', l.nome), h('span', 'fz-barra', i), h('b', 'fz-pct', l.pct === null ? '?' : l.pct + '%'), l.daVez ? h('span', 'fz-vez', 'em uso') : null, l.zera ? h('span', 'fz-zera', l.zera) : null, l.solucao ? h('span', 'fz-sol', 'Solução: ' + l.solucao) : null);
          if (l.ultimo || l.lido) li.title = [l.ultimo, l.lido].filter(Boolean).join(' · ');
          return li;
        })), nota ? h('p', 'fz-nota', nota) : null];
      });
    }
    function pintarFechadas() {
      const f = fechadas(S.dias), nota = notaTodos(PG());
      pintar('fz-fechadas', [f, nota], () => [h('h2', 'fz-h', 'Fechadas hoje'), h('b', 'fz-grande' + (/^[0-9]/.test(f.texto) ? '' : ' is-texto'), f.texto), f.vs ? h('span', 'fz-sub', f.vs) : null, f.solucao ? h('span', 'fz-sol', 'Solução: ' + f.solucao) : null, nota ? h('p', 'fz-nota', nota) : null]);
    }
    // espelho das Entregas: copia do bloco do Agora (ja filtrado pelo Vendo); o clique aciona o botao de verdade
    function pintarEntregas() {
      const src = doc.getElementById('en-agora'), alvo = doc.getElementById('fz-entregas'); if (!alvo) return;
      if (!src) { if (S.assinatura.ent !== 'sem') { S.assinatura.ent = 'sem'; alvo.replaceChildren(h('h2', 'fz-h', 'Entregas'), h('p', 'fz-vazio', '? as Entregas ainda não chegaram. Solução: o painel relê sozinho a cada 15 s')); } return; }
      const ass = src.textContent; if (S.assinatura.ent === ass) return; S.assinatura.ent = ass;
      const copia = src.cloneNode(true); copia.removeAttribute('id'); copia.classList.add('fz-copia');
      copia.addEventListener('click', ev => { const b = ev.target && ev.target.closest ? ev.target.closest('button') : null; if (!b) return; const i = Array.from(copia.querySelectorAll('button')).indexOf(b), orig = src.querySelectorAll('button')[i]; if (orig) orig.click(); });
      alvo.replaceChildren(copia);
    }
    function pintarLed() {
      const alvo = doc.getElementById('fz-led'); if (!alvo) return;
      if (!win.PainelObraPixel) { if (!alvo.firstChild) alvo.append(h('h2', 'fz-h', 'Projetos'), h('p', 'fz-vazio', '? projetos indisponíveis nesta leitura. Solução: o painel relê sozinho a cada 15 s')); return; }
      if (!led) { const host = h('div', 'fz-led-host'); alvo.replaceChildren(host); led = win.PainelObraPixel.create(doc, host, 'd'); }
      const f = filtrarObra(S.obra, PG());
      if (f && f.projects && f.projects.length) {
        led.band.hidden = false; if (led.vazio) { led.vazio.remove(); led.vazio = null; }
        const ass = JSON.stringify(f, (k, v) => (k === 'ageSeconds' ? undefined : v)); if (S.assinatura.led !== ass) { S.assinatura.led = ass; led.update(f); }
      } else if (S.obra) {
        led.band.hidden = true; S.assinatura.led = '';
        if (!led.vazio) { led.vazio = h('p', 'fz-vazio', textoLedVazio(atual() !== 'todos')); alvo.append(led.vazio); }
      }
    }
    function pintarTudo() { pintarResumo(); pintarConsumo(); pintarFechadas(); pintarEntregas(); pintarLed(); pintarBotao(); LEITURA = { resumo: resumo(leituraGrade()), consumo: modeloConsumo(S.agora && S.agora.credito, S.contas), fechadas: fechadas(S.dias), obra: filtrarObra(S.obra, PG()) }; }

    // ---------- leitura (so com o Fluxo na tela) ----------
    const CADA = { agora: 60000, contas: 60000, dias: 120000, obra: 60000, dono: 60000 };
    async function ler(chave, buscar, guardar) {
      const t = Date.now(); if (S.em[chave] && t - S.em[chave] < CADA[chave]) return; S.em[chave] = t;
      try { guardar(await buscar()); } catch (e) { /* fica a leitura anterior; a tela mostra o "?" com a solucao */ }
    }
    async function tick() {
      if (!montar()) return;
      aplicarDono();
      if (!visivel()) return;
      await Promise.all([
        ler('agora', () => getJSON('/api/agora' + SUF), j => { S.agora = j; }),
        ler('dias', () => getJSON('/api/livro/dias' + SUF), j => { S.dias = j; }),
        ler('obra', () => getJSON('/api/obra' + SUF), j => { S.obra = j && j.ok === true && j.data ? j.data : null; }),
        ler('dono', () => getJSON('/api/pulso-acelerar' + SUF), j => { S.aceita = !!(j && j.aceita === true) && SUF === ''; })
      ]);
      if (!(S.agora && S.agora.credito && S.agora.credito.ok !== false)) await ler('contas', () => getJSON('/api/contas-claude' + SUF), j => { S.contas = j; });
      arrumar(); aplicarDono(); pintarTudo();
    }

    // ---------- Acelerar (so quando o painel aceita gravar) ----------
    function aplicarDono() { html.classList.toggle('fz-dono', botaoVisivel({ aceita: S.aceita, fluxo: html.dataset.gNew === 'fluxo' })); }
    function colocarBotao() {
      if (btn && btn.isConnected) return;
      const ancora = doc.getElementById('fz-acao'); if (!ancora) return;
      btn = h('button', 'fz-acelerar', 'Acelerar'); btn.id = 'fz-acelerar'; btn.type = 'button'; btn.title = 'Acelerar o que está marcado no seletor de projeto';
      btn.addEventListener('click', aoClicar); ancora.append(btn);
    }
    const resta = proj => { const s = num(S.restaS[proj]); return s === null ? 0 : Math.max(0, Math.ceil(s - (Date.now() - S.restaEm) / 1000)); };
    function pintarBotao() { if (!btn) return; const r = resta(atual()); btn.textContent = textos.contagem(r); btn.classList.toggle('is-espera', r > 0); }
    async function lerPulsos() {
      try { const j = await getJSON('/api/pulso-acelerar' + SUF); S.pulso = j; S.token = j.token || ''; S.restaS = j.restaS || {}; S.restaEm = Date.now(); } catch (e) { /* mantem a leitura anterior */ }
      pintarPainelPulso(); pintarBotao();
    }
    async function aoClicar() {
      const proj = atual();
      if (resta(proj) > 0) { S.aberto = !S.aberto; S.erro = null; if (S.aberto) await lerPulsos(); else pintarPainelPulso(); return; }
      btn.disabled = true; S.erro = null;
      try {
        await lerPulsos();
        const r = await postJSON('/api/pulso-acelerar' + SUF, { projeto: proj }, { 'X-Pulso-Token': S.token });
        S.aberto = true;
        if (r.status === 200) await lerPulsos();
        else if (r.status === 429) { S.restaS[proj] = (r.j && r.j.restaS) || 120; S.restaEm = Date.now(); }
        else S.erro = r.status === 403 ? textos.semPermissao : '? o pulso não saiu. Solução: tente de novo em instantes';
      } catch (e) { S.aberto = true; S.erro = '? o pulso não saiu. Solução: tente de novo em instantes'; }
      finally { btn.disabled = false; pintarBotao(); pintarPainelPulso(); }
    }
    function pintarPainelPulso() {
      const box = doc.getElementById('fz-pulso'); if (!box) return;
      const proj = atual(), u = S.pulso && S.pulso.ultimos ? S.pulso.ultimos[proj] : null;
      box.hidden = !(S.aberto && html.classList.contains('fz-dono'));
      if (box.hidden) { clearInterval(pollPulso); pollPulso = null; return; }
      if (!S.cardsBox || !box.contains(S.cardsBox)) {
        S.cardsBox = h('div', 'fz-pulso-cards'); S.cardsBox.id = 'fz-pulso-cards'; S.linhasBox = h('div', 'fz-pulso-linhas'); S.cardsUi = null; S.cardsProj = null;
        const fechar = h('button', 'fz-fechar', 'Fechar'); fechar.type = 'button'; fechar.addEventListener('click', () => { S.aberto = false; pintarPainelPulso(); });
        box.replaceChildren(h('div', 'fz-pulso-topo', h('h2', 'fz-h', 'Acelerar'), fechar), S.linhasBox, S.cardsBox);
      }
      const linhas = [];
      if (S.erro) linhas.push(h('p', 'fz-pulso-erro', S.erro));
      if (u) {
        const resps = Array.isArray(u.respostas) ? u.respostas : [];
        linhas.push(h('p', 'fz-pulso-l1', textos.enviado(String(u.hora).slice(11, 16), u.semResposta === true)), h('p', 'fz-sub', textos.alvo(u)));
        if (!u.semResposta) linhas.push(h('p', 'fz-sub', textos.resposta(resps.length || num(u.nRespostas) || 0))); // sem resposta em 15 min: so a linha do '?' com a solucao
        for (const r of resps) for (const l of r.linhas) linhas.push(h('p', 'fz-pulso-resp', l));
        if (u.semResposta) linhas.push(h('p', 'fz-sol', textos.semResposta()));
      } else if (!S.erro) linhas.push(h('p', 'fz-sub', textos.semPulso));
      S.linhasBox.replaceChildren(...linhas);
      const cit = u && Array.isArray(u.cards) ? u.cards.join(',') : '';
      if (win.PainelPcCards && typeof win.PainelPcCards.montar === 'function') {
        if (S.cardsProj !== proj) { if (S.cardsUi && S.cardsUi.destruir) S.cardsUi.destruir(); S.cardsUi = win.PainelPcCards.montar(S.cardsBox, { api: '/api/pulso-acelerar/cards/' + proj, titulo: false, pedidos: false }); S.cardsProj = proj; S.cardsCit = cit; }
        else if (S.cardsCit !== cit && S.cardsUi && S.cardsUi.recarregar) { S.cardsCit = cit; S.cardsUi.recarregar(); }
      }
      if (!pollPulso) pollPulso = setInterval(() => { if (S.aberto) lerPulsos(); }, 10000);
    }

    // ---------- ligacao ----------
    win.addEventListener('painel-projeto', () => { S.assinatura = {}; S.aberto = false; S.erro = null; S.em.obra = 0; pintarTudo(); pintarPainelPulso(); tick(); });
    new win.MutationObserver(() => { aplicarDono(); if (visivel()) tick(); }).observe(html, { attributes: true, attributeFilter: ['data-g-new'] });
    setInterval(() => { arrumar(); if (visivel()) { pintarResumo(); pintarEntregas(); pintarBotao(); } }, 1500);
    setInterval(tick, 5000);
    win.addEventListener('pagehide', () => { clearInterval(pollPulso); if (S.cardsUi && S.cardsUi.destruir) S.cardsUi.destruir(); });
    arrumar(); tick();
    return true;
  }

  return Object.freeze({ start, _teste, leitura: () => LEITURA });
});
