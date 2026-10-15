'use strict';
function example(kind,now=new Date()) {
 const stamp=new Date(now).toISOString(),day=stamp.slice(0,10);
 const data={cards:{id:'decidir-filtro',sessao:'Claude',criado:stamp,tipo:'decisao',pergunta:'Qual filtro fazemos primeiro?',opcoes:[{label:'Por projeto',descricao:'Ajuda a ver o trabalho de cada projeto.',recomendada:true},{label:'Por data',descricao:'Ajuda a conferir o que mudou hoje.'}],respondido:''},cronograma:{atualizado:stamp,hoje:[{id:'rever-bot',o_que:'Conferir testes do bot',quem:'claude',projeto:'Bot de exemplo',dia:day,estado:'na fila'}],semana:[],geral:[]},entregas:{atualizadoEm:stamp,entregas:[{id:'bot-exemplo',nome:'Limites do bot',projeto:'Bot de exemplo',dono:'Claude',passos:[{nome:'Teste que falha',peso:1,feito:true},{nome:'Correção e teste verde',peso:2,feito:false},{nome:'Você decide o próximo passo',peso:1,feito:false,dependeDele:true}]}]},ideias:{t:'ideia',id:'I-'+day.replaceAll('-','')+'-0900-C1',hora:new Date(new Date(now).getTime()-3*3600000).toISOString().slice(0,-1)+'-03:00',autor:'claude',tipo:'feature',projeto:'bot-exemplo',esforco:'P',titulo:'Filtros por projeto',porque:'Encontrar o trabalho de cada projeto.',como:'Separar as sessões pelo projeto.',ganho:'Responder mais rápido.'}};
 return data[kind]||null;
}
module.exports={example};
