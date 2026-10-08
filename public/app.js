const $ = (s) => document.querySelector(s);
const previewCache = new Map();
const PREVIEW_TEXT = "Ciao! Questa è un'anteprima della voce selezionata.";
const MAX_BOZZA_CHARS = 1500;
const SOGLIA_MULTI = 3800;
const MAX_BLOCCO = 2200;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function slugBase(s, max = 70) {
  return String(s || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, max);
}

function spezzaTesto(testo, maxLen = MAX_BLOCCO) {
  const frasi = (testo.replace(/\r?\n/g, ' ').match(/[^.!?…]+[.!?…]*/g) || [testo])
    .map((s) => s.trim()).filter(Boolean);
  const blocchi = [];
  let att = '';
  for (let frase of frasi) {
    if (frase.length > maxLen) {
      if (att) { blocchi.push(att); att = ''; }
      while (frase.length > maxLen) {
        let taglio = frase.lastIndexOf(' ', maxLen);
        if (taglio < maxLen * 0.5) taglio = maxLen;
        blocchi.push(frase.slice(0, taglio).trim());
        frase = frase.slice(taglio).trim();
      }
      att = frase;
      continue;
    }
    if (!att) { att = frase; continue; }
    if ((att + ' ' + frase).length > maxLen) { blocchi.push(att); att = frase; }
    else att += ' ' + frase;
  }
  if (att) blocchi.push(att);
  return blocchi;
}

/* ─── Navigazione a schede ─── */
function apriTab(id) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab-view').forEach((v) => { v.hidden = v.id !== id; });
}
document.querySelectorAll('.tab-btn').forEach((btn) =>
  btn.addEventListener('click', () => apriTab(btn.dataset.tab)));

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

/* ══════════════ SCHEDA SINTESI ══════════════ */
const voiceSelect = $('#voice');
const generateBtn = $('#generate-btn');
const previewBtn = $('#preview-btn');
const previewPlayer = $('#preview-player');
const previewWrap = $('#preview-player-wrap');
const workflowStatus = $('#workflow-status');
const rateInput = $('#rate'), pitchInput = $('#pitch');

const categorieNote = new Set();
let bozza = null;

