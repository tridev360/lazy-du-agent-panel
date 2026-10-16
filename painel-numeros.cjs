'use strict';
// Cada numero que aparece em mais de uma vista sai de UMA conta, com o nome do que conta, a hora da leitura e o texto mastigado
// (mastigar.cjs: titulo de gente, "8 de outubro, 22:55", nada de ISO/null/segundos/ids/caminhos fora do campo "fonte").
//   GET /api/painel-numeros                  -> { espera, credito, fila, lancamentos, cronograma, decididas }
//   GET /api/painel-numeros/<parte>           -> so a parte (espera | credito | fila | lancamentos | cronograma | decididas)
//   ?exemplo=1                                -> vazio (o modo das capturas nunca leva dado real); POST/PUT = 405
// Partes:
//   espera      "Espera você" = cards sem resposta (estado/cards) + passos seus do estado-agora que nao apontam para um desses cards.
//               Os pedidos do tasks/ESCOLHAS.md ficam FORA da conta, listados a parte como "lembretes" (lista escrita a mao, sem data
//               confiavel; varios ja passaram). Parte sem leitura = total null com o motivo (nunca 0 inventado).
//   credito     sempre "% usado" da semana, com a hora da leitura. Codex e a conta do Claude em uso: leitura com mais de 2 h = "?"
//               e o ultimo numero vai junto com a hora. Contas paradas do Claude: o numero com "lido há N dias" (ninguem usa,
//               o numero so muda no reset; reset que ja passou = "?").
//   fila        da MESMA leitura que a aba Fila usa (snapshot do leitor): tarefas lidas x arquivos na pasta (e por que ficam fora),
//               etapas com contagem, concluidos da semana e do historico com o nome do recorte, ramos prontos x etapa Pronta,
//               e "Trabalhando" sem sinal ha 72 h ou mais vira "parado" com a idade.
//   lancamentos estado/LANCAMENTO.md (a lista viva; o Agora ja le). O estado/lancamentos.json antigo vai marcado como velho, com o motivo.
//   cronograma  hora real da fonte = a mais nova entre "atualizado" e os itens que o estado-auto acrescenta; Hoje = so o de hoje.
//   decididas   cards respondidos hoje (sem o corte de 5 da lista) + o que falta hoje; selos de ideia hoje, com nome proprio.
const fs = require('node:fs');
const path = require('node:path');
const M = require('./mastigar.cjs');
const F = require('./frescor.cjs');
const H = 3600000, PARADO_MS = 72 * H, CACHE_MS = 30000, CREDITO_MAX_MS = F.LIMITES.creditoDaVezMs, CREDITO_PARADA_MS = F.LIMITES.creditoParadaMs;
const PARTES = ['espera', 'credito', 'fila', 'lancamentos', 'cronograma', 'decididas'];
const dia = ms => new Date(ms - 3 * H).toISOString().slice(0, 10);
function lerTexto(root, rel, max = 512000) { try { return require('./leitor.cjs').readSafe(root, rel, max) || null; } catch { return null; } }
function mtime(root, rel) { try { const st = fs.lstatSync(path.join(root, rel)); return st.isFile() && !st.isSymbolicLink() ? st.mtimeMs : null; } catch { return null; } }
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

