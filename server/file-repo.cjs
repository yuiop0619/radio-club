'use strict';
const fs=require('node:fs'),path=require('node:path');
// Single-process adapter. A transaction reaches disk before its response is acknowledged.
function fileRepo(directory){
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const file=path.join(directory,'radio.json');
  let data=new Map(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[]),chain=Promise.resolve();
  return {
    atomic(fn){const next=chain.then(async()=>{
      const tx=new Map(structuredClone([...data]));const result=await fn(tx);
      const tmp=file+'.tmp';const fd=fs.openSync(tmp,'w',0o600);
      try{fs.writeFileSync(fd,JSON.stringify([...tx]));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      fs.renameSync(tmp,file);data=tx;return result;
    });chain=next.catch(()=>{});return next;},
    async get(tx,c,id){return structuredClone((tx||data).get(c+':'+id)||null);},
    async set(tx,c,id,value){if(!tx)throw Error('TRANSACTION_REQUIRED');tx.set(c+':'+id,structuredClone(value));},
    async list(c,n){return [...data].filter(([k])=>k.startsWith(c+':')).map(([,v])=>structuredClone(v)).sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0)).slice(0,n);},
  };
}
module.exports={fileRepo};
