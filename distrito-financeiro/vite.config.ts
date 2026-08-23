import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: true,
      proxy: {
        '/api': {
          target: environment.API_PROXY_TARGET || 'http://127.0.0.1:8787',
        },
      },
    },
  };
});
