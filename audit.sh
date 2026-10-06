#!/bin/bash
# ══════ AUDIT SONORA (Google TTS) — report completo in un colpo ══════
BASE="https://sonora-pied-nu.vercel.app"   # ← dominio stabile del progetto

rm -f /tmp/p-voce-*.mp3 /tmp/tts.json /tmp/blob.mp3

echo "═════════ AUDIT SONORA ════════"
echo ""
echo "── T0 · Stato del codice ──"
git status -sb | head -3
git log --oneline -3
echo ""

echo "── T1 · Variabili d'ambiente (/api/health) ──"
curl -s "$BASE/api/health"; echo; echo ""

echo "── T2 · Database (/api/history) ──"
curl -s -w " [HTTP %{http_code}]" "$BASE/api/history"; echo; echo ""

echo "── T3a · Google TTS, voce A (donna) ──"
C=$(curl -s -w "%{http_code}" -X POST "$BASE/api/preview" -H "Content-Type: application/json" \
  -d '{"voice":"it-IT-Neural2-A"}' -o /tmp/p-voce-a.mp3)
echo "HTTP $C · $(wc -c < /tmp/p-voce-a.mp3 | tr -d ' ') bytes · $(file -b /tmp/p-voce-a.mp3 | cut -c1-60)"
echo ""

echo "── T3b · Google TTS, voce F (uomo) ──"
C=$(curl -s -w "%{http_code}" -X POST "$BASE/api/preview" -H "Content-Type: application/json" \
  -d '{"voice":"it-IT-Neural2-F"}' -o /tmp/p-voce-f.mp3)
echo "HTTP $C · $(wc -c < /tmp/p-voce-f.mp3 | tr -d ' ') bytes · $(file -b /tmp/p-voce-f.mp3 | cut -c1-60)"
echo ""

echo "── T4 · Pipeline completa (/api/tts) ──"
C=$(curl -s -w "%{http_code}" -X POST "$BASE/api/tts" -H "Content-Type: application/json" \
  -d '{"text":"Prova di audit di Sonora.","voice":"it-IT-Neural2-A","format":"mp3"}' -o /tmp/tts.json)
echo "HTTP $C · risposta: $(cat /tmp/tts.json | cut -c1-300)"
echo ""

URL=$(grep -o 'https://[^"]*' /tmp/tts.json | head -1)
if [ -n "$URL" ]; then
  echo "── T5 · Scaricamento file dal Blob ──"
  C=$(curl -s -w "%{http_code}" "$URL" -o /tmp/blob.mp3)
  echo "HTTP $C · $(wc -c < /tmp/blob.mp3 | tr -d ' ') bytes · $(file -b /tmp/blob.mp3 | cut -c1-60)"
else
  echo "── T5 · saltato (T4 non ha prodotto un URL) ──"
fi
echo ""
echo "Ascolto di conferma:"
echo "  afplay /tmp/p-voce-a.mp3"
echo "  afplay /tmp/p-voce-f.mp3"
echo ""
echo "═════════ FINE — incolla tutto questo nella chat ═════════"