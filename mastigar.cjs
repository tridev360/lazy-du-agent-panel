'use strict';
// Cada item = titulo de gente com acento + data "8 de outubro, 22:55" (BRT) + idade "há 3 h"; o cru (ISO, id, caminho,
// segundos, arquivo) vai so no campo "fonte". Sem modelo de IA: so regra e dicionario. O filtro de sigilo e o unico da casa
// (privado do codex-sessoes: local + SIGILO do pe-cauda + PRIVADO do claude-atividade + pessoas); sem ele, tudo fecha.
const H = 3600000;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
let CS = null; try { CS = require('./codex-sessoes.cjs'); } catch { CS = null; }
function privado(text) { if (!CS || typeof CS.privado !== 'function') return true; try { return CS.privado(text); } catch { return true; } }

// aceita ISO, Date, epoch em ms ou em segundos
function ms(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? (value < 1e12 ? value * 1000 : value) : NaN;
  if (typeof value === 'string' && value.trim()) return Date.parse(value);
  return NaN;
}
const two = n => String(n).padStart(2, '0');
const brt = at => new Date(at - 3 * H);
// "8 de outubro, 22:55" (BRT). Sem hora valida: null (a tela mostra "?" com o motivo, nunca "null").
function dataTexto(value) { const at = ms(value); if (!Number.isFinite(at)) return null; const d = brt(at); return d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()] + ', ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()); }
// "8 de outubro" (so o dia)
function diaTexto(value) { const at = ms(value); if (!Number.isFinite(at)) return null; const d = brt(at); return d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]; }
// "22:55" se for hoje, senao "8 de outubro, 22:55"
function horaTexto(value, now = Date.now()) { const at = ms(value); if (!Number.isFinite(at)) return null; const d = brt(at), n = brt(ms(now)); return d.toISOString().slice(0, 10) === n.toISOString().slice(0, 10) ? two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) : dataTexto(at); }
// minutos -> "agora", "há 5 min", "há 3 h", "há 2 dias" (nunca segundos nem minutos crus acima de 1 h)
function idadeTexto(minutos) {
  if (typeof minutos !== 'number' || !Number.isFinite(minutos) || minutos < 0) return null;
  const m = Math.floor(minutos);
  if (m < 1) return 'agora';
  if (m < 60) return 'há ' + m + ' min';
  if (m < 48 * 60) return 'há ' + Math.floor(m / 60) + ' h';
  return 'há ' + Math.floor(m / 1440) + ' dias';
}
function idadeDe(value, now = Date.now()) { const at = ms(value), n = ms(now); return Number.isFinite(at) && Number.isFinite(n) && at <= n + 120000 ? Math.max(0, Math.floor((n - at) / 60000)) : null; }
// "lido 22:55 (há 3 h)" / "lido 8 de outubro, 20:02 (há 2 dias)"
function lidoTexto(value, now = Date.now()) { const h = horaTexto(value, now); if (!h) return null; const i = idadeTexto(idadeDe(value, now)); return 'lido ' + h + (i && i !== 'agora' ? ' (' + i + ')' : ''); }

const NOMES = { atendimento: 'Atendimento', loja: 'Loja', assistente: 'Assistente', cortes: 'Cortes', coordenador: 'Claude', coordenacao: 'Claude', 'coordenador claude': 'Claude', 'Claude': 'Claude', 'coordenador-codex': 'Codex', 'coordenador codex': 'Codex', 'coordenador do codex': 'Codex', codex: 'Codex', claude: 'Claude', ele: 'Você', voce: 'Você', dono: 'Você', 'os dois': 'Claude e Codex' };
const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function nomeSessao(raw) {
  const k = fold(raw).replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
  if (!k) return null;
  if (NOMES[k]) return NOMES[k];
  const head = /^(atendimento|loja|assistente|cortes|coordenador|coordenacao|codex|claude)\b/.exec(k);
  if (head) { const resto = k.slice(head[1].length).replace(/^[\s:(·-]+|\)$/g, '').trim(); const base = NOMES[head[1]]; return resto && /^(?:do |da )?(?:claude|codex)$/.test(resto) && base !== 'Codex' && base !== 'Claude' ? base.replace(/ do Claude$/, '') + ' · ' + (/codex/.test(resto) ? 'Codex' : 'Claude') : base; }
  return null;
}

