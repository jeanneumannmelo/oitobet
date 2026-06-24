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
    _onlineCount = Math.max(1200, Math.min(3200, _onlineCount));
    const el = document.getElementById('lnd-count');
    if (el) el.textContent = _onlineCount.toLocaleString('pt-BR');
  }, 3500);
}

function html() {
  const year = new Date().getFullYear();
  return `
<div id="landing-overlay">

  <!-- HEADER -->
  <header class="lnd-header">
    <div class="lnd-container lnd-header-inner">
      <div class="lnd-brand">
        <img src="/oitobet.png" alt="OitoBet" onerror="this.style.display='none'">
        <span class="lnd-brand-name">OITO<em>BET</em></span>
      </div>
      <div class="lnd-header-actions">
        <button id="lnd-btn-login" class="lnd-link-btn">Login</button>
        <button id="lnd-btn-register" class="lnd-cta-btn">Cadastrar</button>
      </div>
    </div>
  </header>

  <!-- HERO -->
  <section class="lnd-hero">
    <div class="lnd-container lnd-hero-inner">

      <span class="lnd-badge-online">
        <span class="lnd-pulse">🎱</span>
        <span id="lnd-count">${_onlineCount.toLocaleString('pt-BR')}</span>
        <span>jogadores online agora</span>
      </span>

      <h1 class="lnd-hero-title">
        Jogue Sinuca e<br>
        <span class="lnd-gold">Ganhe Dinheiro</span><br>
        de Verdade
      </h1>

      <p class="lnd-hero-sub">
        Desafie bots e jogadores reais 1v1 apostando via PIX. Saque instantâneo 24h.
      </p>

      <!-- 8-ball showcase -->
      <div class="lnd-showcase">
        <div class="lnd-showcase-inner">
          <div class="lnd-orbit">
            <div class="lnd-orbit-ball lnd-ob1"></div>
            <div class="lnd-orbit-ball lnd-ob2"></div>
            <div class="lnd-orbit-ball lnd-ob3"></div>
            <div class="lnd-orbit-ball lnd-ob4"></div>
          </div>
          <div class="lnd-eight"></div>
        </div>
      </div>

      <div class="lnd-hero-ctas">
        <button id="lnd-btn-play" class="lnd-play-btn">🎱 JOGAR GRÁTIS</button>
        <button id="lnd-btn-already" class="lnd-already-btn">Já tenho conta</button>
      </div>

      <div class="lnd-trust">
        <span class="lnd-trust-item"><span>✓</span> Saque via PIX</span>
        <span class="lnd-trust-item"><span>✓</span> Depósito mín. R$2</span>
        <span class="lnd-trust-item"><span>✓</span> Resultado na hora</span>
      </div>
    </div>
  </section>

  <!-- STATS -->
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
      <h2 class="lnd-section-title">Como <span class="lnd-gold">funciona</span></h2>
      <p class="lnd-section-sub">Três passos entre você e o seu primeiro prêmio via PIX.</p>
      <div class="lnd-steps">
        <div class="lnd-step">
          <div class="lnd-step-icon">💳</div>
          <h3>1. Faça seu depósito</h3>
          <p>Escolha o valor da aposta a partir de R$ 2 e entre na partida. Depósito via PIX, sem burocracia.</p>
        </div>
        <div class="lnd-step">
          <div class="lnd-step-icon">🎱</div>
          <h3>2. Desafie e vença</h3>
          <p>Entre na sala, desafie um bot ou jogador real. Embole todas as bolas e a 8 para vencer e levar o prêmio!</p>
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
      <h2 class="lnd-section-title">Quem joga, <span class="lnd-gold">recomenda</span></h2>
      <p class="lnd-section-sub" style="margin-bottom:32px"></p>
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
    <div class="lnd-container">
      <h2 class="lnd-section-title">Pronto para <span class="lnd-gold">jogar</span>?</h2>
      <p class="lnd-section-sub">Teste grátis sem cadastro. Quando estiver pronto, jogue valendo e receba via PIX.</p>
      <div class="lnd-cta-btns">
        <button id="lnd-btn-play2" class="lnd-play-btn">🎮 COMEÇAR TESTE GRÁTIS</button>
        <button id="lnd-btn-register2" class="lnd-outline-btn">Jogar valendo</button>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="lnd-footer">
    <div class="lnd-container lnd-footer-inner">
      <div class="lnd-brand">
        <img src="/oitobet.png" alt="OitoBet" onerror="this.style.display='none'">
        <span class="lnd-brand-name">OITO<em>BET</em></span>
      </div>
      <p class="lnd-disclaimer">Jogue com responsabilidade. Plataforma destinada a maiores de 18 anos. Apostas envolvem risco: nunca jogue mais do que pode perder.</p>
      <p class="lnd-copyright">© ${year} OitoBet. Todos os direitos reservados.</p>
    </div>
  </footer>

</div>`;
}

function wire() {
  const root = document.getElementById('landing-overlay');
  root.querySelector('#lnd-btn-login').addEventListener('click', () => { hideLanding(); _onLogin?.(); });
  root.querySelector('#lnd-btn-register').addEventListener('click', () => { hideLanding(); _onRegister?.(); });
  root.querySelector('#lnd-btn-play').addEventListener('click', () => { hideLanding(); _onPlay?.(); });
  root.querySelector('#lnd-btn-already').addEventListener('click', () => { hideLanding(); _onLogin?.(); });
  root.querySelector('#lnd-btn-play2').addEventListener('click', () => { hideLanding(); _onPlay?.(); });
  root.querySelector('#lnd-btn-register2').addEventListener('click', () => { hideLanding(); _onRegister?.(); });
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
  document.getElementById('landing-overlay')?.remove();
}
