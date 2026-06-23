import { auth, db, logout, getProfile, getDailyRanking, subscribeTransaction } from '../firebase.js';
import { showShop, hideShop } from './Shop.js';
import { S } from '../state.js';
import {
  collection, query, orderBy, limit, getDocs,
  doc, getDoc, updateDoc, increment, serverTimestamp,
} from 'firebase/firestore';
import './home.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const EMOJIS = ['🎱','🎮','🏆','⚡','🔥','💎','🌟','🎯','🦁','🐺','🦊','🐻','🦅','🐉','🌊','🌪'];
const DEP_AMOUNTS = [10, 25, 50, 100, 200, 500];

const FALLBACK_BOTS = [
  { id:'f1', name:'Lucas Silva',    nickname:'SniperBR',   difficulty:1, wins:120, losses:80,  location:'São Paulo',      avatar:0 },
  { id:'f2', name:'Fernanda Costa', nickname:'FerCraque',  difficulty:2, wins:240, losses:100, location:'Rio de Janeiro', avatar:4 },
  { id:'f3', name:'Pedro Rocha',    nickname:'PedroFoda',  difficulty:1, wins:55,  losses:40,  location:'Belo Horizonte', avatar:7 },
  { id:'f4', name:'Bianca Lima',    nickname:'BiPro99',    difficulty:2, wins:310, losses:150, location:'Curitiba',       avatar:3 },
  { id:'f5', name:'Matheus Gomes',  nickname:'MatheusTop', difficulty:3, wins:450, losses:200, location:'Salvador',       avatar:1 },
  { id:'f6', name:'Carla Souza',    nickname:'CarlaDrift', difficulty:1, wins:90,  losses:60,  location:'Fortaleza',      avatar:5 },
  { id:'f7', name:'Rafael Torres',  nickname:'RafaKing',   difficulty:3, wins:620, losses:280, location:'Recife',         avatar:2 },
  { id:'f8', name:'Juliana Neves',  nickname:'JuliCrack',  difficulty:2, wins:180, losses:95,  location:'Porto Alegre',   avatar:6 },
];

const ROOM_BETS = [0, 2, 5, 10, 25, 50];

const FIRST_NAMES = ['Lucas','Gabriel','Matheus','Pedro','João','Rafael','Felipe','Bruno','Diego','Thiago','Rodrigo','André','Carlos','Marcos','Paulo','Eduardo','Gustavo','Fernando','Leonardo','Alexandre','Ana','Maria','Julia','Fernanda','Beatriz','Amanda','Camila','Larissa','Juliana','Bruna','Mariana','Natalia','Gabriela','Leticia','Patricia','Aline','Vanessa','Renata','Carla','Sandra'];
const LAST_NAMES  = ['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira','Lima','Gomes','Costa','Ribeiro','Martins','Carvalho','Almeida','Lopes','Sousa','Fernandes','Vieira','Barbosa','Rocha','Dias','Nascimento','Andrade','Moreira','Nunes','Marques','Machado','Mendes','Freitas','Cavalcanti','Cardoso','Teixeira','Correia','Miranda','Ramos','Melo','Moraes','Azevedo','Pinto'];
const NICK_PFX    = ['Sniper','Shark','King','Dark','Flash','Shadow','Wolf','Fire','Ice','Storm','Steel','Eagle','Tiger','Black','Gold','Silver','Iron','Neon','Cyber','Pro','Top','Master','Ultra','Super','Mega','Hyper','Turbo','Ghost','Star','Nova'];
const NICK_SFX    = ['BR','420','007','SP','RJ','99','2k','Pro','God','Play','GG','Win','Boss','King','77','55','33','Top','Max','Ace'];
const LOCATIONS   = ['São Paulo','Rio de Janeiro','Belo Horizonte','Curitiba','Salvador','Fortaleza','Recife','Porto Alegre','Manaus','Belém','Goiânia','Campinas','Natal','Teresina','Campo Grande','João Pessoa','Maceió','São Luís','Vitória','Florianópolis'];

// Deterministic daily seed — stable per bot per day
function botDailySeed(botId, salt) {
  const today = new Date().toISOString().split('T')[0].replace(/-/g,'');
  const str = String(botId) + today + (salt || '');
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  return Math.abs(h);
}

function botDailyStats(bot) {
  // Relative score 0-1: stable all day, unique per bot
  const relScore = (botDailySeed(bot.id, 'e') % 100000) / 100000;

  // Earnings scale with time of day: R$100 at midnight → R$9837 at 23:59
  const now = new Date();
  const minutesOfDay = now.getHours() * 60 + now.getMinutes();
  const dayProgress = minutesOfDay / 1439; // 0..1
  const MIN_EARN = 100.03;
  const MAX_EARN = 9837.88;
  const cap = MIN_EARN + (MAX_EARN - MIN_EARN) * dayProgress;
  const earnings = +(MIN_EARN + relScore * (cap - MIN_EARN)).toFixed(2);

  return { earnings, relScore };
}

