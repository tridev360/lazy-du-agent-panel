'use strict';








const fs = require('node:fs'), path = require('node:path');
const { mascarar, arquivoSensivel, comandoSensivel } = require('./cru-mascara.cjs');

const MAX_FALA = 12000, MAX_TEXTO = 6000, MAX_SAIDA = 4000, MAX_RESUMO = 240, MAX_LINHA_SAIDA = 200, MAX_TURNOS = 60, MAX_FALAS = 5;
const OCULTO_ARQUIVO = '[conteúdo de arquivo sensível: oculto]', OCULTO_SAIDA = '[saída oculta: arquivo ou comando sensível]';
const corta = (s, max) => { const a = Array.from(s); return a.length > max ? { texto: a.slice(0, max - 1).join('') + '…', cortado: true } : { texto: s, cortado: false }; };
const limpo = (v, max = MAX_TEXTO) => corta(mascarar(typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : ''), max);
const primeiraLinha = s => { const l = String(s || '').split('\n').map(x => x.trim()).find(Boolean) || ''; return corta(l, MAX_RESUMO).texto; };
const ms = t => { const n = Date.parse(t); return Number.isFinite(n) ? n : null; };
const temPergunta = v => typeof v === 'string' && /\?(?=\s|$|["')\]»”])/.test(v);
const base = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '?';
const textoDeConteudo = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(b => b && b.type === 'text' ? String(b.text || '') : b && b.type === 'image' ? '[imagem]' : b && b.type === 'tool_reference' ? '[ferramenta ' + (b.tool_name || '?') + ']' : b && b.type ? '[' + b.type + ']' : '').filter(Boolean).join('\n') : '';

function criarCauda({ bytesIniciais = 3000000, maxPorLeitura = 8000000 } = {}) {
  let atual = null, offset = 0, resto = Buffer.alloc(0), pularPrimeira = false;
  function ler(caminho) {
    let st; try { st = fs.lstatSync(caminho); } catch { atual = null; return { linhas: [], reiniciou: false, erro: 'ausente' }; }
    if (!st.isFile() || st.isSymbolicLink()) { atual = null; return { linhas: [], reiniciou: false, erro: 'ausente' }; }
    let reiniciou = false;
    if (caminho !== atual || st.size < offset || st.size - offset > maxPorLeitura) {
      atual = caminho; offset = Math.max(0, st.size - bytesIniciais); resto = Buffer.alloc(0); pularPrimeira = offset > 0; reiniciou = true;
    }
    if (st.size === offset) return { linhas: [], reiniciou, tamanho: st.size, mtimeMs: st.mtimeMs };
    const buf = Buffer.alloc(st.size - offset);
    let lidos = 0, fd = null;
    try { fd = fs.openSync(caminho, 'r'); lidos = fs.readSync(fd, buf, 0, buf.length, offset); } catch { return { linhas: [], reiniciou, erro: 'ilegivel' }; } finally { if (fd !== null) try { fs.closeSync(fd); } catch {  } }
    offset += lidos;
    let dados = Buffer.concat([resto, buf.subarray(0, lidos)]);
    if (pularPrimeira) { const i = dados.indexOf(10); if (i < 0) { resto = Buffer.alloc(0); return { linhas: [], reiniciou, tamanho: st.size, mtimeMs: st.mtimeMs }; } dados = dados.subarray(i + 1); pularPrimeira = false; }
    const fim = dados.lastIndexOf(10);
    if (fim < 0) { resto = dados; return { linhas: [], reiniciou, tamanho: st.size, mtimeMs: st.mtimeMs }; }
    resto = Buffer.from(dados.subarray(fim + 1));
    const linhas = dados.subarray(0, fim).toString('utf8').split('\n').map(l => l.replace(/\r$/, '')).filter(Boolean);
    return { linhas, reiniciou, tamanho: st.size, mtimeMs: st.mtimeMs };
  }
  return { ler, caminho: () => atual };
}

function criarLeitor({ destinos = {}, maxEventos = 400, desde = null } = {}) {
  const desdeMs = typeof desde === 'string' ? ms(desde) : null;
  const sessoes = destinos.sessoes && typeof destinos.sessoes === 'object' ? destinos.sessoes : {};
  const fixos = Array.isArray(destinos.fixos) ? destinos.fixos.filter(x => typeof x === 'string') : [];
  const regras = (Array.isArray(destinos.regras) ? destinos.regras : []).map(r => { try { return { destino: String(r.destino), ferramenta: new RegExp(r.ferramenta, 'i'), campo: String(r.campo), padrao: new RegExp(r.padrao, 'i') }; } catch { return null; } }).filter(Boolean);
  const nomesDeSessao = new Set(Object.values(sessoes));
  let eventos = [], seq = 0, versao = 0, turnoAtual = 0, ultimaLinhaMs = null;
  const porUso = new Map();      // tool_use id -> evento
  const pendentes = new Map();   // tool_use id -> evento (comando ainda sem resultado)
  const ajudantes = new Map();   // agentId -> { id, nome, destino (fixo, quando a regra manda), desde, vivo, voltouEm, evento }
  const aprendidos = new Map();  // id de sessao -> nome visto no proprio registro
  const dest = new Map();        // chave -> { ultimoEnvio, ultimaVolta, duvidaAberta, voltaTurno, nome, tipo }
  const turnos = new Map();      // id -> conta
  let filaPendente = [];         // falas que entraram na fila e a COORDENADOR ainda nao leu
  let marca = null;              // ultimo passo que muda o estado: { classe, t, porque, texto }
  let ultimaResposta = null;     // ultimo texto dela no turno (para "esperando voce" por pergunta)

  const contaDe = id => { if (!turnos.has(id)) { turnos.set(id, { id, inicio: null, fala: '', pensamentos: 0, comandos: 0, leituras: 0, envios: 0, telas: 0, voltas: 0, passos: 0, fim: null }); if (turnos.size > MAX_TURNOS) turnos.delete(turnos.keys().next().value); } return turnos.get(id); };
  const destDe = (chave, nome, tipo) => { if (!dest.has(chave)) dest.set(chave, { ultimoEnvio: null, ultimaVolta: null, duvidaAberta: null, voltaTurno: null, nome: nome || chave, tipo: tipo || 'sessao' }); const d = dest.get(chave); if (nome) d.nome = nome; return d; };
  const toca = e => { e.v = ++versao; };

  function novo(tipo, t, campos) {
    const e = { seq: ++seq, v: 0, t, tipo, turno: turnoAtual, resumo: '', texto: '', cortado: false, durMs: null, destino: null, destinoNome: null, selo: null, ferramenta: null, saida: null, pendente: false, ...campos };
    toca(e); eventos.push(e);
    const c = contaDe(e.turno);
    if (!c.inicio) c.inicio = t;
    c.passos++; c.fim = t;
    if (tipo === 'pensou') c.pensamentos++; else if (tipo === 'comando') { c.comandos++; if (campos && campos.ferramenta === 'Read') c.leituras++; } else if (tipo === 'mandou' || tipo === 'ajudante') c.envios++; else if (tipo === 'perguntou') c.telas++; else if (tipo === 'voltou') c.voltas++;
    if (eventos.length > maxEventos) for (const velho of eventos.splice(0, eventos.length - maxEventos)) if (velho.usoId) { porUso.delete(velho.usoId); pendentes.delete(velho.usoId); }
    return e;
  }
  const envio = (e, chave, nome, tipo) => { const d = destDe(chave, nome, tipo); d.ultimoEnvio = { t: e.t, selo: e.selo, resumo: e.resumo, turno: e.turno }; if (e.selo === 'duvida' && !d.duvidaAberta) d.duvidaAberta = e.t; };
  const volta = (e, chave, nome, tipo) => { const d = destDe(chave, nome, tipo); d.ultimaVolta = { t: e.t }; d.duvidaAberta = null; d.voltaTurno = e.turno; };

  function nomeDaSessao(id, nomeVisto) {
    if (sessoes[id]) return { chave: sessoes[id], nome: sessoes[id], desconhecido: false };
    if (nomeVisto && !aprendidos.has(id)) aprendidos.set(id, mascarar(String(nomeVisto)).slice(0, 40));
    if (aprendidos.has(id)) return { chave: aprendidos.get(id), nome: aprendidos.get(id), desconhecido: false };
    const curto = 'sessão ' + String(id || '?').slice(-6);
    return { chave: curto, nome: curto, desconhecido: true };
  }
  function doAjudante(id) {
    const a = ajudantes.get(id);
    if (a && a.destino) return { chave: a.destino, nome: a.destino, tipo: 'fixo' };
    return { chave: 'aj:' + id, nome: a ? a.nome : 'ajudante ' + String(id).slice(0, 7), tipo: 'ajudante' };
  }
  function ajudanteVoltou(id, t) {
    const a = ajudantes.get(id); if (!a || !a.vivo) return;
    a.vivo = false; a.voltouEm = t;
    if (a.evento && a.evento.pendente) { a.evento.pendente = false; const i = ms(a.evento.t), f = ms(t); a.evento.durMs = i !== null && f !== null ? Math.max(0, f - i) : null; toca(a.evento); }
  }

  function notas(texto, t) {
    let resto = String(texto || ''), achou = false;
    resto = resto.replace(/<system-reminder>([\s\S]*?)<\/system-reminder>/g, (m, miolo) => {
      const n = /The session "([^"]*)" you started \(([\w-]+)\)\s*([^.]*)\.(?:\s*It reported[^:]*:\s*"([\s\S]*?)"\s*(?:Read it with|$))?/.exec(miolo);
      if (n) {
        achou = true;
        const s = nomeDaSessao(n[2], n[1]), corpo = limpo(n[4] || n[3] || '');
        const e = novo('voltou', t, { resumo: primeiraLinha(corpo.texto), texto: corpo.texto, cortado: corpo.cortado, destino: s.chave, destinoNome: s.nome, origem: 'nota' });
        volta(e, s.chave, s.nome, 'sessao');
      }
      return '';
    });
    return { resto: resto.trim(), achou };
  }
  function falaHumana(partes, t, { noMeio = false, abreTurno = true } = {}) {
    let imagens = 0; const textos = [];
    for (const p of partes) { if (p && p.type === 'image') imagens++; else if (typeof p === 'string') textos.push(p); else if (p && p.type === 'text') textos.push(String(p.text || '')); }
    const semMoldura = [];
    const temFala = textos.some(x => x.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()) || imagens > 0;
    if (temFala && abreTurno) { turnoAtual++; ultimaResposta = null; }
    for (const x of textos) { const n = notas(x, t); if (n.resto) semMoldura.push(n.resto); }
    if (!temFala) return false;
    const corpo = limpo(semMoldura.join('\n'), MAX_FALA);
    const e = novo('fala', t, { resumo: primeiraLinha(corpo.texto) || (imagens ? '[imagem]' : ''), texto: corpo.texto, cortado: corpo.cortado, imagens, noMeio });
    const c = contaDe(e.turno); if (abreTurno && !c.fala) { c.fala = e.resumo; c.inicio = t; }
    return true;
  }
  function relatorio(origem, texto, t) {
    const id = String(origem.from || origem.senderTaskId || '');
    const corpo = limpo(typeof origem.body === 'string' && origem.body ? origem.body : String(texto || '').replace(/^[\s\S]*?\[Subagent hand-back\][^\n]*\n?/, '').replace(/<\/agent-message>\s*$/, ''));
    const d = doAjudante(id);
    const e = novo('voltou', t, { resumo: primeiraLinha(corpo.texto), texto: corpo.texto, cortado: corpo.cortado, destino: d.chave, destinoNome: d.nome, origem: 'relatorio' });
    ajudanteVoltou(id, t); volta(e, d.chave, d.nome, d.tipo);
  }
  function recado(texto, t) {
    const m = /<cross-session-message from="([^"]*)"(?:\s+name="([^"]*)")?[^>]*>\s*([\s\S]*?)\s*(?:<\/cross-session-message>|$)/.exec(String(texto || ''));
    if (!m) return false;
    const s = nomeDaSessao(m[1], m[2]), corpo = limpo(m[3]);
    const e = novo('voltou', t, { resumo: primeiraLinha(corpo.texto), texto: corpo.texto, cortado: corpo.cortado, destino: s.chave, destinoNome: s.nome, origem: 'recado' });
    volta(e, s.chave, s.nome, 'sessao');
    return true;
  }
  function aviso(texto, t) {
    const tag = n => { const m = new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>').exec(String(texto || '')); return m ? m[1].trim() : ''; };
    const id = tag('task-id'), status = tag('status'), resumo = tag('summary'), evento = tag('event');
    const corpo = limpo([resumo, evento].filter(Boolean).join('\n'));
    const d = ajudantes.has(id) ? doAjudante(id) : { chave: 'tarefa', nome: 'tarefa em segundo plano', tipo: 'tarefa' };
    const e = novo('voltou', t, { resumo: primeiraLinha(corpo.texto), texto: corpo.texto, cortado: corpo.cortado, destino: d.chave, destinoNome: d.nome, origem: 'tarefa' });
    if (ajudantes.has(id)) { if (status) ajudanteVoltou(id, t); volta(e, d.chave, d.nome, d.tipo); }
  }

  function chegada(conteudo, origem, j, t, noMeio) {
    const kind = origem && origem.kind, texto = typeof conteudo === 'string' ? conteudo : textoDeConteudo(conteudo);
    if (kind === 'human') return falaHumana(typeof conteudo === 'string' ? [conteudo] : conteudo, t, { noMeio, abreTurno: !noMeio }) ? 'fala' : 'volta';
    if (kind === 'peer') { if (origem.handback || /<agent-message/.test(texto)) relatorio(origem, texto, t); else if (!recado(texto, t)) return null; return 'volta'; }
    if (kind === 'task-notification' || /^\s*<task-notification>/.test(texto)) { aviso(texto, t); return 'volta'; }
    if (/^\s*This session is being continued from a previous conversation/.test(texto) || j.isCompactSummary) return null;
    if (/<system-reminder>/.test(texto)) { const n = notas(texto, t); if (n.achou) return 'volta'; if (!n.resto) return null; }
    if (/<cross-session-message/.test(texto)) return recado(texto, t) ? 'volta' : null;
    if (!origem && j.turnOrigin === 'human' && !j.isMeta) return falaHumana(typeof conteudo === 'string' ? [conteudo] : conteudo, t, { noMeio, abreTurno: !noMeio }) ? 'fala' : null;
    return null;
  }

  function regraDe(nome, input) { for (const r of regras) { if (!r.ferramenta.test(nome)) continue; const v = input ? input[r.campo] : undefined; if (typeof v === 'string' && r.padrao.test(v)) return r.destino; } return null; }
  function descreve(nome, i) {
    if (typeof i.description === 'string' && i.description.trim()) return i.description.trim();
    if (nome === 'Read') return 'Ler ' + base(i.file_path);
    if (nome === 'Write') return 'Escrever ' + base(i.file_path);
    if (nome === 'Edit' || nome === 'MultiEdit' || nome === 'NotebookEdit') return 'Editar ' + base(i.file_path || i.notebook_path);
    if (nome === 'Grep') return 'Buscar "' + String(i.pattern || '?') + '"';
    if (nome === 'Glob') return 'Listar ' + String(i.pattern || '?');
    if (nome === 'ToolSearch') return 'Procurar ferramenta: ' + String(i.query || '?');
    const curto = nome.replace(/^mcp__/, '').replace(/__/g, ': ').replace(/_/g, ' ');
    const pista = [i.title, i.url, i.session_id, i.task_id, i.caption, i.skill].find(x => typeof x === 'string' && x);
    return pista ? curto + ': ' + pista : curto;
  }
  function corpoDoComando(nome, i, sensivel) {
    const arq = i.file_path || i.notebook_path || i.path;
    if (sensivel && arq) return String(arq) + '\n' + OCULTO_ARQUIVO;
    if (typeof i.command === 'string') return i.command;
    if (nome === 'Read') return String(i.file_path || '?') + (i.offset ? ' (da linha ' + i.offset + ')' : '');
    if (nome === 'Write') return String(i.file_path || '?') + '\n\n' + String(i.content || '');
    if (nome === 'Edit') return String(i.file_path || '?') + '\n\n- ' + String(i.old_string || '') + '\n\n+ ' + String(i.new_string || '');
    if (nome === 'Grep' || nome === 'Glob') return String(i.pattern || '?') + (i.path ? '\nem ' + i.path : '') + (i.glob ? '\narquivos ' + i.glob : '');
    try { return JSON.stringify(i, (k, v) => typeof v === 'string' && v.length > 1500 ? v.slice(0, 1500) + '…' : v, 1); } catch { return ''; }
  }
  function usoDeFerramenta(b, t) {
    const nome = String(b.name || '?'), i = b.input && typeof b.input === 'object' ? b.input : {};
    let e;
    if (nome === 'SendMessage' || /send_message$/.test(nome)) {
      const para = String(i.to || i.recipient || i.session_id || ''), msg = limpo(String(i.message || i.content || ''));
      const d = i.recipient_kind === 'agent' || (!/^local_/.test(para) && ajudantes.has(para)) ? doAjudante(para) : { ...nomeDaSessao(para), tipo: 'sessao' };
      e = novo('mandou', t, { resumo: primeiraLinha(mascarar(String(i.summary || ''))) || primeiraLinha(msg.texto), texto: msg.texto, cortado: msg.cortado, destino: d.chave, destinoNome: d.nome, selo: temPergunta(String(i.message || i.content || '')) ? 'duvida' : 'direcao', ferramenta: nome, pendente: true, entrega: '', ...(d.desconhecido ? { destinoDesconhecido: true } : {}) });
      envio(e, d.chave, d.nome, d.tipo);
    } else if (/start_session$/.test(nome)) {
      const titulo = mascarar(String(i.title || i.name || '?')).slice(0, 60), msg = limpo(String(i.prompt || ''));
      e = novo('mandou', t, { resumo: 'Abriu a sessão ' + titulo, texto: msg.texto, cortado: msg.cortado, destino: titulo, destinoNome: titulo, selo: 'direcao', ferramenta: nome, pendente: true, entrega: '', sessaoNova: true });
      envio(e, titulo, titulo, 'sessao');
    } else if (nome === 'Agent' || nome === 'Task') {
      const desc = primeiraLinha(mascarar(String(i.description || 'ajudante'))), msg = limpo(String(i.prompt || '')), fixo = regraDe(nome, i);
      e = novo('ajudante', t, { resumo: desc, texto: msg.texto, cortado: msg.cortado, destino: fixo || 'aj:?' + b.id, destinoNome: fixo || desc, selo: temPergunta(String(i.description || '')) ? 'duvida' : 'direcao', ferramenta: nome, subtipo: String(i.subagent_type || ''), pendente: true, destinoFixo: !!fixo });
      if (fixo) envio(e, fixo, fixo, 'fixo');
    } else if (nome === 'AskUserQuestion') {
      const qs = Array.isArray(i.questions) ? i.questions : [];
      const corpo = limpo(qs.map(q => String(q.question || '') + '\n' + (Array.isArray(q.options) ? q.options : []).map((o, n) => (n + 1) + ') ' + String(o.label || '?') + (o.description ? ': ' + o.description : '')).join('\n')).join('\n\n'));
      const q0 = qs[0] || {};
      e = novo('perguntou', t, { resumo: primeiraLinha(mascarar((q0.header ? q0.header + ': ' : '') + String(q0.question || '?'))), texto: corpo.texto, cortado: corpo.cortado, ferramenta: nome, pendente: true });
    } else {
      const arq = i.file_path || i.notebook_path || (/^(Grep|Glob)$/.test(nome) ? i.path : null);
      const sensivel = (typeof arq === 'string' && arquivoSensivel(arq)) || (typeof i.command === 'string' && comandoSensivel(i.command)) || (typeof i.glob === 'string' && arquivoSensivel(i.glob));
      const corpo = limpo(corpoDoComando(nome, i, sensivel)), fixo = regraDe(nome, i);
      e = novo('comando', t, { resumo: primeiraLinha(mascarar(descreve(nome, i))), texto: corpo.texto, cortado: corpo.cortado, ferramenta: nome, pendente: true, sensivel, destino: fixo, destinoNome: fixo, selo: fixo ? (temPergunta(String(i.description || '')) ? 'duvida' : 'direcao') : null });
      if (fixo) envio(e, fixo, fixo, 'fixo');
    }
    e.usoId = b.id; porUso.set(b.id, e); pendentes.set(b.id, e);
    return e;
  }
  function resultadoDeFerramenta(b, j, t) {
    const e = porUso.get(b.tool_use_id); pendentes.delete(b.tool_use_id);
    if (!e) return;
    const r = j.toolUseResult, bruto = textoDeConteudo(b.content), i = ms(e.t), f = ms(t), dur = i !== null && f !== null ? Math.max(0, f - i) : null;
    const saida = textoSaida => { const c = e.sensivel ? { texto: OCULTO_SAIDA, cortado: false } : limpo(textoSaida, MAX_SAIDA); const ls = c.texto.split('\n').map(x => x.trim()).filter(Boolean); return { linhas: ls.slice(0, 3).map(x => corta(x, MAX_LINHA_SAIDA).texto), maisLinhas: Math.max(0, ls.length - 3), texto: c.texto, cortado: c.cortado, erro: b.is_error === true }; };
    if (e.tipo === 'ajudante') {
      const id = r && typeof r === 'object' && typeof r.agentId === 'string' ? r.agentId : null;
      if (id) {
        ajudantes.set(id, { id, nome: e.resumo, destino: e.destinoFixo ? e.destino : null, desde: e.t, vivo: true, voltouEm: null, evento: e });
        if (!e.destinoFixo) { e.destino = 'aj:' + id; envio(e, e.destino, e.resumo, 'ajudante'); }
        e.saida = { linhas: ['lançado em segundo plano'], maisLinhas: 0, texto: 'lançado em segundo plano', cortado: false, erro: false };
      } else { e.saida = saida(bruto); e.pendente = false; e.durMs = dur; }
    } else if (e.tipo === 'perguntou') {
      const resp = r && typeof r === 'object' && r.answers && typeof r.answers === 'object' ? Object.values(r.answers).map(String) : (bruto.match(/="([^"]*)"/g) || []).map(x => x.slice(2, -1));
      const corpo = limpo(resp.join('\n') || bruto);
      e.saida = saida(resp.join('\n') || bruto); e.pendente = false; e.durMs = dur;
      novo('fala', t, { resumo: primeiraLinha(corpo.texto), texto: corpo.texto, cortado: corpo.cortado, imagens: 0, noMeio: false, daEscolha: true });
    } else if (e.tipo === 'mandou') {
      const msg = r && typeof r === 'object' && typeof r.message === 'string' ? r.message : bruto;
      e.entrega = b.is_error === true ? 'falhou' : /delivered/i.test(msg) ? 'entregue' : /queued/i.test(msg) ? 'na fila' : /resuming/i.test(msg) ? 'acordou o ajudante' : /Started session/i.test(msg) ? 'sessão aberta' : '';
      const s = /session (local_[\w-]+) \(\\?"([^"\\]+)/.exec(msg) || /Started session "([^"]+)" \(session_id: (local_[\w-]+)/.exec(msg);
      if (s) { const id = s[1].startsWith('local_') ? s[1] : s[2], nome = s[1].startsWith('local_') ? s[2] : s[1]; if (!sessoes[id] && !aprendidos.has(id)) aprendidos.set(id, mascarar(nome).slice(0, 40)); }
      e.saida = saida(msg); e.pendente = false; e.durMs = dur;
    } else { e.saida = saida(bruto); e.pendente = false; e.durMs = dur; }
    toca(e);
  }

  function linha(j) {
    if (!j || typeof j !== 'object' || j.isSidechain === true) return;
    const t = typeof j.timestamp === 'string' ? j.timestamp : j.attachment && typeof j.attachment.timestamp === 'string' ? j.attachment.timestamp : null;
    if (desdeMs !== null && t && ms(t) !== null && ms(t) < desdeMs) return;
    if (t && ms(t) !== null && (ultimaLinhaMs === null || ms(t) > ultimaLinhaMs)) ultimaLinhaMs = ms(t);
    if (j.type === 'queue-operation') {
      if (j.operation === 'enqueue') filaPendente.push({ t: j.timestamp, texto: String(j.content || '') });
      else if (j.operation === 'dequeue') filaPendente.shift();
      else if (j.operation === 'remove') { const c = String(j.content || ''), k = filaPendente.findIndex(x => x.texto === c); if (k >= 0) filaPendente.splice(k, 1); else filaPendente.shift(); }
      if (filaPendente.length > 50) filaPendente = filaPendente.slice(-50);
      versao++;
      return;
    }
    if (!t) return;
    if (j.type === 'system') {
      if (j.subtype === 'stop_hook_summary') { pendentes.clear(); marca = { classe: 'fim', t }; versao++; }
      else if (j.subtype === 'compact_boundary') novo('sistema', t, { resumo: 'O app compactou a conversa', texto: '' });
      return;
    }
    if (j.type === 'attachment') {
      const a = j.attachment || {};
      if (a.type === 'queued_command') chegada(a.prompt, a.origin && a.origin.kind ? a.origin : null, { isMeta: a.isMeta, turnOrigin: a.origin && a.origin.kind === 'human' ? 'human' : null }, t, true);
      else if (a.type === 'task_status' && a.taskType === 'local_agent' && typeof a.taskId === 'string') {
        const vivo = a.status === 'running', tem = ajudantes.get(a.taskId);
        if (!tem) { if (vivo) { ajudantes.set(a.taskId, { id: a.taskId, nome: primeiraLinha(mascarar(String(a.description || 'ajudante'))), destino: null, desde: t, vivo: true, voltouEm: null, evento: null }); versao++; } }
        else if (!vivo && tem.vivo) { ajudanteVoltou(a.taskId, t); versao++; }
      }
      return;
    }
    const c = j.message && j.message.content;
    if (j.type === 'assistant' && Array.isArray(c)) {
      for (const b of c) {
        if (!b) continue;
        if (b.type === 'thinking') { const corpo = limpo(String(b.thinking || '')); novo('pensou', t, { resumo: primeiraLinha(corpo.texto), texto: corpo.texto, cortado: corpo.cortado, durMs: Number.isFinite(j.thinkingDurationMs) ? j.thinkingDurationMs : null, semTexto: !corpo.texto }); marca = { classe: 'pensou', t }; }
        else if (b.type === 'text') { const corpo = limpo(String(b.text || '')); if (!corpo.texto) continue; novo('respondeu', t, { resumo: primeiraLinha(corpo.texto), texto: corpo.texto, cortado: corpo.cortado }); ultimaResposta = String(b.text || ''); marca = { classe: j.message.stop_reason === 'end_turn' ? 'fim' : 'texto', t }; }
        else if (b.type === 'tool_use') { usoDeFerramenta(b, t); marca = { classe: 'ferramenta', t }; }
      }
      return;
    }
    if (j.type !== 'user') return;
    if (Array.isArray(c) && c.some(b => b && b.type === 'tool_result')) {
      for (const b of c) if (b && b.type === 'tool_result') resultadoDeFerramenta(b, j, t);
      marca = { classe: 'entrada', t, porque: 'resultado' };
      return;
    }
    if (j.isMeta && !j.origin) return;
    const veio = chegada(c, j.origin && j.origin.kind ? j.origin : null, j, t, false);
    if (veio === 'fala') { pendentes.clear(); marca = { classe: 'entrada', t, porque: 'fala' }; }
    else if (veio === 'volta') marca = { classe: 'entrada', t, porque: 'volta' };
  }
  function consumir(linhas) { for (const l of linhas) { if (!l) continue; let j; try { j = JSON.parse(l); } catch { continue; } try { linha(j); } catch {  } } }

  function estado(agora) {
    const silencioMs = ultimaLinhaMs === null ? null : Math.max(0, agora - ultimaLinhaMs);
    const escolha = [...pendentes.values()].filter(e => e.tipo === 'perguntou').pop();
    if (escolha) return { nome: 'esperando', desde: escolha.t, porque: 'escolha', detalhe: escolha.resumo, ferramenta: null, silencioMs };
    const uso = [...pendentes.values()].pop();
    if (uso) return { nome: 'comando', desde: uso.t, porque: uso.tipo, detalhe: uso.resumo, ferramenta: uso.ferramenta, silencioMs };
    if (!marca) return { nome: '?', desde: null, porque: 'sem-leitura', detalhe: '', ferramenta: null, silencioMs };
    if (marca.classe === 'fim') {
      const ultima = String(ultimaResposta || '').split('\n').map(x => x.trim()).filter(Boolean).pop() || '';
      return temPergunta(ultima) ? { nome: 'esperando', desde: marca.t, porque: 'pergunta', detalhe: corta(mascarar(ultima), MAX_RESUMO).texto, ferramenta: null, silencioMs } : { nome: 'parada', desde: marca.t, porque: 'fim', detalhe: '', ferramenta: null, silencioMs };
    }
    return { nome: 'pensando', desde: marca.t, porque: marca.classe === 'entrada' ? marca.porque : marca.classe, detalhe: '', ferramenta: null, silencioMs };
  }
  function listaDestinos() {
    const linhaDe = (chave, nome, tipo, extra = {}) => {
      const d = dest.get(chave), env = d && d.ultimoEnvio, vol = d && d.ultimaVolta;
      const voltou = !!vol && (!env || ms(vol.t) >= ms(env.t)), aceso = !!env && env.turno === turnoAtual;
      return { chave, nome, tipo, aceso, selo: aceso ? env.selo : null, primeira: aceso ? env.resumo : '', t: env ? env.t : null, estado: voltou ? 'voltou' : env ? 'trabalhando' : 'parado', voltouEm: vol ? vol.t : null, semResposta: !!(d && d.duvidaAberta), voltouNoTurno: !!d && d.voltaTurno === turnoAtual, ...extra };
    };
    const lista = fixos.map(nome => linhaDe(nome, nome, nomesDeSessao.has(nome) ? 'sessao' : 'fixo')), vistos = new Set(fixos);
    for (const a of ajudantes.values()) {
      if (a.destino) continue;
      const chave = 'aj:' + a.id, d = dest.get(chave), noTurno = !!d && ((d.ultimoEnvio && d.ultimoEnvio.turno === turnoAtual) || d.voltaTurno === turnoAtual);
      if (!a.vivo && !noTurno) continue;
      vistos.add(chave);
      const l = linhaDe(chave, a.nome, 'ajudante', { vivo: a.vivo, desde: a.desde });
      if (a.vivo) l.estado = 'trabalhando'; else { l.estado = 'voltou'; l.voltouEm = a.voltouEm || l.voltouEm; }
      lista.push(l);
    }
    for (const [chave, d] of dest) {
      if (vistos.has(chave) || chave.startsWith('aj:') || chave === 'tarefa') continue;
      if (!((d.ultimoEnvio && d.ultimoEnvio.turno === turnoAtual) || d.voltaTurno === turnoAtual)) continue;
      lista.push(linhaDe(chave, d.nome, d.tipo));
    }
    return lista;
  }
  function resumo(agora = Date.now()) {
    const c = contaDe(turnoAtual);
    const ditas = eventos.filter(e => e.tipo === 'fala').slice(-MAX_FALAS).map(e => ({ t: e.t, texto: e.texto, estado: 'chegou', noMeio: !!e.noMeio, daEscolha: !!e.daEscolha, imagens: e.imagens || 0, cortado: e.cortado, maisNova: false }));
    const naFila = filaPendente.filter(x => !/^\s*(<|Another Claude session)/.test(x.texto)).map(x => { const corpo = limpo(x.texto, MAX_FALA); return { t: x.t, texto: corpo.texto, estado: 'fila', noMeio: true, daEscolha: false, imagens: 0, cortado: corpo.cortado, maisNova: false }; });
    const falas = [...ditas, ...naFila].slice(-MAX_FALAS);
    if (falas.length) falas[falas.length - 1].maisNova = true;
    return {
      estado: estado(agora),
      turno: { id: turnoAtual, inicio: c.inicio, pensamentos: c.pensamentos, comandos: c.comandos, leituras: c.leituras, envios: c.envios, telas: c.telas, voltas: c.voltas },
      turnos: [...turnos.values()].filter(x => x.passos > 0).map(x => ({ ...x })),
      falas, destinos: listaDestinos(), ultimaLinha: ultimaLinhaMs === null ? null : new Date(ultimaLinhaMs).toISOString()
    };
  }
  const publico = e => { const { usoId, destinoFixo, ...resto } = e; return resto; };
  return { consumir, eventos: () => eventos.map(publico), desde: v => ({ versao, eventos: eventos.filter(e => e.v > v).map(publico) }), versao: () => versao, resumo };
}

function carregarDestinos(arquivo) {
  try { const j = JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '')); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch { return null; }
}

module.exports = { criarLeitor, criarCauda, carregarDestinos, temPergunta, ARQUIVO_DESTINOS: path.join(__dirname, 'dados', 'cru-destinos.json') };
