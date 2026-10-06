const $ = (s) => document.querySelector(s);
const previewCache = new Map();
const PREVIEW_TEXT = "Ciao! Questa è un'anteprima della voce selezionata.";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const voiceSelect = $('#voice');
const generateBtn = $('#generate-btn');
const previewBtn = $('#preview-btn');
const previewPlayer = $('#preview-player');
const previewWrap = $('#preview-player-wrap');

/* --- Popola il menu voci (e gestisce il caso "nessuna voce") --- */
function fillVoices() {
  voiceSelect.innerHTML = '';
  VOICES.voices.forEach((v) => voiceSelect.add(new Option(v.label, v.id)));

  const nessunaVoce = VOICES.voices.length === 0;
  voiceSelect.disabled = nessunaVoce;
  previewBtn.disabled = nessunaVoce;
  generateBtn.disabled = nessunaVoce;
  if (nessunaVoce) {
    setStatus('⚠️ Nessuna voce configurata: aggiungi le voci in public/voices.js');
  }
}

/* --- Contatore caratteri --- */
 $('#text').addEventListener('input', (e) => { $('#char-count').textContent = e.target.value.length; });
 $('#tts-form').addEventListener('reset', () => { $('#char-count').textContent = '0'; });

/* --- Anteprima voce: lettore visibile in pagina --- */
previewBtn.addEventListener('click', async (e) => {
  const btn = e.currentTarget, voice = voiceSelect.value;
  if (!voice) return;

  const playUrl = (url) => {
    previewPlayer.src = url;
    previewWrap.hidden = false;
    previewPlayer.play().catch(() => {
      setStatus("▶ Premi play sul lettore qui sotto per ascoltare l'anteprima.");
    });
  };

  if (previewCache.has(voice)) return playUrl(previewCache.get(voice));

  btn.disabled = true; btn.textContent = '⏳…';
  try {
    const res = await fetch('/api/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice, text: PREVIEW_TEXT }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Errore anteprima');
    const url = URL.createObjectURL(await res.blob());
    previewCache.set(voice, url);
    playUrl(url);
  } catch (err) { setStatus(`❌ ${err.message}`, true); }
  finally { btn.disabled = false; btn.textContent = '▶ Anteprima'; }
});

/* --- Generazione --- */
 $('#tts-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text) return;

  generateBtn.disabled = true; generateBtn.textContent = '⏳ Generazione…';
  setStatus('Conversione in corso…');

  try {
    const res = await fetch('/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: voiceSelect.value,
        format: $('#format').value,
        filename: $('#filename').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);

    const nomeCompleto = `${data.filename}.${data.format}`;
    $('#audio-player').src = data.url;
    $('#download-btn').href = data.url;
    $('#download-btn').dataset.filename = nomeCompleto;
    $('#result-info').textContent =
      `${nomeCompleto} · ${data.voice} · ${(data.sizeBytes / 1024).toFixed(0)} KB`;
    $('#result').hidden = false;
    setStatus('✅ Audio generato e salvato in cronologia.');
    loadHistory();
  } catch (err) { setStatus(`❌ ${err.message}`, true); }
  finally { generateBtn.disabled = false; generateBtn.textContent = '🔊 Genera audio'; }
});

/* --- Download con nome esatto (l'attributo download funziona solo same-origin:
       scarichiamo il file via fetch e usiamo un URL locale) --- */
document.addEventListener('click', async (e) => {
  const a = e.target.closest('a[data-filename]');
  if (!a || !a.dataset.filename) return;
  e.preventDefault();
  try {
    const res = await fetch(a.href);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const tmp = document.createElement('a');
    tmp.href = url;
    tmp.download = a.dataset.filename;
    document.body.appendChild(tmp);
    tmp.click();
    tmp.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    window.open(a.href, '_blank'); // fallback: download con nome del percorso Blob
  }
});

/* --- Cronologia --- */
// Recupera il nome dal percorso Blob: /audio/<timestamp>-<nome>.<ext>
function nomeDaUrl(url, formato) {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return base.replace(/^\d+-/, '').replace(/\.[a-z0-9]+$/i, '') + '.' + formato;
  } catch { return ''; }
}

async function loadHistory() {
  try {
    const rows = await (await fetch('/api/history')).json();
    const ul = $('#history');
    ul.innerHTML = rows.length ? '' : '<li class="empty">Nessuna generazione ancora.</li>';

    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="history-head">
          <span>🔊 ${esc(r.voice)}</span>
          <span>${new Date(r.created_at).toLocaleString('it-IT')}</span>
        </div>
        <p class="snippet">“${esc(r.text.length > 90 ? r.text.slice(0, 90) + '…' : r.text)}”</p>
        <div class="history-actions">
          <audio controls preload="none" src="${esc(r.url)}"></audio>
          <a href="${esc(r.url)}?download=1" class="btn ghost" data-filename="${esc(nomeDaUrl(r.url, r.format))}" title="Scarica">⬇️</a>
          <span class="size">${r.format.toUpperCase()} · ${(r.size_bytes / 1024).toFixed(0)} KB</span>
          <button class="btn danger" data-id="${r.id}" title="Elimina">🗑️</button>
        </div>`;
      li.querySelector('[data-id]').addEventListener('click', () => deleteGeneration(r.id));
      ul.appendChild(li);
    });
  } catch { setStatus('❌ Impossibile caricare la cronologia', true); }
}

async function deleteGeneration(id) {
  if (!confirm('Eliminare questa generazione?')) return;
  await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
  loadHistory();
}

function setStatus(msg, isError = false) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

fillVoices();
loadHistory();