// Acentos por dicionario (so palavra inteira; mantem a caixa da 1a letra). Palavra ambigua (esta, e, so em ingles) fica de fora.
const ACENTOS = { voce: 'você', voces: 'vocês', nao: 'não', sao: 'são', direcao: 'direção', proximo: 'próximo', proximos: 'próximos', proxima: 'próxima', proximas: 'próximas', ja: 'já', ate: 'até', tambem: 'também', decisao: 'decisão', decisoes: 'decisões', revisao: 'revisão', revisoes: 'revisões', sessao: 'sessão', sessoes: 'sessões', codigo: 'código', numero: 'número', numeros: 'números', unica: 'única', unico: 'único', disponivel: 'disponível', ficticios: 'fictícios', pendencia: 'pendência', pendencias: 'pendências', seguranca: 'segurança', decoracao: 'decoração', responsavel: 'responsável', lancamento: 'lançamento', lancamentos: 'lançamentos', previsao: 'previsão', execucao: 'execução', opcao: 'opção', opcoes: 'opções', tres: 'três', medicao: 'medição', missao: 'missão', entao: 'então', sera: 'será', area: 'área', pagina: 'página', paginas: 'páginas', informacao: 'informação', atencao: 'atenção', publico: 'público', publica: 'pública', nucleo: 'núcleo', video: 'vídeo', videos: 'vídeos', historico: 'histórico', analise: 'análise', critico: 'crítico', minimo: 'mínimo', maximo: 'máximo', rapido: 'rápido', facil: 'fácil', possivel: 'possível', apos: 'após', porem: 'porém', alem: 'além', ultimo: 'último', ultima: 'última', ultimos: 'últimos', ultimas: 'últimas', periodo: 'período', saida: 'saída', inicio: 'início', comeco: 'começo', preco: 'preço', precos: 'preços', servico: 'serviço', credito: 'crédito', grafico: 'gráfico', botao: 'botão', botoes: 'botões', padrao: 'padrão', versao: 'versão', funcao: 'função', acao: 'ação', acoes: 'ações', atualizacao: 'atualização', migracao: 'migração', correcao: 'correção', situacao: 'situação', juncao: 'junção', colecao: 'coleção', juridico: 'jurídico', conexao: 'conexão', configuracao: 'configuração', notificacao: 'notificação', conclusao: 'conclusão', solucao: 'solução', protecao: 'proteção', reuniao: 'reunião', semana: 'semana', mes: 'mês', automatico: 'automático', automatica: 'automática', diario: 'diário', diaria: 'diária', usuario: 'usuário', usuarios: 'usuários', relatorio: 'relatório', parametro: 'parâmetro', metodo: 'método', tecnico: 'técnico', estrategia: 'estratégia', experiencia: 'experiência', referencia: 'referência', sequencia: 'sequência', frequencia: 'frequência', agencia: 'agência', vitoria: 'vitória', memoria: 'memória', memorias: 'memórias', licoes: 'lições', licao: 'lição', regua: 'régua', tarefa: 'tarefa', concluido: 'concluído', concluida: 'concluída', concluidos: 'concluídos', concluidas: 'concluídas', invalido: 'inválido', valido: 'válido', basico: 'básico', basica: 'básica', obrigatorio: 'obrigatório', provisorio: 'provisório', unicos: 'únicos', unicas: 'únicas', cronometro: 'cronômetro', cerebro: 'cérebro', habitos: 'hábitos', historia: 'história', financas: 'finanças', infinito: 'infinito', premio: 'prêmio', premios: 'prêmios', voo: 'voo', ideia: 'ideia', aprovacao: 'aprovação', liberacao: 'liberação', medicoes: 'medições', paralelo: 'paralelo', amanha: 'amanhã', manha: 'manhã', ninguem: 'ninguém', alguem: 'alguém', tambem_: 'também' };
function acentos(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\b[A-Za-z]{2,}\b/g, w => { const k = w.toLowerCase(), r = ACENTOS[k]; if (!r || r === k) return w; if (w === w.toUpperCase() && w.length > 1) return r.toUpperCase(); return w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r; })
    .replace(/\bha (\d)/g, 'há $1').replace(/\bHa (\d)/g, 'Há $1');
}

