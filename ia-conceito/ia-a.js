'use strict';
// Conceito A: ENSINE SUA IA (habitos com nota). Uma ficha de 14 habitos em 4 grupos pelo ganho; o numero grande e
// quantos ja foram copiados; 1 acao principal copia os que faltam num bloco so (para o arquivo de regras).
// Copiar não comprova uso; o selo exige detector disponível e registro próprio.
(function (root) {
  const ROTULO = { pt: 'Ensine sua IA', en: 'Teach your AI', es: 'Enseña a tu IA' };
  const T = {
    pt: { titulo: 'Ensine sua IA', de: 'de', habitos: 'hábitos copiados', sub: 'Textos prontos para colar na sua IA. Orientações para reduzir gasto ou erro.', faltam: n => n === 1 ? 'Copiar o que falta' : 'Copiar os ' + n + ' que faltam', todos: n => 'Copiar os ' + n + ' de novo', dicaRegras: 'Cole em qualquer conversa do Claude Code que roda no seu computador. Pronto.', completo: 'Sua IA tem todos os hábitos', usoNenhum: 'Nenhum visto em uso ainda. Cole o texto numa conversa da IA para ganhar o selo.', usoAlguns: n => n + (n === 1 ? ' visto em uso numa conversa sua.' : ' vistos em uso nas suas conversas.'), ultima: q => 'Última cópia ' + q + '.', grupo: (a, b) => a + ' de ' + b },
    en: { titulo: 'Teach your AI', de: 'of', habitos: 'habits copied', sub: 'Ready texts to paste into your AI. Guidance to reduce cost or mistakes.', faltam: n => n === 1 ? 'Copy the missing one' : 'Copy the ' + n + ' missing', todos: n => 'Copy all ' + n + ' again', dicaRegras: 'Paste it into any Claude Code chat running on your computer. Done.', completo: 'Your AI has every habit', usoNenhum: 'None seen in use yet. Paste the text into an AI chat to earn the badge.', usoAlguns: n => n + (n === 1 ? ' seen in use in your chats.' : ' seen in use in your chats.'), ultima: q => 'Last copy ' + q + '.', grupo: (a, b) => a + ' of ' + b },
    es: { titulo: 'Enseña a tu IA', de: 'de', habitos: 'hábitos copiados', sub: 'Textos listos para pegar en tu IA. Orientaciones para reducir gasto o errores.', faltam: n => n === 1 ? 'Copiar el que falta' : 'Copiar los ' + n + ' que faltan', todos: n => 'Copiar los ' + n + ' de nuevo', dicaRegras: 'Pégalo en cualquier conversación de Claude Code que corra en tu ordenador. Listo.', completo: 'Tu IA tiene todos los hábitos', usoNenhum: 'Ninguno visto en uso todavía. Pega el texto en una conversación con la IA para ganar el sello.', usoAlguns: n => n + ' vistos en uso en tus conversaciones.', ultima: q => 'Última copia ' + q + '.', grupo: (a, b) => a + ' de ' + b }
  };
  const ORDEM_GRUPOS = ['gastar', 'errar', 'equipe', 'organizar'];

  function anel(ctx, feitos, total) {
    const { el, svg } = ctx, caixa = el('div', 'iaa-anel'); caixa.dataset.iacAvatar = '';
    const desenho = svg('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true', class: 'iaa-anel-svg' });
    desenho.append(svg('circle', { cx: 60, cy: 60, r: 54, class: 'iaa-anel-fundo', pathLength: 100 }));
    const parte = Math.round(100 * feitos / Math.max(1, total));
    if (parte > 0) desenho.append(svg('circle', { cx: 60, cy: 60, r: 54, class: 'iaa-anel-cheio', pathLength: 100, 'stroke-dasharray': parte + ' 100', transform: 'rotate(-90 60 60)' }));
    const agente = el('img', 'iaa-agente'); agente.src = '/agente.png'; agente.alt = ''; agente.width = 84; agente.height = 84; agente.decoding = 'async';
    caixa.append(desenho, agente); return caixa;
  }

  function item(ctx, dica) {
    const { el, w } = ctx, cortes = ctx.cortes(dica), copiado = ctx.copiados.has(dica.id), emUso = ctx.emUso.has(dica.id), aberto = ctx.aberto.has(dica.id);
    const li = el('li', 'iaa-item' + (copiado ? ' is-copiado' : '') + (aberto ? ' is-aberto' : '')); li.dataset.iacId = dica.id;
    const marca = el('span', 'iac-marca iaa-marca' + (copiado ? ' is-sim' : '')); marca.setAttribute('aria-hidden', 'true'); if (copiado) marca.textContent = '✓';
    const abrir = el('button', 'iaa-abrir'); abrir.type = 'button'; abrir.dataset.iacFoco = 'abrir-' + dica.id; abrir.setAttribute('aria-expanded', String(aberto));
    abrir.title = aberto ? w.esconder : w.verTexto;
    const linhaTitulo = el('span', 'iaa-linha-titulo'); linhaTitulo.append(el('strong', 'iaa-nome', cortes.titulo)); if (emUso) linhaTitulo.append(ctx.chipEmUso());
    linhaTitulo.append(el('span', 'iaa-seta')); abrir.append(linhaTitulo, el('span', 'iaa-porque', cortes.porque));
    abrir.addEventListener('click', () => ctx.alternar(dica.id, abrir));
    li.append(marca, abrir, ctx.botaoCopiar([dica.id], 'copiar-' + dica.id));
    if (aberto) { const texto = el('p', 'iac-colar iaa-texto', ctx.textoDe(dica)); texto.tabIndex = 0; li.append(texto); }
    return li;
  }

  function desenhar(host, ctx) {
    const { el, dicas } = ctx, t = T[ctx.lang] || T.pt, total = dicas.length;
    const feitos = dicas.filter(d => ctx.copiados.has(d.id)).length, faltam = dicas.filter(d => !ctx.copiados.has(d.id)), emUso = dicas.filter(d => ctx.emUso.has(d.id)).length;
    const tela = el('div', 'iaa');
    const cabeca = el('div', 'iaa-cabeca'); const titulo = el('h2', 'iaa-titulo', t.titulo); titulo.id = 'iaa-titulo';
    cabeca.append(titulo, el('p', 'iaa-sub', t.sub)); tela.append(cabeca);

    // resumo: o Agente no anel de progresso, o numero e a acao principal
    const resumo = el('section', 'iac-cartao iaa-resumo'); resumo.setAttribute('aria-labelledby', 'iaa-titulo');
    const topo = el('div', 'iaa-topo'); topo.append(anel(ctx, feitos, total));
    const numeros = el('div', 'iaa-numeros');
    const conta = el('p', 'iaa-conta'); conta.dataset.iacConta = ''; conta.append(el('strong', null, String(feitos)), el('span', 'iaa-de', ' ' + t.de + ' ' + total));
    numeros.append(conta, el('p', 'iaa-rotulo', feitos === total ? t.completo : t.habitos)); topo.append(numeros); resumo.append(topo);
    const ids = faltam.length ? faltam.map(d => d.id) : dicas.map(d => d.id);
    const principal = ctx.botaoCopiar(ids, 'principal', faltam.length ? t.faltam(faltam.length) : t.todos(total), 'iac-primario iaa-principal');
    resumo.append(principal, el('p', 'iaa-dica', t.dicaRegras), ctx.status());
    const rodape = el('div', 'iaa-rodape'); rodape.append(el('p', null, ctx.bonusUnavailable?({pt:'? Verificação de uso indisponível',en:'? Usage verification unavailable',es:'? Verificación de uso no disponible'})[ctx.lang]:emUso ? t.usoAlguns(emUso) : t.usoNenhum));
    const ultima = ctx.quando(ctx.ultimaCopia); if (ultima) rodape.append(el('p', null, t.ultima(ultima)));
    resumo.append(rodape);

    // os habitos em 4 grupos, pelo ganho
    const lista = el('div', 'iaa-grupos');
    const grupos = [...new Set([...ORDEM_GRUPOS, ...dicas.map(d => d.grupo)])].filter(g => dicas.some(d => d.grupo === g));
    for (const chave of grupos) {
      const doGrupo = dicas.filter(d => d.grupo === chave), feitosGrupo = doGrupo.filter(d => ctx.copiados.has(d.id)).length;
      const caixa = el('section', 'iac-cartao iaa-grupo' + (feitosGrupo === doGrupo.length ? ' is-completo' : '')); const id = 'iaa-g-' + chave; caixa.setAttribute('aria-labelledby', id);
      const cabeca = el('div', 'iaa-grupo-topo'); const h = el('h3', null, ctx.grupos[chave]?.[ctx.lang] || ctx.grupos[chave]?.pt || chave); h.id = id;
      cabeca.append(h, el('span', 'iaa-grupo-conta', t.grupo(feitosGrupo, doGrupo.length)));
      const ul = el('ul', 'iaa-itens'); for (const dica of doGrupo) ul.append(item(ctx, dica));
      caixa.append(cabeca, ul); lista.append(caixa);
    }
    tela.append(resumo, lista); host.append(tela);
  }

  root.IAConceito?.registrar('a', { rotulo: ROTULO, usaEstado: false, desenhar });
})(window);
