"""Costruisce il sito «Fonti e dati di ogni video» (GitHub Pages) da sito/video.json e dai dati_pubblici dei video.

Uso, dalla cartella ProgettoMappe:
    python sito/costruisci.py                              # rigenera sito/index.html e sito/video/*
    python sito/costruisci.py --uscita /tmp/prova --aggiungi 05_polo   # anteprima con un video non ancora in elenco

sito/video.json è l'elenco dei video pubblicati, dal più vecchio al più nuovo:
    [{"cartella": "05_polo", "pubblicato": "2026-11-03",
      "instagram": "https://www.instagram.com/reel/...", "tiktok": "https://...", "youtube": "https://..."}]
Titolo, fonte, metodo e dati arrivano da video/<cartella>/dati_pubblici/ (render.py --esporta).

sito/caroselli.json è l'elenco dei caroselli pubblicati (sezione «Caroselli» della pagina principale):
    [{"cartella": "2026-10-26_ecosistema-urbano", "pubblicato": "2026-10-26", "titolo": "...",
      "fonte": "...", "fonte_url": "https://...", "nota": "...",
      "video": "03_auto",                       # facoltativo: seguito di un video -> link alla sua pagina
      "file": ["pedoni_province_2025.csv"],     # facoltativo: dati nuovi, copiati da caroselli/<cartella>/
      "instagram": "...", "tiktok": "...", "youtube": "..."}]
Classifiche fatte da altri: solo il link alla fonte, senza ricopiarne le tabelle.
Dopo aver costruito, si pubblica il contenuto di sito/ nel repository GitHub (vedi sito/README.md).
"""
import datetime
import html
import json
import os
import shutil
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(QUI)
MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre',
        'ottobre', 'novembre', 'dicembre']
PROFILI = [('Instagram', 'https://www.instagram.com/comunechevai/'),
           ('TikTok', 'https://www.tiktok.com/@comunechevai'),
           ('YouTube', 'https://www.youtube.com/@comunechevai')]
# Statistiche delle visite: GoatCounter (senza cookie), cruscotto su https://comunechevai.goatcounter.com
GOATCOUNTER = 'https://comunechevai.goatcounter.com/count'
ICONA_SCARICA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>'
ICONA_FUORI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"/><path d="M19 5 10 14"/><path d="M18 14v5H5V6h5"/></svg>'

e = lambda t: html.escape(str(t), quote=True)


def ver(nome):
    """assets/nome?v=<impronta>: cambia a ogni modifica del file, così il browser non usa una copia vecchia."""
    import hashlib
    h = hashlib.md5(open(os.path.join(QUI, 'assets', nome), 'rb').read()).hexdigest()[:8]
    return f'assets/{nome}?v={h}'


def clic(nome, titolo):
    """Attributi GoatCounter per contare i click su un link (eventi nel cruscotto)."""
    return f' data-goatcounter-click="{e(nome)}" data-goatcounter-title="{e(titolo)}"'


def data_it(iso):
    d = datetime.date.fromisoformat(iso)
    return f'{d.day} {MESI[d.month - 1]} {d.year}'


def testa(titolo, descrizione, base):
    return f'''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(titolo)}</title>
<meta name="description" content="{e(descrizione)}">
<link rel="icon" href="{base}assets/icona.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="{base}{ver('stile.css')}">
<script data-goatcounter="{GOATCOUNTER}" async src="https://gc.zgo.at/count.js"></script>
</head>
<body>
<main class="pagina">
<a class="testata" href="{base}index.html"><img src="{base}assets/icona.png" alt="" width="52" height="52">
<span><span class="marchio">Comune che vai</span><br><span class="motto">Comune che vai, numero che trovi.</span></span></a>
'''


def piede():
    profili = ' · '.join(f'<a href="{u}"{clic("profilo-" + n.lower(), "Profilo " + n)}>{n}</a>' for n, u in PROFILI)
    return f'''<footer class="piede"><p>Comune che vai: mappe dei comuni italiani raccontate con dati pubblici.</p>
<p>@comunechevai su {profili}</p></footer>
</main>
</body>
</html>
'''


def carica(cartella):
    src = os.path.join(ROOT, 'video', cartella, 'dati_pubblici')
    s = json.load(open(os.path.join(src, 'scheda.json'), encoding='utf-8'))
    return src, s