function testoBozza() {
  const t = $('#text').value.trim() || PREVIEW_TEXT;
  return t.slice(0, MAX_BOZZA_CHARS);
}
function firmaParametri() {
  return JSON.stringify([voiceSelect.value, rateInput.value, pitchInput.value, testoBozza()]);
}
function aggiornaStatoWorkflow() {
  const lungh = $('#text').value.trim().length;
  if (!bozza) {
    workflowStatus.textContent = '🎧 1) Regola velocità e tono, poi "Prova (bozza)". 2) Se ti soddisfa: "Genera definitiva".';
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

function fillVoices() {
  voiceSelect.innerHTML = '';
  VOICES.voices.forEach((v) => voiceSelect.add(new Option(v.label, v.id)));
  const nessunaVoce = VOICES.voices.length === 0;
  voiceSelect.disabled = nessunaVoce;
  previewBtn.disabled = nessunaVoce;
  generateBtn.disabled = nessunaVoce;
  if (nessunaVoce) setStatus('⚠️ Nessuna voce configurata: aggiungi le voci in public/voices.js');
}

 $('#text').addEventListener('input', (e) => {
  $('#char-count').textContent = e.target.value.length;
  aggiornaStatoWorkflow();
});
 $('#tts-form').addEventListener('reset', () => {
  $('#char-count').textContent = '0';
  bozza = null;
  aggiornaStatoWorkflow();
});

previewBtn.addEventListener('click', async (e) => {
  const btn = e.currentTarget, voice = voiceSelect.value;
  if (!voice) return;

  const testo = testoBozza();
  if ($('#text').value.trim().length > MAX_BOZZA_CHARS) {
    setStatus(`ℹ️ Bozza limitata ai primi ${MAX_BOZZA_CHARS} caratteri; la generazione sarà completa.`);
  }

  const chiave = firmaParametri();
  const playUrl = (url) => {
    previewPlayer.src = url;
    previewWrap.hidden = false;
    previewPlayer.play().catch(() => setStatus('▶ Premi play sul lettore per ascoltare la bozza.'));
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

 $('#tts-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text) return;
  if (text.length > 4000) {
    setStatus('⚠️ Testo oltre il limite di un file (4000 caratteri): usa la scheda "📚 Multi-file".', true);
    return;
  }

  generateBtn.disabled = true; generateBtn.textContent = '⏳ Generazione…';
  setStatus('Conversione in corso…');
  try {
    const res = await fetch('/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text, voice: voiceSelect.value, format: $('#format').value,
        filename: $('#filename').value, category: $('#category').value,
        rate: rateInput.value, pitch: pitchInput.value,
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

/* ══════════════ SCHEDA MULTI-FILE ══════════════ */
const mfText = $('#mf-text'), mfRate = $('#mf-rate'), mfPitch = $('#mf-pitch');
const mfPreviewBtn = $('#mf-preview-btn');
const mfPreviewPlayer = $('#mf-preview-player');
const mfPreviewWrap = $('#mf-preview-wrap');
const mfWorkflow = $('#mf-workflow');
const mfStart = $('#mf-start');
const mfProgress = $('#mf-progress');
const mfGoHistory = $('#mf-go-history');
let mfBozza = null;

// La bozza del batch usa una voce fissa (i file finali useranno voci casuali):
// ciò che si valida qui è il testo, la velocità e il tono.
const MF_VOCE_BOZZA = VOICES.voices[0];

function mfTestoBozza() { return mfText.value.trim().slice(0, MAX_BOZZA_CHARS); }
function mfFirma() {
  return JSON.stringify([mfRate.value, mfPitch.value, mfTestoBozza()]);
}
function mfAggiornaStato() {
  const lungh = mfText.value.trim().length;
  if (!mfBozza) {
    mfWorkflow.textContent = '🎧 Regola velocità e tono, ascolta la bozza dell\'inizio del testo, poi avvia. I file useranno voci casuali.' +
      (lungh ? '' : ' (Incolla prima il testo.)');
    mfWorkflow.className = 'workflow';
    return;
  }
  if (mfBozza === mfFirma()) {
    mfWorkflow.textContent = '✅ Bozza ascoltata con QUESTE impostazioni: puoi avviare il batch.';
    mfWorkflow.className = 'workflow ok';
  } else {
    mfWorkflow.textContent = '⚠️ Filtri o testo modificati dopo la bozza: ri-ascolta prima di avviare.';
    mfWorkflow.className = 'workflow warn';
  }
}

mfText.addEventListener('input', () => {
  $('#mf-count').textContent = mfText.value.length;
  mfAggiornaStato();
});
mfRate.addEventListener('input', () => {
  $('#mf-rate-val').textContent = Number(mfRate.value).toFixed(2).replace(/\.?0+$/, '') + '×';
  mfAggiornaStato();
});
mfPitch.addEventListener('input', () => {
  const v = Number(mfPitch.value);
  $('#mf-pitch-val').textContent = (v > 0 ? '+' : '') + v;
  mfAggiornaStato();
});

mfPreviewBtn.addEventListener('click', async () => {
  if (!MF_VOCE_BOZZA) return;
  const testo = mfTestoBozza();
  if (!testo) { setStatus('⚠️ Incolla prima il testo lungo.', true); return; }

  const chiave = mfFirma();
  const playUrl = (url) => {
    mfPreviewPlayer.src = url;
    mfPreviewWrap.hidden = false;
    mfPreviewPlayer.play().catch(() => setStatus('▶ Premi play sul lettore per ascoltare la bozza.'));
  };
  if (previewCache.has(chiave)) {
    playUrl(previewCache.get(chiave));
    mfBozza = chiave;
    mfAggiornaStato();
    return;
  }

  mfPreviewBtn.disabled = true; mfPreviewBtn.textContent = '⏳…';
  try {
    const res = await fetch('/api/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice: MF_VOCE_BOZZA.id, text: testo, rate: mfRate.value, pitch: mfPitch.value }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Errore bozza');
    const url = URL.createObjectURL(await res.blob());
    previewCache.set(chiave, url);
    mfBozza = chiave;
    mfAggiornaStato();
    playUrl(url);
  } catch (err) { setStatus(`❌ ${err.message}`, true); }
  finally { mfPreviewBtn.disabled = false; mfPreviewBtn.textContent = '🎧 Prova (inizio)'; }
});

mfStart.addEventListener('click', async () => {
  const testo = mfText.value.trim();
  if (!testo) { setStatus('⚠️ Incolla il testo lungo da suddividere.', true); return; }
  if (mfBozza !== mfFirma()) {
    setStatus('⚠️ Valida prima i filtri con "🎧 Prova (inizio)" (il banner deve essere ✅).', true);
    return;
  }

  const blocchi = spezzaTesto(testo);
  if (blocchi.length < 2) {
    setStatus('ℹ️ Il testo rientra in un unico file: usa la scheda "🎙️ Sintesi".', true);
    return;
  }

  const caratteriTotali = blocchi.reduce((s, b) => s + b.length, 0);
  if (!confirm(
    `📚 MULTI-FILE\n\n` +
    `Il testo sarà suddiviso in ${blocchi.length} file ` +
    `(≈${caratteriTotali.toLocaleString('it-IT')} caratteri in totale),\n` +
    `con voce casuale per ciascun file.\n\n` +
    `Consuma crediti reali. Procedere?`
  )) return;

  mfStart.disabled = true;
  const nomeBase = slugBase($('#mf-filename').value) || 'brano';
  const categoria = slugBase($('#mf-category').value, 40) || 'generale';
  const formato = $('#mf-format').value;
  const cifre = String(blocchi.length).length;

  mfProgress.innerHTML = '';
  mfGoHistory.hidden = true;

  try {
    let generati = 0;
    for (let i = 0; i < blocchi.length; i++) {
      const voce = VOICES.voices[Math.floor(Math.random() * VOICES.voices.length)];
      setStatus(`📚 File ${i + 1}/${blocchi.length} · ${voce.label}…`);

      const res = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: blocchi[i], voice: voce.id, format: formato,
          filename: `${nomeBase}-${String(i + 1).padStart(cifre, '0')}`,
          category: categoria, rate: mfRate.value, pitch: mfPitch.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`File ${i + 1} (${voce.label}): ${data.error || `Errore ${res.status}`}`);
      generati++;

      const riga = document.createElement('div');
      riga.textContent = `✅ ${nomeBase}-${String(i + 1).padStart(cifre, '0')}.${formato} · ${voce.label} · ${(data.sizeBytes / 1024).toFixed(0)} KB`;
      mfProgress.appendChild(riga);
    }

    const fine = document.createElement('div');
    fine.className = 'mf-fine';
    fine.textContent = `— Completato: ${generati}/${blocchi.length} file —`;
    mfProgress.appendChild(fine);
    mfGoHistory.hidden = false;
    mfGoHistory.dataset.category = categoria;
    setStatus(`✅ ${generati} file generati (cartella "📁 ${categoria}").`);
    loadHistory(categoryFilter.value);
  } catch (err) {
    const div = document.createElement('div');
    div.className = 'err';
    div.textContent = `❌ ${err.message} — i file già generati sono al sicuro in cronologia.`;
    mfProgress.appendChild(div);
    setStatus(`❌ ${err.message}`, true);
    loadHistory(categoryFilter.value);
  } finally {
    mfStart.disabled = false;
  }
});

mfGoHistory.addEventListener('click', () => {
  apriTab('tab-cronologia');
  categoryFilter.value = mfGoHistory.dataset.category || '';
  if (categoryFilter.selectedIndex === -1) categoryFilter.value = '';
  loadHistory(categoryFilter.value);
});

/* ══════════════ CRONOLOGIA ══════════════ */
const categoryFilter = $('#category-filter');

function aggiornaFiltroCategorie() {
  const selezione = categoryFilter.value;
  categoryFilter.innerHTML = '';
  categoryFilter.add(new Option('Tutte le cartelle', ''));
  [...categorieNote].sort().forEach((c) => categoryFilter.add(new Option('📁 ' + c, c)));
  categoryFilter.value = selezione;
  if (categoryFilter.selectedIndex === -1) categoryFilter.value = '';

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
  mfAggiornaStato();
});