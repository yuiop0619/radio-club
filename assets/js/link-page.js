(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('link'), path: 'link.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('link.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'link.html' });

})();
