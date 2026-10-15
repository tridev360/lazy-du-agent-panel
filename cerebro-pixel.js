(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement, P = root.CerebroPixel;
  if (!P || !doc) return;
  const EXEMPLO = /[?&]exemplo=1\b/.test((root.location && root.location.search) || '');
  const ROTA = '/api/cerebro/aprendizados' + (EXEMPLO ? '?exemplo=1' : ''), CHAVE_VISTOS = 'cerebro-pixel-vistos', MINUTO = 60000, DIA = 86400000;
  const VAR = { ordens: '--g-rosa', erros: '--g-trava', regras: '--g-tx', licoes: '--g-anda', skills: '--cp-skills', agentes: '--g-claude', ferramentas: '--cp-ferr' };
  function lerMistura(){const m=/(?:^|[?&#])cerebro=(m[12])(?:&|$)/.exec(root.location?.hash||'')||/(?:^|[?&])cerebro=(m[12])(?:&|$)/.exec(root.location?.search||'');return m?m[1]:'m1';}
  let MISTURA=lerMistura();
  function lerBase() { const m = /(?:^|[?&#])base=(v[123])(?:&|$)/.exec(root.location?.hash || ''); return m ? m[1] : 'v2'; }
  let BASE = lerBase();
  const VAR_BASE = Object.fromEntries(P.TIPOS.map(t => [t, '--cp-area-' + t]));
  const PERIODOS = [['hoje', 'Hoje'], ['semana', 'Semana'], ['tudo', 'Tudo']];
  const S = { d: null, assinatura: '', periodo: null, q: '', foco: '', hover: null, g: P.grade(), mapa: null, vistos: lerVistos(), efeitos: [], sinapses: [], fila: [], raf: 0, timer: 0, relogio: 0, cores: {}, cel: 8, w: 0, h: 0, estatico: null, vinculos: [], quadros: 0, sujo: true, proxSinapse: 0, proxBrilho: 0, erro: false, montado: false };
  const els = {};
  const TEXTOS = {"Novos nas últimas 24 horas, como o coletor contou.": ["New in the last 24 hours, as the collector counted.", "Nuevos en las últimas 24 horas, como los contó el recolector."], "Cérebro": ["Brain", "Cerebro"], "em 24 h": ["in 24 h", "en 24 h"], "Hoje": ["Today", "Hoy"], "Semana": ["Week", "Semana"], "Tudo": ["All", "Todo"], "Período": ["Period", "Período"], "Ordens": ["Orders", "Órdenes"], "Erros": ["Errors", "Errores"], "Regras": ["Rules", "Reglas"], "Lições": ["Lessons", "Lecciones"], "Ferramentas": ["Tools", "Herramientas"], "O que sua equipe aprendeu": ["What your team learned", "Lo que aprendió tu equipo"], "lido": ["read", "leído"], "aprendizados guardados": ["stored learnings", "aprendizajes guardados"], "aprendizado": ["learning", "aprendizaje"], "aprendizados": ["learnings", "aprendizajes"], "novo hoje": ["new today", "nuevo hoy"], "novos hoje": ["new today", "nuevos hoy"], "Lendo os aprendizados...": ["Reading learnings...", "Leyendo aprendizajes..."], "Limpar filtro": ["Clear filter", "Limpiar filtro"], "Últimos 7 dias": ["Last 7 days", "Últimos 7 días"], "Ver todos os": ["See all", "Ver todos los"], "Conferir leitura": ["Check reading", "Revisar lectura"], "Tentar de novo": ["Try again", "Reintentar"], "Atividade antiga ↗": ["Previous activity ↗", "Actividad anterior ↗"], "ver": ["view", "ver"], "Por quê": ["Why", "Por qué"], "Fonte": ["Source", "Fuente"], "Quando": ["When", "Cuándo"], "Buscar: foto, deploy, card...": ["Search: photo, deploy, card...", "Buscar: foto, deploy, card..."], "Buscar aprendizado": ["Find learning", "Buscar aprendizaje"], "Regiões do cérebro": ["Brain regions", "Regiones del cerebro"], "Cérebro de pixel": ["Pixel brain", "Cerebro de píxeles"], "Desenho ilustrativo: os pontos e as luzes não são contagem. A onda marca um aprendizado que chegou. Passe o mouse para acender a área e ver o aprendizado; clique para abrir.": ["Illustration: the dots and lights are not counts. A wave marks a learning that arrived. Hover to light up an area and see the learning; click to open.", "Ilustración: los puntos y las luces no son conteos. La onda marca un aprendizaje que llegó. Pasa el mouse para encender el área y ver el aprendizaje; haz clic para abrir."], "Sem leitura nesta vez.": ["No reading this time.", "Sin lectura esta vez."], "A fonte não diz o porquê.": ["The source does not explain why.", "La fuente no explica por qué."], "Nada lido nesta região.": ["Nothing read in this region.", "Nada leído en esta región."], "Ver a semana": ["See the week", "Ver la semana"], "Ver tudo": ["See all", "Ver todo"], "Nada novo hoje": ["Nothing new today", "Nada nuevo hoy"], "Nada nos últimos 7 dias": ["Nothing in the last 7 days", "Nada en los últimos 7 días"], "Lição nova": ["New lesson", "Nueva lección"], "Skill nova": ["New skill", "Nueva skill"], "agora": ["now", "ahora"], "ontem": ["yesterday", "ayer"], "hoje": ["today", "hoy"], "dias": ["days", "días"], "há": ["ago", "hace"], "data não lida": ["date unread", "fecha sin leer"], "arquivo não lido": ["file unread", "archivo sin leer"], "sem título na fonte": ["source has no title", "fuente sin título"], "sem título": ["no title", "sin título"], "Total": ["Total", "Total"], "no período escolhido": ["in the selected period", "en el período elegido"], "Suas decisões orientam os próximos passos.": ["What was requested. Your decisions guide the next steps.", "Lo que pidió. Tus decisiones guían los próximos pasos."], "Erros repetidos": ["Repeated errors", "Errores repetidos"], "O que você mandou e decidiu, com data: decisões, fila de decisões e respostas de card.": ["What you ordered and decided, with a date: decisions, the decision queue and card answers.", "Lo que mandaste y decidiste, con fecha: decisiones, cola de decisiones y respuestas de card."], "Assunto que você teve de cobrar mais de uma vez, marcado como erro repetido.": ["A subject you had to ask for more than once, marked as a repeated error.", "Un asunto que tuviste que pedir más de una vez, marcado como error repetido."], "Como sua equipe trabalha, no CLAUDE.md e nas regras da sua equipe.": ["How your team works, recorded in its rules.", "Cómo trabaja tu equipo, registrado en sus reglas."], "Nota de método da sua equipe, sem ordem sua e sem repetição.": ["A working note of your team, with no order of yours and no repetition.", "Nota de método de tu equipo, sin orden tuya y sin repetición."], "Habilidades e rotinas agendadas instaladas.": ["Installed skills and scheduled routines.", "Habilidades y rutinas programadas instaladas."], "Ajudantes que as sessões chamam.": ["Helpers called by sessions.", "Ayudantes llamados por las sesiones."], "Scripts que sua equipe fez (fora o código do painel).": ["Scripts created by your team.", "Scripts creados por tu equipo."]};
  function tr(value){const text=String(value),lang=/^en/.test(html.lang)?0:/^es/.test(html.lang)?1:-1;if(lang<0)return text;if(TEXTOS[text])return TEXTOS[text][lang];let out=text;for(const par of regras())out=out.replace(par[0],()=>par[1][lang]);return out;}
  let REGRAS=null;
  const PALAVRA='[\\p{L}\\p{N}]',ESCAPE=/[.*+?^${}()|[\]\\]/g;
  function regras(){if(!REGRAS)REGRAS=Object.keys(TEXTOS).sort((a,b)=>b.length-a.length).map(key=>[new RegExp('(?<!'+PALAVRA+')'+key.replace(ESCAPE,'\\$&')+'(?!'+PALAVRA+')','gu'),TEXTOS[key]]);return REGRAS;}
  const dado=v=>doc.createTextNode(String(v));
  function fraseNo(it,fr){const f=fr||P.fraseDaDica(it);return f.solucao||/^Assunto reservado: o texto só abre/.test(f.texto)&&it&&it.reservado&&!it.frase&&!it.descricao||f.texto===P.SEM_DESCRICAO?f.texto:dado(f.texto);}

  const parado = () => html.dataset.motion === 'off' || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ativo = () => html.dataset.gNew === 'aprendizados' && !doc.hidden;

  function h(tag, cls, ...kids) { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) { if (k === null || k === undefined || k === false) continue; n.append(k.nodeType ? k : tr(k)); } return n; }
  function botao(texto, cls, fn) { const b = h('button', cls, texto); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function lerVistos() { try { const v = JSON.parse(root.localStorage.getItem(CHAVE_VISTOS) || '[]'); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); } }
  function guardarVistos() { try { root.localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...S.vistos].slice(-3000))); } catch { S.semArmazenamento = true; } }
  function ha(iso) { const t = Date.parse(iso); if (!Number.isFinite(t)) return '?'; const m = Math.max(0, Math.round((Date.now() - t) / MINUTO)); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const hh = Math.round(m / 60); if (hh < 48) return 'há ' + hh + ' h'; return 'há ' + Math.round(hh / 24) + ' dias'; }
  function diaRelativo(t) { const n = Math.round((P.inicioDoDia(Date.now()) - P.inicioDoDia(t)) / DIA); return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : 'há ' + n + ' dias'; }
  const hora = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  function dataCurta(it) { const t = Date.parse(it && it.quando); if (!Number.isFinite(t)) return '?'; const d = new Date(t), hoje = P.inicioDoDia(Date.now()); if (t >= hoje) return it.soDia ? 'hoje' : hora(d); return d.getDate() + '/' + (d.getMonth() + 1); }
  function dataLonga(it) { const iso = it && it.quando, t = Date.parse(iso); if (!Number.isFinite(t)) return 'data não lida (?)'; const d = new Date(t); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + (/T/.test(iso) && !it.soDia ? ' ' + hora(d) : '') + ' (' + (it.soDia ? diaRelativo(t) : ha(iso)) + ')'; }
  function cor(tipo, a) { const c = S.cores[tipo] || S.cores.tx || [237, 237, 239]; return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lerCor(valor) {
    const v = String(valor || '').trim(); let m = /^#([0-9a-f]{3})$/i.exec(v); if (m) return m[1].split('').map(x => parseInt(x + x, 16));
    m = /^#([0-9a-f]{6})/i.exec(v); if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = /rgba?\(([^)]+)\)/i.exec(v); if (m) return m[1].split(',').slice(0, 3).map(x => Math.round(parseFloat(x)));
    return null;
  }
  function lerCores() { const cs = root.getComputedStyle(els.sec || html); for (const t of P.TIPOS) S.cores[t] = lerCor(cs.getPropertyValue(MISTURA === 'm1' ? VAR_BASE[t] : VAR[t])) || [237, 237, 239]; S.cores.tx = lerCor(cs.getPropertyValue('--g-tx')) || [237, 237, 239]; S.cores.tx3 = lerCor(cs.getPropertyValue('--g-tx3')) || [113, 113, 122]; S.cores.bg = lerCor(cs.getPropertyValue('--g-bg')) || [11, 11, 13]; S.claro = (S.cores.bg[0] + S.cores.bg[1] + S.cores.bg[2]) / 3 > 140; }
  const itens = () => (S.d && Array.isArray(S.d.itens)) ? S.d.itens : [];
  const filtrados = () => P.buscar(P.doPeriodo(itens(), S.periodo || 'tudo', Date.now()), S.q).filter(i => !S.foco || i.tipo === S.foco);

  function montar() {
    if(S.montado)return true;const irma=doc.getElementById('g-cerebro');if(!irma)return false;
    const sec=doc.getElementById('g-aprendizados')||h('section','g-view');sec.replaceChildren();sec.classList.add('cp'); sec.id = 'g-aprendizados'; sec.dataset.dsOwned = 'grade'; sec.dataset.cerebro = MISTURA; sec.dataset.base = BASE; sec.setAttribute('aria-label', 'Cérebro: o que sua equipe aprendeu');
    els.sec = sec;
    const antiga = h('a', 'cp-antiga', 'Atividade antiga ↗'); antiga.href = '#g=cerebro.mapa-antigo'; antiga.title = 'O cérebro de antes, com a atividade das sessões (também em /#cerebro)';
    els.lido = h('p', 'g-sec cp-lido', 'Lendo os aprendizados...');
    const topo = h('div', 'cp-topo', h('h2', 'g-h', 'Cérebro'), els.lido, antiga);
    els.num = h('span', 'cp-num', '?'); els.numRot = h('span', 'g-sec cp-num-rot', 'aprendizados guardados');
    els.hoje = botao('', 'cp-hoje', () => { trocarPeriodo('hoje'); }); els.hoje.hidden = true;
    els.periodos = h('div', 'cp-periodos'); els.periodos.setAttribute('role', 'radiogroup'); els.periodos.setAttribute('aria-label', 'Período');
    els.perBtns = PERIODOS.map(([id, rot]) => { const b = botao(rot, '', () => trocarPeriodo(id)); b.dataset.periodo = id; b.setAttribute('role', 'radio'); els.periodos.append(b); return b; });
    els.busca = h('input', 'cp-busca'); els.busca.type = 'search'; els.busca.placeholder = tr('Buscar: foto, deploy, card...'); els.busca.setAttribute('aria-label', tr('Buscar aprendizado'));
    let espera = 0; els.busca.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => { S.q = els.busca.value; S.sujo = true; pintarLista(); pintarRegioes(); desenharJa(); if (S.q.trim()) brilhoBusca(); }, 120); });
    const heroi = h('div', 'cp-heroi', h('div', 'cp-total', els.num, els.numRot), els.hoje, els.periodos, els.busca);
    els.canvas = doc.createElement('canvas'); els.canvas.className = 'cp-canvas'; els.canvas.setAttribute('role', 'img'); els.canvas.setAttribute('aria-label', 'Cérebro de pixel');
    els.rotulos = h('div', 'cp-rotulos'); els.dica = h('div', 'cp-dica'); els.dica.hidden = true; els.toast = h('div', 'cp-toast'); els.toast.hidden = true; els.toast.setAttribute('role', 'status');
    els.palcoCerebro = h('div', 'cp-cerebro', els.canvas, els.rotulos, els.dica, els.toast);
    els.legenda = h('p', 'g-sec cp-legenda', 'Desenho ilustrativo: os pontos e as luzes não são contagem. A onda marca um aprendizado que chegou. Passe o mouse para acender a área e ver o aprendizado; clique para abrir.');
    els.regioes = h('div', 'cp-regioes'); els.regioes.setAttribute('aria-label', 'Regiões do cérebro');
    const palco = h('div', 'cp-palco', h('div', 'cp-col', els.palcoCerebro, els.legenda), els.regioes);
    els.listaTit = h('h3', 'g-h cp-lista-tit', 'Hoje'); els.listaN = h('span', 'g-sec', ''); els.limpar = botao('Limpar filtro', 'cp-limpar', () => { S.foco = ''; S.q = ''; els.busca.value = ''; S.sujo = true; pintarTudo(); }); els.limpar.hidden = true;
    els.lista = h('ol', 'cp-lista'); els.mais = botao('', 'cp-mais', abrirTodos); els.mais.hidden = true;
    const lista = h('section', 'cp-lista-box', h('div', 'cp-lista-topo', els.listaTit, els.listaN, els.limpar), els.lista, els.mais);
    sec.append(topo, heroi, palco, lista);
    irma.after(sec);
    els.canvas.addEventListener('mousemove', mover); els.canvas.addEventListener('mouseleave', () => { els.dica.hidden = true; if (S.hover) { S.hover = null; S.sujo = true; desenharJa(); } els.canvas.style.cursor = ''; });
    els.canvas.addEventListener('click', clicar);
    if (root.ResizeObserver) new root.ResizeObserver(() => medir()).observe(els.palcoCerebro); else root.addEventListener('resize', medir);
    S.montado = true; return true;
  }

  async function carregar() {
    try {
      const r = await root.fetch(ROTA, { cache: 'no-store' }); if (!r.ok) throw Error('rota');
      const d = await r.json(); if (!d || !Array.isArray(d.itens)) throw Error('forma');
      const novaAss = JSON.stringify([d.itens, d.contagens, d.vinculos]), antes = S.d ? new Set(S.d.itens.map(i => i.id)) : null;
      d.itens = d.itens.filter(i => i && P.TIPOS.includes(i.tipo));
      const porId = new Map(d.itens.map(i => [i.id, i]));
      const anteriores = new Set(S.vinculos.map(v => v.de + '|' + v.para));
      S.vinculos = (Array.isArray(d.vinculos) ? d.vinculos : []).filter(v => v && porId.has(v.de) && porId.has(v.para) && ['regras', 'ordens'].includes(porId.get(v.para).tipo)).map(v => ({ ...v, origem: porId.get(v.de).tipo, destino: porId.get(v.para).tipo }));
      S.d = d; S.erro = false;
      if (antes && !parado()) for (const v of S.vinculos) if (!anteriores.has(v.de + '|' + v.para)) { const cam = P.caminho(S.g, v.origem, v.destino); S.sinapses.push({ cam, t0: performance.now(), vel: 32, cor: v.destino, fim: performance.now() + cam.length / 32 * 1000 }); }
      if (novaAss !== S.assinatura) {
        S.assinatura = novaAss; S.mapa = P.distribuir(d.itens, S.g); if (!S.periodo) S.periodo = P.periodoPadrao(d.itens, Date.now());
        S.sujo = true; pintarTudo();
        agendarPiscadas(antes);
      } else pintarLido();
    } catch {
      S.erro = true; if (!S.d) pintarErro(); else pintarLido();
    }
  }
  function agendarPiscadas(antes) {
    const pendentes = new Set(S.fila.map(e=>e.it.id));
    const novos = P.paraPiscar(itens(), S.vistos, Date.now()), chegaram = antes ? itens().filter(i => !antes.has(i.id)) : [];
    const todos = [...new Map([...chegaram, ...novos].map(i => [i.id, i])).values()].filter(i=>!pendentes.has(i.id)).slice(0,40);
    if (parado()) return;
    const agora=performance.now();
    todos.forEach((it,k)=>S.fila.push({it,quando:agora+(chegaram.some(i=>i.id===it.id)?80:600)+k*150}));
    S.fila.sort((a,b)=>a.quando-b.quando);
    acordar();
  }

  function pintarTudo() { pintarLido(); pintarHeroi(); pintarRotulos(); pintarRegioes(); pintarLista(); medir(); desenharJa(); }
  function pintarErro() { els.lido.textContent = tr('Não deu para ler os aprendizados agora (?). Confira a leitura ou tente de novo.'); els.num.textContent = tr('?'); els.lista.replaceChildren(h('li', 'g-vazio', 'Sem leitura nesta vez.'), botao('Tentar de novo', 'g-btn', carregar)); }
  function pintarLido() { if (!S.d) return; els.lido.textContent = tr('O que sua equipe aprendeu · lido ' + ha(S.d.geradoEm) + (S.erro ? ' · a última tentativa falhou, tento de novo em 1 min' : '')); }
  function pintarHeroi() {
    const d = S.d; if (!d) return;
    const desconhecido = P.TIPOS.some(t => P.contagem(d, t).texto === '?');
    els.num.textContent = tr(String(itens().filter(i => !i.assunto).length) + (desconhecido ? '+' : ''));
    els.numRot.textContent = tr(desconhecido ? 'aprendizados guardados (há fonte não lida: veja a região com ?)' : 'aprendizados guardados');
    const n = P.novosHoje(itens(), Date.now()).length;
    els.hoje.hidden = !n; els.hoje.replaceChildren(h('i', 'cp-ponto'), h('b', '', String(n)), ' ' + (n === 1 ? 'novo hoje' : 'novos hoje'));
    for (const b of els.perBtns) b.setAttribute('aria-checked', String(b.dataset.periodo === S.periodo));
    els.canvas.setAttribute('aria-label', 'Cérebro de pixel: ' + P.TIPOS.map(t => tr(P.NOMES[t]) + ' ' + P.contagem(d, t).texto).join(', '));
  }
  function pintarRotulos() {
    els.rotulos.replaceChildren();
    if (!S.d) return;
    for (const t of P.TIPOS) {
      const c = P.contagem(S.d, t), b = botao('', 'cp-rot', () => abrirRegiao(t)); b.dataset.tipo = t;
      b.append(h('span', 'cp-rot-n', c.texto), h('span', 'cp-rot-nome', tr(P.NOMES[t])));
      b.setAttribute('aria-label', tr(P.NOMES[t]) + ': ' + c.texto); els.rotulos.append(b);
    }
    posicionarRotulos();
  }
  function posicionarRotulos() {
    if (!S.cel) return;
    for (const b of els.rotulos.children) { const m = P.ROTULO[b.dataset.tipo]; b.style.left = Math.round(S.ox + (m.c + 0.5) * S.cel) + 'px'; b.style.top = Math.round(S.oy + (m.r + 0.5) * S.cel) + 'px'; }
  }
  function novos24h(d, t) { const n = d && d.contagens && d.contagens[t] && d.contagens[t].novos; return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null; }
  function seloNovos(texto) { const s = h('span', 'cp-reg-novo', texto); s.setAttribute('title', tr('Novos nas últimas 24 horas, como o coletor contou.')); return s; }
  function pintarRegioes() {
    const d = S.d; if (!d) return; els.regioes.replaceChildren();
    for (const t of P.TIPOS) {
      const c = P.contagem(d, t), novos = novos24h(d, t), extra = P.contagemExtra(d, t), b = botao('', 'cp-reg', () => { S.foco = S.foco === t ? '' : t; S.sujo = true; pintarRegioes(); pintarLista(); desenharJa(); explodir(t); });
      if(c.solucao)b.addEventListener('click',()=>abrirRegiao(t));
      b.addEventListener('mouseenter', () => realcar(t));
      b.addEventListener('mouseleave', () => realcar(null));
      b.addEventListener('focus', () => realcar(t));
      b.addEventListener('blur', () => realcar(null));
      b.dataset.tipo = t; b.setAttribute('aria-pressed', String(S.foco === t));
      const linha = h('span', 'cp-reg-l1', h('i', 'cp-sq'), h('span', 'cp-reg-nome', tr(P.NOMES[t])), c.texto === '?' || novos === null ? seloNovos('+? em 24 h') : novos ? seloNovos('+' + novos + ' em 24 h') : null, h('b', 'cp-reg-n', c.texto));
      b.append(...[linha, h('span', 'cp-reg-frase', c.solucao || P.FRASES[t]), extra ? h('span', 'cp-reg-frase cp-reg-extra', extra) : null].filter(Boolean));
      if (c.solucao) b.classList.add('is-sem-leitura');
      const ver = botao('ver', 'cp-reg-ver', ev => { ev.stopPropagation(); abrirRegiao(t); }); ver.setAttribute('aria-label', 'Ver tudo de ' + tr(P.NOMES[t]));
      els.regioes.append(h('div', 'cp-reg-box', b, ver));
    }
  }
  function linhaItem(it) {
    const b = botao('', 'cp-item', () => abrirItem(it)); b.dataset.tipo = it.tipo;
    b.append(h('span', 'cp-item-hora', dataCurta(it)), h('span', 'cp-item-tipo', h('i', 'cp-sq'), tr(P.NOMES[it.tipo])), h('span', 'cp-item-txt', h('b', '', it.titulo ? dado(it.titulo) : '(sem título na fonte)'), h('span', 'g-sec', it.porque ? dado(it.porque) : fraseNo(it))));
    if (P.novosHoje([it], Date.now()).length) b.classList.add('is-hoje');
    return h('li', '', b);
  }
  function pintarLista() {
    if (!S.d) return;
    const lista = filtrados(), rot = { hoje: 'Hoje', semana: 'Últimos 7 dias', tudo: 'Tudo' }[S.periodo] || 'Tudo';
    els.listaTit.textContent = tr(rot + (S.foco ? ' · ' + P.NOMES[S.foco] : ''));
    els.listaN.textContent = tr(lista.length + (lista.length === 1 ? ' aprendizado' : ' aprendizados') + (S.q.trim() ? ' com "' + S.q.trim() + '"' : ''));
    els.limpar.hidden = !(S.foco || S.q.trim());
    els.lista.replaceChildren(...lista.slice(0, 30).map(linhaItem));
    if (!lista.length) {
      const vazio = h('li', 'g-vazio cp-vazio');
      if (S.q.trim()) vazio.append('Nada com "' + S.q.trim() + '". Tente outra palavra ou o período Tudo.');
      else if (S.periodo === 'hoje') vazio.append('Nada novo hoje' + (S.foco ? ' em ' + P.NOMES[S.foco] : '') + '. ', botao('Ver a semana', 'cp-link', () => trocarPeriodo('semana')));
      else if (S.periodo === 'semana') vazio.append('Nada nos últimos 7 dias' + (S.foco ? ' em ' + P.NOMES[S.foco] : '') + '. ', botao('Ver tudo', 'cp-link', () => trocarPeriodo('tudo')));
      else vazio.append(S.foco && P.contagem(S.d, S.foco).texto === '?' ? P.contagem(S.d, S.foco).solucao : 'Nada lido nesta região.');
      els.lista.append(vazio);
    }
    els.mais.hidden = lista.length <= 30; els.mais.textContent = tr('Ver todos os ' + lista.length);
  }
  function trocarPeriodo(id) { S.periodo = id; S.sujo = true; pintarHeroi(); pintarLista(); desenharJa(); }

  function gaveta(titulo, ...corpo) {
    const dlg = doc.getElementById('drawer'), tit = doc.getElementById('drawer-title'), body = doc.getElementById('drawer-body'); if (!dlg || !tit || !body) return;
    tit.textContent = titulo; body.replaceChildren(...corpo.filter(Boolean)); body.classList.add('cp-gaveta');
    if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } }
  }
  function chip(tipo) { const c = h('span', 'cp-chip', h('i', 'cp-sq'), P.NOMES[tipo]); c.dataset.tipo = tipo; return c; }
  function abrirItem(it) {
    if (it.reservado && !it.arquivo) { gaveta('Assunto reservado', chip(it.tipo), h('p', 'g-txt', 'Este aprendizado é de um assunto reservado. Ele entra na contagem; o texto só abre para você, no modo dono deste computador.'), h('h3', 'g-lab', 'Quando'), h('p', 'g-sec', dataLonga(it))); return; }
    gaveta(it.titulo || tr('(sem título na fonte)'), chip(it.tipo), it.reservado ? h('p', 'g-sec', 'Assunto reservado: só você vê este texto, no modo dono.') : null, h('p', 'g-txt', fraseNo(it)),
      h('h3', 'g-lab', 'Por quê'), h('p', it.porque ? 'g-txt' : 'g-sec', it.porque ? dado(it.porque) : 'A fonte não diz o porquê.'),
      h('h3', 'g-lab', 'Fonte'), h('code', 'cp-fonte', it.arquivo ? dado(it.arquivo) : '? (arquivo não lido)'),
      h('h3', 'g-lab', 'Quando'), h('p', 'g-sec', dataLonga(it)), h('p', 'g-sec cp-gaveta-frase', P.FRASES[it.tipo]), botao('Conferir leitura', 'g-btn', carregar));
  }
  function abrirVarios(lista, titulo) {
    const ul = h('ul', 'cp-gaveta-lista');
    for (const it of lista.slice(0, 200)) { const b = botao('', 'cp-gaveta-item', () => abrirItem(it)); b.append(h('b', '', it.titulo ? dado(it.titulo) : '(sem título)'), h('span', 'g-sec', tr(P.NOMES[it.tipo]) + ' · ' + dataCurta(it))); ul.append(h('li', '', b)); }
    gaveta(titulo, h('p', 'g-sec', lista.length > 200 ? 'Mostrando 200 de ' + lista.length + '. Use a busca para achar o resto.' : lista.length + (lista.length === 1 ? ' aprendizado' : ' aprendizados')), ul);
  }
  function abrirRegiao(t) {
    const c = P.contagem(S.d, t), todos = itens().filter(i => i.tipo === t), doPer = P.doPeriodo(todos, S.periodo || 'tudo', Date.now());
    const lista = doPer.length ? doPer : todos;
    const ul = h('ul', 'cp-gaveta-lista'); for (const it of lista.slice(0, 120)) { const b = botao('', 'cp-gaveta-item', () => abrirItem(it)); b.append(h('b', '', it.titulo ? dado(it.titulo) : '(sem título)'), h('span', 'g-sec', dataCurta(it) + (it.porque ? ' · ' : ''), it.porque ? dado(it.porque) : null)); ul.append(h('li', '', b)); }
    gaveta(tr(P.NOMES[t]), chip(t), h('p', 'g-txt', P.FRASES[t]), h('p', 'g-sec', 'Total: ' + c.texto + (doPer.length && S.periodo !== 'tudo' ? ' · ' + doPer.length + ' no período escolhido' : '')),
      c.solucao ? h('div', 'cp-solucao', h('p', 'g-txt', c.solucao), botao('Conferir leitura', 'g-btn', carregar)) : null, lista.length > 120 ? h('p', 'g-sec', 'Mostrando 120 de ' + lista.length + '. A busca acha o resto.') : null, ul);
  }
  function abrirTodos() { abrirVarios(filtrados(), els.listaTit.textContent); }

  function medir() {
    if (!els.palcoCerebro || !els.palcoCerebro.isConnected) return;
    const larg = els.palcoCerebro.clientWidth - 2 * (parseFloat(root.getComputedStyle(els.palcoCerebro).paddingLeft) || 0); if (larg <= 0) return;
    const cel = Math.max(3, Math.min(12, Math.floor(larg / S.g.cols)));
    const w = cel * S.g.cols, hh = cel * (S.g.rows - 2);
    if (cel === S.cel && w === S.w && els.canvas.width) { posicionarRotulos(); return; }
    S.cel = cel; S.w = w; S.h = hh; const dpr = root.devicePixelRatio || 1;
    els.canvas.width = Math.round(w * dpr); els.canvas.height = Math.round(hh * dpr); els.canvas.style.width = w + 'px'; els.canvas.style.height = hh + 'px';
    S.ox = els.canvas.offsetLeft; S.oy = els.canvas.offsetTop; S.sujo = true; posicionarRotulos(); desenharJa();
  }
  function celulaEm(ev) { const r = els.canvas.getBoundingClientRect(), c = Math.floor((ev.clientX - r.left) / S.cel), rr = Math.floor((ev.clientY - r.top) / S.cel); return S.g.celulas.find(x => x.c === c && x.r === rr) || null; }
  function mover(ev) {
    if (!S.mapa) return; const cell = celulaEm(ev), reg = cell ? cell.regiao : null;
    if (reg !== S.hover) { S.hover = reg; S.sujo = true; desenharJa(); }
    const its = cell ? S.mapa.itensDa(cell) : [];
    els.canvas.style.cursor = cell ? 'pointer' : '';
    if (!its.length) { els.dica.hidden = true; return; }
    const fr = P.fraseDaDica(its[0]), linhas = [h('span', 'cp-dica-tipo', P.NOMES[its[0].tipo] + ' · ' + dataCurta(its[0])), h('b', '', its[0].titulo ? dado(its[0].titulo) : '(sem título)'), h('span', fr.solucao ? 'cp-dica-frase is-sem' : 'cp-dica-frase', fraseNo(its[0], fr))];
    if (fr.solucao) linhas.push(h('span', 'g-sec cp-dica-sol', fr.solucao));
    if (its.length > 1) linhas.push(h('span', 'g-sec', 'e mais ' + (its.length - 1) + ' neste quadrado'));
    els.dica.replaceChildren(...linhas);
    const r = els.palcoCerebro.getBoundingClientRect(); els.dica.style.left = Math.min(r.width - 260, Math.max(8, ev.clientX - r.left + 14)) + 'px'; els.dica.style.top = Math.max(8, ev.clientY - r.top + 14) + 'px'; els.dica.hidden = false;
  }
  function clicar(ev) {
    if (!S.mapa) return; const cell = celulaEm(ev); if (!cell) return;
    const its = S.mapa.itensDa(cell);
    if (its.length === 1) abrirItem(its[0]); else if (its.length > 1) abrirVarios(its, P.NOMES[cell.regiao] + ': ' + its.length + ' neste quadrado'); else abrirRegiao(cell.regiao);
    if (!parado()) { S.efeitos.push({ tipo: 'anel', c: cell.c, r: cell.r, t0: performance.now(), dur: 700, cor: cell.regiao }); acordar(); }
  }
  function realcar(tipo) { if (S.hover === tipo) return; S.hover = tipo; S.sujo = true; desenharJa(); }

  function pintarBase() {
    if (!S.baseLuz) S.baseLuz = doc.createElement('canvas');
    const cv = S.baseLuz, dpr = root.devicePixelRatio || 1, L = S.cel;
    cv.width = els.canvas.width; cv.height = els.canvas.height;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.regioesBase = [];
    if (MISTURA !== 'm1') return;
    const foco = S.hover || S.foco;
    const intensidade = BASE === 'v1' ? .09 : BASE === 'v2' ? .18 : .16;
    for (const [indice, tipo] of P.TIPOS.entries()) {
      const regiao = S.g.regioes[tipo], a = intensidade * (foco ? (foco === tipo ? 1.28 : .68) : 1);
      if (!root.Path2D) {
        x.fillStyle = cor(tipo, a);
        for (const c of regiao.celulas) x.fillRect(c.c * L, c.r * L, L, L);
        S.regioesBase.push({ tipo, cor: S.cores[tipo].slice(), intensidade: a, textura: indice, celulas: regiao.celulas.length });
        continue;
      }
      const forma = new root.Path2D();
      for (const c of regiao.celulas) forma.rect(c.c * L, c.r * L, L, L);
      const cx = (regiao.meio.c + .5) * L, cy = (regiao.meio.r + .5) * L;
      let tinta = cor(tipo, a);
      if (BASE === 'v3') {
        const grad = x.createRadialGradient(cx - 3 * L, cy - 3 * L, L, cx, cy, 25 * L);
        grad.addColorStop(0, cor(tipo, a * 1.7)); grad.addColorStop(.55, cor(tipo, a)); grad.addColorStop(1, cor(tipo, a * .65));
        tinta = grad;
      }
      x.save();
      x.fillStyle = tinta; x.filter = 'blur(' + Math.max(2, L * 1.05) + 'px)'; x.fill(forma);
      x.filter = 'blur(' + Math.max(.6, L * .12) + 'px)'; x.fill(forma);
      x.filter = 'none'; x.clip(forma); x.strokeStyle = cor(tipo, a * .42); x.lineWidth = Math.max(.5, L * .07);
      const passo = (4 + indice) * L;
      for (let y = 0; y < S.h; y += passo) {
        x.beginPath();
        for (let c = 0; c <= S.g.cols; c++) {
          const yy = y + Math.sin(c / (3 + indice) + indice) * L * (1 + indice * .16);
          if (c) x.lineTo(c * L, yy); else x.moveTo(c * L, yy);
        }
        x.stroke();
      }
      x.restore();
      S.regioesBase.push({ tipo, cor: S.cores[tipo].slice(), intensidade: a, textura: indice, celulas: regiao.celulas.length });
    }
  }
  function pintarEstatico() {
    if (!S.estatico) S.estatico = doc.createElement('canvas');
    const cv = S.estatico; cv.width = els.canvas.width; cv.height = els.canvas.height; const x = cv.getContext('2d'), dpr = root.devicePixelRatio || 1;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, S.w, S.h); lerCores(); pintarBase();
    const lado = S.cel >= 6 ? S.cel - 1 : S.cel - (S.cel >= 4 ? 1 : 0), filtro = new Set(filtrados().map(i => i.id)), comFiltro = S.periodo !== 'tudo' || !!S.q.trim() || !!S.foco, focoReg = S.hover || S.foco;
    const selected = S.g.celulas.filter(c => (c.c * 17 + c.r * 31) % 7 === 0);
    const occupied = new Set(S.g.celulas.map(c => c.c + ':' + c.r));
    for (const cel of S.g.celulas) {
      const its = S.mapa ? S.mapa.itensDa(cel) : [], dim = focoReg && cel.regiao !== focoReg ? .22 : 1;
      const edge = [[1,0],[-1,0],[0,1],[0,-1]].some(([dc,dr]) => !occupied.has((cel.c+dc)+':'+(cel.r+dr)));
      x.globalAlpha = dim;
      if (MISTURA === 'm2') { x.fillStyle = cor(cel.regiao, its.length ? .85 : .12 + ((cel.c*13+cel.r*7)%5)*.022); x.fillRect(cel.c*S.cel,cel.r*S.cel,lado,lado); }
      else if (edge) { x.fillStyle=cor(cel.regiao,.48); x.fillRect(cel.c*S.cel,cel.r*S.cel,Math.max(1,S.cel*.45),Math.max(1,S.cel*.45)); }
    }
    if (MISTURA === 'm1') for (const [i,a] of selected.entries()) {
      x.globalAlpha = focoReg && a.regiao !== focoReg ? .2 : 1;
      for (const b of selected.slice(i+1,i+28)) { const d=Math.hypot(a.c-b.c,a.r-b.r); if(d>5 || a.regiao!==b.regiao)continue; x.strokeStyle=cor(a.regiao,.16); x.lineWidth=.7; x.beginPath(); x.moveTo((a.c+.5)*S.cel,(a.r+.5)*S.cel); x.lineTo((b.c+.5)*S.cel,(b.r+.5)*S.cel); x.stroke(); }
      x.fillStyle=cor(a.regiao,.64); x.beginPath(); x.arc((a.c+.5)*S.cel,(a.r+.5)*S.cel,Math.max(1,S.cel*.16),0,Math.PI*2);x.fill();
    }
    x.globalAlpha=1;
    for(const v of S.vinculos) { const a=S.g.regioes[v.origem].centro,b=S.g.regioes[v.destino].centro; x.strokeStyle=cor(v.destino,.55);x.lineWidth=1.5;x.beginPath();x.moveTo((a.c+.5)*S.cel,(a.r+.5)*S.cel);x.quadraticCurveTo(S.w/2,S.h*.1,(b.c+.5)*S.cel,(b.r+.5)*S.cel);x.stroke(); }
    x.globalAlpha = 1; S.sujo = false;
  }
  function desenhar(agora) {
    const c = els.canvas; if (!c.width || !S.mapa) return;
    if (S.sujo || !S.estatico) pintarEstatico();
    const x = c.getContext('2d'), dpr = root.devicePixelRatio || 1, L = S.cel, lado = L >= 6 ? L - 1 : L - (L >= 4 ? 1 : 0);
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); if (S.baseLuz) x.drawImage(S.baseLuz, 0, 0); x.drawImage(S.estatico, 0, 0); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sq = (cc, rr, estilo, extra = 0) => { x.fillStyle = estilo; x.fillRect(cc * L - extra, rr * L - extra, lado + 2 * extra, lado + 2 * extra); };
    S.quadros++;
    const hoje = P.novosHoje(itens(), Date.now()), mover = !parado();
    if (mover) { x.globalAlpha=.07+.045*(1+Math.sin(agora/1100));x.drawImage(S.estatico,0,0,S.w,S.h);x.globalAlpha=1; }
    for (const it of hoje) { const cel = S.mapa.porItem.get(it.id); if (!cel) continue; const fase = mover ? (Math.sin(agora / 380 + cel.c) + 1) / 2 : 1; x.globalAlpha = 0.25 + 0.35 * fase; sq(cel.c, cel.r, cor(it.tipo, 1), Math.max(1, Math.round(L / 4))); x.globalAlpha = 1; sq(cel.c, cel.r, cor('tx', 0.55 + 0.45 * fase)); }
    if (mover) {
      for (const e of S.efeitos) {
        const t = (agora - e.t0) / e.dur; if (t < 0 || t > 1) continue;
        if (e.tipo === 'brilho') { x.globalAlpha = Math.sin(t * Math.PI) * 0.9; sq(e.c, e.r, cor('tx', 1)); x.globalAlpha = 1; }
        else if (e.tipo === 'anel' && MISTURA === 'm1') { x.strokeStyle=cor(e.cor,(1-t)*.8);x.lineWidth=2; x.beginPath(); x.arc((e.c+.5)*L,(e.r+.5)*L,(1+t*(e.raio||8))*L,0,Math.PI*2);x.stroke(); for(let k=0;k<7;k++){const a=k/7*Math.PI*2;x.fillStyle=cor(e.cor,1-t);x.beginPath();x.arc((e.c+.5)*L+Math.cos(a)*t*9*L,(e.r+.5)*L+Math.sin(a)*t*9*L,2,0,Math.PI*2);x.fill();} }
        else if (e.tipo === 'anel') { const raio = 1 + t * (e.raio || 5); x.globalAlpha = 1 - t; for (let k = 0; k < 28; k++) { const ang = k / 28 * Math.PI * 2; sq(Math.round(e.c + Math.cos(ang) * raio), Math.round(e.r + Math.sin(ang) * raio), cor(e.cor, 1)); } x.globalAlpha = 1; }
        else if (e.tipo === 'pisca') { const on = Math.floor(t * 6) % 2 === 0; if (on) { sq(e.c, e.r, cor('tx', 1), Math.max(1, Math.round(L / 3))); sq(e.c, e.r, cor(e.cor, 1)); } }
      }
      for (const s of S.sinapses) {
        const passo = Math.floor((agora - s.t0) / 1000 * s.vel); if (passo < 0) continue;
        for (let k = 0; k < 6; k++) { const p = s.cam[passo - k]; if (!p) continue; x.globalAlpha = k ? (1 - k / 6) * 0.8 : 1; sq(p.c, p.r, k ? cor(s.cor, 1) : cor('tx', 1), k ? 0 : 1); }
        x.globalAlpha = 1;
      }
    }
  }
  function desenharJa() { if (!S.montado || !ativo()) return; if (!S.mapa) return; if (parado()) desenhar(performance.now()); else acordar(); }
  function laco(agora) {
    S.raf = 0; if (!ativo() || parado()) { if (ativo()) desenhar(agora); return; }
    while (S.fila.length && S.fila[0].quando <= agora) {
      const { it } = S.fila.shift(), cel = S.mapa && S.mapa.porItem.get(it.id); if (!cel) continue;
      const cam = P.caminhoAte(S.g, cel), vel = 70, chega = agora + cam.length / vel * 1000;
      S.sinapses.push({ cam, t0: agora, vel, cor: it.tipo, fim: chega });
      S.efeitos.push({ tipo: 'anel', c: cel.c, r: cel.r, t0: chega, dur: 900, cor: it.tipo, raio: 6 }, { tipo: 'pisca', c: cel.c, r: cel.r, t0: chega, dur: 1300, cor: it.tipo });
      if (it.tipo === 'licoes' || it.tipo === 'skills') setTimeout(() => brinde(it), Math.max(0, chega - agora));
      S.vistos.add(it.id); guardarVistos();
    }
    if (agora >= S.proxSinapse && S.mapa) {
      const pesos = P.TIPOS.map(t => ({ t, p: 1 + Math.log1p(itens().filter(i => i.tipo === t).length) + (P.novosHoje(itens(), Date.now()).some(i => i.tipo === t) ? 3 : 0) }));
      const tot = pesos.reduce((a, b) => a + b.p, 0); let sorteio = Math.random() * tot, de = 'ordens'; for (const q of pesos) { sorteio -= q.p; if (sorteio <= 0) { de = q.t; break; } }
      let para = P.TIPOS[Math.floor(Math.random() * P.TIPOS.length)]; if (para === de) para = P.TIPOS[(P.TIPOS.indexOf(de) + 3) % P.TIPOS.length];
      const cam = P.caminho(S.g, de, para), vel = 34 + Math.random() * 18;
      if (cam.length) { S.sinapses.push({ cam, t0: agora, vel, cor: de, fim: agora + cam.length / vel * 1000 }); S.efeitos.push({ tipo: 'anel', c: cam[cam.length - 1].c, r: cam[cam.length - 1].r, t0: agora + cam.length / vel * 1000, dur: 500, cor: de, raio: 2 }); }
      S.proxSinapse = agora + 520 + Math.random() * 520;
    }
    if (agora >= S.proxBrilho && S.mapa) {
      const lista = itens(); for (let k = 0; k < 3 && lista.length; k++) { const it = lista[Math.floor(Math.random() * lista.length)], cel = S.mapa.porItem.get(it.id); if (cel) S.efeitos.push({ tipo: 'brilho', c: cel.c, r: cel.r, t0: agora, dur: 900 + Math.random() * 600 }); }
      S.proxBrilho = agora + 140;
    }
    S.sinapses = S.sinapses.filter(s => agora < s.fim + 220); S.efeitos = S.efeitos.filter(e => agora < e.t0 + e.dur + 50);
    desenhar(agora);
    S.raf = root.requestAnimationFrame(laco);
  }
  function acordar() { if (!S.raf && ativo() && !parado()) S.raf = root.requestAnimationFrame(laco); }
  function explodir(t) { if (parado() || !S.mapa) return; const agora = performance.now(); for (const para of P.TIPOS) { if (para === t) continue; const cam = P.caminho(S.g, t, para); if (cam.length) S.sinapses.push({ cam, t0: agora, vel: 60, cor: t, fim: agora + cam.length / 60 * 1000 }); } const k = S.g.regioes[t].centro; S.efeitos.push({ tipo: 'anel', c: k.c, r: k.r, t0: agora, dur: 800, cor: t, raio: 7 }); acordar(); }
  function brilhoBusca() { if (parado() || !S.mapa) return; const agora = performance.now(); filtrados().slice(0, 80).forEach((it, k) => { const cel = S.mapa.porItem.get(it.id); if (cel) S.efeitos.push({ tipo: 'brilho', c: cel.c, r: cel.r, t0: agora + k * 12, dur: 700 }); }); acordar(); }
  function brinde(it) { if (!els.toast) return; els.toast.replaceChildren(h('span', 'cp-toast-tipo', (it.tipo === 'licoes' ? 'Lição nova' : 'Skill nova') + ' hoje'), h('b', '', dado(it.titulo || ''))); els.toast.dataset.tipo = it.tipo; els.toast.hidden = false; clearTimeout(S.tToast); S.tToast = setTimeout(() => { els.toast.hidden = true; }, 4200); }

  function quandoMuda() {
    if (!S.montado && !montar()) return;
    if (parado() && S.raf) { root.cancelAnimationFrame(S.raf); S.raf=0; S.fila=[];S.sinapses=[];S.efeitos=[]; }
    if (ativo()) { medir(); if (!S.d) carregar(); else { pintarLido(); desenharJa(); } if (!S.timer) S.timer = setInterval(() => { if (ativo()) carregar(); }, MINUTO); if (!S.relogio) S.relogio = setInterval(() => { if (ativo()) pintarLido(); }, 30000); }
    else { if (S.raf) { root.cancelAnimationFrame(S.raf); S.raf = 0; } }
  }
  function iniciar() {
    let n = 0; const tenta = () => { if (montar()) { quandoMuda(); return; } if (n++ < 60) setTimeout(tenta, 250); }; tenta();
    new root.MutationObserver(muts => { if (muts.some(m => m.attributeName === 'data-theme')) { S.sujo = true; } if(muts.some(m=>m.attributeName==='lang')&&S.d)pintarTudo(); quandoMuda(); }).observe(html, { attributes: true, attributeFilter: ['data-g-new', 'data-motion', 'data-theme', 'lang'] });
    doc.addEventListener('visibilitychange', () => { quandoMuda(); if (!doc.hidden && ativo()) carregar(); });
    root.addEventListener('hashchange',()=>{const next=lerMistura(), base=lerBase();if(next===MISTURA && base===BASE)return;MISTURA=next;BASE=base;if(els.sec){els.sec.dataset.cerebro=MISTURA;els.sec.dataset.base=BASE;}S.sujo=true;desenharJa();});
    root.addEventListener('painel-tema', () => { S.sujo = true; desenharJa(); });
    if (root.matchMedia) { const mq = root.matchMedia('(prefers-reduced-motion: reduce)'); if (mq.addEventListener) mq.addEventListener('change', () => { if (parado()) { root.cancelAnimationFrame(S.raf); S.raf=0; S.fila=[]; S.sinapses=[]; S.efeitos=[]; } S.sujo = true; desenharJa(); }); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0), { once: true }); else setTimeout(iniciar, 0);
  root.CerebroPixelVista = Object.freeze({
    estado: () => ({ mistura: MISTURA, base: BASE, regioesBase: (S.regioesBase || []).map(r => ({ ...r, cor: r.cor.slice() })), vinculos: S.vinculos.length, sinapses: S.sinapses.length, efeitos: Object.fromEntries(['anel', 'pisca', 'brilho'].map(t => [t, S.efeitos.filter(e => e.tipo === t).length])), quadros: S.quadros, som: false, montado: S.montado, itens: itens().length, periodo: S.periodo, movimento: !parado(), rodando: !!S.raf, contagens: S.d ? Object.fromEntries(P.TIPOS.map(t => [t, P.contagem(S.d, t).texto])) : null, novosHoje: P.novosHoje(itens(), Date.now()).length, fila: S.fila.length }),
    recarregar: carregar,
    medirQuadros: async (ms = 5000) => { const am = []; let ult, ini; await new Promise(ok => { function f(t) { if (ini === undefined) ini = t; if (ult !== undefined) am.push(t - ult); ult = t; if (t - ini >= ms) ok(); else root.requestAnimationFrame(f); } root.requestAnimationFrame(f); }); const o = am.slice().sort((a, b) => a - b); return { quadros: am.length, janelaMs: ms, medianaMs: o[Math.floor(o.length * 0.5)], p95Ms: o[Math.floor(o.length * 0.95)], acima33ms: am.filter(t => t > 33.34).length }; }
  });
})(window);
