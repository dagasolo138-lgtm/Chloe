import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

function copyVendorFiles() {
  return {
    name: 'copy-vendor-files',
    closeBundle() {
      const source = resolve('src/vendor/purify.min.js');
      const target = resolve('dist/src/vendor/purify.min.js');
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    },
  };
}

export default defineConfig({
  base: '/Chloe/',
  plugins: [copyVendorFiles()],
  build: {
    outDir: 'dist',
  },
});
