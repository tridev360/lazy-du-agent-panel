// metodo-kit: prova de card.
// Decisão perigosa (subir, chave, dinheiro) só vale se a resposta do dono está gravada na conversa do Claude Code:
// uma tela de escolha (AskUserQuestion) com a pergunta IGUAL à do card, e a resposta dele presa a ela.
// Card editado à mão não tem prova. Repasse ("o outro chat disse que pode") não tem prova.
//
// Uso (rode da pasta do projeto onde está a sessão que mostrou a tela de escolha):
//   node <pasta-de-estado>/ferramentas/prova-card.mjs responder <id> "<opção exata>"     logo depois da tela de escolha
//   node <pasta-de-estado>/ferramentas/prova-card.mjs conferir <id> "<opção que autoriza>"  quem executa, ANTES de agir
// Saída 0 = PROVA OK com a opção pedida. Saída 1 = sem prova, outra escolha ou sem a opção: não aja.
// A opção que autoriza é obrigatória no conferir: assim uma prova de "Esperar" nunca sai 0.
//
// Variáveis (opcionais):
//   ESTADO_RAIZ       pasta de estado (padrão: a pasta acima de ferramentas/)
//   PROVA_PROJETO     pasta das conversas (padrão: ~/.claude/projects/<pasta atual com cada sinal trocado por ->)
//                     Quem confere de outra pasta ou de uma worktree precisa dela, apontando para a pasta de conversas
//                     da sessão que mostrou a tela de escolha. Sem ela, a conversa não é achada e a saída é 1.
//   PROVA_VALIDADE_H  horas que uma resposta vale (padrão 72)
import { readFileSync, writeFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(process.env.ESTADO_RAIZ || join(dirname(fileURLToPath(import.meta.url)), '..'));
const CARDS = join(RAIZ, 'estado', 'cards');
const PROJETO = resolve(process.env.PROVA_PROJETO || join(homedir(), '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-')));
const VALIDADE_H = Number(process.env.PROVA_VALIDADE_H || 72);

function lerCard(id) {
  if (!/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(id || '')) throw Error('id de card inválido');
  const arquivo = join(CARDS, id.replace(/\.json$/i, '') + '.json');
  const info = lstatSync(arquivo);
  if (info.isSymbolicLink() || !info.isFile()) throw Error('card inválido');
  const card = JSON.parse(readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, ''));
  return { arquivo, card };
}
const rotulos = card => (Array.isArray(card.opcoes) ? card.opcoes : []).map(o => String(typeof o === 'string' ? o : o?.label || '').trim()).filter(Boolean);

