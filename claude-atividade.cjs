'use strict';
//  - mtime da conversa e dos arquivos subagents\agent-*.jsonl (v1);
//  - da CAUDA da conversa (so as linhas das ultimas 2 h, lida de tras para frente): a hora e a contagem das mensagens DIGITADAS
//    pelo dono (linha type user, sem isMeta, sem tool_result e que nao comeca com "<"), os recados recebidos de outra sessao
//    (linha que comeca com <cross-session-message from="...">: so o remetente e a hora) e o NOME da ultima ferramenta usada;
// Nunca sai texto de conversa, id, titulo nem caminho. O mapa sessao do app -> conversa sai do local_<id>.json do app (so o campo
// cliSessionId, o mesmo que o pe-metadata-reader.cjs ja le); a lista das sessoes da conta atual, do estado/sessoes-claude.json.
// COPIA fora da pasta servida. Aplicacao: ver PRONTO.md da pasta de cima.
const fs = require('node:fs'), path = require('node:path');
const { textoDono } = require('./sigilo-pessoas.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ATIVA_MS = 5 * 60000, FUTURO_MS = 2 * 60000, JANELA_MS = 2 * 3600000, MAX_DIRS = 400, MAX_SUB = 2000;
const BLOCO = 512 * 1024, MAX_CAUDA = 16 * 1024 * 1024, CAUDA_AJUDANTE = 256 * 1024;
const FERRAMENTA = /^[A-Za-z][\w.:-]{0,63}$/;

// frase curta que a sessao deu ao chamar (description), do agent-<id>.meta.json ao lado (arquivo de ~300 bytes, lido 1 vez e
// guardado pela hora do arquivo). Sai limpo: sem hash, sem id longo, sem caminho, sem travessao, ate 80 letras. Assunto
// reservado (sessao ASSISTENTE, tipo reservado ou palavra privada) sai sem a frase e com reservado: true.
const META_MAX = 8 * 1024, LISTA_MAX = 12, metaCache = new Map();
// podia apagar o marcador junto com um caminho ou um hash); inclui credencial e URL com parametro sensivel.
const PRIVADO = /sigilos|segred|carteira|wallet|\bseed\b|\.env\b|\bchave\b|senha|password|mnemonic|private key|privkey|secret|\btoken\b|api[\s_-]?key|bearer|credencia|[?&](?:key|token|apikey|api_key|secret|sig|signature|auth)=|\bsk-[a-z0-9]|0x[a-f\d]{6}/i;
const listaEnv = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
// Sessoes e tipos de ajudante cujo assunto e reservado: PAINEL_SESSOES_RESERVADAS (padrao ASSISTENTE) e PAINEL_TIPOS_RESERVADOS (padrao nenhum), separados por virgula.
const SESSOES_RESERVADAS = new Set((process.env.PAINEL_SESSOES_RESERVADAS === undefined ? ['ASSISTENTE'] : listaEnv(process.env.PAINEL_SESSOES_RESERVADAS)).map(x => x.toUpperCase())), TIPOS_RESERVADOS = new Set(listaEnv(process.env.PAINEL_TIPOS_RESERVADOS).map(x => x.toLowerCase())), TIPO_RESERVADO = { test: v => TIPOS_RESERVADOS.has(String(v || '').toLowerCase()) }, TIPO = /^[A-Za-z][\w-]{0,39}$/;
function limparFrase(texto) {
  let t = String(texto || '').replace(/[\u0000-\u001f\u007f]/g, ' ');
  t = t.replace(/[A-Za-z]:[\\/]\S*/g, ' ').replace(/\S*\\\S*/g, ' ').replace(/(?:^|\s)[.~]?\/\S+/g, ' ').replace(/\S*\/\S*\.[A-Za-z]{1,5}\b/g, ' ')
    .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{7,}\b/gi, ' ')
    .replace(/\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{16,}\b/g, ' ')
    .replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').replace(/^[\s,;:.]+|[\s,;:]+$/g, '').trim();
  return t.length > 80 ? t.slice(0, 79).trimEnd() + '…' : t;
}
function lerMeta(file) {
  const st = statArquivo(file); if (!st || st.size > META_MAX) return null;
  const old = metaCache.get(file); if (old && old.mtimeMs === st.mtimeMs) return old;
  let dado = null; try { dado = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { dado = null; }
  // a decisao de privado olha a description INTEIRA (o arquivo ja tem teto de META_MAX), antes do corte em 400 (revisor do Codex, 328)
  const descricao = dado && typeof dado.description === 'string' ? dado.description : null;
  const meta = { mtimeMs: st.mtimeMs, tipo: dado && typeof dado.agentType === 'string' && TIPO.test(dado.agentType) ? dado.agentType : null, frase: descricao !== null ? descricao.slice(0, 400) : null, privada: descricao !== null && PRIVADO.test(descricao) };
  if (metaCache.size > 2000) metaCache.clear();
  metaCache.set(file, meta); return meta;
}
// nova por alguns minutos depois da entrega (a entrega e a ultima linha). Pela CAUDA curta (so tipo de linha, motivo de parada e
// nome de ferramenta, nunca texto): a ultima fala do ajudante e a entrega (SubagentHandback) ou terminou o turno (end_turn) = terminou.
const CAUDA_FIM = 64 * 1024, fimCache = new Map();
function terminou(file, mtimeMs) {
  const old = fimCache.get(file); if (old && old.mtimeMs === mtimeMs) return old.fim;
  let fim = false;
  try {
    for (const { linha } of caudaDe(file, 0, CAUDA_FIM)) {
      if (!linha || linha.type !== 'assistant') continue;
      const msg = linha.message, content = msg && Array.isArray(msg.content) ? msg.content : [];
      fim = content.some(part => part && part.type === 'tool_use' && part.name === 'SubagentHandback') || (msg && msg.stop_reason === 'end_turn' && !content.some(part => part && part.type === 'tool_use'));
      break;
    }
  } catch { fim = false; }
  if (fimCache.size > 4000) fimCache.clear();
  fimCache.set(file, { mtimeMs, fim }); return fim;
}
function itemAjudante(a, sessao, now, iso) {
  const meta = lerMeta(a.file.replace(/\.jsonl$/i, '.meta.json'));
  const tipoReservado = Boolean(meta && meta.tipo && TIPO_RESERVADO.test(meta.tipo));
  const escondida = SESSOES_RESERVADAS.has(sessao) || tipoReservado;
  const bruta = !escondida && meta && meta.frase ? meta.frase : null;
  const privada = Boolean(bruta && (meta.privada === true || PRIVADO.test(bruta)));
  let oque = bruta && !privada ? limparFrase(bruta) : null;
  if (oque === '') oque = null;
  const reservado = Boolean(meta && meta.frase && (escondida || privada));
  const item = { tipo: tipoReservado ? null : meta ? meta.tipo : null, oque, reservado,
    ativo: now - a.at <= ATIVA_MS && !a.fim, terminou: Boolean(a.fim), desde: iso(meta && Number.isFinite(meta.mtimeMs) && meta.mtimeMs <= a.at ? meta.mtimeMs : null), ultimaEm: iso(a.at) };
  if (reservado) { const real = textoDono(limparFrase(meta.frase)); if (real) item.soDono = { oque: real, tipo: meta.tipo || null }; }
  return item;
}

function statArquivo(file) { try { const st = fs.lstatSync(file); return st.isFile() && !st.isSymbolicLink() ? st : null; } catch { return null; } }
function pastas(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(item => item.isDirectory() && !item.isSymbolicLink()).slice(0, MAX_DIRS).map(item => item.name); } catch { return []; } }
function arquivos(dir, max) { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(item => item.isFile() && !item.isSymbolicLink()).slice(0, max).map(item => item.name); } catch { return []; } }
function lerJson(file, max) { const st = statArquivo(file); if (!st || st.size > max) return null; try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

function mapaDoApp(appRoot) {
  const mapa = new Map();
  if (!appRoot) return mapa;
  for (const conta of pastas(appRoot)) for (const org of pastas(path.join(appRoot, conta))) {
    const dir = path.join(appRoot, conta, org);
    for (const nome of arquivos(dir, MAX_DIRS)) {
      if (!nome.endsWith('.json') || !LOCAL.test(nome.slice(0, -5))) continue;
      const dado = lerJson(path.join(dir, nome), 1024 * 1024);
      const cli = dado && typeof dado.cliSessionId === 'string' && UUID.test(dado.cliSessionId) ? dado.cliSessionId.toLowerCase() : null;
      if (cli && dado.sessionId === nome.slice(0, -5)) mapa.set(nome.slice(0, -5), cli);
    }
  }
  return mapa;
}

// Linhas inteiras da cauda, da mais nova para a mais velha, parando na primeira mais velha que o limite (ou no maximo de bytes).
function caudaDe(file, desde, maxBytes) {
  const st = statArquivo(file); if (!st || st.size === 0) return [];
  const fd = fs.openSync(file, 'r'), out = [];
  try {
    let fim = st.size, resto = Buffer.alloc(0), lidos = 0;
    while (fim > 0 && lidos < maxBytes) {
      const ini = Math.max(0, fim - BLOCO), buf = Buffer.alloc(fim - ini);
      fs.readSync(fd, buf, 0, buf.length, ini); lidos += buf.length; fim = ini;
      let dado = Buffer.concat([buf, resto]), corte = ini === 0 ? -1 : dado.indexOf(10);
      if (ini > 0 && corte < 0) { resto = dado; continue; }
      resto = corte >= 0 ? dado.subarray(0, corte) : Buffer.alloc(0);
      const linhas = (corte >= 0 ? dado.subarray(corte + 1) : dado).toString('utf8').split('\n');
      let velha = false;
      for (let i = linhas.length - 1; i >= 0; i--) {
        const texto = linhas[i]; if (!texto) continue;
        let linha; try { linha = JSON.parse(texto); } catch { continue; }
        const at = Date.parse(linha && linha.timestamp || '');
        if (Number.isFinite(at) && at < desde) { velha = true; break; }
        out.push({ linha, at: Number.isFinite(at) ? at : null });
      }
      if (velha) break;
    }
  } finally { fs.closeSync(fd); }
  return out;
}
function textoInicial(content) {
  if (typeof content === 'string') return { texto: content, ferramenta: false };
  if (!Array.isArray(content)) return { texto: '', ferramenta: false };
  if (content.some(part => part && part.type === 'tool_result')) return { texto: '', ferramenta: true };
  const first = content.find(part => part && part.type === 'text' && typeof part.text === 'string');
  return { texto: first ? first.text : '', ferramenta: false };
}
function ultimaFerramenta(content) {
  if (!Array.isArray(content)) return null;
  for (let i = content.length - 1; i >= 0; i--) { const part = content[i]; if (part && part.type === 'tool_use' && typeof part.name === 'string' && FERRAMENTA.test(part.name)) return part.name; }
  return null;
}
// O texto e lido so para classificar e nunca sai: sai o tipo e a hora.
const TIPOS = ['comando', 'duvida', 'resposta'], AGENTE = /^a[0-9a-f]{16}$/i, MAX_MSGS = 40, JUNTA_MS = 120000;
let kindOfFn = null;
function tipoDe(texto) {
  if (kindOfFn === null) { try { kindOfFn = require('./pe-fluxo.cjs').kindOf; } catch { kindOfFn = false; } }
  if (typeof kindOfFn !== 'function') return 'comando';
  const limpo = String(texto || '').replace(/^\s*<cross-session-message\b[^>]*>/, '').replace(/<\/cross-session-message>\s*$/, '');
  try { const k = kindOfFn(limpo, 'comando'); return TIPOS.includes(k) ? k : 'comando'; } catch { return 'comando'; }
}
function textoTodo(content) {
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.map(part => part && part.type === 'text' && typeof part.text === 'string' ? part.text : '').join('\n') : '';
}
// O que a cauda diz, so em numero, hora, tipo e nome: mensagens do dono, recados (remetente e tipo), ajudantes (abriu, recado ao
// ajudante, devolveu) e ultima ferramenta. Ajudante devolveu = entrega (peer com handback ou senderTaskId), aviso de tarefa
// de ajudante (task-notification com id a + 16 hex), agent-message (formato antigo) ou resultado do ajudante em primeiro plano;
// a mesma volta do mesmo ajudante em ate 2 min conta 1 vez.
function lerCauda(file, now, nomePorLocal, maxBytes = MAX_CAUDA) {
  const desde = now - JANELA_MS, dono = { mensagens: 0, ultimaEm: null }, recados = new Map(); let ferramenta = null;
  const ajud = { abriu: [], recado: [], devolveu: [] }, porAgente = new Map(), primeiroPlano = new Set(), resultados = [];
  const devolveu = (id, at) => {
    if (id) { const vistos = porAgente.get(id) || []; if (vistos.some(t => Math.abs(t - at) <= JUNTA_MS)) return; vistos.push(at); porAgente.set(id, vistos); }
    ajud.devolveu.push(at);
  };
  const recadoDe = (de, at, texto) => {
    const item = recados.get(de) || { de, mensagens: 0, ultimaEm: null, msgs: [] };
    item.mensagens++; if (item.ultimaEm === null || at > item.ultimaEm) item.ultimaEm = at; item.msgs.push({ at, tipo: tipoDe(texto) }); recados.set(de, item);
  };
  for (const { linha, at } of caudaDe(file, desde, maxBytes)) {
    if (at === null || at > now + FUTURO_MS) continue;
    const msg = linha && linha.message;
    if (linha.type === 'assistant') {
      const content = msg && Array.isArray(msg.content) ? msg.content : [];
      if (!ferramenta) { const nome = ultimaFerramenta(content); if (nome) ferramenta = { nome, em: new Date(at).toISOString() }; }
      if (linha.isSidechain === true) continue;
      for (const part of content) {
        if (!part || part.type !== 'tool_use') continue;
        const input = part.input && typeof part.input === 'object' ? part.input : {};
        if (part.name === 'Agent' || part.name === 'Task') { ajud.abriu.push(at); if (input.run_in_background === false && typeof part.id === 'string') primeiroPlano.add(part.id); }
        else if (part.name === 'SendMessage' && [input.to, input.recipient].some(value => typeof value === 'string' && AGENTE.test(value))) ajud.recado.push(at);
      }
      continue;
    }
    if (linha.type !== 'user' || linha.isSidechain === true || !msg || msg.role !== 'user') continue;
    if (Array.isArray(msg.content)) for (const part of msg.content) if (part && part.type === 'tool_result' && typeof part.tool_use_id === 'string') resultados.push({ id: part.tool_use_id, at, agente: (/\b(a[0-9a-f]{16})\b/i.exec(textoTodo(part.content) || (typeof part.content === 'string' ? part.content : '')) || [])[1] || null });
    // O app marca a origem de cada linha: human = digitada por ele; peer = recado de outra sessao (remetente, hora e tipo)
    // ou a volta de um ajudante (handback). Sem a marca (formato antigo), a regra pelo texto.
    const origin = linha.origin && typeof linha.origin === 'object' ? linha.origin : null;
    if (origin && origin.kind === 'peer') {
      const agente = [origin.from, origin.senderTaskId].find(value => typeof value === 'string' && AGENTE.test(value)) || null;
      if (origin.handback || origin.senderTaskId || agente) { devolveu(agente, at); continue; }
      const local = [origin.fromSession, origin.from].find(value => typeof value === 'string' && nomePorLocal.has(value));
      const nome = String(origin.name || '').toUpperCase().replace(/^COORDENACAO$/, 'COORDENADOR');
      recadoDe(local ? nomePorLocal.get(local) : /^[A-Z]{2,20}$/.test(nome) ? nome : 'OUTRA', at, textoTodo(msg.content) || origin.body);
      continue;
    }
    if (origin && origin.kind === 'task-notification') { const id = (/<task-id>\s*(a[0-9a-f]{16})\s*<\/task-id>/i.exec(textoTodo(msg.content)) || [])[1]; if (id) devolveu(id.toLowerCase(), at); continue; }
    if (origin && origin.kind === 'human') {
      if (textoInicial(msg.content).ferramenta) continue;
      dono.mensagens++; if (dono.ultimaEm === null || at > dono.ultimaEm) dono.ultimaEm = at;
      continue;
    }
    if (origin) continue;
    const { texto, ferramenta: resultado } = textoInicial(msg.content);
    if (resultado || !texto) continue;
    const aviso = /^\s*<task-notification>[\s\S]*?<task-id>\s*(a[0-9a-f]{16})\s*<\/task-id>/i.exec(texto) || /^\s*<agent-message from="(a[0-9a-f]{16})"/i.exec(texto);
    if (aviso) { devolveu(aviso[1].toLowerCase(), at); continue; }
    if (linha.isMeta === true) continue;
    const recado = /^<cross-session-message from="([^"]{1,200})"/.exec(texto);
    if (recado) { recadoDe(nomePorLocal.get(recado[1]) || 'OUTRA', at, textoTodo(msg.content)); continue; }
    if (/^\s*</.test(texto)) continue;
    dono.mensagens++; if (dono.ultimaEm === null || at > dono.ultimaEm) dono.ultimaEm = at;
  }
  for (const r of resultados) if (primeiroPlano.has(r.id)) devolveu(r.agente ? r.agente.toLowerCase() : null, r.at);
  const iso = t => t === null ? null : new Date(t).toISOString();
  const lista = ats => { const ord = ats.slice().sort((a, b) => b - a); return { n: ord.length, ultimaEm: ord.length ? iso(ord[0]) : null, horas: ord.slice(0, MAX_MSGS).map(iso) }; };
  return { dono: { mensagens: dono.mensagens, ultimaEm: iso(dono.ultimaEm) },
    recados: [...recados.values()].map(item => {
      const msgs = item.msgs.slice().sort((a, b) => b.at - a.at), tipos = { comando: 0, duvida: 0, resposta: 0 };
      for (const m of msgs) tipos[m.tipo]++;
      return { de: item.de, mensagens: item.mensagens, ultimaEm: iso(item.ultimaEm), tipo: msgs.length ? msgs[0].tipo : 'comando', tipos, msgs: msgs.slice(0, MAX_MSGS).map(m => ({ em: iso(m.at), tipo: m.tipo })) };
    }).sort((a, b) => a.de.localeCompare(b.de)),
    ajudantes: { abriu: lista(ajud.abriu), recado: lista(ajud.recado), devolveu: lista(ajud.devolveu) }, ferramenta };
}

