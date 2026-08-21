import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ronhwung.github.io',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    environments: {
      astro: {
        optimizeDeps: {
          include: ['picomatch'],
        },
      },
    },
    ssr: {
      optimizeDeps: {
        include: ['picomatch'],
      },
    },
  },
});
