'use strict';
// r11: dados de exemplo das abas Decidir e Fila (so ficticio). Chamado no fim do gerar.cjs.
// Radar: placar curado, medidas e custos inventados para os 3 projetos da demo; nada vem do PC nem da rede.
const fs=require('node:fs'),path=require('node:path');
exports.gerar=function({base,root,home}){
  const now=Date.now();
  const brt=(min=0)=>new Date(now-3*3600000+min*60000).toISOString().slice(0,19)+'-03:00';
  function gravar(arq,dados){const file=path.resolve(arq);if(!file.startsWith(path.resolve(base)+path.sep))throw Error('Destino fora de demo');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof dados==='string'?dados:JSON.stringify(dados,null,2)+'\n');}
  radar({root,brt,gravar});
  revisao({root,now,gravar});
  entregas({root,gravar});
  propostasSimples({root,gravar});
  chaves({root,now,gravar});
};

// Fila > Chaves: 5 chaves, uma em cada situacao, cada uma com descricao e motivo proprios (antes: a mesma frase em todas).
function chaves({root,now,gravar}){
  const iso=min=>new Date(now+min*60000).toISOString();
  const t=(id,nome,sessao,estado,descricao,motivo,aspa,min,ligar,desligar,extra={})=>({id,nome,sessao,descricao,estado,motivo,
    chave:{ligada:estado==='ligada',por:'você',quando:iso(min)},aspa:{texto:aspa,exata:false,quando:iso(min-3)},
    aoLigar:{muda:ligar,pros:['Sua escolha fica registrada para o Claude ler'],contras:['Não começa trabalho sozinho']},
    aoDesligar:{muda:desligar,pros:['A tarefa espera sem perder o que já foi feito'],contras:['Não interrompe o que já está rodando']},...extra});
  gravar(path.join(root,'estado','chaves-tasks.json'),{versao:1,atualizado:iso(-3),tasks:[
    t('chave-ugc','Testar 3 criativos UGC','COORDENADOR','ligada','Roda o teste dos três anúncios e anota os cliques simulados de cada um.','Ligada por você; o Claude lê na próxima volta.','Quero ver qual criativo puxa mais antes do fim de semana.',-6,'Registra que o teste dos criativos pode seguir.','Registra que o teste dos criativos pode esperar.'),
    t('chave-legendas','Revisar legendas dos 5 shorts','CORTES','ligada','Confere as legendas dos cortes da semana, palavra por palavra.','Ligada por você; entra depois do roteiro.','Legenda errada no corte é o que mais me incomoda.',-14,'Registra que a revisão das legendas pode seguir.','Registra que a revisão das legendas pode esperar.'),
    t('chave-checkout','Codar o checkout do SaaS','ATENDIMENTO','espera-ele','Monta a escolha do plano e a confirmação da compra no SaaS fictício.','Espera você escolher entre plano mensal e anual.','O checkout tem que ser curto, no máximo duas telas.',-25,'Registra que o checkout pode começar.','Registra que o checkout fica parado.'),
    t('chave-cortes','Cortar o vídeo longo em 5 shorts','CORTES','espera-outra','Separa os cinco melhores trechos do vídeo longo e exporta em formato vertical.','Espera a agenda da semana ficar pronta.','Os shorts saem só depois da agenda montada.',-40,'Registra que os cortes podem começar.','Registra que os cortes ficam para depois.'),
    t('chave-dm','Agente que responde DM em 30 s','ATENDIMENTO','engavetada','Testa uma resposta inicial automática com passagem para uma pessoa.','Engavetada por você até a landing sair.','Deixa o agente de DM para depois da landing.',-90,'Registra que o teste do agente de DM volta para a fila.','Registra que o agente de DM fica guardado.')
  ]});
}

// Conselho: a linha embaixo do titulo diz a proposta com outras palavras (antes repetia o titulo). O hash segue o da ideia.
function propostasSimples({root,gravar}){
  const arq=path.join(root,'estado','ideias','propostas-simples.json');let d;try{d=JSON.parse(fs.readFileSync(arq,'utf8'));}catch{return;}
  const texto={'proposta-1':'Testar dez ganchos novos em cima do anúncio que mais clicou.','proposta-2':'Transformar o vídeo longo em cinco vídeos curtos, cada um com uma ideia.',
    'proposta-3':'Uma resposta automática rápida, com uma pessoa a um clique.','proposta-4':'Publicar um corte por dia, com a legenda revisada na véspera.'};
  for(const p of d.propostas||[])if(texto[p.id])p.o_que_e=texto[p.id];
  gravar(arq,d);
}

