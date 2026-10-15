'use strict';
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PainelObraModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const OLD_MS = 2 * 60 * 60 * 1000;
  const STATES = Object.freeze({ notStarted: 'NAO COMECOU', building: 'EM OBRA', ready: 'PRONTO ESPERANDO', live: 'NO AR', unknown: '?' });
  const MAPPING = Object.freeze([
    { state: 'notStarted', words: 'nao comecou; nao iniciado; nova; aberta; falta desenho; sem desenho; nao existe; falta uma pagina; aprovada (permissao para iniciar)', note: 'Permissao e plano futuro nao sao entrega.' },
    { state: 'building', words: 'execucao; em andamento; em obra; construindo; aplicando; desenvolvimento; planejamento; mockup; nav-mock; roteiro em preparo', note: 'Mockup pronto ou card de escolha pronto nao conclui o produto.' },
    { state: 'ready', words: 'card de up; aguardando revisao/gate/card/up; em revisao; gate verde; pronto; concluida; feito; fechada', note: 'Artefato pronto ainda nao prova que esta no ar.' },
    { state: 'live', words: 'NO AR; JA ESTA NO AR; publicado; em producao; deploy concluido', note: 'Exige afirmacao da etapa inteira. Previa, negacao, promessa e entrega parcial nao contam.' },
    { state: 'unknown', words: 'sem correspondencia; parado sem etapa; no ar parcial + parte futura; pronto parcial + falta; fontes contraditorias', note: 'Exibe motivo. Nenhuma etapa ou percentual e inferido do titulo, dono ou corpo da task.' }
  ]);
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function text(value, max = 1200) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001f]/g, ' ').replace(/[\u2013\u2014]/g, ', ')
      .replace(/https?:\/\/\S+|0x[a-f\d]{40,}|\b[A-Za-z\d]{40,}\b|\bsk-[\w-]+|\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, '[privado]')
      .replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function classify(stage) {
    const s = fold(stage).replace(/[*_`]/g, '').trim();
    const result = (state, reason) => ({ state, stateLabel: STATES[state], reason });
    if (!s) return result('unknown', 'etapa nao informada');
    const live = /\b(?:no ar|publicado|em producao|deploy concluido)\b/.test(s);
    const negatedLive = /\b(?:nao|nunca|ainda nao)\s+(?:esta\s+|foi\s+|ficou\s+|vai\s+)?(?:no ar|publicado|em producao)|\b(?:quando|se|vai|sera|ficara|estara|previsto|planejado|queremos|pretendemos|para (?:ficar|estar|por)|pronto para)\b[^.;]{0,100}\b(?:no ar|publicado|em producao)/.test(s);
    const preview = /\b(?:previa|preview|devnet|teste local)\b/.test(s);
    const partial = /\b(?:sobram?|ainda ha|ainda tem|nao ha versao|parcial|parte|vao no up|vai no up|falta|faltam|restante|por fazer|a definir|nao existe|nao exist[eia]+m|desenho aprovado|ainda nao|aprovad[ao])\b|\?/.test(s);
    const pendingLive = /\b(?:aguardando|pendente|card de up)\b/.test(s);
    if (live && !negatedLive && (preview || partial || pendingLive)) return result('unknown', preview ? 'no ar apenas na previa ou teste; entrega total nao confirmada' : 'a etapa mistura parte no ar com trabalho pendente; item inteiro nao confirmado');
    const ready = /\bcard de up\b|\b(?:aguardando|aguarda|esperando|espera|pendente de|pronto para)\s+(?:a\s+|o\s+)?(?:revisao|gate|card|up|subir|publicacao)|\b(?:em revisao|revisao|gate (?:cheio )?(?:verde|passou)|pront[oa]s?|concluid[ao]s?|feit[oa]s?|fechad[ao]s?)\b/.test(s);
    const building = /\b(?:execucao|em andamento|em obra|andando|construindo|aplicando|desenvolvimento|planejamento|mockups?|nav-mock|roteiro em preparo)\b/.test(s);
    const notStarted = /\b(?:nao comecou|nao iniciad[oa]|falta desenho|sem desenho|nao existe|falta (?:1|uma) pagina|nov[ao]|abert[ao]|aprovad[ao])\b/.test(s);
    if (ready && partial && !live && !building && !/^card de up\b/.test(s)) return result('unknown', 'artefato pronto parcial; a etapa tambem informa parte faltante ou indefinida');
    if (live && !negatedLive && !preview) return result('live', 'etapa afirma entrega no ar; leitura textual, sem verificacao externa');
    if (building && !/^card de up\b/.test(s)) return result('building', 'etapa informa trabalho de desenho ou execucao');
    if (ready) return result('ready', 'etapa informa artefato pronto ou espera de revisao, gate, card ou up');
    if (notStarted) return result('notStarted', 'etapa informa inicio pendente, desenho ausente ou somente aprovacao');
    if (negatedLive) return result('unknown', 'afirmacao negada ou futura de no ar; etapa atual nao informada');
    return result('unknown', 'texto da etapa nao corresponde a uma regra de estado');
  }
  function splitRow(line) {
    const cells = []; let cell = '', escaped = false;
    for (const ch of line.trim().replace(/^\|/, '').replace(/\|\s*$/, '')) {
      if (ch === '|' && !escaped) { cells.push(cell.trim()); cell = ''; }
      else cell += ch;
      escaped = ch === '\\' && !escaped;
    }
    cells.push(cell.trim());
    return cells.map(value => value.replace(/\\\|/g, '|'));
  }
  function parseLaunch(raw, source = {}) {
    const items = [], warnings = []; let header = null, heading = '';
    for (const [offset, line] of String(raw || '').replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
      if (/^#{1,6}\s/.test(line)) { heading = text(line.replace(/^#+\s*/, ''), 200); header = null; }
      if (!/^\s*\|/.test(line)) { if (line.trim()) header = null; continue; }
      const cells = splitRow(line), names = cells.map(fold);
      if (names.includes('etapa hoje')) { header = { stage: names.indexOf('etapa hoje'), title: names.indexOf('item'), owner: names.indexOf('dono'), blocker: names.indexOf('o que falta'), project: names.indexOf('projeto') }; continue; }
      if (!header || cells.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
      const lineNumber = offset + 1, stage = text(cells[header.stage] || '');
      const malformed = cells.length <= header.stage || header.title < 0 || !cells[header.title];
      const status = malformed ? { state: 'unknown', stateLabel: '?', reason: 'linha de tabela incompleta; titulo ou etapa ausente' } : classify(stage);
      const item = { id: 'lancamento:' + lineNumber, title: text(cells[header.title] || 'Item sem titulo', 350), stage,
        owner: text(cells[header.owner] || '', 220), blocker: text(cells[header.blocker] || '', 550), section: heading,
        projectName: header.project >= 0 ? text(cells[header.project], 160) : null,
        ...status, source: { ...source, line: lineNumber } };
      items.push(item);
      if (malformed) warnings.push('LANCAMENTO.md:' + lineNumber + ' linha incompleta preservada como ?');
    }
    return { items, warnings };
  }
  function parseTaskHeader(raw) {
    const lines = String(raw || '').replace(/^\uFEFF/, '').split(/\r?\n/).slice(0, 32), fields = {};
    const yaml = lines[0]?.trim() === '---'; let title = '';
    for (let index = yaml ? 1 : 0; index < lines.length; index++) {
      const line = lines[index].trim();
      if (yaml && line === '---') break;
      if (/^#{2,6}\s/.test(line)) break;
      if (/^#\s/.test(line)) { if (title || Object.keys(fields).length) break; title = text(line.replace(/^#\s*/, ''), 350); continue; }
      const match = /^(?:[-*]\s*)?(?:\*\*)?(id|titulo|nome|dono|status|estado|projeto)\s*(?:\*\*)?:\s*(?:\*\*)?(.+?)\s*$/i.exec(line);
      if (match && !Object.hasOwn(fields, match[1].toLowerCase())) fields[match[1].toLowerCase()] = text(match[2].replace(/^['"]|['"]$/g, ''), match[1].toLowerCase() === 'dono' ? 250 : 700);
      else if (!yaml && line && !/^---$/.test(line)) break;
    }
    return { id: fields.id || null, title: fields.titulo || fields.nome || title || null, owner: fields.dono || null,
      stage: fields.status || fields.estado || null, stageField: fields.status ? 'status' : fields.estado ? 'estado' : null };
  }
  function sourceProof(raw, now = Date.now()) {
    const clock = now instanceof Date ? now.getTime() : Number(now), read = Date.parse(raw?.readAt), mtime = Date.parse(raw?.mtime);
    const age = Number.isFinite(read) && read <= clock ? clock - read : null;
    return { file: text(raw?.file || '', 300), readAt: Number.isFinite(read) ? new Date(read).toISOString() : null,
      mtime: Number.isFinite(mtime) ? new Date(mtime).toISOString() : null, old: age === null || age > OLD_MS,
      ageSeconds: age === null ? null : Math.floor(age / 1000), timeState: !Number.isFinite(read) ? 'unknown' : read > clock ? 'future' : age > OLD_MS ? 'old' : 'current' };
  }
  function aliasesFor(name) {
    const exact = fold(name).trim(), aliases = [exact];
    // Only a project name's explicitly written short name is added, never its folder or work title.
    if (/^projeto d[oa] /.test(exact)) aliases.push(exact.replace(/^projeto d[oa] /, ''));
    if (exact.includes(' (')) aliases.push(exact.split(' (')[0]);
    return [...new Set(aliases)];
  }
  function ownerMatches(owner, projectName) {
    if (!owner || !projectName) return false;
    const value = fold(owner).trim();
    return aliasesFor(projectName).some(alias => {
      const literal = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(?:^|[+;|/]\\s*)' + literal + '(?=$|\\s+\\(|\\s*[+;|/])').test(value);
    });
  }
  function summarize(items) {
    const counts = { total: items.length, noAr: 0, emObra: 0, prontoEsperando: 0, naoComecou: 0, unknown: 0 };
    const names = { live: 'noAr', building: 'emObra', ready: 'prontoEsperando', notStarted: 'naoComecou', unknown: 'unknown' };
    for (const item of items) counts[names[item.state] || 'unknown']++;
    const total = counts.total, percent = total ? counts.noAr * 100 / total : null;
    return { counts, percent, percentRange: total ? { min: percent, max: (counts.noAr + counts.unknown) * 100 / total } : null,
      remaining: total ? total - counts.noAr : null, readyCount: total ? counts.prontoEsperando : null };
  }
  function compose({ registry, launch, tasks = [], warnings = [], readAt }, now = Date.now()) {
    const rawProjects = Array.isArray(registry?.raw?.projetos) ? registry.raw.projetos : [], parsed = parseLaunch(launch?.raw || '', sourceProof(launch?.source, now));
    const usedNames = new Set(), projects = [];
    for (const [index, row] of rawProjects.entries()) {
      const name = text(row?.nome, 160), key = fold(name);
      if (!name || usedNames.has(key)) { warnings.push('registro de projeto sem nome ou duplicado'); continue; }
      usedNames.add(key);
      let items = parsed.items.filter(item => item.projectName && fold(item.projectName) === key);
      let scope = 'itens do lancamento', method = 'coluna Projeto em LANCAMENTO.md';
      if (!items.length && key === 'painel') { items = parsed.items.filter(item => !item.projectName); scope = 'lista do lançamento'; method = 'LANCAMENTO.md sem projeto declarado; lista parcial de ' + items.length + ' itens, nao todo o roadmap'; }
      if (!items.length) {
        items = tasks.filter(work => ownerMatches(work.owner, name)).map(work => ({ id: 'task:' + work.file, title: text(work.title || work.id || 'work sem titulo', 350), stage: text(work.stage), owner: text(work.owner, 250), blocker: '', section: '',
          ...classify(work.stage), source: sourceProof(work.source, now) }));
        scope = 'tasks com dono do projeto'; method = 'cabecalho dono corresponde ao nome ou abreviacao literal do nome; status (ou estado como alias)';
      }
      const hasSource = items.length > 0, summary = summarize(items), sourceFiles = [...new Set(items.map(item => item.source.file).filter(Boolean))];
      if (!hasSource) summary.counts = { total: null, noAr: null, emObra: null, prontoEsperando: null, naoComecou: null, unknown: null };
      const sources = sourceFiles.map(file => items.find(item => item.source.file === file).source);
      const source = sources.length === 1 ? sources[0] : sourceProof({ file: sourceFiles.join('; ') || 'estado/LANCAMENTO.md; tasks/*.md', readAt: readAt || null }, now);
      const partial = !hasSource || scope === 'lista do lançamento' || summary.counts.unknown > 0;
      // chega trocado pelo send(). Os dois viram "Projeto reservado", um nome so; a chave de casar segue a original
      const citaPessoa = typeof module === 'object' && typeof require === 'function' ? (() => { try { return require('./sigilo-pessoas.cjs').temPessoa(name); } catch { return false; } })() : false;
      projects.push({ id: 'obra-projeto-' + index, name: citaPessoa || /\b(?:um parceiro|uma conta|um perfil|um e-mail|uma comunidade parceira)\b|\boculto-[a-f0-9]{8}\b/i.test(name) || /(^|[^\w.@])@\w{2,}/.test(name) ? 'Projeto reservado' : name, color: /^#[a-f\d]{6}$/i.test(row?.cor || '') ? row.cor : '#a78bfa', items,
        ...summary, hasSource, partial, scope, method, source, sources, old: source.old || sources.some(proof => proof.old),
        reason: !hasSource ? 'falta lista de itens' : scope === 'lista do lançamento' ? 'Progresso somente da lista do lançamento; o roadmap total nao foi listado nesta fonte.' : summary.counts.unknown ? 'Ha etapas ?; o percentual e a parcela explicitamente NO AR.' : '',
        resolution: !hasSource ? 'Criar uma lista de itens com Etapa hoje para este projeto ou preencher dono com o nome do projeto nas tasks.' : scope === 'lista do lançamento' ? 'Listar o roadmap total antes de chamar esta conta de progresso total do projeto.' : '',
        blockers: items.filter(item => item.state !== 'live' && item.blocker).map(item => ({ itemId: item.id, title: item.title, text: item.blocker, state: item.state })) });
    }
    if (!rawProjects.length) warnings.push('projetos.json ausente, invalido ou sem projetos; nenhum projeto inventado');
    return { readAt: readAt || null, projects, warnings: [...new Set([...warnings, ...parsed.warnings])], mapping: MAPPING,
      provenance: 'Contagem textual da fonte local; NO AR nao e verificacao independente de producao.', scope: 'Lista do lançamento e tasks por dono explicito' };
  }
  return { OLD_MS, STATES, MAPPING, fold, text, classify, splitRow, parseLaunch, parseTaskHeader, sourceProof, aliasesFor, ownerMatches, summarize, compose };
});
