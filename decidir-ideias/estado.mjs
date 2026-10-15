import { readFileSync } from 'node:fs';
import { readFile, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const FOCOS = ['dinheiro', 'holder', 'velocidade', 'referencias'];
export const VEREDITOS = ['FAZER', 'FAZER_COM_RESSALVAS', 'SO_SE', 'NAO'];
const ORIGEM = 'app decidir-ideias';
const fallback = [
  ['visionario', 'Visionário', '#AFA5FF'], ['cetico', 'Cético', '#AAB8CC'],
  ['operador', 'Operador', '#71D6B1'], ['cientista', 'Cientista', '#7DCDF2'],
  ['filosofo', 'Filósofo', '#D1B1E8'], ['politico', 'Político', '#F0BE7A'],
  ['economista', 'Economista', '#C2D981'], ['artista', 'Artista', '#F2A4C0'],
  ['advogado', 'Advogado', '#A5BDF5'], ['cliente', 'Cliente', '#E9C59F'],
];
const nomes = Object.fromEntries(fallback.map(([id, nome]) => [id, nome]));
export const PAPEIS = fallback.map(([id]) => id);
// Lente de cada cadeira, em palavras de gente (mesmas perguntas da Mesa dos 10).
export const LENTES = {
  visionario: ['Sonha alto', 'Se funcionar aqui, até onde pode chegar?'],
  cetico: ['Procura o furo', 'Bonito, mas onde pode dar errado?'],
  operador: ['Põe de pé', 'Quem faz o quê até amanhã?'],
  cientista: ['Mede tudo', 'O que faria a gente mudar de ideia?'],
  filosofo: ['Pensa nas pessoas', 'Isso ajuda a vida de quem?'],
  politico: ['Junta apoio', 'Quem precisa querer isso junto?'],
  economista: ['Faz a conta', 'Depois de pagar tudo, sobra dinheiro?'],
  artista: ['Cuida do sentir', 'O que a pessoa sente quando olha?'],
  advogado: ['Guarda o combinado', 'O combinado está claro por escrito?'],
  cliente: ['Fala por quem usa', 'Eu usaria isso amanhã?'],
};
// A fila separada por projeto, cada um com a sessão responsável.
// Projetos da fila (id, nome na tela, sessão responsável). Troque pelo seu arquivo: DECIDIR_PROJETOS=/caminho/projetos.json
// (mesmo formato desta lista). Os ids abaixo sao os que o leitor de ideias reconhece.
const PROJETOS_PADRAO = process.env.PAINEL_DEMO === '1' ? require('../demo/projetos.cjs') : require('../descoberta.cjs').snapshot().projects.map(p => ({ id: p.id, nome: p.name, sessao: null, equipe: p.name }));
export const PROJETOS = (() => {
  try {
    if (process.env.DECIDIR_PROJETOS) {
      const lista = JSON.parse(readFileSync(process.env.DECIDIR_PROJETOS, 'utf8'));
      if (Array.isArray(lista) && lista.every(p => p && typeof p.id === 'string' && typeof p.nome === 'string')) return lista;
    }
  } catch { /* arquivo invalido: fica a lista padrao */ }
  return PROJETOS_PADRAO;
})();
const PROJETO_POR_ID = new Map(PROJETOS.map(p => [p.id, p]));
// frente e dono saem da propria lista de projetos: id, nome e sessão responsável
const normP = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const FRENTES = Object.fromEntries(PROJETOS.flatMap(p => [[normP(p.id), p.id], [normP(p.nome), p.id]]));
const DONOS = Object.fromEntries(PROJETOS.filter(p => p.sessao && p.sessao !== 'COORDENADOR').map(p => [String(p.sessao).toUpperCase(), p.id]));
// Ordem: frente, depois sessão responsável, depois o campo projeto. Sem nenhum dos três, cai em Outros.
// Frente e projeto passam pela mesma leitura: nome exato ou texto composto ("Terminal / Modo foco").
function projetoPorTexto(v) {
  const p = norm(v);
  if (!p) return null;
  if (FRENTES[p]) return FRENTES[p];
  // Texto composto: quem decide é a 1a parte ("Projeto A / extra" = Projeto A).
  const primeira = p.split('/')[0].trim();
  if (primeira && primeira !== p) { const r = projetoPorTexto(primeira); if (r) return r; }
  for (const proj of PROJETOS) if (proj.id !== 'outros' && (p.includes(norm(proj.nome)) || p.includes(norm(proj.id)))) return proj.id;
  return null;
}
export function projetoDe(idea, sources = []) {
  const lista = [idea, ...sources].filter(Boolean);
  for (const x of lista) { const f = projetoPorTexto(x.frente); if (f) return f; }
  for (const x of lista) { const d = DONOS[String(x.dono ?? '').toUpperCase().trim()]; if (d) return d; }
  for (const x of lista) { const p = projetoPorTexto(x.projeto); if (p) return p; }
  return 'outros';
}
// Linha de ideia do próprio dono ou do COORDENADOR: autor dono/coordenador, ou origem que começa com "dono" sem citar outra ideia (a J1).
export function ideiaDoDono(idea) {
  if (['dono', 'coordenador'].includes(norm(idea?.autor))) return true;
  const o = String(idea?.origem ?? '');
  return idea?.t === 'ideia' && /^dono\b/.test(norm(o)) && !/I-\d/.test(o) && !(idea.fontes ?? []).length;
}
export const nomeDoProjeto = id => PROJETO_POR_ID.get(id)?.nome || 'Outros';
const POSICOES = { favor: 'favor', apoia: 'favor', ressalva: 'melhora', melhora: 'melhora', so_se: 'condicao', condicao: 'condicao', contra: 'contra', rejeita: 'contra' };
const soSe = t => /so se|a nao ser|apenas se|somente se|se houver|antes de/i.test(norm(t));
// Em qual das 4 opções cada voto cai: a foto do conselheiro aparece dentro dessa opção.
export function opcaoDoVoto(v) {
  return v.posicao === 'favor' ? 1 : v.posicao === 'melhora' ? 2 : v.posicao === 'condicao' ? 3 : soSe(v.texto) ? 3 : 4;
}
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const tempo = v => Date.parse(v) || 0;
export function limpar(v) {
  return String(v ?? '').replace(/[\u2013\u2014]/g, ', ')
    .replace(/0x[a-f\d]{40,}/gi, '[endereço omitido]')
    .replace(/\b[a-f\d]{64}\b/gi, '[segredo omitido]')
    .replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '[endereço omitido]')
    .replace(/(?:seed phrase|mnemonico|chave privada|private key)\s*[:=].*/gi, '[segredo omitido]')
    .replace(/\s+/g, ' ').trim();
}
const linha = (v, max = 160) => {
  const s = limpar(v).split(/(?<=[.!?])\s/)[0];
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
};
function resumoDaPosicao(v) {
  return linha(limpar(v).replace(/^(?:a favor[.!:]?\s*)?(?:melhora|ressalva|ajuste)\s*:\s*/i, '')
    .replace(/^a favor\.\s*/i, ''));
}
export function classificar(texto) {
  const s = norm(texto);
  if (/dinheiro|custo|preco|receita|lucro|saldo|carteira|gas\b|taxa|financeir|compra|venda|trade|invest|pagamento|mensalidade|cobrar|cobranca/.test(s)) {
    return { marca: 'IMPORTANTE', porque: 'dinheiro' };
  }
  if (/risco|segur|privad|privacidade|consent|permiss|fraud|manipul|segredo|chave|perd|falha|erro|protec|acesso|expos|pressao/.test(s)) {
    return { marca: 'IMPORTANTE', porque: 'risco' };
  }
  if (/result|prova|comprov|confirm|verific|medir|medid|teste|amostra|entrega|execut|promess|depende|antes de|so se|somente se|apenas se|desde que|precisa|exige|nao |sem |descoberta|confund|clareza|claro|uso|acessib|desempenho|limite/.test(s)) {
    return { marca: 'IMPORTANTE', porque: 'resultado' };
  }
  // DETALHE só para frases reconhecidamente técnicas ou cosméticas.
  // Cada trecho deve ter um sinal de detalhe; uma parte desconhecida torna o conjunto importante.
  const trechos = s.replace(/^(a favor[.!:]?\s*)?(melhora|ressalva|ajuste)\s*:\s*/, '')
    .split(/[.;!?]|\b(?:mas|e)\b/).map(x => x.trim()).filter(Boolean);
  const detalhe = /^(?:(?:prefiro|sugiro|quero)\s+)?(?:(?:so\s+)?(?:ajustar|mudar|trocar|alterar|padronizar)\s+)?(?:o |a |um |uma )?(?:espacamento|indentacao|tamanho (?:da |de )?fonte|cor (?:do |da )?(?:botao|borda)|ordem (?:dos |das )?(?:imports|importacoes))(?:\s+(?:para|em)\s+(?:azul|verde|rosa|vermelho|branco|preto|\d+(?:px)?|ordem alfabetica))?$|^renomear (?:a |o |uma |um )?(?:variavel|arquivo)$|^(?:tanto faz|(?:e |so |um |e so um )*detalhe tecnico)$/;
  return trechos.length && trechos.every(t => detalhe.test(t))
    ? { marca: 'DETALHE', porque: 'técnico' }
    : { marca: 'IMPORTANTE', porque: 'resultado' };
}
// Quanto o conselho aprova: aceitar (com ou sem ressalva) pesa mais; rejeitar desconta.
export function aprovacao(i) { const [a, b, c, d] = i.porOpcao || [0, 0, 0, 0]; return (a + b) * 100 + a * 10 + c - d * 5; }
export function horaLocal(ms = Date.now()) {
  return new Date(ms - 3 * 3600_000).toISOString().replace('Z', '-03:00');
}
async function lerJSON(dir, file, defaultValue) {
  try { return JSON.parse((await readFile(path.join(dir, file), 'utf8')).replace(/^\uFEFF/, '')); }
  catch (e) { if (e.code === 'ENOENT') return defaultValue; throw new Error(`Não foi possível ler ${file}. Confira o JSON.`); }
}
async function lerLinhas(dir, file) {
  let data;
  try { data = await readFile(path.join(dir, file), 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  return data.replace(/^\uFEFF/, '').split(/\r?\n/).flatMap((s, i) => {
    if (!s.trim()) return [];
    try { return [JSON.parse(s)]; }
    catch { throw new Error(`Linha ${i + 1} inválida em ${file}. Nenhuma decisão foi gravada.`); }
  });
}
function focoDe(idea, sources) {
  const explicit = [idea, ...sources].map(x => norm(x.foco)).find(x => FOCOS.includes(x));
  if (explicit) return explicit;
  const txt = norm([idea.projeto, idea.frente, idea.titulo].join(' '));
  if (/receita|mensal|preco|vender|comerc|dinheiro/.test(txt)) return 'dinheiro';
  if (/holder|cliente|ranking|comunidade/.test(txt)) return 'holder';
  if (/painel|fluxo|processo|rapido|automati|gate/.test(txt)) return 'velocidade';
  return 'referencias';
}
function votoDe(v) {
  const s = norm(v);
  if (/contra|rejeit|^nao$|veto/.test(s)) return 'contra';
  if (/depende|ressalva|melhora|condicion|so se|ajuste/.test(s)) return 'melhora';
  if (/favor|apoia|concorda|^sim$/.test(s)) return 'favor';
  return null;
}
function idealista(autor, foco) {
  const a = norm(autor);
  if (!['claude', 'codex'].includes(a)) return null;
  return { id: `${a}:${foco}`, nome: a === 'claude' ? 'Claude' : 'Codex', foco,
    tipo: 'idealista', cor: a === 'claude' ? '#F0964A' : '#6AA4F5', arte: `/arte/${a}.png`,
    papel: a === 'claude' ? 'Idealista do Claude' : 'Idealista do Codex', pergunta: '' };
}
function montarIdeia(idea, raw, debates, pessoas, extras = {}) {
  // A mesa e quem esta no conselho.json da pessoa (os 10 padrao quando ele nao lista ninguem).
  const papeis = pessoas.length ? pessoas.map(p => p.id) : PAPEIS;
  const refs = [...new Set([idea.id, ...(String(idea.origem ?? '').match(/I-[\w-]+/g) ?? []),
    ...(idea.fontes ?? []).map(x => x.id)].filter(Boolean))];
  const sources = refs.map(id => raw.get(id)).filter(Boolean);
  const foco = focoDe(idea, sources);
  const authors = new Map();
  for (const source of [idea, ...sources]) {
    const a = idealista(source.autor, FOCOS.includes(source.foco) ? source.foco : foco);
    if (a) authors.set(a.id, a);
  }
  if (!authors.size) for (const a of ['claude', 'codex']) {
    if (norm(idea.origem).includes(a)) { const p = idealista(a, foco); authors.set(p.id, p); }
  }
  // Ideia que nasceu do dono ou do COORDENADOR (linha própria, sem juntar ideia de idealista, como a J1) não dá pontos a idealista.
  if (ideiaDoDono(idea)) authors.clear();
  const votes = new Map();
  for (const f of idea.falas ?? idea.votos ?? []) {
    const p = pessoas.find(x => norm(x.id) === norm(f.conselheiro) || norm(x.nome) === norm(f.conselheiro));
    const posicao = votoDe(f.voto ?? f.posicao);
    if (p && posicao) votes.set(p.id, { id: p.id, nome: p.nome, posicao, texto: limpar(f.fala_simples ?? f.fala ?? f.texto) });
  }
  // Uma posição atual por participante e foco, mesmo após várias rodadas do debate.
  for (const d of debates.filter(d => refs.includes(d.id))) {
    const posicao = votoDe(d.posicao);
    const pessoa = pessoas.find(p => norm(p.id) === norm(d.autor) || norm(p.nome) === norm(d.autor));
    const a = pessoa ?? idealista(d.autor, FOCOS.includes(d.foco) ? d.foco : foco);
    if (posicao && a) votes.set(a.id, { id: a.id, nome: a.nome, foco: a.foco, posicao, texto: limpar(d.texto) });
  }
  // Mesa dos 10 pares: só o acordo das duas famílias (publicavel.json). Completa quem faltou, sem trocar voto existente.
  for (const a of extras.mesa?.get(idea.id) ?? []) {
    const p = pessoas.find(x => x.id === a.papel), r = a.resultado || {}, posicao = POSICOES[norm(r.vote)];
    if (p && posicao && !votes.has(p.id)) votes.set(p.id, { id: p.id, nome: p.nome, posicao, fonte: 'mesa',
      texto: limpar(r.title), detalhe: linha(r.summary, 320), condicao: linha((r.conditions || [])[0] || '', 140) });
  }
  // Votos gerados para completar a mesa (arquivo de votos desta cópia); nunca passam por cima de um voto real.
  for (const [papel, v] of Object.entries(extras.completar?.get(idea.id) ?? {})) {
    const p = pessoas.find(x => x.id === papel), posicao = POSICOES[norm(v?.voto)];
    if (!p || !posicao || votes.has(p.id)) continue;
    const peso = ['IMPORTANTE', 'DETALHE'].includes(v.peso) && /^[a-z-]{2,16}$/.test(norm(v.porque)) ? { marca: v.peso, porque: limpar(v.porque).toLowerCase() } : null;
    votes.set(p.id, { id: p.id, nome: p.nome, posicao, fonte: 'completado', texto: linha(v.frase, 200), condicao: linha(v.condicao || '', 140), ...(peso ? { peso } : {}) });
  }
  const ordem = id => { const i = papeis.indexOf(id); return i < 0 ? 99 : i; };
  const votos = [...votes.values()].sort((a, b) => ordem(a.id) - ordem(b.id)).map(v => {
    const { peso, ...resto } = v;
    const marca = v.posicao === 'favor' ? {} : peso || classificar([v.condicao, v.texto].filter(Boolean).join('. '));
    return { ...resto, ...marca, opcao: opcaoDoVoto(v), conselheiro: papeis.includes(v.id) };
  });
  // O placar da ideia conta o conselho; os idealistas aparecem à parte. Sem conselho, conta quem debateu.
  const doConselho = votos.filter(v => v.conselheiro);
  const base = doConselho.length ? doConselho : votos;
  const contagem = { favor: 0, melhora: 0, condicao: 0, contra: 0 };
  for (const v of base) contagem[v.posicao]++;
  const porOpcao = [0, 0, 0, 0, 0];
  for (const v of base) porOpcao[v.opcao]++;
  // Alguns exportadores trazem só o placar, sem identificar os votantes.
  if (!votos.length && idea.placar) {
    for (const [key, input] of [['favor', 'favor'], ['melhora', 'depende'], ['contra', 'contra']]) {
      contagem[key] = Math.max(0, Number(idea.placar[input]) || 0);
    }
  }
  const temDebate = votos.length > 0 || Object.values(contagem).some(Boolean);
  const ressalvas = [...new Set(base.filter(v => v.opcao === 2).map(v => v.condicao || v.texto).filter(Boolean))];
  const contras = [...new Set(base.filter(v => v.opcao >= 3).sort((a, b) => a.opcao - b.opcao).map(v => v.condicao || v.texto).filter(Boolean))];
  const ajuste = resumoDaPosicao(ressalvas[0] ?? '');
  const condicao = resumoDaPosicao(contras[0] ?? '');
  const observacoes = base.filter(v => v.posicao !== 'favor');
  const tantoFaz = contagem.melhora > 0 && contagem.contra === 0 && contagem.condicao === 0 && observacoes.length > 0
    && observacoes.every(v => v.marca === 'DETALHE');
  const maior = Math.max(...porOpcao);
  // Em empate, prevalece a posição mais cautelosa. Sem votos, não inventa recomendação.
  let recomendado = !maior ? null : [4, 3, 2, 1].find(o => porOpcao[o] === maior);
  if (tantoFaz && recomendado === 2) recomendado = 1;
  const opcoes = temDebate ? [
    { opcao: 1, titulo: 'Aceitar', detalhe: 'Fazer como está.', texto: '', editavel: false },
    { opcao: 2, titulo: 'Aceitar com ressalva',
      detalhe: ajuste || 'Escreva a ressalva que deve acompanhar a ideia.', texto: ajuste, editavel: true },
    { opcao: 3, titulo: 'Só se', detalhe: condicao || 'Qual condição precisa ser cumprida antes de fazer?',
      texto: condicao, editavel: true },
    { opcao: 4, titulo: 'Rejeitar', detalhe: 'Esta ideia sai da fila.', texto: '', editavel: false },
  ] : [
    { opcao: 1, titulo: 'Aceitar', detalhe: 'Fazer como está.', texto: '', editavel: false },
    { opcao: 2, titulo: 'Aceitar com ajuste', detalhe: 'Escreva um ajuste curto.', texto: '', editavel: true },
    { opcao: 3, titulo: 'Guardar para depois', detalhe: 'Retomar só quando a condição estiver pronta.', texto: 'Retomar depois', editavel: true },
    { opcao: 4, titulo: 'Rejeitar', detalhe: 'Esta ideia sai da fila.', texto: '', editavel: false },
  ];
  for (const o of opcoes) {
    o.recomendado = o.opcao === recomendado;
    o.votantes = base.filter(v => v.opcao === o.opcao).map(v => v.id);
    if ([2, 3].includes(o.opcao)) {
      const marcas = base.filter(v => o.opcao === 2 ? v.opcao === 2 : v.opcao >= 3).filter(v => v.marca)
        .map(v => ({ marca: v.marca, porque: v.porque }));
      Object.assign(o, marcas.find(m => m.marca === 'IMPORTANTE') ?? marcas[0] ?? classificar(o.detalhe));
    }
  }
  const effort = [idea, ...sources].map(x => String(x.esforco ?? '').toUpperCase()).filter(x => ['P', 'M', 'G'].includes(x));
  const gente = extras.textos?.get(idea.id);
  const projetoId = projetoDe(idea, sources);
  return { id: limpar(idea.id), titulo: limpar(gente?.titulo || idea.titulo || 'Ideia sem título'),
    tituloOriginal: limpar(idea.titulo || ''), porque: linha(gente?.porque || idea.porque || '', 220),
    como: linha(idea.como || idea.resumo || sources[0]?.como || 'Confira o debate antes de decidir.', 240),
    projeto: nomeDoProjeto(projetoId), projetoId, projetoOriginal: limpar(idea.projeto || idea.frente || sources[0]?.projeto || ''),
    pedidoDoDono: /\bdono\b/.test(norm(idea.origem)), donoECoordenador: /\bdono\b/.test(norm(idea.origem)) && /\bcoordenador\b/.test(norm(idea.origem)), foco,
    esforco: ['P', 'M', 'G'].find(e => effort.includes(e)) || 'M', autores: [...authors.values()],
    juntada: refs.some(id => id !== idea.id), fontes: refs.filter(id => id !== idea.id),
    conselho: Boolean(idea.falas), temDebate, votos, contagem, porOpcao: porOpcao.slice(1), ressalvas, contras, opcoes, tantoFaz, recomendado,
    mesaCompleta: papeis.every(p => votos.some(v => v.id === p)), mesaTotal: papeis.length,
    faltam: papeis.filter(p => !votos.some(v => v.id === p)), completados: votos.filter(v => v.fonte === 'completado').length };
}
export async function carregar(dir) {
  const [events, seals, council, foco, achievements] = await Promise.all([
    lerLinhas(dir, 'ideias.jsonl'), lerLinhas(dir, 'vereditos-dono.jsonl'),
    lerJSON(dir, 'conselho.json', {}), lerJSON(dir, 'conselho-modo-foco.json', {}),
    lerJSON(dir, 'conquistas-conselho.json', {}),
  ]);
  const [publicavel, completar] = await Promise.all([lerJSON(dir, 'mesa10/publicavel.json', {}),
    lerJSON(dir, process.env.VOTOS_COMPLETAR || 'votos-completar.json', {})]);
  const mesa = new Map();
  for (const r of publicavel.rodadas ?? []) if (typeof r.proposalId === 'string') mesa.set(r.proposalId, [...(mesa.get(r.proposalId) ?? []), ...(r.acordos ?? [])]);
  const extras = { mesa, completar: new Map(Object.entries(completar.ideias ?? {}).map(([id, v]) => [id, v.votos ?? {}])),
    textos: new Map(Object.entries(completar.ideias ?? {}).filter(([, v]) => v.titulo).map(([id, v]) => [id, { titulo: v.titulo, porque: v.porque }])) };
  const peopleSource = achievements.conselheiros?.length ? achievements.conselheiros : council.conselheiros;
  const pessoas = (peopleSource?.length ? peopleSource : fallback.map(([id, nome, cor]) => ({ id, nome, cor })))
    .map(p => ({ id: limpar(p.id), nome: nomes[p.id] || limpar(p.nome),
      cor: /^#[\da-f]{6}$/i.test(p.cor) ? p.cor : '#AAAABB', tipo: 'conselheiro',
      frase: linha(p.frase_assinatura_simples || p.frase_assinatura),
      arte: PAPEIS.includes(p.id) ? `/arte/${p.id}.png` : '', papel: LENTES[p.id]?.[0] || linha(p.papel || '', 60), pergunta: LENTES[p.id]?.[1] || linha(p.criterio || '', 160) }));
  const raw = new Map(events.filter(x => x.t === 'ideia' && typeof x.id === 'string').map(x => [x.id, x]));
  const councils = new Map([...(council.ideias ?? []), ...(foco.ideias ?? [])].map(x => [x.id, x]));
  const usedSources = new Set();
  for (const c of councils.values()) {
    for (const id of [...(String(c.origem ?? '').match(/I-[\w-]+/g) ?? []), ...(c.fontes ?? []).map(f => f.id)]) {
      if (id !== c.id) usedSources.add(id);
    }
  }
  const all = new Map([...raw, ...councils]);
  const debates = events.filter(x => x.t === 'debate').sort((a, b) => tempo(a.hora) - tempo(b.hora));
  const ideias = [...all.values()].map(i => montarIdeia(i, raw, debates, pessoas, extras));
  const byId = new Map(ideias.map(i => [i.id, i]));
  const latestOwner = new Map(events.filter(x => x.t === 'decisao' && norm(x.autor) === 'dono').map(x => [x.id, x]));
  const latestSeal = new Map(seals.filter(x => x.t === 'selo').map(x => [x.id, x]));
  const effective = new Map();
  for (const id of new Set([...latestOwner.keys(), ...latestSeal.keys()])) {
    const decision = latestOwner.get(id), seal = latestSeal.get(id);
    if (decision?.estado === 'reaberta' && (!seal || tempo(decision.hora) >= tempo(seal.hora))) continue;
    if (seal && (!decision || tempo(seal.hora) >= tempo(decision.hora))) {
      const opcao = VEREDITOS.indexOf(seal.veredito) + 1;
      effective.set(id, { ...seal, opcao: opcao || 3, app: seal.origem === ORIGEM });
    } else if (decision && decision.estado !== 'reaberta') {
      const labels = [/^Aceitar:/, /^Aceitar com (?:ressalvas|ajuste):/, /^(?:Só se|Guardar para depois):/, /^Rejeitar:/];
      const inferred = labels.findIndex(x => x.test(String(decision.motivo)));
      const opcao = inferred >= 0 ? inferred + 1 : decision.estado === 'descartada' ? 4 : decision.estado === 'guardada' ? 3 : 1;
      effective.set(id, { ...decision, opcao, app: inferred >= 0 });
    }
  }
  // A "pauta" do modo foco é só o pedido da rodada, não uma ideia para decidir.
  const fila = ideias.filter(i => !usedSources.has(i.id) && !effective.has(i.id) && !/-PAUTA$/.test(i.id)).sort((a, b) =>
    aprovacao(b) - aprovacao(a) || FOCOS.indexOf(a.foco) - FOCOS.indexOf(b.foco) || ['P', 'M', 'G'].indexOf(a.esforco) - ['P', 'M', 'G'].indexOf(b.esforco) || a.id.localeCompare(b.id));
  const revisao = ideias.filter(i => effective.get(i.id)?.opcao === 1
    && (i.contagem.melhora > 0 || i.contagem.contra > 0))
    .map(i => ({ ...i, aceiteAnterior: { hora: effective.get(i.id).hora,
      veredito: 'FAZER', motivo: limpar(latestOwner.get(i.id)?.motivo || 'Selo FAZER') } }));
  return { events, seals, pessoas, ideias, byId, effective, fila, revisao };
}

function efeitos(idea, opcao) {
  const effects = new Map();
  if (!idea) return effects;
  for (const v of idea.votos) effects.set(v.id, opcao === (v.opcao ?? opcaoDoVoto(v)) ? 10 : -5);
  for (const a of idea.autores) {
    if (opcao <= 2) effects.set(a.id, 10);
    else if (opcao === 4) effects.set(a.id, -5);
  }
  return effects;
}
function rank(rows) {
  return rows.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id))
    .map((p, i) => ({ ...p, posicao: i + 1 }));
}
export function placar(state) {
  const participants = [...state.pessoas, ...['claude', 'codex'].flatMap(a => FOCOS.map(f => idealista(a, f)))];
  const rows = new Map(participants.map(p => [p.id, { ...p, pontos: 0, sequencia: 0 }]));
  const decisions = [...state.effective.values()].sort((a, b) => tempo(a.hora) - tempo(b.hora) || a.id.localeCompare(b.id));
  let previous = rank([...rows.values()].map(p => ({ ...p })));
  for (let i = 0; i < decisions.length; i++) {
    previous = rank([...rows.values()].map(p => ({ ...p })));
    // "Deixar para depois" em lote não julga a ideia: ninguém ganha nem perde pontos.
    if (decisions[i].adiada) continue;
    for (const [id, delta] of efeitos(state.byId.get(decisions[i].id), decisions[i].opcao)) {
      if (!rows.has(id)) continue;
      const p = rows.get(id);
      p.pontos += delta;
      p.sequencia = delta > 0 ? p.sequencia + 1 : 0;
    }
  }
  const previousMap = new Map(previous.map(p => [p.id, p.posicao]));
  const ranking = rank([...rows.values()].map(p => ({ ...p }))).map(p => ({ ...p, movimento: previousMap.get(p.id) - p.posicao }));
  const hoje = horaLocal().slice(0, 10);
  const decididasHoje = decisions.filter(d => !d.adiada && String(d.hora).slice(0, 10) === hoje).length;
  const last = decisions.filter(d => d.app).at(-1);
  const lote = last?.lote ? resumoDoLote(state, last.lote) : null;
  return { ranking, dono: { decididasHoje, sequencia: decididasHoje, lote: decididasHoje % 10,
    lotesCompletos: Math.floor(decididasHoje / 10), filaZerada: state.fila.length === 0 },
    pendentes: state.fila.length, ultima: last ? { id: last.id, titulo: state.byId.get(last.id)?.titulo || limpar(last.titulo), ...(lote ? { lote } : {}) } : null };
}
// Um lote é 1 passo no Desfazer: todas as ideias ainda seladas por ele.
export function idsDoLote(state, loteId) {
  return [...state.effective.values()].filter(x => x.app && x.lote === loteId).sort((a, b) => tempo(a.hora) - tempo(b.hora) || a.id.localeCompare(b.id)).map(x => x.id);
}
export function resumoDoLote(state, loteId) {
  const ids = idsDoLote(state, loteId);
  if (!ids.length) return null;
  const primeiro = state.effective.get(ids[0]);
  const projetoId = PROJETO_POR_ID.has(primeiro.loteProjeto) ? primeiro.loteProjeto : 'outros';
  return { id: loteId, total: ids.length, acao: ACOES_LOTE.includes(primeiro.loteAcao) ? primeiro.loteAcao : 'aceitar',
    projeto: projetoId, nome: nomeDoProjeto(projetoId) };
}
// O que cada botão de lote faria com as ideias pendentes de um projeto. A tela mostra isto antes de confirmar.
export const ACOES_LOTE = ['aceitar', 'rejeitar', 'depois'];
export function planoDoLote(fila, projetoId, acao) {
  const doProjeto = fila.filter(i => i.projetoId === projetoId);
  if (acao === 'rejeitar') return doProjeto.map(i => ({ ideia: i, opcao: 4, texto: '' }));
  if (acao === 'depois') return doProjeto.map(i => ({ ideia: i, opcao: 3, texto: `Retomar depois: guardada em lote no projeto ${nomeDoProjeto(projetoId)}`, adiada: true }));
  return doProjeto.filter(i => [1, 2].includes(i.recomendado)).map(i => {
    const texto = i.opcoes[1]?.texto || '';
    // Sem a frase da ressalva, aceita como está (a ressalva aparece no debate da ideia).
    return i.recomendado === 2 && texto ? { ideia: i, opcao: 2, texto } : { ideia: i, opcao: 1, texto: '' };
  });
}
// Reação da mesa ao lote: a soma dos pontos de cada um no lote inteiro.
export function reacoesDoLote(before, after, loteId, desfazer = false) {
  return after.ranking.map(p => {
    const old = before.ranking.find(x => x.id === p.id);
    const delta = p.pontos - (old?.pontos || 0);
    if (!delta) return null;
    return { ...p, delta, movimento: (old?.posicao || p.posicao) - p.posicao, voto: null,
      frase: desfazer ? 'Voltamos o lote inteiro.' : fraseDe(p.id, loteId, delta > 0, p.tipo === 'idealista') };
  }).filter(Boolean);
}
// Cada cadeira tem o seu jeito de comemorar e de ficar brava. A frase muda por ideia, sem sorteio.
const frases = {
  visionario: [['Isso pode ir longe!', 'Eu vi esse futuro primeiro.', 'Agora sim, pensando grande.'], ['Sonho adiado, não esquecido.', 'Vocês ainda vão lembrar disso.', 'Faltou coragem aqui.']],
  cetico: [['Passou no meu filtro.', 'Ouviram o cético, milagre.', 'Desconfiei e acertei.'], ['Eu avisei.', 'Depois não digam que não falei.', 'Isso vai dar dor de cabeça.']],
  operador: [['Bora pôr de pé amanhã!', 'Já sei quem faz o quê.', 'Mão na massa.'], ['E quem vai executar isso?', 'Mais trabalho na minha mesa.', 'Assim não sai do papel.']],
  cientista: [['Boa. Agora vamos medir.', 'Hipótese aceita, bora testar.', 'Os dados agradecem.'], ['Minha hipótese era outra.', 'Sem medir, é chute.', 'Vou guardar esse dado.']],
  filosofo: [['Essa escolha faz sentido.', 'Quem usa vai sentir a diferença.', 'Decisão com propósito.'], ['Ainda quero pensar nisso.', 'E as pessoas no meio disso?', 'Pressa não é sabedoria.']],
  politico: [['Fechamos juntos!', 'Todo mundo a bordo.', 'Isso vai ter apoio.'], ['Vou repensar meu apoio.', 'Vai ser difícil vender isso.', 'Na próxima, conversem comigo.']],
  economista: [['A conta fecha!', 'Isso paga a si mesmo.', 'Bom para o caixa.'], ['Essa conta me preocupa.', 'Quem paga essa fatura?', 'Dinheiro na mesa, perdido.']],
  artista: [['Já consigo ver a cena!', 'Vai ficar lindo.', 'Isso tem alma.'], ['Eu tinha outra visão.', 'Perdeu a graça.', 'Ninguém vai sentir nada.']],
  advogado: [['Combinado anotado.', 'Tudo dentro das regras.', 'Assino embaixo.'], ['Faltou um combinado.', 'Isso pode dar problema.', 'Registro meu protesto.']],
  cliente: [['Essa eu usaria!', 'Finalmente pensaram em mim.', 'Já quero testar.'], ['Eu escolheria diferente.', 'Não era isso que eu queria.', 'Vou continuar esperando.']],
};
const frasesIdealista = [['Minha ideia vai sair do papel!', 'Valeu! Sabia que ia passar.', 'Bora construir.'], ['Beleza, volto com uma melhor.', 'Doeu, mas tudo bem.', 'Vou pensar em outra.']];
function fraseDe(id, ideaId, ganhou, idealista) {
  const lista = (idealista ? frasesIdealista : frases[id] || [['Boa escolha!'], ['Eu escolheria diferente.']])[ganhou ? 0 : 1];
  let h = 0; for (const c of String(ideaId) + id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return lista[h % lista.length];
}
export function reacoes(before, after, idea, opcao, desfazer = false) {
  const changes = efeitos(idea, opcao);
  return after.ranking.filter(p => changes.has(p.id)).map(p => {
    const old = before.ranking.find(x => x.id === p.id);
    const delta = p.pontos - (old?.pontos || 0);
    return { ...p, delta, movimento: (old?.posicao || p.posicao) - p.posicao,
      voto: idea?.votos.find(v => v.id === p.id)?.opcao ?? null,
      frase: desfazer ? 'Voltamos uma decisão.' : delta === 0 ? 'Decisão revista. Pontos mantidos.' : fraseDe(p.id, idea?.id, delta > 0, p.tipo === 'idealista') };
  });
}
export function erro(status, message) { return Object.assign(new Error(message), { status }); }
export async function comTrava(dir, task) {
  const file = path.join(dir, '.decidir-ideias.lock');
  let handle;
  try { handle = await open(file, 'wx'); }
  catch (e) { if (e.code === 'EEXIST') throw erro(409, 'Uma gravação está em andamento. Tente novamente em instantes.'); throw e; }
  try { return await task(); }
  finally { await handle.close(); await unlink(file); }
}
export async function acrescentar(dir, records) {
  // Abra todos os arquivos antes de gravar. Nunca use writeFile ou truncate nos dados.
  // v4: as linhas de um mesmo arquivo saem numa escrita só (um lote inteiro entra junto ou não entra).
  const porArquivo = new Map();
  for (const [file, record] of records) porArquivo.set(file, [...(porArquivo.get(file) ?? []), record]);
  const handles = [];
  try {
    for (const [file, lista] of porArquivo) {
      const handle = await open(path.join(dir, file), 'a+');
      handles.push({ handle, lista });
    }
    for (const { handle, lista } of handles) {
      const stat = await handle.stat();
      let separator = '';
      if (stat.size) {
        const lastByte = Buffer.alloc(1);
        await handle.read(lastByte, 0, 1, stat.size - 1);
        if (lastByte[0] !== 10) separator = '\n';
      }
      await handle.write(`${separator}${lista.map(r => JSON.stringify(r)).join('\n')}\n`);
      await handle.sync();
    }
  } finally { await Promise.all(handles.map(({ handle }) => handle.close())); }
}
export function novaHora(state, passo = 0) {
  // Uma reabertura precisa ficar depois do selo mesmo dentro do mesmo milissegundo. No lote, cada ideia ganha 1 ms a mais.
  const max = Math.max(0, ...state.events.filter(x => x.t === 'decisao').map(x => tempo(x.hora)), ...state.seals.map(x => tempo(x.hora)));
  return horaLocal(Math.max(Date.now(), max + 1) + passo);
}
