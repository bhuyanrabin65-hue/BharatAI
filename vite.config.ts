import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-check helper to ensure development server does not conflict with existing processes
function processConflictPreCheckPlugin(): Plugin {
  return {
    name: 'process-conflict-precheck',
    async configureServer(server) {
      // Check if another process is holding the target port before binding
      const testSocket = new net.Socket();
      testSocket.setTimeout(300);
      testSocket.once('connect', () => {
        testSocket.destroy();
        console.warn('[Pre-check] Notice: Existing process detected responding on port 3000.');
      });
      testSocket.once('timeout', () => {
        testSocket.destroy();
      });
      testSocket.once('error', () => {
        // Port is free
      });
      testSocket.connect(3000, '127.0.0.1');

      server.httpServer?.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.error('[Pre-check] EADDRINUSE: Port 3000 is occupied by an existing process.');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isHmrDisabled = process.env.DISABLE_HMR === 'true' || env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss(), processConflictPreCheckPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Fixed port 3000
      port: 3000,
      strictPort: true,
      // Fixed host 0.0.0.0 for container and environment compatibility
      host: '0.0.0.0',
      // HMR is correctly toggled based on the DISABLE_HMR environment variable
      hmr: isHmrDisabled ? false : true,
      // Disable file watching when DISABLE_HMR is true to save CPU and avoid reload loops
      watch: isHmrDisabled ? null : {},
    },
  };
});
