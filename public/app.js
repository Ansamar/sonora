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
const categoryFilter = $('#category-filter');

// Categorie mai viste: si riempie solo con il caricamento completo (senza filtro)
const categorieNote = new Set();

/* ─── Miglioria 2: velocità e tono ─── */
const rateInput = $('#rate'), pitchInput = $('#pitch');
rateInput.addEventListener('input', () => {
  $('#rate-val').textContent = Number(rateInput.value).toFixed(2).replace(/\.?0+$/, '') + '×';
});
pitchInput.addEventListener('input', () => {
  const v = Number(pitchInput.value);
  $('#pitch-val').textContent = (v > 0 ? '+' : '') + v;
});

/* ─── Miglioria 7: pulsanti velocità di riproduzione ─── */
const VELOCITA = [1, 1.25, 1.5, 2];
function creaSpeedRow(row) {
  const target = document.querySelector(`#${row.dataset.for}`);
  row.innerHTML = '';
  VELOCITA.forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'speed-btn';
    b.textContent = v + '×';
    b.addEventListener('click', () => {
      target.playbackRate = v;
      row.querySelectorAll('.speed-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    row.appendChild(b);
  });
  // Reset a 1× quando cambia la sorgente audio
  target.addEventListener('loadedmetadata', () => {
    target.playbackRate = 1;
    row.querySelectorAll('.speed-btn').forEach((x) => x.classList.remove('active'));
  });
}
document.querySelectorAll('.speed-row').forEach(creaSpeedRow);

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
      body: JSON.stringify({ voice, text: PREVIEW_TEXT, rate: rateInput.value, pitch: pitchInput.value }),
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
        category: $('#category').value,
        rate: rateInput.value,
        pitch: pitchInput.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);

    const nomeCompleto = `${data.filename}.${data.format}`;
    $('#audio-player').src = data.url;
    $('#download-btn').href = `/api/download?id=${data.id}`;
    $('#result-info').textContent =
      `📁 ${data.category} · ${nomeCompleto} · ${(data.sizeBytes / 1024).toFixed(0)} KB`;
    $('#result').hidden = false;
    setStatus('✅ Audio generato e salvato in cronologia.');
    loadHistory(categoryFilter.value);
  } catch (err) { setStatus(`❌ ${err.message}`, true); }
  finally { generateBtn.disabled = false; generateBtn.textContent = '🔊 Genera audio'; }
});

/* --- Cronologia --- */
function aggiornaFiltroCategorie() {
  const selezione = categoryFilter.value;
  categoryFilter.innerHTML = '';
  categoryFilter.add(new Option('Tutte le cartelle', ''));
  [...categorieNote].sort().forEach((c) => categoryFilter.add(new Option('📁 ' + c, c)));
  categoryFilter.value = selezione;
  if (categoryFilter.selectedIndex === -1) categoryFilter.value = '';
}

async function loadHistory(categoria = '') {
  try {
    const q = categoria ? `?category=${encodeURIComponent(categoria)}` : '';
    const rows = await (await fetch('/api/history' + q)).json();

    // L'elenco delle categorie si aggiorna solo quando carichiamo TUTTE le righe
    if (!categoria) {
      categorieNote.clear();
      rows.forEach((r) => categorieNote.add(r.category || 'generale'));
      aggiornaFiltroCategorie();
    }

    const ul = $('#history');
    ul.innerHTML = rows.length ? '' : '<li class="empty">Nessuna generazione ancora.</li>';

    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="history-head">
          <span>📁 ${esc(r.category || 'generale')} · 🔊 ${esc(r.voice)}</span>
          <span>${new Date(r.created_at).toLocaleString('it-IT')}</span>
        </div>
        <p class="snippet">“${esc(r.text.length > 90 ? r.text.slice(0, 90) + '…' : r.text)}”</p>
        <div class="history-actions">
          <audio controls preload="none" src="${esc(r.url)}"></audio>
          <a href="/api/download?id=${r.id}" class="btn ghost" title="Scarica">⬇️</a>
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
  loadHistory(categoryFilter.value);
}

categoryFilter.addEventListener('change', () => loadHistory(categoryFilter.value));

function setStatus(msg, isError = false) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

// L'app si avvia solo dopo il login (auth-ui.js invia l'evento)
document.addEventListener('sonora:auth', () => {
  fillVoices();
  loadHistory();
});