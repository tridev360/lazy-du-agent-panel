'use strict';
// Conselho: uma ideia por vez, as 4 opções com a foto de quem votou em cada uma, a mesa reagindo e o placar.
const $ = id => document.getElementById(id);
const equipeNome = v => v === 'COORDENADOR' ? 'Planejamento' : v;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FOCO = { dinheiro: 'Dinheiro', holder: 'Holder', velocidade: 'Velocidade', referencias: 'Referências' };
const ORDEM = ['visionario', 'cetico', 'operador', 'cientista', 'filosofo', 'politico', 'economista', 'artista', 'advogado', 'cliente'];
const COR = { 1: 'var(--o1)', 2: 'var(--o2)', 3: 'var(--o3)', 4: 'var(--o4)' };
const NOME_OPCAO = { 1: 'Aceitar', 2: 'Aceitar com ressalva', 3: 'Só se', 4: 'Rejeitar' };
const SELO = { FAZER: ['FAZER', 'Aceita. Bora fazer.', 1], FAZER_COM_RESSALVAS: ['FAZER COM RESSALVA', 'Aceita, com o ajuste combinado.', 2], SO_SE: ['SÓ SE', 'Guardada até a condição ser cumprida.', 3], NAO: ['NÃO', 'Rejeitada. Abre espaço para a próxima.', 4] };
const ESPERA = 4500;
const PAIS = (() => { try { const o = (location.ancestorOrigins && location.ancestorOrigins[0]) || new URL(document.referrer).origin; if (o.startsWith('http://127.0.0.1:') || o.startsWith('http://localhost:')) return [o]; } catch (e) { /* sem painel: so o padrao */ } return ['http://127.0.0.1:3257', 'http://localhost:3257']; })();
let fila = [], revisao = [], mode = 'fila', score = null, current = null, busy = false, selected = null, filter = 'conselheiro';
let skipped = new Set(), reactions = new Map(), outcome = null, nextTimer = null, soundOn = false, motionOn = true, audioContext, animar = false;
// v4: fila por projeto, decisão em lote e equipe online.
let projeto = 'todos', projetosDef = [], equipe = null, confirmLote = null, loteOutcome = null, loteAviso = '';
const LOTE = {
  aceitar: { selo: 'LOTE ACEITO', op: 1, fim: 'aceitas. Ficam anotadas para o responsável pela equipe virar tarefa da equipe dona.' },
  rejeitar: { selo: 'LOTE REJEITADO', op: 4, fim: 'rejeitadas. Abre espaço para as próximas.' },
  depois: { selo: 'PARA DEPOIS', op: 3, fim: 'guardadas para depois.' },
};
const card = $('idea-card');

