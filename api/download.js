const { neon } = require('@neondatabase/serverless');
const { richiediAuth } = require('./_lib/auth');

const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  if (!richiediAuth(req, res)) return;
  try {
    const id = Number(new URL(req.url, 'http://x').searchParams.get('id'));
    if (!id) return res.status(400).json({ error: 'id mancante' });

    const [row] = await sql`select url, format from generations where id = ${id}`;
    if (!row) return res.status(404).json({ error: 'generazione non trovata' });

    // Nome dal percorso Blob: /audio/<cartella>/<timestamp>-<nome>.<ext> → <nome>.<ext>
    const base = decodeURIComponent(new URL(row.url).pathname.split('/').pop() || 'audio');
    const nome = base.replace(/^\d+-/, '');

    const upstream = await fetch(row.url, { redirect: 'follow' });
    if (!upstream.ok) {
      return res.status(502).json({ error: 'File non più disponibile nello storage' });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    // RFC 5987 per nomi con caratteri italiani (à, è, ...) — e fallback ASCII
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nome.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nome)}`
    );
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};