// Polymarket-style initials avatar
const AVATAR_COLORS = ['#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c','#3498db','#2980b9','#9b59b6','#e91e63','#00bcd4','#16a085','#d35400'];
function initialsAvatar(name, seed) {
  const init = (name || '?').trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const idx  = (typeof seed === 'number' ? seed : String(seed||name||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return `<div class="init-av" style="background:${AVATAR_COLORS[idx]}">${init}</div>`;
}

function fmtBRL(v) { return `R$ ${(+v||0).toFixed(2).replace('.',',')}` }

const FEMALE_FIRST_NAMES = new Set(['Ana','Maria','Julia','Fernanda','Beatriz','Amanda','Camila','Larissa','Juliana','Bruna','Mariana','Natalia','Gabriela','Leticia','Patricia','Aline','Vanessa','Renata','Carla','Sandra']);
function playerPhotoURL(name, seed) {
  const firstName = typeof name === 'string' ? name.split(' ')[0] : '';
  const isFemale = FEMALE_FIRST_NAMES.has(firstName);
  const n = Math.abs(typeof seed === 'number' ? seed : String(seed||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0));
  const gender = isFemale ? 'women' : 'men';
  return `https://randomuser.me/api/portraits/${gender}/${(n % 99) + 1}.jpg`;
}
function randCode() { return Math.random().toString(36).substr(2,6).toUpperCase(); }
function timeAgo(i) {
  const mins = [2,5,8,11,15,20,30,45,60,90];
  const m = mins[i % mins.length];
  return m < 60 ? `${m}min atrás` : `${Math.round(m/60)}h atrás`;
}
function diffLabel(d) {
  return ['','Iniciante','Fácil','Intermediário','Difícil','Imbatível'][d] || 'Desconhecido';
}
function username(user) {
  if (!user) return '@jogador';
  const base = (user.displayName || user.email || 'jogador')
    .toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,12);
  return '@' + base + Math.abs(user.uid?.charCodeAt(0) - 48 || 0);
}
function memberSince(user) {
  if (!user?.metadata?.creationTime) return 'Jun 2026';
  const d = new Date(user.metadata.creationTime);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const ICO_WALLET  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/><path d="M2 11V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4"/></svg>`;
const ICO_HIST    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>`;
const ICO_GIFT    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`;
const ICO_HOME    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const ICO_USER    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICO_SEARCH  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const ICO_REFRESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
const ICO_PLUS    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICO_PLAY    = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
const ICO_TABLE   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="6"/><path d="M2 12v6c0 3.31 4.48 6 10 6s10-2.69 10-6v-6"/></svg>`;
const ICO_PIX     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h2v2H7z"/><path d="M15 7h2v2h-2z"/><path d="M7 15h2v2H7z"/><path d="M11 11h2v2h-2z"/><path d="M15 15h2v2h-2z"/></svg>`;
const ICO_DOWN    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICO_UP      = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
const ICO_LINK    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
const ICO_COPY    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICO_TREND   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const ICO_MAIL    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
const ICO_PHONE   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.22 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.66a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const ICO_CAL     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const ICO_LOCK    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const ICO_LOGOUT  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const ICO_CHEVRON = `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
const ICO_EDIT    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICO_FIRE    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
const ICO_CARD    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;

// ── State ─────────────────────────────────────────────────────────────────────
let _el = null;
let _onPlay = null;
let _profile = null;
let _bots = [];
let _rooms = [];
let _currentView = 'inicio';
let _filterValor = 'todos';
let _depAmount = 50;
let _mpBet = 0;       // bet selected in multiplayer modal
let _mpSocket = null; // socket instance held by modal

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchBots() {
  try {
    const snap = await getDocs(collection(db, 'bots'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _bots = list.length ? list : FALLBACK_BOTS;
  } catch(e) {
    _bots = FALLBACK_BOTS;
  }
}

function generateRooms(bots) {
  const rng = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const aiBots = (bots && bots.length) ? bots : FALLBACK_BOTS;
  const totalCount = 500 + Math.floor(Math.random() * (2764 - 500 + 1));
  const rooms = [];
  for (let i = 0; i < totalCount; i++) {
    const lastName = rng(LAST_NAMES);
    const bet = ROOM_BETS[Math.floor(Math.random() * ROOM_BETS.length)];
    const firstName = rng(FIRST_NAMES);
    const playerName = `${firstName} ${lastName}`;
    rooms.push({
      id: `vr${i}`,
      playerName,
      nickname: `${rng(NICK_PFX)}${lastName}${rng(NICK_SFX)}`,
      location: rng(LOCATIONS),
      bet,
      free: bet === 0,
      code: randCode(),
      timeIdx: i,
      avatar: Math.floor(Math.random() * EMOJIS.length),
      photoURL: playerPhotoURL(playerName, i * 3 + 7),
      aiIdx: i % aiBots.length,
    });
  }
  return rooms.sort(() => Math.random() - .5);
}

function filteredRooms() {
  return _rooms.filter(r => {
    if (_filterValor === 'gratis'  && r.bet !== 0)               return false;
    if (_filterValor === '2'       && r.bet !== 2)               return false;
    if (_filterValor === '5-10'    && (r.bet < 5 || r.bet > 10)) return false;
    if (_filterValor === '10-50'   && (r.bet < 10|| r.bet > 50)) return false;
    if (_filterValor === '50+'     && r.bet < 50)                return false;
    return true;
  });
}

// ── DOM builders ─────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { id:'inicio',    label:'Início',          labelMobile:'Início',   icon: ICO_HOME   },
  { id:'carteira',  label:'Carteira',         labelMobile:'Carteira', icon: ICO_WALLET },
  { id:'ranking',   label:'Ranking',          labelMobile:'Ranking',  icon: ICO_TREND  },
  { id:'indicacao', label:'Indique e Ganhe',  labelMobile:'Indicar',  icon: ICO_GIFT   },
  { id:'loja',      label:'Loja de Tacos',    labelMobile:'Loja',     icon: ICO_TABLE  },
  { id:'perfil',    label:'Perfil',           labelMobile:'Perfil',   icon: ICO_USER   },
];

function navHTML(activeView) {
  return `
<nav class="hp-nav">
  <a class="hp-nav-brand" href="#">
    <img src="/oitobet.png" onerror="this.style.display='none'" alt="">
    <span>OITO<em>BET</em></span>
  </a>
  <div class="hp-nav-links">
    ${NAV_LINKS.slice(0,4).map(l => `
    <button class="hp-nav-link${activeView===l.id?' active':''}" data-view="${l.id}">
      ${activeView===l.id ? '<span class="dot"></span>' : ''}${l.label}
    </button>`).join('')}
  </div>
  <div class="hp-nav-right">
    <div class="hp-balance-chip" id="hp-bal-chip">
      ${ICO_WALLET}
      <div>
        <div class="hp-bal-label">Saldo</div>
        <div class="hp-bal-val" id="hp-bal-val">R$ 0,00</div>
      </div>
    </div>
    <div class="chip-balance" title="Fichas da loja">💎 <span id="hp-chips-val">0</span></div>
    <button class="hp-avatar-btn" id="hp-avatar-btn" title="Perfil">🎱</button>
  </div>
  <div class="hp-profile-drop" id="hp-drop">
    <div class="drop-user">
      <h4 id="drop-name">Carregando...</h4>
      <p id="drop-email"></p>
    </div>
    <button class="drop-item" data-view="perfil">${ICO_USER} Meu Perfil</button>
    <button class="drop-item" data-view="carteira">${ICO_WALLET} Carteira</button>
    <button class="drop-item danger" id="drop-logout">${ICO_LOGOUT} Sair da conta</button>
  </div>
</nav>
<nav class="hp-mobile-nav">
  <div class="hp-mobile-nav-inner">
    ${NAV_LINKS.map(l => `
    <button class="hp-mobile-tab${activeView===l.id?' active':''}" data-view="${l.id}">
      ${l.icon}<span>${l.labelMobile}</span>
    </button>`).join('')}
  </div>
</nav>`;
}

function viewInicioHTML() {
  return `
<div class="hp-view active" id="view-inicio">
  <!-- Banner -->
  <div class="hp-banner">
    <div class="hp-banner-icon">⚡</div>
    <div class="hp-banner-info">
      <h3>Deposite via PIX e jogue agora!</h3>
      <p>Receba seu saldo em segundos e dispute partidas por dinheiro real</p>
    </div>
    <button class="hp-banner-btn" data-view-action="depositar">Depositar</button>
    <div class="hp-banner-dots">
      <div class="hp-banner-dot active"></div>
      <div class="hp-banner-dot"></div>
      <div class="hp-banner-dot"></div>
    </div>
  </div>

  <!-- Section header -->
  <div class="hp-section-hd">
    <div>
      <h2>Salas de Jogo</h2>
      <p>Escolha um adversário e entre na partida</p>
    </div>
    <button class="hp-icon-btn" id="btn-refresh-rooms" title="Atualizar">${ICO_REFRESH}</button>
  </div>

  <!-- Action buttons row -->
  <div class="hp-action-row">
    <button class="hp-quick-btn" id="btn-quick-free">⚡ Jogar Grátis</button>
    <div class="hp-bet-wrap">
      <button class="hp-quick-btn hp-bet-btn" id="btn-find-bet">💰 Encontrar Aposta</button>
      <div class="hp-bet-pop" id="hp-bet-pop">
        ${[2,5,10,25,50].map(b=>`<button class="bet-pop-item" data-betval="${b}">R$ ${b}</button>`).join('')}
      </div>
    </div>
    <button class="hp-create-btn" id="btn-create-room">👥 Jogar com Amigo</button>
  </div>

  <!-- Search -->
  <div class="hp-search-wrap">
    ${ICO_SEARCH}
    <input type="text" id="room-search" placeholder="Buscar sala por jogador ou código...">
  </div>

  <!-- Filters -->
  <div class="hp-filters">
    <span class="hp-filter-label">${ICO_TABLE} Valor:</span>
    <button class="filter-chip active" data-fval="todos">Todos</button>
    <button class="filter-chip" data-fval="gratis">Grátis</button>
    <button class="filter-chip" data-fval="2">R$ 2</button>
    <button class="filter-chip" data-fval="5-10">R$ 5-10</button>
    <button class="filter-chip" data-fval="10-50">R$ 10-50</button>
    <button class="filter-chip" data-fval="50+">R$ 50+</button>
  </div>

  <!-- Rooms list header -->
  <div class="hp-rooms-hd">
    <h3>${ICO_PLAY} Salas Disponíveis</h3>
    <span class="hp-rooms-count" id="rooms-count">carregando...</span>
  </div>

  <!-- Rooms grid -->
  <div class="hp-rooms-grid" id="rooms-grid">
    <div class="rooms-loading">Carregando salas</div>
  </div>
</div>`;
}

function roomCardHTML(room, balance) {
  const canAfford = room.free || (balance >= room.bet);
  const prize = room.free ? 'Grátis' : fmtBRL(room.bet * 2);
  const betLabel = room.free ? 'Grátis' : fmtBRL(room.bet);
  const joinClass = room.free ? 'free-join' : (canAfford ? 'can-join' : 'add-balance');
  const joinLabel = room.free
    ? `${ICO_PLAY} Jogar Grátis`
    : canAfford
      ? `${ICO_PLAY} Jogar`
      : `${ICO_WALLET} Adicione saldo para jogar`;

  return `
<div class="room-card" data-room-id="${room.id}">
  <div class="rc-top">
    <div class="rc-avatar"><img src="${room.photoURL}" class="rc-photo" alt="" onerror="this.style.display='none';this.nextSibling&&(this.nextSibling.style.display='flex')">${initialsAvatar(room.playerName, room.timeIdx)}</div>
    <div class="rc-meta">
      <h4>@${room.nickname}</h4>
      <p>🇧🇷 ${room.location} · <span class="rc-waiting">Aguardando adversário</span></p>
    </div>
  </div>
  <div class="rc-badges">
    <span class="rc-code">#${room.code}</span>
    <span class="rc-badge tipo">Pública</span>
  </div>
  <div class="rc-stats">
    <div>
      <div class="rc-stat-label">Aposta</div>
      <div class="rc-stat-val">${betLabel}</div>
    </div>
    <div>
      <div class="rc-stat-label">Prêmio</div>
      <div class="rc-stat-val green">${prize}</div>
    </div>
    <div>
      <div class="rc-stat-label">Status</div>
      <div class="rc-stat-val status">Aberta</div>
    </div>
  </div>
  <button class="rc-join-btn ${joinClass}" data-room-id="${room.id}">
    ${joinLabel}
  </button>
</div>`;
}

function viewCarteiraHTML(profile) {
  const bal = profile?.balance || 0;
  const dep = profile?.totalDeposited || 0;
  const sac = profile?.totalWithdrawn || 0;
  const ent = profile?.totalEarned    || 0;
  return `
<div class="hp-view" id="view-carteira">
  <div class="hp-section-hd" style="margin-bottom:16px">
    <div><h2>Carteira</h2><p style="color:rgba(255,255,255,.38);font-size:13px;margin:0">Gerencie seu saldo, depósitos e saques</p></div>
  </div>

  <!-- Balance card -->
  <div class="wt-balance-card">
    <div class="wt-bal-label">Saldo Disponível</div>
    <div class="wt-bal-amount">${fmtBRL(bal)}</div>
    <div class="wt-stats-row">
      <div class="wt-stat-chip green">
        ${ICO_TREND}
        <div><div class="wt-sc-label">Depositado</div><div class="wt-sc-val">${fmtBRL(dep)}</div></div>
      </div>
      <div class="wt-stat-chip red">
        ${ICO_UP}
        <div><div class="wt-sc-label">Sacado</div><div class="wt-sc-val">${fmtBRL(sac)}</div></div>
      </div>
      <div class="wt-stat-chip gold">
        ${ICO_CARD}
        <div><div class="wt-sc-label">Entradas</div><div class="wt-sc-val">${fmtBRL(ent)}</div></div>
      </div>
    </div>
  </div>

  <!-- Depositar / Sacar -->
  <div class="wt-two-col">
    <div class="wt-card">
      <div class="wt-card-hd">
        <h3>${ICO_DOWN} Depositar</h3>
        <span class="wt-pix-badge">PIX</span>
      </div>
      <label style="color:rgba(255,255,255,.45);font-size:12px;display:block;margin-bottom:8px">Valor do depósito</label>
      <div class="wt-input-wrap">
        <span>R$</span>
        <input type="number" id="wt-dep-input" placeholder="0,00" min="10" max="500" step="0.01">
      </div>
      <div class="wt-amounts">
        ${DEP_AMOUNTS.map(a=>`<button class="wt-amt${a===50?' sel':''}" data-dep="${a}">R$ ${a}</button>`).join('')}
      </div>
      <button class="wt-pix-btn" id="wt-gerar-pix">${ICO_PIX} Gerar QR Code PIX</button>
    </div>

    <div class="wt-card">
      <div class="wt-card-hd">
        <h3>${ICO_UP} Sacar</h3>
        <span class="wt-pix-badge red">PIX</span>
      </div>
      <label style="color:rgba(255,255,255,.45);font-size:12px;display:block;margin-bottom:8px">Valor do saque</label>
      <div class="wt-limits">
        <span>Min <strong>R$ 10</strong></span>
        <span class="green">Max <strong>${fmtBRL(bal)}</strong></span>
      </div>
      <div class="wt-input-wrap">
        <span>R$</span>
        <input type="number" id="wt-sac-input" placeholder="0,00" min="10" max="${bal}" step="0.01">
      </div>
      <div id="wt-sac-fee" style="display:none;background:rgba(255,255,255,.04);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px">
        <div style="display:flex;justify-content:space-between;color:rgba(255,255,255,.45);margin-bottom:2px">
          <span>Taxa de saque</span><span style="color:#f87171">− R$ 2,00</span>
        </div>
        <div style="display:flex;justify-content:space-between;color:#fff;font-weight:700">
          <span>Você recebe</span><span id="wt-sac-net" style="color:#4ade80">R$ 0,00</span>
        </div>
      </div>
      <label style="color:rgba(255,255,255,.45);font-size:12px;display:block;margin-bottom:8px">Tipo de chave</label>
      <select class="wt-select" id="wt-chave-tipo">
        <option>CPF</option><option>E-mail</option><option>Telefone</option><option>Chave aleatória</option>
      </select>
      <label style="color:rgba(255,255,255,.45);font-size:12px;display:block;margin-bottom:8px">Chave PIX</label>
      <div class="wt-chave-wrap">
        ${ICO_CARD}
        <input type="text" id="wt-chave-input" placeholder="CPF, e-mail, telefone ou chave aleatória">
      </div>
      <button class="wt-sacar-btn" id="wt-solicitar-saque">${ICO_UP} Solicitar Saque</button>
    </div>
  </div>

  <!-- Transaction history -->
  <div class="wt-hist-hd"><h3>${ICO_HIST} Histórico de Transações</h3></div>
  <div class="wt-tx-empty">Nenhuma transação encontrada.</div>
</div>`;
}

function viewIndicacaoHTML(user) {
  const link = `https://oitobet.com/cadastro?ref=${randCode()}`;
  return `
<div class="hp-view" id="view-indicacao">
  <div class="hp-section-hd" style="margin-bottom:16px">
    <div><h2>Indique e Ganhe</h2><p style="color:rgba(255,255,255,.38);font-size:13px;margin:0">Indique amigos e ganhe R$ 5,00 no primeiro depósito de cada um</p></div>
  </div>

  <div class="ind-grid">
    <!-- Carteira afiliado -->
    <div class="ind-card">
      <div class="ind-card-hd">${ICO_WALLET} <h3>Carteira de Afiliado</h3></div>
      <div class="ind-bal-label">Saldo disponível</div>
      <div class="ind-bal-amount">R$ 0,00</div>
      <div class="ind-val-display">R$ 0,00</div>
      <button class="ind-transfer-btn">Transferir para Saldo</button>
      <div class="ind-note">Mínimo R$ 10,00 · Transfere para seu saldo principal</div>
    </div>

    <!-- Link de indicação -->
    <div class="ind-card">
      <div class="ind-card-hd">${ICO_LINK} <h3>Link de Indicação</h3></div>
      <div class="ind-link-wrap">
        <span class="ind-link-url">${link}</span>
        <button class="ind-copy-btn" id="ind-copy-btn">${ICO_COPY} Copiar</button>
      </div>
      <div class="ind-stats-grid">
        <div class="ind-stat">
          <div class="is-label">Cadastros</div>
          <div class="is-sub">Total de indicados</div>
          <div class="is-val">0</div>
        </div>
        <div class="ind-stat">
          <div class="is-label">Ativos</div>
          <div class="is-sub">Que depositaram</div>
          <div class="is-val">0</div>
        </div>
        <div class="ind-stat">
          <div class="is-label">Faturado</div>
          <div class="is-sub">Total ganho</div>
          <div class="is-val green">R$ 0,00</div>
        </div>
        <div class="ind-stat">
          <div class="is-label">Sacado</div>
          <div class="is-sub">Transferido</div>
          <div class="is-val">R$ 0,00</div>
        </div>
      </div>
    </div>
  </div>

  <div class="ind-grid">
    <!-- Como funciona -->
    <div class="ind-card">
      <div class="ind-card-hd">
        <svg viewBox="0 0 24 24" fill="none" stroke="#00d470" stroke-width="2" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3>Como Funciona</h3>
      </div>
      <div class="ind-steps">
        <div class="ind-step">
          <div class="ind-step-num s1">1</div>
          <div>
            <h4>Indique Amigos</h4>
            <p>Compartilhe seu link ou código de indicação.</p>
          </div>
        </div>
        <div class="ind-step">
          <div class="ind-step-num s2">2</div>
          <div>
            <h4>Ganhe R$ 5,00 de Bônus</h4>
            <p>No primeiro depósito de cada indicado.</p>
          </div>
        </div>
        <div class="ind-step">
          <div class="ind-step-num s3">3</div>
          <div>
            <h4>Acumule Ganhos</h4>
            <p>Saque suas comissões a qualquer momento via PIX.</p>
          </div>
        </div>
      </div>
      <div class="ind-note">Saque mínimo R$ 10,00 via PIX. Ganho somente no primeiro depósito de cada indicado.</div>
    </div>

    <!-- Desempenho -->
    <div class="ind-card">
      <div class="ind-card-hd">${ICO_TREND} <h3>Desempenho</h3></div>
      <div class="ind-perf-row">
        <div><div class="ind-perf-label">Taxa de Conversão</div><div class="ind-perf-sub">Cadastros que depositaram</div></div>
        <div class="ind-perf-val">0</div>
      </div>
      <div class="ind-perf-row">
        <div><div class="ind-perf-label">Média por Indicado</div><div class="ind-perf-sub">Ganho médio por ativo</div></div>
        <div class="ind-perf-val">0</div>
      </div>
      <div class="ind-perf-row">
        <div><div class="ind-perf-label">Saldo Disponível</div><div class="ind-perf-sub">Disponível para saque</div></div>
        <div class="ind-perf-val">0</div>
      </div>
    </div>
  </div>
</div>`;
}

function viewHistoricoHTML(profile) {
  const wins   = profile?.wins   || 0;
  const losses = profile?.losses || 0;
  const total  = wins + losses;
  const taxa   = total > 0 ? ((wins/total)*100).toFixed(1) : '0.0';
  const taxaPct = total > 0 ? (wins/total)*100 : 0;
  const earned = profile?.totalEarned  || 0;
  const spent  = profile?.totalSpent   || 0;
  const pnl    = earned - spent;
  const pnlClass = pnl >= 0 ? '' : 'red';
  const pnlSign  = pnl >= 0 ? '+' : '';
  return `
<div class="hp-view" id="view-historico">
  <div class="hp-section-hd" style="margin-bottom:16px">
    <div><h2>Histórico de Partidas</h2></div>
  </div>

  <div class="hs-stats-card">
    <div class="hs-three-col">
      <div class="hs-main-stat">
        <div class="hs-main-val green">${wins}</div>
        <div class="hs-main-label">Vitórias</div>
      </div>
      <div class="hs-main-stat">
        <div class="hs-main-val white">${total}</div>
        <div class="hs-main-label">Partidas</div>
      </div>
      <div class="hs-main-stat">
        <div class="hs-main-val red">${losses}</div>
        <div class="hs-main-label">Derrotas</div>
      </div>
    </div>
    <div class="hs-taxa-row">
      <span>Taxa de Vitória</span>
      <strong>${taxa}%</strong>
    </div>
    <div class="hs-money-row">
      <div class="hs-money-item">
        <div class="hs-money-icon blue">${ICO_CARD}</div>
        <div><div class="hs-money-label">Entradas</div><div class="hs-money-val">${fmtBRL(spent)}</div></div>
      </div>
      <div class="hs-money-item">
        <div class="hs-money-icon green">${ICO_TREND}</div>
        <div><div class="hs-money-label">Total Ganho</div><div class="hs-money-val">${fmtBRL(earned)}</div></div>
      </div>
    </div>
  </div>

  <div class="hs-pnl-card">
    <div class="hs-pnl-hd">
      <span>${ICO_TREND} Lucro/Prejuízo</span>
      <span class="hs-pnl-val ${pnlClass}">R$ ${pnlSign}${pnl.toFixed(2).replace('.',',')}</span>
    </div>
    <div class="hs-bar-track"><div class="hs-bar-fill" style="width:${taxaPct}%"></div></div>
    <div class="hs-bar-labels">
      <span>0%</span>
      <span class="mid">${taxa}% vitórias</span>
      <span>100%</span>
    </div>
  </div>

  <div class="hs-list-card">
    <div class="hs-list-empty">Nenhuma partida encontrada.</div>
  </div>
</div>`;
}

function viewPerfilHTML(user, profile) {
  const wins   = profile?.wins   || 0;
  const losses = profile?.losses || 0;
  const total  = wins + losses;
  const taxa   = total > 0 ? ((wins/total)*100).toFixed(1) + '%' : '0%';
  const earned = profile?.totalEarned || 0;
  const spent  = profile?.totalSpent  || 0;
  const pnl    = earned - spent;
  const pnlClass  = pnl >= 0 ? 'green' : 'red';
  const emojiIdx  = Math.abs((user?.uid||'').charCodeAt(0) - 48) % EMOJIS.length;
  const uname     = username(user);
  const since     = memberSince(user);
  const phone     = profile?.phone || '—';
  const email     = user?.email    || '—';
  const displayName = user?.displayName || profile?.displayName || 'Jogador';

  const hasPhoto = !!(user?.photoURL);
  const avatarInner = hasPhoto
    ? `<img src="${user.photoURL}" class="pf-photo" alt="Avatar">`
    : initialsAvatar(displayName, user?.uid || '');

  return `
<div class="hp-view" id="view-perfil">
  <!-- Hero -->
  <div class="pf-hero">
    <div class="pf-hero-avatar ${hasPhoto ? 'has-photo' : ''}">
      ${avatarInner}
      <div class="pf-edit-dot">${ICO_EDIT}</div>
    </div>
    <div class="pf-hero-info">
      <h2>${displayName}</h2>
      <p class="pf-username">${uname}</p>
      <p class="pf-email" title="${email}">${email}</p>
      <p class="pf-since">Membro desde ${since}</p>
    </div>
  </div>

  <!-- Info grid -->
  <div class="pf-info-grid" style="margin-bottom:14px">
    <div class="pf-info-item">${ICO_USER}<div><div class="pf-ii-label">Usuário</div><div class="pf-ii-val green">${uname}</div></div></div>
    <div class="pf-info-item">${ICO_MAIL}<div><div class="pf-ii-label">E-mail</div><div class="pf-ii-val">${email}</div></div></div>
    <div class="pf-info-item">${ICO_PHONE}<div><div class="pf-ii-label">Telefone</div><div class="pf-ii-val">${phone}</div></div></div>
    <div class="pf-info-item">${ICO_CAL}<div><div class="pf-ii-label">Membro desde</div><div class="pf-ii-val">${since}</div></div></div>
  </div>

  <!-- Stats grid -->
  <div class="pf-stats-grid">
    <div class="pf-stat-card">
      <div class="pf-sc-hd">${ICO_TABLE} Partidas</div>
      <div class="pf-sc-val white">${total}</div>
    </div>
    <div class="pf-stat-card">
      <div class="pf-sc-hd">${ICO_PLAY} Vitórias</div>
      <div class="pf-sc-val green">${wins}</div>
    </div>
    <div class="pf-stat-card">
      <div class="pf-sc-hd">${ICO_TABLE} Derrotas</div>
      <div class="pf-sc-val red">${losses}</div>
    </div>
    <div class="pf-stat-card">
      <div class="pf-sc-hd">${ICO_TREND} Taxa de Vitória</div>
      <div class="pf-sc-val yellow">${taxa}</div>
    </div>
  </div>

  <div class="pf-two-col" style="margin-bottom:16px">
    <!-- Sequências + Financeiro -->
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="pf-section-card">
        <h3>${ICO_FIRE} Sequências</h3>
        <div class="pf-seq-grid">
          <div class="pf-seq-item"><div class="psi-label">Sequência Atual</div><div class="psi-val">0</div><div class="psi-sub">vitórias</div></div>
          <div class="pf-seq-item"><div class="psi-label">Melhor Sequência</div><div class="psi-val">0</div><div class="psi-sub">vitórias</div></div>
        </div>
      </div>
      <div class="pf-section-card">
        <h3>${ICO_TREND} Financeiro</h3>
        <div class="pf-fin-row"><span>Total Ganho</span><strong class="green">${fmtBRL(earned)}</strong></div>
        <div class="pf-fin-row"><span>Total Gasto</span><strong class="red">${fmtBRL(spent)}</strong></div>
        <div class="pf-fin-row"><span>Lucro / Prejuízo</span><strong class="${pnlClass}">${fmtBRL(pnl)}</strong></div>
      </div>
    </div>

    <!-- Partidas recentes + Conta -->
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="pf-section-card">
        <div class="pf-section-hd">
          <h3 style="margin:0">${ICO_HIST} Partidas Recentes</h3>
          <button class="pf-see-all" data-view="historico">Ver todas</button>
        </div>
        <div class="pf-recent-empty">
          ${ICO_HIST}
          <p>Nenhuma partida ainda</p>
          <p>Jogue sua primeira partida no lobby!</p>
        </div>
      </div>
      <div class="pf-section-card">
        <h3>${ICO_LOCK} Conta</h3>
        <div class="pf-account-row" id="pf-change-pass">
          <div class="par-left">${ICO_LOCK} Alterar Senha</div>
          ${ICO_CHEVRON}
        </div>
        <div class="pf-account-row danger" id="pf-logout">
          <div class="par-left">${ICO_LOGOUT} Sair da Conta</div>
          ${ICO_CHEVRON}
        </div>
      </div>
    </div>
  </div>

  <!-- Histórico de Partidas embutido -->
  <div class="pf-section-card" style="margin-top:4px">
    <div class="pf-section-hd">
      <h3 style="margin:0">${ICO_HIST} Histórico de Partidas</h3>
    </div>
    <div class="pf-recent-empty">
      ${ICO_HIST}
      <p>Nenhuma partida registrada ainda.</p>
      <p style="font-size:11px;opacity:.5">Jogue partidas com apostas para ver seu histórico aqui.</p>
    </div>
  </div>
</div>`;
}

function multiplayerModalHTML() {
  return `
<div class="mp-modal" id="mp-modal">
  <div class="mp-modal-bd" id="mp-modal-bd"></div>
  <div class="mp-modal-card">
    <div class="mp-modal-hd">
      <h3>👥 Jogar com Amigo</h3>
      <button class="mp-close" id="mp-close">✕</button>
    </div>
    <div class="mp-tabs">
      <button class="mp-tab active" data-mptab="criar">Criar Sala</button>
      <button class="mp-tab" data-mptab="entrar">Entrar na Sala</button>
    </div>

    <div class="mp-panel" id="mpp-criar">
      <p class="mp-hint">Escolha o valor da aposta e envie o código para seu amigo</p>
      <div class="mp-bet-grid">
        <button class="mp-bet-amt active" data-mpbet="0">Grátis</button>
        <button class="mp-bet-amt" data-mpbet="5">R$ 5</button>
        <button class="mp-bet-amt" data-mpbet="10">R$ 10</button>
        <button class="mp-bet-amt" data-mpbet="25">R$ 25</button>
        <button class="mp-bet-amt" data-mpbet="50">R$ 50</button>
      </div>
      <p class="mp-bal-info" id="mp-bal-info"></p>
      <button class="mp-action-btn" id="mp-btn-criar">Criar Sala</button>
    </div>

    <div class="mp-panel" id="mpp-entrar" style="display:none">
      <p class="mp-hint">Digite o código da sala do seu amigo</p>
      <input type="text" id="mp-code-in" class="mp-code-input"
        placeholder="Ex: AB12CD" maxlength="6" autocomplete="off">
      <button class="mp-action-btn" id="mp-btn-entrar">Entrar na Sala</button>
    </div>

    <div class="mp-panel" id="mpp-wait" style="display:none">
      <div class="mp-wait-spinner">⏳</div>
      <p class="mp-wait-msg">Aguardando oponente...</p>
      <div class="mp-code-display">
        <span>Código da sua sala</span>
        <strong id="mp-code-show">------</strong>
        <button class="mp-copy-btn" id="mp-copy-code">${ICO_COPY} Copiar</button>
      </div>
      <button class="mp-cancel-btn" id="mp-cancel">Cancelar</button>
    </div>

    <div class="mp-err" id="mp-err" style="display:none"></div>
  </div>
</div>`;
}

function rankItemHTML(entry, pos) {
  const posLabel = pos <= 3
    ? `<span class="rank-medal-top rank-pos${pos}">${pos}°</span>`
    : `<span class="rank-medal-num">${pos}</span>`;
  const name  = entry.displayName || entry.nickname || entry.name || 'Jogador';
  const earn  = entry.dailyEarnings || 0;
  const avatarContent = entry.photoURL
    ? `<img src="${entry.photoURL}" class="rank-photo" alt="">`
    : initialsAvatar(name, entry.uid || entry.id || name);
  return `
<div class="rank-item ${pos <= 3 ? 'top3' : ''}">
  <div class="rank-pos-cell">${posLabel}</div>
  <div class="rank-avatar">${avatarContent}</div>
  <div class="rank-info">
    <div class="rank-name">${name}</div>
    <div class="rank-sub">Jogador</div>
  </div>
  <div class="rank-earn ${pos === 1 ? 'rank-earn-1' : pos <= 3 ? 'rank-earn-top' : ''}">+${fmtBRL(earn)}</div>
</div>`;
}

async function loadRanking(el, containerId = '#hp-rank-list') {
  const listEl = el.querySelector(containerId);
  if (!listEl) return;

  try {
    const realUsers = await getDailyRanking(5);

    const botPool = (_bots.length ? _bots : FALLBACK_BOTS);
    const botEntries = botPool.map((bot, i) => {
      const stats = botDailyStats(bot);
      return {
        uid: bot.id,
        displayName: bot.nickname || bot.name,
        photoURL: playerPhotoURL(bot.name || '', i + 1),
        dailyEarnings: stats.earnings,
        relScore: stats.relScore,
      };
    });

    const combined = [...realUsers, ...botEntries]
      .reduce((acc, e) => { if (!acc.find(x => x.uid === e.uid)) acc.push(e); return acc; }, [])
      .sort((a, b) => (b.dailyEarnings || 0) - (a.dailyEarnings || 0))
      .slice(0, containerId === '#hp-rank-list' ? 8 : 20);

    if (!combined.length) {
      listEl.innerHTML = `<div class="rank-empty">Seja o primeiro hoje!</div>`;
      return;
    }
    listEl.innerHTML = combined.map((e, i) => rankItemHTML(e, i + 1)).join('');
  } catch(e) {
    listEl.innerHTML = `<div class="rank-empty">Erro ao carregar ranking</div>`;
  }
}

async function loadRankingFull(el) {
  const podiumEl = el.querySelector('#vrank-podium');
  const listEl   = el.querySelector('#vrank-list');
  if (!podiumEl) return;

  try {
    const realUsers = await getDailyRanking(10);
    const botPool = _bots.length ? _bots : FALLBACK_BOTS;
    const botEntries = botPool.map((bot, i) => {
      const stats = botDailyStats(bot);
      return { uid: bot.id, displayName: bot.nickname || bot.name, photoURL: playerPhotoURL(bot.name || '', i + 1), dailyEarnings: stats.earnings };
    });
    const combined = [...realUsers, ...botEntries]
      .reduce((acc, e) => { if (!acc.find(x => x.uid === e.uid)) acc.push(e); return acc; }, [])
      .sort((a, b) => (b.dailyEarnings || 0) - (a.dailyEarnings || 0))
      .slice(0, 25);

    if (!combined.length) { podiumEl.innerHTML = `<div class="rank-empty">Sem dados ainda hoje</div>`; return; }

    // Podium: order 2-1-3 visually
    const top3 = combined.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    const podHeights = [70, 100, 52];    // 2nd, 1st, 3rd
    const podClasses = ['pod-silver','pod-gold','pod-bronze'];
    const podPositions = [2, 1, 3];

    podiumEl.innerHTML = `<div class="vpod-wrap">
      ${podiumOrder.map((e, pIdx) => {
        if (!e) return '';
        const av = e.photoURL ? `<img src="${e.photoURL}" class="rank-photo" alt="">` : initialsAvatar(e.displayName || '', e.uid || '');
        return `<div class="vpod-col">
          <div class="vpod-avatar-wrap ${podClasses[pIdx]}">${av}</div>
          <div class="vpod-name">${(e.displayName||'').split(' ')[0]}</div>
          <div class="vpod-earn">${fmtBRL(e.dailyEarnings)}</div>
          <div class="vpod-base ${podClasses[pIdx]}" style="height:${podHeights[pIdx]}px">${podPositions[pIdx]}°</div>
        </div>`;
      }).join('')}
    </div>`;

    if (listEl) listEl.innerHTML = combined.slice(3).map((e, i) => rankItemHTML(e, i + 4)).join('');
  } catch(e) {
    podiumEl.innerHTML = `<div class="rank-empty">Erro ao carregar ranking</div>`;
  }
}

function viewRankingHTML() {
  const today = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });
  return `
<div class="hp-view" id="view-ranking">
  <div class="hp-section-hd" style="margin-bottom:4px">
    <div>
      <h2>Ranking do Dia</h2>
      <p style="color:rgba(255,255,255,.38);font-size:13px;margin:0">Maiores ganhadores de hoje</p>
    </div>
    <span class="vrank-date">${today}</span>
  </div>

  <div class="vrank-podium" id="vrank-podium">
    <div class="rank-loading">Carregando...</div>
  </div>
  <div class="vrank-list" id="vrank-list"></div>
</div>`;
}

