// ─── Sonora · Voci italiane (Google Cloud Text-to-Speech) ───
// Elenco ottenuto dall'API ufficiale:
//   curl "https://texttospeech.googleapis.com/v1/voices?key=...&languageCode=it-IT"
// Famiglia Neural2: qualità neurale naturale, inclusa nel free tier
// (1 milione di caratteri/mese). Catalogo completo:
//   https://cloud.google.com/text-to-speech/docs/voices

const VOICES = {
  preview: "Ciao! Questa è un'anteprima della voce selezionata.",
  voices: [
    { id: "it-IT-Neural2-A", label: "Voce A — donna" },
    { id: "it-IT-Neural2-E", label: "Voce E — donna" },
    { id: "it-IT-Neural2-F", label: "Voce F — uomo" },
  ],
  // Nota: esiste anche la famiglia Chirp3-HD (33 voci, qualità superiore),
  // MA potrebbe non essere inclusa nel free tier: da aggiungere solo dopo
  // aver verificato i prezzi su cloud.google.com/text-to-speech/pricing
};