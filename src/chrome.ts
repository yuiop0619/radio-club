/* ============================================================
   chrome.ts — 静态页的统一入口（无 Vue 依赖）

   link / bbs / people 的页面主体仍是静态 HTML（首屏更快，也不需要状态），
   这里只把重复了三遍的「站点框架」收进一处：标题、导航、页脚、开场旁白。
   收完之后这三个页面各自的 assets/js/*-page.js 即可删除。

   注意：模块脚本默认 defer，一定晚于构建期注入的 classic 脚本执行，
   所以 RC.* 在这里已经就绪。
   ============================================================ */
import {rc} from './legacy';

interface PageChrome {
  /** i18n 词条键，用作 document.title 与导航高亮 */
  key: string;
  /** 可选的萨弗兰开场旁白：挂载点 id + 台词 */
  intro?: { mount: string; text: string };
}

const PAGES: Record<string, PageChrome> = {
  'link.html': { key: 'link' },
  'bbs.html': { key: 'bbs' },
  'people.html': {
    key: 'people',
    intro: {
      mount: 'detLine',
      text: '资料上都写了，没什么好补充的。……硬要说的话：我不算命，我只做归纳。牌和墨迹只是让你肯把真话说出来的借口。'
    }
  }
};

const file = (location.pathname.split('/').pop() || 'index.html').replace(/[?#].*$/, '') || 'index.html';
const cfg = PAGES[file];

if (cfg) {
  rc.ui.chrome({ title: rc.i18n.t(cfg.key), path: file });
  const nav = document.getElementById('navMount');
  if (nav) nav.innerHTML = rc.ui.nav(file);
  const foot = document.getElementById('footMount');
  if (foot) foot.innerHTML = rc.ui.siteFoot({ active: file });
  if (cfg.intro) {
    const mount = document.getElementById(cfg.intro.mount);
    if (mount) {
      rc.ui.dialog({
        who: { cn: '萨弗兰', jp: 'サフラン' },
        jp: { cn: '梦侦探', jp: '夢探偵' },
        mount, text: cfg.intro.text, speed: 26
      });
    }
  }
}
