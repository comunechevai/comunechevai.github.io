// Mappa interattiva delle zone di un video sotto il comune (es. i CAP di Milano): stessi colori del video,
// zoom, tocco su una zona. Gemella di mappa.js (che disegna i 7.896 comuni).
// Dati: <script id="dati"> della pagina (fascia e valore di ogni zona) + zone.js della pagina (window.ZONE_VIDEO:
// zone e contorni in km, y verso il basso, scritti da toolkit/mappe/esporta_zone.py).
(function () {
  const box = document.getElementById('mappa');
  if (!box || !window.ZONE_VIDEO || !window.d3) return;
  const D = JSON.parse(document.getElementById('dati').textContent);
  const Z = window.ZONE_VIDEO;
  const canvas = box.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const info = document.getElementById('mappa-info');
  const avviso = box.querySelector('.mappa-avviso');
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 6 });
  const css = getComputedStyle(document.documentElement);
  const colore = (nome, riserva) => (css.getPropertyValue(nome).trim() || riserva);
  const MANCA = '#a3a7b0';
  const parola = (D.parola && D.parola[0]) || 'zona';

  function tracciato(anelli) {
    const p = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const a of anelli) {
      a.forEach(([x, y], j) => {
        if (j) p.lineTo(x, y); else p.moveTo(x, y);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      });
      p.closePath();
    }
    return { path: p, bb: [x0, y0, x1, y1] };
  }
  const righe = new Map(D.comuni.map((r) => [String(r[0]), r]));   // codice -> [codice, nome, gruppo, valore, fascia, nel_video]
  const zone = Z.zone.map((z) => Object.assign({ codice: z.id, riga: righe.get(String(z.id)) }, tracciato(z.anelli)));
  const contorni = Z.contorni.map((c) => Object.assign({ nome: c.nome }, tracciato(c.anelli)));
  let W0 = 0, H0 = 0;
  for (const z of zone.concat(contorni)) { W0 = Math.max(W0, z.bb[2]); H0 = Math.max(H0, z.bb[3]); }

  const perFascia = new Map();
  for (const z of zone) {
    const f = z.riga && z.riga[4] != null ? z.riga[4] : 0;
    if (!perFascia.has(f)) perFascia.set(f, new Path2D());
    perFascia.get(f).addPath(z.path);
  }
  const linee = new Path2D();
  for (const c of contorni) linee.addPath(c.path);

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
    for (const [f, p] of perFascia) { ctx.fillStyle = f ? (D.colori[f - 1] || MANCA) : MANCA; ctx.fill(p); }
    ctx.strokeStyle = carta;
    ctx.lineWidth = 1.2 / k;
    for (const p of perFascia.values()) ctx.stroke(p);
    ctx.strokeStyle = colore('--inchiostro', '#1c2230');
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.min(2.2, 1.1 + t.k * 0.1) / k;
    ctx.stroke(linee);
    ctx.globalAlpha = 1;
    if (scelto) {
      ctx.lineWidth = 3.5 / k; ctx.strokeStyle = carta; ctx.stroke(scelto.path);
      ctx.lineWidth = 2 / k; ctx.strokeStyle = colore('--inchiostro', '#1c2230'); ctx.stroke(scelto.path);
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
    .scaleExtent([1, 12])
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
  function usata() {
    if (contato || !window.goatcounter || !window.goatcounter.count) return;
    contato = true;
    window.goatcounter.count({ path: 'mappa-' + (D.cartella || ''), title: 'Mappa usata · ' + (D.cartella || ''), event: true });
  }
  zoom.on('start', usata);
  const sel = d3.select(canvas).call(zoom);
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) mostraAvviso('Usa due dita per spostare e ingrandire la mappa'); }, { passive: true });

  // ---------- zona toccata ----------
  function cerca(px, py) {
    const k = t.k * base.s;
    const x = (px - (t.k * base.ox + t.x)) / k, y = (py - (t.k * base.oy + t.y)) / k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const z of zone) {
      const b = z.bb;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (ctx.isPointInPath(z.path, x, y, 'evenodd')) return z;
    }
    return null;
  }
  function testo(tag, classe, s) { const el = document.createElement(tag); el.className = classe; el.textContent = s; return el; }
  function mostra(z) {
    scelto = z;
    info.innerHTML = '';
    if (!z || !z.riga) { info.append(testo('p', 'nota', 'Tocca un ' + parola + ' per vedere il suo valore.')); ridisegna(); return; }
    const r = z.riga;
    info.append(testo('p', 'mappa-nome', parola + ' ' + r[0] + (r[1] ? ' · ' + r[1] : '')));
    const dett = [];
    if (r[3] != null) dett.push(fmt.format(r[3]) + (D.unita ? ' ' + D.unita : ''));
    dett.push(r[4] == null ? 'dato non disponibile' : 'fascia: ' + D.fasce[r[4] - 1].testo);
    if (D.colonne && D.colonne[2] && r[2]) dett.push(D.colonne[2].toLowerCase() + ' ' + r[2]);
    if (r[5]) dett.push('citato nel video');
    info.append(testo('p', 'nota', dett.join(' · ')));
    ridisegna();
  }
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    mostra(cerca(e.clientX - r.left, e.clientY - r.top));
    usata();
  });
  function vaiA(z) {
    const b = z.bb, w = Math.max(b[2] - b[0], 0.5), h = Math.max(b[3] - b[1], 0.5);
    const k = Math.min(8, 0.45 * Math.min(larg / (w * base.s), alt / (h * base.s)));
    const cx = base.ox + ((b[0] + b[2]) / 2) * base.s, cy = base.oy + ((b[1] + b[3]) / 2) * base.s;
    sel.transition().duration(650).call(zoom.transform, d3.zoomIdentity.translate(larg / 2 - k * cx, alt / 2 - k * cy).scale(Math.max(1, k)));
    mostra(z);
  }
  const perCodice = new Map(zone.map((z) => [String(z.codice), z]));
  document.addEventListener('comune:seleziona', (e) => {
    const z = perCodice.get(String(e.detail));
    if (!z) return;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    vaiA(z);
  });
  box.querySelector('[data-zoom="piu"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 2));
  box.querySelector('[data-zoom="meno"]').addEventListener('click', () => sel.transition().duration(300).call(zoom.scaleBy, 0.5));
  box.querySelector('[data-zoom="italia"]').addEventListener('click', () => { sel.transition().duration(500).call(zoom.transform, d3.zoomIdentity); mostra(null); });

  misura(); limiti(); mostra(null); disegna();
  let rid;
  window.addEventListener('resize', () => { clearTimeout(rid); rid = setTimeout(() => { misura(); limiti(); disegna(); }, 120); });
})();
