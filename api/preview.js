const { generateSpeech, parseBody } = require('./_lib/tts-provider');

// Anteprima breve: non salva nulla né su Blob né su DB
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { voice, text = "Ciao! Questa è un'anteprima della voce selezionata." } = await parseBody(req);
    const { buffer, contentType } = await generateSpeech({
      text: String(text).slice(0, 200), voice, format: 'mp3',
    });
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};