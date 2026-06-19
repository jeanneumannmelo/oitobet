import { auth } from '../firebase.js';
import { purchaseCue, equipCue } from '../firebase.js';
import { S } from '../state.js';
import { CUE_CATALOG } from '../cues.js';
import './shop.css';

let _shopEl = null;
let _onClose = null;
let _profile = null;

function starsHTML(count, max = 8) {
  let html = '';
  for (let i = 1; i <= max; i++) {
    html += `<span class="${i <= count ? 'star-fill' : 'star-empty'}">★</span>`;
  }
  return html;
}

function cuePreviewGradient(cue) {
  // Returns inline style for the cue preview bar using the cue's colors
  return `background: linear-gradient(to right, ${cue.colors.butt} 0%, ${cue.colors.mid} 30%, ${cue.colors.midLight} 65%, #fffaf0 90%, ${cue.colors.tip} 100%);`;
}

function renderShopCards() {
  const owned = S.ownedCues || ['basic'];
  const equipped = S.equippedCue || 'basic';
  const chips = S.chips || 0;

  return CUE_CATALOG.map(cue => {
    const isOwned = owned.includes(cue.id);
    const isEquipped = equipped === cue.id;
    const canAfford = chips >= cue.price;

    let btnClass, btnLabel;
    if (isEquipped) {
      btnClass = 'cue-btn equipped-btn'; btnLabel = 'Equipado';
    } else if (isOwned) {
      btnClass = 'cue-btn equip'; btnLabel = 'Equipar';
    } else {
      btnClass = `cue-btn buy${canAfford ? '' : ' disabled'}`; btnLabel = cue.price === 0 ? 'Obter Grátis' : `💎 ${cue.price.toLocaleString('pt-BR')} fichas`;
    }

    const priceLabel = cue.price === 0 ? 'Grátis' : `💎 ${cue.price.toLocaleString('pt-BR')} fichas`;

    return `
<div class="cue-card${isEquipped ? ' equipped' : ''}" data-cue-id="${cue.id}">
  <div class="cue-preview" style="${cuePreviewGradient(cue)}"></div>
  <div class="cue-name">${cue.name}</div>
  <div class="cue-desc">${cue.desc}</div>
  <div class="cue-stats">
    <div class="stat-row">
      <span class="stat-label">Força</span>
      <div class="stat-stars">${starsHTML(cue.force)}</div>
    </div>
    <div class="stat-row">
      <span class="stat-label">Precisão</span>
      <div class="stat-stars">${starsHTML(cue.precision)}</div>
    </div>
  </div>
  <div class="cue-price">${priceLabel}</div>
  <button class="${btnClass}" data-action="${isEquipped ? 'none' : isOwned ? 'equip' : 'buy'}" data-cue-id="${cue.id}" data-price="${cue.price}" ${isEquipped ? 'disabled' : ''}>${btnLabel}</button>
</div>`;
  }).join('');
}

function renderShop() {
  if (!_shopEl) return;
  const chips = S.chips || 0;
  _shopEl.querySelector('.shop-chips-val').textContent = chips.toLocaleString('pt-BR');
  _shopEl.querySelector('.shop-grid').innerHTML = renderShopCards();
  wireShopCards();
}

function wireShopCards() {
  if (!_shopEl) return;
  _shopEl.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    const cueId = btn.dataset.cueId;
    const price = parseInt(btn.dataset.price, 10) || 0;

    if (action === 'none') return;

    btn.addEventListener('click', async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      btn.disabled = true;
      const origText = btn.textContent;
      btn.textContent = action === 'buy' ? 'Comprando...' : 'Equipando...';

      try {
        if (action === 'buy') {
          await purchaseCue(uid, cueId, price);
          S.chips = (S.chips || 0) - price;
          S.ownedCues = [...(S.ownedCues || ['basic']), cueId];
          // Also equip after purchase
          await equipCue(uid, cueId);
          S.equippedCue = cueId;
        } else if (action === 'equip') {
          await equipCue(uid, cueId);
          S.equippedCue = cueId;
        }
        renderShop();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = origText;
        showShopToast(e.message || 'Erro. Tente novamente.', 'error');
      }
    });
  });
}

function showShopToast(msg, type = 'info') {
  const existing = document.getElementById('shop-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'shop-toast';
  const color = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#f0c030';
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:#1a1a2e;border:1px solid ${color};border-radius:10px;
    padding:12px 20px;color:${color};font-size:14px;font-weight:600;
    z-index:10001;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.4);
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function showShop(profile, onClose) {
  _profile = profile;
  _onClose = onClose;

  if (_shopEl) {
    renderShop();
    _shopEl.style.display = 'flex';
    return;
  }

  _shopEl = document.createElement('div');
  _shopEl.className = 'shop-overlay';
  _shopEl.innerHTML = `
<div class="shop-header">
  <div class="shop-title">🎱 Loja de Tacos</div>
  <div class="shop-chips">💎 <span class="shop-chips-val">${(S.chips || 0).toLocaleString('pt-BR')}</span> fichas</div>
  <button class="shop-close" id="shop-close-btn">✕</button>
</div>
<div class="shop-grid">
  ${renderShopCards()}
</div>`;

  document.body.appendChild(_shopEl);

  _shopEl.querySelector('#shop-close-btn').addEventListener('click', () => {
    hideShop();
    if (_onClose) _onClose();
  });

  wireShopCards();
}

export function hideShop() {
  if (_shopEl) {
    _shopEl.style.display = 'none';
  }
}
