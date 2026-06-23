import { login, auth, db } from '../firebase.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
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
const ICO_MAIL   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>`;
const ICO_LOCK   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const ICO_USER   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
const ICO_ID     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 10h.01M2 15h20M8 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`;
const ICO_EYE    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICO_EYE_OFF= `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const ICO_BACK   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`;
const ICO_GOOGLE = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
const ICO_TROPHY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z"/></svg>`;
const ICO_PIX    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
const ICO_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

const BALL_COLORS = ['#e8c000','#1a5fbb','#cc2222','#7a1faa','#e05500','#1a7a1a','#6b3010','#151515'];

// ── Race-condition guard ───────────────────────────────────────────────────────
// Resolves once the Firestore user doc has been written after login/register.
// main.js awaits this before reading the profile.
let _docReadyResolve = null;
let _docReadyPromise = null;

function resetDocReady() {
  _docReadyPromise = new Promise(res => { _docReadyResolve = res; });
}
resetDocReady();

export function awaitUserDocReady() { return _docReadyPromise; }

// ── HTML helpers ───────────────────────────────────────────────────────────────
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

// ── Error messages ─────────────────────────────────────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found':          'Usuário não encontrado.',
    'auth/wrong-password':          'Senha incorreta.',
    'auth/invalid-email':           'E-mail inválido.',
    'auth/email-already-in-use':    'E-mail já cadastrado. Faça login.',
    'auth/weak-password':           'Senha fraca — use pelo menos 6 caracteres.',
    'auth/popup-closed-by-user':    'Login com Google cancelado.',
    'auth/popup-blocked':           'Popup bloqueado pelo navegador. Permita popups para este site.',
    'auth/cancelled-popup-request': null, // silent — user opened another popup
    'auth/network-request-failed':  'Sem conexão. Verifique sua internet.',
    'auth/invalid-credential':      'E-mail ou senha incorretos.',
    'auth/too-many-requests':       'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/operation-not-allowed':   'Método de cadastro não habilitado. Contate o suporte.',
    'auth/unauthorized-domain':     'Domínio não autorizado. Contate o suporte.',
    'permission-denied':            'Permissão negada. Tente novamente.',
  };
  if (code in map) return map[code]; // null means silent
  return `Erro: ${code || 'desconhecido'}. Tente novamente.`;
}

function showErr(errEl, code) {
  const msg = friendlyError(code);
  if (!msg) return; // silent error
  errEl.textContent = msg;
  errEl.classList.add('show');
}

// ── Google Auth ────────────────────────────────────────────────────────────────
async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;

  // Write user doc — this must complete before onAuthStateChanged handler reads it
  resetDocReady();
  const isNew = cred._tokenResponse?.isNewUser ?? false;
  const userRef = doc(db, 'users', user.uid);

  // For new Google users, create full doc with all required fields
  // For returning users, ensureUserDoc is a no-op (doc already exists)
  if (isNew) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || 'Jogador',
      email: user.email || '',
      cpf: '',
      balance: 0, wins: 0, losses: 0,
      level: 1, xp: 0,
      chips: 200,
      ownedCues: ['basic'],
      equippedCue: 'basic',
      profileComplete: false,
      createdAt: serverTimestamp(),
    });
  }
  _docReadyResolve();
  return cred;
}

// ── Password toggle ────────────────────────────────────────────────────────────
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

// ── Login wiring ───────────────────────────────────────────────────────────────
function wireLogin(el) {
  wirePasswordToggle(el);

  el.querySelector('#btn-login').addEventListener('click', async () => {
    const btn   = el.querySelector('#btn-login');
    const errEl = el.querySelector('#login-err');
    const email = el.querySelector('#l-email').value.trim();
    const pass  = el.querySelector('#l-pass').value;

    errEl.classList.remove('show');
    if (!email || !pass) {
      errEl.textContent = 'Preencha e-mail e senha.';
      errEl.classList.add('show');
      return;
    }

    btn.classList.add('loading'); btn.textContent = 'Entrando...';
    try {
      resetDocReady();
      await login(email, pass);
      _docReadyResolve(); // existing user — doc already exists
    } catch(e) {
      showErr(errEl, e.code);
      btn.classList.remove('loading'); btn.textContent = 'Entrar';
    }
  });

  el.querySelector('#btn-google-login').addEventListener('click', async () => {
    const btn   = el.querySelector('#btn-google-login');
    const errEl = el.querySelector('#login-err');
    errEl.classList.remove('show');
    btn.disabled = true;
    try {
      await googleSignIn();
    } catch(e) {
      showErr(errEl, e.code);
    } finally {
      btn.disabled = false;
    }
  });

  el.querySelector('#btn-forgot').addEventListener('click', async () => {
    const email = el.querySelector('#l-email').value.trim();
    if (!email) {
      el.querySelector('#login-err').textContent = 'Digite seu e-mail primeiro.';
      el.querySelector('#login-err').classList.add('show');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      el.querySelector('#login-err').style.color = '#4ade80';
      el.querySelector('#login-err').textContent = 'E-mail de recuperação enviado!';
      el.querySelector('#login-err').classList.add('show');
    } catch(e) {
      showErr(el.querySelector('#login-err'), e.code);
    }
  });

  el.querySelector('#go-register').addEventListener('click', () => switchTo('register'));
}

