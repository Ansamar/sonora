const { del } = require('@vercel/blob');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  try {
    // GET: ultime 25 generazioni
    if (req.method === 'GET') {
      const rows = await sql`
        select id, text, voice, format, size_bytes, url, created_at
        from generations order by created_at desc limit 25`;
      return res.json(rows);
    }

    // DELETE: rimuove la riga dal DB e il file dal Blob
    if (req.method === 'DELETE') {
      const id = Number(new URL(req.url, 'http://x').searchParams.get('id'));
      if (!id) return res.status(400).json({ error: 'id mancante' });

      const [row] = await sql`select url from generations where id = ${id}`;
      if (!row) return res.status(404).json({ error: 'generazione non trovata' });

      await del(row.url);
      await sql`delete from generations where id = ${id}`;
      return res.status(204).end();
    }

    res.status(405).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};