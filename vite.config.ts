import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Prevents @vite/client from throwing "Error: WebSocket closed without opened."
 * when running inside a Cloud Run / container proxy with HMR disabled.
 */
function disableViteClientWebSocketPlugin(): Plugin {
  return {
    name: 'disable-vite-client-websocket',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs')) {
        return code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in container environment */'
          )
          .replace(
            'setupForwardConsoleHandler(transport, forwardConsole);',
            '/* Forward console disabled */'
          );
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      disableViteClientWebSocketPlugin(),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true as true,
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
