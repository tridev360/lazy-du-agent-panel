'use strict';
// Demo parada no tempo: ao abrir, guarda a idade de cada arquivo do estado. Enquanto a demo roda, devolve essa idade:
// a hora de gravação do arquivo e os carimbos de hora dentro dos .json (atualizado, atualizadoEm, medidoEm, lidoEm...) andam junto com o relógio.
// Assim "parada há 34 min" segue 34 e nenhuma leitura passa do prazo e vira "?".
// Arquivo que alguém mudou com a demo aberta (um voto, uma resposta) fica como está e passa a valer a hora nova.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const soma = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const CARIMBO = /^(atualizado|atualizadoEm|medidoEm|lidoEm|readAt|geradoEm)$/;

function listar(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listar(p)); else if (e.isFile()) out.push(p);
  }
  return out;
}

// Soma "passo" ms a todo carimbo de hora do objeto; devolve quantos mudou.
function andar(v, passo) {
  let n = 0;
  if (Array.isArray(v)) { for (const x of v) n += andar(x, passo); return n; }
  if (!v || typeof v !== 'object') return 0;
  for (const [k, x] of Object.entries(v)) {
    if (CARIMBO.test(k) && typeof x === 'string' && Number.isFinite(Date.parse(x))) { v[k] = new Date(Date.parse(x) + passo).toISOString(); n++; }
    else n += andar(x, passo);
  }
  return n;
}

function congelar(root, { agora = Date.now } = {}) {
  let antes = agora();
  const fotos = listar(root).map(f => ({ f, idade: antes - fs.statSync(f).mtimeMs, soma: soma(f), json: f.endsWith('.json') }));
  const tique = () => {
    const t = agora(), passo = t - antes; antes = t;
    for (const x of fotos) {
      try {
        if (soma(x.f) !== x.soma) { x.idade = t - fs.statSync(x.f).mtimeMs; x.soma = soma(x.f); x.json = false; continue; }
        if (x.json) { const j = JSON.parse(fs.readFileSync(x.f, 'utf8')); if (andar(j, passo)) fs.writeFileSync(x.f, JSON.stringify(j, null, 2)); else x.json = false; }
        const m = new Date(t - x.idade); fs.utimesSync(x.f, m, m); x.soma = soma(x.f);
      } catch {}
    }
  };
  return { tique, arquivos: fotos.length };
}

module.exports = { congelar };
