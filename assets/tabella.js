// Tabella dei comuni di un video: ricerca per nome o provincia, ordinamento per colonna, 200 righe alla volta.
// I dati arrivano dal <script type="application/json" id="dati"> della pagina (scritto da costruisci.py).
(function () {
  const D = JSON.parse(document.getElementById('dati').textContent);
  const conValori = D.con_valori;
  const fasce = D.fasce;
  const colori = D.colori || [];
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 6 });
  const corpo = document.getElementById('corpo');
  const campo = document.getElementById('cerca');
  const conta = document.getElementById('conteggio');
  const altri = document.getElementById('altri');
  const PASSO = 200;
  const conMappa = !!document.getElementById('mappa');
  let mostrate = PASSO;
  let ordine = { col: 0, verso: 1 };
  // righe: [codice, comune, provincia, valore, fascia, nel_video]
  // r[6] (facoltativo, pagine con zone): altri nomi su cui cercare, es. tutti i quartieri di un CAP
  // r[7], r[8]... (facoltativi): colonne in piu' descritte in D.altre, es. la quota di territorio coperto
  const altre = D.altre || [];
  const righe = D.comuni.map((r) => ({ r, chiave: (r[1] + ' ' + r[2] + ' ' + r[0] + ' ' + (r[6] || '')).toLocaleLowerCase('it') }));

  function cella(testo, classe) {
    const td = document.createElement('td');
    if (classe) td.className = classe;
    td.textContent = testo;
    return td;
  }

  function disegna() {
    const q = campo.value.trim().toLocaleLowerCase('it');
    let lista = q ? righe.filter((x) => x.chiave.includes(q)) : righe.slice();
    const c = ordine.col;
    lista.sort((a, b) => {
      const x = a.r[c], y = b.r[c];
      if (x === y) return a.r[1].localeCompare(b.r[1], 'it');
      if (x === null || x === '') return 1;
      if (y === null || y === '') return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'it')) * ordine.verso;
    });
    const frag = document.createDocumentFragment();
    for (const { r } of lista.slice(0, mostrate)) {
      const tr = document.createElement('tr');
      if (r[5]) tr.className = 'citato';
      if (conMappa) {
        const td0 = document.createElement('td');
        td0.className = 'testo';
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'link-comune'; b.textContent = r[1];
        b.setAttribute('aria-label', r[1] + ': mostra sulla mappa');
        b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('comune:seleziona', { detail: r[0] })));
        td0.appendChild(b); tr.appendChild(td0);
      } else {
        tr.appendChild(cella(r[1], 'testo'));
      }
      tr.appendChild(cella(r[2]));
      if (conValori) tr.appendChild(cella(r[3] === null ? '—' : fmt.format(r[3]), 'num'));
      altre.forEach((a, i) => {
        const v = r[7 + i];
        tr.appendChild(cella(v === null || v === undefined ? '—' : fmt.format(v), 'num'));
      });
      const f = r[4];
      const td = cella(f === null ? 'dato non disponibile' : fasce[f - 1].testo, 'testo');
      if (f !== null && colori[f - 1]) {
        const i = document.createElement('i');
        i.style.cssText = 'display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:-1px;background:' + colori[f - 1];
        td.prepend(i);
      }
      tr.appendChild(td);
      tr.appendChild(cella(r[0]));
      frag.appendChild(tr);
    }
    corpo.replaceChildren(frag);
    const [sing, plur] = D.parola || ['comune', 'comuni'];
    conta.textContent = lista.length.toLocaleString('it-IT') + ' ' + (lista.length === 1 ? sing : plur) +
      (lista.length > mostrate ? ' · ne vedi ' + mostrate.toLocaleString('it-IT') : '');
    altri.hidden = lista.length <= mostrate;
  }

  campo.addEventListener('input', () => { mostrate = PASSO; disegna(); });
  altri.addEventListener('click', () => { mostrate += 1000; disegna(); });
  document.querySelectorAll('th[data-col]').forEach((th) => {
    th.querySelector('button').addEventListener('click', () => {
      const col = Number(th.dataset.col);
      ordine = { col, verso: ordine.col === col ? -ordine.verso : (col === 3 || col === 4 || col >= 7 ? -1 : 1) };
      document.querySelectorAll('th[data-col]').forEach((h) => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', ordine.verso === 1 ? 'ascending' : 'descending');
      disegna();
    });
  });
  disegna();
})();
