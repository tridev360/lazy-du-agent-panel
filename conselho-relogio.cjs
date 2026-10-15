'use strict';
const N=require('./pc-cards/cards-nucleo.cjs');
async function horaGetDate(){const h=await N.horaGetDate(),ahead=Date.parse(h)-Date.now();if(ahead>1000)throw Error('clock');if(ahead>0)await new Promise(resolve=>setTimeout(resolve,ahead+2));return h;}
module.exports={horaGetDate};
