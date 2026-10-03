(function(root){
  'use strict';
  // Teach your AI: optional working rules the person copies into CLAUDE.md or AGENTS.md.
  // The panel only shows and copies this text. It never writes files and makes no network request.
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
      intro:'Paste these lines into your project rules: CLAUDE.md for Claude Code or AGENTS.md for Codex.',
      promise:'The panel only copies this text. It does not write to your files and makes no network request. To remove the rules, delete these lines from your rules file.',
      folder:'To see the tasks here, connect the tasks folder with Connect my task folder.',
      copy:'Copy the lines',copied:'Copied. Paste them into your rules file.',select:'Select the lines above and copy them.',
      header:'## Lazy Du Agent Panel: working rules for this project (to remove them, delete this section)',
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
      intro:'Cole estas linhas nas regras do seu projeto: CLAUDE.md no Claude Code ou AGENTS.md no Codex.',
      promise:'O painel só copia este texto. Ele não escreve nos seus arquivos e não faz pedido de rede. Para tirar as regras, apague estas linhas do arquivo de regras.',
      folder:'Para ver as tarefas aqui, ligue a pasta tasks em Ligar minha pasta de tarefas.',
      copy:'Copiar as linhas',copied:'Copiado. Cole no seu arquivo de regras.',select:'Selecione as linhas acima e copie.',
      header:'## Lazy Du Agent Panel: regras de trabalho deste projeto (para tirar, apague esta seção)',
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
      intro:'Pega estas líneas en las reglas de tu proyecto: CLAUDE.md en Claude Code o AGENTS.md en Codex.',
      promise:'El panel solo copia este texto. No escribe en tus archivos y no hace peticiones de red. Para quitar las reglas, borra estas líneas de tu archivo de reglas.',
      folder:'Para ver las tareas aquí, conecta la carpeta tasks con Conectar mi carpeta de tareas.',
      copy:'Copiar las líneas',copied:'Copiado. Pégalo en tu archivo de reglas.',select:'Selecciona las líneas de arriba y cópialas.',
      header:'## Lazy Du Agent Panel: reglas de trabajo de este proyecto (para quitarlas, borra esta sección)',
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
  const KIND=[['edit',/^(?:edit|multiedit|write|notebookedit|apply_patch|write_file)$/i],['command',/^(?:bash|powershell|exec_command|shell|local_shell|run_command)$/i],['read',/^(?:read|grep|glob|ls|read_file|list_dir|search_files)$/i],['helper',/^(?:agent|task|spawn_agent|followup_task)$/i],['web',/^(?:websearch|webfetch|web_search|web_fetch)$/i]];
  function kindOf(name){for(const [kind,pattern]of KIND)if(pattern.test(String(name||'')))return kind;return 'other';}
  function observe(sessions){
    // Uses only tool names and counts from session metadata; no conversation text.
    const out={};for(const family of ['claude','codex']){const counts={};let total=0,seen=0;for(const s of sessions||[]){if(s?.agent!==family)continue;seen++;for(const tool of s.tools||[]){const n=Number.isFinite(tool?.count)&&tool.count>0?tool.count:0;if(!n)continue;const kind=kindOf(tool.name);counts[kind]=(counts[kind]||0)+n;total+=n;}}const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];out[family]={sessions:seen,total,top:top?top[0]:null,share:top&&total?Math.round(top[1]/total*100):null};}
    return out;
  }
  function observation(sessions,lang,example=false){const t=T[lingua(lang)],seen=observe(sessions);if(!seen.claude.total&&!seen.codex.total)return t.observedNone;return t[example?'observedExample':'observed'](['claude','codex'].map(f=>seen[f].total?t.observedPart(NAMES[f],t.what[seen[f].top],seen[f].share):t.observedEmpty(NAMES[f])));}
  const api={TASKS,NAMES,T,STORE,lingua,normalize,lines,text,taskLine,observe,observation,kindOf};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  const d=root.document;
  function read(){try{const saved=JSON.parse(root.localStorage.getItem(STORE));return saved&&saved.version===1?normalize(saved):null;}catch{return null;}}
  function write(choice){try{root.localStorage.setItem(STORE,JSON.stringify({...normalize(choice),savedAt:new Date().toISOString()}));return true;}catch{return false;}}
  function el(tag,value,cls){const n=d.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;}
  function current(){return lingua(d.documentElement.lang||'en');}
  function summary(choice,lang){const t=T[lingua(lang)];if(choice.mode==='own')return t.current+t.keep;if(choice.mode==='recommended')return t.current+t.currentRecommended;return t.current+TASKS.map(task=>t.tasks[task]+' '+(choice.picks[task]==='both'?t.both:NAMES[choice.picks[task]])).join(' · ');}
  function open(lang,snapshot){
    lang=lingua(lang||current());const t=T[lang],saved=read();let view=saved?(saved.mode==='own'?'keep':saved.mode):'recommended',draft=normalize(saved||{mode:'recommended'});const seen=el('p',observation(snapshot?.usage?.sessions||[],lang,!!snapshot?.example),'summary-note teach-observed');
    const intro=el('p',t.intro,'summary-note'),promise=el('p',t.promise,'summary-note teach-promise'),box=el('div',undefined,'teach'),choices=el('div',undefined,'teach-options'),detail=el('div',undefined,'teach-custom'),block=el('pre','','teach-block'),status=el('p','','summary-note teach-status'),copy=el('button',t.copy,'teach-copy');
    choices.setAttribute('role','radiogroup');choices.setAttribute('aria-label',t.who);block.tabIndex=0;block.setAttribute('aria-label',t.title);status.setAttribute('role','status');status.setAttribute('aria-live','polite');copy.type='button';
    function option(key,label,note,tag){const b=el('button',undefined,'teach-option');b.type='button';b.dataset.option=key;b.setAttribute('role','radio');const head=el('span',label,'teach-option-label');if(tag)head.append(el('span',tag,'teach-tag'));b.append(head,el('span',note,'teach-option-note'));b.onclick=()=>{view=key;draft={...draft,mode:key==='keep'?'own':key};write(draft);status.textContent=t.saved;draw();};return b;}
    function draw(){
      for(const b of choices.querySelectorAll('.teach-option')){const on=b.dataset.option===view;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;}
      detail.hidden=view!=='custom';detail.replaceChildren();const own=view==='keep';seen.hidden=!own;for(const n of [block,copy,intro,promise])n.hidden=own;
      if(view==='custom'){for(const task of TASKS){const row=el('div',undefined,'teach-task'),pick=el('div',undefined,'teach-picks');pick.setAttribute('role','radiogroup');pick.setAttribute('aria-label',t.tasks[task]);row.append(el('strong',t.tasks[task],'teach-task-name'),pick);for(const value of PICKS){const b=el('button',value==='both'?t.both:NAMES[value],'teach-pick');b.type='button';b.dataset.family=value;b.setAttribute('role','radio');b.setAttribute('aria-checked',String(draft.picks[task]===value));b.onclick=()=>{draft={...draft,mode:'custom',picks:{...draft.picks,[task]:value}};write(draft);status.textContent=t.saved;draw();};pick.append(b);}for(const family of ['claude','codex']){const note=el('p',undefined,'teach-note');note.dataset.family=family;note.append(el('b',NAMES[family]+': '),d.createTextNode(t.notes[family][task]));row.append(note);}detail.append(row);}detail.append(el('p',t.signature,'summary-note teach-signature'));}
      block.textContent=own?'':text(draft,lang);
    }
    choices.append(option('keep',t.keep,t.keepNote),option('custom',t.custom,t.customNote),option('recommended',t.recommended,t.recommendedNote,t.recommendedTag));
    copy.onclick=async()=>{try{await root.navigator.clipboard.writeText(block.textContent);status.textContent=t.copied;}catch{const range=d.createRange();range.selectNodeContents(block);const selection=root.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent=t.select;}};
    box.append(el('h3',t.who,'teach-who'),choices,seen,detail,intro,block,copy,status,promise,el('p',t.folder,'summary-note'));
    draw();root.panelDrawer(t.title,[box]);
  }
  function card(host,lang){
    if(!host)return null;lang=lingua(lang||current());const t=T[lang];let box=host.querySelector(':scope > .teach-card');
    if(!box){box=el('section',undefined,'teach-card');const b=el('button','','teach-open');b.type='button';box.append(el('h2','','teach-title'),el('p','','teach-copytext'),b);host.prepend(box);}
    box.querySelector('.teach-title').textContent=t.title;box.querySelector('.teach-copytext').textContent=t.card;const b=box.querySelector('.teach-open');b.textContent=t.button;b.onclick=()=>open(lang,root.PanelV2?.state?.()?.snapshot);return box;
  }
  root.PanelTeach=Object.freeze({...api,open,card,read});
})(typeof window==='object'?window:globalThis);
