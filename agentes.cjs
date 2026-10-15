'use strict';

// Nada vem da rede; cada imagem so entra se o sha256 bater com o manifesto.
// Formato de assets/agentes/manifest.json:
//   { "version": 1, "status": "verified", "updated": "<ISO>", "entries": [{ "id": "a1", "asset": "a1.png", "sha256": "<64 hex>" }] }
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const FALLBACK = Object.freeze({ id: null, image: '/agente.png', verified: false });
const MAX_POOL = 128;
const SOURCE = Object.freeze({
  manifest: 'assets/agentes/manifest.json',
  images: 'assets/agentes/<asset>',
  rule: 'sha256 do arquivo igual ao do manifesto'
});

function safeFile(base, relative, limit) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..') || /(?:PRIVADO|_SECRETS|backup-privado|\.env|seed|auth\.json)/i.test(relative)) return null;
  try {
    if (fs.lstatSync(base).isSymbolicLink()) return null;
    const root = fs.realpathSync(base);
    let current = root;
    const parts = relative.split('/');
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index]);
      const entry = fs.lstatSync(current);
      if (entry.isSymbolicLink() || (index < parts.length - 1 ? !entry.isDirectory() : !entry.isFile())) return null;
      if (index === parts.length - 1 && entry.size > limit) return null;
    }
    const real = fs.realpathSync(current);
    if (path.relative(root, real).startsWith('..') || path.isAbsolute(path.relative(root, real))) return null;
    return real;
  } catch { return null; }
}

const ID = /^[A-Za-z0-9][\w-]{0,39}$/;
const ASSET = /^[A-Za-z0-9][\w-]{0,59}\.(?:png|webp)$/;

function loadVerifiedPool(panelRoot = __dirname) {
  const vazio = { pool: [], status: 'unverified-pool', updated: null, sources: SOURCE };
  const file = safeFile(panelRoot, 'assets/agentes/manifest.json', 128000);
  if (!file) return vazio;
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (manifest.version !== 1 || manifest.status !== 'verified' || !Array.isArray(manifest.entries) || manifest.entries.length > MAX_POOL || !Number.isFinite(Date.parse(manifest.updated))) throw Error('Unverified manifest');
    const seen = new Set();
    const pool = manifest.entries.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !ID.test(entry.id) || seen.has(entry.id) || typeof entry.asset !== 'string' || !ASSET.test(entry.asset) || !/^[a-f\d]{64}$/.test(entry.sha256 || '')) throw Error('Invalid entry');
      const image = safeFile(panelRoot, 'assets/agentes/' + entry.asset, 150000);
      if (!image || createHash('sha256').update(fs.readFileSync(image)).digest('hex') !== entry.sha256) throw Error('Missing or changed image');
      seen.add(entry.id);
      return { id: entry.id, image: '/assets/agentes/' + entry.asset, verified: true };
    });
    return { pool, status: pool.length ? 'verified' : 'unverified-pool', updated: manifest.updated, sources: SOURCE };
  } catch { return vazio; }
}

function stableHash(value) { return createHash('sha256').update(String(value)).digest().readUInt32BE(0); }

// A distribuicao e pura em relacao ao disco: ids de teste opacos bastam para exercitar colisoes.
function createPoolResolver(pool = [], metadata = {}) {
  const assignments = new Map();
  const occupied = new Map();
  const candidates = pool.map(agente => Object.freeze({ ...agente }));
  const unique = new Set(candidates.map(agente => agente.id));
  if (unique.size !== candidates.length) throw Error('Duplicate pool');
  function release(agentId) {
    const previous = assignments.get(agentId);
    if (previous) { occupied.delete(previous.id); assignments.delete(agentId); }
  }
  function choose(agentId) {
    if (assignments.has(agentId)) return assignments.get(agentId);
    if (!candidates.length) return { ...FALLBACK, reason: 'unverified-pool' };
    const start = stableHash(agentId) % candidates.length;
    for (let offset = 0; offset < candidates.length; offset++) {
      const candidate = candidates[(start + offset) % candidates.length];
      if (occupied.has(candidate.id)) continue;
      assignments.set(agentId, candidate);
      occupied.set(candidate.id, agentId);
      return candidate;
    }
    return { ...FALLBACK, reason: 'pool-exhausted' };
  }
  return {
    assign(agents) {
      if (!Array.isArray(agents)) return [];
      // Ordem estavel: o resultado inicial nao depende da ordem das linhas.
      const pending = agents.filter(agent => typeof agent?.id === 'string' && agent.id && !assignments.has(agent.id)).map(agent => agent.id);
      for (const id of [...new Set(pending)].sort((a, b) => stableHash(a) - stableHash(b) || a.localeCompare(b))) choose(id);
      const visible = new Set();
      return agents.map(agent => {
        if (!agent || typeof agent.id !== 'string' || !agent.id) return { ...agent, agente: { ...FALLBACK, reason: 'invalid-agent' } };
        if (visible.has(agent.id)) return { ...agent, agente: { ...FALLBACK, reason: 'duplicate-agent' } };
        visible.add(agent.id);
        return { ...agent, agente: { ...choose(agent.id) } };
      });
    },
    release,
    info() { return { origin: 'local', status: metadata.status || (candidates.length ? 'verified' : 'unverified-pool'), verification: metadata.verification || null, poolSize: candidates.length, assigned: assignments.size, updated: metadata.updated || null, sources: metadata.sources || SOURCE }; }
  };
}

function createAvatarResolver(panelRoot = __dirname) {
  const reading = loadVerifiedPool(panelRoot);
  return createPoolResolver(reading.pool, reading);
}

module.exports = { createAvatarResolver, createPoolResolver, loadVerifiedPool, stableHash, safeFile, SOURCE, MAX_POOL };
