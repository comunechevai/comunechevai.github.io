// Trova il comune scritto nel link (comune/?rio-saliceto, redditi/?castro-le): usato da comune.js e redditi.js.
// Niente ricerca libera: il comune arriva solo dal link mandato in DM (decisione di Paolo del 2/11/2026).
// C: [[nome, sigla, regione, abitanti, nome ufficiale se diverso], ...] nell'ordine di toolkit/mappe/comuni_2026.csv.
// Con omonimi o refusi propone al massimo 5 comuni vicini.
window.TrovaComune = function (C) {
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’'`´]/g, '').replace(/[-_+.,/]/g, ' ').replace(/\s+/g, ' ').trim();
  const slug = s => norm(s).replace(/ /g, '-');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
  // nomi di tutti i giorni diversi da quelli ufficiali
  const ALIAS = { 'reggio emilia': "Reggio nell'Emilia", 'reggio calabria': 'Reggio di Calabria' };

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

  // il link di un comune: il nome, con la sigla se ha omonimi (castro-le)
  const link = i => uguali(norm(C[i][0])).length > 1 ? slug(C[i][0] + ' ' + C[i][1]) : slug(C[i][0]);

  // legge il comune dal link (?rio-saliceto, ?Rio%20Saliceto, ?c=rio-saliceto, #rio-saliceto) e chiama mostra(i);
  // altrimenti scrive in lista le proposte o il messaggio per chi è arrivato senza il nome giusto
  function avvia(lista, box, mostra) {
    function proposte(elenco, titolo) {
      lista.innerHTML = elenco.length
        ? `<p class="nota">${esc(titolo)}</p><ul class="proposte">${elenco.map(i =>
          `<li><a href="?${link(i)}" data-i="${i}">${esc(C[i][0])} (${esc(C[i][1])})</a> <span>${esc(C[i][2])}</span></li>`).join('')}</ul>`
        : '<p class="nota">Non troviamo questo comune: controlla il link che ti abbiamo mandato, oppure scrivici di nuovo in DM.</p>';
      lista.hidden = false;
    }
    lista.addEventListener('click', ev => {
      const a = ev.target.closest('a[data-i]');
      if (!a) return;
      ev.preventDefault();
      lista.hidden = true;
      mostra(+a.dataset.i);
      box.scrollIntoView({ block: 'start' });
    });
    let q = location.search.replace(/^\?/, '');
    if (q.startsWith('c=')) q = q.slice(2);
    q = q.split('&')[0] || location.hash.replace(/^#/, '');
    try { q = decodeURIComponent(q.replace(/\+/g, ' ')); } catch (e) { /* link malformato */ }
    const t = trova(q);
    if (t.tipo === 'uno') { lista.hidden = true; mostra(t.i); }
    else if (t.tipo === 'molti') proposte(t.i, 'Ci sono più comuni con questo nome: scegli il tuo.');
    else if (t.tipo === 'proposte') proposte(t.i, 'Non troviamo esattamente questo nome. Forse cercavi:');
    else {
      lista.innerHTML = '<p class="nota">Questa pagina si apre dal link con il nome del comune, quello che ti abbiamo mandato in DM.</p>';
      lista.hidden = false;
    }
  }

  return { norm, slug, esc, trova, link, avvia };
};
