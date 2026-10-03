
(function (root) {
  'use strict';
  const TOTAL = 11;
  const MARCHAS = [1, 2, 3, 4, 5];
  const CREDITO_DA_MARCHA = { 1: 'poupa', 2: 'poupa', 3: 'normal', 4: 'gasta', 5: 'gasta' };
  const ESPERA_MARCHA_S = 4;
  const METAS = [15, 30, 60, 120, 240, 480, 960];
  const SOMAS = [5, 15, 30];
  const AVISO_MS = 6000;
  const MESES = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  };
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


  const TEXTOS = {
    pt: {
      ui: {
        botao: 'ACELERAR',
        dica: 'Marcha do trabalho e fases para os seus agentes esperarem menos',
        titulo: 'Acelerar',
        escolhaMarcha: 'Escolha a sua marcha',
        marchaNome: (n, nome) => 'Marcha ' + n + ' · ' + nome,
        escolhidaEm: d => 'Escolhida em ' + d,
        escolhidaAs: (d, h) => 'Escolhida em ' + d + ' às ' + h + ' UTC',
        toqueParaEscolher: 'Toque numa marcha para escolher.',
        marchasRotulo: 'Marcha do trabalho',
        creditoRotulo: 'Crédito',
        credito: { poupa: 'poupa', normal: 'normal', gasta: 'gasta mais' },
        nuncaCorta: 'Nunca corta',
        nuncaCortaMarcha: 'revisão de dinheiro, segredo, quem faz não aprova, a sua aprovação para publicar.',
        saiEm: s => 'Vai para os agentes em ' + s + ' s. Ainda dá para desfazer.',
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
        semFaseSomar: 'Ligue uma fase antes de somar minutos.'
      },
      publico: {
        lista: 'Cada fase tem um texto para a sua IA aplicar. Marcar aqui só registra neste painel.',
        semFase: 'Marque a primeira fase para começar a somar.',
        ligar: 'Marcar como feito',
        ligando: 'Marcando...',
        ligada: 'Feita',
        ligadaEm: d => 'Feita em ' + d,
        ligou: nome => nome + ': marcada neste painel.',
        foraDeOrdem: 'Marque a fase anterior primeiro.',
        semFaseSomar: 'Marque uma fase antes de somar minutos.'
      },
      marchas: {
        1: { nome: 'Econômica', linha: 'Faça uma tarefa grande por vez. Chame um ajudante só quando precisar.' },
        2: { nome: 'Calma', linha: 'Até 2 tarefas grandes ao mesmo tempo.' },
        3: { nome: 'Normal', linha: 'Até 3 tarefas grandes ao mesmo tempo.' },
        4: { nome: 'Rápida', linha: 'Até 4 tarefas grandes ao mesmo tempo, com as revisões em paralelo.' },
        5: { nome: 'Máxima', linha: 'Rode em paralelo as tarefas que não mexem nos mesmos arquivos. Divida revisões grandes em partes, deixe a minha pergunta de aprovação pronta cedo e, se eu usar mais de uma IA, divida o trabalho com a outra também.' }
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
        escolhidaAs: (d, h) => 'Picked on ' + d + ' at ' + h + ' UTC',
        toqueParaEscolher: 'Tap a gear to pick it.',
        marchasRotulo: 'Work gear',
        creditoRotulo: 'Credit',
        credito: { poupa: 'saves', normal: 'normal', gasta: 'spends more' },
        nuncaCorta: 'Always kept',
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
        semFaseSomar: 'Turn on a step before adding minutes.'
      },
      publico: {
        lista: 'Each step has a text your AI can apply. Marking it here only records it on this panel.',
        semFase: 'Mark the first step to start adding.',
        ligar: 'Mark as done',
        ligando: 'Marking...',
        ligada: 'Done',
        ligadaEm: d => 'Done on ' + d,
        ligou: nome => nome + ': marked on this panel.',
        foraDeOrdem: 'Mark the previous step first.',
        semFaseSomar: 'Mark a step before adding minutes.'
      },
      marchas: {
        1: { nome: 'Economy', linha: 'Do one big task at a time. Call a helper only when you need one.' },
        2: { nome: 'Calm', linha: 'Up to 2 big tasks at the same time.' },
        3: { nome: 'Normal', linha: 'Up to 3 big tasks at the same time.' },
        4: { nome: 'Fast', linha: 'Up to 4 big tasks at the same time, with reviews running in parallel.' },
        5: { nome: 'Max', linha: 'Run in parallel any tasks that do not touch the same files. Split big reviews into parts, have my approval question ready early, and if I use more than one AI, share the work with the other one too.' }
      },
      fases: {
        1: { nome: 'Short status', pergunta: 'Do you read a wall of text to know where things stand? Want the state in 6 short lines, always with a time?', ganho: 'You decide in seconds.', nuncaCorta: 'The forecast always comes with a time.' },
        2: { nome: 'Automatic', pergunta: 'Do you keep asking how it is going? Want the status to refresh on its own every 5 min?', ganho: 'No asking just to know the state.', nuncaCorta: 'It updates the same way a click would. Nothing hidden.' },
        3: { nome: 'Pre-approve', pergunta: 'Does your agent wait for your click to publish? Want it to publish on its own once everything passes?', ganho: 'Finished work does not sit waiting for you.', nuncaCorta: 'Tests, reviews and your release stay.' },
        4: { nome: 'Plan B', pergunta: 'Does one stuck item hold the whole delivery? Want to pull just that one and publish the rest?', ganho: 'One stuck item does not hold the others.', nuncaCorta: 'The pulled item only comes back fixed.' },
        5: { nome: 'Work window', pergunta: 'Does your other agent wait for your permission on every request? Want to open a work window with an end time?', ganho: 'No wait on every request.', nuncaCorta: 'Publishing, keys and money stay with you.' },
        6: { nome: 'Fresh reviewer', pergunta: 'Does approval wait on someone outside? Want a fresh reviewer, who did not do the work, to approve?', ganho: 'Approval does not wait on anyone outside.', nuncaCorta: 'Whoever builds never approves their own work.' },
        7: { nome: 'Review what matters', pergunta: 'Does every text go through review before it ships? Want to review first only what everyone sees?', ganho: 'Less waiting on every preview.', nuncaCorta: 'Anything touching money is always reviewed first.' },
        8: { nome: 'Approved base', pergunta: 'Does each job start from a different version? Want everything built on top of the last approved version?', ganho: 'Fewer merges to redo.', nuncaCorta: 'The release is checked against what is live.' },
        9: { nome: 'Free machine', pergunta: 'Does your computer freeze with everything running? Want to see what is heavy and send heavy tests to another machine?', ganho: 'Screenshots and tests without freezing.', nuncaCorta: 'Only the owner closes a program.' },
        10: { nome: 'Pick up stalled', pergunta: 'Is work stalled waiting on a busy agent? Want whoever is free to pick it up?', ganho: 'Stalled work moves again.', nuncaCorta: 'Nobody touches the other one\'s folder.' },
        11: { nome: 'Full force', pergunta: 'Do your agents work one at a time? Want several workstreams at once where nobody fights over the same thing?', ganho: 'Several workstreams moving together.', nuncaCorta: 'One release at a time.' }
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
        escolhidaAs: (d, h) => 'Elegida el ' + d + ' a las ' + h + ' UTC',
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
        semFaseSomar: 'Activa una fase antes de sumar minutos.'
      },
      publico: {
        lista: 'Cada fase tiene un texto para que tu IA lo aplique. Marcar aquí solo lo registra en este panel.',
        semFase: 'Marca la primera fase para empezar a sumar.',
        ligar: 'Marcar como hecho',
        ligando: 'Marcando...',
        ligada: 'Hecha',
        ligadaEm: d => 'Hecha el ' + d,
        ligou: nome => nome + ': marcada en este panel.',
        foraDeOrdem: 'Marca primero la fase anterior.',
        semFaseSomar: 'Marca una fase antes de sumar minutos.'
      },
      marchas: {
        1: { nome: 'Económica', linha: 'Haz una tarea grande a la vez. Llama a un ayudante solo cuando haga falta.' },
        2: { nome: 'Tranquila', linha: 'Hasta 2 tareas grandes al mismo tiempo.' },
        3: { nome: 'Normal', linha: 'Hasta 3 tareas grandes al mismo tiempo.' },
        4: { nome: 'Rápida', linha: 'Hasta 4 tareas grandes al mismo tiempo, con las revisiones en paralelo.' },
        5: { nome: 'Máxima', linha: 'Ejecuta en paralelo las tareas que no tocan los mismos archivos. Divide las revisiones grandes en partes, deja lista desde el principio mi pregunta de aprobación y, si uso más de una IA, reparte el trabajo con la otra también.' }
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
        9: { nome: 'Máquina libre', pergunta: '¿Tu ordenador se traba con todo corriendo? ¿Quieres ver qué pesa y mandar las pruebas pesadas a otra máquina?', ganho: 'Capturas y pruebas sin trabarse.', nuncaCorta: 'Solo el dueño cierra un programa.' },
        10: { nome: 'Tomar lo parado', pergunta: '¿Hay trabajo parado esperando a un agente ocupado? ¿Quieres que lo tome quien está libre?', ganho: 'Lo parado vuelve a andar.', nuncaCorta: 'Nadie toca la carpeta del otro.' },
        11: { nome: 'Fuerza total', pergunta: '¿Tus agentes trabajan de a uno? ¿Quieres varios frentes juntos donde nadie se pisa?', ganho: 'Varios frentes avanzando juntos.', nuncaCorta: 'Una publicación a la vez.' }
      }
    }
  };


  function ligadasEmOrdem(fases) { let k = 0; while (k < TOTAL && fases && fases[String(k + 1)]) k++; return k; }
  function visiveis(estado) {
    const k = ligadasEmOrdem(estado && estado.fases);
    return { ligadas: Array.from({ length: k }, (_, i) => i + 1), proxima: k < TOTAL ? k + 1 : null, escondidas: Math.max(0, TOTAL - k - 1) };
  }
  function marchaValida(n) { return Number.isInteger(n) && MARCHAS.includes(n); }
  function creditoDe(n, lang) { return marchaValida(n) ? TEXTOS[lingua(lang)].ui.credito[CREDITO_DA_MARCHA[n]] : ''; }

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
    const mes = m ? MESES[lingua(lang)][Number(m[2]) - 1] : null;
    if (!mes) return '';
    return lingua(lang) === 'en' ? mes + ' ' + Number(m[3]) : Number(m[3]) + ' de ' + mes;
  }
  function horaDe(iso) { const m = /T(\d{2}):(\d{2})/.exec(String(iso || '')); return m ? m[1] + ':' + m[2] : ''; }
  function numero(n, lang) { try { return new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR').format(n); } catch { return String(n); } }

  const COPY_TEXT = {
    "en": {
      "label": "Copy for my AI",
      "question2": "Do you keep asking how things stand? Want the status on its own at the end of each step?",
      "rule": "Save it as a rule for the project of this chat (ask me which project if it is not clear). If a rule on the same topic is already there, replace it. Change nothing else and show me the change before saving.",
      "gear": "Work in gear <n>, <nome>: <linha> Always keep: money review, secrets, whoever builds never approves, my approval to publish.",
      "phases": {
        "1": {
          "text": "When I ask how things stand, answer in 6 short lines: completed task, recent activity, blocked by, can we speed up, my next step, credit. Every forecast comes with a time.",
          "writesFile": true
        },
        "2": {
          "text": "When you finish a step or stop to wait for me, end your message with the status in those 6 lines, without me asking.",
          "writesFile": true
        },
        "3": {
          "text": "List the kinds of change you could publish on your own once every test and review passes, and wait for my ok on that list. After my ok, publish only those kinds without waiting for my click. Money, keys and anything outside the list still wait for me.",
          "writesFile": true
        },
        "4": {
          "text": "When one item blocks a delivery, take only that item out, ship the rest with the approvals it already needs and tell me which item came out and why. It comes back only fixed and reviewed.",
          "writesFile": true
        },
        "5": {
          "text": "Propose a work window for this project: what you may do without asking me, and the time it ends. Publishing, keys and money stay with me. Wait for my ok before using it.",
          "writesFile": false
        },
        "6": {
          "text": "Before any change is approved, have it reviewed by a new session or helper that did not do the work. Whoever built it never approves it.",
          "writesFile": true
        },
        "7": {
          "text": "Review before shipping only what everyone sees and anything touching money. Review the rest right after it ships.",
          "writesFile": true
        },
        "8": {
          "text": "Start every new piece of work from the last approved version, never from another unfinished one. Before a release, compare it with what is live.",
          "writesFile": true
        },
        "9": {
          "text": "List what is using the most memory and processor on this computer right now, and which of my heavy tests could run on another machine. Close nothing: only the owner closes a program.",
          "writesFile": false
        },
        "10": {
          "text": "List the work that is waiting on a busy session and say which free session could take each item. Nobody touches another session's folder. Wait for my ok.",
          "writesFile": false
        },
        "11": {
          "text": "Split my open work into streams that never touch the same files and run them in parallel. One release at a time. Show me the split and wait for my ok.",
          "writesFile": false
        }
      }
    },
    "pt": {
      "label": "Copiar para a minha IA",
      "question2": "Você pergunta toda hora como está? Quer o status sozinho no fim de cada etapa?",
      "rule": "Guarde isso como regra do projeto desta conversa (me pergunte qual, se não estiver claro). Se já houver uma regra sobre o mesmo assunto, troque-a. Não mude mais nada e me mostre a mudança antes de salvar.",
      "gear": "Trabalhe na marcha <n>, <nome>: <linha> Nunca corte: revisão de dinheiro, segredo, quem faz não aprova, a minha aprovação para publicar.",
      "phases": {
        "1": {
          "text": "Quando eu perguntar como está, responda em 6 linhas curtas: tarefa concluída, atividade recente, travado por, dá para acelerar, meu próximo passo, crédito. Toda previsão vem com hora.",
          "writesFile": true
        },
        "2": {
          "text": "Quando terminar uma etapa ou parar para me esperar, feche a mensagem com o status nessas 6 linhas, sem eu pedir.",
          "writesFile": true
        },
        "3": {
          "text": "Liste os tipos de mudança que você poderia publicar sozinho quando todo teste e revisão passarem, e espere o meu ok nessa lista. Depois do ok, publique só esses tipos sem esperar o meu clique. Dinheiro, chaves e o que estiver fora da lista continuam esperando por mim.",
          "writesFile": true
        },
        "4": {
          "text": "Quando um item travar uma entrega, tire só ele, publique o resto com as aprovações de sempre e me diga qual saiu e por quê. Ele só volta consertado e revisado.",
          "writesFile": true
        },
        "5": {
          "text": "Proponha uma janela de trabalho para este projeto: o que você pode fazer sem me perguntar e a hora em que ela acaba. Publicar, chaves e dinheiro seguem comigo. Espere o meu ok antes de usar.",
          "writesFile": false
        },
        "6": {
          "text": "Antes de aprovar qualquer mudança, peça a revisão a uma sessão ou ajudante novo, que não fez o trabalho. Quem fez nunca aprova.",
          "writesFile": true
        },
        "7": {
          "text": "Revise antes de publicar só o que todo mundo vê e o que mexe com dinheiro. O resto, revise logo depois de publicar.",
          "writesFile": true
        },
        "8": {
          "text": "Comece todo trabalho novo da última versão aprovada, nunca de outro trabalho pela metade. Antes de publicar, compare com o que está no ar.",
          "writesFile": true
        },
        "9": {
          "text": "Liste o que mais usa memória e processador neste computador agora e quais testes pesados meus poderiam rodar em outra máquina. Não feche nada: só o dono fecha um programa.",
          "writesFile": false
        },
        "10": {
          "text": "Liste o trabalho que espera uma sessão ocupada e diga qual sessão livre poderia pegar cada item. Ninguém mexe na pasta da outra. Espere o meu ok.",
          "writesFile": false
        },
        "11": {
          "text": "Divida o meu trabalho aberto em frentes que nunca mexem nos mesmos arquivos e rode em paralelo. Uma publicação por vez. Me mostre a divisão e espere o meu ok.",
          "writesFile": false
        }
      }
    },
    "es": {
      "label": "Copiar para mi IA",
      "question2": "¿Preguntas a cada rato cómo va? ¿Quieres el estado solo al final de cada paso?",
      "rule": "Guárdalo como regla del proyecto de esta conversación (pregúntame cuál si no está claro). Si ya hay una regla sobre el mismo tema, reemplázala. No cambies nada más y muéstrame el cambio antes de guardar.",
      "gear": "Trabaja en la marcha <n>, <nome>: <linha> Nunca recortes: revisión de dinero, secretos, quien hace no aprueba, mi aprobación para publicar.",
      "phases": {
        "1": {
          "text": "Cuando pregunte cómo va, responde en 6 líneas cortas: tarea terminada, actividad reciente, bloqueado por, podemos acelerar, mi siguiente paso, crédito. Toda previsión viene con hora.",
          "writesFile": true
        },
        "2": {
          "text": "Cuando termines un paso o te detengas a esperarme, cierra el mensaje con el estado en esas 6 líneas, sin que lo pida.",
          "writesFile": true
        },
        "3": {
          "text": "Enumera los tipos de cambio que podrías publicar solo cuando pasen todas las pruebas y revisiones, y espera mi visto bueno sobre esa lista. Después, publica solo esos tipos sin esperar mi clic. Dinero, claves y lo que quede fuera de la lista siguen esperándome.",
          "writesFile": true
        },
        "4": {
          "text": "Cuando un elemento frene una entrega, saca solo ese, publica el resto con las aprobaciones de siempre y dime cuál salió y por qué. Solo vuelve arreglado y revisado.",
          "writesFile": true
        },
        "5": {
          "text": "Propón una ventana de trabajo para este proyecto: qué puedes hacer sin preguntarme y la hora en que termina. Publicar, claves y dinero siguen conmigo. Espera mi visto bueno antes de usarla.",
          "writesFile": false
        },
        "6": {
          "text": "Antes de aprobar cualquier cambio, pide la revisión a una sesión o ayudante nuevo, que no hizo el trabajo. Quien lo hizo nunca lo aprueba.",
          "writesFile": true
        },
        "7": {
          "text": "Revisa antes de publicar solo lo que todos ven y lo que toca dinero. Lo demás, revísalo justo después de publicar.",
          "writesFile": true
        },
        "8": {
          "text": "Empieza todo trabajo nuevo desde la última versión aprobada, nunca desde otro a medias. Antes de publicar, compáralo con lo que está publicado.",
          "writesFile": true
        },
        "9": {
          "text": "Enumera lo que más memoria y procesador usa en este ordenador ahora y cuáles de mis pruebas pesadas podrían correr en otra máquina. No cierres nada: solo el dueño cierra un programa.",
          "writesFile": false
        },
        "10": {
          "text": "Enumera el trabajo que espera a una sesión ocupada y di qué sesión libre podría tomar cada elemento. Nadie toca la carpeta de la otra. Espera mi visto bueno.",
          "writesFile": false
        },
        "11": {
          "text": "Divide mi trabajo abierto en frentes que nunca tocan los mismos archivos y córrelos en paralelo. Una publicación a la vez. Muéstrame la división y espera mi visto bueno.",
          "writesFile": false
        }
      }
    }
  };
  function phaseWritesFile(id) { return !!COPY_TEXT.en.phases[id]?.writesFile; }
  function phaseText(id, lang) {
    const t = COPY_TEXT[lingua(lang)], phase = t.phases[id];
    return phase ? phase.text + (phase.writesFile ? ' ' + t.rule : '') : '';
  }
  function gearText(n, lang, line) {
    if (!marchaValida(n)) return '';
    const L = lingua(lang), t = COPY_TEXT[L], gear = TEXTOS[L].marchas[n];
    return t.gear.replace('<n>', String(n)).replace('<nome>', gear.nome).replace('<linha>', line === undefined ? gear.linha : String(line)) + ' ' + t.rule;
  }

  const exportado = { COPY_TEXT, phaseWritesFile, phaseText, gearText, TOTAL, MARCHAS, CREDITO_DA_MARCHA, ESPERA_MARCHA_S, METAS, SOMAS, FASES, TEXTOS, ICONES, ligadasEmOrdem, visiveis, marchaValida, creditoDe, minutosDe, metaDe, passoBarra, lingua, diaDe, horaDe, numero };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportado;
  if (!root.document || root.PainelAcelerador) return;

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
  function botao(cls, txt, foco) { const b = el('button', cls, txt); b.type = 'button'; if (foco) b.dataset.foco = foco; return b; }
  function par(rotulo, texto) { const d = el('div', 'acel-par'); d.append(el('dt', null, rotulo), el('dd', null, texto)); return d; }
  function reduzido() {
    try { return doc.documentElement.dataset.motion === 'off' || !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
  }
  function linguaDaTela(pedida) { const sel = doc.getElementById('language'); return lingua(pedida || (sel && sel.value) || doc.documentElement.lang || 'pt'); }
  function textoEm(obj, lang) { return obj && typeof obj === 'object' ? String(obj[lang] || obj.pt || '') : ''; }
  function normalizar(j) {
    j = j && typeof j === 'object' ? j : {};
    const m = j.marcha && typeof j.marcha === 'object' && marchaValida(j.marcha.n) ? j.marcha : null;
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
      nuncaCorta: j.nuncaCorta && typeof j.nuncaCorta === 'object' ? j.nuncaCorta : null
    };
  }

  function montar(host, opcoes) {
    opcoes = opcoes || {};
    if (!host) return null;
    if (host.__acel) return host.__acel;
    const api = String(opcoes.api || host.getAttribute('data-api') || '/api/acelerador').replace(/\/+$/, '');
    const s = { dados: null, falhou: false, carregando: null, langPedida: opcoes.lang || null, ocupado: false, vivo: true, abertas: new Set(), origemAberta: false, novaFase: null, marchaNova: false, avisoTimer: null, desfazer: null, pendente: null, abrirDepois: false, voltar: null, assinatura: '' };
    const lang = () => linguaDaTela(s.langPedida);
    const w = () => { const t = TEXTOS[lang()]; return estado().modo === 'publico' ? Object.assign({}, t.ui, t.publico) : t.ui; };
    const f = id => estado().modo === 'publico' && id === 2 ? Object.assign({}, TEXTOS[lang()].fases[id], { pergunta: COPY_TEXT[lang()].question2 }) : TEXTOS[lang()].fases[id];
    const estado = () => s.dados || normalizar(null);
    const salva = () => (s.dados && s.dados.marcha ? s.dados.marcha.n : null);
    const efetiva = () => (s.pendente ? s.pendente.n : salva());
    const nomeMarcha = n => TEXTOS[lang()].marchas[n].nome;
    const linhaMarcha = n => textoEm(estado().marchasTexto[String(n)], lang()) || TEXTOS[lang()].marchas[n].linha;
    const gruposCopia = new Map();
    function copia(chave, texto, writesFile) {
      if (estado().modo !== 'publico') return null;
      const L = lang(), anterior = gruposCopia.get(chave);
      if (anterior && anterior.lang === L) { anterior.group.refresh(); return anterior.group; }
      const group = root.PanelCopySession.create({
        lang: L, label: COPY_TEXT[L].label, text: () => texto(L), writesFile,
        target: anterior ? anterior.group.getTarget() : 'claude', className: 'acel-copy'
      });
      group.dataset.acelCopy = chave;
      group.button.dataset.foco = 'copy-' + chave;
      group.switcher.dataset.foco = 'target-' + chave;
      gruposCopia.set(chave, { lang: L, group });
      return group;
    }

    const controles = el('div', 'acel-controls');
    controles.setAttribute('data-acelerador', '');
    const gatilho = botao('acel-trigger');
    gatilho.id = 'acel-trigger';
    gatilho.setAttribute('aria-haspopup', 'dialog');
    gatilho.setAttribute('aria-controls', 'acel-gaveta');
    gatilho.setAttribute('aria-expanded', 'false');
    const gNome = el('span', 'acel-trigger-nome');
    const gNiveis = el('span', 'acel-niveis');
    gNiveis.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < MARCHAS.length; i++) gNiveis.append(el('i'));
    gatilho.append(gNome, gNiveis);
    controles.append(gatilho);
    host.replaceChildren(controles);

    const gaveta = el('dialog', 'acel-gaveta');
    gaveta.id = 'acel-gaveta';
    gaveta.setAttribute('aria-labelledby', 'acel-titulo');
    const corpo = el('div', 'acel-corpo');
    const topo = el('div', 'acel-topo');
    const sobre = el('span', 'acel-sobre');
    const fechar = botao('acel-fechar', null, 'fechar');
    fechar.append(icone('fechar'));
    topo.append(sobre, fechar);

    const secMarcha = el('section', 'acel-marcha');
    const titulo = el('h2', 'acel-titulo');
    titulo.id = 'acel-titulo';
    const sub = el('p', 'acel-sub');
    const notaLista = el('p', 'acel-lista-nota');
    const seletor = el('div', 'acel-seletor');
    seletor.setAttribute('role', 'group');
    const botoesMarcha = new Map();
    for (const n of MARCHAS) {
      const b = botao('acel-opcao', null, 'marcha-' + n);

      b.dataset.acelMarcha = String(n);
      const num = el('span', 'acel-opcao-n', String(n));
      num.setAttribute('aria-hidden', 'true');
      const meio = el('span', 'acel-opcao-corpo');
      const nome = el('span', 'acel-opcao-nome'), linha = el('span', 'acel-opcao-linha');
      meio.append(nome, linha);
      const cred = el('span', 'acel-opcao-credito');
      b.append(num, meio, cred);
      b.addEventListener('click', () => escolherMarcha(n));
      const item = el('div', 'acel-marcha-item'), copySlot = el('div');
      item.append(b, copySlot);
      seletor.append(item);
      botoesMarcha.set(n, { b, nome, linha, cred, copySlot });
    }
    const nunca = el('p', 'acel-nunca');
    secMarcha.append(titulo, sub, notaLista, seletor, nunca);

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

    function piscar(node, cls, ms) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(() => node.classList.remove(cls), ms); }
    function focar(chave) {
      if (!chave) return false;
      const alvo = Array.from(gaveta.querySelectorAll('[data-foco]')).find(n => n.dataset.foco === chave && !n.disabled && !n.hidden);
      if (!alvo) return false;
      try { alvo.focus({ preventScroll: false }); } catch { return false; }
      return true;
    }

    function renderGatilho() {
      const W = w(), g = s.dados ? efetiva() : null;
      gNome.textContent = W.botao;
      gatilho.title = W.dica;
      gatilho.setAttribute('aria-label', W.botao + (s.dados ? ': ' + (g ? W.marchaNome(g, nomeMarcha(g)) : W.escolhaMarcha) : ''));
      gNiveis.hidden = !s.dados;
      Array.from(gNiveis.children).forEach((i, k) => { i.classList.toggle('is-on', !!g && k < g); i.classList.toggle('is-novo', s.marchaNova && !!g && k === g - 1); });
      gatilho.classList.toggle('is-cheio', g === MARCHAS.length);
    }
    function renderMarcha() {
      const W = w(), L = lang(), g = efetiva(), m = s.dados && s.dados.marcha;
      sobre.textContent = W.titulo;
      fechar.setAttribute('aria-label', W.fechar);
      fechar.title = W.fechar;
      titulo.textContent = !s.dados ? W.titulo : g ? W.marchaNome(g, nomeMarcha(g)) : W.escolhaMarcha;
      if (s.marchaNova && !reduzido()) piscar(titulo, 'is-novo', 520);
      sub.hidden = !s.dados;
      sub.textContent = !s.dados ? '' : s.pendente ? '' : m ? (horaDe(m.em) ? W.escolhidaAs(diaDe(m.em, L), horaDe(m.em)) : W.escolhidaEm(diaDe(m.em, L))) : W.toqueParaEscolher;
      sub.hidden = !sub.textContent;
      notaLista.textContent = s.dados && W.lista ? W.lista : '';
      notaLista.hidden = !notaLista.textContent;
      seletor.hidden = !s.dados;
      seletor.setAttribute('aria-label', W.marchasRotulo);
      for (const [n, o] of botoesMarcha) {
        const marcada = g === n, credito = creditoDe(n, L);
        o.nome.textContent = nomeMarcha(n);
        o.linha.textContent = linhaMarcha(n);
        o.cred.textContent = credito;
        o.b.setAttribute('aria-pressed', String(marcada));
        o.b.setAttribute('aria-label', W.marchaNome(n, nomeMarcha(n)) + '. ' + linhaMarcha(n) + ' ' + W.creditoRotulo + ': ' + credito + '.');
        o.b.classList.toggle('is-pendente', !!s.pendente && s.pendente.n === n);
        o.b.disabled = s.ocupado === 'marcha';
        const group = copia('gear-' + n, language => gearText(n, language, linhaMarcha(n)), true);
        o.copySlot.replaceChildren(...(group ? [group] : []));
      }
      nunca.hidden = !s.dados;
      nunca.replaceChildren(el('strong', null, W.nuncaCorta), el('span', null, textoEm(estado().nuncaCorta, L) || W.nuncaCortaMarcha));
    }
    function renderMinutos() {
      const W = w(), L = lang(), e = estado(), v = visiveis(e);
      secMin.hidden = !s.dados;
      if (!s.dados) return;
      const total = minutosDe(e), meta = metaDe(total), dono = e.modo === 'dono' && !!e.medido;


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
      const actions = el('div', 'acel-fase-actions'), group = copia('phase-' + id, language => phaseText(id, language), phaseWritesFile(id));
      actions.append(ligarB);
      if (group) actions.append(group);
      card.append(cabeca, q, actions, linhas);
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
        const group = copia('phase-' + id, language => phaseText(id, language), phaseWritesFile(id));
        if (group) detalhe.append(group);
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
      avisoDesfazer.textContent = w().desfazer;
      if (ativo && gaveta.open) focar(ativo);
      s.novaFase = null; s.marchaNova = false;
      s.assinatura = JSON.stringify([lang(), s.dados, s.falhou, s.ocupado, s.pendente && s.pendente.n]);
    }

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

    function cancelarMarcha() {
      if (!s.pendente) return;
      clearTimeout(s.pendente.timer); s.pendente = null;
      renderTudo(); avisar(w().marchaDesfeita); focar('marcha-' + (salva() || 1));
    }
    function escolherMarcha(n) {
      if (!s.dados || s.ocupado === 'marcha' || !marchaValida(n)) return;
      if (s.pendente) { clearTimeout(s.pendente.timer); s.pendente = null; }
      if (n === salva()) { renderTudo(); fecharAviso(); return; }
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
        const W = w(), nome = W.marchaNome(n, nomeMarcha(n));
        avisar(j.recado && j.recado.hora ? W.avisou(nome, j.recado.hora) : W.guardou(nome));
      } catch (e) {
        s.ocupado = false; renderTudo(); avisar(msgErro(e.codigo));
        if (e.codigo === 'previa_so_leitura' || e.codigo === 'gravar') carregar();
      }
    }

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

    function abrir() {
      if (gaveta.open || !s.vivo) return;
      s.voltar = doc.activeElement;
      renderTudo();
      try { gaveta.showModal(); } catch { gaveta.setAttribute('open', ''); }
      gatilho.setAttribute('aria-expanded', 'true');
      if (!reduzido()) piscar(gaveta, 'is-abrindo', 400);
      if (!focar('marcha-' + (efetiva() || 0))) fechar.focus();
      carregar();
    }
    function fecharGaveta() { if (gaveta.open) { if (typeof gaveta.close === 'function') gaveta.close(); else { gaveta.removeAttribute('open'); aoFechar(); } } }

    function aoFechar() {
      gatilho.setAttribute('aria-expanded', 'false');
      if (!s.pendente) fecharAviso();
      const volta = s.voltar && s.voltar.isConnected && s.voltar !== doc.body ? s.voltar : gatilho;
      try { volta.focus({ preventScroll: true }); } catch {  }
    }
    gaveta.addEventListener('close', aoFechar);
    gaveta.addEventListener('click', ev => { if (ev.target === gaveta) fecharGaveta(); });
    fechar.addEventListener('click', fecharGaveta);
    gatilho.addEventListener('click', () => { if (!reduzido()) piscar(gatilho, 'is-apertando', 180); if (gaveta.open) fecharGaveta(); else abrir(); });
    const aoTeclar = ev => { if (ev.key === 'Escape' && gaveta.open) { ev.preventDefault(); fecharGaveta(); } };
    doc.addEventListener('keydown', aoTeclar);

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
      abrir, fechar: fecharGaveta, recarregar: carregar, escolherMarcha,
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
        if (gaveta.open) { try { gaveta.close(); } catch {  } }
        gaveta.remove(); controles.remove();
        delete host.__acel;
      }
    };
    host.__acel = instancia;
    renderTudo();
    carregar().then(() => { if (s.abrirDepois) { s.abrirDepois = false; abrir(); } });
    return instancia;
  }

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

      setTimeout(() => { if (!renderizou && !instancia) sozinho(); }, 1500);
      return;
    }
    sozinho();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', auto, { once: true }); else auto();
})(typeof window === 'undefined' ? globalThis : window);
