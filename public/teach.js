(function(root){
  'use strict';
  const panelStorage=()=>root.PanelStorage?.storage()??((root.location?.search&&new URLSearchParams(root.location.search).get('example')==='1')?null:root.localStorage);
  // Teach your AI: optional working rules copied with the instruction for the local AI.
  // The panel only shows and copies this text; it never writes rule files or makes a network request.
  // The copied instruction asks the person's local AI to save the rules if the person approves.
  // The "who does what" choice stays in this browser (localStorage) on the person's computer.
  const TASKS=['coordinate','code','review','analyze','ship','text'];
  const NAMES={claude:'Claude Code',codex:'Codex'};
  const OTHER={claude:'codex',codex:'claude'};
  const T={
    en:{
      button:'Teach your AI',optional:'Teach your AI (optional)',title:'Teach your AI',
      card:'Optional working rules for your project. You see every line before you copy it.',
      who:'Who does what',keep:'Keep my current way',keepNote:'You already split the work your way. The panel changes nothing and makes no rules block.',observedNone:'Nothing observed yet: no tool use read from your sessions.',observed:parts=>'Observed in your sessions, not a rule: '+parts.join('; ')+'.',observedExample:parts=>'Observed in the example sessions, not a rule: '+parts.join('; ')+'.',observedPart:(name,what,share)=>name+' mostly '+what+' ('+share+'% of its tool calls)',observedEmpty:name=>name+': no sessions read',what:{edit:'edits files',command:'runs commands',read:'reads and searches files',helper:'calls helper agents',web:'searches the web',other:'uses other tools'},custom:'Custom choice',customNote:'Pick Claude Code, Codex or both for each task.',recommended:'Use the recommendation',recommendedTag:'Recommended',recommendedNote:'One AI coordinates, code runs in parallel on both, the other AI reviews, analysis uses a smaller model, production waits for your ok.',
      both:'Both',saved:'Saved on this computer.',current:'Current: ',currentRecommended:'the recommendation',
      tasks:{coordinate:'Coordinate',code:'Write code',review:'Review',analyze:'Analyze and measure',ship:'Ship to production',text:'Write public text'},
      signature:'Analysis by Claude, an AI model by Anthropic, October 2026. It may favor Claude; compare it with your own results.',
      intro:'Copy the rules and paste them into any Claude Code chat running on your computer.',
      promise:'The panel only copies. Your AI saves the rules and confirms in one line.',
      folder:'To see these tasks on the panel, use Connect my task folder in Queue.',
      copy:'Copy the lines',copied:'Copied.',select:'Select the lines above and copy them.',
      header:'## Lazy Du Agent Panel: my working rules',
      folderLines:[
        '- Keep one Markdown file per task in tasks/. Start it with the lines ---, phase: doing, --- and then # Task title.',
        '- Phases: new, open, doing, ready, review, released, done. When a task is finished, set phase: done and add completed_at: with the ISO date and time.',
        '- Questions that need my decision go in tasks/decisions.md as numbered headings, like ## 1. Which music fits the menu? Add DONE once I answer.'
      ],
      recommendedLines:{
        coordinate:'- Coordinate: the AI where I start the work coordinates and splits it into tasks; the other AI checks the plan.',
        code:'- Write code: Claude Code and Codex in parallel on independent tasks (tasks that touch the same files go one after another), with the strongest model and high effort.',
        review:'- Review: the other AI reviews each change; nobody reviews its own work.',
        analyze:'- Analyze and measure: a smaller model with low effort.',
        ship:'- Ship to production: only after my explicit ok, by the AI that runs this project\'s safest checks.',
        text:'- Write public text: one AI writes, the other reviews, and I approve before it goes out.'
      },
      one:{
        coordinate:(a,b)=>'- Coordinate: '+a+' splits the work into tasks; '+b+' checks the plan.',
        code:(a,b)=>'- Write code: '+a+', with the strongest model and high effort; '+b+' reviews each change.',
        review:(a,b)=>'- Review: '+a+' reviews, never its own change; changes '+a+' wrote go to '+b+'.',
        analyze:(a,b)=>'- Analyze and measure: '+a+', with a smaller model and low effort; '+b+' checks the numbers.',
        ship:(a,b)=>'- Ship to production: '+a+', only after my explicit ok; '+b+' reviews the change first.',
        text:(a,b)=>'- Write public text: '+a+' writes, '+b+' reviews, and I approve before it goes out.'
      },
      shared:{
        coordinate:'- Coordinate: Claude Code and Codex share the plan; each checks how the other split the work.',
        code:'- Write code: Claude Code and Codex in parallel on independent tasks, with the strongest model and high effort; each reviews the other\'s changes.',
        review:'- Review: the AI that did not write a change reviews it; nobody reviews its own work.',
        analyze:'- Analyze and measure: either AI, with a smaller model and low effort; the other checks the numbers.',
        ship:'- Ship to production: only after my explicit ok, by the AI that runs this project\'s safest checks; the other reviews first.',
        text:'- Write public text: one AI writes, the other reviews, and I approve before it goes out.'
      },
      notes:{
        claude:{coordinate:'Keeps a long plan in one session and can hand parts to helper agents. Long planning sessions use plan credit fast.',code:'Handles changes across many files and follows the rules file closely. It may edit more than asked; ask for small, focused changes.',review:'Reads diffs and tests carefully and explains what it found. It shares blind spots with code it wrote itself.',analyze:'Explains numbers and trade-offs clearly. The strongest model is usually more than this needs.',ship:'Runs the project scripts and checks you allow. Keep production steps behind your explicit ok.',text:'Writes natural, careful text. Still read every public word before it goes out.'},
        codex:{coordinate:'Works well from a written plan and a clear task list. Keep the plan in a file so separate tasks stay aligned.',code:'Good at focused changes with tests and can run several tasks at once. Check that parallel tasks do not touch the same files.',review:'A useful second opinion on another AI\'s change. It shares blind spots with code it wrote itself.',analyze:'Fine for scripted checks and measurements. The strongest model is usually more than this needs.',ship:'Runs the project scripts and checks you allow. Keep production steps behind your explicit ok.',text:'Writes clear, direct text. Still read every public word before it goes out.'}
      }
    },
    pt:{
      button:'Ensinar minha IA',optional:'Ensinar minha IA (opcional)',title:'Ensinar minha IA',
      card:'Regras de trabalho opcionais para o seu projeto. Você vê cada linha antes de copiar.',
      who:'Quem faz o quê',keep:'Manter o meu jeito de hoje',keepNote:'Você já divide o trabalho do seu jeito. O painel não muda nada e não gera bloco de regras.',observedNone:'Nada observado ainda: nenhum uso de ferramenta lido nas suas sessões.',observed:parts=>'Observado nas suas sessões, não é regra: '+parts.join('; ')+'.',observedExample:parts=>'Observado nas sessões do exemplo, não é regra: '+parts.join('; ')+'.',observedPart:(name,what,share)=>name+' na maior parte '+what+' ('+share+'% das chamadas de ferramenta)',observedEmpty:name=>name+': nenhuma sessão lida',what:{edit:'edita arquivos',command:'roda comandos',read:'lê e procura em arquivos',helper:'chama agentes ajudantes',web:'pesquisa na web',other:'usa outras ferramentas'},custom:'Escolha personalizada',customNote:'Marque Claude Code, Codex ou os dois em cada tarefa.',recommended:'Usar a recomendação',recommendedTag:'Recomendado',recommendedNote:'Uma IA coordena, o código anda em paralelo nas duas, a outra IA revisa, a análise usa um modelo menor e a produção espera o seu ok.',
      both:'Os dois',saved:'Salvo neste computador.',current:'Atual: ',currentRecommended:'a recomendação',
      tasks:{coordinate:'Coordenar',code:'Escrever código',review:'Revisar',analyze:'Analisar e medir',ship:'Subir para produção',text:'Escrever texto público'},
      signature:'Análise feita pelo Claude, um modelo de IA da Anthropic, outubro de 2026. Pode favorecer o Claude; compare com os seus resultados.',
      intro:'Copie as regras e cole em qualquer conversa do Claude Code que roda no seu computador.',
      promise:'O painel só copia. Quem salva as regras é a sua IA, e ela confirma em 1 linha.',
      folder:'Para ver essas tarefas no painel, use Conectar minha pasta de tarefas na Fila.',
      copy:'Copiar as linhas',copied:'Copiado.',select:'Selecione as linhas acima e copie.',
      header:'## Lazy Du Agent Panel: minhas regras de trabalho',
      folderLines:[
        '- Mantenha um arquivo Markdown por tarefa em tasks/. Comece com as linhas ---, phase: doing, --- e depois # Título da tarefa.',
        '- Fases: new, open, doing, ready, review, released, done. Quando a tarefa terminar, use phase: done e acrescente completed_at: com a data e a hora em ISO.',
        '- Perguntas que precisam da minha decisão vão em tasks/decisions.md como títulos numerados, como ## 1. Qual música combina com o menu? Acrescente DONE quando eu responder.'
      ],
      recommendedLines:{
        coordinate:'- Coordenar: a IA onde eu começo o trabalho coordena e divide em tarefas; a outra IA confere o plano.',
        code:'- Escrever código: Claude Code e Codex em paralelo nas tarefas independentes (tarefas que mexem nos mesmos arquivos vão uma depois da outra), com o modelo mais forte e esforço alto.',
        review:'- Revisar: a outra IA revisa cada mudança; ninguém revisa o próprio trabalho.',
        analyze:'- Analisar e medir: um modelo menor com esforço baixo.',
        ship:'- Subir para produção: só depois do meu ok explícito, pela IA que roda as checagens mais seguras deste projeto.',
        text:'- Escrever texto público: uma IA escreve, a outra revisa e eu aprovo antes de sair.'
      },
      one:{
        coordinate:(a,b)=>'- Coordenar: '+a+' divide o trabalho em tarefas; '+b+' confere o plano.',
        code:(a,b)=>'- Escrever código: '+a+', com o modelo mais forte e esforço alto; '+b+' revisa cada mudança.',
        review:(a,b)=>'- Revisar: '+a+' revisa, nunca a própria mudança; o que '+a+' escreveu vai para '+b+'.',
        analyze:(a,b)=>'- Analisar e medir: '+a+', com um modelo menor e esforço baixo; '+b+' confere os números.',
        ship:(a,b)=>'- Subir para produção: '+a+', só depois do meu ok explícito; '+b+' revisa a mudança antes.',
        text:(a,b)=>'- Escrever texto público: '+a+' escreve, '+b+' revisa e eu aprovo antes de sair.'
      },
      shared:{
        coordinate:'- Coordenar: Claude Code e Codex dividem o plano; cada um confere como o outro dividiu o trabalho.',
        code:'- Escrever código: Claude Code e Codex em paralelo nas tarefas independentes, com o modelo mais forte e esforço alto; cada um revisa as mudanças do outro.',
        review:'- Revisar: a IA que não escreveu a mudança revisa; ninguém revisa o próprio trabalho.',
        analyze:'- Analisar e medir: qualquer uma das IAs, com um modelo menor e esforço baixo; a outra confere os números.',
        ship:'- Subir para produção: só depois do meu ok explícito, pela IA que roda as checagens mais seguras deste projeto; a outra revisa antes.',
        text:'- Escrever texto público: uma IA escreve, a outra revisa e eu aprovo antes de sair.'
      },
      notes:{
        claude:{coordinate:'Segura um plano longo numa sessão e pode passar partes para agentes ajudantes. Sessões longas de planejamento gastam o crédito rápido.',code:'Lida com mudanças em muitos arquivos e segue de perto o arquivo de regras. Pode mexer além do pedido; peça mudanças pequenas e focadas.',review:'Lê diffs e testes com cuidado e explica o que achou. Tem os mesmos pontos cegos no código que ele mesmo escreveu.',analyze:'Explica números e trocas com clareza. O modelo mais forte costuma ser mais do que isso precisa.',ship:'Roda os scripts e checagens do projeto que você liberar. Deixe os passos de produção atrás do seu ok explícito.',text:'Escreve texto natural e cuidadoso. Mesmo assim, leia cada palavra pública antes de sair.'},
        codex:{coordinate:'Funciona bem a partir de um plano escrito e de uma lista clara de tarefas. Guarde o plano num arquivo para as tarefas separadas seguirem alinhadas.',code:'Bom em mudanças focadas com testes e pode rodar várias tarefas ao mesmo tempo. Confira se as tarefas em paralelo não mexem nos mesmos arquivos.',review:'Uma segunda opinião útil sobre a mudança de outra IA. Tem os mesmos pontos cegos no código que ele mesmo escreveu.',analyze:'Serve para checagens e medições com script. O modelo mais forte costuma ser mais do que isso precisa.',ship:'Roda os scripts e checagens do projeto que você liberar. Deixe os passos de produção atrás do seu ok explícito.',text:'Escreve texto claro e direto. Mesmo assim, leia cada palavra pública antes de sair.'}
      }
    },
    es:{
      button:'Enseña a tu IA',optional:'Enseña a tu IA (opcional)',title:'Enseña a tu IA',
      card:'Reglas de trabajo opcionales para tu proyecto. Ves cada línea antes de copiarla.',
      who:'Quién hace qué',keep:'Mantener mi forma actual',keepNote:'Ya repartes el trabajo a tu manera. El panel no cambia nada y no genera bloque de reglas.',observedNone:'Nada observado todavía: no se leyó uso de herramientas en tus sesiones.',observed:parts=>'Observado en tus sesiones, no es una regla: '+parts.join('; ')+'.',observedExample:parts=>'Observado en las sesiones del ejemplo, no es una regla: '+parts.join('; ')+'.',observedPart:(name,what,share)=>name+' sobre todo '+what+' ('+share+'% de sus llamadas a herramientas)',observedEmpty:name=>name+': ninguna sesión leída',what:{edit:'edita archivos',command:'ejecuta comandos',read:'lee y busca en archivos',helper:'llama a agentes ayudantes',web:'busca en la web',other:'usa otras herramientas'},custom:'Elección personalizada',customNote:'Marca Claude Code, Codex o los dos en cada tarea.',recommended:'Usar la recomendación',recommendedTag:'Recomendado',recommendedNote:'Una IA coordina, el código avanza en paralelo en las dos, la otra IA revisa, el análisis usa un modelo más pequeño y producción espera tu ok.',
      both:'Los dos',saved:'Guardado en este ordenador.',current:'Actual: ',currentRecommended:'la recomendación',
      tasks:{coordinate:'Coordinar',code:'Escribir código',review:'Revisar',analyze:'Analizar y medir',ship:'Subir a producción',text:'Escribir texto público'},
      signature:'Análisis hecho por Claude, un modelo de IA de Anthropic, octubre de 2026. Puede favorecer a Claude; compáralo con tus resultados.',
      intro:'Copia las reglas y pégalas en cualquier conversación de Claude Code que corra en tu ordenador.',
      promise:'El panel solo copia. Quien guarda las reglas es tu IA, y lo confirma en 1 línea.',
      folder:'Para ver esas tareas en el panel, usa Conectar mi carpeta de tareas en Cola.',
      copy:'Copiar las líneas',copied:'Copiado.',select:'Selecciona las líneas de arriba y cópialas.',
      header:'## Lazy Du Agent Panel: mis reglas de trabajo',
      folderLines:[
        '- Mantén un archivo Markdown por tarea en tasks/. Empiézalo con las líneas ---, phase: doing, --- y después # Título de la tarea.',
        '- Fases: new, open, doing, ready, review, released, done. Cuando una tarea termine, usa phase: done y añade completed_at: con la fecha y la hora en ISO.',
        '- Las preguntas que necesitan mi decisión van en tasks/decisions.md como títulos numerados, como ## 1. ¿Qué música va con el menú? Añade DONE cuando yo responda.'
      ],
      recommendedLines:{
        coordinate:'- Coordinar: la IA donde empiezo el trabajo coordina y lo divide en tareas; la otra IA revisa el plan.',
        code:'- Escribir código: Claude Code y Codex en paralelo en tareas independientes (las tareas que tocan los mismos archivos van una después de otra), con el modelo más potente y esfuerzo alto.',
        review:'- Revisar: la otra IA revisa cada cambio; nadie revisa su propio trabajo.',
        analyze:'- Analizar y medir: un modelo más pequeño con esfuerzo bajo.',
        ship:'- Subir a producción: solo después de mi ok explícito, con la IA que ejecuta las comprobaciones más seguras de este proyecto.',
        text:'- Escribir texto público: una IA escribe, la otra revisa y yo apruebo antes de publicarlo.'
      },
      one:{
        coordinate:(a,b)=>'- Coordinar: '+a+' divide el trabajo en tareas; '+b+' revisa el plan.',
        code:(a,b)=>'- Escribir código: '+a+', con el modelo más potente y esfuerzo alto; '+b+' revisa cada cambio.',
        review:(a,b)=>'- Revisar: '+a+' revisa, nunca su propio cambio; lo que escribió '+a+' va a '+b+'.',
        analyze:(a,b)=>'- Analizar y medir: '+a+', con un modelo más pequeño y esfuerzo bajo; '+b+' revisa los números.',
        ship:(a,b)=>'- Subir a producción: '+a+', solo después de mi ok explícito; '+b+' revisa el cambio antes.',
        text:(a,b)=>'- Escribir texto público: '+a+' escribe, '+b+' revisa y yo apruebo antes de publicarlo.'
      },
      shared:{
        coordinate:'- Coordinar: Claude Code y Codex comparten el plan; cada uno revisa cómo dividió el trabajo el otro.',
        code:'- Escribir código: Claude Code y Codex en paralelo en tareas independientes, con el modelo más potente y esfuerzo alto; cada uno revisa los cambios del otro.',
        review:'- Revisar: la IA que no escribió el cambio lo revisa; nadie revisa su propio trabajo.',
        analyze:'- Analizar y medir: cualquiera de las dos, con un modelo más pequeño y esfuerzo bajo; la otra revisa los números.',
        ship:'- Subir a producción: solo después de mi ok explícito, con la IA que ejecuta las comprobaciones más seguras de este proyecto; la otra revisa antes.',
        text:'- Escribir texto público: una IA escribe, la otra revisa y yo apruebo antes de publicarlo.'
      },
      notes:{
        claude:{coordinate:'Mantiene un plan largo en una sesión y puede pasar partes a agentes ayudantes. Las sesiones largas de planificación gastan crédito rápido.',code:'Maneja cambios en muchos archivos y sigue de cerca el archivo de reglas. Puede tocar más de lo pedido; pide cambios pequeños y concretos.',review:'Lee diffs y pruebas con cuidado y explica lo que encontró. Comparte puntos ciegos con el código que escribió.',analyze:'Explica números y compromisos con claridad. El modelo más potente suele ser más de lo necesario.',ship:'Ejecuta los scripts y comprobaciones del proyecto que permitas. Deja los pasos de producción detrás de tu ok explícito.',text:'Escribe texto natural y cuidadoso. Aun así, lee cada palabra pública antes de publicarla.'},
        codex:{coordinate:'Funciona bien a partir de un plan escrito y una lista clara de tareas. Guarda el plan en un archivo para que las tareas separadas sigan alineadas.',code:'Bueno en cambios concretos con pruebas y puede ejecutar varias tareas a la vez. Comprueba que las tareas en paralelo no toquen los mismos archivos.',review:'Una segunda opinión útil sobre el cambio de otra IA. Comparte puntos ciegos con el código que escribió.',analyze:'Sirve para comprobaciones y mediciones con scripts. El modelo más potente suele ser más de lo necesario.',ship:'Ejecuta los scripts y comprobaciones del proyecto que permitas. Deja los pasos de producción detrás de tu ok explícito.',text:'Escribe texto claro y directo. Aun así, lee cada palabra pública antes de publicarla.'}
      }
    }
  };
  const STORE='agent-panel-roles';
  const lingua=value=>Object.prototype.hasOwnProperty.call(T,value)?value:'en';
  const PICKS=['claude','codex','both'];
  function normalize(choice){
    const mode=['custom','own'].includes(choice&&choice.mode)?choice.mode:'recommended',picks={};
    for(const task of TASKS)picks[task]=PICKS.includes(choice?.picks?.[task])?choice.picks[task]:'both';
    return {version:1,mode,picks};
  }
  function taskLine(task,pick,lang){const t=T[lingua(lang)];return pick==='both'?t.shared[task]:t.one[task](NAMES[pick],NAMES[OTHER[pick]]);}
  function lines(choice,lang){
    const t=T[lingua(lang)],c=normalize(choice);
    if(c.mode==='own')return [];
    return [t.header,...TASKS.map(task=>c.mode==='recommended'?t.recommendedLines[task]:taskLine(task,c.picks[task],lang)),...t.folderLines];
  }
  const text=(choice,lang)=>lines(choice,lang).join('\n');

  const SIMPLE={
    en:{copy:'Copy and paste into Claude Code',switchCodex:'I use Codex',switchClaude:'I use Claude Code',other:'Other options',global:'For all my projects',project:'Only this project',afterClaude:'Paste it into any Claude Code chat running on your computer. If it asks to edit the file, allow it. Done.',afterCodex:'Paste it into any Codex chat running on your computer. If it asks to edit the file, allow it. Done.',instruction:'Save the rules below in my global ~/.claude/CLAUDE.md so they apply to all my projects. Put them in a section that starts with the title "## Lazy Du Agent Panel". If that section already exists, replace only that section: its title line and the lines starting with "- " right below it. Create the file if it does not exist. Do not delete or change anything else. Then confirm in one line. If you cannot reach my home folder from here (for example, in a cloud session), say so in one line and stop.',header:'## Lazy Du Agent Panel: my working rules',folderLine:'- In projects that have a tasks/ folder, keep one Markdown file per task there.',cloud:'Using Claude Code or Codex in the cloud? A cloud session cannot reach the file on your computer: paste it in a chat on your computer.',old:'Already pasted the old rules in a project? Copy the removal request and paste it into a chat in that project.'},
    pt:{copy:'Copiar e colar no Claude Code',switchCodex:'Uso o Codex',switchClaude:'Uso o Claude Code',other:'Outras opções',global:'Para todos os meus projetos',project:'Só este projeto',afterClaude:'Cole em qualquer conversa do Claude Code que roda no seu computador. Se ela pedir para editar o arquivo, permita. Pronto.',afterCodex:'Cole em qualquer conversa do Codex que roda no seu computador. Se ela pedir para editar o arquivo, permita. Pronto.',instruction:'Salve as regras abaixo no meu ~/.claude/CLAUDE.md global, para valerem em todos os meus projetos. Coloque numa seção que começa com o título "## Lazy Du Agent Panel". Se essa seção já existir, troque só ela: a linha do título e as linhas que começam com "- " logo abaixo. Crie o arquivo se ele não existir. Não apague nem mude mais nada. Depois confirme em 1 linha. Se daqui você não alcança a minha pasta pessoal (por exemplo, numa sessão na nuvem), diga isso em 1 linha e pare.',header:'## Lazy Du Agent Panel: minhas regras de trabalho',folderLine:'- Nos projetos que têm uma pasta tasks/, mantenha ali um arquivo Markdown por tarefa.',cloud:'Usa o Claude Code ou o Codex na nuvem? A sessão na nuvem não alcança o arquivo do seu computador: cole numa conversa no seu computador.',old:'Já colou as regras antigas num projeto? Copie o pedido de remoção e cole numa conversa desse projeto.'},
    es:{copy:'Copiar y pegar en Claude Code',switchCodex:'Uso Codex',switchClaude:'Uso Claude Code',other:'Otras opciones',global:'Para todos mis proyectos',project:'Solo este proyecto',afterClaude:'Pégalo en cualquier conversación de Claude Code que corra en tu ordenador. Si pide editar el archivo, permítelo. Listo.',afterCodex:'Pégalo en cualquier conversación de Codex que corra en tu ordenador. Si pide editar el archivo, permítelo. Listo.',instruction:'Guarda las reglas de abajo en mi ~/.claude/CLAUDE.md global, para que valgan en todos mis proyectos. Ponlas en una sección que empiece con el título "## Lazy Du Agent Panel". Si esa sección ya existe, reemplaza solo esa sección: la línea del título y las líneas que empiezan con "- " justo debajo. Crea el archivo si no existe. No borres ni cambies nada más. Después confirma en 1 línea. Si desde aquí no llegas a mi carpeta personal (por ejemplo, en una sesión en la nube), dilo en 1 línea y detente.',header:'## Lazy Du Agent Panel: mis reglas de trabajo',folderLine:'- En los proyectos que tienen una carpeta tasks/, guarda ahí un archivo Markdown por tarea.',cloud:'¿Usas Claude Code o Codex en la nube? Una sesión en la nube no llega al archivo de tu ordenador: pégalo en una conversación en tu ordenador.',old:'¿Ya pegaste las reglas antiguas en un proyecto? Copia la petición de retirada y pégala en una conversación de ese proyecto.'}
  };
  const MODEL_EFFORT={
  "en": "- When you start a helper, pick its model and effort by this table, when this tool lets you: coordinate, the strongest model, high or extra high effort; write code, the strongest model, high effort; review security or money, the strongest model, extra high effort, in a clean session, never the one that wrote it; review text, the strongest model, high effort; measure and count, a smaller model, low effort; mechanical task, the smallest model, low effort.",
  "pt": "- Quando abrir um ajudante, escolha modelo e esforço por esta tabela, se esta ferramenta deixar: coordenar, o modelo mais forte, esforço alto ou extra alto; escrever código, o modelo mais forte, esforço alto; revisar segurança ou dinheiro, o modelo mais forte, esforço extra alto, numa sessão limpa, nunca quem escreveu; revisar texto, o modelo mais forte, esforço alto; medir e contar, um modelo menor, esforço baixo; tarefa mecânica, o menor modelo, esforço baixo.",
  "es": "- Cuando abras un ayudante, elige modelo y esfuerzo según esta tabla, si esta herramienta lo permite: coordinar, el modelo más fuerte, esfuerzo alto o extra alto; escribir código, el modelo más fuerte, esfuerzo alto; revisar seguridad o dinero, el modelo más fuerte, esfuerzo extra alto, en una sesión limpia, nunca quien lo escribió; revisar texto, el modelo más fuerte, esfuerzo alto; medir y contar, un modelo menor, esfuerzo bajo; tarea mecánica, el modelo más pequeño, esfuerzo bajo."
};
  const REMOVE={
    en:{global:'Remove the section that starts with the title "## Lazy Du Agent Panel" from my global ~/.claude/CLAUDE.md: its title line and the lines starting with "- " right below it. Do not delete or change anything else. Then confirm in one line.',project:'Remove the section that starts with the title "## Lazy Du Agent Panel" from CLAUDE.md in the folder of the project of this chat: its title line and the lines starting with "- " right below it. Do not delete or change anything else. Then confirm in one line.',globalLabel:'Copy to remove the rules',projectLabel:'Copy to remove the old rules'},
    pt:{global:'Tire do meu ~/.claude/CLAUDE.md global a seção que começa com o título "## Lazy Du Agent Panel": a linha do título e as linhas que começam com "- " logo abaixo. Não apague nem mude mais nada. Depois confirme em 1 linha.',project:'Tire do CLAUDE.md da pasta do projeto desta conversa a seção que começa com o título "## Lazy Du Agent Panel": a linha do título e as linhas que começam com "- " logo abaixo. Não apague nem mude mais nada. Depois confirme em 1 linha.',globalLabel:'Copiar para tirar as regras',projectLabel:'Copiar para tirar as regras antigas'},
    es:{global:'Quita de mi ~/.claude/CLAUDE.md global la sección que empieza con el título "## Lazy Du Agent Panel": la línea del título y las líneas que empiezan con "- " justo debajo. No borres ni cambies nada más. Después confirma en 1 línea.',project:'Quita del CLAUDE.md de la carpeta del proyecto de esta conversación la sección que empieza con el título "## Lazy Du Agent Panel": la línea del título y las líneas que empiezan con "- " justo debajo. No borres ni cambies nada más. Después confirma en 1 línea.',globalLabel:'Copiar para quitar las reglas',projectLabel:'Copiar para quitar las reglas antiguas'}
  };
  function removalText(lang,target='claude',scope='global'){const t=REMOVE[lingua(lang)],value=t[scope==='project'?'project':'global'];return target==='codex'?value.replace(scope==='project'?'CLAUDE.md':'~/.claude/CLAUDE.md',scope==='project'?'AGENTS.md':'~/.codex/AGENTS.md'):value;}
  function ruleText(choice,lang,target='claude',scope='global'){
    lang=lingua(lang);const t=SIMPLE[lang],c=normalize(choice);
    if(c.mode==='own')return '';
    const path=target==='codex'?'~/.codex/AGENTS.md':'~/.claude/CLAUDE.md';
    let instruction=t.instruction.replace('~/.claude/CLAUDE.md',path);
    if(scope==='project'){
      const file=target==='codex'?'AGENTS.md':'CLAUDE.md';
      const replacements={en:['my global '+path+' so they apply to all my projects','the '+file+' file at the root of this project so they apply only to this project'],pt:['meu '+path+' global, para valerem em todos os meus projetos','arquivo '+file+' na raiz deste projeto, para valerem só neste projeto'],es:['mi '+path+' global, para que valgan en todos mis proyectos','archivo '+file+' en la raíz de este proyecto, para que valgan solo en este proyecto']};
      instruction=instruction.replace(...replacements[lang]);
    }
    const rules=lines(c,lang);rules[0]=t.header;rules[1+TASKS.length]=t.folderLine;rules.push(MODEL_EFFORT[lang]);
    return instruction+'\n\n'+rules.join('\n');
  }
  async function copyToClipboard(value,runtime=root){
    try{await runtime.navigator.clipboard.writeText(value);return true;}catch{}
    const doc=runtime.document;if(!doc?.execCommand)return false;
    const previous=doc.activeElement,field=doc.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';doc.body.append(field);
    try{field.select();return !!doc.execCommand('copy');}catch{return false;}finally{field.remove();previous?.focus?.();}
  }

  const KIND=[['edit',/^(?:edit|multiedit|write|notebookedit|apply_patch|write_file)$/i],['command',/^(?:bash|powershell|exec_command|shell|local_shell|run_command)$/i],['read',/^(?:read|grep|glob|ls|read_file|list_dir|search_files)$/i],['helper',/^(?:agent|task|spawn_agent|followup_task)$/i],['web',/^(?:websearch|webfetch|web_search|web_fetch)$/i]];
  function kindOf(name){for(const [kind,pattern]of KIND)if(pattern.test(String(name||'')))return kind;return 'other';}
  function observe(sessions){
    // Uses only tool names and counts from session metadata; no conversation text.
    const out={};for(const family of ['claude','codex']){const counts={};let total=0,seen=0;for(const s of sessions||[]){if(s?.agent!==family)continue;seen++;for(const tool of s.tools||[]){const n=Number.isFinite(tool?.count)&&tool.count>0?tool.count:0;if(!n)continue;const kind=kindOf(tool.name);counts[kind]=(counts[kind]||0)+n;total+=n;}}const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];out[family]={sessions:seen,total,top:top?top[0]:null,share:top&&total?Math.round(top[1]/total*100):null};}
    return out;
  }
  function observation(sessions,lang,example=false){const t=T[lingua(lang)],seen=observe(sessions);if(!seen.claude.total&&!seen.codex.total)return t.observedNone;return t[example?'observedExample':'observed'](['claude','codex'].map(f=>seen[f].total?t.observedPart(NAMES[f],t.what[seen[f].top],seen[f].share):t.observedEmpty(NAMES[f])));}
  const api={TASKS,NAMES,T,STORE,lingua,normalize,lines,text,taskLine,observe,observation,kindOf,SIMPLE,MODEL_EFFORT,REMOVE,ruleText,removalText,copyToClipboard};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  const d=root.document;
  function read(){try{const saved=JSON.parse(panelStorage().getItem(STORE));return saved&&saved.version===1?normalize(saved):null;}catch{return null;}}
  function write(choice){try{panelStorage().setItem(STORE,JSON.stringify({...normalize(choice),savedAt:new Date().toISOString()}));return true;}catch{return false;}}
  function el(tag,value,cls){const n=d.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;}
  function current(){return lingua(d.documentElement.lang||'en');}
  function summary(choice,lang){const t=T[lingua(lang)];if(choice.mode==='own')return t.current+t.keep;if(choice.mode==='recommended')return t.current+t.currentRecommended;return t.current+TASKS.map(task=>t.tasks[task]+' '+(choice.picks[task]==='both'?t.both:NAMES[choice.picks[task]])).join(' · ');}
  function open(lang,snapshot){
    lang=lingua(lang||current());const t=T[lang],simple=SIMPLE[lang],saved=read();let view='recommended',draft=normalize({mode:'recommended',picks:saved?.picks}),target='claude',scope='global';
    const seen=el('p',observation(snapshot?.usage?.sessions||[],lang,!!snapshot?.example),'summary-note teach-observed'),box=el('div',undefined,'teach teach-simple'),choices=el('div',undefined,'teach-options'),detail=el('div',undefined,'teach-custom'),block=el('pre','','teach-block'),status=el('p','','summary-note teach-status'),advanced=el('details',undefined,'teach-advanced'),scopes=el('div',undefined,'teach-scopes');
    choices.setAttribute('role','radiogroup');choices.setAttribute('aria-label',t.who);scopes.setAttribute('role','radiogroup');scopes.setAttribute('aria-label',simple.global);block.tabIndex=0;block.hidden=true;block.setAttribute('aria-label',t.title);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const groups=[];
    function setTarget(value){target=value;for(const group of groups)group.setTarget(value);draw();}
    function makeCopy(label,text,primary,buttonClass){const group=root.PanelCopySession.create({lang,label,text,writesFile:true,target,primary,status,fallback:block,failed:t.select,onTargetChange:setTarget,onFallback(){advanced.open=true;block.hidden=false;}});group.button.className+=' '+buttonClass;groups.push(group);return group;}
    const main=makeCopy(value=>value==='claude'?simple.copy:simple.copy.replace('Claude Code','Codex'),value=>ruleText(draft,lang,value,scope),true,'teach-copy');main.switcher.className+=' teach-switch';
    const removeGlobal=makeCopy(REMOVE[lang].globalLabel,value=>removalText(lang,value,'global'),false,'teach-remove-global');
    const removeOld=makeCopy(REMOVE[lang].projectLabel,value=>removalText(lang,value,'project'),false,'teach-remove');
    function option(key,label,note,tag){const b=el('button',undefined,'teach-option');b.type='button';b.dataset.option=key;b.setAttribute('role','radio');const head=el('span',label,'teach-option-label');if(tag)head.append(el('span',tag,'teach-tag'));b.append(head,el('span',note,'teach-option-note'));b.onclick=()=>{view=key;draft={...draft,mode:key==='keep'?'own':key};write(draft);status.textContent=t.saved;draw();};return b;}
    function draw(){
      for(const b of choices.querySelectorAll('.teach-option')){const on=b.dataset.option===view;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;}
      for(const b of scopes.querySelectorAll('button'))b.setAttribute('aria-checked',String(b.dataset.scope===scope));
      detail.hidden=view!=='custom';detail.replaceChildren();const own=view==='keep';seen.hidden=!own;main.hidden=own;block.hidden=own;
      if(view==='custom'){for(const task of TASKS){const row=el('div',undefined,'teach-task'),pick=el('div',undefined,'teach-picks');pick.setAttribute('role','radiogroup');pick.setAttribute('aria-label',t.tasks[task]);row.append(el('strong',t.tasks[task],'teach-task-name'),pick);for(const value of PICKS){const b=el('button',value==='both'?t.both:NAMES[value],'teach-pick');b.type='button';b.dataset.family=value;b.setAttribute('role','radio');b.setAttribute('aria-checked',String(draft.picks[task]===value));b.onclick=()=>{draft={...draft,mode:'custom',picks:{...draft.picks,[task]:value}};write(draft);status.textContent=t.saved;draw();};pick.append(b);}for(const family of ['claude','codex']){const note=el('p',undefined,'teach-note');note.dataset.family=family;note.append(el('b',NAMES[family]+': '),d.createTextNode(t.notes[family][task]));row.append(note);}detail.append(row);}detail.append(el('p',t.signature,'summary-note teach-signature'));}
      main.refresh();block.textContent=ruleText(draft,lang,target,scope);
    }
    choices.append(option('recommended',t.recommended,t.recommendedNote,t.recommendedTag),option('keep',t.keep,t.keepNote),option('custom',t.custom,t.customNote));
    for(const [value,label]of [['global',simple.global],['project',simple.project]]){const b=el('button',label,'teach-scope');b.type='button';b.dataset.scope=value;b.setAttribute('role','radio');b.onclick=()=>{scope=value;status.textContent='';draw();};scopes.append(b);}
    advanced.append(el('summary',simple.other),el('h3',t.who,'teach-who'),choices,seen,detail,scopes,block,el('p',simple.cloud,'summary-note'),removeGlobal,removeOld,el('p',t.folder,'summary-note'));
    box.append(main,status,el('p',t.promise,'summary-note teach-promise'),advanced);
    draw();root.panelDrawer(t.title,[box]);
  }
  function card(host,lang){
    if(!host)return null;lang=lingua(lang||current());const t=T[lang];let box=host.querySelector(':scope > .teach-card');
    if(!box){box=el('section',undefined,'teach-card');const b=el('button','','teach-open');b.type='button';box.append(el('h2','','teach-title'),el('p','','teach-copytext'),b);host.prepend(box);}
    box.querySelector('.teach-title').textContent=t.title;box.querySelector('.teach-copytext').textContent=t.card;const b=box.querySelector('.teach-open');b.textContent=t.button;b.onclick=()=>open(lang,root.PanelV2?.state?.()?.snapshot);return box;
  }
  root.PanelTeach=Object.freeze({...api,open,card,read});
})(typeof window==='object'?window:globalThis);
