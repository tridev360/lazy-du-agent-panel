/* ACELERAR: modulo PD do painel (02/10). Botao ao lado do WEN e do AUTOMATIZAR; abre uma gaveta com:
 *   1. o CONTROLE de marcha (1 a 5): cada marcha diz o que muda no trabalho e o efeito no credito (poupa, normal,
 *      gasta mais); a linha fixa "Nunca corta" fica embaixo. Trocar espera 4 s com Desfazer e so entao grava:
 *      no modo dono, 1 linha "| OS DOIS | marcha N: <nome>" no recados do painel e a marcha no json do modulo;
 *      no modo publico (git), so no json do modulo.
 *   2. a barra "minutos de espera cortados" (dono: o piso medido no playbook; publico: comeca em 0 e soma o marcado).
 *   3. as 11 fases do playbook como conquistas ("11 de 11 conquistas"); a proxima aparece so depois da anterior.
 * Nenhuma marcha nem fase corta revisao de dinheiro, segredo ou quem monta nao assina.
 *
 * Gancho: window.PainelGanchos.register('acelerador', { render(snapshot, ctx), destroy() }).
 *   render(snapshot, ctx): o lugar vem de ctx.host (ou ctx.el, ctx.root, ctx.mount, ctx.container, ou o proprio ctx se
 *   for um elemento); sem isso, #gancho-acelerador. ctx.lang (pt, en, es) e ctx.api sao opcionais.
 *   snapshot.acelerador (opcional) = o mesmo formato do GET /api/acelerador; sem ele, o modulo le a rota sozinho.
 *   Sem o registro, monta sozinho em #gancho-acelerador ou [data-gancho="acelerador"] no DOMContentLoaded.
 * Dados: GET <api> (padrao /api/acelerador; data-api no gancho troca). Cliques: POST <api>/marcha, <api>/ligar,
 *   <api>/minutos e <api>/desfazer (acelerador-rotas.cjs).
 * Celular (ate 600 px): o botao entra na barra flutuante do WEN, se ela existir (data-acel-fixo no gancho desliga).
 * Sem estilo inline (CSP do painel): a barra de minutos anda por data-passo (0 a 20) no CSS.
 * No node (testes e rotas) exporta as regras e os textos: require('./acelerador.js'). */
