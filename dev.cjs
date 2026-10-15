'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

// Only assets actually served by this panel can participate in development reloads.
// Unlisted names are rejected before any file is opened or directory is traversed.
function assetName(name) {
  if (typeof name !== 'string' || name.length > 160 || name.includes('\\')) return null;
  if (!/^(?:[\w.-]+\.(?:html|js|css|png|svg)|assets\/agentes\/[a-f\d]{16,64}\.(?:png|webp|jpg))$/.test(name)) return null;
  if (/(?:^|\/)(?:\.env|[^/]+\.env|_SECRETS|PRIVADO|backup-privado|seed)(?:$|[/.])/i.test(name)) return null;
  return name;
}
function safeDirectory(root, relative = '') {
  try {
    const base = path.resolve(root), parts = relative ? relative.split('/') : [];
    if (parts.some(part => !/^[\w.-]+$/.test(part) || ['.', '..'].includes(part))) return null;
    let current = base;
    for (const part of ['', ...parts]) {
      if (part) current = path.join(current, part);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return null;
    }
    const resolvedBase = fs.realpathSync(base), resolved = fs.realpathSync(current);
    return resolved === path.join(resolvedBase, ...parts) ? current : null;
  } catch { return null; }
}
function assetBytes(root, name) {
  if (!assetName(name)) return null;
  const directory = path.posix.dirname(name);
  const safe = safeDirectory(root, directory === '.' ? '' : directory);
  if (!safe) return null;
  try {
    const file = path.join(safe, path.posix.basename(name)), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 4 * 1024 * 1024) return null;
    return fs.readFileSync(file);
  } catch { return null; }
}
function createDevController(root, options = {}) {
  if (options.enabled !== true) return { snapshot: () => ({ enabled: false }), refresh() {}, close() {} };
  const serverId = options.serverId || randomBytes(24).toString('hex');
  const fixed = [...new Set((options.assets || []).map(assetName).filter(Boolean))];
  const watchers = new Map();
  let known = new Set(), assetVersion, debounce, poll, closed = false;
  const inventory = () => {
    let pool = [];
    try { pool = typeof options.poolAssets === 'function' ? options.poolAssets() : []; } catch {}
    return [...new Set([...fixed, ...pool.map(assetName).filter(Boolean)])].sort();
  };
  const snapshot = () => ({ enabled: true, assetVersion, serverId });
  const schedule = () => {
    if (closed) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => { debounce = null; refresh(); }, options.debounceMs ?? 1000);
    debounce.unref();
  };
  const synchronizeWatchers = () => {
    const folders = new Set(['', ...[...known].map(name => path.posix.dirname(name)).filter(dir => dir !== '.')]);
    // The pool may arrive after the panel starts. Watch its parent without listing it.
    if (options.poolAssets) { folders.add('assets'); folders.add('assets/agentes'); folders.add('agentes'); }
    for (const [folder, watcher] of watchers) if (!folders.has(folder)) { watcher.close(); watchers.delete(folder); }
    for (const folder of folders) {
      if (watchers.has(folder)) continue;
      const directory = safeDirectory(root, folder);
      if (!directory) continue;
      try {
        const watcher = fs.watch(directory, { persistent: false }, (_event, filename) => {
          const name = filename == null ? '' : String(filename).replace(/\\/g, '/');
          const relative = folder ? folder + '/' + name : name;
          const poolSignal = !!options.poolAssets && ['assets', 'assets/agentes', 'assets/agentes/manifest.json', 'agentes', 'agentes/manifest.json'].includes(relative);
          if (!name || known.has(relative) || poolSignal) schedule();
        });
        watcher.on('error', () => { watcher.close(); watchers.delete(folder); schedule(); });
        watchers.set(folder, watcher);
      } catch {}
    }
  };
  function refresh() {
    if (closed) return;
    const names = inventory(), hash = createHash('sha256');
    for (const name of names) {
      const bytes = assetBytes(root, name);
      hash.update(JSON.stringify(name)).update(':').update(bytes ? createHash('sha256').update(bytes).digest('hex') : 'unavailable').update('\n');
    }
    const next = hash.digest('hex'), previous = assetVersion;
    assetVersion = next; known = new Set(names);
    synchronizeWatchers();
    if (previous && previous !== next) options.onChange?.({ ...snapshot(), reason: 'assets' });
  }
  refresh();
  // A short, unref'd fallback covers unavailable Windows watches and atomic saves.
  poll = setInterval(refresh, options.pollMs ?? 2000); poll.unref();
  return { snapshot, refresh, close() { closed = true; clearTimeout(debounce); clearInterval(poll); for (const watcher of watchers.values()) watcher.close(); watchers.clear(); } };
}
module.exports = { assetName, assetBytes, createDevController };