// Fila > Projetos: cada projeto com 3 ou mais entregas. As novas nunca dependem de voce e ficam em 60% ou menos (ou prontas),
// para nao trocar o "Dependem de voce" nem as 3 "Mais perto de sair" que a aba Agora mostra.
function entregas({root,gravar}){
  const arq=path.join(root,'estado','entregas.json');let d;try{d=JSON.parse(fs.readFileSync(arq,'utf8'));}catch{return;}
  if(!d||!Array.isArray(d.entregas))return;
  const por=nome=>d.entregas.find(e=>e.projeto===nome)||null,todas=[...new Set(d.entregas.map(e=>e.projeto))];
  const achar=rx=>todas.find(n=>rx.test(n));
  const passo=(nome,peso,feito)=>({nome,peso,feito});
  const plano=[
    [/loja/i,[['Página do drop com fila de espera',[passo('Desenho da fila',2,true),passo('Aviso quando chegar a vez',3,false),passo('Ensaio com visitas simuladas',2,false)]],
      ['Fotos do produto em 3 ângulos',[passo('Fotos tiradas',2,true),passo('Fundo limpo nas 3 fotos',1,true)]],
      ['Cupom de primeira compra',[passo('Regra do cupom',2,true),passo('Campo do cupom no checkout',2,false)]]]],
    [/atendimento/i,[['Respostas prontas para as 10 dúvidas mais comuns',[passo('Lista das dúvidas',2,true),passo('Rascunho das respostas',2,true),passo('Revisão do tom',4,false)]],
      ['Botão de falar com uma pessoa',[passo('Botão na conversa',1,true),passo('Aviso para quem atende',2,true)]],
      ['Relatório semanal das conversas',[passo('Contagem por assunto',1,true),passo('Envio toda segunda',4,false)]]]],
    [/cortes/i,[['Capas novas para os 5 shorts',[passo('Molde da capa',2,true),passo('5 capas prontas',3,false)]],
      ['Roteiro do próximo vídeo longo',[passo('Tema escolhido',1,true),passo('Roteiro escrito',3,false)]],
      ['Legendas em espanhol',[passo('Tradução das legendas',2,true),passo('Revisão de quem fala espanhol',2,false)]]]]
  ];
  const ids=new Set(d.entregas.map(e=>e.id));
  for(const [rx,lista] of plano){const projeto=achar(rx);if(!projeto)continue;const dono=por(projeto)?.dono||'COORDENADOR';
    lista.forEach(([nome,passos],i)=>{const id='entrega-r11-'+projeto.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+(i+1);
      if(!ids.has(id)){ids.add(id);d.entregas.push({id,projeto,nome,dono,passos});}});}
  gravar(arq,d);
}

// Revisao: itens nas categorias com sessao nomeada; o card do criativo entra dentro do item, com as opcoes a vista.
function revisao({root,now,gravar}){
  const item=(id,projeto,titulo,sessao,selo,mudou,espera,extra={})=>({id,projeto,titulo,sessao,selo,mudou,...(espera?{espera}:{}),...extra});
  gravar(path.join(root,'estado','revisao-itens.json'),{versao:1,atualizado:new Date(now-2*60000).toISOString(),por:'Coordenação',itens:[
    item('criativo-vencedor','lancamento','Criativo vencedor do teste UGC','COORDENADOR','sim','Três criativos testados com cliques simulados; o UGC 2 puxou mais.','Escolher uma opção abaixo libera 10 variações do anúncio.',{cards:['escolha-1']}),
    item('landing-saas','lancamento','Landing do SaaS de atendimento','ATENDIMENTO','olho','Título novo, botão de falar com uma pessoa e versão de celular conferida.','Confira a página no celular antes de marcar pronto.'),
    item('resposta-30s','automacao','Resposta automática em até 30 s','ATENDIMENTO','olho','Três respostas prontas e o botão de passar para uma pessoa.','Leia as 3 respostas e diga se o tom combina com a marca.'),
    item('agenda-cortes','criacao','Agenda da semana com 5 shorts','CORTES','pronto','Cinco cortes com legenda revisada, um por dia.',null),
    item('placar-criativos','painel','Placar dos criativos no painel','COORDENADOR','olho','O placar mostra os cliques simulados de cada criativo lado a lado.','Diga se a ordem das colunas ajuda a escolher.')
  ]});
}

