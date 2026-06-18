import './pregame.css';

let _el = null;
let _timer = null;

// showPreGame({ player1, player2, bet, searching, onDone })
// searching: if true, show 3s matchmaking phase before revealing opponent
export function showPreGame({ player1, player2, bet, searching = false, onDone }) {
  if (_el) { onDone?.(); return; }

  _el = document.createElement('div');
  _el.id = 'pregame-overlay';
  _el.innerHTML = buildHTML(player1, searching ? null : player2, bet, searching);
  document.body.appendChild(_el);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    _el.classList.add('pg-visible');
  }));

  const SEARCH_DURATION = 3000;
  const PLAY_DURATION   = 2500;
  const TOTAL           = searching ? SEARCH_DURATION + PLAY_DURATION : 5000;

  const bar     = _el.querySelector('#pg-bar-fill');
  const counter = _el.querySelector('#pg-counter');
  let elapsed   = 0;
  const TICK    = 50;
  let revealed  = false;

  _timer = setInterval(() => {
    elapsed += TICK;

    // During searching phase: reveal opponent at SEARCH_DURATION
    if (searching && !revealed && elapsed >= SEARCH_DURATION) {
      revealed = true;
      revealOpponent(player2, bet);
    }

    const pct = Math.min(100, (elapsed / TOTAL) * 100);
    if (bar) bar.style.width = pct + '%';

    const remaining = Math.ceil((TOTAL - elapsed) / 1000);
    if (counter) {
      if (searching && elapsed < SEARCH_DURATION) {
        counter.textContent = '';
      } else {
        counter.textContent = remaining > 0 ? remaining : '🎱';
      }
    }

    if (elapsed >= TOTAL) {
      clearInterval(_timer);
      _timer = null;
      _el.classList.add('pg-out');
      setTimeout(() => {
        _el?.remove();
        _el = null;
        onDone?.();
      }, 400);
    }
  }, TICK);
}

function revealOpponent(p2, bet) {
  if (!_el) return;
  const p2El = _el.querySelector('#pg-p2-slot');
  const statusEl = _el.querySelector('.pg-status');
  const betEl = _el.querySelector('.pg-bet-label');
  if (!p2El) return;

  const betLabel = !bet || bet === 0 ? 'Partida Grátis' : `Aposta: R$ ${(+bet).toFixed(2).replace('.', ',')}`;
  const av2 = p2?.photoURL
    ? `<img src="${p2.photoURL}" class="pg-photo" alt="">`
    : initAv(p2?.name || 'Adversário', 3);

  p2El.innerHTML = `
    <div class="pg-avatar pg-avatar-reveal">${av2}</div>
    <div class="pg-pname">${shortName(p2?.name || 'Adversário')}</div>`;

  if (statusEl) statusEl.textContent = 'Adversário encontrado!';
  if (betEl) betEl.textContent = betLabel;
}

function buildHTML(p1, p2, bet, searching) {
  const betLabel = searching ? 'Procurando...' : (!bet || bet === 0 ? 'Partida Grátis' : `Aposta: R$ ${(+bet).toFixed(2).replace('.', ',')}`);
  const av1 = p1?.photoURL
    ? `<img src="${p1.photoURL}" class="pg-photo" alt="">`
    : initAv(p1?.name || 'Você', 0);

  const p2HTML = searching
    ? `<div class="pg-avatar pg-searching-av"><div class="pg-search-spinner"></div></div>
       <div class="pg-pname pg-searching-name">Procurando...</div>`
    : (() => {
        const av2 = p2?.photoURL
          ? `<img src="${p2.photoURL}" class="pg-photo" alt="">`
          : initAv(p2?.name || 'Bot', 3);
        return `<div class="pg-avatar">${av2}</div>
                <div class="pg-pname">${shortName(p2?.name || 'Adversário')}</div>`;
      })();

  return `
<div class="pg-card">
  <div class="pg-balls-row" aria-hidden="true">
    ${[1,2,3,8,9,10,11].map(n => `<div class="pg-ball pg-ball-${n}" style="animation-delay:${(n-1)*0.07}s"></div>`).join('')}
  </div>

  <div class="pg-status">${searching ? 'Buscando adversário...' : 'Preparando a mesa...'}</div>

  <div class="pg-players">
    <div class="pg-player">
      <div class="pg-avatar">${av1}</div>
      <div class="pg-pname">${shortName(p1?.name || 'Você')}</div>
    </div>
    <div class="pg-vs">
      <div class="pg-vs-inner">VS</div>
    </div>
    <div class="pg-player" id="pg-p2-slot">
      ${p2HTML}
    </div>
  </div>

  <div class="pg-bet-label">${betLabel}</div>

  <div class="pg-progress-wrap">
    <div class="pg-progress-bar"><div id="pg-bar-fill" class="pg-bar-fill"></div></div>
    <span id="pg-counter" class="pg-counter">${searching ? '' : '5'}</span>
  </div>
</div>`;
}

const AV_COLORS = ['#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#d35400','#16a085','#2980b9'];
function initAv(name, offset) {
  const init = (name||'?').trim().split(/\s+/).map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const idx = ((name||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0) + offset) % AV_COLORS.length;
  return `<div class="pg-init-av" style="background:${AV_COLORS[idx]}">${init}</div>`;
}
function shortName(name) {
  return (name||'').split(' ')[0].substring(0, 12);
}