// ---------- 1. Espera você ----------
function esperaVoce(root, now = Date.now()) {
  const N = require('./cards300-nucleo.cjs'), A = require('./agora-nucleo.cjs');
  const cardsDir = path.join(root, 'estado', 'cards');
  let lista = null, idsCru = new Map(), motivoCards = null;
  try { lista = N.montarLista({ cardsDir, dadosDir: path.join(__dirname, 'agora300-dados'), agora: new Date(now) }); for (const l of N.lerPasta(cardsDir).lidos) idsCru.set(l.arquivo, typeof l.cru.id === 'string' ? l.cru.id : ''); } catch { motivoCards = 'a pasta de cards não abriu nesta leitura'; }
  const agora = A.read(root, now), passosOk = agora.ok && !(agora.unavailable || []).includes('voce');
  const cards = (lista ? lista.pendentes : []).map(c => {
    const t = c.restrito ? null : M.titulo(c.pergunta, 120), desde = Number.isFinite(c.ordem) ? c.ordem : null;
    return { tipo: 'card', chave: 'card:' + c.arquivo, titulo: t, motivo: c.restrito ? 'assunto reservado: só no chat da sessão' : t ? null : 'texto do card não pôde ser mostrado', quem: M.nomeSessao(c.sessao) || 'Sessão sem nome', onde: M.frase(c.ondeResponder, 60), perigoso: !!c.perigoso, ...M.quando(desde, now), fonte: { arquivo: 'estado/cards/' + c.arquivo } };
  });
  const contados = new Set((lista ? lista.pendentes : []).flatMap(c => [c.arquivo.replace(/\.json$/, ''), idsCru.get(c.arquivo)]).filter(Boolean).map(s => s.toLowerCase()));
  // Fonte 1: o "pronto para ele" do atendimento.md (hora da linha; vale 24 h ou ate o proximo SUBIU).
  // Fonte 2: passo do estado-agora COM hora propria (campo em ou quando) de menos de 24 h e que nao seja "quando chegar".
  // Passo a mao sem data e o "quando chegar" vao para semData, fora da conta (como os lembretes do ESCOLHAS).
  let atendimento = null; try { atendimento = require('./atendimento-md.cjs').lerCacheado(root, now); } catch { atendimento = null; }
  const siteOk = !!(atendimento && atendimento.ok);
  const passosSite = siteOk ? atendimento.prontos.map(p => ({ tipo: 'passo', chave: 'pronto:atendimento:' + p.fonte.linha, titulo: p.titulo ? p.titulo + ': o clique de subir é seu' : null, motivo: p.titulo ? null : 'texto do passo não pôde ser mostrado', onde: p.onde, em: p.em, dataTexto: p.dataTexto, idadeTexto: p.idadeTexto, fonte: { ...p.fonte } })) : [];
  const COND = /\bquando (?:chegar|vier|ficar|sair)\b|\bse chegar\b|\bdepois que\b/i, semData = [], passosAgora = [];
  if (passosOk) agora.voce.forEach((v, i) => {
    if (v.card && contados.has(String(v.card).replace(/\.json$/, '').toLowerCase())) return;
    const t = M.titulo(v.passo, 120), proprio = M.ms(v.em || v.quando), fonte = { arquivo: 'estado/estado-agora.json', campo: 'voce', item: i };
    const maoV = agora.mao && agora.mao.voce, semHoraPropria = !Number.isFinite(proprio);
    const at = !semHoraPropria ? proprio : maoV && maoV.em && !maoV.velho ? Date.parse(maoV.em) : NaN;
    const base = { chave: 'passo:' + i, titulo: t, motivo: t ? null : 'texto do passo não pôde ser mostrado', onde: M.frase(v.onde, 60), fonte };
    if (COND.test(String(v.passo || ''))) { semData.push({ tipo: 'lembrete', ...base, nota: 'espera chegar' }); return; }
    if (!Number.isFinite(at) || at > now + 120000 || now - at > 24 * H) { semData.push({ tipo: 'lembrete', ...base, nota: Number.isFinite(at) ? 'passou de 24 h' : maoV && !maoV.vazio ? F.fraseMaoVelha(maoV) : 'sem data' }); return; }
    passosAgora.push({ tipo: 'passo', ...base, ...M.quando(at, now), ...(semHoraPropria ? { dataTexto: 'texto confirmado ' + M.horaTexto(at, now) } : {}), horaDoTexto: semHoraPropria, fonte: { ...fonte, contaAte: new Date(at + 24 * H).toISOString() } });
  });
  if (siteOk) for (const v of atendimento.vencidos || []) if (/^passou de 24 h|^sem dia/.test(v.porque)) semData.push({ tipo: 'lembrete', chave: 'pronto:atendimento:' + v.fonte.linha, titulo: v.titulo ? v.titulo + ': o clique de subir é seu' : null, motivo: v.titulo ? null : 'texto do passo não pôde ser mostrado', onde: v.onde, fonte: v.fonte, nota: (/^sem dia/.test(v.porque) ? 'o atendimento.md não diz o dia' : 'passou de 24 h') + ': confira no chat da Atendimento' });
  const passos = [...passosSite, ...passosAgora];
  // lembretes do ESCOLHAS (fora da conta)
  const texto = lerTexto(root, 'tasks/ESCOLHAS.md'), hoje = dia(now), ano = hoje.slice(0, 4);
  const lembretes = texto === null ? null : require('./decisoes.cjs').needsOf(texto).all.map(item => {
    const datas = [...String(item.detail).matchAll(/\b(\d{2})\/(\d{2})\b/g)].map(m => ano + '-' + m[2] + '-' + m[1]).filter(d => Number.isFinite(Date.parse(d)));
    const velho = datas.length > 0 && datas.every(d => d < hoje) || /\batrasad[oa]\b/i.test(item.detail);
    const t = M.titulo(require('./sigilo-pessoas.cjs').mascarar(String(item.title || '')), 120);
    return { tipo: 'lembrete', chave: item.id, titulo: t, motivo: t ? null : 'assunto reservado: só no chat da sessão', velho, nota: velho ? 'a data escrita já passou' : 'sem data', fonte: { arquivo: 'tasks/ESCOLHAS.md', item: item.id } };
  });
  const partes = { cards: lista ? cards.length : null, passos: passosOk || siteOk ? passos.length : null };
  const completo = partes.cards !== null && partes.passos !== null && passosOk && siteOk;
  const total = partes.cards !== null && partes.passos !== null ? partes.cards + partes.passos : null;
  const itens = [...cards, ...passos];
  const desdes = cards.map(c => c.em).filter(Boolean).sort();
  const motivo = !completo ? [motivoCards, passosOk ? null : 'os passos do estado-agora estão sem leitura', siteOk ? null : 'o atendimento.md está sem leitura (o "pronto para ele" pode faltar)'].filter(Boolean).join('; ') : null;
  const velhos = lembretes ? lembretes.filter(l => l.velho).length : null;
  return {
    ok: true, versao: 'espera-1', lidoEm: new Date(now).toISOString(), ...M.quando(now, now), total, partes, completo, motivo,
    rotulo: total === null ? '? esperam você' : total === 0 ? 'nada espera você' : plural(total, 'espera você', 'esperam você') + ': ' + [partes.cards ? plural(partes.cards, 'card', 'cards') : null, partes.passos ? plural(partes.passos, 'passo', 'passos') : null].filter(Boolean).join(' e '),
    regra: 'Cards sem resposta e abertos (substituído, anulado ou encerrado não contam) + o "pronto para ele" do atendimento.md (na conta até subir; com mais de 24 h ou sem dia vai para Fora da conta) + passos do Agora com hora de menos de 24 h. Passo à mão sem data, "quando chegar" e lembretes do ESCOLHAS ficam fora da conta.',
    maisAntigo: desdes.length ? M.quando(desdes[0], now) : null,
    itens,
    semData: { n: semData.length, rotulo: semData.length ? 'Fora da conta (' + semData.length + ')' : null, itens: semData },
    lembretes: lembretes === null ? { n: null, motivo: 'ESCOLHAS sem leitura', itens: [] } : { n: lembretes.length, velhos, rotulo: lembretes.length ? plural(lembretes.length, 'lembrete', 'lembretes') + ' no ESCOLHAS, fora da conta' + (velhos ? ' (' + velhos + ' com data que já passou)' : '') : 'nenhum lembrete no ESCOLHAS', itens: lembretes },
    fonte: { cards: 'estado/cards', passos: 'estado/atendimento.md (pronto para ele) e estado/estado-agora.json (voce, só com hora)', lembretes: 'tasks/ESCOLHAS.md' }
  };
}