function footerHTML() {
  return `
<footer class="hp-footer">
  <span class="hp-footer-brand">OITO<em>BET</em></span>
  <div class="hp-footer-links">
    <a>Termos</a>
    <a>Privacidade</a>
    <a>Suporte</a>
  </div>
  <span class="hp-footer-copy">© 2026 OitoBet. Todos os direitos reservados.</span>
</footer>`;
}

// ── Wiring ────────────────────────────────────────────────────────────────────
function wireNav(el) {
  el.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
      el.querySelector('#hp-drop')?.classList.remove('show');
    });
  });

  el.querySelectorAll('[data-view-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.viewAction === 'depositar') switchView('carteira');
    });
  });

  const avatarBtn = el.querySelector('#hp-avatar-btn');
  const drop = el.querySelector('#hp-drop');
  avatarBtn?.addEventListener('click', e => {
    e.stopPropagation();
    drop?.classList.toggle('show');
  });
  document.addEventListener('click', () => drop?.classList.remove('show'));

  el.querySelector('#drop-logout')?.addEventListener('click', async () => {
    if (confirm('Deseja sair da conta?')) await logout();
  });
}

function wireInicio(el) {
  el.querySelector('#btn-refresh-rooms')?.addEventListener('click', async () => {
    await fetchBots();
    _rooms = generateRooms(_bots);
    renderRooms(el);
    loadRanking(el);
  });

  // Jogar Rápido Grátis
  el.querySelector('#btn-quick-free')?.addEventListener('click', () => {
    if (!_onPlay) return;
    const aiBots = _bots.length ? _bots : FALLBACK_BOTS;
    const bot = { ...aiBots[Math.floor(Math.random() * aiBots.length)] };
    _el?.classList.remove('show');
    _onPlay({ bot, free: true, bet: 0 });
  });

  // Encontrar Aposta — popover
  el.querySelector('#btn-find-bet')?.addEventListener('click', e => {
    e.stopPropagation();
    el.querySelector('#hp-bet-pop')?.classList.toggle('show');
  });

  el.querySelectorAll('.bet-pop-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const bet = +btn.dataset.betval;
      el.querySelector('#hp-bet-pop')?.classList.remove('show');
      const bal = _profile?.balance || 0;
      if (bal < bet) { switchView('carteira'); return; }
      const aiBots = _bots.length ? _bots : FALLBACK_BOTS;
      const bot = { ...aiBots[Math.floor(Math.random() * aiBots.length)], difficulty: 5 };
      _el?.classList.remove('show');
      _onPlay?.({ bot, free: false, bet });
    });
  });

  document.addEventListener('click', () => el.querySelector('#hp-bet-pop')?.classList.remove('show'));

  // Jogar com Amigo
  el.querySelector('#btn-create-room')?.addEventListener('click', () => {
    openMultiplayerModal();
  });

  el.querySelector('#room-search')?.addEventListener('input', e => {
    renderRooms(el, e.target.value.toLowerCase());
  });

  el.querySelectorAll('[data-fval]').forEach(chip => {
    chip.addEventListener('click', () => {
      el.querySelectorAll('[data-fval]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      _filterValor = chip.dataset.fval;
      renderRooms(el);
    });
  });
}

