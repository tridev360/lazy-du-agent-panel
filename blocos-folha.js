/* blocos-folha.js (Fase 2): os blocos proprios do tema FOLHA DO DIA, que so aparecem com data-theme="folha".
   Gancho (1 linha no index.html, depois do vistas.js):
     <link rel="stylesheet" href="/blocos-folha.css"><script defer src="/blocos-folha.js"></script>
   e 1 linha no servidor.cjs (blocos-folha-rota.cjs serve os 2 arquivos e GET /api/folha/hoje).
   O que monta, por cima da marcacao comum (vistas.js), sem mexer nela:
   - AGORA da folha (#fh-agora, coluna de 720): data + "lido HH:MM", 3 aneis finos (Decidir, Entregar, Credito no ritmo),
     a frase grande "N coisas esperam voce." (so os cards pendentes) com "e N passos seus" numa linha menor embaixo,
     a lista (1o item e a unica superficie, com Abrir), linha Andando / Travado / Credito, "Hoje", Projetos D (LED),
     "Feito hoje" e a linha fina do compositor no pe. Tela vazia: "Nada espera voce.". No tema folha o #g-agora some.
   - Recompensa: o card que sai risca, desliza e cai em "Feito hoje" (400 ms), o contador sobe, o anel avanca em 400 ms
     e so o anel que fecha acende rosa por 1 s. Movimento off para tudo. Som: nenhum (anotado onde entraria).
   - Ctrl K estilo Raycast: a caixa de sempre (#painel-caixa) no centro, com "Ir para" (qualquer aba nova ou antiga).
   So leitura: so GET. Nada aqui responde card nem manda mensagem; "Escolher" abre os cards de sempre (#g-decidir). */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.PainelBlocosFolha) return;
  const html = doc.documentElement;
  const ativo = () => html.dataset.theme === 'folha';
  const noAgora = () => html.dataset.gNew === 'agora';

  // ---------- utilidades ----------
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const $ = id => doc.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const stamp = v => { if (v === null || v === undefined || v === '') return null; const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
  const hhmm = t => { if (t === null || t === undefined) return '?'; const d = new Date(t); return Number.isFinite(d.getTime()) ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '?'; };
  const ddmm = t => { const d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); };
  const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
  const rel = t => {
    if (t === null || t === undefined) return '?';
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min';
    const h = Math.floor(m / 60); if (h < 24) return 'há ' + h + ' h';
    const d = Math.floor(h / 24); return d === 1 ? 'ontem' : 'há ' + d + ' dias';
  };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const motion = () => html.dataset.motion !== 'off'; // regra do painel: o Movimento on vence o reduced-motion do sistema
  const owned = node => { node.dataset.dsOwned = 'folha'; return node; }; // o varredor de "?" (dados-solucao) nao mexe aqui
  const dot = cls => el('i', 'fh-dot ' + (cls || ''));
  async function getJson(url) {
    const r = await root.fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r.ok) throw Error(url + ' ' + r.status);
    return r.json();
  }
  const snap = () => { try { return typeof latestSnapshot !== 'undefined' && latestSnapshot ? latestSnapshot : null; } catch { return null; } }; // global do painel.js
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataLonga = t => { const d = new Date(t); return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
  const vistas = () => root.PainelVistas || root.PainelGrade || null;
  // o vistas.js mantem a caixa (#g-dock) como ultimo filho do body e a move de volta se nao for; mover tira o foco do
  // texto. Por isso tudo que esta camada poe no body entra ANTES do #g-dock.
  const noCorpo = node => { const dock = $('g-dock'); if (dock && dock.parentElement === doc.body) dock.before(node); else doc.body.append(node); };
  const ir = (tab, view) => { const V = vistas(); if (V && typeof V.show === 'function') V.show(tab, view); else root.location.hash = '#g=' + tab + '.' + view; };

  const S = { agora: null, agoraAt: null, agoraFail: false, hoje: null, contas: null, crono: null, obraUi: null, prevIds: null, demo: false, listaAberta: false, passosAbertos: false, quem: '', lendo: false };

  // ---------- AGORA ----------
  const ANEIS = [['decidir', 'Decidir'], ['entregar', 'Entregar'], ['credito', 'Crédito no ritmo']];
  const C = 2 * Math.PI * 15;
  const aneis = {};
  const SVGNS = 'http://www.w3.org/2000/svg';
  function montar() {
    if ($('fh-agora')) return true;
    const g = $('g-agora'); if (!g) return false;
    const v = owned(el('section', 'fh-view')); v.id = 'fh-agora'; v.setAttribute('aria-label', 'Agora');
    const topo = el('div', 'fh-topo');
    const data = el('span', 'fh-rot'); data.id = 'fh-data';
    const box = el('div', 'fh-aneis');
    for (const [key, label] of ANEIS) {
      const b = el('div', 'fh-anel is-sem'); b.dataset.anel = key;
      const svg = doc.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 36 36'); svg.setAttribute('aria-hidden', 'true');
      for (const cls of ['fh-trilho', 'fh-arco']) {
        const c = doc.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', '18'); c.setAttribute('cy', '18'); c.setAttribute('r', '15'); c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '3'); c.setAttribute('stroke-linecap', 'round'); c.setAttribute('class', cls);
        if (cls === 'fh-arco') { c.setAttribute('stroke-dasharray', String(C)); c.setAttribute('stroke-dashoffset', String(C)); }
        svg.append(c);
      }
      const txt = el('span'); txt.append(el('span', '', label), el('b', '', '?'));
      b.append(svg, txt); box.append(b);
      aneis[key] = { box: b, arco: svg.lastChild, valor: null, texto: txt.lastChild };
    }
    topo.append(data, box);
    const frase = el('h1', 'fh-frase'); frase.id = 'fh-frase';
    const passosL = el('div', 'fh-passos-linha'); passosL.id = 'fh-passos-linha';
    const passos = el('ol', 'fh-passos'); passos.id = 'fh-passos'; passos.hidden = true;
    const lista = el('ol', 'fh-lista'); lista.id = 'fh-lista';
    const mais = el('div', 'fh-mais'); mais.id = 'fh-mais';
    const linhaB = el('div', 'fh-bloco fh-bloco-linha'); const linha = el('div', 'fh-linha'); linha.id = 'fh-linha'; const abre = el('div', 'fh-abre'); abre.id = 'fh-abre'; abre.hidden = true; linhaB.append(linha, abre);
    const diaB = el('section', 'fh-bloco'); diaB.append(el('h2', 'fh-h2', 'Hoje')); const dia = el('ul', 'fh-dia'); dia.id = 'fh-dia';
    const semana = el('button', 'fh-link fh-depois', 'Ver a semana'); semana.type = 'button'; semana.addEventListener('click', () => ir('agora', 'cronograma')); diaB.append(dia, semana);
    const obraB = el('section', 'fh-bloco'); obraB.id = 'fh-obra-bloco'; const obraHost = el('div'); obraHost.id = 'fh-obra'; const obraPe = el('p', 'fh-rot fh-depois'); obraPe.id = 'fh-obra-pe'; obraB.append(el('h2', 'fh-h2', 'Projetos'), obraHost, obraPe);
    const feitoB = el('section', 'fh-bloco'); const fh = el('h2', 'fh-h2'); const fn = el('span', 'fh-num fh-conta-n'); fn.id = 'fh-feito-n'; fh.append(el('span', '', 'Feito hoje'), fn);
    const feito = el('ul', 'fh-feito'); feito.id = 'fh-feito'; const feitoMais = el('p', 'fh-rot'); feitoMais.id = 'fh-feito-mais'; feitoB.append(fh, feito, feitoMais);
    const pe = el('button', 'fh-pe'); pe.type = 'button'; pe.id = 'fh-pe';
    pe.append(el('b', '', 'Para o Claude'), el('span', '', 'Escreva, fale ou cole um print'), el('span', 'fh-kbd', 'Ctrl K'));
    pe.addEventListener('click', () => abrirK());
    v.append(topo, frase, passosL, passos, lista, mais, linhaB, diaB, obraB, feitoB, pe);
    g.after(v);
    // botao Ctrl K na barra (so aparece na folha)
    const right = doc.querySelector('#g-bar .g-right');
    if (right && !$('fh-kbtn')) { const b = owned(el('button', 'fh-kbtn', 'Ctrl K')); b.id = 'fh-kbtn'; b.type = 'button'; b.title = 'Escreva para o seu Claude ou ache qualquer aba'; b.addEventListener('click', () => abrirK()); right.prepend(b); }
    visibilidade();
    return true;
  }
  function visibilidade() {
    const on = ativo();
    for (const id of ['fh-agora', 'fh-kbtn']) { const n = $(id); if (n) n.hidden = !on; }
    if (!on && S.k) fecharK();
  }

  function setAnel(key, valor, linha, titulo) {
    const a = aneis[key]; if (!a) return;
    a.texto.textContent = linha;
    a.box.title = titulo || (ANEIS.find(x => x[0] === key)[1] + ': ' + linha);
    const antes = a.valor;
    a.box.classList.toggle('is-sem', valor === null);
    if (valor === null) { a.arco.setAttribute('stroke-dashoffset', String(C)); a.valor = null; return; }
    const v = Math.max(0, Math.min(1, valor));
    a.arco.setAttribute('stroke-dashoffset', String(C * (1 - v)));
    a.box.classList.toggle('is-cheio', v >= 1);
    // so o anel que fechou acende rosa por 1 s (e so quando ja havia leitura antes)
    if (antes !== null && antes < 1 && v >= 1 && motion()) { a.box.classList.remove('is-acende'); void a.box.offsetWidth; a.box.classList.add('is-acende'); root.setTimeout(() => a.box.classList.remove('is-acende'), 1000); }
    a.valor = v;
  }

  function tituloCard(c) {
    if (!c || c.restrito || !c.pergunta) return 'Card da ' + (c && c.sessao || '?') + ' (só no chat)';
    const t = String(c.pergunta).replace(/\s+/g, ' ').trim();
    const frases = t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ@"(])/);
    const q = frases.find(f => /\?$/.test(f.trim()) && f.length <= 160);
    return (q || frases[0]).trim();
  }
  function cardsPend() {
    const a = S.agora; if (!a || !a.cards || !Array.isArray(a.cards.pendentes)) return null;
    return a.cards.pendentes.map(c => ({ id: 'card:' + c.arquivo, titulo: tituloCard(c), onde: c.perigoso || c.bloqueado ? (c.ondeResponder || 'chat da ' + c.sessao) : 'painel ou chat da ' + c.sessao, quando: stamp(c.ordem), card: c }));
  }
  function ev() { const e = S.agora && S.agora.esperaVoce; return e && e.ok === true && Array.isArray(e.itens) ? e : null; }
  function passosDele() {
    const e = ev(); if (!e) return null;
    return e.itens.filter(i => i && i.tipo !== 'card').map(i => ({ titulo: String(i.titulo || 'Passo com detalhe só no chat'), onde: i.onde || '?', quando: i.dataTexto || '', passo: i }));
  }
  function foraDaConta() { const e = ev(); return e && e.semData && Array.isArray(e.semData.itens) ? e.semData.itens.map(i => ({ titulo: String(i.titulo || 'Passo com detalhe só no chat'), nota: i.nota || '' })) : []; }

  function rotuloRodando(t) {
    const s = String(t || '').replace(/^Codex VPS:\s*/i, 'Codex na VPS: '), i = s.indexOf(': ');
    if (i < 0) return s;
    return s.slice(0, i + 2) + s.slice(i + 2).replace(/^n-(?=[a-z])/i, '').replace(/-\d{6,}\b/g, '').replace(/-/g, ' ');
  }
  function eventosHoje() {
    const now = Date.now(), ev = [];
    const semana = S.crono && S.crono.lido !== false && Array.isArray(S.crono.semana) ? S.crono.semana : [];
    for (const d of semana) for (const i of Array.isArray(d.itens) ? d.itens : []) {
      const dia = i.data || d.dia; let t = stamp(i.at), utc = '';
      if (t === null && dia) {
        const m = /(\d{1,2}):(\d{2})\s*UTC/i.exec(i.o_que || '');
        if (m) { t = Date.parse(dia + 'T' + pad(m[1]) + ':' + m[2] + ':00Z'); utc = pad(m[1]) + ':' + m[2] + ' UTC'; }
        else if (/^\d{1,2}:\d{2}$/.test(i.hora || '')) { const [y, mo, da] = String(dia).split('-').map(Number), [h, mi] = i.hora.split(':').map(Number); t = new Date(y, mo - 1, da, h, mi).getTime(); }
      }
      if (t !== null && sameDay(t, now)) ev.push({ t, texto: String(i.o_que || '?').replace(/\s*\d{1,2}:\d{2}\s*UTC\s*/i, ' ').trim(), extra: utc });
    }
    // o Hoje tambem le a previsao do gerador de projetos (/api/cronograma, itens com horaFonte previsao)
    for (const i of S.crono && S.crono.lido !== false && Array.isArray(S.crono.hoje) ? S.crono.hoje : []) { if (i.horaFonte !== 'previsao') continue; const t = stamp(i.at); if (t !== null && sameDay(t, now)) ev.push({ t, texto: String(i.o_que || '?'), extra: '' }); }
    for (const r of (S.agora && S.agora.agora && S.agora.agora.rodando) || []) {
      const m = /desde (\d{1,2}):(\d{2})/.exec(r.quando || ''); if (!m) continue;
      const d = new Date(); d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      ev.push({ t: d.getTime(), texto: rotuloRodando(r.o_que) + ' começou', extra: '' });
    }
    const depois = ev.filter(e => e.t >= now).sort((a, b) => a.t - b.t), antes = ev.filter(e => e.t < now).sort((a, b) => b.t - a.t);
    const pick = [...depois.slice(0, 1), ...antes.slice(0, 1), ...depois.slice(1), ...antes.slice(1)].slice(0, 2);
    return { lista: pick.sort((a, b) => a.t - b.t), total: ev.length };
  }
  function ritmo(c) {
    if (!c || !Number.isFinite(c.semana)) return null;
    const zera = stamp(c.zeraEm); if (zera === null) return null;
    const passou = Math.max(0, Math.min(1, 1 - (zera - Date.now()) / (7 * 86400000))), usado = c.semana / 100;
    return { passou, usado, nota: usado <= passou ? 1 : (usado ? passou / usado : 1) };
  }

  function paint(fechados) {
    if (!$('fh-agora') || !ativo()) return;
    const cards = cardsPend(), passos = passosDele(), lido = S.agoraAt;
    const fonte = S.agora && S.agora.agora && S.agora.agora.atualizadoEm ? stamp(S.agora.agora.atualizadoEm) : null;
    $('fh-data').textContent = dataLonga(Date.now()) + ' · lido ' + (S.agoraFail || lido === null ? '?' : hhmm(lido)) + (S.agora && S.agora.agora && S.agora.agora.stale && fonte ? ' · fonte de ' + hhmm(fonte) : '');
    $('fh-data').title = fonte ? 'O estado do seu Claude foi escrito às ' + hhmm(fonte) : 'Sem horário da fonte';
    const frase = $('fh-frase'), lista = $('fh-lista'), mais = $('fh-mais'), pl = $('fh-passos-linha'), pul = $('fh-passos');
    const v = $('fh-agora');
    v.classList.remove('is-vazia');
    lista.replaceChildren(); mais.replaceChildren(); pl.replaceChildren(); pul.replaceChildren();
    if (cards === null) {
      frase.textContent = S.agoraFail ? '? coisas esperam você.' : 'Lendo o que espera você.';
      if (S.agoraFail) { const b = el('button', 'fh-link', 'Ler de novo'); b.type = 'button'; b.addEventListener('click', () => ler()); mais.append(b); }
      pul.hidden = true;
    } else if (!cards.length && !(passos && passos.length)) {
      // premio maior: tela vazia, sempre com o horario da leitura
      v.classList.add('is-vazia');
      const n = S.hoje && Number.isFinite(S.hoje.decididasHoje) ? S.hoje.decididasHoje : null;
      frase.textContent = 'Nada espera você.';
      const p = el('li', 'fh-vazia'); p.append(el('p', '', (n === null ? '? decididas hoje' : n + (n === 1 ? ' decidida hoje' : ' decididas hoje')) + ' · lido ' + (lido ? hhmm(lido) : '?')));
      const seq = mesaLimpa(); if (seq >= 1) p.append(el('p', '', seq === 1 ? 'Primeiro dia de mesa limpa.' : seq + ' dias seguidos de mesa limpa.'));
      lista.append(p); pul.hidden = true;
    } else {
      const e = ev(), total = cards.length + (passos ? passos.length : 0);
      frase.textContent = e && e.rotulo ? e.rotulo.charAt(0).toUpperCase() + e.rotulo.slice(1) + '.' : total === 1 ? '1 coisa espera você.' : total + ' coisas esperam você.';
      const fora = foraDaConta();
      if (fora.length) {
        const b = el('button', 'fh-passos-bt'); b.type = 'button'; b.setAttribute('aria-expanded', String(S.passosAbertos));
        b.append(el('span', '', 'Fora da conta (' + fora.length + ')'), el('i', 'fh-seta', S.passosAbertos ? 'esconder' : 'ver'));
        b.title = 'Passos à mão sem data ou esperando algo chegar. Não entram na conta da frase.';
        b.addEventListener('click', () => { S.passosAbertos = !S.passosAbertos; paint(); });
        pl.append(b);
        fora.forEach(p => { const li = el('li'); li.append(el('span', 'fh-n', '·'), el('span', 'fh-p-txt', p.titulo), el('span', 'fh-p-onde', p.nota)); li.title = p.titulo + (p.nota ? ' · ' + p.nota : ''); pul.append(li); });
        pul.hidden = !S.passosAbertos;
      } else if (passos === null) pl.append(el('span', 'fh-rot', '? passos seus (sem leitura do estado). Solução: clique em Ler de novo; se seguir, reinicie o painel'));
      else pul.hidden = true;
      const fechando = new Set(fechados || []);
      cards.forEach((it, i) => {
        const li = el('li', 'fh-item' + (i === 0 ? ' is-acao' : '') + (i >= 3 && !S.listaAberta ? ' is-extra' : ''));
        li.dataset.id = it.id;
        li.append(el('span', 'fh-n', String(i + 1)));
        const o = el('button', 'fh-o'); o.type = 'button'; o.addEventListener('click', () => abrirCard(it));
        o.append(el('strong', '', it.titulo));
        const onde = el('span', 'fh-onde', it.onde); if (it.quando && Number.isFinite(it.quando)) onde.append(el('i', '', ' · ' + rel(it.quando)));
        o.append(onde); li.append(o);
        if (i === 0) { const b = el('button', 'fh-btn', 'Abrir'); b.type = 'button'; b.addEventListener('click', () => abrirCard(it)); li.append(b); } else li.append(el('span'));
        if (fechando.has(it.id)) li.classList.add('is-fechando');
        lista.append(li);
      });
      // os passos com hora entram na mesma lista, numerados depois dos cards (a conta da frase e a da lista sao a mesma)
      (passos || []).forEach((p, j) => { const i = cards.length + j; const li = el('li', 'fh-item fh-item-passo' + (i === 0 ? ' is-acao' : '') + (i >= 3 && !S.listaAberta ? ' is-extra' : '')); li.dataset.id = 'passo:' + j; const o = el('div', 'fh-o'); o.append(el('strong', '', p.titulo), el('span', 'fh-onde', 'seu passo · ' + p.onde + (p.quando ? ' · ' + p.quando : ''))); li.append(el('span', 'fh-n', String(i + 1)), o, el('span')); lista.append(li); });
      if (cards.length + (passos ? passos.length : 0) > 3) {
        const b = el('button', 'fh-link', S.listaAberta ? 'Mostrar só 3' : 'Mais ' + (cards.length + (passos ? passos.length : 0) - 3)); b.type = 'button';
        b.addEventListener('click', () => { S.listaAberta = !S.listaAberta; paint(); });
        mais.append(b);
      }
      if (cards.length) { const tudo = el('button', 'fh-link', 'Ver todos os cards'); tudo.type = 'button'; tudo.title = 'Os cards de sempre, com as opções para escolher'; tudo.addEventListener('click', () => abrirDecidir()); mais.append(tudo); }
    }
    paintLinha(); paintAneis(); paintDia(); paintFeito(fechados);
  }

  function mesaLimpa() {
    // fica so neste navegador (localStorage); a versao final grava no estado
    const hoje = new Date(), key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    let dias = [];
    try { dias = JSON.parse(root.localStorage.getItem('folha-mesa-limpa-v1') || '[]'); if (!Array.isArray(dias)) dias = []; } catch { dias = []; }
    if (!S.demo && !dias.includes(key(hoje))) { dias.push(key(hoje)); dias = dias.slice(-60); try { root.localStorage.setItem('folha-mesa-limpa-v1', JSON.stringify(dias)); } catch { /* so nesta visita */ } }
    let n = 0; const d = new Date(hoje);
    while (dias.includes(key(d)) || (n === 0 && S.demo)) { n++; d.setDate(d.getDate() - 1); if (n > 60) break; }
    return n;
  }

  function paintLinha() {
    const linha = $('fh-linha'), abre = $('fh-abre'); if (!linha) return;
    const a = S.agora && S.agora.agora;
    // (so trabalho comprovado, com quem). Sem leitura: "?". A conta antiga (PainelAtividade.agentes, "9+") nao entra mais.
    const V = vistas(); let conta = null; try { conta = V && typeof V.anda === 'function' ? V.anda() : null; } catch { conta = null; }
    const n = conta && Number.isInteger(conta.n) ? conta.n : null;
    linha.replaceChildren();
    const anda = el('button'); anda.type = 'button'; anda.setAttribute('aria-expanded', String(S.quem === 'anda'));
    anda.append(dot(n ? 'is-anda' : 'is-dorme'), el('span', 'fh-rotulo', 'Andando'), el('span', 'fh-anda-n', n === null ? '?' : String(n)));
    anda.title = n === null ? 'Sem leitura das conversas ainda (?) Solução: o painel relê sozinho a cada 15 s' : conta.frase;
    anda.addEventListener('click', () => { S.quem = S.quem === 'anda' ? '' : 'anda'; paintLinha(); });
    const travados = a && Array.isArray(a.travado) && !(a.unavailable || []).includes('travado') ? a.travado : null;
    const trav = el('button'); trav.type = 'button'; trav.setAttribute('aria-expanded', String(S.quem === 'trav'));
    trav.append(dot(travados && travados.length ? 'is-travou' : 'is-dorme'), el('span', 'fh-rotulo', 'Travado'), el('span', '', travados ? String(travados.length) : '?'));
    trav.addEventListener('click', () => { S.quem = S.quem === 'trav' ? '' : 'trav'; paintLinha(); });
    const cred = el('span', 'fh-contas'); cred.append(el('span', 'fh-rotulo', 'Crédito'));
    const contas = S.contas && Array.isArray(S.contas.contas) ? S.contas.contas : null;
    if (!contas) cred.append(el('span', '', '?'));
    else for (const c of contas) {
      const u = Number.isFinite(c.semana) ? c.semana : null;
      const sp = el('span', 'fh-conta' + (c.atual ? ' is-atual' : ''));
      sp.append(dot(u === null ? 'is-dorme' : u >= 100 ? 'is-dorme' : u >= 80 ? 'is-travou' : 'is-anda'), el('span', '', c.conta));
      sp.title = 'Conta ' + c.conta + (c.atual ? ' (a atual)' : '') + ': ' + (u === null ? '?' : u + '% usado na semana') + (stamp(c.zeraSemana) ? ', zera ' + ddmm(stamp(c.zeraSemana)) + ' ' + hhmm(stamp(c.zeraSemana)) : '') + (stamp(c.lidoEm) ? ' · lida ' + rel(stamp(c.lidoEm)) : '');
      cred.append(sp);
    }
    const cx = a && a.credito && a.credito.codex;
    if (cx && Number.isFinite(cx.semana)) { const sp = el('span', 'fh-conta'); sp.append(dot(cx.semana >= 100 ? 'is-dorme' : cx.semana >= 80 ? 'is-travou' : 'is-anda'), el('span', '', 'Codex')); sp.title = 'Codex: ' + cx.semana + '% usado na semana' + (stamp(cx.zeraEm) ? ', zera ' + ddmm(stamp(cx.zeraEm)) + ' ' + hhmm(stamp(cx.zeraEm)) : ''); cred.append(sp); }
    linha.append(anda, trav, cred);
    abre.replaceChildren(); abre.hidden = !S.quem;
    if (S.quem === 'anda') {
      // o mesmo "quem" da Grade e do Livro: a frase da conta unica + o que o estado diz que roda (sem a rodada pausada nem a da VPS sem leitura)
      const rodando = ((a && a.rodando) || []).filter(r => !/indispon/i.test(r.o_que || '')).map(r => rotuloRodando(r.o_que));
      const frase = conta && typeof conta.frase === 'string' ? conta.frase : '? sem leitura das conversas. Solução: o painel relê sozinho a cada 15 s';
      abre.append(el('p', 'fh-anda-quem', frase + (rodando.length ? ' · no estado: ' + rodando.join(', ') : '') + '.'));
      const semVps = V && typeof V.vpsSemLeitura === 'function' ? V.vpsSemLeitura(a) : '';
      if (semVps) abre.append(el('p', 'fh-anda-vps', semVps));
      const l = el('button', 'fh-link', 'Ver o Fluxo'); l.type = 'button'; l.addEventListener('click', () => ir('equipe', 'fluxo')); abre.append(l);
    }
    if (S.quem === 'trav') {
      if (!travados) abre.append(el('p', '', (a && a.semLeitura && a.semLeitura.travado) || '? sem leitura'));
      else if (!travados.length) abre.append(el('p', '', 'Nada travado.'));
      else for (const t of travados) abre.append(el('p', '', t));
    }
  }

  function paintAneis() {
    const h = S.hoje, pend = S.agora && S.agora.cards && S.agora.cards.pendentes;
    if (h && Number.isFinite(h.decididasHoje) && Array.isArray(pend)) { const tot = h.decididasHoje + pend.length; setAnel('decidir', tot ? h.decididasHoje / tot : 1, h.decididasHoje + ' de ' + tot, 'Decidir: cards decididos hoje sobre decididos + os que esperam você.'); }
    else setAnel('decidir', null, '?');
    const semana = S.crono && S.crono.lido !== false && Array.isArray(S.crono.semana) ? S.crono.semana.flatMap(d => d.itens || []) : null;
    if (semana && semana.length) { const f = semana.filter(i => i.estado === 'feito').length; setAnel('entregar', f / semana.length, f + ' de ' + semana.length + ' na semana', 'Entregar: itens feitos da semana no cronograma.'); }
    else setAnel('entregar', null, '?');
    // Claude: o numero do estado; sem ele, a conta atual do /api/contas-claude (a mesma faixa CONTAS da GRADE). Nada inventado.
    const cr = S.agora && S.agora.agora && S.agora.agora.credito, davez = S.contas && Array.isArray(S.contas.contas) ? S.contas.contas.find(c => c.atual) : null;
    const a = ritmo(cr && cr.claude) || ritmo(davez ? { semana: davez.semana, zeraEm: davez.zeraSemana } : null), b = ritmo(cr && cr.codex);
    if (a || b) {
      const pior = [['Claude', a], ['Codex', b]].filter(x => x[1]).sort((x, y) => x[1].nota - y[1].nota)[0];
      setAnel('credito', pior[1].nota, pior[1].nota >= 1 ? 'no ritmo' : pior[0] + ' acima do ritmo',
        'Crédito no ritmo: ' + [['Claude', a], ['Codex', b]].filter(x => x[1]).map(([nm, r]) => nm + ' usou ' + Math.round(r.usado * 100) + '%, a semana andou ' + Math.round(r.passou * 100) + '%').join(' · '));
    } else setAnel('credito', null, '?');
  }

  function paintDia() {
    const ul = $('fh-dia'); if (!ul) return;
    ul.replaceChildren();
    if (!S.agora && !S.crono) { ul.append(el('li', '', '?')); return; }
    const { lista } = eventosHoje();
    if (!lista.length) { const li = el('li'); li.append(el('time', '', '·'), el('span', 'fh-sec', S.crono && S.crono.automatico && S.crono.automatico.ok === false ? '? Sem leitura do gerador de projetos. Solução: ' + S.crono.automatico.solucao : 'Nada com hora hoje.')); ul.append(li); return; }
    for (const e of lista) {
      const li = el('li', e.t >= Date.now() ? 'is-depois' : ''); const tx = el('span', '', e.texto); if (e.extra) tx.append(el('span', 'fh-rot', ' · ' + e.extra));
      li.append(el('time', '', hhmm(e.t)), tx); ul.append(li);
    }
  }

  function paintFeito(fechados) {
    const ul = $('fh-feito'); if (!ul) return;
    const h = S.hoje, lista = h && Array.isArray(h.ultimos) ? h.ultimos : null;
    const n = h && Number.isFinite(h.decididasHoje) ? h.decididasHoje : null;
    const nEl = $('fh-feito-n'), antes = nEl.textContent;
    nEl.textContent = n === null ? '?' : n === 0 ? 'none' : String(n);
    if (fechados && fechados.length && antes !== nEl.textContent && motion()) { nEl.classList.remove('is-sobe'); void nEl.offsetWidth; nEl.classList.add('is-sobe'); }
    ul.replaceChildren();
    if (!lista) { ul.append(el('li', '', '?')); $('fh-feito-mais').textContent = ''; return; }
    if (!lista.length) { const li = el('li'); li.append(el('time', '', '·'), el('span', '', 'Nada decidido hoje ainda.')); ul.append(li); }
    const novos = new Set((fechados || []).map(id => id.replace(/^card:/, '')));
    for (const c of lista) {
      const li = el('li', novos.has(c.arquivo) ? 'is-novo' : '');
      const sp = el('span', '', tituloCard(c)); sp.append(el('i', '', ' · ' + c.sessao));
      li.append(el('time', '', hhmm(stamp(c.ordemResp))), sp); ul.append(li);
    }
    $('fh-feito-mais').textContent = n !== null && n > lista.length ? 'e mais ' + (n - lista.length) + ' antes destes, hoje' : '';
  }

  // recompensa: o card que saiu da lista risca, desliza e cai em Feito hoje
  function aplicar(next) {
    const antes = S.prevIds;
    S.agora = next;
    const cards = cardsPend(), ids = cards ? new Set(cards.map(i => i.id)) : null;
    const fechados = antes && ids ? [...antes].filter(id => !ids.has(id)) : [];
    S.prevIds = ids;
    if (fechados.length && motion() && ativo() && noAgora() && $('fh-lista')) {
      for (const id of fechados) { const li = $('fh-lista').querySelector('[data-id="' + CSS.escape(id) + '"]'); if (li) li.classList.add('is-fechando'); }
      // som: entraria aqui (desligado; o mudo do painel continua valendo)
      root.setTimeout(() => paint(fechados), 600);
    } else paint(fechados);
  }

  async function ler() {
    if (S.demo || S.lendo || !ativo()) return;
    S.lendo = true;
    // cada leitura pinta quando chega (o servidor do painel e 1 fio so e as vezes demora); o card que fechou espera o
    // "decididas hoje" novo para cair em Feito hoje com a conta certa
    const hj = getJson('/api/folha/hoje').then(v => { if (v && v.ok) S.hoje = v; }).catch(() => {});
    const ct = getJson('/api/contas-claude').then(v => { S.contas = v; if (S.agora) paintLinha(); }).catch(() => {});
    const cr = getJson('/api/cronograma').then(v => { S.crono = v; if (S.agora) { paintAneis(); paintDia(); } }).catch(() => {});
    try {
      const ag = await getJson('/api/agora').catch(() => null);
      let hjOk = false; hj.then(() => { hjOk = true; });
      await Promise.race([hj, new Promise(ok => root.setTimeout(ok, 1500))]);
      const tarde = !hjOk;
      if (ag && ag.ok) { S.agoraFail = false; S.agoraAt = Date.now(); aplicar(ag); }
      else { S.agoraFail = true; paint(); }
      if (tarde) { await hj; if (S.agora) { paintAneis(); paintFeito(); } }
      await Promise.allSettled([ct, cr]);
    } finally { S.lendo = false; }
    lerObra();
  }

  // Projetos D (Painel de LED), escolhido pelo dono: o mesmo modulo e a mesma fonte da GRADE, no estilo da folha
  async function lerObra() {
    const host = $('fh-obra'), P = root.PainelObraPixel; if (!host) return;
    if (!P || typeof P.create !== 'function') { host.replaceChildren(el('p', 'fh-sec', '? o painel de LED não carregou')); return; }
    if (!S.obraUi) { owned(host); S.obraUi = P.create(doc, host, 'd'); }
    try {
      const j = await getJson('/api/obra');
      if (!j || j.ok !== true || !Array.isArray(j.data && j.data.projects)) throw Error('obra');
      S.obraUi.update(j.data);
      const pe = $('fh-obra-pe'); if (pe) pe.textContent = 'Painel de LED · 1 LED = 1 item da lista, o que está no ar enche de baixo · lido ' + hhmm(stamp(j.data.readAt)) + ' · passe o mouse num LED para ver o item, clique no projeto para a lista';
    } catch { S.obraUi.error(); }
  }

  // ---------- lateral do card (so leitura) e os cards de sempre ----------
  let lado = null;
  function abrirLado(build) {
    if (!lado) {
      lado = owned(el('dialog', 'fh-lado')); lado.id = 'fh-lado'; lado.setAttribute('aria-label', 'Detalhe');
      lado.addEventListener('click', e => { if (e.target === lado) lado.close(); });
      noCorpo(lado);
    }
    const inner = el('div', 'fh-lado-in'), top = el('div', 'fh-lado-top'), x = el('button', 'fh-x', 'Fechar · Esc'); x.type = 'button'; x.addEventListener('click', () => lado.close());
    const kick = el('span', 'fh-rot'); top.append(kick, x); inner.append(top);
    build(inner, kick);
    lado.replaceChildren(inner);
    if (!lado.open) lado.showModal();
  }
  function abrirDecidir(arquivo) {
    const dlg = $('g-decidir'); if (!dlg) return;
    if (lado && lado.open) lado.close();
    if (!dlg.open) dlg.showModal();
    const alvo = arquivo && dlg.querySelector('[data-foco="titulo:' + CSS.escape(arquivo) + '"]');
    if (alvo) { const art = alvo.closest('article'); if (art) art.scrollIntoView({ block: 'start' }); }
  }
  function abrirCard(it) {
    const c = it.card;
    abrirLado((box, kick) => {
      kick.textContent = (c.tipo || 'card') + ' · ' + c.sessao + ' · ' + (c.criado || '?');
      box.append(el('h2', '', tituloCard(c)));
      if (c.pergunta && tituloCard(c) !== c.pergunta) box.append(el('p', 'fh-sec', c.pergunta));
      if (Array.isArray(c.opcoes) && c.opcoes.length) {
        box.append(el('span', 'fh-rot', 'Opções'));
        for (const o of c.opcoes) {
          const d = el('div', 'fh-op'), s = el('strong'); if (o.recomendada) s.append(dot('is-voce')); s.append(el('span', '', o.label + (o.recomendada ? ' (recomendada)' : '')));
          d.append(s); if (o.descricao) d.append(el('span', '', o.descricao)); box.append(d);
        }
      }
      box.append(el('span', 'fh-rot', 'Onde responder'), el('p', '', c.avisoPerigo || ('Responda no ' + it.onde + '.')));
      const ac = el('div', 'fh-acoes');
      if (!c.perigoso && !c.bloqueado && $('g-decidir')) { const b = el('button', 'fh-btn', 'Escolher'); b.type = 'button'; b.title = 'Abre os cards de sempre, que respondem pelo caminho de sempre'; b.addEventListener('click', () => abrirDecidir(c.arquivo)); ac.append(b); }
      if (c.chatLink) { const a = el('a', c.perigoso || c.bloqueado ? 'fh-btn' : 'fh-link', 'Abrir o chat'); a.href = c.chatLink; ac.append(a); }
      box.append(ac);
    });
  }

  // ---------- Ctrl K: a caixa de sempre no centro + achar aba (estilo Raycast) ----------
  // As abas e sub vistas de hoje (vistas.js TABS). Se a marcacao comum mudar de nome, troque aqui.
  const DESTINOS = [
    ['agora', 'agora', 'Agora', 'o que espera você', 'inicio hoje'], ['agora', 'lancamentos', 'Lançamentos', 'Agora', ''], ['agora', 'cronograma', 'Cronograma', 'Agora', 'semana calendario'], ['agora', 'rotina', 'Rotina', 'Agora', 'marcha'],
    ['equipe', 'fluxo', 'Equipe', 'quem fala com quem', 'fluxo time'], ['equipe', 'arvore', 'Árvore', 'Equipe', 'arvore'], ['equipe', 'sessoes', 'Sessões', 'Equipe', 'sessoes conversas'], ['equipe', 'historico', 'Histórico', 'Equipe', 'historico'],
    ['fila', 'fila', 'Fila', 'tasks', 'tarefas'], ['fila', 'projetos', 'Projetos', 'Fila', ''],
    ['decidir', 'ideias', 'Decidir', 'ideias', 'ideias'], ['decidir', 'conselho', 'Conselho', 'Decidir', 'agentes'], ['decidir', 'radar', 'Radar', 'Decidir', ''],
    ['cerebro', 'mapa', 'Cérebro', 'o mapa', 'mapa memoria cerebro'], ['cerebro', 'habitos', 'Hábitos', 'Cérebro', 'alimente dicas habitos'], ['cerebro', 'historia', 'História', 'Cérebro', 'linha do tempo jornada historia'], ['cerebro', 'mapa-antigo', 'Mapa antigo', 'Cérebro', ''],
    ['caixa', 'financas', 'Caixa', 'finanças', 'financas dinheiro'], ['caixa', 'consumo', 'Consumo', 'Caixa', 'credito tokens']
  ];
  const PADRAO = new Set(['agora.agora', 'equipe.fluxo', 'fila.fila', 'decidir.ideias', 'cerebro.mapa', 'caixa.financas']);
  let fundo = null, klist = null, kSel = 0, kItens = [];
  function destinos() {
    const out = DESTINOS.map(([tab, view, titulo, onde, alias]) => ({ key: tab + '.' + view, tab, view, titulo, onde, busca: norm([titulo, onde, alias].join(' ')) }));
    out.push({ key: '!cards', titulo: 'Ver todos os cards', onde: 'espera você', busca: 'cards decidir escolher espera' });
    out.push({ key: '!wen', titulo: 'WEN', onde: 'tecla W', busca: 'wen status previsao' });
    out.push({ key: '!motion', titulo: 'Movimento liga e desliga', onde: 'ajuste', busca: 'movimento motion animacao' });
    return out;
  }
  const texto = () => { const t = $('cx-texto'); return t ? t.value : ''; };
  function paintK() {
    if (!klist) return;
    const q = norm(texto()), todos = destinos();
    kItens = q ? todos.filter(d => d.busca.includes(q) || q.split(/\s+/).every(w => d.busca.includes(w))).slice(0, 7) : todos.filter(d => PADRAO.has(d.key) || d.key === '!cards');
    if (kSel >= kItens.length) kSel = 0;
    klist.replaceChildren();
    kItens.forEach((d, i) => {
      const li = el('li'); li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === kSel));
      li.append(el('b', '', d.titulo), el('small', '', d.onde));
      li.addEventListener('mousedown', e => { e.preventDefault(); escolherK(d); });
      klist.append(li);
    });
    klist.append(el('li', 'fh-k-dica', kItens.length ? (q ? 'Enter abre · Ctrl Enter manda o texto para o seu Claude · Esc fecha' : 'Escreva para o seu Claude, ou o nome de qualquer aba, nova ou antiga') : 'Nenhuma aba com esse nome · Enter manda o texto para o seu Claude, com tempo para desfazer'));
    posicionarK();
  }
  function posicionarK() { const box = $('g-dock') || $('painel-caixa'); if (!box || !klist) return; const r = box.getBoundingClientRect(); klist.style.top = Math.round(r.bottom) + 'px'; }
  function escolherK(d) {
    // o texto era so a busca da aba: limpa a caixa para nao sobrar rascunho
    const t = $('cx-texto'); if (t && t.value && t.value.length <= 24) { t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); }
    fecharK();
    if (d.key === '!wen') { const w = $('wen-trigger'); if (w) w.click(); return; }
    if (d.key === '!motion') { const m = $('motion-toggle'); if (m) m.click(); return; }
    if (d.key === '!cards') { abrirDecidir(); return; }
    ir(d.tab, d.view);
  }
  function abrirK() {
    if (!ativo()) return;
    if (!fundo) {
      fundo = owned(el('div', 'fh-k-fundo')); fundo.addEventListener('mousedown', fecharK); noCorpo(fundo);
      klist = owned(el('ul', 'fh-k-lista')); klist.setAttribute('role', 'listbox'); klist.setAttribute('aria-label', 'Ir para'); noCorpo(klist);
    }
    html.classList.add('fh-k-open'); S.k = true; kSel = 0;
    const t = $('cx-texto');
    if (t && !t.dataset.fhK) { t.dataset.fhK = '1'; t.addEventListener('input', () => { if (S.k) { kSel = 0; paintK(); } }); }
    paintK();
    root.requestAnimationFrame(() => { posicionarK(); if (t) t.focus(); });
  }
  function fecharK() { html.classList.remove('fh-k-open'); S.k = false; const a = doc.activeElement; if (a && a.id === 'cx-texto') a.blur(); }
  const digitando = e => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
  root.addEventListener('keydown', e => {
    if (!ativo()) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(k).toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); if (S.k) fecharK(); else abrirK(); return; }
    if (S.k) {
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fecharK(); return; }
      const campo = e.target && e.target.id === 'cx-texto';
      if (campo && (k === 'ArrowDown' || k === 'ArrowUp') && !String(e.target.value).includes('\n') && kItens.length) { e.preventDefault(); e.stopImmediatePropagation(); kSel = (kSel + (k === 'ArrowDown' ? 1 : -1) + kItens.length) % kItens.length; paintK(); return; }
      // Enter sem modificador abre a aba escolhida; sem aba casando, segue para a caixa (que manda com tempo para desfazer)
      if (campo && k === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.isComposing && kItens.length) { e.preventDefault(); e.stopImmediatePropagation(); escolherK(kItens[kSel]); return; }
      return;
    }
    if (digitando(e) || e.ctrlKey || e.metaKey || e.altKey || doc.querySelector('dialog[open]')) return;
    if (k === '/') { e.preventDefault(); e.stopImmediatePropagation(); abrirK(); return; } // na folha a caixa mora no Ctrl K
    if (k === 'w' || k === 'W') { const b = $('wen-trigger'); if (b) { e.preventDefault(); b.click(); } }
  }, true);
  root.addEventListener('resize', () => { if (S.k) posicionarK(); });

  // ---------- CEREBRO na folha: pontos redondos na cor do tipo, por cima do mapa comum ----------
  // O mapa comum (vistas.js) desenha quadrados cinza de 4 px. Aqui o MESMO layout (CerebroModelo.layout, mesma conta do
  // vistas.js) vira pontos na cor do tipo (CerebroModelo.colors), com um brilho suave por grupo. O canvas comum fica
  const CB = { d: null, at: 0, pos: null, hover: null, sel: null, lendo: false, t: 0 };
  const noCerebro = () => html.dataset.gNew === 'cerebro';
  const rgba = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return 'rgba(161,161,170,' + a + ')'; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
  async function lerCerebro() {
    if (CB.lendo || (CB.d && Date.now() - CB.at < 60000)) { cerebro(); return; }
    CB.lendo = true;
    try { const d = await getJson('/api/cerebro'); if (d && Array.isArray(d.nodes) && Array.isArray(d.edges)) { CB.d = d; CB.at = Date.now(); CB.pos = null; } } catch { /* fica o mapa comum */ } finally { CB.lendo = false; }
    cerebro();
  }
  function cbPontos(w) {
    const d = CB.d, M = root.CerebroModelo, hh = 560;
    const vivos = (d.live || []).filter(n => n.fresh).map(n => ({ ...n, live: true, tipo: 'project', grupo: 'dominio', region: 'Sessoes' }));
    const nodes = [...d.nodes, ...vivos], edges = [...d.edges, ...vivos.filter(n => n.target && d.nodes.some(m => m.id === n.target)).map(n => ({ de: n.target, para: n.id }))];
    const lay = M.layout(nodes, edges, false);
    const map = (nx, ny) => [Math.round((w / 2 + nx * w * 1.06) / 4) * 4, Math.round((hh / 2 - 8 + ny * hh * 0.9) / 4) * 4];
    const grau = new Map(); for (const e of edges) { grau.set(e.de, (grau.get(e.de) || 0) + 1); grau.set(e.para, (grau.get(e.para) || 0) + 1); }
    const pts = lay.nodes.map(n => { const [x, y] = map(n.x, n.y); return { ...n, px: Math.max(4, Math.min(w - 8, x)), py: Math.max(32, Math.min(hh - 12, y)), grau: grau.get(n.id) || 0 }; });
    const byId = new Map(pts.map(p => [p.id, p]));
    const grupos = M.regions.map(r => {
      const g = pts.filter(p => p.region === r); if (!g.length) return null;
      const cx = g.reduce((s, p) => s + p.px, 0) / g.length, cy = g.reduce((s, p) => s + p.py, 0) / g.length, xs = g.map(p => p.px);
      const conta = {}; for (const p of g) conta[p.tipo] = (conta[p.tipo] || 0) + 1; const tipo = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0];
      return { nome: (M.names[r] || r).toUpperCase(), x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2), y: Math.min(...g.map(p => p.py)) - 16, cx, cy, r: Math.max(60, Math.max(...g.map(p => Math.hypot(p.px - cx, p.py - cy))) + 36), cor: M.colors[tipo] };
    }).filter(Boolean);
    if (!CB.sel || !byId.has(CB.sel)) CB.sel = (pts.filter(p => !p.live).sort((p, q) => q.grau - p.grau)[0] || {}).id || null;
    return { w, pts, byId, edges, grupos };
  }
  function cbPerto(base, ev) {
    const P = CB.pos; if (!P) return null; const r = base.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = 100; for (const p of P.pts) { const dx = p.px + 2 - mx, dy = p.py + 2 - my, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = p; } } return best;
  }
  function cbDesenhar() {
    const wrap = doc.querySelector('#g-cerebro .g-cerebro-mapa'), c = wrap && wrap.querySelector('canvas.fh-cb'), base = wrap && wrap.querySelector('canvas:not(.fh-cb)'), M = root.CerebroModelo;
    if (!c || !base || !CB.d || !M) return;
    const w = base.clientWidth, hh = 560, dpr = root.devicePixelRatio || 1; if (!w) return;
    if (!CB.pos || CB.pos.w !== w) CB.pos = cbPontos(w);
    const P = CB.pos; c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); c.style.width = w + 'px'; c.style.height = hh + 'px';
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, hh);
    for (const g of P.grupos) { const gr = x.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.r); gr.addColorStop(0, rgba(g.cor, .09)); gr.addColorStop(1, rgba(g.cor, 0)); x.fillStyle = gr; x.fillRect(g.cx - g.r, g.cy - g.r, 2 * g.r, 2 * g.r); }
    const foco = CB.hover || (CB.sel && P.byId.get(CB.sel)), used = new Set((CB.d.used || []).map(e => e.de + '>' + e.para));
    x.lineWidth = 1;
    for (const e of P.edges) {
      const a = P.byId.get(e.de), b = P.byId.get(e.para); if (!a || !b) continue;
      const hot = foco && (e.de === foco.id || e.para === foco.id), u = used.has(e.de + '>' + e.para);
      x.strokeStyle = hot ? rgba(foco.live ? '#3DD68C' : M.colors[foco.tipo], .45) : u ? 'rgba(237,237,239,.22)' : 'rgba(161,161,170,.045)';
      x.beginPath(); x.moveTo(a.px + 2, a.py + 2); x.lineTo(b.px + 2, b.py + 2); x.stroke();
    }
    for (const p of P.pts) {
      const r = 2 + Math.min(3, Math.sqrt(p.grau) * .45), cor = p.live ? '#3DD68C' : (M.colors[p.tipo] || '#A1A1AA');
      x.globalAlpha = foco && foco.id !== p.id ? .85 : 1; x.fillStyle = cor; x.beginPath(); x.arc(p.px + 2, p.py + 2, r, 0, Math.PI * 2); x.fill();
      if (p.live) { x.globalAlpha = .6; x.strokeStyle = cor; x.lineWidth = 1.2; x.beginPath(); x.arc(p.px + 2, p.py + 2, r + 4, 0, Math.PI * 2); x.stroke(); }
    }
    x.globalAlpha = 1;
    if (foco) { x.strokeStyle = '#EDEDEF'; x.lineWidth = 1.5; x.beginPath(); x.arc(foco.px + 2, foco.py + 2, 7, 0, Math.PI * 2); x.stroke(); }
    x.font = '500 13px Geist, system-ui, sans-serif'; x.textBaseline = 'middle'; try { x.letterSpacing = '0.06em'; } catch { /* navegador antigo */ }
    for (const g of P.grupos) {
      const tw = Math.ceil(x.measureText(g.nome).width), gx = Math.round(Math.max(4, Math.min(w - tw - 12, g.x - tw / 2)));
      x.fillStyle = 'rgba(20,20,22,.92)'; x.beginPath(); if (x.roundRect) x.roundRect(gx - 6, g.y - 11, tw + 12, 22, 6); else x.rect(gx - 6, g.y - 11, tw + 12, 22); x.fill();
      x.fillStyle = '#A1A1AA'; x.fillText(g.nome, gx, g.y + 1);
    }
  }
  function cerebro() {
    const M = root.CerebroModelo, wrap = doc.querySelector('#g-cerebro .g-cerebro-mapa'), base = wrap && wrap.querySelector('canvas:not(.fh-cb)');
    if (!wrap || !base) return;
    if (!ativo() || !M || !CB.d) { wrap.classList.remove('fh-cb-on'); return; }
    let c = wrap.querySelector('canvas.fh-cb');
    if (!c) {
      c = owned(el('canvas', 'fh-cb')); c.setAttribute('aria-hidden', 'true'); wrap.append(c);
      base.addEventListener('mousemove', ev => { const n = cbPerto(base, ev); if ((n && n.id) !== (CB.hover && CB.hover.id)) { CB.hover = n; cbDesenhar(); } });
      base.addEventListener('mouseleave', () => { CB.hover = null; cbDesenhar(); });
      base.addEventListener('click', ev => { const n = cbPerto(base, ev); if (n) { CB.sel = n.id; cbDesenhar(); } });
    }
    if (!wrap.nextElementSibling || !wrap.nextElementSibling.classList.contains('fh-cb-legenda')) {
      const leg = owned(el('p', 'fh-cb-legenda'));
      for (const t of Object.keys(M.types)) { const s = el('span'), d = el('i'); d.style.background = M.colors[t]; s.append(d, M.types[t]); leg.append(s); }
      const v = el('span'), d = el('i', 'is-vivo'); v.append(d, 'trabalho aberto agora'); leg.append(v, el('span', 'fh-cb-dica', 'passe o mouse num ponto, clique para fixar'));
      wrap.after(leg);
    }
    wrap.classList.add('fh-cb-on'); cbDesenhar();
  }
  function cerebroAgendar() { root.clearTimeout(CB.t); CB.t = root.setTimeout(() => { if (ativo() && noCerebro()) lerCerebro(); else cerebro(); }, 60); }

  // ---------- ciclo ----------
  let started = false;
  function start() {
    if (started) return;
    if (!montar()) { root.setTimeout(start, 300); return; }
    started = true;
    const tema = () => { visibilidade(); cerebroAgendar(); if (ativo()) { if (S.agora) paint(); ler(); } };
    root.addEventListener('painel-tema', tema);
    new MutationObserver(tema).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    new MutationObserver(() => { if (ativo() && noAgora() && !S.agora) ler(); if (noCerebro()) cerebroAgendar(); }).observe(html, { attributes: true, attributeFilter: ['data-g-new'] });
    // o vistas.js refaz a vista do Cerebro (troca os filhos): o mapa da folha volta por cima
    const gc = $('g-cerebro'); if (gc) new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !n.dataset.dsOwned))) cerebroAgendar(); }).observe(gc, { childList: true });
    root.addEventListener('resize', () => { CB.pos = null; root.setTimeout(cbDesenhar, 260); });
    root.setInterval(() => { if (ativo() && noCerebro() && !doc.hidden) lerCerebro(); }, 60000);
    if (doc.fonts) doc.fonts.load('500 13px Geist').then(() => cbDesenhar()).catch(() => {});
    if (noCerebro()) cerebroAgendar();
    if (ativo()) ler();
    // repinta a linha quando a leitura OU a conta do Anda (a do vistas.js, mesma dos 3 temas) muda
    let ultimaSnap = null, ultimaConta = null;
    const contaAnda = () => { try { const V = vistas(); return V && typeof V.anda === 'function' ? V.anda() : null; } catch { return null; } };
    root.setInterval(() => { const s = snap(), c = contaAnda(); if (s !== ultimaSnap || c !== ultimaConta) { ultimaSnap = s; ultimaConta = c; if (ativo() && noAgora()) paintLinha(); } }, 2000);
    root.setInterval(() => { if (ativo() && noAgora() && !doc.hidden) ler(); }, 30000);
    if (/(?:^#|&)demo=recompensa\b/.test(root.location.hash || '')) root.setTimeout(() => { if (ativo()) demo.fechar(); }, 4000);
  }
  // demo local (nao grava nada; para a leitura de 30 s ate recarregar): fechar() tira o 1o card como se ele tivesse respondido
  const demo = Object.freeze({
    fechar() {
      const a = S.agora; if (!a || !a.cards || !a.cards.pendentes || !a.cards.pendentes.length) return false;
      S.demo = true;
      const next = JSON.parse(JSON.stringify(a)), c = next.cards.pendentes.shift();
      if (S.hoje) S.hoje = { ...S.hoje, decididasHoje: (S.hoje.decididasHoje || 0) + 1, ultimos: [{ arquivo: c.arquivo, sessao: c.sessao, pergunta: c.pergunta, restrito: c.restrito, ordemResp: Date.now() }, ...(S.hoje.ultimos || [])].slice(0, 5) };
      if (root.PainelAnim) root.PainelAnim.emitir({ tipo: 'card-respondido', id: 'demo' });
      aplicar(next); return true;
    },
    vazia() { const a = S.agora; if (!a) return false; S.demo = true; const next = JSON.parse(JSON.stringify(a)); next.cards.pendentes = []; if (next.agora) next.agora.voce = []; aplicar(next); return true; },
    fecharTodos() { // demo do anel que fecha: tira todos os cards em sequencia (o Decidir chega a 100% e acende rosa 1 s)
      let i = 0; const passo = () => { if (demo.fechar()) { i++; root.setTimeout(passo, 900); } }; passo(); return true;
    }
  });
  root.PainelBlocosFolha = Object.freeze({ abrirK, fecharK, ler, demo, linha: () => paintLinha(), estado: () => ({ ativo: ativo(), montado: !!$('fh-agora'), cards: (cardsPend() || []).length, passos: (passosDele() || []).length, decididasHoje: S.hoje ? S.hoje.decididasHoje : null }) });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => root.setTimeout(start, 0), { once: true }); else root.setTimeout(start, 0);
})(window);