// ---------- 2. Crédito (% usado, com a hora da leitura) ----------
function linhaCredito(quem, { pct, lidoEm, zeraEm, maxMs, daVez, solucao }, now) {
  const at = M.ms(lidoEm), idade = M.idadeDe(at, now), reset = M.ms(zeraEm);
  const zerou = Number.isFinite(reset) && reset <= now;
  let motivo = null;
  if (!Number.isFinite(at)) motivo = 'sem leitura';
  else if (at > now + 120000) motivo = 'leitura com hora no futuro';
  else if (typeof pct !== 'number') motivo = 'leitura sem número';
  else if (zerou) motivo = 'a semana zerou depois da leitura';
  else if (maxMs && now - at > maxMs) motivo = 'leitura com mais de ' + Math.round(maxMs / H) + ' h';
  const lidoHa = Number.isFinite(at) && at <= now + 120000 ? 'lido ' + (M.idadeTexto(idade) === 'agora' ? 'agora' : M.idadeTexto(idade)) : null;
  const vale = motivo === null;
  const lido = M.lidoTexto(at, now);
  return {
    quem, daVez: !!daVez, usadoPct: vale ? pct : null, texto: vale ? pct + '% usado' : '?', velho: !vale, motivo,
    lidoEm: Number.isFinite(at) ? new Date(at).toISOString() : null, lidoTexto: lido, idadeTexto: M.idadeTexto(idade), lidoHa, limiteH: maxMs ? Math.round(maxMs / H) : null, solucao: vale ? null : solucao || null,
    ultimoPct: !vale && typeof pct === 'number' && !zerou ? pct : null,
    ultimoTexto: !vale && typeof pct === 'number' && !zerou && Number.isFinite(at) ? pct + '% usado na leitura de ' + M.dataTexto(at) : null,
    zeraEm: Number.isFinite(reset) ? new Date(reset).toISOString() : null, zeraTexto: Number.isFinite(reset) && !zerou ? (dia(reset) === dia(now) ? 'zera hoje ' + M.horaTexto(reset, now) : 'zera ' + M.dataTexto(reset)) : null,
    zeraCurto: Number.isFinite(reset) && !zerou ? (dia(reset) === dia(now) ? 'zera hoje ' : 'zera ' + dia(reset).slice(8) + '/' + dia(reset).slice(5, 7) + ' ') + new Date(reset - 3 * H).toISOString().slice(11, 16) : null,
    zeraHoje: Number.isFinite(reset) && !zerou && dia(reset) === dia(now)
  };
}
function credito(root, now = Date.now()) {
  const CF = require('./credito-fresco.cjs');
  let vps = null; try { vps = require('./codex-sessoes.cjs').creditoVps(); } catch { vps = null; }
  const cx = CF.maisNova(CF.lerCodex(root), vps) || {};
  const semana = (Array.isArray(cx.windows) ? cx.windows : []).find(w => w && w.minutes >= 10000 && typeof w.used === 'number');
  const codex = { ...linhaCredito('Codex', { pct: semana ? semana.used : null, lidoEm: cx.updated, zeraEm: semana ? semana.reset : null, maxMs: CREDITO_MAX_MS, daVez: true, solucao: 'o leitor de uso do Codex grava a cada poucos minutos; se seguir parado, a sua sessão principal confere a leitura' }, now), fonte: { arquivo: cx.source && /VPS/i.test(cx.source) ? 'VPS (rate_limits do codex exec)' : 'estado/uso-codex.json' } };
  const C = require('./contas-nucleo.cjs'), bruto = C.ler(root, 'credito-claude.jsonl');
  const contas = C.montar(bruto?.texto, new Date(now)).contas;
  const claude = contas ? contas.map(c => ({ ...linhaCredito('Claude conta ' + c.conta, { pct: c.semana, lidoEm: c.lidoEm, zeraEm: c.zeraSemana, maxMs: c.atual ? CREDITO_MAX_MS : CREDITO_PARADA_MS, daVez: c.atual, solucao: c.atual ? F.SOLUCAO.creditoDaVez : F.SOLUCAO.creditoParada }, now), conta: c.conta, fonte: { arquivo: 'estado/credito-claude.jsonl' } })) : [];
  const daVez = claude.find(c => c.daVez) || null;
  return {
    ok: true, versao: 'credito-1', lidoEm: new Date(now).toISOString(), ...M.quando(now, now),
    regra: 'Todo crédito do painel é % usado da semana, com a hora da leitura ("lido há N h" nas suas contas). Codex e a conta atual: leitura com mais de 2 h fica "?" e o último número vai junto com a hora. Conta parada: mais de 26 h sem leitura também fica "?" (o número vale até o reset da semana).',
    codex, claude: { daVez: daVez ? daVez.conta : null, contas: claude, motivo: contas ? null : 'estado/credito-claude.jsonl sem leitura' },
    resumo: [daVez ? 'Claude ' + daVez.conta + ': ' + (daVez.usadoPct !== null ? daVez.texto : '? (' + (daVez.ultimoTexto || daVez.motivo) + ')') + (daVez.lidoTexto ? ', ' + daVez.lidoTexto : '') : 'Claude: ?', 'Codex: ' + (codex.usadoPct !== null ? codex.texto : '? (' + (codex.ultimoTexto || codex.motivo) + ')') + (codex.lidoTexto ? ', ' + codex.lidoTexto : '')].join(' · ')
  };
}

