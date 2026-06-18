import { auth, db } from '../firebase.js';
import { doc, updateDoc } from 'firebase/firestore';
import './auth.css';
import './home.css';

function maskPhone(v) {
  const d = v.replace(/\D/g,'').slice(0,11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2');
  return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2');
}

function maskCPF(v) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}

function validCPF(raw) {
  const d = raw.replace(/\D/g,'');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i]*(10-i);
  let r = (s*10)%11; if (r===10||r===11) r=0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i]*(11-i);
  r = (s*10)%11; if (r===10||r===11) r=0;
  return r === +d[10];
}

function createEl(hasCPF) {
  const el = document.createElement('div');
  el.id = 'cp-overlay';
  el.className = 'ui-overlay';
  el.innerHTML = `
<div class="cp-card">
  <div class="cp-header">
    <div class="cp-icon">📋</div>
    <h2>Complete seu perfil</h2>
    <p>Precisamos de mais alguns dados para liberar todas as funcionalidades</p>
  </div>
  <div class="cp-body">
    <div class="cp-step">Passo 2 de 2 — Dados complementares</div>
    <div class="auth-error" id="cp-err"></div>

    ${!hasCPF ? `
    <div class="field">
      <label>CPF *</label>
      <input type="text" id="cp-cpf" placeholder="000.000.000-00" inputmode="numeric">
      <div class="field-err" id="err-cp-cpf">CPF inválido</div>
    </div>` : ''}

    <div class="field">
      <label>Telefone / WhatsApp *</label>
      <input type="text" id="cp-phone" placeholder="(11) 99999-9999" inputmode="numeric">
      <div class="field-err" id="err-cp-phone">Telefone inválido</div>
    </div>

    <div class="field">
      <label>Data de Nascimento *</label>
      <input type="date" id="cp-birth" max="${new Date(Date.now()-18*365.25*864e5).toISOString().slice(0,10)}">
      <div class="field-hint">Você precisa ter 18 anos ou mais</div>
      <div class="field-err" id="err-cp-birth">Idade mínima: 18 anos</div>
    </div>

    <button class="btn-primary" id="btn-cp-save">SALVAR E CONTINUAR →</button>
  </div>
</div>`;
  return el;
}

let _el = null;
let _onDone = null;

export function showCompleteProfile(hasCPF, onDone) {
  if (_el) return;
  _onDone = onDone;
  _el = createEl(hasCPF);
  document.body.appendChild(_el);

  const cpfIn   = _el.querySelector('#cp-cpf');
  const phoneIn = _el.querySelector('#cp-phone');
  const birthIn = _el.querySelector('#cp-birth');

  if (cpfIn)   cpfIn.addEventListener('input',  e => { e.target.value = maskCPF(e.target.value); });
  if (phoneIn) phoneIn.addEventListener('input', e => { e.target.value = maskPhone(e.target.value); });

  _el.querySelector('#btn-cp-save').addEventListener('click', async () => {
    const btn   = _el.querySelector('#btn-cp-save');
    const errEl = _el.querySelector('#cp-err');
    errEl.classList.remove('show');

    const phone = phoneIn?.value || '';
    const cpf   = cpfIn?.value   || '';
    const birth = birthIn?.value || '';

    let ok = true;

    if (cpfIn && !validCPF(cpf)) {
      _el.querySelector('#err-cp-cpf').classList.add('show');
      cpfIn.classList.add('error'); ok = false;
    }
    if (!phone || phone.replace(/\D/g,'').length < 10) {
      _el.querySelector('#err-cp-phone').classList.add('show');
      phoneIn.classList.add('error'); ok = false;
    }
    if (!birth) {
      _el.querySelector('#err-cp-birth').classList.add('show');
      birthIn.classList.add('error'); ok = false;
    } else {
      const age = (Date.now() - new Date(birth).getTime()) / (365.25 * 864e5);
      if (age < 18) {
        _el.querySelector('#err-cp-birth').classList.add('show');
        birthIn.classList.add('error'); ok = false;
      }
    }
    if (!ok) return;

    btn.classList.add('loading'); btn.textContent = 'SALVANDO';
    try {
      const uid = auth.currentUser.uid;
      const data = { phone: phone.replace(/\D/g,''), birthDate: birth, profileComplete: true };
      if (cpfIn) data.cpf = cpf.replace(/\D/g,'');
      await updateDoc(doc(db, 'users', uid), data);
      hideCompleteProfile();
      _onDone?.();
    } catch(e) {
      errEl.textContent = 'Erro ao salvar. Tente novamente.';
      errEl.classList.add('show');
      btn.classList.remove('loading'); btn.textContent = 'SALVAR E CONTINUAR →';
    }
  });
}

export function hideCompleteProfile() {
  if (_el) { _el.remove(); _el = null; }
}
