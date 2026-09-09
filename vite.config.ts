import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readdirSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [vue(), {
    name: 'preserve-legacy-pages',
    closeBundle() {
      for (const dir of ['js', 'css', 'img']) cpSync(`assets/${dir}`, `dist/assets/${dir}`, { recursive: true });
    },
  }],
  base: './',
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8080' } },
  build: { rollupOptions: { input: Object.fromEntries(readdirSync('.').filter(f => f.endsWith('.html')).map(f => [f.slice(0,-5), resolve(f)])) } },
});
