// Tabella dei settori di un video a confronto tra settori: ricerca per nome o codice Ateco, filtro sui settori del confronto,
// ordinamento per colonna, 200 righe alla volta. I dati arrivano dal <script type="application/json" id="dati"> (scritto da costruisci.py).
(function () {
  const D = JSON.parse(document.getElementById('dati').textContent);
  const corpo = document.getElementById('corpo');
  const campo = document.getElementById('cerca');
  const solo = document.getElementById('solo');
  const conta = document.getElementById('conteggio');
  const altri = document.getElementById('altri');
  const PASSO = 200;
  const intero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
  const due = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const uno = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  let mostrate = PASSO;
  let ordine = { col: 3, verso: -1 };
  // righe: [codice, settore, occupati, valore per occupato, paga oraria, quota personale, % dipendenti, nel confronto, nel video]
  const righe = D.righe.map((r) => ({ r, chiave: (r[1] + ' ' + r[0]).toLocaleLowerCase('it') }));

  function cella(testo, classe) {
    const td = document.createElement('td');
    if (classe) td.className = classe;
    td.textContent = testo;
    return td;
  }
  const num = (v, f) => (v === null || v === undefined ? '—' : f.format(v));

  function disegna() {
    const q = campo.value.trim().toLocaleLowerCase('it');
    let lista = righe.filter((x) => (!solo.checked || x.r[7] === 1) && (!q || x.chiave.includes(q)));
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
      if (r[8]) tr.className = 'citato';
      tr.appendChild(cella(r[1], 'testo'));
      tr.appendChild(cella(r[0]));
      tr.appendChild(cella(num(r[2], intero), 'num'));
      tr.appendChild(cella(num(r[6], intero), 'num'));
      tr.appendChild(cella(num(r[3], intero), 'num'));
      tr.appendChild(cella(num(r[4], due), 'num'));
      tr.appendChild(cella(num(r[5], uno), 'num'));
      frag.appendChild(tr);
    }
    corpo.replaceChildren(frag);
    conta.textContent = lista.length === 0 && solo.checked
      ? 'Nessun settore tra quelli del confronto: togli la spunta per cercare tra tutti.'
      : lista.length.toLocaleString('it-IT') + (lista.length === 1 ? ' settore' : ' settori') +
        (lista.length > mostrate ? ' · ne vedi ' + mostrate.toLocaleString('it-IT') : '');
    altri.hidden = lista.length <= mostrate;
  }

  campo.addEventListener('input', () => { mostrate = PASSO; disegna(); });
  solo.addEventListener('change', () => { mostrate = PASSO; disegna(); });
  altri.addEventListener('click', () => { mostrate += 1000; disegna(); });
  document.querySelectorAll('th[data-col]').forEach((th) => {
    th.querySelector('button').addEventListener('click', () => {
      const col = Number(th.dataset.col);
      ordine = { col, verso: ordine.col === col ? -ordine.verso : (col >= 2 ? -1 : 1) };
      document.querySelectorAll('th[data-col]').forEach((h) => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', ordine.verso === 1 ? 'ascending' : 'descending');
      disegna();
    });
  });
  disegna();
})();
