/* Cards do painel: o dono responde o card com 1 clique; passo a passo com copiar e "feito".
   Uso na Home: <div data-pc-cards data-api="/api/pc-cards"></div> com este arquivo e pc-cards.css carregados
   (monta sozinho), ou PainelPcCards.montar(elemento, { api, titulo: false, pedidos: false }).
   Card perigoso responde aqui com o aviso de que vale so com o ok no chat; restrito, repetido e sem opcao ficam no chat. */
(function () {
  'use strict';
  const TEMPO_DESFAZER = 5000;
  const INTERVALO = 15000;
  const SVG = 'http://www.w3.org/2000/svg';
  const ICONES = {
    check: 'M5 12.5l4.2 4.2L19 7',
    cadeado: 'M7 10V7.5a5 5 0 0 1 10 0V10M6 10h12v10H6z',
    copiar: 'M9 9h10v11H9zM5 15V4h10',
    seta: 'M9 6l6 6-6 6',
    calma: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM8 12.5l2.8 2.8L16.5 9.5'
  };

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = typeof txt==='string'?txt.replace(/\bCOORDENADOR\b/g,'Claude'):txt;
    return n;
  }
  function icone(nome, cls) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.setAttribute('class', 'pcc-ico' + (cls ? ' ' + cls : ''));
    const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', ICONES[nome]); s.append(p);
    return s;
  }
  function botao(cls, foco, txt) {
    const b = el('button', cls, txt); b.type = 'button';
    if (foco) b.dataset.foco = foco;
    return b;
  }

  function montar(raiz, op) {
    op = op || {};
    if (!raiz || raiz.__pcc) return raiz && raiz.__pcc;
    const api = String(op.api || raiz.dataset.api || '/api/pc-cards').replace(/\/$/, '');
    const comTitulo = op.titulo !== false && raiz.dataset.titulo !== 'nao';
    const comPedidos = op.pedidos !== false && raiz.dataset.pedidos !== 'nao';
    const s = { dados: null, falhou: false, token: '', aberto: null, contagem: null, sucesso: null, gravando: null, avisos: new Map(), pedidoAberto: null, verMais: false, passoOcupado: false, recemFeito: null, vivo: true };
    // link direto para um card: ...#card=<arquivo>.json abre esse card primeiro (se ele estiver esperando)
    const ancora = /(?:^#|&)card=([\w][\w.-]{0,115}\.json)(?:&|$)/.exec(location.hash || '');
    if (ancora) s.aberto = ancora[1];
    const host = el('section', 'pcc'); host.setAttribute('aria-label', 'Precisa de você'); host.tabIndex = -1;
    const fala = el('p', 'pcc-sr'); fala.setAttribute('aria-live', 'polite');
    raiz.replaceChildren(host, fala);

    function anunciar(t) { fala.textContent = ''; setTimeout(() => { fala.textContent = t; }, 30); }
    function focoAtual() { const a = document.activeElement; return a && host.contains(a) && a.dataset ? a.dataset.foco || null : null; }
    function focar(chave) {
      if (!chave) return;
      const alvo = Array.from(host.querySelectorAll('[data-foco]')).find(n => n.dataset.foco === chave && !n.disabled);
      if (alvo) alvo.focus({ preventScroll: true });
    }
    function cards() { return (s.dados && s.dados.pendentes) || []; }
    function abertoAgora() {
      const lista = cards();
      if (s.contagem) return s.contagem.arquivo;
      if (s.sucesso) return s.sucesso.arquivo;
      if (s.aberto && lista.some(c => c.arquivo === s.aberto)) return s.aberto;
      return lista[0] ? lista[0].arquivo : null;
    }

    async function carregar() {
      if (!s.vivo) return;
      try {
        const r = await fetch(api + '/lista', { cache: 'no-store', credentials: 'same-origin' });
        const j = await r.json();
        if (!r.ok || !j.ok) throw Error();
        if (s.sucesso && !j.pendentes.some(c => c.arquivo === s.sucesso.arquivo)) {
          j.pendentes = [s.sucesso.card, ...j.pendentes];
        }
        s.dados = j; s.token = j.token; s.falhou = false;
        if (s.contagem && !j.pendentes.some(c => c.arquivo === s.contagem.arquivo && c.versao === s.contagem.versao)) {
          const arq = s.contagem.arquivo;
          parar();
          s.avisos.set(arq, { tipo: 'erro', texto: 'Este card mudou ou já tinha resposta. Nada foi gravado.' });
          anunciar('Este card mudou ou já tinha resposta. Nada foi gravado.');
        }
      } catch { s.falhou = true; }
      if (!s.contagem && !s.gravando) desenhar();
    }

    // ---------- resposta com 5 s para desfazer ----------
    function parar() {
      if (!s.contagem) return;
      clearTimeout(s.contagem.timer); clearInterval(s.contagem.tick);
      s.contagem = null;
    }
    function escolher(card, rotulo, pedido) {
      if (s.contagem || s.gravando || s.sucesso) return;
      s.avisos.delete(card.arquivo);
      s.contagem = { arquivo: card.arquivo, versao: card.versao, rotulo, pedido, card, inicio: Date.now() };
      s.contagem.timer = setTimeout(() => confirmar(false), TEMPO_DESFAZER);
      s.contagem.tick = setInterval(segundos, 250);
      anunciar('Respondendo ' + rotulo + '. Dá para desfazer por 5 segundos.');
      desenhar();
      focar('desfazer:' + card.arquivo);
    }
    function segundos() {
      if (!s.contagem) return;
      const n = host.querySelector('.pcc-contagem__seg');
      if (n) n.textContent = Math.max(1, Math.ceil((TEMPO_DESFAZER - (Date.now() - s.contagem.inicio)) / 1000)) + ' s';
    }
    function desfazer() {
      if (!s.contagem) return;
      const c = s.contagem; parar();
      s.avisos.set(c.arquivo, { tipo: 'info', texto: 'Desfeito. Nada foi gravado.' });
      anunciar('Desfeito. Nada foi gravado.');
      desenhar();
      focar(c.pedido.feito ? 'tudo:' + c.arquivo : 'op:' + c.arquivo + ':' + c.pedido.opcao);
    }
    async function confirmar(saindo) {
      const c = s.contagem; if (!c) return;
      parar(); s.gravando = c.arquivo;
      if (!saindo) desenhar();
      const corpo = Object.assign({ arquivo: c.arquivo, versao: c.versao }, c.pedido);
      let j = {}, ok = false;
      try {
        const r = await fetch(api + '/responder', { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true,
          headers: { 'Content-Type': 'application/json', 'X-Pc-Cards-Token': s.token }, body: JSON.stringify(corpo) });
        j = await r.json().catch(() => ({})); ok = r.ok && j.ok === true;
      } catch { ok = false; }
      s.gravando = null;
      if (ok) {
        // servidor de antes do pacote 8 (3250 ainda sem reiniciar) nao manda o campo recado: fica so o Gravado
        const novo = typeof j.recado === 'boolean';
        const donoRecado = (/^codex$/i.test(j.sessao || '') ? 'o ' : 'a ') + j.sessao;
        const depois = !novo ? '' : j.perigoso ? ' ' + j.avisoPerigo : j.recado ? ' Recado para ' + donoRecado + ' na fila.' : '';
        const semRecado = !novo || j.recado ? '' : ' O recado para ' + donoRecado + ' não foi gravado: avise no chat.';
        s.sucesso = { arquivo: c.arquivo, card: c.card, texto: 'Gravado às ' + j.hora + ': ' + c.rotulo + '.' + depois + semRecado };
        anunciar('Gravado às ' + j.hora + '.');
        desenhar(); focar('topo');
        setTimeout(() => { s.sucesso = null; s.aberto = null; carregar(); }, 2600);
      } else {
        const t = j.mensagem || 'Não consegui gravar. Tente de novo.';
        s.avisos.set(c.arquivo, { tipo: 'erro', texto: t }); anunciar(t);
        carregar();
      }
    }

    // ---------- passo a passo ----------
    async function marcar(card, i, feito) {
      if (s.passoOcupado || s.contagem || s.gravando) return;
      s.passoOcupado = true;
      const antes = card.feitos.slice();
      card.feitos = feito ? Array.from(new Set(card.feitos.concat(i))).sort((a, b) => a - b) : card.feitos.filter(x => x !== i);
      s.recemFeito = feito ? card.arquivo + ':' + i : null;
      desenhar();
      const prox = card.passos.findIndex((_, k) => !card.feitos.includes(k));
      focar(prox >= 0 ? 'passo:' + card.arquivo + ':' + prox : (card.tipoLivre === 'passos' ? 'tudo:' + card.arquivo : (card.opcoes[0] ? 'op:' + card.arquivo + ':' + card.opcoes[0].indice : 'titulo:' + card.arquivo)));
      try {
        const r = await fetch(api + '/passo', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-Pc-Cards-Token': s.token },
          body: JSON.stringify({ arquivo: card.arquivo, chave: card.chavePassos, passo: i, feito }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw Error(j.mensagem || 'Não consegui marcar o passo.');
        card.feitos = j.feitos;
      } catch (e) {
        card.feitos = antes;
        s.avisos.set(card.arquivo, { tipo: 'erro', texto: e.message || 'Não consegui marcar o passo.' });
        anunciar(e.message || 'Não consegui marcar o passo.');
      }
      s.passoOcupado = false;
      if (!s.contagem && !s.gravando) desenhar();
      setTimeout(() => { s.recemFeito = null; }, 900);
    }

    async function copiar(texto, b) {
      let ok = false;
      try { await navigator.clipboard.writeText(texto); ok = true; } catch {
        try {
          const ta = el('textarea', 'pcc-sr'); ta.value = texto; ta.setAttribute('readonly', '');
          document.body.append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
        } catch { ok = false; }
      }
      b.replaceChildren(icone(ok ? 'check' : 'copiar'), el('span', 'pcc-cmd__rotulo', ok ? 'Copiado' : 'Copie à mão'));
      b.classList.toggle('pcc-cmd__copiar--ok', ok);
      anunciar(ok ? 'Comando copiado.' : 'Não deu para copiar. Selecione o texto.');
      setTimeout(() => { if (b.isConnected) { b.replaceChildren(icone('copiar'), el('span', 'pcc-cmd__rotulo', 'Copiar')); b.classList.remove('pcc-cmd__copiar--ok'); } }, 1600);
    }

    // ---------- desenho ----------
    function meta(card) {
      const m = el('div', 'pcc-meta');
      m.append(el('span', 'pcc-ponto pcc-ponto--' + card.familia), el('span', 'pcc-sessao', card.sessao));
      if (card.criado) { const q = el('span', 'pcc-quando', card.criado); if (card.criadoAbs) q.title = card.criadoAbs; m.append(q); }
      if (card.tipo) m.append(el('span', 'pcc-tag', card.tipo));
      if (card.exemplo) m.append(el('span', 'pcc-tag pcc-tag--exemplo', 'exemplo'));
      if (card.perigoso) m.append(el('span', 'pcc-tag pcc-tag--perigo', 'perigosa'));
      return m;
    }
    function passos(card) {
      const ol = el('ol', 'pcc-passos');
      const agora = card.passos.findIndex((_, k) => !card.feitos.includes(k));
      const podeMarcar = !card.bloqueado && !s.contagem && !s.gravando && !s.sucesso;
      card.passos.forEach((p, i) => {
        const feito = card.feitos.includes(i), atual = i === agora && !card.bloqueado;
        const li = el('li', 'pcc-passo' + (feito ? ' pcc-passo--feito' : '') + (atual ? ' pcc-passo--agora' : '') + (s.recemFeito === card.arquivo + ':' + i ? ' pcc-passo--pop' : ''));
        const num = el('span', 'pcc-passo__num');
        if (feito) num.append(icone('check')); else num.textContent = String(i + 1);
        const corpo = el('div', 'pcc-passo__corpo');
        const topo = el('div', 'pcc-passo__topo');
        topo.append(el('p', 'pcc-passo__texto', p.texto));
        if (atual) topo.append(el('span', 'pcc-agora', 'agora'));
        corpo.append(topo);
        const linha = (rotulo, valor, extra) => { if (!valor) return; const l = el('p', 'pcc-passo__linha' + (extra ? ' ' + extra : '')); l.append(el('b', '', rotulo + ' '), document.createTextNode(String(valor).replace(/\bCOORDENADOR\b/g,'Claude'))); corpo.append(l); };
        linha('Onde:', p.onde); linha('Botão:', p.botao); linha('Vai aparecer:', p.aparece); linha('Não mexa:', p.naoMexer, 'pcc-passo__linha--alerta');
        if (p.comando) {
          const cmd = el('div', 'pcc-cmd');
          const code = el('code', 'pcc-cmd__texto', p.comando);
          const b = botao('pcc-cmd__copiar', 'copiar:' + card.arquivo + ':' + i);
          b.append(icone('copiar'), el('span', 'pcc-cmd__rotulo', 'Copiar'));
          b.setAttribute('aria-label', 'Copiar o comando do passo ' + (i + 1));
          b.addEventListener('click', () => copiar(p.comando, b));
          cmd.append(code, b); corpo.append(cmd);
        }
        if (p.comandoRetido) linha('Comando:', 'tem dado sensível, pegue no chat.', 'pcc-passo__linha--alerta');
        if (p.miniatura) {
          const img = el('img', 'pcc-mini'); img.alt = 'Onde clicar no passo ' + (i + 1); img.loading = 'lazy';
          img.src = api + '/miniatura/' + encodeURIComponent(p.miniatura); corpo.append(img);
        }
        if (atual && podeMarcar && card.estado === 'pendente') {
          const b = botao('pcc-feito', 'passo:' + card.arquivo + ':' + i); b.append(icone('check'), document.createTextNode('Feito'));
          b.setAttribute('aria-label', 'Marcar o passo ' + (i + 1) + ' como feito');
          b.addEventListener('click', () => marcar(card, i, true)); corpo.append(b);
        } else if (feito && podeMarcar && card.estado === 'pendente') {
          const b = botao('pcc-desfazer-passo', 'despasso:' + card.arquivo + ':' + i, 'Desfazer');
          b.setAttribute('aria-label', 'Desmarcar o passo ' + (i + 1));
          b.addEventListener('click', () => marcar(card, i, false)); topo.append(b);
        }
        li.append(num, corpo); ol.append(li);
      });
      return ol;
    }
    function status(card) {
      const box = el('div', 'pcc-status');
      if (s.contagem && s.contagem.arquivo === card.arquivo) {
        box.classList.add('pcc-status--contagem');
        const linha = el('div', 'pcc-contagem');
        const t = el('p', 'pcc-contagem__texto'); t.append(el('span', '', 'Respondendo: '), el('b', '', s.contagem.rotulo));
        const seg = el('span', 'pcc-contagem__seg', Math.max(1, Math.ceil((TEMPO_DESFAZER - (Date.now() - s.contagem.inicio)) / 1000)) + ' s');
        const d = botao('pcc-desfazer', 'desfazer:' + card.arquivo, 'Desfazer'); d.addEventListener('click', desfazer);
        linha.append(t, seg, d);
        const trilho = el('div', 'pcc-contagem__trilho'), barra = el('div', 'pcc-contagem__barra');
        barra.style.animationDelay = '-' + (Date.now() - s.contagem.inicio) + 'ms';
        trilho.append(barra); box.append(linha, trilho);
        return box;
      }
      if (s.gravando === card.arquivo) { box.append(el('p', 'pcc-dica', 'Gravando no card...')); return box; }
      if (s.sucesso && s.sucesso.arquivo === card.arquivo) {
        box.classList.add('pcc-status--ok');
        const p = el('p', 'pcc-sucesso'); p.append(icone('check', 'pcc-ico--pop'), document.createTextNode(s.sucesso.texto)); box.append(p);
        return box;
      }
      const aviso = s.avisos.get(card.arquivo);
      if (aviso) { box.append(el('p', aviso.tipo === 'erro' ? 'pcc-erro' : 'pcc-dica', aviso.texto)); return box; }
      box.append(el('p', 'pcc-dica', card.tipoLivre === 'passos' ? 'Marque cada passo quando fizer. No fim, um clique grava no card.' : 'Um clique responde. Dá para desfazer por 5 s.'));
      return box;
    }
    function cardAberto(card) {
      const a = el('article', 'pcc-card pcc-card--' + card.familia + (card.bloqueado ? ' pcc-card--chat' : ''));
      a.append(meta(card));
      const h = el('h3', 'pcc-pergunta', card.restrito ? 'Assunto restrito' : card.pergunta); h.tabIndex = -1; h.dataset.foco = 'titulo:' + card.arquivo;
      a.append(h);
      if (card.passos.length) a.append(passos(card));
      if (card.bloqueado) {
        const c = el('div', 'pcc-chat');
        const t = el('p', 'pcc-chat__onde'); t.append(icone('cadeado'), document.createTextNode('Responder no ' + card.ondeResponder));
        c.append(t, el('p', 'pcc-chat__motivo', card.motivo));
        if (card.opcoes.length) {
          const o = el('p', 'pcc-chat__opcoes'); o.append(el('b', '', 'Opções: '));
          o.append(document.createTextNode(card.opcoes.map(x => x.label + (x.recomendada ? ' (recomendada)' : '')).join(' · ')));
          c.append(o);
        }
        a.append(c);
        return a;
      }
      const travado = !!(s.contagem || s.gravando || s.sucesso);
      if (card.perigoso && card.avisoPerigo) a.append(el('p', 'pcc-perigo', card.avisoPerigo));
      if (card.tipoLivre === 'decisao') {
        const ops = el('div', 'pcc-opcoes'); ops.setAttribute('role', 'group'); ops.setAttribute('aria-label', 'Opções');
        const naVez = s.contagem && s.contagem.arquivo === card.arquivo ? s.contagem.pedido.opcao : null;
        card.opcoes.forEach(o => {
          const b = botao('pcc-opcao' + (o.recomendada ? ' pcc-opcao--rec' : '') + (naVez === o.indice ? ' pcc-opcao--escolhida' : ''), 'op:' + card.arquivo + ':' + o.indice);
          const topo = el('span', 'pcc-opcao__topo'); topo.append(el('span', 'pcc-opcao__label', o.label));
          if (o.recomendada) topo.append(el('span', 'pcc-pilula', 'Recomendada'));
          b.append(topo);
          if (o.descricao) b.append(el('span', 'pcc-opcao__desc', o.descricao));
          b.disabled = travado;
          b.addEventListener('click', () => escolher(card, o.label, { opcao: o.indice }));
          ops.append(b);
        });
        a.append(ops);
      } else if (card.tipoLivre === 'passos') {
        const todos = card.passos.length && card.feitos.length === card.passos.length;
        if (todos) {
          const b = botao('pcc-opcao pcc-opcao--rec pcc-opcao--tudo', 'tudo:' + card.arquivo);
          const topo = el('span', 'pcc-opcao__topo'); topo.append(icone('check'), el('span', 'pcc-opcao__label', 'Tudo feito'));
          b.append(topo, el('span', 'pcc-opcao__desc', 'Grava no card que você terminou os ' + card.passos.length + ' passos.'));
          b.disabled = travado;
          b.addEventListener('click', () => escolher(card, 'Tudo feito', { feito: true }));
          a.append(b);
        }
      }
      a.append(status(card));
      return a;
    }
    function linhaCompacta(card) {
      const b = botao('pcc-linha', 'linha:' + card.arquivo);
      b.setAttribute('aria-expanded', 'false');
      b.append(el('span', 'pcc-ponto pcc-ponto--' + card.familia), el('span', 'pcc-linha__sessao', card.sessao), el('span', 'pcc-linha__pergunta', card.restrito ? 'Assunto restrito' : card.pergunta));
      const fim = el('span', 'pcc-linha__fim');
      if (card.bloqueado) { fim.classList.add('pcc-linha__fim--chat'); fim.append(icone('cadeado'), document.createTextNode('no ' + card.ondeResponder)); }
      else fim.append(document.createTextNode(card.tipoLivre === 'passos' ? card.passos.length + ' passos' : card.opcoes.length + ' opções'));
      fim.append(icone('seta', 'pcc-ico--seta'));
      b.append(fim);
      b.disabled = !!(s.contagem || s.gravando || s.sucesso);
      b.addEventListener('click', () => { s.aberto = card.arquivo; desenhar(); focar('titulo:' + card.arquivo); });
      return b;
    }
    function blocoPedidos(p) {
      const sec = el('section', 'pcc-bloco');
      const h = el('h3', 'pcc-bloco__titulo', 'Também esperando você, no chat');
      if (p && p.ok) h.append(el('span', 'pcc-conta pcc-conta--leve', String(p.itens.length)));
      sec.append(h);
      if (!p || !p.ok) { sec.append(el('p', 'pcc-bloco__sub', (p && p.motivo) || 'A lista de pedidos não carregou agora.')); return sec; }
      if (!p.itens.length) { sec.append(el('p', 'pcc-bloco__sub', 'Nenhum pedido fora dos cards.')); return sec; }
      sec.append(el('p', 'pcc-bloco__sub', 'Ainda não viraram card. Responda no chat indicado.'));
      const ul = el('ul', 'pcc-pedidos');
      const lista = s.verMais ? p.itens : p.itens.slice(0, 3);
      for (const it of lista) {
        const li = el('li', 'pcc-pedido');
        const aberto = s.pedidoAberto === it.id;
        const b = botao('pcc-pedido__linha', 'pedido:' + it.id);
        b.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        const chip = el('span', 'pcc-chip'); chip.append(icone('cadeado'), document.createTextNode(it.ondeResponder || 'no chat'));
        b.append(chip, el('span', 'pcc-pedido__titulo', it.titulo), icone('seta', 'pcc-ico--seta' + (aberto ? ' pcc-ico--aberta' : '')));
        b.addEventListener('click', () => { s.pedidoAberto = aberto ? null : it.id; desenhar(); focar('pedido:' + it.id); });
        li.append(b);
        if (aberto) {
          const d = el('div', 'pcc-pedido__detalhe');
          if (it.detalhe && it.detalhe !== it.titulo) d.append(el('p', '', it.detalhe));
          if (it.opcoes.length) { const o = el('p', 'pcc-chat__opcoes'); o.append(el('b', '', 'Opções: '), document.createTextNode(it.opcoes.map(x => x.label + (x.recomendada ? ' (recomendada)' : '')).join(' · '))); d.append(o); }
          d.append(el('p', 'pcc-chat__motivo', 'Responder no ' + (it.ondeResponder || 'chat de quem pediu') + '.'));
          li.append(d);
        }
        ul.append(li);
      }
      sec.append(ul);
      if (p.itens.length > 3) {
        const m = botao('pcc-mais', 'mais', s.verMais ? 'Mostrar menos' : 'Ver mais ' + (p.itens.length - 3));
        m.addEventListener('click', () => { s.verMais = !s.verMais; desenhar(); focar('mais'); });
        sec.append(m);
      }
      return sec;
    }
    function desenhar() {
      if (!s.vivo) return;
      const foco = focoAtual();
      const nos = [];
      const d = s.dados, lista = cards();
      const topo = el('header', 'pcc-topo'); topo.dataset.foco = 'topo'; topo.tabIndex = -1;
      if (comTitulo) {
        const h = el('h2', 'pcc-titulo', 'Precisa de você');
        if (d) h.append(el('span', 'pcc-conta' + (lista.length ? '' : ' pcc-conta--zero'), String(lista.length)));
        topo.append(h);
      }
      if (d) {
        const livres = lista.filter(c => !c.bloqueado).length, chat = lista.length - livres;
        const partes = [];
        if (livres) partes.push(livres === 1 ? '1 você responde aqui' : livres + ' você responde aqui');
        if (chat) partes.push(chat === 1 ? '1 só no chat' : chat + ' só no chat');
        const sub = el('p', 'pcc-sub', partes.length ? partes.join(' · ') : 'Nenhum card agora');
        sub.append(el('span', 'pcc-lido', 'lido às ' + d.lidoEm));
        topo.append(sub);
      }
      nos.push(topo);
      if (!d) nos.push(el('p', 'pcc-dica pcc-carregando', s.falhou ? 'Não consegui ler os cards agora. Tento de novo em 15 s.' : 'Lendo os cards...'));
      else {
        if (s.falhou) nos.push(el('p', 'pcc-erro', 'A última leitura falhou. Mostrando a anterior.'));
        if (!lista.length) {
          const v = el('div', 'pcc-vazio'); v.append(icone('calma', 'pcc-ico--calma'));
          const t = el('div'); t.append(el('p', 'pcc-vazio__t', 'Nada esperando você agora.'), el('p', 'pcc-vazio__s', 'Card novo aparece aqui sozinho.'));
          v.append(t); nos.push(v);
        } else {
          const aberto = abertoAgora();
          const fila = el('div', 'pcc-fila');
          for (const card of lista) fila.append(card.arquivo === aberto ? cardAberto(card) : linhaCompacta(card));
          nos.push(fila);
        }
        if (d.esperando && d.esperando.length) {
          const sec = el('section', 'pcc-bloco'); sec.append(el('h3', 'pcc-bloco__titulo', 'Feito, esperando conferir'));
          const ul = el('ul', 'pcc-lista');
          for (const c of d.esperando) {
            const li = el('li', 'pcc-esperando'); li.append(icone('check', 'pcc-ico--ok'));
            const t = el('span', 'pcc-esperando__t'); t.append(el('b', '', c.pergunta || 'Card'), document.createTextNode(' · você fez ' + (c.respondido || 'agora') + ', a ' + c.sessao + ' confere'));
            li.append(t); ul.append(li);
          }
          sec.append(ul); nos.push(sec);
        }
        if (comPedidos && d.pedidos !== null && d.pedidos !== undefined) nos.push(blocoPedidos(d.pedidos));
        if (d.respondidos && d.respondidos.length) {
          const det = el('details', 'pcc-resp');
          const sum = el('summary', 'pcc-resp__sum'); sum.dataset.foco = 'resp';
          sum.append(document.createTextNode('Últimas respostas'), el('span', 'pcc-conta pcc-conta--leve', String(d.respondidos.length)));
          det.append(sum);
          const ul = el('ul', 'pcc-lista');
          for (const c of d.respondidos) {
            const li = el('li', 'pcc-resp__item');
            const q = el('span', 'pcc-quando', c.respondido || ''); if (c.respondidoAbs) q.title = c.respondidoAbs;
            li.append(q, el('span', 'pcc-resp__sessao', c.sessao), el('span', 'pcc-resp__pergunta', c.pergunta || 'Assunto restrito'), el('span', 'pcc-resp__resposta', c.resposta));
            ul.append(li);
          }
          det.append(ul); nos.push(det);
        }
        if (d.ilegiveis) nos.push(el('p', 'pcc-nota', d.ilegiveis === 1 ? '1 card não abriu (arquivo com erro).' : d.ilegiveis + ' cards não abriram (arquivo com erro).'));
      }
      const abertos = host.querySelector('details.pcc-resp[open]') ? true : false;
      host.replaceChildren(...nos);
      if (abertos) { const det = host.querySelector('details.pcc-resp'); if (det) det.open = true; }
      focar(foco);
    }

    function visivel() {
      if (document.visibilityState === 'hidden') { if (s.contagem) confirmar(true); }
      else carregar();
    }
    const intervalo = setInterval(() => { if (document.visibilityState !== 'hidden' && !s.contagem && !s.gravando) carregar(); }, INTERVALO);
    document.addEventListener('visibilitychange', visivel);
    const saida = () => { if (s.contagem) confirmar(true); };
    window.addEventListener('pagehide', saida);
    host.addEventListener('keydown', e => { if (e.key === 'Escape' && s.contagem) { e.preventDefault(); desfazer(); } });
    desenhar(); carregar();
    const api_ = {
      recarregar: carregar,
      destruir() { s.vivo = false; parar(); clearInterval(intervalo); document.removeEventListener('visibilitychange', visivel); window.removeEventListener('pagehide', saida); host.remove(); fala.remove(); raiz.__pcc = null; }
    };
    raiz.__pcc = api_;
    return api_;
  }

  window.PainelPcCards = Object.freeze({ montar });
  function auto() { document.querySelectorAll('[data-pc-cards]').forEach(n => montar(n)); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