function openMultiplayerModal() {
  const modal = _el?.querySelector('#mp-modal');
  if (!modal) return;
  const info = modal.querySelector('#mp-bal-info');
  if (info) info.textContent = `Seu saldo: ${fmtBRL(_profile?.balance || 0)}`;
  modal.classList.add('show');
}

function wireMultiplayerModal(el) {
  const modal = el.querySelector('#mp-modal');
  if (!modal) return;

  function closeModal() {
    modal.classList.remove('show');
    showMpPanel('mpp-criar');
    clearMpErr();
    // Reset tabs
    modal.querySelectorAll('[data-mptab]').forEach(t => { t.classList.remove('active'); });
    modal.querySelector('[data-mptab="criar"]')?.classList.add('active');
    _mpBet = 0;
    modal.querySelectorAll('[data-mpbet]').forEach(b => b.classList.remove('active'));
    modal.querySelector('[data-mpbet="0"]')?.classList.add('active');
  }

  function showMpPanel(id) {
    modal.querySelectorAll('.mp-panel').forEach(p => { p.style.display = 'none'; });
    const target = modal.querySelector('#' + id);
    if (target) target.style.display = 'block';
  }

  function showMpErr(msg) {
    const err = modal.querySelector('#mp-err');
    if (err) { err.textContent = msg; err.style.display = 'block'; }
    setTimeout(clearMpErr, 4000);
  }

  function clearMpErr() {
    const err = modal.querySelector('#mp-err');
    if (err) err.style.display = 'none';
  }

  function getPlayerInfo() {
    const user = auth.currentUser;
    return { name: user?.displayName || user?.email?.split('@')[0] || 'Jogador', uid: user?.uid, flag: '🇧🇷' };
  }

  modal.querySelector('#mp-close')?.addEventListener('click', closeModal);
  modal.querySelector('#mp-modal-bd')?.addEventListener('click', closeModal);

  modal.querySelectorAll('[data-mptab]').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('[data-mptab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      showMpPanel(tab.dataset.mptab === 'criar' ? 'mpp-criar' : 'mpp-entrar');
    });
  });

  modal.querySelectorAll('[data-mpbet]').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('[data-mpbet]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _mpBet = +btn.dataset.mpbet;
    });
  });

  modal.querySelector('#mp-btn-criar')?.addEventListener('click', async () => {
    clearMpErr();
    const bal = _profile?.balance || 0;
    if (_mpBet > 0 && bal < _mpBet) {
      showMpErr(`Saldo insuficiente (${fmtBRL(bal)}). Deposite para apostar.`);
      return;
    }
    const code = randCode();
    const pInfo = getPlayerInfo();

    try {
      const { initNet, netCreatePrivateRoom, setOnPrivateRoomCreated, setOnPrivateRoomError, setOnMatchStart } =
        await import('../net/socket.js');
      _mpSocket = await initNet(pInfo);

      setOnPrivateRoomError(msg => showMpErr(msg));
      setOnPrivateRoomCreated(({ roomCode }) => {
        showMpPanel('mpp-wait');
        const codeEl = modal.querySelector('#mp-code-show');
        if (codeEl) codeEl.textContent = roomCode;
      });
      setOnMatchStart(({ betAmount }) => {
        closeModal();
        _onPlay?.({ mode: 'online', bet: betAmount, free: betAmount === 0 });
      });

      netCreatePrivateRoom(code, _mpBet, pInfo);
    } catch(e) {
      showMpErr('Erro ao conectar ao servidor. Tente novamente.');
    }
  });

  modal.querySelector('#mp-btn-entrar')?.addEventListener('click', async () => {
    clearMpErr();
    const code = (modal.querySelector('#mp-code-in')?.value || '').toUpperCase().trim();
    if (code.length < 4) { showMpErr('Informe um código válido.'); return; }

    try {
      const { initNet, netJoinPrivateRoom, setOnPrivateRoomError, setOnMatchStart } =
        await import('../net/socket.js');
      const pInfo = getPlayerInfo();
      _mpSocket = await initNet(pInfo);

      setOnPrivateRoomError(msg => showMpErr(msg));
      setOnMatchStart(({ betAmount }) => {
        const bal = _profile?.balance || 0;
        if (betAmount > 0 && bal < betAmount) {
          showMpErr(`Saldo insuficiente para esta sala (aposta: ${fmtBRL(betAmount)}).`);
          return;
        }
        closeModal();
        _onPlay?.({ mode: 'online', bet: betAmount, free: betAmount === 0 });
      });

      showMpPanel('mpp-wait');
      modal.querySelector('#mp-code-show').textContent = code;
      netJoinPrivateRoom(code, pInfo);
    } catch(e) {
      showMpErr('Erro ao conectar ao servidor. Tente novamente.');
    }
  });

  modal.querySelector('#mp-copy-code')?.addEventListener('click', () => {
    const code = modal.querySelector('#mp-code-show')?.textContent;
    if (code && code !== '------') navigator.clipboard?.writeText(code).catch(() => {});
    const btn = modal.querySelector('#mp-copy-code');
    if (btn) { btn.textContent = '✓ Copiado!'; setTimeout(() => btn.innerHTML = `${ICO_COPY} Copiar`, 2000); }
  });

  modal.querySelector('#mp-cancel')?.addEventListener('click', () => {
    if (_mpSocket) { _mpSocket.disconnect(); _mpSocket = null; }
    closeModal();
  });
}

