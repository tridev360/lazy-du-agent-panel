(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var ESTADO = { pronta: 'pronta', quase: 'quase lá', obra: 'em obra', voce: 'espera você', parado: 'parado', '?': '?', 'sem-leitura': '?' };
  var TRILHA = { feito: 'feito', rodando: 'rodando', falta: 'falta', voce: 'espera você' };

  function el(doc, tag, cls, texto) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (texto !== undefined && texto !== null) n.textContent = String(texto);
    return n;
  }
  function sv(doc, tag, at) {
    var n = doc.createElementNS(NS, tag);
    for (var k in at) if (Object.prototype.hasOwnProperty.call(at, k)) n.setAttribute(k, at[k]);
    return n;
  }
  function tx(doc, s, x, y, tam, texto, cls, ancora) {
    var n = sv(doc, 'text', { x: x, y: y, 'font-size': tam });
    if (cls) n.setAttribute('class', cls);
    if (ancora) n.setAttribute('text-anchor', ancora);
    n.textContent = String(texto);
    s.append(n);
    return n;
  }
  function r(doc, s, x, y, w, h, cls, rx) {
    var n = sv(doc, 'rect', { x: x, y: y, width: w, height: h, rx: rx === undefined ? 6 : rx });
    n.setAttribute('class', cls);
    s.append(n);
    return n;
  }
  function c(doc, s, cx, cy, raio, cls) {
    var n = sv(doc, 'circle', { cx: cx, cy: cy, r: raio });
    n.setAttribute('class', cls);
    s.append(n);
    return n;
  }
  function p(doc, s, d, cls) {
    var n = sv(doc, 'path', { d: d });
    n.setAttribute('class', cls);
    s.append(n);
    return n;
  }
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function doisD(n) { return (n < 10 ? '0' : '') + n; }
  // r11: carimbo ISO vira hora de gente ("às 09:11" hoje, "em 14 de outubro, 09:11" em outro dia); texto que nao e carimbo fica como veio
  function quandoGente(v, agora) {
    var t = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? Date.parse(v) : NaN;
    if (!isFinite(t)) return null;
    var d = new Date(t), h = new Date(isFinite(agora) ? agora : Date.now()), hm = doisD(d.getHours()) + ':' + doisD(d.getMinutes());
    return d.toDateString() === h.toDateString() ? 'às ' + hm : 'em ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ', ' + hm;
  }
  function semCarimbo(v) { var q = quandoGente(v); return q ? (q.indexOf('às') === 0 ? 'hoje ' + q : q.slice(3)) : v; }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function horas(h) { return h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : String(Math.round(h * 10) / 10).replace('.', ',') + ' h'; }

  var SPR = {
    bot: ['................|..I.I.I.....P...|.IIIIIII....P...|..IPPPI....PPP..|.IIPrPII...PPP..|..IPPPI....PPP..|.IIIIIII...PPP..|..I.I.I.P...P...|........P...P...|...R...PPP......|...R...PPP......|..RRR..PPP......|..RRR...P.......|..RRR...P.......|...R............|MMMMMMMMMMMMMMMM',
      '................|.......II.......|.....PPIIPP.....|...PPP.II.PPP...|..PP...II...PP..|..P..........P..|.PP..........PP.|IIIII..rr..IIIII|IIIII..rr..IIIII|.PP..........PP.|..P..........P..|..PP...II...PP..|...PPP.II.PPP...|.....PPIIPP.....|.......II.......|................',
      'II............II|I..........R...I|........PPP.....|.......PPP......|......PPP.......|.....PPPPPPP....|....PPPPPPP.....|.......PPP......|......PPP.......|.....PPP........|....PPP.........|....PP..........|....P......r....|..R.............|I..............I|II............II',
      '................|......PPPP......|..PP..PPPP..PP..|..PPPPPPPPPPPP..|...PPPPPPPPPP...|...PPP....PPP...|.PPPP..II..PPPP.|.PPPP.IrrI.PPPP.|.PPPP.IrrI.PPPP.|.PPPP..II..PPPP.|...PPP....PPP...|...PPPPPPPPPP...|..PPPPPPPPPPPP..|..PP..PPPP..PP..|......PPPP......|................'],
    simulacao: ['................|.....IIIIII.....|......I..I......|......I..I......|......I.RI......|.....I....I.....|.....I.R..I.....|....I......I....|....IPPPPPPI....|...IPPPPPPPPI...|...IPPrPPPPPI...|..IPPPPPPrPPPI..|..IPPPPPPPPPPI..|..IIIIIIIIIIII..|................|................',
      '................|................|IIIIIIIIIIIIIIII|I......II......I|I.PPP..II..RR..I|I.P.P..II...R..I|I.P.P..II...R..I|I.P.P..II...R..I|I.PPP..II..RRR.I|I......II......I|IIIIIIIIIIIIIIII|......MMMM......|......MMMM......|....MMMMMMMM....|................|................',
      '................|I...............|I..........PP...|I.........P..P..|I....PP..P....P.|I...P..PP.......|I..P............|I.P.............|I...............|I...............|IIIIIIIIIIIIIIII|................|..GG..GG..RR..GG|..GG..GG..RR..GG|................|................'],
    protecao: ['................|..PPPPPPPPPPPP..|..PPPPPPPPPPPP..|..PP........PP..|..PP......I.PP..|..PP.....II.PP..|..PP.I..II..PP..|..PP.IIII...PP..|..PP..II....PP..|..PP........PP..|...PP......PP...|...PPP....PPP...|....PPP..PPP....|.....PPPPPP.....|......PPPP......|................',
      '................|.....IIIIII.....|....II....II....|....I......I....|....I......I....|....I......I....|..PPPPPPPPPPPP..|..PPPPPPPPPPPP..|..PPPPP..PPPPP..|..PPPP.rr.PPPP..|..PPPPP..PPPPP..|..PPPPP..PPPPP..|..PPPPPPPPPPPP..|..PPPPPPPPPPPP..|................|................',
      '................|................|.....RRRRRR.....|.....RRRRRR.....|................|...PPPPPPPPPP...|...P........P...|...PPPPPPPPPP...|................|.IIIIIIIIIIIIII.|.I............I.|.I............I.|.IIIIIIIIIIIIII.|................|..M..M..M..M..M.|................'],
    video: ['................|.II.II.II.II.II.|II.II.II.II.II..|................|PPPPPPPPPPPPPPPP|P..............P|P.....R........P|P.....RR.......P|P.....RRR......P|P.....RRRR.....P|P.....RRR......P|P.....RR.......P|P.....R........P|P..............P|PPPPPPPPPPPPPPPP|................',
      '................|................|..II....II......|.IIII..IIII.....|.IIII..IIII.....|..II....II......|PPPPPPPPPPP....P|PPPPPPPPPPP...PP|PP.......PP..PPP|PP..r....PPPPPPP|PP.......PPPPPPP|PP.......PP..PPP|PPPPPPPPPPP...PP|PPPPPPPPPPP....P|................|................',
      '................|PPPPPPPPPPPPPPPP|P.PP.PP.PP.PP.PP|PPPPPPPPPPPPPPPP|P......PP......P|P.R....PP....I.P|P.RR...PP...II.P|P.RRR..PP..III.P|P.RR...PP.IIII.P|P.R....PP......P|P......PP......P|PPPPPPPPPPPPPPPP|P.PP.PP.PP.PP.PP|PPPPPPPPPPPPPPPP|................|................'],
    anuncio: ['................|...........PP...|.........PPPP...|.......PPPPPP.R.|.IIIIPPPPPPPP...|.IIIIPPPPPPPP.RR|.IIIIPPPPPPPP...|.IIIIPPPPPPPP.RR|.IIIIPPPPPPPP...|.......PPPPPP.R.|..II.....PPPP...|..II.......PP...|..II............|..II............|................|................',
      '................|..I.............|..IPPPPPPPP.....|..IPPPPPPPPPP...|..IPPRRPPPPPPPP.|..IPPRRPPPPPPPP.|..IPPPPPPPPPP...|..IPPPPPPPP.....|..I.............|..I.............|..I.............|..I.............|..I.............|.III............|IIIII...........|................'],
    tela: ['................|PPPPPPPPPPPPPPPP|P.P.P.PPPPPPPPPP|PPPPPPPPPPPPPPPP|P..............P|P.II.MMMMM..GG.P|P..............P|P.II.MMMM...RR.P|P..............P|P.II.MMMMMM.GG.P|P..............P|P.II.MMM....GG.P|P..............P|PPPPPPPPPPPPPPPP|................|................',
      '................|PPPPPPPPPPPPPPPP|P..............P|P.I............P|P..I...........P|P...I..........P|P..I...........P|P.I....rrrr....P|P..............P|P.MMMMMMMM.....P|P..............P|P.MMMMM........P|P..............P|PPPPPPPPPPPPPPPP|................|................',
      '................|................|.PPPPPPPPPPPPPP.|.P............P.|.P.RRRRRRRR...P.|.P.RRRRRRRR...P.|.P......I.....P.|.PPPPPPPII.PPPP.|........III.....|........IIII....|........IIIII...|........IIIIII..|........IIII....|........I..II...|...........II...|................',
      '................|PPPPPPPPPPPP....|P..........P....|P.MMMMMMM..P....|P........IIIIIII|P.MMMM...I.....I|P........I.RRR.I|P.MMMMMM.I.RRR.I|PPPPPPPPPI.....I|....PP...I.MMM.I|..PPPPPP.I.....I|.........I.MMM.I|.........I.....I|.........I..r..I|.........IIIIIII|................'],
    painel: ['................|PPPPPPP.IIIIIIII|P.....P.I......I|P.RRR.P.I.....PI|P.RRR.P.I...P.PI|P.RRR.P.I.P.P.PI|P.....P.I......I|PPPPPPP.IIIIIIII|................|MMMMMMMMMMMMMMMM|M..............M|M.PPPPPPPPP....M|M..............M|M.RRRRR........M|M..............M|MMMMMMMMMMMMMMMM',
      '................|PPPP..PPPP..PPPP|................|IIII..IIII..IIII|IIII..IIII..IIII|................|IIII..RRRR..IIII|IIII..RRRR..IIII|................|IIII........IIII|IIII........IIII|................|............IIII|............IIII|................|................',
      '................|......MMMMMMMMMM|......M........M|...IIIIIIIIII..M|...I........I..M|PPPPPPPPPP..I..M|P.P.PPPPPP..I..M|PPPPPPPPPP..I..M|P........P..I..M|P.RRRR...P..IMMM|P........P..I...|P.MMMMMM.PIII...|P........P......|PPPPPPPPPP......|................|................'],
    dado: ['................|....PPPPPPPP....|..PPPPPPPPPPPP..|..PPPPPPPPPPPP..|..P.PPPPPPPP.P..|..P..........P..|..PPP......PPP..|..P.PPPPPPPP.P..|..P..........P..|..PPP......PPP..|..P.PPPPPPPP.P..|..P.......r..P..|..PPP......PPP..|....PPPPPPPP....|................|................',
      '................|.R............R.|R..R........R..R|R.R..........R.R|R.R....PP....R.R|R.R...PPPP...R.R|R..R..PPPP..R..R|.R.....PP.....R.|.......II.......|......IIII......|......I..I......|.....II..II.....|.....I....I.....|....II....II....|...IIIIIIIIII...|................',
      '................|..R..G...Y..R...|.....R..G.......|PPPPPPPPPPPPPPPP|.PP..........PP.|..PP........PP..|...PP......PP...|....PP....PP....|.....PP..PP.....|......P..P......|......P..P......|......P..P......|......PPPP......|................|.......II.......|.......II.......'],
    carteira: ['................|................|...PPPPPPPPPP...|..PP............|.PPPPPPPPPPPPPP.|.PPPPPPPPPPPPPP.|.PP..........PP.|.PP.....IIIIIIII|.PP.....I..RR..I|.PP.....I..RR..I|.PP.....IIIIIIII|.PP..........PP.|.PPPPPPPPPPPPPP.|.PPPPPPPPPPPPPP.|................|................',
      '................|................|...........YYYY.|...........MMMM.|...........YYYY.|...........MMMM.|......PPPP.YYYY.|......MMMM.MMMM.|......PPPP.YYYY.|......MMMM.MMMM.|.IIII.PPPP.YYYY.|.MMMM.MMMM.MMMM.|.IIII.PPPP.YYYY.|.MMMM.MMMM.MMMM.|................|................',
      '................|................|PPPPPPPPPPPPPPPP|P..............P|PIIIIIIIIIIIIIIP|PIIIIIIIIIIIIIIP|P..............P|P.YYY..........P|P.YYY..........P|P..............P|P.MMMM.MMMM.MM.P|P..............P|PPPPPPPPPPPPPPPP|................|................|................'],
    cassino: ['................|..PPPPPPPPPPPP..|.PPPPPPPPPPPPPP.|.PP..........PP.|.PP.II....II.PP.|.PP.II....II.PP.|.PP..........PP.|.PP....RR....PP.|.PP....RR....PP.|.PP..........PP.|.PP.II....II.PP.|.PP.II....II.PP.|.PP..........PP.|.PPPPPPPPPPPPPP.|..PPPPPPPPPPPP..|................',
      '................|.....PPIIPP.....|...PPPPIIPPPP...|..PPPPPPPPPPPP..|..PPP......PPP..|.PPP...RR...PPP.|.PP...RRRR...PP.|.II..RRRRRR..II.|.II..RRRRRR..II.|.PP...RRRR...PP.|.PPP...RR...PPP.|..PPP......PPP..|..PPPPPPPPPPPP..|...PPPPIIPPPP...|.....PPIIPP.....|................',
      '................|......IIIIIIIII.|......I.......I.|.PPPPPPPPP....I.|.P.......P.RR.I.|.P.RR....P.RR.I.|.P.RR....P....I.|.P.......P....I.|.P..PPP..P....I.|.P..PPP..P....I.|.P.......P....I.|.P....RR.PIIIII.|.P....RR.P......|.P.......P......|.PPPPPPPPP......|................'],
    jogo: ['................|................|................|..PPPPPPPPPPPP..|.PPPPPPPPPPPPPP.|PPPIPPPPPPPPPRPP|PPIIIPPPPPPRPPPP|PPPIPPPPPPPPPPPP|PPPPPPPPPPPPPPPP|PPPP........PPPP|PPP..........PPP|.PP..........PP.|................|................|................|................',
      '............III.|...........IIII.|..........IIII..|.........IIII...|........IIII....|.......IIII.....|..P...IIII......|..PP.IIII.......|...PPIII........|....PPP.........|...PPPPP........|..RR..PP........|.RR.............|RR..............|................|................',
      '................|................|..PPPP....PPPP..|.PPPPPP..PPPPPP.|PPIIPPPPPPPPPPPP|PPIPPPPPPPPPPPPP|PPPPPPPPPPPPPPPP|PPPPPPPPPPPPPPPP|.PPPPPPPPPPPPPP.|..PPPPPPPPPPPP..|...PPPPPPPPPP...|....PPPPPPPP....|.....PPPPPP.....|......PPPP......|.......PP.......|................'],
    texto: ['................|..PPPPPPPPP.....|..P.......PP....|..P.......P.P...|..P.......PPPP..|..P..........P..|..P.IIIIIIII.P..|..P..........P..|..P.IIIIII...P..|..P..........P..|..P.IIIIIIII.P..|..P..........P..|..P.RRRR.....P..|..P..........P..|..PPPPPPPPPPPP..|................',
      '................|.PPPPPPPPPPPPPP.|PP............PP|P..............P|P..IIIIIIIII...P|P..............P|P..IIIIII......P|P..............P|P..IIIIIIII....P|PP............PP|.PPPP...PPPPPPP.|....P..P........|....P.P.........|....PP..........|................|................',
      '................|.....PPPPPP.....|...PPP.II.PPP...|..PP...II...PP..|.PP.I..II..I.PP.|.P..I..II..I..P.|.PIIIIIIIIIIIIP.|.P.I...II...I.P.|.P.I...II...I.P.|.PIIIIIIIIIIIIP.|.P..I..II..I..P.|.PP.I..II..I.PP.|..PP...II...PP..|...PPP.II.PPP...|.....PPPPPP.....|................'],
    pesquisa: ['................|....PPPPPP......|..PPP....PPP....|.PP........PP...|.P...II.....P...|PP..I.......PP..|P...I........P..|P............P..|PP..........PP..|.P..........P...|.PP........PPP..|..PPP....PPPIII.|....PPPPPP..IIII|.............III|..............II|................',
      '................|.....PPPPPP.....|...PPPPPPPPPP...|..PPPIIPPPPPPP..|..PPIPPPPPPPPP..|..PPPPPPPPPPPP..|..PPPPPPPPPPPP..|...PPPPPPPPPP...|....PPPPPPPP....|.....PPPPPP.....|.....PPPPPP.....|......IIII......|......MMMM......|......IIII......|.......MM.......|................',
      '................|................|................|.....PPPPPP.....|...PPP....PPP...|..PP...II...PP..|.PP...IIII...PP.|PP...IIrrII...PP|PP...IIrrII...PP|.PP...IIII...PP.|..PP...II...PP..|...PPP....PPP...|.....PPPPPP.....|................|................|................'],
    arte: ['................|.....PPPPPPP....|...PPPPPPPPPPP..|..PPPRRPPPPGGPP.|.PPPPRRPPPPGGPPP|.PPPPPPPPPPPPPPP|PPYYPPPPPPPPPIIP|PPYYPPPPPPPPPIIP|PPPPPPPPPPPPPPPP|PPPPPPPP...PPPP.|.PPPPPP.....PP..|.PPPPPP....PP...|..PPPPPP..PP....|...PPPPPPPP.....|.....PPPP.......|................',
      '.............II.|............IIII|...........IIII.|..........IIII..|.........IIII...|........IIII....|.......MMII.....|......MMMM......|.....PPMM.......|....PPPP........|...PPPPP........|..PPPPP.........|.RPPPP..........|RRRPP...........|.RR.............|................',
      '................|IIIIIIIIIIIIIIII|I..............I|I.........YY...I|I.........YY...I|I....P.........I|I...PPP....P...I|I..PPPPP..PPP..I|I.PPPPPPPPPPPP.I|I.PPPPPPPPPPPP.I|I..............I|IIIIIIIIIIIIIIII|................|....R..R..R.....|................|................'],
    prontas: ['................|...PPPPPPPPPP...|.PPPPPPPPPPPPPP.|.P.PPPPPPPPPP.P.|.P.PPIPPPPPPP.P.|.PPPPIPPPPPPPPP.|...PPPPPPPPPP...|....PPPPPPPP....|.....PPPPPP.....|.......PP.......|.......PP.......|.....PPPPPP.....|....GGGGGGGG....|....GGGGGGGG....|................|................',
      '................|...II......II...|...III....III...|....III..III....|.....IIIIII.....|......PPPP......|....PPPPPPPP....|...PPPPPPPPPP...|...PPPPGGPPPP...|...PPPGGGGPPP...|...PPPGGGGPPP...|...PPPPGGPPPP...|...PPPPPPPPPP...|....PPPPPPPP....|......PPPP......|................',
      '................|.I..............|.IPP..PP..PP....|.IPP..PP..PP....|.I..PP..PP..PP..|.I..PP..PP..PP..|.IPP..PP..PP....|.IPP..PP..PP....|.I..PP..PP..PP..|.I..PP..PP..PP..|.I..............|.I..............|.I..............|.I..............|III.............|................',
      '................|.......PP.......|.......PP.......|......PPPP......|......PPPP......|PPPPPPPPPPPPPPPP|.PPPIPPPPPPPPPP.|..PPPPPPPPPPPP..|...PPPPPPPPPP...|...PPPPPPPPPP...|..PPPPPPPPPPPP..|..PPPPP..PPPPP..|.PPPP......PPPP.|.PP..........PP.|................|................',
      '................|................|................|................|.P.....PP.....P.|.PP...PPPP...PP.|.PPP.PPPPPP.PPP.|.PPPPPPPPPPPPPP.|.PPPPPPPPPPPPPP.|.PPGPPPGGPPPGPP.|.PPPPPPPPPPPPPP.|.IIIIIIIIIIIIII.|.IIIIIIIIIIIIII.|................|................|................',
      '................|.....PPPPPP.....|...PPPPPPPPPP...|..PPPPPPPPPPPP..|.PPPPPPPPPPIPPP.|.PPPPPPPPPIIPPP.|PPPPPPPPPIIPPPPP|PPPIPPPPIIPPPPPP|PPPIIPPIIPPPPPPP|PPPPIIIIPPPPPPPP|.PPPPIIPPPPPPPP.|.PPPPPPPPPPPPPP.|..PPPPPPPPPPPP..|...PPPPPPPPPP...|.....PPPPPP.....|................',
      '................|................|......IIII......|......IIII......|................|.....PPPPPP.....|.....PPIPPP.....|.....PPIPPP.....|PPPPPPPPPPP.....|PPPPPPPPPPP.....|PPPPPPPPPPPPPPPP|PPPPPPPPPPPPPPPP|PPPPPPPPPPPPPPPP|PPPPPPPPPPPPPPPP|................|................',
      '................|................|...PPPPPPPPPP...|..PPIPPPPPPPPP..|.PPIPPPPPPPPPPP.|IIIIIIIIIIIIIIII|.PPPPPPPPPPPPPP.|..PPPPPPPPPPPP..|...PPPPPPPPPP...|....PPPPPPPP....|.....PPPPPP.....|......PPPP......|.......PP.......|................|................|................'],
    mais: ['................|................|....MMMMMMMMMMMM|....M..........M|..IIIIIIIIIIII.M|..I..........I.M|PPPPPPPPPPPP.I.M|P..........P.I.M|P.RR.......P.IMM|P.RR.......P.I..|P..........PII..|P.PPPPPPP..P....|P..........P....|PPPPPPPPPPPP....|................|................'],
    vazio: ['................|.MM.MM.MM.MM.MM.|.M............M.|................|.M....PPPP....M.|.M...PP..PP...M.|.........PP.....|.M......PP....M.|.M.....PP.....M.|.......PP.......|.M............M.|.M.....PP.....M.|................|.M............M.|.MM.MM.MM.MM.MM.|................']
  };
  var TEMAS = [
    ['video', 'vídeo', 'video', 'video', /\bvideos?\b|teaser|trailer|showreel|\breels?\b|gravac|filme/],
    ['cassino', 'cassino', 'casino', 'casino', /cassino|casino|roleta|\bfichas?\b|apost/],
    ['jogo', 'jogo', 'game', 'juego', /\bjogos?\b|\bgames?\b|\bskins?\b|\bboss\b|\bchefe\b/],
    ['protecao', 'proteção', 'protection', 'protección', /prote[cg]|\bcopia|segur|\btrava|sigilo|blindag/],
    ['simulacao', 'simulação e teste', 'simulation and testing', 'simulación y prueba', /simula|backtest|placar|\bpapel\b|ensaio/],
    ['bot', 'robô de trade', 'trading bot', 'robot de trading', /\brobos?\b|\bbots?\b|\btrade|\bmotor\b|estrateg/],
    ['anuncio', 'anúncio e lançamento', 'announcement and launch', 'anuncio y lanzamiento', /anuncio|\bads?\b|lancamento|divulg|promo|campanha|marketing|\bposts?\b/],
    ['painel', 'painel', 'dashboard', 'panel', /painel|dashboard|\bkit\b|\bwen\b|cerebro/],
    ['arte', 'arte e visual', 'art and visuals', 'arte y visual', /\barte\b|ilustra|\bcores?\b|desenho|design|visual|animac|\btemas?\b/],
    ['texto', 'texto e tradução', 'text and translation', 'texto y traducción', /\btextos?\b|traduc|idioma|\bguias?\b|\bfaq\b|tutorial|\bdocs?\b|\bregras?\b|termos/],
    ['pesquisa', 'pesquisa', 'research', 'investigación', /pesquis|\bradar\b|\bcaca\b|\bbusca|\bachar\b|estudo|\bideias?\b|concorr|revis/],
    ['carteira', 'carteira e pagamento', 'wallet and payment', 'billetera y pago', /carteira|wallet|\bsaldo\b|\bloja\b|\bcaixa\b|pagament|\bprecos?\b|\bcusto|dinheiro|assinatura/],
    ['dado', 'dado e coleta', 'data and collection', 'datos y recolección', /\bdados?\b|coleta|\bbanco\b|indice|\bfeed\b|stream|\brpc\b|medic|\bmedir\b|analise|raio-x|monitor|transferenc/],
    ['tela', 'tela do site', 'site screen', 'pantalla del sitio', /\btelas?\b|terminal|\bsites?\b|pagina|\baba\b|botao|\btour\b|navega|\bhome\b|layout/],
    ['prontas', 'entregas prontas', 'finished deliveries', 'entregas listas', null],
    ['mais', 'mais entregas em obra', 'more deliveries in progress', 'más entregas en obra', null],
    ['vazio', 'sem entregas na lista', 'no deliveries on the list', 'sin entregas en la lista', null]
  ].map(function (t) { return { id: t[0], rotulo: { pt: t[1], en: t[2], es: t[3] }, rx: t[4], sprites: (SPR[t[0]] || []).map(function (g) { return g.split('|'); }) }; });
  var PROJ_TEMAS = {};
  var TIPO_TEMAS = { prontas: ['prontas'], mais: ['mais'], jogo: ['jogo'], sites: ['tela'], vazio: ['vazio'] };
  var ABSTRATO = { pt: 'abstrato, gerado do nome', en: 'abstract, generated from the name', es: 'abstracto, generado del nombre' };
  var TXT = {
    pt: { dica: 'Desenho desta frente: ', fim: '. Cada cartão tem o seu, tirado do nome e do projeto.', rot: 'Desenho' },
    en: { dica: 'Picture for this workstream: ', fim: '. Each card gets its own, drawn from the name and the project.', rot: 'Picture' },
    es: { dica: 'Dibujo de este frente: ', fim: '. Cada tarjeta tiene el suyo, sacado del nombre y del proyecto.', rot: 'Dibujo' }
  };
  function idioma(doc) { var l = String((doc && doc.documentElement && doc.documentElement.lang) || 'pt'); return /^en/.test(l) ? 'en' : /^es/.test(l) ? 'es' : 'pt'; }
  function dobra(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function hash(t, semente) { var h = (semente || 2166136261) >>> 0; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hex8(n) { return ('0000000' + (n >>> 0).toString(16)).slice(-8); }
  function sorte(semente) { var a = semente >>> 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function temaDe(id) { for (var i = 0; i < TEMAS.length; i++) if (TEMAS[i].id === id) return TEMAS[i]; return null; }
  function gradeAbstrata(h) {
    var r = sorte(h), cel, i, j, n, volta = 0;
    do {
      cel = []; n = 0;
      for (j = 0; j < 7; j++) { cel[j] = []; for (i = 0; i < 4; i++) { cel[j][i] = r() < 0.56 ? (r() < 0.24 ? 'I' : 'P') : '.'; if (cel[j][i] !== '.') n += i < 3 ? 2 : 1; } }
    } while ((n < 16 || n > 38) && ++volta < 12);
    cel[3][3] = 'R';
    var g = ['................'];
    for (j = 0; j < 7; j++) {
      var m = cel[j].concat([cel[j][2], cel[j][1], cel[j][0]]), l = '.';
      for (i = 0; i < 7; i++) l += m[i] + m[i];
      l += '.';
      g.push(l, l);
    }
    g.push('................');
    return g;
  }
  function candidatos(projId, tipo, nome) {
    var out = [], d = dobra(nome), i;
    function poe(id) { var t = temaDe(id); if (t && t.sprites.length && out.indexOf(id) < 0) out.push(id); }
    if (TIPO_TEMAS[tipo]) TIPO_TEMAS[tipo].forEach(poe);
    else for (i = 0; i < TEMAS.length; i++) if (TEMAS[i].rx && TEMAS[i].rx.test(d)) poe(TEMAS[i].id);
    (PROJ_TEMAS[projId] || []).forEach(poe);
    return out;
  }
  function escolherFotos(projetos) {
    var itens = [], saida = [], usados = {};
    (projetos || []).forEach(function (pr, pi) {
      saida[pi] = [];
      ((pr && pr.cartoes) || []).forEach(function (cd, ci) {
        var nome = cd && cd.soDono && cd.soDono.titulo ? cd.soDono.titulo : (cd && cd.titulo) || '';
        var tipo = (cd && cd.desenho && cd.desenho.tipo) || 'vazio';
        var quem = String((pr && pr.id) || '') + '|' + tipo + '|' + dobra(nome);
        itens.push({ pi: pi, ci: ci, proj: pr && pr.id, tipo: tipo, nome: nome, quem: quem, h: hash(quem) });
      });
    });
    itens.slice().sort(function (a, b) { return a.h - b.h || (a.quem < b.quem ? -1 : a.quem > b.quem ? 1 : 0) || a.pi - b.pi || a.ci - b.ci; }).forEach(function (it) {
      var cs = candidatos(it.proj, it.tipo, it.nome), f = null, i, k, t, n, v, h;
      for (i = 0; i < cs.length && !f; i++) {
        t = temaDe(cs[i]); n = t.sprites.length;
        for (k = 0; k < n && !f; k++) { v = (it.h + k) % n; if (!usados[t.id + '-' + (v + 1)]) f = { tema: t.id, variante: v + 1, chave: t.id + '-' + (v + 1), rotulo: t.rotulo, grade: t.sprites[v] }; }
      }
      for (h = it.h; !f; h = (h + 1) >>> 0) if (!usados['abs-' + hex8(h)]) f = { tema: 'abstrato', variante: 0, chave: 'abs-' + hex8(h), rotulo: ABSTRATO, grade: gradeAbstrata(h) };
      usados[f.chave] = true;
      saida[it.pi][it.ci] = f;
    });
    return saida;
  }
  function assinatura(d, L) { var t = JSON.stringify([L, d.visao || '', d.fora || 0, d.projetos || []]); return hex8(hash(t)) + hex8(hash(t, 40389)) + '.' + t.length; }
  function fotoSvg(doc, s, ft, L) {
    var g = sv(doc, 'g', { 'class': 'af-foto', 'data-tema': ft.tema, 'data-foto': ft.chave, 'shape-rendering': 'crispEdges' });
    var dica = sv(doc, 'title', {}), U = 7, X0 = 6, Y0 = 29, pts = '', cor = {}, i, j;
    dica.textContent = TXT[L].dica + ft.rotulo[L] + TXT[L].fim;
    g.append(dica);
    g.append(sv(doc, 'rect', { x: 5, y: 28, width: 114, height: 114, 'class': 'af-quadro' }));
    for (i = 0; i < 7; i++) for (j = 0; j < 7; j++) pts += 'M' + (13 + i * 16) + ' ' + (36 + j * 16) + 'h2v2h-2z';
    p(doc, g, pts, 'af-ponto');
    p(doc, g, 'M5 38V28H15M109 28H119V38M119 132V142H109M15 142H5V132', 'af-canto');
    ft.grade.forEach(function (l, lin) {
      var a = 0, b, ch;
      while (a < 16) {
        ch = l.charAt(a);
        if (ch === '.') { a++; continue; }
        b = a; while (b < 16 && l.charAt(b) === ch) b++;
        cor[ch] = (cor[ch] || '') + 'M' + (X0 + a * U) + ' ' + (Y0 + lin * U) + 'h' + ((b - a) * U) + 'v' + U + 'h-' + ((b - a) * U) + 'z';
        a = b;
      }
    });
    ['M', 'P', 'I', 'G', 'Y', 'R', 'r'].forEach(function (ch) { if (cor[ch]) p(doc, g, cor[ch], ch === 'r' ? 'af-R af-pisca' : 'af-' + ch); });
    s.append(g);
  }

  function desenho(doc, d, proj, foto) {
    var s = sv(doc, 'svg', { viewBox: '0 0 400 170', role: 'img' });
    var dz = d.desenho || { tipo: 'vazio' };
    var rotulo = d.titulo || '';
    var L = idioma(doc), ft = foto || escolherFotos([{ id: proj, cartoes: [d] }])[0][0];
    fotoSvg(doc, s, ft, L);
    var X = 130, W = 266;
    if (dz.tipo === 'passos') {
      var ps = dz.passos || [], n = ps.length, feitos = 0;
      for (var i = 0; i < n; i++) if (ps[i].f) feitos++;
      var pctTxt = dz.pct === null || dz.pct === undefined ? (dz.estado === 'pronta' ? '100%' : '') : dz.pct + '%';
      tx(doc, s, X, 52, 24, pctTxt, 't-acc t-forte');
      tx(doc, s, 396, 52, 18, ESTADO[dz.estado] || '', dz.estado === 'voce' ? 't-voce' : dz.estado === 'pronta' ? 't-ok' : 't-fraco', 'end');
      if (n > 0 && n <= 24) {
        var gap = 4, w = (W - gap * (n - 1)) / n;
        for (var j = 0; j < n; j++) r(doc, s, Math.round((X + j * (w + gap)) * 10) / 10, 70, Math.round(w * 10) / 10, 28, ps[j].f ? 's-ok' : ps[j].d ? 's-voce' : 's-falta', 4);
      } else if (n > 24) {
        r(doc, s, X, 70, W, 28, 's-falta', 4);
        if (feitos) r(doc, s, X, 70, Math.max(4, Math.round(W * feitos / n)), 28, 's-ok', 4);
      } else r(doc, s, X, 70, W, 28, 's-falta', 4);
      tx(doc, s, X, 128, 18, n ? feitos + ' de ' + plural(n, 'passo', 'passos') + (n === 1 ? ' feito' : ' feitos') : 'sem passos lidos', '');
      var pe = d.estado === 'pronta' ? 'tudo feito' : d.horasNaFrente > 0 ? 'falta cerca de ' + horas(d.horasNaFrente) + ' de obra' : 'sem estimativa de horas';
      tx(doc, s, X, 158, 16, pe, 't-fraco');
      rotulo += ': ' + (dz.pct === null || dz.pct === undefined ? '? de progresso' : dz.pct + '% feito') + ', ' + feitos + ' de ' + n + ' passos; ' + pe;
    } else if (dz.tipo === 'prontas') {
      var q = dz.quantas || 0, mostra = Math.min(q, 12);
      for (var k = 0; k < mostra; k++) {
        var col = k % 6, lin = Math.floor(k / 6), x0 = X + 6 + col * 44, y0 = 22 + lin * 46;
        r(doc, s, x0, y0, 36, 36, 's-ok', 6);
        p(doc, s, 'M' + (x0 + 9) + ' ' + (y0 + 19) + ' l6 6 l12 -13', 's-traco-fundo');
      }
      tx(doc, s, X, 150, 24, plural(q, 'pronta', 'prontas') + (q > 12 ? ' (12 no desenho)' : ''), 't-ok t-forte');
      rotulo += ': ' + plural(q, 'entrega pronta', 'entregas prontas');
    } else if (dz.tipo === 'mais') {
      var pc = (dz.pcts || []).slice(0, 5);
      for (var m = 0; m < pc.length; m++) {
        r(doc, s, X, 24 + m * 22, W, 14, 's-falta', 4);
        if (pc[m] > 0) r(doc, s, X, 24 + m * 22, Math.max(4, Math.round(W * pc[m] / 100)), 14, 's-acc', 4);
      }
      tx(doc, s, X, 158, 18, plural((dz.pcts || []).length, 'entrega', 'entregas') + ' a mais em obra', '');
      rotulo += ': ' + plural((dz.pcts || []).length, 'entrega', 'entregas') + ' a mais em obra';
    } else if (dz.tipo === 'jogo') {
      var bl = [[dz.prontas, 'prontas'], [dz.verificadas, 'verificadas'], [dz.escolhas, 'escolhas']];
      for (var b = 0; b < 3; b++) {
        var bx = X + b * 90;
        r(doc, s, bx, 30, 82, 76, b === 2 && dz.escolhas > 0 ? 's-voce' : 's-linha', 10);
        tx(doc, s, bx + 41, 78, 24, bl[b][0] === null || bl[b][0] === undefined ? '?' : bl[b][0], 't-forte', 'middle');
        tx(doc, s, bx + 41, 132, 16, bl[b][1], 't-fraco', 'middle');
      }
      tx(doc, s, X, 160, 16, dz.escolhas > 0 ? 'escolhas de regra esperam você' : 'sinais da pasta do jogo', dz.escolhas > 0 ? 't-voce' : 't-fraco');
      rotulo += ': ' + [bl[0][0], bl[1][0], bl[2][0]].map(function (v) { return v === null || v === undefined ? '?' : v; }).join(', ') + ' (prontas, verificadas, escolhas)';
    } else if (dz.tipo === 'sites') {
      tx(doc, s, X, 78, 24, ESTADO[dz.estado] || '?', dz.estado === 'parado' ? 't-voce t-forte' : 't-forte');
      tx(doc, s, X, 116, 18, dz.estado === 'parado' ? 'por decisão sua' : dz.estado === 'obra' ? 'na lista de frentes' : 'sem leitura', 't-fraco');
      rotulo += ': ' + (ESTADO[dz.estado] || '?');
    } else {
      tx(doc, s, X, 78, 24, '?', 't-forte');
      tx(doc, s, X, 116, 18, 'sem entregas na lista', 't-fraco');
      rotulo += ': sem entregas na lista';
    }
    s.setAttribute('aria-label', rotulo + '. ' + TXT[L].rot + ': ' + ft.rotulo[L]);
    return s;
  }

  function oculto(doc, cls, o, prefixo) {
    var q = el(doc, 'p', cls);
    q.append(el(doc, 'em', null, '* ' + plural(o.n, 'coisa', 'coisas') + ' fora daqui'));
    q.append(el(doc, 'span', 'previa', ': ' + (o.tipos || []).join(', ') + (prefixo || '') + '.'));
    return q;
  }
  function cartao(doc, d0, proj, foto) {
    var d = d0.soDono ? Object.assign({}, d0, d0.soDono) : d0;
    var card = el(doc, 'section', 'card' + (d.destaque ? ' destaque' : ''));
    card.append(el(doc, 'h3', null, d.titulo));
    var vis = el(doc, 'div', 'vis');
    vis.append(desenho(doc, d, proj, foto));
    card.append(vis);
    card.append(el(doc, 'p', 'longa', d.longa));
    card.append(el(doc, 'p', 'curta', semCarimbo(d.curta)));
    if (d.ocultos && d.ocultos.n > 0) card.append(oculto(doc, 'oculto', d.ocultos));
    return card;
  }
  function secao(doc, pr, fotos) {
    var sec = el(doc, 'section', 'secao');
    sec.setAttribute('data-proj', pr.id);
    sec.id = 'p-' + pr.id;
    var h2 = el(doc, 'h2', null, pr.titulo + ' ');
    h2.append(el(doc, 'small', null, pr.sub));
    sec.append(h2);
    if (pr.ocultosSecao && pr.ocultosSecao.n > 0) sec.append(oculto(doc, 'oculto-secao', pr.ocultosSecao));
    var grade = el(doc, 'div', 'grade');
    (pr.cartoes || []).forEach(function (cd, i) { grade.append(cartao(doc, cd, pr.id, fotos && fotos[i])); });
    sec.append(grade);
    var tr = el(doc, 'section', 'trilha');
    tr.append(el(doc, 'h3', null, 'O que falta até ' + pr.marco));
    var ol = el(doc, 'ol', 'passos');
    (pr.trilha || []).forEach(function (t) {
      var li = el(doc, 'li', TRILHA[t.estado] ? t.estado : 'falta');
      li.append(el(doc, 'span', 'st', TRILHA[t.estado] || 'falta'));
      li.append(el(doc, 'span', 't', t.soDono && t.soDono.texto ? t.soDono.texto : t.texto));
      ol.append(li);
    });
    var linha = sv(doc, 'svg', { viewBox: '0 0 800 80', role: 'img', 'aria-label': 'Linha do tempo: ' + (pr.trilha || []).map(function(t){return (t.soDono && t.soDono.texto || t.texto) + ', ' + (TRILHA[t.estado] || 'falta');}).join('; ') });
    p(doc, linha, 'M30 35 H770', 's-traco');
    (pr.trilha || []).forEach(function(t,i,ts){var x=ts.length>1?30+i*740/(ts.length-1):400;c(doc,linha,x,35,10,t.estado==='feito'?'s-ok':t.estado==='voce'?'s-voce':'s-acc');tx(doc,linha,x,68,14,i+1,null,'middle');});
    tr.append(linha);
    tr.append(ol);
    sec.append(tr);
    return sec;
  }

  function montar(doc, d) {
    var raiz = doc.getElementById('ma-raiz'), aviso = doc.getElementById('ma-aviso');
    if (!d || d.ok !== true) {
      if (aviso) aviso.textContent = (d && d.falta) || 'Sem leitura do estado agora: ?. O painel tenta de novo no próximo minuto.';
      return false;
    }
    var oldPhoto=doc.getElementById('ma-foto-pessoal');if(oldPhoto)oldPhoto.remove();if(typeof d.foto==='string'&&/^\/api\/meu-andamento\/foto\/[a-f0-9]{24}$/.test(d.foto)){var photo=doc.createElement('img');photo.id='ma-foto-pessoal';photo.src=d.foto;photo.alt='Foto pessoal configurada';photo.className='ma-foto-pessoal';doc.getElementById('g-andamento')?.prepend(photo);}var gallery=doc.getElementById('videos');if(gallery){gallery.replaceChildren();gallery.hidden=!(d.videos||[]).length;if(!gallery.hidden){gallery.append(el(doc,'h2',null,'Meus vídeos'));for(const v of d.videos){var card=el(doc,'article','ma-video');card.append(el(doc,'h3',null,v.titulo));if(v.src&&/^\/api\/player\/midia\/[a-f0-9]{24}$/.test(v.src)){var video=doc.createElement('video');video.src=v.src;video.controls=true;video.muted=true;video.preload='none';video.setAttribute('aria-label',v.titulo);card.append(video);}else card.append(el(doc,'p',null,'? Fonte local ausente. Configure seu arquivo de vídeo pelo prompt.'));gallery.append(card);}}}var q = doc.getElementById('ma-quando');
    if (q) { var qg = quandoGente(d.atualizado || d.atualizadoTexto); q.textContent = d.horas ? 'Entregas de ' + d.horas.entregas + ' · agora de ' + d.horas.agora : qg ? 'Atualizado ' + qg : d.atualizadoTexto && d.atualizadoTexto !== '?' ? 'Atualizado ' + d.atualizadoTexto : ''; }
    // sem proxima volta lida, a frase some (nada de "Próxima volta: ?")
    var pr = doc.getElementById('ma-proxima'), prx = d.proxima && d.proxima.texto && d.proxima.texto !== '?' ? d.proxima.texto : null; if (pr) { pr.textContent = prx ? 'Próxima volta da sua equipe: ' + prx : ''; pr.hidden = !prx; }
    var chips = doc.getElementById('ma-chips');
    if (chips) {
      chips.replaceChildren();
      if (d.chips && d.chips.length) {
        chips.append(el(doc, 'b', null, 'HOJE:'));
        d.chips.forEach(function (t) { chips.append(el(doc, 'span', 'chip' + (/sem atualizar/.test(t) ? ' alerta' : ''), t)); });
      }
    }
    if (aviso && d.visao === 'dono') {
      var tiposDono = d.ocultosTipos || [];
      aviso.replaceChildren();
      aviso.append(el(doc, 'b', null, 'Sigilo aberto só neste PC:'));
      if (!d.ocultosTotal) aviso.append(el(doc, 'span', null, ' nada ficou de fora desta leitura.'));
      else {
        aviso.append(el(doc, 'span', null, ' o texto real aparece nesta leitura. Ainda ' + (d.ocultosTotal === 1 ? 'fica ' : 'ficam ')));
        aviso.append(el(doc, 'b', null, plural(d.ocultosTotal, 'coisa', 'coisas')));
        aviso.append(el(doc, 'span', null, ' de fora' + (tiposDono.length ? ' (' + tiposDono.join(', ') + ')' : '') + ': cada cartão diz quantas e de que tipo.'));
      }
    } else if (aviso) {
      aviso.replaceChildren();
      aviso.append(el(doc, 'b', null, '* Sigilo:'));
      if (!(d.ocultosTotal > 0)) aviso.append(el(doc, 'span', null, ' nada ficou de fora desta página. Quando algo ficar, cada cartão diz quantas e de que tipo; os detalhes, só no chat da sessão.'));
      else {
      aviso.append(el(doc, 'span', null, ' ' + (d.ocultosTotal === 1 ? 'ficou ' : 'ficaram ')));
      aviso.append(el(doc, 'b', null, plural(d.ocultosTotal || 0, 'coisa', 'coisas')));
      var tipos = d.ocultosTipos || [];
      aviso.append(el(doc, 'span', null, ' de fora desta página' + (tipos.length ? ' (' + tipos.join(', ') + ')' : '') + '. Cada cartão diz quantas e de que tipo' + (d.ocultosFora > 0 ? '; ' + d.ocultosFora + ' ' + (d.ocultosFora === 1 ? 'está' : 'estão') + ' nas atualizações' : '') + '; os detalhes, só no chat da sessão.'));
      }
    }
    var L = idioma(doc), sig = assinatura(d, L), F = null;
    var fotos = function () { return F || (F = escolherFotos(d.projetos || [])); };
    var igual = !!(raiz && raiz.getAttribute('data-ma-sig') === sig && raiz.children && raiz.children.length);
    if (raiz && !igual) {
      raiz.replaceChildren();
      (d.projetos || []).forEach(function (p_, i) { raiz.append(secao(doc, p_, fotos()[i])); });
      raiz.setAttribute('data-ma-sig', sig);
      if (d.fora > 0) raiz.append(el(doc, 'p', 'fora', plural(d.fora, 'entrega da lista não é', 'entregas da lista não são') + ' destes projetos; ' + (d.fora === 1 ? 'está' : 'estão') + ' na aba Fila do painel.'));
    }
    var agora = doc.getElementById('ma-agora'), espera = doc.getElementById('ma-espera');
    if (agora && !igual) {
      agora.replaceChildren(el(doc,'h2',null,'Agora'));
      var linhasAgora=el(doc,'div','linhas');
      (d.projetos || []).forEach(function(pr){var a=el(doc,'a','lin');a.setAttribute('href','#p-'+pr.id);a.append(el(doc,'b',null,pr.titulo));var cd=(pr.cartoes || [])[0];if(cd){var dono=cd.soDono?Object.assign({},cd,cd.soDono):cd;a.append(el(doc,'span',null,semCarimbo(dono.curta)));}linhasAgora.append(a);});agora.append(linhasAgora);
    }
    if (espera && !igual) {
      espera.replaceChildren(el(doc,'h2',null,'O que espera você'));
      var itens=0;
      (d.projetos || []).forEach(function(pr){(pr.trilha || []).filter(function(t){return t.estado==='voce';}).forEach(function(t){var a=el(doc,'a','lin');a.setAttribute('href','#p-'+pr.id);a.append(el(doc,'b',null,pr.titulo),el(doc,'span',null,t.soDono && t.soDono.texto || t.texto));espera.append(a);itens++;});});
      if(!itens)espera.append(el(doc,'p',null,'Nada esperando você agora.'));
    }
    var di = doc.getElementById('ma-diario');
    if (di) {
      di.replaceChildren();
      var ents = d.diario || [];
      if (ents.length) {
        di.append(el(doc, 'h2', null, 'Atualizações'));
        ents.forEach(function (e) {
          var ent = el(doc, 'div', 'ent');
          ent.append(el(doc, 'time', null, e.quando));
          var ul = el(doc, 'ul');
          ((e.soDono && e.soDono.itens) || e.itens || []).forEach(function (i) { ul.append(el(doc, 'li', null, i)); });
          ent.append(ul);
          di.append(ent);
        });
        di.hidden = false;
      } else di.hidden = true;
    }
    var linhas = doc.getElementById('ma-trilhas');
    if (linhas && !igual) { linhas.replaceChildren(el(doc,'h2',null,'Trilha')); (d.projetos || []).forEach(function(pr,i){var tr=secao(doc,pr,fotos()[i]).querySelector('.trilha');tr.prepend(el(doc,'h3',null,pr.titulo));linhas.append(tr);}); }
    return true;
  }

  function mamifero(doc, b, opc) {
    var o = opc || {}, arm = o.armazem, alvo = o.alvo || doc.body;
    function ligado() { return String(alvo.className || '').split(/\s+/).indexOf('mam') >= 0; }
    function liga(on) {
      alvo.classList.toggle('mam', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Ver tudo' : 'Modo mamífero: só o resumo';
    }
    var ini = o.hash !== '#tudo';
    try { if (ini && o.hash !== '#mamifero' && arm && arm.getItem('ma-mam2') === '0') ini = false; } catch (e) { ini = ini === true; }
    liga(ini);
    b.addEventListener('click', function () {
      var on = !ligado();
      liga(on);
      try { if (arm) arm.setItem('ma-mam2', on ? '1' : '0'); } catch (e) { on = !!on; }
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { desenho: desenho, montar: montar, mamifero: mamifero, escolherFotos: escolherFotos, gradeAbstrata: gradeAbstrata, FOTOS: { TEMAS: TEMAS, PROJETOS: PROJ_TEMAS, TIPOS: TIPO_TEMAS } };
  if (root) root.MeuAndamentoPagina = { montar: montar, mamifero: mamifero, desenho: desenho, escolherFotos: escolherFotos, FOTOS: { TEMAS: TEMAS, PROJETOS: PROJ_TEMAS, TIPOS: TIPO_TEMAS } };

})(typeof window !== 'undefined' ? window : null);
