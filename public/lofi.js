(function(root) {
  'use strict';
  const ORIGIN = 'https://www.youtube-nocookie.com';
  const KEY = 'painel-lofi-sound-v1';
  const liveWords = { en: 'Live 24/7', pt: 'Ao vivo 24h', es: 'En vivo 24h' };
  function stationOf(radio) {
    const name = typeof radio?.nome === 'string' ? radio.nome : '';
    const live = /\s*\(ao\s+vivo\s*24h\)\s*$/i.test(name);
    return { name: live ? name.replace(/\s*\(ao\s+vivo\s*24h\)\s*$/i, '') : name, live };
  }
  const words = {
    en: { title: 'Lofi', play: 'Play', pause: 'Pause', close: 'Close player', mute: 'Mute', unmute: 'Sound on', volume: 'Volume', loading: 'Connecting to the radio...', ready: 'Radio ready. Use the player to start.', error: 'Radio unavailable. Check your connection and try again.', retry: 'Try again', empty: 'No radio configured', muted: 'Muted', paused: 'Paused', playing: 'Playing', frame: 'Official YouTube radio player' },
    pt: { title: 'Lofi', play: 'Tocar', pause: 'Pausar', close: 'Fechar player', mute: 'Silenciar', unmute: 'Ligar som', volume: 'Volume', loading: 'Conectando à rádio...', ready: 'Rádio pronta. Use o player para tocar.', error: 'Rádio indisponível. Confira a conexão e tente de novo.', retry: 'Tentar de novo', empty: 'Nenhuma rádio configurada', muted: 'Mudo', paused: 'Pausado', playing: 'Tocando', frame: 'Player oficial da rádio no YouTube' },
    es: { title: 'Lofi', play: 'Reproducir', pause: 'Pausar', close: 'Cerrar reproductor', mute: 'Silenciar', unmute: 'Activar sonido', volume: 'Volumen', loading: 'Conectando con la radio...', ready: 'Radio lista. Usa el reproductor para iniciar.', error: 'Radio no disponible. Revisa la conexión e inténtalo de nuevo.', retry: 'Intentar de nuevo', empty: 'No hay radio configurada', muted: 'Silenciado', paused: 'Pausado', playing: 'Reproduciendo', frame: 'Reproductor oficial de la radio en YouTube' }
  };
  function radioOf(data) {
    return (Array.isArray(data?.lofi?.radios) ? data.lofi.radios : []).find(item => item && typeof item.nome === 'string' && item.nome.length <= 160 && /^[a-zA-Z\d_-]{11}$/.test(item.youtube));
  }
  function radiosOf(data) { return (Array.isArray(data?.lofi?.radios) ? data.lofi.radios : []).filter(item => radioOf({lofi:{radios:[item]}})).filter((item,index,list)=>list.findIndex(other=>other.youtube===item.youtube)===index).slice(0,3); }
  function frameUrl(radio, origin) {
    if (!radio || !/^[a-zA-Z\d_-]{11}$/.test(radio.youtube)) return null;
    const params = new URLSearchParams({ autoplay: '1', mute: '1', playsinline: '1', controls: '1', enablejsapi: '1', origin });
    return ORIGIN + '/embed/' + radio.youtube + '?' + params;
  }
  function validMessage(event, frame) { return !!frame && event.source === frame.contentWindow && event.origin === ORIGIN && typeof event.data === 'string' && event.data.length <= 32000; }
  function init(options = {}) {
    const doc = root.document;
    if (doc.getElementById('lofi-trigger')) return root.DuLofi.instance;
    const getData = typeof options.getData === 'function' ? options.getData : () => null;
    const language = () => { const value = typeof options.lang === 'function' ? options.lang() : options.lang || doc.documentElement.lang; return /^pt/i.test(value) ? 'pt' : /^es/i.test(value) ? 'es' : 'en'; };
    const t = key => words[language()][key];
    const make = (tag, cls) => { const el = doc.createElement(tag); if (cls) el.className = cls; return el; };
    const button = make('button', 'lofi-trigger'); button.id = 'lofi-trigger'; button.type = 'button'; button.textContent = '♫ Lofi';
    button.setAttribute('aria-controls', 'lofi-player'); button.setAttribute('aria-expanded', 'false');
    (doc.querySelector('.header-actions') || doc.body).append(button);
    const panel = make('section', 'lofi-player'); panel.id = 'lofi-player'; panel.hidden = true; panel.setAttribute('aria-label', 'Lofi');
    const head = make('div', 'lofi-head'), caption = make('div', 'lofi-caption'), title = make('strong'), availability = make('span', 'lofi-availability'), close = make('button'); close.type = 'button'; close.textContent = '×';
    caption.append(title, availability); head.append(caption, close);
    const mount = make('div', 'lofi-frame'), status = make('p', 'lofi-status'); status.setAttribute('role', 'status');
    const controls = make('div', 'lofi-controls'), pause = make('button'), mute = make('button'), retry = make('button');
    for (const el of [pause, mute, retry]) el.type = 'button';
    const volumeLabel = make('label'), volume = make('input'); volume.id = 'lofi-volume'; volume.type = 'range'; volume.min = '0'; volume.max = '100'; volume.step = '1'; volumeLabel.htmlFor = volume.id;
    controls.append(pause, mute); const volumeRow = make('div', 'lofi-volume'); volumeRow.append(volumeLabel, volume);
    const external = make('a', 'lofi-external'); external.id='lofi-youtube'; external.target='_blank'; external.rel='noopener noreferrer'; external.hidden=true;
    panel.append(head, mount, status, controls, volumeRow, retry, external);
    const main = doc.querySelector('.shell > main') || doc.querySelector('main');
    let layout;
    if (main?.parentNode?.insertBefore) {
      layout = make('div', 'lofi-layout'); main.parentNode.insertBefore(layout, main); layout.append(main, panel);
    } else doc.body.append(panel);
    let frame = null, ready = false, paused = false, playerState = null, state = 'idle', timer, handshake, lastFocus, radioIndex=0, activeRadio=null, failure=null;
    let preferences = { muted: true, volume: 15 };
    try { const saved = JSON.parse(root.sessionStorage.getItem(KEY)); if (saved && typeof saved.muted === 'boolean') preferences.muted = saved.muted; if (Number.isFinite(saved?.volume)) preferences.volume = Math.max(0, Math.min(100, saved.volume)); } catch {}
    const persist = () => { try { root.sessionStorage.setItem(KEY, JSON.stringify(preferences)); } catch {} };
    const gesture = () => { options.onUserGesture?.(); doc.dispatchEvent(new root.CustomEvent('painel:user-gesture')); };
    const getState = () => ({ open: !panel.hidden, ready, playing: ready && playerState === 1, paused: ready && playerState === 2, muted: preferences.muted, volume: preferences.volume, status: state, error: failure, radio: activeRadio?.youtube || null, backup:radioIndex>0 });
    function command(func, args = []) { frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args, id: 'painel-lofi-frame' }), ORIGIN); }
    function update() {
      close.setAttribute('aria-label', t('close')); volumeLabel.textContent = t('volume'); volume.setAttribute('aria-label', t('volume')); volume.value = String(preferences.volume);
      mute.textContent = t(preferences.muted ? 'unmute' : 'mute'); mute.setAttribute('aria-pressed', String(preferences.muted));
      pause.textContent = t(playerState === 1 ? 'pause' : 'play'); pause.disabled = mute.disabled = volume.disabled = !ready;
      retry.textContent = t('retry'); retry.hidden = !['error','empty'].includes(state);
      panel.setAttribute('data-lofi-state',state);
      status.textContent = t(state === 'empty' ? 'empty' : state === 'error' ? 'error' : !ready || playerState === 3 ? 'loading' : playerState === 2 ? 'paused' : playerState === 1 ? preferences.muted ? 'muted' : 'playing' : 'ready');
      const extras={pt:{external:'Abrir no YouTube',blocked:'YouTube bloqueou o player',timeout:'O player não respondeu',offline:'Sem conexão',backup:'Rádio reserva'},en:{external:'Open on YouTube',blocked:'YouTube blocked the player',timeout:'Player did not respond',offline:'Offline',backup:'Backup radio'},es:{external:'Abrir en YouTube',blocked:'YouTube bloqueó el reproductor',timeout:'El reproductor no respondió',offline:'Sin conexión',backup:'Radio de reserva'}}[language()];
      status.title=failure?(Number.isInteger(failure)?extras.blocked+' ('+failure+')':extras[failure]||t('error')):'';
      if(failure)status.textContent=state==='error'?status.title:extras.backup+' · '+status.textContent;
      external.textContent=extras.external;external.hidden=panel.hidden||!activeRadio; if(activeRadio)external.href='https://www.youtube.com/watch?v='+activeRadio.youtube;
      const station = stationOf(activeRadio || radioOf(getData()));
      title.textContent = station.name || t('title'); availability.hidden = !station.live; availability.textContent = station.live ? liveWords[language()] : '';
      if (frame) frame.title = t('frame') + (station.name ? ' · ' + station.name : '');
      layout?.classList.toggle('has-lofi', !panel.hidden);
      button.setAttribute('aria-expanded', String(!panel.hidden)); button.title = radioOf(getData()) ? t('title') : t('empty');
      doc.dispatchEvent(new root.CustomEvent('painel-lofi-state', { detail: getState() }));
    }
    function stop() {
      clearTimeout(timer); clearInterval(handshake); frame?.remove(); frame = null; ready = false; playerState = null; state = 'idle'; panel.hidden = true; update();
    }
    function fail(reason='network') { clearTimeout(timer); clearInterval(handshake); failure=reason; state = 'error'; ready = false; playerState = null; frame?.remove(); frame = null;
      const next=radiosOf(getData())[radioIndex+1];if(next&&reason!=='offline'&&root.navigator?.onLine!==false){radioIndex++;start(true);return;} update(); }
    function start(reserve=false) {
      if(reserve!==true){gesture();radioIndex=0;failure=null;} const radio = radiosOf(getData())[radioIndex];activeRadio=radio || null; if (!radio) { stop(); lastFocus=doc.activeElement; panel.hidden=false; state='empty'; update(); close.focus(); return; }
      stop(); panel.hidden = false; state = 'loading'; paused = false; lastFocus = doc.activeElement;
      if (root.navigator?.onLine === false) { fail('offline'); close.focus(); return; }
      frame = make('iframe'); frame.id = 'painel-lofi-frame'; frame.title = t('frame'); frame.width = '320'; frame.height = '200';
      frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture'); frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.src = frameUrl(radio, root.location.origin); mount.replaceChildren(frame);
      const activeFrame = frame;
      const listening = () => { if (frame === activeFrame) activeFrame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'painel-lofi-frame', channel: 'painel-lofi' }), ORIGIN); };
      frame.addEventListener('load', () => { if (frame !== activeFrame) return; clearInterval(handshake); listening(); if (!ready) handshake = setInterval(listening, 500); }); frame.addEventListener('error', () => { if (frame === activeFrame) fail(); });
      timer = setTimeout(()=>{if(frame===activeFrame)fail('timeout');}, 45000); update(); if(!reserve)close.focus();
    }
    function onMessage(event) {
      if (!validMessage(event, frame)) return;
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (data.event === 'onError') { fail(Number.isInteger(data.info)?data.info:'network'); return; }
      if (data.event === 'onReady' || data.event === 'initialDelivery' || data.event === 'infoDelivery' && Number.isFinite(data.info?.playerState)) {
        const firstReady = !ready;
        if (firstReady) { ready = true; state = 'ready'; clearTimeout(timer); clearInterval(handshake); command('setVolume', [preferences.volume]); command(preferences.muted ? 'mute' : 'unMute'); command('addEventListener', ['onStateChange']); command('addEventListener', ['onError']); }
        if (!firstReady && typeof data.info?.muted === 'boolean') { preferences.muted = data.info.muted; persist(); }
        if (Number.isFinite(data.info?.playerState)) playerState = data.info.playerState;
        if (!firstReady && Number.isFinite(data.info?.volume)) { preferences.volume = Math.max(0, Math.min(100, data.info.volume)); persist(); }
        paused = playerState === 2;
        update();
      }
      if (data.event === 'onStateChange' && Number.isFinite(data.info)) { playerState = data.info; paused = playerState === 2; update(); }
    }
    button.addEventListener('click', () => { if (panel.hidden) start(); else { stop(); button.focus(); } });
    close.addEventListener('click', () => { stop(); lastFocus?.focus?.(); }); retry.addEventListener('click', start);
    pause.addEventListener('click', () => { if (!ready) return; gesture(); command(playerState === 1 ? 'pauseVideo' : 'playVideo'); });
    mute.addEventListener('click', () => { if (!ready) return; gesture(); preferences.muted = !preferences.muted; command('setVolume', [preferences.volume]); command(preferences.muted ? 'mute' : 'unMute'); persist(); update(); });
    volume.addEventListener('input', () => { if (!ready) return; gesture(); preferences.volume = Number(volume.value); command('setVolume', [preferences.volume]); persist(); update(); });
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); stop(); button.focus(); } });
    root.addEventListener('message', onMessage); root.addEventListener('offline', () => { if (frame) fail('offline'); });
    root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden&&!doc.querySelector('dialog[open]')){event.preventDefault();stop();button.focus();}});
    doc.getElementById('language')?.addEventListener('change', update);
    function toggle(event) {
      if (!panel.hidden) { stop(); button.focus(); return true; }
      const trustedEvent = event?.isTrusted === true && ['click', 'keydown', 'pointerup', 'touchend'].includes(event.type);
      if (!trustedEvent && root.navigator?.userActivation?.isActive !== true) return false;
      start(); return !panel.hidden;
    }
    update(); root.DuLofi.instance = { update, stop, toggle, getState, playing: () => getState().playing, isPlaying: () => getState().playing }; return root.DuLofi.instance;
  }
  const api = { init, radioOf, radiosOf, frameUrl, validMessage, stationOf };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DuLofi = api;
})(typeof window === 'object' ? window : globalThis);