function atividadeClaude({ estadoRoot, appRoot, projectsRoot, now = Date.now() } = {}) {
  const lista = lerJson(path.join(estadoRoot || '', 'estado', 'sessoes-claude.json'), 256 * 1024);
  const sessoes = Array.isArray(lista && lista.sessoes) ? lista.sessoes : [];
  const mapa = mapaDoApp(appRoot), projetos = projectsRoot ? pastas(projectsRoot) : [];
  const nomeDe = item => String(item && item.titulo || '').toUpperCase().replace(/^COORDENACAO$/, 'COORDENADOR');
  const nomePorLocal = new Map(sessoes.filter(item => item && LOCAL.test(String(item.sessionId || '')) && /^[A-Z]{2,20}$/.test(nomeDe(item))).map(item => [item.sessionId, nomeDe(item)]));
  const valido = t => Number.isFinite(t) && t <= now + FUTURO_MS;
  const iso = t => t === null ? null : new Date(t).toISOString();
  const out = [];
  for (const item of sessoes) {
    const sessao = nomeDe(item);
    if (!/^[A-Z]{2,20}$/.test(sessao) || out.some(row => row.sessao === sessao)) continue;
    const cli = mapa.get(String(item && item.sessionId || '')) || null;
    let ultima = null, cauda = null; const ajudantes = [];
    if (cli) for (const projeto of projetos) {
      const file = path.join(projectsRoot, projeto, cli + '.jsonl'), principal = statArquivo(file);
      if (principal && valido(principal.mtimeMs)) {
        ultima = Math.max(ultima === null ? 0 : ultima, principal.mtimeMs);
        if (!cauda && now - principal.mtimeMs <= JANELA_MS) cauda = lerCauda(file, now, nomePorLocal);
      }
      const sub = path.join(projectsRoot, projeto, cli, 'subagents');
      for (const nome of arquivos(sub, MAX_SUB)) {
        if (!/^agent-[0-9a-z]{6,40}\.jsonl$/i.test(nome)) continue;
        const st = statArquivo(path.join(sub, nome)); if (st && valido(st.mtimeMs)) ajudantes.push({ at: st.mtimeMs, file: path.join(sub, nome), fim: now - st.mtimeMs <= ATIVA_MS ? terminou(path.join(sub, nome), st.mtimeMs) : true });
      }
    }
    ajudantes.sort((a, b) => b.at - a.at);
    const ativos = ajudantes.filter(a => now - a.at <= ATIVA_MS && !a.fim);
    const ferramentasAjudantes = ativos.slice(0, 12).map(a => (lerCauda(a.file, now, nomePorLocal, CAUDA_AJUDANTE).ferramenta)).filter(Boolean);
    const ultimaSessao = ajudantes.length && (ultima === null || ajudantes[0].at > ultima) ? ajudantes[0].at : ultima;
    out.push({ sessao, lida: Boolean(cli), ultimaEm: iso(ultimaSessao),
      ajudantes: cli ? { total: ajudantes.filter(a => now - a.at <= JANELA_MS).length, totalJanelaMin: JANELA_MS / 60000, totalConversa: ajudantes.length, ativos: ativos.length, ultimaEm: iso(ajudantes.length ? ajudantes[0].at : null), ferramentas: ferramentasAjudantes,
        lista: ajudantes.filter(a => now - a.at <= JANELA_MS).slice(0, LISTA_MAX).map(a => itemAjudante(a, sessao, now, iso)) } : null,
      dono: cli ? (cauda ? cauda.dono : { mensagens: 0, ultimaEm: null }) : null,
      recados: cli ? (cauda ? cauda.recados : []) : null,
      // (o /api/pe-equipe/fluxo ja serve o id inteiro como claude:<id>), para a tela casar a raiz com a caixa da casa
      fluxoAjudantes: cli ? { ...(cauda ? cauda.ajudantes : { abriu: { n: 0, ultimaEm: null, horas: [] }, recado: { n: 0, ultimaEm: null, horas: [] }, devolveu: { n: 0, ultimaEm: null, horas: [] } }), ativos: ativos.length } : null,
      conversa: cli ? cli.slice(0, 8) : null,
      ferramenta: cauda ? cauda.ferramenta : null });
  }
  return { ok: true, lidoEm: new Date(now).toISOString(), janelaMin: JANELA_MS / 60000, sessoes: out };
}

