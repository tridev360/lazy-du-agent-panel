/* pe-anim.js: do tipo de acao do agente para a classe do pe-anim.css.
   Duas entradas: (a) Codex, pelo state e lastAction que o /api/estado ja traz em equipe.agents[];
   (b) Claude, pelo NOME da ultima ferramenta. Sem tipo conhecido: generico. Nunca inventa tipo.
   A "dica" (opcional) e so testada por regex aqui e nunca guardada nem mostrada. Sem rede, sem style inline. */
(function (root) {
  'use strict';
  const TIPOS = ['escrevendo', 'lendo', 'executando', 'testando', 'revisando', 'subindo', 'ajudante', 'falando', 'esperando', 'terminou', 'generico', 'parado'];
  const ROTULOS = {
    escrevendo: { pt: 'escrevendo código', en: 'writing code', es: 'escribiendo código' },
    lendo: { pt: 'lendo e pesquisando', en: 'reading and searching', es: 'leyendo y buscando' },
    executando: { pt: 'executando comando', en: 'running a command', es: 'ejecutando comando' },
    testando: { pt: 'testando', en: 'testing', es: 'probando' },
    revisando: { pt: 'revisando', en: 'reviewing', es: 'revisando' },
    subindo: { pt: 'subindo ao ar', en: 'going live', es: 'subiendo' },
    conferindo: { pt: 'conferindo o ar', en: 'checking live', es: 'revisando en vivo' },
    ajudante: { pt: 'chamando ajudante', en: 'calling a helper', es: 'llamando a un ayudante' },
    esperaAjudante: { pt: 'esperando ajudante', en: 'waiting for a helper', es: 'esperando a un ayudante' },
    falando: { pt: 'falando com a equipe', en: 'talking to the team', es: 'hablando con el equipo' },
    esperando: { pt: 'esperando você', en: 'waiting for you', es: 'esperándote' },
    terminou: { pt: 'terminou', en: 'done', es: 'terminó' },
    generico: { pt: 'trabalhando', en: 'working', es: 'trabajando' },
    aguardando: { pt: 'aguardando', en: 'waiting', es: 'en espera' },
    parado: { pt: 'parado', en: 'idle', es: 'inactivo' },
    pausa: { pt: 'esperando', en: 'waiting', es: 'esperando' }
  };
  // (b) Claude: nome da ferramenta (prefixo mcp__servidor__ cai fora antes).
  const CLAUDE = {
    Edit: 'escrevendo', Write: 'escrevendo', NotebookEdit: 'escrevendo', MultiEdit: 'escrevendo',
    Read: 'lendo', Grep: 'lendo', Glob: 'lendo', WebFetch: 'lendo', WebSearch: 'lendo', get_page_text: 'lendo', read_page: 'lendo',
    Bash: 'executando', PowerShell: 'executando',
    Agent: 'ajudante', Task: 'ajudante',
    SendMessage: 'falando', send_message: 'falando',
    AskUserQuestion: 'esperando', ExitPlanMode: 'esperando',
    SubagentHandback: 'terminou'
  };
  // (a) Codex: nome cru da ferramenta, quando vier.
  const CODEX = {
    apply_patch: 'escrevendo', exec: 'executando', exec_command: 'executando', web__run: 'lendo', view_image: 'lendo',
    spawn_agent: 'ajudante', send_message: 'falando', send_message_to_thread: 'falando', followup_task: 'falando',
    request_user_input: 'esperando', request_user_input_async: 'esperando'
  };
  // (a) Codex: lastAction do snapshot (rotulos do TOOLS do equipe.cjs e do leitor de metadados).
  const ACAO = {
    'Edita arquivos': 'escrevendo', 'Escreve arquivos': 'escrevendo',
    'Le arquivos': 'lendo', 'Busca nos arquivos': 'lendo', 'Busca arquivos': 'lendo', 'Pesquisa': 'lendo', 'Olha imagens': 'lendo',
    'Terminal': 'executando',
    'Chama ajudantes': 'ajudante', 'Espera ajudante': ['ajudante', 'esperaAjudante'],
    'Conversa com equipe': 'falando', 'Passa tarefa': 'falando',
    'Precisa revisar': 'esperando',
    'Terminou o passo': 'terminou', 'Passo encerrado': 'terminou',
    'Espera': ['generico', 'aguardando']
  };
  const ESPERA_FERRAMENTA = { wait: ['generico', 'aguardando'], sleep: ['generico', 'aguardando'], wait_agent: ['ajudante', 'esperaAjudante'], wait_threads: ['ajudante', 'esperaAjudante'] };
  // dica (comando do terminal, tipo do ajudante, nome da skill): so refina, nunca cria trabalho.
  const DICAS = [
    [/\bhospedagem\s+up\b/i, 'subindo', 'subindo'],
    [/\bhospedagem\s+(?:status|logs)\b|app\.com/i, 'subindo', 'conferindo'],
    [/\b(?:vitest|jest|mocha|pytest|playwright\s+test|node\s+--test|npm\s+(?:run\s+)?test|typecheck|tsc\b)/i, 'testando', 'testando'],
    [/\brevisor|\breview\b|code-review|security-review/i, 'revisando', 'revisando']
  ];
  const TRABALHA = new Set(['working', 'walking', 'trabalhando', 'ativo', '']);
  const PARADO = new Set(['unknown', 'sleeping', 'dormindo', 'sem-leitura', 'parado', 'idle', 'antiga']);

  const curto = nome => String(nome || '').split('__').pop().trim();
  const par = (v, rotulo) => Array.isArray(v) ? { tipo: v[0], rotulo: v[1] } : { tipo: v, rotulo: rotulo || v };

  function porDica(base, dica) {
    if (!dica || (base.tipo !== 'executando' && base.tipo !== 'ajudante' && base.tipo !== 'generico')) return base;
    const texto = String(dica).slice(0, 400);
    for (const [re, tipo, rotulo] of DICAS) if (re.test(texto)) return { tipo, rotulo };
    return base;
  }

  /* info: { familia: 'claude'|'codex', estado, acao (lastAction), ferramenta, dica, precisa }
     devolve { tipo, classe, rotulo: { pt, en, es } } */
  function tipoDe(info) {
    const i = info || {};
    const estado = String(i.estado || '').toLowerCase();
    const ferramenta = curto(i.ferramenta);
    const tabela = i.familia === 'codex' ? CODEX : CLAUDE;
    let r = null;
    if (i.precisa || estado === 'precisa') r = par('esperando');
    else if (estado === 'done' || estado === 'terminou') r = par('terminou');
    else if (estado === 'esperando') r = par('parado', 'pausa');
    else if (PARADO.has(estado)) r = par('parado');
    else {
      if (ferramenta && ESPERA_FERRAMENTA[ferramenta]) r = par(ESPERA_FERRAMENTA[ferramenta]);
      else if (ferramenta && (tabela[ferramenta] || CLAUDE[ferramenta] || CODEX[ferramenta])) r = par(tabela[ferramenta] || CLAUDE[ferramenta] || CODEX[ferramenta]);
      else if (i.acao && ACAO[i.acao]) r = par(ACAO[i.acao]);
      if (!r && estado === 'waiting') r = par('generico', 'aguardando');
      if (!r) r = par('generico');
      if (!TRABALHA.has(estado) && estado !== 'waiting') r = par('parado');
      else r = porDica(r, i.dica);
    }
    return { tipo: r.tipo, classe: 'pa-' + r.tipo, rotulo: ROTULOS[r.rotulo] || ROTULOS[r.tipo] };
  }

  /* poe a animacao no cartao (que ja tem position: relative e data-lado). Mesmo tipo e rotulo: nao mexe
     (assim o "terminou" toca 1 vez so, mesmo com a tela redesenhando). lingua: 'pt' | 'en' | 'es'. */
  function aplicar(card, info, lingua) {
    if (!card || !card.classList) return null;
    const t = tipoDe(info), texto = t.rotulo[lingua] || t.rotulo.pt;
    if (card.dataset.pa === t.tipo + '|' + texto) return t;
    const doc = card.ownerDocument;
    let fx = card.querySelector(':scope > .pa-fx'), tag = card.querySelector(':scope > .pa-tag');
    if (!fx) { fx = doc.createElement('span'); fx.className = 'pa-fx'; fx.setAttribute('aria-hidden', 'true'); card.appendChild(fx); }
    if (!tag) {
      tag = doc.createElement('span'); tag.className = 'pa-tag';
      const ico = doc.createElement('span'); ico.className = 'pa-ico'; ico.setAttribute('aria-hidden', 'true');
      for (const c of ['pa-a', 'pa-b', 'pa-c']) { const el = doc.createElement('i'); el.className = c; ico.appendChild(el); }
      const rot = doc.createElement('span'); rot.className = 'pa-rot';
      tag.append(ico, rot); card.appendChild(tag);
    }
    const mudouTipo = !card.classList.contains(t.classe);
    for (const k of TIPOS) card.classList.remove('pa-' + k);
    if (mudouTipo && t.tipo === 'terminou') void card.offsetWidth; // reinicia o 1 vez quando chega de outro tipo
    card.classList.add('pa-card', t.classe);
    tag.querySelector('.pa-rot').textContent = texto;
    card.dataset.pa = t.tipo + '|' + texto;
    return t;
  }

  function limpar(card) {
    if (!card || !card.classList) return;
    for (const k of TIPOS) card.classList.remove('pa-' + k);
    card.classList.remove('pa-card');
    card.querySelectorAll(':scope > .pa-fx, :scope > .pa-tag').forEach(el => el.remove());
    delete card.dataset.pa;
  }

  // aba escondida = pausa (o integrador chama 1 vez); devolve a funcao que desliga o ouvinte.
  function ligarPausa(doc) {
    const d = doc || root.document; if (!d) return () => {};
    const sync = () => d.documentElement.classList.toggle('pa-pausado', d.hidden === true);
    d.addEventListener('visibilitychange', sync); sync();
    return () => d.removeEventListener('visibilitychange', sync);
  }
  function desligar(sim, doc) { const d = doc || root.document; if (d) d.documentElement.classList.toggle('pa-desligado', !!sim); }

  const api = { TIPOS, ROTULOS, tipoDe, aplicar, limpar, ligarPausa, desligar };
  // (embutido no pe-equipe.js: so window.PaAnim; o module.exports e do pe-equipe)
  if (root) root.PaAnim = api;
})(typeof window !== 'undefined' ? window : globalThis);
/* ===== fim do pe-anim.js ===== */
/* Aba EQUIPE com as DUAS IAs.
 * Uso: <div data-pe-equipe></div> na aba Equipe, com pe-equipe.css e este arquivo carregados.
 * Gancho: com window.PainelGanchos, registra 'equipe' com {render(snapshot, ctx), destroy()}.
 *   snapshot = o objeto do GET /api/estado; ctx (opcional) = {mount: elemento, lang: 'pt' | 'en' | 'es'}.
 *   Sem os ganchos, monta sozinho em [data-pe-equipe] e le GET /api/estado a cada 15 s, so com a aba visivel.
 * ARVORE: Voce no topo e os dois lados lado a lado: COORDENADOR CLAUDE com ATENDIMENTO, LOJA, ASSISTENTE e CORTES e os ajudantes de cada
 *   uma; COORDENADOR CODEX com a guarda, as conversas do Codex e os executores. Cada caixa com o estado (trabalhando, esperando,
 *   dormindo, terminou) e a ultima atividade, pela MESMA regra que conta o topo e o numero do Inicio (ladosOf, uma fonte so).
 * FLUXO: Voce no meio, Claude de um lado e Codex do outro; os fios passam so pelos vaos entre as caixas (layoutFluxo, puro);
 *   particulas correm no sentido da mensagem (1 laco so em canvas, pausa com a aba escondida; Movimento off = fio aceso parado).
 * CORES (tokens --cor-voce, --cor-claude, --cor-codex do painel): rosa = voce, laranja = lado do Claude, azul = lado do Codex.
 *   Fio, particula e rotulo levam a cor de QUEM MANDA; o tipo (comando, duvida, resposta) vai no traco e no rotulo, sem cor.
 * Retratos: o Agente verificado de cada agente; quem nao tem pega um Agente livre do pacote verificado (GET /api/pe-equipe/agentes).
 * So leitura: nada e enviado. Sem estilo inline (CSP do painel): so classes, atributos e animacao por CSS, WAAPI ou canvas. */
