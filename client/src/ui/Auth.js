import { login, auth, db, ensureUserDoc } from '../firebase.js';
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  createUserWithEmailAndPassword,
  updateProfile as fbUpdateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import './auth.css';

// ── CPF helpers ────────────────────────────────────────────────────────────────
function maskCPF(v) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function validCPF(raw) {
  const d = raw.replace(/\D/g,'');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0; for (let i=0;i<9;i++) s+=+d[i]*(10-i);
  let r=(s*10)%11; if(r===10||r===11)r=0; if(r!==+d[9])return false;
  s=0; for(let i=0;i<10;i++) s+=+d[i]*(11-i);
  r=(s*10)%11; if(r===10||r===11)r=0; return r===+d[10];
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const ICO_MAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>`;
const ICO_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const ICO_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
const ICO_ID   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 10h.01M2 15h20M8 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`;
const ICO_EYE  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICO_EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const ICO_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`;
const ICO_GOOGLE = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
const ICO_TROPHY= `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z"/></svg>`;
const ICO_PIX  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
const ICO_SHIELD=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

const BALL_COLORS = ['#e8c000','#1a5fbb','#cc2222','#7a1faa','#e05500','#1a7a1a','#6b3010','#151515'];

// ── HTML builders ──────────────────────────────────────────────────────────────
function fieldHTML(id, label, type, placeholder, icon, extra='') {
  return `
<div class="field">
  <label for="${id}">${label}</label>
  <div class="field-wrap" id="wrap-${id}">
    <span class="field-icon">${icon}</span>
    <input type="${type}" id="${id}" placeholder="${placeholder}" autocomplete="off" ${extra}>
    ${type==='password'?`<button class="field-eye" data-for="${id}" type="button">${ICO_EYE}</button>`:''}
  </div>
  <div class="field-err" id="err-${id}"></div>
</div>`;
}

function rightPanel() {
  const balls = BALL_COLORS.map(c=>`<div class="ar-ball" style="background:${c}"></div>`).join('');
  return `
<div class="auth-right">
  <div class="ar-inner">
    <div class="ar-ball-deco">${balls}</div>
    <h2 class="ar-title">Sinuca Online Competitiva</h2>
    <p class="ar-subtitle">Jogue partidas valendo PIX, desafie jogadores de todo o Brasil e ganhe dinheiro real.</p>
    <div class="ar-features">
      <div class="ar-feat">
        <div class="ar-feat-icon">${ICO_TROPHY}</div>
        <div class="ar-feat-info"><h4>1v1 Desafios</h4><p>Desafie jogadores em partidas valendo PIX</p></div>
      </div>
      <div class="ar-feat">
        <div class="ar-feat-icon">${ICO_PIX}</div>
        <div class="ar-feat-info"><h4>PIX Instantâneo</h4><p>Receba seus ganhos na hora via PIX</p></div>
      </div>
      <div class="ar-feat">
        <div class="ar-feat-icon">${ICO_SHIELD}</div>
        <div class="ar-feat-info"><h4>100% Seguro</h4><p>Plataforma segura e confiável</p></div>
      </div>
    </div>
  </div>
</div>`;
}

function loginHTML() {
  return `
<div class="auth-left" id="auth-left">
  <button class="auth-back" id="auth-back-btn">${ICO_BACK} Voltar ao início</button>
  <div class="auth-brand">
    <img src="/oitobet.png" onerror="this.style.display='none'" alt="">
    <span class="auth-brand-name">OITOBET <span>BRASIL</span></span>
  </div>
  <h1 class="auth-title">Bem-vindo de volta!</h1>
  <p class="auth-subtitle">Entre na sua conta para continuar jogando</p>
  <div class="auth-error" id="login-err"></div>
  ${fieldHTML('l-email','E-mail','email','seu@email.com',ICO_MAIL,'autocomplete="email"')}
  ${fieldHTML('l-pass','Senha','password','••••••••',ICO_LOCK,'autocomplete="current-password"')}
  <button class="auth-forgot" id="btn-forgot">Esqueceu sua senha?</button>
  <button class="btn-submit" id="btn-login">Entrar</button>
  <div class="auth-divider">ou</div>
  <button class="btn-google" id="btn-google-login">${ICO_GOOGLE} Entrar com Google</button>
  <div class="auth-switch">Não tem conta? <button id="go-register">Criar Conta Grátis</button></div>
</div>`;
}

function registerHTML() {
  return `
<div class="auth-left" id="auth-left">
  <button class="auth-back" id="auth-back-btn">${ICO_BACK} Voltar ao login</button>
  <div class="auth-brand">
    <img src="/oitobet.png" onerror="this.style.display='none'" alt="">
    <span class="auth-brand-name">OITOBET <span>BRASIL</span></span>
  </div>
  <h1 class="auth-title">Criar conta</h1>
  <p class="auth-subtitle">Rápido e gratuito — comece a jogar agora</p>
  <div class="auth-error" id="reg-err"></div>
  ${fieldHTML('r-name','Nome Completo','text','João da Silva',ICO_USER,'autocomplete="name"')}
  ${fieldHTML('r-cpf','CPF','text','000.000.000-00',ICO_ID,'inputmode="numeric"')}
  ${fieldHTML('r-email','E-mail','email','seu@email.com',ICO_MAIL,'autocomplete="email"')}
  ${fieldHTML('r-pass','Senha','password','mínimo 6 caracteres',ICO_LOCK,'autocomplete="new-password"')}
  <div class="auth-age-check">
    <input type="checkbox" id="r-age18" name="age18">
    <label for="r-age18">Confirmo que tenho 18 anos ou mais</label>
  </div>
  <button class="btn-submit" id="btn-register">Criar Conta Grátis</button>
  <div class="auth-divider">ou</div>
  <button class="btn-google" id="btn-google-reg">${ICO_GOOGLE} Cadastrar com Google</button>
  <p class="auth-terms">Ao criar conta você concorda com os <a href="#">Termos de Uso</a> e <a href="#">Política de Privacidade</a>.</p>
  <div class="auth-switch">Já tem conta? <button id="go-login">Entrar</button></div>
</div>`;
}

// ── Google Auth ────────────────────────────────────────────────────────────────

const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);

