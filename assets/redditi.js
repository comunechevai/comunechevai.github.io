// «I redditi del tuo comune»: scheda dei redditi IRPEF di un comune (dati MEF), per chi commenta REDDITI.
// Il comune arriva solo dal link (redditi/?veroli, redditi/?castro-le), come in comune.js: ricerca del nome in trova_comune.js.
// Dati: window.REDDITI (redditi/dati.js, scritto da sito/redditi.py):
//   comuni: [[nome, sigla, regione, abitanti, nome ufficiale se diverso]]
//   valori: per comune [contribuenti, reddito medio, dipendenti, media, pensionati, media, autonomi, media, 7 classi]
//           (null = cella che il MEF non pubblica per segreto statistico)
//   italia, regioni (reddito medio), cap (righe [CAP, contribuenti, reddito medio] per comune), zone (pagina del video sui CAP)
(function () {
  const D = window.REDDITI;
  const C = D.comuni, V = D.valori, I = D.italia;
  const T = window.TrovaComune(C);
  const esc = T.esc;
  // 4.441 con il punto anche a quattro cifre (Intl in italiano non lo mette), 0,6 con la virgola
  const nf = (x, dec) => {
    const [a, b] = Math.abs(x).toFixed(dec || 0).split('.');
    return (x < 0 ? '−' : '') + a.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (b ? ',' + b : '');
  };
  const euro = x => nf(x) + ' €';
  const box = document.getElementById('scheda');
  const lista = document.getElementById('proposte');
  const CLASSI = ['fino a 10.000 €', 'da 10.000 a 15.000 €', 'da 15.000 a 26.000 €', 'da 26.000 a 55.000 €',
    'da 55.000 a 75.000 €', 'da 75.000 a 120.000 €', 'oltre 120.000 €'];
  const TIPI = [
    ['Stipendi', 'Chi dichiara redditi da lavoro dipendente (e assimilati), e quanto in media'],
    ['Pensioni', 'Chi dichiara una pensione, e quanto in media'],
    ['Lavoro autonomo', 'Professionisti e lavoratori autonomi, esclusi i forfettari, e quanto dichiarano in media']];
  const NON_PUBBLICATO = '<p class="valore assente">Il MEF non pubblica questo dato: sono pochi casi (segreto statistico).</p>';

  const ordinati = V.map(v => v[1]).sort((a, b) => a - b);
  function quota(v) {             // quota dei comuni con un reddito medio più basso
    let lo = 0, hi = ordinati.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (ordinati[m] < v) lo = m + 1; else hi = m; }
    return lo / ordinati.length;
  }
  function frase(p) {
    if (p >= 0.95) return 'tra i più alti d\'Italia';
    if (p < 0.05) return 'tra i più bassi d\'Italia';
    return `più alto di ${Math.max(1, Math.min(9, Math.round(p * 10)))} comuni italiani su 10`;
  }
  function inProvincia(i) {       // posizione del reddito medio tra i comuni della stessa provincia
    let n = 0, sopra = 0;
    C.forEach((r, k) => { if (r[1] === C[i][1]) { n++; if (V[k][1] > V[i][1]) sopra++; } });
    return [sopra + 1, n];
  }
  // «35 contribuenti su 100 · Italia: 34»; sotto 10 con un decimale («0,6»), per non scrivere «1 contribuenti»
  function quanti(x, ita) {
    const d = Math.min(x, ita) < 10 ? 1 : 0;
    return `${nf(x, d)} contribuenti su 100</span><span>Italia: ${nf(ita, d)}`;
  }
  const voce = (titolo, indicatore, corpo, cls) =>
    `<article class="voce${cls ? ' ' + cls : ''}"><h3>${esc(titolo)}</h3><p class="indicatore">${esc(indicatore)}</p>${corpo}</article>`;

  function fasce(v) {
    const n = v[0];
    const p = v.slice(8).map(x => x === null ? null : 100 * x / n);
    const max = Math.max(...p.filter(x => x !== null), ...I.classi);
    const righe = CLASSI.map((et, k) => {
      const ita = `Italia ${nf(I.classi[k], 1)}%`;
      if (p[k] === null) return `<div class="fr"><span class="et">${et}</span><span class="np">non pubblicato dal MEF</span><span class="num">–</span>
<span class="sotto">${ita}</span></div>`;
      return `<div class="fr"><span class="et">${et}</span>
<span class="bar" aria-hidden="true"><b style="width:${(100 * p[k] / max).toFixed(1)}%"></b><i style="left:${(100 * I.classi[k] / max).toFixed(1)}%"></i></span>
<span class="num">${nf(p[k], 1)}%</span><span class="sotto">${nf(v[8 + k])} ${v[8 + k] === 1 ? 'persona' : 'persone'} · ${ita}</span></div>`;
    }).join('');
    return `<p class="legenda"><span><i class="campione"></i>il tuo comune</span><span><i class="tacca"></i>Italia</span></p>
<div class="fasce-redditi">${righe}</div>
<p class="nota">Su 100 contribuenti. Restano fuori quelli con reddito zero o negativo, per questo il totale può stare sotto 100.${p.includes(null) ? ' Quando una fascia ha pochi contribuenti il MEF non la pubblica, e a volte ne nasconde un\'altra perché non si possa ricavare.' : ''}</p>`;
  }

  function cap(i) {
    const righe = D.cap[i];
    if (!righe) return '';
    const z = D.zone[i];
    const video = z ? `<p class="valore"><a href="${esc(z[1])}">La mappa dei CAP: ${esc(z[0])}</a></p>` : '';
    return voce('Codice postale per codice postale', `Reddito medio dichiarato nei ${righe.length} CAP del comune`, `${video}
<div class="tabella-box alta"><table><thead><tr><th>CAP</th><th>Reddito medio</th><th>Contribuenti</th></tr></thead><tbody>
${righe.map(r => `<tr><td>${esc(r[0])}</td><td>${euro(r[2])}</td><td>${nf(r[1])}</td></tr>`).join('')}
</tbody></table></div>`, 'larga');
  }

  function mostra(i) {
    const r = C[i], v = V[i];
    history.replaceState(null, '', location.pathname + '?' + T.link(i));
    document.title = `Redditi · ${r[0]} · Comune che vai`;
    const [pos, nprov] = inProvincia(i);
    const p = quota(v[1]);
    let h = `<header class="testa-comune"><h2>${esc(r[0])}</h2>
<p class="meta"><span>${esc(r[1])} · ${esc(r[2])}</span><span>Redditi ${D.anno}, dichiarati nel ${D.anno + 1}</span></p></header>
<div class="voci">`;
    h += voce('Reddito medio dichiarato', 'Reddito complessivo diviso per il numero di contribuenti', `<p class="valore"><strong>${euro(v[1])}</strong></p>
<p class="confronto"><span>Italia: ${euro(I.medio)}</span>${D.regioni[r[2]] ? `<span>${esc(r[2].split('/')[0])}: ${euro(D.regioni[r[2]])}</span>` : ''}</p>
<p class="confronto"><span>${esc(frase(p))}</span></p>
<div class="barra" aria-hidden="true"><i style="left:${(p * 100).toFixed(1)}%"></i></div>
<p class="confronto"><span>${pos}° su ${nprov} comuni della provincia (${esc(r[1])})</span></p>`);
    const ogni100 = r[3] ? Math.round(100 * v[0] / r[3]) : null;
    h += voce('Contribuenti', 'Chi ha dichiarato redditi al fisco', `<p class="valore"><strong>${nf(v[0])}</strong></p>
${ogni100 !== null ? `<p class="confronto"><span>${ogni100} ogni 100 abitanti</span><span>Italia: ${Math.round(100 * I.contribuenti / I.abitanti)}</span></p>
<p class="confronto"><span>${nf(r[3])} abitanti al ${esc(D.data_pop)}</span></p>` : ''}`);
    TIPI.forEach(([titolo, ind], k) => {
      const n = v[2 + 2 * k], m = v[3 + 2 * k], [ni, mi] = I.tipi[k];
      const corpo = n === null || m === null ? NON_PUBBLICATO : `<p class="valore"><strong>${nf(n)}</strong> ${n === 1 ? 'persona' : 'persone'}</p>
<p class="confronto"><span>${quanti(100 * n / v[0], 100 * ni / I.contribuenti)}</span></p>
<p class="valore">In media <strong class="medio">${euro(m)}</strong></p>
<p class="confronto"><span>Italia: ${euro(mi)}</span></p>`;
      h += voce(titolo, ind, corpo);
    });
    h += voce('Quanto dichiara ciascuno', 'Contribuenti per fascia di reddito complessivo', fasce(v), 'larga');
    h += cap(i);
    h += `</div>
<div class="azioni"><button class="bottone pieno" type="button" id="condividi">Condividi questa scheda</button>
<span class="conteggio" id="copiato" aria-live="polite"></span></div>
<p class="nota"><strong>Fonte:</strong> <a href="https://www1.finanze.gov.it/finanze/pagina_dichiarazioni/public/dichiarazioni.php">MEF – Dipartimento delle Finanze</a>, redditi e principali variabili IRPEF per comune e per CAP, anno d'imposta ${D.anno} (dichiarazioni presentate nel ${D.anno + 1}); ISTAT, popolazione al ${esc(D.data_pop)}.</p>
<p class="nota"><strong>Come si legge:</strong> il reddito medio è il reddito complessivo dichiarato diviso per il numero di contribuenti, come nei comunicati del MEF. Stipendi, pensioni e lavoro autonomo: quante persone dichiarano quel reddito e quanto in media; chi ha più redditi (per esempio pensione e lavoro) compare in più voci. «Più alto di 3 comuni su 10» vuol dire che 3 comuni italiani su 10 hanno un reddito medio più basso.</p>
<p class="nota"><strong>Limiti:</strong> sono redditi dichiarati ai fini IRPEF, senza lavoro nero, forfettari, affitti in cedolare secca e redditi finanziari. La media è tirata su dai redditi più alti. I contribuenti sono contati nel comune del domicilio fiscale.</p>`;
    box.innerHTML = h;
    box.hidden = false;
    document.getElementById('condividi').addEventListener('click', async () => {
      const url = location.href;
      try {
        if (navigator.share) await navigator.share({ title: `Redditi · ${r[0]}`, text: `${r[0]}: i redditi del comune, da Comune che vai`, url });
        else { await navigator.clipboard.writeText(url); document.getElementById('copiato').textContent = 'Link copiato'; }
      } catch (e) { /* condivisione annullata */ }
    });
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: 'redditi/' + T.link(i), title: 'Redditi · ' + r[0], event: true });
    }
  }

  T.avvia(lista, box, mostra);
})();
