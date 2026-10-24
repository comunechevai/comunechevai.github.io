"""Confini dei 7.896 comuni (codici ISTAT 2026) per la mappa interattiva del sito.

Stessi confini dei video (toolkit/mappe/geo.py, EPSG:3035), semplificati con mapshaper in modo topologico
(i comuni vicini condividono gli stessi bordi: niente buchi né sovrapposizioni) e salvati come TopoJSON
dentro un file JavaScript, così la mappa funziona anche aprendo la pagina dal disco.

Uso, dalla cartella ProgettoMappe, nel container di Claude dopo `bash toolkit/setup.sh`
e con mapshaper installato (npm i mapshaper@0.6.102):
    /root/venv/geo/bin/python -I sito/geometrie_sito.py <percorso di mapshaper>
Scrive sito/assets/comuni_2026.js (window.COMUNI_2026 = {...}); si rifà solo se cambiano i confini.
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

from mappe import codici, geo

SEMPLIFICA = '10%'          # quota di vertici tenuti (Visvalingam pesato), con keep-shapes
QUANTIZZA = 40000


def main(mapshaper):
    G = geo.carica()
    feats = []
    for c in codici.codici():
        feats.append({'type': 'Feature', 'properties': {'c': codici.sigla(c), 'p': G['prov'][c] or ''},
                      'geometry': mapping(G['comuni'][c])})
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, 'comuni.json')
        out = os.path.join(d, 'comuni_topo.json')
        json.dump({'type': 'FeatureCollection', 'features': feats}, open(src, 'w'))
        subprocess.run([mapshaper, src, '-simplify', SEMPLIFICA, 'weighted', 'keep-shapes', 'planar',
                        '-o', 'format=topojson', f'quantization={QUANTIZZA}', 'precision=1', out],
                       check=True, capture_output=True)
        topo = json.load(open(out))
    nome = next(iter(topo['objects']))
    topo['objects'] = {'comuni': topo['objects'][nome]}
    n = len(topo['objects']['comuni']['geometries'])
    assert n == 7896, f'{n} comuni invece di 7.896'
    dest = os.path.join(QUI, 'assets', 'comuni_2026.js')
    with open(dest, 'w') as f:
        f.write('/* Confini dei 7.896 comuni italiani, codici ISTAT 2026, EPSG:3035 semplificati. Comune che vai. */\n')
        f.write('window.COMUNI_2026=')
        json.dump(topo, f, separators=(',', ':'))
        f.write(';\n')
    print(dest, round(os.path.getsize(dest) / 1e6, 2), 'MB,', n, 'comuni,', len(topo['arcs']), 'archi')


if __name__ == '__main__':
    main(sys.argv[1])
