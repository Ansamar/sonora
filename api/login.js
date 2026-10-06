const crypto = require('crypto');
const { COOKIE_NAME, creaToken } = require('./_lib/auth');

async function parseBody(req) {
  if (req.body == null) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
  }
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { password } = await parseBody(req);
    const attesa = process.env.SONORA_PASSWORD || '';

    if (!attesa) {
      return res.status(500).json({ error: 'SONORA_PASSWORD non configurata su Vercel' });
    }

    // Confronto a tempo costante: non svela con eventuali tentativi se la lunghezza era giusta
    const a = Buffer.from(String(password || ''));
    const b = Buffer.from(attesa);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!ok) {
      await new Promise((r) => setTimeout(r, 500)); // rallenta i tentativi a forza bruta
      return res.status(401).json({ error: 'Password errata' });
    }

    // Cookie valido 30 giorni, solo HTTP (inaccessibile a JavaScript), SameSite
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=${creaToken()}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax; Secure`);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};