"""Pagina «I redditi del tuo comune» (redditi/index.html + redditi/dati.js, assets/redditi.js), usata da costruisci.py.

Per ogni comune i redditi IRPEF dell'ultimo anno pubblicato dal MEF:
- reddito medio = reddito complessivo dichiarato / numero di contribuenti (come nei video 04, 08, 12 e nei comunicati MEF);
- contribuenti ogni 100 abitanti (popolazione ISTAT al 1° gennaio dell'anno dopo l'anno d'imposta);
- lavoro dipendente, pensione, lavoro autonomo: quanti li dichiarano e la media = ammontare / frequenza, come il MEF;
- contribuenti per classe di reddito complessivo, in percentuale dei contribuenti (come nel video 12);
- per le città con più CAP, la tabella dei CAP (file subcomunale) e il link alla pagina del video sulle zone, se c'è.
Confronto con l'Italia: medie dalla somma di tutti i comuni (come i video); classi dal file nazionale delle dichiarazioni,
perché nel file comunale il MEF oscura alcune classi (segreto statistico), anche grandi: la somma darebbe un'Italia sbagliata.
Le classi oscurate restano vuote nella scheda: mai ricavate per differenza.

Si apre solo dal link mandato in DM a chi commenta REDDITI: redditi/?veroli, redditi/?castro-le (stesse regole di comune/?,
codice in assets/trova_comune.js). Niente link dal sito, noindex (decisione di Paolo del 2/11/2026).
Anno nuovo (aprile): aggiornare ANNO e i quattro file qui sotto, poi rigenerare il sito.
"""
import csv
import hashlib
import io
import json
import os
import zipfile

ANNO = 2024
QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(QUI)
F = os.path.join(ROOT, 'fonti')
FILE_COMUNI = os.path.join(F, 'mef', 'redditi_irpef_2024', 'Redditi_e_principali_variabili_IRPEF_su_base_comunale_CSV_2024.zip')
FILE_CAP = os.path.join(F, 'mef', 'redditi_irpef_2024', 'Redditi_e_principali_variabili_IRPEF_su_base_subcomunale_CSV_2024.zip')
FILE_CLASSI = os.path.join(F, 'mef', 'dichiarazioni_2025_classi', 'estratto_classi_reddito_2024.txt')
FILE_POP = os.path.join(F, 'istat', 'popolazione_per_eta', 'POSAS_2025_it_Comuni_2025-01-01.zip')
DATA_POP = '1° gennaio 2025'

C_N = 'Numero contribuenti'
C_RC = 'Reddito complessivo - Ammontare in euro'
TIPI = ['Reddito da lavoro dipendente e assimilati', 'Reddito da pensione',
        'Reddito da lavoro autonomo (comprensivo dei valori nulli)']
CLASSI = ['da 0 a 10000 euro', 'da 10000 a 15000 euro', 'da 15000 a 26000 euro', 'da 26000 a 55000 euro',
          'da 55000 a 75000 euro', 'da 75000 a 120000 euro', 'oltre 120000 euro']
# le 34 classi del file nazionale (riga NAZ dell'estratto, dall'indice 0 «minore di -1.000» al 33 «oltre 300.000»)
# sommate nelle 7 classi del file comunale; 0-2 sono i redditi negativi e zero, fuori dalle classi come nel file comunale
CLASSI_NAZ = [range(3, 14), range(14, 16), range(16, 18), range(18, 23), range(23, 26), range(26, 30), range(30, 34)]

PAGINA = '''<a class="indietro" href="../index.html">← Tutti i video</a>
<header class="intro"><h1>I redditi del tuo comune</h1>
<p>Quanto si dichiara al fisco nel tuo comune: reddito medio, stipendi, pensioni e fasce di reddito, confrontati con l'Italia. Dati del Ministero dell'Economia, redditi @ANNO@ dichiarati nel @ANNO1@.</p></header>
<div id="proposte" hidden></div>
<section class="sezione scheda-comune" id="scheda" aria-live="polite" hidden></section>
<script src="dati.js?v=@V_DATI@"></script>
<script src="../@TROVA@"></script>
<script src="../@JS@"></script>
'''


def _csv_zip(percorso):
    z = zipfile.ZipFile(percorso)
    nome = [n for n in z.namelist() if n.lower().endswith('.csv')]
    assert len(nome) == 1, percorso
    return list(csv.DictReader(io.TextIOWrapper(z.open(nome[0]), encoding='cp1252'), delimiter=';'))


def _num(s):
    s = (s or '').strip()
    return int(s) if s else None          # cella vuota = oscurata dal MEF


def _media(a, f):
    return round(a / f) if a is not None and f else None


def _popolazione():
    z = zipfile.ZipFile(FILE_POP)
    nome = [n for n in z.namelist() if n.lower().endswith('.csv')][0]
    t = io.TextIOWrapper(z.open(nome), encoding='utf-8-sig')
    next(t)                                   # titolo
    r = csv.reader(t, delimiter=';')
    assert next(r)[:3] == ['Codice comune', 'Comune', 'Età']
    return {row[0].zfill(6): int(row[5]) for row in r if len(row) >= 6 and row[2].strip() == '999'}


def _italia_classi():
    riga = [l for l in open(FILE_CLASSI, encoding='utf-8') if l.startswith('NAZ|')][0]
    v = [int(x) for x in riga.split('|')[1].split(',')]
    assert len(v) == 34
    return [sum(v[i] for i in g) for g in CLASSI_NAZ], sum(v)


