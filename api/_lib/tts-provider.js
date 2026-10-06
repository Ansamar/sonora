const FORMATS = { mp3: 'MP3', wav: 'LINEAR16' };
const CONTENT_TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav' };
const MAX_TEXT_LENGTH = 4000; // l'API sincrona accetta fino a ~5000 byte: margine prudente

async function parseBody(req) {
  if (req.body == null) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
  }
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

// Limita un numero in un intervallo, con valore di default
function limita(val, min, max, def) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// Chiama Google Cloud Text-to-Speech (API sincrona: audio base64 direttamente in risposta).
// La chiave va nella query string, come dimostrato dal test del Punto 1.
async function generateSpeech({ text, voice, format = 'mp3', rate, pitch }) {
  const encoding = FORMATS[format];
  if (!encoding) {
    throw Object.assign(new Error(`Formato non supportato: ${format} (disponibili: mp3, wav)`), { status: 400 });
  }

  if (!process.env.GOOGLE_TTS_API_KEY) {
    throw Object.assign(new Error('GOOGLE_TTS_API_KEY non configurata: aggiungi la variabile su Vercel e fai il redeploy'), { status: 500 });
  }

  text = String(text || '').trim();
  if (!text) throw Object.assign(new Error('Testo mancante'), { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) {
    throw Object.assign(new Error(`Testo troppo lungo (max ${MAX_TEXT_LENGTH} caratteri)`), { status: 400 });
  }
  if (!voice) throw Object.assign(new Error('Voce mancante'), { status: 400 });

  // speakingRate: 0.25–4 (1 = normale) · pitch: -20…+20 semitoni (0 = naturale)
  const speakingRate = limita(rate, 0.25, 4, 1);
  const pitchVal = limita(pitch, -20, 20, 0);

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(process.env.GOOGLE_TTS_API_KEY)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'it-IT', name: voice },
      audioConfig: { audioEncoding: encoding, speakingRate: speakingRate, pitch: pitchVal },
    }),
  });

  const bodyText = await res.text();

  if (!res.ok) {
    // Gli errori di Google sono JSON leggibili: {error: {code, message, status}}
    let msg = bodyText.slice(0, 300);
    try { msg = JSON.parse(bodyText).error.message || msg; } catch { /* mantieni il testo grezzo */ }
    throw Object.assign(new Error(`Google TTS (${res.status}): ${msg}`), { status: 502 });
  }

  let audioBase64;
  try { audioBase64 = JSON.parse(bodyText).audioContent; } catch { audioBase64 = null; }
  if (!audioBase64) {
    throw Object.assign(new Error(`Risposta inattesa da Google: ${bodyText.slice(0, 200)}`), { status: 502 });
  }

  return { buffer: Buffer.from(audioBase64, 'base64'), contentType: CONTENT_TYPES[format] };
}

module.exports = { FORMATS, CONTENT_TYPES, generateSpeech, parseBody };