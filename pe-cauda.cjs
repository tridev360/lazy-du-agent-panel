'use strict';
// Fim: os ultimos 3 MB do arquivo (linhas inteiras; a 1a linha cortada sai), com cache por tamanho e hora do arquivo.
//   Sai: quantas vezes cada fase apareceu (leitura, mudancas, comandos, equipe) e a 1a e a ultima hora de cada uma, a fase da
//   ultima ferramenta, a hora da 1a e da ultima linha lida e o pedido = a ultima mensagem do dono em 1 linha neutra.
// Comeco (so para ajudante e executor): quem pediu e o que, em 1 linha neutra.
//   Ajudante do Claude: <projetos>/<pasta>/<sessao>/subagents/agent-<id>.jsonl; o "o que" e a descricao curta do pedido
//   (agent-<id>.meta.json) ou a 1a linha da 1a mensagem; quem pediu = a sessao dona da conversa.
//   Executor do Codex: a 1a linha do rollout diz a conversa que o chamou (parent_thread_id) e o papel; o "o que" e a 1a
//   linha da 1a mensagem que a conversa mandou a ele.
// Nunca sai: endereco, chave, caminho, link, hash, numero de dinheiro. Sessao com assunto reservado (ASSISTENTE) ou texto com sinal
// de sigilo: o texto nao sai ("assunto reservado").
//   Fases: Read, Grep, Glob, LS, WebFetch, WebSearch e leituras de pagina = leitura; Edit, Write, MultiEdit, NotebookEdit,
//   apply_patch = mudancas; Bash, PowerShell, exec_command, shell e acoes do navegador = comandos; Agent, Task, SendMessage,
//   send_message, spawn_agent, followup_task, wait_agent e AskUserQuestion = equipe (chama ajudante, manda recado, pergunta).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CAP = 3 * 1024 * 1024, CAP_COMECO = 768 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENTE = /^a?[0-9a-f]{6,40}$/i;
const CLAUDE_DIR = process.env.PE_CLAUDE_PROJECTS || path.join((process.env.PAINEL_HOME || os.homedir()), '.claude', 'projects');
const CODEX_DIR = process.env.PE_CODEX_SESSIONS || path.join((process.env.PAINEL_HOME || os.homedir()), '.codex', 'sessions');

const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Mesma tabela do pe-equipe.js (phaseOf): o nome da ferramenta, sem o prefixo mcp__servidor__.
const FASES = [
  [/^(?:read|grep|glob|ls|webfetch|websearch|toolsearch|view_?image|notebookread|get_page_text|read_page|find|search|web_?run|read_console_messages|read_network_requests|read_terminal|read_widget_context|get_usage|list_\w+|get_\w+|query|search_\w+)$/, 'read'],
  [/^(?:edit|write|multiedit|notebookedit|apply_patch|create|update|batch)$/, 'edit'],
  [/^(?:bash|powershell|exec|exec_command|shell|local_shell|monitor|bashoutput|killshell|terminal|run_in_terminal|computer|navigate|browser_batch|javascript_tool|form_input|preview_start|preview_stop|resize_window|tabs_\w+|run_scheduled_task)$/, 'run'],
  [/^(?:agent|task|sendmessage|send_message|spawn_agent|followup_task|wait_agent|askuserquestion|request_user_input_async|spawn_task)$/, 'team'],
  [/^(?:subagenthandback)$/, 'deliver']
];
function faseDe(nome) {
  const base = fold(String(nome || '').split('__').pop()).replace(/\s+/g, '');
  if (!base) return null;
  for (const [padrao, chave] of FASES) if (padrao.test(base)) return chave;
  return null;
}

