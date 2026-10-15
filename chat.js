(() => {
  'use strict';
  // Botao redondo do Agente (canto de baixo): leva a caixa de mensagem da Inicio (comandos.js) e some quando ela ja esta na tela.
  const fallback = { en: 'Write to your AI', pt: 'Escrever para as IAs', es: 'Escribir a tu IA' };
  const off = { en: 'Chat is off in Example mode', pt: 'Chat desligado no modo Exemplo', es: 'Chat desactivado en modo Ejemplo' };
  function init(options = {}) {
    if (document.getElementById('painel-chat-trigger')) return window.PainelChat.instance;
    const button = document.createElement('button');
    button.id = 'painel-chat-trigger'; button.type = 'button'; button.className = 'painel-chat-trigger';
    button.setAttribute('aria-controls', 'painel-caixa');
    const image = document.createElement('img'); image.src = '/agente.png'; image.alt = ''; image.width = 36; image.height = 36;
    const label = document.createElement('span'); label.className = 'painel-chat-label';
    button.append(image, label); document.body.append(button);
    const getData = typeof options.getData === 'function' ? options.getData : () => null;
    const words = options.words && typeof options.words === 'object' ? options.words : fallback;
    let inView = false;
    function update() {
      const language = typeof options.lang === 'function' ? options.lang() : options.lang || document.documentElement.lang;
      const key = /^pt/i.test(language) ? 'pt' : /^es/i.test(language) ? 'es' : 'en';
      const example = getData()?.example === true || new URLSearchParams(window.location.search).get('exemplo') === '1';
      const text = example ? off[key] : words[key] || fallback[key];
      button.disabled = example; button.title = text; button.setAttribute('aria-label', text); label.textContent = text;
      const home = document.documentElement.dataset.painelTab === 'home';
      button.hidden = example || (inView && home);
    }
    button.addEventListener('click', () => { update(); if (!button.disabled) options.open?.(); });
    if (options.target && 'IntersectionObserver' in window) new IntersectionObserver(entries => { inView = entries.some(entry => entry.isIntersecting); update(); }, { threshold: 0.4 }).observe(options.target);
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-painel-tab'] });
    document.getElementById('language')?.addEventListener('change', update);
    document.addEventListener('painel:snapshot', update);
    update();
    window.PainelChat.instance = { update };
    return window.PainelChat.instance;
  }
  window.PainelChat = { init, instance: null };
})();
