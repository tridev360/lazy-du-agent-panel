'use strict';
// COLETOR DOS TOKENS DA ULTIMA HORA: soma o consumo de tokens da ultima hora do Claude Code e do Codex e grava
// estado/tokens-hora.json dentro da pasta de estado do painel. A tela do WEN (bloco "Uso de cada IA") so le esse arquivo.
// Le os mesmos registros de sessao que o painel ja le, guarda so numeros (usage e token_count) e nunca imprime texto de conversa.
// Nada vai para a rede. Uso: node tokens-hora-coletor.cjs   (sua IA pode rodar a cada 15 min; com mais de 20 min a tela mostra "?")
//   Claude: soma message.usage das respostas da ultima hora (entrada, saida e cache); a mesma resposta repetida no streaming conta 1 vez.
//   Codex : diferenca do contador acumulado (total_token_usage) dentro da hora; sem contador, soma last_token_usage.
// Grava {atualizado, claude_total, claude_sem_cache, codex_total, codex_sem_cache}; o que nao foi lido vira null e a tela mostra "?".
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

const CAUDA = 16 * 1024 * 1024;
const num = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
function cauda(file) {
  let fd; try {
    const st = fs.statSync(file), ini = Math.max(0, st.size - CAUDA), buf = Buffer.alloc(st.size - ini);
    fd = fs.openSync(file, 'r'); fs.readSync(fd, buf, 0, buf.length, ini);
    let t = buf.toString('utf8'); if (ini > 0) t = t.slice(t.indexOf('\n') + 1); return t;
  } catch { return null; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* fechado */ } }
}
const linhas = (texto, marca) => texto.split('\n').filter(l => l.includes(marca)).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

function somarClaude(arquivos, ini, fim) {
  const porId = new Map(); let lidos = 0;
  for (const f of arquivos) {
    const t = cauda(f); if (t === null) continue; lidos++;
    linhas(t, '"usage"').forEach((r, i) => {
      if (!r || r.type !== 'assistant' || !r.message || !r.message.usage) return;
      const ms = Date.parse(r.timestamp); if (!Number.isFinite(ms) || ms < ini || ms > fim) return;
      const u = r.message.usage, semCache = num(u.input_tokens) + num(u.output_tokens), total = semCache + num(u.cache_read_input_tokens) + num(u.cache_creation_input_tokens);
      const chave = r.message.id ? 'id:' + r.message.id : f + ':' + i, ant = porId.get(chave);
      if (!ant || total >= ant.total) porId.set(chave, { total, semCache });
    });
  }
  if (!lidos) return null;
  let total = 0, semCache = 0; for (const v of porId.values()) { total += v.total; semCache += v.semCache; }
  return { total, semCache };
}
function somarCodex(arquivos, ini, fim) {
  let total = 0, cache = 0, lidos = 0;
  for (const f of arquivos) {
    const t = cauda(f); if (t === null) continue; lidos++;
    let base = null, topo = null, soltos = 0, soltosCache = 0;
    for (const r of linhas(t, '"token_count"')) {
      const p = r && r.payload; if (!p || p.type !== 'token_count' || !p.info) continue;
      const ms = Date.parse(r.timestamp); if (!Number.isFinite(ms) || ms > fim) continue;
      const acc = p.info.total_token_usage, ult = p.info.last_token_usage;
      if (acc && typeof acc.total_tokens === 'number') {
        const v = { t: num(acc.total_tokens), c: num(acc.cached_input_tokens) };
        if (ms < ini) base = v; else if (!topo || v.t >= topo.t) topo = v;
      } else if (ult && ms >= ini) { soltos += num(ult.total_tokens); soltosCache += num(ult.cached_input_tokens); }
    }
    if (topo) { total += Math.max(0, topo.t - (base ? base.t : 0)); cache += Math.max(0, topo.c - (base ? base.c : 0)); }
    total += soltos; cache += soltosCache;
  }
  if (!lidos) return null;
  return { total, semCache: Math.max(0, total - cache) };
}
function coletar({ home = process.env.PAINEL_HOME || os.homedir(), estado = process.env.PAINEL_ROOT || path.join(__dirname, 'estado-local'), now = Date.now(), minutos = 60 } = {}) {
  const ini = now - minutos * 60000, fim = now + 2 * 60000;
  let fontes = null; try { fontes = require('./descoberta.cjs').sources(home); } catch { fontes = null; }
  // Ler tambem arquivos antigos prova zero na janela; ausencia ou recusa nao prova zero.
  const recentes = fam => fontes === null ? null : fontes.filter(s => s.family === fam).map(s => s.file);
  const rc = recentes('claude'), rx = recentes('codex');
  const c = rc === null ? null : somarClaude(rc, ini, fim), x = rx === null ? null : somarCodex(rx, ini, fim);
  const j = { atualizado: new Date(now).toISOString(), claude_total: c ? c.total : null, claude_sem_cache: c ? c.semCache : null, codex_total: x ? x.total : null, codex_sem_cache: x ? x.semCache : null };
  const dir = path.join(estado, 'estado'), alvo = path.join(dir, 'tokens-hora.json'), tmp = alvo + '.novo-' + process.pid;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(j) + '\n', 'utf8'); fs.renameSync(tmp, alvo); // escrita inteira: a tela nunca le o arquivo pela metade
  return j;
}
const textoTotal = n => n === null ? '?' : n === 0 ? 'none' : String(n);
module.exports = { coletar, somarClaude, somarCodex, textoTotal };
if (require.main === module) {
  try {
    const j = coletar(), d = new Date(Date.parse(j.atualizado));
    console.log('Tokens da última hora gravados às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ': Claude ' + textoTotal(j.claude_total) + ', Codex ' + textoTotal(j.codex_total) + '.');
  } catch { console.log('? não consegui gravar os tokens da última hora. Solução: confira se a pasta de estado do painel existe (estado-local ou PAINEL_ROOT).'); process.exitCode = 1; }
}