async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  if (isMobile) {
    // Redirect flow — page reloads; result is handled in showAuth()
    await signInWithRedirect(auth, provider);
    return;
  }
  const cred = await signInWithPopup(auth, provider);
  await ensureUserDoc(cred.user);
  return cred;
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found':        'Usuário não encontrado.',
    'auth/wrong-password':        'Senha incorreta.',
    'auth/invalid-email':         'E-mail inválido.',
    'auth/email-already-in-use':  'E-mail já cadastrado.',
    'auth/weak-password':         'Senha fraca (mínimo 6 caracteres).',
    'auth/popup-closed-by-user':  'Login com Google cancelado.',
    'auth/network-request-failed':'Sem conexão. Tente novamente.',
    'auth/invalid-credential':    'E-mail ou senha incorretos.',
    'auth/too-many-requests':     'Muitas tentativas. Aguarde alguns minutos.',
    'auth/operation-not-allowed': 'Cadastro por e-mail desativado. Ative no Firebase Console.',
    'auth/unauthorized-domain':   'Domínio não autorizado no Firebase Console.',
    'permission-denied':          'Permissão negada. Verifique as regras do Firestore.',
  };
  return map[code] || `Erro: ${code || 'desconhecido'}. Tente novamente.`;
}

// ── Wire logic ─────────────────────────────────────────────────────────────────
function wirePasswordToggle(el) {
  el.querySelectorAll('.field-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = el.querySelector(`#${btn.dataset.for}`);
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.innerHTML = show ? ICO_EYE_OFF : ICO_EYE;
    });
  });
}

