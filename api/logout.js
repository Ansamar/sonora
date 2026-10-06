const { COOKIE_NAME } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  // Cancella il cookie sul browser
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
  res.json({ ok: true });
};