function radar({root,brt,gravar}){
  const fonte=[{arquivo:'estado/LANCAMENTO.md',onde:'linha do projeto'}];
  const custo=(credito,horas,servico='nenhum')=>({credito,horas,servico});
  const linha=(id,area,ordem,feature,posicao,alvo,dificuldade,recomendacao,como,pratica,porque,c,extra={})=>({id,area,ordem,feature,curto:feature,concorrente:{Loja:'Loja de referência',SaaS:'Atendimento de referência',Cortes:'Canal de referência'}[area],como,pratica,porque,posicao,alvo,dificuldade,recomendacao,custo:c,fonte,...extra});
  const placar=[
    linha('loja-1-clique','Loja',1,'Compra em 1 clique no drop','PIOR','IGUAL','M','AGORA','Guardar o endereço na primeira compra e pular a etapa do frete.','Botão único na página do drop, com o resumo antes de confirmar.','Metade das desistências simuladas acontece no frete.',custo('baixo','meio dia')),
    linha('saas-30s','SaaS',2,'Primeira resposta em até 30 s','PIOR','MELHOR','P','AGORA','Três respostas prontas e o botão de passar para uma pessoa.','O agente responde a saudação e a dúvida de prazo sozinho.','Quem espera mais de 1 min desiste no teste fictício.',custo('baixo','1 h de agente')),
    linha('cortes-legenda','Cortes',3,'Legenda automática revisada','IGUAL','MELHOR','P','AGORA','Gerar a legenda no corte e revisar só as palavras marcadas.','Cada short sai com legenda conferida na véspera.','A legenda já existe; falta só a revisão em lote.',custo('baixo','1 h de agente')),
    linha('loja-fila','Loja',4,'Fila de espera do drop','PIOR','IGUAL','M','DEPOIS','Abrir a fila 1 h antes e liberar por ordem de chegada.','Página com a posição na fila e aviso quando chegar a vez.','Evita a página cair no pico, mas o drop atual é pequeno.',custo('médio','1 dia')),
    linha('saas-historico','SaaS',5,'Histórico da conversa para o cliente','PIOR','IGUAL','G','DEPOIS','Guardar as conversas e mostrar ao cliente com busca.','Tela do cliente com as últimas conversas e o status.','Pedido frequente nas conversas fictícias, depois do básico.',custo('médio','2 dias'),{depende:'Primeira resposta em até 30 s'}),
    linha('cortes-agenda','Cortes',6,'Agenda da semana pronta','MELHOR',null,'P','DEPOIS','Montar a semana a partir dos cortes já aprovados.','Um corte por dia, com a legenda revisada na véspera.','Já estamos à frente; manter a rotina.',custo('baixo','30 min')),
    linha('ugc-variacoes','Loja',7,'Variações de criativo por IA','SO NOS',null,'P','DEPOIS','Gerar 10 ganchos a partir do criativo que mais clicou.','Mesma arte, só o gancho muda em cada variação.','Ninguém da referência testa variações tão rápido.',custo('baixo','1 h de agente')),
    linha('saas-app','SaaS',8,'App próprio no celular','PIOR',null,'G','NUNCA','Publicar um app nas lojas de aplicativo.','A versão web no celular já resolve o atendimento.','Custa mais do que devolve agora.',custo('alto','2 semanas','loja de aplicativos')),
    linha('cortes-ao-vivo','Cortes',9,'Cortes durante a live','PIOR',null,'G','NUNCA','Cortar e publicar enquanto a live acontece.','Exige alguém dedicado durante toda a transmissão.','O canal não faz live; não vale o esforço.',custo('alto','1 semana'))
  ];
  const medida=(id,nome,tipo,valor,min,janela,extra={})=>({id,nome,tipo,valor,quando:brt(min),janela,fonte,...extra});
  const medidas=[
    medida('atendimento-fila','Fila de mensagens do agente de atendimento','medido','~1.240 mensagens por dia, 96% respondidas em até 30 s',-40,'últimas 24 h',{destaque:{titulo:'Agente de atendimento',valor:'~1.240',unidade:'mensagens por dia na fila de DMs'}}),
    medida('cortes-render','Render dos cortes no PC','medido','10 cortes em 38 min, nenhuma falha',-95,'rodada de hoje'),
    medida('loja-pico','Página do drop no pico','estimado','~3.800 visitas na primeira hora, sem queda no ensaio',-300,'ensaio de ontem'),
    medida('ugc-cliques','Teste dos 3 criativos UGC','medido','UGC 2 com 2,1 vezes os cliques do UGC 1 (cliques simulados)',-180,'3 dias de teste')
  ];
  const custosExtra=[
    {id:'plano-ia',nome:'Plano de IA, 2 contas',valorMes:600,nota:'valor inventado para a demonstração',tipo:'registro fictício (aprox.)',fonte:'demo'},
    {id:'hospedagem',nome:'Hospedagem do SaaS',valorMes:120,tipo:'registro fictício (aprox.)',fonte:'demo'},
    {id:'editor-video',nome:'Editor de vídeo dos cortes',valorMes:80,tipo:'registro fictício (aprox.)',fonte:'demo'}
  ];
  gravar(path.join(root,'radar-fontes.json'),{versao:1,curadoEm:brt(0),curadoPor:'Coordenação',regra:'Cada linha diz de onde veio; números inventados para a demonstração.',
    escalaCusto:{P:'até 1 h de agente',M:'meio dia a 1 dia',G:'2 dias ou mais'},placar,medidas,semMedida:[],custosExtra});
}
