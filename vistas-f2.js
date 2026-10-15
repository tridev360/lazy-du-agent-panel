/* vistas-f2.js (F2, 09/10): as 16 abas antigas no formato novo, SEM trocar o JS delas (adaptador por cima).
   Raiz = a vista antiga aberta (#panel-<alvo>, #cronograma-casa ou #rotina-card) + o #drawer aberto (so texto).
   Classes neutras (cor so por variavel do tema, vale GRADE, LIVRO e FOLHA; detalhe em MARCACAO-F2.md):
     f2-piso (letra < 13 px vira 13), f2-frase (caixa alta vira frase), f2-inteiro / f2-desclampa (sem reticencia),
     f2-bloco (1a superficie: sem fundo, borda e sombra, so linha em cima), f2-plano (superficie dentro de superficie some),
     f2-raiz (a propria vista sem moldura), f2-acento (borda de cor a esquerda fica: ela diz quem e).
   Texto (MASTIGAR, via nomes.js): nome de sessao vira nome padrao colorido (.g-nome[data-lado]); TUDO MAIUSCULO vira frase;
     datas dd/mm viram "8 de outubro"; carimbo ISO vira "ha X min" (o cru no title); "12345 min" e "221239 s" viram horas/dias;
     hora UTC vira a hora daqui (o cru no title); id com hifen vira titulo de gente; caminho de arquivo vira o nome (o cru no title);
     acentos so de palavra sem ambiguidade. Tambem: Fila (Todas N, contagem por etapa, conta que bate), WEN novo (tecla W),
     compositor "Para" com nomes padrao e cor, dica de projeto sem lista. So leitura: nada aqui grava nem manda. */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement;
  const N = () => root.PainelNomes || null;
  const h = (tag, cls, ...kids) => { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) { if (k === null || k === undefined || k === false) continue; n.append(k.nodeType ? k : String(k)); } return n; };
  const raizDe = t => !t ? null : doc.querySelector(t === 'cronograma' ? '#cronograma-casa' : t === 'rotina' ? '#rotina-card' : '#panel-' + t);
  const FORA = 'button,input,select,textarea,a,svg,canvas,img,iframe,dialog,video,label,summary';
  const PULA = 'script,style,textarea,input,select,option,code,pre,svg,canvas,iframe,.g-nome,[data-f2-cru],[contenteditable=""],[contenteditable=true]';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // ---------- tempo ----------
  function dur(seg) {
    const s = Math.max(0, Math.round(seg)); if (s < 90) return s + ' s'; const m = Math.round(s / 60); if (m < 90) return m + ' min';
    const hr = Math.round(m / 60); if (hr < 48) return hr + ' h'; return Math.round(hr / 24) + ' dias';
  }
  function ago(t) { if (!Number.isFinite(t)) return '?'; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'agora'; return 'há ' + dur(m * 60); }
  const two = n => String(n).padStart(2, '0');
  const diaMes = d => d.getDate() + ' de ' + MESES[d.getMonth()];

  // ---------- texto: as trocas (cada uma e idempotente: o que ela escreve nao casa de novo) ----------
  const NOMES_RE = /\b(?:COORDENADOR|Coordenador)(?:\s+(?:do\s+)?(?:Claude|CLAUDE|Codex|CODEX))?\b|\bCOORDENACAO\b|\b(?:ATENDIMENTO|LOJA|ASSISTENTE|CONTE[UÚ]DO)\b/g;
  const TROCAS = [
    [/Respons[aá]vel a confirmar/g, 'Sem dono'],
    // a troca de nome nao pode virar "Claude vira Claude" (os dois nomes caem no mesmo nome padrao)
    [/\bCOORDENACAO vira (?:a )?COORDENADOR\b/g, 'Coordenacao vira Claude'],
    [/Robôs automáticos/g, 'Assistente'],
    [/Fonte indispon[ií]vel nesta leitura\.?/g, 'Sem leitura agora (volta sozinho)'],
    [/\bnull(?:null)+\b/g, ''],
    [/\bvalor null\b/gi, 'valor ainda sem número'],
    [/\bleitura (\d+) min · (antiga|recente)\b/g, (m, n, v) => (+n < 1 ? 'lida agora' : 'lida há ' + dur(+n * 60)) + (v === 'antiga' ? ' · antiga' : '')],
    [/\b(\d{3,})\s*(?:min|MIN)\b/g, (m, n) => dur(+n * 60)],
    [/\bidade:\s*(\d{3,})\s*s\b/g, (m, n) => 'idade: ' + dur(+n)],
    [/\b(\d{4,})\s*s\b/g, (m, n) => dur(+n)],
    [/\bn-([a-z]+(?:-[a-z]+)*)-\d{6,}\b/g, (m, w) => 'rodada ' + w.replace(/-/g, ' ')]
  ];
  // "[VIGIA-PROVA-LOCAL-CONCLUIDA-01-10]" -> "Vigia prova local concluída de 1 de outubro"
  const idLimpo = s => s.replace(/^\d+-/, '').replace(/-\d{8}$/, '').toLowerCase();
  function horaUTC(txt, titles) {
    txt = txt.replace(/\b(\d{2})\/(\d{2})(?:\/(20\d{2}))?,?\s+(\d{2}):(\d{2})(?::\d{2})?\s*UTC\b/g, (m, d, mo, y, hh, mm) => {
      const t = Date.UTC(y ? +y : new Date().getFullYear(), +mo - 1, +d, +hh, +mm); if (!Number.isFinite(t)) return m; titles.push(m);
      const dt = new Date(t); return diaMes(dt) + ', ' + two(dt.getHours()) + ':' + two(dt.getMinutes());
    });
    return txt.replace(/\b(\d{2}):(\d{2})(?::\d{2})?\s*UTC\b/g, (m, hh, mm) => { titles.push(m); const d = new Date(); d.setUTCHours(+hh, +mm, 0, 0); return two(d.getHours()) + ':' + two(d.getMinutes()); });
  }
  function mastigar(v) {
    const P = N(); let s = v; const titles = [];
    s = s.replace(/\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g, m => { titles.push(m); return ago(Date.parse(m)); });
    s = horaUTC(s, titles);
    for (const [re, to] of TROCAS) s = s.replace(re, to);
    if (P) {
      s = s.replace(/\[([A-Z0-9]+(?:-[A-Z0-9]+)+)\]/g, (m, inner) => { titles.push(m); return P.titulo(idLimpo(inner)); });
      // caminho de arquivo: fica o nome de gente, o cru no title ("ver fonte")
      s = s.replace(/(?:[A-Za-z]:)?(?:[\w.-]+\/)+([\w-]+)\.(?:md|json|jsonl|cjs|mjs|js|ts|txt|log)\b|\b(\w+(?:-\w+)+|[A-Z]\w+)\.(?:md|json|jsonl|cjs)\b/g, (m, a, b) => { titles.push(m); return P.titulo(String(a || b).toLowerCase()); });
      s = s.replace(/\b(\d{2}\/\d{2})\/20\d{2}\b/g, '$1');
      s = P.datas(s);
      const t = s.trim();
      if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(t) && /[a-z]{3}/.test(t)) { titles.push(t); s = s.replace(t, P.titulo(t)); }
    }
    return { s, titles };
  }
  const acentosSeguro = s => N() ? s.replace(/\S+/g, tok => /[\/_=@#\\]|\.\w{1,5}$|^https?:/.test(tok) ? tok : N().acentos(tok)) : s;
  const letras = s => s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const ehCaixaAlta = s => { const l = letras(s); return l.length > 2 && l === l.toUpperCase(); };
  const CAPS_RUN = /(?<![A-Za-zÀ-ÿ])[A-ZÀ-Þ]{2,}(?:[\s:'"‘’“”,.-]+[A-ZÀ-Þ]{2,}){2,}(?![A-Za-zÀ-ÿ])['"‘’“”]?/g;
  function ladoNome(m, el) {
    const P = N(); if (!P) return [m, ''];
    if (/^coordenador$/i.test(m)) { const codex = el && el.closest('.is-codex,[data-side=codex],[data-lado=codex]'); return codex ? ['Codex', 'codex'] : ['Claude', 'claude']; }
    const nome = P.nome(m.replace(/\s+/g, ' ')); return [nome, P.lado(nome) || 'claude'];
  }
  const cache = new WeakMap();
  function textoNo(t) {
    const v = t.nodeValue; if (!v || !/\S/.test(v) || cache.get(t) === v) return;
    const el = t.parentElement; if (!el || el.closest(PULA)) { cache.set(t, v); return; }
    if (v.trim() === '?') { if (!el.title) el.title = 'Sem leitura desta fonte agora; o painel tenta de novo sozinho.'; cache.set(t, v); return; }
    if (/(?:R\$|US\$)\s?-?[\d.,]+/.test(v) && v.trim().length <= 28) el.classList.add('f2-dinheiro');
    const { s, titles } = mastigar(v);
    // nomes de sessao: separa, para colorir; o resto vira frase se vier todo em caixa alta
    const partes = []; let last = 0, m; NOMES_RE.lastIndex = 0;
    while ((m = NOMES_RE.exec(s))) { partes.push(s.slice(last, m.index), m[0]); last = m.index + m[0].length; }
    partes.push(s.slice(last));
    const caps = ehCaixaAlta(partes.filter((_, i) => i % 2 === 0).join(' '));
    // trecho de 3 ou mais palavras em caixa alta no meio da frase ("TELA NOVA: BOTAO 'EXPORTAR TUDO'") vira frase normal
    const trechoCaps = y => !N() ? y : y.replace(CAPS_RUN, run => { const l = letras(run); return l.length >= 8 ? N().frase(run) : run; });
    const arruma = (x, primeiro) => { let y = caps ? x.toLowerCase() : trechoCaps(x); if (caps && N()) y = N().frase(y); y = acentosSeguro(y); y = caps && !primeiro ? y.replace(/^(\s*)(\S)/, (a, b, c) => b + c.toLowerCase()) : y; return y; };
    if (titles.length && !el.title) el.title = titles.join(' · ');
    if (partes.length === 1) { const novo = arruma(s, true); if (novo !== v) t.nodeValue = novo; cache.set(t, t.nodeValue); return; }
    const frag = doc.createDocumentFragment(), novos = [];
    partes.forEach((p, i) => {
      if (i % 2 === 0) { if (p) { const tn = doc.createTextNode(arruma(p, i === 0)); novos.push(tn); frag.append(tn); } return; }
      const [nome, lado] = ladoNome(p, el); const ant = novos[novos.length - 1]; if (ant && /^(Loja|Assistente|Cortes)$/.test(nome) && /\b[nNdD]a\s+$/.test(ant.nodeValue)) ant.nodeValue = ant.nodeValue.replace(/([nNdD])a(\s+)$/, '$1o$2'); const b = h('span', 'g-nome f2-nome', nome); if (lado) b.dataset.lado = lado; frag.append(b);
    });
    t.replaceWith(frag); for (const tn of novos) cache.set(tn, tn.nodeValue);
  }
  function textoEm(raiz) {
    const w = doc.createTreeWalker(raiz, NodeFilter.SHOW_TEXT); const lista = []; let t;
    while ((t = w.nextNode())) lista.push(t);
    for (const tn of lista) textoNo(tn);
    // rotulo, cabecalho e titulo de trabalho: 1a letra maiuscula (frase normal)
    for (const el of raiz.querySelectorAll('.f2-frase,th,h2,h3,h4,.up-label,.up-record-button>span,.chip,.filter')) {
      if (el.closest(PULA)) continue;
      const tw = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT); let x;
      while ((x = tw.nextNode())) { const v = x.nodeValue, i = v.search(/\S/); if (i < 0) continue; if (x.parentElement && x.parentElement.closest('.g-nome')) break; const ch = v.charAt(i); if (ch !== ch.toUpperCase() && /[a-zà-ÿ]/.test(ch)) { x.nodeValue = v.slice(0, i) + ch.toUpperCase() + v.slice(i + 1); cache.set(x, x.nodeValue); } break; }
    }
  }
  // resumo do "Ver mais" (upgrade.js) sem reticencia: frase de gente cortada na virgula
  function resumoUm(d) {
    const full = d.querySelector('.up-full'), n = d.querySelector('.up-summary-text'); if (!full || !n || !N()) return;
    if (!/…$/.test(n.textContent.trim())) return;
    const novo = N().resumo(full.textContent, { max: 120 }); if (novo) { n.textContent = novo; n.title = 'Texto inteiro em Ver mais'; }
  }
  function resumos(raiz) { for (const d of raiz.querySelectorAll('.up-more')) resumoUm(d); }
  // r11: na faixa de numeros (upgrade.js), card sem numero some e a faixa toda sem numero some (nada de "Sem leitura agora" em fila);
  // "Ver mais" que ficou sem texto (o paragrafo de dentro foi trocado pela vista) tambem some.
  function semNumero(raiz) {
    for (const strip of raiz.querySelectorAll('.up-strip')) {
      let vistos = 0, com = 0;
      for (const card of strip.querySelectorAll('.up-hero')) { const n = card.querySelector('.up-number'), t = n ? n.textContent.trim() : ''; vistos++; const sem = !t || t === '?'; if (sem) card.hidden = true; else { com++; if (card.hidden) card.hidden = false; } }
      strip.hidden = vistos > 0 && com === 0;
    }
    for (const d of raiz.querySelectorAll('.up-more')) { const f = d.querySelector('.up-full'); if (!f || !f.textContent.trim()) d.hidden = true; else if (d.hidden) d.hidden = false; }
  }

  function corteLimpo(s, max) {
    let t = String(s || '').replace(/\s*…\s*$/, '').replace(/\s+/g, ' ').trim(); if (max && t.length > max) t = t.slice(0, max);
    const c = Math.max(t.lastIndexOf('. '), t.lastIndexOf('; '), t.lastIndexOf(', '));
    t = c > 40 ? t.slice(0, c) : (/\s/.test(t) ? t.replace(/\s+\S*$/, '') : t);
    if (t.lastIndexOf('(') > t.lastIndexOf(')')) t = t.slice(0, t.lastIndexOf('(')).trim();
    t = t.replace(/[\s,;:·-]+$/, ''); return t + (/[.!?]$/.test(t) ? '' : '.');
  }
  function semReticencia(raiz) {
    // Historia (clareza-1310): a previa de 2 linhas tem o texto inteiro guardado; corta na virgula, o "Ver mais" ao lado abre o resto
    for (const p of raiz.querySelectorAll('.cl1310-excerpt')) {
      const v = p.textContent; if (!/…\s*$/.test(v) || !p._cl1310FullText) continue;
      const novo = corteLimpo(p._cl1310FullText, v.replace(/…\s*$/, '').length); p.textContent = novo; textoNo(p.firstChild); p.title = 'Texto inteiro em Ver mais';
    }
    // Sessoes (coordenador-pb): a fala vem cortada da fonte; frase cortada na virgula + "Ver mais" (o botao abre a fala inteira)
    for (const s of raiz.querySelectorAll('.jpb-fala-text')) {
      const v = s.textContent; if (!/…\s*$/.test(v)) continue;
      const novo = corteLimpo(v); s.textContent = novo; textoNo(s.firstChild);
      const btn = s.closest('button.jpb-fala-btn');
      if (btn && btn.getAttribute('aria-expanded') !== 'true' && !btn.querySelector('.f2-vermais')) s.after(h('span', 'f2-vermais', 'Ver mais'));
    }
    // Arvore (pe-equipe): "ajudante: o que faz…" vira o nome inteiro (o inteiro ja estava no title da linha)
    for (const t of raiz.querySelectorAll('.pe-ajl-t')) {
      const v = t.textContent, li = t.parentElement; if (!/…\s*$/.test(v) || !li || !li.title) continue;
      const cauda = (li.querySelector('.pe-ajl-tm') || {}).textContent || '', inteiro = cauda && li.title.endsWith(cauda) ? li.title.slice(0, li.title.length - cauda.length) : li.title;
      if (inteiro && inteiro.length >= v.length - 1) { t.textContent = inteiro; textoNo(t.firstChild); }
    }
  }

  // Consumo: o anel do Claude sem numero nao fica "?" sozinho: diz o que falta, a regua do Agora e quem resolve
  function consumoAnel() {
    const ring = doc.getElementById('claude-ring'), reset = doc.getElementById('claude-reset'); if (!ring || !reset || !ring.firstElementChild) return;
    let p = doc.getElementById('f2-claude-solucao');
    if (ring.firstElementChild.textContent.trim() !== '?') { if (p) p.remove(); return; }
    const c = NUM && NUM.credito && NUM.credito.ok === true && NUM.credito.claude, contas = (c && c.contas) || [];
    const regua = contas.map(x => (x.conta || x.quem) + ' ' + (x.texto || '?') + (x.daVez ? ' (em uso)' : '')).join(' · ');
    const txt = '? = esta fonte não trouxe o crédito do Claude.' + (regua ? ' Na régua do Agora: ' + regua + '.' : '') + ' Solução: o Claude relê o crédito na próxima volta.';
    if (!p) { p = h('div', 'g-sec f2-solucao'); p.id = 'f2-claude-solucao'; }
    // repunha a reticencia nos resumos "Ver mais" de todas as vistas a cada volta)
    if (p.dataset.fonte !== txt) { p.dataset.fonte = txt; p.textContent = txt; }
    if (p.previousElementSibling !== reset) reset.after(p);
  }

  // ---------- estilo: piso, frase, sem reticencia, superficies ----------
  function superficie(cs) {
    const bg = cs.backgroundColor, temBg = (!!bg && bg !== 'transparent' && !/^rgba\([^)]*,\s*0\)$/.test(bg)) || (cs.backgroundImage && cs.backgroundImage !== 'none' && !/url\(/.test(cs.backgroundImage));
    const borda = ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(cs['border' + k + 'Width']) > 0 && cs['border' + k + 'Style'] !== 'none');
    return temBg || borda || (cs.boxShadow && cs.boxShadow !== 'none');
  }
  function estiloEm(raiz) {
    if (!raiz.classList.contains('f2-raiz') && superficie(getComputedStyle(raiz))) raiz.classList.add('f2-raiz');
    for (const el of raiz.querySelectorAll('*')) {
      if (el.dataset.f2 === '1') continue;
      if (el.closest('svg,canvas,iframe,.up-strip,[class^="g-"],[class*=" g-"]')) { el.dataset.f2 = '1'; continue; }
      const cs = getComputedStyle(el);
      const proprio = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
      if (proprio && parseFloat(cs.fontSize) < 13) el.classList.add('f2-piso');
      if (cs.textTransform === 'uppercase') el.classList.add('f2-frase');
      if (cs.textOverflow === 'ellipsis') el.classList.add('f2-inteiro');
      if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') el.classList.add('f2-desclampa');
      if (!el.getClientRects().length) continue; // escondido: volta a ver quando aparecer
      if (!el.matches(FORA) && !el.closest('button,a,summary,label') && superficie(cs)) {
        const r = el.getBoundingClientRect();
        if (r.width > 150 && r.height > 50) {
          const dentro = el.parentElement && el.parentElement.closest('.f2-bloco,.f2-plano');
          el.classList.add(dentro && raiz.contains(dentro) ? 'f2-plano' : 'f2-bloco');
          if (parseFloat(cs.borderLeftWidth) >= 2 && cs.borderLeftColor !== cs.borderTopColor) el.classList.add('f2-acento');
        }
      }
      el.dataset.f2 = '1';
    }
  }

  // ---------- FILA: "Todas N", contagem por etapa e 1 linha que bate ----------
  function fila() {
    const tabs = doc.getElementById('phase-tabs'), board = doc.getElementById('board'); if (!tabs || !board || !tabs.childElementCount) return;
    if (!tabs.dataset.f2Ouvinte) {
      tabs.dataset.f2Ouvinte = '1';
      tabs.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.classList.contains('f2-todas')) html.classList.add('f2-fila-todas'); else html.classList.remove('f2-fila-todas'); marcaTabs(); }, true);
    }
    if (tabs.querySelector('.f2-todas')) { marcaTabs(); return; }
    const cols = [...board.querySelectorAll('.phase-column[data-phase]')], botoes = [...tabs.children];
    const nomes = botoes.map(b => b.textContent.trim()), cont = cols.map(c => c.querySelectorAll('tbody tr').length);
    botoes.forEach((b, i) => b.append(h('span', 'f2-n', ' ' + (cont[i] ?? '?'))));
    cols.forEach((c, i) => { if (!c.querySelector('.f2-etapa')) c.prepend(h('h3', 'f2-etapa', nomes[i] + ' ', h('span', 'f2-n', String(cont[i])))); });
    // Todas: cada etapa mostra as 8 primeiras e um botao para a etapa inteira (nada de rolagem dentro de rolagem)
    cols.forEach((c, i) => {
      const rows = [...c.querySelectorAll('tbody tr')]; rows.forEach((r, j) => r.classList.toggle('f2-mais-linha', j >= 8));
      if (rows.length > 8 && !c.querySelector('.f2-ver')) { const ver = h('button', 'f2-ver', 'Ver os ' + rows.length + ' de ' + nomes[i]); ver.type = 'button'; ver.addEventListener('click', () => { html.classList.remove('f2-fila-todas'); botoes[i].click(); root.scrollTo(0, 0); }); c.append(ver); }
    });
    const soma = cont.reduce((a, b) => a + b, 0);
    const todas = h('button', 'f2-todas', 'Todas ', h('span', 'f2-n', String(soma))); todas.type = 'button'; todas.setAttribute('role', 'tab');
    tabs.prepend(todas);
    // vazio: diz onde estao os itens deste filtro
    cols.forEach((c, i) => { const e = c.querySelector('.empty-column'); if (!e) return; const outros = nomes.map((nm, j) => j !== i && cont[j] ? cont[j] + ' em ' + nm : null).filter(Boolean); e.textContent = 'Nenhum em ' + nomes[i] + (outros.length ? '; ' + outros.join(', ') + '.' : '; nenhum trabalho com este filtro.'); });
    // a conta que bate: registrados = na lista por etapa + parados
    let d = null; try { d = typeof data !== 'undefined' ? data : null; } catch { d = null; }
    const tasks = d && Array.isArray(d.tasks) ? d.tasks : null;
    // div (nao p): o upgrade.js embrulha todo p longo num "Ver mais" com reticencia; esta linha cabe inteira em 2 linhas
    let linha = doc.getElementById('f2-fila-conta'); if (!linha) { linha = h('div', 'f2-fila-conta'); linha.id = 'f2-fila-conta'; }
    const F = NUM && NUM.fila;
    if (tasks && root.PainelFila.ok()) {
      linha.replaceChildren(h('b', '', tasks.length + ' trabalhos registrados'), ', cada um em uma etapa só (a mesma conta do painel inteiro)' + (soma !== tasks.length ? '. Com o filtro escolhido: ' + soma + '.' : '.') + (F.tarefas && F.tarefas.porque ? ' ' + F.tarefas.porque.charAt(0).toUpperCase() + F.tarefas.porque.slice(1) + '.' : ''));
      linha.title = 'Por etapa: ' + nomes.map((nm, i) => nm + ' ' + cont[i]).join(', ') + '. ' + (F.parados && F.parados.regra ? F.parados.regra : '');
    } else if (tasks) {
      const ids = new Set(tasks.map(t => t.id)), parados = (d.stalledTasks || []).filter(t => ids.has(t.id)).length, naLista = tasks.length - parados;
      linha.replaceChildren(h('b', '', tasks.length + ' trabalhos registrados'), ': ' + naLista + ' na lista por etapa e ' + parados + ' sem andar há dias (só no botão Parados).' + (soma !== naLista ? ' Com o filtro escolhido: ' + soma + '.' : ''));
      linha.title = 'Por etapa: ' + nomes.map((nm, i) => nm + ' ' + cont[i]).join(', ') + '. Os sem andar há dias (sem log) saem das etapas e ficam só no botão Parados; a etapa Parado é outra coisa (adiada de propósito).';
    } else linha.textContent = 'Trabalhos sem leitura agora (volta sozinho).';
    if (linha.previousElementSibling !== tabs) tabs.after(linha);
    marcaTabs();
  }
  function marcaTabs() {
    const tabs = doc.getElementById('phase-tabs'); if (!tabs) return; const todas = html.classList.contains('f2-fila-todas');
    const etapas = [...tabs.children].filter(b => !b.classList.contains('f2-todas'));
    for (const b of tabs.querySelectorAll('.f2-todas')) b.setAttribute('aria-selected', String(todas));
    const sel = doc.querySelector('#board .phase-column.selected'), i = sel ? [...sel.parentElement.querySelectorAll('.phase-column')].indexOf(sel) : -1;
    etapas.forEach((b, j) => b.setAttribute('aria-selected', String(!todas && j === i)));
  }
  function filaRotulos() {
    const strip = doc.querySelector('#panel-queue .up-strip'); if (!strip) return;
    for (const l of strip.querySelectorAll('.up-label')) {
      const v = l.textContent.trim().toLowerCase();
      const novo = v === 'registros' ? 'Trabalhos registrados' : v === 'itens concluídos' ? 'Itens de checklist feitos nesta semana' : v === 'ramos prontos' ? 'Ramos prontos no git (outra conta que a etapa Pronta)' : null;
      if (novo && l.textContent !== novo) l.textContent = novo;
    }
    const w = doc.createTreeWalker(strip, NodeFilter.SHOW_TEXT); let t;
    while ((t = w.nextNode())) { const m = /^(\s*)(\d+)\/(\d+) itens concluídos(\s*)$/.exec(t.nodeValue); if (m) t.nodeValue = m[1] + m[2] + ' de ' + m[3] + ' itens de checklist nesta semana' + m[4]; }
  }

  // ---------- compositor "Para": nomes padrao, cor do lado, sem caixa alta ----------
  const ALVO_NOME = { claude: ['Claude', 'claude'], codex: ['Codex', 'codex'], dois: ['Os dois', ''], ATENDIMENTO: ['Atendimento', 'claude'], LOJA: ['Loja', 'claude'], ASSISTENTE: ['Assistente', 'claude'], CORTES: ['Cortes', 'claude'] };
  function compositor() {
    const sel = doc.getElementById('cx-alvo'); if (!sel) return;
    for (const o of sel.options) { const a = ALVO_NOME[o.value]; if (!a) continue; if (o.textContent !== a[0]) o.textContent = a[0]; if (a[1]) o.dataset.lado = a[1]; else delete o.dataset.lado; }
    const a = ALVO_NOME[sel.value]; if (a && a[1]) sel.dataset.lado = a[1]; else delete sel.dataset.lado;
    for (const to of doc.querySelectorAll('.cx-to')) if (ehCaixaAlta(to.textContent) && N()) to.textContent = N().frase(to.textContent);
    const ta = doc.getElementById('cx-texto'); if (ta && /COORDENADOR/.test(ta.placeholder)) ta.placeholder = ta.placeholder.replace(/COORDENADOR/g, 'Coordenador');
    const PADRAO = { COORDENADOR: 'Coordenador', ATENDIMENTO: 'Atendimento', LOJA: 'Loja', ASSISTENTE: 'Assistente', CORTES: 'Cortes', 'CORTES': 'Cortes', COORDENACAO: 'Coordenador' };
    for (const c of doc.querySelectorAll('.jpb-compose [placeholder]')) { const v = c.placeholder, n = v.replace(/\b(COORDENADOR|ATENDIMENTO|LOJA|ASSISTENTE|CONTE[UÚ]DO|COORDENACAO)(?![A-Za-zÀ-ÿ])/g, m => PADRAO[m] || m).replace(/\b([pP]ara) a (Loja|Assistente|Cortes)\b/, '$1 o $2'); if (n !== v) c.placeholder = n; }
    if (!sel.dataset.f2Ouvinte) { sel.dataset.f2Ouvinte = '1'; sel.addEventListener('change', () => setTimeout(compositor, 0)); }
  }

  // ---------- PROJETOS sem lista: a dica diz exatamente o que falta ----------
  function obraDica() {
    for (const el of doc.querySelectorAll('#g-agora .opx-sem-lista, #g-agora .opx-leds-sem, #g-agora .opx-tsem')) {
      const p = el.closest('[data-project]'), id = p ? p.dataset.project : '?';
      const dica = '? sem lista: falta linha com coluna Projeto no LANCAMENTO.md ou work com "dono: ' + id + '"';
      if (el.title !== dica) el.title = dica;
      if (el.classList.contains('opx-sem-lista') && el.textContent !== '? sem lista') { el.textContent = '? sem lista'; el.setAttribute('aria-label', dica); }
      if (p && p.title && !p.title.includes('dono: ')) p.title = p.title.replace(/\? falta lista de itens[^\n]*(\n[^\n]*)?/, dica);
    }
  }

  // ---------- WEN (tecla W e clique no placar): le /api/pe-equipe/wen: tabela por frente, Acelerado, Uso de cada IA e, em "Mais", as 7 linhas ----------
  const els = {};
  // WEN em tabela: Frente | Progresso | Faltam | Tasks | Quem trabalha. Claude laranja, Codex azul.
  // Tudo textContent (nada do servidor vira HTML). Sem numero inventado: sem fonte = "?" com a solucao ao lado.
  const SELO = { claude: 'f2-selo f2-selo-claude', codex: 'f2-selo f2-selo-codex', script: 'f2-selo f2-selo-script' };
  const COR_BARRA = { verde: 'g', azul: 'b', laranja: 'a', vermelho: 'r', sem: 's' };
  const selo = x => h('span', SELO[x.tipo] || SELO.script, x.texto);
  const celula = (rot, ...kids) => { const td = h('td', '', h('div', 'f2-cel', ...kids)); td.dataset.rotulo = rot; td.setAttribute('data-rotulo', rot); return td; };
  function barra(pct, cor, rotulo) {
    const b = h('div', 'f2-bar f2-bar-' + (COR_BARRA[cor] || 's')), i = h('i'); b.append(i); b.setAttribute('role', 'img');
    b.setAttribute('aria-label', rotulo + ': ' + (Number.isFinite(pct) ? pct + '%' : '?')); if (Number.isFinite(pct)) i.style.width = Math.max(0, Math.min(100, pct)) + '%';
    return b;
  }
  const pctTxt = pct => h('span', 'g-sec f2-pct', Number.isFinite(pct) ? pct + '%' : '?');
  function wenTabela(T, A, U, E) {
    const raiz = h('div', 'f2-wen-corpo');
    raiz.append(h('p', 'g-sec f2-wen-leg', ...[['claude', 'Claude', 'sessão ou ajudante do Claude'], ['codex', 'Codex', 'sessão do Codex']].flatMap(([t, n, a]) => [selo({ tipo: t, texto: n }), h('span', 'f2-leg-t', a)])));
    if (!T || T.ok !== true) {
      raiz.append(h('p', 'g-sec f2-wen-semleitura', '? Tabela das frentes sem leitura' + (T && T.motivo ? ' (' + T.motivo + ')' : '') + '. Solução: ' + ((T && T.solucao) || 'recarregue o painel; se seguir assim, rode node checar.cjs')));
    } else {
      const tab = h('table', 'f2-wen-tab'), cab = h('tr'); tab.append(h('thead', '', cab));
      for (const c of ['Frente', 'Progresso', 'Faltam', 'Tasks', 'Quem trabalha']) cab.append(h('th', '', c));
      const corpo = h('tbody'); tab.append(corpo);
      for (const f of T.frentes || []) {
        const tr = h('tr', 'f2-wen-linha' + (f.parada ? ' is-parada' : '')); tr.dataset.frente = f.chave;
        // parada = passo aberto e nenhuma sessao da frente com sinal ha mais de 60 min: texto visivel, nao so no title
        const fr = [h('strong', 'f2-frente', f.nome)]; if (f.parada) fr.push(h('span', 'f2-parada' + (f.parada.tipo === 'sem-sinal' ? ' f2-parada-sem' : ''), f.parada.texto)); fr[0].title = 'Fonte: lista de entregas (' + (f.projeto || f.nome) + ')';
        const faltam = [h('strong', 'f2-faltam', f.faltamTexto)]; if(f.velha && Number.isFinite(f.medidoHaMin)) faltam.push(h('span','g-sec','medido há '+Math.round(f.medidoHaMin)+' min')); if (f.solucao) faltam.push(h('span', 'g-sec f2-sol', f.solucao));
        const tasks = [String(f.tasks)]; if (f.cardsTexto) tasks.push(' ', h('span', 'f2-cards', f.cardsTexto));
        const quem = (f.selos || []).map(selo);
        if (f.quemPendente) quem.push(h('span', 'g-sec f2-ninguem', f.quemPendente), h('span', 'g-sec f2-sol', f.quemSolucao || ''));
        else if (!quem.length) quem.push(h('span', 'g-sec f2-ninguem', f.quem || 'ninguém agora'));
        tr.append(celula('Frente', ...fr), celula('Progresso', barra(f.pct, f.cor, f.nome), pctTxt(f.pct)), celula('Faltam', ...faltam), celula('Tasks', ...tasks), celula('Quem trabalha', ...quem));
        if (f.parada) tr.title = f.parada.min === null ? 'Nenhuma sessão do Claude ou do Codex foi vista nesta frente.' : 'Nenhuma sessão, ajudante ou Codex da frente com sinal há ' + f.parada.min + ' min.';
        corpo.append(tr);
      }
      if (!(T.frentes || []).length) raiz.append(h('p', 'g-sec', T.exemplo ? 'Modo exemplo: sem dado real.' : 'none: nenhuma frente com passo aberto.'));
      else raiz.append(tab);
      if (T.entregasVelha) raiz.append(h('p', 'g-sec f2-wen-velha', '? Lista de entregas velha, de ' + (T.entregasHora || '?') + '. Solução: peça ao seu Claude para refazer a lista de entregas (o painel lê de novo sozinho).'));
      else if (T.entregasHora) raiz.append(h('p', 'g-sec', 'Entregas lidas às ' + T.entregasHora + '. Faltam = horas de obra dos passos abertos.'));
    }
    const R = T && T.rodape;
    if (R) {
      const p = h('p', 'f2-wen-rodape', h('span', 'f2-rod-t', 'Trabalhando agora: '), ...(R.selos || []).map(selo));
      if (A && A.rotina && A.rotina.texto) p.append(' ', h('span', 'g-sec f2-rotina', A.rotina.texto));
      raiz.append(p);
    }
    // Acelerado: voltas da rotina de 15 min na ultima hora, "ganhou ~N min" em verde
    const ac = h('section', 'f2-wen-bloco f2-wen-acel'); ac.append(h('h3', 'f2-wen-h', 'Acelerado'));
    if (!A || A.ok === false || A.exemplo) ac.append(h('p', 'g-sec', A && A.exemplo ? 'Modo exemplo: sem dado real.' : ((A && A.texto) || '? voltas sem leitura') + '. ' + ((A && A.solucao) || 'Solução: recarregue o painel; se seguir assim, rode node checar.cjs')));
    else if (!A.itens.length) ac.append(h('p', 'g-sec', 'none: nenhuma aceleração na última hora.' + (A.ultima ? ' A última gravada foi às ' + A.ultima.hora + ' (há ' + A.ultima.idadeMin + ' min).' : '')));
    else {
      ac.append(h('p', 'g-sec f2-acel-nota', 'Horas no relógio deste computador.'));
      const ul = h('ul', 'f2-acel-lista');
      for (const i of A.itens) ul.append(h('li', 'f2-acel-l', h('span', 'g-sec f2-hora', i.hora), h('span', 'f2-acel-t', i.texto), i.ganhoMin === null ? h('span', 'g-sec f2-ganho-sem', i.ganhoTexto) : h('strong', 'f2-ganho', i.ganhoTexto), i.solucao ? h('span', 'g-sec f2-sol', i.solucao) : null));
      ac.append(ul);
      if (A.totalGanhoMin !== null) ac.append(h('p', 'g-sec f2-acel-total', 'Na última hora: ganhou ~' + A.totalGanhoMin + ' min' + (A.semGanho ? ' + ? (' + plural1(A.semGanho, 'volta') + ' sem ganho gravado)' : '') + '.'));
    }
    raiz.append(ac);
    // Uso de cada IA: conta do Claude em uso (laranja) e Codex (azul), % da semana, quando zera e tokens da ultima hora (lidos do arquivo do coletor)
    const us = h('section', 'f2-wen-bloco f2-wen-uso'); us.append(h('h3', 'f2-wen-h', 'Uso de cada IA'));
    if (!U || U.ok === false || U.exemplo) us.append(h('p', 'g-sec', U && U.exemplo ? 'Modo exemplo: sem dado real.' : '? Uso sem leitura' + (U && U.motivo ? ' (' + U.motivo + ')' : '') + '. ' + ((U && U.solucao) || 'Solução: recarregue o painel; se seguir assim, rode node checar.cjs')));
    else {
      const ut = h('table', 'f2-wen-tab f2-wen-tab-uso'), uc = h('tr'); ut.append(h('thead', '', uc));
      for (const c of ['IA', 'Semana usada', 'Zera em', 'Tokens na última hora', 'Observação']) uc.append(h('th', '', c));
      const ub = h('tbody'); ut.append(ub);
      for (const l of U.linhas) {
        const tk = l.tokens || { texto: '?', solucao: 'Solução: rode node tokens-hora-coletor.cjs', obs: '' }, sm = tk.semana; // S13: % da semana ao lado dos tokens
        ub.append(h('tr', 'f2-wen-linha', celula('IA', selo({ tipo: l.ia, texto: l.rotulo })), celula('Semana usada', barra(l.pct, l.cor, l.rotulo), pctTxt(l.pct)), celula('Zera em', h('strong', 'f2-faltam', l.zeraTexto)),
          celula('Tokens na última hora', h('strong', 'f2-faltam', tk.texto + (sm ? ' · ' + sm.texto : '')), sm && sm.pct === null && sm.motivo ? h('span', 'g-sec', ' (' + sm.motivo + ')') : null, tk.solucao ? h('span', 'g-sec f2-sol', tk.solucao) : null, sm && sm.solucao ? h('span', 'g-sec f2-sol', sm.solucao) : null, tk.obs ? h('span', 'g-sec f2-tok-obs', tk.obs) : null), celula('Observação', h('span', 'g-sec', l.obs || ''))));
      }
      us.append(ut);
    }
    raiz.append(us);
    // Economia: o que esta sendo feito para gastar menos, com o efeito (lista que sua IA grava; sem lista = "?" com a solucao, lista vazia = "none")
    const ec = h('section', 'f2-wen-bloco f2-wen-eco'); ec.append(h('h3', 'f2-wen-h', 'Economia'));
    if (E && E.exemplo) ec.append(h('p', 'g-sec', 'Modo exemplo: sem dado real.'));
    else if (!E || E.ok === false) { const mot = (E && E.motivo) || 'lista de economia sem leitura'; ec.append(h('p', 'g-sec', '? ' + mot.charAt(0).toUpperCase() + mot.slice(1) + '. ' + ((E && E.solucao) || 'Solução: peça ao seu Claude para gravar a lista de economia do dia'))); } // B5: o motivo 1 vez
    else if (!E.linhas.length) ec.append(h('p', 'g-sec', 'none: nenhuma medida de economia gravada.' + (E.hora ? ' Lista das ' + E.hora + '.' : '')));
    else {
      const ul = h('ul', 'f2-eco-lista');
      for (const x of E.linhas) ul.append(h('li', 'f2-eco-l', h('span', 'f2-eco-t', x.frase), x.efeito ? h('strong', 'f2-eco-ef', x.efeito) : h('span', 'g-sec', 'efeito ?'), x.efeito ? null : h('span', 'g-sec f2-sol', 'Solução: peça ao seu Claude para escrever o efeito na lista')));
      ec.append(ul);
      ec.append(h('p', 'g-sec', E.velha ? '? Lista velha' + (E.hora ? ', de ' + E.hora : '') + '. Solução: peça ao seu Claude para refazer a lista de economia do dia.' : 'Lista das ' + E.hora + '.'));
    }
    raiz.append(ec);
    return raiz;
  }
  const plural1 = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  function montarWen() {
    const p = h('section', 'f2-wen'); p.id = 'f2-wen'; p.hidden = true; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'WEN em tabela'); p.dataset.dsOwned = 'grade';
    const fechar = h('button', 'g-btn is-quieto', 'Fechar'); fechar.type = 'button'; fechar.addEventListener('click', () => { p.hidden = true; });
    els.wenLido = h('span', 'g-sec', 'lendo...');
    els.wenLista = h('ol', 'f2-wen-linhas'); els.wenTab = h('div', 'f2-wen-caixa', h('p', 'g-sec', 'lendo...'));
    const mais = h('details', 'f2-wen-mais'); mais.append(h('summary', '', 'Mais'));
    els.wenEstado = h('p', 'g-sec f2-wen-estado', '');
    const antigo = h('button', 'g-btn is-quieto', 'Abrir o WEN antigo'); antigo.type = 'button'; antigo.addEventListener('click', () => { p.hidden = true; doc.getElementById('wen-trigger')?.click(); });
    els.wenAuto = h('div', 'f2-wen-auto');
    mais.append(h('h3', 'f2-wen-h', 'As 7 linhas do status'), els.wenLista, h('p', 'g-sec', 'Automatizar só aperta o WEN neste navegador a cada 5 min; não atualiza fonte nenhuma. Este WEN já lê as fontes vivas sozinho.'), els.wenAuto, els.wenEstado, antigo);
    mais.addEventListener('toggle', () => { if (mais.open) autoAqui(); });
    p.append(h('div', 'f2-wen-head', h('h2', 'g-h', 'WEN'), els.wenLido, fechar), els.wenTab, mais);
    doc.body.append(p); els.wen = p;
    const st = doc.getElementById('panel-settings'); if (st) st.addEventListener('toggle', () => { if (st.open) p.hidden = true; });
    return p;
  }
  function autoAqui() {
    const t = doc.getElementById('wen-auto'); if (!t) { els.wenEstado.textContent = 'Automatizar indisponível nesta página.'; return; }
    if (t.parentElement !== els.wenAuto) els.wenAuto.append(t);
    const pinta = () => { const on = t.getAttribute('aria-checked') === 'true'; els.wenEstado.textContent = (on ? 'Ligado' : 'Desligado') + ' neste navegador.'; t.textContent = on ? 'Desligar o automático' : 'Ligar o automático'; };
    pinta(); if (!t.dataset.f2Ouvinte) { t.dataset.f2Ouvinte = '1'; t.addEventListener('click', () => setTimeout(pinta, 30)); }
  }
  async function carregarWen() {
    let j = null;
    try { const c = new AbortController(), to = setTimeout(() => c.abort(), 20000); const r = await fetch('/api/pe-equipe/wen' + (/[?&]exemplo=1\b/.test(root.location.search) ? '?exemplo=1' : ''), { cache: 'no-store', headers: { Accept: 'application/json' }, signal: c.signal }); clearTimeout(to); if (r.ok) j = await r.json(); } catch { j = null; }
    const lista = els.wenLista; lista.replaceChildren();
    if (!j || j.ok !== true || !Array.isArray(j.linhas)) { els.wenLido.textContent = 'sem leitura agora'; els.wenTab.replaceChildren(h('p', 'g-sec', '? O WEN não respondeu agora. Solução: abra de novo em 1 minuto.')); lista.append(h('li', 'g-sec', 'O WEN não respondeu agora; tenta de novo ao abrir (ou pelo WEN antigo, em Mais).')); return; }
    els.wenLido.textContent = 'lido às ' + (j.geradoHora || '?');
    if(root.PainelFluxoTelaModelo) getNorteWen();
    try { els.wenTab.replaceChildren(wenTabela(j.tabela, j.acelerado, j.uso, j.economia)); } catch (e) { console.warn('vistas-f2 wen tabela', e); els.wenTab.replaceChildren(h('p', 'g-sec', '? A tabela não montou agora. Solução: recarregue o painel.')); }
    for (const l of j.linhas) {
      const vazio = !l.texto || l.texto === 'none';
      const txt = h('span', 'f2-wen-t' + (vazio ? ' is-vazio' : ''), vazio ? (l.motivo ? 'Nada agora: ' + l.motivo : 'Nada agora') : l.texto);
      const fonte = h('span', 'g-sec f2-wen-f', l.velho ? 'fonte velha, de ' + (l.fonteHora || '?') : 'fonte ' + (l.fonteHora || '?'));
      fonte.title = (l.fonte || '') + (Number.isFinite(l.idadeMin) ? ' · lida há ' + dur(l.idadeMin * 60) : '');
      const li = h('li', 'f2-wen-l' + (l.velho ? ' is-velho' : ''), h('span', 'g-lab', l.rotulo || '?'), txt, fonte);
      if (l.velho && l.motivo) li.append(h('span', 'g-sec f2-wen-m', '? ' + l.motivo));
      lista.append(li);
    }
    textoEm(lista);
  }
  async function getNorteWen(){
    const sec=h('section','f2-wen-bloco r9-wen-norte');sec.append(h('h3','f2-wen-h','Frentes e prioridades'));
    try{const r=await fetch('/api/pe-equipe/frentes-situacao',{cache:'no-store'}),j=await r.json();if(!j.ok)sec.append(h('p','g-sec','? '+j.motivo+'. Solução: '+j.solucao));else{for(const f of root.PainelFluxoTelaModelo.ordenarNorte(j.frentes)){const medido=f.medidoTexto(/^en/.test(html.lang)?'en':/^es/.test(html.lang)?'es':'pt');sec.append(h('p','g-sec',[f.nome,f.pctTexto,f.faltamTexto,medido,f.selos.situacao.texto].filter(Boolean).join(' · ')));}if(!j.frentes.length)sec.append(h('p','g-sec','none: nenhuma frente nesta leitura'));}}catch{sec.append(h('p','g-sec','? Frentes sem leitura. Confira sua pasta de estado.'));}
    if(els.wenTab){els.wenTab.querySelector('.r9-wen-norte')?.remove();els.wenTab.append(sec);}
  }
  function wen(abrir) {
    const p = els.wen || montarWen();
    if (abrir === false || (abrir === undefined && !p.hidden)) { p.hidden = true; return; }
    const st = doc.getElementById('panel-settings'); if (st) st.open = false;
    const old = doc.querySelector('.wen-panel'); if (old) old.hidden = true;
    p.hidden = false; carregarWen();
  }
  function teclas(ev) {
    const t = ev.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (ev.key === 'Escape' && els.wen && !els.wen.hidden) { els.wen.hidden = true; return; }
    if (typing || ev.ctrlKey || ev.metaKey || ev.altKey || doc.querySelector('dialog[open]')) return;
    if (ev.key === 'w' || ev.key === 'W') { ev.preventDefault(); wen(); }
  }

  // ---------- NUMEROS UNICOS (/api/painel-numeros, ajudante de dados): a mesma conta em toda vista ----------
  let NUM = null;
  async function lerNumeros() {
    try { const r = await fetch('/api/painel-numeros' + (/[?&]exemplo=1\b/.test(root.location.search) ? '?exemplo=1' : ''), { cache: 'no-store', headers: { Accept: 'application/json' } }); if (r.ok) { const j = await r.json(); if (j && j.ok === true) { const antes = filaSig(); NUM = j; if (filaSig() !== antes) redesenhaFila(); agenda(); } } } catch { /* fica a leitura anterior */ }
  }
  // Fila: UMA classificacao, a do /api/painel-numeros/fila (porTarefa); o painel.js le por aqui a etapa e o titulo inteiro
  const ETAPA_CHAVE = { 'Nova': 'new', 'Fazendo': 'doing', 'Pronta': 'ready', 'Em revisão': 'review', 'Liberada': 'released', 'No ar': 'live', 'Parado': 'paused', 'Parado há 3 dias ou mais': 'stalled', 'Sem etapa': 'none' };
  const filaPor = () => (NUM && NUM.fila && NUM.fila.ok !== false && NUM.fila.porTarefa) || null;
  const filaSig = () => { const p = filaPor(); return p ? Object.keys(p).length + ':' + JSON.stringify(NUM.fila.etapas || {}) : ''; };
  function redesenhaFila() { try { if (typeof data !== 'undefined' && data && Array.isArray(data.tasks) && typeof renderBoard === 'function') { renderBoard(); adaptar(); } } catch (e) { console.warn('vistas-f2 fila', e); } }
  root.PainelFila = Object.freeze({
    ok: () => !!filaPor(),
    etapa: id => { const p = filaPor(), x = p && id && p[id]; return x ? ETAPA_CHAVE[x.etapa] || 'none' : null; },
    titulo: id => { const p = filaPor(), x = p && id && p[id]; return x && x.titulo ? x.titulo : null; },
    parados: () => (NUM && NUM.fila && NUM.fila.parados && NUM.fila.parados.itens) || [],
    paradosRegra: () => (NUM && NUM.fila && NUM.fila.parados && NUM.fila.parados.regra) || ''
  });
  function esperaTexto(e) { if (!e || !Number.isFinite(e.total)) return null; if (e.total === 0) return 'nada espera você agora'; const p = e.partes || {}, n = (v, um, varios) => v + ' ' + (v === 1 ? um : varios), partes = [Number.isFinite(p.cards) && p.cards > 0 ? n(p.cards, 'card', 'cards') : null, Number.isFinite(p.passos) && p.passos > 0 ? n(p.passos, 'passo', 'passos') : null].filter(Boolean); return e.total + (e.total === 1 ? ' espera você' : ' esperam você') + (partes.length ? ' (' + partes.join(' e ') + ')' : ''); }
  const esperaCurta = () => esperaTexto(NUM && NUM.espera);
  const creditoLinha = () => { const c = NUM && NUM.credito; if (!c || c.ok !== true) return null; const contas = ((c.claude && c.claude.contas) || []).map(x => (x.conta || x.quem) + ' ' + (x.texto || '?') + (x.daVez ? ' (em uso)' : '') + (/dias/.test(x.idadeTexto || '') ? ' (lido ' + x.idadeTexto + ')' : '')); const cx = c.codex ? 'Codex ' + (c.codex.texto || '?') + (Number.isFinite(c.codex.usadoPct) ? '' : c.codex.ultimoTexto ? ' (' + c.codex.ultimoTexto + ')' : '') : null; return ['Crédito, % usado da semana (a mesma régua do Agora): ' + contas.join(' · '), cx].filter(Boolean).join(' · '); };
  const decididasLinha = () => { const d = NUM && NUM.decididas; if (!d || d.ok !== true) return null; return [d.cards && d.cards.rotulo, d.ideias && d.ideias.rotulo].filter(Boolean).join(' · '); };
  function linhaNumeros(alvo) {
    const L = [], e = esperaCurta(), F = NUM && NUM.fila, La = NUM && NUM.lancamentos, Cr = NUM && NUM.cronograma;
    if (alvo === 'launches') { if (e) L.push('Espera você (a conta do Agora): ' + e); if (La && La.auto && La.auto.ok) L.push('Esta aba lê o gerador de projetos (' + La.auto.n + (La.auto.n === 1 ? ' item' : ' itens') + ', lido ' + (La.auto.idadeTexto || '?') + '); a lista à mão do LANCAMENTO.md (' + La.n + ' itens, ' + (La.fonteTexto || '?') + ') fica só de apoio');
      else if (La && La.antigo && La.antigo.velho) L.push('Esta aba lê a ' + (La.antigo.motivo || 'lista antiga') + '; a viva tem ' + La.n + ' itens (' + (La.fonteTexto || '?') + ')' + (La.auto && !La.auto.ok ? ' · ? gerador de projetos sem leitura (' + La.auto.motivo + '). Solução: ' + La.auto.solucao : '')); if (La && La.dependemRotulo) L.push(La.dependemRotulo); }
    else if (alvo === 'cronograma') { if (Cr) L.push([Cr.rotuloHoje, Cr.antigos && Cr.antigos.rotulo, Cr.listaEscrita && Cr.listaEscrita.rotulo + ' (' + (Cr.listaEscrita.idadeTexto || '?') + ')'].filter(Boolean).join(' · ')); }
    else if (alvo === 'rotina' || alvo === 'team' || alvo === 'flow' || alvo === 'sessions') { if (e) L.push('Espera você (a conta do Agora): ' + e); }
    else if (alvo === 'queue') { if (F && F.tarefas) L.push(F.tarefas.rotulo + (F.tarefas.porque ? ' (' + F.tarefas.porque + ')' : '')); if (F && F.concluidos && F.concluidos.semana) L.push('Concluídos: ' + F.concluidos.semana.rotulo); }
    else if (alvo === 'finances' || alvo === 'consumption' || alvo === 'radar') { const c = creditoLinha(); if (c) L.push(c); }
    else if (alvo === 'council' || alvo === 'ideias') { const d = decididasLinha(); if (d) L.push('Decididas (a conta do Agora): ' + d); }
    return L;
  }
  function faixaNumeros(raiz, alvo) {
    const L = linhaNumeros(alvo); let p = raiz.querySelector(':scope > .f2-numeros');
    if (!L.length) { if (p) p.remove(); return; }
    if (!p) { p = h('div', 'f2-numeros'); p.setAttribute('aria-label', 'Números únicos do painel'); }
    // div (nao p): o upgrade.js corta p longo com reticencia num "Ver mais"; a linha de numeros fica inteira
    const sig = L.join('|'); if (p.dataset.sig !== sig || p.querySelector('.up-more')) { p.dataset.sig = sig; p.replaceChildren(...L.map(x => h('div', 'g-sec', x))); }
    const strip = raiz.querySelector(':scope > .up-strip'), antes = strip ? strip.nextSibling : raiz.querySelector(':scope > :not(h1)');
    if (p.parentElement !== raiz || (strip && p.previousElementSibling !== strip)) raiz.insertBefore(p, antes || null);
  }
  function trocasNumeros(raiz) {
    const e = esperaCurta(); if (!e) return;
    const w = doc.createTreeWalker(raiz, NodeFilter.SHOW_TEXT); let t;
    while ((t = w.nextNode())) { if (t.parentElement && t.parentElement.closest('.f2-numeros,.g-nome')) continue; const v = t.nodeValue; const n = v.replace(/\b\d+ cards? esperam? você\b/gi, e).replace(/nenhum card esperando você/gi, NUM.espera.total > 0 ? e : 'nada espera você'); if (n !== v) { t.nodeValue = n; cache.set(t, n); } }
  }

  // mastigar DENTRO do observador, antes de pintar; sem a janela crua de 140 ms a 3 s ("ATENDIMENTO", "idade: 231010 s", letra de 10 px)
  function pisoEm(lista) {
    const marcar = [];
    for (const el of lista) for (const x of [el, ...el.querySelectorAll('*')]) {
      if (x.dataset.f2 === '1' || x.closest('svg,canvas,iframe,.up-strip,[class^="g-"],[class*=" g-"]')) continue;
      if (![...x.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) continue;
      const cs = getComputedStyle(x); marcar.push([x, parseFloat(cs.fontSize) < 13, cs.textTransform === 'uppercase']);
    }
    // le tudo antes, escreve depois (1 recalculo de estilo so)
    for (const [x, piso, frase] of marcar) { if (piso) x.classList.add('f2-piso'); if (frase) x.classList.add('f2-frase'); }
  }
  function naHora(recs) {
    const novos = new Set();
    for (const r of recs) {
      if (r.type === 'characterData') { if (r.target.parentElement) novos.add(r.target.parentElement); continue; }
      for (const no of r.addedNodes) { const el = no.nodeType === 1 ? no : no.nodeType === 3 ? no.parentElement : null; if (el) novos.add(el); }
    }
    // antigo em 400 deixava os nomes dos ramos ("ATENDIMENTO", letra de 12,5 px) crus ate o laco de 140 ms
    const vivos = [...novos].filter(el => el.isConnected), conj = new Set(vivos);
    const lista = vivos.filter(el => { for (let p = el.parentElement; p && p !== raizAtual; p = p.parentElement) if (conj.has(p)) return false; return !el.closest(PULA); }).slice(0, 4000);
    if (!lista.length) return;
    try { pisoEm(lista); for (const el of lista) textoEm(el); } catch { /* o laco de 140 ms pega o resto */ }
    try { for (const el of lista) { const d = el.closest('.up-more'); if (d) resumoUm(d); else for (const x of el.querySelectorAll('.up-more')) resumoUm(x); } } catch { /* segue */ }
    if (raizAtual && raizAtual.id === 'panel-queue' && lista.some(el => el.id === 'board' || el.id === 'phase-tabs' || el.closest('#board,#phase-tabs'))) try { fila(); } catch { /* o laco pega */ }
  }
  // ---------- laco: observa a vista aberta e o drawer ----------
  let obs = null, raizAtual = null;
  function adaptar() {
    const raiz = raizDe(html.dataset.gOld);
    if (raiz !== raizAtual) { if (obs) obs.disconnect(); raizAtual = raiz; if (raiz && root.MutationObserver) { obs = new MutationObserver(recs => { naHora(recs); agenda(); }); obs.observe(raiz, { childList: true, subtree: true, characterData: true }); } }
    if (raiz) { try { estiloEm(raiz); textoEm(raiz); trocasNumeros(raiz); faixaNumeros(raiz, html.dataset.gOld); resumos(raiz); semNumero(raiz); semReticencia(raiz); if (raiz.id === 'panel-queue') { fila(); filaRotulos(); } } catch (e) { console.warn('vistas-f2', e); } }
    const dr = doc.getElementById('drawer'); if (dr && dr.open) try { textoEm(dr); } catch { /* segue */ }
    const ga = doc.getElementById('g-agora'); if (ga && !ga.dataset.f2Ouvinte && root.MutationObserver) { ga.dataset.f2Ouvinte = '1'; new MutationObserver(agenda).observe(ga, { childList: true, subtree: true }); }
    // FOLHA: o Agora dela (#fh-agora, blocos-folha.js) passa pelo mesmo mastigar (nome padrao colorido, frase, horas)
    const fh = doc.getElementById('fh-agora');
    if (fh) { try { textoEm(fh); } catch { /* segue */ } if (!fh.dataset.f2Ouvinte && root.MutationObserver) { fh.dataset.f2Ouvinte = '1'; new MutationObserver(agenda).observe(fh, { childList: true, subtree: true, characterData: true }); } }
    try { compositor(); obraDica(); verTudo(); consumoAnel(); } catch { /* segue */ }
  }
  // Agora: pergunta cortada em 2 linhas ganha "ver tudo" (abre ali mesmo, sem reticencia escondendo o essencial)
  const abertos = new Set();
  function verTudo() {
    for (const c of doc.querySelectorAll('#g-agora .g-item .g-clamp')) {
      const li = c.closest('.g-item'), chave = (li && li.dataset.id) || c.textContent.slice(0, 80);
      if (abertos.has(chave)) c.classList.add('f2-aberto');
      const corta = c.classList.contains('f2-aberto') || c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2;
      let b = c.nextElementSibling && c.nextElementSibling.classList.contains('f2-vertudo') ? c.nextElementSibling : null;
      if (!corta) { if (b) b.remove(); continue; }
      if (!b) { b = h('button', 'f2-vertudo'); b.type = 'button'; b.addEventListener('click', ev => { ev.stopPropagation(); const on = !c.classList.contains('f2-aberto'); c.classList.toggle('f2-aberto', on); if (on) abertos.add(chave); else abertos.delete(chave); b.textContent = on ? 'Ver menos' : 'Ver tudo'; b.setAttribute('aria-expanded', String(on)); }); c.after(b); }
      const on = c.classList.contains('f2-aberto'); b.textContent = on ? 'Ver menos' : 'Ver tudo'; b.setAttribute('aria-expanded', String(on));
    }
  }
  // 140 ms depois da ultima mudanca, mas nunca mais de ~0,5 s esperando (vista que muda sem parar empurrava ate o laco de 3 s)
  let tmr = null, desde = 0; function agenda() { const t = Date.now(); if (!tmr) desde = t; clearTimeout(tmr); tmr = setTimeout(() => { tmr = null; adaptar(); }, t - desde > 500 ? 0 : 140); }
  function start() {
    html.classList.add('f2-fila-todas');
    new MutationObserver(agenda).observe(html, { attributes: true, attributeFilter: ['data-g-old', 'data-g-new'] });
    const dr = doc.getElementById('drawer'); if (dr) new MutationObserver(agenda).observe(dr, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true });
    doc.addEventListener('click', () => setTimeout(agenda, 260), true);
    doc.addEventListener('keydown', teclas);
    root.addEventListener('hashchange', agenda);
    setInterval(adaptar, 3000); agenda(); lerNumeros(); setInterval(lerNumeros, 30000);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(start, 40), { once: true }); else setTimeout(start, 40);
  root.PainelF2 = Object.freeze({ wen, wenTabela, adaptar, numeros: () => NUM, mastigar: s => mastigar(String(s || '')).s, textoEm });
})(window);
