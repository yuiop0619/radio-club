(function () {
  'use strict';
  var LIMIT=80000;
  function encode(value) {
    var bytes=new TextEncoder().encode(JSON.stringify(value));
    if(bytes.length>LIMIT*0.7) throw Error('内容过长，请分享摘要 / Share a shorter summary');
    var bin='';bytes.forEach(function(b){bin+=String.fromCharCode(b);});
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function decode(value) {
    if(value.length>LIMIT||!/^[-_a-zA-Z0-9]+$/.test(value)) throw Error('分享链接无效或过长 / Invalid link');
    var s=value.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(s),function(c){return c.charCodeAt(0);})));
  }
  function read(key) {
    var query=new URLSearchParams(location.search), hash=new URLSearchParams(location.hash.slice(1));
    var value=hash.get(key), legacy=query.has(key);
    if(value===null&&!legacy) return null;
    try { history.replaceState(null,'',location.pathname); } catch(e) { location.hash=''; }
    if(legacy) throw Error('旧查询链接已停止读取：原始请求可能已包含资料。请发送者重新生成摘要链接。 / Please request a new private-fragment link.');
    return decode(value);
  }
  function link(key,value) {
    if(location.protocol==='file:') throw Error('本地文件地址不能分享，请从已部署的网站生成链接。 / Use the hosted website to share.');
    return location.origin+location.pathname+'#'+key+'='+encode(value);
  }
  function copy(text) {
    if(!navigator.clipboard||!navigator.clipboard.writeText) return Promise.reject(Error('clipboard unavailable'));
    return navigator.clipboard.writeText(text);
  }
  RC.share={encode:encode,decode:decode,read:read,link:link,copy:copy};
})();
