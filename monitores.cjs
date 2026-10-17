'use strict';
// Checagens locais configuráveis, com estado público resumido.
const fs = require('node:fs'), path = require('node:path');
const http = require('node:http'), https = require('node:https'), cp = require('node:child_process');
const segredo = /key|token|secret|auth|senha|password|sig/i;
// segmento de caminho com cara de chave (20 ou mais letras e numeros misturados, como /v2/<chave> dos provedores)
const chaveNoCaminho = u => u.pathname.split('/').some(p => /^[A-Za-z0-9_-]{20,}$/.test(p) && /[A-Za-z]/.test(p) && /\d/.test(p));
const texto = (s, max = 80) => typeof s === 'string' && s.trim() && s.length <= max && !/[\x00-\x1f\x7f]/.test(s);
const limite = (n, padrao, max) => n === undefined ? padrao : Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
const nomeArquivo = s => path.basename(s.replace(/\\/g, '/'));
function endereco(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u : null; } catch { return null; }
}
function preparar(item, index) {
  const x = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
  const id = typeof x.id === 'string' && /^[a-z0-9-]+$/.test(x.id) ? x.id : 'monitor-' + (index + 1);
  const nome = texto(x.nome) ? x.nome.trim() : 'Monitor ' + (index + 1);
  const tipo = ['http', 'comando', 'batimento'].includes(x.tipo) ? x.tipo : '?';
  const c = { id, nome, tipo, via: '', erro: '', original: JSON.stringify(item) };
  if (id !== x.id || !texto(x.nome) || tipo === '?') c.erro = 'configuração inválida';
  if (tipo === 'http') {
    c.timeoutMs = limite(x.timeoutMs, 5000, 15000);
    if (!c.timeoutMs) c.erro = 'timeout inválido';
    c.esperar = x.esperar;
    if (x.esperar !== undefined && !(Number.isInteger(x.esperar) && x.esperar >= 100 && x.esperar <= 599)) c.erro = 'status esperado inválido';
    if (x.urlEnv !== undefined) {
      if (typeof x.urlEnv !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(x.urlEnv) || x.url !== undefined) c.erro = 'configuração inválida';
      else { c.urlEnv = x.urlEnv; c.via = 'variável ' + x.urlEnv; }
    } else {
      const u = typeof x.url === 'string' ? endereco(x.url) : null;
      if (!u) c.erro = 'URL inválida';
      else {
        c.via = u.host;
        if (u.username || u.password || [...u.searchParams.keys()].some(k => segredo.test(k)) || chaveNoCaminho(u)) c.erro = 'use urlEnv';
        else c.url = u.href;
      }
    }
  } else if (tipo === 'comando') {
    c.timeoutMs = limite(x.timeoutMs, 10000, 30000);
    if (!texto(x.comando, 4096) || !Array.isArray(x.args) || !x.args.every(s => typeof s === 'string' && !s.includes('\0')) || !c.timeoutMs) c.erro = 'configuração inválida';
    else { c.comando = x.comando; c.args = x.args; c.via = nomeArquivo(x.comando); }
  } else if (tipo === 'batimento') {
    c.maxIdadeSegundos = limite(x.maxIdadeSegundos, 300, Number.MAX_SAFE_INTEGER);
    if (!texto(x.arquivo, 4096) || !c.maxIdadeSegundos) c.erro = 'configuração inválida';
    else { c.arquivo = x.arquivo; c.via = nomeArquivo(x.arquivo); }
  }
  return c;
}
const semResposta = ms => 'sem resposta em ' + Math.ceil(ms / 1000) + ' s';
function checarHttp(c, pendentes) {
  // A URL da variável só existe nesta chamada. Erros de rede nunca são publicados.
  const u = endereco(c.urlEnv ? process.env[c.urlEnv] : c.url);
  if (!u) return Promise.resolve({ status: '?', motivo: c.urlEnv ? 'variável ausente ou URL inválida' : 'URL inválida' });
  return new Promise(resolve => {
    let atual, encerrado = false;
    const fim = (status, motivo) => {
      if (encerrado) return;
      encerrado = true; clearTimeout(timer); pendentes.delete(cancelar); atual?.destroy(); resolve({ status, motivo });
    };
    const cancelar = () => fim('?', 'checagem interrompida');
    const timer = setTimeout(() => fim('caiu', semResposta(c.timeoutMs)), c.timeoutMs); timer.unref();
    pendentes.add(cancelar);
    function pedir(url, saltos) {
      try {
        atual = (url.protocol === 'https:' ? https : http).get(url, { agent: false }, res => {
          const codigo = res.statusCode, location = res.headers.location;
          res.destroy();
          if ([301, 302, 303, 307, 308].includes(codigo) && location) {
            if (saltos >= 3) return fim('caiu', 'mais de 3 redirecionamentos');
            let next; try { next = endereco(new URL(location, url).href); } catch {}
            if (!next) return fim('?', 'redirecionamento inválido');
            // so segue no mesmo host e porta (http 80 para https 443 no mesmo host vale); outro endereco nunca recebe a checagem
            const porta = u => u.port || (u.protocol === 'https:' ? '443' : '80'), subiu = url.protocol === 'http:' && next.protocol === 'https:' && porta(url) === '80' && porta(next) === '443';
            if (next.hostname !== url.hostname || (porta(next) !== porta(url) && !subiu) || (url.protocol === 'https:' && next.protocol !== 'https:')) return fim('?', 'redirecionamento para outro endereço');
            pedir(next, saltos + 1); return;
          }
          fim(c.esperar === undefined ? codigo >= 200 && codigo <= 399 ? 'ok' : 'caiu' : codigo === c.esperar ? 'ok' : 'caiu', 'HTTP ' + codigo);
        });
        atual.on('error', () => fim('caiu', 'sem resposta'));
      } catch { fim('?', 'URL inválida'); }
    }
    pedir(u, 0);
  });
}
// Mata o comando e o que ele abriu (no Windows pelo taskkill da arvore; fora dele pelo grupo do processo).
// No Windows o child.kill espera o taskkill: com o comando ja morto, o taskkill nao acha os processos que ele abriu.
function matar(child) {
  if (!child || !child.pid) return;
  for (const stream of [child.stdout, child.stderr]) { try { stream?.destroy(); } catch {} }
  const resto = () => { try { child.kill('SIGKILL'); } catch {} };
  if (process.platform === 'win32') { try { cp.execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 }, resto); return; } catch {} }
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  resto();
}
function checarComando(c, pendentes) {
  return new Promise(resolve => {
    let child, timer, terminou = false;
    const fim = (status, motivo) => { if (terminou) return; terminou = true; clearTimeout(timer); pendentes.delete(cancelar); resolve({ status, motivo }); };
    const cancelar = () => { matar(child); fim('?', 'checagem interrompida'); };
    try {
      // spawn e nao execFile: o execFile ignora o detached, e sem grupo proprio o kill do grupo nao acha os netos fora do Windows.
      // A saida e descartada desde o comeco (stdio ignore): nenhum processo de fundo segura a checagem por um fluxo aberto.
      child = cp.spawn(c.comando, c.args, { shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: 'ignore' });
      child.once('error', () => fim('?', 'não foi possível executar'));
      // exit: o fim do proprio comando decide a checagem
      child.once('exit', code => { for (const stream of [child.stdout, child.stderr]) { try { stream?.destroy(); } catch {} } fim(code !== 0 ? 'caiu' : 'ok', Number.isInteger(code) ? 'código ' + code : 'comando interrompido'); });
      // no timeout a checagem termina na hora, sem esperar o processo sair
      timer = setTimeout(() => { fim('caiu', semResposta(c.timeoutMs)); matar(child); }, c.timeoutMs); timer.unref();
      pendentes.add(cancelar);
    } catch { fim('?', 'não foi possível executar'); }
  });
}
async function checarBatimento(c, root) {
  try {
    const s = await fs.promises.stat(path.resolve(root, c.arquivo));
    if (!s.isFile()) return { status: '?', motivo: 'arquivo inválido' };
    const idade = Math.max(0, Math.floor((Date.now() - s.mtimeMs) / 1000));
    return { status: idade <= c.maxIdadeSegundos ? 'ok' : 'caiu', motivo: idade < 60 ? 'arquivo com ' + idade + ' s' : 'arquivo com ' + Math.floor(idade / 60) + ' min' };
  } catch { return { status: '?', motivo: 'arquivo sem leitura' }; }
}
function create({ root = process.env.PAINEL_ROOT || path.join(__dirname, 'estado-local'), configPath = process.env.PAINEL_MONITORES || path.join(__dirname, 'config', 'monitores.json') } = {}) {
  let versao, configs = [], estados = [], intervaloSegundos = 60, lidoEm = null;
  let timer, rodando, iniciado = false, fechado = false;
  const pendentes = new Set();
  function carregar() {
    let marca, data;
    try { const s = fs.statSync(configPath); marca = s.mtimeMs + ':' + s.ctimeMs + ':' + s.size; }
    catch (e) { marca = e.code === 'ENOENT' ? 'ausente' : 'erro'; }
    if (marca === versao) return;
    versao = marca;
    try {
      if (marca === 'ausente') data = {};
      else { const raw = fs.readFileSync(configPath, 'utf8').trim(); data = raw ? JSON.parse(raw) : {}; }
      if (!data || typeof data !== 'object' || Array.isArray(data) || (data.monitores !== undefined && !Array.isArray(data.monitores))) throw Error();
      intervaloSegundos = Math.max(60, Number.isFinite(data.intervaloSegundos) ? data.intervaloSegundos : 60);
      const anteriores = configs, velhos = estados, ids = new Set();
      configs = (data.monitores || []).map(preparar);
      estados = configs.map(c => {
        if (ids.has(c.id)) c.erro = 'id repetido';
        ids.add(c.id);
        const i = anteriores.findIndex(x => x.original === c.original && x.erro === c.erro);
        return i >= 0 ? velhos[i] : { id: c.id, nome: c.nome, tipo: c.tipo, status: '?', lidoEm: null, duracaoMs: null, desde: new Date().toISOString(), motivo: c.erro || 'aguardando checagem', via: c.via };
      });
    } catch {
      intervaloSegundos = 60;
      configs = [{ id: 'configuracao', nome: 'Configuração dos monitores', tipo: '?', erro: 'configuração sem leitura', via: '' }];
      estados = [{ id: 'configuracao', nome: 'Configuração dos monitores', tipo: '?', status: '?', lidoEm: null, duracaoMs: null, desde: new Date().toISOString(), motivo: 'configuração sem leitura', via: '' }];
    }
    lidoEm = null;
    clearTimeout(timer); timer = undefined;
  }
  function agendar(ms) {
    if (!iniciado || fechado || timer || rodando || !configs.length) return;
    // setTimeout tem limite inteiro de 32 bits; intervalos longos são limitados aqui.
    timer = setTimeout(async () => { timer = undefined; await check(); agendar(intervaloSegundos * 1000); }, Math.min(ms, 2147483647)); timer.unref();
  }
  function snapshot() {
    if (!fechado) { carregar(); agendar(lidoEm ? intervaloSegundos * 1000 : 0); }
    return { ok: true, configurado: estados.length > 0, intervaloSegundos, lidoEm, monitores: estados.map(x => ({ ...x })) };
  }
  function check() {
    if (fechado) return Promise.resolve(snapshot());
    if (rodando) return rodando;
    carregar();
    clearTimeout(timer); timer = undefined;
    const rodada = configs, marca = versao;
    rodando = (async () => {
      for (let i = 0; i < rodada.length && !fechado && marca === versao; i++) {
        const c = rodada[i], inicio = Date.now();
        const r = c.erro ? { status: '?', motivo: c.erro } : c.tipo === 'http' ? await checarHttp(c, pendentes) : c.tipo === 'comando' ? await checarComando(c, pendentes) : await checarBatimento(c, root);
        if (fechado || marca !== versao) break;
        const at = new Date().toISOString(), anterior = estados[i];
        estados[i] = { ...anterior, ...r, lidoEm: at, duracaoMs: Date.now() - inicio, desde: r.status === anterior.status ? anterior.desde : at };
      }
      if (rodada.length && marca === versao && !fechado) lidoEm = new Date().toISOString();
    })().finally(() => { rodando = null; agendar(intervaloSegundos * 1000); });
    return rodando;
  }
  function start() { if (fechado) return; iniciado = true; carregar(); agendar(lidoEm ? intervaloSegundos * 1000 : 0); }
  function close() { fechado = true; iniciado = false; clearTimeout(timer); timer = undefined; for (const cancelar of [...pendentes]) cancelar(); }
  return { snapshot, check, start, close };
}
// Exemplo ficticio com horas relativas a agora (o caido ha 3 min, contando de agora ou da leitura).
function exemplo(agora = Date.now()) {
  const iso = ms => new Date(agora - ms).toISOString(), lidoEm = iso(8000);
  return { ok: true, configurado: true, intervaloSegundos: 60, lidoEm, monitores: [
    { id: 'robo-compras', nome: 'Robô de compras', tipo: 'batimento', status: 'ok', lidoEm, duracaoMs: 1, desde: iso(3600000), motivo: 'arquivo com 8 s', via: 'compras.pulso' },
    { id: 'api-exemplo', nome: 'API de exemplo', tipo: 'http', status: 'ok', lidoEm, duracaoMs: 12, desde: iso(3600000), motivo: 'HTTP 200', via: 'variável STATUS_URL' },
    { id: 'servidor-testes', nome: 'Servidor de testes', tipo: 'comando', status: 'caiu', lidoEm, duracaoMs: 10000, desde: iso(188000), motivo: 'sem resposta em 10 s', via: 'ssh' }
  ] };
}
module.exports = { create, exemplo };