// Sinal de sigilo: o texto do pedido nao sai (vira "assunto reservado").
const SIGILO_BASE = /sigilos|segred|carteira|wallet|\bchave\b|\bkey\b|senha|password|\bseed\b|mnemonic|privad|\.env\b|\benv\b|0x[0-9a-f]{6}|holder|\bpnl\b|p&l|lucro|preju|r\$|\busd\b|\beth\b|\bsol\b|\bweth\b|secundari/;
const SIGILO = { test: v => SIGILO_BASE.test(v) || require('./sigilo-pessoas.cjs').PESSOAS.test(v) };
function neutro(texto) {
  let t = String(texto || '').replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]{1,200}>/g, ' ');
  const primeira = t.split(/\r?\n/).map(linha => linha.trim()).find(linha => linha.length > 0) || '';
  t = primeira
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[A-Za-z]:[\\/][^\s,;)]*/g, ' ')
    .replace(/(?:^|\s)\/(?:[\w.-]+\/)+[\w.-]*/g, ' ')
    .replace(/\b[0-9a-f]{7,64}\b/gi, ' ')
    .replace(/\blocal_[0-9a-f-]{4,}/gi, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+([,;.:])/g, '$1').replace(/([,;:])(?=[,;:])/g, '')
    .replace(/[–—]/g, ',')
    .replace(/[`*_#>|]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length > 110) { const corte = t.slice(0, 110); const espaco = corte.lastIndexOf(' '); t = (espaco > 60 ? corte.slice(0, espaco) : corte).replace(/[\s,.;:]+$/, '') + '...'; }
  return t;
}
// 1 linha neutra ou reservada: { texto, reservado }
function linhaNeutra(texto) {
  if (texto === null || texto === undefined || !String(texto).trim()) return { texto: null, reservado: false };
  if (SIGILO.test(fold(texto))) return { texto: null, reservado: true };
  return { texto: neutro(texto), reservado: false };
}
const textoDe = content => typeof content === 'string' ? content : Array.isArray(content) ? content.map(part => part && (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text') ? part.text || '' : '').join(' ') : '';
// texto colado pelo dono vem dentro de <pasted_content ...>: vale o que esta dentro
const semColagem = texto => String(texto || '').trim().replace(/^<pasted_content[^>]*>/i, '').replace(/<\/pasted_content>\s*$/i, '').trim();
const iso = em => Number.isFinite(em) ? new Date(em).toISOString() : null;
// Mensagem do dono nesta linha (o texto) ou null. Claude: user com origem humana, sem ser meta nem resultado de ferramenta.
// Codex: a mensagem "user" que nao e contexto que o app injeta (<...>, # titulo), o user_message antigo e a fala por voz.
function doDono(r, familia) {
  if (!r || typeof r !== 'object') return null;
  if (familia === 'claude') {
    if (r.type !== 'user' || r.isMeta === true) return null;
    const origem = r.origin && r.origin.kind; if (origem && origem !== 'human') return null;
    const content = r.message && r.message.content; if (Array.isArray(content) && content.some(parte => parte && parte.type === 'tool_result')) return null;
    const texto = semColagem(textoDe(content)); return texto && !texto.startsWith('<') ? texto : null;
  }
  const p = r.payload || {};
  let texto = null;
  if (r.type === 'response_item' && p.type === 'message' && p.role === 'user') texto = textoDe(p.content).trim();
  else if (r.type === 'event_msg' && p.type === 'user_message') texto = String(p.message || '').trim();
  else if (r.type === 'realtime_item' && p.type === 'transcript_segment' && (p.role === 'user' || p.speaker === 'user')) texto = String(p.text || p.transcript || '').trim();
  return texto && !texto.startsWith('<') && !texto.startsWith('#') ? texto : null;
}

// Cache: arquivo -> {tamanho, hora, valor}. No maximo 40 arquivos por leitura.
const cache = new Map();
function lerCauda(arquivo, familia, cap = CAP) {
  return require('./sigilo-pessoas.cjs').rodarComo(false, () => lerCaudaFechado(arquivo, familia, cap));
}
function lerCaudaFechado(arquivo, familia, cap = CAP) {
  let stat; try { stat = fs.statSync(arquivo); } catch { return null; }
  const chave = 'fim|' + arquivo + '|' + cap, hit = cache.get(chave);
  if (hit && hit.tamanho === stat.size && hit.hora === stat.mtimeMs) return hit.valor;
  const tamanho = Math.min(cap, stat.size), buffer = Buffer.alloc(tamanho);
  let fd; try { fd = fs.openSync(arquivo, 'r'); fs.readSync(fd, buffer, 0, tamanho, stat.size - tamanho); } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
  const linhas = buffer.toString('utf8').split('\n');
  const inteira = tamanho >= stat.size;
  if (!inteira) linhas.shift(); // a 1a linha veio cortada
  const fases = { read: 0, edit: 0, run: 0, team: 0 }, tempos = { read: null, edit: null, run: null, team: null };
  let ultimaFase = null, ultimaFaseEm = null, desde = null, ate = null, pedido = null, pedidoEm = null, entregue = false, entregueEm = null, ferramentas = 0;
  const recados = []; // os ultimos 20 recados de outra sessao (texto inteiro so aqui dentro; nunca vai para a tela)
  const conta = (fase, em) => { fases[fase]++; ultimaFase = fase; ultimaFaseEm = em; if (Number.isFinite(em)) { const t = tempos[fase] || (tempos[fase] = { de: em, ate: em }); t.ate = em; } };
  for (const linha of linhas) {
    if (!linha.trim()) continue;
    let r; try { r = JSON.parse(linha); } catch { continue; }
    const em = Date.parse(r.timestamp);
    if (Number.isFinite(em)) { if (desde === null) desde = em; ate = em; }
    if (familia === 'claude') {
      const content = r.message && r.message.content, partes = Array.isArray(content) ? content : [];
      if (r.type === 'assistant') {
        for (const parte of partes) if (parte && parte.type === 'tool_use') { ferramentas++; const fase = faseDe(parte.name); if (fase === 'deliver') { entregue = true; entregueEm = em; ultimaFase = 'deliver'; ultimaFaseEm = em; } else if (fase) conta(fase, em); }
        continue;
      }
      if (r.type !== 'user' || partes.some(parte => parte && parte.type === 'tool_result')) continue;
      const origem = r.origin && r.origin.kind;
      // recado de outra sessao (SendMessage): o pedido em uso pode ser dela (o COORDENADOR mandando trabalho)
      if (origem === 'peer') {
        const de = String(r.origin.from || ''), corpo = /<cross-session-message[^>]*>([\s\S]*?)<\/cross-session-message>/.exec(textoDe(content));
        if (/^local_[0-9a-f-]{36}$/i.test(de) && corpo && corpo[1].trim()) { recados.push({ de: de.toLowerCase(), corpo: corpo[1].trim().slice(0, 2000), em }); if (recados.length > 20) recados.shift(); }
        continue;
      }
      const texto = doDono(r, 'claude');
      if (texto) { pedido = texto; pedidoEm = em; }
    } else {
      const p = r.payload || {};
      if (r.type === 'response_item' && (p.type === 'function_call' || p.type === 'custom_tool_call' || p.type === 'local_shell_call')) {
        ferramentas++; const fase = faseDe(p.type === 'local_shell_call' ? 'shell' : p.name);
        if (fase && fase !== 'deliver') conta(fase, em);
      } else if (r.type === 'event_msg' && p.type === 'task_complete') { entregueEm = em; }
      else { const texto = doDono(r, 'codex'); if (texto) { pedido = texto; pedidoEm = em; } }
    }
  }
  const linha = linhaNeutra(pedido);
  const valor = {
    recados,
    fases, tempos: Object.fromEntries(Object.entries(tempos).map(([k, t]) => [k, t ? { de: iso(t.de), ate: iso(t.ate) } : null])),
    ferramentas, ultimaFase, ultimaFaseEm: iso(ultimaFaseEm), entregue, entregueEm: iso(entregueEm),
    desde: iso(desde), ate: iso(ate), inteira, bytes: tamanho, inicio: stat.size - tamanho,
    pedido: pedido === null ? null : { texto: linha.texto, reservado: linha.reservado, em: iso(pedidoEm) }
  };
  cache.set(chave, { tamanho: stat.size, hora: stat.mtimeMs, valor });
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  return valor;
}

// Comeco da conversa (ate 768 KB, linhas inteiras): a 1a mensagem (Claude) ou a 1a linha do rollout e a 1a mensagem que a
// conversa-mae mandou (executor do Codex).
function lerComeco(arquivo, familia, cap = CAP_COMECO) {
  return require('./sigilo-pessoas.cjs').rodarComo(false, () => lerComecoFechado(arquivo, familia, cap));
}
function lerComecoFechado(arquivo, familia, cap = CAP_COMECO) {
  let stat; try { stat = fs.statSync(arquivo); } catch { return null; }
  const chave = 'comeco|' + arquivo, hit = cache.get(chave);
  if (hit && (hit.tamanho === stat.size || hit.valor.completo) ) return hit.valor;
  const tamanho = Math.min(cap, stat.size), buffer = Buffer.alloc(tamanho);
  let fd; try { fd = fs.openSync(arquivo, 'r'); fs.readSync(fd, buffer, 0, tamanho, 0); } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
  const linhas = buffer.toString('utf8').split('\n');
  if (tamanho < stat.size) linhas.pop(); // a ultima linha veio cortada
  const valor = { primeira: null, em: null, pai: null, papel: null, completo: false };
  for (const linha of linhas) {
    if (!linha.trim()) continue;
    let r; try { r = JSON.parse(linha); } catch { continue; }
    const em = Date.parse(r.timestamp);
    if (valor.em === null && Number.isFinite(em)) valor.em = iso(em);
    if (familia === 'claude') {
      const texto = doDono(r, 'claude');
      if (texto) { valor.primeira = texto; valor.em = iso(em) || valor.em; valor.completo = true; break; }
    } else {
      const p = r.payload || {};
      if (r.type === 'session_meta') {
        const spawn = p.source && p.source.subagent && p.source.subagent.thread_spawn || {};
        valor.pai = String(spawn.parent_thread_id || p.parent_thread_id || '').toLowerCase() || null;
        valor.papel = String(spawn.agent_role || p.agent_role || '').trim() || null;
        continue;
      }
      // executor: a 1a mensagem que a conversa-mae mandou; conversa raiz: a 1a mensagem do dono
      if (valor.pai && r.type === 'response_item' && p.type === 'agent_message') { const texto = textoDe(p.content).trim(); if (texto) { valor.primeira = texto; valor.em = iso(em) || valor.em; valor.completo = true; break; } }
      if (!valor.pai) { const texto = doDono(r, 'codex'); if (texto) { valor.primeira = texto; valor.em = iso(em) || valor.em; valor.completo = true; break; } }
    }
  }
  cache.set(chave, { tamanho: stat.size, hora: stat.mtimeMs, valor });
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  return valor;
}

// A ultima mensagem do dono ANTES do fim lido: de tras para frente, em blocos de 4 MB, ate 32 MB; so faz JSON.parse da linha
// que pode ser do dono. Guarda a posicao achada: enquanto ela estiver antes do fim lido, vale sem reler (o arquivo so cresce).
const fundo = new Map();
const PODE_SER_DONO = { claude: '"human"', codex: '"user"' };
function donoNoFundo(arquivo, familia, inicio, limite = 32 * 1024 * 1024) {
  return require('./sigilo-pessoas.cjs').rodarComo(false, () => donoNoFundoFechado(arquivo, familia, inicio, limite));
}
function donoNoFundoFechado(arquivo, familia, inicio, limite = 32 * 1024 * 1024) {
  const hit = fundo.get(arquivo);
  if (hit && hit.pedido && hit.posicao < inicio) return hit.pedido; // achada antes e ainda antes do fim lido
  // sem achar da outra vez: so o trecho que saiu do fim lido desde entao; da 1a vez: ate 32 MB para tras
  const ate = hit && !hit.pedido && hit.inicio <= inicio && inicio - hit.inicio < limite ? hit.ate : Math.max(0, inicio - limite);
  const parar = hit && !hit.pedido && hit.inicio <= inicio && inicio - hit.inicio < limite ? hit.inicio : ate;
  let fd; try { fd = fs.openSync(arquivo, 'r'); } catch { return null; }
  let fim = inicio, achado = null, posicao = null;
  try {
    while (fim > parar && !achado) {
      const comeco = Math.max(parar, fim - 4 * 1024 * 1024), buffer = Buffer.alloc(fim - comeco);
      fs.readSync(fd, buffer, 0, buffer.length, comeco);
      let corte = 0;
      if (comeco > 0) { const nl = buffer.indexOf(10); if (nl < 0) { fim = comeco; continue; } corte = nl + 1; }
      const linhas = buffer.subarray(corte).toString('utf8').split('\n');
      let fimLinha = fim;
      for (let i = linhas.length - 1; i >= 0 && !achado; i--) {
        const linha = linhas[i]; fimLinha -= Buffer.byteLength(linha, 'utf8') + (i < linhas.length - 1 ? 1 : 0);
        if (!linha.includes(PODE_SER_DONO[familia])) continue;
        let r; try { r = JSON.parse(linha); } catch { continue; }
        const dono = doDono(r, familia), em = Date.parse(r.timestamp);
        if (dono) { achado = { texto: dono, em: Number.isFinite(em) ? em : null }; posicao = Math.max(0, fimLinha); }
      }
      if (comeco <= parar) break;
      fim = comeco + corte;
    }
  } catch { /* fica sem */ } finally { fs.closeSync(fd); }
  const linha = achado ? linhaNeutra(achado.texto) : null;
  const pedido = achado ? { texto: linha.texto, reservado: linha.reservado, em: iso(achado.em) } : null;
  fundo.set(arquivo, { posicao, inicio, ate, pedido });
  if (fundo.size > 60) fundo.delete(fundo.keys().next().value);
  return pedido;
}

// Onde mora a conversa: Claude = <projetos>/<pasta>/<uuid>.jsonl (ajudante: <pasta>/<uuid>/subagents/agent-<id>.jsonl);
// Codex = <sessoes>/AAAA/MM/DD/rollout-...-<uuid>.jsonl (ultimos 7 dias).
const lugares = new Map();
function arquivoDe(familia, uuid, opcoes = {}) {
  if (!UUID.test(uuid || '')) return null;
  const agente = opcoes.agente ? String(opcoes.agente) : null;
  if (agente !== null && !AGENTE.test(agente)) return null;
  const id = uuid.toLowerCase(), chave = familia + ':' + id + ':' + (agente || '') + ':' + (familia === 'claude' ? opcoes.claudeDir || '' : opcoes.codexDir || '');
  const hit = lugares.get(chave);
  if (hit && fs.existsSync(hit)) return hit;
  let achado = null;
  if (familia === 'claude') {
    const raiz = opcoes.claudeDir || CLAUDE_DIR;
    let pastas = []; try { pastas = fs.readdirSync(raiz, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name); } catch { pastas = []; }
    for (const pasta of pastas) {
      const alvo = agente ? path.join(raiz, pasta, id, 'subagents', 'agent-' + agente.toLowerCase() + '.jsonl') : path.join(raiz, pasta, id + '.jsonl');
      try { if (fs.lstatSync(alvo).isFile()) { achado = alvo; break; } } catch { /* nao esta aqui */ }
    }
  } else if (familia === 'codex' && !agente) {
    const raiz = opcoes.codexDir || CODEX_DIR, agora = opcoes.agora || Date.now();
    for (let dia = 0; dia < 7 && !achado; dia++) {
      const data = new Date(agora - 3 * 3600000 - dia * 86400000).toISOString().slice(0, 10).split('-');
      const pasta = path.join(raiz, data[0], data[1], data[2]);
      let nomes = []; try { nomes = fs.readdirSync(pasta); } catch { nomes = []; }
      const nome = nomes.find(item => /^rollout-.*\.jsonl$/.test(item) && item.toLowerCase().endsWith(id + '.jsonl'));
      if (nome) achado = path.join(pasta, nome);
    }
  }
  if (achado) { lugares.set(chave, achado); if (lugares.size > 200) lugares.delete(lugares.keys().next().value); }
  return achado;
}
function metaDoAjudante(arquivo) {
  try { const meta = JSON.parse(fs.readFileSync(arquivo.replace(/\.jsonl$/i, '.meta.json'), 'utf8')); return meta && typeof meta === 'object' ? meta : null; } catch { return null; }
}

// Sessao dona da conversa (pelo estado lido): para dizer quem pediu e para esconder o texto da ASSISTENTE.
const RESERVADAS = new Set(['ASSISTENTE']);
function sessaoDe(snapshot, familia, uuid) {
  const alvo = familia + ':' + String(uuid || '').toLowerCase();
  for (const item of snapshot && snapshot.operator && Array.isArray(snapshot.operator.sessions) ? snapshot.operator.sessions : []) {
    const conversa = String((item && item.node && item.node.conversationId) || '').toLowerCase();
    if (conversa === alvo) return String(item.id || '').toUpperCase() || null;
  }
  return null;
}
// comando, duvida ou resposta: a mesma leitura do Fluxo (pe-fluxo.cjs)
function kindOf(texto, padrao) { try { return require('./pe-fluxo.cjs').kindOf(texto, padrao); } catch { return padrao; } }
const papelLegivel = papel => { const t = String(papel || '').replace(/[-_]+/g, ' ').trim(); return t && !/^(?:worker|default|explorer)$/i.test(t) ? t : null; };
// Quem e a sessao local_<id> que mandou o recado: estado/sessoes-claude.json (titulo da conversa) -> COORDENADOR, ATENDIMENTO, ...
let registro = { arquivo: null, hora: 0, mapa: new Map() };
function nomeDaSessao(estado, local) {
  if (!estado || !local) return null;
  const arquivo = path.join(estado, 'estado', 'sessoes-claude.json');
  let hora = 0; try { hora = fs.statSync(arquivo).mtimeMs; } catch { return null; }
  if (registro.arquivo !== arquivo || registro.hora !== hora) {
    const mapa = new Map();
    try {
      const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
      for (const item of Array.isArray(dados && dados.sessoes) ? dados.sessoes : []) {
        const titulo = fold(item && item.titulo);
        const nome = /coordenador|coordenacao/.test(titulo) ? 'COORDENADOR' : (/^(atendimento|loja|cortes|assistente)\b/.exec(titulo) || [])[1];
        if (nome && /^local_[0-9a-f-]{36}$/i.test(String(item.sessionId || ''))) mapa.set(String(item.sessionId).toLowerCase(), nome.toUpperCase());
      }
    } catch { /* sem registro: quem mandou fica "outra sessao" */ }
    registro = { arquivo, hora, mapa };
  }
  return registro.mapa.get(String(local).toLowerCase()) || null;
}

function caudaDe({ familia, uuid, agente = null, snapshot = null, claudeDir, codexDir, estado = null, cap = CAP, agora } = {}) {
  if (!['claude', 'codex'].includes(familia) || !UUID.test(uuid || '')) return { ok: false, erro: 'id' };
  if (agente !== null && (familia !== 'claude' || !AGENTE.test(String(agente)))) return { ok: false, erro: 'id' };
  const arquivo = arquivoDe(familia, uuid, { claudeDir, codexDir, agora, agente });
  if (!arquivo) return { ok: false, erro: 'sem-arquivo' };
  const valor = lerCauda(arquivo, familia, cap);
  if (!valor) return { ok: false, erro: 'sem-leitura' };
  const sessao = familia === 'claude' ? sessaoDe(snapshot, familia, uuid) : null;
  const reservada = sessao !== null && RESERVADAS.has(sessao);
  const doDonoLido = valor.pedido || (!agente && !valor.inteira ? donoNoFundo(arquivo, familia, valor.inicio) : null);
  const pedido = doDonoLido ? { ...doDonoLido, texto: reservada ? null : doDonoLido.texto, reservado: reservada || doDonoLido.reservado } : null;
  let origem = null;
  if (familia === 'claude' && agente) {
    const meta = metaDoAjudante(arquivo), comeco = lerComeco(arquivo, 'claude');
    const linha = linhaNeutra(meta && meta.description ? meta.description : comeco && comeco.primeira);
    origem = { quem: { tipo: 'sessao', nome: sessao, ajudante: Boolean(meta && Number(meta.spawnDepth) > 1) }, texto: reservada ? null : linha.texto, reservado: reservada || linha.reservado, em: comeco && comeco.em || valor.desde };
  } else if (familia === 'codex') {
    const comeco = lerComeco(arquivo, 'codex');
    if (comeco && comeco.pai) {
      const linha = linhaNeutra(comeco.primeira), papel = papelLegivel(comeco.papel);
      origem = { quem: { tipo: 'conversa-codex', pai: UUID.test(comeco.pai) ? comeco.pai : null }, texto: linha.texto || (linha.reservado ? null : papel), reservado: linha.reservado, em: comeco.em };
    }
  }
  // sessao do Claude: o ultimo PEDIDO que chegou, do dono ou de outra sessao pelo recado. Recado so conta como pedido quando
  // e comando (do COORDENADOR, por padrao) ou pergunta do COORDENADOR; relatorio de sessao para o COORDENADOR nao e pedido (mesma regra do Fluxo).
  if (!origem && familia === 'claude') {
    const pedidoEm = pedido && Date.parse(pedido.em);
    for (let i = valor.recados.length - 1; i >= 0 && !origem; i--) {
      const recado = valor.recados[i];
      if (Number.isFinite(pedidoEm) && recado.em <= pedidoEm) break;
      const nome = nomeDaSessao(estado, recado.de), coordenador = nome === 'COORDENADOR', tipo = kindOf(recado.corpo, coordenador ? 'comando' : 'resposta');
      if (!(tipo === 'comando' || (coordenador && tipo === 'duvida'))) continue;
      const doBot = nome !== null && RESERVADAS.has(nome), linha = linhaNeutra(recado.corpo);
      origem = { quem: { tipo: 'sessao', nome }, texto: reservada || doBot ? null : linha.texto, reservado: reservada || doBot || linha.reservado, em: iso(recado.em) };
    }
  }
  if (!origem && pedido) origem = { quem: { tipo: 'voce' }, texto: pedido.texto, reservado: pedido.reservado, em: pedido.em };
  // conversa raiz sem pedido no fim lido: o pedido do comeco da conversa (a 1a mensagem do dono)
  if (!origem) {
    const comeco = lerComeco(arquivo, familia);
    if (comeco && comeco.primeira && !comeco.pai) { const linha = linhaNeutra(comeco.primeira); origem = { quem: { tipo: 'voce' }, texto: reservada ? null : linha.texto, reservado: reservada || linha.reservado, em: comeco.em, comeco: true }; }
  }
  const { recados, inicio, ...publico } = valor; // o texto inteiro dos recados nunca sai daqui
  return { ok: true, familia, sessao, chatDe: familia === 'codex' ? 'codex' : sessao, ...publico, pedido, origem };
}

module.exports = { SIGILO, caudaDe, lerCauda, lerComeco, donoNoFundo, doDono, arquivoDe, faseDe, neutro, linhaNeutra, CAP, UUID, AGENTE };
