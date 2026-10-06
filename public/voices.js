// ─── Sonora · Voci italiane (Google Cloud Text-to-Speech) ───
// Elenco verificato con l'API ufficiale:
//   curl "https://texttospeech.googleapis.com/v1/voices?key=...&languageCode=it-IT"
//
// • Neural2 + Wavenet: incluse nel free tier (1 milione di caratteri/mese)
// • Chirp3-HD (30 voci, qualità superiore): potrebbero essere A PAGAMENTO.
//   Per provarle: metti INCLUDI_CHIRP3 = true, fai un'anteprima e controlla
//   Console Google Cloud → Fatturazione → Report. Se compaiono addebiti,
//   riporta il flag su false e ridistribuisci.

const INCLUDI_CHIRP3 = false;

const VOCI_FREE = [
  { id: "it-IT-Neural2-A", label: "Voce A — donna (Neural2)" },
  { id: "it-IT-Neural2-E", label: "Voce E — donna (Neural2)" },
  { id: "it-IT-Neural2-F", label: "Voce F — uomo (Neural2)" },
  { id: "it-IT-Wavenet-E", label: "Voce W-E — donna (Wavenet)" },
  { id: "it-IT-Wavenet-F", label: "Voce W-F — uomo (Wavenet)" },
];

const VOCI_CHIRP3 = [
  { id: "it-IT-Chirp3-HD-Achernar",      label: "Achernar — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Achird",        label: "Achird — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Algenib",       label: "Algenib — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Algieba",       label: "Algieba — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Alnilam",       label: "Alnilam — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Aoede",         label: "Aoede — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Autonoe",       label: "Autonoe — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Callirrhoe",    label: "Callirrhoe — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Charon",        label: "Charon — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Despina",       label: "Despina — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Enceladus",     label: "Enceladus — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Erinome",       label: "Erinome — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Fenrir",        label: "Fenrir — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Gacrux",        label: "Gacrux — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Iapetus",       label: "Iapetus — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Kore",          label: "Kore — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Laomedeia",     label: "Laomedeia — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Leda",          label: "Leda — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Orus",          label: "Orus — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Puck",          label: "Puck — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Pulcherrima",   label: "Pulcherrima — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Rasalgethi",    label: "Rasalgethi — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Sadachbia",     label: "Sadachbia — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Sadaltager",    label: "Sadaltager — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Schedar",       label: "Schedar — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Sulafat",       label: "Sulafat — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Umbriel",       label: "Umbriel — uomo (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Vindemiatrix",  label: "Vindemiatrix — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Zephyr",        label: "Zephyr — donna (Chirp3 HD)" },
  { id: "it-IT-Chirp3-HD-Zubenelgenubi", label: "Zubenelgenubi — uomo (Chirp3 HD)" },
];

const VOICES = {
  preview: "Ciao! Questa è un'anteprima della voce selezionata.",
  voices: INCLUDI_CHIRP3 ? [...VOCI_FREE, ...VOCI_CHIRP3] : VOCI_FREE,
};