def pagina_video(v, s, uscita):
    dest = os.path.join(uscita, 'video', v['cartella'])
    os.makedirs(dest, exist_ok=True)
    src = os.path.join(ROOT, 'video', v['cartella'], 'dati_pubblici')
    zonale = s.get('livello', 'comune') != 'comune'      # zone sotto il comune (es. CAP): toolkit/mappe/esporta_zone.py
    for k in ('csv', 'xlsx') + (('zone',) if zonale else ()):
        shutil.copy2(os.path.join(src, s['file'][k]), os.path.join(dest, s['file'][k]))
    sing, plur = s.get('parola', ['comune', 'comuni'])
    T = s.get('testi', {})        # frasi su misura per le pagine con zone (es. province); se mancano, quelle dei CAP
    col0, col1, col2 = s.get('colonne', ['Codice ISTAT', 'Comune', 'Provincia'])

    unita = f" ({s['unita']})" if s.get('unita') else ''
    c = v['cartella']
    guarda = ''.join(f'<a class="bottone" href="{e(v[k])}"{clic(f"guarda-{k}-{c}", f"Guarda su {n} · {c}")}>{ICONA_FUORI}Guarda su {n}</a>'
                     for k, n in (('instagram', 'Instagram'), ('tiktok', 'TikTok'), ('youtube', 'YouTube')) if v.get(k))
    pub = f" · pubblicato il {data_it(v['pubblicato'])}" if v.get('pubblicato') else ''
    valori = (f'Sì: per ogni {sing} c\'è il valore esatto e la fascia di colore della mappa.' if s['con_valori'] else
              'Per ogni comune c\'è la fascia di colore della mappa. I valori esatti dei comuni citati sono nei «Numeri del video»; '
              'i valori di tutti i comuni sono nella fonte originale.')
    numeri = ''.join(
        f'<tr><td class="testo">{e(n["cosa"])}</td><td class="testo">{e(n["comune"] + (" (" + n["provincia"] + ")" if n["provincia"] else ""))}</td>'
        f'<td class="num">{e(format_it(n["valore"]))} {e(n["unita"])}</td><td class="testo">{e(n["nota"])}</td></tr>'
        for n in s['numeri'])
    colori = s.get('colori', [])
    fasce = ''.join(f'<li><i style="background:{c}"></i>{e(f["testo"])}</li>' for f, c in zip(s['fasce'], colori))
    th_val = f'<th class="num" data-col="3"><button type="button">Valore{e(unita)}</button></th>' if s['con_valori'] else ''
    altre = s.get('altre', [])          # colonne in piu' (toolkit/mappe/esporta.py, ALTRE_COLONNE con sito=True)
    th_val += ''.join(f'<th class="num" data-col="{7 + i}"><button type="button">{e(a["titolo"])}</button></th>'
                      for i, a in enumerate(altre))
    dati_pag = dict(con_valori=s['con_valori'], fasce=s['fasce'], colori=colori, comuni=s['comuni'],
                    unita=s.get('unita', ''), indicatore=s['indicatore'], cartella=c, altre=altre)
    if zonale:
        dati_pag.update(livello=s['livello'], parola=[sing, plur], colonne=[col0, col1, col2], testi=T)
    # mappa interattiva: c'è se esiste il file dei confini (sito/geometrie_sito.py)
    con_mappa = zonale or os.path.exists(os.path.join(QUI, 'assets', 'comuni_2026.js'))
    if con_mappa and s['n_senza_dato']:
        fasce += '<li><i style="background:#a3a7b0"></i>dato non disponibile</li>'
    legenda = f'<ul class="fasce" aria-label="Fasce di colore della mappa">{fasce}</ul>'
    luogo = s.get('luogo', '')
    descr_mappa = T.get('descr_mappa') or (f'dei {plur} di {luogo}' if zonale else 'dei comuni italiani')
    torna = e(f'Torna a tutta {luogo}') if zonale else "Torna all'Italia intera"
    sigla = luogo[:3].upper() if zonale else 'ITA'
    nota_zone = (' Le linee scure sono i confini dei ' + s.get('contorni', '') + '.') if zonale and s.get('contorni') else ''
    if T.get('nota_mappa'):
        nota_zone = ' ' + T['nota_mappa']
    tocca_mappa = T.get('tocca') or f'Tocca un {sing} per vedere il suo valore'
    sezione_mappa = f'''<section class="sezione" aria-labelledby="t-mappa"><h2 id="t-mappa">La mappa</h2>
<p class="nota">Gli stessi colori del video. {e(tocca_mappa.rstrip('.'))}; ingrandisci con due dita sul telefono, con Ctrl + rotellina o con i pulsanti sul computer.{nota_zone}</p>
{legenda}
<div class="mappa-box" id="mappa">
<canvas role="img" aria-label="Mappa {e(descr_mappa)} colorati per {e(s['indicatore'].lower())}. I valori sono anche nella tabella qui sotto."></canvas>
<div class="mappa-comandi"><button type="button" data-zoom="piu" aria-label="Ingrandisci">+</button><button type="button" data-zoom="meno" aria-label="Rimpicciolisci">−</button><button type="button" class="testo" data-zoom="italia" aria-label="{torna}">{e(sigla)}</button></div>
<p class="mappa-avviso" hidden></p>
</div>
<div class="mappa-info" id="mappa-info" aria-live="polite"></div>
</section>
''' if con_mappa else ''
    if zonale:
        script_mappa = (f'<script src="../../{ver("d3.min.js")}"></script>\n<script src="{e(s["file"]["zone"])}"></script>\n'
                        f'<script src="../../{ver("mappa_zone.js")}"></script>\n')
    else:
        script_mappa = (f'<script src="../../{ver("d3.min.js")}"></script>\n<script src="../../{ver("comuni_2026.js")}"></script>\n'
                        f'<script src="../../{ver("mappa.js")}"></script>\n') if con_mappa else ''
    if zonale:
        elenco_nota = T.get('elenco_nota') or f"{format_it(s['n_comuni'])} {plur} di {luogo}."
        tocca = '; tocca una riga per vederla sulla mappa'
        cerca_label = T.get('cerca_label', f'Cerca il tuo {sing} o quartiere')
        cerca_ph = T.get('cerca_ph', f'{sing} o nome del quartiere')
    else:
        elenco_nota = (f"{format_it(s['n_comuni'])} comuni con i codici ISTAT 2026"
                       f"{(', ' + str(s['n_senza_dato']) + ' senza dato') if s['n_senza_dato'] else ''}.")
        tocca = '; tocca un comune per vederlo sulla mappa'
        cerca_label, cerca_ph = 'Cerca il tuo comune', 'Nome o sigla della provincia'

    corpo = testa(f"{s['titolo']} · Comune che vai", f"Fonte, metodo e dati {sing} per {sing} del video «{s['titolo']}».", '../../')
    corpo += f'''<a class="indietro" href="../../index.html">← Tutti i video</a>
<header class="intro"><h1>{e(s['titolo'])}</h1>
<div class="meta"><span>Video {e(s['numero'])}{pub}</span><span>Dati aggiornati il {data_it(s['generato_il'])}</span></div></header>
<div class="azioni">
<a class="bottone pieno" href="{e(s['file']['xlsx'])}" download{clic(f"scarica-excel-{c}", f"Scarica Excel · {c}")}>{ICONA_SCARICA}Scarica Excel</a>
<a class="bottone" href="{e(s['file']['csv'])}" download{clic(f"scarica-csv-{c}", f"Scarica CSV · {c}")}>{ICONA_SCARICA}Scarica CSV</a>
<a class="bottone" href="{e(s['fonte_url'])}"{clic(f"fonte-{c}", f"Fonte originale · {c}")}>{ICONA_FUORI}Fonte originale</a>{guarda}
</div>
<section class="sezione" aria-labelledby="t-scheda"><h2 id="t-scheda">Da dove vengono i numeri</h2>
<dl class="scheda">
<dt>Indicatore</dt><dd>{e(s['indicatore'] + unita)}</dd>
<dt>Fonte</dt><dd><a href="{e(s['fonte_url'])}"{clic(f"fonte-{c}", f"Fonte originale · {c}")}>{e(s['fonte'])}</a></dd>
<dt>Anno dei dati</dt><dd>{e(s['anno'])}</dd>
<dt>Come è calcolato</dt><dd>{e(s['metodo'])}</dd>
<dt>Classifiche</dt><dd>{e(s['soglia'])}</dd>
<dt>Limiti</dt><dd>{e(s['limiti'])}</dd>
<dt>Valori per {e(sing)}</dt><dd>{e(valori)}</dd>
</dl></section>
{sezione_mappa}<section class="sezione" aria-labelledby="t-comuni"><h2 id="t-comuni">{e(T.get('titolo_elenco', f'Tutti i {plur}'))}</h2>
<p class="nota">{elenco_nota} {e(T.get('evidenza', 'In evidenza quelli citati nel video.'))} Tocca il nome di una colonna per ordinare{tocca if con_mappa else ""}.</p>
{"" if con_mappa else legenda}
<div class="cerca"><label for="cerca">{e(cerca_label)}</label><input id="cerca" type="search" placeholder="{e(cerca_ph)}" autocomplete="off">
<span class="conteggio" id="conteggio" aria-live="polite"></span></div>
<div class="tabella-box"><table><thead><tr>
<th data-col="1" aria-sort="ascending"><button type="button">{e(col1)}</button></th><th data-col="2"><button type="button">{e(col2)}</button></th>{th_val}
<th data-col="4"><button type="button">Fascia</button></th><th data-col="0"><button type="button">{e(col0)}</button></th>
</tr></thead><tbody id="corpo"></tbody></table></div>
<button class="bottone altri" id="altri" type="button" hidden>{e(T.get('altri', 'Mostra altri comuni'))}</button>
</section>
<section class="sezione" aria-labelledby="t-numeri"><h2 id="t-numeri">Numeri del video</h2>
<p class="nota">Ogni numero mostrato o detto nel video.</p>
<div class="tabella-box"><table><thead><tr><th>Cosa</th><th>{e(T.get('colonna_numeri', 'Zona')) if zonale else "Comune"}</th><th class="num">Valore</th><th>Nota</th></tr></thead>
<tbody>{numeri}</tbody></table></div></section>
<script type="application/json" id="dati">{json.dumps(dati_pag, ensure_ascii=False).replace("</", "<\\/")}</script>
<script src="../../{ver('tabella.js')}"></script>
{script_mappa}'''
    corpo += piede()
    open(os.path.join(dest, 'index.html'), 'w', encoding='utf-8').write(corpo)


