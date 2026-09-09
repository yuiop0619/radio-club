(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('bbs'), path: 'bbs.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('bbs.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'bbs.html' });

})();
