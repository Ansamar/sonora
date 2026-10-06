#!/bin/bash
# ══════ AUDIT SONORA (Google TTS + auth) ══════
BASE="https://sonora-pied-nu.vercel.app"
PW="${SONORA_PASSWORD:-}"

rm -f /tmp/p-voce-*.mp3 /tmp/tts.json /tmp/blob.mp3 /tmp/cookies.txt

echo "═════════ AUDIT SONORA ════════"
echo ""
echo "── T0 · Stato del codice ──"
git status -sb | head -3
git log --oneline -3
echo ""

echo "── T0b · Login ──"
if [ -z "$PW" ]; then
  echo "⚠️  Passa la password:  export SONORA_PASSWORD='...' bash audit.sh"
  C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/login" -H "Content-Type: application/json" -d '{"password":"x"}')
  echo "POST login (password errata) → HTTP $C (atteso 401)"
else
  C=$(curl -s -c /tmp/cookies.txt -o /dev/null -w "%{http_code}" -X POST "$BASE/api/login" -H "Content-Type: application/json" -d "{\"password\":\"$PW\"}")
  echo "POST login (password giusta) → HTTP $C (atteso 200)"
fi
C=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/history")
echo "GET history SENZA cookie → HTTP $C (atteso 401)"
echo ""

if [ ! -f /tmp/cookies.txt ]; then
  echo "── T2-T5 saltati: serve il login ──"
  echo "═════════ FINE ═════════"; exit 0
fi

echo "── T1 · Variabili d'ambiente (/api/health) ──"
curl -s "$BASE/api/health"; echo; echo ""

echo "── T2 · Database (/api/history) ──"
curl -s -b /tmp/cookies.txt -w " [HTTP %{http_code}]" "$BASE/api/history" | cut -c1-200; echo; echo ""

echo "── T3a · voce A (donna, rate 0.8) ──"
C=$(curl -s -b /tmp/cookies.txt -w "%{http_code}" -X POST "$BASE/api/preview" -H "Content-Type: application/json" \
  -d '{"voice":"it-IT-Neural2-A","rate":0.8}' -o /tmp/p-voce-a.mp3)
echo "HTTP $C · $(wc -c < /tmp/p-voce-a.mp3 | tr -d ' ') bytes · $(file -b /tmp/p-voce-a.mp3 | cut -c1-60)"
echo ""

echo "── T3b · voce F (uomo, rate 1.3) ──"
C=$(curl -s -b /tmp/cookies.txt -w "%{http_code}" -X POST "$BASE/api/preview" -H "Content-Type: application/json" \
  -d '{"voice":"it-IT-Neural2-F","rate":1.3}' -o /tmp/p-voce-f.mp3)
echo "HTTP $C · $(wc -c < /tmp/p-voce-f.mp3 | tr -d ' ') bytes · $(file -b /tmp/p-voce-f.mp3 | cut -c1-60)"
echo ""

echo "── T4 · Pipeline completa (/api/tts) ──"
C=$(curl -s -b /tmp/cookies.txt -w "%{http_code}" -X POST "$BASE/api/tts" -H "Content-Type: application/json" \
  -d '{"text":"Prova di audit di Sonora.","voice":"it-IT-Neural2-A","format":"mp3","filename":"audit","category":"test"}' -o /tmp/tts.json)
echo "HTTP $C · risposta: $(cat /tmp/tts.json | cut -c1-300)"
echo ""

ID=$(grep -o '"id":[0-9]*' /tmp/tts.json | head -1 | cut -d: -f2)
if [ -n "$ID" ]; then
  echo "── T5 · Download dal server (id=$ID) ──"
  C=$(curl -s -b /tmp/cookies.txt -w "%{http_code}" "$BASE/api/download?id=$ID" -o /tmp/blob.mp3 -D /tmp/dl-h.txt)
  echo "HTTP $C · $(wc -c < /tmp/blob.mp3 | tr -d ' ') bytes · $(file -b /tmp/blob.mp3 | cut -c1-60)"
  grep -i 'content-disposition' /tmp/dl-h.txt
else
  echo "── T5 · saltato (T4 non ha prodotto un id) ──"
fi
echo ""
echo "Ascolto di conferma:"
echo "  afplay /tmp/p-voce-a.mp3   (lenta)"
echo "  afplay /tmp/p-voce-f.mp3   (veloce)"
echo ""
echo "═════════ FINE — incolla tutto questo nella chat ═════════"