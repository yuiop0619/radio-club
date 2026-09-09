function memoryRepo(){
  let data=new Map(),chain=Promise.resolve();
  return {
    atomic(fn){const next=chain.then(async()=>{const tx=new Map(structuredClone([...data]));const result=await fn(tx);data=tx;return result;});chain=next.catch(()=>{});return next;},
    async get(tx,c,id){return structuredClone((tx||data).get(c+':'+id)||null);},
    async set(tx,c,id,v){(tx||data).set(c+':'+id,structuredClone(v));},
    async list(c,n){return [...data].filter(([k])=>k.startsWith(c+':')).map(([,v])=>structuredClone(v)).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,n);},
    snapshot(){return structuredClone([...data]);}
  };
}
module.exports={memoryRepo};