(function (root) {
  'use strict';
  const LANGS = ['pt', 'en', 'es'];
  const W = {
    pt: {
      title: 'Equipe', workingNow: 'trabalhando agora', ofAgents: n => 'de ' + (n === 1 ? '1 agente' : n + ' agentes'),
      counts: { esperando: n => n + ' esperando', dormindo: n => n + ' dormindo', terminaram: n => n === 1 ? '1 terminou' : n + ' terminaram', semLeitura: n => n + ' sem leitura' },
      state: { trabalhando: 'Trabalhando', esperando: 'Esperando', dormindo: 'Dormindo', terminou: 'Terminou', 'sem-leitura': 'Sem leitura' },
      pick: 'Escolha um Agente', needsYou: 'Precisa de você',
      counting: pct => 'Contando os tokens' + (pct === null ? '...' : ' · ' + pct + '% lido'), countingShort: pct => 'contando, ' + pct + '%',
      consumption: 'Consumo da equipe', tokens: 'tokens', water: v => v + ' de água estimada', cups: n => n + ' copos de 250 ml',
      howCount: 'Como a conta é feita', tldr: 'Cada copo = 250 ml de água que o uso de IA da equipe gasta, em conta aproximada; não é medido.', how: 'Como calculamos',
      formula: 'Estimativa de brincadeira, sem medição: (entrada nova + saída + 10% da entrada em cache) ÷ 1.500 × 0,3 ml. Cada copo vale 250 ml. O copo em uso é o que está enchendo.',
      timeline: 'Linha do tempo', open: 'Abrir a linha do tempo de', request: 'Pedido', now: 'Agora', progress: 'Progresso', goal: 'Objetivo',
      phase: { read: 'Leitura', edit: 'Mudanças', run: 'Comandos', team: 'Equipe' },
      phaseHint: { read: 'lê e busca arquivos', edit: 'muda arquivos', run: 'roda comandos', team: 'chama ajudantes e manda recados' },
      times: n => n === 1 ? '1 vez' : n + ' vezes', notYet: 'ainda não', noPhase: 'fase não lida',
      askedAt: t => 'pedido às ' + t, yourLast: t => 'sua última mensagem às ' + t, reservedAsk: chat => 'assunto reservado · detalhe só ' + chat,
      chatOf: s => s === 'codex' ? 'na conversa do Codex' : 'no chat da ' + s,
      deliveredAt: t => 'entregue às ' + t, expected: t => 'entrega ~' + t, estimated: 'estimada', deadline: t => 'prazo ' + t,
      window: t => 'contado no fim da conversa, desde ' + t,
      end: 'Fim', who: { voce: 'você', ajudanteDe: s => 'um ajudante: ' + s, conversaCodex: 'uma conversa do Codex', outraSessao: 'outra sessão do Claude' },
      asked: (who, t) => who + ' pediu' + (t ? ' ' + W.pt.at(t) : ''), askedYou: t => 'você pediu' + (t ? ' ' + W.pt.at(t) : ''),
      range: (a, b) => a === b ? W.pt.at(a) : a + ' a ' + b, at: t => t.includes(' ') ? 'em ' + t.replace(' ', ' às ') : 'às ' + t, lastAction: t => 'última ação ' + W.pt.at(t),
      deliversTo: s => 'entrega para a ' + s, endDone: 'Terminou', endState: { trabalhando: 'Trabalhando agora', esperando: 'Esperando a próxima mensagem', dormindo: 'Parado', terminou: 'Terminou', 'sem-leitura': '?' },
      details: 'Detalhes', model: 'Modelo', startedAt: 'Começou', lastStep: 'Último passo', portrait: 'Retrato', side: 'Lado',
      ago: m => !Number.isFinite(m) ? '?' : m < 1 ? 'agora' : m < 60 ? 'há ' + m + ' min' : m < 1440 ? 'há ' + Math.floor(m / 60) + ' h' : 'há ' + Math.floor(m / 1440) + (Math.floor(m / 1440) === 1 ? ' dia' : ' dias'),
      close: 'Fechar', empty: 'Nenhum agente lido agora.', loading: 'Lendo a equipe...', readFail: 'Não deu para ler a equipe agora. Tento de novo em 15 s.',
      more: n => '+' + n, readAt: t => 'lido às ' + t,
      step: { read: 'Lê arquivos', edit: 'Muda arquivos', run: 'Roda comandos', team: 'Fala com a equipe', deliver: 'Entregou o trabalho' },
      views: { tree: 'Árvore', flow: 'Fluxo', label: 'Como ver a equipe' },
      tree: {
        title: 'As duas IAs', you: 'Você', owner: 'dono',
        waiting: n => n === null || n === undefined ? 'decisões: ?' : n === 0 ? 'nada esperando você' : n === 1 ? '1 decisão espera você' : n + ' decisões esperam você',
        side: { claude: 'Claude', codex: 'Codex' }, coord: { claude: 'COORDENADOR CLAUDE', codex: 'COORDENADOR CODEX' },
        coordRole: { claude: 'Coordena o lado do Claude', codex: 'Coordena o lado do Codex' },
        sideCount: (working, total) => working + ' trabalhando · ' + (total === 1 ? '1 agente' : total + ' agentes'),
        roles: { ATENDIMENTO: 'Cuida do atendimento e das subidas', LOJA: 'Produtos e pedidos', ASSISTENTE: 'Tracker e assistentes', CORTES: 'Posts, arte e vídeos' },
        codexConversation: 'Conversa do Codex', claudeConversation: 'Conversa do Claude',
        unreadName: { codex: 'Executores do Codex', claude: 'Ajudantes do Claude' }, unreadRole: 'de uma conversa que o painel não leu',
        guard: 'Guarda', guardRole: 'Ronda da fila e do estado', guardEvery: m => 'ronda a cada ~' + m + ' min', guardNone: 'ronda não lida',
        helpers: (n, working) => n === 0 ? 'nenhum ajudante agora' : (n === 1 ? '1 ajudante' : n + ' ajudantes') + (working ? ' · ' + working + ' trabalhando' : ''),
        executors: (n, working) => n === 0 ? 'nenhum executor agora' : (n === 1 ? '1 executor' : n + ' executores') + (working ? ' · ' + working + ' trabalhando' : ''),
        legend: { voce: 'você', claude: 'Claude', codex: 'Codex' }, unread: 'sem leitura',
        cards: n => n === 0 ? 'nenhum card esperando você' : n === 1 ? '1 card espera você' : n + ' cards esperam você', old: n => n === 1 ? '1 conversa antiga' : n + ' conversas antigas', oldHint: 'paradas há mais de 1 h', byActivity: 'conta pela atividade dos últimos 5 min'
      },
      flow: {
        title: 'Quem fala com quem · últimas 2 h', titleBase: 'Quem fala com quem',
        janela: { '2h': '2 h', '6h': '6 h', '12h': '12 h', '24h': '24 h', semana: 'Semana', mes: 'Mês', total: 'Total' }, janelaK: 'Período',
        janelaTitulo: (j, desde) => j === 'semana' ? 'últimos 7 dias' : j === 'mes' ? 'últimos 30 dias' : j === 'total' ? (desde ? 'desde ' + desde : 'todo o histórico') : 'últimas ' + j.replace('h', ' h'),
        histDesde: d => 'histórico desde ' + d, histLendo: 'lendo o histórico', histSem: 'histórico ainda não lido', histAjudantes: n => n === 1 ? '1 tarefa a ajudante' : n + ' tarefas a ajudantes', mensagens: n => n === 1 ? '1 mensagem' : n + ' mensagens', outrasCodex: 'outras conversas do Codex',
        names: { voce: 'você', 'coordenador-claude': 'coordenador claude', 'coordenador-codex': 'coordenador codex', atendimento: 'atendimento', loja: 'loja', cortes: 'cortes', assistente: 'assistente', codex: 'codex' },
        plain: { voce: 'você', 'coordenador-claude': 'COORDENADOR CLAUDE', 'coordenador-codex': 'COORDENADOR CODEX', atendimento: 'ATENDIMENTO', loja: 'LOJA', cortes: 'CORTES', assistente: 'ASSISTENTE', codex: 'Codex' },
        helpersOf: (name, codex) => (codex ? 'executores: ' : 'ajudantes: ') + name, helpersShort: codex => codex ? 'executores' : 'ajudantes',
        tag: { voce: 'DONO', coord: 'COORDENA', executa: 'EXECUTA', sessao: 'SESSÃO', conversa: 'CONVERSA' },
        waitingYou: n => n === null || n === undefined ? 'decisões ?' : n === 1 ? '1 decisão espera' : n + ' decisões esperam',
        spoke: t => 'falou ' + t,
        cards: n => n === 0 ? 'nenhum card' : n === 1 ? '1 card espera' : n + ' cards esperam', helpersWords: (total, now, codex) => total + (codex ? (total === 1 ? ' executor' : ' executores') : (total === 1 ? ' ajudante' : ' ajudantes')) + ' · ' + (now ? now + ' agora' : total === 1 ? 'parado' : 'parados'),
        helpersNow: (n, total) => n + ' de ' + total + ' ativos', helpersPill: (n, total) => n + '/' + total + ' ativos', helpersNone: 'nenhum agora',
        state: { trabalhando: 'trabalhando', esperando: 'esperando', dormindo: 'dormindo', terminou: 'terminou', 'sem-leitura': '?' },
        kind: { comando: 'comando', duvida: 'dúvida', resposta: 'resposta' }, kindTitle: 'tipo pelo traço', whoTitle: 'cor de quem manda',
        who: { voce: 'você', claude: 'Claude', codex: 'Codex' }, dot: 'partícula: rápida = mensagem há pouco, lenta = no período',
        to: 'para', count: n => n === 1 ? '1 mensagem' : n + ' mensagens', close: 'Fechar',
        motionOff: 'A animação está desligada neste PC.', motionOn: 'Ligar animação',
        workPulse: 'pulso: trabalho em andamento', helpersWorking: n => n + (n === 1 ? ' ajudante trabalhando' : ' ajudantes trabalhando'),
        topic: { painel: 'painel', equipe: 'equipe', fotos: 'fotos', tela: 'tela', testes: 'testes', revisao: 'revisão', subida: 'subida', card: 'card', status: 'status', fila: 'fila', credito: 'crédito', terminal: 'Terminal', atendimento: 'atendimento', loja: 'loja', lancamento: 'lançamento', codex: 'Codex' },
        about: list => 'sobre ' + list, reservedAt: chat => 'detalhe só ' + chat, reservedNoChat: 'assunto reservado',
        phrase: {
          despacho: 'mandou uma tarefa a um ajudante', recadoAjudante: 'mandou recado ao ajudante', entrega: 'o ajudante entregou o resultado',
          ajudante: { resposta: 'o ajudante mandou o resultado', duvida: 'o ajudante perguntou', comando: 'o ajudante pediu algo' },
          perguntaDono: 'perguntou a você', respostaDono: 'respondeu a você',
          dono: { comando: 'você mandou uma ordem', duvida: 'você perguntou', resposta: 'você respondeu' },
          sessao: { comando: 'mandou uma ordem', duvida: 'perguntou', resposta: 'mandou o resultado' },
          executorNovo: 'abriu um executor com uma tarefa', recadoExecutor: 'mandou recado ao executor', maisTarefa: 'passou mais uma tarefa ao executor',
          executorEntrega: 'o executor mandou o resultado', voz: 'você falou por voz',
          painel: { comando: 'você mandou pelo painel', duvida: 'você perguntou pelo painel', resposta: 'você respondeu pelo painel' },
          painelResposta: 'respondeu pelo painel'
        },
        empty: 'Nenhuma mensagem lida nas últimas 2 h.', loading: 'Lendo as conversas...',
        notRead: list => 'Sem leitura agora: ' + list, source: { claude: 'conversas do Claude', codex: 'conversas do Codex', painel: 'recados do painel', sessoes: 'lista das sessões' },
        hint: 'Clique num fio para ver o que passou por ele.', apart: n => n === 1 ? '1 conversa entre os dois lados está só na lista' : n + ' conversas entre os dois lados estão só na lista'
      }
    },
    en: {
      title: 'Team', workingNow: 'working now', ofAgents: n => 'of ' + (n === 1 ? '1 agent' : n + ' agents'),
      counts: { esperando: n => n + ' waiting', dormindo: n => n + ' sleeping', terminaram: n => n + ' finished', semLeitura: n => n + ' not read' },
      state: { trabalhando: 'Working', esperando: 'Waiting', dormindo: 'Sleeping', terminou: 'Finished', 'sem-leitura': 'Not read' },
      pick: 'Pick a Agente', needsYou: 'Needs you',
      counting: pct => 'Counting tokens' + (pct === null ? '...' : ' · ' + pct + '% read'), countingShort: pct => 'counting, ' + pct + '%',
      consumption: 'Team usage', tokens: 'tokens', water: v => v + ' of estimated water', cups: n => n + ' cups of 250 ml',
      howCount: 'How this is counted', tldr: 'Each cup = 250 ml of water the team\u2019s AI use takes, as a rough estimate; it is not measured.', how: 'How we estimate',
      formula: 'Playful estimate, not a measurement: (new input + output + 10% of cached input) ÷ 1,500 × 0.3 ml. Each cup is 250 ml. The current cup is the one filling up.',
      timeline: 'Timeline', open: 'Open the timeline of', request: 'Request', now: 'Now', progress: 'Progress', goal: 'Goal',
      phase: { read: 'Reading', edit: 'Changes', run: 'Commands', team: 'Team' },
      phaseHint: { read: 'reads and searches files', edit: 'changes files', run: 'runs commands', team: 'calls assistants and sends notes' },
      times: n => n === 1 ? '1 time' : n + ' times', notYet: 'not yet', noPhase: 'phase not read',
      askedAt: t => 'asked at ' + t, yourLast: t => 'your last message at ' + t, reservedAsk: chat => 'private subject · details only ' + chat,
      chatOf: s => s === 'codex' ? 'in the Codex chat' : 'in the ' + s + ' chat',
      deliveredAt: t => 'delivered at ' + t, expected: t => 'delivery ~' + t, estimated: 'estimated', deadline: t => 'deadline ' + t,
      window: t => 'counted at the end of the chat, since ' + t,
      end: 'End', who: { voce: 'you', ajudanteDe: s => 'a ' + s + ' assistant', conversaCodex: 'a Codex chat', outraSessao: 'another Claude session' },
      asked: (who, t) => who + ' asked' + (t ? ' ' + W.en.at(t) : ''), askedYou: t => 'you asked' + (t ? ' ' + W.en.at(t) : ''),
      range: (a, b) => a === b ? W.en.at(a) : a + ' to ' + b, at: t => / \d\d:\d\d$/.test(t) ? 'on ' + t.replace(/ (\d\d:\d\d)$/, ' at $1') : 'at ' + t, lastAction: t => 'last action ' + W.en.at(t),
      deliversTo: s => 'delivers to ' + s, endDone: 'Finished', endState: { trabalhando: 'Working now', esperando: 'Waiting for the next message', dormindo: 'Stopped', terminou: 'Finished', 'sem-leitura': '?' },
      details: 'Details', model: 'Model', startedAt: 'Started', lastStep: 'Last step', portrait: 'Portrait', side: 'Side',
      ago: m => !Number.isFinite(m) ? '?' : m < 1 ? 'now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + (Math.floor(m / 1440) === 1 ? ' day ago' : ' days ago'),
      close: 'Close', empty: 'No agent read right now.', loading: 'Reading the team...', readFail: 'Could not read the team now. Trying again in 15 s.',
      more: n => '+' + n, readAt: t => 'read at ' + t,
      step: { read: 'Reads files', edit: 'Changes files', run: 'Runs commands', team: 'Talks to the team', deliver: 'Delivered the work' },
      views: { tree: 'Tree', flow: 'Flow', label: 'How to see the team' },
      tree: {
        title: 'The two AIs', you: 'You', owner: 'owner',
        waiting: n => n === null || n === undefined ? 'decisions: ?' : n === 0 ? 'nothing waiting for you' : n === 1 ? '1 decision waiting for you' : n + ' decisions waiting for you',
        side: { claude: 'Claude', codex: 'Codex' }, coord: { claude: 'COORDENADOR CLAUDE', codex: 'COORDENADOR CODEX' },
        coordRole: { claude: 'Coordinates the Claude side', codex: 'Coordinates the Codex side' },
        sideCount: (working, total) => working + ' working · ' + (total === 1 ? '1 agent' : total + ' agents'),
        roles: { ATENDIMENTO: 'Support and deliveries', LOJA: 'Store and orders', ASSISTENTE: 'Automations and helpers', CORTES: 'Posts, art and videos' },
        codexConversation: 'Codex chat', claudeConversation: 'Claude chat',
        unreadName: { codex: 'Codex executors', claude: 'Claude assistants' }, unreadRole: 'from a chat the dashboard did not read',
        guard: 'Guard', guardRole: 'Rounds over the queue and state', guardEvery: m => 'a round every ~' + m + ' min', guardNone: 'round not read',
        helpers: (n, working) => n === 0 ? 'no assistant now' : (n === 1 ? '1 assistant' : n + ' assistants') + (working ? ' · ' + working + ' working' : ''),
        executors: (n, working) => n === 0 ? 'no executor now' : (n === 1 ? '1 executor' : n + ' executors') + (working ? ' · ' + working + ' working' : ''),
        legend: { voce: 'you', claude: 'Claude', codex: 'Codex' }, unread: 'not read',
        cards: n => n === 0 ? 'no card waiting for you' : n === 1 ? '1 card waiting for you' : n + ' cards waiting for you', old: n => n === 1 ? '1 old conversation' : n + ' old conversations', oldHint: 'stopped more than 1 h ago', byActivity: 'counted from activity in the last 5 min'
      },
      flow: {
        title: 'Who talks to whom · last 2 h', titleBase: 'Who talks to whom',
        janela: { '2h': '2 h', '6h': '6 h', '12h': '12 h', '24h': '24 h', semana: 'Week', mes: 'Month', total: 'All' }, janelaK: 'Period',
        janelaTitulo: (j, desde) => j === 'semana' ? 'last 7 days' : j === 'mes' ? 'last 30 days' : j === 'total' ? (desde ? 'since ' + desde : 'all history') : 'last ' + j.replace('h', ' h'),
        histDesde: d => 'history since ' + d, histLendo: 'reading the history', histSem: 'history not read yet', histAjudantes: n => n === 1 ? '1 work to a helper' : n + ' tasks to helpers', mensagens: n => n === 1 ? '1 message' : n + ' messages', outrasCodex: 'other Codex chats',
        names: { voce: 'you', 'coordenador-claude': 'claude coordenador', 'coordenador-codex': 'codex coordenador', atendimento: 'atendimento', loja: 'loja', cortes: 'cortes', assistente: 'assistente', codex: 'codex' },
        plain: { voce: 'you', 'coordenador-claude': 'CLAUDE COORDENADOR', 'coordenador-codex': 'CODEX COORDENADOR', atendimento: 'ATENDIMENTO', loja: 'LOJA', cortes: 'CORTES', assistente: 'ASSISTENTE', codex: 'Codex' },
        helpersOf: (name, codex) => name + (codex ? ' executors' : ' assistants'), helpersShort: codex => codex ? 'executors' : 'assistants',
        tag: { voce: 'OWNER', coord: 'LEADS', executa: 'EXECUTES', sessao: 'CHAT', conversa: 'CHAT' },
        waitingYou: n => n === null || n === undefined ? 'decisions ?' : n === 1 ? '1 decision waiting' : n + ' decisions waiting',
        spoke: t => 'spoke ' + t,
        cards: n => n === 0 ? 'no cards' : n === 1 ? '1 card waiting' : n + ' cards waiting', helpersWords: (total, now, codex) => total + (codex ? (total === 1 ? ' executor' : ' executors') : (total === 1 ? ' helper' : ' helpers')) + ' · ' + (now ? now + ' now' : 'stopped'),
        helpersNow: (n, total) => n + ' of ' + total + ' active', helpersPill: (n, total) => n + '/' + total + ' active', helpersNone: 'none now',
        state: { trabalhando: 'working', esperando: 'waiting', dormindo: 'sleeping', terminou: 'finished', 'sem-leitura': '?' },
        kind: { comando: 'command', duvida: 'question', resposta: 'answer' }, kindTitle: 'type by line', whoTitle: 'color of who sends',
        who: { voce: 'you', claude: 'Claude', codex: 'Codex' }, dot: 'particle: fast = recent message, slow = in the period',
        to: 'to', count: n => n === 1 ? '1 message' : n + ' messages', close: 'Close',
        motionOff: 'Animation is off on this PC.', motionOn: 'Turn animation on',
        workPulse: 'pulse: work in progress', helpersWorking: n => n + (n === 1 ? ' assistant working' : ' assistants working'),
        topic: { painel: 'dashboard', equipe: 'team', fotos: 'photos', tela: 'screen', testes: 'tests', revisao: 'review', subida: 'release', card: 'card', status: 'status', fila: 'queue', credito: 'credit', terminal: 'Terminal', atendimento: 'atendimento', loja: 'store', cortes: 'content', lancamento: 'launch', codex: 'Codex' },
        about: list => 'about ' + list, reservedAt: chat => 'details only ' + chat, reservedNoChat: 'private subject',
        phrase: {
          despacho: 'sent a work to an assistant', recadoAjudante: 'sent a note to the assistant', entrega: 'the assistant delivered the result',
          ajudante: { resposta: 'the assistant sent the result', duvida: 'the assistant asked', comando: 'the assistant asked for something' },
          perguntaDono: 'asked you', respostaDono: 'answered you',
          dono: { comando: 'you sent an order', duvida: 'you asked', resposta: 'you answered' },
          sessao: { comando: 'sent an order', duvida: 'asked', resposta: 'sent the result' },
          executorNovo: 'opened an executor with a task', recadoExecutor: 'sent a note to the executor', maisTarefa: 'gave the executor one more task',
          executorEntrega: 'the executor sent the result', voz: 'you spoke by voice',
          painel: { comando: 'you sent it from the dashboard', duvida: 'you asked from the dashboard', resposta: 'you answered from the dashboard' },
          painelResposta: 'answered on the dashboard'
        },
        empty: 'No message read in the last 2 h.', loading: 'Reading the chats...',
        notRead: list => 'Not read right now: ' + list, source: { claude: 'Claude chats', codex: 'Codex chats', painel: 'dashboard notes', sessoes: 'chat list' },
        hint: 'Click a wire to see what went through it.', apart: n => n === 1 ? '1 chat between the two sides is only in the list' : n + ' chats between the two sides are only in the list'
      }
    },
    es: {
      title: 'Equipo', workingNow: 'trabajando ahora', ofAgents: n => 'de ' + (n === 1 ? '1 agente' : n + ' agentes'),
      counts: { esperando: n => n + ' esperando', dormindo: n => n + ' durmiendo', terminaram: n => n === 1 ? '1 terminó' : n + ' terminaron', semLeitura: n => n + ' sin lectura' },
      state: { trabalhando: 'Trabajando', esperando: 'Esperando', dormindo: 'Durmiendo', terminou: 'Terminó', 'sem-leitura': 'Sin lectura' },
      pick: 'Elige un Agente', needsYou: 'Te necesita',
      counting: pct => 'Contando los tokens' + (pct === null ? '...' : ' · ' + pct + '% leído'), countingShort: pct => 'contando, ' + pct + '%',
      consumption: 'Consumo del equipo', tokens: 'tokens', water: v => v + ' de agua estimada', cups: n => n + ' vasos de 250 ml',
      howCount: 'Cómo se calcula', tldr: 'Cada vaso = 250 ml de agua que gasta el uso de IA del equipo, en cuenta aproximada; no se mide.', how: 'Cómo calculamos',
      formula: 'Estimación informal, sin medición: (entrada nueva + salida + 10% de la entrada en caché) ÷ 1.500 × 0,3 ml. Cada vaso equivale a 250 ml. El vaso de turno es el que se está llenando.',
      timeline: 'Línea de tiempo', open: 'Abrir la línea de tiempo de', request: 'Pedido', now: 'Ahora', progress: 'Progreso', goal: 'Objetivo',
      phase: { read: 'Lectura', edit: 'Cambios', run: 'Comandos', team: 'Equipo' },
      phaseHint: { read: 'lee y busca archivos', edit: 'cambia archivos', run: 'ejecuta comandos', team: 'llama ayudantes y manda notas' },
      times: n => n === 1 ? '1 vez' : n + ' veces', notYet: 'todavía no', noPhase: 'fase sin leer',
      askedAt: t => 'pedido a las ' + t, yourLast: t => 'tu último mensaje a las ' + t, reservedAsk: chat => 'asunto reservado · detalle solo ' + chat,
      chatOf: s => s === 'codex' ? 'en la conversación de Codex' : 'en el chat de ' + s,
      deliveredAt: t => 'entregado a las ' + t, expected: t => 'entrega ~' + t, estimated: 'estimada', deadline: t => 'plazo ' + t,
      window: t => 'contado al final de la conversación, desde ' + t,
      end: 'Fin', who: { voce: 'tú', ajudanteDe: s => 'un ayudante de ' + s, conversaCodex: 'una conversación de Codex', outraSessao: 'otra sesión de Claude' },
      asked: (who, t) => who + ' pidió' + (t ? ' ' + W.es.at(t) : ''), askedYou: t => 'tú pediste' + (t ? ' ' + W.es.at(t) : ''),
      range: (a, b) => a === b ? W.es.at(a) : 'de ' + a + ' a ' + b, at: t => t.includes(' ') ? 'el ' + t.replace(' ', ' a las ') : 'a las ' + t, lastAction: t => 'última acción ' + W.es.at(t),
      deliversTo: s => 'entrega a ' + s, endDone: 'Terminó', endState: { trabalhando: 'Trabajando ahora', esperando: 'Esperando el próximo mensaje', dormindo: 'Parado', terminou: 'Terminó', 'sem-leitura': '?' },
      details: 'Detalles', model: 'Modelo', startedAt: 'Empezó', lastStep: 'Último paso', portrait: 'Retrato', side: 'Lado',
      ago: m => !Number.isFinite(m) ? '?' : m < 1 ? 'ahora' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.floor(m / 60) + ' h' : 'hace ' + Math.floor(m / 1440) + (Math.floor(m / 1440) === 1 ? ' día' : ' días'),
      close: 'Cerrar', empty: 'Ningún agente leído ahora.', loading: 'Leyendo el equipo...', readFail: 'No se pudo leer el equipo ahora. Reintento en 15 s.',
      more: n => '+' + n, readAt: t => 'leído a las ' + t,
      step: { read: 'Lee archivos', edit: 'Cambia archivos', run: 'Ejecuta comandos', team: 'Habla con el equipo', deliver: 'Entregó el trabajo' },
      views: { tree: 'Árbol', flow: 'Flujo', label: 'Cómo ver el equipo' },
      tree: {
        title: 'Las dos IAs', you: 'Tú', owner: 'dueño',
        waiting: n => n === null || n === undefined ? 'decisiones: ?' : n === 0 ? 'nada te espera' : n === 1 ? '1 decisión te espera' : n + ' decisiones te esperan',
        side: { claude: 'Claude', codex: 'Codex' }, coord: { claude: 'COORDENADOR CLAUDE', codex: 'COORDENADOR CODEX' },
        coordRole: { claude: 'Coordina el lado de Claude', codex: 'Coordina el lado de Codex' },
        sideCount: (working, total) => working + ' trabajando · ' + (total === 1 ? '1 agente' : total + ' agentes'),
        roles: { ATENDIMENTO: 'Atención y entregas', LOJA: 'Tienda y pedidos', ASSISTENTE: 'Automatizaciones y ayudantes', CORTES: 'Posts, arte y videos' },
        codexConversation: 'Conversación de Codex', claudeConversation: 'Conversación de Claude',
        unreadName: { codex: 'Ejecutores de Codex', claude: 'Ayudantes de Claude' }, unreadRole: 'de una conversación que el panel no leyó',
        guard: 'Guardia', guardRole: 'Ronda de la cola y del estado', guardEvery: m => 'ronda cada ~' + m + ' min', guardNone: 'ronda sin leer',
        helpers: (n, working) => n === 0 ? 'ningún ayudante ahora' : (n === 1 ? '1 ayudante' : n + ' ayudantes') + (working ? ' · ' + working + ' trabajando' : ''),
        executors: (n, working) => n === 0 ? 'ningún ejecutor ahora' : (n === 1 ? '1 ejecutor' : n + ' ejecutores') + (working ? ' · ' + working + ' trabajando' : ''),
        legend: { voce: 'tú', claude: 'Claude', codex: 'Codex' }, unread: 'sin lectura',
        cards: n => n === 0 ? 'ninguna tarjeta te espera' : n === 1 ? '1 tarjeta te espera' : n + ' tarjetas te esperan', old: n => n === 1 ? '1 conversación antigua' : n + ' conversaciones antiguas', oldHint: 'paradas hace más de 1 h', byActivity: 'cuenta por la actividad de los últimos 5 min'
      },
      flow: {
        title: 'Quién habla con quién · últimas 2 h', titleBase: 'Quién habla con quién',
        janela: { '2h': '2 h', '6h': '6 h', '12h': '12 h', '24h': '24 h', semana: 'Semana', mes: 'Mes', total: 'Total' }, janelaK: 'Período',
        janelaTitulo: (j, desde) => j === 'semana' ? 'últimos 7 días' : j === 'mes' ? 'últimos 30 días' : j === 'total' ? (desde ? 'desde ' + desde : 'todo el historial') : 'últimas ' + j.replace('h', ' h'),
        histDesde: d => 'historial desde ' + d, histLendo: 'leyendo el historial', histSem: 'historial aún no leído', histAjudantes: n => n === 1 ? '1 tarea a un ayudante' : n + ' tareas a ayudantes', mensagens: n => n === 1 ? '1 mensaje' : n + ' mensajes', outrasCodex: 'otras conversaciones de Codex',
        names: { voce: 'tú', 'coordenador-claude': 'coordenador claude', 'coordenador-codex': 'coordenador codex', atendimento: 'atendimento', loja: 'loja', cortes: 'cortes', assistente: 'assistente', codex: 'codex' },
        plain: { voce: 'tú', 'coordenador-claude': 'COORDENADOR CLAUDE', 'coordenador-codex': 'COORDENADOR CODEX', atendimento: 'ATENDIMENTO', loja: 'LOJA', cortes: 'CORTES', assistente: 'ASSISTENTE', codex: 'Codex' },
        helpersOf: (name, codex) => (codex ? 'ejecutores de ' : 'ayudantes de ') + name, helpersShort: codex => codex ? 'ejecutores' : 'ayudantes',
        tag: { voce: 'DUEÑO', coord: 'COORDINA', executa: 'EJECUTA', sessao: 'SESIÓN', conversa: 'CONVERSACIÓN' },
        waitingYou: n => n === null || n === undefined ? 'decisiones ?' : n === 1 ? '1 decisión espera' : n + ' decisiones esperan',
        spoke: t => 'habló ' + t,
        cards: n => n === 0 ? 'ninguna tarjeta' : n === 1 ? '1 tarjeta espera' : n + ' tarjetas esperan', helpersWords: (total, now, codex) => total + (codex ? (total === 1 ? ' ejecutor' : ' ejecutores') : (total === 1 ? ' ayudante' : ' ayudantes')) + ' · ' + (now ? now + ' ahora' : total === 1 ? 'parado' : 'parados'),
        helpersNow: (n, total) => n + ' de ' + total + ' activos', helpersPill: (n, total) => n + '/' + total + ' activos', helpersNone: 'ninguno ahora',
        state: { trabalhando: 'trabajando', esperando: 'esperando', dormindo: 'durmiendo', terminou: 'terminó', 'sem-leitura': '?' },
        kind: { comando: 'orden', duvida: 'duda', resposta: 'respuesta' }, kindTitle: 'tipo por el trazo', whoTitle: 'color de quien manda',
        who: { voce: 'tú', claude: 'Claude', codex: 'Codex' }, dot: 'partícula: rápida = mensaje reciente, lenta = en el período',
        to: 'para', count: n => n === 1 ? '1 mensaje' : n + ' mensajes', close: 'Cerrar',
        motionOff: 'La animación está apagada en este PC.', motionOn: 'Encender animación',
        workPulse: 'pulso: trabajo en curso', helpersWorking: n => n + (n === 1 ? ' ayudante trabajando' : ' ayudantes trabajando'),
        topic: { painel: 'panel', equipe: 'equipo', fotos: 'fotos', tela: 'pantalla', testes: 'pruebas', revisao: 'revisión', subida: 'publicación', card: 'tarjeta', status: 'estado', fila: 'cola', credito: 'crédito', terminal: 'Terminal', atendimento: 'atención', loja: 'tienda', cortes: 'contenido', lancamento: 'lanzamiento', codex: 'Codex' },
        about: list => 'sobre ' + list, reservedAt: chat => 'detalle solo ' + chat, reservedNoChat: 'asunto reservado',
        phrase: {
          despacho: 'mandó una tarea a un ayudante', recadoAjudante: 'mandó una nota al ayudante', entrega: 'el ayudante entregó el resultado',
          ajudante: { resposta: 'el ayudante mandó el resultado', duvida: 'el ayudante preguntó', comando: 'el ayudante pidió algo' },
          perguntaDono: 'te preguntó', respostaDono: 'te respondió',
          dono: { comando: 'mandaste una orden', duvida: 'preguntaste', resposta: 'respondiste' },
          sessao: { comando: 'mandó una orden', duvida: 'preguntó', resposta: 'mandó el resultado' },
          executorNovo: 'abrió un ejecutor con una tarea', recadoExecutor: 'mandó una nota al ejecutor', maisTarefa: 'le pasó otra tarea al ejecutor',
          executorEntrega: 'el ejecutor mandó el resultado', voz: 'hablaste por voz',
          painel: { comando: 'mandaste desde el panel', duvida: 'preguntaste desde el panel', resposta: 'respondiste desde el panel' },
          painelResposta: 'respondió en el panel'
        },
        empty: 'Ningún mensaje leído en las últimas 2 h.', loading: 'Leyendo las conversaciones...',
        notRead: list => 'Sin lectura ahora: ' + list, source: { claude: 'conversaciones de Claude', codex: 'conversaciones de Codex', painel: 'notas del panel', sessoes: 'lista de sesiones' },
        hint: 'Haz clic en un hilo para ver lo que pasó por él.', apart: n => n === 1 ? '1 conversación entre los dos lados está solo en la lista' : n + ' conversaciones entre los dos lados están solo en la lista'
      }
    }
  };

  // ---------- modelo (puro: roda no navegador e no node --test) ----------
  const SLEEP_MS = 10 * 60 * 1000, FUTURE_MS = 2 * 60 * 1000;
  const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
  const finite = value => Number.isFinite(value) && value >= 0;
  const stamp = value => { const at = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(at) ? at : null; };
  const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const langOf = value => LANGS.includes(value) ? value : 'pt';
  function clock(value, lang) {
    const at = stamp(value); if (at === null) return null;
    try { return new Intl.DateTimeFormat(LOCALE[langOf(lang)], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date(at)); } catch { return null; }
  }
  function clockDay(value, lang, now) {
    const at = stamp(value), time = clock(value, lang); if (at === null || !time) return null;
    try {
      const day = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
      if (day(at) === day(Number.isFinite(now) ? now : Date.now())) return time;
      const label = langOf(lang) === 'en' ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', month: 'short', day: 'numeric' }).format(new Date(at)) : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(at));
      return label + ' ' + time;
    } catch { return time; }
  }
  function compact(value, lang) {
    if (!finite(value)) return '?';
    try { return new Intl.NumberFormat(LOCALE[langOf(lang)], { notation: 'compact', maximumFractionDigits: 1 }).format(value); } catch { return String(Math.round(value)); }
  }
  function whole(value, lang) {
    if (!finite(value)) return '?';
    try { return new Intl.NumberFormat(LOCALE[langOf(lang)], { maximumFractionDigits: 0 }).format(value); } catch { return String(Math.round(value)); }
  }
  function agoOf(at, now, lang) { const t = stamp(at); return W[langOf(lang)].ago(t === null ? NaN : Math.max(0, Math.floor((now - t) / 60000))); }

  // Estados simples, UMA regra para a tela inteira (topo, arvore, fluxo, detalhe e o numero do Inicio):
  // trabalhando, esperando, dormindo (parado 10+ min), terminou ou sem leitura. Hora no futuro nao vale (vira "sem leitura").
  const ESTADOS = ['trabalhando', 'esperando', 'dormindo', 'terminou', 'sem-leitura'];
  const PE_STATE = { trabalhando: 'working', esperando: 'waiting', dormindo: 'sleeping', terminou: 'done', 'sem-leitura': 'unknown' };
  const METADATA_MS = 30000, RETAINED_READING_MS = 300000, METADATA_POLICY = 'pe-scalar-v1';
  const FRONT_LABELS = {};
  const scalarContext = new WeakMap();
  const has = (value, key) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
  const nativeId = value => typeof value === 'string' && /^(codex|claude):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
  const scalarMode = value => has(value, 'metadataProof') || Boolean(value && value.equipe && (value.equipe.source === 'scalar-metadata' || Array.isArray(value.equipe.agents) && value.equipe.agents.some(agent => has(agent, 'workProof')))) || Boolean(value && Array.isArray(value.nodes) && value.nodes.some(node => has(node, 'workProof') || node && Array.isArray(node.members)));
  function metadataContext(value, now) {
    const proof = value && value.metadataProof, observedAt = stamp(proof && proof.observedAt);
    const retained = Boolean(proof && proof.mode === 'scalar-metadata' && proof.policyId === METADATA_POLICY && Number.isInteger(proof.revision) && proof.revision > 0 && typeof proof.complete === 'boolean' && observedAt !== null && finite(now) && now >= observedAt && now - observedAt <= RETAINED_READING_MS);
    const valid = retained && now - observedAt <= METADATA_MS;
    const coverage = proof && proof.coverage;
    const finished = valid && coverage && coverage.finished === true && ['read', 'unread', 'unknown', 'durationMs'].every(key => Number.isInteger(coverage[key]) && coverage[key] >= 0) && coverage.unknown <= coverage.read;
    return { scalar: scalarMode(value), valid, retained, observedAt, policyId: proof && proof.policyId, revision: proof && proof.revision, coverage: finished ? coverage : null,
      complete: valid && proof.complete === true && value.readerStatus === 'ready' && !(value.equipe && value.equipe.scanning === true) };
  }
  function workState(entity, context, now) {
    if (!context || !context.valid || !finite(now) || !finite(context.observedAt) || context.policyId !== METADATA_POLICY || !Number.isInteger(context.revision) || context.revision <= 0 || !entity || entity.observer === true || entity.observador === true || entity.stale === true || entity.unknown === true || /^(observer|observador)$/i.test(String(entity.role || ''))) return 'unknown';
    if (now < context.observedAt || now - context.observedAt > METADATA_MS) return 'unknown';
    const proof = entity.workProof, family = familyOf(entity), seen = stamp(proof && proof.observedAt), started = stamp(proof && proof.startedAt), closed = stamp(proof && proof.closedAt);
    if (!proof || !family || proof.source !== family + '.lifecycle' || !['working', 'waiting', 'done', 'unknown'].includes(proof.state)) return 'unknown';
    if (seen === null || seen > now || now - seen > METADATA_MS || started === null || started > seen) return 'unknown';
    if (has(entity, 'state') && entity.state !== proof.state) return 'unknown';
    if (proof.closedAt != null && (closed === null || closed < started || closed > seen)) return 'unknown';
    if (proof.state === 'working' && proof.closedAt != null || proof.state === 'done' && closed === null) return 'unknown';
    return proof.state;
  }
  function presentationLabel(value, rootId, lang, context, now) {
    if (!context || !context.valid || !finite(now) || !finite(context.observedAt) || context.policyId !== METADATA_POLICY || !Number.isInteger(context.revision) || context.revision <= 0 || now < context.observedAt || now - context.observedAt > METADATA_MS || !value || value.proofSource !== 'approved-id' || !nativeId(rootId) || nativeId(value.rootId) !== nativeId(rootId) || !has(FRONT_LABELS, value.frontId)) return null;
    return FRONT_LABELS[value.frontId][langOf(lang)];
  }
  function scalarEntity(entity, id, family, parentId, conversationId) {
    const raw = { id, family, parentId, conversationId, source: 'scalar-metadata', workProof: entity.workProof,
      presentation: entity.presentation, lastAt: entity.lastAt, eventLastAt: entity.eventLastAt };
    for (const key of ['state', 'observer', 'observador', 'stale', 'unknown', 'role']) if (has(entity, key)) raw[key] = entity[key];
    return raw;
  }
  function lastOf(entity, now) { const at = stamp(entity && (entity.lastAt || entity.lastActionAt)); return at !== null && at - now > FUTURE_MS ? null : at; }
  function estadoOf(entity, now) {
    if (scalarContext.has(entity) || has(entity, 'workProof') || entity && entity.source === 'scalar-metadata') {
      return { working: 'trabalhando', waiting: 'esperando', done: 'terminou', unknown: 'sem-leitura' }[workState(entity, scalarContext.get(entity), now)];
    }
    const value = fold(entity && entity.state), last = lastOf(entity, now);
    if (value === 'done' || value === 'completed') return 'terminou';
    if (phaseOf(entity && entity.lastAction) === 'deliver' && ['working', 'walking', 'waiting'].includes(value)) return 'terminou';
    if (entity && entity.processAlive === true) return value === 'working' || value === 'walking' ? 'trabalhando' : 'esperando';
    if (value === 'waiting') return 'esperando';
    if (value === 'sleeping') return 'dormindo';
    if (last !== null && now - last >= SLEEP_MS) return 'dormindo';
    if (value === 'working' || value === 'walking') return 'trabalhando';
    if (value === 'registered' && last !== null) return 'esperando';
    return 'sem-leitura';
  }
  // Sessao, conversa e coordenacao sao conversas que continuam: turno terminado = esperando a proxima mensagem (10+ min: dormindo).
  // "Terminou" fica so para o ajudante que entregou o trabalho.
  function raizEstado(entity, now) {
    const estado = estadoOf(entity, now);
    if (estado !== 'terminou') return estado;
    if (scalarContext.has(entity)) return estado;
    const last = lastOf(entity, now);
    return last !== null && now - last < SLEEP_MS ? 'esperando' : 'dormindo';
  }
  // Compatibilidade (nomes antigos da animacao): working, waiting, sleeping, done, unknown.
  function stateOf(agent, now) { return PE_STATE[estadoOf(agent, now)]; }

  const KEEP_UPPER = new Set(['qa', 'ia', 'ai', 'coordenador', 'ui', 'api']);
  function niceWords(text) {
    const words = String(text || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.map((word, index) => KEEP_UPPER.has(fold(word)) ? word.toUpperCase() : fold(word) === 'agente' ? 'Agente' : index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(' ');
  }
  // Nome do agente pelo papel ("AGENTE MAESTRO · PROTEÇÃO" vira "Maestro · Proteção"); nunca numero de Agente no nome.
  function roleName(agent, lang) {
    const labels = (agent && agent.identity && agent.identity.labels) || (agent && agent.roleLabels) || null;
    const raw = labels ? labels[lang] || labels.pt || '' : '';
    const clean = String(raw).replace(/^\s*agente\s+/i, '').replace(/\s*#?\d+$/, '').trim();
    const segment = part => /^[\w.]+(?:[-_][\w.]*)+$/.test(part) ? niceWords(part.replace(/[-_]+/g, ' ').trim()) : niceWords(part);
    return clean ? clean.split(/\s*·\s*/).filter(Boolean).map(segment).join(' · ') : null;
  }
  const CURATED = {
    'coordena tarefas e entregas': ['Coordena as entregas', 'Coordinates deliveries', 'Coordina las entregas'],
    'testa a entrega desta tarefa': ['Testa a entrega', 'Tests the delivery', 'Prueba la entrega'],
    'confere textos e seus idiomas': ['Confere os textos', 'Checks the copy', 'Revisa los textos'],
    'escreve textos para o projeto': ['Escreve os textos', 'Writes the copy', 'Escribe los textos'],
    'confere as fontes dos dados': ['Confere as fontes', 'Checks data sources', 'Revisa las fuentes'],
    'acompanha os proximos passos': ['Acompanha os passos', 'Follows next steps', 'Sigue los pasos'],
    'melhora nomes e entregas': ['Melhora os nomes', 'Improves the names', 'Mejora los nombres'],
    'ajusta controles das galerias': ['Ajusta as galerias', 'Tunes the galleries', 'Ajusta las galerías'],
    'revisa as entregas da equipe': ['Revisa as entregas', 'Reviews deliveries', 'Revisa las entregas']
  };
  const STOP = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'para', 'a', 'o', 'os', 'as', 'em', 'no', 'na', 'nos', 'nas', 'com', 'and', 'of', 'for', 'the', 'to', 'with', 'y', 'la', 'el', 'los', 'las', 'del', 'en', 'con', 'al', 'desta', 'deste', 'this', 'esta', 'este', 'seus', 'suas', 'its', 'sus', 'an']);
  function threeWords(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    while (words.length > 1 && STOP.has(fold(words[words.length - 1]))) words.pop();
    return words.length ? words.join(' ') : null;
  }
  function whatOf(agent, lang) {
    const labels = (agent && agent.identity && agent.identity.taskLabels) || (agent && agent.taskLabels) || null;
    if (!labels) return null;
    const hit = CURATED[fold(labels.pt)];
    if (hit) return hit[LANGS.indexOf(langOf(lang))];
    return threeWords(labels[lang] || labels.pt);
  }
  function humanTitle(text, lang) {
    const raw = String(text || '').trim(); if (!raw) return null;
    const clean = raw.replace(/\s*\([^)]*\)/g, '').trim();
    return clean === clean.toUpperCase() ? niceWords(clean) : clean;
  }
  function familyOf(agent) { return fold(agent && agent.family) === 'codex' ? 'codex' : fold(agent && agent.family) === 'claude' ? 'claude' : null; }

  // Retratos: so Agente verificado (o do proprio agente ou um livre do pacote), nunca o mesmo duas vezes na tela.
  const IMAGE = /^\/(?:assets|agente|agentes|miniaturas)\/[\w./-]+\.(?:png|webp|jpg)$/i;
  const validImage = value => typeof value === 'string' && IMAGE.test(value) && !value.includes('..') && value !== '/agente.png';
  function hashOf(value) { let hash = 2166136261; for (const char of String(value)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0; return hash; }
  function ownPortrait(agente) { return agente && agente.verified === true && validImage(agente.image) ? { image: agente.image, agente: agente.id === undefined || agente.id === null ? null : String(agente.id) } : null; }
  function poolOf(snapshot, extra) {
    const seen = new Set(), pool = [];
    const add = item => { if (item && validImage(item.image) && !seen.has(item.image)) { seen.add(item.image); pool.push({ image: item.image, agente: item.agente === undefined || item.agente === null ? null : String(item.agente) }); } };
    for (const item of Array.isArray(extra) ? extra : []) add(item && { image: item.image, agente: item.id !== undefined ? item.id : item.agente });
    const agents = snapshot && snapshot.equipe && Array.isArray(snapshot.equipe.agents) ? snapshot.equipe.agents : [];
    for (const agent of agents) add(ownPortrait(agent && agent.agente));
    const sessions = snapshot && snapshot.operator && Array.isArray(snapshot.operator.sessions) ? snapshot.operator.sessions : [];
    for (const session of sessions) add(ownPortrait(session && session.node && session.node.agente));
    return pool.sort((a, b) => a.image.localeCompare(b.image));
  }
  function assignPortraits(cards, pool, memory) {
    const used = new Set(), out = new Map(), known = new Map((pool || []).map(item => [item.image, item]));
    const ordered = [...cards].sort((a, b) => Number(Boolean(memory && memory.get(b.id) === (ownPortrait(b.agente) || {}).image)) - Number(Boolean(memory && memory.get(a.id) === (ownPortrait(a.agente) || {}).image)) || String(a.id).localeCompare(String(b.id)));
    for (const card of ordered) { const own = ownPortrait(card.agente); if (own && !used.has(own.image)) { used.add(own.image); out.set(card.id, own); if (memory) memory.set(card.id, own.image); } }
    for (const card of ordered) {
      if (out.has(card.id)) continue;
      const previous = memory && memory.get(card.id);
      if (previous && known.has(previous) && !used.has(previous)) { used.add(previous); out.set(card.id, known.get(previous)); }
    }
    const free = (pool || []).filter(item => !used.has(item.image));
    const waiting = cards.filter(card => !out.has(card.id)).sort((a, b) => hashOf(a.id) - hashOf(b.id) || String(a.id).localeCompare(String(b.id)));
    for (const card of waiting) {
      if (!free.length) { out.set(card.id, null); continue; }
      const [chosen] = free.splice(hashOf(card.id) % free.length, 1);
      used.add(chosen.image); out.set(card.id, chosen);
      if (memory) memory.set(card.id, chosen.image);
    }
    return out;
  }

  // Fases da linha do tempo: leitura, mudancas, comandos e equipe (Agent, Task, SendMessage, send_message, spawn_agent,
  // followup_task, wait_agent e AskUserQuestion: chamar ajudante, mandar recado e perguntar). Mesma tabela do pe-cauda.cjs.
  const PHASES = ['read', 'edit', 'run', 'team'];
  const TOOL_PHASE = [
    [/^(?:read|grep|glob|ls|webfetch|websearch|toolsearch|view_?image|notebookread|get_page_text|read_page|find|search|web_?run|read_console_messages|read_network_requests|read_terminal|read_widget_context|get_usage|list_\w+|get_\w+|query|search_\w+|le arquivos|busca arquivos|busca nos arquivos|olha imagens|pesquisa)$/, 'read'],
    [/^(?:edit|write|multiedit|notebookedit|apply_patch|create|update|batch|edita arquivos|escreve arquivos)$/, 'edit'],
    [/^(?:bash|powershell|exec|exec_command|shell|local_shell|monitor|bashoutput|killshell|terminal|run_in_terminal|computer|navigate|browser_batch|javascript_tool|form_input|preview_start|preview_stop|resize_window|tabs_\w+|run_scheduled_task)$/, 'run'],
    [/^(?:agent|task|sendmessage|send_message|spawn_agent|followup_task|wait_agent|askuserquestion|request_user_input_async|spawn_task|chama ajudantes|conversa com equipe|passa tarefa|espera ajudante)$/, 'team'],
    [/^(?:subagenthandback|terminou o passo)$/, 'deliver']
  ];
  function phaseOf(name) {
    const base = fold(String(name || '').split('__').pop()).replace(/\s+/g, ' ');
    if (!base) return null;
    const compactBase = base.replace(/\s+/g, '');
    for (const [pattern, key] of TOOL_PHASE) if (pattern.test(base) || pattern.test(compactBase)) return key;
    return null;
  }
  // Linha do tempo: PEDIDO -> PROGRESSO (leitura, mudancas, comandos, equipe; a fase em uso acesa) -> OBJETIVO.
  // cauda (opcional) = GET /api/pe-equipe/conversa/<familia>/<id>: o FIM da conversa (contagem por fase e o pedido de verdade).
  // quem pediu (cauda.origem.quem) em palavras: voce, a sessao (COORDENADOR CLAUDE, ATENDIMENTO...) ou a conversa do Codex que chamou
  function whoOf(quem, lang, lados) {
    const w = W[langOf(lang)];
    if (!quem || typeof quem !== 'object') return null;
    if (quem.tipo === 'voce') return w.who.voce;
    if (quem.tipo === 'sessao') { const nome = /^(?:COORDENADOR|COORDENACAO)$/i.test(String(quem.nome || '')) ? w.tree.coord.claude : quem.nome ? String(quem.nome).toUpperCase() : null; if (!nome) return w.who.outraSessao; return quem.ajudante ? w.who.ajudanteDe(nome) : nome; }
    if (quem.tipo === 'conversa-codex') {
      const pai = String(quem.pai || '').toLowerCase(), codex = lados && lados.lados ? lados.lados[1] : null;
      if (pai && codex) {
        const coord = codex.coordenador, coordId = String(coord && coord.raw && (coord.raw.conversationId || coord.raw.id) || '').toLowerCase();
        if (coordId === 'codex:' + pai) return w.tree.coord.codex;
        const box = (codex.sessoes || []).find(item => String(item.chave || '').toLowerCase() === 'codex:' + pai);
        if (box && box.nome) return box.nome;
      }
      return w.who.conversaCodex;
    }
    return null;
  }
  function timelineOf(card, lang, now, cauda, lados) {
    lang = langOf(lang); now = Number.isFinite(now) ? now : Date.now();
    const strict = Boolean(lados && lados.scalar || scalarContext.has(card.raw)), w = W[lang], agent = strict ? { lastAt: card.lastAt } : card.raw || {}, tail = !strict && cauda && cauda.ok ? cauda : null;
    const tools = Array.isArray(agent.tools) && agent.tools.length ? agent.tools : null;
    const counts = { read: 0, edit: 0, run: 0, team: 0 };
    let known = false, last = null;
    if (tail && tail.fases) { for (const key of PHASES) counts[key] = finite(tail.fases[key]) ? tail.fases[key] : 0; known = true; last = tail.ultimaFase || null; }
    else if (tools) { for (const tool of tools) { const key = phaseOf(tool && tool.name) || phaseOf(tool && tool.label); if (key && key !== 'deliver' && finite(tool.count)) counts[key] += tool.count; } known = true; last = phaseOf(agent.lastAction); }
    const done = card.estado === 'terminou';
    const rangeOf = key => { const t = tail && tail.tempos && tail.tempos[key]; const a = t ? clockDay(t.de, lang, now) : null, b = t ? clockDay(t.ate, lang, now) : null; return a && b ? w.range(a, b) : null; };
    const steps = PHASES.map(key => ({ key, label: w.phase[key], hint: w.phaseHint[key], range: known ? rangeOf(key) : null, count: known ? counts[key] : null, status: !known ? 'unknown' : counts[key] > 0 ? 'passed' : 'pending' }));
    let at;
    if (done || last === 'deliver') { at = PHASES.length + 1; for (const step of steps) if (step.status === 'pending') step.status = 'skipped'; }
    else if (!known) at = 1;
    else {
      let current = PHASES.includes(last) ? last : null;
      if (!current) for (const key of PHASES) if (counts[key] > 0) current = key;
      if (current) { steps[PHASES.indexOf(current)].status = 'current'; at = 1 + PHASES.indexOf(current); } else at = 0;
    }
    // Pedido: a ultima mensagem do dono no fim da conversa (1 linha neutra); sem ela, a tarefa lida do agente.
    const work = (agent.identity && agent.identity.taskLabels) || agent.taskLabels || null;
    let request;
    const origem = tail && tail.origem && typeof tail.origem === 'object' ? tail.origem : null;
    if (origem) {
      const chat = w.chatOf(tail.chatDe || (card.side === 'codex' ? 'codex' : card.chave || '?'));
      const when = clockDay(origem.em, lang, now), who = whoOf(origem.quem, lang, lados);
      request = { text: origem.texto || (origem.reservado ? w.reservedAsk(chat) : null), when: origem.quem && origem.quem.tipo === 'voce' ? w.askedYou(when) : who ? w.asked(who, when) : when ? w.askedAt(when) : null, reserved: origem.reservado === true, who, fromYou: Boolean(origem.quem && origem.quem.tipo === 'voce') };
    } else if (tail && tail.pedido) {
      const chat = w.chatOf(tail.chatDe || (card.side === 'codex' ? 'codex' : card.chave || '?'));
      const when = clock(tail.pedido.em, lang);
      request = { text: tail.pedido.texto || (tail.pedido.reservado ? w.reservedAsk(chat) : null), when: when ? w.yourLast(when) : null, reserved: tail.pedido.reservado === true, fromYou: true };
    } else {
      const asked = clock(agent.startedAt, lang);
      request = { text: work ? work[lang] || work.pt || null : null, when: asked ? w.askedAt(asked) : null, reserved: false };
    }
    const delivery = agent.delivery || {};
    const resting = card.estado === 'dormindo' || card.estado === 'sem-leitura';
    const finished = clock(delivery.completedAt, lang), deadline = clock(delivery.deadlineAt, lang), expected = resting && delivery.estimated !== false ? null : clock(delivery.etaAt, lang);
    const goalText = humanTitle(agent.currentItemTitle, lang) || card.goalText || (card.needsYou ? w.needsYou : null);
    const goal = {
      text: goalText,
      when: done && finished ? w.deliveredAt(finished) : deadline ? w.deadline(deadline) : expected ? w.expected(expected) + (delivery.estimated ? ' · ' + w.estimated : '') : finished ? w.deliveredAt(finished) : null,
      hard: Boolean(deadline) && !done, status: done || last === 'deliver' ? 'passed' : 'pending'
    };
    // Fim: terminou (e a hora) ou o objetivo com a entrega; sem objetivo, o estado de agora e a ultima acao
    const lastAt = clockDay(tail && tail.ate || agent.lastActionAt || agent.lastAt, lang, now);
    const helper = Boolean(card.helperOf), eta = deadline ? w.deadline(deadline) : expected ? w.expected(expected) + (delivery.estimated ? ' · ' + w.estimated : '') : null;
    const end = done || last === 'deliver'
      ? { text: w.endDone, when: finished ? w.deliveredAt(finished) : clockDay(tail && tail.entregueEm, lang, now) ? w.at(clockDay(tail.entregueEm, lang, now)) : lastAt ? w.at(lastAt) : null, status: 'passed', hard: false }
      : { text: (helper ? null : goal.text) || w.endState[card.estado] || null, when: helper && card.goalText
          ? w.deliversTo(card.goalText) + (deadline ? ' · ' + w.deadline(deadline) : expected ? ' ~' + expected + (delivery.estimated ? ' · ' + w.estimated : '') : lastAt ? ' · ' + w.lastAction(lastAt) : '')
          : eta || (lastAt ? w.lastAction(lastAt) : null), status: 'pending', hard: goal.hard };
    const since = tail && !tail.inteira && tail.desde ? clock(tail.desde, lang) : null;
    return { request, steps, goal, end, at, known, window: since ? w.window(since) : null };
  }

  function cupsOf(waterMl, max = 10) {
    if (!finite(waterMl)) return null;
    const total = waterMl / 250, full = Math.floor(total), part = total - full;
    if (total === 0) return { levels: [0], current: 0, total: 0 };
    const count = Math.min(max, Math.ceil(total)), levels = [];
    for (let i = 0; i < count; i++) levels.push(1);
    if (part > 0) levels[count - 1] = part;
    return { levels, current: part > 0 ? count - 1 : -1, total: Math.ceil(total) };
  }

  // ---------- as duas IAs: um modelo so (arvore, fluxo, topo e Inicio) ----------
  const CLAUDE_SESSOES = ['ATENDIMENTO', 'LOJA', 'ASSISTENTE', 'CORTES'];
  const PRIVATE_NAME = /sigilos|segred|carteira|wallet|\bseed\b|\.env\b|\bchave\b|senha|password|0x[0-9a-f]{6}/i;
  // "COORDENADOR · comando da casa (5)" -> "Comando da casa"; nome com sinal de sigilo nao sai.
  function threadName(raw) {
    const text = String(raw || '').replace(/[\u0000-\u001f–—|]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || PRIVATE_NAME.test(text)) return null;
    const clean = text.replace(/^coordenador\s*·\s*/i, '').replace(/\s*\(\d+\)\s*$/, '').trim();
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : null;
  }
  const ORDER = { trabalhando: 0, esperando: 1, terminou: 2, dormindo: 3, 'sem-leitura': 4 };
  function helperGroup(list, now) {
    const itens = list.map(agent => ({ id: agent.id, estado: estadoOf(agent, now), ultimaEm: lastOf(agent, now), raw: agent }))
      .sort((a, b) => ORDER[a.estado] - ORDER[b.estado] || (b.ultimaEm || 0) - (a.ultimaEm || 0) || a.id.localeCompare(b.id));
    const conta = estado => itens.filter(item => item.estado === estado).length;
    return { total: itens.length, trabalhando: conta('trabalhando'), esperando: conta('esperando'), dormindo: conta('dormindo'), terminaram: conta('terminou'), semLeitura: conta('sem-leitura'), itens };
  }
  function contagemOf(entries) {
    const c = { agentes: 0, trabalhando: 0, esperando: 0, dormindo: 0, terminaram: 0, semLeitura: 0 };
    for (const entry of entries) {
      c.agentes++;
      if (entry.estado === 'trabalhando') c.trabalhando++; else if (entry.estado === 'esperando') c.esperando++; else if (entry.estado === 'dormindo') c.dormindo++; else if (entry.estado === 'terminou') c.terminaram++; else c.semLeitura++;
    }
    return c;
  }
  function deliveryOf(groups, conversationId) { const group = conversationId ? groups.find(item => item && item.conversationId === conversationId) : null; return group && group.delivery ? group.delivery : null; }
  // Guarda do Codex (estado/codex.md, lido pelo servidor): a ultima ronda e o intervalo tipico entre rondas.
  function guardaOf(info, now) {
    if (!info || typeof info !== 'object') return null;
    const rondas = (Array.isArray(info.rondas) ? info.rondas : []).map(stamp).filter(at => at !== null && at - now <= FUTURE_MS).sort((a, b) => b - a);
    const last = rondas.length ? rondas[0] : null;
    const gaps = []; for (let i = 0; i + 1 < rondas.length && i < 6; i++) gaps.push((rondas[i] - rondas[i + 1]) / 60000);
    gaps.sort((a, b) => a - b);
    const intervalo = gaps.length ? Math.max(1, Math.round(gaps[Math.floor(gaps.length / 2)])) : null;
    const age = last === null ? null : now - last, limite = Math.max(45, (intervalo || 30) * 1.5) * 60000;
    const estado = last === null ? 'sem-leitura' : age < 3 * 60000 ? 'trabalhando' : age < limite ? 'esperando' : 'dormindo';
    return { id: 'guarda:codex', chave: 'guarda', lado: 'codex', tipo: 'guarda', estado, ultimaEm: last, intervalo, conta: false, raw: null, ajudantes: helperGroup([], now) };
  }
  function scalarLados(snapshot, now, failed) {
    const context = metadataContext(snapshot, now);
    if (context.retained && (!context.valid || failed)) {
      const previous = scalarLados(snapshot, context.observedAt, false);
      const lados = previous.lados.map(lado => ({ ...lado, sessoes: lado.sessoes.map(box => ({ ...box, estado: 'sem-leitura', ajudantes: { ...box.ajudantes, itens: box.ajudantes.itens.map(item => ({ ...item, estado: 'sem-leitura' })) } })) }));
      return { ...previous, lados, now, stale: true, ageSeconds: Math.floor((now - context.observedAt) / 1000), metadataContext: context };
    }
    if (failed) context.valid = context.complete = false;
    const input = snapshot && snapshot.equipe && Array.isArray(snapshot.equipe.agents) ? snapshot.equipe.agents : [];
    const byId = new Map(), duplicate = new Set(); let issue = !snapshot || !snapshot.equipe || !Array.isArray(snapshot.equipe.agents);
    for (const agent of input) {
      const id = nativeId(agent && agent.id), family = familyOf(agent);
      if (!id || !family || !id.startsWith(family + ':')) { issue = true; continue; }
      if (byId.has(id)) { duplicate.add(id); issue = true; }
      const raw = scalarEntity(agent, id, family, agent.parentId == null ? null : nativeId(agent.parentId), nativeId(agent.conversationId));
      if (agent.parentId != null && !raw.parentId) { duplicate.add(id); issue = true; }
      scalarContext.set(raw, context); byId.set(id, raw);
    }
    const rootOf = raw => {
      let current = raw; const seen = new Set();
      while (current) {
        if (seen.has(current.id) || duplicate.has(current.id) || current.family !== raw.family || current.conversationId !== raw.conversationId) return null;
        seen.add(current.id);
        if (!current.parentId) return current.id === raw.conversationId && current.conversationId === current.id ? current : null;
        current = byId.get(current.parentId);
      }
      return null;
    };
    const accepted = [...byId.values()].filter(raw => { const ok = Boolean(rootOf(raw)); if (!ok) issue = true; return ok; });
    const complete = context.complete && !issue;
    const available = context.valid && !failed && (complete || Boolean(context.coverage && context.coverage.read >= accepted.length));
    const countsKnown = complete && accepted.every(raw => workState(raw, context, now) !== 'unknown');
    const groupOf = list => {
      const group = helperGroup(list, now);
      if (!available) for (const key of ['total', 'trabalhando', 'esperando', 'dormindo', 'terminaram', 'semLeitura']) group[key] = null;
      return group;
    };
    const lados = ['claude', 'codex'].map(lado => {
      const roots = accepted.filter(raw => raw.family === lado && !raw.parentId);
      const sessoes = roots.map(raw => ({ id: raw.id, chave: raw.id, conversationId: raw.id, lado, tipo: 'conversa', nome: null,
        estado: estadoOf(raw, now), precisa: null, ultimaEm: lastOf(raw, now), conta: true, raw,
        ajudantes: groupOf(accepted.filter(child => child.parentId && child.conversationId === raw.id)) }));
      return { id: lado, coordenador: { id: 'coord:' + lado, chave: 'COORDENADOR', lado, tipo: 'coordenador', nome: 'COORDENADOR', estado: 'sem-leitura', precisa: null, ultimaEm: null, conta: false, raw: null, ajudantes: groupOf([]) }, sessoes, guarda: null };
    });
    const entriesOf = lado => lado.sessoes.flatMap(box => [box, ...box.ajudantes.itens]);
    const countsOf = entries => {
      const counts = contagemOf(entries);
      if (!available) for (const key of Object.keys(counts)) counts[key] = null;
      return counts;
    };
    const porLado = Object.fromEntries(lados.map(lado => [lado.id, countsOf(entriesOf(lado))]));
    const contagem = countsOf(lados.flatMap(entriesOf));
    return { scalar: true, metadataContext: context, complete, countsKnown, countsAvailable: available, lowerBound: available && !countsKnown, coverage: context.coverage, known: available,
      now, activityReadAt: context.observedAt, processReadingAvailable: false, lados, porLado, contagem, dono: { esperam: null } };
  }
  // O leitor so de metadados so ve o Codex. Com { casa: true } (a Equipe e a contagem): as sessoes do Claude entram pelo
  // operator.sessions e pelo /api/coordenador-pb (o que a tela ja tem); o estado de cada cartao e o numero vem das chaves ativas do
  // Inicio (atividade dos ultimos 5 min); "sem leitura" com hora vira esperando ou dormindo; conversa parada ha mais de 1 h fica
  // marcada como antiga (a tela junta em "N conversas antigas"). "?" so sem leitura nenhuma. Sem opcao, ladosOf fica como era
  const ATIVA_MS = 5 * 60000, CASA_QUIETA_MS = 30 * 60000, ANTIGA_MS = 60 * 60000, COORDENADOR_NAME = /^coordenador\b/i;
  const CASA_IDS = { COORDENADOR: 'coordenador-claude', ATENDIMENTO: 'atendimento', LOJA: 'loja', ASSISTENTE: 'assistente', CORTES: 'cortes' };
  function fonteAtividade(snapshot, now) {
    const fonte = root.PainelAtividade; let ativas = null, linhas = [];
    if (fonte && typeof fonte.ativas === 'function') { try { ativas = fonte.ativas(snapshot, now); } catch { ativas = null; } }
    if (fonte && typeof fonte.sessoes === 'function') { try { const list = fonte.sessoes(); if (Array.isArray(list)) linhas = list; } catch { /* sem linhas */ } }
    const chave = fonte && typeof fonte.chave === 'function' ? fonte.chave : (family, id, name) => {
      const raw = String(id || '').replace(/^(?:codex|claude):/i, ''); if (!raw) return null;
      return family === 'codex' ? (COORDENADOR_NAME.test(String(name || '')) || raw.toLowerCase() === 'coordenador' ? 'codex:coordenador' : 'codex:' + raw.toLowerCase()) : 'claude:' + raw.toUpperCase();
    };
    const set = ativas instanceof Set ? ativas : null;
    // sem o Inicio na pagina (teste no node): a mesma janela de 5 min pela hora
    const ativa = (key, at, busy) => set ? set.has(key) : busy === true || (at !== null && at <= now + FUTURE_MS && now - at <= ATIVA_MS);
    return { ativas: set, linhas, chave, ativa };
  }
  function maisNovaAt(now, ...values) { let best = null; for (const value of values) { const at = stamp(value); if (at !== null && at - now <= FUTURE_MS && (best === null || at > best)) best = at; } return best; }
  function recontar(itens) {
    itens.sort((a, b) => ORDER[a.estado] - ORDER[b.estado] || (b.ultimaEm || 0) - (a.ultimaEm || 0) || String(a.id).localeCompare(String(b.id)));
    const conta = estado => itens.filter(item => item.estado === estado).length;
    return { total: itens.length, trabalhando: conta('trabalhando'), esperando: conta('esperando'), dormindo: conta('dormindo'), terminaram: conta('terminou'), semLeitura: conta('sem-leitura'), itens };
  }
  function comCasa(model, snapshot, now) {
    if (!model || !Array.isArray(model.lados) || model.comCasa) return model;
    const fonte = fonteAtividade(snapshot, now), [claude, codex] = model.lados;
    const agents = new Map((snapshot && snapshot.equipe && Array.isArray(snapshot.equipe.agents) ? snapshot.equipe.agents : []).filter(agent => agent && typeof agent.id === 'string').map(agent => [agent.id.toLowerCase(), agent]));
    const nomeDe = value => String(value || '').toUpperCase().replace(/^COORDENACAO$/, 'COORDENADOR');
    const porHora = at => at === null ? 'sem-leitura' : now - at < SLEEP_MS ? 'esperando' : 'dormindo';
    if (model.scalar) {
      // 1) a casa do Claude: COORDENADOR, ATENDIMENTO, LOJA, ASSISTENTE, CORTES (e outra sessao que o estado tiver)
      // r11: conversa com id cru ("claude:<id>", "codex:<id>") nao e sessao da casa; ela ja aparece como conversa na coluna dela
      const ops = snapshot && snapshot.operator && Array.isArray(snapshot.operator.sessions) ? snapshot.operator.sessions.filter(item => item && item.id && !/^(claude|codex):[0-9a-f-]{8,}$/i.test(String(item.id))) : [];
      const rows = fonte.linhas.filter(row => row && row.family === 'claude' && /^claude:/i.test(String(row.key || '')));
      const nomes = [];
      for (const name of [...['COORDENADOR', ...CLAUDE_SESSOES].filter(key => ops.some(item => nomeDe(item.id) === key) || rows.some(row => nomeDe(String(row.key).slice(7)) === key)), ...ops.map(item => nomeDe(item.id)), ...rows.map(row => nomeDe(String(row.key).slice(7)))]) if (name && !nomes.includes(name)) nomes.push(name);
      const casa = nomes.map(name => {
        const op = ops.find(item => nomeDe(item.id) === name) || null, row = rows.find(item => nomeDe(String(item.key).slice(7)) === name) || null, node = op && op.node || {};
        const last = maisNovaAt(now, node.lastAt, op && op.updatedAt, row && row.lastAt);
        const busy = Boolean(row && (row.busy === true || row.state === 'trabalhando')), needs = Boolean(op && op.needsOperator === true);
        const key = fonte.chave('claude', name), working = fonte.ativa(key, last, busy);
        const estado = working ? 'trabalhando' : needs ? 'esperando' : last === null ? 'sem-leitura' : now - last <= CASA_QUIETA_MS ? 'esperando' : 'dormindo';
        const raw = { id: 'operator:' + name, family: 'claude', state: working ? 'working' : 'registered', lastAt: last === null ? null : new Date(last).toISOString(), tools: [] };
        // ajudantes da sessao: so quando o servidor mandar a conta pronta (op.ajudantes = { total, ativos }, leitura de metadados)
        const aj = op && op.ajudantes, nAj = aj && Number.isInteger(aj.total) && aj.total >= 0 ? aj.total : null, nAtivos = nAj !== null && Number.isInteger(aj.ativos) ? Math.min(nAj, Math.max(0, aj.ativos)) : 0;
        const ajudantes = nAj === null ? recontar([]) : { total: nAj, trabalhando: nAtivos, esperando: 0, dormindo: nAj - nAtivos, terminaram: 0, semLeitura: 0, itens: [] };
        return { id: 'sessao:' + name, chave: name, lado: 'claude', tipo: name === 'COORDENADOR' ? 'coordenador' : 'sessao', nome: name, estado, precisa: needs, ultimaEm: last, conta: true, casa: true, chaveAtiva: key, porAtividade: working,
          conversationId: node.conversationId || null, summary: op && op.summary && op.summary.fields ? op.summary.fields : null, raw, ajudantes,
          // leitura do leitor do Claude (v2, quando o servidor aplicar): mensagens e recados das ultimas 2 h e o nome da ultima ferramenta
          fluxo: op && op.fluxo && typeof op.fluxo === 'object' ? op.fluxo : null, ferramenta: op && op.ferramenta && typeof op.ferramenta.nome === 'string' ? op.ferramenta : null,
          ferramentasAjudantes: aj && Array.isArray(aj.ferramentas) ? aj.ferramentas.filter(item => item && typeof item.nome === 'string') : [],
          ajudantesLista: aj && Array.isArray(aj.lista) ? aj.lista.filter(item => item && typeof item === 'object').slice(0, 12) : null };
      });
      const coordenador = casa.find(box => box.tipo === 'coordenador') || null;
      if (coordenador) claude.coordenador = coordenador;
      claude.sessoes = [...casa.filter(box => box !== coordenador), ...claude.sessoes];
      // 2) cada conversa e ajudante lidos pelo leitor: a mesma atividade; "sem leitura" com hora vira esperando ou dormindo
      for (const lado of model.lados) for (const box of [lado.coordenador, ...lado.sessoes]) {
        if (!box || box.casa || !box.raw || !box.conta) continue;
        const rawId = String(box.raw.id || box.id), agent = agents.get(rawId.toLowerCase());
        const key = fonte.chave(box.lado, rawId, agent && (agent.conversationName || agent.conversation));
        box.chaveAtiva = key; box.nomeConversa = agent && (agent.conversationName || agent.conversation) || null; box.acao = agent && typeof agent.lastAction === 'string' ? agent.lastAction : null;
        if (box.estado !== 'trabalhando' && fonte.ativa(key, box.ultimaEm, false)) { box.estado = 'trabalhando'; box.porAtividade = true; }
        else if (box.estado === 'sem-leitura') box.estado = porHora(box.ultimaEm);
        const itens = box.ajudantes && Array.isArray(box.ajudantes.itens) ? box.ajudantes.itens : [];
        for (const item of itens) {
          const proof = item.raw && item.raw.workProof || {}, fechou = Boolean(item.raw && (item.raw.state === 'done' || proof.state === 'done' || proof.closedAt != null));
          item.chaveAtiva = 'ajudante:' + String(item.raw && item.raw.id || item.id).toLowerCase();
          if (item.estado !== 'trabalhando' && fonte.ativa(item.chaveAtiva, fechou ? null : item.ultimaEm, false)) { item.estado = 'trabalhando'; item.porAtividade = true; }
          else if (item.estado === 'sem-leitura') item.estado = fechou ? 'terminou' : porHora(item.ultimaEm);
        }
        box.ajudantes = recontar(itens);
      }
    }
    if (model.scalar && !codex.coordenador.coordVivo) {
      const coordenador = codex.sessoes.filter(box => box.conta && box.chaveAtiva === 'codex:coordenador');
      const coord = coordenador.find(box => /^coordenador\s*·\s*conversa\b/i.test(String(box.nomeConversa || ''))) || coordenador.sort((a, b) => (b.ultimaEm || 0) - (a.ultimaEm || 0))[0] || null;
      if (coord) { coord.tipo = 'coordenador'; coord.coordVivo = true; codex.coordenador = coord; codex.sessoes = codex.sessoes.filter(box => box !== coord); }
    }
    // 3) conversa parada ha mais de 1 h (ou sem hora nenhuma) vira "antiga"; as sessoes da casa nunca
    for (const lado of model.lados) {
      for (const box of lado.sessoes) box.antiga = !box.casa && box.tipo === 'conversa' && box.estado !== 'trabalhando' && box.precisa !== true && !(box.ajudantes && box.ajudantes.trabalhando > 0) && (box.ultimaEm === null || now - box.ultimaEm > ANTIGA_MS);
      if (model.scalar) {
        const casa = lado.sessoes.filter(box => box.casa), resto = lado.sessoes.filter(box => !box.casa);
        resto.sort((a, b) => ORDER[a.estado] - ORDER[b.estado] || (b.ultimaEm || 0) - (a.ultimaEm || 0));
        lado.sessoes = [...casa, ...resto];
      }
    }
    // 4) a conta: cada agente uma vez; quem trabalha conta pela chave ativa (as conversas COORDENADOR do Codex sao 1 so, como no Inicio)
    const entriesOf = lado => { const out = []; for (const box of [lado.coordenador, ...lado.sessoes]) { if (!box) continue; if (box.conta) out.push(box); out.push(...(box.ajudantes && box.ajudantes.itens || [])); } return out; };
    const conta = list => { const c = contagemOf(list); c.trabalhando = new Set(list.filter(item => item.estado === 'trabalhando').map(item => item.chaveAtiva || item.id)).size; return c; };
    if (model.scalar && entriesOf(claude).length + entriesOf(codex).length > 0) {
      model.porLado = { claude: conta(entriesOf(claude)), codex: conta(entriesOf(codex)) };
      model.contagem = conta([...entriesOf(claude), ...entriesOf(codex)]);
      model.known = true; model.countsAvailable = true;
    }
    model.antigas = { claude: claude.sessoes.filter(box => box.antiga).length, codex: codex.sessoes.filter(box => box.antiga).length };
    // trabalhando por lado, da mesma conta do Inicio (as chaves ativas), para o topo
    if (fonte.ativas) { const split = { claude: 0, codex: 0 }; for (const key of fonte.ativas) split[/^(?:ajudante:)?claude:/.test(key) ? 'claude' : 'codex']++; model.ativasPorLado = split; }
    // 5) voce: as decisoes que esperam (cards e pedidos) e a hora do seu ultimo recado pelo painel (o que a tela ja tem)
    const waiting = snapshot && snapshot.management && snapshot.management.waiting && finite(snapshot.management.waiting.count) ? snapshot.management.waiting.count : snapshot && finite(snapshot.needsCount) ? snapshot.needsCount : null;
    // 'falou': a hora da ultima mensagem DIGITADA por ele em qualquer sessao do Claude (leitor v2); sem leitura, a linha some
    let falou = null;
    for (const box of [claude.coordenador, ...claude.sessoes]) { const at = box && box.fluxo && box.fluxo.dono ? stamp(box.fluxo.dono.ultimaEm) : null; if (at !== null && at - now <= FUTURE_MS && (falou === null || at > falou)) falou = at; }
    // cards: so os REALMENTE abertos (estado/cards sem resposta); a lista do ESCOLHAS fica no Inicio
    const cardsAbertos = snapshot && snapshot.management && snapshot.management.waiting && finite(snapshot.management.waiting.cards) ? snapshot.management.waiting.cards : Array.isArray(snapshot && snapshot.cards) ? snapshot.cards.filter(card => card && !card.exemplo).length : null;
    model.dono = { ...(model.dono || {}), esperam: model.dono && finite(model.dono.esperam) ? model.dono.esperam : waiting, cards: cardsAbertos, falouEm: falou };
    model.comCasa = true;
    return model;
  }
  function ladosOf(snapshot, now, failed = false, options = null) {
    now = Number.isFinite(now) ? now : Date.now();
    if (options && options.casa === true) return comCasa(ladosOf(snapshot, now, failed), snapshot, now);
    if (scalarMode(snapshot)) return scalarLados(snapshot, now, failed);
    const equipe = snapshot && snapshot.equipe;
    const agents = equipe && Array.isArray(equipe.agents) ? equipe.agents.filter(agent => agent && typeof agent.id === 'string' && agent.id) : [];
    const sessions = snapshot && snapshot.operator && Array.isArray(snapshot.operator.sessions) ? snapshot.operator.sessions.filter(item => item && item.node) : [];
    const known = Boolean(equipe && Array.isArray(equipe.agents)) || sessions.length > 0;
    const groups = equipe && Array.isArray(equipe.groups) ? equipe.groups : [];
    const byId = new Map(agents.map(agent => [agent.id, agent]));
    const placed = new Set();
    const helpersFor = (conversationId, family) => {
      if (!conversationId) return [];
      const list = agents.filter(agent => agent.parentId && agent.conversationId === conversationId && agent.family === family && !placed.has(agent.id));
      for (const agent of list) placed.add(agent.id);
      return list;
    };
    const make = (fields, raw, helpers) => ({ ...fields, raw, ajudantes: helperGroup(helpers || [], now) });
    // Lado do Claude: o COORDENADOR e as sessoes da casa (com os ajudantes da conversa de cada uma)
    const bySession = new Map(sessions.map(item => [String(item.id || '').toUpperCase(), item]));
    // r11: sessao sem nome chega com o id cru ("Claude:<id>"); vira rotulo generico e a do Codex fica na coluna do Codex
    const ID_CRU = /^(claude|codex):[0-9a-f-]{8,}$/i, cruDe = item => item.name ? null : ID_CRU.exec(String(item.id || ''));
    const sessionBox = (item, tipo, lado = 'claude') => {
      const node = item.node, conversationId = node.conversationId || null, root = byId.get(node.id) || null;
      placed.add(node.id); if (root) placed.add(root.id);
      // com a conversa lida, o estado e a hora sao os dela (a ultima linha de verdade); sem ela, os do no (app e estado).
      // Hora no futuro (bloco do estado escrito ontem) nunca vale.
      const base = root || node, own = lastOf(base, now), last = own !== null ? own : lastOf(node, now);
      const fixed = { ...node, ...(root ? { state: root.state, lastAction: root.lastAction } : {}), processAlive: node.processAlive === true || Boolean(root && root.processAlive === true), lastAt: last === null ? null : new Date(last).toISOString() };
      const needs = item.needsOperator === true, raw = { ...(root || {}), ...fixed, tools: (root && root.tools) || node.tools || [] };
      return make({ id: 'sessao:' + String(item.id || node.id), chave: String(item.id || '').toUpperCase(), lado, tipo, nome: cruDe(item) ? null : String(item.name || item.id || '?'), estado: needs ? 'esperando' : raizEstado(fixed, now), precisa: needs, ultimaEm: last, entrega: deliveryOf(groups, conversationId), conversationId, summary: item.summary && item.summary.fields ? item.summary.fields : null, conta: true }, raw, helpersFor(conversationId, 'claude'));
    };
    const coordenador = bySession.get('COORDENADOR') || bySession.get('COORDENACAO') || null;
    const claude = { id: 'claude', coordenador: coordenador ? sessionBox(coordenador, 'coordenador') : make({ id: 'coord:claude', chave: 'COORDENADOR', lado: 'claude', tipo: 'coordenador', nome: 'COORDENADOR', estado: 'sem-leitura', ultimaEm: null, conta: false }, null, []), sessoes: [] };
    const codexSoltas = [];
    for (const key of CLAUDE_SESSOES) { const item = bySession.get(key); if (item) claude.sessoes.push(sessionBox(item, 'sessao')); }
    for (const item of sessions) { const key = String(item.id || '').toUpperCase(); if (key !== 'COORDENADOR' && key !== 'COORDENACAO' && !CLAUDE_SESSOES.includes(key)) { const cru = cruDe(item); if (cru && cru[1].toLowerCase() === 'codex') codexSoltas.push(sessionBox(item, 'sessao', 'codex')); else claude.sessoes.push(sessionBox(item, 'sessao')); } }
    // Conversas por id: Claude que nao e sessao da casa e todas do Codex (raiz + ajudantes; raiz fora da janela vira caixa sem raiz)
    const threadNames = new Map();
    for (const item of Array.isArray(snapshot && snapshot.commandSessions) ? snapshot.commandSessions : []) if (item && item.family === 'codex' && item.threadId) threadNames.set('codex:' + String(item.threadId).toLowerCase(), { name: item.name, lastAt: item.lastAt });
    const conversations = family => {
      const map = new Map();
      for (const agent of agents) {
        if (agent.family !== family || placed.has(agent.id)) continue;
        const conv = agent.conversationId || agent.id;
        if (!map.has(conv)) map.set(conv, { id: conv, root: null, helpers: [] });
        const entry = map.get(conv);
        if (agent.id === conv && !agent.parentId) entry.root = agent; else entry.helpers.push(agent);
      }
      return [...map.values()];
    };
    const convName = entry => (entry.root && (entry.root.conversationName || entry.root.appTitle || entry.root.conversation)) || (threadNames.get(entry.id) || {}).name || null;
    const convBox = (entry, lado, tipo, extra = {}) => {
      for (const agent of [entry.root, ...entry.helpers]) if (agent) placed.add(agent.id);
      const base = entry.root || null;
      let lastKnown = base ? lastOf(base, now) : stamp((threadNames.get(entry.id) || {}).lastAt), estado;
      if (base) estado = raizEstado(base, now);
      else {
        // sem a conversa lida: vale o que os ajudantes dela mostram (quem trabalha, quem espera) e a hora mais nova deles
        const states = entry.helpers.map(agent => estadoOf(agent, now)), times = entry.helpers.map(agent => lastOf(agent, now)).filter(at => at !== null);
        if (times.length) lastKnown = Math.max(lastKnown || 0, ...times);
        estado = states.includes('trabalhando') ? 'trabalhando' : states.includes('esperando') ? 'esperando' : lastKnown !== null && now - lastKnown >= SLEEP_MS ? 'dormindo' : lastKnown !== null ? 'esperando' : 'sem-leitura';
      }
      return make({ id: base ? base.id : 'conversa:' + entry.id, chave: entry.id, lado, tipo, nome: threadName(convName(entry)), semRaiz: !base, estado, ultimaEm: lastKnown !== null && lastKnown - now > FUTURE_MS ? null : lastKnown, conta: Boolean(base), ...extra }, base, entry.helpers);
    };
    for (const entry of conversations('claude')) claude.sessoes.push(convBox(entry, 'claude', 'conversa'));
    // Lado do Codex: a conversa "COORDENADOR · conversa" e o COORDENADOR do Codex; as outras conversas e os executores ficam abaixo dela
    const codexEntries = conversations('codex');
    const label = entry => String(convName(entry) || '');
    const coordEntry = codexEntries.find(entry => /^coordenador\s*·\s*conversa\b/i.test(label(entry))) || codexEntries.filter(entry => /^coordenador\b/i.test(label(entry))).sort((a, b) => (lastOf(b.root, now) || 0) - (lastOf(a.root, now) || 0))[0] || null;
    const codex = { id: 'codex', coordenador: null, sessoes: [], guarda: guardaOf(equipe && equipe.guardaCodex, now) };
    if (coordEntry) codex.coordenador = { ...convBox(coordEntry, 'codex', 'coordenador'), nome: 'COORDENADOR', chave: 'coordenador-codex' };
    else {
      const thread = [...threadNames.entries()].find(([, value]) => /^coordenador\b/i.test(String(value.name || '')));
      const lastKnown = thread ? stamp(thread[1].lastAt) : null, at = lastKnown !== null && lastKnown - now > FUTURE_MS ? null : lastKnown;
      codex.coordenador = make({ id: 'coord:codex', chave: 'coordenador-codex', lado: 'codex', tipo: 'coordenador', nome: 'COORDENADOR', estado: at !== null && now - at >= SLEEP_MS ? 'dormindo' : 'sem-leitura', ultimaEm: at, conta: false }, null, []);
    }
    for (const entry of codexEntries) if (entry !== coordEntry) codex.sessoes.push(convBox(entry, 'codex', 'conversa'));
    codex.sessoes.push(...codexSoltas);
    codex.sessoes.sort((a, b) => ORDER[a.estado] - ORDER[b.estado] || (b.ultimaEm || 0) - (a.ultimaEm || 0));
    // Contagem: cada agente uma vez (caixa que conta + ajudantes); guarda e caixa sem leitura nao contam
    const entriesOf = lado => { const out = []; for (const box of [lado.coordenador, ...lado.sessoes]) { if (!box) continue; if (box.conta) out.push(box); out.push(...box.ajudantes.itens); } return out; };
    const porLado = { claude: contagemOf(entriesOf(claude)), codex: contagemOf(entriesOf(codex)) };
    const contagem = contagemOf([...entriesOf(claude), ...entriesOf(codex)]);
    const waiting = snapshot && snapshot.management && snapshot.management.waiting && finite(snapshot.management.waiting.count) ? snapshot.management.waiting.count : snapshot && finite(snapshot.needsCount) ? snapshot.needsCount : null;
    return { known, now, activityReadAt: stamp(snapshot && snapshot.updated), processReadingAvailable: Boolean(equipe && equipe.activitySource && equipe.activitySource.processReadingAvailable === true), lados: [claude, codex], porLado, contagem, dono: { esperam: waiting } };
  }
  // O numero de "trabalhando agora" e de agentes, igual em toda a tela (o Inicio chama isto).
  function contagem(snapshot, now) { return ladosOf(snapshot, now, false, { casa: true }).contagem; }

  // A tela em dados: os cartoes de cada agente (linha do tempo e retratos), o topo e o consumo.
  function viewOf(snapshot, lang, now, options = {}) {
    lang = langOf(lang); now = Number.isFinite(now) ? now : Date.now();
    const w = W[lang], equipe = snapshot && snapshot.equipe, model = options.lados || ladosOf(snapshot, now, options.failed === true, { casa: true });
    const cards = [];
    const roleOf = box => box.tipo === 'coordenador' ? w.tree.coordRole[box.lado] : box.tipo === 'guarda' ? w.tree.guardRole : w.tree.roles[box.chave] || (box.lado === 'codex' ? w.tree.codexConversation : w.tree.claudeConversation);
    const nameOf = box => box.casa || box.coordVivo ? (box.tipo === 'coordenador' ? w.tree.coord[box.lado] : box.nome) : model.scalar && box.raw ? presentationLabel(box.raw.presentation, box.conversationId, lang, model.metadataContext, now) || roleOf(box) : box.tipo === 'coordenador' ? w.tree.coord[box.lado] : box.tipo === 'guarda' ? w.tree.guard : box.nome || roleOf(box);
    for (const lado of model.lados) for (const box of [lado.coordenador, ...lado.sessoes]) {
      if (!box) continue;
      if (model.scalar && !box.conta) continue;
      const summary = box.summary || null, next = summary && (summary.proximo || summary.precisa || summary.fez);
      cards.push({ id: box.id, kind: box.tipo === 'sessao' ? 'session' : 'agent', box, raw: box.raw || {}, agente: box.raw && box.raw.agente, estado: box.estado, state: PE_STATE[box.estado], side: box.lado, chave: box.chave, family: box.lado, name: nameOf(box), what: roleOf(box), needsYou: box.precisa === true, lastAt: box.ultimaEm, goalText: next ? String(next).replace(/\s+/g, ' ').slice(0, 110) : roleOf(box) });
      for (const item of box.ajudantes.itens) cards.push({ id: item.id, kind: 'agent', helperOf: box.id, raw: item.raw, agente: item.raw.agente, estado: item.estado, state: PE_STATE[item.estado], side: box.lado, family: familyOf(item.raw), name: (model.scalar ? null : roleName(item.raw, lang)) || w.flow.helpersShort(box.lado === 'codex'), what: model.scalar ? w.flow.helpersShort(box.lado === 'codex') : whatOf(item.raw, lang), needsYou: false, lastAt: item.ultimaEm, goalText: nameOf(box) });
    }
    const pool = poolOf(snapshot, options.pool);
    const portraits = assignPortraits(cards, pool, options.memory || null);
    for (const card of cards) card.portrait = portraits.get(card.id) || null;
    const c = model.contagem;
    const tokens = equipe && finite(equipe.tokens) ? equipe.tokens : null;
    const waterMl = equipe && finite(equipe.waterMl) ? equipe.waterMl : null;
    return {
      lang, now, known: model.known, lados: model,
      lowerBound: model.lowerBound === true, coverage: model.coverage,
      stale: model.stale === true, ageSeconds: model.scalar && model.known ? Math.floor((now - model.activityReadAt) / 1000) : null,
      observedWorking: model.stale && model.known && (model.countsKnown !== false || model.countsAvailable) ? c.trabalhando : null,
      total: model.known ? c.agentes : null, working: !model.stale && model.known && (model.countsKnown !== false || model.countsAvailable) ? c.trabalhando : null,
      waiting: model.known && (model.countsKnown !== false || model.countsAvailable) ? c.esperando : null, sleeping: model.known && (model.countsKnown !== false || model.countsAvailable) ? c.dormindo : null, done: model.known && (model.countsKnown !== false || model.countsAvailable) ? c.terminaram : null, unknown: model.known ? c.semLeitura : null,
      consumption: { tokens, exact: !(equipe && equipe.tokensExact === false), waterMl, cups: cupsOf(waterMl), measurementAt:equipe?.consumption?.lastMeasurementAt||equipe?.consumption?.readAt||null, frescor: equipe?.consumption?.frescor?.velho ? equipe.consumption.frescor : null, consumo: equipe && equipe.consumo && finite(equipe.consumo.total) ? equipe.consumo : null },
      cards: new Map(cards.map(card => [card.id, card])),
      updated: snapshot && snapshot.updated ? snapshot.updated : null
    };
  }
  function heroLine(view) {
    const w = W[view.lang], parts = [];
    if (view.total === null) return w.readFail;
    if (view.lowerBound) parts.push({ pt: 'Leitura parcial', en: 'Partial reading', es: 'Lectura parcial' }[view.lang]);
    if (finite(view.ageSeconds)) parts.push(readingAge(view.ageSeconds, view.lang));
    parts.push(w.ofAgents(view.total));
    for (const [key, word] of [['waiting', 'esperando'], ['sleeping', 'dormindo'], ['done', 'terminaram'], ['unknown', 'semLeitura']]) if (view[key]) parts.push(w.counts[word](view[key]));
    if (view.coverage && view.coverage.unread > 0) parts.push({ pt: view.coverage.unread + ' fontes sem leitura', en: view.coverage.unread + ' unread sources', es: view.coverage.unread + ' fuentes sin lectura' }[view.lang]);
    return parts.join(' · ');
  }
  function pintarMistura(node, mix) { if (!node || !node.classList || !node.style) return; if (!mix) { node.classList.remove('agentes-mix'); node.style.removeProperty('--mix-claude'); return; } node.classList.add('agentes-mix'); node.style.setProperty('--mix-claude', mix.pct + '%'); node.title = 'Claude ' + mix.claude + ' · Codex ' + mix.codex; }
  function workingText(value, lang, lowerBound) { return value === null ? W[lang].state['sem-leitura'] : (lowerBound ? { pt: 'Pelo menos ', en: 'At least ', es: 'Al menos ' }[lang] : '') + value; }
  function readingAge(seconds, lang) { return { pt: 'lido há ', en: 'read ', es: 'leído hace ' }[lang] + seconds + (lang === 'en' ? ' s ago' : ' s'); }
  function readingLabel(stale, lang) { return stale ? { pt: 'trabalhando na última leitura', en: 'working at the last reading', es: 'trabajando en la última lectura' }[lang] : W[lang].workingNow; }
  function displayWorking(view) { return view.stale ? view.observedWorking : view.working; }
  // r11: o topo da Equipe usa uma conta so, a das caixas desenhadas; trabalhando + esperando + dormindo fecha com o total.
  // (as chaves ativas do Inicio contam ajudantes que a Arvore nao desenha e davam 5 trabalhando com 2 + 8 de 12)
  function topoDaEquipe(view) {
    const n = displayWorking(view), sides = view.lados && view.lados.porLado;
    return { n, sub: heroLine(view), lados: view.known && n !== null && n !== undefined && sides ? { claude: sides.claude.trabalhando, codex: sides.codex.trabalhando } : null };
  }
  function sinceOf(consumo, lang) {
    const at = consumo ? Date.parse(consumo.desde) : NaN; if (!Number.isFinite(at)) return '';
    const d = new Date(at - 3 * 3600000), two = n => String(n).padStart(2, '0'), hm = two(d.getUTCHours()) + ':' + two(d.getUTCMinutes());
    return lang === 'en' ? ' since ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + hm : ' desde ' + two(d.getUTCDate()) + '/' + two(d.getUTCMonth() + 1) + ' ' + hm;
  }
  function waterText(waterMl, lang) {
    if (!finite(waterMl)) return '?';
    const liters = waterMl >= 1000;
    let number;
    try { number = new Intl.NumberFormat(LOCALE[langOf(lang)], { maximumFractionDigits: liters && waterMl < 10000 ? 1 : 0 }).format(liters ? waterMl / 1000 : waterMl); } catch { number = String(Math.round(liters ? waterMl / 1000 : waterMl)); }
    return '~' + number + (liters ? ' L' : ' ml');
  }
  function modelName(value) { const raw = fold(value); return /claude|opus|sonnet|haiku|fable/.test(raw) ? 'Claude' : /gpt|codex|o\d/.test(raw) ? 'Codex' : null; }

  // ---------- FLUXO: modelo (dados do GET /api/pe-equipe/fluxo + o modelo das duas IAs) ----------
  const KINDS = ['comando', 'duvida', 'resposta'];
  const CLAUDE_BOXES = new Set(['coordenador-claude', 'atendimento', 'loja', 'cortes', 'assistente']);
  function sideOfId(id) {
    const key = String(id || '');
    if (key === 'voce') return null;
    const base = key.startsWith('ajudantes:') ? key.slice(10) : key;
    if (CLAUDE_BOXES.has(base)) return 'claude';
    if (base === 'coordenador-codex' || base === 'codex' || base.startsWith('codex:')) return 'codex';
    if (base.startsWith('claude:')) return 'claude';
    return null;
  }
  // Caixa do modelo das duas IAs para cada caixa do fluxo (o estado da arvore vale tambem no fluxo).
  function boxOfFlow(lados, id) {
    if (!lados) return null;
    if (lados.scalar) return lados.lados.flatMap(lado => lado.sessoes).find(box => box.id === id) || null;
    const [claude, codex] = lados.lados;
    if (id === 'coordenador-claude') return claude.coordenador;
    if (id === 'coordenador-codex') return codex.coordenador;
    if (['atendimento', 'loja', 'cortes', 'assistente'].includes(id)) return claude.sessoes.find(box => box.chave === id.toUpperCase()) || null;
    if (id.startsWith('codex:')) { const prefix = 'codex:' + id.slice(6).toLowerCase(); return codex.sessoes.find(box => String(box.chave || box.id).toLowerCase().startsWith(prefix)) || (String(codex.coordenador && codex.coordenador.raw && codex.coordenador.raw.id || '').toLowerCase().startsWith(prefix) ? codex.coordenador : null); }
    if (id.startsWith('claude:')) { const prefix = id.toLowerCase(); return claude.sessoes.find(box => box.tipo === 'conversa' && String(box.chave || '').toLowerCase().startsWith(prefix)) || null; }
    return null;
  }
  // id da caixa no fluxo para uma conversa do modelo ("codex:" ou "claude:" + 8 letras do id), ou null
  function flowIdOf(box) { if (scalarContext.has(box && box.raw)) return nativeId(box.id); const m = /^(codex|claude):([0-9a-z]{8})/i.exec(String(box && box.chave || '')); return m ? (m[1] + ':' + m[2]).toLowerCase() : null; }
  // Work is proved by the current agent metadata, never by message age, a guard round or a flow DTO label.
  const WORK_READ_MS = 90000;
  function trabalhoLeitura(lados, now) {
    if (lados && lados.scalar) { const c = lados.metadataContext; return Boolean(c && c.valid && now >= c.observedAt && now - c.observedAt <= METADATA_MS); }
    return Boolean(lados && lados.known === true && finite(lados.activityReadAt) && now >= lados.activityReadAt && now - lados.activityReadAt <= WORK_READ_MS);
  }
  function trabalhoComprovado(entity, now, runtimeRead = false, context = null) {
    if (context || scalarContext.has(entity) || has(entity, 'workProof') || entity && entity.source === 'scalar-metadata') return workState(entity, context || scalarContext.get(entity), now) === 'working';
    if (!entity || entity.observer === true || entity.observador === true || entity.stale === true || entity.unknown === true) return false;
    if (/^(?:observer|observador)$/i.test(String(entity.role || ''))) return false;
    const last = lastOf(entity, now), state = fold(entity.state);
    // A checked live process preserves the producer's running state for a long tool call.
    const fresh = entity.processAlive === true && runtimeRead === true || (last !== null && now - last < SLEEP_MS);
    return last !== null && last <= now && fresh && (state === 'working' || state === 'walking') && estadoOf(entity, now) === 'trabalhando';
  }
  function trabalhoOf(box, now, lados) {
    if (!trabalhoLeitura(lados, now)) return { own: false, helpers: 0, total: 0, source: null };
    const runtimeRead = lados.processReadingAvailable === true;
    const own = Boolean(box && box.conta && box.estado === 'trabalhando' && trabalhoComprovado(box.raw, now, runtimeRead));
    const items = box && box.ajudantes && Array.isArray(box.ajudantes.itens) ? box.ajudantes.itens : [];
    const helpers = items.filter(item => trabalhoComprovado(item.raw, now, runtimeRead)).length;
    return { own, helpers, total: Number(own) + helpers, source: own ? (helpers ? 'both' : 'self') : helpers ? 'helpers' : null };
  }
  function trabalhoTotal(lados, now) {
    if (!trabalhoLeitura(lados, now) || !Array.isArray(lados.lados) || lados.scalar && !lados.countsAvailable) return null;
    const seen = new Set();
    for (const lado of lados.lados) for (const box of [lado.coordenador, ...(lado.sessoes || [])]) {
      if (!box) continue;
      if (box.conta && box.estado === 'trabalhando' && trabalhoComprovado(box.raw, now, lados.processReadingAvailable)) seen.add(box.raw.id || box.id);
      for (const item of box.ajudantes && box.ajudantes.itens || []) if (trabalhoComprovado(item.raw, now, lados.processReadingAvailable)) seen.add(item.raw.id || item.id);
    }
    return seen.size;
  }
  function scalarFlowView(data, lang, now) {
    const w = W[lang], f = w.flow, context = metadataContext(data, now);
    const unavailable = () => ({ scalar: true, metadataContext: context, known: false, nodes: [], edges: [], working: null, note: f.notRead('?') });
    if (!context.retained || !data || data.ok !== true || !Array.isArray(data.nodes)) return unavailable();
    if (!context.valid) {
      const since = now - 2 * 60 * 60 * 1000;
      const edges = (Array.isArray(data.edges) ? data.edges : []).filter(edge => { const at = stamp(edge.lastAt); return at !== null && at >= since && at <= now; });
      const previous = scalarFlowView({ ...data, edges }, lang, context.observedAt);
      return { ...previous, metadataContext: context, stale: true, ageSeconds: Math.floor((now - context.observedAt) / 1000), observedWorking: previous.working, working: null,
        nodes: previous.nodes.map(node => ({ ...node, estado: 'sem-leitura', work: false, hot: false, lines: node.lines.map(line => [line[0], false]) })), edges: previous.edges.map(edge => ({ ...edge, recent: false })), workSignal: false,
        note: readingAge(Math.floor((now - context.observedAt) / 1000), lang) + ' · ' + previous.note };
    }
    const roots = [], groups = [], used = new Set(); let issue = false;
    for (const node of data.nodes) {
      if (!node || typeof node.id !== 'string') { issue = true; continue; }
      if (used.has(node.id.toLowerCase())) { issue = true; return unavailable(); } used.add(node.id.toLowerCase());
      if (node.id === 'voce') continue;
      if (node.stage === 'ajudantes' || node.id.startsWith('ajudantes:')) { groups.push(node); continue; }
      const id = nativeId(node.id), family = familyOf(node);
      if (!id || !family || !id.startsWith(family + ':') || nativeId(node.rootId) !== id || node.parentId != null) { issue = true; continue; }
      roots.push(scalarEntity(node, id, family, null, id));
    }
    const byRoot = new Map(roots.map(root => [root.id, root])), actors = [...roots], taken = new Set(roots.map(root => root.id)), cleanGroups = [];
    for (const node of groups) {
      const rootId = nativeId(node.rootId), root = byRoot.get(rootId);
      if (!root || node.id.toLowerCase() !== 'ajudantes:' + rootId || nativeId(node.of) !== rootId || familyOf(node) !== root.family || node.workProof != null || !Array.isArray(node.members)) { issue = true; continue; }
      const members = [];
      for (const member of node.members) {
        const id = nativeId(member && member.id), parentId = nativeId(member && member.parentId), memberRoot = nativeId(member && member.rootId);
        if (taken.has(id)) return unavailable();
        if (!id || !parentId || memberRoot !== rootId || !id.startsWith(root.family + ':') || !parentId.startsWith(root.family + ':') || member.family && familyOf(member) !== root.family) { issue = true; continue; }
        taken.add(id); const raw = scalarEntity(member, id, root.family, parentId, rootId); members.push(raw); actors.push(raw);
      }
      cleanGroups.push({ id: 'ajudantes:' + rootId, of: rootId, rootId, family: root.family, members,
        workProof: null, presentation: node.presentation, lastAt: node.lastAt, eventLastAt: node.eventLastAt });
    }
    const projected = scalarLados({ metadataProof: data.metadataProof, readerStatus: issue ? 'partial' : data.readerStatus, equipe: { agents: actors, source: 'scalar-metadata' } }, now, false);
    const boxes = projected.lados.flatMap(lado => lado.sessoes), accepted = new Set(boxes.flatMap(box => [box.id, ...box.ajudantes.itens.map(member => member.id)]));
    const plainOf = root => presentationLabel(root.presentation, root.id, lang, context, now) || (root.family === 'codex' ? w.tree.codexConversation : w.tree.claudeConversation);
    const safeNodes = roots.filter(root => accepted.has(root.id)).map(root => ({ ...root, name: plainOf(root), state: workState(root, context, now), stage: 'sessoes', side: root.family, needsYou: null }));
    if (data.nodes.some(node => node && node.id === 'voce')) safeNodes.unshift({ id: 'voce', state: null, needsYou: null, waiting: null, lastAt: null });
    for (const group of cleanGroups) if (accepted.has(group.rootId)) {
      const box = boxes.find(item => item.id === group.rootId), members = group.members.filter(member => accepted.has(member.id));
      const allKnown = projected.complete && members.length > 0 && members.every(member => workState(member, context, now) !== 'unknown');
      const working = allKnown ? members.filter(member => workState(member, context, now) === 'working').length : null;
      const state = !allKnown ? 'unknown' : working > 0 ? 'working' : members.some(member => workState(member, context, now) === 'waiting') ? 'waiting' : 'done';
      const total = projected.complete && members.length > 0 ? members.length : null;
      safeNodes.push({ ...group, state, stage: 'ajudantes', side: group.family, needsYou: null, total, working });
      if (box && !allKnown) { box.ajudantes.total = total; for (const key of ['trabalhando', 'esperando', 'dormindo', 'terminaram', 'semLeitura']) box.ajudantes[key] = null; }
    }
    const sources = {}, inputSources = data.sources;
    for (const key of ['claude', 'codex', 'painel', 'sessoes']) if (has(inputSources, key)) sources[key] = inputSources[key];
    const view = legacyFlowView({ ok: true, nodes: safeNodes, edges: data.edges, sources, readAt: data.readAt }, lang, now, projected);
    const groupStates = new Map(safeNodes.filter(node => node.stage === 'ajudantes').map(node => [node.id, node.state]));
    for (const node of view.nodes) {
      node.needsYou = null; node.actor = node.id !== 'voce' && node.stage !== 'ajudantes';
      if (node.stage === 'ajudantes') {
        node.estado = { working: 'trabalhando', waiting: 'esperando', done: 'terminou', unknown: 'sem-leitura' }[groupStates.get(node.id)] || 'sem-leitura';
        if (node.estado === 'sem-leitura') node.lines = [['?', false]];
        if (node.work) node.workSource = 'helpers';
      }
    }
    return { ...view, scalar: true, metadataContext: context, lowerBound: projected.lowerBound, coverage: projected.coverage, note: projected.lowerBound ? heroLine(viewOf({ metadataProof: data.metadataProof, readerStatus: data.readerStatus, equipe: { agents: actors, source: 'scalar-metadata' } }, lang, now)) : view.note, workSignal: view.nodes.some(node => node.work) };
  }
  // nos ultimos 5 min (leitor v2), ajudante ativo sem entrega (mtime de 5 min e sem SubagentHandback/end_turn) e Codex rodando de
  // verdade (codex-sessoes: processo vivo e nao pausado). Conversa antiga, arquivo tocado sem ferramenta e rodada pausada nao contam.
  // Sem nenhuma sessao da casa lida pelo v2: null ("?"), nunca 0 inventado.
  function andaComprovado(lados, f2, now) {
    now = Number.isFinite(now) ? now : Date.now();
    if (!lados || !Array.isArray(lados.lados)) return null;
    const [claude] = lados.lados, casa = [claude.coordenador, ...claude.sessoes].filter(box => box && box.casa);
    if (!casa.some(box => box.fluxo)) return null;
    const quem = [];
    for (const box of casa) {
      const t = box.ferramenta ? stamp(box.ferramenta.em) : null, sessao = t !== null && now - t <= ATIVA_MS && t - now <= FUTURE_MS;
      const ajudantes = box.ajudantes && Number.isInteger(box.ajudantes.trabalhando) ? box.ajudantes.trabalhando : 0;
      if (sessao || ajudantes > 0) quem.push({ id: CASA_IDS[box.chave] || null, chave: box.chave, side: 'claude', sessao, ajudantes, ferramentaEm: sessao ? new Date(t).toISOString() : null });
    }
    let codex = 0;
    if (f2 && f2.ok === true) for (const c of [...(Array.isArray(f2.sessoes) ? f2.sessoes.flatMap(s => Array.isArray(s && s.codex) ? s.codex : []) : []), ...(Array.isArray(f2.semDono) ? f2.semDono : [])]) if (c && c.estado === 'rodando') codex++;
    if (codex) quem.push({ id: 'codex', chave: 'CODEX', side: 'codex', sessao: false, ajudantes: 0, codex });
    const n = quem.reduce((a, q) => a + (q.sessao ? 1 : 0) + q.ajudantes + (q.codex || 0), 0);
    return { n, parcial: false, comprovado: true, quem, codexLido: Boolean(f2 && f2.ok === true) };
  }
  // le o mesmo objeto (PainelGrade.anda()); ninguem mais usa a conta antiga (PainelAtividade.agentes). Sem leitura: n null ("?"), nunca 0.
  // numero = o que a tela escreve; frase = quem anda, a mesma nos 3 temas ("Coordenador e 1 ajudante · Atendimento e 3 ajudantes · 1 Codex rodando").
  const andaNome = id => id === 'codex' ? 'Codex' : root.PainelNomes && typeof root.PainelNomes.nome === 'function' ? root.PainelNomes.nome(id) : String(id || '?');
  const andaAj = n => n === 1 ? '1 ajudante' : n + ' ajudantes';
  function andaFrase(conta) {
    if (!conta || !Number.isInteger(conta.n)) return '? sem leitura das conversas. Solução: o painel relê sozinho a cada 15 s; se seguir, reinicie o painel';
    const quem = Array.isArray(conta.quem) ? conta.quem : [];
    if (!quem.length) return 'ninguém com trabalho comprovado agora' + (conta.codexLido === false ? ' · Codex sem leitura (?)' : '');
    return quem.map(q => q.codex ? q.codex + ' Codex rodando' : q.sessao && q.ajudantes ? andaNome(q.id) + ' e ' + andaAj(q.ajudantes) : q.sessao ? andaNome(q.id) : andaNome(q.id) + ': ' + andaAj(q.ajudantes)).join(' · ');
  }
  function andaPainel(lados, f2, now) {
    let prova = null; try { prova = andaComprovado(lados, f2, now); } catch { prova = null; }
    const conta = prova || { n: null, parcial: false, comprovado: false, quem: [], codexLido: Boolean(f2 && f2.ok === true) };
    return { ...conta, numero: Number.isInteger(conta.n) ? String(conta.n) : '?', frase: andaFrase(conta) };
  }
  function flowView(data, lang, now, lados) {
    lang = langOf(lang); now = Number.isFinite(now) ? now : Date.now();
    if (scalarMode(data) || lados && lados.scalar) return comCasaNoFluxo(scalarFlowView(data, lang, now), lados, lang, now);
    return legacyFlowView(data, lang, now, lados);
  }
  // Codex pelo lastAction do estado; Claude pelo NOME da ultima ferramenta (leitor v2) se for dos ultimos 5 min.
  function animInfo(box, now) {
    if (!box) return null;
    const fresca = item => { const at = item && typeof item.nome === 'string' ? stamp(item.em) : null; return at !== null && now - at <= ATIVA_MS && at - now <= FUTURE_MS ? item.nome : null; };
    return { familia: box.lado === 'codex' ? 'codex' : 'claude', estado: box.estado, precisa: box.precisa === true, acao: box.acao || null, ferramenta: box.estado === 'trabalhando' ? fresca(box.ferramenta) : null };
  }
  function acaoTexto(box, now, lang) {
    const anim = root.PaAnim; if (!anim || typeof anim.tipoDe !== 'function') return null;
    try { const t = anim.tipoDe(animInfo(box, now)); return t && t.rotulo ? t.rotulo[langOf(lang)] || t.rotulo.pt : null; } catch { return null; }
  }
  function frenteCodex(fr, lang) {
    lang=langOf(lang);
    if(!fr||fr.estado!=='rodando'||!fr.nomes||!fr.atividades)return null;
    const title=fr.nomes[lang], action=fr.atividades[lang];
    if(typeof title!=='string'||typeof action!=='string'||!title.trim()||title.trim().split(/\s+/).length>4||/\d|\b(?:frente|task)\b|[\u2013\u2014]/i.test(title)||!action.trim()||/[\u2013\u2014]/.test(action))return null;
    return{title,plain:title,lines:[[action,true]]};
  }
  function comCasaNoFluxo(view, lados, lang, now) {
    if (!view || !view.known || !lados || !lados.comCasa || !Array.isArray(view.nodes)) return view;
    const w = W[lang], f = w.flow, [claude, codex] = lados.lados, boxes = new Map();
    for (const lado of lados.lados) for (const box of [lado.coordenador, ...lado.sessoes]) if (box && !box.casa && box.raw && box.raw.id) boxes.set(String(box.raw.id).toLowerCase(), box);
    // letras da conversa de cada sessao) e a MESMA caixa da casa: sai daqui e a caixa da casa entra abaixo (nunca 2 vezes)
    const casaPorConversa = new Map();
    for (const box of [claude.coordenador, ...claude.sessoes]) {
      const cru = box && box.casa ? (box.fluxo && typeof box.fluxo.conversa === 'string' ? box.fluxo.conversa : typeof box.conversationId === 'string' ? box.conversationId.replace(/^claude:/i, '') : '') : '';
      const conv = /^[0-9a-f]{8}/i.test(cru) ? cru.slice(0, 8).toLowerCase() : null;
      if (conv && CASA_IDS[box.chave]) casaPorConversa.set(conv, CASA_IDS[box.chave]);
    }
    const daCasa = raw => { const m = /^claude:([0-9a-f]{8})/i.exec(String(raw || '')); return m ? casaPorConversa.get(m[1].toLowerCase()) || null : null; };
    // quem trabalha diz o que faz ("escrevendo código · há 1 min"); sem tipo lido, "trabalhando"
    const lineOf = box => [(box.precisa ? w.needsYou.toLowerCase() : box.estado === 'trabalhando' ? acaoTexto(box, now, lang) || f.state[box.estado] : f.state[box.estado]) + ' · ' + agoOf(box.ultimaEm, now, lang), box.estado === 'trabalhando' || box.precisa === true];
    const nodes = [];
    for (const node of view.nodes) {
      if (node.id !== 'voce' && daCasa(node.stage === 'ajudantes' ? node.of : node.id)) continue;
      const box = boxes.get(String(node.stage === 'ajudantes' ? node.of : node.id || '').toLowerCase()) || null;
      if (box && box.antiga) continue;
      if (node.id === 'voce') {
        const cards = lados.dono && finite(lados.dono.cards) ? lados.dono.cards : null, spoke = lados.dono ? stamp(lados.dono.falouEm) : null;
        node.lines = [...(cards !== null ? [[f.cards(cards), cards > 0]] : []), ...(spoke !== null ? [[f.spoke(agoOf(spoke, now, lang)), false]] : [])];
        node.hot = cards > 0;
      } else if (node.stage === 'ajudantes') {
        // sem o chip de fracao: os executores viram 1 linha de texto na caixa da conversa ("9 executores · parados")
        continue;
      } else if (box) {
        node.estado = box.estado;
        // conversa do Codex sem nome aprovado: "codex" + o selo CONVERSA (o nome longo nao cabia e saia cortado)
        if (node.side === 'codex' && node.title === fold(w.tree.codexConversation)) node.title = f.names.codex;
        const group = box.ajudantes;
        node.lines = [lineOf(box), ...(group && group.total > 0 ? [[f.helpersWords(group.total, group.trabalhando || 0, node.side === 'codex'), group.trabalhando > 0]] : [])];
        if (box === codex.coordenador) Object.assign(node, { stage: 'coord', title: f.names['coordenador-codex'], plain: f.plain['coordenador-codex'], tag: f.tag.executa });
      }
      nodes.push(node);
    }
    // o COORDENADOR do Codex que a Arvore tem e a leitura do fio nao trouxe entra igual (sem fio)
    const coordCodex = codex.coordenador && codex.coordenador.coordVivo ? codex.coordenador : null, coordId = coordCodex ? nativeId(coordCodex.raw && coordCodex.raw.id) : null;
    if (coordId && !nodes.some(node => String(node.id).toLowerCase() === coordId)) nodes.push({ id: coordId, stage: 'coord', side: 'codex', of: null, estado: coordCodex.estado, needsYou: false, actor: true, work: false, workSource: null, title: f.names['coordenador-codex'], plain: f.plain['coordenador-codex'], tag: f.tag.executa, lines: [lineOf(coordCodex), ...(coordCodex.ajudantes && coordCodex.ajudantes.total > 0 ? [[f.helpersWords(coordCodex.ajudantes.total, coordCodex.ajudantes.trabalhando || 0, true), coordCodex.ajudantes.trabalhando > 0]] : [])] });
    const casaIds = new Map();
    for (const box of [claude.coordenador, ...claude.sessoes]) {
      const id = box && box.casa ? CASA_IDS[box.chave] : null;
      if (!id) continue;
      casaIds.set(box.chave, id);
      if (nodes.some(node => node.id === id)) continue;
      const aj = box.ajudantes && box.ajudantes.total > 0 ? [[(AJ_TXT[lang] || AJ_TXT.pt).linha(box.ajudantes.total, box.ajudantes.trabalhando || 0), box.ajudantes.trabalhando > 0]] : [];
      nodes.push({ id, stage: box.tipo === 'coordenador' ? 'coord' : 'sessoes', side: 'claude', of: null, estado: box.estado, needsYou: box.precisa === true, actor: true, work: false, workSource: null,
        title: f.names[id], plain: f.plain[id], tag: box.tipo === 'coordenador' ? f.tag.coord : f.tag.sessao, lines: [lineOf(box), ...aj] });
    }
    for (const node of nodes) if (node.id !== 'voce' && node.estado === 'trabalhando') { node.work = true; node.workSource = node.workSource || 'self'; }
    const ids = new Set(nodes.map(node => node.id)), byId = new Map(nodes.map(node => [node.id, node]));
    const add = node => { nodes.push(node); ids.add(node.id); byId.set(node.id, node); return node.id; };
    // estado/codex.md, GET /api/pe-equipe/codex-frentes) vira 1 caixa filha ligada o COORDENADOR do Codex. Sem leitura: nada desenhado.
    const coordNo = nodes.find(node => node.side === 'codex' && node.stage === 'coord'), filhosFrente = [];
    if (coordNo) for (const fr of (Array.isArray(lados.frentesCodex) ? lados.frentesCodex : []).slice(0, 3)) {
      if (!fr || !/^\d{3}$/.test(String(fr.item))) continue;
      const id = 'codex:frente:' + fr.item; if (ids.has(id)) continue;
      const label = frenteCodex(fr, lang); if (!label) continue;
      add({ id, stage: 'sessoes', side: 'codex', of: null, estado: 'trabalhando', needsYou: false, actor: true, work: true, workSource: 'self', ...label, tag: f.tag.executa });
      filhosFrente.push([coordNo.id, id, fr]);
    }
    if (coordNo && filhosFrente.length) { coordNo.work = true; coordNo.workSource = coordNo.workSource || 'self'; }
    // (snapshot.fluxoHistorico[periodo], quando o Codex ligar); em 2 h sem ele, o leitor do Claude (v2). Sem dado: nenhum fio.
    const janela = JANELAS_FLUXO.includes(lados.janelaFluxo) ? lados.janelaFluxo : '2h';
    const hist = lados.historicoFluxo && typeof lados.historicoFluxo === 'object' ? lados.historicoFluxo : null;
    // o historico por hora (balde que cruza o comeco da janela entra inteiro) fica so para 6 h ou mais
    const casaBoxes = [claude.coordenador, ...claude.sessoes].filter(box => box && box.casa);
    const lidaV2 = casaBoxes.some(box => box.fluxo);
    const usaHist = janela !== '2h' && Boolean(hist && hist.lido === true && Array.isArray(hist.ligacoes));
    const edges = !usaHist && janela === '2h' ? (view.edges || []).filter(edge => ids.has(edge.from) && ids.has(edge.to)) : [];
    const msgDe = (m, kind, source, from, to) => ({ time: clock(m.em, lang) || '', at: m.em, kind, text: phraseOf({ kind, source }, { from, to }, lang), subject: null, reserved: false, ...(m.resumo ? { resumo: m.resumo } : {}) });
    const refaz = edge => {
      const ult = edge.messages.reduce((best, m) => { const t = stamp(m.at); return t !== null && (best === null || t > best.t) ? { t, m } : best; }, null);
      if (ult) { const age = Math.max(0, now - ult.t); edge.kind = ult.m.kind; edge.ageMin = Math.floor(age / 60000); edge.recent = age <= 15 * 60000; edge.lastTime = ult.m.time; }
      edge.messages.sort((x, y) => (stamp(x.at) || 0) - (stamp(y.at) || 0));
      edge.label = f.kind[edge.kind] + ' ' + edge.count; edge.width = Math.min(3, 1.6 + Math.log2(1 + edge.count) * 0.4);
    };
    const novo = (from, to, count, lastAt, source, kind = 'comando', msgs = null) => {
      const at = lastAt === null ? null : stamp(lastAt); if (!ids.has(from) || !ids.has(to) || from === to || !(count > 0) || at !== null && at > now + FUTURE_MS) return;
      if (lastAt !== null && at === null) return;
      const age = at === null ? null : Math.max(0, now - at), a = byId.get(from), b = byId.get(to), sender = from === 'voce' ? 'voce' : a.side || 'claude';
      // cada mensagem com a sua hora e o seu tipo (a v2 traz a lista); sem lista, 1 mensagem com a hora da ultima
      const lista = Array.isArray(msgs) && msgs.length ? msgs.filter(m => m && stamp(m.em) !== null && stamp(m.em) <= now + FUTURE_MS).map(m => msgDe(m, KINDS.includes(m.tipo) ? m.tipo : kind, source, from, to)) : null;
      const key = from + '>' + to, old = edges.find(edge => edge.key === key);
      if (old) { old.count += count; if (lista) { old.messages.push(...lista); refaz(old); } else { old.label = f.kind[old.kind] + ' ' + old.count; old.width = Math.min(3, 1.6 + Math.log2(1 + old.count) * 0.4); } return; }
      const message = { time: at === null ? '' : clock(lastAt, lang) || '', kind, text: phraseOf({ kind, source }, { from, to }, lang), subject: null, reserved: false };
      const edge = { key, from, to, kind, count, recent: age !== null && age <= 15 * 60000, ageMin: age === null ? null : Math.floor(age / 60000), sender, width: Math.min(3, 1.6 + Math.log2(1 + count) * 0.4),
        label: f.kind[kind] + ' ' + count, title: a.plain + ' → ' + b.plain, short: a.plain + ' → ' + b.plain, chat: b.plain, aria: a.plain + ' ' + f.to + ' ' + b.plain + ': ' + f.count(count) + ', ' + f.kind[kind],
        lastTime: at === null ? '' : clock(lastAt, lang) || '', messages: lista || [message] };
      if (lista) refaz(edge);
      edges.push(edge);
    };
    for (const [de, para, fr] of filhosFrente) novo(de, para, 1, fr.ultimaEm || fr.desde, 'codex:spawn_agent', 'comando');
    let histNota = null;
    if (usaHist) {
      // ids do historico: voce, coordenador-claude, atendimento, loja, cortes, assistente, coordenador-codex, codex:<8 letras>, codex:outras, ajudantes:<no>
      const casaValores = new Set(Object.values(CASA_IDS)), totais = new Map(), ajudantes = { n: 0 };
      for (const l of hist.ligacoes) if (l && Number.isFinite(l.n)) for (const id of [l.de, l.para]) totais.set(id, (totais.get(id) || 0) + l.n);
      const outras = () => ids.has('codex:outras') ? 'codex:outras' : add({ id: 'codex:outras', stage: 'sessoes', side: 'codex', of: null, estado: 'sem-leitura', needsYou: false, actor: true, work: false, workSource: null, title: f.names.codex, plain: f.outrasCodex, tag: f.tag.conversa, lines: [] });
      const idDe = raw => {
        const id = String(raw || '');
        if (id === 'voce' || casaValores.has(id)) return ids.has(id) ? id : null;
        if (id === 'coordenador-codex') { const coord = nodes.find(node => node.side === 'codex' && node.stage === 'coord'); return coord ? coord.id : add({ id: 'coordenador-codex', stage: 'coord', side: 'codex', of: null, estado: 'sem-leitura', needsYou: false, actor: true, work: false, workSource: null, title: f.names['coordenador-codex'], plain: f.plain['coordenador-codex'], tag: f.tag.executa, lines: [] }); }
        if (/^codex:[0-9a-f]{8}$/i.test(id)) { const hit = nodes.find(node => String(node.id).toLowerCase().startsWith(id.toLowerCase())); return hit ? hit.id : outras(); }
        // "codex" do historico = a fila (Claude -> Codex) e o "PARA COORDENADOR" do codex.md (Codex -> Claude):
        // quem le e escreve os dois e o COORDENADOR do Codex, entao o fio liga as duas COORDENADOR (antes caia numa "conversa" solta)
        if (id === 'codex') { const coord = nodes.find(node => node.side === 'codex' && node.stage === 'coord'); return coord ? coord.id : outras(); }
        if (id === 'codex:outras') return outras();
        return null;
      };
      for (const l of hist.ligacoes) {
        if (!l || !(l.n > 0)) continue;
        if (l.tipo === 'ajudante' || String(l.para).startsWith('ajudantes:') || String(l.de).startsWith('ajudantes:')) { ajudantes.n += l.n; continue; }
        const de = idDe(l.de), para = idDe(l.para); if (!de || !para) continue;
        novo(de, para, l.n, null, l.tipo === 'dono' ? 'claude:dono' : 'claude:sessao', l.tipo === 'para-coordenador' ? 'resposta' : 'comando');
      }
      // caixa que entrou so pelo historico: a linha diz quantas mensagens teve no periodo (nunca "?")
      for (const node of nodes) if (!node.lines.length && node.id !== 'voce') { let n = 0; for (const edge of edges) if (edge.from === node.id || edge.to === node.id) n += edge.count; node.lines = [[f.mensagens(n), false]]; }
      if (!hist.cobreJanela && hist.historicoDesde) histNota = f.histDesde(dataCurta(hist.historicoDesde, lang));
      if (ajudantes.n) histNota = [histNota, f.histAjudantes(ajudantes.n)].filter(Boolean).join(' · ');
    } else if (janela === '2h' && lidaV2) {
      // Ligacoes que o leitor do Claude (v2) le na cauda das conversas: voce -> sessao (o que ele digitou), sessao -> sessao
      // (recado, com a hora e o tipo de cada um pelo kindOf) e sessao <-> ajudantes (abriu, recado ao ajudante, devolveu).
      const tx = AJ_TXT[lang] || AJ_TXT.pt;
      for (const box of casaBoxes) {
        const to = casaIds.get(box.chave), fluxo = box.fluxo;
        if (!to || !fluxo) continue;
        if (fluxo.dono && fluxo.dono.mensagens > 0) novo('voce', to, fluxo.dono.mensagens, fluxo.dono.ultimaEm, 'claude:dono');
        for (const recado of Array.isArray(fluxo.recados) ? fluxo.recados : []) if (recado && casaIds.has(recado.de)) novo(casaIds.get(recado.de), to, recado.mensagens, recado.ultimaEm, 'claude:sessao', KINDS.includes(recado.tipo) ? recado.tipo : 'comando', Array.isArray(recado.msgs) ? recado.msgs : null);
        const aj = fluxo.ajudantes && typeof fluxo.ajudantes === 'object' ? fluxo.ajudantes : null;
        const parte = key => aj && aj[key] && Number.isFinite(aj[key].n) && aj[key].n > 0 ? aj[key] : null;
        const abriu = parte('abriu'), recado = parte('recado'), volta = parte('devolveu');
        if (!abriu && !recado && !volta) continue;
        const ajId = 'ajudantes:' + to, ativos = Number.isFinite(aj.ativos) ? aj.ativos : 0, dono = byId.get(to);
        if (!ids.has(ajId)) add({ id: ajId, stage: 'ajudantes', side: 'claude', of: to, estado: ativos > 0 ? 'trabalhando' : 'terminou', needsYou: false, actor: false, work: ativos > 0, workSource: ativos > 0 ? 'helpers' : null,
          title: f.helpersOf(dono ? dono.plain : to, false), plain: f.helpersOf(dono ? dono.plain : to, false), tag: f.helpersShort(false), total: (abriu ? abriu.n : 0), working: ativos,
          lines: [[tx.no((abriu ? abriu.n : 0), (volta ? volta.n : 0), ativos), ativos > 0]] });
        const horas = (p, resumo, tipo) => p ? (Array.isArray(p.horas) ? p.horas : []).map(em => ({ em, tipo, resumo })) : [];
        if (abriu) novo(to, ajId, abriu.n, abriu.ultimaEm, 'claude:despacho', 'comando', horas(abriu, tx.abriu, 'comando'));
        if (recado) novo(to, ajId, recado.n, recado.ultimaEm, 'claude:ajudante', 'comando', horas(recado, tx.recado, 'comando'));
        if (volta) novo(ajId, to, volta.n, volta.ultimaEm, 'claude:entrega', 'resposta', horas(volta, tx.volta, 'resposta'));
      }
    } else if (janela === '2h') histNota = (AJ_TXT[lang] || AJ_TXT.pt).semV2;
    else histNota = hist && hist.lido === false ? f.histLendo : f.histSem;
    const leituraSrv = lados.fluxoLeitura && typeof lados.fluxoLeitura === 'object' ? lados.fluxoLeitura : null;
    const v2Em = casaBoxes.map(box => box.fluxo && stamp(box.fluxo.lidoEm)).filter(t => t !== null).reduce((a, b) => Math.max(a, b), -Infinity);
    const janelaMin = casaBoxes.map(box => box.fluxo && Number(box.fluxo.janelaMin)).find(n => Number.isFinite(n) && n > 0) || 120;
    let leitura = null;
    if (janela === '2h' && lidaV2 && Number.isFinite(v2Em)) leitura = { fonte: 'conversas', lidoEm: new Date(v2Em).toISOString(), desde: new Date(v2Em - janelaMin * 60000).toISOString(), ate: new Date(v2Em).toISOString(), idadeMin: Math.max(0, Math.floor((now - v2Em) / 60000)) };
    else if (usaHist) { const t = stamp(hist.lidoEm); leitura = { fonte: 'historico', lidoEm: t === null ? null : new Date(t).toISOString(), desde: hist.desde || null, ate: hist.ate || null, idadeMin: t === null ? null : Math.max(0, Math.floor((now - t) / 60000)) }; }
    if (leitura && leituraSrv) { leitura.falha = leituraSrv.falha && stamp(leituraSrv.falha.em) !== null ? { em: leituraSrv.falha.em, motivo: String(leituraSrv.falha.motivo || '').slice(0, 60) } : null; leitura.pulada = leituraSrv.pulada && stamp(leituraSrv.pulada.em) !== null ? { em: leituraSrv.pulada.em, cpu: Number.isFinite(leituraSrv.pulada.cpu) ? leituraSrv.pulada.cpu : null } : null; leitura.conversasFalhaEm = leitura.fonte === 'conversas' && stamp(leituraSrv.conversasFalhaEm) !== null && stamp(leituraSrv.conversasFalhaEm) > v2Em ? leituraSrv.conversasFalhaEm : null; }
    return { ...view, nodes, edges, lidaV2, janela, histNota, leitura, historicoDesde: hist && hist.historicoDesde || null, antigas: (lados.antigas && (lados.antigas.claude + lados.antigas.codex)) || 0, workSignal: nodes.some(node => node.work) };
  }
  const AJ_TXT = {
    pt: { semV2: 'conversas do Claude sem leitura nesta volta (?) Solução: o painel relê sozinho a cada 15 s; se seguir, reinicie o painel', abriu: 'abriu ajudante', recado: 'recado ao ajudante', volta: 'ajudante entregou', linha: n => (n === 1 ? '1 ajudante trabalhou' : n + ' ajudantes trabalharam') + ' em 2 h',
      no: (abertos, voltas) => (abertos === 1 ? '1 aberto' : abertos + ' abertos') + ' em 2 h · ' + (voltas === 1 ? '1 entrega' : voltas + ' entregas') + ' (inclui ajudantes de antes)' },
    en: { semV2: 'Claude chats not read this round (?) Fix: the panel rereads every 15 s; if it stays, restart the panel', abriu: 'opened a helper', recado: 'note to the helper', volta: 'helper delivered', linha: n => (n === 1 ? '1 helper worked' : n + ' helpers worked') + ' in 2 h',
      no: (opened, back) => opened + ' opened in 2 h · ' + (back === 1 ? '1 delivery' : back + ' deliveries') + ' (includes earlier helpers)' },
    es: { semV2: 'conversaciones de Claude sin lectura en esta vuelta (?) Solución: el panel relee solo cada 15 s; si sigue, reinicia el panel', abriu: 'abrió un ayudante', recado: 'mensaje al ayudante', volta: 'el ayudante entregó', linha: n => (n === 1 ? '1 ayudante trabajó' : n + ' ayudantes trabajaron') + ' en 2 h',
      no: (abiertos, vueltas) => abiertos + (abiertos === 1 ? ' abierto' : ' abiertos') + ' en 2 h · ' + (vueltas === 1 ? '1 entrega' : vueltas + ' entregas') + ' (incluye ayudantes de antes)' }
  };
  const JANELAS_FLUXO = ['2h', '6h', '12h', '24h', 'semana', 'mes', 'total'];
  function dataCurta(value, lang) {
    const at = stamp(value); if (at === null) return '';
    const d = new Date(at - 3 * 3600000), two = n => String(n).padStart(2, '0');
    return langOf(lang) === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' ' + d.getUTCDate() : two(d.getUTCDate()) + '/' + two(d.getUTCMonth() + 1);
  }
  // mensagens do periodo por caixa da Arvore (a mesma fonte do Fluxo): casa do Claude, COORDENADOR do Codex e conversas do Codex
  function ligacoesPorCaixa(lados, janela, hist) {
    const out = new Map(); if (!lados || !Array.isArray(lados.lados)) return out;
    const [claude, codex] = lados.lados, porId = new Map();
    for (const box of [claude.coordenador, ...claude.sessoes]) if (box && box.casa && CASA_IDS[box.chave]) porId.set(CASA_IDS[box.chave], box);
    const soma = (box, n) => { if (box) out.set(box.id, (out.get(box.id) || 0) + n); };
    const caixa = raw => {
      const id = String(raw || '');
      if (porId.has(id)) return porId.get(id);
      if (id === 'coordenador-codex') return codex.coordenador && codex.coordenador.coordVivo ? codex.coordenador : null;
      if (/^codex:[0-9a-f]{8}$/i.test(id)) return [codex.coordenador, ...codex.sessoes].find(box => box && box.raw && String(box.raw.id || '').toLowerCase().startsWith(id.toLowerCase())) || null;
      return null;
    };
    if (hist && hist.lido === true && Array.isArray(hist.ligacoes)) {
      for (const l of hist.ligacoes) if (l && l.n > 0 && l.tipo !== 'ajudante') { soma(caixa(l.de), l.n); soma(caixa(l.para), l.n); }
    } else if (janela === '2h') {
      for (const box of porId.values()) {
        const fluxo = box.fluxo; if (!fluxo) continue;
        if (fluxo.dono && fluxo.dono.mensagens > 0) soma(box, fluxo.dono.mensagens);
        for (const recado of Array.isArray(fluxo.recados) ? fluxo.recados : []) if (recado && recado.mensagens > 0) { soma(box, recado.mensagens); soma(porId.get(CASA_IDS[recado.de]), recado.mensagens); }
      }
    }
    return out;
  }
  function legacyFlowView(data, lang, now, lados) {
    lang = langOf(lang); now = Number.isFinite(now) ? now : Date.now();
    const w = W[lang], f = w.flow;
    const working = trabalhoTotal(lados, now);
    if (!data || data.ok !== true || !Array.isArray(data.nodes)) return { known: false, nodes: [], edges: [], working, note: data ? f.notRead('?') : f.loading };
    const STATE_IN = { working: 'trabalhando', waiting: 'esperando', sleeping: 'dormindo', done: 'terminou', unknown: 'sem-leitura' };
    const plainOf = (id, node) => { if (id.startsWith('codex:')) return (node && node.name) || w.tree.codexConversation; return f.plain[id] || (node && node.name) || '?'; };
    const titleOf = (id, node) => id.startsWith('codex:') ? fold((node && node.name) || w.tree.codexConversation) : f.names[id] || fold((node && node.name) || '?');
    const raw = new Map(data.nodes.filter(node => node && typeof node.id === 'string').map(node => [node.id, node]));
    const nodes = [];
    for (const node of raw.values()) {
      const id = node.id, of = id.startsWith('ajudantes:') ? id.slice(10) : null;
      if (of && !raw.has(of)) continue;
      const side = id === 'voce' ? null : node.side || sideOfId(id);
      if (id !== 'voce' && !side) continue;
      const stage = id === 'voce' ? 'voce' : of ? 'ajudantes' : node.stage === 'coord' || /^coordenador-/.test(id) ? 'coord' : 'sessoes';
      const box = of ? null : boxOfFlow(lados, id);
      let estado = box ? box.estado : STATE_IN[node.state] || 'sem-leitura';
      const last = box ? box.ultimaEm : stamp(node.lastAt);
      const work = trabalhoOf(box, now, lados);
      const view = { id, stage, side, of, estado, work: work.total > 0, workSource: work.source, needsYou: node.needsYou === true || Boolean(box && box.precisa) };
      if (id === 'voce') {
        const waiting = finite(node.waiting) ? node.waiting : lados && finite(lados.dono.esperam) ? lados.dono.esperam : null;
        Object.assign(view, { title: f.names.voce, plain: f.plain.voce, tag: f.tag.voce, lines: [[f.waitingYou(waiting), waiting > 0], [f.spoke(agoOf(node.lastAt, now, lang)), false]], hot: waiting > 0 });
      } else if (of) {
        const parent = raw.get(of), group = boxOfFlow(lados, of), codex = side === 'codex';
        const total = group ? group.ajudantes.total : finite(node.total) ? node.total : null, working = group ? group.ajudantes.trabalhando : finite(node.working) ? node.working : null;
        estado = working > 0 ? 'trabalhando' : total ? (group ? (group.ajudantes.esperando ? 'esperando' : 'dormindo') : STATE_IN[node.state] || 'dormindo') : STATE_IN[node.state] || 'sem-leitura';
        Object.assign(view, { estado, title: f.helpersShort(codex), plain: f.helpersOf(plainOf(of, parent), codex), lines: [[total === null ? '?' : total === 0 ? f.helpersNone : f.helpersPill(working || 0, total), working > 0]] });
        const proven = trabalhoOf(group, now, lados).helpers;
        view.work = proven > 0; view.workSource = proven > 0 ? 'self' : null;
      } else {
        const label = view.needsYou ? w.needsYou.toLowerCase() : f.state[estado];
        Object.assign(view, { title: titleOf(id, node), plain: plainOf(id, node), tag: stage === 'coord' ? (side === 'codex' ? f.tag.executa : f.tag.coord) : side === 'codex' ? f.tag.conversa : f.tag.sessao, lines: [[label + ' · ' + agoOf(last, now, lang), estado === 'trabalhando' || view.needsYou]] });
        if (work.helpers > 0) view.lines.push([f.helpersWorking(work.helpers), true]);
      }
      nodes.push(view);
    }
    // caixas que a conta tem e o fio nao (conversa ativa sem mensagem na janela, ou so com executores): entram sem fio, para o
    // Fluxo ter as mesmas caixas ativas da Arvore e do numero do topo
    if (lados && Array.isArray(lados.lados)) for (const lado of lados.lados) for (const box of lado.sessoes || []) {
      const id = box.tipo === 'conversa' ? flowIdOf(box) : null;
      if (!id || nodes.some(node => node.id === id)) continue;
      const helpers = box.ajudantes || { total: 0, trabalhando: 0, esperando: 0 };
      if (!(box.estado === 'trabalhando' || box.estado === 'esperando' || helpers.trabalhando > 0)) continue;
      const side = box.lado === 'codex' ? 'codex' : 'claude', codex = side === 'codex';
      const name = box.nome || (box.semRaiz ? w.tree.unreadName[side] : codex ? w.tree.codexConversation : w.tree.claudeConversation);
      const ago = agoOf(box.ultimaEm, now, lang);
      if (box.semRaiz) nodes.push({ id, stage: 'sessoes', side, of: null, estado: box.estado, needsYou: false, title: fold(name), plain: name, tag: f.tag.conversa, lines: [[(helpers.trabalhando > 0 ? f.helpersPill(helpers.trabalhando, helpers.total) : f.state[box.estado]) + ' · ' + ago, box.estado === 'trabalhando']] });
      else {
        nodes.push({ id, stage: 'sessoes', side, of: null, estado: box.estado, needsYou: false, title: fold(name), plain: name, tag: codex ? f.tag.conversa : f.tag.sessao, lines: [[f.state[box.estado] + ' · ' + ago, box.estado === 'trabalhando']] });
        if (helpers.total > 0 && !nodes.some(node => node.id === 'ajudantes:' + id)) nodes.push({ id: 'ajudantes:' + id, stage: 'ajudantes', side, of: id, estado: helpers.trabalhando > 0 ? 'trabalhando' : helpers.esperando ? 'esperando' : 'dormindo', needsYou: false, title: f.helpersShort(codex), plain: f.helpersOf(name, codex), lines: [[f.helpersPill(helpers.trabalhando || 0, helpers.total), helpers.trabalhando > 0]] });
      }
    }
    // Apply the same proof to boxes that entered from the team snapshot without any message edge.
    for (const node of nodes) if (node.work === undefined) {
      const box = boxOfFlow(lados, node.of || node.id), work = trabalhoOf(box, now, lados);
      const helpersOnly = node.stage === 'ajudantes';
      node.work = (helpersOnly ? work.helpers : work.total) > 0;
      node.workSource = node.work ? (helpersOnly ? 'self' : work.source) : null;
      if (!helpersOnly && work.helpers > 0 && !(box && box.semRaiz)) node.lines.push([f.helpersWorking(work.helpers), true]);
    }
    const byId = new Map(nodes.map(node => [node.id, node]));
    const senderOf = id => id === 'voce' ? 'voce' : (byId.get(id) || {}).side || sideOfId(id) || 'voce';
    const subjectOf = topics => Array.isArray(topics) && topics.length && !topics.includes('reservado') ? topics.map(topic => f.topic[topic] || '?').join(', ') : null;
    // o chat onde a conversa mora: a caixa do fio que nao e voce (dos ajudantes, a caixa deles; entre duas, a que mandou)
    const chatOfEdge = (a, b) => { const owner = [a, b].map(id => String(id).replace(/^ajudantes:/, '')).find(id => id !== 'voce'); if (!owner) return null; if (senderOf(owner) === 'codex') return 'codex'; const node = byId.get(owner); return node && node.plain && node.plain !== '?' ? node.plain : null; };
    const edges = (Array.isArray(data.edges) ? data.edges : []).filter(edge => edge && byId.has(edge.from) && byId.has(edge.to) && edge.from !== edge.to && finite(edge.count) && edge.count > 0).map(edge => {
      const kind = KINDS.includes(edge.kind) ? edge.kind : 'comando', lastAt = stamp(edge.lastAt);
      const age = lastAt === null ? Infinity : now - lastAt;
      const from = byId.get(edge.from), to = byId.get(edge.to);
      return {
        key: edge.from + '>' + edge.to, from: edge.from, to: edge.to, kind, count: edge.count, recent: age >= 0 && age <= 15 * 60000, ageMin: Number.isFinite(age) ? Math.floor(age / 60000) : null,
        sender: senderOf(edge.from), width: edge.recent === true ? Math.min(3, 1.6 + Math.log2(1 + edge.count) * 0.4) : 1.4,
        label: f.kind[kind] + ' ' + edge.count, title: from.plain + ' → ' + to.plain, short: from.plain + ' → ' + to.plain, chat: chatOfEdge(edge.from, edge.to),
        aria: from.plain + ' ' + f.to + ' ' + to.plain + ': ' + f.count(edge.count) + ', ' + f.kind[kind],
        lastTime: clock(edge.lastAt, lang) || '?',
        messages: (Array.isArray(edge.messages) ? edge.messages : []).slice(0, 8).map(message => {
          const mk = KINDS.includes(message.kind) ? message.kind : 'comando', reserved = Array.isArray(message.topics) && message.topics.includes('reservado');
          return { time: clock(message.at, lang) || '?', kind: mk, text: phraseOf(message, edge, lang), subject: subjectOf(message.topics), reserved };
        })
      };
    });
    const missing = Object.entries(data.sources || {}).filter(([, value]) => value !== 'ok').map(([key]) => f.source[key] || '?');
    const notes = [];
    if (missing.length) notes.push(f.notRead(missing.join(', ')));
    if (!edges.length) notes.push(f.empty);
    const read = clock(data.readAt, lang);
    if (read) notes.push(w.readAt(read));
    return { known: true, nodes, edges, working, note: notes.join(' · ') };
  }
  // O que aconteceu, em palavras simples e neutras: do tipo e da ferramenta (nunca o texto da conversa).
  function phraseOf(message, edge, lang) {
    const p = W[langOf(lang)].flow.phrase, kind = KINDS.includes(message && message.kind) ? message.kind : 'comando', source = String(message && message.source || '');
    const fromHelpers = String(edge.from).startsWith('ajudantes:'), toHelpers = String(edge.to).startsWith('ajudantes:');
    switch (source) {
      case 'claude:despacho': return p.despacho;
      case 'claude:ajudante': return fromHelpers ? p.ajudante[kind] : p.recadoAjudante;
      case 'claude:entrega': return p.entrega;
      case 'claude:pergunta': return p.perguntaDono;
      case 'claude:resposta': return p.respostaDono;
      case 'claude:dono': case 'codex:texto': return p.dono[kind];
      case 'claude:sessao': return p.sessao[kind];
      case 'codex:spawn_agent': return p.executorNovo;
      case 'codex:send_message': return p.recadoExecutor;
      case 'codex:followup_task': return p.maisTarefa;
      case 'codex:pergunta': return p.perguntaDono;
      case 'codex:ajudante': return p.executorEntrega;
      case 'codex:voz': return p.voz;
      case 'painel:recado': return p.painel[kind];
      case 'painel:resposta': return p.painelResposta;
      default: return edge.from === 'voce' ? p.dono[kind] : fromHelpers ? p.ajudante[kind] : toHelpers ? p.recadoAjudante : edge.to === 'voce' && kind === 'resposta' ? p.respostaDono : edge.to === 'voce' && kind === 'duvida' ? p.perguntaDono : p.sessao[kind];
    }
  }

  // ---------- FLUXO: geometria (pura, sem DOM; testada no node) ----------
  // Largo (>= 1000 px de quadro, tela de 1100): Voce no meio, Claude a esquerda e Codex a direita (coordenacao, depois as
  // sessoes em coluna). De 1368 px para cima as caixas sao inteiras (STD); entre 1000 e 1368 a vista fica DENSA.
  // Medio (>= 640 px): Claude em cima, Voce no meio e Codex embaixo. Estreito: lista (sem fios).
  // Cada fio anda so nos vaos: entre Voce e a coordenacao, entre a coordenacao e as sessoes e, de Voce a uma sessao, por um
  // corredor ao lado da caixa da coordenacao. Entre duas sessoes do mesmo lado, um arco no vao de dentro. Nada passa por cima.
  // caixas e vaos da vista larga: STD (inteiras, 1366 px de quadro = a largura maxima da pagina) e DENSO (o minimo, 1020 px:
  // tela de 1100 com barra de rolagem = 1035). Entre os dois tudo encolhe junto (interpolado), sem rolagem para o lado.
  // A caixa da coordenacao nunca fica abaixo de 176 px: o nome "coordenador claude" e o selo COORDENA cabem inteiros.
  const FLOW_STD = { vw: 176, vh: 92, cw: 196, ch: 84, sw: 204, sh: 66, ph: 30, pg: 8, gy: 18, g1: 64, g2: 112, P: 19 };
  const FLOW_DENSO = { vw: 164, vh: 84, cw: 176, ch: 70, sw: 128, sh: 62, ph: 26, pg: 6, gy: 14, g1: 34, g2: 78, P: 12 };
  // largura media de 1 letra (fonte mono) por classe; no denso a letra cai 1 px (pe-equipe.css, data-denso)
  const FLOW_FONT = { std: { t: 7.4, tag: 6.4, l: 6.9, p: 6.15, wl: 7.2, row: 20 }, denso: { t: 6.85, tag: 6.1, l: 6.35, p: 5.9, wl: 6.6, row: 18 } };
  const needOf = D => D.vw + 2 * (D.g1 + D.cw + D.g2 + D.sw) + 2 * D.P;
  // (as caixas ficam do tamanho do denso: nome e selo inteiros, nenhuma linha cortada). Abaixo disso, a vista media.
  const FLOW_COMPACTO = { ...FLOW_DENSO, gy: 12, g1: 18, g2: 44, P: 8 };
  const FLOW_H_MIN = needOf(FLOW_COMPACTO), FLOW_V_MIN = 640, SIDES = ['claude', 'codex'];
  function layoutFluxo(fv, width) {
    const out = { mode: 'lista', width: Math.max(0, Math.floor(width || 0)), height: 0, boxes: new Map(), wires: [], apart: [] };
    if (!fv || !fv.known || !Number.isFinite(width)) return out;
    const Wd = out.width;
    // a vista larga cabe de FLOW_H_MIN (denso: 164 + 2 x (34 + 176 + 78 + 128) + 2 x 12 = 1020 px) para cima; inteira em 1366
    let mode = Wd >= FLOW_H_MIN ? 'h' : Wd >= FLOW_V_MIN ? 'v' : 'lista';
    if (mode === 'lista') return out;
    const byId = new Map(fv.nodes.map(node => [node.id, node]));
    const side = { claude: { coord: null, sess: [], pills: new Map() }, codex: { coord: null, sess: [], pills: new Map() } };
    for (const node of fv.nodes) {
      if (node.stage === 'ajudantes') { const parent = byId.get(node.of); if (parent && side[parent.side]) side[parent.side].pills.set(node.of, node); continue; }
      if (!side[node.side]) continue;
      if (node.stage === 'coord') side[node.side].coord = node; else if (node.stage === 'sessoes') side[node.side].sess.push(node);
    }
    const voce = byId.get('voce') || null;
    let P = 20, dense = false, F = FLOW_FONT.std;
    const put = (id, x, y, w, h, extra) => out.boxes.set(id, { id, x, y, w, h, cx: x + w / 2, cy: y + h / 2, node: byId.get(id), ...extra });
    let x0, y0;
    if (mode === 'h') {
      // t = 1 com as caixas inteiras; de 1000 a 1368 px de quadro t vai de 0 a 1 e caixas e vaos encolhem juntos
      const t = Math.max(0, Math.min(1, (Wd - needOf(FLOW_DENSO)) / (needOf(FLOW_STD) - needOf(FLOW_DENSO))));
      const D = {}; for (const key of Object.keys(FLOW_STD)) D[key] = FLOW_DENSO[key] + (FLOW_STD[key] - FLOW_DENSO[key]) * t;
      if (Wd < needOf(FLOW_DENSO)) { const u = Math.max(0, Math.min(1, (Wd - needOf(FLOW_COMPACTO)) / (needOf(FLOW_DENSO) - needOf(FLOW_COMPACTO)))); for (const key of Object.keys(FLOW_DENSO)) D[key] = FLOW_COMPACTO[key] + (FLOW_DENSO[key] - FLOW_COMPACTO[key]) * u; }
      // letra 1 px menor so com a vista bem apertada (t < 0,85, quadro < 1311 px); abaixo de t 1 a linha que nao cabe quebra
      dense = t < 0.85; F = dense ? FLOW_FONT.denso : FLOW_FONT.std; P = D.P;
      // linhas da caixa: com a vista encolhida, a que nao cabe quebra no " · " (estado em cima, hora embaixo) e a caixa cresce
      const rowsOf = (node, w) => {
        if (t >= 1) return node.lines;
        const rows = [];
        for (const [value, hot] of node.lines) {
          const text = String(value), room = Math.floor((w - (rows.length ? 22 : 36)) / F.l), cut = text.lastIndexOf(' · ');
          if (text.length > room && cut > 0) rows.push([text.slice(0, cut), hot], [text.slice(cut + 3), hot, true]); else rows.push([value, hot]);
        }
        return rows;
      };
      const tall = (node, w, base) => { const rows = rowsOf(node, w), oldHeight = base + Math.max(0, rows.length - node.lines.length) * F.row; return { rows, h: node.stage === 'sessoes' ? Math.max(oldHeight, 46 + Math.max(0, rows.length - 1) * F.row + 12) : oldHeight }; };
      const colH = s => side[s].sess.reduce((sum, node, i) => sum + tall(node, D.sw, D.sh).h + (side[s].pills.has(node.id) ? D.pg + D.ph : 0) + (i ? D.gy : 0), 0);
      const coordH = s => side[s].coord ? tall(side[s].coord, D.cw, D.ch).h + (side[s].pills.has(side[s].coord.id) ? D.pg + D.ph : 0) : 0;
      const vo = voce ? tall(voce, D.vw, D.vh) : { rows: [], h: D.vh };
      const inner = Math.max(vo.h, ...SIDES.map(coordH), ...SIDES.map(colH));
      const H = Math.round(inner + 2 * P + 2 * 40);
      const extra = Math.max(0, Wd - needOf(D));
      const g1 = D.g1 + Math.min(70, extra * 0.18), g2 = D.g2 + Math.min(200, extra * 0.32);
      x0 = Wd / 2; y0 = H / 2; out.height = H;
      if (voce) put('voce', x0 - D.vw / 2, y0 - vo.h / 2, D.vw, vo.h, { side: null, level: 0, rows: vo.rows });
      for (const s of SIDES) {
        const dir = s === 'claude' ? -1 : 1, info = side[s];
        if (info.coord) {
          const cb = tall(info.coord, D.cw, D.ch);
          const cIn = x0 + dir * (D.vw / 2 + g1), cx = dir < 0 ? cIn - D.cw : cIn, cy = y0 - coordH(s) / 2;
          put(info.coord.id, cx, cy, D.cw, cb.h, { side: s, level: 1, rows: cb.rows });
          const pill = info.pills.get(info.coord.id); if (pill) put(pill.id, cx + 10, cy + cb.h + D.pg, D.cw - 20, D.ph, { side: s, level: 1, pillOf: info.coord.id });
        }
        const sIn = x0 + dir * (D.vw / 2 + g1 + D.cw + g2), sx = dir < 0 ? sIn - D.sw : sIn;
        let y = y0 - colH(s) / 2;
        for (const node of info.sess) {
          const sb = tall(node, D.sw, D.sh);
          put(node.id, sx, y, D.sw, sb.h, { side: s, level: 2, rows: sb.rows }); y += sb.h;
          const pill = info.pills.get(node.id); if (pill) { put(pill.id, sx + 10, y + D.pg, D.sw - 20, D.ph, { side: s, level: 2, pillOf: node.id }); y += D.pg + D.ph; }
          y += D.gy;
        }
      }
    } else {
      const D = { vw: 180, vh: 84, cw: 188, ch: 76, sh: 66, ph: 30, pg: 8, gx: 14, g1: 52, g2: 84, pw: 184 };
      const n = Math.max(1, ...SIDES.map(s => side[s].sess.length));
      const sw = Math.min(188, Math.floor((Wd - 2 * P - (n - 1) * D.gx) / n));
      if (sw < 112) { out.mode = 'lista'; return out; }
      const anyPill = s => side[s].sess.some(node => side[s].pills.has(node.id));
      let y = P;
      const row = (s, top) => {
        const list = side[s].sess, total = list.length * sw + Math.max(0, list.length - 1) * D.gx;
        let x = (Wd - total) / 2;
        const pills = anyPill(s), rowHeight = Math.max(D.sh, ...list.map(node => 46 + Math.max(0, node.lines.length - 1) * F.row + 12)), sy = s === 'claude' && pills ? top + D.ph + D.pg : top;
        for (const node of list) {
          put(node.id, x, sy, sw, rowHeight, { side: s, level: 2 });
          const pill = side[s].pills.get(node.id);
          if (pill) put(pill.id, x + 8, s === 'claude' ? sy - D.pg - D.ph : sy + rowHeight + D.pg, sw - 16, D.ph, { side: s, level: 2, pillOf: node.id });
          x += sw + D.gx;
        }
        return list.length ? rowHeight + (pills ? D.pg + D.ph : 0) : 0;
      };
      const coordAt = (s, top) => {
        const info = side[s]; if (!info.coord) return 0;
        const cx = Wd / 2 - D.cw / 2;
        put(info.coord.id, cx, top, D.cw, D.ch, { side: s, level: 1 });
        const pill = info.pills.get(info.coord.id); if (pill) put(pill.id, cx + D.cw + 14, top + (D.ch - D.ph) / 2, Math.min(D.pw, Wd - P - (cx + D.cw + 14)), D.ph, { side: s, level: 1, pillOf: info.coord.id });
        return D.ch;
      };
      const rc = row('claude', y); if (rc) y += rc + D.g2;
      const cc = coordAt('claude', y); if (cc) y += cc + D.g1;
      if (voce) put('voce', Wd / 2 - D.vw / 2, y, D.vw, D.vh, { side: null, level: 0 });
      y0 = y + D.vh / 2; y += D.vh;
      if (side.codex.coord) { y += D.g1; y += coordAt('codex', y); }
      if (side.codex.sess.length) { y += D.g2; y += row('codex', y); }
      out.height = Math.round(y + P); x0 = Wd / 2;
    }
    out.mode = mode; out.dense = dense; out.font = F;
    // ---- coordenadas por lado: u = distancia para fora (a partir de Voce), l = posicao de lado ----
    const vb = out.boxes.get('voce') || { x: x0 - 1, y: y0 - 1, w: 2, h: 2, cx: x0, cy: y0 };
    const dirOf = s => s === 'claude' ? -1 : 1;
    const toXY = (s, u, l) => mode === 'h' ? [x0 + dirOf(s) * u, l] : [l, y0 + dirOf(s) * u];
    const uIn = (b, s) => mode === 'h' ? (dirOf(s) < 0 ? x0 - (b.x + b.w) : b.x - x0) : (dirOf(s) < 0 ? y0 - (b.y + b.h) : b.y - y0);
    const uOut = (b, s) => mode === 'h' ? (dirOf(s) < 0 ? x0 - b.x : b.x + b.w - x0) : (dirOf(s) < 0 ? y0 - b.y : b.y + b.h - y0);
    const lMin = b => mode === 'h' ? b.y : b.x, lMax = b => mode === 'h' ? b.y + b.h : b.x + b.w, lMid = b => (lMin(b) + lMax(b)) / 2;
    const vHalf = mode === 'h' ? vb.w / 2 : vb.h / 2;
    // ---- planos ----
    const plans = [];
    for (const edge of fv.edges) {
      const a = out.boxes.get(edge.from), b = out.boxes.get(edge.to);
      if (!a || !b) { out.apart.push(edge.key); continue; }
      if (a.pillOf || b.pillOf) { if (a.pillOf === b.id || b.pillOf === a.id) plans.push({ edge, kind: 'pill', a, b }); else out.apart.push(edge.key); continue; }
      if (edge.from === 'voce' || edge.to === 'voce') {
        const other = edge.from === 'voce' ? b : a, s = other.side;
        if (!s) { out.apart.push(edge.key); continue; }
        const coordBox = side[s].coord ? out.boxes.get(side[s].coord.id) : null;
        plans.push({ edge, kind: other.level === 1 ? 'vc' : coordBox ? 'vs' : 'vc', s, voceEnd: edge.from === 'voce' ? 'a' : 'b', other, coordBox });
      } else if (a.side && a.side === b.side) {
        if (a.level !== b.level) plans.push({ edge, kind: 'cs', s: a.side, coordEnd: a.level === 1 ? 'a' : 'b' });
        else if (a.level === 2) plans.push({ edge, kind: 'ss', s: a.side });
        else out.apart.push(edge.key);
      } else if (a.level === 1 && b.level === 1 && a.side && b.side && a.side !== b.side) plans.push({ edge, kind: 'cc' });
      else out.apart.push(edge.key);
    }
    // ---- portas espalhadas na face de cada caixa (ordenadas pela outra ponta) ----
    const ports = new Map();
    const addPort = (key, box, other, plan, end) => { if (!ports.has(key)) ports.set(key, { box, list: [] }); ports.get(key).list.push({ other, plan, end }); };
    for (const plan of plans) {
      const { edge } = plan, a = out.boxes.get(edge.from), b = out.boxes.get(edge.to);
      if (plan.kind === 'vc' || plan.kind === 'vs') {
        const other = plan.voceEnd === 'a' ? b : a;
        addPort('voce|' + plan.s, vb, lMid(other), plan, plan.voceEnd);
        addPort(other.id + '|in', other, lMid(vb), plan, plan.voceEnd === 'a' ? 'b' : 'a');
      } else if (plan.kind === 'cs') {
        const coord = plan.coordEnd === 'a' ? a : b, sess = plan.coordEnd === 'a' ? b : a;
        addPort(coord.id + '|out', coord, lMid(sess), plan, plan.coordEnd);
        addPort(sess.id + '|in', sess, lMid(coord), plan, plan.coordEnd === 'a' ? 'b' : 'a');
      } else if (plan.kind === 'ss') {
        addPort(a.id + '|in', a, lMid(b), plan, 'a'); addPort(b.id + '|in', b, lMid(a), plan, 'b');
      }
    }
    for (const { box, list } of ports.values()) {
      list.sort((p, q) => p.other - q.other || (p.end === 'a' ? -1 : 1));
      const lo = lMin(box), hi = lMax(box), margin = Math.min(14, (hi - lo) / 4);
      list.forEach((port, index) => { port.plan[port.end === 'a' ? 'la' : 'lb'] = list.length === 1 ? (lo + hi) / 2 : lo + margin + (hi - lo - 2 * margin) * index / (list.length - 1); });
    }
    // ---- corredores ao lado da coordenacao (Voce -> sessao) ----
    const lanes = new Map();
    for (const plan of plans.filter(item => item.kind === 'vs')) {
      const coord = plan.coordBox, pill = side[plan.s].pills.get(coord.id) ? out.boxes.get(side[plan.s].pills.get(coord.id).id) : null;
      const blockLo = Math.min(lMin(coord), pill ? lMin(pill) : Infinity), blockHi = Math.max(lMax(coord), pill ? lMax(pill) : -Infinity);
      const target = plan.voceEnd === 'a' ? plan.lb : plan.la, low = target < (blockLo + blockHi) / 2;
      const key = plan.s + (low ? '|low' : '|high');
      if (!lanes.has(key)) lanes.set(key, { low, blockLo, blockHi, list: [] });
      lanes.get(key).list.push({ plan, target });
    }
    for (const lane of lanes.values()) {
      lane.list.sort((p, q) => lane.low ? q.target - p.target : p.target - q.target);
      lane.list.forEach((item, k) => { item.plan.lane = lane.low ? lane.blockLo - 14 - k * 9 : lane.blockHi + 14 + k * 9; });
    }
    // ---- caminhos ----
    const cubic = (p0, p1, p2, p3) => ({ t: 'C', p: [p0, p1, p2, p3] }), line = (p0, p1) => ({ t: 'L', p: [p0, p1] });
    const sCurve = (s, u0, l0, u1, l1) => { const um = (u0 + u1) / 2; return cubic(toXY(s, u0, l0), toXY(s, um, l0), toXY(s, um, l1), toXY(s, u1, l1)); };
    const ssCount = { claude: 0, codex: 0 }; let ccCount = 0;
    for (const plan of plans) {
      const { edge } = plan, a = out.boxes.get(edge.from), b = out.boxes.get(edge.to);
      let segs = [], spots = [];
      if (plan.kind === 'pill') {
        const box = a.pillOf ? b : a, pill = a.pillOf ? a : b, down = edge.from === box.id ? -7 : 7;
        let p0, p1;
        if (mode === 'h' || (mode === 'v' && box.level === 2)) {
          const pillBelow = pill.y > box.y, x = box.cx + down;
          const boxEdge = pillBelow ? box.y + box.h : box.y, pillEdge = pillBelow ? pill.y : pill.y + pill.h;
          p0 = [x, edge.from === box.id ? boxEdge : pillEdge]; p1 = [x, edge.from === box.id ? pillEdge : boxEdge];
        } else {
          const yv = box.cy + down;
          p0 = [edge.from === box.id ? box.x + box.w : pill.x, yv]; p1 = [edge.from === box.id ? pill.x : box.x + box.w, yv];
        }
        segs = [line(p0, p1)];
      } else if (plan.kind === 'vc') {
        const other = plan.voceEnd === 'a' ? b : a, s = plan.s;
        const uo = uIn(other, s), lv = plan.voceEnd === 'a' ? plan.la : plan.lb, lo = plan.voceEnd === 'a' ? plan.lb : plan.la;
        const c = plan.voceEnd === 'a' ? sCurve(s, vHalf, lv, uo, lo) : sCurve(s, uo, lo, vHalf, lv);
        segs = [c]; spots = [[0, 0.5], [0, 0.4], [0, 0.6], [0, 0.3], [0, 0.7]];
      } else if (plan.kind === 'vs') {
        const s = plan.s, sess = plan.voceEnd === 'a' ? b : a, coord = plan.coordBox;
        const lv = plan.voceEnd === 'a' ? plan.la : plan.lb, ls = plan.voceEnd === 'a' ? plan.lb : plan.la;
        const cI = uIn(coord, s), cO = uOut(coord, s), sI = uIn(sess, s), lane = plan.lane;
        const forward = [sCurve(s, vHalf, lv, cI, lane), line(toXY(s, cI, lane), toXY(s, cO, lane)), sCurve(s, cO, lane, sI, ls)];
        segs = plan.voceEnd === 'a' ? forward : forward.reverse().map(seg => seg.t === 'L' ? line(seg.p[1], seg.p[0]) : cubic(seg.p[3], seg.p[2], seg.p[1], seg.p[0]));
        spots = [[1, 0.5], [1, 0.25], [1, 0.75], [2, 0.5], [0, 0.5]];
      } else if (plan.kind === 'cs') {
        const s = plan.s, coord = plan.coordEnd === 'a' ? a : b, sess = plan.coordEnd === 'a' ? b : a;
        const lc = plan.coordEnd === 'a' ? plan.la : plan.lb, ls = plan.coordEnd === 'a' ? plan.lb : plan.la;
        segs = [plan.coordEnd === 'a' ? sCurve(s, uOut(coord, s), lc, uIn(sess, s), ls) : sCurve(s, uIn(sess, s), ls, uOut(coord, s), lc)];
        spots = [[0, 0.5], [0, 0.62], [0, 0.38], [0, 0.72], [0, 0.28]];
      } else if (plan.kind === 'ss') {
        const s = plan.s, k = ssCount[s]++, uI = uIn(a, s), bulge = Math.min(22 + k * 12, 70);
        segs = [cubic(toXY(s, uI, plan.la), toXY(s, uI - bulge, plan.la), toXY(s, uI - bulge, plan.lb), toXY(s, uI, plan.lb))];
        spots = [[0, 0.5], [0, 0.35], [0, 0.65]];
      }
      if (plan.kind === 'cc') {
        // Claude <-> COORDENADOR do Codex: um arco por cima de voce (vista larga) ou pelo lado (media); ida e volta em trilhos separados
        const k = ccCount++, off = k % 2 ? 9 : -9;
        if (mode === 'h') {
          const top = Math.min(a.y, b.y, vb.y), laneY = Math.max(6, top - 30 - k * 10), ax = a.cx + off, bx = b.cx - off;
          segs = [cubic([ax, a.y], [ax, laneY], [bx, laneY], [bx, b.y])];
        } else {
          const lx = Math.min(Wd - 6, Math.max(a.x + a.w, b.x + b.w, vb.x + vb.w) + 30 + k * 10);
          segs = [cubic([a.x + a.w, a.cy + off], [lx, a.cy + off], [lx, b.cy - off], [b.x + b.w, b.cy - off])];
        }
        spots = [[0, 0.5], [0, 0.4], [0, 0.6]];
      }
      out.wires.push({ edge, kind: plan.kind, side: plan.s || a.side || b.side || null, segs, spots, d: pathOf(segs) });
    }
    // ---- rotulos: no meio do fio, nunca em cima de caixa nem de outro rotulo (os recentes e com mais mensagens primeiro) ----
    const boxRects = [...out.boxes.values()].map(box => ({ x: box.x - 6, y: box.y - 6, w: box.w + 12, h: box.h + 12 }));
    const placed = [], hit = (r, list) => list.some(o => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h);
    const ranked = out.wires.filter(wire => wire.spots.length).sort((p, q) => Number(q.edge.recent) - Number(p.edge.recent) || q.edge.count - p.edge.count);
    for (const wire of ranked.slice(0, 14)) {
      const width = String(wire.edge.label).length * F.wl + 16, height = 20;
      for (const [index, t] of wire.spots) {
        const seg = wire.segs[index]; if (!seg) continue;
        const [x, y] = pointOf(seg, t), r = { x: x - width / 2, y: y - height / 2, w: width, h: height };
        if (r.x < 2 || r.y < 2 || r.x + r.w > Wd - 2 || r.y + r.h > out.height - 2 || hit(r, boxRects) || hit(r, placed)) continue;
        placed.push(r); wire.labelAt = [x, y]; wire.labelBox = r; break;
      }
    }
    return out;
  }
  // Cabeca da caixa: o nome e o selo. O selo da coordenacao (Claude) nunca sai: se faltar lugar, o nome encurta;
  // nas outras caixas, sem lugar, sai o selo e o nome fica inteiro.
  function boxHead(node, w, F) {
    const font = F || FLOW_FONT.std, room = Math.floor((w - 24) / font.t), tagRoom = node.tag ? Math.ceil((node.tag.length * font.tag + 10) / font.t) : 0;
    const must = node.stage === 'coord' && node.side === 'claude';
    const withTag = !!node.tag && (must || node.title.length <= room - tagRoom);
    return { title: trunc(node.title, withTag ? room - tagRoom : room), tag: withTag ? node.tag : null };
  }
  function pointOf(seg, t) {
    const [a, b, c, d] = seg.p;
    if (seg.t === 'L') return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const m = 1 - t;
    return [m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0], m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1]];
  }
  function pathOf(segs) {
    const f = n => (Math.round(n * 10) / 10).toString();
    let d = '';
    segs.forEach((seg, index) => {
      if (index === 0) d += 'M' + f(seg.p[0][0]) + ',' + f(seg.p[0][1]);
      d += seg.t === 'L' ? ' L' + f(seg.p[1][0]) + ',' + f(seg.p[1][1]) : ' C' + f(seg.p[1][0]) + ',' + f(seg.p[1][1]) + ' ' + f(seg.p[2][0]) + ',' + f(seg.p[2][1]) + ' ' + f(seg.p[3][0]) + ',' + f(seg.p[3][1]);
    });
    return d;
  }
  // Pontos do fio a cada ~4 px com o comprimento acumulado (as particulas andam por aqui).
  function samplePath(segs) {
    const points = [], lengths = [];
    let total = 0, prev = null;
    for (const seg of segs) {
      const steps = seg.t === 'L' ? Math.max(1, Math.ceil(Math.hypot(seg.p[1][0] - seg.p[0][0], seg.p[1][1] - seg.p[0][1]) / 6)) : 28;
      for (let i = prev ? 1 : 0; i <= steps; i++) {
        const p = pointOf(seg, i / steps);
        if (prev) total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        points.push(p); lengths.push(total); prev = p;
      }
    }
    return { points, lengths, total };
  }

  const AJ_MAX = 60;
  const AJ_W = {
    pt: { todos: n => 'ver todos (' + n + ')', ativos: 'ver só os ativos', titulo: 'O que cada ajudante faz', reservado: 'assunto reservado', ajudante: 'ajudante', executor: 'executor', min: m => m < 1 ? 'agora' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' },
    en: { todos: n => 'see all (' + n + ')', ativos: 'see active only', titulo: 'What each helper is doing', reservado: 'private topic', ajudante: 'helper', executor: 'runner', min: m => m < 1 ? 'now' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' },
    es: { todos: n => 'ver todos (' + n + ')', ativos: 'ver solo los activos', titulo: 'Qué hace cada ayudante', reservado: 'tema reservado', ajudante: 'ayudante', executor: 'ejecutor', min: m => m < 1 ? 'ahora' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' }
  };
  const AJ_PAPEL = {
    'revisor-dinheiro': ['revisor de dinheiro', 'money reviewer', 'revisor de dinero'], 'revisor-texto-sigilo': ['revisor de texto', 'copy reviewer', 'revisor de texto'],
    tela: ['tela', 'screen', 'pantalla'], rota: ['servidor', 'server', 'servidor'], sweep: ['compras em lote', 'batch buys', 'compras en lote'], medir: ['medição', 'measuring', 'medición'],
    analise: ['análise', 'analysis', 'análisis'], video: ['vídeo', 'video', 'video'], 'tracker-dev': ['tracker', 'tracker', 'tracker'], explore: ['busca', 'search', 'búsqueda'],
    plan: ['plano', 'plan', 'plan'], 'claude-code-guide': ['guia', 'guide', 'guía']
  };
  function ajLimpo(text) {
    return String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[A-Za-z]:[\\/]\S*|\S*\\\S*|(?:^|\s)[.~]?\/\S+|\S*\/\S*\.[A-Za-z]{1,5}\b/g, ' ')
      .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{7,}\b/gi, ' ').replace(/\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{16,}\b/g, ' ')
      .replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').replace(/^[\s,;:.]+|[\s,;:]+$/g, '').trim();
  }
  function ajPapel(tipo, lang) { const hit = AJ_PAPEL[String(tipo || '').toLowerCase()]; return hit ? hit[LANGS.indexOf(langOf(lang))] : null; }
  // "papel: o que faz · tempo", com o tempo sempre a vista; o resto corta com reticencias
  function ajLinha(papel, oque, tempo) {
    const tail = tempo ? ' · ' + tempo : '', head = ajLimpo(papel) + (oque && ajLimpo(oque) ? ': ' + ajLimpo(oque) : ''), room = AJ_MAX - tail.length;
    const corte = head.length > room ? head.slice(0, Math.max(1, room - 1)).trimEnd() + '…' : head;
    return { texto: corte + tail, cabeca: corte, cauda: tail, completo: head + tail };
  }
  function linhasAjudantes(c, box) {
    const lang = c.lang, aw = AJ_W[lang], now = c.now || Date.now(), out = [];
    if (!box || box.tipo === 'guarda') return out;
    if (box.casa && Array.isArray(box.ajudantesLista)) {
      for (const item of box.ajudantesLista) {
        const ativo = item.ativo === true, desde = stamp(item.desde), ultima = stamp(item.ultimaEm);
        const tempo = ativo ? aw.min(Math.max(0, Math.floor((now - (desde !== null ? desde : ultima !== null ? ultima : now)) / 60000))) : agoOf(ultima, now, lang);
        const papel = ajPapel(item.tipo, lang) || aw.ajudante, oque = item.reservado ? aw.reservado : typeof item.oque === 'string' ? item.oque : null;
        out.push({ ...ajLinha(papel, oque, tempo), ativo, id: null, at: ultima });
      }
    } else if (!box.casa && box.ajudantes && Array.isArray(box.ajudantes.itens)) {
      for (const item of box.ajudantes.itens) {
        const card = c.view && c.view.cards.get(item.id), ativo = item.estado === 'trabalhando';
        const papel = (item.raw && roleName(item.raw, lang)) || (box.lado === 'codex' ? aw.executor : aw.ajudante), oque = item.raw && whatOf(item.raw, lang);
        out.push({ ...ajLinha(papel, oque, agoOf(item.ultimaEm, now, lang)), ativo, id: card ? item.id : null, at: item.ultimaEm });
      }
    }
    // ativos primeiro; dentro de cada grupo, o mais novo em cima
    return out.sort((a, b) => (b.ativo - a.ativo) || ((b.at || 0) - (a.at || 0)));
  }
  const api = { andaComprovado, andaPainel, andaFrase, frenteCodex, linhasAjudantes, ajLinha, ajLimpo, animInfo, W, LANGS, ESTADOS, viewOf, flowView, layoutFluxo, boxHead, samplePath, pointOf, timelineOf, estadoOf, stateOf, ladosOf, contagem, roleName, whatOf, threeWords, humanTitle, threadName, assignPortraits, poolOf, cupsOf, heroLine, topoDaEquipe, waterText, compact, whole, clock, phaseOf, phraseOf, modelName, hashOf, sideOfId, caudaKey, whoOf, trabalhoComprovado, trabalhoOf, trabalhoTotal, trabalhoLeitura, WORK_READ_MS, METADATA_MS, metadataContext, workState, presentationLabel };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  // ---------- tela ----------
  const doc = root.document;
  if (!doc) return;
  if (root.PaAnim) {
    try {
      root.PaAnim.ligarPausa(doc);
      const syncAnim = () => root.PaAnim.desligar(doc.documentElement.dataset.motion === 'off', doc);
      syncAnim(); if (typeof root.MutationObserver === 'function') new root.MutationObserver(syncAnim).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    } catch { /* sem animacao */ }
  }
  const POLL_MS = 15000, MEMORY_KEY = 'pe-equipe-agentes-v1';
  function ladosText(view, w) {
    const lados = topoDaEquipe(view).lados;
    return lados ? w.tree.side.claude + ' ' + lados.claude + ' · ' + w.tree.side.codex + ' ' + lados.codex : '';
  }
  const systemReduce = () => { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  // Movimento: a escolha do painel (Movimento on/off na engrenagem) vence; sem escolha, vale o sistema.
  const motionOn = () => { if (doc.documentElement.classList.contains('pa-desligado')) return false; const choice = doc.documentElement.dataset.motion; return choice === 'off' ? false : choice === 'on' ? true : !systemReduce(); };
  function h(tag, cls, text) { const node = doc.createElement(tag); if (cls) node.className = cls; if (text !== undefined && text !== null) node.textContent = String(text); return node; }
  function setText(node, text) { const value = text === null || text === undefined ? '' : String(text); if (node.textContent !== value) node.textContent = value; }
  function setAttr(node, name, value) { if (value === null || value === undefined || value === false) { if (node.hasAttribute(name)) node.removeAttribute(name); } else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value)); }
  function place(parent, node, index) { if (parent.children[index] !== node) parent.insertBefore(node, parent.children[index] || null); }
  function trim(parent, count) { while (parent.children.length > count) parent.lastElementChild.remove(); }
  const memory = {
    load() { try { const raw = JSON.parse(root.localStorage.getItem(MEMORY_KEY) || '{}'); return new Map(Object.entries(raw).filter(([, image]) => validImage(image))); } catch { return new Map(); } },
    save(map) { try { const entries = [...map].slice(-400); root.localStorage.setItem(MEMORY_KEY, JSON.stringify(Object.fromEntries(entries))); } catch { /* so conveniencia */ } }
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) { const node = doc.createElementNS(SVG_NS, tag); for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value)); return node; }
  function icon(kind) {
    const svg = svgEl('svg', { viewBox: '0 0 24 24', class: 'pe-ico', 'aria-hidden': 'true', focusable: 'false' });
    const paths = { close: 'M6 6l12 12M18 6L6 18', guard: 'M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6z M9 12l2 2 4-4', you: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6' };
    for (const d of paths[kind].split(' M').map((part, index) => (index ? 'M' : '') + part)) svg.append(svgEl('path', { d }));
    return svg;
  }

  // Agente com a animacao do estado: corpo (balanco, respiro, cochilo, pulinho), efeitos (faiscas, z) e selo.
  function duNode(size) {
    const box = h('span', 'pe-agente pe-agente-' + size), ring = h('span', 'pe-agente-ring'), body = h('span', 'pe-agente-body'), img = h('img', 'pe-agente-img'), fx = h('span', 'pe-agente-fx'), badge = h('span', 'pe-agente-badge');
    img.alt = ''; img.decoding = 'async'; img.draggable = false;
    const px = size === 'lg' ? 64 : size === 'sm' ? 36 : size === 'xs' ? 28 : 48; img.width = px; img.height = px;
    img.addEventListener('error', () => { if (img.getAttribute('src') !== '/agente.png') { img.setAttribute('src', '/agente.png'); box.classList.add('pe-agente-generic'); } });
    for (let i = 0; i < 3; i++) fx.append(h('i', null, 'z'));
    body.append(img); box.append(ring, body, fx, badge);
    box.setAttribute('aria-hidden', 'true');
    return box;
  }
  function paintAvatar(box, card, side) {
    setAttr(box, 'data-state', card ? card.state : 'unknown');
    setAttr(box, 'data-lado', side || (card && card.side) || null);
    setAttr(box, 'data-needs', card && card.needsYou ? '1' : null);
    const img = box.querySelector('.pe-agente-img'), image = card && card.portrait ? card.portrait.image : '/agente.png';
    box.classList.toggle('pe-agente-generic', !(card && card.portrait));
    if (img.getAttribute('src') !== image) img.setAttribute('src', image);
  }
  function chipText(card, w) { return card.needsYou ? w.needsYou : w.state[card.estado] || w.state['sem-leitura']; }

  function drawCup(c, level, current) {
    const id = 'pe-cup-' + (++c.cupSeq);
    const svg = svgEl('svg', { viewBox: '0 0 32 42', class: 'pe-cup' + (current ? ' pe-cup-now' : ''), 'aria-hidden': 'true' });
    const defs = svgEl('defs'), clip = svgEl('clipPath', { id }), shape = svgEl('path', { d: 'M5 4h22l-3 34H8z' });
    clip.append(shape); defs.append(clip); svg.append(defs);
    const fill = svgEl('g', { 'clip-path': 'url(#' + id + ')' });
    if (level > 0) {
      const y = (38 - level * 34).toFixed(2), wave = svgEl('g', { class: current ? 'pe-wave' : '' });
      wave.append(svgEl('path', { d: 'M-16 ' + y + ' q4 -2.4 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 V44 H-16z', class: 'pe-water' })); fill.append(wave);
    }
    svg.append(fill, svgEl('path', { d: 'M5 4h22l-3 34H8z', class: 'pe-cup-line' }));
    return svg;
  }

  // ---------- montagem ----------
  function build(c) {
    const shell = c.mount;
    shell.classList.add('pe-equipe'); shell.replaceChildren();
    const hero = h('header', 'pe-hero'), now = h('div', 'pe-now'), nowN = h('strong', 'pe-now-n', '?'), nowText = h('div', 'pe-now-text'), nowK = h('span', 'pe-now-k'), nowSub = h('span', 'pe-now-sub'), nowSides = h('span', 'pe-now-sides');
    nowText.append(nowK, nowSub, nowSides); now.append(nowN, nowText);
    const cons = h('section', 'pe-cons'), consTop = h('div', 'pe-cons-top'), consK = h('span', 'pe-cons-k'), info = h('button', 'pe-info', 'i'), consN = h('strong', 'pe-cons-n'), cups = h('div', 'pe-cups'), consSub = h('span', 'pe-cons-sub');
    // explicacao longa: 1 linha em negrito (o que e) e a conta com as fontes so em "Como calculamos"
    const formula = h('div', 'pe-formula'), tldr = h('strong', 'pe-tldr'), how = h('details', 'pe-how'), howSum = h('summary'), howText = h('p');
    how.append(howSum, howText); formula.append(tldr, how);
    info.type = 'button'; info.setAttribute('aria-expanded', 'false'); formula.hidden = true; formula.id = 'pe-formula-' + Math.random().toString(36).slice(2, 8); info.setAttribute('aria-controls', formula.id);
    info.addEventListener('click', () => { const open = info.getAttribute('aria-expanded') !== 'true'; info.setAttribute('aria-expanded', String(open)); formula.hidden = !open; });
    consTop.append(consK, info); cons.append(consTop, consN, cups, consSub, formula);
    hero.append(now, cons);
    const status = h('p', 'pe-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const views = h('div', 'pe-views'), viewTree = h('button', 'pe-view-btn'), viewFlow = h('button', 'pe-view-btn');
    viewTree.type = viewFlow.type = 'button'; views.setAttribute('role', 'group');
    viewTree.addEventListener('click', () => setMode(c, 'tree')); viewFlow.addEventListener('click', () => setMode(c, 'flow'));
    views.append(viewTree, viewFlow);
    shell.append(hero, status, views, buildTree(c), buildFlow(c));
    Object.assign(c.ui, { hero, nowN, nowK, nowSub, nowSides, cons, consK, info, consN, cups, consSub, formula, tldr, howSum, howText, status, views, viewTree, viewFlow });
  }

  // ---------- ARVORE: Voce e os dois lados ----------
  function buildTree(c) {
    const sec = h('section', 'pe-sec pe-arvore'), head = h('div', 'pe-arvore-head'), k = h('h3', 'pe-sec-k'), legend = h('ul', 'pe-cores');
    const legendText = {};
    for (const key of ['voce', 'claude', 'codex']) { const li = h('li'), dot = h('i', 'pe-cor-dot'), text = h('span'); dot.dataset.lado = key; li.append(dot, text); legend.append(li); legendText[key] = text; }
    head.append(k, legend);
    const top = h('div', 'pe-topo'), dono = h('div', 'pe-dono'), donoIcon = h('span', 'pe-dono-ico'), donoText = h('span', 'pe-dono-text'), donoName = h('strong', 'pe-dono-n'), donoSub = h('span', 'pe-dono-s');
    donoIcon.append(icon('you')); donoText.append(donoName, donoSub); dono.append(donoIcon, donoText); top.append(dono);
    const lados = h('div', 'pe-lados'), sides = {};
    for (const id of ['claude', 'codex']) {
      const lane = h('section', 'pe-lado'); lane.dataset.lado = id;
      const laneHead = h('div', 'pe-lado-head'), name = h('h4', 'pe-lado-n'), count = h('span', 'pe-lado-c');
      laneHead.append(h('i', 'pe-cor-dot'), name, count); laneHead.firstChild.dataset.lado = id;
      const coordHost = h('div', 'pe-lado-coord'), rail = h('ol', 'pe-ramos');
      lane.append(laneHead, coordHost, rail); lados.append(lane);
      sides[id] = { lane, name, count, coordHost, rail };
    }
    sec.append(head, top, lados);
    c.tree = { sec, k, legendText, dono, donoName, donoSub, sides, nodes: new Map() };
    return sec;
  }
  function makeNode(c) {
    const el = h('div', 'pe-no'), main = h('button', 'pe-no-main'); main.type = 'button';
    const face = h('span', 'pe-no-face'), agente = duNode('md'), guard = h('span', 'pe-no-ico');
    guard.append(icon('guard')); face.append(agente, guard);
    const text = h('span', 'pe-no-text'), l1 = h('span', 'pe-no-l1'), name = h('strong', 'pe-no-n'), chip = h('span', 'pe-chip');
    chip.append(h('i', 'pe-chip-dot'), h('span', 'pe-chip-t')); l1.append(name, chip);
    const papel = h('span', 'pe-no-p'), when = h('span', 'pe-no-w');
    text.append(l1, papel, when); main.append(face, text);
    const helpers = h('div', 'pe-no-aj'), faces = h('div', 'pe-faces'), helpersK = h('span', 'pe-no-ajk');
    const aj = h('div', 'pe-ajl');
    helpers.append(faces, helpersK); el.append(main, helpers, aj);
    main.addEventListener('click', () => { if (main.dataset.card) openTimeline(c, main.dataset.card, main); });
    return { el, main, agente, guard, name, chip, chipText: chip.lastChild, papel, when, helpers, faces, helpersK, aj, faceNodes: [], more: null };
  }
  function paintNode(c, node, box) {
    const w = W[c.lang], card = c.view.cards.get(box.id) || null, guard = box.tipo === 'guarda';
    node.el.dataset.lado = box.lado; node.el.dataset.tipo = box.tipo; node.el.dataset.estado = box.estado;
    setAttr(node.el, 'data-needs', box.precisa ? '1' : null);
    node.agente.hidden = guard; node.guard.hidden = !guard;
    if (!guard) paintAvatar(node.agente, card || { state: PE_STATE[box.estado], side: box.lado }, box.lado);
    const name = c.view.lados.scalar && card ? card.name : box.tipo === 'coordenador' ? w.tree.coord[box.lado] : guard ? w.tree.guard : box.nome || (box.semRaiz ? w.tree.unreadName[box.lado] : box.lado === 'codex' ? w.tree.codexConversation : w.tree.claudeConversation);
    const papel = box.tipo === 'coordenador' ? w.tree.coordRole[box.lado] : guard ? (box.intervalo ? w.tree.guardEvery(box.intervalo) : w.tree.guardRole) : box.semRaiz ? w.tree.unreadRole : w.tree.roles[box.chave] || (box.lado === 'codex' ? w.tree.codexConversation : w.tree.claudeConversation);
    setText(node.name, name); setText(node.papel, papel);
    setAttr(node.chip, 'data-estado', box.precisa ? 'precisa' : box.estado);
    setText(node.chipText, box.precisa ? w.needsYou : w.state[box.estado]);
    const parts = [];
    if (guard && box.ultimaEm === null) parts.push(w.tree.guardNone); else parts.push(agoOf(box.ultimaEm, c.now, c.lang));
    if (c.ligacoes && c.ligacoes.get(box.id) > 0) parts.push(w.flow.mensagens(c.ligacoes.get(box.id)));
    if (box.entrega) { const when = deliveryText(box.entrega, w, c.lang, box.estado === 'trabalhando' || box.estado === 'esperando'); if (when) parts.push(when); }
    setText(node.when, parts.join(' · '));
    node.main.dataset.card = card && !guard ? box.id : '';
    node.main.dataset.inerte = !card || guard ? '1' : '';
    setAttr(node.main, 'aria-disabled', !card || guard ? 'true' : null);
    setAttr(node.main, 'aria-label', (card && !guard ? w.open + ' ' : '') + name + ': ' + (box.precisa ? w.needsYou : w.state[box.estado]) + ', ' + parts.join(', '));
    if (root.PaAnim && !guard) { try { root.PaAnim.aplicar(node.el, animInfo(box, c.now), c.lang); } catch { /* sem animacao */ } }
    // ajudantes (Claude) ou executores (Codex): ate 6 rostos, o resto em "+N"
    const group = box.ajudantes, shown = group.itens.slice(0, 6);
    // sessao da casa do Claude: o painel ainda nao le os ajudantes dela; sem leitura a linha some (nunca "nenhum ajudante" inventado)
    node.helpers.hidden = guard || (group.total === 0 && (box.tipo !== 'coordenador' || box.casa === true));
    while (node.faceNodes.length < shown.length) { const button = h('button', 'pe-face'), agente = duNode('sm'); button.type = 'button'; button.append(agente); button.addEventListener('click', () => { if (button.dataset.card) openTimeline(c, button.dataset.card, button); }); node.faceNodes.push({ button, agente }); node.faces.append(button); }
    while (node.faceNodes.length > shown.length) node.faceNodes.pop().button.remove();
    shown.forEach((item, index) => {
      const face = node.faceNodes[index], helperCard = c.view.cards.get(item.id) || { state: PE_STATE[item.estado], side: box.lado };
      paintAvatar(face.agente, helperCard, box.lado);
      face.button.dataset.card = item.id; face.button.dataset.estado = item.estado;
      const label = (helperCard.name || '?') + (helperCard.what ? ' · ' + helperCard.what : '') + ' · ' + w.state[item.estado];
      setAttr(face.button, 'title', label); setAttr(face.button, 'aria-label', w.open + ' ' + label);
    });
    // sessao do Claude so com a conta (sem rostos lidos): sem o "+N" solto, a linha ja diz quantos
    if (group.total > shown.length && shown.length) { if (!node.more) node.more = h('span', 'pe-face-more'); setText(node.more, w.more(group.total - shown.length)); node.faces.append(node.more); }
    else if (node.more) { node.more.remove(); node.more = null; }
    setText(node.helpersK, group.total === null ? w.tree.unread : (box.lado === 'codex' ? w.tree.executors : w.tree.helpers)(group.total, group.trabalhando));
    if (guard) node.aj.hidden = true; else pintarAjudantes(c, node.aj, box);
  }
  // Fonte: a mesma do resto da Equipe. Casa do Claude: operator.sessions[].ajudantes.lista (claude-atividade.cjs: tipo e frase
  // curta do meta.json do ajudante, ja limpa no servidor); conversa do Codex: os executores ja lidos (box.ajudantes.itens).
  // So os ativos ficam a vista; os parados atras de "ver todos (N)". Ate 60 letras, sem hash, id longo, caminho nem travessao.
  function pintarAjudantes(c, host, box) {
    const aw = AJ_W[c.lang], linhas = linhasAjudantes(c, box), ativas = linhas.filter(l => l.ativo);
    c.ajAbertos = c.ajAbertos || new Set();
    const aberto = c.ajAbertos.has(box.id), vis = aberto ? linhas : ativas;
    host.hidden = !linhas.length;
    const sig = JSON.stringify([c.lang, aberto, linhas.map(l => [l.texto, l.ativo, l.id])]);
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;
    const parts = [];
    if (vis.length) {
      const ul = h('ul', 'pe-ajl-l');
      for (const l of vis) {
        const li = h('li', 'pe-ajl-i'), el = h(l.id ? 'button' : 'span', 'pe-ajl-b');
        li.dataset.ativo = l.ativo ? '1' : '0';
        if (l.id) { el.type = 'button'; el.addEventListener('click', () => openTimeline(c, l.id, el)); }
        const dot = h('i', 'pe-ajl-dot'); dot.setAttribute('aria-hidden', 'true');
        // o tempo fica sempre a vista: so o texto corta (com reticencias) quando a tela e estreita
        el.append(...[dot, h('span', 'pe-ajl-t', l.cabeca), l.cauda ? h('span', 'pe-ajl-tm', l.cauda) : null].filter(Boolean));
        if (l.completo !== l.texto) setAttr(el, 'title', l.completo);
        li.append(el); ul.append(li);
      }
      parts.push(ul);
    }
    if (linhas.length > ativas.length) {
      const more = h('button', 'pe-ajl-mais', aberto ? aw.ativos : aw.todos(linhas.length)); more.type = 'button';
      setAttr(more, 'aria-expanded', String(aberto));
      more.addEventListener('click', () => {
        if (c.ajAbertos.has(box.id)) c.ajAbertos.delete(box.id); else c.ajAbertos.add(box.id);
        // a mesma escolha vale na Arvore e no Fluxo: repinta os dois e devolve o foco ao botao
        for (const node of doc.querySelectorAll('.pe-ajl')) node.dataset.sig = '';
        paint(c);
        const again = [...doc.querySelectorAll('.pe-ajl[data-box="' + CSS.escape(box.id) + '"] .pe-ajl-mais')].find(item => item.offsetParent);
        if (again) again.focus();
      });
      parts.push(more);
    }
    host.dataset.box = box.id;
    host.replaceChildren(...parts);
  }
  // Fluxo: as caixas do mapa ficam com a conta ("3 ajudantes · 1 trabalhando"); logo abaixo do mapa, 1 cartao por sessao com
  // ajudante, com as mesmas linhas da Arvore (o mapa tem geometria fixa e a linha de 60 letras nao cabe dentro da caixa).
  function nomeDaCaixa(c, box) {
    const w = W[c.lang], card = c.view && c.view.cards.get(box.id);
    return card && card.name || (box.tipo === 'coordenador' ? w.tree.coord[box.lado] : box.nome || (box.lado === 'codex' ? w.tree.codexConversation : w.tree.claudeConversation));
  }
  function pintarFluxoAjudantes(c, lados) {
    const fx = c.fx; if (!fx.ajWrap) return;
    const caixas = [];
    if (lados && c.view) for (const lado of lados.lados) for (const box of [lado.coordenador, ...lado.sessoes]) if (box && !box.antiga && box.tipo !== 'guarda' && linhasAjudantes(c, box).length) caixas.push(box);
    fx.ajWrap.hidden = !caixas.length;
    setText(fx.ajK, AJ_W[c.lang].titulo);
    fx.ajCards = fx.ajCards || new Map();
    const seen = new Set();
    caixas.forEach((box, index) => {
      let card = fx.ajCards.get(box.id);
      if (!card) { const el = h('article', 'pe-flow-aj-c'), head = h('p', 'pe-flow-aj-n'), host = h('div', 'pe-ajl'); head.append(h('i', 'pe-cor-dot'), h('span')); el.append(head, host); card = { el, head, host }; fx.ajCards.set(box.id, card); }
      seen.add(box.id); card.el.dataset.lado = box.lado; card.head.firstChild.dataset.lado = box.lado; card.el.dataset.estado = box.estado;
      setText(card.head.lastChild, nomeDaCaixa(c, box));
      pintarAjudantes(c, card.host, box);
      place(fx.ajGrid, card.el, index);
    });
    for (const [id, card] of fx.ajCards) if (!seen.has(id)) { card.el.remove(); fx.ajCards.delete(id); }
  }
  function deliveryText(delivery, w, lang, active) {
    const finished = clock(delivery.completedAt, lang), deadline = clock(delivery.deadlineAt, lang), expected = !active && delivery.estimated !== false ? null : clock(delivery.etaAt, lang);
    return finished && !expected ? w.deliveredAt(finished) : deadline ? w.deadline(deadline) : expected ? w.expected(expected) + (delivery.estimated ? ' · ' + w.estimated : '') : null;
  }
  function paintTree(c) {
    const w = W[c.lang], t = c.tree, model = c.view.lados;
    setText(t.k, w.tree.title + (c.ligacoes && c.ligacoes.size ? ' · ' + w.flow.janelaTitulo(c.janela, '') : ''));
    for (const key of ['voce', 'claude', 'codex']) setText(t.legendText[key], w.tree.legend[key]);
    // voce: so os cards realmente abertos (com a casa); sem leitura, a linha some
    const cardsDono = model.comCasa ? model.dono.cards : model.dono.esperam;
    setText(t.donoName, w.tree.you); setText(t.donoSub, finite(cardsDono) ? (model.comCasa ? w.tree.cards(cardsDono) : w.tree.waiting(cardsDono)) : '');
    setAttr(t.dono, 'data-hot', cardsDono > 0 ? '1' : null);
    const seen = new Set();
    for (const lado of model.lados) {
      const side = c.tree.sides[lado.id], counts = model.porLado[lado.id];
      setText(side.name, w.tree.side[lado.id]);
      // trabalhando do lado: a mesma conta das caixas do numero grande (topoDaEquipe)
      const working = model.scalar ? workingText(model.countsAvailable ? counts.trabalhando : null, c.lang, model.lowerBound) : counts.trabalhando;
      setText(side.count, w.tree.sideCount(working, model.known ? counts.agentes : '?'));
      side.coordHost.hidden = model.scalar === true && !lado.coordenador.casa && !lado.coordenador.coordVivo;
      const coordNode = keyedNode(c, lado.coordenador.id, seen); paintNode(c, coordNode, lado.coordenador); coordNode.el.classList.add('pe-no-coord');
      place(side.coordHost, coordNode.el, 0); trim(side.coordHost, 1);
      const antigas = lado.sessoes.filter(box => box.antiga);
      const list = [...(lado.guarda ? [lado.guarda] : []), ...lado.sessoes.filter(box => !box.antiga)];
      list.forEach((box, index) => {
        const node = keyedNode(c, box.id, seen); paintNode(c, node, box); node.el.classList.remove('pe-no-coord');
        let item = side.rail.children[index];
        if (!item || item.firstChild !== node.el) { item = h('li', 'pe-ramo'); item.append(node.el); place(side.rail, item, index); }
      });
      // conversas paradas ha mais de 1 h: 1 linha "N conversas antigas" que abre com 1 clique (fica aberta entre as leituras)
      if (antigas.length) {
        if (!side.fold) {
          const li = h('li', 'pe-ramo pe-antigas'), det = h('details', 'pe-antigas-d'), sum = h('summary', 'pe-antigas-s'), ol = h('ol', 'pe-ramos pe-antigas-l');
          det.append(sum, ol); li.append(det); side.fold = { li, det, sum, ol };
        }
        const fold = side.fold;
        setText(fold.sum, w.tree.old(antigas.length)); setAttr(fold.sum, 'title', w.tree.oldHint);
        antigas.forEach((box, index) => {
          const node = keyedNode(c, box.id, seen); paintNode(c, node, box); node.el.classList.remove('pe-no-coord');
          let item = fold.ol.children[index];
          if (!item || item.firstChild !== node.el) { item = h('li', 'pe-ramo'); item.append(node.el); place(fold.ol, item, index); }
        });
        trim(fold.ol, antigas.length);
        place(side.rail, fold.li, list.length); trim(side.rail, list.length + 1);
        if (c.abrirAntigas) { fold.det.open = true; c.abrirAntigas = null; try { fold.li.scrollIntoView({ block: 'nearest' }); } catch { /* sem rolagem */ } }
      } else trim(side.rail, list.length);
      side.rail.hidden = !list.length && !antigas.length;
    }
    for (const [id, node] of c.tree.nodes) if (!seen.has(id)) { node.el.remove(); c.tree.nodes.delete(id); }
  }
  function keyedNode(c, id, seen) { let node = c.tree.nodes.get(id); if (!node) { node = makeNode(c); c.tree.nodes.set(id, node); } seen.add(id); return node; }

  async function loadFrentes(c) {
    c.frentesTry = Date.now();
    try { const r = await root.fetch('/api/pe-equipe/codex-frentes', { cache: 'no-store', headers: { Accept: 'application/json' } }); const j = r.ok ? await r.json() : null; c.frentesCodex = j && j.lido === true && Array.isArray(j.frentes) ? j.frentes : null; }
    catch { c.frentesCodex = null; }
  }
  function paint(c) {
    if ((!c.pool || !c.pool.length) && c.poolTry && Date.now() - c.poolTry > 30000) loadPool(c);
    if (!c.frentesTry || Date.now() - c.frentesTry > 30000) loadFrentes(c);
    paintViews(c);
    if (!c.snapshot) { setText(c.ui.status, c.failed ? W[c.lang].readFail : W[c.lang].loading); c.ui.status.hidden = false; if (c.mode === 'flow') paintFlow(c); return; }
    const w = W[c.lang]; c.now = Date.now();
    const view = viewOf(c.snapshot, c.lang, c.now, { pool: c.pool, memory: c.memory, failed: c.failed });
    c.ligacoes = ligacoesPorCaixa(view.lados, c.janela, historicoDe(c.snapshot, c.janela));
    c.view = view; memory.save(c.memory);
    c.mount.lang = c.lang;
    // topo: trabalhando agora (o numero grande, a conta das caixas) e o resto em 1 linha; tudo da mesma conta (topoDaEquipe)
    const topo = topoDaEquipe(view);
    setText(c.ui.nowN, workingText(topo.n, c.lang, view.lowerBound));
    pintarMistura(c.ui.nowN, null);
    setText(c.ui.nowK, readingLabel(view.stale, c.lang));
    setText(c.ui.nowSub, topo.sub);
    setText(c.ui.nowSides, ladosText(view, w));
    setAttr(c.ui.nowN, 'title', [view.updated && clock(view.updated, c.lang) ? w.readAt(clock(view.updated, c.lang)) : ''].filter(Boolean).join(' · ') || null);
    const cons = view.consumption;
    const age=root.PainelDadosAuditados?.source(cons.measurementAt,Date.now(),7200000);setText(c.ui.consK,w.consumption+' · '+(age?.age===null||!age?'?':age.age+' min'+(age.old?' · '+({pt:'antiga',en:'old',es:'antigua'})[c.lang]:'')));
    // contagem ainda correndo (depois de reiniciar): diz quanto ja leu, nunca "≥ 0"
    const counting = cons.consumo && cons.consumo.completo === false, pct = counting && finite(cons.consumo.lidoPct) ? Math.round(cons.consumo.lidoPct) : null;
    setText(c.ui.consN, cons.frescor ? '? ' + w.tokens + ' · ' + (cons.frescor.motivo || 'sem medida') + '. Solução: ' + cons.frescor.solucao : counting && !(cons.tokens > 0) ? w.counting(pct) : (cons.tokens !== null && !cons.exact ? '≥ ' : '') + compact(cons.tokens, c.lang) + ' ' + w.tokens + sinceOf(cons.consumo, c.lang) + (counting && pct !== null ? ' · ' + w.countingShort(pct) : ''));
    setAttr(c.ui.info, 'aria-label', w.howCount); setAttr(c.ui.info, 'title', w.howCount);
    setText(c.ui.tldr, w.tldr); setText(c.ui.howSum, w.how);
    setText(c.ui.howText, (cons.consumo && cons.consumo.agua && cons.consumo.agua.dica && cons.consumo.agua.dica[c.lang]) || w.formula);
    const cupKey = cons.cups ? cons.cups.levels.map(level => level.toFixed(2)).join(',') : 'none';
    if (cupKey !== c.cupKey) {
      c.cupKey = cupKey; c.ui.cups.replaceChildren();
      if (cons.cups) cons.cups.levels.forEach((level, index) => c.ui.cups.append(drawCup(c, level, index === cons.cups.current)));
      c.ui.cups.hidden = !cons.cups;
    }
    setText(c.ui.consSub, cons.frescor ? w.water('?') + ' · Solução: a mesma dos tokens, acima' : cons.cups ? (cons.consumo && cons.consumo.agua && cons.consumo.agua.rotulo ? waterText(cons.waterMl, c.lang) + ' ' + ({ pt: 'de ', en: 'of ', es: 'de ' }[c.lang] || '') + cons.consumo.agua.rotulo[c.lang] : w.water(waterText(cons.waterMl, c.lang))) + ' · ' + w.cups(whole(cons.cups.total, c.lang)) : '');
    c.ui.consSub.hidden = !c.ui.consSub.textContent;
    c.ui.status.hidden = !(c.failed || !view.known);
    setText(c.ui.status, c.failed ? w.readFail : !view.known ? (view.lados.scalar ? w.state['sem-leitura'] : w.empty) : '');
    paintTree(c);
    if (c.mode === 'flow') paintFlow(c);
    if (c.dialog && c.dialog.open && c.openId) paintTimeline(c, false);
  }

  // ---------- linha do tempo (1 clique no cartao ou no rosto) ----------
  function ensureDialog(c) {
    if (c.dialog) return c.dialog;
    const dialog = h('dialog', 'pe-tl pe-equipe'), head = h('div', 'pe-tl-head'), agente = duNode('lg'), title = h('div', 'pe-tl-title'), name = h('h2', 'pe-tl-name'), sub = h('p', 'pe-tl-sub'), close = h('button', 'pe-x');
    close.append(icon('close'));
    name.id = 'pe-tl-name-' + Math.random().toString(36).slice(2, 8); dialog.setAttribute('aria-labelledby', name.id);
    close.type = 'button'; close.addEventListener('click', () => dialog.close());
    title.append(name, sub); head.append(agente, title, close);
    const crew = h('div', 'pe-tl-crew'), crewK = h('span', 'pe-tl-crew-k'), crewFaces = h('div', 'pe-faces');
    crew.append(crewK, crewFaces); crew.hidden = true;
    const map = h('div', 'pe-tl-map'), cols = h('div', 'pe-tl-cols'), steps = h('ol', 'pe-tl-steps'), window = h('p', 'pe-tl-window');
    map.append(cols, steps, window);
    const more = h('details', 'pe-tl-more'), moreSum = h('summary'), facts = h('dl', 'pe-tl-facts');
    more.append(moreSum, facts);
    dialog.append(head, crew, map, more);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { c.openId = null; c.crewIds = null; if (c.returnFocus && c.returnFocus.isConnected) c.returnFocus.focus({ preventScroll: true }); });
    doc.body.append(dialog);
    c.dialog = dialog; Object.assign(c.tl, { agente, name, sub, close, crew, crewK, crewFaces, cols, steps, window, more, moreSum, facts });
    return dialog;
  }
  // Conversa de onde vem o "fim da conversa": a sessao (Claude) ou a conversa raiz (Codex).
  function caudaKey(card) {
    const raw = card && card.raw || {};
    if (raw.parentId) {
      const helper = /^claude:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(a?[0-9a-f]{6,40})$/i.exec(String(raw.id || ''));
      if (helper) return 'claude/' + helper[1].toLowerCase() + '/' + helper[2].toLowerCase();
      const executor = /^codex:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(String(raw.id || ''));
      return executor ? 'codex/' + executor[1].toLowerCase() : null;
    }
    const conv = String(card && card.box && card.box.conversationId || raw.conversationId || raw.id || '');
    const match = /^(claude|codex):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(conv);
    return match ? match[1].toLowerCase() + '/' + match[2].toLowerCase() : null;
  }
  async function loadCauda(c, card) {
    if (c.view && c.view.lados.scalar) return;
    const key = caudaKey(card); if (!key) return;
    const hit = c.caudas.get(key);
    if (hit && (hit.busy || Date.now() - hit.at < 20000)) return;
    c.caudas.set(key, { at: Date.now(), busy: true, data: hit ? hit.data : null });
    let data = hit ? hit.data : null;
    try { const response = await root.fetch('/api/pe-equipe/conversa/' + key, { cache: 'no-store', headers: { Accept: 'application/json' } }); if (response.ok) data = await response.json(); } catch { /* fica o que tinha */ }
    c.caudas.set(key, { at: Date.now(), busy: false, data });
    if (c.dialog && c.dialog.open) { c.tlSig = ''; paintTimeline(c, true); }
  }
  function openTimeline(c, id, from) {
    if (!c.view || !c.view.cards.has(id)) return;
    const dialog = ensureDialog(c), card = c.view.cards.get(id);
    c.openId = id; c.returnFocus = from || null; c.tlSig = '';
    const box = card.box; c.crewIds = box && box.ajudantes.total ? null : null;
    paintTimeline(c, true);
    if (!dialog.open) { try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); } }
    walkIn(c);
    loadCauda(c, card);
  }
  function paintTimeline(c, fresh) {
    const card = c.view && c.view.cards.get(c.openId);
    if (!card) { if (c.dialog && c.dialog.open) c.dialog.close(); return; }
    const w = W[c.lang], key = caudaKey(card), cauda = c.view && c.view.lados.scalar ? null : key && c.caudas.get(key) ? c.caudas.get(key).data : null;
    const line = timelineOf(card, c.lang, Date.now(), cauda, c.view && c.view.lados);
    const sig = JSON.stringify([c.lang, card.estado, card.name, card.what, card.portrait && card.portrait.image, line]);
    if (!fresh && sig === c.tlSig) return;
    c.tlSig = sig;
    const t = c.tl;
    c.dialog.lang = c.lang; c.dialog.dataset.lado = card.side || '';
    t.crew.hidden = true;
    paintAvatar(t.agente, card, card.side);
    setText(t.name, card.name || '?');
    setText(t.sub, [card.what || '?', chipText(card, w)].join(' · '));
    setAttr(t.close, 'aria-label', w.close); setAttr(t.close, 'title', w.close);
    t.cols.replaceChildren(); t.cols.hidden = true;
    const requestNode = { kind: 'request', status: line.request.text || line.request.when ? 'passed' : 'unknown', label: w.request, text: line.request.text || '?', when: line.request.when || null, reserved: line.request.reserved, you: line.request.fromYou === true };
    const goalNode = { kind: 'goal', status: line.end.status, hard: line.end.hard, label: w.end, text: line.end.text || '?', when: line.end.when || null };
    let nodes, at = line.at;
    if (line.known) {
      nodes = [requestNode,
        ...line.steps.map(step => ({ kind: 'phase', key: step.key, status: step.status, label: step.label, text: step.count === null ? '?' : step.count > 0 ? w.times(step.count) : w.notYet, when: step.status === 'unknown' ? w.noPhase : [step.hint, step.count > 0 ? step.range : null].filter(Boolean).join(' · ') })),
        goalNode];
    } else {
      // fases nao lidas: nada de 4 linhas de "?"; 1 linha AGORA com a ultima acao, e o pedido so se foi lido
      const acao = card.raw && typeof card.raw.lastAction === 'string' && card.raw.lastAction.trim() ? card.raw.lastAction.trim() : w.endState[card.estado] || '?';
      const nowNode = { kind: 'phase', key: 'now', status: 'current', label: w.now, text: acao, when: null };
      nodes = requestNode.status === 'unknown' ? [nowNode, goalNode] : [requestNode, nowNode, goalNode];
      at = nodes.indexOf(nowNode);
    }
    t.steps.replaceChildren();
    nodes.forEach((node, index) => {
      const li = h('li', 'pe-step'), mark = h('span', 'pe-node'), k = h('span', 'pe-step-k', node.label), text = h('span', 'pe-step-t', node.text);
      li.dataset.kind = node.kind; li.dataset.status = node.status; if (node.hard) li.dataset.hard = '1'; if (node.reserved) li.dataset.reserved = '1'; if (node.you) li.dataset.voce = '1';
      if (index < at) li.classList.add('pe-lit');
      if (index === at) { li.classList.add('pe-here'); const here = duNode('md'); here.classList.add('pe-tl-agente'); paintAvatar(here, card, card.side); mark.append(here); }
      li.append(mark, k, text);
      if (node.when) li.append(h('span', 'pe-step-at', node.when));
      t.steps.append(li);
    });
    setAttr(t.steps, 'data-at', String(at));
    setText(t.window, line.window || ''); t.window.hidden = !line.window;
    setText(t.moreSum, w.details);
    const raw = card.raw || {}, facts = [];
    facts.push([w.side, w.tree.side[card.side] || '?']);
    const model = modelName(raw.model); if (model) facts.push([w.model, model, raw.model]);
    const started = clock(raw.startedAt, c.lang); if (started) facts.push([w.startedAt, started]);
    const lastPhase = phaseOf(raw.lastAction), lastAt = stamp(raw.lastAt || raw.lastActionAt);
    if (lastPhase || lastAt !== null) facts.push([w.lastStep, [lastPhase ? w.step[lastPhase] : null, lastAt !== null ? agoOf(lastAt, Date.now(), c.lang) : null].filter(Boolean).join(' · ')]);
    if (card.portrait && card.portrait.agente) facts.push([w.portrait, 'Agente #' + card.portrait.agente]);
    t.facts.replaceChildren(...facts.flatMap(([term, value, tip]) => { const dt = h('dt', null, term), dd = h('dd', null, value); if (tip) dd.title = String(tip); return [dt, dd]; }));
    t.more.hidden = !facts.length;
  }
  // Ao abrir: o Agente sai do Pedido e anda ate a fase em uso (so transform, WAAPI); com o movimento desligado ele ja esta la.
  function walkIn(c) {
    if (!motionOn()) return;
    const here = c.tl.steps.querySelector('.pe-tl-agente'), start = c.tl.steps.querySelector('.pe-step .pe-node');
    if (!here || !start || typeof here.animate !== 'function') return;
    const a = here.getBoundingClientRect(), b = start.getBoundingClientRect();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    try { here.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }], { duration: Math.min(1400, 500 + Math.hypot(dx, dy) * 1.4), easing: 'cubic-bezier(.22,1,.36,1)' }); } catch { /* sem animacao */ }
  }

  // ---------- vista FLUXO ----------
  const VIEW_KEY = 'pe-equipe-vista-v1', FLOW_MS = 20000, JANELA_KEY = 'pe-equipe-periodo-v1';
  function loadJanela() { try { const v = root.localStorage.getItem(JANELA_KEY); return JANELAS_FLUXO.includes(v) ? v : '2h'; } catch { return '2h'; } }
  function historicoDe(snapshot, janela) { const h = snapshot && snapshot.fluxoHistorico; return h && typeof h === 'object' && h[janela] && typeof h[janela] === 'object' ? h[janela] : null; }
  function setJanela(c, janela) { c.janela = JANELAS_FLUXO.includes(janela) ? janela : '2h'; try { root.localStorage.setItem(JANELA_KEY, c.janela); } catch { /* so conveniencia */ } c.flowSig = ''; c.wireSig = ''; paint(c); if (c.mode === 'flow') paintFlow(c); }
  function loadMode() {
    if (/(?:^#|&)fluxo\b/.test(root.location.hash || '')) return 'flow';
    try { return root.localStorage.getItem(VIEW_KEY) === 'flow' ? 'flow' : 'tree'; } catch { return 'tree'; }
  }
  function setMode(c, mode) {
    c.mode = mode === 'flow' ? 'flow' : 'tree';
    try { root.localStorage.setItem(VIEW_KEY, c.mode); } catch { /* so conveniencia */ }
    paintViews(c);
    if (c.mode === 'flow') { c.flowSig = ''; paintFlow(c); pullFlow(c); } else stopParticles(c);
  }
  function paintViews(c) {
    const w = W[c.lang];
    setText(c.ui.viewTree, w.views.tree); setText(c.ui.viewFlow, w.views.flow); setAttr(c.ui.views, 'aria-label', w.views.label);
    setAttr(c.ui.viewTree, 'aria-pressed', String(c.mode !== 'flow')); setAttr(c.ui.viewFlow, 'aria-pressed', String(c.mode === 'flow'));
    c.tree.sec.hidden = c.mode === 'flow'; c.fx.flow.hidden = c.mode !== 'flow';
    syncWorkMotion(c);
  }
  function buildFlow(c) {
    const flow = h('section', 'pe-sec pe-flow'), head = h('div', 'pe-flow-head'), title = h('h3', 'pe-sec-k'), legend = h('div', 'pe-legend');
    const who = h('ul', 'pe-legend-g'), kinds = h('ul', 'pe-legend-g'), whoK = h('li', 'pe-legend-k'), kindsK = h('li', 'pe-legend-k'), legendText = {}, whoText = {};
    who.append(whoK);
    for (const key of ['voce', 'claude', 'codex']) { const item = h('li'), dot = h('i', 'pe-cor-dot'), text = h('span'); dot.dataset.lado = key; item.append(dot, text); who.append(item); whoText[key] = text; }
    kinds.append(kindsK);
    for (const kind of KINDS) { const item = h('li'), sample = svgEl('svg', { viewBox: '0 0 28 8', class: 'pe-legend-line', 'aria-hidden': 'true' }), text = h('span'); sample.append(svgEl('path', { d: 'M1 4 H27', class: 'pe-w-main', 'data-kind': kind })); item.append(sample, text); kinds.append(item); legendText[kind] = text; }
    const dotItem = h('li', 'pe-legend-part'), dotText = h('span'); dotItem.append(h('i', 'pe-legend-dot'), dotText); kinds.append(dotItem);
    const motion = h('p', 'pe-motion'), motionText = h('span'), motionBtn = h('button', 'pe-motion-btn'); motionBtn.type = 'button';
    motionBtn.addEventListener('click', () => { const toggle = doc.getElementById('motion-toggle'); if (toggle && doc.documentElement.dataset.motion === 'off') toggle.click(); else { doc.documentElement.dataset.motion = 'on'; } c.wireSig = ''; drawFlow(c); });
    motion.append(motionText, motionBtn);
    legend.append(who, kinds, motion);
    const activity = h('p', 'pe-flow-activity'), activityDot = h('i', 'pe-work-dot'), activityText = h('span');
    activityDot.setAttribute('aria-hidden', 'true'); activity.append(activityDot, activityText);
    const janelas = h('div', 'pe-janelas'), janelaBtns = new Map(); janelas.setAttribute('role', 'group');
    for (const key of JANELAS_FLUXO) { const b = h('button', 'pe-janela-btn'); b.type = 'button'; b.dataset.janela = key; b.addEventListener('click', () => setJanela(c, key)); janelas.append(b); janelaBtns.set(key, b); }
    head.append(title, janelas, activity, legend);
    const map = h('div', 'pe-flow-map'), svg = svgEl('svg', { class: 'pe-flow-fios', role: 'img' }), canvas = h('div', 'pe-flow-part'), top = svgEl('svg', { class: 'pe-flow-caixas' });
    canvas.setAttribute('aria-hidden', 'true');
    c.uid = c.uid || Math.random().toString(36).slice(2, 8);
    const defs = svgEl('defs');
    for (const sender of ['voce', 'claude', 'codex']) {
      const marker = svgEl('marker', { id: 'pe-seta-' + c.uid + '-' + sender, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, markerUnits: 'userSpaceOnUse', orient: 'auto' });
      marker.append(svgEl('path', { d: 'M0,1 L10,5 L0,9 z', class: 'pe-arrow', 'data-lado': sender })); defs.append(marker);
    }
    const glow = svgEl('radialGradient', { id: 'pe-fundo-' + c.uid, cx: '50%', cy: '50%', r: '65%' });
    glow.append(svgEl('stop', { offset: '0%', class: 'pe-fundo-a' }), svgEl('stop', { offset: '100%', class: 'pe-fundo-b' }));
    defs.append(glow);
    const back = svgEl('rect', { class: 'pe-flow-back', x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#pe-fundo-' + c.uid + ')' });
    const wires = svgEl('g', { class: 'pe-wire-layer' });
    svg.append(defs, back, wires);
    const boxes = svgEl('g', { class: 'pe-box-layer' }), labels = svgEl('g', { class: 'pe-label-layer' }), hits = svgEl('g', { class: 'pe-hit-layer' });
    top.append(hits, boxes, labels);
    map.append(svg, canvas, top);
    const listWrap = h('div', 'pe-flow-lista'), groups = h('div', 'pe-flow-grupos'), list = h('ol', 'pe-wire-list');
    listWrap.append(groups, list);
    const note = h('p', 'pe-flow-note'), hint = h('p', 'pe-flow-hint');
    // conversas antigas ficam fora do mapa: 1 clique abre a lista delas na Arvore
    const antigas = h('button', 'pe-antigas-btn'); antigas.type = 'button'; antigas.hidden = true;
    antigas.addEventListener('click', () => { c.abrirAntigas = true; setMode(c, 'tree'); paint(c); });
    const detail = h('section', 'pe-wire-detail'), detailHead = h('div', 'pe-wire-detail-head'), detailTitle = h('h4', 'pe-wire-detail-t'), detailSub = h('p', 'pe-wire-detail-s'), detailClose = h('button', 'pe-x pe-x-corner'), detailList = h('ol', 'pe-wire-msgs');
    detailClose.append(icon('close'));
    detail.hidden = true; detailClose.type = 'button';
    detailClose.addEventListener('click', () => { const key = c.wireKey; c.wireKey = null; paintWireDetail(c); c.wireSig = ''; drawFlow(c); const hit = key && c.fx.hits.get(key); if (hit) hit.focus(); });
    detailHead.append(detailTitle, detailSub); detail.append(detailClose, detailHead, detailList);
    const ajWrap = h('section', 'pe-flow-aj'), ajK = h('h4', 'pe-flow-aj-k'), ajGrid = h('div', 'pe-flow-aj-g'); ajWrap.hidden = true; ajWrap.append(ajK, ajGrid);
    flow.append(head, map, ajWrap, listWrap, antigas, hint, detail, note);
    Object.assign(c.fx, { ajWrap, ajK, ajGrid });
    Object.assign(c.fx, { flow, title, antigas, janelas, janelaBtns, activity, activityText, whoK, kindsK, whoText, legendText, dotText, motion, motionText, motionBtn, map, svg, canvas, top, wires, boxes, labels, hitsLayer: hits, listWrap, groups, list, note, hint, detail, detailTitle, detailSub, detailClose, detailList, hits: new Map(), particles: [] });
    return flow;
  }
  function paintFlow(c) {
    if (!c.fx.flow || c.mode !== 'flow') return;
    const w = W[c.lang], f = w.flow;
    const lados = c.failed ? null : c.snapshot ? ladosOf(c.snapshot, Date.now(), false, { casa: true }) : null;
    if (lados) { lados.janelaFluxo = c.janela; lados.historicoFluxo = historicoDe(c.snapshot, c.janela); lados.fluxoLeitura = c.snapshot && c.snapshot.fluxoLeitura || null; lados.frentesCodex = Array.isArray(c.frentesCodex) ? c.frentesCodex : null; }
    try { pintarFluxoAjudantes(c, lados); } catch { if (c.fx.ajWrap) c.fx.ajWrap.hidden = true; }
    const view = flowView(c.flowFailed ? { ok: false } : c.flowData, c.lang, Date.now(), lados);
    // a nota de baixo com a mesma conta da Arvore (sem as centenas de "sem leitura" do leitor parcial)
    if (view.scalar && view.known && c.view && c.view.lados && c.view.lados.comCasa && view.lowerBound) view.note = heroLine(c.view);
    c.flowView = view;
    setText(c.fx.title, (f.titleBase || f.title) + (f.janelaTitulo ? ' · ' + f.janelaTitulo(c.janela, dataCurta(view.historicoDesde, c.lang)) : ''));
    if (view.histNota) view.note = [view.histNota, view.note].filter(Boolean).join(' · ');
    setAttr(c.fx.janelas, 'aria-label', f.janelaK);
    for (const [key, b] of c.fx.janelaBtns || []) { setText(b, f.janela[key]); setAttr(b, 'aria-pressed', String(key === c.janela)); }
    setText(c.fx.activityText, workingText(topoDaEquipe(view).n, c.lang, view.lowerBound) + ' ' + readingLabel(view.stale, c.lang));
    const antigas = lados && lados.antigas ? lados.antigas.claude + lados.antigas.codex : 0;
    setText(c.fx.antigas, antigas ? w.tree.old(antigas) : ''); setAttr(c.fx.antigas, 'title', antigas ? w.tree.oldHint : null); c.fx.antigas.hidden = !antigas;
    setAttr(c.fx.activity, 'data-work', view.working > 0 || view.workSignal === true ? '1' : '0'); setAttr(c.fx.activity, 'title', f.workPulse);
    setText(c.fx.whoK, f.whoTitle); setText(c.fx.kindsK, f.kindTitle);
    for (const key of ['voce', 'claude', 'codex']) setText(c.fx.whoText[key], f.who[key]);
    for (const kind of KINDS) setText(c.fx.legendText[kind], f.kind[kind]);
    setText(c.fx.dotText, f.dot);
    setText(c.fx.note, view.note); c.fx.note.hidden = !view.note;
    setText(c.fx.hint, f.hint); c.fx.hint.hidden = !view.edges.length;
    const sig = JSON.stringify([c.lang, view.nodes.map(node => [node.id, node.estado, node.work, node.workSource, node.title, node.plain, node.tag, node.lines]), view.edges.map(edge => [edge.key, edge.kind, edge.count, edge.recent])]);
    if (sig !== c.flowSig + '') { c.flowSig = sig; c.wireSig = ''; paintFlowList(c, view); }
    paintWireDetail(c);
    root.requestAnimationFrame(() => drawFlow(c));
  }
  // Tela estreita: os dois lados em lista curta e os fios em linhas (quem -> quem, tipo, quantas, hora).
  function paintFlowList(c, view) {
    const w = W[c.lang], f = w.flow;
    c.fx.groups.replaceChildren(...['claude', 'codex'].map(side => {
      const group = h('section', 'pe-flow-grupo'); group.dataset.lado = side;
      const head = h('h5', 'pe-flow-grupo-k'); head.append(h('i', 'pe-cor-dot'), h('span', null, w.tree.side[side])); head.firstChild.dataset.lado = side;
      const rows = h('ul', 'pe-flow-grupo-l');
      for (const node of view.nodes.filter(item => item.side === side && item.stage !== 'ajudantes')) {
        const li = h('li', 'pe-flow-row'); li.dataset.estado = node.estado; li.dataset.work = node.work ? '1' : '0'; li.dataset.workSource = node.workSource || '';
        li.append(h('i', 'pe-chip-dot'), h('span', 'pe-flow-row-n', node.plain), h('span', 'pe-flow-row-s', node.lines.map(line => line[0]).join(' · ')));
        rows.append(li);
      }
      group.append(head, rows);
      return group;
    }));
    c.fx.list.replaceChildren(...view.edges.slice(0, 14).map(edge => {
      const item = h('li'), button = h('button', 'pe-wire-row');
      button.type = 'button'; button.dataset.lado = edge.sender; button.dataset.kind = edge.kind; setAttr(button, 'aria-label', edge.aria);
      const sample = svgEl('svg', { viewBox: '0 0 22 8', class: 'pe-legend-line', 'aria-hidden': 'true' }); sample.append(svgEl('path', { d: 'M1 4 H21', class: 'pe-w-main', 'data-kind': edge.kind, 'data-lado': edge.sender }));
      button.append(sample, h('span', 'pe-wire-row-t', edge.short), h('span', 'pe-wire-row-m', f.kind[edge.kind] + ' ' + edge.count + ' · ' + edge.lastTime));
      button.addEventListener('click', () => openWire(c, edge.key));
      item.append(button); return item;
    }));
  }
  function trunc(text, chars) { const value = String(text || ''); return value.length > chars ? value.slice(0, Math.max(1, chars - 1)).trimEnd() + '…' : value; }
  // Desenho: fios (svg de baixo), particulas (canvas) e caixas, rotulos e areas de clique (svg de cima).
  function drawFlow(c) {
    const view = c.flowView, map = c.fx.map;
    if (!view || c.mode !== 'flow' || !visible(c.fx.flow)) return;
    // a largura vem da secao (o mapa some na lista e mediria 0); sem largura (aba escondida) nao desenha
    const width = Math.round(c.fx.flow.getBoundingClientRect().width || 0) - 2;
    if (width < 40) return;
    const motion = motionOn();
    const sig = JSON.stringify([width, c.flowSig, c.wireKey, motion]);
    if (sig === c.wireSig) { syncMotion(c, motion); return; }
    c.wireSig = sig;
    const f = W[c.lang].flow, layout = layoutFluxo(view, width);
    c.layout = layout;
    map.dataset.mode = layout.mode; c.fx.listWrap.dataset.mode = layout.mode; c.fx.flow.dataset.mode = layout.mode;
    c.fx.hits.clear();
    if (layout.mode === 'lista') {
      for (const layer of [c.fx.wires, c.fx.boxes, c.fx.labels, c.fx.hitsLayer]) layer.replaceChildren();
      c.fx.particles = []; stopParticles(c); syncMotion(c, motion); return;
    }
    const H = layout.height, F = layout.font || FLOW_FONT.std;
    setAttr(c.fx.top, 'data-denso', layout.dense ? '1' : null);
    for (const svg of [c.fx.svg, c.fx.top]) { svg.setAttribute('width', String(width)); svg.setAttribute('height', String(H)); svg.setAttribute('viewBox', '0 0 ' + width + ' ' + H); }
    setAttr(c.fx.svg, 'aria-label', f.title);
    // fios: a cor de quem manda e o traco do tipo; o escolhido em destaque
    const wires = [], hits = [], labels = [];
    for (const wire of layout.wires) {
      const edge = wire.edge, group = svgEl('g', { class: 'pe-wire' + (edge.key === c.wireKey ? ' pe-sel' : '') });
      group.dataset.kind = edge.kind; group.dataset.lado = edge.sender; group.dataset.recent = edge.recent ? '1' : '0';
      if (edge.recent) group.append(svgEl('path', { d: wire.d, class: 'pe-w-glow', 'stroke-width': (edge.width + 5).toFixed(1) }));
      group.append(svgEl('path', { d: wire.d, class: 'pe-w-main', 'data-kind': edge.kind, 'stroke-width': edge.width.toFixed(2), 'marker-end': 'url(#pe-seta-' + c.uid + '-' + edge.sender + ')' }));
      wires.push(group);
      const hit = svgEl('path', { d: wire.d, class: 'pe-wire-hit', tabindex: 0, role: 'button', 'aria-label': edge.aria });
      hit.addEventListener('click', () => openWire(c, edge.key));
      hit.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openWire(c, edge.key); } });
      hits.push(hit); c.fx.hits.set(edge.key, hit);
      if (wire.labelAt) {
        const label = svgEl('g', { class: 'pe-wl', transform: 'translate(' + wire.labelAt[0].toFixed(1) + ' ' + wire.labelAt[1].toFixed(1) + ')' });
        label.dataset.lado = edge.sender; label.dataset.recent = edge.recent ? '1' : '0';
        const bw = wire.labelBox.w, bh = wire.labelBox.h;
        label.append(svgEl('rect', { class: 'pe-wl-bg', x: (-bw / 2).toFixed(1), y: (-bh / 2).toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: 7, ry: 7 }));
        const text = svgEl('text', { class: 'pe-wl-t', 'text-anchor': 'middle', y: 4 }); text.textContent = edge.label; label.append(text);
        labels.push(label);
      }
    }
    c.fx.wires.replaceChildren(...wires); c.fx.hitsLayer.replaceChildren(...hits); c.fx.labels.replaceChildren(...labels);
    // caixas: a do dono em rosa, as do Claude em laranja e as do Codex em azul; quem trabalha ganha um brilho que respira
    const boxes = [];
    for (const box of layout.boxes.values()) {
      const node = box.node; if (!node) continue;
      const g = svgEl('g', { class: 'pe-fbox', transform: 'translate(' + box.x.toFixed(1) + ' ' + box.y.toFixed(1) + ')' });
      g.dataset.lado = node.side || 'voce'; g.dataset.estado = node.estado; g.dataset.stage = node.stage; if (node.hot) g.dataset.hot = '1'; if (box.pillOf) g.dataset.pill = '1';
      g.dataset.work = node.work ? '1' : '0'; g.dataset.workSource = node.workSource || '';
      const title = svgEl('title'); title.textContent = node.plain + ': ' + node.lines.map(lineItem => lineItem[0]).join(', '); g.append(title);
      g.append(svgEl('rect', { class: 'pe-fbox-glow', x: -4, y: -4, width: box.w + 8, height: box.h + 8, rx: box.pillOf ? 18 : 14 }));
      g.append(svgEl('rect', { class: 'pe-fbox-shadow', x: 0, y: 4, width: box.w, height: box.h, rx: box.pillOf ? 15 : 11 }));
      g.append(svgEl('rect', { class: 'pe-fbox-bg', x: 0, y: 0, width: box.w, height: box.h, rx: box.pillOf ? 15 : 11 }));
      if (box.pillOf) {
        const dot = svgEl('circle', { class: 'pe-fbox-dot', cx: 14, cy: box.h / 2, r: 4 }); g.append(dot);
        const room = Math.floor((box.w - 40) / (F.p + 1)), full = node.pillText || node.title + ' · ' + node.lines[0][0];
        const text = svgEl('text', { class: 'pe-fbox-pill', x: 26, y: box.h / 2 + 4 }); text.textContent = full.length <= room ? full : trunc(node.lines[0][0], room); g.append(text);
      } else {
        g.append(svgEl('rect', { class: 'pe-fbox-band', x: 0, y: 0, width: box.w, height: 28, rx: 11 }));
        g.append(svgEl('rect', { class: 'pe-fbox-band-fix', x: 0, y: 17, width: box.w, height: 11 }));
        const head = boxHead(node, box.w, F);
        const name = svgEl('text', { class: 'pe-fbox-t', x: 12, y: 19 }); name.textContent = head.title; g.append(name);
        if (head.tag) { const tag = svgEl('text', { class: 'pe-fbox-tag', x: box.w - 10, y: 18, 'text-anchor': 'end' }); tag.textContent = head.tag; g.append(tag); }
        let y = 46;
        // box.rows: as linhas como a geometria decidiu (no denso o estado longo vem em 2 linhas; a 2a alinhada a 1a)
        (box.rows || node.lines).forEach(([value, hot, cont], index) => {
          if (index === 0) g.append(svgEl('circle', { class: 'pe-fbox-dot', cx: 16, cy: y - 4, r: 4 }));
          const inset = index === 0 || cont;
          const text = svgEl('text', { class: 'pe-fbox-l' + (hot ? ' pe-hot' : ''), x: inset ? 27 : 12, y }); text.textContent = trunc(value, Math.floor((box.w - (inset ? 36 : 22)) / F.l)); g.append(text);
          y += F.row;
        });
      }
      boxes.push(g);
    }
    c.fx.boxes.replaceChildren(...boxes);
    // Particles belong only to messages from the last 15 minutes; work has its own CSS pulse.
    c.fx.particles = layout.wires.map(wire => {
      const edge = wire.edge, age = edge.ageMin;
      // so fio com mensagem nos ultimos 15 min anda; sem atividade nova, nada anda (e o laco para)
      const n = edge.recent ? Math.min(5, 2 + Math.floor(Math.log2(1 + edge.count))) : 1;
      if (!n) return null;
      const path = samplePath(wire.segs);
      if (path.total < 24) return null; // fio curto (caixa ate a pilula): particula ali vira borrao
      return { key: edge.key, sender: edge.sender, path, n, speed: edge.recent ? 120 : 34, lento: !edge.recent, offset: (hashOf(edge.key) % 1000) / 1000, size: edge.recent ? 1 : 0.75, sel: edge.key === c.wireKey };
    }).filter(Boolean);
    syncMotion(c, motion);
  }
  function syncMotion(c, motion) {
    syncWorkMotion(c);
    const f = W[c.lang].flow;
    c.fx.motion.hidden = motion || !c.layout || c.layout.mode === 'lista';
    // botao pequeno no canto (o aviso longo vai para a dica)
    setText(c.fx.motionText, ''); c.fx.motionText.hidden = true; setText(c.fx.motionBtn, f.motionOn); setAttr(c.fx.motionBtn, 'title', f.motionOff);
    if (motion && c.fx.particles.length && c.layout && c.layout.mode !== 'lista') startParticles(c);
    else stopParticles(c);
  }
  // Particulas: pontinhos HTML animados so com transform e opacity (Web Animations rodam no compositor, sem JavaScript por
  // quadro). Cada fio com mensagem nos ultimos 15 min ganha de 2 a 5 pontos em fila; o caminho vira 24 pontos de passagem.
  const onScreen = c => c.mode === 'flow' && c.fx.onScreen !== false && c.fx.map.isConnected && Boolean(c.fx.map.offsetParent);
  function syncWorkMotion(c) {
    if (!c.fx.flow) return;
    const shown = c.mode === 'flow' && c.teamTab !== false && c.fx.flow.isConnected && Boolean(c.fx.flow.offsetParent);
    const seen = c.fx.workOnScreen !== false;
    const now = Date.now(), strict = c.flowView && c.flowView.scalar, context = strict ? c.flowView.metadataContext : scalarMode(c.snapshot) ? metadataContext(c.snapshot, now) : null;
    const read = strict ? !c.flowFailed && c.flowView.known && context.valid && now >= context.observedAt && now - context.observedAt <= METADATA_MS : !c.failed && (context ? context.valid : trabalhoLeitura({ known: Boolean(c.snapshot), activityReadAt: stamp(c.snapshot && c.snapshot.updated) }, now));
    c.fx.flow.dataset.pulseMotion = motionOn() && !doc.hidden && shown && seen && read ? '1' : '0';
  }
  function startParticles(c) {
    const key = JSON.stringify(c.fx.particles.map(p => [p.key, p.n, p.sel, Math.round(p.path.total), p.path.points[0].map(Math.round), p.path.points[p.path.points.length - 1].map(Math.round)]));
    if (c.fx.partKey !== key || !c.fx.anims || !c.fx.anims.length) {
      stopParticles(c); c.fx.partKey = key; c.fx.anims = [];
      const dots = [];
      for (const p of c.fx.particles) {
        const steps = 24, frames = [];
        for (let k = 0; k <= steps; k++) { const point = pointAt(p.path, p.path.total * k / steps); frames.push({ transform: 'translate(' + point[0].toFixed(1) + 'px,' + point[1].toFixed(1) + 'px)', opacity: k === 0 || k === steps ? 0 : 1, offset: k / steps }); }
        const duration = Math.max(1200, p.path.total / p.speed * 1000);
        for (let i = 0; i < p.n; i++) {
          const dot = h('i', 'pe-part'); dot.dataset.lado = p.sender; if (p.sel) dot.dataset.sel = '1'; if (p.lento) dot.dataset.lento = '1';
          dots.push([dot, frames, duration, -duration * ((p.offset + i / p.n) % 1)]);
        }
      }
      c.fx.canvas.replaceChildren(...dots.map(item => item[0]));
      for (const [dot, frames, duration, delay] of dots) { if (typeof dot.animate !== 'function') continue; try { c.fx.anims.push(dot.animate(frames, { duration, delay, iterations: Infinity, easing: 'linear' })); } catch { /* sem animacao */ } }
    }
    const run = !doc.hidden && onScreen(c);
    for (const anim of c.fx.anims) { try { if (run) anim.play(); else anim.pause(); } catch { /* ja acabou */ } }
  }
  function stopParticles(c) {
    for (const anim of c.fx.anims || []) { try { anim.cancel(); } catch { /* ja acabou */ } }
    c.fx.anims = []; c.fx.partKey = null;
    if (c.fx.canvas && c.fx.canvas.replaceChildren) c.fx.canvas.replaceChildren();
  }
  function pauseParticles(c, paused) { for (const anim of c.fx.anims || []) { try { if (paused) anim.pause(); else anim.play(); } catch { /* ja acabou */ } } }
  function pointAt(path, distance) {
    const { lengths, points } = path;
    let lo = 0, hi = lengths.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (lengths[mid] < distance) lo = mid + 1; else hi = mid; }
    if (lo === 0) return points[0];
    const span = lengths[lo] - lengths[lo - 1] || 1, t = (distance - lengths[lo - 1]) / span, a = points[lo - 1], b = points[lo];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function openWire(c, key) {
    c.wireKey = c.wireKey === key ? null : key;
    paintWireDetail(c); c.wireSig = ''; drawFlow(c);
    if (c.wireKey && c.fx.detail.scrollIntoView) c.fx.detail.scrollIntoView({ block: 'nearest', behavior: motionOn() ? 'smooth' : 'auto' });
  }
  // Detalhe do fio: quem para quem com nomes claros e, em cada linha, o que aconteceu em palavras simples (sem texto da conversa).
  function paintWireDetail(c) {
    const w = W[c.lang], f = w.flow, edge = c.flowView && c.flowView.edges.find(item => item.key === c.wireKey);
    c.fx.detail.hidden = !edge;
    if (!edge) return;
    c.fx.detail.dataset.lado = edge.sender;
    setText(c.fx.detailTitle, edge.title);
    setText(c.fx.detailSub, f.count(edge.count) + ' · ' + f.kind[edge.kind] + ' · ' + edge.lastTime);
    setAttr(c.fx.detailClose, 'aria-label', f.close); setAttr(c.fx.detailClose, 'title', f.close);
    const reservedChat = ['assistente'].find(id => edge.from === id || edge.to === id || edge.from === 'ajudantes:' + id || edge.to === 'ajudantes:' + id);
    c.fx.detailList.replaceChildren(...edge.messages.map(message => {
      const item = h('li', 'pe-wire-msg'), time = h('span', 'pe-wire-msg-at', message.time), kind = h('span', 'pe-wire-msg-k'), what = h('span', 'pe-wire-msg-s');
      const sample = svgEl('svg', { viewBox: '0 0 22 8', class: 'pe-legend-line', 'aria-hidden': 'true' }); sample.append(svgEl('path', { d: 'M1 4 H21', class: 'pe-w-main', 'data-kind': message.kind, 'data-lado': edge.sender }));
      kind.append(sample, h('span', null, f.kind[message.kind]));
      what.append(h('span', 'pe-wire-msg-o', message.text));
      const chat = reservedChat ? reservedChat.toUpperCase() : edge.chat;
      const extra = message.reserved || reservedChat ? (chat ? f.reservedAt(w.chatOf(chat)) : f.reservedNoChat) : message.subject ? f.about(message.subject) : null;
      if (extra) what.append(h('span', 'pe-wire-msg-x', extra));
      item.append(time, kind, what); return item;
    }));
  }
  async function pullFlow(c) {
    if (c.flowBusy || c.mode !== 'flow') return;
    c.flowBusy = true;
    try {
      const response = await root.fetch('/api/pe-equipe/fluxo', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw Error('fluxo ' + response.status);
      c.flowData = await response.json(); c.flowFailed = false;
    } catch { c.flowFailed = true; }
    finally { c.flowBusy = false; }
    paintFlow(c);
  }

  // ---------- ligacao: ganchos do integrador ou sozinho ----------
  function langFrom(ctx) {
    const wanted = ctx && ctx.lang;
    if (LANGS.includes(wanted)) return wanted;
    const select = doc.getElementById('language');
    if (select && LANGS.includes(select.value)) return select.value;
    const html = String(doc.documentElement.lang || '').slice(0, 2);
    return LANGS.includes(html) ? html : 'pt';
  }
  const controllers = new Map();
  function controllerFor(mount) {
    let c = controllers.get(mount);
    if (c) return c;
    c = { mount, ui: {}, tl: {}, fx: {}, tree: null, lang: 'pt', mode: loadMode(), janela: loadJanela(), snapshot: null, failed: false, flowData: null, flowFailed: false, wireKey: null, pool: [], memory: memory.load(), caudas: new Map(), cupSeq: 0, cupKey: null, openId: null, external: false, timer: null, now: Date.now() };
    controllers.set(mount, c);
    build(c);
    c.onVisible = () => {
      syncWorkMotion(c);
      mount.classList.toggle('pe-paused', doc.hidden); if (c.dialog) c.dialog.classList.toggle('pe-paused', doc.hidden);
      pauseParticles(c, doc.hidden || !onScreen(c));
      if (!doc.hidden && scalarMode(c.snapshot)) paint(c);
      if (!doc.hidden && !c.external) pull(c);
      if (!doc.hidden && c.mode === 'flow') { paintFlow(c); pullFlow(c); c.wireSig = ''; drawFlow(c); }
    };
    c.onLang = () => { const next = langFrom(null); if (next !== c.lang) { c.lang = next; c.cupKey = null; c.flowSig = ''; c.wireSig = ''; paint(c); } };
    c.onTab = event => { c.teamTab = Boolean(event && event.detail && event.detail.tab === 'team'); syncWorkMotion(c); if (c.teamTab) { if (scalarMode(c.snapshot)) paint(c); if (!c.external) pull(c); if (c.mode === 'flow') { paintFlow(c); c.wireSig = ''; pullFlow(c); } } else stopParticles(c); };
    c.onMotion = () => { c.wireSig = ''; if (c.mode === 'flow') drawFlow(c); };
    doc.addEventListener('visibilitychange', c.onVisible);
    doc.addEventListener('painel:tab-change', c.onTab);
    const select = doc.getElementById('language'); if (select) select.addEventListener('change', c.onLang);
    if (typeof root.MutationObserver === 'function') { c.motionWatch = new root.MutationObserver(c.onMotion); c.motionWatch.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-motion'] }); }
    c.flowTimer = setInterval(() => { if (!doc.hidden && c.teamTab !== false && visible(c.mount)) { if (scalarMode(c.snapshot)) paint(c); else if (c.mode === 'flow' && visible(c.fx.flow)) paintFlow(c); if (c.mode === 'flow' && visible(c.fx.map)) pullFlow(c); } }, FLOW_MS);
    if (typeof root.ResizeObserver === 'function') { c.resize = new root.ResizeObserver(() => root.requestAnimationFrame(() => drawFlow(c))); c.resize.observe(c.fx.flow); }
    if (typeof root.IntersectionObserver === 'function') { c.seen = new root.IntersectionObserver(entries => { for (const entry of entries) { if (entry.target === c.fx.flow) c.fx.workOnScreen = entry.isIntersecting; else if (entry.target === c.fx.map) c.fx.onScreen = entry.isIntersecting; } syncWorkMotion(c); pauseParticles(c, doc.hidden || !onScreen(c)); }); c.seen.observe(c.fx.map); c.seen.observe(c.fx.flow); }
    loadPool(c);
    if (c.mode === 'flow') pullFlow(c);
    return c;
  }
  // reiniciando nessa hora, ficava vazio e todo cartao sem Agente proprio (o lado do Claude) caia no retrato generico.
  // Agora: vazio ou erro = tenta de novo a cada 30 s (no pull da tela), ate vir o pacote.
  async function loadPool(c) {
    c.poolTry = Date.now();
    try {
      const response = await root.fetch('/api/pe-equipe/agentes', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw Error('pool');
      const data = await response.json();
      c.pool = Array.isArray(data && data.pool) ? data.pool : [];
      if (c.snapshot) paint(c);
    } catch { c.pool = []; }
  }
  const visible = node => Boolean(node && node.isConnected && node.getClientRects().length);
  async function pull(c) {
    if (c.external || c.busy || !visible(c.mount)) return;
    c.busy = true;
    try {
      const example = /[?&]exemplo=1(?:&|$)/.test(root.location.search);
      const response = await root.fetch('/api/estado' + (example ? '?exemplo=1' : ''), { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw Error('estado ' + response.status);
      if ((!c.pool || !c.pool.length) && (!c.poolTry || Date.now() - c.poolTry > 30000)) loadPool(c);
      c.snapshot = await response.json(); c.failed = false;
    } catch { c.failed = true; }
    finally { c.busy = false; }
    c.lang = langFrom(null); paint(c);
  }
  function mountOf(ctx) { const wanted = ctx && (ctx.mount || ctx.host); return wanted && wanted.nodeType === 1 ? wanted : doc.querySelector('[data-pe-equipe]') || doc.getElementById('pe-equipe'); }
  function render(snapshot, ctx) {
    const mount = mountOf(ctx); if (!mount) return false;
    const c = controllerFor(mount);
    if (snapshot && typeof snapshot === 'object') { c.external = true; clearInterval(c.timer); c.timer = null; c.snapshot = snapshot; c.failed = false; }
    c.lang = langFrom(ctx); paint(c);
    return true;
  }
  function destroy() {
    for (const [mount, c] of controllers) {
      clearInterval(c.timer); clearInterval(c.flowTimer); if (c.resize) c.resize.disconnect(); if (c.seen) c.seen.disconnect(); if (c.motionWatch) c.motionWatch.disconnect();
      stopParticles(c);
      doc.removeEventListener('visibilitychange', c.onVisible); doc.removeEventListener('painel:tab-change', c.onTab);
      const select = doc.getElementById('language'); if (select) select.removeEventListener('change', c.onLang);
      if (c.dialog) { if (c.dialog.open) c.dialog.close(); c.dialog.remove(); }
      mount.replaceChildren(); mount.classList.remove('pe-equipe', 'pe-paused');
      controllers.delete(mount);
    }
  }
  function selfMount() {
    const mount = mountOf(null); if (!mount || controllers.has(mount)) return;
    const c = controllerFor(mount);
    c.lang = langFrom(null); paint(c); pull(c);
    c.timer = setInterval(() => { if (!doc.hidden) pull(c); }, POLL_MS);
  }
  const hook = { render, destroy };
  root.PainelEquipePE = Object.freeze({ ...api, render, destroy, hook });
  // o Inicio usa a mesma conta (contagem) e redesenha quando este modulo chega
  try { doc.dispatchEvent(new root.CustomEvent('painel:equipe-modelo')); } catch { /* sem evento */ }
  function start() {
    const ganchos = root.PainelGanchos;
    if (ganchos && typeof ganchos.register === 'function') { try { ganchos.register('equipe', hook); return; } catch { /* segue sozinho */ } }
    selfMount();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof window === 'object' ? window : globalThis);