function wireCarteira(el) {
  const depInput = el.querySelector('#wt-dep-input');
  if (depInput) depInput.value = '50.00';

  el.querySelectorAll('[data-dep]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-dep]').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      _depAmount = +btn.dataset.dep;
      if (depInput) depInput.value = _depAmount.toFixed(2);
    });
  });

  el.querySelector('#wt-gerar-pix')?.addEventListener('click', () => handleDeposit(el));
  el.querySelector('#wt-solicitar-saque')?.addEventListener('click', () => handleWithdraw(el));

  const sacInput = el.querySelector('#wt-sac-input');
  const feeBox   = el.querySelector('#wt-sac-fee');
  const netEl    = el.querySelector('#wt-sac-net');
  sacInput?.addEventListener('input', () => {
    const v = parseFloat(sacInput.value);
    if (v >= 10 && feeBox && netEl) {
      feeBox.style.display = 'block';
      netEl.textContent = fmtBRL(Math.max(0, v - 2));
    } else if (feeBox) {
      feeBox.style.display = 'none';
    }
  });
}

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');
  return user.getIdToken();
}

async function handleDeposit(el) {
  const val = +(el.querySelector('#wt-dep-input')?.value) || _depAmount;
  if (val < 10)  { showToast('Valor mínimo de depósito é R$ 10,00', 'error'); return; }
  if (val > 500) { showToast('Valor máximo de depósito é R$ 500,00', 'error'); return; }

  const btn = el.querySelector('#wt-gerar-pix');
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando PIX…'; }

  try {
    const token = await getIdToken();
    const res = await fetch('/api/payment/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: val }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erro ao gerar PIX', 'error'); return; }

    showPixModal({ amount: val, pixCode: data.pixCode, qrCodeUrl: data.qrCodeUrl, txId: data.txId, expiresAt: data.expiresAt });
  } catch (e) {
    console.error('[deposit]', e);
    showToast('Erro de conexão. Tente novamente.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `${ICO_PIX} Gerar QR Code PIX`; }
  }
}

