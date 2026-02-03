import { defineConfig } from 'vite';
import { overlayFontsPlugin } from '@blorkfield/overlay-core/vite';
import type { WebSocketServer } from 'ws';

// WebSocket handling for mouse data (shared between dev and prod)
function setupMouseWebSocket(wss: WebSocketServer) {
  const browserClients = new Set<import('ws').WebSocket>();
  let obsScriptClient: import('ws').WebSocket | null = null;

  wss.on('connection', (ws, req) => {
    const isSource = req.url?.includes('source=obs');

    if (isSource) {
      console.log('OBS mouse script connected');
      obsScriptClient = ws;

      ws.on('message', (data) => {
        const message = data.toString();
        for (const client of browserClients) {
          if (client.readyState === 1) {
            client.send(message);
          }
        }
      });

      ws.on('close', () => {
        console.log('OBS mouse script disconnected');
        obsScriptClient = null;
      });
    } else {
      console.log('Browser client connected');
      browserClients.add(ws);
      ws.send(JSON.stringify({ type: 'status', obsConnected: obsScriptClient !== null }));

      ws.on('close', () => {
        console.log('Browser client disconnected');
        browserClients.delete(ws);
      });
    }
  });
}

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  plugins: [
    overlayFontsPlugin(),
    {
      name: 'mouse-websocket',
      configureServer(server) {
        import('ws').then(({ WebSocketServer }) => {
          const wss = new WebSocketServer({ noServer: true });
          setupMouseWebSocket(wss);

          server.httpServer!.on('upgrade', (request, socket, head) => {
            const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
            if (pathname === '/mouse') {
              wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
              });
            }
            // Let Vite handle other upgrades (HMR)
          });

          console.log('Mouse WebSocket ready at ws://localhost:5173/mouse');
        });
      }
    }
  ]
});
