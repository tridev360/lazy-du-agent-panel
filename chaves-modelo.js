'use strict';


(function (root) {
  const GRUPOS = [
    { estado: 'ligada', titulo: 'Solicitadas, aguardando leitura' },
    { estado: 'espera-ele', titulo: 'Desligadas, esperando a sua resposta' },
    { estado: 'espera-outra', titulo: 'Desligadas, esperando outra coisa acabar' },
    { estado: 'engavetada', titulo: 'Engavetadas por você' }
  ];
  const texto = v => (typeof v === 'string' ? v.trim() : '');
  const plano = v => String(v === null || v === undefined ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function casa(tarefa, busca) {
    const partes = plano(busca).split(/\s+/).filter(Boolean);
    if (!partes.length) return true;
    const alvo = plano([tarefa.nome, tarefa.descricao, tarefa.aspa && tarefa.aspa.texto, tarefa.motivo, tarefa.quem, tarefa.sessao, tarefa.origem, tarefa.id, tarefa.card].filter(v => typeof v === 'string').join(' | '));
    return partes.every(p => alvo.includes(p));
  }

  function agrupar(tasks, filtro) {
    const f = filtro || {}, lista = Array.isArray(tasks) ? tasks.filter(t => t && typeof t === 'object') : [];
    const sessao = texto(f.sessao) || null, busca = texto(f.busca);
    const passa = t => (!sessao || t.sessao === sessao) && casa(t, busca);
    const grupos = GRUPOS.map(g => { const todas = lista.filter(t => t.estado === g.estado); return { estado: g.estado, titulo: g.titulo, total: todas.length, itens: todas.filter(passa) }; });
    const semGrupo = lista.filter(t => !GRUPOS.some(g => g.estado === t.estado));
    return { grupos, semGrupo, filtrado: !!(sessao || busca) };
  }

  function sessoes(tasks) {
    const out = [];
    for (const t of Array.isArray(tasks) ? tasks : []) {
      const s = t && texto(t.sessao); if (!s) continue;
      const achada = out.find(x => x.sessao === s);
      if (achada) achada.n++; else out.push({ sessao: s, n: 1 });
    }
    return out;
  }

  function marca(tarefa) {
    const c = tarefa && tarefa.chave;
    return c && c.por === 'ele' ? (c.ligada ? 'você ligou' : 'você desligou') : null;
  }

  function aspa(tarefa) {
    const a = tarefa && tarefa.aspa && typeof tarefa.aspa === 'object' ? tarefa.aspa : null, origem = (tarefa && texto(tarefa.origem)) || null;
    const frase = a ? texto(a.texto) : '';
    if (!frase) return { tipo: 'vazia', texto: null, quando: null, origem };
    return { tipo: a.exata === false ? 'tema' : 'exata', texto: frase, quando: texto(a.quando) || null, origem };
  }


  function efeito(tarefa, ligada) {
    const bruto = tarefa && tarefa[ligada ? 'aoLigar' : 'aoDesligar'], e = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {};
    const lista = v => (Array.isArray(v) ? v.map(texto).filter(Boolean) : []);
    const muda = texto(e.muda) || null, pros = lista(e.pros), contras = lista(e.contras);
    return { muda, pros, contras, vazio: !muda && !pros.length && !contras.length };
  }
  const api = { GRUPOS, agrupar, sessoes, marca, aspa, efeito, plano };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PainelChavesModelo = api;
})(typeof window === 'object' ? window : globalThis);