def format_it(x):
    if x is None:
        return ''
    if isinstance(x, int) or float(x).is_integer():
        return f'{int(x):,}'.replace(',', '.')
    s = f'{x:,.6f}'.rstrip('0').rstrip('.')
    return s.replace(',', '_').replace('.', ',').replace('_', '.')


def sezione_caroselli(caroselli, uscita):
    """Elenco dei caroselli, dal più nuovo: titolo (link alla fonte, alla pagina del video o al file), fonte, post."""
    if not caroselli:
        return ''
    righe = ''
    for k in reversed(caroselli):
        c = k['cartella']
        d = datetime.date.fromisoformat(k['pubblicato'])
        link_file = ''
        for f in k.get('file', []):
            dest = os.path.join(uscita, 'caroselli', c)
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(os.path.join(ROOT, 'caroselli', c, f), os.path.join(dest, f))
            link_file += (f'<a href="caroselli/{e(c)}/{e(f)}" download{clic(f"scarica-{c}-{f}", f"Scarica {f}")}>'
                          f'Scarica {e(f.rsplit(".", 1)[-1].upper())}</a>')
        if k.get('video'):
            href, cl = f"video/{e(k['video'])}/index.html", ''
        else:
            href, cl = e(k['fonte_url']), clic(f'fonte-{c}', f'Fonte originale · {c}')
        post = ' · '.join(f'<a href="{e(k[p])}"{clic(f"guarda-{p}-{c}", f"Guarda su {n} · {c}")}>{n}</a>'
                          for p, n in (('instagram', 'Instagram'), ('tiktok', 'TikTok'), ('youtube', 'YouTube')) if k.get(p))
        fonte = f'<a href="{e(k["fonte_url"])}"{clic(f"fonte-{c}", f"Fonte originale · {c}")}>{e(k["fonte"])}</a>'
        righe += (f'<li><span class="num data">{d.day}/{d.month}</span><span class="tit"><a href="{href}"{cl}>{e(k["titolo"])}</a></span>'
                  f'<span class="info"><span>{fonte}</span>{link_file}{f"<span>Guarda su {post}</span>" if post else ""}</span>'
                  f'{f"""<span class="info">{e(k["nota"])}</span>""" if k.get("nota") else ""}</li>')
    return f'''<section class="sezione" aria-labelledby="t-caroselli"><h2 id="t-caroselli">Caroselli</h2>
<p class="nota">I caroselli di Instagram e TikTok. Quando riportano la classifica di qualcun altro rimandiamo alla fonte; quando usano dati nuovi, qui trovi anche i file.</p>
<ul class="elenco">{righe}</ul></section>
'''


