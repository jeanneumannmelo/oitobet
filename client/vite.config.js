import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/__/': { target: 'https://oitobet-brasil.firebaseapp.com', changeOrigin: true },
    },
  },
  build: {
    outDir: '../dist',
  },
});