const WITHDRAW_FEE = 2;

async function handleWithdraw(el) {
  const val = +(el.querySelector('#wt-sac-input')?.value) || 0;
  const bal = _profile?.balance || 0;
  const totalDebit = val + WITHDRAW_FEE;
  if (val < 10)        { showToast('Valor mínimo de saque é R$ 10,00', 'error'); return; }
  if (totalDebit > bal) { showToast(`Saldo insuficiente (necessário ${fmtBRL(totalDebit)} incluindo taxa de R$2,00)`, 'error'); return; }
  const chave = (el.querySelector('#wt-chave-input')?.value || '').trim();
  if (!chave) { showToast('Informe sua chave PIX', 'error'); return; }
  const pixKeyType = el.querySelector('#wt-chave-tipo')?.value?.toLowerCase().replace('-', '') || 'cpf';

  const btn = el.querySelector('#wt-solicitar-saque');
  if (btn) { btn.disabled = true; btn.textContent = 'Processando…'; }

  try {
    const token = await getIdToken();
    const res = await fetch('/api/payment/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: val, pixKey: chave, pixKeyType }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erro no saque', 'error'); return; }

    showToast(`Saque de ${fmtBRL(val)} em análise. Será processado em até 48h após aprovação.`, 'success');
    // Refresh profile balance
    if (auth.currentUser) {
      const updated = await getProfile(auth.currentUser.uid);
      if (updated) { _profile = updated; refreshBalanceDisplay(); }
    }
  } catch (e) {
    console.error('[withdraw]', e);
    showToast('Erro de conexão. Tente novamente.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `${ICO_UP} Solicitar Saque`; }
  }
}

