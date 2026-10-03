(function(root){
 'use strict';
 const WORDS={
  "en": {
    "title": "What the panel solves",
    "lines": [
      "Took on too much and got lost? See the Claude Code and Codex sessions on this computer side by side, in one place.",
      "Can't remember who started what? Team shows who started each session and the helpers of each one.",
      "Lost track of an agent? The timeline shows the tools it used and its last activity.",
      "Left a session open and forgot? Team separates sessions with recent activity from paused and finished ones.",
      "Want to know where things stand right now? WEN opens the current summary in six lines.",
      "Spent more than you thought? Usage shows this week's and today's tokens and how much credit has been used.",
      "Everything stays on your computer. No account, no key, and it reads only metadata, never your conversations."
    ]
  },
  "pt": {
    "title": "O que o painel resolve",
    "lines": [
      "Pegou trabalho demais e se perdeu? Veja as sessões do Claude Code e do Codex deste computador lado a lado, num lugar só.",
      "Não lembra quem começou o quê? A Equipe mostra quem começou cada sessão e os ajudantes de cada uma.",
      "Perdeu o fio de um agente? A linha do tempo mostra as ferramentas que ele usou e a última atividade.",
      "Esqueceu uma sessão aberta? A Equipe separa as sessões com atividade recente das que estão em pausa ou concluídas.",
      "Quer saber como está tudo agora? O WEN abre o resumo atual em seis linhas.",
      "Gastou mais do que achava? O Consumo mostra os tokens da semana e de hoje e quanto do crédito já foi usado.",
      "Tudo fica no seu computador. Sem conta, sem chave, e ele lê só metadados, nunca as suas conversas."
    ]
  },
  "es": {
    "title": "Lo que resuelve el panel",
    "lines": [
      "¿Aceptaste demasiado trabajo y te perdiste? Ve las sesiones de Claude Code y Codex de este ordenador lado a lado, en un solo lugar.",
      "¿No recuerdas quién empezó qué? Equipo muestra quién empezó cada sesión y los ayudantes de cada una.",
      "¿Perdiste el hilo de un agente? La línea de tiempo muestra las herramientas que usó y su última actividad.",
      "¿Olvidaste una sesión abierta? Equipo separa las sesiones con actividad reciente de las que están en pausa o terminadas.",
      "¿Quieres saber cómo va todo ahora? WEN abre el resumen actual en seis líneas.",
      "¿Gastaste más de lo que pensabas? Uso muestra los tokens de la semana y de hoy y cuánto crédito se ha usado.",
      "Todo queda en tu ordenador. Sin cuenta, sin clave, y solo lee metadatos, nunca tus conversaciones."
    ]
  }
};
 const lingua=value=>Object.hasOwn(WORDS,value)?value:'en';
 if(typeof module==='object'&&module.exports)module.exports={WORDS,lingua};
 if(!root.document)return;
 function mount(){const d=root.document,host=d.getElementById('view-home');if(!host)return;let box=d.getElementById('panel-solves');
  if(!box){box=d.createElement('section');box.id='panel-solves';box.className='home-card resolve211';const title=d.createElement('h2');title.id='panel-solves-title';box.setAttribute('aria-labelledby',title.id);box.append(title,d.createElement('ul'));host.append(box);}
  function draw(){const copy=WORDS[lingua(d.documentElement.lang)];box.querySelector('h2').textContent=copy.title;const list=box.querySelector('ul');list.replaceChildren(...copy.lines.map(line=>{const li=d.createElement('li');li.textContent=line;return li;}));}
  draw();new MutationObserver(draw).observe(d.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 if(root.document.readyState==='loading')root.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis==='object'?globalThis:this);
