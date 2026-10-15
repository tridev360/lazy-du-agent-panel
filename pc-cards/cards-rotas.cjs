'use strict';
// Rotas HTTP do modulo de cards (itens 72 e 100). O integrador monta assim, no servidor da Home:
//   const cards = require('<esta pasta>/cards-rotas.cjs').criarRotasCards({ porta: 3296, cardsDir, dadosDir });
//   ... no handler:  if (cards.handle(req, res)) return;
// Rotas: GET /api/pc-cards/lista · POST /api/pc-cards/responder · POST /api/pc-cards/passo
//        GET /api/pc-cards/miniatura/<arquivo> · GET /pc-cards/pc-cards.js · GET /pc-cards/pc-cards.css
// Clique so da propria pagina: Host e Origin locais da porta, Sec-Fetch-Site same-origin, JSON e token por processo.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const N = require('./cards-nucleo.cjs');

const MENSAGEM = {
  mudou: 'Este card mudou desde que você abriu. Veja de novo e escolha.',
  'ja-respondido': 'Este card já tinha resposta.',
  'so-no-chat': 'Assunto restrito: este card vale só no chat.',
  'sem-opcoes': 'Este card não tem opção para clicar: responda no chat.',
  'id-repetido': 'Há dois cards iguais: responda no chat para não errar.',
  'id-invalido': 'Este card está com defeito: responda no chat.',
  ocupado: 'O card está sendo gravado por outro painel. Tente de novo.',
  hora: 'Não consegui marcar a hora. Tente de novo.',
  sumiu: 'Este card saiu da pasta.',
  'passos-faltando': 'Falta marcar algum passo como feito.',
  invalido: 'Não consegui gravar. Solução: confira permissão de escrita na pasta de estado e espaço no disco.',
  gravar: 'Não consegui gravar. Solução: confira permissão de escrita na pasta de estado e espaço no disco.'
};

