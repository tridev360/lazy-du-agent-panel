'use strict';
// r11: dados de exemplo da aba Agora e da Caixa (so ficticio). Chamado no fim do gerar.cjs.
// Meu andamento (3 projetos com faixa HOJE), Lançamentos (lista à mão com hora e previsão no gerador de projetos) e Finanças (lançamentos inventados).
const fs=require('node:fs'),path=require('node:path');
exports.gerar=function({root}){
 const now=Date.now(),iso=(min=0)=>new Date(now+min*60000).toISOString();
 const brt=(min=0)=>new Date(now-3*3600000+min*60000);
 const dia=(dias=0)=>brt(dias*1440).toISOString().slice(0,10),hora=(min=0)=>brt(min).toISOString().slice(11,16);
 const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 const diaMes=(min=0)=>{const d=brt(min);return d.getUTCDate()+' de '+MESES[d.getUTCMonth()];};
 // hora marcada em BRT (dias a partir de hoje, "HH:MM") como carimbo ISO
 const marcada=(dias,hm)=>new Date(Date.parse(dia(dias)+'T'+hm+':00-03:00')).toISOString();
 const ler=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
 const gravar=(rel,v)=>{const f=path.resolve(root,rel);if(!f.startsWith(root+path.sep))throw Error('Destino fora de demo');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');};

 // ---------- Meu andamento ----------
 const passos=(feitos,total,voce=-1)=>Array.from({length:total},(_,i)=>i<feitos?{f:true}:i===voce?{f:false,d:true}:{f:false});
 const cartao=(titulo,longa,curta,estado,pct,feitos,total,extra={})=>({titulo,longa,curta,estado,horasNaFrente:extra.horas||0,destaque:!!extra.destaque,desenho:{tipo:'passos',estado,pct,passos:passos(feitos,total,extra.voce)}});
 const projetos=[
  {id:'projeto-d',titulo:'Loja de drop',sub:'Criativos UGC e o drop da semana',marco:'o drop de sexta',
   cartoes:[cartao('Teste de 3 criativos UGC','Três anúncios feitos por IA rodando com cliques simulados.','espera você escolher o vencedor','voce',72,3,4,{voce:3,destaque:true}),cartao('Página do drop','Fotos, preço e texto da página conferidos no celular.','pronta hoje às '+hora(-40),'pronta',100,4,4),cartao('10 variações do vencedor','Saem depois da sua escolha, a partir do arquivo que já existe.','começa depois da escolha','obra',10,0,5,{horas:3})],
   trilha:[{estado:'feito',texto:'3 criativos gerados por IA'},{estado:'feito',texto:'Página do drop conferida'},{estado:'voce',texto:'Escolher o criativo vencedor'},{estado:'falta',texto:'10 variações do vencedor'}]},
  {id:'projeto-a',titulo:'SaaS de agente de atendimento',sub:'Landing, checkout e o agente de DM',marco:'o checkout no ar',
   cartoes:[cartao('Checkout do SaaS','Seleção de plano e confirmação em construção.','em obra desde as '+hora(-90),'obra',48,2,5,{horas:2.5}),cartao('Revisão da landing','Texto e versão de celular em conferência.','quase lá: falta o rodapé','quase',86,6,7)],
   trilha:[{estado:'feito',texto:'Deploy da landing (simulado)'},{estado:'rodando',texto:'Checkout em construção'},{estado:'falta',texto:'Agente que responde DM em 30 s'}]},
  {id:'projeto-c',titulo:'Canal de cortes sem rosto',sub:'Roteiros, legendas e a agenda da semana',marco:'a semana publicada',
   cartoes:[cartao('Roteiro de 10 cortes','Dez roteiros curtos sobre organização e IA.','pronto ontem','pronta',100,10,10),cartao('Legendas e agenda','Legendas revisadas e um corte por dia na agenda.','77%: falta publicar os 5 shorts','obra',77,7,9,{horas:2})],
   trilha:[{estado:'feito',texto:'Roteiro de 10 cortes'},{estado:'feito',texto:'Legendas prontas'},{estado:'falta',texto:'Publicar os 5 shorts'}]}
 ];
 gravar('estado/meu-andamento.json',{ok:true,titulo:'Meu andamento',resumo:'Seus três projetos fictícios num lugar só.',atualizado:iso(-1),horas:{entregas:hora(-1),agora:hora(-3)},proxima:{texto:diaMes(14)+', '+hora(14)},
  chips:['1 escolha espera você: o criativo vencedor','2 entregas saem hoje','Mais perto de sair: Revisão da landing (86%)'],ocultosTotal:2,ocultosTipos:['nome de cliente','valor de contrato'],fora:0,
  marcos:[{titulo:'Primeira interface revisada',estado:'feito',resumo:'O formulário tem confirmação e mensagem de resultado.',em:iso(-600)}],projetos,
  diario:[{quando:'Hoje, '+hora(-40),itens:['Página do drop conferida no celular','Revisor entrou na landing em paralelo']},{quando:'Ontem',itens:['Roteiro de 10 cortes pronto','Deploy da landing (simulado)']}]});

 // ---------- Lançamentos: lista à mão com hora e dia ----------
 const itens=[
  {id:'estreia-drop',dia:dia(0),hora:'10:00',o_que:'Página do drop no ar',sessao:'COORDENADOR',estado:'em revisao',depende:'Conferir as fotos no celular'},
  {id:'escolha-criativo',dia:dia(0),hora:'11:30',o_que:'Escolher o criativo vencedor',sessao:'COORDENADOR',estado:'espera voce',depende:'Sua escolha entre os 3 criativos'},
  {id:'checkout',dia:dia(0),hora:'16:30',o_que:'Checkout do SaaS em teste',sessao:'ATENDIMENTO',estado:'em obra',depende:'Revisor terminar a landing'},
  {id:'shorts',dia:dia(1),hora:'09:15',o_que:'Publicar os 5 shorts',sessao:'CORTES',estado:'falta card',depende:'Legendas revisadas na véspera'},
  {id:'variacoes',dia:dia(1),hora:'14:00',o_que:'10 variações do criativo vencedor',sessao:'COORDENADOR',estado:'em obra',depende:'Escolher o criativo vencedor'},
  {id:'agente-dm',dia:dia(2),hora:'10:00',o_que:'Agente que responde DM em 30 s',sessao:'ATENDIMENTO',estado:'em obra',depende:'Checkout no ar'}
 ].map(i=>({...i,prazo_duro:false}));
 gravar('estado/lancamentos.json',{fuso:'BRT',atualizado:iso(-1),itens});

 // ---------- Gerador de projetos: previsão e o que falta nas tarefas abertas (a etapa fica como estava) ----------
 const rel='casa/ferramentas/painel-projetos/projetos.json',P=ler(rel);
 const previsoes={'Testar 3 criativos UGC feitos por IA':[0,'11:30','Escolher o vencedor entre os 3'],'Codar o checkout do SaaS':[0,'16:30','Confirmação de pagamento simulada'],'Revisor conferindo a landing':[0,'10:00','Rodapé no celular'],'Escolher o criativo vencedor':[0,'11:30','Sua escolha'],'Cortar o vídeo longo em 5 shorts':[1,'09:15','Legendas revisadas na véspera'],'Fazer 10 variações do criativo que mais clicou':[1,'14:00','Escolher o criativo vencedor'],'Testar agente que responde DM em 30 s':[2,'10:00','Checkout no ar']};
 // o revisor da landing esta em revisao (selo "em revisão" no Lançamentos, como no painel de origem)
 for(const p of P.projetos)for(const f of p.features){if(f.nome==='Revisor conferindo a landing')f.etapa='REVISAO';const v=previsoes[f.nome];if(!v||f.etapa==='NO AR')continue;f.prazo={previsto:true,para:marcada(v[0],v[1]),texto:(v[0]===0?'hoje ':v[0]===1?'amanhã ':diaMes(v[0]*1440)+' ')+v[1],vencido:false};f.falta={texto:v[2]};}
 P.geradoEm=iso(-1);gravar(rel,P);

 // ---------- Consumo: resets livres do Codex no formato que o leitor lê (campo available) ----------
 {let r={};try{r=ler('estado/uso-codex-resets.json');}catch{r={};}const n=Number.isSafeInteger(r.available)?r.available:Number.isSafeInteger(r.resetsAvailable)?r.resetsAvailable:3;gravar('estado/uso-codex-resets.json',{...r,updated:iso(-1),available:n});}

 // ---------- Finanças: lançamentos inventados, em BRL e USD ----------
 const L=(id,descricao,dias,tipo,categoria,recorrencia,valor,usd)=>({id,descricao,data:dia(dias),tipo,categoria,recorrencia,fonte:'Registro fictício da demo',...(usd?{valor_usd:valor}:{valor,moeda:'BRL'}),parte_do_dono:1});
 gravar('estado/financas.json',{moeda:'BRL',atualizadoEm:iso(-1),nota:'Valores inventados para a demonstração.',lancamentos:[
  L('venda-drop','Vendas do drop da semana',-2,'entrada','venda','unico',1890),
  L('assinaturas-saas','Assinaturas do SaaS (teste)',-3,'entrada','venda','mensal',290,true),
  L('api-voz','Créditos de API de voz',-4,'gasto','API','unico',15,true),
  L('legendas','Ferramenta de legendas',-6,'gasto','servico','mensal',39),
  L('hospedagem','Hospedagem da landing',-9,'gasto','infra','mensal',45),
  L('plano-codex','Plano do Codex',-11,'gasto','IA','mensal',20,true),
  L('plano-ia','Plano de IA da equipe',-12,'gasto','IA','mensal',550),
  L('dominio','Domínio da loja',-30,'gasto','dominio','anual',40)
 ],ativos:[],ia:[]});
};
