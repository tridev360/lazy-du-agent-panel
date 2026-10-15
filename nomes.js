/* nomes.js (F2): MAPA UNICO de nome de exibicao + "frase normal". Todo lugar do painel novo chama PainelNomes.
   Apresentação dos nomes: primeira letra maiuscula, resto minusculo; nunca o id cru (CORTES, local_..., pasta); acentos certos.
   Sessoes: Atendimento, Assistente, Loja, Cortes, Claude, Codex, Você.
   Codex de uma sessao = "<Sessão> · Codex N"; ajudante = "<Sessão> · ajudante N" (o ajudante de dados manda id cru + tipo). */
(function (root) {
  'use strict';
  const BASE = {
    voce: 'Você', 'coordenador-claude': 'Claude', 'coordenador-codex': 'Codex',
    atendimento: 'Atendimento', assistente: 'Assistente', loja: 'Loja', cortes: 'Cortes', codex: 'Codex', claude: 'Claude', vps: 'VPS'
  };
  // apelidos que chegam da fonte (caixa alta, sem acento, com prefixo) -> chave do mapa
  const APELIDO = [
    [/^(?:voce|você|you|tú|tu|dono)$/i, 'voce'],
    [/^(?:coordenador(?:[\s_-]*(?:do\s+)?claude)?|claude[\s_-]*coordenador|coordenacao)$/i, 'coordenador-claude'],
    [/^(?:coordenador[\s_-]*(?:do\s+)?codex|codex[\s_-]*coordenador)$/i, 'coordenador-codex'],
    [/^atendimento$/i, 'atendimento'], [/^assistente$/i, 'assistente'], [/^loja$/i, 'loja'], [/^cortes$/i, 'cortes'],
    [/^(?:codex|conversa do codex)$/i, 'codex']
  ];
  // siglas e nomes proprios que continuam como sao dentro de uma frase
  const PROPRIOS = ['Claude', 'Codex', 'Coordenador', 'Painel', 'Agente', 'VPS', 'WEN', 'CHECAGEM', 'UTC', 'API', 'Hospedagem', 'Discord', 'Telegram', 'ferramenta', 'ferramenta', 'mercado', 'SOL', 'ETH', 'BRL', 'USD', 'Obsidian'];
  const chave = s => { const v = String(s || '').trim().replace(/^casa:/i, ''); for (const [re, k] of APELIDO) if (re.test(v)) return k; return null; };
  // "CORTES - sessao 1" -> "Cortes"; "Idealistas estratégia (Codex)" -> "Idealistas estratégia"
  function base(raw) {
    const s = String(raw || '').trim(); if (!s) return null;
    const k = chave(s); if (k) return BASE[k];
    const sem = s.replace(/\s*\((?:codex|claude)\)\s*$/i, '').replace(/\s*[-·:]\s*sess[aã]o\s*\d+\s*$/i, '').trim();
    const k2 = chave(sem); if (k2) return BASE[k2];
    return frase(sem.replace(/[_]+/g, ' '));
  }
  // frase normal: tudo em caixa alta vira minusculo; a 1a letra sobe; nomes proprios e siglas voltam como sao
  function frase(s) {
    let v = String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim(); if (!v) return v;
    const letras = v.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letras.length > 1 && letras === letras.toUpperCase()) v = v.toLowerCase();
    else v = v.replace(/\b([A-ZÀ-Þ]{2,})\b/g, w => PROPRIOS.some(p => p.toUpperCase() === w) ? w : w.toLowerCase());
    for (const p of PROPRIOS) v = v.replace(new RegExp('(^|[^A-Za-zÀ-ÿ])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-zÀ-ÿ])', 'gi'), (m, a) => a + p);
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
  // nome de uma caixa do Fluxo/Arvore: { id, plain, title, side, tipo: 'sessao'|'codex'|'ajudante'|'coord', dono, n }
  function nome(x) {
    if (!x) return '?';
    if (typeof x === 'string') return base(x) || '?';
    const dono = x.dono ? base(x.dono) : null;
    if (x.tipo === 'codex' && dono) return dono + ' · Codex' + (Number.isInteger(x.n) ? ' ' + x.n : '');
    if (x.tipo === 'ajudante' && dono) return dono + ' · ajudante' + (Number.isInteger(x.n) ? ' ' + x.n : '');
    const k = chave(x.id) || chave(x.plain) || chave(x.title);
    if (k) return BASE[k];
    if (x.side === 'codex' && x.stage === 'coord') return BASE['coordenador-codex'];
    return base(x.plain || x.title || x.id) || '?';
  }
  // lado de quem fala (para a cor): voce | claude | codex
  function lado(x) { const k = chave(typeof x === 'string' ? x : x && (x.id || x.plain || x.title)); if (k === 'voce') return 'voce'; if (k === 'coordenador-codex' || k === 'codex') return 'codex'; if (k) return 'claude'; return x && x.side === 'codex' ? 'codex' : x && x.side === 'claude' ? 'claude' : x && x.id === 'voce' ? 'voce' : ''; }

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  // so palavras sem ambiguidade (texto que chegou sem acento); "esta", "e", "so", "publica" ficam como vieram
  const ACENTO = {
    voce: 'você', voces: 'vocês', nao: 'não', sao: 'são', estao: 'estão', entao: 'então', tambem: 'também', porem: 'porém', alem: 'além', ate: 'até', ja: 'já', mes: 'mês',
    ninguem: 'ninguém', alguem: 'alguém', atraves: 'através', unico: 'único', unica: 'única', ultimo: 'último', ultima: 'última', ultimos: 'últimos', ultimas: 'últimas', proximo: 'próximo', proxima: 'próxima', proximos: 'próximos',
    sessao: 'sessão', sessoes: 'sessões', licao: 'lição', licoes: 'lições', decisao: 'decisão', decisoes: 'decisões', revisao: 'revisão', revisoes: 'revisões', versao: 'versão', versoes: 'versões', juncao: 'junção',
    acao: 'ação', acoes: 'ações', funcao: 'função', producao: 'produção', execucao: 'execução', informacao: 'informação', situacao: 'situação', operacao: 'operação', organizacao: 'organização', aprovacao: 'aprovação',
    pre: 'pré', previa: 'prévia', previas: 'prévias', previsao: 'previsão', transicao: 'transição', conexao: 'conexão', contencao: 'contenção', atencao: 'atenção', condicao: 'condição', posicao: 'posição', aceleracoes: 'acelerações', aceleracao: 'aceleração',
    lancamento: 'lançamento', lancamentos: 'lançamentos', financas: 'finanças', seguranca: 'segurança', comeco: 'começo', forca: 'força', preco: 'preço', servico: 'serviço', espaco: 'espaço',
    publico: 'público', codigo: 'código', numero: 'número', numeros: 'números', historico: 'histórico', historia: 'história', cerebro: 'cérebro', habitos: 'hábitos', habito: 'hábito',
    memoria: 'memória', memorias: 'memórias', metodo: 'método', regua: 'régua', inicio: 'início', credito: 'crédito', creditos: 'créditos', diario: 'diário', saida: 'saída', sequencia: 'sequência', referencia: 'referência',
    experiencia: 'experiência', conferencia: 'conferência', responsavel: 'responsável', possivel: 'possível', disponivel: 'disponível', indisponivel: 'indisponível', nivel: 'nível', facil: 'fácil', dificil: 'difícil', util: 'útil',
    video: 'vídeo', videos: 'vídeos', audio: 'áudio', pagina: 'página', paginas: 'páginas', tecnico: 'técnico', grafico: 'gráfico', estagio: 'estágio', estagios: 'estágios', agua: 'água', otimo: 'ótimo', rapido: 'rápido', analise: 'análise',
    automatico: 'automático', automatica: 'automática', critico: 'crítico', criterio: 'critério', criterios: 'critérios', diagnostico: 'diagnóstico', pendencia: 'pendência', pendencias: 'pendências', urgencia: 'urgência', concorrencia: 'concorrência',
    tematico: 'temático', estrategia: 'estratégia', conselheiros: 'conselheiros', idealistas: 'idealistas', manha: 'manhã', amanha: 'amanhã', semana: 'semana', relatorio: 'relatório', portao: 'portão', portoes: 'portões', botao: 'botão', botoes: 'botões', opcao: 'opção', opcoes: 'opções', razao: 'razão', missao: 'missão', missoes: 'missões', regiao: 'região', solucao: 'solução', solucoes: 'soluções', portao: 'portão', portoes: 'portões', botao: 'botão', botoes: 'botões', opcao: 'opção', opcoes: 'opções', razao: 'razão', missao: 'missão', missoes: 'missões', regiao: 'região', relatorios: 'relatórios', concluida: 'concluída', concluido: 'concluído', concluidas: 'concluídas', concluidos: 'concluídos', usuario: 'usuário', horario: 'horário', horarios: 'horários'
  };
  function acentos(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[A-Za-z]+/g, w => { const a = ACENTO[w.toLowerCase()]; if (!a || a === w.toLowerCase()) return w; return w === w.toUpperCase() && w.length > 1 ? a.toUpperCase() : w.charAt(0) === w.charAt(0).toUpperCase() ? a.charAt(0).toUpperCase() + a.slice(1) : a; });
  }
  function datas(s) {
    return String(s || '').replace(/\b(\d{2})\/(\d{2})\b(?:\s+(\d{2}):(\d{2}|\dx))?/g, (m, d, mo, hh, mm) => { const di = +d, mi = +mo; if (di < 1 || di > 31 || mi < 1 || mi > 12) return m; return di + ' de ' + MESES[mi - 1] + (hh ? ', ' + hh + ':' + mm : ''); });
  }
  const PERIODO = { manha: 'da manhã', tarde: 'da tarde', noite: 'da noite', madrugada: 'da madrugada' };
  const DE_QUEM = { loja: 'do Loja', atendimento: 'da Atendimento', assistente: 'do Assistente', cortes: 'do Cortes', coordenacao: 'do Coordenador', coordenador: 'do Coordenador', codex: 'do Codex' };
  // "licoes-02-10-noite" -> "Lições da noite de 2 de outubro"; "loja-licoes-27-09" -> "Lições do Loja de 27 de setembro";
  // "aceleracoes-02-10" -> "Acelerações de 2 de outubro"; "agir-no-sinal-sem-esperar-status" -> "Agir no sinal sem esperar status"
  function titulo(raw) {
    let s = String(raw || '').trim().replace(/^casa:/i, '').replace(/\.md$/i, ''); if (!s) return '?';
    const partes = s.split(/[-_\s]+/).filter(Boolean); let dia = null, mes = null, periodo = null; const resto = [];
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i].toLowerCase(), q = partes[i + 1];
      if (dia === null && /^\d{2}$/.test(p) && q && /^\d{2}$/.test(q) && +p >= 1 && +p <= 31 && +q >= 1 && +q <= 12) { dia = +p; mes = +q; i++; continue; }
      if (PERIODO[p] && !periodo) { periodo = PERIODO[p]; continue; }
      resto.push(partes[i]);
    }
    const quando = dia !== null ? 'de ' + dia + ' de ' + MESES[mes - 1] : '';
    const iLicao = resto.findIndex(w => /^li[cç][oõ]es$/i.test(w));
    if (iLicao >= 0) {
      const quem = resto.filter((_, i) => i !== iLicao).map(w => DE_QUEM[w.toLowerCase()] || null).filter(Boolean)[0] || '';
      const outros = resto.filter((w, i) => i !== iLicao && !DE_QUEM[w.toLowerCase()]);
      return ['Lições', quem, outros.length ? acentos(outros.join(' ').toLowerCase()) : '', periodo || '', quando].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    }
    const corpo = acentos(resto.join(' ')), base = frase(corpo || s);
    return [base, periodo, quando].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  function resumo(desc, opts = {}) {
    let s = String(desc || '').replace(/\\"/g, '"').replace(/\s+/g, ' ').trim(); if (!s) return '';
    s = s.replace(/^(?:ordem|erro|decis[aã]o|confirmado|regra|li[cç][oõ]es?(?:\s+(?:pagas?|de))?)\b(?:\s+(?:em\s+)?\d{2}\/\d{2})?(?:\s+\d{2}:\d{1,2}x?)?(?:\s+(?:manh[aã]|tarde|noite|madrugada))?(?:\s*\([^)]*\))?[^:()]{0,40}:\s*/i, '');
    s = s.replace(/\s*\(([^()]*)\)/g, (m, inner) => /\bconta\s+[A-Z0-9]\b/i.test(inner) ? (inner.replace(/,?\s*\bconta\s+[A-D]\b/ig, '').trim() ? ' (' + inner.replace(/,?\s*\bconta\s+[A-D]\b/ig, '').trim() + ')' : '') : m);
    s = s.replace(/^\d{2}\/\d{2}(?:\s+\d{2}:\d{1,2}x?)?\s*[:,-]?\s*/, '');
    s = acentos(datas(s));
    s = s.replace(/\bCOORDENADOR\b/g, 'Coordenador').replace(/\b(ATENDIMENTO|LOJA|CORTES|ASSISTENTE)\b/g, w => base(w)).replace(/\b([nNdD])a (Loja|Assistente|Cortes)\b/g, (m, p, w) => p + 'o ' + w);
    const max = opts.max || 0;
    if (opts.cortada || (max && s.length > max)) {
      const lim = max ? s.slice(0, max) : s; const corte = Math.max(lim.lastIndexOf(', '), lim.lastIndexOf('; '), lim.lastIndexOf('. '));
      s = corte > 40 ? lim.slice(0, corte) : lim.replace(/\s+\S*$/, '');
      if (s.lastIndexOf('(') > s.lastIndexOf(')')) s = s.slice(0, s.lastIndexOf('(')).trim();
    }
    s = s.replace(/[\s,;:…-]+$/, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.') : '';
  }
  root.PainelNomes = Object.freeze({ nome, frase, lado, BASE, acentos, datas, titulo, resumo, chave });
})(window);
