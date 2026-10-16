'use strict';
// LIVRO V3: a tela Agora do tema LIVRO DE ORDENS no desenho V3 (anel FALAR no centro e o resto em volta).
// Serve /livro-v3.js e /livro-v3.css e GET /api/livro-v3. Nesta copia a tela so mostra o exemplo:
// com ?exemplo=1 ou na demonstracao (demo/rodar.sh) o dado e inventado aqui e nada do disco e lido;
// fora disso a resposta e "fechado" (e a tela abre em "Agora de antes"). POST /api/livro-v3/fila nunca grava nada; responde 409.
// As horas vao como instante (ms) e o navegador escreve a hora local.
// Gancho no servidor.cjs: const livroV3=require('./livro-v3-rota.cjs').create({root,port}); e, depois do blocos-livro,
//   if(await livroV3.handle(req,url,{send,example:example||process.env.PAINEL_DEMO==='1'}))return;
const fs = require('node:fs'), path = require('node:path');
const ASSETS = { '/livro-v3.js': ['livro-v3.js', 'text/javascript'], '/livro-v3.css': ['livro-v3.css', 'text/css'] };
const FECHADO = 'Esta tela mostra só o exemplo. Para os seus dados, use Agora de antes no menu. Para ver o exemplo, rode a demonstração: bash demo/rodar.sh.';
// a mesma frase do card perigoso no exemplo e na tela (livro-v3.js tem a mesma constante)
const PERIGO = 'Perigoso: só vale com prova; responda no chat da sessão.';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// dado inventado para o exemplo e para os prints: nada aqui vem do disco
function exemplo(agora) {
  const ms = min => agora - min * 60000;
  const hoje = new Date(agora), seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (hoje.getDay() + 6) % 7), dom = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 6);
  const datas = seg.getDate() + (seg.getMonth() === dom.getMonth() ? '' : ' ' + MESES[seg.getMonth()]) + ' a ' + dom.getDate() + ' ' + MESES[dom.getMonth()];
  return {
    ok: true, exemplo: true, geradoMs: agora, erros: [],
    topo: { seus: 4, frentes: 9, cards: 3 },
    voceResolve: { erro: null, itens: [
      { tipo: 'card', cardId: 'EXEMPLO-1', titulo: 'Qual das 3 artes vira o fundo da aba Ideias?', detalhe: 'Claude · há 12 min', perigoso: false, modo: 'opcoes', opcoes: [{ rotulo: 'Arte 2, escura', indice: 1, recomendada: true }, { rotulo: 'Arte 1', indice: 0, recomendada: false }, { rotulo: 'Arte 3', indice: 2, recomendada: false }], passos: [], idadeMin: 12 },
      { tipo: 'passo', titulo: 'Conferir o print novo da página do drop', detalhe: 'passo seu no chat da Loja · há 40 min', perigoso: false, passos: [], semBloco: 'sem bloco: o passo está no chat da sessão', idadeMin: 40 },
      { tipo: 'card', cardId: 'EXEMPLO-2', titulo: 'Qual trilha entra no vídeo de cortes da semana?', detalhe: 'Cortes · há 1 h', perigoso: false, modo: 'opcoes', opcoes: [{ rotulo: 'Trilha B, mais rápida', indice: 1, recomendada: true }, { rotulo: 'Trilha A', indice: 0, recomendada: false }], passos: [], idadeMin: 60 },
      { tipo: 'card', cardId: 'EXEMPLO-3', titulo: 'Card que só vale com prova', detalhe: 'Atendimento · há 2 h · ' + PERIGO, perigoso: true, modo: 'chat', opcoes: [], passos: [], idadeMin: 120 }
    ] },
    frentes: { erro: null, dadoHaMin: 3, itens: [
      ['Checkout do Projeto A', 80, '~40 min'], ['Agente de DM do Atendimento', 65, '~1h10'], ['Vídeo de cortes da semana', 55, '~2h', true],
      ['Placar dos criativos da Loja', 40, '~3h'], ['Página do drop no celular', 90, '~20 min'], ['Resumo da manhã', 30, 'sem prazo'],
      ['Atalhos de teclado nos cards', 70, '~1h'], ['Limpeza das abas velhas', 20, '~4h'], ['Tradução do guia', 95, '~10 min']
    ].map(([nome, pct, faltam, atencao]) => ({ nome, nomeInteiro: nome, pct, faltam, atencao: !!atencao })) },
    // doca: entregas mais perto de sair e projetos em LED (1 LED = 1 item)
    doca: {
      entregas: { lido: true, itens: [
        { nome: 'Página do drop no celular', pct: 90, estado: 'quase', passo: null },
        { nome: 'Checkout do Projeto A', pct: 75, estado: 'obra', passo: null },
        { nome: 'Vídeo de cortes da semana', pct: 98, estado: 'voce', passo: 'escolher a trilha' }
      ] },
      projetos: { lido: true, itens: [
        ['Projeto A', 'ar ar ar obra obra vez fila fila incerto ar ar fila fila fila obra'], ['Projeto B', 'ar ar obra obra obra fila fila fila'],
        ['Projeto C', 'ar obra vez fila fila fila'], ['Loja', 'ar ar ar ar obra fila']
      ].map(([nome, l]) => { const leds = l.split(' '); return { nome, leds, ar: leds.filter(x => x === 'ar').length, total: leds.length, vez: leds.filter(x => x === 'vez').length }; }) }
    },
    prontoHoje: { erro: null, nota: null, itens: ['Guia da aba Caixa', 'Landing revisada no celular', 'Teste do recado', 'Print da Fila'] },
    ajudantes: { erro: null, agora: 3, nota: 'Atendimento 2 · Loja 1', lidoHaS: 8 },
    ideias: { erro: null, hoje: 5, semana: 18, novas: 2, itens: [
      { haMin: 12, titulo: 'Abrir a Fila somente quando ela for usada', de: 'Atendimento', estado: 'nova' },
      { haMin: 50, titulo: 'Uma vitrine simples para cada loja', de: 'Loja', estado: 'nova' },
      { haMin: 190, titulo: 'Resumo do dia em 3 linhas', de: 'Claude', estado: 'no Conselho' }
    ] },
    contas: { erro: null, itens: [{ conta: 'A', semana: 42, atual: true }, { conta: 'B', semana: 67 }, { conta: 'C', semana: 85 }, { conta: 'D', semana: 12 }], proxima: 'D' },
    semana: { erro: null, datas, itens: [
      { texto: 'Landing revisada no celular', estado: 'pronto' }, { texto: 'Checkout do Projeto A no ar', estado: 'anda' }, { texto: 'Vídeo de cortes da semana', estado: 'anda' },
      { texto: 'Drop de sexta na Loja', estado: 'falta' }, { texto: 'Guia em pt, en e es', estado: 'pronto' }
    ] },
    feed: { erro: null, nota: null, itens: [
      [2, 'CLAUDE', 'Atendimento terminou o teste do agente de DM; o print está na fila de revisão.'],
      [4, 'CODEX', 'Revisão da landing pronta: 2 ajustes de texto no rodapé.'],
      [7, 'CLAUDE', 'Card novo de Cortes sobre a trilha do vídeo.'],
      [12, 'CLAUDE', 'Guia da aba Caixa pronto em pt, en e es.'],
      [18, 'CLAUDE', 'Loja com 3 criativos no teste; o placar sai no fim do dia.'],
      [24, 'CLAUDE', 'A fila andou: 2 frentes fecharam e 1 abriu.']
    ].map(([min, quem, texto]) => ({ ms: ms(min), quem, texto })) },
    conversa: [
      { eu: true, rotulo: 'VOCÊ · VOZ', ms: ms(9), texto: 'Como está a aba Ideias?' },
      { eu: false, rotulo: 'CLAUDE ·', ms: ms(9), texto: 'Fundo novo em teste; falta 1 card seu sobre a arte.' },
      { eu: true, rotulo: 'VOCÊ · TEXTO', ms: ms(3), texto: 'E o vídeo de cortes da semana?' },
      { eu: false, rotulo: 'CLAUDE ·', ms: ms(2), texto: 'A trilha B ficou melhor; espera o seu card.' }
    ],
    recado: { erro: null, sessoes: [['Atendimento', 'ATENDIMENTO', 6], ['Cortes', 'CORTES', 35], ['Loja', 'LOJA', null]]
      .map(([chave, rotulo, min]) => ({ chave, rotulo, ultimoMs: min === null ? null : ms(min) })),
      historico: [
        { ms: ms(6), sessao: 'ATENDIMENTO', texto: 'Responde primeiro as DMs da manhã.', estado: 'lida', lidaMs: ms(5), retorno: { ms: ms(5), texto: 'Combinado, faço isso agora.' } },
        { ms: ms(35), sessao: 'CORTES', texto: 'Corta o vídeo em 3 partes curtas.', estado: 'lida', lidaMs: ms(33), retorno: { ms: ms(33), texto: 'Fechado, sai depois do almoço.' } }
      ] }
  };
}

function create({ relogio = Date.now } = {}) {
  async function handle(req, url, { send, example = false }) {
    const asset = ASSETS[url.pathname];
    if (asset) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { req.resume(); send(405, { ok: false, error: 'Somente leitura' }); return true; }
      try { send(200, fs.readFileSync(path.join(__dirname, asset[0])), asset[1]); } catch { send(404, { ok: false, error: 'Arquivo ausente' }); }
      return true;
    }
    if (url.pathname === '/api/livro-v3/fila') {
      req.resume();
      if (req.method !== 'POST') send(405, { ok: false, texto: 'só pelos botões da tela' });
      else send(409, { ok: false, texto: 'exemplo: nada é enviado' });
      return true;
    }
    if (url.pathname !== '/api/livro-v3') return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') { req.resume(); send(405, { ok: false, error: 'Somente leitura' }); return true; }
    send(200, example ? exemplo(relogio()) : { ok: false, fechado: true, falta: FECHADO });
    return true;
  }
  return { handle };
}

module.exports = { create, exemplo, PERIGO };