function criarRotasCards(op = {}) {
  const porta = Number(op.porta);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw Error('porta invalida');
  const cardsDir = N.pastaSegura(op.cardsDir);
  const dadosDir = path.resolve(op.dadosDir || path.join(__dirname, 'dados'));
  fs.mkdirSync(dadosDir, { recursive: true });
  const hosts = new Set(op.hosts || [`127.0.0.1:${porta}`, `localhost:${porta}`]);
  const origens = new Set(op.origens || [`http://127.0.0.1:${porta}`, `http://localhost:${porta}`]);
  const token = crypto.randomBytes(24).toString('hex');
  const hora = typeof op.horaGetDate === 'function' ? op.horaGetDate : N.horaGetDate;
  const fonte3250 = op.pedidos3250 === false ? null : (op.pedidos3250 || 'http://127.0.0.1:3257');
  const mostrarExemplo = op.mostrarExemplo === true;
  const modo = op.modo || 'real';
  const estaticos = { '/pc-cards/pc-cards.js': ['pc-cards.js', 'text/javascript'], '/pc-cards/pc-cards.css': ['pc-cards.css', 'text/css'] };
  let cache = { em: 0, dados: null };

  function enviar(res, status, dados, tipo = 'application/json') {
    res.writeHead(status, { 'Content-Type': tipo + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(tipo === 'application/json' ? JSON.stringify(dados) : dados);
  }
  function mesmaPagina(req) {
    if (!origens.has(req.headers.origin)) return false;
    const atendimento = req.headers['sec-fetch-site'];
    if (atendimento !== undefined && atendimento !== 'same-origin') return false;
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    return ct === 'application/json' && req.headers['x-pc-cards-token'] === token;
  }
  async function corpo(req, limite = 2048) {
    const partes = []; let tam = 0;
    for await (const p of req) { tam += p.length; if (tam > limite) throw N.erro('invalido'); partes.push(p); }
    const j = JSON.parse(Buffer.concat(partes).toString('utf8'));
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw N.erro('invalido');
    return j;
  }

  // arquivo na hora, sem cache e sem pedir o /api/estado inteiro por HTTP. Sem ele, o caminho antigo (3250 por HTTP, 60 s).
  function itensDe(lista) {
    return (Array.isArray(lista) ? lista : []).slice(0, 20).map(n => ({
      id: String(n.id || ''),
      titulo: N.limpar(n.title, 240),
      detalhe: N.limpar(n.detail, 900),
      ondeResponder: N.limpar(n.replyWhere, 60) || '',
      opcoes: (Array.isArray(n.opcoes) ? n.opcoes : []).slice(0, 6).map(o => ({ label: N.limpar(o && o.label, 120), recomendada: !!(o && o.recommended) })).filter(o => o.label)
    })).filter(i => i.titulo);
  }
  // Pedidos do ESCOLHAS vindos da 3250 (so leitura, 1 vez por minuto no maximo e so com a pagina aberta).
  function pedidos() {
    if (typeof op.pedidosLocal === 'function') {
      try {
        const lista = op.pedidosLocal(); const d = new Date();
        if (lista === null) return Promise.resolve({ ok: false, motivo: 'Não consegui ler a lista de pedidos agora.' });
        return Promise.resolve({ ok: true, lidoEm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), itens: itensDe(lista) });
      } catch { return Promise.resolve({ ok: false, motivo: 'Não consegui ler a lista de pedidos agora.' }); }
    }
    if (!fonte3250) return Promise.resolve(null);
    if (cache.dados && Date.now() - cache.em < (cache.dados.ok ? 60000 : 15000)) return Promise.resolve(cache.dados);
    return new Promise(resolve => {
      const fim = dados => { cache = { em: Date.now(), dados }; resolve(dados); };
      let url; try { url = new URL('/api/estado', fonte3250); } catch { return fim({ ok: false, motivo: 'Endereço do painel inválido.' }); }
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return fim({ ok: false, motivo: 'Endereço do painel fora desta máquina.' });
      const req = http.get({ host: url.hostname, port: url.port, path: url.pathname, headers: { Host: url.host, Accept: 'application/json' }, timeout: 8000 }, res => {
        const partes = []; let tam = 0;
        res.on('data', p => { tam += p.length; if (tam > 32 * 1024 * 1024) { req.destroy(); } else partes.push(p); });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) throw Error();
            const j = JSON.parse(Buffer.concat(partes).toString('utf8'));
            const lista = Array.isArray(j.needsAll) ? j.needsAll : Array.isArray(j.needsItems) ? j.needsItems : [];
            const itens = itensDe(lista);
            const d = new Date();
            fim({ ok: true, lidoEm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), itens });
          } catch { fim({ ok: false, motivo: 'O painel não respondeu agora.' }); }
        });
        res.on('error', () => fim({ ok: false, motivo: 'O painel não respondeu agora.' }));
      });
      req.on('timeout', () => req.destroy());
      req.on('error', () => fim({ ok: false, motivo: 'O painel não respondeu agora.' }));
    });
  }

  let aquecido = false;
  async function lista(res) {
    // alguem abriu a tela: o PowerShell do Get-Date sobe agora para o clique nao esperar ~3 s
    if (!aquecido && typeof op.horaGetDate !== 'function') { aquecido = true; N.horaGetDate().catch(() => { aquecido = false; }); }
    const agora = new Date();
    const l = N.montarLista({ cardsDir, dadosDir, agora, mostrarExemplo });
    if(op.somenteChatPerigoso)for(const card of l.pendentes)if(card.perigoso){card.bloqueado=true;card.motivo='Decisão perigosa: responda no chat e confira a prova antes de agir.';}
    const p = await pedidos();
    enviar(res, 200, { ok: true, modo, token, lidoEm: String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0'), ...l, pedidos: p });
  }

  async function responder(req, res) {
    let h = null, pedido = {};
    try {
      pedido = await corpo(req);
      const chaves = Object.keys(pedido);
      if (chaves.some(k => !['arquivo', 'versao', 'opcao', 'feito'].includes(k))) throw N.erro('invalido');
      h = await hora().catch(() => { throw N.erro('hora'); });
      const r = N.gravarResposta({ cardsDir, dadosDir, pedido, hora: h, somenteChatPerigoso:op.somenteChatPerigoso });
      N.registrar(dadosDir, h, 'responder', pedido.arquivo, pedido.feito === true ? 'tudo feito' : `${r.escolha}: ${r.resposta}`, 'ok, backup ' + r.backup + (r.recado ? ', recado ' + r.recado.id : ', SEM recado'));
      enviar(res, 200, { ok: true, resposta: r.resposta, respondido: r.respondido, respondidoEm: r.respondidoEm, hora: r.respondidoEm.slice(11, 16), sessao: r.sessao, recado: !!r.recado, perigoso: r.perigoso, avisoPerigo: r.avisoPerigo });
    } catch (e) {
      const codigo = e && e.codigo && MENSAGEM[e.codigo] ? e.codigo : 'gravar';
      N.registrar(dadosDir, h, 'responder', typeof pedido.arquivo === 'string' ? pedido.arquivo.slice(0, 120) : '-', pedido.feito === true ? 'tudo feito' : `opcao ${pedido.opcao}`, 'recusado ' + codigo);
      enviar(res, 409, { ok: false, erro: codigo, mensagem: MENSAGEM[codigo] });
    }
  }

  async function passo(req, res) {
    let h = null, pedido = {};
    try {
      pedido = await corpo(req);
      if (Object.keys(pedido).some(k => !['arquivo', 'chave', 'passo', 'feito'].includes(k))) throw N.erro('invalido');
      h = await hora().catch(() => { throw N.erro('hora'); });
      const r = N.marcarPasso({ cardsDir, dadosDir, pedido, hora: h, somenteChatPerigoso:op.somenteChatPerigoso });
      N.registrar(dadosDir, h, 'passo', pedido.arquivo, `passo ${pedido.passo + 1} ${pedido.feito ? 'feito' : 'desfeito'}`, 'ok');
      enviar(res, 200, { ok: true, ...r });
    } catch (e) {
      const codigo = e && e.codigo && MENSAGEM[e.codigo] ? e.codigo : 'gravar';
      N.registrar(dadosDir, h, 'passo', typeof pedido.arquivo === 'string' ? pedido.arquivo.slice(0, 120) : '-', `passo ${pedido.passo}`, 'recusado ' + codigo);
      enviar(res, 409, { ok: false, erro: codigo, mensagem: MENSAGEM[codigo] });
    }
  }

  function miniatura(res, nome) {
    try {
      if (!/^[\w][\w.-]{0,80}\.(?:png|jpe?g|webp)$/i.test(nome)) return enviar(res, 404, { ok: false });
      const base = fs.realpathSync(path.join(cardsDir, 'miniaturas'));
      const alvo = path.join(base, nome), st = fs.lstatSync(alvo);
      if (st.isSymbolicLink() || !st.isFile() || st.size > 2 * 1024 * 1024 || path.dirname(fs.realpathSync(alvo)) !== base) return enviar(res, 404, { ok: false });
      const tipo = /\.png$/i.test(nome) ? 'image/png' : /\.webp$/i.test(nome) ? 'image/webp' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(fs.readFileSync(alvo));
    } catch { enviar(res, 404, { ok: false }); }
  }

  function handle(req, res) {
    let url; try { url = new URL(req.url, 'http://127.0.0.1'); } catch { return false; }
    const p = url.pathname;
    if (!p.startsWith('/api/pc-cards/') && !Object.hasOwn(estaticos, p)) return false;
    if (!hosts.has(req.headers.host)) { enviar(res, 403, { ok: false, erro: 'so local' }); return true; }
    if (req.method === 'GET' && Object.hasOwn(estaticos, p)) {
      const [arq, tipo] = estaticos[p];
      try { enviar(res, 200, fs.readFileSync(path.join(__dirname, arq)), tipo); } catch { enviar(res, 503, { ok: false }); }
      return true;
    }
    if (req.method === 'GET' && p === '/api/pc-cards/lista') {
      if (req.headers.origin && !origens.has(req.headers.origin)) { enviar(res, 403, { ok: false }); return true; }
      lista(res).catch(() => enviar(res, 503, { ok: false, mensagem: 'Não consegui ler os cards agora.' }));
      return true;
    }
    if (req.method === 'GET' && p.startsWith('/api/pc-cards/miniatura/')) {
      let nome = ''; try { nome = decodeURIComponent(p.slice('/api/pc-cards/miniatura/'.length)); } catch { nome = ''; }
      miniatura(res, nome); return true;
    }
    if (req.method === 'POST' && (p === '/api/pc-cards/responder' || p === '/api/pc-cards/passo')) {
      if (!mesmaPagina(req)) {
        N.registrar(dadosDir, null, p.endsWith('passo') ? 'passo' : 'responder', '-', 'pedido de fora da pagina', 'recusado origem');
        enviar(res, 403, { ok: false, erro: 'origem', mensagem: 'Clique só vale de dentro do painel.' });
        return true;
      }
      (p.endsWith('passo') ? passo(req, res) : responder(req, res)).catch(() => enviar(res, 500, { ok: false, mensagem: MENSAGEM.gravar }));
      return true;
    }
    enviar(res, 404, { ok: false });
    return true;
  }

  return { handle, token };
}

module.exports = { criarRotasCards };
