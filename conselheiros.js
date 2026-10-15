/* Conselheiros na aba Decidir: popup na 1a vez, questionario de clique, prompt montado com as escolhas e lembrete de ideias.
   O painel so le: quem cria os conselheiros e grava os arquivos e o Claude da pessoa, com o prompt que sai daqui.
   No node (testes e CONSELHEIROS-PROMPT.md) exporta a parte sem tela; no navegador monta a faixa, o dialogo e o aviso do topo. */
(function (root, fabrica) {
  'use strict';
  const M = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else { root.Conselheiros = M; if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => M.iniciar(root)); else M.iniciar(root); } }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const LINGUAS = ['pt', 'en', 'es'];
  const CHAVES = { popup: 'painel-conselheiros-popup', respostas: 'painel-conselheiros-respostas', lingua: 'painel-language' };
  // ---------- as 4 lentes ----------
  const LENTES = [
    { id: 'seguranca', cor: '#E58F8F', nome: { pt: 'Segurança e dinheiro', en: 'Security and money', es: 'Seguridad y dinero' },
      foco: 'pagamento, cobrança, saldo, login, senha, permissão, segredo em log ou em endereço de página e dado de cliente',
      olhar: 'valor e destino conferidos antes de gravar; o limite falha fechado; o pedido repetido não cobra 2 vezes; segredo fora do código, do log e da URL; quem não tem permissão não passa',
      achado: 'O pedido repetido cobra 2 vezes: conferir o número do pedido antes de gravar.',
      fala: 'Ajuda, desde que o total venha do servidor e não da tela.', voto: 'a favor' },
    { id: 'texto', cor: '#E8C27A', nome: { pt: 'Texto e sigilo', en: 'Text and privacy', es: 'Texto y privacidad' },
      foco: 'texto da tela, mensagens, documentos e tudo o que vai a público',
      olhar: 'a tela promete só o que o código cumpre; nenhum nome de pessoa, cliente ou dado interno que não deva sair; sem número inventado (sem dado é "?"); frase curta e clara',
      achado: 'A tela promete entrega em 1 dia e o código não garante: trocar pelo prazo real.',
      fala: 'Bom, com o texto dizendo o valor exato, sem arredondar.', voto: 'a favor' },
    { id: 'testes', cor: '#7FC8E8', nome: { pt: 'Testes e qualidade', en: 'Tests and quality', es: 'Pruebas y calidad' },
      foco: 'testes, casos de borda e o que pode quebrar',
      olhar: 'o teste novo falha sem o conserto (vermelho antes do verde); os testes da parte mexida rodam; caso vazio, repetido, grande e com erro; nenhum teste que passa sempre',
      achado: 'O teste novo passa mesmo sem o conserto: fazer ele falhar antes.',
      fala: 'Depende de um teste com carrinho vazio e com desconto.', voto: 'depende' },
    { id: 'produto', cor: '#9FD39A', nome: { pt: 'Produto', en: 'Product', es: 'Producto' },
      foco: 'se a mudança ajuda quem usa',
      olhar: 'o que a pessoa ganha; o caminho mais curto até o resultado; o que confunde quem chega pela 1a vez; o que falta para ficar pronto de verdade',
      achado: 'O botão novo fica escondido no menu: levar para a tela principal.',
      fala: 'Menos surpresa no fim da compra, menos desistência.', voto: 'a favor' }
  ];
  const IDS = LENTES.map(l => l.id), lenteDe = id => LENTES.find(l => l.id === id);
  // ---------- questionario (so clique) ----------
  const PERGUNTAS = [
    { id: 'lentes', multipla: true, titulo: { pt: 'Quais conselheiros você quer ligar?', en: 'Which advisors do you want to turn on?', es: '¿Qué consejeros quieres activar?' },
      opcoes: LENTES.map(l => ({ valor: l.id, rotulo: l.nome })) },
    { id: 'quando', titulo: { pt: 'Quando eles revisam?', en: 'When do they review?', es: '¿Cuándo revisan?' },
      opcoes: [{ valor: 'commit', rotulo: { pt: 'Antes de todo commit', en: 'Before every commit', es: 'Antes de cada commit' } },
        { valor: 'risco', rotulo: { pt: 'Só no que mexe em dinheiro ou login', en: 'Only when money or login changes', es: 'Solo cuando toca dinero o login' } },
        { valor: 'pedido', rotulo: { pt: 'Só quando eu pedir', en: 'Only when I ask', es: 'Solo cuando yo lo pida' } }] },
    { id: 'ideiasFreq', titulo: { pt: 'Com que frequência eles trazem ideias?', en: 'How often do they bring ideas?', es: '¿Cada cuánto traen ideas?' },
      opcoes: [{ valor: 'hora', rotulo: { pt: 'A cada hora', en: 'Every hour', es: 'Cada hora' } },
        { valor: 'dia', rotulo: { pt: '1 vez por dia', en: 'Once a day', es: '1 vez al día' } },
        { valor: 'pedido', rotulo: { pt: 'Só quando eu pedir', en: 'Only when I ask', es: 'Solo cuando yo lo pida' } }] },
    { id: 'ideiasPorVez', titulo: { pt: 'Quantas ideias por vez?', en: 'How many ideas at a time?', es: '¿Cuántas ideas por vez?' },
      opcoes: [1, 3, 5].map(n => ({ valor: n, rotulo: { pt: n === 1 ? '1 ideia' : n + ' ideias', en: n === 1 ? '1 idea' : n + ' ideas', es: n === 1 ? '1 idea' : n + ' ideas' } })) },
    { id: 'rigor', titulo: { pt: 'Quando um deles diz SEGURA:', en: 'When one of them says SEGURA (hold):', es: 'Cuando uno dice SEGURA (espera):' },
      opcoes: [{ valor: 'avisa', rotulo: { pt: 'Só avisa', en: 'Just warn me', es: 'Solo avisa' } },
        { valor: 'trava', rotulo: { pt: 'Trava até eu decidir', en: 'Hold until I decide', es: 'Frena hasta que yo decida' } }] },
    { id: 'lembrete', titulo: { pt: 'Me avise quando houver quantas ideias esperando?', en: 'Remind me when how many ideas are waiting?', es: '¿Avisarme cuando haya cuántas ideas esperando?' },
      opcoes: [5, 10, 20].map(n => ({ valor: n, rotulo: { pt: n + ' ideias', en: n + ' ideas', es: n + ' ideas' } })) }
  ];
  const PADRAO = Object.freeze({ lentes: IDS.slice(), quando: 'commit', ideiasFreq: 'dia', ideiasPorVez: 3, rigor: 'trava', lembrete: 10 });
  function normalizar(r) {
    const x = r && typeof r === 'object' ? r : {}, out = {};
    for (const p of PERGUNTAS) {
      const validos = p.opcoes.map(o => o.valor);
      if (p.multipla) { const v = Array.isArray(x[p.id]) ? IDS.filter(id => x[p.id].includes(id)) : []; out[p.id] = v.length ? v : PADRAO[p.id].slice(); }
      else out[p.id] = validos.includes(x[p.id]) ? x[p.id] : PADRAO[p.id];
    }
    return out;
  }
  // ---------- textos da tela ----------
  const TEXTOS = {
    pt: {
      popup: { titulo: 'Conselheiros', linhas: ['Conselheiros são agentes revisores do seu Claude, cada um com uma lente: segurança e dinheiro, texto e sigilo, testes e qualidade, produto.', 'Eles revisam antes de você decidir e dizem PODE, CONFERE ou SEGURA, com o porquê. Com as 4 lentes ligadas, 4 revisores por commit gastam crédito do seu plano Claude.', 'E trazem ideias: cada um vota, e nada é feito sem o seu sim.'], ligar: 'Quero ligar', agoraNao: 'Agora não', reabrir: 'O que são conselheiros?' },
      q: { de: (a, b) => a + ' de ' + b, proxima: 'Próxima', voltar: 'Voltar', fechar: 'Fechar', umaPeloMenos: 'Escolha pelo menos 1.', varias: 'Pode marcar mais de uma.' },
      prompt: { titulo: 'Seu prompt está pronto', dica: 'Copie e cole no Claude Code, na pasta do seu projeto. Ele mostra o que vai criar e espera o seu sim.', copiar: 'Copiar', copiado: 'Copiado', semCopia: 'Selecione o texto e copie com Ctrl C.', mudar: 'Mudar respostas', fechar: 'Fechar' },
      faixa: { titulo: 'Conselheiros', desligados: 'Desligados. Eles revisam antes de você decidir e trazem ideias.', ligar: 'Ligar', esperando: 'Prompt pronto. Quando o seu Claude gravar estado/conselheiros/config.json, eles aparecem aqui.', verPrompt: 'Ver o prompt', mudar: 'Mudar respostas', nenhuma: 'none', semLeitura: '?', ideias: n => n === 1 ? '1 ideia esperando você' : n + ' ideias esperando você', abrirIdeias: 'Abrir Ideias', resumo: (n, q, f) => n + (n === 1 ? ' lente' : ' lentes') + ' · ' + q + ' · ideias: ' + f, revisoes: n => n === 1 ? '1 revisão' : n + ' revisões' },
      quando: { commit: 'antes de todo commit', risco: 'no que mexe em dinheiro ou login', pedido: 'quando você pede' },
      freq: { hora: 'a cada hora', dia: '1 vez por dia', pedido: 'quando você pede' },
      lembrete: { texto: (n, t) => n + ' ideias esperando você' + (t ? ', a mais votada: ' + t : ''), botao: 'Abrir Ideias' },
      ha: m => m < 1 ? 'agora' : m < 60 ? 'há ' + m + ' min' : m < 2880 ? 'há ' + Math.round(m / 60) + ' h' : 'há ' + Math.round(m / 1440) + ' dias'
    },
    en: {
      popup: { titulo: 'Advisors', linhas: ['Advisors are reviewer agents for your Claude, each with one lens: security and money, text and privacy, tests and quality, product.', 'They review before you decide and answer PODE (go ahead) or SEGURA (hold), with the reason.', 'They also bring ideas: each one votes, and nothing is done without your yes.'], ligar: 'Turn on', agoraNao: 'Not now', reabrir: 'What are advisors?' },
      q: { de: (a, b) => a + ' of ' + b, proxima: 'Next', voltar: 'Back', fechar: 'Close', umaPeloMenos: 'Pick at least 1.', varias: 'You can pick more than one.' },
      prompt: { titulo: 'Your prompt is ready', dica: 'Copy it and paste it into Claude Code, in your project folder. It shows what it will create and waits for your yes.', copiar: 'Copy', copiado: 'Copied', semCopia: 'Select the text and copy with Ctrl C.', mudar: 'Change answers', fechar: 'Close' },
      faixa: { titulo: 'Advisors', desligados: 'Off. They review before you decide and bring ideas.', ligar: 'Turn on', esperando: 'Prompt ready. When your Claude writes estado/conselheiros/config.json, they show up here.', verPrompt: 'See the prompt', mudar: 'Change answers', nenhuma: 'none', semLeitura: '?', ideias: n => n === 1 ? '1 idea waiting for you' : n + ' ideas waiting for you', abrirIdeias: 'Open Ideas', resumo: (n, q, f) => n + (n === 1 ? ' lens' : ' lenses') + ' · ' + q + ' · ideas: ' + f, revisoes: n => n === 1 ? '1 review' : n + ' reviews' },
      quando: { commit: 'before every commit', risco: 'when money or login changes', pedido: 'when you ask' },
      freq: { hora: 'every hour', dia: 'once a day', pedido: 'when you ask' },
      lembrete: { texto: (n, t) => n + ' ideas waiting for you' + (t ? ', top voted: ' + t : ''), botao: 'Open Ideas' },
      ha: m => m < 1 ? 'now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'
    },
    es: {
      popup: { titulo: 'Consejeros', linhas: ['Los consejeros son agentes revisores de tu Claude, cada uno con una lente: seguridad y dinero, texto y privacidad, pruebas y calidad, producto.', 'Revisan antes de que decidas y responden PODE (adelante) o SEGURA (espera), con el porqué.', 'Y traen ideas: cada uno vota, y nada se hace sin tu sí.'], ligar: 'Quiero activar', agoraNao: 'Ahora no', reabrir: '¿Qué son los consejeros?' },
      q: { de: (a, b) => a + ' de ' + b, proxima: 'Siguiente', voltar: 'Volver', fechar: 'Cerrar', umaPeloMenos: 'Elige al menos 1.', varias: 'Puedes marcar más de una.' },
      prompt: { titulo: 'Tu prompt está listo', dica: 'Cópialo y pégalo en Claude Code, en la carpeta de tu proyecto. Muestra lo que va a crear y espera tu sí.', copiar: 'Copiar', copiado: 'Copiado', semCopia: 'Selecciona el texto y copia con Ctrl C.', mudar: 'Cambiar respuestas', fechar: 'Cerrar' },
      faixa: { titulo: 'Consejeros', desligados: 'Apagados. Revisan antes de que decidas y traen ideas.', ligar: 'Activar', esperando: 'Prompt listo. Cuando tu Claude grabe estado/conselheiros/config.json, aparecen aquí.', verPrompt: 'Ver el prompt', mudar: 'Cambiar respuestas', nenhuma: 'none', semLeitura: '?', ideias: n => n === 1 ? '1 idea esperándote' : n + ' ideas esperándote', abrirIdeias: 'Abrir Ideas', resumo: (n, q, f) => n + (n === 1 ? ' lente' : ' lentes') + ' · ' + q + ' · ideas: ' + f, revisoes: n => n === 1 ? '1 revisión' : n + ' revisiones' },
      quando: { commit: 'antes de cada commit', risco: 'cuando toca dinero o login', pedido: 'cuando lo pides' },
      freq: { hora: 'cada hora', dia: '1 vez al día', pedido: 'cuando lo pides' },
      lembrete: { texto: (n, t) => n + ' ideas esperándote' + (t ? ', la más votada: ' + t : ''), botao: 'Abrir Ideas' },
      ha: m => m < 1 ? 'ahora' : m < 60 ? 'hace ' + m + ' min' : m < 2880 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' días'
    }
  };
  // ---------- armazenamento local (pode faltar ou recusar: nunca quebra) ----------
  function ler(store, k) { try { return store ? store.getItem(k) : null; } catch { return null; } }
  function gravar(store, k, v) { try { if (store) store.setItem(k, v); return true; } catch { return false; } }
  function lingua(store, idioma) { const l = LINGUAS.includes(idioma) ? idioma : ler(store, CHAVES.lingua); return LINGUAS.includes(l) ? l : 'pt'; }
  function deveMostrarPopup(store, ligado) { return !ligado && ler(store, CHAVES.popup) !== '1'; }
  function marcarPopupVisto(store) { return gravar(store, CHAVES.popup, '1'); }
  function lerRespostas(store) { const s = ler(store, CHAVES.respostas); if (!s) return null; try { return normalizar(JSON.parse(s)); } catch { return null; } }
  function salvarRespostas(store, r) { return gravar(store, CHAVES.respostas, JSON.stringify(normalizar(r))); }
  // ---------- lembrete ----------
  const LIMITES = [5, 10, 20];
  function limiteDe(local, config) {
    if (local && LIMITES.includes(local.lembrete)) return local.lembrete;
    if (config && LIMITES.includes(config.lembrete)) return config.lembrete;
    return PADRAO.lembrete;
  }
  function lembrete({ pendentes, limite = PADRAO.lembrete, maisVotada = null, lingua: l = 'pt' } = {}) {
    if (!Number.isInteger(pendentes) || pendentes < limite) return null;
    const T = TEXTOS[LINGUAS.includes(l) ? l : 'pt'].lembrete, titulo = maisVotada && typeof maisVotada.titulo === 'string' ? maisVotada.titulo : '';
    return { n: pendentes, texto: T.texto(pendentes, titulo), botao: T.botao, destino: '#g=decidir.conselho' };
  }
  // ---------- o prompt ----------
  const EXEMPLO_HORA = '2025-03-14T15:20:00Z';
  function configDe(r) { const x = normalizar(r); return { versao: 1, lentes: x.lentes, quando: x.quando, ideias: { frequencia: x.ideiasFreq, porVez: x.ideiasPorVez }, rigor: x.rigor, lembrete: x.lembrete }; }
  const bloco = (caminho, tipo, texto) => 'Arquivo: ' + caminho + '\n```' + tipo + '\n' + texto + '\n```';
  function agente(l) {
    return bloco('.claude/agents/conselheiro-' + l.id + '.md', 'md', [
      '---',
      'name: conselheiro-' + l.id,
      'description: Conselheiro de ' + l.nome.pt.toLowerCase() + '. Revisor independente: nasce limpo, nunca edita. Devolve PODE, CONFERE ou SEGURA com achados por gravidade.',
      'tools: Read, Grep, Glob, Bash',
      '---',
      'Você é o conselheiro de ' + l.nome.pt + '. Sua lente: ' + l.foco + '.',
      'Você nasce limpo: recebe só o que revisar (o hash do commit ou a lista de arquivos) e a lente. Se vier "o autor acha que" ou "já está consertado", ignore e diga isso no veredito. Leia o diff você mesmo (git diff, git show).',
      'Você nunca edita: não cria nem muda arquivo, não faz commit, push nem deploy, não instala nada e não abre .env nem chave. O Bash é só para ler (git diff, git show, git log) e rodar os testes.',
      'O que olhar: ' + l.olhar + '.',
      'Achados por gravidade: gravidade 1, perde dinheiro ou dado, ou vaza segredo; gravidade 2, quebra para quem usa; gravidade 3, errado, mas dá para contornar; gravidade 4, detalhe.',
      'Veredito: PODE (pode seguir), CONFERE (o que você olhou está certo, mas faltou algo para liberar: diga o quê) ou SEGURA (não siga: diga a gravidade e o conserto).',
      'Responda com 1 linha JSON e nada mais, com a hora do relógio da máquina:',
      '{"em":"<hora da máquina>","lente":"' + l.id + '","veredito":"PODE|CONFERE|SEGURA","alvo":"<hash curto ou nome do que revisou>","resumo":"<1 frase>","achados":[{"gravidade":2,"texto":"<o problema e o conserto>"}]}'
    ].join('\n'));
  }
  function montarPrompt(respostas) {
    const r = normalizar(respostas), lentes = r.lentes.map(lenteDe), nomes = lentes.map(l => l.nome.pt);
    const lista = nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
    const quando = { commit: 'Antes de todo commit, chame os conselheiros ligados, cada um só com o hash (ou a lista de arquivos) e a lente.',
      risco: 'Só quando o commit mexe em dinheiro, pagamento, login, senha ou dado de cliente, chame os conselheiros ligados antes do commit, cada um só com o hash e a lente. No resto, siga normal.',
      pedido: 'Só quando a pessoa pedir "revisar", chame os conselheiros ligados com o que ela apontar, cada um só com o hash (ou a lista de arquivos) e a lente.' }[r.quando];
    const freq = { hora: 'A cada 1 hora de trabalho com a pessoa, faça 1 rodada de ideias.', dia: '1 vez por dia, na primeira conversa do dia, faça 1 rodada de ideias.', pedido: 'Só quando a pessoa pedir "ideias", faça 1 rodada de ideias.' }[r.ideiasFreq];
    const porVez = 'No máximo ' + r.ideiasPorVez + (r.ideiasPorVez === 1 ? ' ideia' : ' ideias') + ' por rodada.';
    const primeira = lentes[0];
    const vereditos = ''; // Arquivo novo vazio; so revisoes reais entram depois.
    const conselho = { atualizadoEm: EXEMPLO_HORA,
      conselheiros: lentes.map(l => ({ id: l.id, nome: l.nome.pt, papel: l.nome.pt, criterio: 'Olha ' + l.foco + '.', assinatura: l.achado.split(':')[0] + '?', cor: l.cor })),
      ideias: [] };
    const card = { id: 'conselheiros-exemplo', sessao: 'Claude', criado: '2025-03-14T15:20:00.000Z', tipo: 'decisao',
      pergunta: 'O conselheiro de ' + primeira.nome.pt + ' segurou o commit a1b2c3d (gravidade 2). ' + primeira.achado + ' O que fazemos?',
      opcoes: [{ label: 'Consertar primeiro', descricao: 'Eu conserto, rodo os testes e peço a revisão de novo.', recomendada: true }, { label: 'Seguir assim', descricao: 'Faço o commit agora e anoto o achado para depois.' }],
      respondido: '' };
    const rigor = r.rigor === 'trava'
      ? ['SEGURA trava: não faça o commit. Conte à pessoa no chat (lente, gravidade e conserto) e grave um card para ela decidir no painel, neste formato (1 arquivo por card; id conselheiros-<lente>-<hash curto>). Para card perigoso, a resposta vale no chat; você grava o campo "respondido" depois do sim no chat. Só siga depois da resposta dela registrada, sem tratar o card como autorização de deploy ou dinheiro.', '', 'Formato (nao grave este arquivo): estado/cards/conselheiros-exemplo.json\n```json\n' + JSON.stringify(card, null, 2) + '\n```']
      : ['SEGURA só avisa: conte à pessoa no chat em 1 linha (lente, gravidade e conserto) e siga o trabalho. Ela decide se conserta agora.'];
    const linhas = [
      '# Conselheiros: revisores e ideias para o seu projeto',
      '',
      'Este texto foi montado pelo painel com as suas escolhas. Cole inteiro no Claude Code, na pasta do seu projeto. Para mudar, abra o painel, aba Decidir, "Mudar respostas", e cole o novo.',
      '',
      'Suas escolhas:',
      '- Conselheiros ligados: ' + lista + '.',
      '- Quando revisam: ' + TEXTOS.pt.quando[r.quando] + '.',
      '- Ideias: ' + TEXTOS.pt.freq[r.ideiasFreq] + ', no máximo ' + r.ideiasPorVez + ' por rodada.',
      '- Quando um diz SEGURA: ' + (r.rigor === 'trava' ? 'trava até a pessoa decidir' : 'só avisa') + '.',
      '- Lembrete: com ' + r.lembrete + ' ideias sem resposta.',
      'Custo: com as 4 lentes ligadas, 4 revisores por commit gastam crédito do seu plano Claude.',
      '',
      '## Antes de tudo (Claude, leia até o fim antes de agir)',
      '1. Fale com a pessoa na língua dela, em frases curtas.',
      '2. Mostre o caminho e o conteúdo completo de cada arquivo antes de gravar e peça um sim por arquivo. Só grave o arquivo aprovado; não substitua dados existentes. Não grave os blocos marcados Formato (nao grave).',
      '3. A pasta de estado é a que o painel lê (a mesma de estado/cards e estado/ideias). Se não souber qual é, pergunte. Os caminhos estado/... são dentro dela; os caminhos .claude/agents/... são dentro da pasta do projeto.',
      '4. Hora sempre do relógio da máquina (date -Iseconds no bash, Get-Date -Format o no PowerShell), nunca de cabeça.',
      '5. Nunca grave senha, chave, token, endereço de carteira nem dado pessoal nesses arquivos.',
      '',
      '## 1. Os conselheiros (1 agente por lente)',
      'Crie 1 arquivo por conselheiro ligado. Cada um nasce limpo (não recebe o seu raciocínio), nunca edita e devolve só o veredito.',
      '',
      ...lentes.flatMap(l => [agente(l), '']),
      '## 2. Quando revisam',
      quando,
      'Quem faz não revisa: o Claude que escreveu o código nunca dá o veredito do próprio trabalho. Quem revisa é sempre um conselheiro novo, sem o seu raciocínio.',
      'Cada veredito vira 1 linha no fim de estado/conselheiros/vereditos.jsonl: a linha JSON que o conselheiro devolveu, sem mudar nada. O painel mostra o último de cada lente.',
      'O PODE vale para o que foi revisado. Mudou o código, revise de novo. Um SEGURA depois, de qualquer lente, vence o PODE de antes.',
      ...rigor,
      '',
      'Crie estado/conselheiros/vereditos.jsonl vazio. Depois, acrescente 1 linha por revisão real:',
      '',
      bloco('estado/conselheiros/vereditos.jsonl', 'jsonl', vereditos),
      '',
      '## 3. Ideias (cada conselheiro traz ideias e todos votam)',
      freq,
      porVez,
      'Cada ideia é curta (título de até 70 letras e resumo de 1 frase) e nasce de uma lente. Todos os conselheiros ligados votam em cada ideia: "a favor", "contra" ou "depende", com 1 frase do porquê.',
      'Grave em estado/ideias/conselho.json, neste formato. Acrescente as ideias novas no fim da lista "ideias"; nunca apague nem mude as antigas. A cada rodada, troque "atualizadoEm" pela hora da máquina. O id é C-AAAAMMDD-HHMM-N.',
      '',
      bloco('estado/ideias/conselho.json', 'json', JSON.stringify(conselho, null, 2)),
      '',
      'Nunca aja numa ideia sem o sim da pessoa. Ela responde na tela completa do painel (Decidir > Conselho). O carimbo grava só estado/ideias/vereditos-dono.jsonl, com FAZER, PROVAR, GUARDAR ou DESCARTAR. Você só lê esse arquivo; quem grava é o painel.',
      'Comece uma ideia só com FAZER. PROVAR autoriza só um teste. GUARDAR adia e DESCARTAR recusa.',
      '',
      '## 4. Lembrete de ideias acumuladas',
      'Quando as ideias sem resposta chegarem a ' + r.lembrete + ', lembre 1 vez no chat: "' + r.lembrete + ' ideias esperando você, a mais votada: <título>. Abra o painel, aba Decidir > Conselho."',
      'Ideia sem resposta é a que está em conselho.json e não tem linha em vereditos-dono.jsonl. A mais votada é a que tem mais votos "a favor". Não repita o lembrete até o número cair abaixo de ' + r.lembrete + ' e chegar de novo. O painel mostra o mesmo aviso no topo.',
      '',
      '## 5. O arquivo que liga os conselheiros no painel',
      'Grave as suas escolhas em estado/conselheiros/config.json. Com ele, a aba Decidir mostra os conselheiros ligados e o último veredito de cada um.',
      '',
      bloco('estado/conselheiros/config.json', 'json', JSON.stringify(configDe(r), null, 2)),
      '',
      '## 6. Para terminar',
      'Depois de criar, diga à pessoa em 3 linhas: quais conselheiros nasceram, quando revisam e quando vêm as ideias. Não faça mais nada sem pedido.',
      ''
    ];
    return linhas.join('\n');
  }

  // ---------- tela (so no navegador) ----------
  function iniciar(win) {
    const doc = win.document, html = doc.documentElement;
    if (!doc || doc.getElementById('cons-faixa')) return;
    let store = null; try { store = win.localStorage; } catch { store = null; }
    let dados = null, aberto = false;
    const T = () => TEXTOS[lingua(store, doc.documentElement.dataset.kitIdioma)];
    const el = (tag, cls, ...kids) => { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) if (k !== null && k !== undefined && k !== false) n.append(k.nodeType ? k : String(k)); return n; };
    const botao = (cls, texto, fn) => { const b = el('button', cls, texto); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const faixa = el('section', 'cons-faixa'); faixa.id = 'cons-faixa'; faixa.setAttribute('aria-label', 'Conselheiros');
    const topo = el('div', 'cons-lembrete'); topo.id = 'cons-lembrete'; topo.hidden = true; topo.setAttribute('role', 'status');
    const dlg = doc.createElement('dialog'); dlg.id = 'cons-dlg'; dlg.className = 'cons-dlg';
    const corpo = el('div', 'cons-corpo'); dlg.append(corpo);
    dlg.addEventListener('cancel', () => { marcarPopupVisto(store); aberto = false; });
    dlg.addEventListener('close', () => { aberto = false; });
    function fechar() { marcarPopupVisto(store); try { dlg.close(); } catch { dlg.removeAttribute('open'); } aberto = false; }
    function abrir() { if (!dlg.isConnected) doc.body.append(dlg); if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } } aberto = true; }
    // popup
    function popup() {
      const t = T().popup;
      corpo.replaceChildren(el('h2', 'cons-h', t.titulo), ...t.linhas.map(l => el('p', 'cons-p', l)),
        el('div', 'cons-acoes', botao('cons-btn is-forte', t.ligar, () => { marcarPopupVisto(store); questionario(0, lerRespostas(store) || normalizar(PADRAO)); }), botao('cons-btn', t.agoraNao, fechar)));
      abrir(); const b = corpo.querySelector('.is-forte'); if (b) b.focus();
    }
    // questionario: 1 pergunta por tela; escolha unica avanca no clique
    function questionario(i, r) {
      const p = PERGUNTAS[i], l = lingua(store, doc.documentElement.dataset.kitIdioma), q = T().q;
      const marcado = o => p.multipla ? r[p.id].includes(o.valor) : r[p.id] === o.valor;
      const lista = el('div', 'cons-opcoes'); lista.setAttribute('role', p.multipla ? 'group' : 'radiogroup'); lista.setAttribute('aria-label', p.titulo[l]);
      const aviso = el('p', 'cons-aviso', p.multipla ? q.varias : '');
      for (const o of p.opcoes) {
        const b = botao('cons-opcao', o.rotulo[l], () => {
          if (p.multipla) { const s = new Set(r[p.id]); if (s.has(o.valor)) s.delete(o.valor); else s.add(o.valor); r[p.id] = IDS.filter(id => s.has(id)); questionario(i, r); }
          else { r[p.id] = o.valor; seguir(); }
        });
        b.setAttribute(p.multipla ? 'aria-pressed' : 'aria-checked', String(marcado(o))); if (!p.multipla) b.setAttribute('role', 'radio');
        if (p.id === 'lentes') { const cor = lenteDe(o.valor).cor; b.style.setProperty('--cons-cor', cor); }
        lista.append(b);
      }
      function seguir() { if (p.multipla && !r[p.id].length) { aviso.textContent = q.umaPeloMenos; return; } if (i + 1 < PERGUNTAS.length) questionario(i + 1, r); else { salvarRespostas(store, r); mostrarPrompt(normalizar(r)); pintar(); } }
      const pontos = el('div', 'cons-pontos'); PERGUNTAS.forEach((_, k) => pontos.append(el('span', k === i ? 'is-agora' : k < i ? 'is-feito' : '')));
      const acoes = el('div', 'cons-acoes');
      if (i > 0) acoes.append(botao('cons-btn', q.voltar, () => questionario(i - 1, r)));
      if (p.multipla) acoes.append(botao('cons-btn is-forte', q.proxima, seguir));
      acoes.append(botao('cons-btn is-quieto', q.fechar, () => { salvarRespostas(store, r); fechar(); pintar(); }));
      corpo.replaceChildren(el('p', 'cons-passo', q.de(i + 1, PERGUNTAS.length)), pontos, el('h2', 'cons-h', p.titulo[l]), lista, aviso, acoes);
      abrir(); const f = lista.querySelector('[aria-checked="true"],[aria-pressed="true"]') || lista.firstChild; if (f) f.focus();
    }
    function mostrarPrompt(r) {
      const t = T().prompt, texto = montarPrompt(r);
      const area = el('textarea', 'cons-texto'); area.readOnly = true; area.value = texto; area.rows = 12; area.setAttribute('aria-label', 'CONSELHEIROS-PROMPT.md');
      const estado = el('span', 'cons-copiado'); estado.setAttribute('role', 'status');
      const copiar = botao('cons-btn is-forte', t.copiar, async () => {
        let ok = false;
        try { await win.navigator.clipboard.writeText(texto); ok = true; } catch { try { area.focus(); area.select(); ok = doc.execCommand('copy'); } catch { ok = false; } }
        estado.textContent = ok ? t.copiado : t.semCopia;
      });
      corpo.replaceChildren(el('h2', 'cons-h', t.titulo), el('p', 'cons-p', t.dica), area,
        el('div', 'cons-acoes', copiar, estado, botao('cons-btn', t.mudar, () => questionario(0, r)), botao('cons-btn is-quieto', t.fechar, fechar)));
      abrir(); copiar.focus();
    }
    // faixa no topo da aba Decidir
    function pintar() {
      const t = T(), f = t.faixa, l = lingua(store, doc.documentElement.dataset.kitIdioma), local = lerRespostas(store);
      const links = el('span', 'cons-links', botao('cons-link', t.popup.reabrir, popup));
      if (dados && dados.ligado) {
        const cfg = dados.config || {}, lentes = Array.isArray(dados.lentes) ? dados.lentes : [];
        links.prepend(botao('cons-link', f.mudar, () => questionario(0, local || normalizar({ lentes: cfg.lentes, quando: cfg.quando, ideiasFreq: cfg.ideias && cfg.ideias.frequencia, ideiasPorVez: cfg.ideias && cfg.ideias.porVez, rigor: cfg.rigor, lembrete: cfg.lembrete }))));
        const cab = el('div', 'cons-cab', el('h2', 'cons-titulo', f.titulo), el('span', 'cons-resumo', f.resumo(lentes.length, t.quando[cfg.quando] || '?', t.freq[cfg.ideias && cfg.ideias.frequencia] || '?')), links);
        const grade = el('div', 'cons-lentes');
        for (const x of lentes) {
          const info = lenteDe(x.id), u = x.ultimo, card = el('article', 'cons-lente');
          card.style.setProperty('--cons-cor', info ? info.cor : '#999');
          const nome = el('span', 'cons-lente-nome', info ? info.nome[l] : x.id);
          if (x.estado === 'invalido') card.append(nome, el('span', 'cons-selo is-sem', f.semLeitura), el('p', 'cons-lente-txt', x.solucao || ''));
          else if (!u) card.append(nome, el('span', 'cons-selo is-sem', f.nenhuma));
          else {
            const min = Math.max(0, Math.round((Date.now() - Date.parse(u.em)) / 60000));
            const achado = u.achados && u.achados[0];
            card.append(nome, el('span', 'cons-selo is-' + u.veredito.toLowerCase(), u.veredito), el('span', 'cons-quando', Number.isFinite(min) ? t.ha(min) : '?'),
              el('p', 'cons-lente-txt', achado ? achado.gravidade + ' · ' + achado.texto : (u.resumo || '')), el('span', 'cons-quando', f.revisoes(x.revisoes || 1)));
          }
          grade.append(card);
        }
        const id = dados.ideias || {}, pend = Number.isInteger(id.pendentes) ? id.pendentes : null;
        const ideias = el('div', 'cons-ideias', el('span', '', pend === null ? f.semLeitura + (id.solucao ? ' ' + id.solucao : '') : pend === 0 ? f.nenhuma : f.ideias(pend)));
        if (pend) ideias.append(botao('cons-btn is-forte', f.abrirIdeias, () => { win.location.hash = '#g=decidir.conselho'; }));
        faixa.replaceChildren(cab, grade, ideias); faixa.dataset.estado = 'ligado';
      } else if (local) {
        links.prepend(botao('cons-link', f.mudar, () => questionario(0, local)));
        faixa.replaceChildren(el('div', 'cons-cab', el('h2', 'cons-titulo', f.titulo), el('span', 'cons-resumo', f.esperando), botao('cons-btn is-forte', f.verPrompt, () => mostrarPrompt(local)), links)); faixa.dataset.estado = 'esperando';
      } else {
        faixa.replaceChildren(el('div', 'cons-cab', el('h2', 'cons-titulo', f.titulo), el('span', 'cons-resumo', f.desligados), botao('cons-btn is-forte', f.ligar, () => questionario(0, normalizar(PADRAO))), links)); faixa.dataset.estado = 'desligado';
      }
      const lem = lembrete({ pendentes: dados && dados.ideias ? dados.ideias.pendentes : null, limite: limiteDe(local, dados && dados.config), maisVotada: dados && dados.ideias ? dados.ideias.maisVotada : null, lingua: l });
      if (lem) { topo.replaceChildren(el('span', 'cons-lembrete-txt', lem.texto), botao('cons-btn is-forte', lem.botao, () => { win.location.hash = lem.destino; })); topo.hidden = false; }
      else { topo.hidden = true; topo.replaceChildren(); }
    }
    async function atualizar() {
      try { const r = await win.fetch('/api/conselheiros', { cache: 'no-store', headers: { Accept: 'application/json' } }); dados = r.ok ? await r.json() : null; } catch { dados = null; }
      // r11: o popup nao abre sozinho (cobria a tela na 1a visita); ele abre pelo "O que sao conselheiros?" e pelo Ligar da faixa
      pintar();
    }
    function montar() {
      const sub = doc.getElementById('g-subnav'), bar = doc.getElementById('g-bar');
      // r11: a faixa mora no pe da Revisao (onde os conselheiros revisam); logo abaixo das sub-abas ela empurrava todas as vistas de Decidir
      const revisao = doc.getElementById('panel-revisao');
      if (revisao) revisao.append(faixa); else if (sub) sub.after(faixa); else { const main = doc.querySelector('main'); if (!main) return false; main.prepend(faixa); }
      if (bar) bar.after(topo); else doc.body.prepend(topo);
      doc.body.append(dlg);
      return true;
    }
    let tentativas = 0;
    (function esperar() { if (doc.getElementById('g-subnav') || tentativas++ > 40) { if (!montar()) return; pintar(); atualizar(); new win.MutationObserver(() => { if (html.dataset.gTab === 'decidir') atualizar(); }).observe(html, { attributes: true, attributeFilter: ['data-g-tab'] }); win.setInterval(atualizar, 60000); } else win.setTimeout(esperar, 250); })();
  }
  return { LENTES, PERGUNTAS, PADRAO, TEXTOS, CHAVES, normalizar, montarPrompt, configDe, lembrete, limiteDe, lingua, deveMostrarPopup, marcarPopupVisto, lerRespostas, salvarRespostas, iniciar };
});
