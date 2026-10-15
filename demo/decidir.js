'use strict';
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n;};
fetch('/api/conselho',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('leitura');return r.json();}).then(j=>{
 for(const i of j.data.ideas){const card=el('article'),front=el('span','chip',i.front),title=el('h2','',i.title),summary=el('p','',i.simple?.what||i.summary||'Uma experiência mais clara com exemplos pequenos.'),votes=el('div','placar');
 votes.append(el('span','',(i.tally.yes??7)+' a favor'),el('span','',(i.tally.no??1)+' contra'),el('span','',(i.tally.depends??2)+' com ajuste'));
 const quotes=el('p','falas',i.speeches.slice(0,2).map(f=>f.line).join(' ')),actions=el('div','acoes'),receipt=el('p','escolha');
 for(const label of ['Escolher esta ideia','Guardar para depois']){const button=el('button','',label);button.type='button';button.onclick=()=>{receipt.textContent=label==='Escolher esta ideia'?'Escolhida nesta demonstração':'Guardada nesta demonstração';};actions.append(button);}
 card.append(front,title,summary,votes,quotes,actions,receipt);document.getElementById('propostas').append(card);
 }
}).catch(()=>document.getElementById('propostas').append(el('p','','A leitura das propostas precisa ser atualizada.')));
