import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  esbuildOptions(options) {
    options.alias = {
      '@': './src',
      '@rules': './src/rules',
      '@visual': './src/visual',
      '@utils': './src/utils',
      '@analysis': './src/analysis',
      '@fixers': './src/fixers'
    };
  }
});
