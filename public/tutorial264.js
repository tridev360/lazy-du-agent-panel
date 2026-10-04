(function(root) {
  'use strict';
  const WORDS = {
    pt: { start: 'Ver como começar', title: 'Como começar', close: 'Fechar vídeo', captions: 'Português', failure: 'Não foi possível abrir o vídeo. Feche e tente de novo.', unavailable: 'O vídeo ainda não está disponível.' },
    en: { start: 'See how to start', title: 'How to start', close: 'Close video', captions: 'English', failure: 'Could not open the video. Close it and try again.', unavailable: 'The video is not available yet.' },
    es: { start: 'Ver cómo empezar', title: 'Cómo empezar', close: 'Cerrar vídeo', captions: 'Español', failure: 'No se pudo abrir el vídeo. Ciérralo e inténtalo de nuevo.', unavailable: 'El vídeo aún no está disponible.' }
  };
  const localeOf = value => typeof value === 'string' ? value.toLowerCase().split(/[-_]/)[0] : '';
  const localAsset = (src, extension) => typeof src === 'string' && new RegExp('^/tutorial-painel/(?:[a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+(?:\\.[a-zA-Z0-9_-]+)*\\.' + extension + '$').test(src);
  const durationText = seconds => {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const total = Math.max(1, Math.round(seconds)), minutes = Math.floor(total / 60), rest = total % 60;
    return minutes ? minutes + ' min' + (rest ? ' ' + rest + ' s' : '') : total + ' s';
  };
  function tutorialFor(manifest, language) {
    const locale = localeOf(language), entry = manifest?.version === 1 && manifest.tutorials?.[locale];
    if (!WORDS[locale] || entry?.locale !== locale || entry.approvalMatched !== true ||
      !localAsset(entry.video?.src, 'mp4') || !localAsset(entry.subtitle?.src, 'vtt') ||
      !/^[a-f0-9]{64}$/.test(entry.video?.sha256 || '') || !/^[a-f0-9]{64}$/.test(entry.subtitle?.sha256 || '') ||
      !Number.isInteger(entry.video?.bytes) || entry.video.bytes < 1 || entry.video.bytes > 5 * 1024 * 1024 ||
      !Number.isInteger(entry.subtitle?.bytes) || entry.subtitle.bytes < 1 || entry.subtitle.bytes > 256 * 1024 ||
      !durationText(entry.durationSeconds)) return null;
    const ownLanguage = new RegExp('(?:^|[./_-])' + locale + '(?=[./_-]|$)');
    if (!ownLanguage.test(entry.video.src) || !ownLanguage.test(entry.subtitle.src)) return null;
    return entry;
  }
  const helpers = { WORDS, localeOf, localAsset, durationText, tutorialFor };
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (!root.document) return;
  const d = root.document, mounts = new Map();
  let manifest = root.PanelTutorialManifest || { version: 1, tutorials: {} }, current = null, restoring = false, serial = 0;
  const make = (tag, text, className) => { const node = d.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
  const dialog = make('dialog', undefined, 'tutorial264-dialog');
  dialog.id = 'panel-tutorial-dialog'; dialog.setAttribute('aria-labelledby', 'panel-tutorial-title');
  const heading = make('div', undefined, 'tutorial264-heading'), title = make('h2'), closeButton = make('button');
  title.id = 'panel-tutorial-title'; closeButton.type = 'button'; closeButton.className = 'tutorial264-close';
  const video = make('video'), message = make('p', '', 'tutorial264-status');
  video.controls = true; video.autoplay = false; video.preload = 'metadata'; video.playsInline = true;
  message.setAttribute('role', 'status'); message.hidden = true;
  heading.append(title, closeButton); dialog.append(heading, video, message); d.body.append(dialog);

  function scrollSnapshot(opener) {
    const nodes = [];
    for (let node = opener?.parentElement; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)
        nodes.push({ node, top: node.scrollTop, left: node.scrollLeft });
    }
    return { x: root.scrollX || 0, y: root.scrollY || 0, nodes };
  }
  function pauseAndUnload() {
    video.pause(); video.removeAttribute('src'); video.replaceChildren(); video.load();
  }
  function restore() {
    if (!current || restoring) return;
    restoring = true;
    const previous = current; current = null;
    pauseAndUnload();
    const active = d.activeElement, ownsFocus = active === d.body || active === dialog || dialog.contains(active) || active === previous.returnFocusNode;
    if (ownsFocus && previous.opener?.isConnected && previous.opener.getClientRects().length && !previous.opener.hidden)
      previous.opener.focus({ preventScroll: true });
    if (ownsFocus || active === previous.opener) {
      for (const item of previous.scroll.nodes) if (item.node.isConnected) {
        item.node.scrollTop = item.top; item.node.scrollLeft = item.left;
      }
      root.scrollTo({ left: previous.scroll.x, top: previous.scroll.y, behavior: 'instant' });
    }
    restoring = false;
  }
  function close() {
    if (!current) return;
    video.pause();
    if (dialog.open) dialog.close();
    restore();
  }
  function failed(text) {
    if (!current) return;
    pauseAndUnload(); video.controls = false;
    message.textContent = text || WORDS[current.locale].failure; message.hidden = false;
  }
  function open(opener, language) {
    const entry = tutorialFor(manifest, language);
    if (!entry || !opener?.isConnected || typeof dialog.showModal !== 'function') return false;
    if (dialog.open) return false;
    const locale = entry.locale, words = WORDS[locale];
    const opening = ++serial;
    current = { opener, returnFocusNode: opener, entryName: opener.dataset.panelTutorial, locale, entry, serial: opening, scroll: scrollSnapshot(opener) };
    title.textContent = words.title; closeButton.textContent = words.close; video.setAttribute('aria-label', words.title);
    message.textContent = ''; message.hidden = true;
    const track = make('track'); track.kind = 'subtitles'; track.srclang = locale; track.label = words.captions;
    track.src = entry.subtitle.src; track.default = true; track.addEventListener('error', () => { if (current?.serial === opening) failed(); });
    video.controls = true; video.replaceChildren(track); video.src = entry.video.src;
    try { dialog.showModal(); video.load(); video.pause(); closeButton.focus({ preventScroll: true }); }
    catch { restore(); return false; }
    return true;
  }
  video.addEventListener('error', () => failed());
  video.addEventListener('loadedmetadata', () => {
    if (current && (!Number.isFinite(video.duration) || Math.abs(video.duration - current.entry.durationSeconds) > 0.25))
      failed(WORDS[current.locale].unavailable);
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (!dialog.open) restore(); });
  closeButton.addEventListener('click', close);

  function paint(host, item) {
    const entry = tutorialFor(manifest, item.language), button = item.button;
    button.hidden = !entry;
    if (entry) button.textContent = WORDS[entry.locale].start + ' (' + durationText(entry.durationSeconds) + ')';
    else button.textContent = '';
    if (!host.contains(button)) host.append(button);
  }
  function mount(host, { entry = 'first-steps', language = d.documentElement.lang } = {}) {
    if (!host?.append || !['welcome', 'first-steps'].includes(entry)) return null;
    for (const [previous] of mounts) if (!previous.isConnected) mounts.delete(previous);
    let item = mounts.get(host);
    if (!item) {
      const button = make('button', '', 'tutorial264-start'); button.type = 'button'; button.hidden = true;
      button.dataset.panelTutorial = entry; button.dataset.button = 'secondary';
      item = { entry, language, button }; mounts.set(host, item);
      button.addEventListener('click', () => open(button, item.language));
    } else { item.language = language; item.entry = entry; item.button.dataset.panelTutorial = entry; }
    paint(host, item);
    if (current && !current.opener?.isConnected && current.entryName === entry) {
      current.opener = item.button;
      close();
    }
    return item.button;
  }
  function retire(entry, resolveFallback) {
    if (!current || current.entryName !== entry) return false;
    const fallback = typeof resolveFallback === 'function' ? resolveFallback() : resolveFallback;
    if (fallback?.isConnected && fallback.getClientRects().length && !fallback.hidden) current.opener = fallback;
    close();
    for (const [host, item] of mounts) if (item.entry === entry) mounts.delete(host);
    return true;
  }
  function configure(next) {
    if (current) close();
    manifest = next?.version === 1 ? next : { version: 1, tutorials: {} };
    for (const [host, item] of mounts) {
      if (!host.isConnected) mounts.delete(host); else paint(host, item);
    }
  }
  function language(next) {
    if (current && current.locale !== localeOf(next)) close();
    for (const [host, item] of mounts) { item.language = next; if (host.isConnected) paint(host, item); else mounts.delete(host); }
  }
  function destroy() {
    close(); for (const item of mounts.values()) item.button.remove(); mounts.clear(); dialog.remove();
  }
  root.PanelTutorial = Object.freeze({ ...helpers, mount, retire, configure, language, open, close, destroy });
})(typeof window === 'object' ? window : globalThis);