// Tira o cru do texto que a tela mostra: ISO vira data de gente, caminho/URL/hash/id/segundos/null saem.
const ISO_RX = /\b20\d\d-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)?/g;
function semCru(text) {
  if (typeof text !== 'string') return null;
  let v = text.replace(/[\u0000-\u001f]/g, ' ').replace(/[\u2013\u2014]/g, ', ');
  v = v.replace(ISO_RX, m => dataTexto(m) || '');
  v = v.replace(/https?:\/\/\S+/gi, '')
    .replace(/\b[a-z]:[\\/][^\s'")]*/gi, '')
    .replace(/(?:^|[\s(])(?:\.{0,2}\/)?(?:Downloads|estado|tasks|casa|src|public|wt|scratchpad|historico|revisoes)[\\/][^\s;,)]*/gi, ' ')
    .replace(/\b[\w.-]+\.(?:json|jsonl|md|cjs|mjs|js|ts|css|html|txt|log|ps1|bat)\b/gi, '')
    .replace(/\[[A-Z0-9][A-Z0-9_-]{5,}\]/g, '')
    .replace(/\bI-20\d{6}-\d{4}-[A-Z0-9]+\b/g, '')
    .replace(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d{9,13}\b/gi, m => (CS && CS.nomeLegivel ? CS.nomeLegivel(m) : null) || '')
    .replace(/\b20\d\d-\d\d-\d\d-[a-z0-9-]+\b/gi, m => (CS && CS.nomeLegivel ? CS.nomeLegivel(m) : null) || '')
    .replace(/\b(?=[a-f\d]*\d)(?=[a-f\d]*[a-f])[a-f\d]{7,64}\b/gi, '')
    .replace(/0x[a-f\d]{6,}/gi, '')
    .replace(/\bidade:?\s*(\d+)\s*s\b/gi, (m, s) => idadeTexto(Number(s) / 60) || '')
    .replace(/\b(\d{4,})\s*min\b/g, (m, n) => idadeTexto(Number(n)) || m)
    .replace(/\b(?:null|undefined|NaN)+\b/g, '')
    .replace(/[`*_>#]/g, '')
    .replace(/\(\s*\)/g, '').replace(/\s+([,.;:)])/g, '$1').replace(/([,;:])\1+/g, '$1').replace(/\s+/g, ' ').replace(/^[\s,;:·.-]+|[\s,;:·-]+$/g, '').trim();
  return v || null;
}
// Troca ATENDIMENTO, ASSISTENTE, COORDENADOR Claude... pelo nome padrao dentro de uma frase
function nomesNaFrase(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\bCOORDENADOR[\s-]+(?:do\s+)?CLAUDE\b/gi, 'Claude').replace(/\bCOORDENADOR[\s-]+(?:do\s+)?CODEX\b/gi, 'Codex').replace(/\bCOORDENACAO\b/g, 'Claude')
    .replace(/\bCOORDENADOR\b/g, 'Coordenador').replace(/\bATENDIMENTO\b/g, 'Atendimento').replace(/\bASSISTENTE\b/g, 'Assistente').replace(/\bLOJA\b/g, 'Loja').replace(/\bCORTES\b/g, 'Cortes');
}
// Frase de gente para a tela: sigilo fecha (null), cru sai, nomes e acentos entram, corte so no fim de palavra.
function frase(text, max = 160) {
  if (typeof text !== 'string' || !text.trim()) return null;
  if (privado(text)) return null;
  let v = semCru(text); if (!v) return null;
  v = acentos(nomesNaFrase(v));
  if (privado(v)) return null;
  if (v.length > max) v = v.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return v;
}
function titulo(text, max = 90) {
  if (typeof text !== 'string' || !text.trim()) return null;
  let v = text.trim();
  if (/^[\w-]+$/.test(v) && /-/.test(v)) v = (CS && CS.nomeLegivel ? CS.nomeLegivel(v) : null) || v.replace(/^20\d\d-\d\d-\d\d-/, '').replace(/[-_]+/g, ' ');
  v = frase(v, max);
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : null;
}
// Um campo de hora pronto: {em (ISO, cru), dataTexto, idadeTexto}
function quando(value, now = Date.now()) { const at = ms(value); if (!Number.isFinite(at)) return { em: null, dataTexto: null, idadeTexto: null }; return { em: new Date(at).toISOString(), dataTexto: dataTexto(at), idadeTexto: idadeTexto(idadeDe(at, now)) }; }
// Confere um objeto de tela: nenhum campo (fora de "fonte", "em", "*Em", "id", "chave") com ISO, null escrito, caminho, hash ou segundos crus.
const CRU_RX = /\b20\d\d-\d\d-\d\dT\d\d:\d\d|\b(?:null|undefined|NaN)+\b|(?:^|[\s(])(?:estado|tasks|casa|Downloads|wt)[\\/]|[a-z]:[\\/]|\b\d{3,}\s*s\b(?!\w)|\b(?=[a-f\d]*\d)(?=[a-f\d]*[a-f])[a-f\d]{12,}\b|[\u2013\u2014]/i;
const LIVRE = new Set(['fonte', 'em', 'id', 'chave', 'arquivo', 'versao']);
function camposCrus(obj, caminho = '', out = []) {
  if (obj === null || obj === undefined) return out;
  if (typeof obj === 'string') { if (CRU_RX.test(obj)) out.push(caminho + ': ' + obj.slice(0, 80)); return out; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => camposCrus(v, caminho + '[' + i + ']', out)); return out; }
  if (typeof obj === 'object') for (const [k, v] of Object.entries(obj)) { if (LIVRE.has(k) || /Em$/.test(k)) continue; camposCrus(v, caminho ? caminho + '.' + k : k, out); }
  return out;
}
module.exports = { MESES, ms, dataTexto, diaTexto, horaTexto, idadeTexto, idadeDe, lidoTexto, nomeSessao, acentos, semCru, nomesNaFrase, frase, titulo, quando, camposCrus, privado, fold };
