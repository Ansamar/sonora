const { put } = require('@vercel/blob');
const { neon } = require('@neondatabase/serverless');
const { generateSpeech, parseBody } = require('./_lib/tts-provider');
const { richiediAuth } = require('./_lib/auth');

const sql = neon(process.env.DATABASE_URL);

// Rende un testo sicuro per un percorso file/cartella:
// lettere (anche accentate), numeri, trattini; max N caratteri
function slugSicuro(nome, fallback, max = 80) {
  const pulito = String(nome || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, max);
  return pulito || fallback;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!richiediAuth(req, res)) return;
  try {
    const { text, voice, format = 'mp3', filename, category, rate, pitch } = await parseBody(req);
    const { buffer } = await generateSpeech({ text, voice, format, rate, pitch });

    const nome = slugSicuro(filename, voice, 80);
    const categoria = slugSicuro(category, 'generale', 40);

    // Destinazione: audio/<cartella>/<timestamp>-<nome>.<formato>
    const blob = await put(`audio/${categoria}/${Date.now()}-${nome}.${format}`, buffer, { access: 'public' });

    const cleanText = String(text).trim();
    const [row] = await sql`
      insert into generations (text, voice, format, size_bytes, url, category)
      values (${cleanText}, ${voice}, ${format}, ${buffer.length}, ${blob.url}, ${categoria})
      returning id, created_at`;

    res.status(201).json({
      id: row.id, url: blob.url, text: cleanText,
      voice, format, filename: nome, category: categoria,
      sizeBytes: buffer.length, createdAt: row.created_at,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};