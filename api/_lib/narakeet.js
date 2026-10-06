const FORMATS = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };
const MAX_TEXT_LENGTH = 3000; // limite prudente per l'API sincrona

async function parseBody(req) {
  if (req.body == null) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
  }
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

async function generateSpeech({ text, voice, format = 'mp3' }) {
  const contentType = FORMATS[format];
  if (!contentType) throw Object.assign(new Error(`Formato non supportato: ${format}`), { status: 400 });

  if (!process.env.NARAKEET_API_KEY) {
    throw Object.assign(new Error('NARAKEET_API_KEY non configurata'), { status: 500 });
  }

  text = String(text || '').trim();
  if (!text) throw Object.assign(new Error('Testo mancante'), { status: 400 });
  if (text.length > MAX_TEXT_LENGTH)
    throw Object.assign(new Error(`Testo troppo lungo (max ${MAX_TEXT_LENGTH} caratteri nell'API sincrona)`), { status: 400 });
  if (!voice) throw Object.assign(new Error('Voce mancante'), { status: 400 });

  // ═══ API SINCRONA: testo nel corpo come testo semplice, voce nella query string ═══
  const res = await fetch(
    `https://api.narakeet.com/text-to-speech/${format}?voice=${encodeURIComponent(voice)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Accept': contentType,
        'x-api-key': process.env.NARAKEET_API_KEY,
      },
      body: text,
    }
  );

  // Controllo di sanità: se Narakeet risponde con JSON, non è audio → errore leggibile
  const resType = res.headers.get('content-type') || '';
  if (resType.includes('application/json')) {
    const info = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error(`Narakeet ha risposto con JSON invece di audio (HTTP ${res.status}): ${JSON.stringify(info).slice(0, 300)}`),
      { status: 502 }
    );
  }

  if (!res.ok) {
    const detail = await res.text();
    throw Object.assign(new Error(`Narakeet: ${res.status} – ${detail.slice(0, 200)}`), { status: res.status });
  }

  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
}

module.exports = { FORMATS, generateSpeech, parseBody };