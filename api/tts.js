const { put } = require('@vercel/blob');
const { neon } = require('@neondatabase/serverless');
const { generateSpeech, parseBody } = require('./_lib/tts-provider');

const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { text, voice, format = 'mp3' } = await parseBody(req);
    const { buffer } = await generateSpeech({ text, voice, format });

    // 1. Salva il file audio su Vercel Blob
    const blob = await put(`audio/${Date.now()}-${voice}.${format}`, buffer, { access: 'public' });

    // 2. Registra i metadati in Postgres
    const cleanText = String(text).trim();
    const [row] = await sql`
      insert into generations (text, voice, format, size_bytes, url)
      values (${cleanText}, ${voice}, ${format}, ${buffer.length}, ${blob.url})
      returning id, created_at`;

    res.status(201).json({
      id: row.id, url: blob.url, text: cleanText,
      voice, format, sizeBytes: buffer.length, createdAt: row.created_at,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};