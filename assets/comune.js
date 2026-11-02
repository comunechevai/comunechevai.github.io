// «Il tuo comune in numeri»: scheda di un comune con i numeri di tutti i video pubblicati.
// Il comune arriva solo dal link (comune/?rio-saliceto, comune/?Rio Saliceto, comune/?castro-le): niente ricerca libera,
// la pagina non e' collegata dal sito (decisione di Paolo del 2/11/2026). Ricerca del nome in trova_comune.js.
// Dati: window.NUMERI_COMUNI (comune/numeri.js, scritto da sito/costruisci.py):
//   comuni: [[nome, sigla, regione, abitanti, nome ufficiale se diverso]]; ogni video ha valori nello stesso ordine.
(function () {
  const D = window.NUMERI_COMUNI;
  const C = D.comuni;
  const T = window.TrovaComune(C);
  const esc = T.esc;
  const nf = (x, dec) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: dec }).format(x);
  const u = s => (s.unita === '%' ? '' : ' ') + esc(s.unita);   // 2,2% senza spazio, 47 anni con lo spazio
  const box = document.getElementById('scheda');
  const lista = document.getElementById('proposte');

  // valori ordinati di ogni video, per dire quanti comuni hanno un valore più basso
  for (const s of D.schede) if (s.con_valori) s.ordinati = s.valori.filter(v => v !== null).sort((a, b) => a - b);
  function quota(s, v) {          // quota dei comuni con un valore più basso di v
    let lo = 0, hi = s.ordinati.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s.ordinati[m] < v) lo = m + 1; else hi = m; }
    return lo / s.ordinati.length;
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
    history.replaceState(null, '', location.pathname + '?' + T.link(i));
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
      window.goatcounter.count({ path: 'comune/' + T.link(i), title: r[0], event: true });
    }
  }

  T.avvia(lista, box, mostra);
})();
