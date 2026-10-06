// Autenticazione semplice: password nelle env var + cookie di sessione firmato.
// Non c'è registrazione: chi conosce SONORA_PASSWORD ottiene il cookie.

const COOKIE_NAME = 'sonora_session';

// Firma simmetrica leggera con la password stessa (HMAC): il cookie non è falsificabile
// senza conoscere SONORA_PASSWORD. Il valore include la scadenza (30 giorni).
const crypto = require('crypto');

function segreto() {
  return process.env.SONORA_PASSWORD || '';
}

function firma(payload) {
  return crypto.createHmac('sha256', segreto()).update(payload).digest('hex');
}

function creaToken() {
  const scadenza = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 giorni
  const payload = String(scadenza);
  return `${payload}.${firma(payload)}`;
}

function verificaToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  // Confronto a tempo costante per evitare analisi temporali
  const atteso = firma(payload);
  if (sig.length !== atteso.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(atteso))) return false;
  return Number(payload) > Date.now();
}

function leggiCookie(req) {
  const header = req.headers.cookie || '';
  for (const parte of header.split(';')) {
    const [nome, ...resto] = parte.trim().split('=');
    if (nome === COOKIE_NAME) return resto.join('=');
  }
  return null;
}

// Richiede l'autenticazione: risponde 401 e restituisce false se non valido
function richiediAuth(req, res) {
  const ok = verificaToken(leggiCookie(req));
  if (!ok) res.status(401).json({ error: 'Non autenticato' });
  return ok;
}

module.exports = { COOKIE_NAME, creaToken, verificaToken, leggiCookie, richiediAuth };