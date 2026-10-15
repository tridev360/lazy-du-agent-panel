// Lê só arquivos locais que já existem, e só hora e id (nunca o texto de conversa):
//  1. estado/sessoes-claude.json: título e id do app de cada sessão (o mesmo que o painel 3250 usa);
//  2. %APPDATA%/Claude/claude-code-sessions/<conta>/<org>/local_<id>.json: só cliSessionId, isArchived e lastActivityAt;
//  3. ~/.claude/projects/<projeto>/<cliSessionId>.jsonl e a pasta subagents ao lado: só a hora do arquivo;
//  4. sem conversa achada: a hora do estado/<sessao>.md (atendimento.md, assistente.md, loja.md, cortes.md; COORDENADOR: coordenador-passagem.md e coordenador-frentes.md).
// Nada lido: "?" (nunca "parada" inventada).
import { statSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const ONLINE_MS = 10 * 60000;
export const SESSOES = ['ATENDIMENTO', 'ASSISTENTE', 'LOJA', 'CORTES', 'COORDENADOR'];
const ARQUIVOS_DO_ESTADO = { ATENDIMENTO: ['atendimento.md'], ASSISTENTE: ['assistente.md'], LOJA: ['loja.md'], CORTES: ['cortes.md'], COORDENADOR: ['coordenador-passagem.md', 'coordenador-frentes.md'] };
const LOCAL = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PASTAS = 400, MAX_SUB = 2000, FUTURO_MS = 2 * 60000;

function arquivo(f) { try { const st = statSync(f); return st.isFile() ? st : null; } catch { return null; } }
function pastas(dir) { try { return readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.isSymbolicLink()).slice(0, MAX_PASTAS).map(d => d.name); } catch { return []; } }
function lerJson(f, max) { const st = arquivo(f); if (!st || st.size > max) return null; try { return JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } }
const nomeDe = s => String(s?.titulo || '').toUpperCase().trim().replace(/^COORDENACAO$/, 'COORDENADOR');

export function lerEquipe({ estadoDir, appRoot, projetosRoot, agora = Date.now() } = {}) {
  const valida = t => Number.isFinite(t) && t > 0 && t <= agora + FUTURO_MS;
  const lista = estadoDir ? lerJson(path.join(estadoDir, 'sessoes-claude.json'), 256 * 1024) : null;
  const sessoes = Array.isArray(lista?.sessoes) ? lista.sessoes : [];
  const contas = appRoot ? pastas(appRoot).flatMap(c => pastas(path.join(appRoot, c)).map(o => path.join(appRoot, c, o))) : [];
  const projetos = projetosRoot ? pastas(projetosRoot) : [];
  const out = {};
  for (const nome of SESSOES) {
    // Se houver mais de uma linha com o mesmo nome, vale a marcada como ativa.
    const linhas = sessoes.filter(s => nomeDe(s) === nome && LOCAL.test(String(s.sessionId || '')));
    const item = linhas.find(s => s.ativa !== false) || linhas[0];
    let conversa = null, arquivada = false;
    if (item) {
      for (const dir of contas) {
        const app = lerJson(path.join(dir, `${item.sessionId}.json`), 1024 * 1024);
        if (!app || app.sessionId !== item.sessionId) continue;
        arquivada = app.isArchived === true;
        const t = Date.parse(app.lastActivityAt);
        if (valida(t)) conversa = Math.max(conversa ?? 0, t);
        const cli = typeof app.cliSessionId === 'string' && UUID.test(app.cliSessionId) ? app.cliSessionId.toLowerCase() : null;
        if (cli) for (const p of projetos) {
          const st = arquivo(path.join(projetosRoot, p, `${cli}.jsonl`));
          if (st && valida(st.mtimeMs)) conversa = Math.max(conversa ?? 0, st.mtimeMs);
          const sub = path.join(projetosRoot, p, cli, 'subagents');
          let nomes = [];
          try { nomes = readdirSync(sub).filter(n => /^agent-[0-9a-z]{6,40}\.jsonl$/i.test(n)).slice(0, MAX_SUB); } catch { /* sem ajudantes */ }
          for (const n of nomes) { const s2 = arquivo(path.join(sub, n)); if (s2 && valida(s2.mtimeMs)) conversa = Math.max(conversa ?? 0, s2.mtimeMs); }
        }
        break;
      }
    }
    let ultima = conversa, fonte = conversa ? 'conversa' : null;
    if (!ultima && estadoDir) {
      for (const f of ARQUIVOS_DO_ESTADO[nome]) {
        const st = arquivo(path.join(estadoDir, f));
        if (st && valida(st.mtimeMs)) { ultima = Math.max(ultima ?? 0, st.mtimeMs); fonte = 'estado'; }
      }
    }
    if (!ultima) { out[nome] = { estado: '?', ultimaEm: null, minutos: null, fonte: null }; continue; }
    const minutos = Math.max(0, Math.floor((agora - ultima) / 60000));
    const estado = agora - ultima <= ONLINE_MS ? 'online' : arquivada ? 'fechada' : 'parada';
    out[nome] = { estado, ultimaEm: new Date(ultima).toISOString(), minutos, fonte };
  }
  return { lidoEm: new Date(agora).toISOString(), onlineMin: ONLINE_MS / 60000, sessoes: out };
}

// Cache curto: a tela pede a fila a cada 12 s; a equipe é relida no máximo a cada 15 s.
export function criarLeitorDeEquipe(opcoes = {}) {
  const cfg = {
    estadoDir: opcoes.estadoDir,
    appRoot: opcoes.appRoot ?? path.join(process.env.APPDATA || path.join((process.env.PAINEL_HOME || os.homedir()), 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions'),
    projetosRoot: opcoes.projetosRoot ?? path.join((process.env.PAINEL_HOME || os.homedir()), '.claude', 'projects'),
  };
  let cache = null, em = 0;
  return () => {
    const agora = Date.now();
    if (!cache || agora - em >= 15000) {
      try { cache = lerEquipe({ ...cfg, agora }); } catch { cache = { lidoEm: new Date(agora).toISOString(), onlineMin: ONLINE_MS / 60000, sessoes: Object.fromEntries(SESSOES.map(s => [s, { estado: '?', ultimaEm: null, minutos: null, fonte: null }])) }; }
      em = agora;
    }
    return cache;
  };
}
