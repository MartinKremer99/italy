import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: '.',
  // '/' for Vercel & custom domain; relative asset URLs still work in dist
  base: process.env.VERCEL ? '/' : './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [{ src: 'data/route.geojson', dest: 'data' }],
    }),
  ],
  server: {
    open: true,
  },
});
