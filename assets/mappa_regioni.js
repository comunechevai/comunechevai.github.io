// Mappa interattiva delle regioni (video con mappa regionale, es. il 10 · Calcio).
// Stessa struttura di mappa.js, ma le forme sono venti e non c'è un valore per forma:
// di ogni regione si pubblica solo la fascia di colore, quella che si vede nel video.
// Dati: <script id="dati"> della pagina + assets/regioni_2026.js (confini).
(function () {
  const box = document.getElementById('mappa');
  if (!box || !window.REGIONI_2026 || !window.d3) return;
  const D = JSON.parse(document.getElementById('dati').textContent);
  const T = window.REGIONI_2026;
  const canvas = box.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const info = document.getElementById('mappa-info');
  const avviso = box.querySelector('.mappa-avviso');
  const css = getComputedStyle(document.documentElement);
  const colore = (nome, riserva) => (css.getPropertyValue(nome).trim() || riserva);
  const MANCA = '#a3a7b0';

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

  const righe = new Map(D.regioni.map((r) => [r[0], r]));   // nome -> [nome, fascia, nel_video]
  const geoms = T.objects.regioni.geometries;
  const uso = new Map();
  const regioni = geoms.map((g) => {
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
    return { nome: g.properties.c, path: p, bb: [x0, y0, x1, y1], riga: righe.get(g.properties.c) };
  });

  const perFascia = new Map();
  for (const r of regioni) {
    const f = r.riga && r.riga[1] != null ? r.riga[1] : 0;
    if (!perFascia.has(f)) perFascia.set(f, new Path2D());
    perFascia.get(f).addPath(r.path);
  }
  const confini = new Path2D(), costa = new Path2D();
  for (const [k, ps] of uso) {
    const dest = ps.length === 1 ? costa : (ps[0] !== ps[1] ? confini : null);
    if (!dest) continue;
    archiKm[k].forEach(([x, y], j) => (j ? dest.lineTo(x, y) : dest.moveTo(x, y)));
  }

  // ---------- disegno ----------
  let larg = 0, alt = 0, dpr = 1, base = { s: 1, ox: 0, oy: 0 }, t = d3.zoomIdentity, scelta = null, attesa = false;
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
    ctx.strokeStyle = colore('--inchiostro', '#1c2230');
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.min(1.6, 0.6 + t.k * 0.08) / k;
    ctx.stroke(confini);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.8 / k;
    ctx.stroke(costa);
    ctx.globalAlpha = 1;
    if (scelta) {
      ctx.lineWidth = 3 / k; ctx.strokeStyle = carta; ctx.stroke(scelta.path);
      ctx.lineWidth = 1.6 / k; ctx.strokeStyle = colore('--inchiostro', '#1c2230'); ctx.stroke(scelta.path);
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
    .scaleExtent([1, 20])
    .filter((e) => {
      if (e.type === 'wheel') { if (!(e.ctrlKey || e.metaKey)) { mostraAvviso('Usa Ctrl + rotellina per ingrandire la mappa'); return false; } return true; }
      if (e.type === 'touchstart') { if (e.touches.length < 2) return false; return true; }
      return !e.button;
    })
    .on('zoom', (ev) => { t = ev.transform; ridisegna(); });
  function limiti() {
    zoom.extent([[0, 0], [larg, alt]]).translateExtent([[-larg * 0.2, -alt * 0.2], [larg * 1.2, alt * 1.2]]);
  }
  let contato = false;
  function usata() {
    if (contato || !window.goatcounter || !window.goatcounter.count) return;
    contato = true;
    window.goatcounter.count({ path: 'mappa-' + (D.cartella || ''), title: 'Mappa usata · ' + (D.cartella || ''), event: true });
  }
  zoom.on('start', usata);
  const sel = d3.select(canvas).call(zoom);
  canvas.addEventListener('touchstart', (ev) => { if (ev.touches.length === 1) mostraAvviso('Usa due dita per spostare e ingrandire la mappa'); }, { passive: true });

  // ---------- regione toccata ----------
  function cerca(px, py) {
    const k = t.k * base.s;
    const x = (px - (t.k * base.ox + t.x)) / k, y = (py - (t.k * base.oy + t.y)) / k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const r of regioni) {
      const b = r.bb;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (ctx.isPointInPath(r.path, x, y)) return r;
    }
    return null;
  }
  function testo(tag, classe, s) { const el = document.createElement(tag); el.className = classe; el.textContent = s; return el; }
  function mostra(r) {
    scelta = r;
    info.innerHTML = '';
    if (!r || !r.riga) { info.append(testo('p', 'nota', 'Tocca una regione per vedere la sua fascia.')); ridisegna(); return; }
    info.append(testo('p', 'mappa-nome', r.riga[0]));
    const dett = [r.riga[1] == null ? 'dato non disponibile' : 'fascia: ' + D.fasce[r.riga[1] - 1].testo];
    if (r.riga[2]) dett.push('citata nel video');
    info.append(testo('p', 'nota', dett.join(' · ')));
    ridisegna();
  }
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    mostra(cerca(ev.clientX - r.left, ev.clientY - r.top));
    usata();
  });

  box.querySelector('[data-zoom="piu"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 2));
  box.querySelector('[data-zoom="meno"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 0.5));
  box.querySelector('[data-zoom="italia"]').addEventListener('click', () => { sel.transition().duration(500).call(zoom.transform, d3.zoomIdentity); mostra(null); });

  misura(); limiti(); mostra(null); disegna();
  let rid;
  window.addEventListener('resize', () => { clearTimeout(rid); rid = setTimeout(() => { misura(); limiti(); disegna(); }, 120); });
})();
