import { defineConfig, type IndexHtmlTransformContext } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readdirSync, cpSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import siteConfig from './site.config.json';

/* 页面脚本清单的唯一来源：site.config.json
   构建期自动注入，HTML 里不再手写 <script src="assets/js/...">。
   新增页面 = 加一个 HTML + 在 site.config.json 里加一行。 */
const PAGES = siteConfig.pages as Record<string, string[]>;

/* 注入点：优先插在「尾部内联脚本」之前（内联脚本可能依赖 RC.*），
   没有内联脚本时才插到 </body> 前。 */
function injectIndex(html: string): number {
  const re = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const after = html.slice(m.index + m[0].length).replace(/<\/body>|<\/html>|\s/gi, '');
    if (!after) return m.index;
  }
  const close = html.search(/<\/body>/i);
  return close === -1 ? html.length : close;
}

function siteScripts() {
  return {
    name: 'inject-site-scripts',
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string, ctx: IndexHtmlTransformContext) {
        const file = basename(ctx.filename || ctx.path || '');
        const list = PAGES[file];
        if (!list || !list.length) return html;
        const tags = list
          .map((n) => `<script src="assets/js/${n}.js?v=${siteConfig.assetVersion}"></script>`)
          .join('\n');
        const at = injectIndex(html);
        return html.slice(0, at) + tags + '\n' + html.slice(at);
      },
    },
  };
}

export default defineConfig({
  plugins: [vue(), siteScripts(), {
    name: 'preserve-legacy-pages',
    closeBundle() {
      for (const dir of ['js', 'css', 'img']) cpSync(`assets/${dir}`, `dist/assets/${dir}`, { recursive: true });
    },
  }],
  base: './',
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8080' } },
  build: { rollupOptions: { input: Object.fromEntries(readdirSync('.').filter(f => f.endsWith('.html')).map(f => [f.slice(0,-5), resolve(f)])) } },
});