// Junta no estado que a tela ja recebe (operator.sessions[]): node.lastAt com a hora mais nova, ajudantes { total, ativos,
// ferramentas }, fluxo { janelaMin, dono, recados } e ferramenta { nome, em }. Sessao nao lida fica como estava.
function juntarNoEstado(snapshot, atividade) {
  const ops = snapshot && snapshot.operator && Array.isArray(snapshot.operator.sessions) ? snapshot.operator.sessions : null;
  if (!ops || !atividade || !Array.isArray(atividade.sessoes)) return snapshot;
  const porNome = new Map(atividade.sessoes.map(row => [row.sessao, row]));
  const sessions = ops.map(item => {
    const row = porNome.get(String(item && item.id || '').toUpperCase().replace(/^COORDENACAO$/, 'COORDENADOR'));
    if (!row || !row.lida) return item;
    const antes = Date.parse(item.node && item.node.lastAt || ''), agora = Date.parse(row.ultimaEm || '');
    const node = Number.isFinite(agora) && (!Number.isFinite(antes) || agora > antes) ? { ...item.node, lastAt: row.ultimaEm } : item.node;
    return { ...item, node, ajudantes: row.ajudantes ? { total: row.ajudantes.total, ativos: row.ajudantes.ativos, ferramentas: row.ajudantes.ferramentas || [], lista: Array.isArray(row.ajudantes.lista) ? row.ajudantes.lista : [] } : undefined,
      fluxo: { janelaMin: atividade.janelaMin || 120, lidoEm: atividade.lidoEm, dono: row.dono, recados: row.recados || [], ajudantes: row.fluxoAjudantes || null, conversa: row.conversa || null }, ferramenta: row.ferramenta || null };
  });
  return { ...snapshot, operator: { ...snapshot.operator, sessions } };
}

module.exports = { PRIVADO, SESSOES_RESERVADAS, TIPO_RESERVADO, atividadeClaude, juntarNoEstado, mapaDoApp, lerCauda, limparFrase, itemAjudante, terminou };