// ---------- 3. Fila ----------
const ETAPAS = [['nova', 'Nova'], ['aberta', 'Nova'], ['andando', 'Fazendo'], ['commit', 'Pronta'], ['revisada', 'Em revisão'], ['liberado', 'Liberada'], ['feito', 'No ar'], ['adiada', 'Parado']];
const ETAPA = Object.fromEntries(ETAPAS);
function contarTasks(root) { try { return fs.readdirSync(path.join(root, 'tasks'), { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.md')).length; } catch { return null; } }
function fila(root, snapshot, now = Date.now()) {
  if (!snapshot || !Array.isArray(snapshot.tasks)) return { ok: false, versao: 'fila-1', motivo: 'a leitura da fila ainda não chegou; tente de novo em 1 min', lidoEm: new Date(now).toISOString() };
  const tasks = snapshot.tasks, arquivos = contarTasks(root);
  // ultimo sinal = o mais novo entre a hora do log e a do arquivo (nota sem hora no log ainda conta como sinal)
  const ultimoSinal = t => { const at = M.ms(t.lastLogAt), mt = mtime(root, 'tasks/' + t.id + '.md'); const v = Math.max(Number.isFinite(at) ? at : -Infinity, Number.isFinite(mt) ? mt : -Infinity); return Number.isFinite(v) ? v : null; };
  const paradoDe = t => { const key = t.phase && t.phase.key; if (!['andando', 'aberta', 'nova'].includes(key)) return null; if (key !== 'andando' && !/^(?:andando|em andamento|trabalhando)/i.test(String(t.state || ''))) return null; const at = ultimoSinal(t); return Number.isFinite(at) && now - at >= PARADO_MS ? at : null; };
  const etapas = {}; for (const [, nome] of ETAPAS) etapas[nome] = 0; etapas['Parado há 3 dias ou mais'] = 0; etapas['Sem etapa'] = 0;
  const parados = [], porTarefa = {};
  // titulo inteiro: o leitor corta em 40 com reticencia; o cabecalho "# ..." do proprio arquivo (no details) vem inteiro
  const tituloInteiro = t => { let base = t.title; if (/…$/.test(String(t.title || ''))) { const cab = /^#\s+(.+)$/m.exec(String(t.details || '')) || /^#\s+(.+)$/m.exec(lerTexto(root, 'tasks/' + t.id + '.md') || ''); if (cab) base = cab[1]; } return M.titulo(base, 200) || M.titulo(t.id, 200); };
  for (const t of tasks) {
    const p = paradoDe(t), tit = tituloInteiro(t);
    if (p !== null) { etapas['Parado há 3 dias ou mais']++; porTarefa[t.id] = { etapa: 'Parado há 3 dias ou mais', titulo: tit }; parados.push({ chave: t.id, titulo: tit, motivo: null, quem: M.nomeSessao(t.owner) || M.frase(t.owner, 40), etapaAntes: ETAPA[t.phase.key] || 'Sem etapa', paradoTexto: 'sem sinal ' + (M.idadeTexto(M.idadeDe(p, now)) || '?'), ultimoSinal: M.quando(p, now), fonte: { arquivo: 'tasks/' + t.id + '.md', estado: t.state || null } }); continue; }
    const nome = ETAPA[t.phase && t.phase.key]; etapas[nome || 'Sem etapa']++; porTarefa[t.id] = { etapa: nome || 'Sem etapa', titulo: tit };
  }
  parados.sort((a, b) => String(a.ultimoSinal.em).localeCompare(String(b.ultimoSinal.em)));
  const pr = snapshot.progress || {}, hist = pr.history || {};
  const semanaTxt = pr.week ? M.diaTexto(pr.week.start + 'T12:00:00Z') + ' a ' + M.diaTexto(pr.week.end + 'T12:00:00Z') : null;
  const ramos = Array.isArray(snapshot.readyBranches) ? snapshot.readyBranches.length : null;
  const foraDaConta = arquivos === null ? null : Math.max(0, arquivos - tasks.length);
  return {
    ok: true, versao: 'fila-1', lidoEm: new Date(now).toISOString(), ...M.quando(snapshot.updated || now, now),
    tarefas: { lidas: tasks.length, arquivos, foraDaConta, rotulo: plural(tasks.length, 'tarefa lida', 'tarefas lidas') + (arquivos !== null ? ' de ' + arquivos + ' arquivos na pasta' : ''), porque: foraDaConta ? plural(foraDaConta, 'arquivo fica', 'arquivos ficam') + ' fora: sem id de data no cabeçalho (ESCOLHAS, notas e listas não são tarefa)' : null },
    etapasDe: 'tarefas da pasta tasks (a fila do Codex conta só em concluídos)', etapas, etapasRotulo: Object.entries(etapas).filter(([, n]) => n).map(([k, n]) => k + ' ' + n).join(' · '),
    porTarefa, porTarefaDe: 'a etapa e o titulo inteiro de cada tarefa (chave = id do arquivo): a tela da Fila usa esta conta e nenhuma outra',
    concluidos: {
      semana: { feitos: Number.isFinite(pr.done) ? pr.done : null, total: Number.isFinite(pr.total) ? pr.total : null, rotulo: Number.isFinite(pr.done) && Number.isFinite(pr.total) ? pr.done + ' de ' + pr.total + ' nesta semana' + (semanaTxt ? ' (' + semanaTxt + ')' : '') : '? nesta semana', recorte: 'abertos de qualquer dia + fechados nesta semana, da fila do Codex e das tarefas com prazo na semana' },
      historico: { feitos: Number.isFinite(hist.done) ? hist.done : null, total: Number.isFinite(hist.total) ? hist.total : null, rotulo: Number.isFinite(hist.done) && Number.isFinite(hist.total) ? hist.done + ' de ' + hist.total + ' desde o começo' : '? desde o começo' },
      etapaNoAr: { n: etapas['No ar'], rotulo: plural(etapas['No ar'], 'tarefa na etapa No ar', 'tarefas na etapa No ar') + ' (todas as datas, só tarefas)' }
    },
    prontos: { ramos, etapaPronta: etapas.Pronta, rotulo: ramos === null ? '? ramos prontos' : plural(ramos, 'ramo com commit esperando revisão ou subida', 'ramos com commit esperando revisão ou subida'), diferenca: ramos !== null && ramos !== etapas.Pronta ? 'Ramos prontos conta também o que está anotado no codex.md sem tarefa e as tarefas já revisadas ou liberadas; a etapa Pronta conta só tarefas com commit no ramo.' : null },
    parados: { n: parados.length, rotulo: parados.length ? plural(parados.length, 'tarefa parada', 'tarefas paradas') + ' há 3 dias ou mais (estava Fazendo)' : 'nenhuma tarefa parada', regra: 'Trabalhando sem sinal no log (ou no arquivo) há 72 h ou mais vira parado, com a idade.', itens: parados.slice(0, 60) },
    fonte: { tarefas: 'tasks/*.md com id', concluidos: pr.source || null, ramos: 'estado/codex.md e logs das tarefas' }
  };
}

// ---------- 4. Lançamentos ----------
const ESTADO_PT = { notStarted: 'Não começou', building: 'Em obra', ready: 'Pronto esperando', live: 'No ar', unknown: '?' };
function lancamentos(root, now = Date.now()) {
  const rel = 'estado/LANCAMENTO.md', raw = lerTexto(root, rel, 256 * 1024), at = mtime(root, rel);
  const antigoAt = mtime(root, 'estado/lancamentos.json');
  let antigoEscrito = null; try { antigoEscrito = M.ms(JSON.parse(String(lerTexto(root, 'estado/lancamentos.json', 64000) || '{}')).atualizado); } catch { antigoEscrito = null; }
  const antigo = antigoAt === null ? null : { arquivo: 'estado/lancamentos.json', velho: true, ...M.quando(Number.isFinite(antigoEscrito) ? antigoEscrito : antigoAt, now), motivo: 'lista antiga, parada desde ' + (M.dataTexto(Number.isFinite(antigoEscrito) ? antigoEscrito : antigoAt) || '?') + '; a lista viva é o LANCAMENTO.md' };
  if (raw === null) return { ok: false, versao: 'lancamentos-1', motivo: 'LANCAMENTO.md sem leitura', lidoEm: new Date(now).toISOString(), antigo, auto: autoLanc(root, now) };
  const Obra = require('./obra-modelo.js'), parsed = Obra.parseLaunch(raw, { file: rel });
  const linhas = String(raw).replace(/^﻿/, '').split(/\r?\n/);
  let cab = null; const extra = new Map();
  linhas.forEach((line, i) => { if (!/^\s*\|/.test(line)) { if (line.trim()) cab = null; return; } const cells = line.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(s => s.trim()), names = cells.map(M.fold); if (names.includes('etapa hoje')) { cab = { n: names.indexOf('#'), prev: names.findIndex(n => /^previsao/.test(n)), dep: names.findIndex(n => /^depende/.test(n)) }; return; } if (cab) extra.set(i + 1, { numero: cab.n >= 0 ? cells[cab.n] : null, previsao: cab.prev >= 0 ? cells[cab.prev] : null, depende: cab.dep >= 0 ? cells[cab.dep] : null }); });
  const itens = parsed.items.map(item => {
    const x = extra.get(item.source.line) || {}, t = M.titulo(item.title, 110);
    const dep = M.fold(x.depende || '');
    return { chave: item.id, numero: /^\d+$/.test(String(x.numero || '')) ? Number(x.numero) : null, titulo: t, motivo: t ? null : 'assunto reservado ou sem texto', secao: M.frase(item.section, 80), dono: M.frase(item.owner, 80), estado: ESTADO_PT[item.state] || '?', estadoMotivo: item.state === 'unknown' ? M.frase(item.reason, 120) : null, etapa: M.frase(item.stage, 200), falta: M.frase(item.blocker, 200), previsao: M.frase(x.previsao, 120), dependeDeVoce: /^sim\b/.test(dep) ? true : /^nao\b/.test(dep) ? false : null, fonte: { arquivo: rel, linha: item.source.line } };
  });
  const porEstado = {}; for (const i of itens) porEstado[i.estado] = (porEstado[i.estado] || 0) + 1;
  const dependem = itens.filter(i => i.dependeDeVoce === true).length;
  return {
    ok: true, versao: 'lancamentos-1', lidoEm: new Date(now).toISOString(), fonteEm: Number.isFinite(at) ? new Date(at).toISOString() : null, fonteTexto: at ? 'lista mexida ' + M.dataTexto(at) + ' (' + M.idadeTexto(M.idadeDe(at, now)) + ')' : null,
    n: itens.length, porEstado, dependemDeVoce: dependem, dependemRotulo: plural(dependem, 'item depende de você', 'itens dependem de você') + ' (coluna "Depende dele" do LANCAMENTO.md; a conta "Espera você" é outra, ver espera)',
    itens, antigo, auto: autoLanc(root, now), fonte: { arquivo: rel }
  };
}

// o resumo da aba Lancamentos le o mesmo resultado do gerador que a lista (launchesOf), nao so o LANCAMENTO.md
function autoLanc(root, now) {
  try { const L = require('./leitor.cjs').launchesOf(root, new Date(now)), fa = L && L.fonteAuto; if (!fa) return null; return fa.ok ? { ok: true, n: L.items.length, idadeTexto: fa.idadeTexto, geradoEm: fa.geradoEm, semPrevisao: fa.semPrevisao } : { ok: false, motivo: fa.motivo, solucao: fa.solucao }; } catch { return null; }
}

// ---------- 5. Cronograma ----------
function cronograma(root, now = Date.now()) {
  let raw = null; try { raw = JSON.parse(String(lerTexto(root, 'estado/cronograma.json', 256000) || '').replace(/^﻿/, '')); } catch { raw = null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, versao: 'cronograma-1', motivo: 'cronograma sem leitura', lidoEm: new Date(now).toISOString() };
  const hoje = dia(now), escrito = M.ms(raw.atualizado);
  const lista = Array.isArray(raw.hoje) ? raw.hoje : [];
  const autos = lista.map(x => M.ms(x && x.concluidoEm)).filter(Number.isFinite);
  const fonteAt = Math.max(Number.isFinite(escrito) ? escrito : -Infinity, ...autos);
  const item = x => { const t = M.titulo(x && x.o_que, 120); return { chave: String(x.id || ''), titulo: t, motivo: t ? null : 'assunto reservado ou sem texto', quem: M.nomeSessao(x.quem), estado: M.frase(x.estado, 30), hora: M.frase(x.hora, 20), automatico: x.automatico === true }; };
  const deHoje = lista.filter(x => x && typeof x === 'object' && (Number.isFinite(M.ms(x.concluidoEm)) ? dia(M.ms(x.concluidoEm)) === hoje : Number.isFinite(escrito) && dia(escrito) === hoje)).map(item);
  const antigos = lista.length - deHoje.length;
  // o Hoje tambem conta os itens do gerador de projetos (a mesma lista da aba Cronograma)
  let autoC = null;
  try { const P = F.lerProjetos(root, now); if (P.ok && !P.velho) { const a = F.itensDeProjetos(P, now); for (const x of a.hoje) deHoje.push({ chave: x.id, titulo: x.o_que, motivo: null, quem: M.nomeSessao(x.quem) || x.quem, estado: x.estado, hora: x.hora, automatico: true }); autoC = { ok: true, n: a.hoje.length, geradoEm: P.geradoEm, idadeTexto: P.idadeTexto }; } else autoC = { ok: false, motivo: P.motivo, solucao: P.solucao }; } catch { autoC = { ok: false, motivo: 'projetos.json sem leitura', solucao: F.SOLUCAO.projetos }; }
  // itens da semana marcados para hoje tambem sao do Hoje
  for (const d of Array.isArray(raw.semana) ? raw.semana : []) if (d && d.dia === hoje && Array.isArray(d.itens)) for (const x of d.itens) if (x && typeof x === 'object') deHoje.push(item(x));
  const semana = (Array.isArray(raw.semana) ? raw.semana : []).filter(d => d && typeof d === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(d.dia || ''))).map(d => ({ dia: d.dia, diaTexto: M.diaTexto(d.dia + 'T15:00:00Z'), n: Array.isArray(d.itens) ? d.itens.length : 0, passou: d.dia < hoje, ehHoje: d.dia === hoje }));
  const proximos = semana.filter(d => !d.passou && !d.ehHoje).reduce((s, d) => s + d.n, 0);
  return {
    ok: true, versao: 'cronograma-1', lidoEm: new Date(now).toISOString(),
    fonteEm: Number.isFinite(fonteAt) ? new Date(fonteAt).toISOString() : null, fonteTexto: Number.isFinite(fonteAt) ? 'atualizado ' + M.horaTexto(fonteAt, now) + ' (' + M.idadeTexto(M.idadeDe(fonteAt, now)) + ')' : '?',
    listaEscrita: Number.isFinite(escrito) ? { ...M.quando(escrito, now), rotulo: 'lista escrita à mão em ' + M.dataTexto(escrito) } : null,
    hoje: { n: deHoje.length, itens: deHoje }, antigos: { n: antigos, rotulo: antigos ? plural(antigos, 'item', 'itens') + ' de dias anteriores (fora do Hoje)' : null },
    semana, automatico: autoC, rotuloHoje: (autoC && !autoC.ok ? '? gerador de projetos sem leitura. Solução: ' + autoC.solucao + ' · ' : '') + (deHoje.length ? plural(deHoje.length, 'item hoje', 'itens hoje') : 'nada hoje' + (proximos ? '; ' + plural(proximos, 'item', 'itens') + ' nos próximos dias da semana' : '') + (antigos ? '; ' + antigos + ' de dias anteriores' : '')),
    fonte: { arquivo: 'estado/cronograma.json', atualizadoCampo: raw.atualizado || null }
  };
}

// ---------- 7. Decididas hoje ----------
function decididas(root, now = Date.now()) {
  const N = require('./cards300-nucleo.cjs'), hoje = dia(now);
  let resp = null, pend = null;
  try {
    const lidos = N.lerPasta(path.join(root, 'estado', 'cards')).lidos.filter(l => l.cru.exemplo !== true);
    resp = 0; pend = 0;
    const subs = N.substituidos(lidos);
    for (const l of lidos) {
      const c = l.cru, r = N.respondido(c);
      if (!r) { if (!N.fechado(c, subs)) pend++; continue; }
      const q = N.quando(String(c.respondidoEm || '') || String(c.respondido || ''), new Date(now));
      const at = q ? q.t : l.mtime;
      if (Number.isFinite(at) && dia(at) === hoje) resp++;
    }
  } catch { resp = null; pend = null; }
  let selosHoje = null, selosTotal = null;
  const txt = lerTexto(root, 'estado/ideias/vereditos-dono.jsonl', 4 * 1024 * 1024);
  if (txt !== null) { const ult = new Map(); for (const linha of txt.split(/\r?\n/)) { try { const r = JSON.parse(linha); if (r && r.t === 'selo' && typeof r.id === 'string') ult.set(r.id, M.ms(r.hora)); } catch { /* linha quebrada fica de fora */ } } selosTotal = ult.size; selosHoje = [...ult.values()].filter(at => Number.isFinite(at) && dia(at) === hoje).length; }
  return {
    ok: true, versao: 'decididas-1', lidoEm: new Date(now).toISOString(), ...M.quando(now, now),
    cards: { respondidosHoje: resp, faltam: pend, total: resp === null ? null : resp + pend, rotulo: resp === null ? '? cards respondidos hoje' : resp + ' de ' + (resp + pend) + ' cards respondidos hoje', regra: 'cards respondidos hoje (todos, sem o corte da lista) sobre respondidos hoje + os que esperam' },
    ideias: { selosHoje, selosTotal, rotulo: selosHoje === null ? '? ideias com o seu selo hoje' : plural(selosHoje, 'ideia com o seu selo hoje', 'ideias com o seu selo hoje') + (selosTotal !== null ? ' (' + selosTotal + ' no total)' : '') },
    fonte: { cards: 'estado/cards', ideias: 'estado/ideias/vereditos-dono.jsonl' }
  };
}

// ---------- rotas ----------
const cache = new Map();
function parte(nome, root, ctx, now) {
  const fechado = !require('./sigilo-pessoas.cjs').aberto();
  const hit = fechado ? cache.get(nome) : null;
  if (hit && now - hit.at < CACHE_MS && hit.root === root) return hit.valor;
  let valor;
  try {
    if (nome === 'espera') valor = esperaVoce(root, now);
    else if (nome === 'credito') valor = credito(root, now);
    else if (nome === 'fila') valor = fila(root, ctx.snapshot ? ctx.snapshot() : null, now);
    else if (nome === 'lancamentos') valor = lancamentos(root, now);
    else if (nome === 'cronograma') valor = cronograma(root, now);
    else valor = decididas(root, now);
  } catch { valor = { ok: false, motivo: 'leitura falhou; tente de novo em 1 min', lidoEm: new Date(now).toISOString() }; }
  if (fechado) cache.set(nome, { at: now, root, valor });
  return valor;
}
function vazio(nome) { return { ok: true, exemplo: true, versao: nome, motivo: 'modo exemplo: sem dado real' }; }
function handle(req, url, ctx) {
  const m = /^\/api\/painel-numeros(?:\/([a-z]+))?$/.exec(url && url.pathname || '');
  if (!m) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') { if (typeof req.resume === 'function') req.resume(); ctx.send(405, { ok: false, error: 'method_not_allowed' }); return true; }
  const nome = m[1] || null;
  if (nome && !PARTES.includes(nome)) { ctx.send(404, { ok: false, error: 'not_found' }); return true; }
  const now = typeof ctx.now === 'function' ? ctx.now() : Date.now();
  if (ctx.example) { ctx.send(200, nome ? vazio(nome) : { ok: true, exemplo: true, ...Object.fromEntries(PARTES.map(p => [p, vazio(p)])) }); return true; }
  if (nome) { ctx.send(200, parte(nome, ctx.root, ctx, now)); return true; }
  ctx.send(200, { ok: true, versao: 'painel-numeros-1', lidoEm: new Date(now).toISOString(), ...Object.fromEntries(PARTES.map(p => [p, parte(p, ctx.root, ctx, now)])) });
  return true;
}
// a conta do Espera você com o mesmo cache de 30 s (fluxo, agora e rotina leem daqui)
function esperaCacheada(root, now = Date.now()) { return parte('espera', root, {}, now); }
function _limparCache() { cache.clear(); }
module.exports = { handle, esperaVoce, esperaCacheada, credito, linhaCredito, fila, lancamentos, cronograma, decididas, PARTES, PARADO_MS, _limparCache };
