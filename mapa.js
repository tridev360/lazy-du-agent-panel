(function (scope) {
  'use strict';
  const SLEEP_AFTER = 30 * 60 * 1000;
  const WORDS = {
    en: {none:'Nothing moving',sleep:'Resting',wait:'Your move',work:'Working',next:'Next',done:'Done',live:'Live',ready:'Ready',review:'In review',paused:'Paused',unknown:'Unread',deadline:'Deadline',more:'more',map:'Live work map',phase:'Recorded phase'},
    pt: {none:'Nada andando',sleep:'Descansando',wait:'Sua vez',work:'Em andamento',next:'Próximo',done:'Feito',live:'No ar',ready:'Pronto',review:'Em revisão',paused:'Parado',unknown:'Não lido',deadline:'Prazo',more:'mais',map:'Mapa do trabalho ao vivo',phase:'Fase registrada'},
    es: {none:'Nada en marcha',sleep:'Descansando',wait:'Tu turno',work:'En marcha',next:'Siguiente',done:'Listo',live:'Publicado',ready:'Preparado',review:'En revisión',paused:'Pausado',unknown:'Sin leer',deadline:'Plazo',more:'más',map:'Mapa del trabajo en vivo',phase:'Fase registrada'}
  };
  const ACTIVE = new Set(['pegou','peguei','andando','working','in_progress']);
  const DONE = new Set(['feito','noar','done','complete','completed','live']);
  function executor(item) {
    const value = String(item.executor || item.actor || '').toLowerCase();
    if (value.includes('codex')) return 'codex';
    if (value.includes('claude') || /^(atendimento|assistente|cortes|content|loja|games|coordenacao)$/.test(value)) return 'claude';
    return null;
  }
  function status(item) {return String(item.status || item.phase?.key || '').toLowerCase();}
  function completed(item) {return item.percent === 100 || item.phase?.percent === 100 || DONE.has(status(item));}
  function active(item) {return !completed(item) && (ACTIVE.has(status(item)) || item.phase?.key === 'andando');}
  function signature(item) {return [status(item),item.percent ?? item.phase?.percent ?? '?',item.needsOwner?'wait':''].join('|');}
  function timestamp(value) {const result=Date.parse(value);return Number.isFinite(result)?result:null;}
  function countdown(value, now = Date.now()) {
    const target=timestamp(value);if(target===null)return '?';
    const remaining=Math.max(0,target-now),hours=Math.floor(remaining/3600000),minutes=Math.floor(remaining%3600000/60000);
    return hours>=24?Math.floor(hours/24)+'d '+String(hours%24).padStart(2,'0')+'h':hours+'h '+String(minutes).padStart(2,'0')+'m';
  }
  function capacity(width) {return width<430?3:width<650?4:width<920?6:8;}
  function visibleItems(items, currentId, width) {
    const count=capacity(width),index=Math.max(0,items.findIndex(item=>item.id===currentId));
    const start=Math.max(0,Math.min(items.length-count,index-Math.min(2,Math.floor(count/3))));
    return {items:items.slice(start,start+count),before:start,after:Math.max(0,items.length-start-count)};
  }
  function selectCurrent(items, activity, previous, changes) {
    const recorded=items.find(item=>item.id===activity?.activeId && !completed(item));
    if(recorded)return recorded;
    const newlyTaken=items.find(item=>changes.has(item.id) && active(item));
    if(newlyTaken)return newlyTaken;
    const old=items.find(item=>item.id===previous?.currentId);
    if(old && !completed(old) && (active(old)||old.needsOwner))return old;
    const working=items.find(active);if(working)return working;
    if(old && completed(old)) {
      const next=items.slice(items.indexOf(old)+1).find(item=>!completed(item));
      if(next)return next;
    }
    return items.find(item=>item.needsOwner&&!completed(item)) || items.find(item=>!completed(item)) || items.at(-1) || null;
  }
  function model(snapshot, previous = null, now = Date.now(), width = 1100) {
    const items=(snapshot.pipelineItems||[]).filter(item=>item && typeof item.id==='string');
    const signatures=new Map(items.map(item=>[item.id,signature(item)])),changes=new Set(),freshDone=new Set();
    if(previous)for(const item of items) {
      if(previous.signatures.has(item.id) && previous.signatures.get(item.id)!==signatures.get(item.id)) {
        changes.add(item.id);if(completed(item)&&!previous.done.has(item.id))freshDone.add(item.id);
      } else if(!previous.signatures.has(item.id)&&active(item))changes.add(item.id);
    }
    const lanes={};
    for(const who of ['claude','codex']) {
      const list=items.filter(item=>executor(item)===who),activity=snapshot.activity?.[who],old=previous?.lanes[who];
      const current=selectCurrent(list,activity,old,changes),currentId=current?.id||null;
      const laneChanged=list.some(item=>changes.has(item.id));
      const dated=list.map(item=>timestamp(item.lastChangeAt||item.lastLogAt)).filter(Number.isFinite);
      const lastChangeAt=timestamp(activity?.lastChangeAt) ?? (laneChanged?now:old?.lastChangeAt??(dated.length?Math.max(...dated):now));
      const waiting=Boolean(activity?.waiting || current?.needsOwner || (snapshot.cards||[]).some(card=>!card.exemplo && !card.respondido && executor({executor:card.executor,actor:card.sessao})===who));
      const sleeping=!waiting && (activity?.sleeping===true || (lastChangeAt!==null&&now-lastChangeAt>=SLEEP_AFTER) || !list.length);
      lanes[who]={who,items:list,current,currentId,lastChangeAt,waiting,sleeping,activeCount:activity?.activeCount??list.filter(active).length,move:Boolean(previous && old?.currentId && old.currentId!==currentId),changed:laneChanged,visible:visibleItems(list,currentId,width)};
    }
    return {lanes,signatures,changes,freshDone,done:new Set(items.filter(completed).map(item=>item.id)),now,width};
  }
  function wave(t,width) {const inset=width<650?36:74;return {x:inset+(Math.max(inset*2,width)-inset*2)*t,y:84+Math.sin(t*Math.PI*2-0.35)*12};}
  function path(width,to=1) {
    const points=[];for(let i=0;i<=32;i++){const p=wave(to*i/32,width);points.push((i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2));}return points.join(' ');
  }
  function positions(items,width) {
    return items.map((item,index)=>({...wave(items.length===1?.5:index/Math.max(1,items.length-1),width),item,t:items.length===1?.5:index/Math.max(1,items.length-1)}));
  }
  function labelLayout(points,width) {
    const step=points.length>1?points[1].x-points[0].x:width-72;
    return points.map(point=>{
      const labelWidth=Math.max(50,Math.min(140,step-14,point.x*2-8,(width-point.x)*2-8)),center=Math.max(labelWidth/2+4,Math.min(width-labelWidth/2-4,point.x));
      return {width:labelWidth,offset:center-point.x,left:center-labelWidth/2,right:center+labelWidth/2};
    });
  }
  function stateLabel(item, words) {
    if(!item)return words.none;if(item.needsOwner&&!completed(item))return words.wait;
    const value=status(item);if(value==='noar'||value==='live')return words.live;if(completed(item))return words.done;if(active(item))return words.work;
    if(['commit','pronto','liberado'].includes(value)||item.percent===60||item.percent===90)return words.ready;
    if(['revisao','revisada'].includes(value)||item.percent===80)return words.review;
    if(['parado','paused','blocked'].includes(value))return words.paused;
    return Number.isFinite(item.percent??item.phase?.percent)?words.next:words.unknown;
  }
  const controllers=new WeakMap();
  function html(tag,className,text) {const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function svg(tag,attributes={}) {const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;}
  function createLane(host,who) {
    const section=html('section','pm-lane pm-'+who),meta=html('div','pm-lane-meta'),identity=html('div','pm-identity'),name=html('span','pm-name',who==='claude'?'Claude':'Codex'),current=html('strong','pm-current'),state=html('span','pm-state');
    identity.append(name,current);meta.append(identity,state);
    const rail=html('div','pm-rail'),drawing=svg('svg',{'aria-hidden':'true',class:'pm-trails',preserveAspectRatio:'none'}),trail=svg('path',{class:'pm-trail'}),lit=svg('path',{class:'pm-trail-lit'}),points=html('div','pm-points'),agente=html('div','pm-agente'),body=html('div','pm-agente-body'),picture=html('img'),badge=html('span','pm-agente-badge'),question=html('span','pm-question','?'),sleep=html('span','pm-sleep');
    picture.src='./agente.png';picture.alt='';picture.width=58;picture.height=58;picture.draggable=false;
    badge.textContent=who==='claude'?'C':'X';sleep.append(html('i',undefined,'z'),html('i',undefined,'z'),html('i',undefined,'z'));
    body.append(picture,badge,question,sleep);agente.append(body);drawing.append(trail,lit);rail.append(drawing,points,agente);section.append(meta,rail);host.append(section);
    return {section,current,state,rail,drawing,trail,lit,points,agente,body,nodes:new Map(),position:null,motion:null};
  }
  function createPoint(item,controller) {
    const button=html('button','pm-point');button.type='button';button.dataset.id=item.id;
    const dot=html('span','pm-dot'),check=svg('svg',{viewBox:'0 0 16 16','aria-hidden':'true'});check.append(svg('path',{d:'M4 8l3 3 5-6'}));dot.append(check);
    button.append(dot,html('span','pm-point-title'),html('span','pm-point-phase'),html('span','pm-point-deadline'));
    button.addEventListener('click',()=>{const selected=controller.snapshot.pipelineItems.find(value=>value.id===button.dataset.id);if(selected)controller.options.onSelect?.(selected);});return button;
  }
  function moveAvatar(lane,target,shouldMove,controller) {
    const previous=lane.position;
    if(previous&&!shouldMove&&Math.abs(previous.x-target.x)<.1&&Math.abs(previous.y-target.y)<.1)return;
    lane.motion?.cancel();lane.position=target;
    const end='translate('+target.x.toFixed(2)+'px,'+target.y.toFixed(2)+'px)';lane.agente.style.transform=end;
    if(!shouldMove||!previous||controller.reduced||document.documentElement.dataset.motion==='off'||document.hidden||controller.paused)return;
    const dx=target.x-previous.x,dy=target.y-previous.y,distance=Math.hypot(dx,dy),duration=Math.min(1400,Math.max(600,distance*3.2));
    if(distance<2)return;
    lane.motion=lane.agente.animate([
      {transform:'translate('+previous.x+'px,'+previous.y+'px) rotate(0deg)',offset:0},
      {transform:'translate('+(previous.x+dx*.45)+'px,'+(previous.y+dy*.45-22)+'px) rotate('+(dx<0?-5:5)+'deg)',offset:.45},
      {transform:end+' rotate(0deg)',offset:1}
    ],{duration,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  function paint(controller,animate=true) {
    const {host,snapshot,options}=controller,lang=WORDS[options.lang]?options.lang:'en',words=WORDS[lang],width=Math.max(240,Math.floor(host.clientWidth||controller.width||1000));
    const next=model(snapshot,controller.model,Date.now(),width);if(!animate){next.freshDone.clear();for(const lane of Object.values(next.lanes))lane.move=false;}host.setAttribute('aria-label',words.map);host.classList.toggle('pm-paused',controller.paused||document.hidden);
    for(const who of ['claude','codex']) {
      const data=next.lanes[who],lane=controller.lanes[who];lane.current.textContent=data.current?.title||words.none;
      lane.state.textContent=data.waiting?words.wait:data.sleeping?words.sleep:(data.activeCount>1?data.activeCount+' '+words.work.toLowerCase():stateLabel(data.current,words));
      lane.section.classList.toggle('pm-is-sleeping',data.sleeping);lane.section.classList.toggle('pm-is-waiting',data.waiting);lane.agente.hidden=!data.items.length;
      const railWidth=Math.max(240,lane.rail.clientWidth||width-40),points=positions(data.visible.items,railWidth),current=points.find(point=>point.item.id===data.currentId)||points[0];
      lane.drawing.setAttribute('viewBox','0 0 '+railWidth+' 155');lane.trail.setAttribute('d',path(railWidth));lane.lit.setAttribute('d',path(railWidth,current?.t??0));
      const wanted=new Set(points.map(point=>point.item.id));for(const [id,button]of lane.nodes)if(!wanted.has(id)){button.remove();lane.nodes.delete(id);}
      const labels=labelLayout(points,railWidth);
      for(const [pointIndex,point] of points.entries()) {
        const item=point.item;let button=lane.nodes.get(item.id);if(!button){button=createPoint(item,controller);lane.nodes.set(item.id,button);lane.points.append(button);}
        const amount=item.percent??item.phase?.percent,done=completed(item),deadline=Boolean(item.deadlineAt||item.deadlineDay),isCurrent=item.id===data.currentId;
        button.className='pm-point'+(done?' pm-done':'')+(isCurrent?' pm-current-point':'')+(item.needsOwner&&!done?' pm-owner-point':'')+(deadline?' pm-deadline-point':'')+(next.freshDone.has(item.id)&&!controller.reduced?' pm-fresh':'');
        button.style.left=point.x+'px';button.style.top=point.y+'px';button.style.setProperty('--label-width',labels[pointIndex].width+'px');button.style.setProperty('--label-offset',labels[pointIndex].offset+'px');
        const day=item.deadlineDay?item.deadlineDay.slice(5).split('-'):[];
        button.children[1].textContent=item.title;button.children[2].textContent=stateLabel(item,words)+(Number.isFinite(amount)?' · '+amount+'%':' · ?');button.children[3].textContent=deadline?(item.deadlineAt?countdown(item.deadlineAt,next.now):(lang==='en'?day:day.reverse()).join('/')):'';
        button.children[3].hidden=!deadline;
        button.title=item.title+' · '+words.phase+': '+stateLabel(item,words)+(Number.isFinite(amount)?' '+amount+'%':' ?')+(deadline?' · '+words.deadline+' '+(item.deadlineAt||item.deadlineDay):'');button.setAttribute('aria-label',button.title);
        button.setAttribute('aria-current',isCurrent?'step':'false');
      }
      if(current)moveAvatar(lane,current,data.move,controller);
      lane.rail.dataset.before=data.visible.before?'… '+data.visible.before:'';lane.rail.dataset.after=data.visible.after?'+'+data.visible.after:'';
    }
    controller.model=next;controller.width=width;
  }
  function render(host,snapshot,options={}) {
    if(!host||!snapshot)return;
    let controller=controllers.get(host);
    if(!controller) {
      host.replaceChildren();host.className='phase-map';controller={host,snapshot,options,model:null,lanes:{},paused:false,reduced:scope.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true};
      controller.lanes.claude=createLane(host,'claude');controller.lanes.codex=createLane(host,'codex');controllers.set(host,controller);
      controller.visibility=()=>{host.classList.toggle('pm-paused',document.hidden||controller.paused);for(const lane of Object.values(controller.lanes)){if(document.hidden||controller.paused)lane.motion?.pause();else lane.motion?.finish();}};
      document.addEventListener('visibilitychange',controller.visibility);
      if(typeof ResizeObserver!=='undefined'){controller.resize=new ResizeObserver(()=>{if(Math.abs(host.clientWidth-(controller.width||0))>2)paint(controller,false);});controller.resize.observe(host);}
      controller.timer=setInterval(()=>{if(!document.hidden&&!controller.paused&&host.isConnected)paint(controller,false);},30000);
      paint(controller,false);return;
    }
    controller.snapshot=snapshot;controller.options=options;paint(controller);
  }
  function pause(host,paused=true) {const controller=controllers.get(host);if(controller){controller.paused=paused;controller.visibility();}}
  function destroy(host) {const controller=controllers.get(host);if(controller){clearInterval(controller.timer);controller.resize?.disconnect();document.removeEventListener('visibilitychange',controller.visibility);for(const lane of Object.values(controller.lanes))lane.motion?.cancel();controllers.delete(host);}}
  const api={render,pause,destroy,model,executor,completed,signature,countdown,visibleItems,positions,labelLayout,SLEEP_AFTER};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(scope)scope.PainelMapa=api;
})(typeof window!=='undefined'?window:globalThis);
