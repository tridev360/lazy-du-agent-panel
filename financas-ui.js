'use strict';
(function(root){
  const V=typeof module==='object'&&module.exports?require('./financas-vista.js'):root.FinanceView;
  function create(doc,host){
    let data=null,lang='pt',destroyed=false,signature='',open=new Set(),last=new Map();
    const w=(pt,en,es)=>lang==='en'?en:lang==='es'?es:pt;
    const locale=()=>lang==='en'?'en-US':lang==='es'?'es-ES':'pt-BR';
    const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
    const money=(value,currency,estimated=false)=>Number.isFinite(value)&&currency?(estimated?'≈ ':'')+new Intl.NumberFormat(locale(),{style:'currency',currency}).format(value/100):'?';
    const stamp=at=>at?new Intl.DateTimeFormat(locale(),{timeZone:'UTC',dateStyle:'short',timeStyle:'short'}).format(new Date(at))+' UTC':'?';
    const day=at=>at?new Intl.DateTimeFormat(locale(),{timeZone:'UTC',dateStyle:'short'}).format(new Date(at+'T12:00:00Z')):'?';
    const notice=el('p','ideias-reading');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    function number(tag,cls,text,key,value){
      const n=el(tag,cls,text),id=lang+'|'+key,prior=last.get(id);last.set(id,value);
      if(Number.isFinite(value)&&Number.isFinite(prior)&&value!==prior)n.classList.add('fi-roll');
      return n;
    }
    function block(title,cls=''){
      const n=el('section','ideias349 fi-section '+cls);n.append(el('h2','',title));host.append(n);return n;
    }
    function reason(code){
      const labels={stale:['Leitura ausente ou antiga. Solução: lance os valores em Salvar dados.','Missing or old reading. Fix: enter the values in Save data.','Lectura ausente o antigua. Solución: registre los valores en Guardar datos.'],missing:['Faltam valores ou fontes.','Missing values or sources.','Faltan valores o fuentes.'],dates:['Faltam datas comparáveis.','Comparable dates are missing.','Faltan fechas comparables.'],scope:['Gasto e entrada sem a mesma base comprovada.','Expense and income lack the same proven basis.','Gasto e ingreso sin la misma base comprobada.'],cost:['Sem gasto comparável.','No comparable expense.','Sin gasto comparable.'],income:['Sem entrada comparável.','No comparable income.','Sin ingreso comparable.']};
      return w(...(labels[code]||labels.missing));
    }
    function source(section){
      section.append(el('p','ideias-reading',w('Fonte: ','Source: ','Fuente: ')+(data.evidence?.source||'?')+' · '+stamp(data.evidence?.at)+' · '+(data.evidence?.at?(Date.parse(data.evidence.at)<=Date.now()?(m=>m<120?m+' min':m<2880?Math.floor(m/60)+' h':Math.floor(m/1440)+' d')(Math.floor((Date.now()-Date.parse(data.evidence.at))/60000)):'? '+w('hora futura','future time','hora futura')):'? '+w('hora não registrada','time not recorded','hora sin registrar'))+(data.evidence?.old?w(' · leitura antiga · ? Solução: lance os valores em Salvar dados',' · old reading · ? Fix: enter the values in Save data',' · lectura antigua · ? Solución: registre los valores en Guardar datos'):'')));
    }
    function comparison(parent,t,currency){
      const row=el('details','fi-comparison');row.append(el('summary','',currency+' · '+w('Sua parte e retorno','Your share and return','Tu parte y retorno')));
      row.append(el('p','',w('Sua parte do saldo: ','Your share of the balance: ','Tu parte del saldo: ')+money(t.owner.balance,currency,t.owner.estimated)),el('p','',w('Seu gasto mensal: ','Your monthly spending: ','Tu gasto mensual: ')+money(t.owner.monthly,currency,t.owner.monthlyEstimated)));
      for(const [label,value,code]of [[w('Entrada / gasto comparáveis','Comparable income / expense','Ingreso / gasto comparables'),t.returnRatio,t.returnReason],[w('Retorno da sua parte','Return on your share','Retorno de tu parte'),t.owner.returnRatio,t.owner.returnReason]])row.append(el('p','',label+': '+(Number.isFinite(value)?value.toFixed(2)+'x':'? · '+reason(code))));
      if(t.balance===null)row.append(el('p','ideia-meta',w('Subtotal conhecido: ','Known subtotal: ','Subtotal conocido: ')+money(t.knownBalance,currency)));
      if(t.monthly===null)row.append(el('p','ideia-meta',w('Mensal conhecido: ','Known monthly: ','Mensual conocido: ')+money(t.knownMonthly,currency)));
      parent.append(row);
    }
    function overview(){
      const section=block(w('Saldo e gasto mensal','Balance and monthly spending','Saldo y gasto mensual'),'fi-overview'),grid=el('div','fi-heroes');section.append(grid);
      for(const currency of ['BRL','USD']){
        const t=data.totalsByCurrency?.[currency],card=el('article','ideia fi-hero');card.append(el('h3','',w('Saldo ','Balance ','Saldo ')+currency),number('strong','fi-hero-number',money(t?.balance,currency,t?.estimated),'balance-'+currency,t?.balance),el('small','fi-caption',w('Saldo registrado','Recorded balance','Saldo registrado')));grid.append(card);
      }
      const monthly=el('article','ideia fi-hero');monthly.append(el('h3','',w('Gasto mensal','Monthly spending','Gasto mensual')));
      for(const currency of data.currencies||[]){const value=data.totalsByCurrency?.[currency]?.monthly,line=el('div','fi-month-line');line.append(el('span','fi-currency',currency),number('strong','fi-hero-number',money(value,currency,data.totalsByCurrency?.[currency]?.monthlyEstimated),'monthly-'+currency,value));monthly.append(line);}
      if(!data.currencies?.length)monthly.append(el('strong','fi-hero-number','?'));
      monthly.append(el('small','fi-caption',w('Recorrências registradas','Recorded recurring expenses','Gastos recurrentes registrados')));grid.append(monthly);
      const account=V.reserve(data.accounts),ai=el('article','ideia fi-hero fi-reserve');const usadoR=account&&Number.isFinite(account.remaining)?100-account.remaining:null;ai.append(el('h3','',w('Crédito da IA, % usado','AI credit, % used','Crédito de IA, % usado')),number('strong','fi-hero-number',usadoR!==null?usadoR+'%':'?','reserve-'+(account?.name||'?'),usadoR),el('small','fi-caption',account?account.name+w(' · a conta com mais folga',' · the account with most room',' · la cuenta con más margen')+(account.old?w(' · leitura antiga · ? Solução: registre uma leitura atual do consumo',' · old reading · ? Fix: record a current usage reading',' · lectura antigua · ? Solución: Coordenador lo lee en la próxima vuelta'):''):w('Sem leitura das contas','No account reading','Sin lectura de las cuentas')));grid.append(ai);
      source(section);const more=el('div','fi-comparisons');for(const currency of data.currencies||[])comparison(more,data.totalsByCurrency[currency],currency);section.append(more);
      if(data.entries?.some(e=>e.estimated))section.append(el('p','fi-caption',w('≈ Valores aproximados na fonte','≈ Approximate source amounts','≈ Valores aproximados en la fuente')));
      if(data.note)section.append(el('p','ideia-meta',data.note));
    }
    function shareLabel(e){return e.share===1?w('100% seu','100% yours','100% tuyo'):e.share===0?w('Pago pelo caixa do projeto','Paid by project funds','Pagado por la caja del proyecto'):e.share===null?'?':e.sharingPeople?'1/'+e.sharingPeople+' '+w('seu','yours','tuyo'):(e.share*100).toFixed(2)+'% '+w('seu','yours','tuyo');}
    function ledger(){
      const section=block(w('Lançamentos','Entries','Movimientos'),'fi-entries');section.append(el('p','fi-caption',w('Clique no item para ver fonte e rateio.','Select an item to see source and sharing.','Selecciona un item para ver fuente y reparto.')));
      const table=el('table','fi-ledger'),caption=el('caption','fi-sr',w('Lançamentos registrados e sua parte','Recorded entries and your share','Movimientos registrados y tu parte'));table.append(caption);
      const labels=[w('Data','Date','Fecha'),w('Item','Item','Item'),w('Categoria','Category','Categoría'),w('Valor','Amount','Valor'),w('Sua parte','Your share','Tu parte')],thead=el('thead'),head=el('tr');
      for(const label of labels){const th=el('th','',label);th.setAttribute('scope','col');head.append(th);}thead.append(head);table.append(thead);const body=el('tbody');table.append(body);section.append(table);
      for(const [i,e]of (data.entries||[]).entries()){
        const row=el('tr','ideia fi-entry'),detailRow=el('tr','fi-detail-row'),cell=el('td','fi-detail-cell'),detail=el('div','fi-detail'),id='fi-detail-'+i;
        row.dataset.entry=e.id;row.dataset.kind=e.kind||'unknown';detailRow.id=id;cell.setAttribute('colspan','5');cell.append(detail);detailRow.append(cell);detailRow.hidden=!open.has(e.id);
        const toggle=el('button','fi-item-button',e.description||'?');toggle.type='button';toggle.dataset.finFocus=e.id;toggle.setAttribute('aria-controls',id);toggle.setAttribute('aria-expanded',String(!detailRow.hidden));
        toggle.addEventListener('click',()=>{detailRow.hidden=!detailRow.hidden;if(detailRow.hidden)open.delete(e.id);else open.add(e.id);toggle.setAttribute('aria-expanded',String(!detailRow.hidden));});
        const item=el('td','fi-item');item.append(toggle,el('span','fi-kind',e.kind==='entrada'?w('Entrada','Income','Ingreso'):e.kind==='gasto'?w('Gasto','Expense','Gasto'):'?'));
        const date=el('td','fi-date',day(e.date)),category=el('td','fi-category');category.append(el('span','fi-chip',e.category||'?'));
        const value=el('td','fi-amount');value.append(number('strong','fi-value',money(e.amountKnown?e.value:null,e.currency,e.estimated),'entry-'+e.id,e.amountKnown?e.value:null));
        const owner=el('td','fi-owner');owner.append(number('strong','fi-value',money(e.amountKnown?e.ownerValue:null,e.currency,e.estimated),'owner-'+e.id,e.amountKnown?e.ownerValue:null),el('small','fi-caption',shareLabel(e)));
        const cells=[date,item,category,value,owner];cells.forEach((c,j)=>{c.dataset.label=labels[j];row.append(c);});
        detail.append(el('p','',w('Fonte: ','Source: ','Fuente: ')+(e.origin||'?')),el('p','',shareLabel(e)+' · '+money(e.amountKnown?e.ownerValue:null,e.currency,e.estimated)));
        if(e.sharingPeople&&e.divisionSource)detail.append(el('p','',w('Rateio: ','Sharing: ','Reparto: ')+e.divisionSource));
        if(e.partOf)detail.append(el('p','',w('Parcela de ','Share of ','Parte de ')+e.partOf+w(', contada uma vez. ', ', counted once. ', ', contado una vez. ')+(e.linkInvalid?w('Vínculo não confirmado.','Unconfirmed link.','Vínculo sin confirmar.'):'')));
        if(e.reinvested!==null)detail.append(el('p','',w('Reinvestimento declarado: ','Declared reinvestment: ','Reinversión declarada: ')+money(e.reinvested,'USD')));
        if(e.note)detail.append(el('p','',e.note));body.append(row,detailRow);
      }
      if(!data.entries?.length)section.append(el('p','fi-empty',data.evidence?.valid&&!data.incomplete?w('Nenhum lançamento registrado.','No recorded entries.','Sin movimientos registrados.'):w('? Sem leitura dos lançamentos.','? No entries reading.','? Sin lectura de movimientos.')));
    }
    function chart(){
      const section=block(w('Gasto por categoria','Spending by category','Gasto por categoría'),'fi-chart-section');section.append(el('p','fi-caption',w('Gastos registrados, separados por moeda. Outros inclui API, domínio e serviços.','Recorded expenses, separated by currency. Other includes API, domain and services.','Gastos registrados, separados por moneda. Otros incluye API, dominio y servicios.')));
      const grid=el('div','fi-chart-grid');section.append(grid);
      for(const group of V.spending(data)){
        const card=el('article','ideia fi-chart');card.append(el('h3','',group.currency));
        // Categoria sem gasto nesta moeda some do cartão; moeda sem gasto nenhum diz isso (nunca três zeros).
        const shown=group.groups.filter(g=>g.count>0);
        if(!shown.length){if(group.complete)card.append(el('p','fi-caption',w('Nenhum gasto registrado nesta moeda.','No expenses recorded in this currency.','Ningún gasto registrado en esta moneda.')));else card.append(el('p','fi-caption',w('? Total por categoria sem fonte completa.','? Category totals lack complete evidence.','? Totales por categoría sin fuente completa.')));grid.append(card);continue;}
        const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 320 '+shown.length*48);svg.setAttribute('role','img');svg.setAttribute('aria-label',group.currency+' · '+w('Gasto registrado por categoria','Recorded spending by category','Gasto registrado por categoría'));
        const summary=[];
        for(const [i,g]of shown.entries()){
          const label=g.name==='outros'?w('Outros','Other','Otros'):g.name,y=16+i*48;
          const node=(tag,attrs,text)=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
          node('text',{x:0,y,class:'fi-chart-label'},label);node('text',{x:320,y,'text-anchor':'end',class:'fi-chart-value'},group.complete?money(g.value,group.currency,g.estimated):'?');
          node('rect',{x:0,y:y+8,width:320,height:8,rx:4,class:'fi-chart-track'});
          if(g.scale!==null)node('rect',{x:0,y:y+8,width:320*g.scale,height:8,rx:4,class:'fi-chart-bar','data-category':g.name});
          summary.push(label+': '+(group.complete?money(g.value,group.currency):'?'));
        }
        const title=doc.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=summary.join('; ');svg.prepend(title);card.append(svg);
        if(!group.complete){card.append(el('p','fi-caption',w('? Total por categoria sem fonte completa.','? Category totals lack complete evidence.','? Totales por categoría sin fuente completa.')));if(group.base)for(const g of shown)card.append(el('p','fi-caption',w('Conhecido em ','Known in ','Conocido en ')+g.name+': '+money(g.value,group.currency,g.estimated)));}
        grid.append(card);
      }
      if(!data.currencies?.length)section.append(el('p','fi-empty',w('? Sem leitura dos gastos.','? No spending reading.','? Sin lectura de gastos.')));
    }
    function bar(parent,scale,label){
      const track=el('div','fi-track im-track');track.dataset.known=String(Number.isFinite(scale));track.setAttribute('role','img');track.setAttribute('aria-label',label);
      const fill=el('span','fi-fill im-fill');if(Number.isFinite(scale)){fill.style.setProperty('--im-scale',String(Math.max(0,Math.min(1,scale))));track.append(fill);}parent.append(track);
    }
    function assets(){
      const section=block(w('Ativos que duram','Lasting assets','Activos que duran'),'fi-assets'),grid=el('div','ideias-grid');section.append(grid);
      for(const [i,a]of (data.assets||[]).entries()){
        const row=el('article','ideia fi-asset');if(a.needsOwner?.length){row.dataset.solucaoAsset=a.name;row.dataset.solucaoFields=a.needsOwner.join(',');row.dataset.solucaoCurrency=a.currency||data.currency;row.dataset.solucaoVersion=data.version;}row.append(el('h3','',a.name),el('p','fi-caption',money(a.value,a.currency)));
        const text=a.remaining===null?'?':a.remaining+' '+w('dias restantes','days remaining','días restantes');row.append(number('strong','fi-asset-days',text,'asset-'+a.name+'-'+i,a.remaining));
        bar(row,a.life,text);if(a.life===null)row.append(el('small','fi-caption',w('? Datas de duração sem fonte completa','? Duration dates lack complete evidence','? Fechas de duración sin fuente completa')));row.append(el('p','fi-caption',day(a.start)+' / '+day(a.end)));
        if(a.expired)row.append(el('span','fi-chip',w('Vencido','Expired','Vencido')));if(a.note)row.append(el('p','fi-caption',a.note));grid.append(row);
      }
      if(!data.assets?.length)section.append(el('p','fi-empty',data.evidence?.valid?w('Nenhum ativo registrado.','No recorded asset.','Sin activos registrados.'):w('? Sem leitura dos ativos.','? No asset reading.','? Sin lectura de activos.')));
    }
    function energy(){
      const section=block(w('Crédito da IA, % usado da semana','AI credit, % used this week','Crédito de IA, % usado de la semana'),'fi-energy-section'),grid=el('div','ideias-grid');section.append(grid);
      for(const a of data.accounts||[]){
        const row=el('article','ideia fi-energy im-energy');row.append(el('h3','',a.name),el('p','fi-caption',a.plan||'?'));
        const usado=Number.isFinite(a.remaining)?100-a.remaining:null,text=usado!==null?usado+'%':'?';row.append(number('strong','im-energy-number',text,'ai-'+a.name,usado),el('span','fi-caption',w('usado (a mesma régua do Agora)','used (same scale as Now)','usado (la misma regla de Ahora)')));
        bar(row,usado!==null?usado/100:null,a.name+': '+text+' '+w('usado','used','usado'));
        row.append(el('small','fi-caption',(a.source||'? '+w('fonte não registrada','source not recorded','fuente sin registrar'))+' · '+w('Leitura: ','Reading: ','Lectura: ')+stamp(a.read)+(a.read?' · '+(Date.parse(a.read)<=Date.now()?Math.floor((Date.now()-Date.parse(a.read))/60000)+' min':'? '+w('hora futura','future time','hora futura')):' · ?')+(a.old?w(' · antiga',' · old',' · antigua'):'')),el('small','fi-caption',w('Zera: ','Resets: ','Reinicia: ')+stamp(a.reset)+(a.expired?w(' · aguarda nova leitura',' · awaiting a new reading',' · espera nueva lectura'):'')));grid.append(row);
      }
      if(!data.accounts?.length)section.append(el('p','fi-empty',w('? Sem leitura das contas.','? No account reading.','? Sin lectura de las cuentas.')));
    }
    function render(){
      const focused=doc.activeElement?.dataset?.finFocus;
      host.replaceChildren();if(data){overview();ledger();chart();assets();energy();}host.append(notice);
      if(focused)for(const button of host.querySelectorAll('.fi-item-button'))if(button.dataset.finFocus===focused){button.focus();break;}
    }
    return {update(value,opts={}){if(destroyed)return;const next=opts.lang||lang,key=JSON.stringify(value)+'|'+next;if(key===signature)return;signature=key;data=value;lang=next;const ids=new Set((data?.entries||[]).map(e=>e.id));open=new Set([...open].filter(id=>ids.has(id)));render();if(last.size>1000)last.clear();},status(text){notice.textContent=text;},destroy(){destroyed=true;open.clear();last.clear();},state(){return {waiting:!data,busy:false};}};
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.FinancePanel=api;
})(typeof globalThis==='object'?globalThis:this);
