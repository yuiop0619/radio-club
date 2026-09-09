'use strict';
const {createHash}=require('node:crypto');
const key=s=>createHash('sha256').update(s).digest('hex');
function text(v,n,required=false){if(typeof v!=='string'||v.length>n||(required&&!v.trim()))throw Error('INVALID_INPUT');return v.trim();}
function validId(v){if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(v))throw Error('INVALID_ID');return v;}
function publicNote(n,uid){
  return {id:n.id,status:n.status,version:n.version,ts:n.ts,updatedAt:n.updatedAt,mine:n.owner===uid,
    codeCn:n.codeCn,codeJp:n.codeCn,sig:n.sig,bodyCn:n.status==='published'?n.body:'',bodyJp:n.status==='published'?n.body:'',
    mood:n.mood,lights:n.lights,lit:(n.reactors||[]).includes(key(uid)),replies:n.status==='published'?(n.replies||[]):[]};
}
// Repository adapter exposes atomic(tx), get(tx, collection, id), set and list.
function service(repo,clock=Date.now){
  return async function handle(event,uid){
    if(typeof uid!=='string'||!uid)throw Error('AUTH_REQUIRED');
    if(!event||typeof event!=='object')throw Error('INVALID_INPUT');
    const {action}=event;
    if(action==='hello')return {protocol:1,uid};
    if(action==='list'){
      const notes=await repo.list('rc_notes',80);
      const known=Array.isArray(event.known)?event.known.slice(0,80):[];
      const seen=new Set(notes.map(n=>n.id));
      for(const id of known){validId(id);if(!seen.has(id)){const n=await repo.get(null,'rc_notes',id);if(n)notes.push(n);}}
      return {notes:notes.map(n=>publicNote(n,uid))};
    }
    if(!['publish','reply','light','withdraw','report'].includes(action))throw Error('INVALID_ACTION');
    const id=validId(event.id),op=validId(event.operationId),opId=key(uid+':'+op);
    return repo.atomic(async tx=>{
      const prior=await repo.get(tx,'rc_operations',opId);
      if(prior){
        if(prior.result.reportId)return prior.result;
        const current=await repo.get(tx,'rc_notes',prior.result.noteId);
        if(!current)throw Error('NOT_FOUND');
        return {note:publicNote(current,uid)};
      }
      const now=clock(),rateId=key(uid),rate=await repo.get(tx,'rc_limits',rateId);
      const count=rate&&now-rate.start<60000?rate.count:0;
      if(count>=20)throw Error('RATE_LIMIT');
      let n=await repo.get(tx,'rc_notes',id),result;
      if(action==='publish'){
        if(n)throw Error('ALREADY_EXISTS');
        const mood=['tired','angry','miss','awake','lost','calm'].includes(event.mood)?event.mood:'calm';
        n={id,owner:uid,body:text(event.body,140,true),sig:text(event.sig||'',16),codeCn:'访客 '+key(uid).slice(0,6),mood,status:'published',ts:now,updatedAt:now,version:1,lights:0,reactors:[],replies:[]};
      }else{
        if(!n)throw Error('NOT_FOUND');
        if(action==='withdraw'){
          if(n.owner!==uid)throw Error('FORBIDDEN');
          n.status='withdrawn';n.body='';n.sig='';n.replies=[];
        }else{
          if(n.status!=='published')throw Error('WITHDRAWN');
          if(action==='reply'){
            if(n.replies.length>=200)throw Error('REPLY_LIMIT');
            const reply={id:opId,code:{cn:'访客 '+key(uid).slice(0,6),jp:'訪問者 '+key(uid).slice(0,6)},who:'user',body:{cn:text(event.body,140,true),jp:text(event.body,140,true)},ts:now};
            n.replies.push(reply);
          }else if(action==='light'){
            const actor=key(uid);
            if(!n.reactors.includes(actor)){if(n.reactors.length>=1000)throw Error('REACTION_LIMIT');n.reactors.push(actor);n.lights=n.reactors.length;}
          }else if(action==='report'){
            const reportId=key(uid+':'+id);
            await repo.set(tx,'rc_reports',reportId,{id:reportId,noteId:id,reporter:uid,reason:text(event.reason||'用户举报',200),status:'pending',createdAt:now});
            result={reportId};
          }
        }
        n.version++;n.updatedAt=now;
      }
      await repo.set(tx,'rc_notes',id,n);
      result=result||{note:publicNote(n,uid)};
      await repo.set(tx,'rc_limits',rateId,{start:count?rate.start:now,count:count+1});
      await repo.set(tx,'rc_operations',opId,{result:result.reportId?result:{noteId:id},createdAt:now});
      return result;
    });
  };
}
module.exports={service};
