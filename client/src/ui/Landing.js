import './landing.css';

let _onPlay = null;
let _onLogin = null;
let _onRegister = null;
let _countInterval = null;

let _onlineCount = 1700 + Math.floor(Math.random() * 600);

function fluctuateCount() {
  clearInterval(_countInterval);
  _countInterval = setInterval(() => {
    _onlineCount += Math.floor(Math.random() * 9) - 4;
    _onlineCount = Math.max(1400, Math.min(3200, _onlineCount));
    const el = document.getElementById('lnd-count');
    if (el) el.textContent = _onlineCount.toLocaleString('pt-BR');
  }, 3500);
}

function buildBall(num, cls) {
  return `<div class="lnd-ball ${cls}">${num}</div>`;
}

function html() {
  const year = new Date().getFullYear();
  return `
<div id="landing-overlay">

  <!-- HEADER -->
  <header class="lnd-header">
    <div class="lnd-container lnd-header-inner">
      <a class="lnd-brand" href="#">
        <img src="/oitobet.png" alt="OitoBet" onerror="this.style.display='none'">
        <span class="lnd-brand-name">OITOBET</span>
      </a>
      <div class="lnd-header-actions">
        <button id="lnd-btn-login" class="lnd-link-btn">Login</button>
        <button id="lnd-btn-register" class="lnd-cta-btn">Cadastrar</button>
      </div>
    </div>
  </header>

  <!-- HERO -->
  <section class="lnd-hero">
    <div class="lnd-hero-bg"></div>
    <div class="lnd-container lnd-hero-inner">

      <span class="lnd-badge-online">
        <span class="lnd-pulse">🎱</span>
        <span class="lnd-online-count" id="lnd-count">${_onlineCount.toLocaleString('pt-BR')}</span>
        <span>Jogadores online agora</span>
      </span>

      <h1 class="lnd-hero-title">
        Jogue Sinuca e<br>
        <span class="lnd-gold-text">Ganhe Dinheiro</span><br>
        de Verdade
      </h1>

      <p class="lnd-hero-sub">Desafie bots e jogadores reais 1v1 apostando via PIX. Saque instantâneo 24h por dia.</p>

      <!-- Pool table visual -->
      <div class="lnd-table-visual">
        <div class="lnd-table-felt">
          <div class="lnd-ball-rack">
            ${buildBall('1','b1')}
            ${buildBall('9','b9')}
            ${buildBall('2','b2')}
            ${buildBall('3','b3')}
            ${buildBall('8','b8')}
            ${buildBall('10','b10')}
            <!-- hidden cells for triangle grid -->
            <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
          </div>
          <div class="lnd-cue-ball">
            ${buildBall('','b0')}
          </div>
        </div>
      </div>

      <div class="lnd-hero-ctas">
        <button id="lnd-btn-play" class="lnd-play-btn">🎱 JOGAR GRÁTIS</button>
        <button id="lnd-btn-already" class="lnd-already-btn">Já tenho conta</button>
      </div>

      <div class="lnd-trust-badges">
        <span class="lnd-trust-badge"><span>✓</span> Saque via PIX</span>
        <span class="lnd-trust-badge"><span>✓</span> Depósito mín. R$2</span>
        <span class="lnd-trust-badge"><span>✓</span> Resultado na hora</span>
      </div>
    </div>
  </section>

  <!-- STATS BAR -->
  <section class="lnd-stats">
    <div class="lnd-container lnd-stats-grid">
      <div class="lnd-stat">
        <div class="lnd-stat-num">+5.000</div>
        <div class="lnd-stat-label">Jogadores Ativos</div>
      </div>
      <div class="lnd-stat">
        <div class="lnd-stat-num">R$ 500K+</div>
        <div class="lnd-stat-label">Pagos via PIX</div>
      </div>
      <div class="lnd-stat">
        <div class="lnd-stat-num">24h</div>
        <div class="lnd-stat-label">Saques Instantâneos</div>
      </div>
      <div class="lnd-stat">
        <div class="lnd-stat-num">100%</div>
        <div class="lnd-stat-label">Seguro e Confiável</div>
      </div>
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section class="lnd-how">
    <div class="lnd-container">
      <h2 class="lnd-section-title">Como <span class="lnd-gold-text">funciona</span></h2>
      <p class="lnd-section-sub">Três passos entre você e o seu primeiro prêmio via PIX.</p>
      <div class="lnd-steps">
        <div class="lnd-step">
          <div class="lnd-step-icon">💳</div>
          <h3>1. Faça seu depósito</h3>
          <p>Escolha o valor da aposta a partir de R$ 2 e entre na partida. Depósito rápido via PIX, sem burocracia.</p>
        </div>
        <div class="lnd-step">
          <div class="lnd-step-icon">🎱</div>
          <h3>2. Desafie e vença</h3>
          <p>Entre na sala, desafie um bot ou jogador real. Quem embolar todas as bolas e a 8 vence e leva o prêmio!</p>
        </div>
        <div class="lnd-step">
          <div class="lnd-step-icon">💸</div>
          <h3>3. Resgate via PIX</h3>
          <p>Ganhou? Resgate na hora. O valor cai direto no seu saldo. Saques disponíveis 24 horas por dia.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- TESTIMONIALS -->
  <section class="lnd-testimonials">
    <div class="lnd-container">
      <h2 class="lnd-section-title">Quem joga, <span class="lnd-gold-text2">recomenda</span></h2>
      <p class="lnd-section-sub" style="margin-bottom:36px"></p>
      <div class="lnd-reviews">
        <div class="lnd-review">
          <div class="lnd-stars">★★★★★</div>
          <p>"Comecei no teste grátis só pra ver e no mesmo dia já saquei meu primeiro prêmio. Viciante demais!"</p>
          <div class="lnd-reviewer">Carlos M. <span>São Paulo, SP</span></div>
        </div>
        <div class="lnd-review">
          <div class="lnd-stars">★★★★★</div>
          <p>"O jogo é incrível e pagar de verdade muda tudo. Bati a meta 3 vezes essa semana jogando sinuca."</p>
          <div class="lnd-reviewer">Fernanda R. <span>Recife, PE</span></div>
        </div>
        <div class="lnd-review">
          <div class="lnd-stars">★★★★★</div>
          <p>"Achei que era pegadinha, mas o resgate caiu na hora. Melhor plataforma de sinuca que já joguei!"</p>
          <div class="lnd-reviewer">João P. <span>Belo Horizonte, MG</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- BOTTOM CTA -->
  <section class="lnd-cta-bottom">
    <div class="lnd-cta-glow"></div>
    <div class="lnd-container lnd-cta-bottom-inner">
      <h2 class="lnd-section-title">Pronto para <span class="lnd-gold-text">jogar</span>?</h2>
      <p class="lnd-section-sub">Teste grátis sem cadastro. Quando estiver pronto, jogue valendo e receba via PIX.</p>
      <div class="lnd-cta-btns">
        <button id="lnd-btn-play2" class="lnd-play-btn" style="padding:14px 32px;font-size:15px">🎮 COMEÇAR TESTE GRÁTIS</button>
        <button id="lnd-btn-register2" class="lnd-outline-btn">Jogar valendo</button>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="lnd-footer">
    <div class="lnd-container lnd-footer-inner">
      <div class="lnd-brand lnd-footer-brand">
        <img src="/oitobet.png" alt="OitoBet" onerror="this.style.display='none'">
        <span class="lnd-brand-name">OITOBET</span>
      </div>
      <p class="lnd-disclaimer">Jogue com responsabilidade. Plataforma destinada a maiores de 18 anos. Apostas envolvem risco: nunca jogue mais do que pode perder.</p>
      <p class="lnd-copyright">© ${year} OitoBet. Todos os direitos reservados.</p>
    </div>
  </footer>

</div>`;
}

