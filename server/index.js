import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/mouse' });

// Track connected browser clients
const browserClients = new Set();

// Track the OBS script connection
let obsScriptClient = null;

wss.on('connection', (ws, req) => {
  const isSource = req.url?.includes('source=obs');

  if (isSource) {
    // This is the OBS script sending mouse data
    console.log('OBS mouse script connected');
    obsScriptClient = ws;

    ws.on('message', (data) => {
      // Broadcast mouse data to all browser clients
      const message = data.toString();
      for (const client of browserClients) {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      }
    });

    ws.on('close', () => {
      console.log('OBS mouse script disconnected');
      obsScriptClient = null;
    });
  } else {
    // This is a browser client wanting to receive mouse data
    console.log('Browser client connected');
    browserClients.add(ws);

    // Let the client know if OBS script is connected
    ws.send(JSON.stringify({ type: 'status', obsConnected: obsScriptClient !== null }));

    ws.on('close', () => {
      console.log('Browser client disconnected');
      browserClients.delete(ws);
    });
  }
});

// Serve static files from dist/
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/mouse`);
});
