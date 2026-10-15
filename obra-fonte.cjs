'use strict';
// Read-only sources. The manifest supplies provenance, never additional paths to open.
const fs = require('node:fs');
const path = require('node:path');
const Model = require('./obra-modelo.js');
const LIMITS = Object.freeze({ 'estado/LANCAMENTO.md': 256 * 1024, 'estado/projetos.json': 64 * 1024, 'obra-retrato.json': 256 * 1024 });
const SAFE_WORK = /^(?!.*(?:\.env|privado|segredos|backup-privado|(?:^|[-_.])(?:seed|mnemonic|chave)(?:[-_.]|$)))[a-z\d_.-]+\.md$/i;
const cache = new Map();
function headerBytes(fd, maxBytes) {
  const byte = Buffer.alloc(1), chunks = []; let line = [], lineCount = 0, yaml = false, complete = false;
  const allowed = /^(?:[-*]\s*)?(?:\*\*)?(?:id|titulo|nome|dono|status|estado|projeto)\s*(?:\*\*)?:/i;
  // Read exactly through the header boundary, without reading a task's body into memory.
  for (let offset = 0; offset < maxBytes; offset++) {
    const count = fs.readSync(fd, byte, 0, 1, null);
    if (!count) { complete = !yaml; break; }
    line.push(byte[0]);
    if (byte[0] !== 10) continue;
    const value = Buffer.from(line).toString('utf8').replace(/^\uFEFF/, '').trim();
    if (!lineCount) yaml = value === '---';
    lineCount++;
    if (yaml) { chunks.push(...line); if (lineCount > 1 && value === '---') { line = []; complete = true; break; } }
    else {
      if (/^#{2,6}\s/.test(value) || value && !allowed.test(value) && !(lineCount === 1 && /^#\s/.test(value)) && !/^---$/.test(value)) { line = []; complete = true; break; }
      chunks.push(...line);
    }
    line = [];
    if (lineCount >= 32) break;
  }
  if (line.length) {
    const value = Buffer.from(line).toString('utf8').replace(/^\uFEFF/, '').trim();
    if (yaml || allowed.test(value) || /^#\s/.test(value)) chunks.push(...line);
  }
  return { raw: Buffer.from(chunks).toString('utf8').replace(/^\uFEFF/, ''), complete };
}
function bounded(root, relative, maxBytes, now = Date.now()) {
  if (!Object.hasOwn(LIMITS, relative) && !/^tasks\/[a-z\d_.-]+\.md$/i.test(relative)) return { error: 'path denied' };
  if (relative.startsWith('tasks/') && !SAFE_WORK.test(relative.slice(6))) return { error: 'path denied' };
  const file = path.resolve(root, ...relative.split('/'));
  let fd;
  try {
    if (fs.lstatSync(path.resolve(root)).isSymbolicLink()) return { error: 'path denied' };
    let component = path.resolve(root);
    for (const segment of relative.split('/')) {
      component = path.join(component, segment);
      if (fs.lstatSync(component).isSymbolicLink()) return { error: 'path denied' };
    }
    const realRoot = fs.realpathSync(root), realFile = fs.realpathSync(file);
    const within = path.relative(realRoot, realFile);
    if (!within || within.startsWith('..' + path.sep) || path.isAbsolute(within)) return { error: 'path denied' };
    const stat = fs.statSync(realFile);
    if (!stat.isFile()) return { error: 'not a file' };
    const cacheKey = realFile + ':' + maxBytes, hit = cache.get(cacheKey);
    if (hit?.size === stat.size && hit?.mtime === stat.mtimeMs) return hit.value;
    fd = fs.openSync(realFile, 'r');
    let raw, headerComplete = true;
    if (relative.startsWith('tasks/')) { const header = headerBytes(fd, maxBytes); raw = header.raw; headerComplete = header.complete; }
    else {
      const size = Math.min(stat.size, maxBytes), buffer = Buffer.alloc(size);
      const length = fs.readSync(fd, buffer, 0, size, 0);
      raw = buffer.subarray(0, length).toString('utf8').replace(/^\uFEFF/, '');
    }
    const value = { raw, headerComplete, observedAt: new Date(now).toISOString(), mtime: stat.mtime.toISOString(), truncated: stat.size > maxBytes, file: relative };
    cache.set(cacheKey, { size: stat.size, mtime: stat.mtimeMs, value });
    if (cache.size > 450) cache.delete(cache.keys().next().value);
    return value;
  } catch (error) { return { error: error.code === 'ENOENT' ? 'missing' : 'unreadable', file: relative }; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function read(root, now = Date.now()) {
  const clock = now instanceof Date ? now.getTime() : Number(now), readAt = new Date(clock).toISOString(), warnings = [];
  const manifestFile = bounded(root, 'obra-retrato.json', LIMITS['obra-retrato.json']); let manifest = null;
  if (!manifestFile.error && !manifestFile.truncated) { try { manifest = JSON.parse(manifestFile.raw); } catch { warnings.push('manifesto do retrato invalido; hora da copia nao usada como leitura original'); } }
  const isSnapshot = !!manifest || path.basename(path.resolve(root)).toLowerCase().includes('retrato');
  const proofFor = (relative, file) => {
    const original = manifest?.originals?.[relative];
    return { file: Model.text(original?.file || relative, 300), mtime: original?.mtime || file.mtime || null,
      readAt: original?.readAt || manifest?.readAt || (!isSnapshot ? file.observedAt || readAt : null) };
  };
  const launchFile = bounded(root, 'estado/LANCAMENTO.md', LIMITS['estado/LANCAMENTO.md'], clock);
  const registryFile = bounded(root, 'estado/projetos.json', LIMITS['estado/projetos.json'], clock);
  const launch = { raw: launchFile.error || launchFile.truncated ? '' : launchFile.raw, source: proofFor('estado/LANCAMENTO.md', launchFile) };
  if (launchFile.error || launchFile.truncated) warnings.push('LANCAMENTO.md: ' + (launchFile.truncated ? 'limite de leitura; lista nao contada pela metade' : launchFile.error));
  let registryRaw = null;
  if (!registryFile.error && !registryFile.truncated) { try { registryRaw = JSON.parse(registryFile.raw); } catch { warnings.push('projetos.json: JSON invalido'); } }
  else warnings.push('projetos.json: ' + (registryFile.truncated ? 'limite de leitura' : registryFile.error));
  const registry = { raw: registryRaw, source: proofFor('estado/projetos.json', registryFile) }, tasks = [];
  try {
    const taskDir = path.join(root, 'tasks');
    if (fs.lstatSync(taskDir).isSymbolicLink() || fs.lstatSync(path.resolve(root)).isSymbolicLink()) throw new Error('path denied');
    const relativeDir = path.relative(fs.realpathSync(root), fs.realpathSync(taskDir));
    if (relativeDir.startsWith('..' + path.sep) || path.isAbsolute(relativeDir)) throw new Error('path denied');
    const entries = fs.readdirSync(taskDir, { withFileTypes: true }).filter(entry => entry.isFile() && SAFE_WORK.test(entry.name) && !/^_(?:molde|template)/i.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name));
    // Bounded work headers only; no nested folders, work body, Log, or sensitive files.
    for (const entry of entries.slice(0, 500)) {
      const relative = 'tasks/' + entry.name, file = bounded(root, relative, 8192, clock);
      if (file.error) { warnings.push(relative + ': ' + file.error); continue; }
      const header = Model.parseTaskHeader(file.raw);
      if (!file.headerComplete) { header.stage = null; warnings.push(relative + ': cabecalho incompleto ou limite de leitura; etapa ?'); }
      if (header.owner && !/<.*>/.test(header.owner)) tasks.push({ ...header, file: relative, source: proofFor(relative, file) });
    }
    if (entries.length > 500) warnings.push('tasks: limite de 500 cabecalhos; fonte parcial');
  } catch (error) { warnings.push('tasks: ' + (error.code === 'ENOENT' ? 'missing' : 'unreadable')); }
  const data = Model.compose({ registry, launch, tasks, warnings, readAt: manifest?.readAt || (!isSnapshot ? readAt : null) }, clock);
  data.registrySource = Model.sourceProof(registry.source, clock);
  data.snapshot = isSnapshot;
  data.marcos = marcos(launch.raw, Model.sourceProof(launch.source, clock));
  return data;
}
// Marcos do LANCAMENTO.md (opcao e): so a linha que fala do nucleo com data "~dd/mm"; sem linha = null, sem data = null.
function marcos(raw, source) {
  for (const [index, line] of String(raw || '').split(/\r?\n/).entries()) {
    const folded = Model.fold(line);
    if (!/\bnucleo\b/.test(folded) || !/~\s*\d{1,2}\/\d{1,2}/.test(line)) continue;
    const first = /~\s*(\d{1,2}\/\d{1,2})/.exec(line), count = /\bnucleo de (\d+) itens\b/.exec(folded), all = /\btudo\b[^~]*~\s*(\d{1,2}\/\d{1,2})/.exec(folded);
    return { source: { ...source, line: index + 1 }, m1: { data: first ? '~' + first[1] : null, itens: count ? Number(count[1]) : null }, m2: { data: all ? '~' + all[1] : null, itens: null } };
  }
  return null;
}
module.exports = { read, bounded, marcos, LIMITS, SAFE_TASK:SAFE_WORK };
