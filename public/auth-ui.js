// ─── Gestione login/logout di Sonora ───

const $ = (s) => document.querySelector(s);

const loginScreen = $('#login-screen');
const app = $('#app');
const loginForm = $('#login-form');
const loginBtn = $('#login-btn');
const loginPassword = $('#login-password');
const loginStatus = $('#login-status');

function mostraApp() {
  loginScreen.hidden = true;
  app.hidden = false;
  // Notifica app.js che l'app è visibile (caricherà voci e cronologia)
  document.dispatchEvent(new CustomEvent('sonora:auth'));
}

async function controllaSessione() {
  try {
    // GET, non HEAD: l'endpoint history risponde 405 alle richieste HEAD
    const res = await fetch('/api/history');
    if (res.status === 401) { loginScreen.hidden = false; return; }
    if (res.ok) { mostraApp(); return; }
    // Qualsiasi altro stato: mostra il login per sicurezza
    loginScreen.hidden = false;
  } catch {
    loginScreen.hidden = false;
    loginStatus.textContent = 'Server non raggiungibile';
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginStatus.textContent = '';
  loginStatus.classList.remove('error');
  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: loginPassword.value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
    loginPassword.value = '';
    mostraApp();
  } catch (err) {
    loginStatus.textContent = `❌ ${err.message}`;
    loginStatus.classList.add('error');
  } finally {
    loginBtn.disabled = false;
  }
});

 $('#logout-btn').addEventListener('click', async () => {
  try { await fetch('/api/logout', { method: 'POST' }); } catch { /* ignora */ }
  app.hidden = true;
  loginScreen.hidden = false;
  loginPassword.focus();
});

controllaSessione();