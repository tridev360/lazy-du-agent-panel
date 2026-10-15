'use strict';
const fs = require('node:fs'), path = require('node:path');
const CAUDA = 256 * 1024, VELHA_MS = 2 * 3600000;
const TITULOS = [
  [/token meter/i, {pt:'Token meter',en:'Token meter',es:'Token meter'}],
  [/nomes seguem genericos|nomes do painel/i, {pt:'Nomes do painel',en:'Panel names',es:'Panel: nombres'}],
  [/acompanhar progresso de forma visual/i, {pt:'Progresso visual das IAs',en:'Visual AI progress',es:'Progreso visual de IA'}],
  [/itens 3 e 4 da analise do uso/i, {pt:'Marcha: uso do painel',en:'Panel workflow',es:'Marcha: uso del panel'}],
  [/ranking da mesa/i, {pt:'Gate do ranking',en:'Ranking checks',es:'Pruebas del ranking'}]
];
const ATIVIDADES = {
  start:{pt:'começando',en:'starting',es:'iniciando'},
  preparo:{pt:'preparando',en:'preparing',es:'preparando'},
  revisao:{pt:'conferindo',en:'reviewing',es:'revisando'},
  aplicacao:{pt:'aplicando',en:'applying',es:'aplicando'},
  foto:{pt:'vendo telas',en:'screen check',es:'ver pantallas'},
  testes:{pt:'testando',en:'testing',es:'probando'},
  testesVps:{pt:'testes na VPS',en:'VPS tests',es:'pruebas VPS'},
  card:{pt:'esperando o seu card',en:'waiting for your approval',es:'esperando tu aprobación'},
  restart:{pt:'reiniciando',en:'restarting',es:'reiniciando'}
};
function ler(root, relative, limit) {
  const file=path.join(root,relative), st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink())throw Error('Unavailable metadata');
  const ini=Math.max(0,st.size-limit), buf=Buffer.alloc(st.size-ini), fd=fs.openSync(file,'r');
  try{fs.readSync(fd,buf,0,buf.length,ini);}finally{fs.closeSync(fd);}
  const text=buf.toString('utf8');
  return ini?text.slice(text.indexOf('\n')+1):text;
}
function assuntos(root) {
  const map=new Map();
  for(const row of ler(root,'estado/fila-codex.md',4*1024*1024).split(/\r?\n/)) {
    const m=/^(\d{3})\.\s+/.exec(row); if(!m)continue;
    const entries=TITULOS.map(([pattern,names])=>({index:row.search(pattern),names})).filter(e=>e.index>=0).sort((a,b)=>a.index-b.index);
    if(entries.length)map.set(m[1],entries[0].names);
  }
  return map;
}
function momento(text,now) {
  const m=/\b(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(-0[23]:00|Z)/.exec(text);
  const at=m?Date.parse(m[1]+'T'+m[2]+m[3]):NaN;
  return Number.isFinite(at)&&at<=now+120000?at:null;
}
function atividade(tag) {
  if(/(?:^|-)(?:CARD|APROVACAO)(?:-|$)/.test(tag))return 'card';
  if(/(?:^|-)(?:TESTES|FOCAIS|GATE)(?:-|$)/.test(tag))return /(?:^|-)VPS(?:-|$)/.test(tag)?'testesVps':'testes';
  if(/^(?:REVISAO)/.test(tag))return 'revisao';
  if(/^(?:APLICACAO)/.test(tag))return 'aplicacao';
  if(/^(?:FOTO)/.test(tag))return 'foto';
  if(/^(?:RESTART)/.test(tag))return 'restart';
  return /^(?:START|RETOMA)/.test(tag)?'start':'preparo';
}
function frentes(root,now=Date.now()) {
  let texto,titles;try{texto=ler(root,'estado/codex.md',CAUDA);titles=assuntos(root);}catch{return{ok:false,lido:false};}
  const items=new Map();let blocoEm=null;
  const save=(n,next)=>{const old=items.get(n);if(!old||next.em>=old.em)items.set(n,next);};
  for(const row of texto.split(/\r?\n/)) {
    const head=/^\[([A-Z][A-Z0-9-]{2,120})(?:\s+\d{2}:\d{2})?\]/.exec(row);
    if(head) {
      blocoEm=momento(row.slice(head[0].length),now);
      const tag=head[1].replace(/-\d{8}(?:-\d{4,6})?$/,''), nums=[...tag.matchAll(/(?:^|[A-Z-])(\d{3})(?!\d)/g)].map(m=>m[1]);
      if(blocoEm!==null&&nums.length) {
        if(/^(?:FEITO|PRONTO|ENTREGA|CONCLUSAO|FALHA|CANCELADO|ABANDONADO|ROLLBACK)/.test(tag)||/(?:^|-)(?:REJEITADA|REJEITADO|ENCERRADO)(?:-|$)/.test(tag)) {
          for(const n of nums)save(n,{item:n,estado:'parou',em:blocoEm});
        } else if(/^(?:START|PEGUEI|REVISAO|APLICACAO|FOTO|PARCIAL|PREP|PREPARO|FREEZE|RESTART|RETOMA)/.test(tag)) {
          const n=nums[0],old=items.get(n),etapa=atividade(tag);
          save(n,{item:n,estado:etapa==='card'?'esperando':'rodando',em:blocoEm,desde:old&&old.estado==='rodando'?old.desde:blocoEm,etapa});
        }
      }
    }
    if(blocoEm===null)continue;
    for(const clause of row.split(/;/)) {
      if(/\?|\b(?:se|quando|somente|ainda|falta|nao|não)\b/i.test(clause))continue;
      const m=/(?:^|\.\s*)\s*(\d{3})\s*(?:pronto sem certifica[cç][aã]o visual pelo\d{3}|encerrado(?: antes de codigo\/carga| sem\s*codigo\/carga)?)(?=[.,]|$)/i.exec(clause.trim());
      if(m)save(m[1],{item:m[1],estado:'parou',em:blocoEm});
    }
  }
  const lista=[...items.values()].filter(f=>f.estado==='rodando'&&now-f.em<=VELHA_MS&&titles.has(f.item)).sort((a,b)=>b.em-a.em).slice(0,6)
    .map(f=>({item:f.item,estado:'rodando',nome:titles.get(f.item).pt,nomes:titles.get(f.item),etapa:f.etapa,atividades:ATIVIDADES[f.etapa],desde:new Date(f.desde).toISOString(),ultimaEm:new Date(f.em).toISOString()}));
  return{ok:true,lido:true,lidoEm:new Date(now).toISOString(),frentes:lista};
}
module.exports={frentes};
