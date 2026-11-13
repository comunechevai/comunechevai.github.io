// «La mappa dei comuni»: scegli un numero del database e la mappa si colora; tocco o ricerca di un comune, classifica,
// scheda della fonte e CSV. Dati: mappa/dati/comuni.js, catalogo.js e dati/ind/<indicatore>.js (caricato a richiesta),
// confini: assets/comuni_2026.js (TopoJSON, proprietà c = codice della mappa). Zoom come nelle pagine dei video.
(function () {
  const C = window.MAPPA_COMUNI, K = window.MAPPA_CATALOGO, T = window.COMUNI_2026;
  const box = document.getElementById('mappa');
  if (!box || !C || !K || !T || !window.d3) return;
  const $ = (id) => document.getElementById(id);
  const canvas = box.querySelector('canvas'), ctx = canvas.getContext('2d');
  const info = $('mappa-info'), avviso = box.querySelector('.mappa-avviso');
  const css = getComputedStyle(document.documentElement);
  const colore = (nome, riserva) => (css.getPropertyValue(nome).trim() || riserva);
  const MANCA = '#a3a7b0';
  const SEQ = ['#e3ecf8', '#c2d5ef', '#97b7e2', '#6b96d0', '#4174bb', '#2455a0', '#123a78'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ---------- comuni ----------
  const IX = Object.fromEntries(C.campi.map((c, i) => [c, i]));
  const R = C.righe;                                            // [codice, codice_mappa, comune, sigla, provincia, regione, residenti]
  const perMappa = new Map(R.map((r, i) => [r[IX.codice_mappa], i]));
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’'`´]/g, '').replace(/[-_+.,/]/g, ' ').replace(/\s+/g, ' ').trim();
  const slug = (s) => norm(s).replace(/ /g, '-');
  const nomiN = R.map((r) => norm(r[IX.comune]));
  const omonimi = new Map();
  nomiN.forEach((k) => omonimi.set(k, (omonimi.get(k) || 0) + 1));
  const linkComune = (i) => (omonimi.get(nomiN[i]) > 1 ? slug(R[i][IX.comune] + ' ' + R[i][IX.sigla]) : slug(R[i][IX.comune]));
  const nomeComune = (i) => R[i][IX.comune] + ' (' + R[i][IX.sigla] + ')';

  // ---------- numeri ----------
  const fmtN = (v, d) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: d, minimumFractionDigits: 0, useGrouping: 'always' }).format(v);
  function decimali(v) { const a = Math.abs(v); return a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3; }
  function valoreTesto(v, s) {
    if (v == null) return s.vuoto || 'dato non disponibile';
    const u = s.unita || '';
    const n = fmtN(v, decimali(v));
    if (u.startsWith('%')) return n + u;
    if (s.valori && s.valori[String(v)]) return s.valori[String(v)];
    if (u === 'sì/no') return v >= 1 ? 'sì' : 'no';
    return u ? n + ' ' + u : n;
  }

  // ---------- confini ----------
  const [sx, sy] = T.transform.scale, [tx, ty] = T.transform.translate;
  const archi = T.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
  let minX = Infinity, maxY = -Infinity, maxX = -Infinity, minY = Infinity;
  for (const a of archi) for (const [x, y] of a) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const archiKm = archi.map((a) => a.map(([x, y]) => [(x - minX) / 1000, (maxY - y) / 1000]));
  const W0 = (maxX - minX) / 1000, H0 = (maxY - minY) / 1000;
  const uso = new Map();
  const forme = T.objects.comuni.geometries.map((g) => {
    const p = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pol of (g.type === 'Polygon' ? [g.arcs] : g.arcs)) for (const anello of pol) {
      let primo = true;
      for (const i of anello) {
        const a = i >= 0 ? archiKm[i] : archiKm[~i].slice().reverse();
        const k = i >= 0 ? i : ~i;
        if (!uso.has(k)) uso.set(k, []);
        uso.get(k).push(g.properties.p);
        for (let j = primo ? 0 : 1; j < a.length; j++) {
          const [x, y] = a[j];
          if (primo && j === 0) p.moveTo(x, y); else p.lineTo(x, y);
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        primo = false;
      }
      p.closePath();
    }
    return { i: perMappa.get(g.properties.c), path: p, bb: [x0, y0, x1, y1] };
  });
  const formaDi = new Map(forme.map((f) => [f.i, f]));
  const province = new Path2D(), costa = new Path2D();
  for (const [k, ps] of uso) {
    const d = ps.length === 1 ? costa : (ps[0] !== ps[1] ? province : null);
    if (d) archiKm[k].forEach(([x, y], j) => (j ? d.lineTo(x, y) : d.moveTo(x, y)));
  }

  // ---------- stato ----------
  let nome = null, S = null, V = null, classi = null, perClasse = new Map(), scelto = null;
  const dati = () => (window.MAPPA_DATI || {});

  function carica(n) {
    return new Promise((ok, no) => {
      if (dati()[n]) return ok(dati()[n]);
      const s = document.createElement('script');
      s.src = 'dati/ind/' + n + '.js?v=' + K.schede[n].v;
      s.onload = () => (dati()[n] ? ok(dati()[n]) : no(new Error(n)));
      s.onerror = () => no(new Error(n));
      document.head.appendChild(s);
    });
  }

  // fasce. Pochi valori diversi: una fascia per valore (con quanti comuni). Segni opposti: divergente, con più fasce dal
  // lato dove stanno più comuni (sotto l'1% da un lato: sequenziale). Tanti zeri (10% o più): lo 0 ha la sua fascia.
  // Il resto: quantili sui comuni con il dato. Ogni fascia: da ≤ x < a (l'ultima di ogni lato comprende a).
  const NEG = ['#7a2c0c', '#a8481c', '#d77b45', '#efb48a', '#f6d5bd'], POS = ['#c9dbf1', '#a9c4e6', '#5f8fd0', '#1f5fbf', '#123a78'];
  const ZERO = '#e4dfd3';
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  function scala(lista, k) {                                 // k colori presi a intervalli regolari (interpolati)
    if (k === 1) return [lista[Math.floor((lista.length - 1) / 2)]];
    return Array.from({ length: k }, (_, i) => {
      const p = i * (lista.length - 1) / (k - 1), a = Math.floor(p), b = Math.min(lista.length - 1, a + 1), f = p - a;
      const A = rgb(lista[a]), B = rgb(lista[b]);
      return '#' + A.map((x, j) => Math.round(x + (B[j] - x) * f).toString(16).padStart(2, '0')).join('');
    });
  }
  // limiti «tondi» 1, 2, 5, 10, 20, 50… quando i quantili si schiacciano (tanti comuni con lo stesso valore, es. 1 biblioteca)
  function tondi(w, k) {
    const out = [];
    for (let e = Math.floor(Math.log10(w[0] || 1)) - 1; out.length < 40; e++) for (const m of [1, 2, 5]) {
      const x = m * 10 ** e;
      if (x > w[0] && x <= w[w.length - 1] && w.some((y) => y >= x)) out.push(x);
      if (x > w[w.length - 1]) return out.length > k - 1 ? out.filter((_, i) => i % Math.ceil(out.length / (k - 1)) === 0) : out;
    }
    return out;
  }
  function quantili(w, k) {                                  // w ordinato
    const q = (p) => w[Math.min(w.length - 1, Math.floor(p * w.length))];
    const grezzi = [...new Set(Array.from({ length: k - 1 }, (_, j) => q((j + 1) / k)))];
    // limiti arrotondati (2 cifre significative, 3 da 1.000 in su; 3 per tutti se due limiti si toccano): legenda leggibile
    const tondo = (x, c) => { if (!x) return 0; const e = 10 ** (Math.floor(Math.log10(Math.abs(x))) - c + 1); return Math.round(x / e) * e; };
    let r = grezzi.map((x) => tondo(x, Math.abs(x) >= 1000 ? 3 : 2));
    if (new Set(r).size < r.length) r = grezzi.map((x) => tondo(x, 3));
    if (new Set(r).size < r.length) r = grezzi;
    let lim = r.map((x) => +x.toPrecision(12)).filter((x) => x > w[0] && x <= w[w.length - 1]);
    if (lim.length + 1 < Math.ceil(k / 2) && w[0] > 0) { const t = tondi(w, k); if (t.length > lim.length) lim = t; }
    const bordi = [w[0], ...lim, w[w.length - 1]];
    if (bordi.length === 2 && bordi[0] === bordi[1]) return [{ da: w[0], a: w[0], chiusa: true }];
    return bordi.slice(0, -1).map((da, i) => ({ da, a: bordi[i + 1], chiusa: i === bordi.length - 2 }));
  }
  const colora = (fasce, colori) => fasce.map((f, i) => Object.assign(f, { colore: colori[i] }));
  function faiClassi(vals) {
    const v = vals.filter((x) => x != null).sort((a, b) => a - b);
    if (!v.length) return { tipo: 'vuoto', fasce: [], interi: true };
    const unici = [...new Set(v)], interi = unici.every(Number.isInteger) && v[v.length - 1] <= 100;   // «da 1 a 3» solo per numeri piccoli
    if (unici.length <= 7 || (S.valori && unici.length <= 12)) {
      const col = unici.length === 2 ? [SEQ[1], SEQ[5]] : scala(SEQ, unici.length);
      const n = new Map(); v.forEach((x) => n.set(x, (n.get(x) || 0) + 1));
      return { tipo: 'valori', interi, fasce: unici.map((x, i) => ({ da: x, a: x, chiusa: true, colore: col[i], n: n.get(x) })) };
    }
    const neg = v.filter((x) => x < 0), pos = v.filter((x) => x > 0), zeri = v.length - neg.length - pos.length;
    const zero = { da: 0, a: 0, chiusa: true, colore: ZERO, zero: true };
    if (neg.length && pos.length && Math.min(neg.length, pos.length) >= 0.01 * v.length) {
      const kn = Math.max(1, Math.min(5, Math.round(6 * neg.length / (neg.length + pos.length)))), kp = Math.max(1, Math.min(5, 6 - kn));
      const fn = colora(quantili(neg, kn), scala(NEG, kn)), fp = colora(quantili(pos, kp), scala(POS, kp));
      fn[fn.length - 1].finoZero = true; fp[0].daZero = true;
      return { tipo: 'div', interi, fasce: [...fn, ...(zeri ? [zero] : []), ...fp] };
    }
    if (!neg.length && pos.length && zeri >= 0.1 * v.length) {
      const fp = quantili(pos, 6);
      fp[0].daZero = true;
      return { tipo: 'zeri', interi, fasce: [Object.assign(zero, { colore: SEQ[0] }), ...colora(fp, scala(SEQ.slice(1), fp.length))] };
    }
    const f = quantili(v, 7);
    return { tipo: 'quantili', interi, fasce: colora(f, scala(SEQ, f.length)) };
  }
  function classe(x) {
    if (x == null) return -1;
    const F = classi.fasce;
    for (let c = 0; c < F.length; c++) { const f = F[c]; if (x >= f.da && (x < f.a || (f.chiusa && x <= f.a))) return c; }
    return -1;
  }
  // unità corte accanto ai numeri; quelle lunghe una volta sola, in testa alla legenda
  const CORTE = ['%', '°C', '€', 'mm', 'm', 'sì/no'];
  const unitaCorta = () => { const u = S.unita || ''; return !u || CORTE.includes(u); };
  function legenda() {
    const ul = $('legenda');
    ul.innerHTML = '';
    const voce = (col, testo, n) => {
      const li = el('li'); const i = el('i'); i.style.background = col; li.append(i, el('span', null, testo));
      if (n != null) li.append(el('span', 'conta', fmtN(n, 0) + (n === 1 ? ' comune' : ' comuni')));
      ul.append(li);
    };
    const F = classi.fasce;
    if (classi.tipo === 'valori') F.forEach((f) => voce(f.colore, valoreTesto(f.da, S), f.n));
    else {
      const corta = unitaCorta();
      if (!corta) ul.append(el('li', 'unita', S.unita + ':'));
      const perc = (S.unita || '').startsWith('%');
      const t = (x) => (corta ? valoreTesto(x, S) : fmtN(x, decimali(x)) + (perc ? '%' : ''));
      F.forEach((f, c) => {
        let testo;
        const ultima = c === F.length - 1, prima = c === 0;
        const hi = classi.interi && !f.chiusa ? f.a - 1 : f.a;
        if (f.zero) testo = t(0);
        else if (f.da === f.a || (classi.interi && f.da === hi)) testo = t(f.da);
        else if (f.finoZero) testo = prima ? 'meno di ' + t(0) : 'da ' + t(f.da) + ' a ' + t(0);
        else if (f.daZero) testo = ultima ? 'più di ' + t(0) : (classi.interi ? 'da ' + t(f.da) + ' a ' + t(hi) : 'da ' + t(0) + ' a ' + t(f.a));
        else if (ultima) testo = 'da ' + t(f.da) + ' in su';
        else if (prima && !classi.interi) testo = 'meno di ' + t(f.a);
        else testo = 'da ' + t(f.da) + ' a ' + t(hi);
        voce(f.colore, testo);
      });
    }
    const nv = V.filter((x) => x == null).length;
    if (nv) voce(MANCA, S.vuoto || 'dato non disponibile', classi.tipo === 'valori' ? nv : null);
  }

  // ---------- classifica (sopra soglia, come nei video) ----------
  let soglia = null, ordine = [];
  async function preparaClassifica() {
    let base = null, quale = '';
    if (S.soglia && S.soglia_su === 'contribuenti') { base = await carica('contribuenti'); quale = 'contribuenti'; }
    else if (S.soglia) { base = R.map((r) => r[IX.residenti]); quale = 'abitanti'; }
    soglia = S.soglia ? { n: S.soglia, su: quale, base } : null;
    const dentro = (i) => V[i] != null && (!soglia || (soglia.base[i] != null && soglia.base[i] >= soglia.n));
    ordine = R.map((_, i) => i).filter(dentro).sort((a, b) => V[b] - V[a]);
  }
  function posto(i) {
    const k = ordine.indexOf(i);
    if (k < 0) return null;
    let p = k;                                                // a pari merito la stessa posizione
    while (p > 0 && V[ordine[p - 1]] === V[i]) p--;
    return p + 1;
  }
  function testoSoglia() {
    return soglia ? ` comuni con almeno ${fmtN(soglia.n, 0)} ${soglia.su}` : ' comuni con il dato';
  }
  function classifica() {
    const pochi = classi.tipo === 'valori';
    document.querySelector('.classifiche').style.display = pochi ? 'none' : '';
    if (pochi) {
      $('nota-classifica').textContent = `${fmtN(ordine.length, 0)}${testoSoglia()}. Questo numero ha pochi valori possibili: ` +
        'più che una classifica conta quanti comuni ci sono in ognuno, come nella legenda sotto la mappa.';
      return;
    }
    $('nota-classifica').textContent = `${fmtN(ordine.length, 0)}${testoSoglia()}.` +
      (S.meglio === true ? ' Qui più alto è meglio.' : S.meglio === false ? ' Qui più basso è meglio.' : '');
    const riempi = (ol, idx) => {
      ol.innerHTML = '';
      idx.forEach((i) => {
        const li = el('li');
        li.value = posto(i);                               // a pari merito la stessa posizione
        const b = el('button', 'link-comune', nomeComune(i));
        b.type = 'button';
        b.addEventListener('click', () => { vaiA(i); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
        li.append(b, el('span', 'valore-lista', valoreTesto(V[i], S)));
        ol.append(li);
      });
    };
    riempi($('primi'), ordine.slice(0, 10));
    const ult = ordine.slice(-10).reverse();          // dal più basso: posizioni N, N-1, …
    $('ultimi').reversed = true;
    $('ultimi').start = ordine.length;
    riempi($('ultimi'), ult);
  }

  // ---------- scheda della fonte ----------
  function scheda() {
    const dl = $('scheda-numero');
    dl.innerHTML = '';
    const riga = (dt, dd) => { if (!dd) return; dl.append(el('dt', null, dt), el('dd', null, dd)); };
    riga('Che cosa misura', S.definizione + (S.unita && S.unita !== 'sì/no' ? ' (' + S.unita + ')' : ''));
    riga('Fonte', S.fonte);
    riga('Dati al', S.dati_al);
    riga('Licenza', S.licenza);
    riga('Classifica', S.soglia ? `solo i comuni con almeno ${fmtN(S.soglia, 0)} ${S.soglia_su === 'contribuenti' ? 'contribuenti' : 'abitanti'}; la mappa li mostra tutti` : 'tutti i comuni con il dato');
    riga('Limiti', S.limiti);
    riga('Comuni con il dato', `${fmtN(S.n, 0)} su ${fmtN(R.length, 0)}`);
  }

  // ---------- disegno e zoom (come assets/mappa.js) ----------
  let larg = 0, alt = 0, dpr = 1, base = { s: 1, ox: 0, oy: 0 }, t = d3.zoomIdentity, attesa = false;
  function misura() {
    const r = canvas.getBoundingClientRect();
    larg = r.width; alt = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(larg * dpr); canvas.height = Math.round(alt * dpr);
    const s = Math.min(larg / W0, alt / H0) * 0.94;
    base = { s, ox: (larg - W0 * s) / 2, oy: (alt - H0 * s) / 2 };
  }
  function disegna() {
    attesa = false;
    const k = t.k * base.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (t.k * base.ox + t.x), dpr * (t.k * base.oy + t.y));
    ctx.lineJoin = 'round';
    const carta = colore('--carta', '#f6f3ec');
    for (const [c, p] of perClasse) { ctx.fillStyle = c < 0 ? MANCA : classi.fasce[c].colore; ctx.fill(p); }
    if (t.k > 1.6) {
      ctx.strokeStyle = carta; ctx.lineWidth = Math.min(1, 0.25 + t.k * 0.05) / k;
      for (const p of perClasse.values()) ctx.stroke(p);
    }
    ctx.strokeStyle = colore('--inchiostro', '#1c2230');
    ctx.globalAlpha = 0.5; ctx.lineWidth = Math.min(1.6, 0.6 + t.k * 0.08) / k; ctx.stroke(province);
    ctx.globalAlpha = 0.35; ctx.lineWidth = 0.8 / k; ctx.stroke(costa);
    ctx.globalAlpha = 1;
    if (scelto != null && formaDi.get(scelto)) {
      const p = formaDi.get(scelto).path;
      ctx.lineWidth = 3 / k; ctx.strokeStyle = carta; ctx.stroke(p);
      ctx.lineWidth = 1.6 / k; ctx.strokeStyle = colore('--inchiostro', '#1c2230'); ctx.stroke(p);
    }
  }
  const ridisegna = () => { if (!attesa) { attesa = true; requestAnimationFrame(disegna); } };
  let sugg;
  function mostraAvviso(testo) { avviso.textContent = testo; avviso.hidden = false; clearTimeout(sugg); sugg = setTimeout(() => { avviso.hidden = true; }, 1600); }
  const zoom = d3.zoom().scaleExtent([1, 80])
    .filter((e) => {
      if (e.type === 'wheel') { if (!(e.ctrlKey || e.metaKey)) { mostraAvviso('Usa Ctrl + rotellina per ingrandire la mappa'); return false; } return true; }
      if (e.type === 'touchstart') return e.touches.length >= 2;
      return !e.button;
    })
    .on('zoom', (e) => { t = e.transform; ridisegna(); });
  const limiti = () => zoom.extent([[0, 0], [larg, alt]]).translateExtent([[-larg * 0.2, -alt * 0.2], [larg * 1.2, alt * 1.2]]);
  const sel = d3.select(canvas).call(zoom);
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) mostraAvviso('Usa due dita per spostare e ingrandire la mappa'); }, { passive: true });
  function cercaPunto(px, py) {
    const k = t.k * base.s;
    const x = (px - (t.k * base.ox + t.x)) / k, y = (py - (t.k * base.oy + t.y)) / k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const f of forme) { const b = f.bb; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (ctx.isPointInPath(f.path, x, y)) return f.i; }
    return null;
  }
  canvas.addEventListener('click', (e) => { const r = canvas.getBoundingClientRect(); mostra(cercaPunto(e.clientX - r.left, e.clientY - r.top)); usata(); });
  box.querySelector('[data-zoom="piu"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 2));
  box.querySelector('[data-zoom="meno"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 0.5));
  box.querySelector('[data-zoom="italia"]').addEventListener('click', () => { sel.transition().duration(500).call(zoom.transform, d3.zoomIdentity); mostra(null); });
  function vaiA(i) {
    const f = formaDi.get(i);
    if (!f) return;
    const b = f.bb, w = Math.max(b[2] - b[0], 4), h = Math.max(b[3] - b[1], 4);
    const k = Math.min(40, 0.3 * Math.min(larg / (w * base.s), alt / (h * base.s)));
    const cx = base.ox + ((b[0] + b[2]) / 2) * base.s, cy = base.oy + ((b[1] + b[3]) / 2) * base.s;
    sel.transition().duration(650).call(zoom.transform, d3.zoomIdentity.translate(larg / 2 - k * cx, alt / 2 - k * cy).scale(Math.max(1, k)));
    mostra(i);
  }

  // ---------- comune scelto ----------
  function mostra(i) {
    scelto = i;
    info.innerHTML = '';
    if (i == null) { info.append(el('p', 'nota', 'Tocca un comune sulla mappa' + (K.cerca ? ' o cercalo qui sopra' : '') + ' per vedere il suo valore.')); aggiornaLink(); ridisegna(); return; }
    info.append(el('p', 'mappa-nome', nomeComune(i)));
    const r = R[i];
    const righe = [valoreTesto(V[i], S)];
    const p = posto(i);
    if (classi.tipo === 'valori' && V[i] != null) {
      const f = classi.fasce[classe(V[i])];
      righe.push(f.n === 1 ? 'l\'unico comune con questo valore' : `uno dei ${fmtN(f.n, 0)} comuni con questo valore`);
    } else if (p) righe.push(`${fmtN(p, 0)}° valore più alto su ${fmtN(ordine.length, 0)}${testoSoglia()}`);
    else if (V[i] != null && soglia) righe.push(`fuori classifica: sotto i ${fmtN(soglia.n, 0)} ${soglia.su}`);
    righe.push(`${r[IX.provincia]}, ${r[IX.regione]} · ${fmtN(r[IX.residenti], 0)} abitanti`);
    info.append(el('p', 'mappa-valore', righe[0]));
    info.append(el('p', 'nota', righe.slice(1).join(' · ')));
    aggiornaLink();
    ridisegna();
  }

  // ---------- scelta del numero ----------
  const selTema = $('scelta-tema'), selNum = $('scelta-numero');
  K.temi.forEach((tm, k) => selTema.append(new Option(tm.nome, String(k))));
  const temaDi = new Map();
  K.temi.forEach((tm, k) => tm.indicatori.forEach((n) => temaDi.set(n, k)));
  function riempiNumeri(k) { selNum.innerHTML = ''; K.temi[k].indicatori.forEach((n) => selNum.append(new Option(K.schede[n].etichetta, n))); }
  selTema.addEventListener('change', () => { riempiNumeri(+selTema.value); scegli(selNum.value); });
  selNum.addEventListener('change', () => scegli(selNum.value));

  let gia = new Set();
  async function scegli(n) {
    if (!K.schede[n]) n = K.predefinito;
    selTema.value = String(temaDi.get(n)); riempiNumeri(temaDi.get(n)); selNum.value = n;
    nome = n; S = K.schede[n];
    $('titolo-numero').textContent = S.etichetta;
    $('sottotitolo-numero').textContent = 'Caricamento…';
    try { V = await carica(n); } catch (e) { $('sottotitolo-numero').textContent = 'Non riusciamo a caricare questo numero: riprova tra poco.'; return; }
    if (nome !== n) return;
    classi = faiClassi(V);
    perClasse = new Map();
    for (const f of forme) {
      const c = f.i == null ? -1 : classe(V[f.i]);
      if (!perClasse.has(c)) perClasse.set(c, new Path2D());
      perClasse.get(c).addPath(f.path);
    }
    await preparaClassifica();
    $('sottotitolo-numero').textContent = S.definizione + ' · ' + S.dati_al + ' · ' + S.fonte.split(',')[0];
    legenda(); classifica(); scheda(); mostra(scelto);
    if (!gia.has(n) && window.goatcounter && window.goatcounter.count) {
      gia.add(n);
      window.goatcounter.count({ path: 'mappa-dati-' + n, title: 'Mappa dei comuni · ' + n, event: true });
    }
  }
  let contato = false;
  function usata() { if (contato || !window.goatcounter || !window.goatcounter.count) return; contato = true; window.goatcounter.count({ path: 'mappa-dati-usata', title: 'Mappa dei comuni usata', event: true }); }
  zoom.on('start', usata);

  // ---------- link condivisibile: ?n=<indicatore>&c=<comune> ----------
  function aggiornaLink() {
    const q = new URLSearchParams();
    if (nome && nome !== K.predefinito) q.set('n', nome);
    if (scelto != null) q.set('c', linkComune(scelto));
    const s = q.toString();
    history.replaceState(null, '', s ? '?' + s : location.pathname);
  }
  function daLink() {
    const q = new URLSearchParams(location.search);
    const c = q.get('c');
    let i = null;
    if (c) { const k = slug(c); i = R.findIndex((_, j) => linkComune(j) === k || nomiN[j].replace(/ /g, '-') === k); if (i < 0) i = null; }
    return { n: q.get('n') || K.predefinito, i };
  }

  // ---------- ricerca ----------
  const inp = $('cerca-comune'), lista = $('suggerimenti');
  if (inp && K.cerca) {
    inp.addEventListener('input', () => {
      const q = norm(inp.value);
      lista.innerHTML = '';
      if (q.length < 2) { lista.hidden = true; return; }
      const z = q.replace(/ /g, '');
      const ini = [], den = [];
      nomiN.forEach((k, i) => { const kk = k.replace(/ /g, ''); if (kk.startsWith(z)) ini.push(i); else if (kk.includes(z)) den.push(i); });
      const tutti = ini.sort((a, b) => R[b][IX.residenti] - R[a][IX.residenti]).concat(den).slice(0, 8);
      if (!tutti.length) { lista.append(el('li', 'nota', 'Nessun comune con questo nome')); lista.hidden = false; return; }
      tutti.forEach((i) => {
        const li = el('li');
        const b = el('button', 'link-comune', nomeComune(i)); b.type = 'button';
        b.addEventListener('click', () => { lista.hidden = true; inp.value = R[i][IX.comune]; vaiA(i); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
        li.append(b, el('span', null, R[i][IX.regione]));
        lista.append(li);
      });
      lista.hidden = false;
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = lista.querySelector('button'); if (b) b.click(); } });
  }

  // ---------- CSV ----------
  $('scarica-csv').addEventListener('click', () => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const testa = ['codice_istat', 'comune', 'sigla', 'provincia', 'regione', 'residenti', nome];
    const righe = R.map((r, i) => [r[IX.codice], q(r[IX.comune]), r[IX.sigla], q(r[IX.provincia]), q(r[IX.regione]), r[IX.residenti], V[i] == null ? '' : V[i]].join(','));
    const testo = '﻿' + testa.join(',') + '\n' + righe.join('\n') + '\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([testo], { type: 'text/csv;charset=utf-8' }));
    a.download = 'comune_che_vai_' + nome + '.csv';
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'scarica-csv-mappa-' + nome, title: 'CSV mappa · ' + nome, event: true });
  });

  // ---------- avvio ----------
  misura(); limiti();
  const L = daLink();
  scelto = L.i;
  scegli(L.n).then(() => { if (L.i != null) vaiA(L.i); });
  let rid;
  window.addEventListener('resize', () => { clearTimeout(rid); rid = setTimeout(() => { misura(); limiti(); disegna(); }, 120); });
})();
