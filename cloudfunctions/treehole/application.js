'use strict';
const {createHash}=require('node:crypto');
const key=s=>createHash('sha256').update(s).digest('hex');
const {service}=require('./service');
function application(repo,{isAdmin=()=>false,clock=Date.now}={}){
  const hole=service(repo,clock);
  return async function handle(event,uid){
    if(typeof uid!=='string'||!uid)throw Error('AUTH_REQUIRED');
    if(!event||typeof event!=='object')throw Error('INVALID_INPUT');
    const {action}=event,admin=isAdmin(uid);
    if(action==='content:get')return await repo.get(null,'rc_content','site')||{revision:0,items:{},chapters:{}};
    if(action==='content:save'){
      if(!admin)throw Error('FORBIDDEN');
      const menus=['milk','water','coffee','fizz','highball','orange','ramen','steak','sandwich','onigiri'];
      const group=event.group;
      if(!['items','chapters'].includes(group)||!(group==='items'?menus.includes(event.id):/^[1-5]$/.test(event.id)))throw Error('INVALID_INPUT');
      const fields=group==='items'?['cn','jp','desc','descJp','line','lineJp']:['cn','jp'];
      const value={};for(const field of fields){const str=event.value?.[field];if(typeof str!=='string'||str.length>1000)throw Error('INVALID_INPUT');value[field]=str.trim();}
      return repo.atomic(async tx=>{const old=await repo.get(tx,'rc_content','site')||{revision:0,items:{},chapters:{}};if(old.revision!==event.revision)throw Error('VERSION_CONFLICT');old[group][event.id]=value;old.revision++;old.updatedAt=clock();await repo.set(tx,'rc_content','site',old);return old;});
    }
    if(action==='hello')return {protocol:1,uid,isAdmin:admin,features:['profile','moderation']};
    if(action==='profile:get')return await repo.get(null,'rc_profiles',key(uid))||{revision:0,snapshot:null};
    if(action==='profile:save'||action==='profile:delete'){
      if(!Number.isSafeInteger(event.revision)||event.revision<0)throw Error('INVALID_INPUT');
      const snapshot=action==='profile:delete'?null:validateSnapshot(event.snapshot);
      if(action==='profile:save'&&event.consent!==true)throw Error('CONSENT_REQUIRED');
      return repo.atomic(async tx=>{
        const id=key(uid),old=await repo.get(tx,'rc_profiles',id);
        if((old?.revision||0)!==event.revision)throw Error('VERSION_CONFLICT');
        const next={revision:event.revision+1,updatedAt:clock(),snapshot};
        await repo.set(tx,'rc_profiles',id,next);return next;
      });
    }
    if(action==='reports:list'){
      if(!admin)throw Error('FORBIDDEN');
      const reports=await repo.list('rc_reports',100);
      return {reports:await Promise.all(reports.filter(r=>r.status==='pending').map(async r=>{const n=await repo.get(null,'rc_notes',r.noteId);return {id:r.id,noteId:r.noteId,reason:r.reason,body:n?.status==='published'?n.body:'',createdAt:r.createdAt};}))};
    }
    if(action==='reports:resolve'){
      if(!admin)throw Error('FORBIDDEN');
      if(!/^[a-f0-9]{64}$/.test(event.id)||!['dismiss','remove'].includes(event.decision))throw Error('INVALID_INPUT');
      return repo.atomic(async tx=>{
        const r=await repo.get(tx,'rc_reports',event.id);if(!r)throw Error('NOT_FOUND');
        if(r.status!=='pending')return {resolved:true};
        if(event.decision==='remove'){
          const n=await repo.get(tx,'rc_notes',r.noteId);
          if(n){n.status='withdrawn';n.body='';n.sig='';n.replies=[];n.version++;n.updatedAt=clock();await repo.set(tx,'rc_notes',r.noteId,n);}
        }
        r.status=event.decision;r.resolvedAt=clock();r.updatedAt=clock();r.resolvedBy=uid;
        await repo.set(tx,'rc_reports',r.id,r);return {resolved:true};
      });
    }
    return hole(event,uid);
  };
}
function validateSnapshot(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_INPUT');
  const snapshot={};
  for(const field of ['case','counter_v2','archive_v2'])if(Object.hasOwn(value,field)){
    if(!value[field]||typeof value[field]!=='object'||Array.isArray(value[field]))throw Error('INVALID_INPUT');
    snapshot[field]=value[field];
  }
  if(Buffer.byteLength(JSON.stringify(snapshot))>128*1024)throw Error('PAYLOAD_TOO_LARGE');
  return snapshot;
}
module.exports={application,validateSnapshot};