function wireLogin(el) {
  wirePasswordToggle(el);

  el.querySelector('#btn-login').addEventListener('click', async () => {
    const btn = el.querySelector('#btn-login');
    const errEl = el.querySelector('#login-err');
    const email = el.querySelector('#l-email').value.trim();
    const pass  = el.querySelector('#l-pass').value;
    errEl.classList.remove('show');
    if (!email || !pass) { errEl.textContent='Preencha e-mail e senha.'; errEl.classList.add('show'); return; }
    btn.classList.add('loading'); btn.textContent='Entrando...';
    try { await login(email, pass); }
    catch(e) {
      errEl.textContent=friendlyError(e.code); errEl.classList.add('show');
      btn.classList.remove('loading'); btn.textContent='Entrar';
    }
  });

  el.querySelector('#btn-google-login').addEventListener('click', async () => {
    const errEl = el.querySelector('#login-err');
    errEl.classList.remove('show');
    try { await googleSignIn(); }
    catch(e) { errEl.textContent=friendlyError(e.code); errEl.classList.add('show'); }
  });

  el.querySelector('#btn-forgot').addEventListener('click', async () => {
    const email = el.querySelector('#l-email').value.trim();
    if (!email) { alert('Digite seu e-mail primeiro.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('E-mail de recuperação enviado!');
    } catch(e) { alert(friendlyError(e.code)); }
  });

  el.querySelector('#go-register').addEventListener('click', () => switchTo('register'));
}

function wireRegister(el) {
  wirePasswordToggle(el);

  const cpfIn = el.querySelector('#r-cpf');
  cpfIn.addEventListener('input', e => { e.target.value = maskCPF(e.target.value); });

  function showErr(id, msg) {
    const errEl = el.querySelector(`#err-${id}`);
    const wrap  = el.querySelector(`#wrap-${id}`);
    errEl.textContent = msg; errEl.classList.add('show');
    wrap.classList.add('error');
  }
  function clearErrs() {
    el.querySelectorAll('.field-err').forEach(e => { e.textContent=''; e.classList.remove('show'); });
    el.querySelectorAll('.field-wrap').forEach(w => w.classList.remove('error'));
  }

  el.querySelector('#btn-register').addEventListener('click', async () => {
    const btn    = el.querySelector('#btn-register');
    const errEl  = el.querySelector('#reg-err');
    const name   = el.querySelector('#r-name').value.trim();
    const cpf    = el.querySelector('#r-cpf').value;
    const email  = el.querySelector('#r-email').value.trim();
    const pass   = el.querySelector('#r-pass').value;
    errEl.classList.remove('show');
    clearErrs();

    let ok = true;
    if (!name || name.split(' ').length < 2) { showErr('r-name','Informe nome e sobrenome'); ok=false; }
    if (!validCPF(cpf)) { showErr('r-cpf','CPF inválido'); ok=false; }
    if (!email.includes('@')) { showErr('r-email','E-mail inválido'); ok=false; }
    if (pass.length < 6) { showErr('r-pass','Mínimo 6 caracteres'); ok=false; }
    const age18 = el.querySelector('#r-age18')?.checked;
    if (!age18) { errEl.textContent='Você deve confirmar que tem 18 anos ou mais.'; errEl.classList.add('show'); ok=false; }
    if (!ok) return;

    btn.classList.add('loading'); btn.textContent='Criando conta...';
    try {
      const cpfClean = cpf.replace(/\D/g,'');
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      // Write Firestore doc before updating profile so any errors surface on this form
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, displayName: name, email, cpf: cpfClean,
        balance:0, wins:0, losses:0, level:1, xp:0,
        profileComplete: true, createdAt: serverTimestamp(),
      });
      await fbUpdateProfile(cred.user, { displayName: name });
      // onAuthStateChanged fires here and handles navigation
    } catch(e) {
      console.error('[register]', e.code, e.message);
      errEl.textContent = friendlyError(e.code);
      errEl.classList.add('show');
      btn.classList.remove('loading'); btn.textContent='Criar Conta Grátis';
    }
  });

  el.querySelector('#btn-google-reg').addEventListener('click', async () => {
    const errEl = el.querySelector('#reg-err');
    errEl.classList.remove('show');
    try { await googleSignIn(); }
    catch(e) { errEl.textContent=friendlyError(e.code); errEl.classList.add('show'); }
  });

  el.querySelector('#go-login').addEventListener('click', () => switchTo('login'));
}

// ── Overlay management ─────────────────────────────────────────────────────────
let _overlay = null;
let _currentView = 'login';

function switchTo(view) {
  if (!_overlay) return;
  _currentView = view;
  const left = _overlay.querySelector('#auth-left');
  left.style.opacity = '0'; left.style.transform = 'translateX(-12px)';
  setTimeout(() => {
    left.outerHTML = (view === 'login' ? loginHTML() : registerHTML())
      .trim().match(/<div class="auth-left"[^>]*>([\s\S]*)<\/div>/)?.[0] || '';
    // Replace the entire left div
    const parent = _overlay;
    const existingLeft = parent.querySelector('#auth-left');
    if (existingLeft) existingLeft.remove();
    const tmp = document.createElement('div');
    tmp.innerHTML = view === 'login' ? loginHTML() : registerHTML();
    const newLeft = tmp.querySelector('#auth-left');
    parent.insertBefore(newLeft, parent.querySelector('.auth-right'));
    newLeft.style.opacity = '0'; newLeft.style.transform = 'translateX(-12px)';
    requestAnimationFrame(() => {
      newLeft.style.transition = 'opacity .2s, transform .2s';
      newLeft.style.opacity = '1'; newLeft.style.transform = 'translateX(0)';
    });
    view === 'login' ? wireLogin(parent) : wireRegister(parent);
  }, 150);
  left.style.transition = 'opacity .15s, transform .15s';
}

export function showAuth() {
  if (_overlay) return;
  _overlay = document.createElement('div');
  _overlay.id = 'auth-overlay';
  _overlay.innerHTML = loginHTML() + rightPanel();
  document.body.appendChild(_overlay);
  wireLogin(_overlay);

  _overlay.addEventListener('click', e => {
    if (e.target.closest('#auth-back-btn') && _currentView === 'register') switchTo('login');
  });

}

export function hideAuth() {
  if (_overlay) { _overlay.remove(); _overlay = null; }
}
