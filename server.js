/**
 * ColdCallReps custom Next.js server.
 * Hosts the xAI Realtime WebSocket bridge on /api/trainer/realtime.
 * Bind 0.0.0.0:$PORT for Render / container deploys.
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');
const { handleTrainerRealtime } = require('./trainer-realtime-bridge');

const { loadEnvConfig } = require('@next/env');
const dev = process.env.NODE_ENV !== 'production';
loadEnvConfig(process.cwd(), dev);

const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on('error', (err) => console.error('[WSS]', err));

  const originalEmit = server.emit.bind(server);
  server.emit = function (event, ...args) {
    if (event === 'upgrade') {
      const [req, socket, head] = args;
      const { pathname } = parse(req.url || '/', true);
      if (pathname === '/api/trainer/realtime') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          console.log('[Trainer Realtime] Browser connected');
          handleTrainerRealtime(ws, port, WebSocket);
        });
        return true;
      }
    }
    return originalEmit(event, ...args);
  };

  server.listen(port, hostname, () => {
    console.log(`🔥 ColdCallReps ready on http://${hostname}:${port}`);
    console.log(`🎯 Trainer realtime on /api/trainer/realtime`);
  });
});
