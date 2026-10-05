const FORMATS = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };
const MAX_TEXT_LENGTH = 10000; // adatta ai limiti del tuo piano Narakeet

// Estrae il JSON dal body della richiesta (Vercel può passarlo già parsato o come stream)
async function parseBody(req) {
  if (req.body == null) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
  }
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

// Chiama Narakeet e restituisce il buffer audio
async function generateSpeech({ text, voice, format = 'mp3' }) {
  const contentType = FORMATS[format];
  if (!contentType) throw Object.assign(new Error(`Formato non supportato: ${format}`), { status: 400 });

  text = String(text || '').trim();
  if (!text) throw Object.assign(new Error('Testo mancante'), { status: 400 });
  if (text.length > MAX_TEXT_LENGTH)
    throw Object.assign(new Error(`Testo troppo lungo (max ${MAX_TEXT_LENGTH} caratteri)`), { status: 400 });
  if (!voice) throw Object.assign(new Error('Voce mancante'), { status: 400 });

  const res = await fetch(`https://api.narakeet.com/text-to-speech/${format}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': contentType,
      'x-api-key': process.env.NARAKEET_API_KEY,
    },
    body: JSON.stringify({ voice, text }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw Object.assign(new Error(`Narakeet: ${res.status} – ${detail.slice(0, 200)}`), { status: res.status });
  }
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
}

module.exports = { FORMATS, generateSpeech, parseBody };