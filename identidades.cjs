'use strict';
const roles = require('./papeis.json').roles;
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_/:-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const patterns = Object.entries(roles).filter(([, value]) => value.match).map(([id, value]) => [id, new RegExp(value.match, 'i')]);
function taskRoleKeyOf(source){
 const text=normalized(source).replace(/^[#>* ]+/,'');
 if(!/^(?:voce e|you are|atue|act as|sua tarefa|sua missao|your task|task|missao|rodada|codex|agente |revisor|revisao|revise|review|teste|test |qa |auditoria|arquiteto|architect|dev |artista|artist|animador|animator|economista|economist|maestro|engenheiro|engineer|dados |data |sons |texto |atualiz|update |implemente|implement |conserte|fix |corrija|desenvolva|integre|anime|animate |confira|check |verifique|verify |construa|build |crie|create )/.test(text))return null;
 if(/^(?:voce e (?:o |um )?|you are (?:a |the )?)?(?:revisor|revisao visual|revise|reviewer|review)\b/.test(text))return /\b(?:texto|copy|traducao|translation)\b/.test(text.split(/[.;]/)[0])?'text-reviewer':'reviewer';
 return roleKeyOf(source);
}
function roleKeyOf(source) { const text = normalized(source);if(/^(?:voce e (?:o )?)?codex (?:dev|app)\b/.test(text))return 'dev';if(/\b(?:codex arte|agente artista)\b/.test(text))return 'artist';if(/\b(?:animador|codex animacao)\b/.test(text))return 'combat-animator';if(/\b(?:codex painel|dev do painel|painel nomes|painel local)\b/.test(text))return 'panel-dev';return patterns.find(([, pattern]) => pattern.test(text))?.[0] || null; }
const FIXED_TITLES = {
  'coordenacao e entregas': { pt: 'COORDENAÇÃO E ENTREGAS', en: 'COORDINATION AND DELIVERIES', es: 'COORDINACIÓN Y ENTREGAS' },
  'painel nomes e estimativas': { pt: 'PAINEL: NOMES E ESTIMATIVAS', en: 'PANEL: NAMES AND ESTIMATES', es: 'PANEL: NOMBRES Y ESTIMACIONES' },
  'auditoria do painel': { pt: 'AUDITORIA DO PAINEL', en: 'PAINEL AUDIT', es: 'AUDITORÍA DE PAINEL' }
};
const GROUP_ROLES = {
  'panel-dev': {pt:'PAINEL: EQUIPES E ENTREGAS',en:'PANEL: TEAMS AND DELIVERIES',es:'PANEL: EQUIPOS Y ENTREGAS'},
  'combat-animator': {pt:'ANIMAÇÃO',en:'ANIMATION',es:'ANIMACIÓN'},
  maestro: { pt: 'COORDENAÇÃO E ENTREGAS', en: 'COORDINATION AND DELIVERIES', es: 'COORDINACIÓN Y ENTREGAS' },
  artist: { pt: 'ARTE E PERSONAGENS', en: 'ART AND CHARACTERS', es: 'ARTE Y PERSONAJES' },
  dj: { pt: 'SONS', en: 'SOUNDS', es: 'SONIDOS' },
  economist: { pt: 'ECONOMIA', en: 'ECONOMY', es: 'ECONOMÍA' },
  reviewer: { pt: 'REVISÃO DE QUALIDADE', en: 'QUALITY REVIEW', es: 'REVISIÓN DE CALIDAD' },
  'text-reviewer': { pt: 'REVISÃO DE TEXTO', en: 'TEXT REVIEW', es: 'REVISIÓN DE TEXTO' },
  animator: { pt: 'MAPA E ANIMAÇÃO', en: 'MAP AND ANIMATION', es: 'MAPA Y ANIMACIÓN' },
  'data-engineer': { pt: 'DADOS AO VIVO', en: 'LIVE PANEL DATA', es: 'DATOS EN VIVO' },
  qa: { pt: 'TESTES DA ENTREGA', en: 'DELIVERY TESTS', es: 'PRUEBAS DE ENTREGA' }
};
function projectKey(value) {
  const text = normalized(value);
  if (/^colecao(?: \(|$)/.test(text)) return 'colecao';
  if (/^(?:painel|app)$/.test(text)) return 'app';
  if (/^(?:painel aberto|agent panel|public panel)$/.test(text)) return 'public-panel';
  if (/^(?:painel|panel)$/.test(text)) return 'panel';
  return null;
}
function titleConfigOf(root, team) {
  let raw; try { raw = JSON.parse(require('./leitor.cjs').readSafe(root, 'estado/titulos.json', 32000)); } catch { return new Map(); }
  if (raw?.versao !== 1 || !raw.por_conversa || typeof raw.por_conversa !== 'object' || Array.isArray(raw.por_conversa) || Object.keys(raw.por_conversa).length > 100) return new Map();
  const result = new Map();
  for (const [id, item] of Object.entries(raw.por_conversa)) {
    if (!UUID.test(id) || !item || typeof item.titulo !== 'string' || typeof item.titulo_en !== 'string') continue;
    const unsafe = value => value.length > 120 || /[^A-ZÀ-Ý0-9 :,]/u.test(value) || /\b(?:V\d+|PRIVADO|SEGREDOS|PRIVATE|SEED|OWNER|WALLET)\b/i.test(value);
    if (unsafe(item.titulo) || unsafe(item.titulo_en)) continue;
    const known = FIXED_TITLES[normalized(item.titulo)] || { pt: item.titulo, en: item.titulo_en, es: item.titulo_es || item.titulo_en };
    const entries = team.agents.filter(agent => agent.conversationId?.replace(/^(?:codex|claude):/, '') === id);
    const expected = projectKey(item.projeto);
    if (!expected || !entries.length) continue;
    result.set(id, { labels: { ...known }, source: 'estado/titulos.json', project: expected });
  }
  return result;
}
function sessionLabels(agent) {
  const stamp = Date.parse(agent?.startedAt), hour = Number.isFinite(stamp) ? new Date(stamp - 3 * 3600000).toISOString().slice(11, 16) : null;
  return hour ? { pt: 'SESSÃO ' + hour, en: 'SESSION ' + hour, es: 'SESIÓN ' + hour } : { pt: 'SESSÃO SEM INÍCIO', en: 'SESSION START UNKNOWN', es: 'SESIÓN SIN INICIO' };
}
const nameIndices=new Map();
function applyIdentities(root, team) {
  const approved = titleConfigOf(root, team);
  for (const agent of team.agents) {
    const title = approved.get(agent.conversationId?.replace(/^(?:codex|claude):/, ''));
    const taskRoleKey = agent.taskRoleKey && roles[agent.taskRoleKey] ? agent.taskRoleKey : null;
    // TeamReader already arbitrates prefix versus current work metadata. Its null is
    // meaningful; the generated legacy root caption is not evidence of a task.
    let current = agent.taskRoleSource ? taskRoleKey : taskRoleKey || roleKeyOf(agent.currentItemTitle);if(!agent.parentId&&/^COORDENADOR\b/i.test(agent.conversationName||''))current='maestro';
    const chief = !agent.parentId;
    const maestro = current === 'maestro' || !current && title && /^coordenacao/.test(normalized(title.labels.pt));
    const approvedRole = roleKeyOf(title?.labels.pt);
    const parent = team.agents.find(other => other.id === agent.parentId);
    const roleKey = maestro && chief ? 'maestro' : current || approvedRole || parent?.identity?.roleKey || parent?.taskRoleKey || 'helper';
    const definition = roles[roleKey];
    const focusModule=require('./foco.cjs'),focusKey=agent.taskFocusKey||focusModule.focusKeyOf(agent.currentItemTitle)||focusModule.focusKeyOf(title?.labels.pt)||parent?.identity?.focusKey||null;
    const context=normalized(agent.currentItemTitle||title?.labels.pt),tasks=/painel publico/.test(normalized(agent.deliveryActor))?{pt:'Sincroniza equipes e entregas',en:'Syncs teams and delivery estimates',es:'Sincroniza equipos y entregas'}:/controles.*galeri/.test(context)?roleKey==='qa'?{pt:'Testa controles das galerias',en:'Tests the gallery controls',es:'Prueba controles de las galerías'}:roleKey==='reviewer'?{pt:'Revisa controles das galerias',en:'Reviews the gallery controls',es:'Revisa controles de las galerías'}:{pt:'Ajusta controles das galerias',en:'Improves the gallery controls',es:'Mejora controles de galerías'}:/sons e jogo.*toque/.test(context)?{pt:'Melhora toque e etiquetas',en:'Improves touch controls and labels',es:'Mejora controles y etiquetas'}:definition.taskLabels;
    agent.identity = { paper: roleKey, roleKey, focusKey, focusLabels:focusModule.labels[focusKey]||null, labels: { ...definition.labels }, taskLabels: { ...tasks }, source: chief ? 'conversation-chief' : agent.taskRoleSource || 'task-or-agent-path', taskSource: agent.taskRoleSource || 'task-or-agent-path', duplicateIndex: null };
    agent.roleKey = roleKey; agent.roleLabels = agent.identity.labels; agent.taskLabels = agent.identity.taskLabels;
    if(chief&&title)agent.deliveryActor=title.project==='panel'?'CODEX PAINEL':title.project==='colecao'&&roleKey==='artist'?'COLECAO ARTE':title.project==='colecao'&&['combat-animator','dj'].includes(roleKey)?'COLECAO SONS':roleKey==='maestro'?'COORDENADOR':null;
  }
  for(const agent of team.agents){const parent=team.agents.find(a=>a.id===agent.parentId),focus=/^COORDENADOR.*comando/i.test(agent.conversationName||'')?'commands':/^COORDENADOR.*fila.*entregas/i.test(agent.conversationName||'')?'delivery':agent.identity.focusKey||parent?.identity?.focusKey;const names={panel:{pt:/aberto|public/i.test(agent.project)?'PAINEL PÚBLICO':'PAINEL LOCAL',en:/aberto|public/i.test(agent.project)?'PUBLIC PANEL':'LOCAL PANEL',es:/aberto|public/i.test(agent.project)?'PANEL PÚBLICO':'PANEL LOCAL'},commands:{pt:'COMANDOS',en:'COMMANDS',es:'COMANDOS'},delivery:{pt:'ENTREGAS',en:'DELIVERIES',es:'ENTREGAS'},home:{pt:'PÁGINA INICIAL',en:'HOME PAGE',es:'PÁGINA INICIAL'},terminal:{pt:'TERMINAL',en:'TERMINAL',es:'TERMINAL'},gallery:{pt:'GALERIAS',en:'GALLERIES',es:'GALERÍAS'},combat:{pt:'COMBATE',en:'COMBAT',es:'COMBATE'},economy:{pt:'ECONOMIA',en:'ECONOMY',es:'ECONOMÍA'},copy:{pt:'TEXTOS',en:'COPY',es:'TEXTOS'},usability:{pt:'LEITURA DO PAINEL',en:'PANEL READING',es:'LECTURA DEL PANEL'},security:{pt:'PROTEÇÃO',en:'PROTECTION',es:'PROTECCIÓN'},tracker:{pt:'RARIDADES',en:'RARITY',es:'RAREZA'},art:{pt:'ARTE',en:'ART',es:'ARTE'}};const project=agent.project||parent?.project||'Trabalho atual',panel=/painel|panel/i.test(project)?(/aberto|public/i.test(project)?{pt:'PAINEL PÚBLICO',en:'PUBLIC PANEL',es:'PANEL PÚBLICO'}:{pt:'PAINEL LOCAL',en:'LOCAL PANEL',es:'PANEL LOCAL'}):null;const context=names[focus]||panel||(/^coordenacao/.test(normalized(agent.conversationTitle))?{pt:'CASA',en:'HOUSE',es:'CASA'}:{pt:project.toUpperCase(),en:project.toUpperCase(),es:project.toUpperCase()});agent.identity.duplicateIndex=null;for(const lang of ['pt','en','es'])agent.identity.labels[lang]=agent.identity.labels[lang]+' · '+context[lang];agent.identity.contextLabels=context;if(focus==='commands')agent.identity.taskLabels={pt:'Distribui pedidos da casa',en:'Assigns house requests',es:'Distribuye pedidos de la casa'};if(focus==='delivery')agent.identity.taskLabels={pt:'Organiza fila e entregas',en:'Organizes the queue and deliveries',es:'Organiza la cola y entregas'};}
  const repeated = new Map();
  for (const group of team.groups || []) {
    const config = approved.get(group.conversationId?.replace(/^(?:codex|claude):/, ''));
    const leader = group.agents.find(agent => !agent.parentId) || group.agents[0];
    const sourceRole = leader.roleKey || leader.taskRoleKey || roleKeyOf(leader.currentItemTitle);
    const appTitle = group.agents.map(agent => agent.appTitle).find(Boolean) || null;
    const appLabels = appTitle ? { pt: appTitle, en: appTitle, es: appTitle } : null;
    const labels = config?.labels || appLabels || GROUP_ROLES[sourceRole] || sessionLabels(leader);
    group.titleLabels = { ...labels }; group.title = labels.pt; group.titleSource = config ? config.source : appLabels ? 'app-session-title' : GROUP_ROLES[sourceRole] ? 'known-task-vocabulary' : 'session-start';
    const project = config?.project || projectKey(leader.project) || projectKey(leader.projectId);
    const projectLabels = { 'app': 'PAINEL', colecao: 'COLECAO', panel: 'PAINEL', 'public-panel': 'PAINEL ABERTO' };
    const localProject = String(leader.project || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    group.projectLabel = projectLabels[project] || (/^[\p{L}\p{N} .-]{1,40}$/u.test(localProject) ? localProject : 'PROJETO LOCAL');
    for (const agent of group.agents) { agent.conversationTitle = labels.pt; agent.conversation = labels.pt; }
    const id = group.title; if (!repeated.has(id)) repeated.set(id, []); repeated.get(id).push(group);
  }
  return team;
}
module.exports = { roleKeyOf, taskRoleKeyOf, titleConfigOf, sessionLabels, applyIdentities };
