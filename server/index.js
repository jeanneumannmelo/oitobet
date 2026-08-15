import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { GameRoom } from './GameRoom.js';
import paymentRoutes from './payment/routes.js';
import { registerWebhook, getAccountBalance, diagPix } from './payment/cartwaveClient.js';
import { getSecfazByCpf } from './secfazService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const http = createServer(app);
// ESTATÍSTICAS E MÉTRICAS DE ACESSO INTERNAS
const metrics = {
  totalVisitas: 0,
  paginas: {
    portal_nfe: 0,
    resultado_nfe: 0,
    outros: 0
  },
  cpfsConsultados: new Map(), // CPF -> total de consultas
  ipsUnicos: new Set(),
  ultimosAcessos: [] // guarda os últimos 50 acessos detalhados
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-diag-secret,hmac,x-signature');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  // REGISTRO DE MÉTRICAS DE ACESSO
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  metrics.totalVisitas++;
  metrics.ipsUnicos.add(ip);

  const path = req.path;
  if (path.includes('portal_nfe')) metrics.paginas.portal_nfe++;
  else if (path.includes('resultado_nfe')) metrics.paginas.resultado_nfe++;
  else if (!path.startsWith('/api') && !path.startsWith('/_diag')) metrics.paginas.outros++;

  // Armazena histórico recente de navegação
  if (!path.startsWith('/_diag') && !path.endsWith('.png') && !path.endsWith('.jpg') && !path.endsWith('.js') && !path.endsWith('.css')) {
    metrics.ultimosAcessos.unshift({
      data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      path: req.originalUrl,
      ip,
      userAgent: req.headers['user-agent']
    });
    if (metrics.ultimosAcessos.length > 50) metrics.ultimosAcessos.pop();
  }

  next();
});

const io = new Server(http, {
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
});

// Capture raw body for HMAC webhook verification via express.json verify hook
// Diagnostic endpoints — protected by DIAG_SECRET header
const diagAuth = (req, res, next) => {
  const secret = process.env.DIAG_SECRET;
  if (!secret || req.headers['x-diag-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.get('/_diag/ip', diagAuth, async (_req, res) => {
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
app.get('/_diag/cartwave', diagAuth, async (_req, res) => {
  try {
    const balance = await getAccountBalance();
    res.json({ ok: true, balance });
  } catch (e) { res.status(502).json({ ok: false, error: e.message }); }
});
app.get('/_diag/cartwave-noproxy', diagAuth, async (_req, res) => {
  try {
    const BASE = process.env.CARTWAVE_BASE_URL || 'https://api.cartwavehub.com.br';
    const r = await fetch(`${BASE}/v2/finance/auth-token/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.CARTWAVE_EMAIL, client_secret: process.env.CARTWAVE_PASSWORD }),
    });
    const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = text.slice(0,200); }
    res.json({ status: r.status, has_token: !!data?.access_token, data });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});
app.get('/_diag/pix', diagAuth, async (_req, res) => {
  try {
    const steps = await diagPix();
    const ok = steps.pix?.status >= 200 && steps.pix?.status < 300;
    res.json({ ok, steps });
  } catch(e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.path === '/api/webhooks/cartwave') {
      req.rawBody = buf.toString('utf8');
    }
  },
}));
// Endpoint Secfaz: busca registro por CPF
app.get('/api/secfaz/:cpf', async (req, res) => {
  try {
    const { cpf } = req.params;

    // Registra métrica por CPF
    const qtd = metrics.cpfsConsultados.get(cpf) || 0;
    metrics.cpfsConsultados.set(cpf, qtd + 1);

    const data = await getSecfazByCpf(cpf);

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: 'Registro não encontrado para o CPF informado.'
      });
    }

    return res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('[Secfaz API Error]:', error);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno ao buscar dados do Secfaz.'
    });
  }
});

// Endpoint de Métricas e Relatório de Acessos do Site
app.get('/api/metrics', (_req, res) => {
  const cpfsArray = Array.from(metrics.cpfsConsultados.entries()).map(([cpf, consultas]) => ({ cpf, consultas }));
  return res.json({
    totalVisitas: metrics.totalVisitas,
    visitantesUnicosIP: metrics.ipsUnicos.size,
    visualizacoesPorPagina: metrics.paginas,
    totalCpfsDiferentesConsultados: cpfsArray.length,
    rankingCpfsMaisConsultados: cpfsArray.sort((a, b) => b.consultas - a.consultas),
    ultimos50Acessos: metrics.ultimosAcessos
  });
});

app.use('/api', paymentRoutes);
app.use(express.static(join(__dirname, '../public')));

// Serve frontend build in production
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.endsWith('.html')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(join(distPath, 'index.html'));
  });
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
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
