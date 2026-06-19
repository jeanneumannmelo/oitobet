import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { GameRoom } from './GameRoom.js';
import paymentRoutes from './payment/routes.js';
import { registerWebhook, getAccountBalance } from './payment/cartwaveClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const http = createServer(app);
const ALLOWED_ORIGINS = [
  'https://oitobet.com.br',
  'https://www.oitobet.com.br',
  'http://localhost:5173',
  'http://localhost:4173',
  /^http:\/\/192\.168\./,  // rede local para testes
];
const io = new Server(http, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ['websocket', 'polling'],
});

// Capture raw body for HMAC webhook verification via express.json verify hook
// Temp diagnostics — mounted before all routes so static serving doesn't catch them
app.get('/_diag/ip', async (_req, res) => {
  try {
    const { ProxyAgent, fetch: undiciFetch } = await import('undici');
    const fixieUrl = process.env.FIXIE_URL;
    const agent = fixieUrl ? new ProxyAgent(fixieUrl) : null;
    const r = agent
      ? await undiciFetch('https://api.ipify.org?format=json', { dispatcher: agent })
      : await fetch('https://api.ipify.org?format=json');
    res.json({ ...(await r.json()), via_fixie: !!agent, fixie_configured: !!fixieUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/_diag/cartwave', async (_req, res) => {
  try {
    const balance = await getAccountBalance();
    res.json({ ok: true, balance });
  } catch (e) { res.status(502).json({ ok: false, error: e.message }); }
});
app.get('/_diag/pix', async (_req, res) => {
  const { ProxyAgent, fetch: undiciFetch } = await import('undici');
  const fixieUrl = process.env.FIXIE_URL;
  const agent = fixieUrl ? new ProxyAgent(fixieUrl) : null;
  const proxied = (url, opts = {}) =>
    agent ? undiciFetch(url, { ...opts, dispatcher: agent }) : fetch(url, opts);

  const BASE_URL = process.env.CARTWAVE_BASE_URL || 'https://api.cartwavehub.com.br';
  let token;
  try {
    const tr = await proxied(`${BASE_URL}/v2/finance/auth-token/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.CARTWAVE_EMAIL, client_secret: process.env.CARTWAVE_PASSWORD }),
    });
    const td = await tr.json(); token = td.access_token;
  } catch (e) { return res.status(502).json({ ok: false, step: 'auth', error: e.message }); }

  const BRANCH = process.env.CARTWAVE_ACCOUNT_BRANCH || '0001';
  const NUMBER = process.env.CARTWAVE_ACCOUNT_NUMBER || '7004635';
  const expiry = new Date(Date.now() + 30*60*1000).toISOString().slice(0, 19);

  // Probe via POST with actual PIX body — 4xx responses tell us which paths exist
  const postBody = JSON.stringify({
    source_account_branch_identifier: BRANCH,
    source_account_number: NUMBER,
    amount: 10,
    type_fine: 'NONE',
    expiration_date: expiry,
    debtor_name: 'Teste PIX',
    tag: 'test_pix_probe',
  });

  const candidates = [
    '/v2/finance/create-pix-copy-and-paste-web-simplified',
    '/v2/finance/create-pix-copy-paste-web-simplified',
    '/v2/finance/create-pix',
    '/v2/finance/pix',
    '/v2/finance/create-charge',
    '/v2/finance/charge',
    '/v2/finance/pix-charge',
    '/v2/transaction/pix',
    '/v2/transaction/charge',
    '/v1/finance/create-pix-copy-and-paste-web-simplified',
    '/api/pix/charge',
  ];

  const results = {};
  for (const path of candidates) {
    try {
      const r = await proxied(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: postBody,
      });
      const text = await r.text(); let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 200); }
      results[path] = { status: r.status, body: parsed };
      // Stop at first non-404 response
      if (r.status !== 404) break;
    } catch (e) { results[path] = { error: e.message }; }
  }
  res.json({ ok: true, token_ok: !!token, results });
});

app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.path === '/api/webhooks/cartwave') {
      req.rawBody = buf.toString('utf8');
    }
  },
}));
app.use('/api', paymentRoutes);


// Serve frontend build in production
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

// Room registry
const rooms = new Map();        // roomId → GameRoom
const privateCodes = new Map(); // roomCode → GameRoom
const waitingRoom = { room: null };

function findOrCreateRoom() {
  if (waitingRoom.room && !waitingRoom.room.isFull()) {
    return waitingRoom.room;
  }
  const id = `room_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const room = new GameRoom(id, io, { bet: 0 });
  rooms.set(id, room);
  waitingRoom.room = room;
  return room;
}

io.on('connection', socket => {
  console.log('Player connected:', socket.id);

  // ── Public matchmaking ─────────────────────────────────────────────────────
  socket.on('joinQueue', playerInfo => {
    const room = findOrCreateRoom();
    room.addPlayer(socket, playerInfo || { name: 'Anônimo', flag: '🌐', wins: 0 });
    if (room.isFull()) waitingRoom.room = null;
  });

  // ── Private rooms ─────────────────────────────────────────────────────────
  socket.on('createPrivateRoom', ({ roomCode, bet, playerInfo }) => {
    const code = (roomCode || '').toUpperCase();
    if (!code) { socket.emit('privateRoomError', { msg: 'Código inválido.' }); return; }
    if (privateCodes.has(code)) {
      socket.emit('privateRoomError', { msg: 'Código já em uso. Tente novamente.' });
      return;
    }
    const id = `priv_${code}`;
    const room = new GameRoom(id, io, { bet: bet || 0 });
    rooms.set(id, room);
    privateCodes.set(code, room);
    room.addPlayer(socket, playerInfo || { name: 'Jogador', flag: '🇧🇷' });
    socket.emit('privateRoomCreated', { roomCode: code, bet: bet || 0 });
    console.log(`Private room created: ${code} (bet: ${bet})`);
  });

  socket.on('joinPrivateRoom', ({ roomCode, playerInfo }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = privateCodes.get(code);
    if (!room) {
      socket.emit('privateRoomError', { msg: 'Sala não encontrada. Verifique o código.' });
      return;
    }
    if (room.isFull()) {
      socket.emit('privateRoomError', { msg: 'Sala já está cheia.' });
      return;
    }
    room.addPlayer(socket, playerInfo || { name: 'Jogador', flag: '🇧🇷' });
    privateCodes.delete(code);
    console.log(`Player joined private room: ${code}`);
  });

  // ── In-game actions ────────────────────────────────────────────────────────
  socket.on('shoot', ({ angle, power }) => {
    const room = rooms.get(socket.data.roomId);
    if (room) room.handleShoot(socket.data.playerIdx, { angle, power });
  });

  socket.on('placeBall', ({ x, y }) => {
    const room = rooms.get(socket.data.roomId);
    if (room) room.handlePlaceBall(socket.data.playerIdx, { x, y });
  });

  socket.on('resign', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const winner = 1 - socket.data.playerIdx;
    room.vencedor = winner;
    room.estado = 'vitoria';
    room.broadcast('stateUpdate', { state: room.getState(), netAnims: [] });
    room.broadcast('gameResult', { winnerIdx: winner, betAmount: room.betAmount });
  });

  socket.on('rematch', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    room.reset();
    room.broadcast('stateUpdate', { state: room.getState(), netAnims: [] });
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const room = rooms.get(socket.data?.roomId);
    if (room) {
      room.removePlayer(socket);
      if (room.isEmpty()) {
        rooms.delete(room.id);
      } else {
        room.broadcast('opponentLeft', {});
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Register CartWave webhooks on startup (production only)
  if (process.env.WEBHOOK_URL) {
    const url = process.env.WEBHOOK_URL;
    Promise.all([
      registerWebhook(url, 'CASHIN'),     // PIX deposits
      registerWebhook(url, 'CASHOUT'),    // PIX cashouts
    ]).then(() => {
      console.log('[webhook] registered CartWave webhooks →', url);
    }).catch(e => {
      console.warn('[webhook] registration failed (may already exist):', e.message);
    });
  }
});
