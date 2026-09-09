(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('people'), path: 'people.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('people.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'people.html' });
RC.ui.dialog({
  who: { cn: '萨弗兰', jp: 'サフラン' },
  jp: { cn: '梦侦探', jp: '夢探偵' },
  mount: document.getElementById('detLine'),
  text: '资料上都写了，没什么好补充的。……硬要说的话：我不算命，我只做归纳。牌和墨迹只是让你肯把真话说出来的借口。',
  speed: 26
});

})();