(function (root) {
  'use strict';
  const TOTAL = 11;
  const MARCHAS = [1, 2, 3, 4, 5];
  const ROTINA = 'rotina';
  const CREDITO_DA_MARCHA = { 1: 'poupa', 2: 'poupa', 3: 'normal', 4: 'gasta', 5: 'gasta' };
  const ESPERA_MARCHA_S = 4; // como o PB: a mudanca espera 4 s com Desfazer antes de sair
  const METAS = [15, 30, 60, 120, 240, 480, 960];
  const SOMAS = [5, 15, 30];
  const AVISO_MS = 6000;
  const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ICONES = {
    linhas: 'M5 7h14M5 12h10M5 17h6',
    ciclo: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
    escudo: 'M12 3.5l7 2.8v5.2c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.3zM9 12l2.2 2.2L15.2 10',
    desvio: 'M4 7h4.5l7 10H20M4 17h4.5l2-2.9M15.5 7H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5',
    relogio: 'M12 20.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17zM12 7.5V12l3 2',
    olho: 'M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12zM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z',
    alvo: 'M12 20.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h.01',
    camadas: 'M12 3.8l8.5 4.4-8.5 4.4-8.5-4.4zM3.5 12.4l8.5 4.4 8.5-4.4M3.5 16.4l8.5 4.4 8.5-4.4',
    chip: 'M7 7h10v10H7zM10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5',
    play: 'M8.5 5.5v13l10-6.5z',
    raio: 'M13 2.8L5 13.2h6.2l-.8 8 8.6-10.6h-6.3z',
    check: 'M5 12.5l4.2 4.2L19 7',
    seta: 'M9 6l6 6-6 6',
    fechar: 'M6 6l12 12M18 6L6 18'
  };
  const FASES = [
    { id: 1, icone: 'linhas' }, { id: 2, icone: 'ciclo' }, { id: 3, icone: 'escudo' }, { id: 4, icone: 'desvio' },
    { id: 5, icone: 'relogio' }, { id: 6, icone: 'olho' }, { id: 7, icone: 'alvo' }, { id: 8, icone: 'camadas' },
    { id: 9, icone: 'chip' }, { id: 10, icone: 'play' }, { id: 11, icone: 'raio' }
  ];

  // Textos da tela. As 3 linguas tem as mesmas chaves (o teste confere). Sem sigla, sem nada de um projeto so:
  const TEXTOS = {
    pt: {
      ui: {
        botao: 'ACELERAR',
        dica: 'Marcha do trabalho e fases para os seus agentes esperarem menos',
        titulo: 'Acelerar',
        escolhaMarcha: 'Escolha a sua marcha',
        marchaNome: (n, nome) => 'Marcha ' + n + ' · ' + nome,
        escolhidaEm: d => 'Escolhida em ' + d,
        escolhidaAs: (d, h) => 'Escolhida em ' + d + ' às ' + h,
        toqueParaEscolher: 'Toque numa marcha para escolher.',
        marchasRotulo: 'Marcha do trabalho',
        creditoRotulo: 'Crédito',
        credito: { poupa: 'poupa', normal: 'normal', gasta: 'gasta mais' },
        nuncaCorta: 'Nunca corta',
        nuncaCortaMarcha: 'revisão de dinheiro, segredo, quem faz não aprova, a sua aprovação para publicar.',
        saiEm: s => 'Registra a preferência local em ' + s + ' s. Ainda dá para desfazer.',
        guardaEm: s => 'Guarda em ' + s + ' s. Ainda dá para desfazer.',
        avisou: (nome, h) => nome + ': os agentes foram avisados às ' + h + '.',
        guardou: nome => nome + ': guardada neste painel.',
        marchaDesfeita: 'Desfeito. A marcha não mudou.',
        minutosTitulo: 'Minutos de espera cortados',
        minutos: n => n + ' min',
        piso: 'pelo menos',
        comeca: 'Começa em 0 e soma o que você marcar.',
        semFase: 'Ligue a primeira fase para começar a somar.',
        somarPergunta: 'Mediu uma espera que sumiu?',
        somar: m => '+' + m + ' min',
        somou: m => 'Somou ' + m + ' min.',
        meta: n => 'Próxima marca: ' + n + ' min',
        deOndeVem: 'De onde vem',
        fase: (n, t) => 'Fase ' + n + ' de ' + t,
        proxima: 'Próxima fase',
        conquistasDe: (n, t) => n + ' de ' + t + ' conquistas',
        ligar: 'Ligar',
        ligando: 'Ligando...',
        ligada: 'Ligada',
        ligadaEm: d => 'Ligada em ' + d,
        ligou: nome => nome + ': ligada.',
        ganho: 'Ganho',
        ganhoMedido: 'Ganho medido',
        escondidas: n => n === 1 ? 'Mais 1 fase aparece depois desta.' : 'Mais ' + n + ' fases aparecem, uma por vez.',
        desfazer: 'Desfazer',
        desfeito: 'Desfeito.',
        fechar: 'Fechar',
        lendo: 'Lendo as fases...',
        semLeitura: 'Não deu para ler as fases agora.',
        erro: 'Não deu para gravar agora. Tente de novo.',
        soLeitura: 'Prévia só de leitura: nada foi gravado.',
        foraDeOrdem: 'Ligue a fase anterior primeiro.',
        ocupado: 'Outra tela está gravando agora. Tente de novo.',
        semFaseSomar: 'Ligue uma fase antes de somar minutos.',
        marchaDica: 'Abre as 6 marchas e o que está ligado agora',
        marchaAria: (nome, estado) => 'Marcha: ' + nome + (estado ? ', ' + estado : '') + '. Abre as marchas.',
        estadoLigada: 'Ligada',
        rotinaNome: 'Rotina',
        estadoDesligada: 'Desligada',
        agora: 'Agora',
        escolhidaBrt: (d, h) => 'Escolhida em ' + d + ' às ' + h,
        vivaLigada: (desde, ultima, prox, proxHora) => 'Voltas seguidas desde ' + desde + ' · última volta há ' + ultima + ' min' + (prox ? ' · próxima em ~' + prox + ' min (' + proxHora + ')' : ''),
        vivaParada: (dur, hora) => 'Rotina sem volta há ' + dur + (hora ? ' (a última foi às ' + hora + ')' : ''),
        vivaDesligada: dur => 'Desligada · última volta há ' + dur,
        vivaSemLeitura: 'Sem leitura das voltas da rotina.',
        solParada: 'Solução: peça ao seu Claude para religar a volta de 15 min.',
        solSemLeitura: 'Solução: peça ao seu Claude para rodar 1 volta agora; o registro aparece aqui.',
        solMinutos: 'Solução: cada volta passa a gravar os minutos que ganhou.',
        hoje: 'hoje',
        semana: 'nos últimos 7 dias',
        parcial: (m, v) => m + ' de ' + v + ' voltas mediram',
        deOndeVemViva: (hv, hm, sv, sm) => 'Soma dos minutos ganhos que cada volta da rotina de 15 min grava. Hoje: ' + hv + ' voltas, ' + hm + ' com minutos. Últimos 7 dias: ' + sv + ' voltas, ' + sm + ' com minutos.',
        deOndeVemSem: 'Soma dos minutos ganhos que cada volta da rotina de 15 min grava. Sem leitura das voltas agora.'
      },
      marchas: {
        1: { nome: 'Econômica', linha: '1 frente pesada por vez; ajudante só quando precisa; o resto espera na fila.' },
        2: { nome: 'Calma', linha: '2 frentes pesadas por vez; uma revisão de cada vez.' },
        3: { nome: 'Normal', linha: 'Até 3 frentes pesadas por vez, o teto de sempre; revisões em paralelo.' },
        4: { nome: 'Rápida', linha: 'Até 3 frentes pesadas, cada uma com testes, revisões e prints ao mesmo tempo.' },
        5: { nome: 'Máxima', linha: 'Tudo em paralelo onde não há disputa: revisões em metades, quem aprova adiantado, outro agente junto.' },
        rotina: { nome: 'ROTINA', linha: 'Revisão periódica das frentes e próximos passos, conforme a rotina que você configurou.' }
      },
      fases: {
        1: { nome: 'Status curto', pergunta: 'Você lê um textão para saber como está? Quer o estado em 6 linhas curtas, sempre com hora?', ganho: 'Você decide em segundos.', nuncaCorta: 'A previsão sempre vem com hora.' },
        2: { nome: 'Automático', pergunta: 'Você pergunta toda hora como está? Quer que o status se atualize sozinho a cada 5 min?', ganho: 'Nenhuma pergunta só para saber o estado.', nuncaCorta: 'Muda igual ao clique, nada escondido.' },
        3: { nome: 'Pré-aprovar', pergunta: 'Seu agente espera você clicar para publicar? Quer que ele publique sozinho quando tudo passar?', ganho: 'O que está pronto não fica parado esperando você.', nuncaCorta: 'Testes, revisões e a sua liberação continuam.' },
        4: { nome: 'Plano B', pergunta: 'Um item travado segura a entrega inteira? Quer tirar só ele e publicar o resto?', ganho: 'Um item travado não segura os outros.', nuncaCorta: 'O item tirado só volta consertado.' },
        5: { nome: 'Janela de trabalho', pergunta: 'Seu outro agente espera a sua licença a cada pedido? Quer abrir uma janela de trabalho com hora para acabar?', ganho: 'Sem espera a cada pedido.', nuncaCorta: 'Publicar, chaves e dinheiro seguem com você.' },
        6: { nome: 'Revisor novo', pergunta: 'A aprovação espera alguém de fora? Quer que um revisor novo, que não fez o trabalho, aprove?', ganho: 'A aprovação não espera ninguém de fora.', nuncaCorta: 'Quem faz nunca aprova o próprio trabalho.' },
        7: { nome: 'Revisar onde importa', pergunta: 'Todo texto passa por revisão antes de sair? Quer revisar antes só o que todo mundo vê?', ganho: 'Menos espera em cada prévia.', nuncaCorta: 'O que mexe com dinheiro é sempre revisado antes.' },
        8: { nome: 'Base aprovada', pergunta: 'Cada trabalho começa de uma versão diferente? Quer que tudo nasça em cima da última versão aprovada?', ganho: 'Menos junção para refazer.', nuncaCorta: 'A liberação compara com o que está no ar.' },
        9: { nome: 'Máquina livre', pergunta: 'Seu computador trava com tudo rodando junto? Quer ver o que pesa e mandar o teste pesado para outra máquina?', ganho: 'Fotos e testes sem travar.', nuncaCorta: 'Só o dono fecha um programa.' },
        10: { nome: 'Pegar o parado', pergunta: 'Tem trabalho parado esperando um agente ocupado? Quer que quem está livre pegue?', ganho: 'O trabalho parado volta a andar.', nuncaCorta: 'Ninguém mexe na pasta do outro.' },
        11: { nome: 'Força total', pergunta: 'Seus agentes trabalham um de cada vez? Quer várias frentes juntas onde ninguém disputa a mesma coisa?', ganho: 'Várias frentes andando juntas.', nuncaCorta: 'Uma publicação por vez.' }
      }
    },
    en: {
      ui: {
        botao: 'ACCELERATE',
        dica: 'Work gear and steps so your agents wait less',
        titulo: 'Accelerate',
        escolhaMarcha: 'Pick your gear',
        marchaNome: (n, nome) => 'Gear ' + n + ' · ' + nome,
        escolhidaEm: d => 'Picked on ' + d,
        escolhidaAs: (d, h) => 'Picked on ' + d + ' at ' + h,
        toqueParaEscolher: 'Tap a gear to pick it.',
        marchasRotulo: 'Work gear',
        creditoRotulo: 'Credit',
        credito: { poupa: 'saves', normal: 'normal', gasta: 'spends more' },
        nuncaCorta: 'Never cuts',
        nuncaCortaMarcha: 'money review, secrets, whoever builds never approves, your approval to publish.',
        saiEm: s => 'Goes to your agents in ' + s + ' s. You can still undo.',
        guardaEm: s => 'Saves in ' + s + ' s. You can still undo.',
        avisou: (nome, h) => nome + ': your agents were told at ' + h + '.',
        guardou: nome => nome + ': saved on this panel.',
        marchaDesfeita: 'Undone. The gear did not change.',
        minutosTitulo: 'Minutes of waiting cut',
        minutos: n => n + ' min',
        piso: 'at least',
        comeca: 'Starts at 0 and adds what you mark.',
        semFase: 'Turn on the first step to start adding.',
        somarPergunta: 'Measured a wait that went away?',
        somar: m => '+' + m + ' min',
        somou: m => 'Added ' + m + ' min.',
        meta: n => 'Next mark: ' + n + ' min',
        deOndeVem: 'Where it comes from',
        fase: (n, t) => 'Step ' + n + ' of ' + t,
        proxima: 'Next step',
        conquistasDe: (n, t) => n + ' of ' + t + ' achievements',
        ligar: 'Turn on',
        ligando: 'Turning on...',
        ligada: 'On',
        ligadaEm: d => 'On since ' + d,
        ligou: nome => nome + ': on.',
        ganho: 'Gain',
        ganhoMedido: 'Measured gain',
        escondidas: n => n === 1 ? '1 more step shows up after this one.' : n + ' more steps show up, one at a time.',
        desfazer: 'Undo',
        desfeito: 'Undone.',
        fechar: 'Close',
        lendo: 'Reading the steps...',
        semLeitura: 'Could not read the steps right now.',
        erro: 'Could not save right now. Try again.',
        soLeitura: 'Read only preview: nothing was saved.',
        foraDeOrdem: 'Turn on the previous step first.',
        ocupado: 'Another screen is saving right now. Try again.',
        semFaseSomar: 'Turn on a step before adding minutes.',
        marchaDica: 'Opens the 6 gears and what is on right now',
        marchaAria: (nome, estado) => 'Gear: ' + nome + (estado ? ', ' + estado : '') + '. Opens the gears.',
        estadoLigada: 'On',
        rotinaNome: 'Routine',
        estadoDesligada: 'Off',
        agora: 'Now',
        escolhidaBrt: (d, h) => 'Picked on ' + d + ' at ' + h,
        vivaLigada: (desde, ultima, prox, proxHora) => 'Rounds in a row since ' + desde + ' · last round ' + ultima + ' min ago' + (prox ? ' · next in ~' + prox + ' min (' + proxHora + ')' : ''),
        vivaParada: (dur, hora) => 'The routine has had no round for ' + dur + (hora ? ' (the last one was at ' + hora + ')' : ''),
        vivaDesligada: dur => 'Off · last round ' + dur + ' ago',
        vivaSemLeitura: 'No reading of the routine rounds.',
        solParada: 'Fix: ask your Claude to turn the 15 min round back on.',
        solSemLeitura: 'Fix: ask your Claude to run 1 round now; the log shows up here.',
        solMinutos: 'Fix: each round starts saving the minutes it gained.',
        hoje: 'today',
        semana: 'in the last 7 days',
        parcial: (m, v) => m + ' of ' + v + ' rounds measured',
        deOndeVemViva: (hv, hm, sv, sm) => 'Sum of the minutes gained that each round of the 15 min routine saves. Today: ' + hv + ' rounds, ' + hm + ' with minutes. Last 7 days: ' + sv + ' rounds, ' + sm + ' with minutes.',
        deOndeVemSem: 'Sum of the minutes gained that each round of the 15 min routine saves. No reading of the rounds right now.'
      },
      marchas: {
        1: { nome: 'Economy', linha: '1 heavy front at a time; a helper only when needed; the rest waits in line.' },
        2: { nome: 'Calm', linha: '2 heavy fronts at a time; one review at a time.' },
        3: { nome: 'Normal', linha: 'Up to 3 heavy fronts at a time, the usual ceiling; reviews in parallel.' },
        4: { nome: 'Fast', linha: 'Up to 3 heavy fronts, each with tests, reviews and screenshots at the same time.' },
        5: { nome: 'Max', linha: 'Everything in parallel where nothing collides: reviews in halves, approver ahead, another agent alongside.' },
        rotina: { nome: 'ROTINA', linha: 'Periodic review of work and next steps, according to the routine you configured.' }
      },
      fases: {
        1: { nome: 'Short status', pergunta: 'Do you read a wall of text to know where things stand? Want the state in 6 short lines, always with a time?', ganho: 'You decide in seconds.', nuncaCorta: 'The forecast always comes with a time.' },
        2: { nome: 'Automatic', pergunta: 'Do you keep asking how it is going? Want the status to refresh on its own every 5 min?', ganho: 'No asking just to know the state.', nuncaCorta: 'It changes just like a click, nothing hidden.' },
        3: { nome: 'Pre-approve', pergunta: 'Does your agent wait for your click to publish? Want it to publish on its own once everything passes?', ganho: 'Finished work does not sit waiting for you.', nuncaCorta: 'Tests, reviews and your release stay.' },
        4: { nome: 'Plan B', pergunta: 'Does one stuck item hold the whole delivery? Want to pull just that one and publish the rest?', ganho: 'One stuck item does not hold the others.', nuncaCorta: 'The pulled item only comes back fixed.' },
        5: { nome: 'Work window', pergunta: 'Does your other agent wait for your permission on every request? Want to open a work window with an end time?', ganho: 'No wait on every request.', nuncaCorta: 'Publishing, keys and money stay with you.' },
        6: { nome: 'Fresh reviewer', pergunta: 'Does approval wait on someone outside? Want a fresh reviewer, who did not do the work, to approve?', ganho: 'Approval does not wait on anyone outside.', nuncaCorta: 'Whoever builds never approves their own work.' },
        7: { nome: 'Review what matters', pergunta: 'Does every text go through review before it ships? Want to review first only what everyone sees?', ganho: 'Less waiting on every preview.', nuncaCorta: 'Anything touching money is always reviewed first.' },
        8: { nome: 'Approved base', pergunta: 'Does each job start from a different version? Want everything built on top of the last approved version?', ganho: 'Fewer merges to redo.', nuncaCorta: 'The release is checked against what is live.' },
        9: { nome: 'Free machine', pergunta: 'Does your computer freeze with everything running? Want to see what is heavy and send heavy tests to another machine?', ganho: 'Screenshots and tests without freezing.', nuncaCorta: 'Only the owner closes a program.' },
        10: { nome: 'Pick up stalled', pergunta: 'Is work stalled waiting on a busy agent? Want whoever is free to pick it up?', ganho: 'Stalled work moves again.', nuncaCorta: 'Nobody touches the other one\'s folder.' },
        11: { nome: 'Full force', pergunta: 'Do your agents work one at a time? Want several fronts at once where nobody fights over the same thing?', ganho: 'Several fronts moving together.', nuncaCorta: 'One release at a time.' }
      }
    },
    es: {
      ui: {
        botao: 'ACELERAR',
        dica: 'Marcha del trabajo y fases para que tus agentes esperen menos',
        titulo: 'Acelerar',
        escolhaMarcha: 'Elige tu marcha',
        marchaNome: (n, nome) => 'Marcha ' + n + ' · ' + nome,
        escolhidaEm: d => 'Elegida el ' + d,
        escolhidaAs: (d, h) => 'Elegida el ' + d + ' a las ' + h,
        toqueParaEscolher: 'Toca una marcha para elegirla.',
        marchasRotulo: 'Marcha del trabajo',
        creditoRotulo: 'Crédito',
        credito: { poupa: 'ahorra', normal: 'normal', gasta: 'gasta más' },
        nuncaCorta: 'Nunca recorta',
        nuncaCortaMarcha: 'revisión de dinero, secretos, quien hace no aprueba, tu aprobación para publicar.',
        saiEm: s => 'Va a tus agentes en ' + s + ' s. Aún puedes deshacer.',
        guardaEm: s => 'Se guarda en ' + s + ' s. Aún puedes deshacer.',
        avisou: (nome, h) => nome + ': se avisó a tus agentes a las ' + h + '.',
        guardou: nome => nome + ': guardada en este panel.',
        marchaDesfeita: 'Deshecho. La marcha no cambió.',
        minutosTitulo: 'Minutos de espera recortados',
        minutos: n => n + ' min',
        piso: 'como mínimo',
        comeca: 'Empieza en 0 y suma lo que marques.',
        semFase: 'Activa la primera fase para empezar a sumar.',
        somarPergunta: '¿Mediste una espera que desapareció?',
        somar: m => '+' + m + ' min',
        somou: m => 'Sumaste ' + m + ' min.',
        meta: n => 'Próxima marca: ' + n + ' min',
        deOndeVem: 'De dónde sale',
        fase: (n, t) => 'Fase ' + n + ' de ' + t,
        proxima: 'Próxima fase',
        conquistasDe: (n, t) => n + ' de ' + t + ' logros',
        ligar: 'Activar',
        ligando: 'Activando...',
        ligada: 'Activa',
        ligadaEm: d => 'Activa desde el ' + d,
        ligou: nome => nome + ': activa.',
        ganho: 'Ganancia',
        ganhoMedido: 'Ganancia medida',
        escondidas: n => n === 1 ? 'Falta 1 fase más: aparece después de esta.' : 'Aparecen ' + n + ' fases más, una por vez.',
        desfazer: 'Deshacer',
        desfeito: 'Deshecho.',
        fechar: 'Cerrar',
        lendo: 'Leyendo las fases...',
        semLeitura: 'No se pudieron leer las fases ahora.',
        erro: 'No se pudo guardar ahora. Prueba de nuevo.',
        soLeitura: 'Vista previa de solo lectura: no se guardó nada.',
        foraDeOrdem: 'Activa primero la fase anterior.',
        ocupado: 'Otra pantalla está guardando ahora. Prueba de nuevo.',
        semFaseSomar: 'Activa una fase antes de sumar minutos.',
        marchaDica: 'Abre las 6 marchas y lo que está encendido ahora',
        marchaAria: (nome, estado) => 'Marcha: ' + nome + (estado ? ', ' + estado : '') + '. Abre las marchas.',
        estadoLigada: 'Encendida',
        rotinaNome: 'Rutina',
        estadoDesligada: 'Apagada',
        agora: 'Ahora',
        escolhidaBrt: (d, h) => 'Elegida el ' + d + ' a las ' + h,
        vivaLigada: (desde, ultima, prox, proxHora) => 'Vueltas seguidas desde ' + desde + ' · última vuelta hace ' + ultima + ' min' + (prox ? ' · próxima en ~' + prox + ' min (' + proxHora + ')' : ''),
        vivaParada: (dur, hora) => 'Rutina sin vuelta hace ' + dur + (hora ? ' (la última fue a las ' + hora + ')' : ''),
        vivaDesligada: dur => 'Apagada · última vuelta hace ' + dur,
        vivaSemLeitura: 'Sin lectura de las vueltas de la rutina.',
        solParada: 'Solución: pide a tu Claude que vuelva a encender la vuelta de 15 min.',
        solSemLeitura: 'Solución: pide a tu Claude que corra 1 vuelta ahora; el registro aparece aquí.',
        solMinutos: 'Solución: cada vuelta pasa a guardar los minutos que ganó.',
        hoje: 'hoy',
        semana: 'en los últimos 7 días',
        parcial: (m, v) => m + ' de ' + v + ' vueltas midieron',
        deOndeVemViva: (hv, hm, sv, sm) => 'Suma de los minutos ganados que guarda cada vuelta de la rutina de 15 min. Hoy: ' + hv + ' vueltas, ' + hm + ' con minutos. Últimos 7 días: ' + sv + ' vueltas, ' + sm + ' con minutos.',
        deOndeVemSem: 'Suma de los minutos ganados que guarda cada vuelta de la rutina de 15 min. Sin lectura de las vueltas ahora.'
      },
      marchas: {
        1: { nome: 'Económica', linha: '1 frente pesado a la vez; ayudante solo cuando hace falta; el resto espera en la fila.' },
        2: { nome: 'Tranquila', linha: '2 frentes pesados a la vez; una revisión por vez.' },
        3: { nome: 'Normal', linha: 'Hasta 3 frentes pesados a la vez, el techo de siempre; revisiones en paralelo.' },
        4: { nome: 'Rápida', linha: 'Hasta 3 frentes pesados, cada uno con pruebas, revisiones y capturas al mismo tiempo.' },
        5: { nome: 'Máxima', linha: 'Todo en paralelo donde no hay disputa: revisiones en mitades, quien aprueba adelantado, otro agente al lado.' },
        rotina: { nome: 'ROTINA', linha: 'Revisión periódica del trabajo y los próximos pasos, según la rutina que configuraste.' }
      },
      fases: {
        1: { nome: 'Estado corto', pergunta: '¿Lees un texto enorme para saber cómo va? ¿Quieres el estado en 6 líneas cortas, siempre con hora?', ganho: 'Decides en segundos.', nuncaCorta: 'La previsión siempre viene con hora.' },
        2: { nome: 'Automático', pergunta: '¿Preguntas a cada rato cómo va? ¿Quieres que el estado se actualice solo cada 5 min?', ganho: 'Ninguna pregunta solo para saber el estado.', nuncaCorta: 'Cambia igual que con un clic, nada oculto.' },
        3: { nome: 'Preaprobar', pergunta: '¿Tu agente espera tu clic para publicar? ¿Quieres que publique solo cuando todo pase?', ganho: 'Lo terminado no queda esperándote.', nuncaCorta: 'Pruebas, revisiones y tu liberación siguen.' },
        4: { nome: 'Plan B', pergunta: '¿Un elemento trabado frena toda la entrega? ¿Quieres sacar solo ese y publicar el resto?', ganho: 'Uno trabado no frena a los demás.', nuncaCorta: 'El elemento sacado solo vuelve arreglado.' },
        5: { nome: 'Ventana de trabajo', pergunta: '¿Tu otro agente espera tu permiso en cada pedido? ¿Quieres abrir una ventana de trabajo con hora de cierre?', ganho: 'Sin espera en cada pedido.', nuncaCorta: 'Publicar, claves y dinero siguen contigo.' },
        6: { nome: 'Revisor nuevo', pergunta: '¿La aprobación espera a alguien de fuera? ¿Quieres que apruebe un revisor nuevo, que no hizo el trabajo?', ganho: 'La aprobación no espera a nadie de fuera.', nuncaCorta: 'Quien hace nunca aprueba su propio trabajo.' },
        7: { nome: 'Revisar lo que importa', pergunta: '¿Todo texto pasa por revisión antes de salir? ¿Quieres revisar antes solo lo que todos ven?', ganho: 'Menos espera en cada vista previa.', nuncaCorta: 'Lo que toca dinero siempre se revisa antes.' },
        8: { nome: 'Base aprobada', pergunta: '¿Cada trabajo empieza de una versión distinta? ¿Quieres que todo nazca sobre la última versión aprobada?', ganho: 'Menos uniones para rehacer.', nuncaCorta: 'La liberación se compara con lo publicado.' },
        9: { nome: 'Máquina libre', pergunta: '¿Tu computadora se traba con todo corriendo? ¿Quieres ver qué pesa y mandar las pruebas pesadas a otra máquina?', ganho: 'Capturas y pruebas sin trabarse.', nuncaCorta: 'Solo el dueño cierra un programa.' },
        10: { nome: 'Tomar lo parado', pergunta: '¿Hay trabajo parado esperando a un agente ocupado? ¿Quieres que lo tome quien está libre?', ganho: 'Lo parado vuelve a andar.', nuncaCorta: 'Nadie toca la carpeta del otro.' },
        11: { nome: 'Fuerza total', pergunta: '¿Tus agentes trabajan de a uno? ¿Quieres varios frentes juntos donde nadie se pisa?', ganho: 'Varios frentes avanzando juntos.', nuncaCorta: 'Una publicación a la vez.' }
      }
    }
  };

  // ---------- regras (as mesmas no navegador e no servidor) ----------
  // Ligadas contam so em ordem: a fase 3 sem a 2 nao conta (sem pular).
  function ligadasEmOrdem(fases) { let k = 0; while (k < TOTAL && fases && fases[String(k + 1)]) k++; return k; }
  function visiveis(estado) {
    const k = ligadasEmOrdem(estado && estado.fases);
    return { ligadas: Array.from({ length: k }, (_, i) => i + 1), proxima: k < TOTAL ? k + 1 : null, escondidas: Math.max(0, TOTAL - k - 1) };
  }
  function marchaValida(n) { return Number.isInteger(n) && MARCHAS.includes(n); }
  function creditoDe(n, lang) { return n === ROTINA ? TEXTOS[lingua(lang)].ui.credito.gasta : marchaValida(n) ? TEXTOS[lingua(lang)].ui.credito[CREDITO_DA_MARCHA[n]] : ''; }
  // Minutos: so o que foi medido (o piso do dono, escrito no playbook) e o que a pessoa marcou. Nunca um numero inventado.
  function minutosDe(estado) {
    const itens = estado && estado.medido && Array.isArray(estado.medido.itens) ? estado.medido.itens : [];
    const marcas = estado && Array.isArray(estado.marcas) ? estado.marcas : [];
    const soma = lista => lista.reduce((t, x) => t + (x && Number.isInteger(x.minutos) && x.minutos > 0 ? x.minutos : 0), 0);
    return soma(itens) + soma(marcas);
  }
  function metaDe(min) { for (const m of METAS) if (min < m) return m; let m = METAS[METAS.length - 1]; while (m <= min) m *= 2; return m; }
  function passoBarra(min, meta) { if (!(meta > 0) || !(min > 0)) return 0; return Math.max(1, Math.min(20, Math.round(min / meta * 20))); }
  function lingua(valor) { return Object.prototype.hasOwnProperty.call(TEXTOS, valor) ? valor : 'pt'; }
  function diaDe(iso, lang) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    return lang === 'en' ? MESES_EN[Number(m[2]) - 1] + ' ' + Number(m[3]) : m[3] + '/' + m[2];
  }
  function horaDe(iso) { const m = /T(\d{2}):(\d{2})/.exec(String(iso || '')); return m ? m[1] + ':' + m[2] : ''; }
  function numero(n, lang) { try { return new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR').format(n); } catch { return String(n); } }

  // ---------- marcha viva (10/10): o que esta ligado agora, lido das voltas de 15 min do ROTINA (marcha-viva.cjs) ----------
  // Data no formato da lingua: pt e es "DD/MM", en "Oct 9". Hora no relogio deste computador. Nunca nome de arquivo na frase.
  function diaNaLingua(ddmm, lang) { const m = /^(\d{2})\/(\d{2})$/.exec(String(ddmm || '')); if (!m) return ''; return lang === 'en' ? MESES_EN[Number(m[2]) - 1] + ' ' + Number(m[1]) : ddmm; }
  function duracao(min, lang) {
    if (!Number.isFinite(min)) return '?';
    if (min < 120) return min + ' min';
    const h = Math.round(min / 60);
    if (h < 48) return '~' + h + ' h';
    const d = Math.round(min / 1440); return '~' + d + (lang === 'en' ? (d === 1 ? ' day' : ' days') : lang === 'es' ? (d === 1 ? ' día' : ' días') : (d === 1 ? ' dia' : ' dias'));
  }
  function minutosTexto(bloco, lido, lang) {
    if (!lido || !bloco || bloco.soma === null || bloco.soma === undefined || !Number.isFinite(bloco.soma)) return '?';
    if (bloco.soma === 0) return 'none';
    return numero(bloco.soma, lang) + ' min';
  }
  function resumoViva(viva, lang) {
    const L = lingua(lang), W = TEXTOS[L].ui, v = viva && typeof viva === 'object' ? viva : { lido: false, estado: 'sem-leitura' };
    const lido = v.lido === true, est = lido ? v.estado : 'sem-leitura';
    const r = { ligada: est === 'ligada', estado: est, estadoTexto: '?', linha: '', solucao: '', hoje: '?', semana: '?', parcialHoje: '', parcialSemana: '', solucaoMinutos: '', deOndeVem: W.deOndeVemSem };
    if (est === 'ligada') {
      const desde = (v.desdeDia && v.hojeDia && v.desdeDia !== v.hojeDia ? diaNaLingua(v.desdeDia, L) + ' ' : '') + (v.desdeHora || '?');
      r.estadoTexto = W.estadoLigada; r.linha = W.vivaLigada(desde, Number.isFinite(v.ultimaMin) ? v.ultimaMin : '?', v.proximaMin, v.proximaHora);
    } else if (est === 'desligada') { r.estadoTexto = W.estadoDesligada; r.linha = W.vivaDesligada(duracao(v.ultimaMin, L)); }
    else if (est === 'parada') { r.linha = W.vivaParada(duracao(v.ultimaMin, L), v.ultimaHora); r.solucao = W.solParada; }
    else { r.linha = W.vivaSemLeitura; r.solucao = W.solSemLeitura; }
    r.hoje = minutosTexto(v.hoje, lido, L); r.semana = minutosTexto(v.semana, lido, L);
    const parcial = b => b && b.medidas > 0 && b.voltas > b.medidas ? W.parcial(b.medidas, b.voltas) : '';
    if (lido) { r.parcialHoje = parcial(v.hoje); r.parcialSemana = parcial(v.semana); r.deOndeVem = W.deOndeVemViva(v.hoje.voltas, v.hoje.medidas, v.semana.voltas, v.semana.medidas); }
    if (r.hoje === '?' || r.semana === '?') r.solucaoMinutos = lido ? W.solMinutos : W.solSemLeitura;
    return r;
  }
  // botao do cabecalho: o nome da marcha ligada; a ROTINA com o simbolo e rosa so quando as voltas estao ligadas
  function rotuloGatilho(marcha, viva, lang) {
    const L = lingua(lang), n = marcha && typeof marcha === 'object' ? marcha.n : null;
    if (n === ROTINA) { const est = viva && viva.lido !== false ? viva.estado : 'sem-leitura'; return { simbolo: '∞', nome: TEXTOS[L].ui.rotinaNome, rosa: est === 'ligada', duvida: est !== 'ligada' && est !== 'desligada' }; }
    if (marchaValida(n)) return { simbolo: String(n), nome: TEXTOS[L].marchas[n].nome, rosa: false, duvida: false };
    return { simbolo: '', nome: TEXTOS[L].ui.botao, rosa: false, duvida: false };
  }
  function bordaLigada(marcha, viva) { return !!(marcha && marcha.n === ROTINA && viva && viva.estado === 'ligada' && viva.lido !== false); }

  const exportado = { TOTAL, MARCHAS, ROTINA, CREDITO_DA_MARCHA, ESPERA_MARCHA_S, METAS, SOMAS, FASES, TEXTOS, ICONES, ligadasEmOrdem, visiveis, marchaValida, creditoDe, minutosDe, metaDe, passoBarra, lingua, diaDe, horaDe, numero, resumoViva, rotuloGatilho, bordaLigada, duracao, diaNaLingua };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportado;
  if (!root.document || root.PainelAcelerador) return;

  // ---------- tela ----------
  const doc = root.document;
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, cls, txt) { const n = doc.createElement(tag); if (cls) n.className = cls; if (txt !== undefined && txt !== null) n.textContent = txt; return n; }
  function icone(nome, cls) {
    const s = doc.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.setAttribute('class', 'acel-svg' + (cls ? ' ' + cls : ''));
    const p = doc.createElementNS(NS, 'path'); p.setAttribute('d', ICONES[nome] || ''); s.append(p);
    return s;
  }
  const INF_PIX = ['.##...##.', '#..#.#..#', '#...#...#', '#..#.#..#', '.##...##.'];
  function pixelInfinito() {
    const s = doc.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 9 5'); s.setAttribute('class', 'acel-pix-inf'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.setAttribute('shape-rendering', 'crispEdges');
    INF_PIX.forEach((linha, y) => { for (let x = 0; x < linha.length; x++) if (linha[x] === '#') { const q = doc.createElementNS(NS, 'rect'); q.setAttribute('x', String(x)); q.setAttribute('y', String(y)); q.setAttribute('width', '1'); q.setAttribute('height', '1'); s.append(q); } });
    return s;
  }
  function botao(cls, txt, foco) { const b = el('button', cls, txt); b.type = 'button'; if (foco) b.dataset.foco = foco; return b; }
  function par(rotulo, texto) { const d = el('div', 'acel-par'); d.append(el('dt', null, rotulo), el('dd', null, texto)); return d; }
  function reduzido() {
    try { return doc.documentElement.dataset.motion === 'off' || !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
  }
  function linguaDaTela(pedida) { const sel = doc.getElementById('language'); return lingua(pedida || (sel && sel.value) || doc.documentElement.lang || 'pt'); }
  function textoEm(obj, lang) { return obj && typeof obj === 'object' ? String(obj[lang] || obj.pt || '') : ''; }
  function normalizar(j) {
    j = j && typeof j === 'object' ? j : {};
    const inf = j.rotina && typeof j.rotina === 'object' && j.rotina.texto && typeof j.rotina.texto === 'object' ? j.rotina : null;
    const m = j.marcha && typeof j.marcha === 'object' && (marchaValida(j.marcha.n) || (inf && j.marcha.n === ROTINA)) ? j.marcha : null;
    return {
      token: typeof j.token === 'string' ? j.token : '',
      modo: j.modo === 'dono' ? 'dono' : 'publico',
      avisa: j.avisa === true,
      fases: j.fases && typeof j.fases === 'object' ? j.fases : {},
      ganhos: j.ganhos && typeof j.ganhos === 'object' ? j.ganhos : {},
      medido: j.medido && Array.isArray(j.medido.itens) && j.medido.itens.length ? j.medido : null,
      marcas: Array.isArray(j.marcas) ? j.marcas : [],
      marcha: m,
      marchasTexto: j.marchasTexto && typeof j.marchasTexto === 'object' ? j.marchasTexto : {},
      nuncaCorta: j.nuncaCorta && typeof j.nuncaCorta === 'object' ? j.nuncaCorta : null,
      rotina: inf,
      // so no dono: o que esta ligado agora (as voltas de 15 min do ROTINA), lido do disco pelo servidor
      viva: j.viva && typeof j.viva === 'object' ? j.viva : null
    };
  }

  function montar(host, opcoes) {
    opcoes = opcoes || {};
    if (!host) return null;
    if (host.__acel) return host.__acel;
    const api = String(opcoes.api || host.getAttribute('data-api') || '/api/acelerador').replace(/\/+$/, '');
    const s = { relogio: null, dados: null, falhou: false, carregando: null, langPedida: opcoes.lang || null, ocupado: false, vivo: true, abertas: new Set(), origemAberta: false, novaFase: null, marchaNova: false, avisoTimer: null, desfazer: null, pendente: null, abrirDepois: false, voltar: null, assinatura: '' };
    const lang = () => linguaDaTela(s.langPedida);
    const w = () => TEXTOS[lang()].ui;
    const f = id => TEXTOS[lang()].fases[id];
    const estado = () => s.dados || normalizar(null);
    const salva = () => (s.dados && s.dados.marcha ? s.dados.marcha.n : null);
    const efetiva = () => (s.pendente ? s.pendente.n : salva());
    const nomeMarcha = n => n === ROTINA ? 'Rotina' : TEXTOS[lang()].marchas[n].nome;
    const linhaMarcha = n => n === ROTINA ? textoEm(estado().rotina && estado().rotina.texto, lang()) || TEXTOS[lang()].marchas.rotina.linha : textoEm(estado().marchasTexto[String(n)], lang()) || TEXTOS[lang()].marchas[n].linha;
    const rotuloMarcha = n => n === ROTINA ? 'Rotina' : w().marchaNome(n, nomeMarcha(n));

    // botao (no gancho; no celular entra na barra do WEN)
    const controles = el('div', 'acel-controls');
    controles.setAttribute('data-acelerador', '');
    const gatilho = botao('acel-trigger');
    gatilho.id = 'acel-trigger';
    gatilho.setAttribute('aria-haspopup', 'dialog');
    gatilho.setAttribute('aria-controls', 'acel-gaveta');
    gatilho.setAttribute('aria-expanded', 'false');
    // 10/10 (PECA 5): o botao mostra a marcha ligada: o simbolo (o infinito ou o numero), o nome e, na ROTINA sem volta, um "?"
    const gSimbolo = el('span', 'acel-trigger-simbolo');
    gSimbolo.setAttribute('aria-hidden', 'true');
    const gNome = el('span', 'acel-trigger-nome');
    const gNiveis = el('span', 'acel-niveis');
    gNiveis.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < MARCHAS.length; i++) gNiveis.append(el('i'));
    const gDuvida = el('span', 'acel-trigger-duvida', '?');
    gDuvida.setAttribute('aria-hidden', 'true');
    gatilho.append(gSimbolo, gNome, gNiveis, gDuvida);
    controles.append(gatilho);
    host.replaceChildren(controles);

    // gaveta
    const gaveta = el('dialog', 'acel-gaveta');
    gaveta.id = 'acel-gaveta';
    gaveta.setAttribute('aria-labelledby', 'acel-titulo');
    const corpo = el('div', 'acel-corpo');
    const topo = el('div', 'acel-topo');
    const sobre = el('span', 'acel-sobre');
    const fechar = botao('acel-fechar', null, 'fechar');
    fechar.append(icone('fechar'));
    topo.append(sobre, fechar);
    // marcha: o controle (5 toques) e a linha fixa do que nunca corta
    const secMarcha = el('section', 'acel-marcha');
    const titulo = el('h2', 'acel-titulo');
    titulo.id = 'acel-titulo';
    const sub = el('p', 'acel-sub');
    // o que esta ligado agora (so no dono): selo, linha com a hora local e, se for "?", a solucao
    const vivaBox = el('div', 'acel-viva');
    vivaBox.hidden = true;
    const seletor = el('div', 'acel-seletor');
    seletor.setAttribute('role', 'group');
    const botoesMarcha = new Map();
    for (const n of [...MARCHAS, ROTINA]) {
      const b = botao('acel-opcao' + (n === ROTINA ? ' acel-opcao-rotina' : ''), null, 'marcha-' + n);
      // data-acel-marcha, nunca data-marcha: o WEN (status6.js) se muda para perto de qualquer [data-marcha]
      b.dataset.acelMarcha = String(n);
      const num = el('span', 'acel-opcao-n', n === ROTINA ? '∞' : String(n));
      num.setAttribute('aria-hidden', 'true');
      const meio = el('span', 'acel-opcao-corpo');
      const nome = el('span', 'acel-opcao-nome'), linha = el('span', 'acel-opcao-linha');
      meio.append(nome, linha);
      const cred = el('span', 'acel-opcao-credito');
      b.append(num, meio, cred);
      b.addEventListener('click', () => escolherMarcha(n));
      seletor.append(b);
      botoesMarcha.set(n, { b, nome, linha, cred });
    }
    const nunca = el('p', 'acel-nunca');
    secMarcha.append(titulo, sub, vivaBox, seletor, nunca);
    // minutos: trilho fixo (a barra anda com transicao); o resto refaz a cada leitura
    const secMin = el('section', 'acel-minutos');
    const minRotulo = el('p', 'acel-rotulo');
    const minTotal = el('p', 'acel-total');
    const minNum = el('strong', 'acel-num');
    const minPiso = el('span', 'acel-piso');
    minTotal.append(minNum, minPiso);
    const trilho = el('div', 'acel-trilho');
    trilho.setAttribute('role', 'progressbar');
    trilho.setAttribute('aria-valuemin', '0');
    trilho.append(el('span', 'acel-cheio'));
    const minExtra = el('div', 'acel-min-extra');
    secMin.append(minRotulo, minTotal, trilho, minExtra);
    const leitura = el('p', 'acel-leitura');
    const secProx = el('section', 'acel-proxima-sec');
    const secConq = el('section', 'acel-conquistas-sec');
    corpo.append(topo, secMarcha, secMin, leitura, secProx, secConq);
    const aviso = el('div', 'acel-aviso');
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    aviso.hidden = true;
    const avisoTexto = el('span', 'acel-aviso-texto');
    const avisoDesfazer = botao('acel-desfazer', null, 'desfazer');
    avisoDesfazer.hidden = true;
    aviso.append(avisoTexto, avisoDesfazer);
    gaveta.append(corpo, aviso);
    doc.body.append(gaveta);
    // PECA 3: a borda rosa viva em volta da tela inteira quando a ROTINA esta ligada (nao cobre nada, nao rouba clique)
    const borda = el('div', 'acel-borda');
    borda.setAttribute('aria-hidden', 'true');
    // 4 cometas, um por lado, em fila: o brilho da a volta na tela (so transform e opacity; parado com Motion off)
    for (let i = 1; i <= 4; i++) borda.append(el('i', 'acel-cometa c' + i));
    doc.body.append(borda);

    function piscar(node, cls, ms) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(() => node.classList.remove(cls), ms); }
    function focar(chave) {
      if (!chave) return false;
      const alvo = Array.from(gaveta.querySelectorAll('[data-foco]')).find(n => n.dataset.foco === chave && !n.disabled && !n.hidden);
      if (!alvo) return false;
      try { alvo.focus({ preventScroll: false }); } catch { return false; }
      return true;
    }

    // ---------- desenho ----------
    function renderGatilho() {
      const W = w(), L = lang(), g = s.dados ? efetiva() : null, viva = s.dados ? s.dados.viva : null;
      const r = rotuloGatilho(g ? { n: g } : null, viva, L), rv = viva ? resumoViva(viva, L) : null;
      // o infinito em pixel (a fonte pixel da casa nao tem o caractere): 9 x 5 quadrados, cor do texto
      if (r.simbolo === '∞') { if (gSimbolo.dataset.pix !== '1') { gSimbolo.replaceChildren(pixelInfinito()); gSimbolo.dataset.pix = '1'; } }
      else { gSimbolo.textContent = r.simbolo; delete gSimbolo.dataset.pix; }
      gSimbolo.hidden = !r.simbolo;
      gatilho.classList.toggle('sem-simbolo', !r.simbolo);
      gNome.textContent = r.nome;
      gDuvida.hidden = !r.duvida;
      const est = g === ROTINA && rv ? (rv.estadoTexto === '?' ? '?' : rv.estadoTexto.toLowerCase()) : '';
      gatilho.title = W.marchaDica + (g === ROTINA && rv ? '. ' + rv.linha : '');
      gatilho.setAttribute('aria-label', s.dados && g ? W.marchaAria(r.nome, est) : W.botao + ': ' + W.marchaDica);
      gNiveis.hidden = !s.dados || !g || g === ROTINA;
      gatilho.classList.toggle('is-viva', r.rosa);
      gatilho.classList.toggle('is-duvida', r.duvida);
      const nivel = g === ROTINA ? MARCHAS.length : g;
      Array.from(gNiveis.children).forEach((i, k) => { i.classList.toggle('is-on', !!nivel && k < nivel); i.classList.toggle('is-novo', s.marchaNova && !!nivel && k === nivel - 1); });
      gatilho.classList.toggle('is-cheio', nivel === MARCHAS.length);
      gatilho.classList.toggle('is-rotina', g === ROTINA);
    }
    function renderMarcha() {
      const W = w(), L = lang(), g = efetiva(), m = s.dados && s.dados.marcha;
      sobre.textContent = W.titulo;
      fechar.setAttribute('aria-label', W.fechar);
      fechar.title = W.fechar;
      titulo.textContent = !s.dados ? W.titulo : g ? rotuloMarcha(g) : W.escolhaMarcha;
      if (s.marchaNova && !reduzido()) piscar(titulo, 'is-novo', 520);
      const viva = s.dados && s.dados.viva;
      sub.textContent = !s.dados || s.pendente ? '' : viva ? (m ? '' : W.toqueParaEscolher) : m ? (horaDe(m.em) ? W.escolhidaBrt(diaDe(m.em, L), horaDe(m.em)) : W.escolhidaEm(diaDe(m.em, L))) : W.toqueParaEscolher;
      sub.hidden = !sub.textContent;
      vivaBox.hidden = !viva;
      if (viva) {
        const rv = resumoViva(viva, L), selo = el('span', 'acel-viva-selo', (g === ROTINA ? '' : W.rotinaNome + ' · ') + rv.estadoTexto);
        vivaBox.dataset.estado = rv.estado;
        vivaBox.replaceChildren(selo, el('span', 'acel-viva-linha', rv.linha));
        if (rv.solucao) vivaBox.append(el('span', 'acel-viva-sol', rv.solucao));
      } else vivaBox.replaceChildren();
      seletor.hidden = !s.dados;
      seletor.setAttribute('aria-label', W.marchasRotulo);
      for (const [n, o] of botoesMarcha) {
        const marcada = g === n, credito = creditoDe(n, L);
        o.nome.textContent = nomeMarcha(n);
        o.linha.textContent = linhaMarcha(n);
        o.cred.textContent = credito;
        o.b.setAttribute('aria-pressed', String(marcada));
        o.b.setAttribute('aria-label', rotuloMarcha(n) + '. ' + linhaMarcha(n) + ' ' + W.creditoRotulo + ': ' + credito + '.');
        o.b.classList.toggle('is-pendente', !!s.pendente && s.pendente.n === n);
        o.b.disabled = s.ocupado === 'marcha';
        o.b.hidden = n === ROTINA && !estado().rotina;
      }
      nunca.hidden = !s.dados;
      nunca.replaceChildren(el('strong', null, W.nuncaCorta), el('span', null, textoEm(estado().nuncaCorta, L) || W.nuncaCortaMarcha));
    }
    function renderMinutos() {
      const W = w(), L = lang(), e = estado(), v = visiveis(e);
      secMin.hidden = !s.dados;
      if (!s.dados) return;
      if (e.viva) { renderMinutosVivos(e.viva); return; }
      trilho.hidden = false; minTotal.classList.remove('is-duvida');
      const total = minutosDe(e), meta = metaDe(total), dono = e.modo === 'dono' && !!e.medido;
      // a proxima marca so aparece quando ja da para somar (antes da 1a fase ligada, so o 0)
      // replaceChildren escreve "null" na tela se receber null: so entra o que existe
      const rotulo = [el('span', null, W.minutosTitulo)];
      if (v.ligadas.length || total) rotulo.push(el('span', 'acel-rotulo-n acel-meta', W.meta(numero(meta, L))));
      minRotulo.replaceChildren(...rotulo);
      minNum.textContent = W.minutos(numero(total, L));
      minPiso.textContent = dono ? W.piso : '';
      minPiso.hidden = !dono;
      trilho.dataset.passo = String(passoBarra(total, meta));
      trilho.setAttribute('aria-label', W.minutosTitulo);
      trilho.setAttribute('aria-valuemax', String(meta));
      trilho.setAttribute('aria-valuenow', String(Math.min(total, meta)));
      trilho.setAttribute('aria-valuetext', W.minutos(numero(total, L)) + '. ' + W.meta(numero(meta, L)));
      const partes = [];
      if (dono) partes.push(origem(e));
      if (v.ligadas.length) partes.push(somar(dono ? W.somarPergunta : W.comeca, dono));
      else partes.push(el('p', 'acel-nota', W.semFase));
      minExtra.replaceChildren(...partes);
    }
    function renderMinutosVivos(viva) {
      const W = w(), L = lang(), rv = resumoViva(viva, L);
      minRotulo.replaceChildren(el('span', null, W.minutosTitulo));
      minNum.textContent = rv.hoje; minPiso.textContent = W.hoje; minPiso.hidden = false;
      minTotal.classList.toggle('is-duvida', rv.hoje === '?');
      trilho.hidden = true;
      const semana = el('p', 'acel-semana' + (rv.semana === '?' ? ' is-duvida' : ''));
      semana.append(el('strong', null, rv.semana), el('span', null, W.semana));
      const partes = [semana];
      if (rv.parcialHoje) partes.push(el('p', 'acel-nota', rv.parcialHoje + ' ' + W.hoje + '.'));
      if (rv.parcialSemana) partes.push(el('p', 'acel-nota', rv.parcialSemana + ' ' + W.semana + '.'));
      if (rv.solucaoMinutos) partes.push(el('p', 'acel-sol', rv.solucaoMinutos));
      const box = el('details', 'acel-origem');
      if (s.origemAberta) box.open = true;
      box.addEventListener('toggle', () => { s.origemAberta = box.open; });
      const resumo = el('summary', 'acel-origem-sum');
      resumo.dataset.foco = 'origem';
      resumo.append(el('span', 'acel-origem-link', W.deOndeVem));
      box.append(resumo, el('p', 'acel-origem-nota', rv.deOndeVem));
      partes.push(box);
      minExtra.replaceChildren(...partes);
    }
    function origem(e) {
      const W = w(), L = lang(), med = e.medido;
      const box = el('details', 'acel-origem');
      if (s.origemAberta) box.open = true;
      box.addEventListener('toggle', () => { s.origemAberta = box.open; });
      const resumo = el('summary', 'acel-origem-sum');
      resumo.dataset.foco = 'origem';
      resumo.append(el('span', 'acel-origem-fonte', textoEm(med.fonte, L)), el('span', 'acel-origem-link', W.deOndeVem));
      if (med.arquivo) resumo.title = med.arquivo;
      const lista = el('ul', 'acel-origem-lista');
      for (const item of med.itens) {
        const li = el('li');
        const t = f(item.fase);
        li.append(el('span', 'acel-origem-nome', t ? t.nome : W.fase(item.fase, TOTAL)), el('strong', 'acel-origem-min', W.minutos(numero(item.minutos, L))), el('span', 'acel-origem-texto', textoEm(item.texto, L)));
        lista.append(li);
      }
      box.append(resumo, lista);
      const nota = textoEm(med.nota, L);
      if (nota) box.append(el('p', 'acel-origem-nota', nota));
      return box;
    }
    function somar(pergunta, comLinha) {
      const W = w(), box = el('div', 'acel-somar' + (comLinha ? ' com-linha' : ''));
      box.append(el('span', 'acel-somar-q', pergunta));
      const chips = el('div', 'acel-chips');
      for (const m of SOMAS) {
        const b = botao('acel-chip', W.somar(m), 'somar-' + m);
        b.disabled = !!s.ocupado;
        b.addEventListener('click', () => somarMinutos(m));
        chips.append(b);
      }
      box.append(chips);
      return box;
    }
    function ganhoDe(id) {
      const medido = textoEm(estado().ganhos[String(id)], lang());
      return medido ? { texto: medido, medido: true } : { texto: f(id).ganho, medido: false };
    }
    function renderProxima() {
      const W = w(), v = visiveis(estado());
      secProx.hidden = !s.dados || !v.proxima;
      if (secProx.hidden) { secProx.replaceChildren(); return; }
      const id = v.proxima, t = f(id), g = ganhoDe(id);
      const rot = el('p', 'acel-rotulo');
      rot.append(el('span', null, W.proxima), el('span', 'acel-rotulo-n', W.fase(id, TOTAL)));
      const card = el('article', 'acel-proxima' + (s.novaFase ? ' is-chegando' : ''));
      card.dataset.fase = String(id);
      const cabeca = el('div', 'acel-fase-topo');
      const ic = el('span', 'acel-icone');
      ic.append(icone(FASES[id - 1].icone));
      cabeca.append(ic, el('h3', 'acel-nome', t.nome));
      const q = el('p', 'acel-pergunta', t.pergunta);
      q.id = 'acel-q-' + id;
      const ligarB = botao('acel-ligar', s.ocupado === 'ligar' ? W.ligando : W.ligar, 'ligar');
      ligarB.setAttribute('aria-describedby', q.id);
      if (s.ocupado) { ligarB.disabled = true; if (s.ocupado === 'ligar') ligarB.setAttribute('aria-busy', 'true'); }
      ligarB.addEventListener('click', () => ligar(id));
      const linhas = el('dl', 'acel-linhas');
      linhas.append(par(g.medido ? W.ganhoMedido : W.ganho, g.texto), par(W.nuncaCorta, t.nuncaCorta));
      card.append(cabeca, q, ligarB, linhas);
      const partes = [rot, card];
      if (v.escondidas > 0) partes.push(el('p', 'acel-escondidas', W.escondidas(v.escondidas)));
      secProx.replaceChildren(...partes);
    }
    function renderConquistas() {
      const W = w(), L = lang(), e = estado(), v = visiveis(e);
      secConq.hidden = !s.dados || !v.ligadas.length;
      if (secConq.hidden) { secConq.replaceChildren(); return; }
      const rot = el('p', 'acel-rotulo', W.conquistasDe(v.ligadas.length, TOTAL));
      const lista = el('ul', 'acel-lista');
      for (const id of v.ligadas) {
        const t = f(id), dia = diaDe((e.fases[String(id)] || {}).em, L), g = ganhoDe(id);
        const li = el('li');
        const det = el('details', 'acel-conquista' + (s.novaFase === id ? ' is-nova' : ''));
        det.dataset.fase = String(id);
        if (s.abertas.has(id)) det.open = true;
        det.addEventListener('toggle', () => { if (det.open) s.abertas.add(id); else s.abertas.delete(id); });
        const resumo = el('summary', 'acel-conquista-sum');
        resumo.dataset.foco = 'conq-' + id;
        const ic = el('span', 'acel-icone');
        ic.append(icone(FASES[id - 1].icone));
        const feita = el('span', 'acel-feita');
        feita.append(icone('check'), el('span', null, dia ? W.ligadaEm(dia) : W.ligada));
        resumo.append(ic, el('span', 'acel-conquista-nome', t.nome), feita, icone('seta', 'acel-seta'));
        const detalhe = el('div', 'acel-detalhe');
        const linhas = el('dl', 'acel-linhas');
        linhas.append(par(g.medido ? W.ganhoMedido : W.ganho, g.texto), par(W.nuncaCorta, t.nuncaCorta));
        detalhe.append(el('p', 'acel-pergunta', t.pergunta), linhas);
        det.append(resumo, detalhe);
        li.append(det);
        lista.append(li);
      }
      secConq.replaceChildren(rot, lista);
    }
    function renderLeitura() {
      const W = w();
      leitura.hidden = !!s.dados;
      leitura.textContent = s.dados ? '' : s.falhou ? W.semLeitura : W.lendo;
    }
    function renderTudo() {
      if (!s.vivo) return;
      const ativo = doc.activeElement && gaveta.contains(doc.activeElement) && doc.activeElement.dataset ? doc.activeElement.dataset.foco : null;
      renderGatilho(); renderMarcha(); renderMinutos(); renderLeitura(); renderProxima(); renderConquistas();
      // PECA 3: borda so com a ROTINA escolhida E as voltas ligadas (lidas do disco); "?" ou desligada = sem borda
      doc.documentElement.dataset.rotina = s.dados && bordaLigada(salva() ? { n: salva() } : null, s.dados.viva) ? 'on' : 'off';
      avisoDesfazer.textContent = w().desfazer;
      if (ativo && gaveta.open) focar(ativo);
      s.novaFase = null; s.marchaNova = false;
      s.assinatura = JSON.stringify([lang(), s.dados, s.falhou, s.ocupado, s.pendente && s.pendente.n]);
    }

    // ---------- aviso com desfazer ----------
    function avisar(texto, desfazer, fixo) {
      clearTimeout(s.avisoTimer);
      const mesmo = !aviso.hidden && avisoTexto.textContent && fixo;
      avisoTexto.textContent = texto;
      s.desfazer = desfazer || null;
      avisoDesfazer.hidden = !desfazer;
      aviso.hidden = false;
      if (!reduzido() && !mesmo) piscar(aviso, 'is-entrando', 400);
      if (!fixo) s.avisoTimer = setTimeout(() => { aviso.hidden = true; s.desfazer = null; avisoDesfazer.hidden = true; }, AVISO_MS);
    }
    function fecharAviso() { clearTimeout(s.avisoTimer); aviso.hidden = true; s.desfazer = null; avisoDesfazer.hidden = true; }
    avisoDesfazer.addEventListener('click', () => {
      const d = s.desfazer; s.desfazer = null; avisoDesfazer.hidden = true;
      if (d && d.marcha) { cancelarMarcha(); return; }
      if (d) desfazer(d);
    });

    // ---------- marcha: 4 s com Desfazer, depois grava ----------
    function cancelarMarcha() {
      if (!s.pendente) return;
      clearTimeout(s.pendente.timer); s.pendente = null;
      renderTudo(); avisar(w().marchaDesfeita); focar('marcha-' + (salva() || 1));
    }
    function escolherMarcha(n) {
      if (!s.dados || s.ocupado === 'marcha' || !(marchaValida(n) || (n === ROTINA && estado().rotina))) return;
      if (s.pendente) { clearTimeout(s.pendente.timer); s.pendente = null; }
      if (n === salva()) { renderTudo(); fecharAviso(); return; } // tocar na que ja vale: nada sai
      s.pendente = { n, restam: ESPERA_MARCHA_S, timer: null };
      s.marchaNova = true;
      renderTudo();
      const passo = () => {
        if (!s.pendente || s.pendente.n !== n || !s.vivo) return;
        if (s.pendente.restam <= 0) { s.pendente = null; enviarMarcha(n); return; }
        const W = w();
        avisar(estado().avisa ? W.saiEm(s.pendente.restam) : W.guardaEm(s.pendente.restam), { marcha: n }, true);
        s.pendente.restam -= 1;
        s.pendente.timer = setTimeout(passo, 1000);
      };
      passo();
    }
    async function enviarMarcha(n) {
      s.ocupado = 'marcha'; renderTudo();
      try {
        const j = await enviar('marcha', { marcha: n });
        s.dados = normalizar(j); s.ocupado = false; renderTudo();
        const W = w(), nome = rotuloMarcha(n);
        avisar(j.recado && j.recado.hora ? W.avisou(nome, j.recado.hora) : W.guardou(nome));
      } catch (e) {
        s.ocupado = false; renderTudo(); avisar(msgErro(e.codigo));
        if (e.codigo === 'previa_so_leitura' || e.codigo === 'gravar') carregar();
      }
    }

    // ---------- rede ----------
    async function carregar() {
      if (!s.vivo) return;
      if (s.carregando) return s.carregando;
      s.carregando = (async () => {
        try {
          const r = await fetch(api, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
          const j = await r.json();
          if (!r.ok || !j || !j.ok) throw Error('leitura');
          s.dados = normalizar(j); s.falhou = false;
        } catch { s.falhou = true; }
        finally { s.carregando = null; }
      })();
      await s.carregando;
      renderTudo();
    }
    async function enviar(rota, pedido) {
      if (!s.dados || !s.dados.token) await carregar();
      const r = await fetch(api + '/' + rota, {
        method: 'POST', cache: 'no-store', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Acelerador-Token': (s.dados && s.dados.token) || '' },
        body: JSON.stringify(pedido)
      });
      let j = null;
      try { j = await r.json(); } catch { j = null; }
      if (!r.ok || !j || !j.ok) { const e = Error('gravar'); e.codigo = (j && (j.erro || j.error)) || 'gravar'; throw e; }
      return j;
    }
    function msgErro(codigo) {
      const W = w();
      if (codigo === 'previa_so_leitura') return W.soLeitura;
      if (codigo === 'fora-de-ordem') return W.foraDeOrdem;
      if (codigo === 'ocupado') return W.ocupado;
      if (codigo === 'sem-fase') return W.semFaseSomar;
      return W.erro;
    }
    async function ligar(id) {
      if (s.ocupado) return;
      s.ocupado = 'ligar'; renderProxima(); focar('ligar');
      try {
        const j = await enviar('ligar', { fase: id });
        s.dados = normalizar(j); s.ocupado = false;
        s.novaFase = id;
        renderTudo();
        if (!reduzido()) piscar(gatilho, 'is-apertando', 180);
        const W = w();
        avisar(W.ligou(f(id).nome) + ' ' + W.conquistasDe(visiveis(estado()).ligadas.length, TOTAL) + '.', { fase: id });
        if (!focar('ligar')) focar('conq-' + id);
      } catch (e) {
        s.ocupado = false; renderTudo(); avisar(msgErro(e.codigo)); focar('ligar');
        if (e.codigo === 'fora-de-ordem' || e.codigo === 'ja-ligada') carregar();
      }
    }
    async function somarMinutos(m) {
      if (s.ocupado) return;
      s.ocupado = 'somar'; renderMinutos();
      try {
        const j = await enviar('minutos', { minutos: m });
        s.dados = normalizar(j); s.ocupado = false; renderTudo();
        avisar(w().somou(m), j.marca ? { marca: j.marca } : null);
        focar('somar-' + m);
      } catch (e) { s.ocupado = false; renderTudo(); avisar(msgErro(e.codigo)); focar('somar-' + m); }
    }
    async function desfazer(d) {
      if (s.ocupado) return;
      s.ocupado = 'desfazer';
      try {
        const j = await enviar('desfazer', d);
        s.dados = normalizar(j); s.ocupado = false; renderTudo();
        avisar(w().desfeito);
        if (!focar('ligar')) focar('fechar');
      } catch (e) { s.ocupado = false; renderTudo(); avisar(msgErro(e.codigo)); }
    }

    // ---------- abrir e fechar (Esc fecha; o foco volta ao botao) ----------
    function abrir() {
      if (gaveta.open || !s.vivo) return;
      // o WEN (tabela nova e o antigo) fecha antes: a gaveta nunca abre por cima dele
      const wenTabela = doc.getElementById('f2-wen'); if (wenTabela) wenTabela.hidden = true;
      for (const w of doc.querySelectorAll('.wen-panel')) w.hidden = true;
      s.voltar = doc.activeElement;
      renderTudo();
      try { gaveta.showModal(); } catch { gaveta.setAttribute('open', ''); }
      gatilho.setAttribute('aria-expanded', 'true');
      if (!reduzido()) piscar(gaveta, 'is-abrindo', 400);
      if (!focar('marcha-' + (efetiva() || 0))) fechar.focus();
      carregar();
    }
    function fecharGaveta() { if (gaveta.open) { if (typeof gaveta.close === 'function') gaveta.close(); else { gaveta.removeAttribute('open'); aoFechar(); } } }
    // fechar no meio dos 4 s nao cancela: a marcha escolhida sai no fim da conta (o botao ja mostra a nova)
    function aoFechar() {
      gatilho.setAttribute('aria-expanded', 'false');
      if (!s.pendente) fecharAviso();
      const volta = s.voltar && s.voltar.isConnected && s.voltar !== doc.body ? s.voltar : gatilho;
      try { volta.focus({ preventScroll: true }); } catch { /* sem foco para devolver */ }
    }
    gaveta.addEventListener('close', aoFechar);
    gaveta.addEventListener('click', ev => { if (ev.target === gaveta) fecharGaveta(); });
    fechar.addEventListener('click', fecharGaveta);
    gatilho.addEventListener('click', () => { if (!reduzido()) piscar(gatilho, 'is-apertando', 180); if (gaveta.open) fecharGaveta(); else abrir(); });
    const aoTeclar = ev => { if (ev.key === 'Escape' && gaveta.open) { ev.preventDefault(); fecharGaveta(); } };
    doc.addEventListener('keydown', aoTeclar);

    // ---------- lingua e lugar ----------
    const seletorLingua = doc.getElementById('language');
    const aoTrocarLingua = () => renderTudo();
    if (seletorLingua) seletorLingua.addEventListener('change', aoTrocarLingua);
    const celular = root.matchMedia ? root.matchMedia('(max-width: 600px)') : null;
    function lugar() {
      if (!s.vivo) return;
      const wen = !host.hasAttribute('data-acel-fixo') && celular && celular.matches ? doc.querySelector('.wen-controls') : null;
      if (wen) {
        if (controles.parentNode !== wen) wen.insertBefore(controles, wen.querySelector('.wen-last'));
        controles.classList.add('no-wen');
      } else {
        if (controles.parentNode !== host) host.append(controles);
        controles.classList.remove('no-wen');
      }
    }
    const aoMudarTela = () => lugar();
    if (celular) { if (celular.addEventListener) celular.addEventListener('change', aoMudarTela); else if (celular.addListener) celular.addListener(aoMudarTela); }
    root.addEventListener('load', aoMudarTela, { once: true });
    lugar();
    if (/(?:^#|&)acelerar\b/.test(root.location ? root.location.hash || '' : '')) s.abrirDepois = true;

    const instancia = {
      host,
      abrir, fechar: fecharGaveta, recarregar: carregar, escolherMarcha, lugar,
      atualizar(dadosSnapshot, langPedida) {
        if (langPedida) s.langPedida = langPedida;
        if (dadosSnapshot && typeof dadosSnapshot === 'object' && dadosSnapshot.fases) {
          const token = s.dados && s.dados.token;
          s.dados = normalizar(dadosSnapshot);
          if (!s.dados.token && token) s.dados.token = token;
        }
        if (!controles.isConnected) lugar();
        if (JSON.stringify([lang(), s.dados, s.falhou, s.ocupado, s.pendente && s.pendente.n]) !== s.assinatura) renderTudo();
      },
      destroy() {
        s.vivo = false;
        clearTimeout(s.avisoTimer);
        if (s.pendente) { clearTimeout(s.pendente.timer); s.pendente = null; }
        if (seletorLingua) seletorLingua.removeEventListener('change', aoTrocarLingua);
        if (celular) { if (celular.removeEventListener) celular.removeEventListener('change', aoMudarTela); else if (celular.removeListener) celular.removeListener(aoMudarTela); }
        root.removeEventListener('load', aoMudarTela);
        doc.removeEventListener('keydown', aoTeclar);
        if (s.relogio) { clearInterval(s.relogio); s.relogio = null; }
        if (gaveta.open) { try { gaveta.close(); } catch { /* ja fechada */ } }
        gaveta.remove(); controles.remove(); borda.remove();
        delete doc.documentElement.dataset.rotina;
        delete host.__acel;
      }
    };
    host.__acel = instancia;
    renderTudo();
    carregar().then(() => { if (s.abrirDepois) { s.abrirDepois = false; abrir(); } });
    // a marcha viva muda sozinha (uma volta a cada 15 min): rele a cada 60 s, so com a aba a vista
    s.relogio = setInterval(() => { if (s.vivo && !doc.hidden) carregar(); }, 60000);
    return instancia;
  }

  // ---------- gancho do integrador ----------
  let instancia = null, renderizou = false;
  function lugarPadrao() { return doc.getElementById('gancho-acelerador') || doc.querySelector('[data-gancho="acelerador"]'); }
  const gancho = {
    render(snapshot, ctx) {
      renderizou = true;
      if (ctx && ctx.nodeType === 1) ctx = { el: ctx };
      ctx = ctx || {};
      const host = ctx.host || ctx.el || ctx.root || ctx.mount || ctx.container || lugarPadrao();
      if (!host || host.nodeType !== 1) return null;
      if (instancia && instancia.host !== host) { instancia.destroy(); instancia = null; }
      if (!instancia) instancia = montar(host, { api: ctx.api, lang: ctx.lang });
      if (instancia) instancia.atualizar(snapshot && snapshot.acelerador, ctx.lang);
      return instancia;
    },
    destroy() { if (instancia) instancia.destroy(); instancia = null; }
  };
  root.PainelAcelerador = { montar, gancho, regras: exportado, get instancia() { return instancia; } };
  function auto() {
    const sozinho = () => { const h = lugarPadrao(); if (h && !h.hasAttribute('data-acel-manual')) gancho.render(null, { el: h }); };
    const registro = root.PainelGanchos;
    if (registro && typeof registro.register === 'function') {
      try { registro.register('acelerador', gancho); } catch { sozinho(); return; }
      // o integrador ainda nao chamou render em 1,5 s: o botao aparece sozinho no gancho
      setTimeout(() => { if (!renderizou && !instancia) sozinho(); }, 1500);
      return;
    }
    sozinho();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', auto, { once: true }); else auto();
})(typeof window === 'undefined' ? globalThis : window);
