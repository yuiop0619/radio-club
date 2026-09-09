'use strict';
const cloudbase=require('@cloudbase/node-sdk');
const {application}=require('./application');
const app=cloudbase.init({env:cloudbase.SYMBOL_CURRENT_ENV});
const db=app.database();
const repo={
  atomic:fn=>db.runTransaction(fn),
  async get(tx,collection,id){
    const res=await (tx||db).collection(collection).doc(id).get();
    return Array.isArray(res.data)?res.data[0]||null:res.data||null;
  },
  set:(tx,collection,id,value)=>(tx||db).collection(collection).doc(id).set(value),
  async list(collection,limit){const res=await db.collection(collection).orderBy('updatedAt','desc').limit(limit).get();return res.data||[];}
};
const handle=application(repo,{isAdmin:uid=>(process.env.RC_ADMIN_UIDS||'').split(',').includes(uid)});
exports.main=async event=>{
  try{return {ok:true,data:await handle(event,app.auth().getUserInfo().uid)};}
  catch(e){return {ok:false,error:/^[A-Z_]+$/.test(e.message)?e.message:'SERVICE_UNAVAILABLE'};}
};
