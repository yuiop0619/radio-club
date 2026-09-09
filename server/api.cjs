'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {application}=require('../cloudfunctions/treehole/application');
const hash=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
function createApi(repo,{origin,adminIds=[],clock=Date.now}={}){
  const handle=application(repo,{isAdmin:uid=>adminIds.includes(uid),clock}),rates=new Map();
  let requests=0,errors=0;
  return async function api(req,res){
    requests++;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
    try{
      if(req.url==='/api/health'&&req.method==='GET')return send(200,{ok:true,service:'radio-club',storage:'persistent',uptime:Math.floor(process.uptime())});
      if(req.url==='/api/content'&&req.method==='GET')return send(200,{ok:true,data:await handle({action:'content:get'},'public-reader')});
      if(req.method!=='POST')return send(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
      const expected=origin||'http://'+req.headers.host;
      if(req.headers.origin!==expected||req.headers['x-radio-client']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return send(403,{ok:false,error:'ORIGIN_REJECTED'});
      const now=clock(),ip=req.socket.remoteAddress||'local';
      for(const [key,v] of rates)if(now-v.start>60000)rates.delete(key);
      const rate=rates.get(ip)||{start:now,n:0};if(++rate.n>180)throw Error('RATE_LIMIT');rates.set(ip,rate);
      let chunks=[],size=0;
      for await(const chunk of req){size+=chunk.length;if(size>160*1024)throw Error('PAYLOAD_TOO_LARGE');chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('INVALID_INPUT');}
      if(!body||typeof body!=='object'||Array.isArray(body))throw Error('INVALID_INPUT');
      const cookie=/\brc_session=([\w-]{43})\b/.exec(req.headers.cookie||'')?.[1];
      const session=cookie?await repo.get(null,'rc_sessions',hash(cookie)):null;
      let uid=session&&session.expires>now?session.uid:null;
      async function setSession(user){
        const value=token();await repo.atomic(tx=>repo.set(tx,'rc_sessions',hash(value),{uid:user,expires:now+30*86400000}));
        res.setHeader('Set-Cookie',`rc_session=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=2592000${expected.startsWith('https:')?'; Secure':''}`);
      }
      if(req.url==='/api/session'){
        if(!uid){uid='guest-'+randomBytes(16).toString('hex');await setSession(uid);}
        return send(200,{ok:true,data:{uid,isAdmin:adminIds.includes(uid)}});
      }
      if(req.url==='/api/recover'){
        if(typeof body.code!=='string'||!/^rc-[\w-]{43}$/.test(body.code))throw Error('INVALID_RECOVERY');
        const record=await repo.get(null,'rc_recovery',hash(body.code));if(!record)throw Error('INVALID_RECOVERY');
        const user=await repo.get(null,'rc_users',record.uid);if(user?.recoveryHash!==hash(body.code))throw Error('INVALID_RECOVERY');
        await setSession(record.uid);return send(200,{ok:true,data:{uid:record.uid}});
      }
      if(!uid)return send(401,{ok:false,error:'AUTH_REQUIRED'});
      if(req.url==='/api/recovery'){
        const code='rc-'+token();await repo.atomic(async tx=>{await repo.set(tx,'rc_recovery',hash(code),{uid,createdAt:now});await repo.set(tx,'rc_users',uid,{recoveryHash:hash(code)});});return send(200,{ok:true,data:{code}});
      }
      if(req.url==='/api/logout'){if(cookie)await repo.atomic(tx=>repo.set(tx,'rc_sessions',hash(cookie),{uid,expires:0}));res.setHeader('Set-Cookie','rc_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');return send(200,{ok:true,data:{}});}
      if(req.url==='/api/metrics'){if(!adminIds.includes(uid))throw Error('FORBIDDEN');return send(200,{ok:true,data:{requests,errors}});}
      if(req.url!=='/api/rpc')return send(404,{ok:false,error:'NOT_FOUND'});
      return send(200,{ok:true,data:await handle(body,uid)});
    }catch(e){errors++;const error=/^[A-Z_]+$/.test(e.message)?e.message:'SERVICE_UNAVAILABLE';send(error==='RATE_LIMIT'?429:error==='FORBIDDEN'?403:error==='VERSION_CONFLICT'?409:400,{ok:false,error});}
  };
}
module.exports={createApi};