function refreshBalanceDisplay() {
  const balEl = document.querySelector('.wt-bal-amount');
  if (balEl) balEl.textContent = fmtBRL(_profile?.balance || 0);
}

function showPixModal({ amount, pixCode, qrCodeUrl, txId, expiresAt }) {
  const existing = document.getElementById('pix-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pix-modal-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  overlay.innerHTML = `
    <div style="background:#1a1a2e;border:1px solid rgba(245,200,0,.25);border-radius:16px;padding:24px;max-width:420px;width:100%;position:relative">
      <button id="pix-modal-close" style="position:absolute;top:12px;right:12px;background:none;border:none;color:rgba(255,255,255,.5);font-size:20px;cursor:pointer;padding:4px">✕</button>
      <h3 style="margin:0 0 4px;color:#f5c800;font-size:18px">Pagamento PIX</h3>
      <p style="margin:0 0 16px;color:rgba(255,255,255,.5);font-size:13px">Depósito de ${fmtBRL(amount)}${expiryStr ? ' · expira às ' + expiryStr : ''}</p>
      ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code PIX" style="width:180px;height:180px;display:block;margin:0 auto 16px;border-radius:8px;background:#fff;padding:8px">` : ''}
      <label style="color:rgba(255,255,255,.45);font-size:12px;display:block;margin-bottom:6px">Código PIX (copia e cola)</label>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
        <input id="pix-code-input" type="text" readonly value="${pixCode}"
          style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:10px 12px;color:#fff;font-size:12px;font-family:monospace;min-width:0">
        <button id="pix-copy-btn" style="background:#f5c800;color:#000;border:none;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;white-space:nowrap;font-size:13px">Copiar</button>
      </div>
      <div id="pix-status" style="text-align:center;color:rgba(255,255,255,.45);font-size:13px;padding:12px;background:rgba(255,255,255,.04);border-radius:8px">
        Aguardando pagamento…
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#pix-modal-close').addEventListener('click', () => {
    overlay.remove();
    if (unsubTx) unsubTx();
  });

  overlay.querySelector('#pix-copy-btn').addEventListener('click', () => {
    navigator.clipboard?.writeText(pixCode).catch(() => {});
    const btn = overlay.querySelector('#pix-copy-btn');
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
  });

  // Listen for payment confirmation
  let unsubTx = null;
  if (txId) {
    unsubTx = subscribeTransaction(txId, tx => {
      const statusEl = overlay.querySelector('#pix-status');
      if (tx.status === 'completed') {
        if (statusEl) statusEl.innerHTML = '<span style="color:#4ade80;font-weight:700">✓ Pagamento confirmado! Saldo atualizado.</span>';
        setTimeout(() => { overlay.remove(); }, 2500);
        if (unsubTx) unsubTx();
        // Refresh profile
        if (auth.currentUser) {
          getProfile(auth.currentUser.uid).then(p => {
            if (p) { _profile = p; refreshBalanceDisplay(); }
          });
        }
      } else if (tx.status === 'failed') {
        if (statusEl) statusEl.innerHTML = '<span style="color:#f87171">Pagamento não confirmado. Tente novamente.</span>';
        if (unsubTx) unsubTx();
      }
    });
  }
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('wt-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'wt-toast';
  const color = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#f5c800';
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:#1a1a2e;border:1px solid ${color};border-radius:10px;
    padding:12px 20px;color:${color};font-size:14px;font-weight:600;
    z-index:10000;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.4);
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function wireIndicacao(el) {
  el.querySelector('#ind-copy-btn')?.addEventListener('click', () => {
    const url = el.querySelector('.ind-link-url')?.textContent;
    if (url) navigator.clipboard?.writeText(url).catch(() => {});
    const btn = el.querySelector('#ind-copy-btn');
    if (btn) { btn.innerHTML = `${ICO_COPY} Copiado!`; setTimeout(() => btn.innerHTML = `${ICO_COPY} Copiar`, 2000); }
  });
}