function wire() {
  const root = document.getElementById('landing-overlay');

  root.querySelector('#lnd-btn-login').addEventListener('click', () => {
    hideLanding();
    _onLogin?.();
  });
  root.querySelector('#lnd-btn-register').addEventListener('click', () => {
    hideLanding();
    _onRegister?.();
  });
  root.querySelector('#lnd-btn-play').addEventListener('click', () => {
    hideLanding();
    _onPlay?.();
  });
  root.querySelector('#lnd-btn-already').addEventListener('click', () => {
    hideLanding();
    _onLogin?.();
  });
  root.querySelector('#lnd-btn-play2').addEventListener('click', () => {
    hideLanding();
    _onPlay?.();
  });
  root.querySelector('#lnd-btn-register2').addEventListener('click', () => {
    hideLanding();
    _onRegister?.();
  });

  fluctuateCount();
}

export function showLanding({ onPlay, onLogin, onRegister } = {}) {
  _onPlay = onPlay;
  _onLogin = onLogin;
  _onRegister = onRegister;

  if (!document.getElementById('landing-overlay')) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html();
    document.body.appendChild(tmp.firstElementChild);
  }
  wire();
}

export function hideLanding() {
  clearInterval(_countInterval);
  const el = document.getElementById('landing-overlay');
  if (el) el.remove();
}

// Shows the sticky banner at the bottom of the game canvas for guest users.
export function showGuestBanner(onRegister) {
  if (document.getElementById('lnd-guest-banner')) return;
  const el = document.createElement('div');
  el.id = 'lnd-guest-banner';
  el.className = 'lnd-guest-banner';
  el.innerHTML = `
    <p><strong>Modo demonstração</strong> — crie uma conta gratuita para jogar valendo dinheiro real via PIX!</p>
    <button class="lnd-guest-banner-btn">Criar Conta Grátis</button>
  `;
  el.querySelector('button').addEventListener('click', () => {
    el.remove();
    onRegister?.();
  });
  document.body.appendChild(el);
}

export function hideGuestBanner() {
  document.getElementById('lnd-guest-banner')?.remove();
}
