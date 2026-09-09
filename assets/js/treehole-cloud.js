(function(){
  'use strict';
  var config=window.RC_CLOUD_CONFIG||{},app,uid='',running=null;
  var api={ready:false};
  function local(path,data){return fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Radio-Client':'1'},body:JSON.stringify(data),credentials:'same-origin'}).then(function(r){return r.json();}).then(function(r){if(!r.ok)throw Error(r.error||'SERVICE_UNAVAILABLE');return r.data;});}
  function call(data){if(config.transport==='local')return local('rpc',data);return app.callFunction({name:config.functionName||'treehole',data:data}).then(function(r){var result=r.result;if(typeof result==='string')result=JSON.parse(result);if(!result||!result.ok)throw Error(result&&result.error||'SERVICE_UNAVAILABLE');return result.data;});}
  function sdk(){
    if(window.cloudbase)return Promise.resolve();
    return new Promise(function(resolve,reject){var s=document.createElement('script');s.src='https://static.cloudbase.net/cloudbase-js-sdk/2.7.1/cloudbase.full.js';s.onload=resolve;s.onerror=function(){s.remove();reject(Error('SDK_UNAVAILABLE'));};document.head.appendChild(s);});
  }
  api.connect=function(){
    if(!config.enabled||(!config.env&&config.transport!=='local'))return Promise.reject(Error('公开树洞尚未配置 / Public service not configured'));
    if(api.ready)return Promise.resolve();
    if(config.transport==='local')return local('session',{}).then(function(){return call({action:'hello'});}).then(function(r){uid=r.uid;api.ready=true;});
    return sdk().then(async function(){app=window.cloudbase.init({env:config.env});var auth=app.auth({persistence:'local'});if(auth.getLoginState && await auth.getLoginState())return;return auth.signInAnonymously?auth.signInAnonymously():auth.anonymousAuthProvider().signIn();})
      .then(function(){return call({action:'hello'});}).then(function(r){if(r.protocol!==1||!r.uid)throw Error('INCOMPATIBLE_SERVICE');uid=r.uid;api.ready=true;});
  };
  function queue(){var q=RC.store.get('hole_queue',[]);return Array.isArray(q)?q:[];}
  api.flush=function(){
    if(running)return running;
    if(!api.ready)return Promise.reject(Error('请先连接公开树洞 / Connect first'));
    running=(async function(){
      var op;
      while((op=queue()[0])){
        if(op.uid!==uid)throw Error('待同步记录属于另一身份 / Different author identity');
        var result=await call(op.data);
        if(api.onResult)api.onResult(result,op.data.action);
        if(!RC.store.set('hole_queue',queue().filter(function(x){return x.data.operationId!==op.data.operationId;})))throw Error('LOCAL_SAVE_FAILED');
      }
    })().finally(function(){running=null;});return running;
  };
  api.mutate=function(action,id,fields){
    if(!api.ready)return Promise.reject(Error('请先连接公开树洞 / Connect first'));
    var data=Object.assign({},fields,{action:action,id:id,operationId:'op-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)});
    var q=queue();if(q.length>=100)return Promise.reject(Error('待同步操作过多 / Too many pending operations'));
    q.push({uid:uid,data:data});if(!RC.store.set('hole_queue',q))return Promise.reject(Error('LOCAL_SAVE_FAILED'));
    return api.flush();
  };
  api.pull=async function(known){
    if(!api.ready)throw Error('NOT_CONNECTED');
    var all=[],ids=known||[];
    for(var i=0;i<Math.max(1,ids.length);i+=80){var r=await call({action:'list',known:ids.slice(i,i+80)});all=all.concat(r.notes||[]);}
    return all;
  };
  api.pending=function(){return queue().length;};
  api.cancelPending=function(){if(running)throw Error('操作正在发送，请等待完成 / Wait for the active request');return RC.store.set('hole_queue',[]);};
  api.request=function(data){if(!api.ready)return Promise.reject(Error('NOT_CONNECTED'));return call(data);};
  RC.cloud=api;
})();
