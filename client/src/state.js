// Central mutable game state. All modules import this object and read/write it.
// Treat it like a store — never reassign the object itself, only its properties.

export const BHEX = {
  0:'#f2f2f2',1:'#e8c000',2:'#1a5fbb',3:'#cc2222',4:'#7a1faa',
  5:'#e05500',6:'#1a7a1a',7:'#6b3010',8:'#151515',
  9:'#e8c000',10:'#1a5fbb',11:'#cc2222',12:'#7a1faa',
  13:'#e05500',14:'#1a7a1a',15:'#6b3010',
};

export const S = {
  // ── Canvas / layout ──
  DPR: window.devicePixelRatio || 1,
  BH: 580,
  BW: 900,
  sc: 1,
  isPortrait: false,
  HH: 96, FW: 28, CW: 14, SB: 62, MG: 8,
  TX: 0, TY: 0, TW: 0, TH: 0,
  IX: 0, IY: 0, IW: 0, IH: 0,
  PX: 0, PY: 0, PW: 0, PH: 0,
  BR: 11, PCR: 0, PMR: 0,
  MAX_PULL: 88,
  POCKETS: [],

  // ── Game ──
  balls: [],
  estado: 'mira',        // 'mira' | 'rolando' | 'ballInHand' | 'vitoria'
  tipos: [null, null],   // null | 'solid' | 'stripe'
  turn: 0,
  quebra: true,
  potJogador: [[], []],
  potTurno: [],
  primeiroHit: null,
  faltou: false,
  vencedor: -1,
  TIMER_MAX: 30 * 60,
  timerFrames: 30 * 60,
  msgTxt: 'Arraste para atirar',
  msgFlash: 0,

  players: [
    { name: 'Jogador 1', coins: 125400, level: 13, xp: 68, wins: 42, flag: '🇧🇷' },
    { name: 'Jogador 2', coins: 98200,  level: 9,  xp: 35, wins: 28, flag: '🇧🇷' },
  ],

  // ── Match ──
  betAmount: 0,

  // ── Multiplayer ──
  mode: 'offline',       // 'offline' | 'online'
  myIdx: 0,              // which player slot we are (online mode)
  connected: false,

  // ── Input / aim ──
  aimAng: 0,
  power: 0,
  pullBack: 0,
  isDragging: false,

  // ── HUD ──
  resignBtn: { x:0, y:0, w:0, h:0, simX:0, simY:0, simW:0, simH:0, naoX:0, naoY:0 },
  resignConfirm: false,

  // ── Bot ──
  BOT: 1,
  botDifficulty: 1,   // 1-5; controls aim error
  botDelay: 0,
  botAimPhase: 0,
  botAimTick: 0,
  botFakeAng: 0,
  botFakeTarget: 0,
  botFakeLinger: 0,
  botTargetAng: 0,
  botTargetPow: 0,

  // ── Celebration / effects ──
  celebFrames: 0,
  CELEB_TOTAL: 120,
  celebParticles: [],
  netAnims: [],

  // ── Loop ──
  tick: 0,

  // ── Table theme ──
  tableTheme: 0,      // 0-6, picked randomly each game

  // ── Turn popup ──
  turnPopup: 0,       // countdown 120→0; triggers mini popup when human's turn starts
  _prevTurn: -1,      // tracks previous turn for change detection

  // ── Match finalization ──
  gameEndHandled: false,

  // ── Chips / shop ──
  chips: 0,
  equippedCue: 'basic',
  ownedCues: ['basic'],
  chipBet: 0,

  // ── Player photos (preloaded Image objects, keyed by photoURL) ──
  _photoCache: {},
};
