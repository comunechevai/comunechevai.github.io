// «Il tuo comune in numeri»: scheda di un comune con i numeri di tutti i video pubblicati.
// Il comune arriva solo dal link (comune/?rio-saliceto, comune/?Rio Saliceto, comune/?castro-le): niente ricerca libera,
// la pagina non e' collegata dal sito (decisione di Paolo del 2/11/2026). Con omonimi o refusi propone pochi comuni vicini.
// Dati: window.NUMERI_COMUNI (comune/numeri.js, scritto da sito/costruisci.py):
//   comuni: [[nome, sigla, regione, abitanti, nome ufficiale se diverso]]; ogni video ha valori nello stesso ordine.
(function () {
  const D = window.NUMERI_COMUNI;
  const C = D.comuni;
  const nf = (x, dec) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: dec }).format(x);
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’'`´]/g, '').replace(/[-_+.,/]/g, ' ').replace(/\s+/g, ' ').trim();
  const slug = s => norm(s).replace(/ /g, '-');
  const u = s => (s.unita === '%' ? '' : ' ') + esc(s.unita);   // 2,2% senza spazio, 47 anni con lo spazio
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const box = document.getElementById('scheda');
  const lista = document.getElementById('proposte');

  // valori ordinati di ogni video, per dire quanti comuni hanno un valore più basso
  for (const s of D.schede) if (s.con_valori) s.ordinati = s.valori.filter(v => v !== null).sort((a, b) => a - b);
  function quota(s, v) {          // quota dei comuni con un valore più basso di v
    let lo = 0, hi = s.ordinati.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s.ordinati[m] < v) lo = m + 1; else hi = m; }
    return lo / s.ordinati.length;
  }

  // indice dei nomi: nome, nome ufficiale e sue parti (Bolzano/Bozen)
  const nomi = [];
  C.forEach((r, i) => {
    const chiavi = new Set([norm(r[0])]);
    if (r[4]) { chiavi.add(norm(r[4])); r[4].split('/').forEach(p => chiavi.add(norm(p))); }
    chiavi.forEach(k => k && nomi.push([k, i]));
  });
  // uguali anche senza spazi: «Sant'Agata» = «sant-agata» = «santagata»
  const uguali = n => { const z = n.replace(/ /g, ''); return [...new Set(nomi.filter(([k]) => k.replace(/ /g, '') === z).map(([, i]) => i))]; };
  const sigle = new Set(C.map(r => r[1].toLowerCase()));

  function trova(testo) {
    let q = norm(testo);
    if (!q) return { tipo: 'vuoto' };
    let sigla = null;
    const m = q.match(/^(.*) ([a-z]{2})$/);
    if (m && uguali(q).length === 0 && sigle.has(m[2])) { q = m[1]; sigla = m[2].toUpperCase(); }
    let esatti = uguali(q);
    if (sigla) esatti = esatti.filter(i => C[i][1] === sigla);
    if (esatti.length === 1) return { tipo: 'uno', i: esatti[0] };
    if (esatti.length > 1) return { tipo: 'molti', i: esatti };
    if (ALIAS[q]) return trova(ALIAS[q]);
    const inizio = [...new Set(nomi.filter(([k]) => k.startsWith(q)).map(([, i]) => i))];
    const dentro = [...new Set(nomi.filter(([k]) => !k.startsWith(q) && k.includes(q)).map(([, i]) => i))];
    let tutte = inizio.concat(dentro);
    if (!tutte.length) {            // ogni parola cercata dentro il nome, in qualsiasi ordine («reggio emilia»)
      const parole = q.split(' ');
      tutte = [...new Set(nomi.filter(([k]) => parole.every(w => k.includes(w))).map(([, i]) => i))];
    }
    return { tipo: 'proposte', i: tutte.slice(0, 5) };
  }

  // nomi di tutti i giorni diversi da quelli ufficiali
  const ALIAS = { 'reggio emilia': "Reggio nell'Emilia", 'reggio calabria': 'Reggio di Calabria' };

  const link = i => uguali(norm(C[i][0])).length > 1 ? slug(C[i][0] + ' ' + C[i][1]) : slug(C[i][0]);

  function proposte(elenco, titolo) {
    lista.innerHTML = elenco.length
      ? `<p class="nota">${esc(titolo)}</p><ul class="proposte">${elenco.map(i =>
        `<li><a href="?${link(i)}" data-i="${i}">${esc(C[i][0])} (${esc(C[i][1])})</a> <span>${esc(C[i][2])}</span></li>`).join('')}</ul>`
      : '<p class="nota">Non troviamo questo comune: controlla il link che ti abbiamo mandato, oppure scrivici di nuovo in DM.</p>';
    lista.hidden = false;
  }

  function frase(p) {
    if (p >= 0.95) return 'tra i più alti d\'Italia';
    if (p < 0.05) return 'tra i più bassi d\'Italia';
    return `più alto di ${Math.max(1, Math.min(9, Math.round(p * 10)))} comuni italiani su 10`;
  }

  function voce(href, titolo, indicatore, corpo) {
    return `<article class="voce"><h3><a href="${esc(href)}">${esc(titolo)}</a></h3><p class="indicatore">${esc(indicatore)}</p>${corpo}</article>`;
  }

  function mostra(i) {
    const r = C[i];
    lista.hidden = true;
    history.replaceState(null, '', location.pathname + '?' + link(i));
    document.title = `${r[0]} in numeri · Comune che vai`;
    let h = `<header class="testa-comune"><h2>${esc(r[0])}</h2>
<p class="meta"><span>${esc(r[1])} · ${esc(r[2])}</span>${r[3] ? `<span>${nf(r[3], 0)} abitanti al 1° gennaio 2026</span>` : ''}</p></header>
<div class="voci">`;
    for (const s of D.schede) {
      const v = s.valori[i];
      let corpo;
      if (!s.con_valori) corpo = `<p class="valore">${esc(v !== null ? (s.fasce[v] || '') : 'dato non disponibile')}</p>`;
      else if (v === null) corpo = '<p class="valore assente">dato non disponibile</p>';
      else {
        const p = quota(s, v);
        const ita = s.italia !== null ? `<span>Italia: ${nf(s.italia, s.dec)}${u(s)}</span>` : '';
        corpo = `<p class="valore"><strong>${nf(v, s.dec)}</strong>${u(s)}</p>
<p class="confronto">${ita}<span>${esc(frase(p))}</span></p>
<div class="barra" aria-hidden="true"><i style="left:${(p * 100).toFixed(1)}%"></i></div>`;
      }
      h += voce(s.href, s.titolo, s.indicatore, corpo);
    }
    for (const z of D.zone) {
      if (z.comune === i) h += voce(z.href, z.titolo, z.indicatore, '<p class="valore">La tua città zona per zona: mappa e ricerca per quartiere</p>');
    }
    if (r[2] !== 'Sardegna') {      // le province sarde del 2026 non coincidono con quelle dei dati provinciali
      for (const s of D.province.schede) {
        const v = s.valori[r[1]];
        if (v === undefined) continue;
        h += voce(s.href, s.titolo, s.indicatore + ', nella tua provincia', `<p class="valore"><strong>${nf(v, s.dec)}</strong>${u(s)}</p>
${s.italia !== null ? `<p class="confronto"><span>Italia: ${nf(s.italia, s.dec)}${u(s)}</span></p>` : ''}`);
      }
    }
    for (const s of D.regioni) {
      const v = s.valori[r[2]];
      if (v) h += voce(s.href, s.titolo, s.indicatore + ', nella tua regione', `<p class="valore">${esc(v)}</p>`);
    }
    h += `</div>
<div class="azioni"><button class="bottone pieno" type="button" id="condividi">Condividi questa scheda</button>
<span class="conteggio" id="copiato" aria-live="polite"></span></div>
<p class="nota">I numeri dei video pubblicati fino al ${esc(D.aggiornato)}. «Più alto di 7 comuni su 10» vuol dire che 7 comuni italiani su 10 hanno un valore più basso. Fonte, metodo e limiti di ogni numero sono nella pagina del video.</p>`;
    box.innerHTML = h;
    box.hidden = false;
    document.getElementById('condividi').addEventListener('click', async () => {
      const url = location.href;
      try {
        if (navigator.share) await navigator.share({ title: `${r[0]} in numeri`, text: `${r[0]} in numeri, da Comune che vai`, url });
        else { await navigator.clipboard.writeText(url); document.getElementById('copiato').textContent = 'Link copiato'; }
      } catch (e) { /* condivisione annullata */ }
    });
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: 'comune/' + link(i), title: r[0], event: true });
    }
  }

  function cerca(testo) {
    const t = trova(testo);
    if (t.tipo === 'uno') mostra(t.i);
    else if (t.tipo === 'molti') proposte(t.i, 'Ci sono più comuni con questo nome: scegli il tuo.');
    else if (t.tipo === 'proposte') proposte(t.i, 'Non troviamo esattamente questo nome. Forse cercavi:');
    else {
      lista.innerHTML = '<p class="nota">Questa pagina si apre dal link con il nome del comune, quello che ti abbiamo mandato in DM.</p>';
      lista.hidden = false;
    }
  }

  lista.addEventListener('click', ev => {
    const a = ev.target.closest('a[data-i]');
    if (!a) return;
    ev.preventDefault();
    mostra(+a.dataset.i);
    box.scrollIntoView({ block: 'start' });
  });

  // comune dal link: ?rio-saliceto, ?Rio%20Saliceto, ?c=rio-saliceto, #rio-saliceto
  let q = location.search.replace(/^\?/, '');
  if (q.startsWith('c=')) q = q.slice(2);
  q = q.split('&')[0] || location.hash.replace(/^#/, '');
  try { q = decodeURIComponent(q.replace(/\+/g, ' ')); } catch (e) { /* link malformato */ }
  cerca(q);
})();