function wirePerfil(el) {
  el.querySelector('#pf-logout')?.addEventListener('click', async () => {
    if (confirm('Deseja sair da conta?')) await logout();
  });

  el.querySelector('#pf-change-pass')?.addEventListener('click', () => {
    alert('Funcionalidade em breve!');
  });

}

function renderRooms(el, search = '') {
  const grid = el.querySelector('#rooms-grid');
  if (!grid) return;

  let rooms = filteredRooms();
  if (search) {
    rooms = rooms.filter(r =>
      r.nickname?.toLowerCase().includes(search) ||
      r.playerName?.toLowerCase().includes(search) ||
      r.code.toLowerCase().includes(search)
    );
  }

  const bal = _profile?.balance || 0;
  el.querySelector('#rooms-count').textContent = `${rooms.length} salas disponíveis`;

  if (!rooms.length) {
    grid.innerHTML = `<div class="rooms-loading" style="animation:none;opacity:.5">Nenhuma sala encontrada</div>`;
    return;
  }

  grid.innerHTML = rooms.slice(0, 30).map(r => roomCardHTML(r, bal)).join('');

  grid.querySelectorAll('.rc-join-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // CTA: navigate to deposit page
      if (btn.classList.contains('add-balance')) {
        switchView('carteira');
        return;
      }

      const roomId = btn.dataset.roomId;
      const room = _rooms.find(r => r.id === roomId);
      if (!room || !_onPlay) return;

      const aiBots = _bots.length ? _bots : FALLBACK_BOTS;
      const aiBot = { ...aiBots[room.aiIdx % aiBots.length], nickname: room.nickname, name: room.playerName };
      _el?.classList.remove('show');
      _onPlay({ bot: aiBot, free: room.free, bet: room.bet });
    });
  });
}

function updateBalance(el) {
  const user = auth.currentUser;
  if (!user) return;
  getProfile(user.uid).then(p => {
    if (!p) return;
    _profile = p;
    const balEl = el.querySelector('#hp-bal-val');
    if (balEl) balEl.textContent = fmtBRL(p.balance || 0);
    const chipsEl = el.querySelector('#hp-chips-val');
    if (chipsEl) chipsEl.textContent = (p.chips || S.chips || 0).toLocaleString('pt-BR');
    const avatarBtn = el.querySelector('#hp-avatar-btn');
    if (avatarBtn) {
      if (user.photoURL) {
        avatarBtn.innerHTML = `<img src="${user.photoURL}" class="nav-avatar-photo" alt="">`;
      } else {
        const emojiIdx = Math.abs((user.uid||'').charCodeAt(0)-48) % EMOJIS.length;
        avatarBtn.textContent = EMOJIS[emojiIdx];
      }
    }
    const dropName = el.querySelector('#drop-name');
    const dropEmail = el.querySelector('#drop-email');
    if (dropName) dropName.textContent = user.displayName || user.email || 'Jogador';
    if (dropEmail) dropEmail.textContent = user.email || '';
  }).catch(() => {});
}

// ── View switching ────────────────────────────────────────────────────────────
function switchView(viewId) {
  if (!_el) return;
  _currentView = viewId;
  const user = auth.currentUser;

  // Sync desktop nav links
  _el.querySelectorAll('.hp-nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = _el.querySelector(`.hp-nav-link[data-view="${viewId}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Sync mobile bottom nav
  _el.querySelectorAll('.hp-mobile-tab').forEach(t => t.classList.remove('active'));
  const activeMobile = _el.querySelector(`.hp-mobile-tab[data-view="${viewId}"]`);
  if (activeMobile) activeMobile.classList.add('active');

  const content = _el.querySelector('.hp-content');
  if (!content) return;

  // Handle shop as overlay, not a view
  if (viewId === 'loja') {
    showShop(_profile, () => {
      // On shop close, sync chips display
      const chipsEl = _el?.querySelector('#hp-chips-val');
      if (chipsEl) chipsEl.textContent = (S.chips || 0).toLocaleString('pt-BR');
    });
    return;
  }

  let html = '';
  if (viewId === 'inicio') {
    html = viewInicioHTML();
  } else if (viewId === 'carteira') {
    html = viewCarteiraHTML(_profile);
  } else if (viewId === 'ranking') {
    html = viewRankingHTML();
  } else if (viewId === 'indicacao') {
    html = viewIndicacaoHTML(user);
  } else if (viewId === 'perfil') {
    html = viewPerfilHTML(user, _profile);
  }

  content.innerHTML = html + footerHTML();
  const view = content.querySelector('.hp-view');
  if (view) view.classList.add('active');

  if (viewId === 'inicio') {
    wireInicio(content);
    if (_rooms.length) {
      renderRooms(content);
    } else {
      content.querySelector('#rooms-grid').innerHTML = '<div class="rooms-loading">Carregando salas</div>';
      fetchBots().then(() => {
        _rooms = generateRooms(_bots);
        renderRooms(content);
      });
    }
  } else if (viewId === 'carteira') {
    wireCarteira(content);
  } else if (viewId === 'ranking') {
    loadRankingFull(content);
  } else if (viewId === 'indicacao') {
    wireIndicacao(content);
  } else if (viewId === 'perfil') {
    wirePerfil(content);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function showHome(onPlay) {
  _onPlay = onPlay;

  if (_el) {
    _el.classList.add('show');
    updateBalance(_el);
    return;
  }

  _el = document.createElement('div');
  _el.id = 'home-overlay';
  _el.className = 'ui-overlay';
  _el.innerHTML = navHTML('inicio') + `<div class="hp-content"></div>` + multiplayerModalHTML();
  document.body.appendChild(_el);
  _el.classList.add('show');

  wireNav(_el);
  wireMultiplayerModal(_el);

  const user = auth.currentUser;
  if (user) {
    getProfile(user.uid).then(p => {
      _profile = p || null;
      updateBalance(_el);
      switchView('inicio');
    }).catch(() => {
      switchView('inicio');
    });
  } else {
    switchView('inicio');
  }
}

export function hideHome() {
  if (_el) _el.classList.remove('show');
}

export function refreshHome() {
  if (!_el) return;
  const user = auth.currentUser;
  if (!user) return;
  getProfile(user.uid).then(p => {
    if (!p) return;
    _profile = p;
    const balEl = _el.querySelector('#hp-bal-val');
    if (balEl) balEl.textContent = fmtBRL(p.balance || 0);
    const chipsEl = _el.querySelector('#hp-chips-val');
    if (chipsEl) chipsEl.textContent = (p.chips || S.chips || 0).toLocaleString('pt-BR');
    if (_currentView === 'perfil') {
      const content = _el.querySelector('.hp-content');
      if (content) { content.innerHTML = viewPerfilHTML(user, _profile); wirePerfil(content); }
    }
    if (_currentView === 'inicio' && _rooms.length) {
      const content = _el.querySelector('.hp-content');
      if (content) renderRooms(content);
    }
  }).catch(() => {});
}
