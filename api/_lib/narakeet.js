const FORMATS = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };
const MAX_TEXT_LENGTH = 3000;   // la generazione deve concludersi nel timeout della function (60s)
const POLL_INTERVAL_MS = 1500;  // frequenza di interrogazione dello stato del task
const TASK_TIMEOUT_MS = 45000;  // limite complessivo del flusso

async function parseBody(req) {
  if (req.body == null) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
  }
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

// Decide se un content-type rappresenta audio vero (mai JSON, mai testo)
function èAudio(contentType) {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  if (ct.includes('json') || ct.startsWith('text/')) return false;
  return true; // audio/*, application/octet-stream, binary/octet-stream, ecc.
}

// Raccoglie ricorsivamente tutte le stringhe-URL dentro un oggetto JSON
function trovaUrl(obj, out = []) {
  if (typeof obj === 'string') {
    if (/^https?:\/\//i.test(obj)) out.push(obj);
  } else if (Array.isArray(obj)) {
    for (const v of obj) trovaUrl(v, out);
  } else if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) trovaUrl(v, out);
  }
  return out;
}

// Scarica un URL e restituisce il buffer SOLO se è audio plausibile
async function scaricaSeAudio(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    if (!èAudio(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Guardia finale: un file audio non inizia con '{' e non è minuscolo
    if (buf.length < 1000 || buf[0] === 0x7b) return null;
    return buf;
  } catch {
    return null;
  }
}

async function generateSpeech({ text, voice, format = 'mp3' }) {
  const contentType = FORMATS[format];
  if (!contentType) throw Object.assign(new Error(`Formato non supportato: ${format}`), { status: 400 });

  if (!process.env.NARAKEET_API_KEY) {
    throw Object.assign(new Error('NARAKEET_API_KEY non configurata'), { status: 500 });
  }

  text = String(text || '').trim();
  if (!text) throw Object.assign(new Error('Testo mancante'), { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) {
    throw Object.assign(new Error(`Testo troppo lungo (max ${MAX_TEXT_LENGTH} caratteri)`), { status: 400 });
  }
  if (!voice) throw Object.assign(new Error('Voce mancante'), { status: 400 });

  // ═══ 1) CREAZIONE DEL TASK ═══
  // Contratto verificato empiricamente dall'audit: corpo JSON → Narakeet crea
  // il task e risponde { taskId, statusUrl } (o, se supportato, audio diretto).
  const create = await fetch(`https://api.narakeet.com/text-to-speech/${format}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': contentType,
      'x-api-key': process.env.NARAKEET_API_KEY,
    },
    body: JSON.stringify({ voice, text }),
  });

  const createType = create.headers.get('content-type') || '';

  // Caso fortunato: audio direttamente nella risposta
  if (create.ok && !createType.includes('json')) {
    return { buffer: Buffer.from(await create.arrayBuffer()), contentType: createType };
  }

  const createBody = await create.text();
  if (!create.ok) {
    throw Object.assign(
      new Error(`Narakeet (creazione task): ${create.status} – ${createBody.slice(0, 200)}`),
      { status: create.status }
    );
  }

  let task;
  try { task = JSON.parse(createBody); } catch {
    throw Object.assign(new Error(`Risposta inattesa da Narakeet: ${createBody.slice(0, 200)}`), { status: 502 });
  }
  if (!task.statusUrl) {
    throw Object.assign(new Error(`Task creato ma senza statusUrl: ${createBody.slice(0, 200)}`), { status: 502 });
  }

  // ═══ 2) ATTESA DEL RISULTATO ═══
  // Interroga lo statusUrl finché non arriva audio (diretto o via redirect)
  // oppure il JSON di stato contiene l'URL del risultato da scaricare.
  const inizio = Date.now();
  let ultimoStato = '';
  while (Date.now() - inizio < TASK_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let poll;
    try {
      poll = await fetch(task.statusUrl, { redirect: 'follow' });
    } catch {
      continue; // errore di rete momentaneo: riprova al prossimo giro
    }

    const pollType = poll.headers.get('content-type') || '';

    // Il risultato arriva come audio nella risposta dello statusUrl stesso
    if (èAudio(pollType)) {
      const buf = Buffer.from(await poll.arrayBuffer());
      if (buf.length >= 1000 && buf[0] !== 0x7b) {
        return { buffer: buf, contentType: pollType };
      }
    }

    const pollBody = await poll.text();
    ultimoStato = pollBody;

    let stato = null;
    try { stato = JSON.parse(pollBody); } catch { /* non-JSON: riprova */ }

    if (stato) {
      // Prova tutti gli URL presenti nella risposta (resultUrl, outputUrl, ...)
      for (const u of trovaUrl(stato)) {
        if (u === task.statusUrl) continue;
        const buf = await scaricaSeAudio(u);
        if (buf) return { buffer: buf, contentType };
      }
      // Se lo stato dichiara un fallimento, esci subito con il messaggio
      const s = String(stato.status || stato.state || '');
      if (/fail|error|cancelled|canceled/i.test(s)) {
        throw Object.assign(new Error(`Task Narakeet fallito: ${pollBody.slice(0, 300)}`), { status: 502 });
      }
    }
  }

  throw Object.assign(
    new Error(`Timeout (${TASK_TIMEOUT_MS / 1000}s) in attesa del task Narakeet. Ultimo stato: ${ultimoStato.slice(0, 200)}`),
    { status: 504 }
  );
}

module.exports = { FORMATS, generateSpeech, parseBody };