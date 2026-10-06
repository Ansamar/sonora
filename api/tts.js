const { put } = require('@vercel/blob');
const { neon } = require('@neondatabase/serverless');
const { generateSpeech, parseBody } = require('./_lib/tts-provider');

const sql = neon(process.env.DATABASE_URL);

// Rende il nome sicuro per un percorso file: lettere, numeri, trattini; max 80 caratteri
function nomeFileSicuro(nome, fallback) {
  const pulito = String(nome || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return pulito || fallback;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { text, voice, format = 'mp3', filename } = await parseBody(req);
    const { buffer } = await generateSpeech({ text, voice, format });

    const nome = nomeFileSicuro(filename, voice);
    const blob = await put(`audio/${Date.now()}-${nome}.${format}`, buffer, { access: 'public' });

    const cleanText = String(text).trim();
    const [row] = await sql`
      insert into generations (text, voice, format, size_bytes, url)
      values (${cleanText}, ${voice}, ${format}, ${buffer.length}, ${blob.url})
      returning id, created_at`;

    res.status(201).json({
      id: row.id, url: blob.url, text: cleanText,
      voice, format, filename: nome, sizeBytes: buffer.length, createdAt: row.created_at,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};