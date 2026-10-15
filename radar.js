'use strict';
(function (root) {
  const T = {
    pt: { kicker: 'Radar', title: 'O que mais puxa, o que custa e onde estamos atrás', sub: 'O Agente fez as contas deitado: número só com fonte, e todo "?" vem com a solução.', refresh: 'Atualizar', loading: 'Lendo o radar…',
      fresh: 'atualizado sozinho', manual: 'feito à mão', old: 'gerado agora pelo painel', missing: 'gerado agora pelo painel', made: 'Gerado', noSchedule: 'Atualizar sozinho: o agendamento ainda não está ligado.', noScheduleFix: 'o COORDENADOR liga a tarefa de 15 em 15 min no PC (comando pronto na entrega).',
      approx: 'aprox.', q1: 'Mais puxado da rede', q2: 'O que custa mais', q3: 'Onde estamos atrás', q4: 'Fazer primeiro', perRoute: 'Uso por tela do Terminal', of: 'de', behind: 'features em que o concorrente ganha', outGame: 'fora {n} que não vale fazer',
      usage: 'Uso e custo', usageNote: 'O que já dá para medir sem chave nenhuma.', credit: 'Crédito e máquinas', network: 'Rede e motor', costs: 'O que custa mais por mês', unknown: 'Ainda sem número',
      week: 'da semana', window5h: '5 h', read: 'lido', resets: 'zera', pace: 'ritmo', perHour: '/h', endsAt: 'acaba ~{t}', beforeReset: 'antes de zerar', afterReset: 'depois de zerar', cores: 'núcleos', ram: 'RAM', freeDisk: 'disco livre', top: 'quem mais usa',
      usd: 'em dólar, sem conversão', solution: 'Solução', who: 'Quem', board: 'Placar contra os concorrentes', boardNote: 'Cada linha diz de onde veio. Toque numa linha para ver como alcançar, custo e fonte.',
      doNow: 'Fazer agora', later: 'Depois', never: 'Não fazer', feature: 'Feature', us: 'Nós', best: 'Melhor concorrente', diff: 'Dif.', rec: 'Recomendação',
      how: 'Como alcançar', cost: 'Custo estimado', practice: 'Na prática', why: 'Por quê', depends: 'Depende de', disagree: 'Divergência', target: 'Depois do passo', source: 'Fonte',
      creditWord: 'crédito', hoursWord: 'tempo', serviceWord: 'serviço pago', scale: 'Escala da dificuldade', curated: 'Curado', by: 'pela', sources: 'A fonte de cada linha fica no detalhe dela.', effort: { P: 'pequena', M: 'média', G: 'grande' }, effortWord: 'Dificuldade', split: 'As lentes discordam: veja no detalhe', paceWord: 'ritmo de gasto', perHourLong: 'por hora em {h} h ({n} leituras)',
      exampleOff: 'No exemplo o Radar fica desligado: ele só mostra dado real.', fail: 'Radar sem leitura agora.', failFix: 'Solução: o painel tenta de novo em 1 min; se seguir, rodar node radar-gerar.cjs na pasta do painel.',
      types: { medido: 'medido', estimado: 'estimado', 'conta feita': 'conta feita', 'lido no código': 'lido no código', 'regra do envio': 'regra', registro: 'registro' }, home: 'casa', none: 'none' },
    en: { kicker: 'Radar', title: 'What pulls the most, what costs the most and where we are behind', sub: 'The Agente did the math lying down: numbers only with a source, every "?" comes with the fix.', refresh: 'Refresh', loading: 'Reading the radar…',
      fresh: 'updated on its own', manual: 'made by hand', old: 'built now by the panel', missing: 'built now by the panel', made: 'Built', noSchedule: 'Updating on its own: the schedule is not on yet.', noScheduleFix: 'COORDENADOR turns on the 15 min work on the PC (command ready in the delivery).',
      approx: 'approx.', q1: 'Pulls the most from the network', q2: 'Costs the most', q3: 'Where we are behind', q4: 'Do first', perRoute: 'Use per Terminal screen', of: 'of', behind: 'features where the best competitor wins', outGame: 'not counting {n} not worth doing',
      usage: 'Usage and cost', usageNote: 'What we can already measure with no key at all.', credit: 'Credit and machines', network: 'Network and engine', costs: 'What costs the most per month', unknown: 'No number yet',
      week: 'of the week', window5h: '5 h', read: 'read', resets: 'resets', pace: 'pace', perHour: '/h', endsAt: 'runs out ~{t}', beforeReset: 'before the reset', afterReset: 'after the reset', cores: 'cores', ram: 'RAM', freeDisk: 'free disk', top: 'top users',
      usd: 'in dollars, not converted', solution: 'Fix', who: 'Who', board: 'Scoreboard against competitors', boardNote: 'Every row says where it came from. Tap a row to see how to catch up, cost and source.',
      doNow: 'Do now', later: 'Later', never: "Don't do", feature: 'Feature', us: 'Us', best: 'Best competitor', diff: 'Eff.', rec: 'Recommendation',
      how: 'How to catch up', cost: 'Estimated cost', practice: 'In practice', why: 'Why', depends: 'Depends on', disagree: 'Disagreement', target: 'After the step', source: 'Source',
      creditWord: 'credit', hoursWord: 'time', serviceWord: 'paid service', scale: 'Effort scale', curated: 'Curated', by: 'by', sources: 'Each row keeps its source in its details.', effort: { P: 'small', M: 'medium', G: 'large' }, effortWord: 'Effort', split: 'The lenses disagree: see the details', paceWord: 'spending pace', perHourLong: 'per hour over {h} h ({n} readings)',
      exampleOff: 'In the example the Radar is off: it only shows real data.', fail: 'Radar has no reading right now.', failFix: 'Fix: the panel tries again in 1 min; if it stays, run node radar-gerar.cjs in the panel folder.',
      types: { medido: 'measured', estimado: 'estimate', 'conta feita': 'math', 'lido no código': 'from code', 'regra do envio': 'rule', registro: 'log' }, home: 'ours', none: 'none' },
    es: { kicker: 'Radar', title: 'Qué tira más, qué cuesta más y dónde estamos atrás', sub: 'El Agente hizo las cuentas acostado: número solo con fuente, y todo "?" trae la solución.', refresh: 'Actualizar', loading: 'Leyendo el radar…',
      fresh: 'actualizado solo', manual: 'hecho a mano', old: 'generado ahora por el panel', missing: 'generado ahora por el panel', made: 'Generado', noSchedule: 'Actualizar solo: la agenda aún no está activada.', noScheduleFix: 'COORDENADOR activa la tarea de cada 15 min en el PC (comando listo en la entrega).',
      approx: 'aprox.', q1: 'Lo que más tira de la red', q2: 'Lo que más cuesta', q3: 'Dónde estamos atrás', q4: 'Hacer primero', perRoute: 'Uso por pantalla del Terminal', of: 'de', behind: 'features en que gana el mejor competidor', outGame: 'sin contar {n} que no vale hacer',
      usage: 'Uso y costo', usageNote: 'Lo que ya se puede medir sin ninguna clave.', credit: 'Crédito y máquinas', network: 'Red y motor', costs: 'Lo que más cuesta por mes', unknown: 'Aún sin número',
      week: 'de la semana', window5h: '5 h', read: 'leído', resets: 'reinicia', pace: 'ritmo', perHour: '/h', endsAt: 'se acaba ~{t}', beforeReset: 'antes de reiniciar', afterReset: 'después de reiniciar', cores: 'núcleos', ram: 'RAM', freeDisk: 'disco libre', top: 'quién más usa',
      usd: 'en dólares, sin conversión', solution: 'Solución', who: 'Quién', board: 'Marcador contra los competidores', boardNote: 'Cada línea dice de dónde salió. Toca una línea para ver cómo alcanzar, costo y fuente.',
      doNow: 'Hacer ya', later: 'Después', never: 'No hacer', feature: 'Feature', us: 'Nosotros', best: 'Mejor competidor', diff: 'Dif.', rec: 'Recomendación',
      how: 'Cómo alcanzar', cost: 'Costo estimado', practice: 'En la práctica', why: 'Por qué', depends: 'Depende de', disagree: 'Divergencia', target: 'Después del paso', source: 'Fuente',
      creditWord: 'crédito', hoursWord: 'tiempo', serviceWord: 'servicio pago', scale: 'Escala de dificultad', curated: 'Curado', by: 'por', sources: 'La fuente de cada línea está en su detalle.', effort: { P: 'pequeña', M: 'media', G: 'grande' }, effortWord: 'Dificultad', split: 'Las lentes no coinciden: mira el detalle', paceWord: 'ritmo de gasto', perHourLong: 'por hora en {h} h ({n} lecturas)',
      exampleOff: 'En el ejemplo el Radar está apagado: solo muestra datos reales.', fail: 'Radar sin lectura ahora.', failFix: 'Solución: el panel lo intenta de nuevo en 1 min; si sigue, correr node radar-gerar.cjs en la carpeta del panel.',
      types: { medido: 'medido', estimado: 'estimado', 'conta feita': 'cuenta', 'lido no código': 'del código', 'regra do envio': 'regla', registro: 'registro' }, home: 'casa', none: 'none' }
  };
  const POS = { pt: { PIOR: 'PIOR', IGUAL: 'IGUAL', MELHOR: 'MELHOR', 'SO NOS': 'SÓ NÓS' }, en: { PIOR: 'BEHIND', IGUAL: 'EVEN', MELHOR: 'AHEAD', 'SO NOS': 'ONLY US' }, es: { PIOR: 'PEOR', IGUAL: 'IGUAL', MELHOR: 'MEJOR', 'SO NOS': 'SOLO NOSOTROS' } };
  const POS_KEY = { PIOR: 'pior', IGUAL: 'igual', MELHOR: 'melhor', 'SO NOS': 'sonos' };
  const REC = ['AGORA', 'DEPOIS', 'NUNCA'];
  const words = lang => T[lang] || T.pt;
  const recLabel = (rec, w) => rec === 'AGORA' ? w.doNow : rec === 'DEPOIS' ? w.later : w.never;
  function el(doc, tag, cls, text) { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; }
  function num(v, lang) { return Number.isFinite(v) ? new Intl.NumberFormat(lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt-BR', { maximumFractionDigits: 1 }).format(v) : '?'; }
  // Horas chegam como "AAAA-MM-DDTHH:MM:SS-03:00" (BRT); o texto mostra HH:MM, e o dia quando não é hoje.
  function quando(iso, nowIso) { if (typeof iso !== 'string' || iso.length < 16) return '?'; const hm = iso.slice(11, 16), dia = iso.slice(8, 10) + '/' + iso.slice(5, 7); return nowIso && nowIso.slice(0, 10) === iso.slice(0, 10) ? hm : dia + ' ' + hm; }
  function idade(min) { if (!Number.isFinite(min)) return '?'; return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') + ' min'; }
  function chipPos(doc, pos, lang) { if (!pos) return el(doc, 'span', 'rd-pos rd-pos-casa', words(lang).home); const c = el(doc, 'span', 'rd-pos rd-pos-' + POS_KEY[pos], (POS[lang] || POS.pt)[pos]); return c; }
  function chipRec(doc, rec, lang) { return el(doc, 'span', 'rd-rec rd-rec-' + rec.toLowerCase(), recLabel(rec, words(lang))); }
  function chipTipo(doc, tipo, lang) { const w = words(lang); return el(doc, 'span', 'rd-tipo rd-tipo-' + (tipo === 'medido' ? 'medido' : tipo === 'estimado' ? 'estimado' : 'outro'), w.types[tipo] || tipo || '?'); }
  function bar(doc, pct, cls) { const track = el(doc, 'span', 'rd-bar ' + (cls || '')), fill = el(doc, 'span', 'rd-bar-fill'); const v = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0; fill.style.setProperty('--rd-w', v + '%'); track.append(fill); track.setAttribute('aria-hidden', 'true'); return track; }
  function interrogacao(doc, texto, solucao, lang) { const box = el(doc, 'p', 'rd-q'); box.append(el(doc, 'b', 'rd-q-mark', '?'), el(doc, 'span', 'rd-q-text', texto)); if (solucao) box.append(el(doc, 'span', 'rd-q-fix', words(lang).solution + ': ' + solucao)); return box; }

  function heroes(doc, d, lang) {
    const w = words(lang), wrap = el(doc, 'section', 'rd-heroes'), h = d.herois || {}, claude = d.uso?.claude;
    const card = (key, label, value, caption, extra, target) => { const b = el(doc, 'button', 'rd-hero rd-hero-' + key); b.type = 'button'; b.dataset.alvo = target; b.append(el(doc, 'span', 'rd-hero-label', label), el(doc, 'strong', 'rd-hero-value', value), el(doc, 'span', 'rd-hero-caption', caption)); if (extra) b.append(extra); wrap.append(b); return b; };
    // a linha "uso por tela" so entra quando a medida traz a rota; sem ela o cartao fica so com o numero e a legenda
    const puxado = h.maisPuxado || {}, rota = puxado.rota ? el(doc, 'span', 'rd-hero-extra') : null; if (rota) rota.append(el(doc, 'b', 'rd-q-mark', '?'), el(doc, 'span', '', ' ' + w.perRoute + (puxado.rota?.solucao ? ' · ' + words(lang).solution + ': ' + puxado.rota.solucao : '')));
    card('puxado', w.q1, puxado.valor || '?', [puxado.titulo, puxado.unidade].filter(Boolean).join(' · ') + (puxado.tipo ? ' (' + (w.types[puxado.tipo] || puxado.tipo) + ')' : ''), rota, 'rd-uso');
    const caro = h.custaMais || {}; let ritmo = null;
    if (claude?.ritmo?.acabaEm) { ritmo = el(doc, 'span', 'rd-hero-extra rd-hero-alert'); ritmo.textContent = 'Claude ' + (claude.conta || '?') + ': ' + num(claude.semanaPct, lang) + '% ' + w.week + ', ' + w.endsAt.replace('{t}', quando(claude.ritmo.acabaEm, d.geradoEm)) + (claude.ritmo.acabaAntesDeZerar === true ? ' (' + w.beforeReset + ')' : ''); }
    card('caro', w.q2, caro.valor || '?', [caro.unidade, caro.titulo].filter(Boolean).join(' · ') + (caro.tipo ? ' (' + w.approx + ')' : ''), ritmo, 'rd-custos');
    const atras = h.atras || {}; card('atras', w.q3, Number.isFinite(atras.valor) ? atras.valor + ' ' + w.of + ' ' + atras.de : '?', w.behind + (atras.fora ? ' · ' + w.outGame.replace('{n}', atras.fora) : ''), null, 'rd-placar');
    const p = h.primeiro; const pri = card('primeiro', w.q4, p ? p.titulo : '?', p ? p.porque : '', p ? el(doc, 'span', 'rd-hero-extra', w.effortWord + ' ' + (w.effort[p.dificuldade] || p.dificuldade)) : null, 'rd-agora'); pri.classList.add('rd-hero-text');
    return wrap;
  }
  function creditoRow(doc, nome, lado, info, lang, nowIso) {
    const w = words(lang), row = el(doc, 'div', 'rd-meter rd-lado-' + lado), head = el(doc, 'div', 'rd-meter-head');
    head.append(el(doc, 'span', 'rd-meter-name', nome));
    if (!info || info.estado !== 'ok') { row.append(head, interrogacao(doc, w.read + ': ?', info?.solucao, lang)); return row; }
    head.append(el(doc, 'strong', 'rd-meter-value', num(info.semanaPct, lang) + '% ' + w.week + (Number.isFinite(info.janela5hPct) ? ' · ' + w.window5h + ': ' + num(info.janela5hPct, lang) + '%' : '')));
    const sub = [w.read + ' ' + quando(info.leitura?.em, nowIso) + ' · ' + idade(info.leitura?.minutos)];
    if (info.zeraSemana) sub.push(w.resets + ' ' + quando(info.zeraSemana, nowIso));
    if (info.ritmo) sub.push(w.paceWord + ' +' + num(info.ritmo.pontosPorHora, lang) + ' ' + w.perHourLong.replace('{h}', num(info.ritmo.horas, lang)).replace('{n}', info.ritmo.n) + (info.ritmo.acabaEm ? ': ' + w.endsAt.replace('{t}', quando(info.ritmo.acabaEm, nowIso)) + ', ' + (info.ritmo.acabaAntesDeZerar ? w.beforeReset : w.afterReset) : ''));
    row.append(head, bar(doc, info.semanaPct, 'rd-bar-' + lado), el(doc, 'p', 'rd-meter-sub' + (info.leitura?.velha ? ' rd-velha' : ''), sub.join(' · ')));
    if (info.leitura?.velha) row.append(interrogacao(doc, w.read + ' ' + idade(info.leitura?.minutos), lado === 'claude' ? 'a leitura volta quando a fonte do Claude for atualizada.' : 'a leitura volta quando estado/uso-codex.json for atualizado.', lang));
    return row;
  }
  function maquinaRow(doc, m, lang, nowIso) {
    const w = words(lang), row = el(doc, 'div', 'rd-meter rd-lado-maquina'), head = el(doc, 'div', 'rd-meter-head');
    head.append(el(doc, 'span', 'rd-meter-name', m.nome));
    if (m.estado !== 'ok') { row.append(head, interrogacao(doc, w.cores + ': ? de ' + (m.nucleosTotal ?? '?'), m.solucao, lang)); return row; }
    head.append(el(doc, 'strong', 'rd-meter-value', num(m.nucleos, lang) + ' ' + w.of + ' ' + m.nucleosTotal + ' ' + w.cores));
    const sub = [w.ram + ' ' + num(m.ramGb, lang) + ' ' + w.of + ' ' + num(m.ramTotalGb, lang) + ' GB', w.freeDisk + ' ' + num(m.discoLivreGb, lang) + ' GB', w.read + ' ' + quando(m.leitura?.em, nowIso) + ' · ' + idade(m.leitura?.minutos)];
    row.append(head, bar(doc, m.nucleosTotal ? m.nucleos / m.nucleosTotal * 100 : null, 'rd-bar-maquina'), el(doc, 'p', 'rd-meter-sub' + (m.leitura?.velha ? ' rd-velha' : ''), sub.join(' · ')));
    if (m.mais?.length) row.append(el(doc, 'p', 'rd-meter-sub', w.top + ': ' + m.mais.map(f => f.nome + ' (' + num(f.nucleos, lang) + ' ' + w.cores + ')').join(', ')));
    return row;
  }
  function uso(doc, d, lang) {
    const w = words(lang), sec = el(doc, 'section', 'rd-section'), nowIso = d.geradoEm; sec.id = 'rd-uso';
    const head = el(doc, 'div', 'rd-section-head'); head.append(el(doc, 'h3', 'rd-h', w.usage), el(doc, 'p', 'rd-note', w.usageNote)); sec.append(head);
    const grid = el(doc, 'div', 'rd-grid'); sec.append(grid);
    const c1 = el(doc, 'article', 'rd-card'); c1.append(el(doc, 'h4', 'rd-card-title', w.credit));
    const conta = d.uso?.claude?.conta; // "Sua conta" ja diz conta: nao vira "conta Sua conta"
    c1.append(creditoRow(doc, 'Claude' + (conta ? ' · ' + (/conta/i.test(conta) ? conta : 'conta ' + conta) : ''), 'claude', d.uso?.claude, lang, nowIso), creditoRow(doc, 'Codex', 'codex', d.uso?.codex, lang, nowIso));
    for (const m of d.uso?.maquinas || []) c1.append(maquinaRow(doc, m, lang, nowIso));
    const c2 = el(doc, 'article', 'rd-card'); c2.append(el(doc, 'h4', 'rd-card-title', w.network));
    const list = el(doc, 'ul', 'rd-list');
    for (const m of d.medidas || []) { const li = el(doc, 'li', 'rd-medida'), top = el(doc, 'div', 'rd-medida-top'); top.append(el(doc, 'span', 'rd-medida-name', m.nome), chipTipo(doc, m.tipo, lang)); li.append(top, el(doc, 'p', 'rd-medida-value', m.valor)); const meta = el(doc, 'p', 'rd-medida-meta', quando(m.quando, nowIso) + ' · ' + m.janela); meta.title = w.source + ': ' + (m.fonte || []).map(f => f.arquivo).join(', '); li.append(meta); if (/\?/.test(m.janela || '') && !/\(/.test(m.janela)) li.append(interrogacao(doc, m.janela, null, lang)); list.append(li); }
    c2.append(list);
    const c3 = el(doc, 'article', 'rd-card'); c3.id = 'rd-custos'; c3.append(el(doc, 'h4', 'rd-card-title', w.costs));
    const itens = d.custos?.itens || [], max = Math.max(1, ...itens.filter(i => Number.isFinite(i.mes)).map(i => i.mes)), cl = el(doc, 'ol', 'rd-costs');
    for (const i of itens) {
      const li = el(doc, 'li', 'rd-cost' + (Number.isFinite(i.mes) ? '' : ' rd-cost-usd')), top = el(doc, 'div', 'rd-cost-top');
      top.append(el(doc, 'span', 'rd-cost-name', i.nome), el(doc, 'strong', 'rd-cost-value', Number.isFinite(i.mes) ? 'R$ ' + num(i.mes, lang) : i.texto || '?')); li.append(top);
      if (Number.isFinite(i.mes)) li.append(bar(doc, i.mes / max * 100, 'rd-bar-custo'));
      li.append(el(doc, 'p', 'rd-cost-meta', [i.nota, i.tipo, Number.isFinite(i.mes) ? null : w.usd].filter(Boolean).join(' · '))); cl.append(li);
    }
    if (!itens.length) c3.append(interrogacao(doc, w.costs + ': ?', d.custos?.solucao, lang)); else c3.append(cl);
    const c4 = el(doc, 'article', 'rd-card rd-card-unknown'); c4.append(el(doc, 'h4', 'rd-card-title', w.unknown));
    const ul = el(doc, 'ul', 'rd-list');
    for (const u of d.semMedida || []) { const li = el(doc, 'li', 'rd-unknown'); li.append(interrogacao(doc, u.o_que, u.solucao, lang), el(doc, 'p', 'rd-unknown-who', w.who + ': ' + u.quem)); ul.append(li); }
    c4.append(ul);
    // o quadro "Ainda sem numero" so entra quando ha algo sem medida; vazio ele so ocupa espaco
    grid.append(c1, c2, c3); if ((d.semMedida || []).length) grid.append(c4);
    return sec;
  }
  function detalhe(doc, r, lang, id) {
    const w = words(lang), box = el(doc, 'div', 'rd-detail'); box.id = id; const dl = el(doc, 'dl', 'rd-dl');
    const add = (k, v) => { if (!v) return; dl.append(el(doc, 'dt', '', k), el(doc, 'dd', '', v)); };
    add(w.how, r.como); add(w.cost, [w.creditWord + ' ' + r.custo.credito, w.hoursWord + ' ' + r.custo.horas, w.serviceWord + ' ' + r.custo.servico].join(' · '));
    add(w.practice, r.pratica); add(w.why, r.porque); add(w.depends, r.depende); add(w.disagree, r.divergencia);
    if (r.alvo) add(w.target, (POS[lang] || POS.pt)[r.alvo]);
    add(w.source, (r.fonte || []).map(f => f.arquivo.replace(/^estado\/ideias\//, '') + ' (' + f.onde + ')' + (f.existe === false ? ' ?' : '')).join('; '));
    box.append(dl); return box;
  }
  function placar(doc, d, lang, open) {
    const w = words(lang), p = d.placar || {}, sec = el(doc, 'section', 'rd-section'); sec.id = 'rd-placar';
    const head = el(doc, 'div', 'rd-section-head'); head.append(el(doc, 'h3', 'rd-h', w.board), el(doc, 'p', 'rd-note', w.boardNote)); sec.append(head);
    for (const a of p.avisos || []) sec.append(interrogacao(doc, a.texto, a.solucao, lang));
    const c = p.contagem || {}, total = ['PIOR', 'IGUAL', 'MELHOR', 'SO NOS'].reduce((s, k) => s + (c[k] || 0), 0), stack = el(doc, 'div', 'rd-stack'), legend = el(doc, 'div', 'rd-legend');
    stack.setAttribute('role', 'img'); stack.setAttribute('aria-label', ['PIOR', 'IGUAL', 'MELHOR', 'SO NOS'].map(k => (POS[lang] || POS.pt)[k] + ' ' + (c[k] || 0)).join(', '));
    for (const k of ['PIOR', 'IGUAL', 'MELHOR', 'SO NOS']) { const n = c[k] || 0; if (n) { const s = el(doc, 'span', 'rd-stack-part rd-bg-' + POS_KEY[k]); s.style.setProperty('flex-grow', String(n)); stack.append(s); } const item = el(doc, 'span', 'rd-legend-item'); item.append(chipPos(doc, k, lang), el(doc, 'b', 'rd-legend-n', String(n))); legend.append(item); }
    const resumo = el(doc, 'div', 'rd-summary'); resumo.append(stack, legend);
    if (p.consolidado) resumo.append(el(doc, 'p', 'rd-note', 'SINTESE: ' + p.consolidado.texto + '.'));
    sec.append(resumo);
    const linhas = p.linhas || [], agora = linhas.filter(r => r.recomendacao === 'AGORA').slice(0, 3);
    const top = el(doc, 'div', 'rd-top3'); top.id = 'rd-agora';
    agora.forEach((r, i) => { const card = el(doc, 'article', 'rd-pick'); const tl = el(doc, 'div', 'rd-pick-top'); tl.append(el(doc, 'span', 'rd-pick-n', String(i + 1)), chipPos(doc, r.posicao, lang)); if (r.alvo) tl.append(el(doc, 'span', 'rd-arrow', '→'), chipPos(doc, r.alvo, lang)); tl.append(el(doc, 'span', 'rd-dif', w.effortWord + ' ' + (w.effort[r.dificuldade] || r.dificuldade))); card.append(tl, el(doc, 'h4', 'rd-pick-title', r.curto || r.feature), el(doc, 'p', 'rd-pick-text', r.pratica), el(doc, 'p', 'rd-pick-meta', r.custo.horas + ' · ' + r.porque)); top.append(card); });
    sec.append(top);
    const table = el(doc, 'div', 'rd-table'); table.setAttribute('role', 'list');
    const th = el(doc, 'div', 'rd-row rd-row-head'); th.setAttribute('aria-hidden', 'true'); for (const [cls, t] of [['rd-c-feature', w.feature], ['rd-c-us', w.us], ['rd-c-best', w.best], ['rd-c-dif', w.diff], ['rd-c-rec', w.rec]]) th.append(el(doc, 'span', cls, t)); table.append(th);
    for (const rec of REC) {
      const grupo = linhas.filter(r => r.recomendacao === rec); if (!grupo.length) continue;
      table.append(el(doc, 'p', 'rd-group rd-group-' + rec.toLowerCase(), recLabel(rec, w) + ' · ' + grupo.length));
      for (const r of grupo) {
        const item = el(doc, 'div', 'rd-item'); item.setAttribute('role', 'listitem'); const id = 'rd-d-' + r.id, btn = el(doc, 'button', 'rd-row'); btn.type = 'button'; btn.dataset.id = r.id;
        const isOpen = open.has(r.id); btn.setAttribute('aria-expanded', String(isOpen)); btn.setAttribute('aria-controls', id);
        const f = el(doc, 'span', 'rd-c-feature'); f.append(el(doc, 'span', 'rd-feature-name', r.feature), el(doc, 'span', 'rd-area', r.area)); const us = el(doc, 'span', 'rd-c-us'); us.append(chipPos(doc, r.posicao, lang)); if (r.divergencia) { const sp = el(doc, 'span', 'rd-split', '±'); sp.title = w.split; sp.setAttribute('aria-label', w.split); us.append(sp); }
        const rc = el(doc, 'span', 'rd-c-rec'); rc.append(chipRec(doc, r.recomendacao, lang));
        const dif = el(doc, 'span', 'rd-c-dif'); dif.append(el(doc, 'span', 'rd-dif-label', w.diff + ' '), el(doc, 'b', 'rd-dif-v', r.dificuldade));
        btn.append(f, us, el(doc, 'span', 'rd-c-best', r.concorrente), dif, rc);
        const det = detalhe(doc, r, lang, id); det.hidden = !isOpen;
        btn.addEventListener('click', () => { const now = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(now)); det.hidden = !now; if (now) open.add(r.id); else open.delete(r.id); });
        item.append(btn, det); table.append(item);
      }
    }
    sec.append(table);
    const esc = p.escalaCusto || {}; sec.append(el(doc, 'p', 'rd-note rd-scale', w.scale + ': ' + ['P', 'M', 'G'].map(k => k + ' = ' + (esc[k] || '?')).join(' · ')));
    return sec;
  }
  function render(doc, host, payload, opts = {}) {
    const lang = opts.lang || 'pt', w = words(lang), open = opts.open || new Set(), wrap = el(doc, 'div', 'rd');
    const top = el(doc, 'div', 'rd-top'), agente = el(doc, 'img', 'rd-agente'); agente.setAttribute('src', '/agente.png'); agente.setAttribute('alt', ''); agente.setAttribute('width', '56'); agente.setAttribute('height', '56');
    const tt = el(doc, 'div', 'rd-top-text'); tt.append(el(doc, 'h2', 'rd-title', w.title), el(doc, 'p', 'rd-sub', w.sub));
    const side = el(doc, 'div', 'rd-top-side'), status = el(doc, 'span', 'rd-read'); status.setAttribute('role', 'status'); const again = el(doc, 'button', 'rd-refresh', w.refresh); again.type = 'button'; if (opts.onRefresh) again.addEventListener('click', () => opts.onRefresh());
    side.append(status, again); top.append(agente, tt, side); wrap.append(top);
    if (!payload) { status.textContent = w.loading; wrap.append(el(doc, 'p', 'rd-loading', w.loading)); host.replaceChildren(wrap); return wrap; }
    if (payload.example) { status.textContent = 'EXAMPLE'; wrap.append(el(doc, 'p', 'rd-note', w.exampleOff)); host.replaceChildren(wrap); return wrap; }
    if (!payload.ok || !payload.data) { status.textContent = '?'; wrap.append(interrogacao(doc, w.fail, w.failFix.replace(/^[^:]+: /, ''), lang)); host.replaceChildren(wrap); return wrap; }
    // montado agora pelo painel (a cada minuto com a aba aberta) tambem esta em dia sozinho: so o arquivo velho do agendamento pede aviso
    const d = payload.data, arq = d.arquivo?.estado, sozinho = (arq === 'em dia' && d.geradoPor === 'agendamento') || d.geradoPor === 'painel';
    status.textContent = w.made + ' ' + quando(d.geradoEm, d.geradoEm) + ' · ' + (sozinho ? w.fresh : arq === 'em dia' ? w.manual : arq === 'velho' ? w.old : w.missing);
    status.dataset.estado = sozinho ? 'ok' : 'aviso';
    wrap.append(heroes(doc, d, lang));
    if (!sozinho) { const aviso = interrogacao(doc, w.noSchedule, w.noScheduleFix, lang); aviso.classList.add('rd-schedule'); wrap.append(aviso); }
    wrap.append(uso(doc, d, lang), placar(doc, d, lang, open));
    const foot = el(doc, 'p', 'rd-foot', w.curated + ' ' + quando(d.placar?.curadoEm, d.geradoEm) + ' ' + w.by + ' ' + (d.placar?.curadoPor || 'COORDENADOR') + '. ' + w.sources); wrap.append(foot);
    for (const b of wrap.querySelectorAll('.rd-hero')) b.addEventListener('click', () => { const alvo = doc.getElementById(b.dataset.alvo); if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ behavior: root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
    host.replaceChildren(wrap); return wrap;
  }
  const api = { render, quando, idade, words };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.PainelRadar = api;
  const doc = root.document, host = doc.getElementById('radar-host'); if (!host) return;
  let data = null, loading = false, timer = null; const open = new Set();
  const lang = () => doc.getElementById('language')?.value || doc.documentElement.lang || 'pt';
  const active = () => doc.documentElement.dataset.painelTab === 'radar' && !doc.hidden;
  const paint = () => render(doc, host, data, { lang: lang(), open, onRefresh: load });
  async function load() {
    if (loading) return; loading = true;
    try { const r = await root.fetch('/api/radar' + (/[?&]exemplo=1/.test(root.location.search) ? '?exemplo=1' : ''), { cache: 'no-store', headers: { Accept: 'application/json' } }); data = await r.json(); }
    catch { data = { ok: false, sourceState: 'unavailable' }; }
    loading = false; paint();
  }
  function sync() { if (timer) { root.clearInterval(timer); timer = null; } if (active()) timer = root.setInterval(load, 60000); }
  paint();
  doc.addEventListener('painel:tab-change', e => { if (e.detail?.tab === 'radar') load(); sync(); });
  doc.addEventListener('visibilitychange', () => { sync(); if (active()) load(); });
  doc.getElementById('language')?.addEventListener('change', () => { if (data) paint(); });
  root.addEventListener('pagehide', () => { if (timer) root.clearInterval(timer); }, { once: true });
  if (doc.documentElement.dataset.painelTab === 'radar') { load(); sync(); }
})(typeof window === 'object' ? window : globalThis);
