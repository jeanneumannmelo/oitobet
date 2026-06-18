import { db, auth, logout, getProfile } from '../firebase.js';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import './auth.css';

const EMOJIS = ['🎱','🎮','🏆','⚡','🔥','💎','🌟','🎯','🦁','🐺','🦊','🐻','🦅','🐉','🌊','🌪'];

function diffLabel(d) {
  const labels = ['','Iniciante','Fácil','Intermediário','Difícil','Imbatível'];
  return labels[d] || 'Desconhecido';
}

function starsHTML(d) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i<=d?'on':'off'}">★</span>`;
  return s;
}

function createLobbyEl() {
  const el = document.createElement('div');
  el.id = 'lobby-overlay';
  el.innerHTML = `
<div class="lobby-card">
  <div class="lobby-header">
    <img src="/oitobet.png" onerror="this.style.display='none'" alt="">
    <div>
      <h2>OITOBET</h2>
      <p>Escolha seu adversário</p>
    </div>
  </div>

  <div class="user-bar">
    <div class="user-avatar" id="lobby-user-emoji">🎱</div>
    <div class="user-info">
      <h3 id="lobby-user-name">Carregando...</h3>
      <p id="lobby-user-level">Nível 1</p>
    </div>
    <div class="user-balance">
      <span id="lobby-user-balance">R$ 0,00</span>
      <small>saldo</small>
    </div>
  </div>

  <div class="lobby-body">
    <h3>Seu adversário</h3>
    <div class="bot-card" id="bot-card">
      <div class="bot-avatar" id="bot-emoji">🎮</div>
      <div class="bot-info">
        <h3 id="bot-name">Carregando...</h3>
        <p id="bot-location">🇧🇷 Brasil</p>
        <div class="bot-stars" id="bot-stars"></div>
        <span class="bot-diff-label diff-1" id="bot-diff">Iniciante</span>
      </div>
      <div class="bot-stats">
        <div><span class="stat-val" id="bot-wins">-</span><span class="stat-lbl">Vitórias</span></div>
        <div><span class="stat-val" id="bot-losses">-</span><span class="stat-lbl">Derrotas</span></div>
      </div>
    </div>

    <button class="btn-play" id="btn-play">▶ JOGAR AGORA</button>
    <button class="btn-shuffle" id="btn-shuffle">🔀 Outro adversário</button>
    <button class="btn-logout" id="btn-logout">Sair da conta</button>
  </div>
</div>`;
  return el;
}

// ── State ─────────────────────────────────────────────────────────────────────
let _el = null;
let _bots = [];
let _currentBot = null;
let _onStart = null;

// ── Fetch bots pool ────────────────────────────────────────────────────────────
const FALLBACK_BOTS = [
  { id:'f1', name:'Lucas Silva',    nickname:'SniperBR',   difficulty:1, wins:120, losses:80,  location:'São Paulo',       avatar:0 },
  { id:'f2', name:'Fernanda Costa', nickname:'FerCraque',  difficulty:2, wins:240, losses:100, location:'Rio de Janeiro',  avatar:4 },
  { id:'f3', name:'Pedro Rocha',    nickname:'PedroFoda',  difficulty:1, wins:55,  losses:40,  location:'Belo Horizonte',  avatar:7 },
  { id:'f4', name:'Bianca Lima',    nickname:'BiPro99',    difficulty:2, wins:310, losses:150, location:'Curitiba',        avatar:3 },
  { id:'f5', name:'Matheus Gomes',  nickname:'MatheusTop', difficulty:3, wins:450, losses:200, location:'Salvador',        avatar:1 },
];

async function fetchBots() {
  try {
    const snap = await getDocs(collection(db, 'bots'));
    _bots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (_bots.length === 0) _bots = FALLBACK_BOTS;
  } catch(e) {
    console.warn('Could not load bots from Firestore, using fallbacks:', e);
    _bots = FALLBACK_BOTS;
  }
}

function pickRandomBot() {
  if (!_bots.length) return null;
  return _bots[Math.floor(Math.random() * _bots.length)];
}

function renderBot(bot) {
  if (!bot || !_el) return;
  _currentBot = bot;
  const emojiIdx = (bot.avatar ?? bot.emoji ?? 0) % EMOJIS.length;
  _el.querySelector('#bot-emoji').textContent    = EMOJIS[emojiIdx];
  _el.querySelector('#bot-name').textContent     = bot.nickname || bot.name;
  _el.querySelector('#bot-location').textContent = `🇧🇷 ${bot.location || 'Brasil'}`;
  _el.querySelector('#bot-stars').innerHTML      = starsHTML(bot.difficulty);
  const d = bot.difficulty || 1;
  const diffEl = _el.querySelector('#bot-diff');
  diffEl.textContent  = diffLabel(d);
  diffEl.className    = `bot-diff-label diff-${d}`;
  _el.querySelector('#bot-wins').textContent   = bot.wins ?? '?';
  _el.querySelector('#bot-losses').textContent = bot.losses ?? '?';
}

async function renderUser() {
  if (!_el) return;
  const user = auth.currentUser;
  if (!user) return;

  _el.querySelector('#lobby-user-name').textContent  = user.displayName || user.email || 'Jogador';
  _el.querySelector('#lobby-user-emoji').textContent = EMOJIS[Math.abs(user.uid.charCodeAt(0) - 48) % EMOJIS.length];

  try {
    const profile = await getProfile(user.uid);
    if (profile) {
      _el.querySelector('#lobby-user-level').textContent   = `Nível ${profile.level || 1}`;
      const bal = (profile.balance || 0).toFixed(2).replace('.',',');
      _el.querySelector('#lobby-user-balance').textContent = `R$ ${bal}`;
    }
  } catch(e) { /* silently skip */ }
}

// ── Public API ─────────────────────────────────────────────────────────────────
export async function showLobby(onStart) {
  _onStart = onStart;
  if (_el) return;

  _el = createLobbyEl();
  document.body.appendChild(_el);
  _el.classList.add('show');

  await fetchBots();
  const bot = pickRandomBot();
  renderBot(bot);
  renderUser();

  _el.querySelector('#btn-shuffle').addEventListener('click', () => {
    renderBot(pickRandomBot());
  });

  _el.querySelector('#btn-play').addEventListener('click', () => {
    if (_currentBot && _onStart) {
      hideLobby();
      _onStart(_currentBot);
    }
  });

  _el.querySelector('#btn-logout').addEventListener('click', async () => {
    await logout();
    hideLobby();
  });
}

export function hideLobby() {
  if (_el) { _el.remove(); _el = null; }
}

export function getCurrentBot() { return _currentBot; }
