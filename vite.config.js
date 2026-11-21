import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // 엔진(PixiJS)과 게임 코드를 분리: 게임 코드만 난독화해서 성능 손실을 줄인다.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'engine';
        },
      },
    },
  },
});
