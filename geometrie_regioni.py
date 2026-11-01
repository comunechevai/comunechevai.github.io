"""Confini delle venti regioni per la mappa del sito (video con mappa regionale, es. il 10 · Calcio).

Stessi confini dei video: le regioni nascono unendo i comuni di toolkit/mappe/geo.py (EPSG:3035),
semplificati con mapshaper in modo topologico e salvati come TopoJSON dentro un file JavaScript,
così la mappa funziona anche aprendo la pagina dal disco. Stesso formato di comuni_2026.js:
properties «c» (nome della regione, la chiave delle righe) e «p» (di nuovo la regione, così
mappa_regioni.js disegna scuri i confini fra regioni diverse e chiari quelli di costa).

Uso, dalla cartella ProgettoMappe, con mapshaper installato (npm i mapshaper@0.6.102):
    python -I sito/geometrie_regioni.py <percorso di mapshaper>
Scrive sito/assets/regioni_2026.js (window.REGIONI_2026 = {...}); si rifà solo se cambiano i confini.
"""
import json
import os
import subprocess
import sys
import tempfile

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(QUI)
sys.path.insert(0, os.path.join(ROOT, 'toolkit'))

from shapely.geometry import mapping
from shapely.ops import unary_union

from mappe import codici, geo

SEMPLIFICA = '4%'           # meno vertici dei comuni: qui i confini interni non servono
QUANTIZZA = 20000


def forme():
    """{regione: poligono} unendo i comuni, come fa render.py del video 10."""
    G, ana, per = geo.carica(), codici.anagrafica(), {}
    for c, d in ana.items():
        if c in G['comuni'] and d['regione']:
            per.setdefault(d['regione'], []).append(G['comuni'][c])
    out = {r: unary_union(v).buffer(0) for r, v in sorted(per.items())}
    assert len(out) == 20, 'regioni trovate: %d' % len(out)
    return out


def main(mapshaper):
    feats = [{'type': 'Feature', 'properties': {'c': r, 'p': r}, 'geometry': mapping(g)}
             for r, g in forme().items()]
    with tempfile.TemporaryDirectory() as d:
        src, out = os.path.join(d, 'regioni.json'), os.path.join(d, 'regioni_topo.json')
        json.dump({'type': 'FeatureCollection', 'features': feats}, open(src, 'w'))
        subprocess.run([mapshaper, src, '-simplify', SEMPLIFICA, 'weighted', 'keep-shapes', 'planar',
                        '-o', 'format=topojson', f'quantization={QUANTIZZA}', 'precision=1', out],
                       check=True, capture_output=True)
        topo = json.load(open(out))
    nome = next(iter(topo['objects']))
    topo['objects'] = {'regioni': topo['objects'][nome]}
    n = len(topo['objects']['regioni']['geometries'])
    assert n == 20, f'{n} regioni invece di 20'
    dest = os.path.join(QUI, 'assets', 'regioni_2026.js')
    with open(dest, 'w') as f:
        f.write('/* Confini delle venti regioni italiane, EPSG:3035 semplificati. Comune che vai. */\n')
        f.write('window.REGIONI_2026=')
        json.dump(topo, f, separators=(',', ':'))
        f.write(';\n')
    print(dest, round(os.path.getsize(dest) / 1e3, 1), 'KB,', n, 'regioni,', len(topo['arcs']), 'archi')


if __name__ == '__main__':
    main(sys.argv[1])