def indice(voci, uscita, caroselli=()):
    corpo = testa('Fonti e dati di ogni video · Comune che vai',
                  'Fonte, metodo e dati comune per comune di ogni video di Comune che vai, da scaricare in CSV o Excel.', '')
    corpo += '''<header class="intro"><h1>Fonti e dati di ogni video</h1>
<p>Per ogni video trovi la fonte originale, come abbiamo calcolato i numeri e i dati comune per comune: da consultare qui o da scaricare in Excel e CSV. Se trovi un errore, scrivilo nei commenti del video.</p>
'''
    if caroselli:
        corpo += '<p><a href="#t-caroselli">Cerchi un carosello? Sono più in basso ↓</a></p>\n'
    corpo += '''</header>
'''
    if voci:
        corpo += '<ul class="elenco">'
        for v, s in reversed(voci):
            pub = f"<span>{data_it(v['pubblicato'])}</span>" if v.get('pubblicato') else ''
            base = f"video/{e(v['cartella'])}/"
            corpo += (f'<li><span class="num">{e(s["numero"])}</span><span class="tit"><a href="{base}index.html">{e(s["titolo"])}</a></span>'
                      f'<span class="info">{pub}<span>{e(s["fonte"].split(" – ")[0])}, {e(s["anno"])}</span></span></li>')
        corpo += '</ul>'
    else:
        corpo += '''<div class="vuoto"><strong>Il primo video arriva a breve.</strong>
<p>Qui comparirà ogni video pubblicato, con la sua fonte, il metodo e i dati di tutti i comuni.</p></div>'''
    corpo += sezione_caroselli(list(caroselli), uscita)
    corpo += '''<section class="sezione" aria-labelledby="t-come"><h2 id="t-come">Come leggere i file</h2><div class="come">
<div><h3>Una riga per comune</h3><p>I comuni sono 7.896, con i codici ISTAT in vigore nel 2026. Il codice permette di unire i nostri file con qualsiasi altro dato ISTAT.</p></div>
<div><h3>Fascia e valore</h3><p>La fascia è il colore del comune sulla mappa del video. Quando c'è la colonna del valore, è il numero esatto calcolato per quel comune.</p></div>
<div><h3>Numeri del video</h3><p>Ogni numero mostrato o detto nel video, con il comune a cui si riferisce e come è stato calcolato.</p></div>
</div></section>
'''
    corpo += piede()
    open(os.path.join(uscita, 'index.html'), 'w', encoding='utf-8').write(corpo)


def main():
    args = sys.argv[1:]
    uscita = args[args.index('--uscita') + 1] if '--uscita' in args else QUI
    elenco = json.load(open(os.path.join(QUI, 'video.json'), encoding='utf-8'))
    for i, a in enumerate(args):
        if a == '--aggiungi':
            elenco.append(dict(cartella=args[i + 1]))
    if uscita != QUI:
        os.makedirs(uscita, exist_ok=True)
        shutil.copytree(os.path.join(QUI, 'assets'), os.path.join(uscita, 'assets'), dirs_exist_ok=True)
    voci = []
    for v in elenco:
        _, s = carica(v['cartella'])
        pagina_video(v, s, uscita)
        voci.append((v, s))
    pc = os.path.join(QUI, 'caroselli.json')
    caroselli = json.load(open(pc, encoding='utf-8')) if os.path.exists(pc) else []
    indice(voci, uscita, caroselli)
    open(os.path.join(uscita, '.nojekyll'), 'w').close()
    print('sito costruito in', uscita, '-', len(voci), 'video,', len(caroselli), 'caroselli')


if __name__ == '__main__':
    main()