// ── Register wiring ────────────────────────────────────────────────────────────
function wireRegister(el) {
  wirePasswordToggle(el);

  el.querySelector('#r-cpf').addEventListener('input', e => {
    e.target.value = maskCPF(e.target.value);
  });

  function markErr(id, msg) {
    const errEl = el.querySelector(`#err-${id}`);
    const wrap  = el.querySelector(`#wrap-${id}`);
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    if (wrap)  wrap.classList.add('error');
  }
  function clearErrs() {
    el.querySelectorAll('.field-err').forEach(e => { e.textContent=''; e.classList.remove('show'); });
    el.querySelectorAll('.field-wrap').forEach(w => w.classList.remove('error'));
    const top = el.querySelector('#reg-err');
    if (top) { top.textContent=''; top.classList.remove('show'); top.style.color=''; }
  }

  el.querySelector('#btn-register').addEventListener('click', async () => {
    const btn   = el.querySelector('#btn-register');
    const errEl = el.querySelector('#reg-err');
    clearErrs();

    const name  = el.querySelector('#r-name').value.trim();
    const cpf   = el.querySelector('#r-cpf').value;
    const email = el.querySelector('#r-email').value.trim();
    const pass  = el.querySelector('#r-pass').value;
    const age18 = el.querySelector('#r-age18').checked;

    let ok = true;
    if (!name || name.trim().split(/\s+/).length < 2) { markErr('r-name', 'Informe nome e sobrenome'); ok = false; }
    if (!validCPF(cpf)) { markErr('r-cpf', 'CPF inválido'); ok = false; }
    if (!email.includes('@') || !email.includes('.')) { markErr('r-email', 'E-mail inválido'); ok = false; }
    if (pass.length < 6) { markErr('r-pass', 'Mínimo 6 caracteres'); ok = false; }
    if (!age18) { errEl.textContent = 'Você deve ter 18 anos ou mais para jogar.'; errEl.classList.add('show'); ok = false; }
    if (!ok) return;

    btn.classList.add('loading'); btn.textContent = 'Criando conta...';
    try {
      const cpfClean = cpf.replace(/\D/g,'');

      // Signal that doc is being written — main.js will wait before reading profile
      resetDocReady();

      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      // Write complete user doc — all fields in one atomic setDoc
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        displayName: name,
        email,
        cpf: cpfClean,
        balance: 0, wins: 0, losses: 0,
        level: 1, xp: 0,
        chips: 200,
        ownedCues: ['basic'],
        equippedCue: 'basic',
        profileComplete: true,
        createdAt: serverTimestamp(),
      });

      // Update Firebase Auth display name in parallel (non-critical)
      fbUpdateProfile(cred.user, { displayName: name }).catch(() => {});

      // Signal doc is ready — main.js handleLoggedIn can now read profile safely
      _docReadyResolve();

      // onAuthStateChanged fires after createUserWithEmailAndPassword and will
      // handle navigation once _docReadyPromise resolves
    } catch(e) {
      console.error('[register]', e.code, e.message);
      showErr(errEl, e.code);
      btn.classList.remove('loading'); btn.textContent = 'Criar Conta Grátis';
    }
  });

  el.querySelector('#btn-google-reg').addEventListener('click', async () => {
    const btn   = el.querySelector('#btn-google-reg');
    const errEl = el.querySelector('#reg-err');
    errEl.classList.remove('show');
    btn.disabled = true;
    try {
      await googleSignIn();
    } catch(e) {
      showErr(errEl, e.code);
    } finally {
      btn.disabled = false;
    }
  });

  el.querySelector('#go-login').addEventListener('click', () => switchTo('login'));
  el.querySelector('#auth-back-btn').addEventListener('click', () => switchTo('login'));
}

// ── Overlay management ─────────────────────────────────────────────────────────
let _overlay = null;
let _currentView = 'login';

function switchTo(view) {
  if (!_overlay) return;
  _currentView = view;
  const oldLeft = _overlay.querySelector('#auth-left');
  if (!oldLeft) return;

  oldLeft.style.transition = 'opacity .15s, transform .15s';
  oldLeft.style.opacity = '0';
  oldLeft.style.transform = 'translateX(-12px)';

  setTimeout(() => {
    const tmp = document.createElement('div');
    tmp.innerHTML = view === 'login' ? loginHTML() : registerHTML();
    const newLeft = tmp.querySelector('#auth-left');
    newLeft.style.opacity = '0';
    newLeft.style.transform = 'translateX(-12px)';

    const right = _overlay.querySelector('.auth-right');
    _overlay.insertBefore(newLeft, right || null);
    oldLeft.remove();

    requestAnimationFrame(() => {
      newLeft.style.transition = 'opacity .2s, transform .2s';
      newLeft.style.opacity = '1';
      newLeft.style.transform = 'translateX(0)';
    });

    if (view === 'login') wireLogin(_overlay);
    else wireRegister(_overlay);
  }, 160);
}

export function showAuth() {
  if (_overlay) { _overlay.classList.add('show'); return; }
  _currentView = 'login';
  _overlay = document.createElement('div');
  _overlay.id = 'auth-overlay';
  _overlay.innerHTML = loginHTML() + rightPanel();
  document.body.appendChild(_overlay);
  wireLogin(_overlay);
}

export function hideAuth() {
  if (_overlay) { _overlay.remove(); _overlay = null; }
}