// Tema: igual ao do painel. Vem por ?tema= no endereço do iframe ou por mensagem do painel (3250).
function guardado(chave) { try { return localStorage.getItem(chave); } catch { return null; } }
function guardar(chave, v) { try { localStorage.setItem(chave, v); } catch { /* só nesta visita */ } }
function aplicarTema(t) { if (!['grade', 'livro', 'folha'].includes(t)) return; document.documentElement.dataset.theme = t; guardar('decidir-tema', t); }
aplicarTema((/[?&#]tema=(grade|livro|folha)\b/.exec(location.search + location.hash) || [])[1] || guardado('decidir-tema') || 'grade');
// Projeto da barra: ?projeto= no endereço ou o último escolhido neste aparelho (confere com a lista quando a fila chega).
projeto = (/[?&#]projeto=([a-z0-9-]+)/.exec(location.search + location.hash) || [])[1] || guardado('decidir-projeto') || 'todos';
window.addEventListener('message', e => {
  if (!PAIS.includes(e.origin) || !e.data || e.data.tipo !== 'painel-tema') return;
  aplicarTema(e.data.tema);
});
try { if (window.parent !== window) for (const o of PAIS) window.parent.postMessage({ tipo: 'decidir-pede-tema' }, o); } catch { /* fora do painel */ }

function announce(s) { $('announcement').textContent = s; }
function fail(e) { $('error').textContent = e.message; $('error').hidden = false; announce(e.message); }
function clearError() { $('error').hidden = true; }
async function api(url, input) {
  const r = await fetch(url, input === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.erro || 'Não foi possível concluir. Tente de novo.');
  return data;
}
const pessoa = id => score?.ranking.find(p => p.id === id) || { id, nome: id, arte: '', cor: '#888' };
function face(p, { cor = '', titulo = '', classe = '' } = {}) {
  const t = titulo || `${p.nome}${p.papel ? ', ' + p.papel : ''}`;
  return `<span class="face ${cor ? 'ring' : ''} ${classe}" ${cor ? `style="--fc:${cor}"` : ''} title="${esc(t)}">${p.arte ? `<img src="${esc(p.arte)}" alt="" width="64" height="64" loading="lazy">` : ''}</span>`;
}
function faceVazia(p) { return `<span class="face unknown" title="${esc(p.nome)}: ainda não votou">${p.arte ? `<img src="${esc(p.arte)}" alt="">` : ''}<span>?</span></span>`; }
function weight(o) {
  if (!o.marca) return '';
  return `<span class="weight ${o.marca === 'DETALHE' ? 'det' : 'imp'}" title="${o.marca === 'DETALHE' ? 'Detalhe: tanto faz, não muda o resultado' : 'Importante: muda o resultado, o risco ou o dinheiro'}">${esc(o.marca)} · ${esc(o.porque)}</span>`;
}
const doProjeto = id => fila.filter(i => i.projetoId === id);
const queue = () => mode === 'revisao' ? revisao : projeto === 'todos' ? fila : doProjeto(projeto);
const projetoAtual = () => projetosDef.find(p => p.id === projeto) || null;
const equipeDe = p => equipe?.sessoes?.[p.sessao] || { estado: '?', minutos: null };
function tempoTexto(min) {
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} dias`;
}
function statusTexto(e) {
  if (e.estado === 'online') return 'online agora';
  if (e.estado === 'parada') return `parada há ${tempoTexto(e.minutos)}`;
  if (e.estado === 'fechada') return `fechada há ${tempoTexto(e.minutos)}`;
  return 'sem leitura';
}
const dotClass = e => ({ online: 'on', parada: 'off', fechada: 'off' }[e.estado] || 'unknown');
// Mesma regra do servidor (planoDoLote): a tela mostra o que vai acontecer antes de confirmar.
function planoLote(acao) {
  const ideas = doProjeto(projeto);
  if (acao === 'rejeitar') return ideas.map(i => ({ ideia: i, opcao: 4 }));
  if (acao === 'depois') return ideas.map(i => ({ ideia: i, opcao: 3 }));
  return ideas.filter(i => [1, 2].includes(i.recomendado)).map(i => ({ ideia: i, opcao: i.recomendado === 2 && i.opcoes[1]?.texto ? 2 : 1 }));
}
function ordemProjetos() {
  const on = p => equipeDe(p).estado === 'online' ? 1 : 0, idx = p => projetosDef.indexOf(p);
  // Equipe online primeiro; dentro de cada grupo, ordem fixa (o botão não muda de lugar quando a contagem cai).
  return [...projetosDef].sort((a, b) => on(b) - on(a) || idx(a) - idx(b));
}
function pick(id) {
  const ideas = queue();
  current = ideas.find(i => i.id === id) || ideas.find(i => !skipped.has(i.id));
  if (!current && ideas.length) { skipped = new Set(); current = ideas[0]; }
  selected = null;
}
const votoDe = id => current?.votos.find(v => v.id === id);

function updateStats() {
  if (!score) return;
  const d = score.dono;
  $('today').textContent = d.decididasHoje;
  $('streak').textContent = d.sequencia;
  $('fila-count').textContent = fila.length;
  $('review-count').textContent = revisao.length;
  // "Meta" de 10 decisões por dia (não confundir com a decisão em lote por projeto).
  $('batch-label').textContent = `meta ${d.lote}/10`;
  $('batch-dots').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < d.lote ? 'on' : ''}"></i>`).join('');
  const conquista = d.filaZerada ? 'Conquista: fila zerada' : d.lotesCompletos ? `${d.lotesCompletos} meta${d.lotesCompletos > 1 ? 's' : ''} de 10 batida${d.lotesCompletos > 1 ? 's' : ''} hoje` : '';
  $('achievement').hidden = !conquista; $('achievement').textContent = conquista;
  $('undo-top').disabled = !score.ultima || busy;
  $('undo-top').innerHTML = score.ultima?.lote ? `Desfazer o lote (${score.ultima.lote.total}) <kbd>Z</kbd>` : 'Desfazer <kbd>Z</kbd>';
  document.querySelectorAll('[data-mode]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); b.disabled = busy; });
}

function renderReview() {
  $('review-panel').hidden = mode !== 'revisao';
  if (mode !== 'revisao') return;
  $('review-list').innerHTML = revisao.length ? revisao.map(i => {
    const nota = i.votos.find(v => v.posicao !== 'favor' && v.marca === 'IMPORTANTE') || i.votos.find(v => v.posicao !== 'favor');
    return `<button class="review-item" data-review-id="${esc(i.id)}" aria-pressed="${i.id === current?.id}" ${busy ? 'disabled' : ''}><strong>${esc(i.titulo)}</strong><span>${nota ? `${weight(nota)} ${esc(nota.condicao || nota.texto)}` : 'Confira as condições do debate.'}</span></button>`;
  }).join('') : '<p>Nenhuma ideia aceita precisa de revisão agora.</p>';
  $('review-list').querySelectorAll('[data-review-id]').forEach(b => b.addEventListener('click', () => {
    if (busy) return; clearTimeout(nextTimer); outcome = null; reactions.clear(); clearError(); pick(b.dataset.reviewId); render(true);
  }));
}

function renderProjects() {
  $('projects').hidden = mode !== 'fila' || !projetosDef.length;
  if ($('projects').hidden) return;
  const outros = doProjeto('outros').length;
  const chip = p => {
    const n = doProjeto(p.id).length, e = equipeDe(p);
    const titulo = `${p.nome}: ${n} ${n === 1 ? 'ideia pendente' : 'ideias pendentes'}. Equipe ${equipeNome(p.equipe)}: ${statusTexto(e)}${e.fonte === 'estado' ? ' (pela hora do arquivo de estado)' : ''}${p.id === 'outros' ? '. Ideias sem projeto definido.' : ''}`;
    return `<button class="proj ${n ? '' : 'zero'} ${e.estado === 'online' ? 'live' : ''}" data-proj="${esc(p.id)}" aria-pressed="${projeto === p.id}" title="${esc(titulo)}" ${busy || selected ? 'disabled' : ''}>
      <span class="proj-name">${esc(p.nome)}<b>${n}</b></span><span class="proj-team"><i class="dot ${dotClass(e)}" aria-hidden="true"></i>${esc(equipeNome(p.equipe))} · ${esc(statusTexto(e))}</span></button>`;
  };
  $('project-bar').innerHTML = `<button class="proj all" data-proj="todos" aria-pressed="${projeto === 'todos'}" ${busy || selected ? 'disabled' : ''}><span class="proj-name">Todos<b>${fila.length}</b></span><span class="proj-team">${outros ? `${outros} sem projeto, em Outros` : 'todas com projeto'}</span></button>${ordemProjetos().map(chip).join('')}`;
  $('project-bar').querySelectorAll('[data-proj]').forEach(b => b.addEventListener('click', () => setProjeto(b.dataset.proj)));
  // No celular a barra rola de lado: o projeto escolhido fica sempre à vista.
  const bar = $('project-bar'), sel = bar.querySelector('[aria-pressed=true]');
  if (sel && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, sel.offsetLeft - bar.offsetLeft - 12);
  renderLote();
}
function renderLote() {
  const el = $('lote-panel'), p = projetoAtual();
  el.hidden = mode !== 'fila' || !p;
  if (el.hidden) return;
  const ideas = doProjeto(p.id), e = equipeDe(p), n = ideas.length, nAc = planoLote('aceitar').length;
  const off = busy || Boolean(outcome) || Boolean(loteOutcome) || Boolean(selected) || !n;
  // Nenhum código cria a tarefa: o selo fica anotado e o responsável pela equipe repassa à equipe.
  const frase = e.estado === 'online' ? `Equipe ${equipeNome(p.equipe)} online agora. O que você aceitar fica anotado para o responsável pela equipe virar tarefa dela.`
    : e.estado === '?' ? `Não deu para ler se a equipe ${equipeNome(p.equipe)} está online (sem arquivo de sessão). O que você aceitar fica anotado para o responsável pela equipe.`
    : `Equipe ${equipeNome(p.equipe)} ${statusTexto(e)}. O que você aceitar fica anotado até o responsável pela equipe passar a ela.`;
  let html = loteAviso ? `<p class="lote-aviso" role="status">${esc(loteAviso)}</p>` : '';
  html += `<div class="lote-head"><div class="lote-copy"><strong>${n ? `Decidir as ${n} de ${esc(p.nome)} de uma vez` : `Equipe ${esc(equipeNome(p.equipe))}`}</strong><small><i class="dot ${dotClass(e)}" aria-hidden="true"></i>${esc(frase)}</small></div>
    <div class="lote-actions" ${n ? '' : 'hidden'}><button class="lote-btn ok" data-lote="aceitar" ${off || !nAc ? 'disabled' : ''} title="Aceita só as que o conselho recomenda aceitar, com a ressalva dele quando houver">Aceitar as recomendadas <b>${nAc}</b></button>
    <button class="lote-btn bad" data-lote="rejeitar" ${off ? 'disabled' : ''}>Rejeitar todas <b>${n}</b></button>
    <button class="lote-btn later" data-lote="depois" ${off ? 'disabled' : ''} title="Saem da fila sem julgar a ideia; ninguém ganha nem perde pontos">Deixar para depois <b>${n}</b></button></div></div>`;
  if (confirmLote) {
    const { acao, plano } = confirmLote, m = plano.length, resto = n - m;
    const c1 = plano.filter(x => x.opcao === 1).length, c2 = plano.filter(x => x.opcao === 2).length;
    const titulo = acao === 'aceitar' ? `Aceitar ${m} ${m === 1 ? 'ideia' : 'ideias'} de ${p.nome}?` : acao === 'rejeitar' ? `Rejeitar ${m === 1 ? 'a única ideia' : `as ${m} ideias`} de ${p.nome}?` : `Deixar ${m === 1 ? 'a única ideia' : `as ${m} ideias`} de ${p.nome} para depois?`;
    const partes = [c1 ? `${c1} como ${c1 === 1 ? 'está' : 'estão'}` : '', c2 ? `${c2} com a ressalva do conselho` : ''].filter(Boolean).join(' e ');
    const detalhe = acao === 'aceitar' ? `${partes.charAt(0).toUpperCase()}${partes.slice(1)}. ${resto ? `${resto} sem recomendação de aceite ${resto === 1 ? 'continua' : 'continuam'} na fila.` : 'A fila deste projeto zera.'}`
      : acao === 'rejeitar' ? 'Todas saem da fila e o conselho ganha ou perde pontos como numa decisão normal.'
      : 'Saem da fila e ficam guardadas para retomar depois. Ninguém ganha nem perde pontos.';
    const verbo = { 1: 'Aceitar', 2: 'Com ressalva', 3: 'Depois', 4: 'Rejeitar' };
    html += `<div class="lote-confirm" role="group" aria-labelledby="lote-q"><p id="lote-q"><b>${esc(titulo)}</b> ${esc(detalhe)} Dá para desfazer o lote inteiro depois, no botão Desfazer.</p>
      <ul class="lote-list">${plano.slice(0, 6).map(x => `<li><span class="vote" style="--vc:${COR[x.opcao]}">${verbo[x.opcao]}</span>${esc(x.ideia.titulo)}</li>`).join('')}${m > 6 ? `<li class="more">e mais ${m - 6}</li>` : ''}</ul>
      <div class="edit-actions"><button class="plain-btn" type="button" id="lote-cancel">Voltar <kbd>Esc</kbd></button><button class="pink-btn" type="button" id="lote-ok">Confirmar ${m} <kbd>Enter</kbd></button></div></div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-lote]').forEach(b => b.addEventListener('click', () => askLote(b.dataset.lote)));
  $('lote-cancel')?.addEventListener('click', cancelLote);
  $('lote-ok')?.addEventListener('click', commitLote);
}
// No lote "deixar para depois" o selo gravado é SÓ SE, mas a tela diz o que ele quis: depois.
// As mesmas palavras da confirmação (um nome por coisa).
const rotuloLote = v => ({ FAZER: 'Aceitar', FAZER_COM_RESSALVAS: 'Com ressalva', SO_SE: loteOutcome?.acao === 'depois' ? 'Depois' : 'Só se', NAO: 'Rejeitar' }[v] || v);
// Quem conta em cada número: a mesa (10 do conselho) e os idealistas autores aparecem separados.
const quem = l => { const nm = l.filter(r => r.tipo === 'conselheiro').length, ni = l.length - nm; return ni ? `${nm} da mesa e ${ni} ${ni === 1 ? 'idealista' : 'idealistas'}` : 'só da mesa'; };
const TOQUE = () => matchMedia('(hover: none), (max-width: 520px)').matches;
function loteOutcomeHtml() {
  const L = loteOutcome, info = LOTE[L.acao] || LOTE.aceitar, lista = [...reactions.values()];
  const ganhou = lista.filter(r => r.delta > 0), perdeu = lista.filter(r => r.delta < 0);
  // No lote o mesmo idealista aparece por foco (Claude de Dinheiro, Claude de Velocidade): o foco vai junto do nome.
  const linha = (r, i) => `<div class="react" style="--i:${i}">${face(r)}<span><b>${esc(r.nome)}${r.tipo === 'idealista' && FOCO[r.foco] ? ` de ${esc(FOCO[r.foco])}` : ''}</b> <q>${esc(r.frase)}</q></span><span class="pts">${r.delta > 0 ? '+' : ''}${r.delta}</span></div>`;
  const porVeredito = Object.entries((L.ideias || []).reduce((a, x) => ({ ...a, [x.veredito]: (a[x.veredito] || 0) + 1 }), {}));
  return `<div class="card-top"><span class="chip">${esc(L.nome)}</span><span class="chip">Decisão em lote</span><span class="card-pos">${L.total} de uma vez</span></div>
    <section class="outcome lote-outcome" role="status"><div class="outcome-head"><div class="stamp" style="--sc:${COR[info.op]}">${esc(info.selo)}<small>SELO DO DONO</small></div>
      <strong><span class="big-n">${L.total}</span> ${L.total === 1 ? 'ideia' : 'ideias'} de ${esc(L.nome)} ${esc(info.fim)}</strong>
      <span class="next"><button class="link-btn" id="lote-undo">Desfazer o lote <kbd>Z</kbd></button><button class="next-btn" id="lote-next">Continuar <kbd>Enter</kbd></button></span></div>
      <div class="lote-tally">${porVeredito.map(([v, k]) => `<span class="vote" style="--vc:${COR[SELO[v][2]]}">${esc(rotuloLote(v))}: ${k}</span>`).join('')}</div>
      <ul class="lote-list done">${(L.ideias || []).slice(0, 12).map((x, i) => `<li style="--i:${i}"><span class="vote" style="--vc:${COR[SELO[x.veredito][2]]}">${esc(rotuloLote(x.veredito))}</span>${esc(x.titulo)}</li>`).join('')}${(L.ideias || []).length > 12 ? `<li class="more">e mais ${L.ideias.length - 12}</li>` : ''}</ul>
      ${L.acao === 'depois' ? '<p class="react">Guardar não é julgar a ideia: o placar fica como estava.</p>' : `<div class="reactions"><div class="won"><h3>Comemoram (${ganhou.length})${ganhou.length ? ` <small>${esc(quem(ganhou))}</small>` : ''}</h3>${ganhou.map(linha).join('') || '<p class="react">Ninguém ganhou pontos.</p>'}</div>
      <div class="lost"><h3>Ficaram bravos (${perdeu.length})${perdeu.length ? ` <small>${esc(quem(perdeu))}</small>` : ''}</h3>${perdeu.map((r, i) => linha(r, i + ganhou.length)).join('') || '<p class="react">Ninguém perdeu pontos.</p>'}</div></div>`}</section>`;
}
function setProjeto(id) {
  if (busy || selected || (id !== 'todos' && !projetosDef.some(p => p.id === id))) return;
  clearTimeout(nextTimer); nextTimer = null; outcome = null; loteOutcome = null; confirmLote = null; loteAviso = '';
  projeto = id; guardar('decidir-projeto', id); skipped.clear(); reactions.clear(); clearError(); pick(); render(true);
  const p = projetoAtual();
  announce(p ? `${p.nome}: ${queue().length} ideias. Equipe ${equipeNome(p.equipe)} ${statusTexto(equipeDe(p))}.` : `Todos os projetos: ${fila.length} ideias.`);
}
function askLote(acao) {
  if (busy || outcome || loteOutcome || selected || !projetoAtual()) return;
  const plano = planoLote(acao);
  if (!plano.length) return;
  confirmLote = { acao, plano }; loteAviso = ''; clearError(); renderLote(); $('lote-ok')?.focus();
}
function cancelLote() { confirmLote = null; renderLote(); }
async function commitLote() {
  if (!confirmLote || busy) return;
  const { acao, plano } = confirmLote;
  busy = true; clearError(); clearTimeout(nextTimer); nextTimer = null; updateStats(); renderLote();
  try {
    const result = await api('/api/lote', { projeto, acao, ids: plano.map(x => x.ideia.id) });
    fila = result.fila; revisao = result.revisao; score = result.placar;
    reactions = new Map(result.reacoes.map(p => [p.id, p]));
    loteOutcome = result.lote; confirmLote = null; outcome = null; current = null; selected = null; busy = false;
    render(true); play(LOTE[acao].op);
    const g = result.reacoes.filter(r => r.delta > 0).length, b = result.reacoes.filter(r => r.delta < 0).length;
    announce(`${result.lote.total} ideias de ${result.lote.nome} ${LOTE[acao].fim} ${acao === 'depois' ? '' : `${g} comemoram, ${b} ficaram bravos.`} Z desfaz o lote inteiro.`);
  } catch (e) { busy = false; confirmLote = null; updateStats(); renderProjects(); fail(e); }
}
function nextAfterLote() {
  if (!loteOutcome) return;
  loteOutcome = null; reactions.clear(); pick(); render(true);
  if (current) announce(`Próxima ideia: ${current.titulo}`);
}

function tally(c) {
  const total = 10, falta = Math.max(0, total - c.porOpcao.reduce((a, b) => a + b, 0));
  return `<span class="tally" aria-hidden="true">${c.porOpcao.map((n, i) => n ? `<i class="t${i + 1}" style="width:${n * 10}%"></i>` : '').join('')}${falta ? `<i class="t0" style="width:${falta * 10}%"></i>` : ''}</span>`;
}
function outcomeHtml() {
  if (!outcome) return '';
  const [selo, frase, op] = SELO[outcome.veredito];
  const lista = [...reactions.values()];
  const ganhou = lista.filter(r => r.delta > 0), perdeu = lista.filter(r => r.delta < 0);
  const linha = (r, i) => `<div class="react" style="--i:${i}">${face(r, { cor: r.voto ? COR[r.voto] : '' })}<span><b>${esc(r.nome)}</b> <q>${esc(r.frase)}</q></span><span class="pts">${r.delta > 0 ? '+' : ''}${r.delta}</span></div>`;
  return `<section class="outcome" role="status"><div class="outcome-head"><div class="stamp" style="--sc:${COR[op]}">${esc(selo)}<small>SELO DO DONO</small></div><strong>${esc(frase)}</strong>${outcome.condicao ? `<span class="chip">${esc(outcome.condicao)}</span>` : ''}
      <span class="next"><button class="link-btn" id="stay" ${nextTimer ? '' : 'hidden'}>Ficar aqui</button><button class="next-btn" id="next">Próxima <kbd>Enter</kbd>${nextTimer ? `<i style="--espera:${ESPERA}ms"></i>` : ''}</button></span></div>
      <div class="reactions"><div class="won"><h3>Comemoram (${ganhou.length})${ganhou.length ? ` <small>${esc(quem(ganhou))}</small>` : ''}</h3>${ganhou.map(linha).join('') || '<p class="react">Ninguém acertou essa.</p>'}</div>
      <div class="lost"><h3>Ficaram bravos (${perdeu.length})${perdeu.length ? ` <small>${esc(quem(perdeu))}</small>` : ''}</h3>${perdeu.map((r, i) => linha(r, i + ganhou.length)).join('') || '<p class="react">Ninguém perdeu pontos.</p>'}</div></div></section>`;
}
function renderCard() {
  card.setAttribute('aria-busy', String(busy));
  card.classList.toggle('card-enter', animar && !outcome);
  card.classList.toggle('anim', animar && motionOn);
  if (loteOutcome) {
    card.removeAttribute('data-id');
    card.innerHTML = loteOutcomeHtml();
    $('lote-undo')?.addEventListener('click', undo);
    $('lote-next')?.addEventListener('click', nextAfterLote);
    return;
  }
  if (!current) {
    card.removeAttribute('data-id');
    const p = projetoAtual();
    card.innerHTML = mode === 'revisao'
      ? `<div class="empty"><div class="big">✓</div><h1>Revisão em dia.</h1><p>As ideias aceitas com ressalva no debate aparecem aqui.</p></div>`
      : p && fila.length ? `<div class="empty"><div class="big">✦</div><p class="label">Projeto em dia</p><h1>${esc(p.nome)} sem ideias pendentes.</h1><p>Ainda ${fila.length === 1 ? 'falta 1 ideia' : `faltam ${fila.length} ideias`} em outros projetos.</p><button class="ghost-btn" id="see-all">Ver todos os projetos</button></div>`
      : `<div class="empty"><div class="big">✦</div><p class="label">Conquista desbloqueada</p><h1>Fila zerada.</h1><p>Todas as ideias têm o seu selo. O conselho já está pensando nas próximas.</p><button class="ghost-btn" id="refresh">Conferir novas ideias</button></div>`;
    $('refresh')?.addEventListener('click', () => refresh());
    $('see-all')?.addEventListener('click', () => setProjeto('todos'));
    return;
  }
  const c = current, ideas = queue(), pos = ideas.findIndex(i => i.id === c.id) + 1;
  card.dataset.id = c.id;
  const autores = c.autores.map(a => {
    const p = pessoa(a.id), r = reactions.get(a.id);
    return `<span class="author ${r ? (r.delta > 0 ? 'win' : 'lose') : ''}">${face(p)}<span><b>${esc(a.nome)}</b> · ${esc(FOCO[a.foco] || '')} · #${p.posicao ?? '?'} · ${p.pontos ?? 0} pts ${r && r.delta ? `<span class="delta" style="color:${r.delta > 0 ? 'var(--ok)' : 'var(--bad)'}">${r.delta > 0 ? '+' : ''}${r.delta}</span>` : ''}</span></span>`;
  }).join('');
  const votaram = c.porOpcao.reduce((a, b) => a + b, 0), soIdealistas = !c.votos.some(v => v.conselheiro);
  const rec = c.opcoes.find(o => o.recomendado);
  const recN = rec ? c.porOpcao[rec.opcao - 1] : 0;
  const opcoes = [...c.opcoes].sort((a, b) => Number(b.recomendado) - Number(a.recomendado) || a.opcao - b.opcao);
  const faltam = (c.faltam || []).map(pessoa);
  card.innerHTML = `
    <div class="card-top"><span class="chip foco">${esc(FOCO[c.foco])}</span><span class="chip">${esc(c.projeto)}</span>${c.pedidoDoDono ? '<span class="chip dono">Pedido do dono</span>' : ''}<span class="chip">Esforço ${esc({ P: 'pequeno', M: 'médio', G: 'grande' }[c.esforco] || c.esforco)}</span>
      <span class="chip ${c.mesaCompleta ? 'mesa-ok' : 'mesa-falta'}">${c.mesaCompleta ? `Mesa completa: ${c.mesaTotal || 10} de ${c.mesaTotal || 10} votaram` : `Faltam ${faltam.length} ${faltam.length === 1 ? 'voto' : 'votos'}`}</span>
      <span class="card-pos">${outcome ? 'decidida agora' : `${mode === 'revisao' ? 'revisão' : 'ideia'} ${pos} de ${ideas.length}`}</span></div>
    <h1>${esc(c.titulo)}</h1>
    ${c.porque ? `<p class="porque">${esc(c.porque)}</p>` : ''}
    <div class="authors"><span class="label">Ideia de</span>${autores || (c.donoECoordenador ? '<span class="author">Dono e responsável pela equipe</span>' : '<span class="author">Conselho</span>')}</div>
    <details class="como"><summary>Como funciona</summary><p>${esc(c.como)}</p><p class="label">Fonte: ${esc(c.id)}${c.projetoOriginal ? ` · projeto no arquivo: ${esc(c.projetoOriginal)}` : ''}${c.tituloOriginal && c.tituloOriginal !== c.titulo ? ` · título original: ${esc(c.tituloOriginal)}` : ''}</p></details>
    ${mode === 'revisao' ? `<p class="previous">Você aceitou antes sem ressalva. ${esc(c.aceiteAnterior?.motivo || '')}</p>` : ''}
    ${outcomeHtml()}
    <div class="verdict-bar">${tally(c)}<p>${!rec ? 'Ainda sem votos do conselho.' : soIdealistas ? `O conselho ainda não votou. Só ${votaram === 1 ? 'um idealista opinou' : `${votaram} idealistas opinaram`}: <b>${esc(NOME_OPCAO[rec.opcao])}</b>.` : `O conselho recomenda <b>${esc(NOME_OPCAO[rec.opcao])}</b>: ${recN} de ${votaram} ${recN === 1 ? 'votou' : 'votaram'} nisso.`}</p></div>
    ${c.tantoFaz ? '<p class="same-choice"><b>Tanto faz entre 1 e 2.</b> As ressalvas são detalhes. Escolhendo 1 ou 2, grava como 1.</p>' : ''}
    <div class="options">${opcoes.map(o => {
      const quem = (o.votantes || []).map(pessoa);
      const mostraPeso = [2, 3].includes(o.opcao) && (quem.length || (o.texto && o.texto !== o.detalhe));
      const escolhida = outcome ? SELO[outcome.veredito][2] === o.opcao : false;
      return `<div><button class="option ${o.recomendado ? 'rec' : ''} ${outcome ? (escolhida ? 'chosen' : 'not-chosen') : ''}" data-option="${o.opcao}" ${busy || outcome ? 'disabled' : ''} aria-label="${o.opcao}: ${esc(o.titulo)}${o.recomendado ? ', recomendado' : ''}, ${quem.length} votos">
        <span class="key">${o.opcao}</span>
        <span class="option-copy"><span class="option-title">${esc(o.titulo)}${o.recomendado ? '<span class="rec-tag">Recomendado</span>' : ''}${mostraPeso ? weight(o) : ''}</span><span class="option-detail">${esc(o.detalhe)}</span></span>
        <span class="voters">${quem.length ? quem.map(p => face(p, { cor: COR[o.opcao], titulo: `${p.nome}: ${votoDe(p.id)?.texto || ''}` })).join('') : '<span class="none">ninguém</span>'}<span class="count">${quem.length}</span></span>
      </button>${selected === o.opcao && !outcome ? `<form class="edit-form" id="condition-form"><label for="condition">${o.opcao === 2 ? 'A ressalva que vai junto com o aceite' : 'Só fazer quando isto estiver cumprido'}</label><input id="condition" name="texto" maxlength="300" autocomplete="off" value="${esc(o.texto)}" placeholder="Uma frase curta" required><div class="edit-actions"><button class="plain-btn" type="button" id="cancel-condition">Voltar <kbd>Esc</kbd></button><button class="pink-btn" type="submit">${o.opcao === 2 ? 'Aceitar com isto' : 'Guardar com esta condição'}</button></div></form>` : ''}</div>`;
    }).join('')}</div>
    ${faltam.length ? `<div class="missing"><span>Ainda não votaram:</span><span class="faces">${faltam.map(faceVazia).join('')}</span></div>` : ''}
    <div class="card-bottom"><button class="link-btn" id="skip" ${busy || outcome ? 'disabled' : ''}>Pular <kbd>P</kbd></button><button class="link-btn" id="undo" ${!score?.ultima || busy ? 'disabled' : ''}>${score?.ultima?.lote ? `Desfazer o lote (${score.ultima.lote.total})` : 'Desfazer a última'} <kbd>Z</kbd></button><span class="spacer"></span><span>${c.completados ? `${c.completados} votos completados pelo ajudante` : ''}</span></div>
    ${c.votos.length ? `<details class="debate"><summary>O que cada um disse (${c.votos.length})</summary><div class="debate-list">${c.votos.map(v => {
      const p = pessoa(v.id);
      return `<div class="say">${face(p, { cor: COR[v.opcao] })}<div><b>${esc(v.nome)}</b><span class="vote" style="--vc:${COR[v.opcao]}">${esc(NOME_OPCAO[v.opcao])}</span>${v.marca ? ` ${weight(v)}` : ''}<p>${esc(v.texto || 'Voto sem comentário.')}</p>${v.condicao ? `<small>${v.opcao === 3 ? 'Condição' : 'Ajuste'}: ${esc(v.condicao)}</small>` : ''}${v.detalhe ? `<small>${esc(v.detalhe)}</small>` : ''}<span class="src">${{ mesa: 'Mesa dos 10', completado: 'completado', undefined: '' }[v.fonte] || ''}</span></div></div>`;
    }).join('')}</div></details>` : ''}`;
  card.querySelectorAll('[data-option]').forEach(b => b.addEventListener('click', () => choose(Number(b.dataset.option))));
  $('skip')?.addEventListener('click', skip);
  $('undo')?.addEventListener('click', undo);
  $('next')?.addEventListener('click', next);
  $('stay')?.addEventListener('click', stay);
  $('cancel-condition')?.addEventListener('click', () => { selected = null; animar = false; renderCard(); });
  $('condition-form')?.addEventListener('submit', e => { e.preventDefault(); commit(selected, $('condition').value); });
}

function renderTable() {
  if (!score) return;
  const conselho = ORDEM.map(id => score.ranking.find(p => p.id === id)).filter(Boolean);
  const n = conselho.length || 1;
  const seats = conselho.map((p, i) => {
    const ang = (-90 + i * 360 / n) * Math.PI / 180, x = 50 + 41 * Math.cos(ang), y = 52 + 39 * Math.sin(ang);
    const v = votoDe(p.id), r = reactions.get(p.id), st = r ? (r.delta > 0 ? 'win' : r.delta < 0 ? 'lose' : '') : '';
    const conf = st === 'win' ? `<span class="confetti">${Array.from({ length: 7 }, (_, k) => `<i style="--i:${k};--cc:${['var(--acc)', 'var(--ok)', 'var(--warn)', 'var(--codex)'][k % 4]};--x:${Math.round(Math.cos(k) * 34)}px;--y:${-18 - (k % 3) * 12}px;--r:${k * 70}deg"></i>`).join('')}</span>` : '';
    return `<div class="seat ${st}" style="left:${x}%;top:${y}%;--i:${i};--vc:${v ? COR[v.opcao] : 'var(--line)'}" tabindex="0">
      ${conf}${v || loteOutcome ? face(p, { titulo: `${p.nome}, ${p.papel}: ${p.pergunta}` }) : faceVazia(p)}${v ? `<span class="vchip">${v.opcao}</span>` : ''}
      <span class="who">${esc(p.nome)}</span><span class="rank">#${p.posicao} · ${p.pontos}${p.sequencia >= 2 ? ` · ${p.sequencia}×` : ''}</span>
      ${r && r.delta ? `<span class="float">${r.delta > 0 ? '+' : ''}${r.delta}</span><span class="mood">${r.delta > 0 ? 'Viva!' : 'Grr!'}</span>` : ''}
      <span class="bubble">${r ? esc(r.frase) : v ? esc(v.texto) : esc(p.pergunta)}</span></div>`;
  }).join('');
  let centro;
  if (outcome) {
    const [selo, , op] = SELO[outcome.veredito], l = [...reactions.values()];
    centro = `<div><span class="seal" style="--sc:${COR[op]}">${esc(selo)}</span><small>Da mesa: ${l.filter(x => x.delta > 0 && x.tipo === 'conselheiro').length} comemoram · ${l.filter(x => x.delta < 0 && x.tipo === 'conselheiro').length} bravos</small></div>`;
  } else if (loteOutcome) {
    const info = LOTE[loteOutcome.acao] || LOTE.aceitar, l = [...reactions.values()];
    centro = `<div><small>Lote de ${esc(loteOutcome.nome)}</small><span class="seal big" style="--sc:${COR[info.op]}">${loteOutcome.total}</span><small>${loteOutcome.acao === 'depois' ? 'placar parado' : `Da mesa: ${l.filter(x => x.delta > 0 && x.tipo === 'conselheiro').length} comemoram · ${l.filter(x => x.delta < 0 && x.tipo === 'conselheiro').length} bravos`}</small></div>`;
  } else if (current) {
    const rec = current.opcoes.find(o => o.recomendado);
    const nv = current.votos.filter(v => v.conselheiro).length;
    centro = nv ? `<div><small>O conselho recomenda</small><b>${rec ? esc(NOME_OPCAO[rec.opcao]) : 'nada ainda'}</b><small>${nv} de 10 votaram</small></div>` : '<div><b>Ninguém votou ainda</b><small>Os 10 votam na próxima rodada</small></div>';
  } else centro = projetoAtual() && fila.length ? `<div><b>Mesa livre</b><small>${esc(projetoAtual().nome)} em dia</small></div>` : '<div><b>Mesa livre</b><small>Sem ideias na fila</small></div>';
  $('round-table').className = `round-table ${animar && motionOn ? 'anim' : ''}`;
  $('round-table').innerHTML = `<div class="table-top">${centro}</div>${seats}`;
  $('table-note').textContent = outcome || loteOutcome ? (TOQUE() ? 'Toque num Agente para ler o que ele disse.' : 'Passe o mouse num Agente para ler o que ele disse.') : 'Acertou ganha 10. Errou perde 5.';
}

function renderRanking() {
  if (!score) return;
  const lista = $('ranking');
  const antes = new Map([...lista.children].map(li => [li.dataset.id, li.getBoundingClientRect().top]));
  const rows = score.ranking.filter(p => filter === 'todos' || p.tipo === filter);
  lista.innerHTML = rows.map((p, i) => {
    const r = reactions.get(p.id), mv = r ? r.movimento : p.movimento;
    return `<li class="rank-row ${r ? 'changed' : ''}" data-id="${esc(p.id)}"><span class="pos">#${filter === 'todos' ? p.posicao : i + 1}</span>${face(p)}
      <span class="name"><b>${esc(p.nome)}</b><small>${esc(p.tipo === 'idealista' ? `${FOCO[p.foco]} · ${p.papel}` : `${p.papel}: ${p.pergunta}`)}</small></span>
      <span class="mv ${mv > 0 ? 'up' : mv < 0 ? 'down' : ''}" title="${mv ? `${mv > 0 ? 'Subiu' : 'Desceu'} ${Math.abs(mv)}` : 'Manteve'}">${mv > 0 ? '▲' : mv < 0 ? '▼' : '·'}</span>
      <span class="seq ${p.sequencia >= 3 ? 'hot' : ''}" title="Acertos seguidos">${p.sequencia ? `${p.sequencia}×` : ''}</span>
      <span class="pts">${p.pontos}${r && r.delta ? `<small class="${r.delta > 0 ? 'plus' : 'minus'}">${r.delta > 0 ? '+' : ''}${r.delta}</small>` : ''}</span></li>`;
  }).join('');
  if (!motionOn || !antes.size) return;
  for (const li of lista.children) {
    const t = antes.get(li.dataset.id); if (t === undefined) continue;
    const d = t - li.getBoundingClientRect().top; if (!d) continue;
    li.style.transform = `translateY(${d}px)`; li.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => { li.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)'; li.style.transform = ''; }));
  }
}

function render(animate = false) { animar = animate; updateStats(); renderProjects(); renderReview(); renderCard(); renderTable(); renderRanking(); }

function choose(option) {
  if (busy || !current || outcome || loteOutcome || confirmLote) return;
  clearError();
  if (option === 2 && current.tantoFaz) { commit(1); return; }
  if ([2, 3].includes(option)) { selected = option; animar = false; renderCard(); $('condition').focus(); $('condition').select(); }
  else commit(option);
}
async function commit(option, texto) {
  if (busy || !current || outcome) return;
  busy = true; loteAviso = ''; clearError(); animar = false; updateStats(); renderCard();
  try {
    const result = await api(mode === 'revisao' ? '/api/revisar' : '/api/decidir', { id: current.id, opcao: option, ...(texto !== undefined ? { texto } : {}) });
    fila = result.fila; revisao = result.revisao; score = result.placar;
    reactions = new Map(result.reacoes.map(p => [p.id, p]));
    current = result.ideia;
    if (mode === 'revisao') skipped.add(current.id);
    outcome = result.decisao; selected = null; busy = false;
    nextTimer = setTimeout(next, ESPERA);
    render(true); play(SELO[outcome.veredito][2]);
    const g = [...reactions.values()].filter(r => r.delta > 0).length, b = [...reactions.values()].filter(r => r.delta < 0).length;
    announce(`${current.titulo}: ${SELO[outcome.veredito][1]} ${g} comemoram, ${b} ficaram bravos. ${score.pendentes} na fila.`);
  } catch (e) { busy = false; updateStats(); renderCard(); fail(e); }
}
function stay() { clearTimeout(nextTimer); nextTimer = null; animar = false; renderCard(); }
function next() {
  if (!outcome) return;
  clearTimeout(nextTimer); nextTimer = null; outcome = null; reactions.clear(); pick(); render(true);
  if (current) announce(`Próxima ideia: ${current.titulo}`);
}
function skip() {
  if (busy || !current || outcome || loteOutcome || confirmLote) return;
  skipped.add(current.id); pick(); reactions.clear(); render(true);
  announce(queue().length === 1 ? 'Só falta esta ideia. Pular não grava nada.' : 'Ideia pulada. Ela volta no fim da rodada.');
}
async function undo() {
  if (busy || !score?.ultima) return;
  const id = score.ultima.id, lote = score.ultima.lote?.id ?? null;
  busy = true; confirmLote = null; clearTimeout(nextTimer); nextTimer = null; clearError(); updateStats(); animar = false; renderCard();
  try {
    const result = await api('/api/desfazer', { id, lote });
    fila = result.fila; revisao = result.revisao; score = result.placar; outcome = null; loteOutcome = null; busy = false; reactions.clear();
    mode = 'fila';
    if (result.lote) {
      for (const i of result.lote.ids) skipped.delete(i);
      projeto = result.lote.projeto; guardar('decidir-projeto', projeto);
      loteAviso = `Lote desfeito: ${result.lote.total} ${result.lote.total === 1 ? 'ideia voltou' : 'ideias voltaram'} para a fila de ${result.lote.nome}. Pontos recalculados.`;
      pick(result.lote.ids[0]); render(true); announce(loteAviso);
    } else {
      skipped.delete(result.ideia.id);
      if (projeto !== 'todos' && result.ideia.projetoId !== projeto) projeto = 'todos';
      pick(result.ideia.id); render(true);
      announce('Última decisão desfeita. A ideia voltou e os pontos foram recalculados.');
    }
  } catch (e) { busy = false; updateStats(); renderCard(); fail(e); }
}
async function changeMode(m) {
  if (busy || m === mode) return;
  clearTimeout(nextTimer); nextTimer = null; mode = m; outcome = null; loteOutcome = null; confirmLote = null; loteAviso = ''; skipped.clear(); reactions.clear(); clearError(); pick(); render(true);
  announce(mode === 'revisao' ? `${revisao.length} ideias aceitas para rever.` : `${fila.length} ideias para decidir.`);
}
async function refresh(quiet = false) {
  if (busy || outcome || selected || confirmLote || loteOutcome) return;
  try {
    const m = mode, result = await api('/api/fila');
    if (busy || outcome || selected || confirmLote || loteOutcome || m !== mode) return;
    const antes = JSON.stringify([fila, revisao, score]), oldId = current?.id, equipeAntes = JSON.stringify([projetosDef, equipe]);
    fila = result.ideias; revisao = result.revisao; score = result.placar;
    projetosDef = Array.isArray(result.projetos) ? result.projetos : []; equipe = result.equipe || null;
    if (projeto !== 'todos' && !projetosDef.some(p => p.id === projeto)) projeto = 'todos';
    pick(oldId);
    if (!quiet || oldId !== current?.id || antes !== JSON.stringify([fila, revisao, score])) { reactions.clear(); render(!quiet); }
    else if (equipeAntes !== JSON.stringify([projetosDef, equipe])) renderProjects();
    clearError();
  } catch (e) { fail(e); card.setAttribute('aria-busy', 'false'); }
}
function play(option) {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const now = audioContext.currentTime;
    for (const [i, freq] of (option === 4 ? [392, 330] : option === 3 ? [440, 494] : [2 * 261.63, 659, 784]).entries()) {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain(), t = now + i * .07;
      osc.type = 'triangle'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.03, t + .015); gain.gain.exponentialRampToValueAtTime(.001, t + .14);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(t); osc.stop(t + .15);
    }
  } catch { soundOn = false; $('sound').textContent = 'Som: indisponível'; }
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => changeMode(b.dataset.mode)));
$('undo-top').addEventListener('click', undo);
$('sound').addEventListener('click', () => { soundOn = !soundOn; $('sound').textContent = soundOn ? 'Som: sim' : 'Som: não'; $('sound').setAttribute('aria-pressed', String(soundOn)); if (soundOn) play(1); });
function setMotion(v) { motionOn = v; document.documentElement.classList.toggle('no-motion', !v); $('motion').textContent = v ? 'Movimento: sim' : 'Movimento: não'; $('motion').setAttribute('aria-pressed', String(v)); guardar('decidir-movimento', v ? 'sim' : 'nao'); }
setMotion(guardado('decidir-movimento') !== 'nao' && !matchMedia('(prefers-reduced-motion: reduce)').matches);
$('motion').addEventListener('click', () => setMotion(!motionOn));
document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderRanking();
}));
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
  if (e.key === 'Escape' && selected) { e.preventDefault(); selected = null; animar = false; renderCard(); return; }
  if (e.key === 'Escape' && confirmLote) { e.preventDefault(); cancelLote(); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || busy) return;
  if (confirmLote) {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); commitLote(); }
    return;
  }
  if (loteOutcome) {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); nextAfterLote(); }
    else if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    return;
  }
  if (/^[1-4]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key)); }
  else if (e.key.toLowerCase() === 'p') { e.preventDefault(); skip(); }
  else if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === 'Enter' && outcome && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); next(); }
});
refresh();
setInterval(() => { if (!document.hidden) refresh(true); }, 12000);
