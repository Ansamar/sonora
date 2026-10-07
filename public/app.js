const $ = (s) => document.querySelector(s);
const previewCache = new Map();
const PREVIEW_TEXT = "Ciao! Questa è un'anteprima della voce selezionata.";
const MAX_BOZZA_CHARS = 1500;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const voiceSelect = $('#voice');
const generateBtn = $('#generate-btn');
const previewBtn = $('#preview-btn');
const previewPlayer = $('#preview-player');
const previewWrap = $('#preview-player-wrap');
const categoryFilter = $('#category-filter');
const workflowStatus = $('#workflow-status');
const rateInput = $('#rate'), pitchInput = $('#pitch');

// Categorie mai viste: si riempie solo con il caricamento completo (senza filtro)
const categorieNote = new Set();

/* ─── Workflow: bozza ascoltata vs impostazioni correnti ─── */
// "bozza" = firma dei parametri con cui è stata generata l'ultima bozza ascoltata
let bozza = null;

function testoBozza() {
  const t = $('#text').value.trim() || PREVIEW_TEXT;
  return t.slice(0, MAX_BOZZA_CHARS);
}

// Firma completa: voce + velocità + tono + testo. Cambia QUALSIASI cosa → cambia firma
function firmaParametri() {
  return JSON.stringify([voiceSelect.value, rateInput.value, pitchInput.value, testoBozza()]);
}

function aggiornaStatoWorkflow() {
  if (!bozza) {
    workflowStatus.textContent = '🎧 1) Regola velocità e tono, poi "Prova (bozza)" per ascoltare il tuo testo. 2) Se ti soddisfa: "Genera definitiva".';
    workflowStatus.className = 'workflow';
    return;
  }
  if (bozza === firmaParametri()) {
    workflowStatus.textContent = '✅ Bozza ascoltata con QUESTE impostazioni: se ti soddisfa, genera il file definitivo.';
    workflowStatus.className = 'workflow ok';
  } else {
    workflowStatus.textContent = '⚠️ Filtri o testo modificati dopo la bozza: ri-ascolta prima di generare.';
    workflowStatus.className = 'workflow warn';
  }
}

/* ─── Cursori velocità e tono ─── */
rateInput.addEventListener('input', () => {
  $('#rate-val').textContent = Number(rateInput.value).toFixed(2).replace(/\.?0+$/, '') + '×';
  aggiornaStatoWorkflow();
});
pitchInput.addEventListener('input', () => {
  const v = Number(pitchInput.value);
  $('#pitch-val').textContent = (v > 0 ? '+' : '') + v;
  aggiornaStatoWorkflow();
});
voiceSelect.addEventListener('change', aggiornaStatoWorkflow);

/* ─── Pulsanti velocità di riproduzione (1× / 1.25× / 1.5× / 2×) ─── */
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
  target.addEventListener('loadedmetadata', () => {
    target.playbackRate = 1;
    row.querySelectorAll('.speed-btn').forEach((x) => x.classList.remove('active'));
  });
}
document.querySelectorAll('.speed-row').forEach(creaSpeedRow);

/* ─── Popola il menu voci (e gestisce il caso "nessuna voce") ─── */
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
 $('#text').addEventListener('input', (e) => {
  $('#char-count').textContent = e.target.value.length;
  aggiornaStatoWorkflow();
});
 $('#tts-form').addEventListener('reset', () => {
  $('#char-count').textContent = '0';
  bozza = null;
  aggiornaStatoWorkflow();
});

/* --- BOZZA: legge il testo reale con voce, velocità e tono correnti --- */
previewBtn.addEventListener('click', async (e) => {
  const btn = e.currentTarget, voice = voiceSelect.value;
  if (!voice) return;

  const testo = testoBozza();
  if ($('#text').value.trim().length > MAX_BOZZA_CHARS) {
    setStatus(`ℹ️ Bozza limitata ai primi ${MAX_BOZZA_CHARS} caratteri; il file definitivo sarà completo.`);
  }

  const chiave = firmaParametri();
  const playUrl = (url) => {
    previewPlayer.src = url;
    previewWrap.hidden = false;
    previewPlayer.play().catch(() => {
      setStatus("▶ Premi play sul lettore qui sotto per ascoltare la bozza.");
    });
  };

  if (previewCache.has(chiave)) {
    playUrl(previewCache.get(chiave));
    bozza = chiave;
    aggiornaStatoWorkflow();
    return;
  }

  btn.disabled = true; btn.textContent = '⏳…';
  try {
    const res = await fetch('/api/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice, text: testo, rate: rateInput.value, pitch: pitchInput.value }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Errore bozza');
    const url = URL.createObjectURL(await res.blob());
    previewCache.set(chiave, url);
    if (previewCache.size > 12) {
      const prima = previewCache.keys().next().value;
      URL.revokeObjectURL(previewCache.get(prima));
      previewCache.delete(prima);
    }
    bozza = chiave;
    aggiornaStatoWorkflow();
    playUrl(url);
  } catch (err) { setStatus(`❌ ${err.message}`, true); }
  finally { btn.disabled = false; btn.textContent = '🎧 Prova (bozza)'; }
});

/* --- GENERAZIONE DEFINITIVA --- */
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
    setStatus('✅ FILE DEFINITIVO creato: ascoltalo qui sopra o scaricalo.');
    loadHistory(categoryFilter.value);
  } catch (err) { setStatus(`❌ ${err.message}`, true); }
  finally { generateBtn.disabled = false; generateBtn.textContent = '✅ Genera definitiva'; }
});

/* --- Cronologia --- */
function aggiornaFiltroCategorie() {
  const selezione = categoryFilter.value;
  categoryFilter.innerHTML = '';
  categoryFilter.add(new Option('Tutte le cartelle', ''));
  [...categorieNote].sort().forEach((c) => categoryFilter.add(new Option('📁 ' + c, c)));
  categoryFilter.value = selezione;
  if (categoryFilter.selectedIndex === -1) categoryFilter.value = '';

  // Suggerimenti automatici nel campo Cartella (datalist)
  const dl = $('#cartelle-esistenti');
  dl.innerHTML = '';
  [...categorieNote].sort().forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    dl.appendChild(opt);
  });
}

async function loadHistory(categoria = '') {
  try {
    const q = categoria ? `?category=${encodeURIComponent(categoria)}` : '';
    const rows = await (await fetch('/api/history' + q)).json();

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
  aggiornaStatoWorkflow();
});