/* Versioned, bounded input shared by storage, forms and imported links. */
(function () {
  'use strict';
  var motifs = ['water','fall','chase','fly','teeth','dead','exam','naked','animal','house','fire','mirror'];
  var masters = ['zhougong','freud','jung','horney','perls','cartwright','vonfranz'];
  var counts = {pentagram:5,timeLine:3,dailyCard:1};
  function obj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0,n).trim() : ''; }
  function num(v, max) { return typeof v === 'number' && Number.isFinite(v) ? Math.max(0,Math.min(v,max)) : 0; }
  function list(v,n) { return Array.isArray(v) ? v.slice(0,n).filter(obj) : []; }
  function pair(v,n) { return obj(v) ? {cn:str(v.cn,n),jp:str(v.jp,n)} : {cn:str(v,n),jp:str(v,n)}; }
  function id() { return 'case-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10); }
  function normalize(input) {
    var c = obj(input) ? input : {};
    var spread = Object.prototype.hasOwnProperty.call(counts,c.tarotSpread) ? c.tarotSpread : 'pentagram';
    var seen = {}, positions = {};
    var birth = str(c.birth,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(Date.parse(birth)) || new Date(birth).toISOString().slice(0,10) !== birth) birth = '';
    return {
      schemaVersion:1, caseId:str(c.caseId,80), handle:str(c.handle,60),age:str(c.age,20),gender:str(c.gender,20),birth:birth,
      category:str(c.category,30),story:str(c.story,4000),dream:str(c.dream,4000),dreamFreq:str(c.dreamFreq,20),
      recurring:str(c.recurring,500),paralysis:c.paralysis === true,
      createdAt:num(c.createdAt,8640000000000000),updatedAt:num(c.updatedAt,8640000000000000),
      tarotSpread:spread,tarotQuestion:['love','work','self','choice'].indexOf(c.tarotQuestion)>=0 ? c.tarotQuestion : '',
      tarot:list(c.tarot,5).filter(function(t){
        if(!Number.isInteger(t.id)||t.id<0||t.id>21||!Number.isInteger(t.pos)||t.pos<0||t.pos>=counts[spread]||typeof t.upright!=='boolean'||seen[t.id]||positions[t.pos]) return false;
        seen[t.id]=positions[t.pos]=true;return true;
      }).map(function(t){return {id:t.id,pos:t.pos,upright:t.upright};}).sort(function(a,b){return a.pos-b.pos;}),
      analystLog:list(c.analystLog,20).filter(function(l){return masters.indexOf(l.m)>=0;}).map(function(l){return {
        m:l.m,dream:str(l.dream,2000),motifs:Array.isArray(l.motifs)?l.motifs.filter(function(k){return motifs.indexOf(k)>=0;}).slice(0,12):[],verdict:pair(l.verdict,2000),ts:num(l.ts,8640000000000000)
      };}),
      assoc:list(c.assoc,12).map(function(a){return {stim:pair(a.stim,40),resp:str(a.resp,200),ms:num(a.ms,600000),interrupted:a.interrupted===true};}),
      sct:list(c.sct,6).map(function(s,i){return {i:i,qCn:str(s.qCn,200),qJp:str(s.qJp,200),a:str(s.a,1000)};})
    };
  }
  function parse(c) {
    if(!obj(c)||!['story','tarot','analystLog','assoc','sct'].some(function(k){return Object.prototype.hasOwnProperty.call(c,k);})) throw Error('无效档案 / Invalid case');
    ['tarot','analystLog','assoc','sct'].forEach(function(k){if(c[k]!==undefined && !Array.isArray(c[k])) throw Error('档案格式有误 / Invalid fields');});
    if(c.schemaVersion!==undefined && c.schemaVersion!==1) throw Error('不支持的档案版本 / Unsupported version');
    return normalize(c);
  }
  function formError(c) {
    if(!str(c.handle,60)) return '请填写称呼 / お名前を入力してください';
    if(!str(c.category,30)) return '请选择类别 / 種類を選んでください';
    if(str(c.story,4000).length<8) return '请至少写 8 个字 / 8文字以上入力してください';
    if(typeof c.story==='string'&&c.story.length>4000) return '正文限 4000 字 / 4000文字以内';
    return '';
  }
  RC.model = {normalize:normalize,parse:parse,id:id,formError:formError,string:str,pair:pair};
})();
