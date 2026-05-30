import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/start-call': 'http://localhost:3000',
      '/register-call': 'http://localhost:3000',
      '/calls': 'http://localhost:3000',
      '/webhook': 'http://localhost:3000'
    }
  }
});