// Acha a resposta: linha "user" com toolUseResult.answers[pergunta], presa (tool_use_id) a uma chamada
// AskUserQuestion do assistente com a mesma pergunta, na conversa principal (fora de ajudante).
function provasNa(arquivo, pergunta) {
  let linhas; try { linhas = readFileSync(arquivo, 'utf8').split('\n'); } catch { return []; }
  const chamadas = new Map(), achadas = [];
  for (const l of linhas) {
    if (!l.includes('AskUserQuestion') && !l.includes('"answers"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.isSidechain) continue;
    const partes = Array.isArray(o.message?.content) ? o.message.content : [];
    if (o.type === 'assistant') for (const c of partes) if (c.type === 'tool_use' && c.name === 'AskUserQuestion') chamadas.set(c.id, { uuid: o.uuid, perguntas: (c.input?.questions || []).map(q => q.question) });
    if (o.type === 'user' && o.toolUseResult?.answers && Object.hasOwn(o.toolUseResult.answers, pergunta)) {
      const tr = partes.find(c => c.type === 'tool_result');
      const ch = tr && chamadas.get(tr.tool_use_id);
      if (!ch || !ch.perguntas.includes(pergunta) || (o.sourceToolAssistantUUID && o.sourceToolAssistantUUID !== ch.uuid)) continue;
      achadas.push({ uuid: o.uuid, hora: o.timestamp, resposta: String(o.toolUseResult.answers[pergunta]), conversa: o.sessionId });
    }
  }
  return achadas;
}
function conversasRecentes() {
  const limite = Date.now() - VALIDADE_H * 3600000;
  let nomes = []; try { nomes = readdirSync(PROJETO).filter(f => f.endsWith('.jsonl')); } catch { return []; }
  return nomes.map(f => join(PROJETO, f)).filter(f => statSync(f).mtimeMs >= limite).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}
function motivoInvalida(card, p, opcao) {
  const criado = Date.parse(String(card.criado || card.criadoEm || ''));
  if (!Number.isFinite(criado)) return 'card sem hora de criação legível (campo criado, em ISO)';
  if (Date.parse(p.hora) < criado - 60000) return 'resposta mais velha que o card';
  if (Date.now() - Date.parse(p.hora) > VALIDADE_H * 3600000) return `resposta com mais de ${VALIDADE_H} h`;
  if (p.resposta !== opcao) return `a resposta foi "${p.resposta}", não "${opcao}"`;
  if (!rotulos(card).includes(opcao)) return 'a opção não é uma das opções do card';
  return null;
}

export function responder(id, opcao) {
  const { arquivo, card } = lerCard(id);
  if (card.respondido) throw Error('card já respondido: ' + String(card.respondido).slice(0, 80));
  const pergunta = String(card.pergunta || '');
  let motivo = `nenhuma tela de escolha com a pergunta exata do card nas conversas das últimas ${VALIDADE_H} h`;
  for (const conv of conversasRecentes()) {
    for (const p of provasNa(conv, pergunta).reverse()) {
      const m = motivoInvalida(card, p, opcao);
      if (m) { motivo = m; continue; }
      card.respondido = `${p.hora} ${opcao} (com prova)`;
      card.respondidoEm = p.hora;
      card.prova = { conversa: p.conversa, uuid: p.uuid, hora: p.hora, resposta: opcao };
      writeFileSync(arquivo, JSON.stringify(card, null, 2) + '\n', 'utf8');
      return card.prova;
    }
  }
  throw Error('sem prova: ' + motivo);
}

export function conferir(id, exige) {
  if (!exige) return { ok: false, motivo: 'falta a opção que autoriza (uso: conferir <id> "<opção que autoriza>")' };
  const { card } = lerCard(id);
  const p = card.prova;
  if (!p || !p.conversa || !p.uuid) return { ok: false, motivo: 'card sem prova (sem resposta, ou respondido pelo painel ou à mão): mostre a tela de escolha com a pergunta do card' };
  if (p.resposta !== exige) return { ok: false, motivo: `a escolha foi "${p.resposta}", não "${exige}"` };
  if (!/^[0-9a-f-]{36}$/i.test(p.conversa)) return { ok: false, motivo: 'conversa da prova inválida' };
  const achada = provasNa(join(PROJETO, p.conversa + '.jsonl'), String(card.pergunta || '')).find(x => x.uuid === p.uuid);
  if (!achada) return { ok: false, motivo: 'a resposta citada não está na conversa com a pergunta exata do card' };
  const m = motivoInvalida(card, achada, String(p.resposta));
  if (m) return { ok: false, motivo: m };
  if (!String(card.respondido || '').includes(p.resposta)) return { ok: false, motivo: 'o respondido do card não bate com a prova' };
  return { ok: true, resposta: p.resposta, hora: achada.hora };
}

if (process.argv[1] && /prova-card\.mjs$/i.test(process.argv[1])) {
  const [cmd, id, opcao] = process.argv.slice(2);
  try {
    if (cmd === 'responder') { const p = responder(id, opcao); console.log(`RESPONDIDO COM PROVA: ${id} = "${p.resposta}" (${p.hora})`); }
    else if (cmd === 'conferir') { const r = conferir(id, opcao); console.log(r.ok ? `PROVA OK: ${id} = "${r.resposta}" (${r.hora})` : `SEM PROVA: ${id}: ${r.motivo}. Não aja.`); process.exit(r.ok ? 0 : 1); }
    else { console.log('uso: node prova-card.mjs responder <id> "<opção exata>" | conferir <id> "<opção que autoriza>"'); process.exit(1); }
  } catch (e) { console.log('ERRO: ' + e.message); process.exit(1); }
}
