'use strict';
// Author messages: a public JSON file in the panel repository, fetched only when the person asks.
// The request is a plain GET with no identifier, cookie or local data.
const NEWS_URL='https://raw.githubusercontent.com/tridev360/lazy-du-agent-panel/main/news.json';
const LANGS=['en','pt','es'];
const LONG_DASH_OR_TAG=new RegExp('['+String.fromCharCode(0x2013,0x2014)+'<>]');
function words(value,max){
  if(typeof value==='string')value={en:value};
  if(!value||typeof value!=='object')return null;
  const out={};for(const lang of LANGS){const s=value[lang];if(typeof s==='string'&&s.trim()&&s.length<=max&&!LONG_DASH_OR_TAG.test(s))out[lang]=s.trim();}
  return out.en?out:null;
}
function cleanNews(json){
  const list=Array.isArray(json)?json:Array.isArray(json?.items)?json.items:[];
  const out=[];
  for(const item of list){
    if(out.length>=20)break;
    const id=typeof item?.id==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(item.id)?item.id:null,date=typeof item?.date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(item.date)&&Number.isFinite(Date.parse(item.date))?item.date.slice(0,10):null,title=words(item?.title,120),text=words(item?.text,400);
    let link=null;if(typeof item?.link==='string'&&item.link.length<=300){try{const u=new URL(item.link);if(u.protocol==='https:')link=u.href;}catch{}}
    if(id&&date&&title&&!out.some(x=>x.id===id))out.push({id,date,title,text:text||null,link});
  }
  return out;
}
function createNews({fetcher=typeof fetch==='function'?fetch:null,timeoutMs=5000,maxBytes=65536,cacheMs=600000,now=()=>Date.now()}={}){
  let cache=null;
  return async function read(){
    if(cache&&now()-cache.at<cacheMs)return cache.body;
    if(typeof fetcher!=='function')return {ok:false};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetcher(NEWS_URL,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!response||!response.ok)return {ok:false};
      const text=await response.text();
      if(typeof text!=='string'||Buffer.byteLength(text)>maxBytes)return {ok:false};
      const body={ok:true,items:cleanNews(JSON.parse(text)),fetchedAt:new Date(now()).toISOString(),source:NEWS_URL};
      cache={at:now(),body};return body;
    }catch{return {ok:false};}
    finally{clearTimeout(timer);}
  };
}
module.exports={NEWS_URL,cleanNews,createNews};
