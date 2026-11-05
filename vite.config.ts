import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import type { PreviewServer, ViteDevServer } from 'vite';
import { createApiMiddleware } from './server/http-api';

// Share the application HTTP API between development and preview.
function apiPlugin() {
  const handler = createApiMiddleware();
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(handler);
  };

  return {
    name: 'qualix-api',
    configureServer(server: ViteDevServer) {
      attach(server);
    },
    configurePreviewServer(server: PreviewServer) {
      attach(server);
    },
  };
}

export default defineConfig(() => ({
  plugins: [vue(), apiPlugin()],
}));
