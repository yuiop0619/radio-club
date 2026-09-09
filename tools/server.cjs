const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
function createServer(onRequest=()=>{}){
  return http.createServer((req,res)=>{
    onRequest(req.url);
    try{
      let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(name==='/')name='/index.html';
      const file=path.resolve(ROOT,'.'+name);
      const rel=path.relative(ROOT,file).replace(/\\/g,'/');
      const allowed=/^[\w-]+\.html$/.test(rel)||rel==='favicon.ico'||/^assets\/(?:js|css|img)\/[\w.-]+$/.test(rel);
      if(!file.startsWith(ROOT+path.sep)||!allowed||!fs.existsSync(file)){res.writeHead(404);res.end('Not found');return;}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
      res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
      res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
    }catch{res.writeHead(400);res.end('Bad request');}
  });
}
if(require.main===module){const port=Number(process.env.PORT||8080);createServer().listen(port,'127.0.0.1',()=>console.log('RADIO CLUB: http://127.0.0.1:'+port));}
module.exports={createServer};
