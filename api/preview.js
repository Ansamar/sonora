const { generateSpeech, parseBody } = require('./_lib/tts-provider');
const { richiediAuth } = require('./_lib/auth');

const MAX_PREVIEW_CHARS = 1500;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!richiediAuth(req, res)) return;
  try {
    const { voice, text, rate, pitch } = await parseBody(req);

    // Bozza: legge il testo reale dell'utente (troncato), o la frase campione se vuoto
    const sorgente = String(text || '').trim()
      || "Ciao! Questa è un'anteprima della voce selezionata.";

    // FIX: rate e pitch ora vengono passati a Google (prima erano ignorati)
    const { buffer, contentType } = await generateSpeech({
      text: sorgente.slice(0, MAX_PREVIEW_CHARS),
      voice,
      format: 'mp3',
      rate,
      pitch,
    });

    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};