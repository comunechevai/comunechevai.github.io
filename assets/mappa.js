// Mappa interattiva dei comuni di un video: stessi colori del video, zoom, tocco su un comune.
// Dati: <script id="dati"> della pagina (fascia e valore di ogni comune) + assets/comuni_2026.js (confini).
// Zoom: rotellina con Ctrl, doppio clic, pulsanti +/−; sul telefono due dita (un dito scorre la pagina).
(function () {
  const box = document.getElementById('mappa');
  if (!box || !window.COMUNI_2026 || !window.d3) return;
  const D = JSON.parse(document.getElementById('dati').textContent);
  const T = window.COMUNI_2026;
  const canvas = box.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const info = document.getElementById('mappa-info');
  const avviso = box.querySelector('.mappa-avviso');
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 6 });
  const css = getComputedStyle(document.documentElement);
  const colore = (nome, riserva) => (css.getPropertyValue(nome).trim() || riserva);
  const MANCA = '#a3a7b0';   // grigio freddo: si distingue da tutte le palette dei video

  // ---------- decodifica TopoJSON (coordinate in km, y verso il basso) ----------
  const [sx, sy] = T.transform.scale, [tx, ty] = T.transform.translate;
  const archi = T.arcs.map((a) => {
    let x = 0, y = 0;
    return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  let minX = Infinity, maxY = -Infinity, maxX = -Infinity, minY = Infinity;
  for (const a of archi) for (const [x, y] of a) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const km = ([x, y]) => [(x - minX) / 1000, (maxY - y) / 1000];
  const archiKm = archi.map((a) => a.map(km));
  const W0 = (maxX - minX) / 1000, H0 = (maxY - minY) / 1000;

  const righe = new Map(D.comuni.map((r) => [r[0], r]));   // codice -> [codice, nome, prov, valore, fascia, nel_video]
  const geoms = T.objects.comuni.geometries;
  const uso = new Map();                                     // arco -> province che lo usano
  const comuni = geoms.map((g) => {
    const p = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const poligoni = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    for (const pol of poligoni) for (const anello of pol) {
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
    return { codice: g.properties.c, path: p, bb: [x0, y0, x1, y1], riga: righe.get(g.properties.c) };
  });

  // un tracciato per colore (disegno veloce) + confini provinciali (archi tra province diverse)
  const perFascia = new Map();
  for (const c of comuni) {
    const f = c.riga && c.riga[4] != null ? c.riga[4] : 0;
    if (!perFascia.has(f)) perFascia.set(f, new Path2D());
    perFascia.get(f).addPath(c.path);
  }
  const province = new Path2D(), costa = new Path2D();
  for (const [k, ps] of uso) {
    const dest = ps.length === 1 ? costa : (ps[0] !== ps[1] ? province : null);
    if (!dest) continue;
    archiKm[k].forEach(([x, y], j) => (j ? dest.lineTo(x, y) : dest.moveTo(x, y)));
  }

  // ---------- disegno ----------
  let larg = 0, alt = 0, dpr = 1, base = { s: 1, ox: 0, oy: 0 }, t = d3.zoomIdentity, scelto = null, attesa = false;
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
    for (const [f, p] of perFascia) {
      ctx.fillStyle = f ? (D.colori[f - 1] || MANCA) : MANCA;
      ctx.fill(p);
    }
    if (t.k > 1.6) {                                  // bordi dei comuni solo quando si ingrandisce
      ctx.strokeStyle = carta;
      ctx.lineWidth = Math.min(1, 0.25 + t.k * 0.05) / k;
      for (const p of perFascia.values()) ctx.stroke(p);
    }
    ctx.strokeStyle = colore('--inchiostro', '#1c2230');
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.min(1.6, 0.6 + t.k * 0.08) / k;
    ctx.stroke(province);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.8 / k;
    ctx.stroke(costa);
    ctx.globalAlpha = 1;
    if (scelto) {
      ctx.lineWidth = 3 / k; ctx.strokeStyle = carta; ctx.stroke(scelto.path);
      ctx.lineWidth = 1.6 / k; ctx.strokeStyle = colore('--inchiostro', '#1c2230'); ctx.stroke(scelto.path);
    }
  }
  const ridisegna = () => { if (!attesa) { attesa = true; requestAnimationFrame(disegna); } };

  // ---------- zoom ----------
  let suggerimento;
  function mostraAvviso(testo) {
    avviso.textContent = testo; avviso.hidden = false;
    clearTimeout(suggerimento); suggerimento = setTimeout(() => { avviso.hidden = true; }, 1600);
  }
  const zoom = d3.zoom()
    .scaleExtent([1, 80])
    .filter((e) => {
      if (e.type === 'wheel') { if (!(e.ctrlKey || e.metaKey)) { mostraAvviso('Usa Ctrl + rotellina per ingrandire la mappa'); return false; } return true; }
      if (e.type === 'touchstart') { if (e.touches.length < 2) return false; return true; }
      return !e.button;
    })
    .on('zoom', (e) => { t = e.transform; ridisegna(); });
  function limiti() {
    zoom.extent([[0, 0], [larg, alt]]).translateExtent([[-larg * 0.2, -alt * 0.2], [larg * 1.2, alt * 1.2]]);
  }
  let contato = false;
  function usata() {                                  // conta una volta per visita l'uso della mappa (GoatCounter)
    if (contato || !window.goatcounter || !window.goatcounter.count) return;
    contato = true;
    window.goatcounter.count({ path: 'mappa-' + (D.cartella || ''), title: 'Mappa usata · ' + (D.cartella || ''), event: true });
  }
  zoom.on('start', usata);
  const sel = d3.select(canvas).call(zoom);
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) mostraAvviso('Usa due dita per spostare e ingrandire la mappa'); }, { passive: true });

  // ---------- comune toccato ----------
  function cerca(px, py) {
    const k = t.k * base.s;
    const x = (px - (t.k * base.ox + t.x)) / k, y = (py - (t.k * base.oy + t.y)) / k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const c of comuni) {
      const b = c.bb;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (ctx.isPointInPath(c.path, x, y)) return c;
    }
    return null;
  }
  function mostra(c) {
    scelto = c;
    if (!c || !c.riga) { info.innerHTML = ''; info.append(testo('p', 'nota', 'Tocca un comune per vedere il suo valore.')); ridisegna(); return; }
    const r = c.riga;
    info.innerHTML = '';
    const tit = testo('p', 'mappa-nome', r[1] + (r[2] ? ' (' + r[2] + ')' : ''));
    info.append(tit);
    const dett = [];
    if (D.con_valori && r[3] != null) dett.push(fmt.format(r[3]) + (D.unita ? ' ' + D.unita : ''));
    dett.push(r[4] == null ? 'dato non disponibile' : 'fascia: ' + D.fasce[r[4] - 1].testo);
    if (r[5]) dett.push('citato nel video');
    info.append(testo('p', 'nota', dett.join(' · ')));
    ridisegna();
  }
  function testo(tag, classe, s) { const el = document.createElement(tag); el.className = classe; el.textContent = s; return el; }
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    mostra(cerca(e.clientX - r.left, e.clientY - r.top));
    usata();
  });

  function vaiA(c) {
    const b = c.bb, w = Math.max(b[2] - b[0], 4), h = Math.max(b[3] - b[1], 4);
    const k = Math.min(60, 0.35 * Math.min(larg / (w * base.s), alt / (h * base.s)));
    const cx = base.ox + ((b[0] + b[2]) / 2) * base.s, cy = base.oy + ((b[1] + b[3]) / 2) * base.s;
    sel.transition().duration(650).call(zoom.transform, d3.zoomIdentity.translate(larg / 2 - k * cx, alt / 2 - k * cy).scale(k));
    mostra(c);
  }
  const perCodice = new Map(comuni.map((c) => [c.codice, c]));
  document.addEventListener('comune:seleziona', (e) => {
    const c = perCodice.get(e.detail);
    if (!c) return;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    vaiA(c);
  });

  box.querySelector('[data-zoom="piu"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 2));
  box.querySelector('[data-zoom="meno"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 0.5));
  box.querySelector('[data-zoom="italia"]').addEventListener('click', () => { sel.transition().duration(500).call(zoom.transform, d3.zoomIdentity); mostra(null); });

  misura(); limiti(); mostra(null); disegna();
  let rid;
  window.addEventListener('resize', () => { clearTimeout(rid); rid = setTimeout(() => { misura(); limiti(); disegna(); }, 120); });
})();
