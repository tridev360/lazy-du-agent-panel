(() => {
  'use strict';
  //  - Para: Claude (padrao), COORDENADOR do Codex, as duas, ATENDIMENTO, LOJA, ASSISTENTE, CORTES. Os botoes COORDENADOR CODEX,
  //    OS DOIS e COORDENADOR CLAUDE da barra so escolhem o alvo (a conversa antiga abre por "Ver conversa").
  //  - Texto, print (Ctrl+V, arrastar ou o botao Imagem; ate 3, ate 8 MB cada, viram PNG no navegador) e voz do navegador.
  //  - Entrega: alvo do Claude = 1 linha em estado/recados-do-painel.md (POST /api/coordenador-pb/recado; sem a sessao na lista,
  //    POST /api/comando); COORDENADOR do Codex = fila nativa da conversa "COORDENADOR · conversa" (POST /api/comando com threadId).
  //    Os prints vao antes por POST /api/painel-chat/print/<alvo> e o texto leva " prints: <caminhos>" no fim.
  //  - Recibo: "enviado HH:MM" na hora; "entregue HH:MM" quando o COORDENADOR grava em estado/respostas-do-painel.md a linha
  //    "- DD/MM HH:MM | COORDENADOR CLAUDE | painel-<id> | ENTREGUE a <ALVO>" (lida pelo GET /api/coordenador-pb); 3 min sem recibo =
  //    "ainda não entregue" + "Copiar para colar no app".
  //  - Trava: subir, card, env, chave, dinheiro ou mensagem a terceiros nao sai daqui: copia o texto para o chat de quem executa.
  // Sem HTML cru e sem estilo inline em atributo (CSP do painel). Ctrl+K leva a caixa.
  const MAX_TEXT = 1000;
  const MAX_IMAGES = 3;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const PRINT_PATH_CHARS = 120;
  const UNDO_S = 4;
  const WAIT_MS = 3 * 60000;
  const POLL_MS = 10000;
  const WATCH_MS = 30 * 60000;
  const STORE = 'painel-caixa-v1';
  const CODEX_THREAD = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  const ALVOS = Object.freeze([
    { key: 'claude', slug: 'coordenador-claude', family: 'claude', para: 'claude' },
    { key: 'codex', slug: 'coordenador-codex', family: 'codex' },
    { key: 'dois', slug: 'os-dois', family: 'dois', para: 'dois' },
    { key: 'ATENDIMENTO', slug: 'atendimento', family: 'claude', sessao: 'claude:ATENDIMENTO', destino: 'atendimento' },
    { key: 'LOJA', slug: 'loja', family: 'claude', sessao: 'claude:LOJA', destino: 'loja' },
    { key: 'ASSISTENTE', slug: 'assistente', family: 'claude', sessao: 'claude:ASSISTENTE', destino: 'assistente' },
    { key: 'CORTES', slug: 'cortes', family: 'claude', sessao: 'claude:CORTES', destino: 'cortes' }
  ]);
  const alvoOf = key => ALVOS.find(item => item.key === key) || ALVOS[0];

  const W = {
    pt: {
      name: { claude: 'Claude', codex: 'COORDENADOR do Codex', dois: 'As duas COORDENADOR' }, to: 'Para', region: 'Mensagem para as IAs',
      article: key => key === 'dois' ? 'os dois coordenadores' : nameOf('pt', key), toWhom: key => key === 'dois' ? 'para os dois coordenadores' : 'para ' + nameOf('pt', key), chatOf: key => 'no chat de ' + nameOf('pt', key === 'dois' ? 'claude' : key),
      placeholder: (who, prints) => 'Escreva para ' + who + '.' + (prints ? ' Ctrl+V cola um print.' : ''), send: 'Enviar', undo: 'Desfazer', leaving: n => 'Sai em ' + n + ' s.', canceled: 'Desfeito. Nada saiu.', sending: 'Enviando...',
      mic: 'Falar', micStop: 'Parar', listening: 'Ouvindo. Fale e clique em Parar.', micFail: 'A voz não começou. Confira o microfone do navegador.',
      image: 'Imagem', removeImage: 'Tirar imagem', imagesMax: 'Até 3 imagens por mensagem.', imageBig: 'Imagem acima de 8 MB.', imageBad: 'Não deu para ler essa imagem.', imageNotYet: 'Imagem ainda não passa pelo painel. Cole o print no app por enquanto.', imageSave: 'A imagem não salvou. Nada foi enviado. Tente de novo.', drop: 'Solte a imagem aqui',
      history: 'Ver conversa', empty: 'Escreva a mensagem ou cole um print.', tooLong: n => 'Até ' + n + ' caracteres com os prints.', offline: 'Esperando a conexão local.', error: 'Não foi possível salvar. Tente de novo.', example: 'Envio desligado no modo exemplo.', publicOff: 'Envio pelo painel desligado nesta versão.',
      sent: c => 'enviado ' + c, delivered: (c, key) => 'entregue ' + (c ? c + ' ' : '') + W.pt.toWhom(key), queued: (c) => 'entregue ' + c + ' na conversa do COORDENADOR do Codex', replied: (c, who) => (who ? who + ' respondeu ' : 'respondeu ') + c, wait: 'ainda não entregue', copiedAt: c => 'copiado ' + c,
      copyApp: 'Copiar para colar no app', copied: key => 'Copiado. Cole ' + W.pt.chatOf(key) + ', no app.', copyFail: 'Não deu para copiar. Selecione o texto e copie.', unknown: 'O app do Codex não confirmou a tempo. Confira a conversa antes de repetir.', cliFail: 'O app do Codex não confirmou a entrega. Tente de novo.', openApp: 'Abrir no app',
      lockApproval: 'Aprovar subida só vale no chat de quem executa (ex.: chat da ATENDIMENTO). Copiei o texto para você colar lá.', lockMoney: 'Subida, env, chave ou dinheiro só valem no chat de quem executa (ex.: chat da ATENDIMENTO). Copiei o texto para você colar lá.', lockExternal: 'Mensagem para outras pessoas é no chat, não no painel. Copiei o texto para você colar lá.', copyAgain: 'Copiar de novo',
      prints: n => n === 1 ? '1 print' : n + ' prints', fab: 'Escrever para as IAs', who: { claude: 'Claude', codex: 'Codex' }
    },
    en: {
      name: { claude: 'COORDENADOR (Claude)', codex: 'COORDENADOR (Codex)', dois: 'Both COORDENADOR' }, to: 'To', region: 'Message to your AI',
      article: key => nameOf('en', key), toWhom: key => 'to ' + nameOf('en', key), chatOf: key => 'in the ' + nameOf('en', key === 'dois' ? 'claude' : key) + ' chat',
      placeholder: (who, prints) => 'Write to ' + who + '.' + (prints ? ' Ctrl+V pastes a screenshot.' : ''), send: 'Send', undo: 'Undo', leaving: n => 'Leaves in ' + n + ' s.', canceled: 'Undone. Nothing left.', sending: 'Sending...',
      mic: 'Speak', micStop: 'Stop', listening: 'Listening. Speak, then click Stop.', micFail: 'Voice did not start. Check the browser microphone.',
      image: 'Image', removeImage: 'Remove image', imagesMax: 'Up to 3 images per message.', imageBig: 'Image over 8 MB.', imageBad: 'Could not read this image.', imageNotYet: 'Images do not go through the panel yet. Paste the screenshot in the app for now.', imageSave: 'The image was not saved. Nothing was sent. Try again.', drop: 'Drop the image here',
      history: 'See conversation', empty: 'Write the message or paste a screenshot.', tooLong: n => 'Up to ' + n + ' characters with the screenshots.', offline: 'Waiting for the local connection.', error: 'Could not save. Try again.', example: 'Sending is off in Example mode.', publicOff: 'Sending from the panel is off in this version.',
      sent: c => 'sent ' + c, delivered: (c, key) => 'delivered ' + (c ? c + ' ' : '') + W.en.toWhom(key), queued: c => 'delivered ' + c + ' to the COORDENADOR (Codex) conversation', replied: (c, who) => (who ? who + ' replied ' : 'replied ') + c, wait: 'not delivered yet', copiedAt: c => 'copied ' + c,
      copyApp: 'Copy to paste in the app', copied: key => 'Copied. Paste it ' + W.en.chatOf(key) + ', in the app.', copyFail: 'Could not copy. Select the text and copy it.', unknown: 'The Codex app did not confirm in time. Check the conversation before trying again.', cliFail: 'The Codex app did not confirm delivery. Try again.', openApp: 'Open in app',
      lockApproval: 'Approving a release only counts in the chat of whoever runs it (e.g. the ATENDIMENTO chat). I copied the text for you to paste there.', lockMoney: 'Release, env, keys or money only count in the chat of whoever runs it (e.g. the ATENDIMENTO chat). I copied the text for you to paste there.', lockExternal: 'Messages to other people go in the chat, not the panel. I copied the text for you to paste there.', copyAgain: 'Copy again',
      prints: n => n === 1 ? '1 screenshot' : n + ' screenshots', fab: 'Write to your AI', who: { claude: 'Claude', codex: 'Codex' }
    },
    es: {
      name: { claude: 'COORDENADOR de Claude', codex: 'COORDENADOR de Codex', dois: 'Las dos COORDENADOR' }, to: 'Para', region: 'Mensaje para tu IA',
      article: key => key === 'dois' ? 'los dos coordinadores' : nameOf('es', key), toWhom: key => key === 'dois' ? 'a los dos coordinadores' : 'a ' + nameOf('es', key), chatOf: key => 'en el chat de ' + nameOf('es', key === 'dois' ? 'claude' : key),
      placeholder: (who, prints) => 'Escribe a ' + who + '.' + (prints ? ' Ctrl+V pega una captura.' : ''), send: 'Enviar', undo: 'Deshacer', leaving: n => 'Sale en ' + n + ' s.', canceled: 'Deshecho. No salió nada.', sending: 'Enviando...',
      mic: 'Hablar', micStop: 'Parar', listening: 'Escuchando. Habla y haz clic en Parar.', micFail: 'La voz no empezó. Revisa el micrófono del navegador.',
      image: 'Imagen', removeImage: 'Quitar imagen', imagesMax: 'Hasta 3 imágenes por mensaje.', imageBig: 'Imagen de más de 8 MB.', imageBad: 'No se pudo leer esta imagen.', imageNotYet: 'Las imágenes aún no pasan por el panel. Pega la captura en la app por ahora.', imageSave: 'La imagen no se guardó. No se envió nada. Inténtalo de nuevo.', drop: 'Suelta la imagen aquí',
      history: 'Ver conversación', empty: 'Escribe el mensaje o pega una captura.', tooLong: n => 'Hasta ' + n + ' caracteres con las capturas.', offline: 'Esperando la conexión local.', error: 'No se pudo guardar. Inténtalo de nuevo.', example: 'Envío desactivado en el modo Ejemplo.', publicOff: 'El envío desde el panel está desactivado en esta versión.',
      sent: c => 'enviado ' + c, delivered: (c, key) => 'entregado ' + (c ? c + ' ' : '') + W.es.toWhom(key), queued: c => 'entregado ' + c + ' en la conversación de la COORDENADOR de Codex', replied: (c, who) => (who ? who + ' respondió ' : 'respondió ') + c, wait: 'aún no entregado', copiedAt: c => 'copiado ' + c,
      copyApp: 'Copiar para pegar en la app', copied: key => 'Copiado. Pégalo ' + W.es.chatOf(key) + ', en la app.', copyFail: 'No se pudo copiar. Selecciona el texto y cópialo.', unknown: 'La app de Codex no confirmó a tiempo. Revisa la conversación antes de repetir.', cliFail: 'La app de Codex no confirmó la entrega. Inténtalo de nuevo.', openApp: 'Abrir en la app',
      lockApproval: 'Aprobar una subida solo vale en el chat de quien la ejecuta (ej.: chat de ATENDIMENTO). Copié el texto para que lo pegues allí.', lockMoney: 'Subida, env, claves o dinero solo valen en el chat de quien lo ejecuta (ej.: chat de ATENDIMENTO). Copié el texto para que lo pegues allí.', lockExternal: 'Los mensajes a otras personas van en el chat, no en el panel. Copié el texto para que lo pegues allí.', copyAgain: 'Copiar de nuevo',
      prints: n => n === 1 ? '1 captura' : n + ' capturas', fab: 'Escribir a tu IA', who: { claude: 'Claude', codex: 'Codex' }
    }
  };
  function nameOf(lang, key) { return W[lang].name[key] || key; }

  // ---------- regras puras (testadas em painel-chat.test.cjs) ----------
  // As mesmas travas do servidor (comandos.cjs), mais a de aprovacao: o painel nunca leva aprovacao nem segredo.
  const PRIVATE = /(?:\.env\b|\b(?:env|chave|chaves|key|keys|token|tokens|seed|seeds|semente|senha|password|credentials?|credential|segredos?|secret|secrets|auth\.json|backup-privado|private\s*key|api\s*key)\b|segredos|privado|\bbearer\s+|\b(?:sk-[a-z0-9_-]{10,}|gh[pousr]_[a-z0-9_]{10,})\b|\b[a-f0-9]{64}\b)/i;
  const LOCKED = /(?:\b(?:subir|sobe|suba|publique|publicar|deploy\w*|hospedagem|push|pushing|merge|merging|dinheiro|money|buy|buying|comprar|compre|compra|compras|sell|selling|vender|venda|withdraw\w*|saque|sacar|saca|transfer\w*|transferir|transfira|pagar|pague|pagamento|payment|payments|assinatura|assinar|sign|signing|signed|transact\w*)\b)/i;
  const APPROVAL = /\b(?:pre\s?-?\s?aprov\w*|aprovo|aprova|aprovad[oa]s?|aprovar|aprovei|libera|liberar|liberado|liberada|liberados|liberadas|libere|liberem|liberou|carta\s+branca|pode\s+subir|go\s+ahead)\b/i;
  const RELEASE = /\b(?:subir|sobe|suba|publique|publicar|deploy\w*|hospedagem|push|pushing|merge|merging)\b/i;
  const EXTERNAL = /\b(?:mande|mandar|envie|enviar|send|post|poste|publicar|publish|message|dm)\b.{0,65}\b(?:discord|telegram|twitter|\bx\b|email|e-mail|slack|holder|holders|pessoa|fulano)\b/i;
  const SENSITIVE_URL = /https?:\/\/(?:[^\s/]+@|\S*[?&](?:key|token|secret|password|api[_-]?key|auth|signature|sig)=)/i;
  const normal = text => String(text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function lockOf(text) {
    const plain = normal(text);
    if (APPROVAL.test(plain) || RELEASE.test(plain)) return 'approval';
    if (EXTERNAL.test(plain)) return 'external';
    if (PRIVATE.test(plain) || SENSITIVE_URL.test(String(text || '')) || LOCKED.test(plain)) return 'money';
    return null;
  }
  // Texto que sai: o que ele escreveu (1 linha so no arquivo, quem grava e o servidor) e os caminhos dos prints no fim.
  function composeText(text, paths = []) {
    const body = String(text || '').trim();
    const list = paths.filter(Boolean);
    if (!list.length) return body;
    return (body ? body + ' ' : '') + 'prints: ' + list.join(', ');
  }
  function textLimit(images) { return Math.max(100, MAX_TEXT - (images ? ' prints: '.length + images * PRINT_PATH_CHARS : 0)); }
  const RECEIPT = /^\s*ENTREGUE\b/i;
  // Uma mensagem no GET /api/coordenador-pb: o item enviado (status e respostas) em qualquer lista.
  function findSent(data, id) {
    if (!data || !id) return null;
    const lists = [data.coordenador?.claude?.sent, data.coordenador?.codex?.sent, data.coordenador?.dois?.sent, ...(Array.isArray(data.sessions) ? data.sessions.map(item => item.sent) : [])];
    for (const list of lists) for (const item of Array.isArray(list) ? list : []) if (item && String(item.id).toLowerCase() === String(id).toLowerCase()) return item;
    return null;
  }
  // Recibo: a linha "ENTREGUE ..." do COORDENADOR (hora da linha) ou a marca "entregue" antiga; resposta = qualquer outra linha.
  function receiptOf(item) {
    if (!item) return null;
    const replies = Array.isArray(item.replies) ? item.replies : [];
    const receipt = replies.find(reply => RECEIPT.test(reply.text || ''));
    const answers = replies.filter(reply => !RECEIPT.test(reply.text || '')).map(reply => ({ who: reply.who === 'codex' ? 'codex' : reply.who === 'claude' ? 'claude' : String(reply.who || ''), clock: reply.clock || '', text: String(reply.text || '').slice(0, 600) }));
    const delivered = receipt ? { clock: receipt.clock || '' } : ['entregue', 'respondida'].includes(item.status) || answers.length ? { clock: '' } : null;
    return { delivered, answers, cancelled: item.status === 'cancelada' };
  }
  function clockOf(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  }
  // Texto pronto para colar no chat do alvo quando o painel nao conseguiu entregar.
  function copyTextOf(message) {
    const prints = Array.isArray(message.prints) && message.prints.length ? ' Prints no PC: ' + message.prints.join(', ') + '.' : '';
    return 'Recado do dono pelo painel (' + (message.clock || '') + ', não chegou pelo vigia): ' + String(message.texto || '').trim() + prints + ' Responda aqui no chat.';
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function icon(kind) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'cx-icon');
    const shapes = kind === 'mic' ? ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'] : ['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M15.5 8.5h.01'];
    for (const d of shapes) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.append(p); }
    return svg;
  }
  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* cai no plano B */ }
    try {
      const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.className = 'cx-copy-buffer';
      document.body.append(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok;
    } catch { return false; }
  }
  function load() { try { const list = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(list) ? list.filter(item => item && typeof item.id === 'string').slice(0, 8) : []; } catch { return []; } }
  function save(list) { try { localStorage.setItem(STORE, JSON.stringify(list.slice(0, 8))); } catch { /* so conveniencia deste navegador */ } }

  // Imagem: vira PNG no navegador (tira dados de camera de JPG) e encolhe ate caber em 8 MB; miniatura em data: (CSP).
  async function toPng(file) {
    const bitmap = await createImageBitmap(file);
    try {
      let blob = file.type === 'image/png' && file.size <= MAX_IMAGE_BYTES ? file : null, scale = 1;
      for (let round = 0; !blob && round < 6; round++, scale *= 0.75) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const out = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (out && out.size <= MAX_IMAGE_BYTES) blob = out;
      }
      if (!blob) throw Error('too big');
      const side = 128, ratio = Math.min(1, side / Math.max(bitmap.width, bitmap.height)), thumb = document.createElement('canvas');
      thumb.width = Math.max(1, Math.round(bitmap.width * ratio)); thumb.height = Math.max(1, Math.round(bitmap.height * ratio));
      thumb.getContext('2d').drawImage(bitmap, 0, 0, thumb.width, thumb.height);
      return { blob, thumb: thumb.toDataURL('image/png') };
    } finally { bitmap.close?.(); }
  }

  function init(options = {}) {
    if (window.PainelComandos.instance) return window.PainelComandos.instance;
    const getData = typeof options.getData === 'function' ? options.getData : () => null;
    const apiUrl = typeof options.apiUrl === 'function' ? options.apiUrl : value => value;
    const toast = typeof options.showToast === 'function' ? options.showToast : () => {};
    const lang = () => { const value = typeof options.lang === 'function' ? options.lang() : options.lang || document.documentElement.lang; return /^pt/i.test(value) ? 'pt' : /^es/i.test(value) ? 'es' : 'en'; };
    const t = () => W[lang()];
    const exampleMode = () => new URLSearchParams(window.location.search).get('exemplo') === '1' || getData()?.example === true;
    const offMode = () => document.documentElement.dataset.kitAmigo === 'true' || exampleMode() || (getData()?.public === true && getData()?.commandsEnabled !== true);

    // O "Comando" do menu e o dialogo antigo saem: tudo vira esta caixa (Ctrl+K continua).
    const oldTrigger = document.getElementById('command-trigger');
    if (oldTrigger) oldTrigger.hidden = true;
    const host = document.getElementById('gancho-coordenador') || document.getElementById('panel-home');
    if (!host || exampleMode()) {
      window.PainelComandos.instance = { open() {}, updateLanguage() {}, focus() {} };
      return window.PainelComandos.instance;
    }

    let alvo = 'claude', images = [], prints = null, printsCheckedAt = 0, countdown = null, sending = false, recognition = null, jpb = null, pollTimer = null, messages = load(), notice = null;
    const box = make('section', 'cx');
    box.id = 'painel-caixa';
    const head = make('div', 'cx-head');
    const toLabel = make('label', 'cx-to'); toLabel.htmlFor = 'cx-alvo';
    const selectWrap = make('span', 'cx-alvo-wrap');
    const select = make('select', 'cx-alvo'); select.id = 'cx-alvo';
    for (const item of ALVOS) { const option = make('option'); option.value = item.key; select.append(option); }
    selectWrap.append(select);
    const history = make('button', 'cx-link'); history.type = 'button';
    head.append(toLabel, selectWrap, history);
    const textarea = make('textarea', 'cx-text'); textarea.id = 'cx-texto'; textarea.rows = 2; textarea.maxLength = MAX_TEXT;
    const thumbs = make('div', 'cx-thumbs'); thumbs.hidden = true;
    const actions = make('div', 'cx-actions');
    const mic = make('button', 'cx-tool cx-mic'); mic.type = 'button'; mic.setAttribute('aria-pressed', 'false');
    const micText = make('span', 'cx-tool-text'); mic.append(icon('mic'), micText);
    const imageButton = make('button', 'cx-tool cx-image'); imageButton.type = 'button';
    const imageText = make('span', 'cx-tool-text'); imageButton.append(icon('image'), imageText);
    const fileInput = make('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.multiple = true; fileInput.hidden = true; fileInput.tabIndex = -1;
    const counter = make('span', 'cx-count');
    const send = make('button', 'cx-send'); send.type = 'button';
    actions.append(mic, imageButton, fileInput, counter, send);
    const note = make('div', 'cx-note'); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite'); note.hidden = true;
    const noteText = make('span', 'cx-note-text');
    const noteButton = make('button', 'cx-note-button'); noteButton.type = 'button'; noteButton.hidden = true;
    note.append(noteText, noteButton);
    const list = make('ol', 'cx-list'); list.hidden = true;
    const dropHint = make('div', 'cx-drop'); dropHint.setAttribute('aria-hidden', 'true');
    box.append(head, textarea, thumbs, actions, note, list, dropHint);
    const bar = document.getElementById('coordenador-pb-bar');
    if (bar && bar.parentElement === host) bar.after(box); else host.prepend(box);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    // Falar so aparece com reconhecimento no proprio aparelho; sem modo local, fica escondido.
    mic.hidden = true; if (SR && typeof SR.available === 'function') SR.available({ langs: [{ pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[lang()]], processLocally: true }).then(r => { mic.hidden = r !== 'available'; }, () => {});

    function say(text, kind = 'info', button = null) {
      notice = text ? { text, kind, button } : null;
      note.hidden = !text; note.className = 'cx-note is-' + kind; noteText.textContent = text || '';
      noteButton.hidden = !button; noteButton.textContent = button ? button.label : '';
      noteButton.onclick = button ? button.run : null;
    }
    function setAlvo(key, focus) {
      alvo = alvoOf(key).key; select.value = alvo;
      host.dataset.cxAlvo = alvo; box.dataset.family = alvoOf(alvo).family;
      markBar(); refresh();
      if (focus) { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); textarea.focus(); }
    }
    function markBar() {
      const current = document.getElementById('coordenador-pb-bar');
      if (!current) return;
      for (const button of current.querySelectorAll('[data-jpb]')) {
        if (button.hasAttribute('aria-haspopup')) button.removeAttribute('aria-haspopup');
        const on = button.dataset.jpb === alvo;
        if (button.getAttribute('aria-pressed') !== String(on)) button.setAttribute('aria-pressed', String(on));
      }
    }
    function limit() { return textLimit(images.length); }
    function autoGrow() { textarea.style.height = 'auto'; textarea.style.height = Math.min(200, Math.max(52, textarea.scrollHeight + 2)) + 'px'; }
    function update() {
      const w = t();
      box.setAttribute('aria-label', w.region);
      toLabel.textContent = w.to;
      for (const option of select.options) option.textContent = nameOf(lang(), option.value);
      history.textContent = w.history + ' ↗';
      textarea.placeholder = offMode() ? (exampleMode() ? w.example : w.publicOff) : w.placeholder(w.article(alvo), !!prints);
      textarea.disabled = offMode(); textarea.readOnly = !!countdown || sending;
      micText.textContent = recognition ? w.micStop : w.mic; mic.setAttribute('aria-label', recognition ? w.micStop : w.mic); mic.disabled = offMode() || !!countdown || sending;
      imageText.textContent = w.image; imageButton.setAttribute('aria-label', w.image); imageButton.hidden = !prints; imageButton.disabled = offMode() || !!countdown || sending || images.length >= MAX_IMAGES;
      const size = textarea.value.length, cap = limit();
      counter.textContent = size ? size + '/' + cap : ''; counter.classList.toggle('is-over', size > cap);
      send.textContent = countdown ? w.undo + ' (' + countdown.left + ')' : sending ? w.sending : w.send;
      send.disabled = offMode() || sending || (!countdown && !textarea.value.trim() && !images.length);
      send.classList.toggle('is-undo', !!countdown);
      dropHint.textContent = w.drop;
    }
    function refresh() { update(); renderThumbs(); renderList(); }
    function renderThumbs() {
      thumbs.hidden = !images.length;
      thumbs.replaceChildren(...images.map((image, index) => {
        const item = make('figure', 'cx-thumb'), img = make('img'); img.src = image.thumb; img.alt = '';
        const remove = make('button', 'cx-thumb-x'); remove.type = 'button'; remove.append(make('span', 'cx-thumb-x-dot', '×')); remove.setAttribute('aria-label', t().removeImage + ' ' + (index + 1));
        remove.disabled = !!countdown || sending;
        remove.addEventListener('click', () => { images.splice(index, 1); refresh(); textarea.focus(); });
        item.append(img, remove); return item;
      }));
    }
    function statusParts(message, now) {
      const w = t(), parts = [];
      parts.push({ kind: 'sent', text: w.sent(message.clock || '') });
      if (message.via === 'fila') {
        if (message.state === 'incerto') parts.push({ kind: 'wait', text: w.unknown, copy: true });
        else parts.push({ kind: 'ok', text: w.queued(message.clock || '') });
        return parts;
      }
      if (message.delivered) parts.push({ kind: 'ok', text: w.delivered(message.delivered.clock, message.alvo) });
      for (const answer of message.answers || []) parts.push({ kind: 'reply', who: answer.who, text: w.replied(answer.clock, message.alvo === 'dois' ? w.who[answer.who] || '' : '') });
      if (!message.delivered && !(message.answers || []).length) {
        if (message.copiedAt) parts.push({ kind: 'copied', text: w.copiedAt(message.copiedAt) });
        else if (now - Date.parse(message.at) >= WAIT_MS) parts.push({ kind: 'wait', text: w.wait, copy: true });
      }
      return parts;
    }
    function renderList() {
      const w = t(), now = Date.now(), shown = messages.slice(0, 3);
      list.hidden = !shown.length;
      list.replaceChildren(...shown.map(message => {
        const item = make('li', 'cx-msg is-' + alvoOf(message.alvo).family);
        const top = make('div', 'cx-msg-top');
        top.append(make('span', 'cx-msg-to', nameOf(lang(), message.alvo)), make('span', 'cx-msg-text', message.texto || w.prints(message.prints?.length || 0)));
        if (message.prints?.length) top.append(make('span', 'cx-msg-prints', w.prints(message.prints.length)));
        const status = make('div', 'cx-msg-status');
        for (const part of statusParts(message, now)) {
          status.append(make('span', 'cx-st is-' + part.kind + (part.who ? ' is-' + part.who : ''), part.text));
          if (part.copy) {
            const button = make('button', 'cx-copy', w.copyApp); button.type = 'button';
            button.addEventListener('click', async () => {
              const ok = await copyText(copyTextOf(message));
              if (ok) { message.copiedAt = clockOf(new Date()); save(messages); say(w.copied(message.alvo), 'info'); } else say(w.copyFail, 'error');
              renderList();
            });
            status.append(button);
          }
        }
        if (message.via === 'fila' && message.appLink) { const link = make('a', 'cx-app', w.openApp); link.href = message.appLink; status.append(link); }
        item.append(top, status);
        const answer = (message.answers || []).slice(-1)[0];
        if (answer?.text) { const reply = make('p', 'cx-msg-reply', answer.text); reply.tabIndex = 0; reply.addEventListener('click', () => reply.classList.toggle('is-open')); reply.addEventListener('keydown', event => { if (event.key === 'Enter') reply.classList.toggle('is-open'); }); item.append(reply); }
        return item;
      }));
    }

    // ---------- leitura: nonce e listas do COORDENADOR (GET /api/coordenador-pb) e prints (GET /api/painel-chat) ----------
    async function readJpb() {
      try { const response = await fetch(apiUrl('/api/coordenador-pb'), { cache: 'no-store' }); if (!response.ok) return jpb; jpb = await response.json(); } catch { /* fica a leitura anterior */ }
      return jpb;
    }
    async function checkPrints(force) {
      if (prints || (!force && Date.now() - printsCheckedAt < 30000)) return prints;
      printsCheckedAt = Date.now();
      try { const response = await fetch(apiUrl('/api/painel-chat'), { cache: 'no-store' }); const data = response.ok ? await response.json() : null; prints = data?.ok === true && data.prints && Number.isFinite(data.prints.maxBytes) ? data.prints : null; } catch { prints = null; }
      update(); return prints;
    }
    // Segue lendo ate a resposta (as duas, quando foi para as duas) ou ate 30 min.
    function pending(now = Date.now()) {
      return messages.filter(message => message.via === 'arquivo' && now - Date.parse(message.at) < WATCH_MS && new Set((message.answers || []).map(answer => answer.who)).size < (message.alvo === 'dois' ? 2 : 1));
    }
    async function poll() {
      clearTimeout(pollTimer); pollTimer = null;
      if (pending().length && !document.hidden) {
        const data = await readJpb();
        let changed = false;
        for (const message of pending()) {
          const receipt = receiptOf(findSent(data, message.id));
          if (!receipt) continue;
          if (receipt.delivered && !message.delivered) { message.delivered = { clock: receipt.delivered.clock || clockOf(new Date()) }; changed = true; }
          if (receipt.answers.length !== (message.answers || []).length) { message.answers = receipt.answers; changed = true; }
        }
        if (changed) save(messages);
      }
      renderList();
      if (pending().length) pollTimer = setTimeout(poll, POLL_MS);
    }

    // ---------- imagens ----------
    async function addFiles(files) {
      const w = t();
      const wanted = [...files].filter(file => file && /^image\//.test(file.type));
      if (!wanted.length) return false;
      if (!(await checkPrints(true))) { say(w.imageNotYet, 'info'); return true; }
      for (const file of wanted) {
        if (images.length >= MAX_IMAGES) { say(w.imagesMax, 'info'); break; }
        if (file.size > MAX_IMAGE_BYTES) { say(w.imageBig, 'error'); continue; }
        try { images.push(await toPng(file)); say(''); } catch { say(w.imageBad, 'error'); }
      }
      refresh(); return true;
    }

    // ---------- envio ----------
    function codexThread() {
      const sessions = Array.isArray(getData()?.commandSessions) ? getData().commandSessions : [];
      const codex = sessions.filter(item => item?.family === 'codex' && CODEX_THREAD.test(item.threadId || ''));
      return (codex.find(item => /^COORDENADOR\s*·\s*conversa$/i.test(item.name || '')) || codex.find(item => item.maestro) || codex.find(item => /\bCOORDENADOR\b/i.test(item.name || '')))?.threadId || null;
    }
    async function postJson(url, body, nonce) {
      const response = await fetch(apiUrl(url), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Painel-Nonce': nonce }, body: JSON.stringify(body) });
      let result = null; try { result = await response.json(); } catch { result = null; }
      return { status: response.status, result: result || { ok: false, error: 'error' } };
    }
    async function uploadAll(target, nonce) {
      const paths = [];
      for (const image of images) {
        const response = await fetch(apiUrl('/api/painel-chat/print/' + target.slug), { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-Painel-Nonce': nonce }, body: image.blob });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.ok !== true || typeof result.caminho !== 'string') throw Object.assign(Error('print'), { message: result?.message || '' });
        paths.push(result.caminho);
      }
      return paths;
    }
    async function lock(kind, text) {
      const w = t(), message = kind === 'approval' ? w.lockApproval : kind === 'external' ? w.lockExternal : w.lockMoney;
      await copyText(text);
      say(message, 'lock', { label: w.copyAgain, run: async () => { say((await copyText(text)) ? message : w.copyFail, 'lock', notice?.button); } });
    }
    async function deliver(snapshot) {
      const w = t(), target = alvoOf(snapshot.alvo), nonce = getData()?.nonce;
      if (!nonce) { say(w.offline, 'error'); return; }
      sending = true; update(); renderThumbs();
      try {
        let paths = [];
        if (snapshot.images.length) {
          try { paths = await uploadAll(target, nonce); } catch (error) { say(error.message || w.imageSave, 'error'); return; }
        }
        const texto = composeText(snapshot.texto, paths);
        let outcome = null;
        if (target.key === 'codex' && codexThread()) {
          const { result } = await postJson('/api/comando', { destino: 'codex', texto, threadId: codexThread(), confirmado: true }, nonce);
          if (result.ok === true) outcome = { id: result.id, at: result.queuedAt, via: 'fila', appLink: typeof result.appLink === 'string' && /^codex:\/\/threads\/[a-f\d-]{36}$/i.test(result.appLink) ? result.appLink : null };
          else if (result.error === 'delivery_unknown') outcome = { id: result.id || 'incerto-' + Date.now(), at: new Date().toISOString(), via: 'fila', state: 'incerto' };
          else if (result.error === 'cli') { say(w.cliFail, 'error'); return; }
          else if (result.error === 'locked' || result.error === 'external') { await lock(result.error === 'external' ? 'external' : lockOf(texto) || 'money', snapshot.texto); return; }
          else if (result.error !== 'session') { say(result.message || w.error, 'error'); return; }
        }
        if (!outcome) {
          say(w.publicOff + ' ' + ((await copyText(snapshot.texto)) ? w.copied(target.key) : w.copyFail), 'info'); return;
        }
        const message = { id: String(outcome.id), alvo: target.key, texto: snapshot.texto, prints: paths, at: outcome.at, clock: clockOf(outcome.at), via: outcome.via, state: outcome.state || 'ok', appLink: outcome.appLink || null, delivered: null, answers: [] };
        messages = [message, ...messages.filter(item => item.id !== message.id)].slice(0, 8); save(messages);
        textarea.value = ''; images = []; autoGrow(); say(''); renderThumbs(); renderList();
        toast(w.sent(message.clock));
        document.dispatchEvent(new CustomEvent('painel-command-saved', { detail: { id: message.id, destino: target.key } }));
        poll();
      } catch { say(w.error, 'error'); }
      finally { sending = false; update(); renderThumbs(); }
    }
    async function start() {
      const w = t();
      if (countdown) { clearInterval(countdown.timer); countdown = null; say(w.canceled, 'info'); refresh(); textarea.focus(); return; }
      if (sending || offMode()) return;
      const texto = textarea.value.trim();
      if (!texto && !images.length) { say(w.empty, 'error'); return; }
      if (texto.length > limit()) { say(w.tooLong(limit()), 'error'); return; }
      const kind = lockOf(texto);
      if (kind) { await lock(kind, texto); return; }
      if (images.length && !(await checkPrints(true))) { say(w.imageNotYet, 'info'); return; }
      const snapshot = { alvo, texto, images: images.slice() };
      countdown = { left: UNDO_S, timer: null };
      say(w.leaving(UNDO_S), 'info'); renderThumbs();
      countdown.timer = setInterval(() => {
        if (!countdown) return;
        countdown.left -= 1;
        if (countdown.left <= 0) { clearInterval(countdown.timer); countdown = null; say(''); renderThumbs(); deliver(snapshot); return; }
        say(w.leaving(countdown.left), 'info'); update();
      }, 1000);
      update();
    }

    // ---------- voz do navegador ----------
    async function listen() {
      const w = t();
      if (recognition) { try { recognition.stop(); } catch { /* ja parou */ } return; }
      if (!SR || countdown || sending) return;
      const base = textarea.value.trim(), language = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[lang()];
      try {
        const rec = new SR(); rec.lang = language; rec.interimResults = true; rec.continuous = true;
        // Reconhecimento so no proprio aparelho; sem modo local, a voz nao comeca.
        if (typeof SR.available !== 'function' || await SR.available({ langs: [language], processLocally: true }) !== 'available') { say(w.micFail, 'error'); update(); return; }
        rec.processLocally = true;
        rec.onresult = event => { let heard = ''; for (const result of event.results) heard += result[0].transcript; textarea.value = (base + ' ' + heard).trim().slice(0, MAX_TEXT); autoGrow(); update(); };
        rec.onerror = event => { if (event?.error && event.error !== 'no-speech' && event.error !== 'aborted') say(w.micFail, 'error'); };
        rec.onend = () => { recognition = null; mic.setAttribute('aria-pressed', 'false'); box.classList.remove('is-listening'); if (notice?.text === w.listening) say(''); update(); textarea.focus(); };
        rec.start(); recognition = rec; mic.setAttribute('aria-pressed', 'true'); box.classList.add('is-listening'); say(w.listening, 'info'); update();
      } catch { recognition = null; say(w.micFail, 'error'); update(); }
    }

    // ---------- ligacoes ----------
    select.addEventListener('change', () => setAlvo(select.value, false));
    history.addEventListener('click', () => {
      const pb = window.PainelCoordenadorPB?.instance;
      if (['claude', 'codex', 'dois'].includes(alvo) && pb?.open) pb.open(alvo);
      else document.getElementById('tab-sessions')?.click();
    });
    textarea.addEventListener('input', () => { if (notice && notice.kind !== 'info') say(''); autoGrow(); update(); });
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!countdown) start(); } });
    textarea.addEventListener('focus', () => { if (!prints) checkPrints(false); });
    box.addEventListener('paste', event => {
      const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
      if (files.some(file => /^image\//.test(file.type))) { event.preventDefault(); addFiles(files); }
    });
    let dragDepth = 0;
    box.addEventListener('dragenter', event => { if ([...(event.dataTransfer?.types || [])].includes('Files')) { dragDepth++; box.classList.add('is-drop'); event.preventDefault(); } });
    box.addEventListener('dragover', event => { if ([...(event.dataTransfer?.types || [])].includes('Files')) event.preventDefault(); });
    box.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) box.classList.remove('is-drop'); });
    box.addEventListener('drop', event => { dragDepth = 0; box.classList.remove('is-drop'); if (event.dataTransfer?.files?.length) { event.preventDefault(); if (!offMode() && !countdown && !sending) addFiles(event.dataTransfer.files); } });
    imageButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { addFiles(fileInput.files || []); fileInput.value = ''; });
    mic.addEventListener('click', listen);
    send.addEventListener('click', start);
    // Os 3 botoes da barra (COORDENADOR CODEX, OS DOIS, COORDENADOR CLAUDE) so escolhem o alvo da caixa.
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#coordenador-pb-bar [data-jpb]');
      if (!button || !['claude', 'codex', 'dois'].includes(button.dataset.jpb)) return;
      event.preventDefault(); event.stopPropagation(); setAlvo(button.dataset.jpb, true);
    }, true);
    if (bar) new MutationObserver(markBar).observe(bar, { childList: true, subtree: true });
    function focus() {
      const home = document.getElementById('tab-home');
      if (home && home.getAttribute('aria-selected') !== 'true') home.click();
      box.scrollIntoView({ block: 'center', behavior: 'smooth' }); textarea.focus();
    }
    document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); focus(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && pending().length) poll(); });
    document.addEventListener('painel:snapshot', () => update());
    document.getElementById('language')?.addEventListener('change', () => setTimeout(refresh, 0));
    setInterval(() => { if (!document.hidden && messages.length) renderList(); }, 15000);

    setAlvo('claude', false);
    checkPrints(true); readJpb().then(poll);
    window.PainelComandos.instance = { open: focus, focus, updateLanguage: refresh, setAlvo: key => setAlvo(key, true) };
    window.PainelChat?.init({ ...options, open: focus, target: box, words: { pt: W.pt.fab, en: W.en.fab, es: W.es.fab } });
    return window.PainelComandos.instance;
  }

  window.PainelComandos = { init, instance: null, logic: { lockOf, composeText, textLimit, findSent, receiptOf, clockOf, copyTextOf, ALVOS, MAX_IMAGES, MAX_IMAGE_BYTES } };
})();
