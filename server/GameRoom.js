import { computeLayout, initBalls, runUntilStop, ballMoving, LAYOUT } from '../shared/physics.js';

const { BW, BH, HH, FW, CW, SB, MG } = LAYOUT;
const layout = computeLayout(BW, BH, HH, FW, CW, SB, MG);
const { PX, PY, PW, PH, BR, POCKETS } = layout;

const TIMER_MAX = 30 * 60; // frames at 60fps

export class GameRoom {
  constructor(id, io, options = {}) {
    this.id = id;
    this.io = io;
    this.betAmount = options.bet || 0;
    this.sockets = [];
    this.players = [null, null];
    this.reset();
  }

  reset() {
    this.balls = initBalls(PX, PY, PW, PH, BR);
    this.estado = 'mira';
    this.turn = 0;
    this.quebra = true;
    this.tipos = [null, null];
    this.potJogador = [[], []];
    this.potTurno = [];
    this.primeiroHit = null;
    this.faltou = false;
    this.vencedor = -1;
    this.timerFrames = TIMER_MAX;
    this.msg = '';
  }

  addPlayer(socket, playerInfo) {
    const idx = this.sockets.length;
    this.sockets.push(socket);
    this.players[idx] = playerInfo;

    socket.join(this.id);
    socket.data.roomId = this.id;
    socket.data.playerIdx = idx;

    socket.emit('joined', { playerIdx: idx, roomId: this.id });

    if (this.sockets.length === 2) {
      this.broadcast('matchStart', {
        players: this.players,
        state: this.getState(),
        betAmount: this.betAmount,
      });
    }
  }

  isFull() {
    return this.sockets.length >= 2;
  }

  getState() {
    return {
      balls: this.balls.map(b => ({ ...b })),
      estado: this.estado,
      turn: this.turn,
      tipos: this.tipos,
      potJogador: this.potJogador,
      vencedor: this.vencedor,
      msg: this.msg,
    };
  }

  broadcast(event, data) {
    this.io.to(this.id).emit(event, data);
  }

  handleShoot(playerIdx, { angle, power }) {
    if (playerIdx !== this.turn) return;
    if (this.estado !== 'mira') return;

    const cb = this.balls.find(b => b.id === 0);
    if (!cb || cb.out) return;

    const spd = power * 20;
    cb.vx = Math.cos(angle) * spd;
    cb.vy = Math.sin(angle) * spd;

    this.estado = 'rolando';
    this.primeiroHit = null;
    this.faltou = false;
    this.potTurno = [];
    this.timerFrames = TIMER_MAX;

    // Run physics to completion (server-authoritative)
    const { events, firstHit } = runUntilStop(
      this.balls, POCKETS, layout, this.primeiroHit
    );

    this.primeiroHit = firstHit;

    // Collect pocketed balls from events
    events.forEach(ev => {
      ev.pocketed.forEach(({ id }) => {
        if (this.estado === 'rolando') this.potTurno.push(id);
      });
    });

    this.processTurn();

    this.broadcast('stateUpdate', {
      state: this.getState(),
      netAnims: events.flatMap(ev => ev.pocketed.map(p => ({ x: p.px, y: p.py }))),
    });
  }

  handlePlaceBall(playerIdx, { x, y }) {
    if (playerIdx !== this.turn) return;
    if (this.estado !== 'ballInHand') return;

    const cb = this.balls.find(b => b.id === 0);
    if (!cb) return;

    // Clamp to play area
    cb.x = Math.max(PX + BR + 2, Math.min(PX + PW - BR - 2, x));
    cb.y = Math.max(PY + BR + 2, Math.min(PY + PH - BR - 2, y));
    cb.out = false; cb.vx = 0; cb.vy = 0;

    // Validate no overlap
    const ok = !this.balls.some((b, i) => {
      if (i === 0 || b.out) return false;
      const dx = b.x - cb.x, dy = b.y - cb.y;
      return dx * dx + dy * dy < (BR * 2.1) ** 2;
    });

    if (ok) {
      this.estado = 'mira';
      this.msg = 'Atire!';
    } else {
      this.msg = 'Posição bloqueada!';
    }

    this.broadcast('stateUpdate', { state: this.getState(), netAnims: [] });
  }

  processTurn() {
    const cb = this.balls.find(b => b.id === 0);
    if (cb.out) this.faltou = true;

    if (!this.quebra && !this.faltou) {
      if (this.primeiroHit === null) {
        this.faltou = true;
        this.msg = 'Falta: nenhuma bola tocada!';
      } else if (this.tipos[this.turn] !== null) {
        const ht = this.primeiroHit <= 7 ? 'solid' : 'stripe';
        if (ht !== this.tipos[this.turn]) {
          this.faltou = true;
          this.msg = 'Falta: bola adversária primeiro!';
        }
      }
    }

    const pot8 = this.potTurno.includes(8);
    if (pot8) {
      const myList = this.tipos[this.turn] === 'solid' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
      const allDone = myList.every(id => this.potJogador[this.turn].includes(id));
      this.vencedor = (!allDone || this.faltou) ? 1 - this.turn : this.turn;
      this.estado = 'vitoria';
      // Broadcast game result for balance settlement on clients
      setImmediate(() => this.broadcast('gameResult', { winnerIdx: this.vencedor, betAmount: this.betAmount }));
      return;
    }

    // Assign types
    if (this.tipos[this.turn] === null && !this.quebra) {
      const firstNon8 = this.potTurno.find(id => id !== 8);
      if (firstNon8 != null && !this.faltou) {
        const myType = firstNon8 <= 7 ? 'solid' : 'stripe';
        this.tipos[this.turn] = myType;
        this.tipos[1 - this.turn] = myType === 'solid' ? 'stripe' : 'solid';
        this.msg = (myType === 'solid' ? 'Sólidas' : 'Listradas') + ' atribuídas!';
      }
    }

    // Count correct pots
    let potouMinha = false;
    this.potTurno.forEach(id => {
      if (id === 8) return;
      const t = id <= 7 ? 'solid' : 'stripe';
      if (this.tipos[this.turn] === null || t === this.tipos[this.turn]) {
        if (!this.potJogador[this.turn].includes(id)) this.potJogador[this.turn].push(id);
        potouMinha = true;
      } else {
        if (!this.potJogador[1 - this.turn].includes(id)) this.potJogador[1 - this.turn].push(id);
      }
    });

    if (this.quebra) this.quebra = false;
    const continua = !this.faltou && potouMinha;

    if (this.faltou) {
      this.msg = this.msg || 'Falta! Bola na mão';
    } else if (this.potTurno.length > 0 && !this.faltou) {
      if (!this.msg) this.msg = this.potTurno.length === 1 ? 'Bola dentro!' : `${this.potTurno.length} bolas!`;
    } else {
      this.msg = '';
    }

    if (!continua) this.turn = 1 - this.turn;
    this.primeiroHit = null;
    this.potTurno = [];
    this.timerFrames = TIMER_MAX;

    if (this.faltou) {
      this.faltou = false;
      if (cb) { cb.out = false; cb.vx = 0; cb.vy = 0; cb.x = PX + PW * 0.26; cb.y = PY + PH / 2; }
      this.estado = 'ballInHand';
    } else {
      this.faltou = false;
      this.estado = 'mira';
    }
  }

  removePlayer(socket) {
    const idx = this.sockets.indexOf(socket);
    if (idx >= 0) this.sockets.splice(idx, 1);
  }

  isEmpty() {
    return this.sockets.length === 0;
  }
}
