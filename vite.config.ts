import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import monkey, { cdn } from 'vite-plugin-monkey';
import path from 'node:path'
import { readFileSync } from 'node:fs';


// https://vitejs.dev/config/
export default defineConfig({

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    vue(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: '抖音净化 paaroll 修复版',
        author: 'wan-kong (original); paaroll (fork maintenance)',
        copyright: 'wan-kong and contributors; 2026 paaroll (fork modifications)',
        license: "MIT",
        homepageURL: 'https://github.com/paaroll/fuck-douyin_paarollfix',
        supportURL: 'https://github.com/paaroll/fuck-douyin_paarollfix',
        description: '净化抖音网页版：屏蔽全屏送礼栏，失焦时隐藏直播控制栏，适合副屏观看',
        icon: 'https://lf1-cdn-tos.bytegoofy.com/goofy/ies/douyin_web/public/favicon.ico',
        namespace: 'https://github.com/paaroll/fuck-douyin_paarollfix',
        downloadURL: 'none',
        updateURL: 'none',
        match: [
          'https://douyin.com/*',
          'https://www.douyin.com/*',
          'https://*.douyin.com/*',
          'https://live.douyin.com/*',
        ],
        'run-at': 'document-idle',
      },
      build: {
        fileName: 'douyin-paarollfix.user.js',
        externalGlobals: {
          vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js'),
        },
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        banner: `/*!\n${readFileSync(new URL('./LICENSE', import.meta.url), 'utf8')}*/`,
      },
    },
  },
});
