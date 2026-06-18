// Socket.IO client — handles online multiplayer communication.
import { S } from '../state.js';
import { sndCueStrike, sndPocket } from '../audio/sounds.js';

let socket = null;
let onMatchStartCb = null;
let onPrivateRoomCreatedCb = null;
let onPrivateRoomErrorCb = null;

export function setOnMatchStart(cb) { onMatchStartCb = cb; }
export function setOnPrivateRoomCreated(cb) { onPrivateRoomCreatedCb = cb; }
export function setOnPrivateRoomError(cb) { onPrivateRoomErrorCb = cb; }

export function initNet(playerInfo) {
  if (socket && socket.connected) return Promise.resolve(socket);

  // VITE_SOCKET_URL deve apontar para o backend em produção (ex: https://oitobet-api.herokuapp.com)
  const serverUrl = import.meta.env.VITE_SOCKET_URL || '';
  return import('socket.io-client').then(({ io }) => {
    socket = io(serverUrl, { autoConnect: false });

    socket.on('connect', () => {
      S.connected = true;
    });

    socket.on('joined', ({ playerIdx }) => {
      S.myIdx = playerIdx;
      S.BOT = -1;
    });

    socket.on('matchStart', ({ players, state, betAmount }) => {
      S.players = players;
      S.betAmount = betAmount || 0;
      S.mode = 'online';
      S.BOT = -1;
      S.gameEndHandled = false;
      applyServerState(state);
      S.msgTxt = 'Partida iniciada!'; S.msgFlash = 120;
      if (onMatchStartCb) onMatchStartCb({ players, betAmount: betAmount || 0 });
    });

    socket.on('stateUpdate', ({ state, netAnims }) => {
      applyServerState(state);
      if (netAnims) {
        netAnims.forEach(a => S.netAnims.push({ x: a.x, y: a.y, t: 0 }));
        if (netAnims.length > 0) sndPocket();
      }
    });

    socket.on('gameResult', ({ winnerIdx, betAmount }) => {
      // Handled by main.js via S.gameEndHandled + loop detection
      S._pendingResult = { winnerIdx, betAmount };
    });

    socket.on('privateRoomCreated', (data) => {
      if (onPrivateRoomCreatedCb) onPrivateRoomCreatedCb(data);
    });

    socket.on('privateRoomError', ({ msg }) => {
      if (onPrivateRoomErrorCb) onPrivateRoomErrorCb(msg);
    });

    socket.on('opponentLeft', () => {
      S.msgTxt = 'Oponente desconectou'; S.msgFlash = 300;
    });

    socket.on('disconnect', () => {
      S.connected = false;
    });

    socket.connect();
    return socket;
  });
}

function applyServerState(state) {
  if (state.balls)              S.balls      = state.balls;
  if (state.estado !== undefined) S.estado   = state.estado;
  if (state.turn  !== undefined)  S.turn     = state.turn;
  if (state.tipos)              S.tipos      = state.tipos;
  if (state.potJogador)         S.potJogador = state.potJogador;
  if (state.vencedor !== undefined) S.vencedor = state.vencedor;
  if (state.msg) { S.msgTxt = state.msg; S.msgFlash = 120; }
}

export function netSendShoot(angle, power) {
  if (socket && S.connected) socket.emit('shoot', { angle, power });
}

export function netSendPlaceBall(x, y) {
  if (socket && S.connected) socket.emit('placeBall', { x, y });
}

export function netSendResign() {
  if (socket && S.connected) socket.emit('resign');
}

export function netCreatePrivateRoom(roomCode, bet, playerInfo) {
  if (socket) socket.emit('createPrivateRoom', { roomCode, bet, playerInfo });
}

export function netJoinPrivateRoom(roomCode, playerInfo) {
  if (socket) socket.emit('joinPrivateRoom', { roomCode, playerInfo });
}

export function netDisconnect() {
  if (socket) { socket.disconnect(); socket = null; }
}