def dati(voci):
    """Il dizionario che finisce in redditi/dati.js (window.REDDITI)."""
    elenco = list(csv.DictReader(open(os.path.join(ROOT, 'toolkit', 'mappe', 'comuni_2026.csv'), encoding='utf-8')))
    codici = [r['codice'].zfill(6) for r in elenco]
    pos = {c: i for i, c in enumerate(codici)}
    mef = {r['Codice Istat Comune']: r for r in _csv_zip(FILE_COMUNI)}
    senza = mef.pop('0')                  # contribuenti senza comune: contano solo nel totale Italia, come nei video
    assert senza['Regione'] == 'Mancante/errata'
    assert sorted(mef) == sorted(codici), 'il file MEF non ha esattamente i comuni di comuni_2026.csv'
    assert all(r['Anno di imposta'] == str(ANNO) for r in mef.values())
    pop = _popolazione()
    assert sorted(pop) == sorted(codici), 'il file ISTAT della popolazione non ha esattamente i comuni di comuni_2026.csv'

    comuni, valori = [], []
    tot = dict(N=0, RC=0, pop=0, **{f'F{k}': 0 for k in range(3)}, **{f'A{k}': 0 for k in range(3)})
    regioni = {}
    for c, r in zip(codici + ['0'], elenco + [None]):
        m = mef[c] if r else senza
        n, rc = _num(m[C_N]), _num(m[C_RC])
        assert n and rc is not None, c
        tipi = []
        for k, t in enumerate(TIPI):
            f, a = _num(m[t + ' - Frequenza']), _num(m[t + ' - Ammontare in euro'])
            tipi += [f, _media(a, f)]
            if f is not None and a is not None:
                tot[f'F{k}'] += f
                tot[f'A{k}'] += a
        tot['N'] += n
        tot['RC'] += rc
        if not r:
            break
        classi = [_num(m[f'Reddito complessivo {k} - Frequenza']) for k in CLASSI]
        valori.append([n, round(rc / n)] + tipi + classi)
        comuni.append([r['comune'], r['sigla'], r['regione'], pop[c],
                       r['comune_ufficiale'] if r['comune_ufficiale'] != r['comune'] else ''])
        tot['pop'] += pop[c]
        g = regioni.setdefault(r['regione'], [0, 0])
        g[0] += rc
        g[1] += n

    classi_ita, n_naz = _italia_classi()
    # controllo che le classi nazionali siano quelle del file comunale: dove il MEF oscura poco, le somme coincidono
    for k, cl in enumerate(CLASSI):
        somma = sum(_num(m[f'Reddito complessivo {cl} - Frequenza']) or 0 for m in mef.values())
        assert somma <= classi_ita[k] * 1.0001, (cl, somma, classi_ita[k])
        if k < 4:
            assert abs(somma - classi_ita[k]) / classi_ita[k] < 0.001, (cl, somma, classi_ita[k])
    italia = dict(contribuenti=tot['N'], medio=round(tot['RC'] / tot['N']), abitanti=tot['pop'],
                  tipi=[[tot[f'F{k}'], round(tot[f'A{k}'] / tot[f'F{k}'])] for k in range(3)],
                  classi=[round(100 * x / n_naz, 1) for x in classi_ita], contribuenti_classi=n_naz)

    cap = {}
    for r in _csv_zip(FILE_CAP):
        assert r['Anno di imposta'] == str(ANNO)
        n, rc = _num(r[C_N]), _num(r[C_RC])
        if r['Codice Istat Comune'] in pos and n and rc is not None:
            cap.setdefault(pos[r['Codice Istat Comune']], []).append([r['CAP'], n, round(rc / n)])
    for righe in cap.values():
        righe.sort(key=lambda x: -x[2])

    zone = {}
    per_nome = {r['comune']: pos[c] for c, r in zip(codici, elenco)}
    for v, s in voci:
        if s.get('livello') == 'cap' and 'reddito' in s.get('indicatore', '').lower() and s.get('luogo') in per_nome:
            t = s['titolo']
            zone[per_nome[s['luogo']]] = [t if t.startswith(s['numero']) else f"{s['numero']} · {t}",
                                          f"../video/{v['cartella']}/index.html"]

    return dict(anno=ANNO, data_pop=DATA_POP, italia=italia,
                regioni={k: round(a / n) for k, (a, n) in regioni.items()},
                comuni=comuni, valori=valori, cap=cap, zone=zone)


def pagina_redditi(voci, uscita, testa, piede, ver):
    dest = os.path.join(uscita, 'redditi')
    os.makedirs(dest, exist_ok=True)
    d = dati(voci)
    js = 'window.REDDITI=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(dest, 'dati.js'), 'w', encoding='utf-8').write(js)
    corpo = testa('I redditi del tuo comune · Comune che vai',
                  'Reddito medio, stipendi, pensioni e fasce di reddito del tuo comune, confrontati con l\'Italia.', '../')
    # raggiungibile solo dal link mandato in DM: niente link dal sito, niente motori di ricerca
    corpo = corpo.replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"', 1)
    corpo += (PAGINA.replace('@ANNO@', str(ANNO)).replace('@ANNO1@', str(ANNO + 1))
              .replace('@V_DATI@', hashlib.md5(js.encode('utf-8')).hexdigest()[:8])
              .replace('@TROVA@', ver('trova_comune.js')).replace('@JS@', ver('redditi.js')))
    corpo += piede()
    open(os.path.join(dest, 'index.html'), 'w', encoding='utf-8').write(corpo)
    return len(d['comuni']), len(d['cap'])
