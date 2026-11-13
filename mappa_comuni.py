"""Pagina «La mappa dei comuni» (mappa/index.html, mappa/dati/*.js, assets/mappa_comuni.js), usata da costruisci.py.

Prende l'esportazione del database dei comuni (db/esportazione_sito/, fatta da db/esporta_sito.py) e la trasforma in file
JavaScript che la pagina carica anche aperta dal disco (niente fetch): dati/comuni.js (nomi, province, regioni, residenti,
codice della mappa), dati/catalogo.js (temi, nomi brevi e schede degli indicatori) e dati/ind/<indicatore>.js, uno per
indicatore, caricato solo quando lo si sceglie. I confini sono quelli del sito, assets/comuni_2026.js.

La mappa colora tutti i comuni; classifica e posizione valgono solo sopra la soglia del catalogo (abitanti o contribuenti),
come nei video. Nessun numero si ricalcola qui: i valori sono quelli del database, arrotondati a 4 cifre significative.
Uso da solo: python sito/mappa_comuni.py [--uscita cartella]
"""
import hashlib
import json
import os
import re
import shutil

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(QUI)
ESPORTAZIONE = os.path.join(ROOT, 'db', 'esportazione_sito')
PREDEFINITO = 'reddito_complessivo_medio'
CERCA = True          # ricerca del comune nella pagina (False: solo dal link ?c=)
IN_INDICE = False     # riquadro nella pagina principale e indicizzazione: False = online ma solo per chi ha il link (13/11/2026)

# temi della pagina: il primo che corrisponde vince; ogni indicatore deve finire in un tema
TEMI = [
    ('Popolazione', r'^(residenti$|residenti_censimento|densita|eta_media|eta_media_prevista|indice_|quota_0_14|'
                    r'quota_65_piu|quota_80_piu|nati$|tasso_natalita|tasso_mortalita|decessi|quota_decessi|saldo_naturale|'
                    r'saldo_migratorio|saldo_interno|variazione_popolazione|anno_massima_popolazione|variazione_dal_massimo|'
                    r'popolazione_prevista|variazione_prevista)'),
    ('Redditi e lavoro', r'^(reddito_|contribuenti|quota_contribuenti|variazione_reddito|tasso_occupazione|tasso_disoccupazione|'
                         r'quota_pensionati|quota_diplomati|quota_laureat|quota_lavoratori_fuori|quota_pendolari|saldo_pendolari|'
                         r'unita_locali|addetti|quota_addetti)'),
    ('Casa', r'^(abitazioni|quota_abitazioni|prezzo_case|affitto_case|anni_di_affitto|compravendite)'),
    ('Qualità della vita', r'^(locali_|bar_caffe|ristoranti_osm|pizzerie|fast_food|gelaterie|pub_osm|discoteche|aree_produttive|'
                           r'aree_industriali|verde_pubblico|incidenti_|feriti_|morti_incidenti|servizi_a_piedi|'
                           r'supermercato_a_piedi|alimentari_a_piedi|farmacia_a_piedi|scuola_a_piedi|biblioteca_a_piedi|'
                           r'libreria_a_piedi|distanza_|servizi_osm)'),
    ('Clima', r'^(temperatura_|pioggia_|giorni_sopra|giorni_di_gelo|notti_tropicali|riscaldamento_)'),
    ('Servizi', r'^(farmacie|abitanti_per_farmacia|dispensari|ospedali|posti_letto_ospedalieri|pronto_soccorso|dea$|minuti_|'
                r'scuole_|iscritti_|posti_nidi|copertura_ftth|famiglie_ftth|sportelli|stazioni_|aeroporti|passeggeri_|'
                r'uscite_autostradali|dotazione_infrastrutture|studenti_universitari)'),
    ('Territorio e ambiente', r'^(superficie_kmq|altitudine|suolo_|crescita_suolo|incremento_suolo|fotovoltaico|quota_superficie|quota_residenti_aree|'
                              r'residenti_aree|zona_sismica|raccolta_differenziata|rifiuti_)'),
    ('Turismo e cultura', r'^(esercizi_ricettivi|posti_letto|arrivi_turistici|presenze_|permanenza_media|quota_presenze|'
                          r'variazione_presenze|musei|cinema|teatri|biblioteche|librerie_osm)'),
    ('Auto e moto', r'^(autovetture|motocicli|veicoli_|quota_autovetture)'),
    ('Agricoltura e prodotti tipici', r'^(aziende_agricole|sau_|quota_sau|ettari_|capi_|arnie|produttori_dop|trasformatori_dop)'),
    ('Conti del comune', r'^(entrate_tributarie|imu_|tari_|addizionale_|aliquota_|esenzione_|spesa_|multe_|pnrr_|coesione_|'
                         r'comune_in_|massa_passiva)'),
    ('Vita pubblica e comunità', r'^(sindaco_|consiglio_|giunta_|comune_commissariato|affluenza_|calcio_|societa_sportive|'
                                 r'enti_terzo_settore|organizzazioni_volontariato|associazioni_promozione)'),
]

# nomi brevi scritti a mano dove la definizione tagliata non basta
ETICHETTE = {
    'giorni_sopra_30': 'Giorni sopra 30 °C nel 2025', 'giorni_sopra_30_2016_2025': "Giorni sopra 30 °C all'anno, media 2016-2025",
    'giorni_sopra_30_rispetto_1961_1990': 'Giorni sopra 30 °C in più rispetto al 1961-1990',
    'giorni_sopra_35_2016_2025': "Giorni sopra 35 °C all'anno, media 2016-2025",
    'giorni_di_gelo_2016_2025': "Giorni di gelo all'anno, media 2016-2025",
    'giorni_di_gelo_rispetto_1961_1990': 'Giorni di gelo rispetto al 1961-1990 (in meno se negativo)',
    'notti_tropicali': 'Notti tropicali nel 2025', 'notti_tropicali_2016_2025': "Notti tropicali all'anno, media 2016-2025",
    'notti_tropicali_rispetto_1961_1990': 'Notti tropicali in più rispetto al 1961-1990',
    'pioggia_annua': 'Pioggia nel 2025', 'riscaldamento_dal_1961_1990': 'Quanto è più caldo rispetto al 1961-1990',
    'temperatura_media_annua': 'Temperatura media nel 2025', 'temperatura_media_2016_2025': 'Temperatura media annua, 2016-2025',
    'temperatura_estate_2016_2025': "Temperatura media d'estate, 2016-2025",
    'temperatura_inverno_2016_2025': "Temperatura media d'inverno, 2016-2025",
    'aree_industriali_quota_territorio': 'Aree industriali in % del territorio',
    'aree_produttive_quota_territorio': 'Aree industriali e commerciali in % del territorio',
    'aree_produttive_ettari': 'Aree industriali e commerciali (ettari)',
    'aree_produttive_m2_per_abitante': 'Aree industriali e commerciali per abitante (m²)',
    'verde_pubblico_ettari': 'Parchi e verde pubblico (ettari)', 'verde_pubblico_m2_per_abitante': 'Parchi e verde pubblico per abitante (m²)',
    'distanza_supermercato_m': 'Distanza dal supermercato più vicino (metri)', 'distanza_farmacia_m': 'Distanza dalla farmacia più vicina (metri)',
    'servizi_osm_copertura': 'Completezza di OpenStreetMap: farmacie mappate ogni 100 ufficiali',
    'locali_osm_copertura': 'Completezza di OpenStreetMap: locali mappati ogni 100 contati da ISTAT',
    'servizi_a_piedi': 'Residenti con alimentari, farmacia e scuola a piedi', 'farmacia_a_piedi': 'Residenti con una farmacia a piedi',
    'scuola_a_piedi': 'Residenti con una scuola a piedi', 'supermercato_a_piedi': 'Residenti con un supermercato a piedi',
    'alimentari_a_piedi': 'Residenti con supermercato o alimentari a piedi', 'biblioteca_a_piedi': 'Residenti con una biblioteca a piedi',
    'libreria_a_piedi': 'Residenti con una libreria a piedi',
    'saldo_interno_5_anni_per_1000': 'Voto con i piedi: arrivati meno partiti verso altri comuni, 2021-2025',
    'locali_ristorazione': 'Bar, ristoranti e altri locali (ISTAT)',
    'locali_ristorazione_per_1000_abitanti': 'Bar, ristoranti e altri locali ogni 1.000 abitanti (ISTAT)',
    'minuti_medi_infrastrutture': 'Minuti medi da aeroporto, autostrada, stazione principale e porto',
    'dotazione_infrastrutture': 'Infrastrutture nel comune: aeroporto, autostrada, stazione principale, porto',
    'scuole_infanzia': "Scuole dell'infanzia", 'scuole_primaria': 'Scuole primarie', 'scuole_secondaria_1': 'Scuole secondarie di I grado',
    'scuole_secondaria_2': 'Scuole secondarie di II grado', 'teatri': 'Teatri', 'teatri_per_100000_abitanti': 'Teatri ogni 100.000 residenti',
    'capi_avicoli': 'Polli e altri avicoli allevati (2020)', 'capi_bovini': 'Bovini allevati (2020)', 'capi_bufalini': 'Bufale allevate (2020)',
    'capi_caprini': 'Capre allevate (2020)', 'capi_ovini': 'Pecore allevate (2020)', 'capi_suini': 'Maiali allevati (2020)',
    'ettari_frutteto': 'Frutteti (ettari)', 'quota_sau_frutteto': 'Frutteti in % della superficie agricola',
    'ettari_oliveto': 'Oliveti (ettari)', 'quota_sau_oliveto': 'Oliveti in % della superficie agricola',
    'ettari_vigneto': 'Vigneti (ettari)', 'quota_sau_vigneto': 'Vigneti in % della superficie agricola',
    'massa_passiva_per_abitante': 'Debiti della procedura di crisi per abitante',
    'associazioni_promozione_sociale': 'Associazioni di promozione sociale',
    'associazioni_promozione_sociale_per_10000_abitanti': 'Associazioni di promozione sociale ogni 10.000 abitanti',
    'organizzazioni_volontariato': 'Organizzazioni di volontariato',
    'organizzazioni_volontariato_per_10000_abitanti': 'Organizzazioni di volontariato ogni 10.000 abitanti',
    'enti_terzo_settore': 'Enti del Terzo settore', 'enti_terzo_settore_per_10000_abitanti': 'Enti del Terzo settore ogni 10.000 abitanti',
    'societa_sportive': 'Società sportive dilettantistiche',
    'societa_sportive_per_10000_abitanti': 'Società sportive dilettantistiche ogni 10.000 abitanti',
}


# numeri a codici: il testo da mostrare al posto del codice (gli anni dei censimenti si scrivono da soli)
VALORI = {
    'calcio_livello_massimo': {1: 'Terza Categoria', 2: 'Seconda Categoria', 3: 'Prima Categoria', 4: 'Promozione',
                               5: 'Eccellenza', 6: 'Serie D', 7: 'Serie C', 8: 'Serie B', 9: 'Serie A'},
    'zona_sismica': {1: 'zona 1, la più pericolosa', 2: 'zona 2', 3: 'zona 3', 4: 'zona 4, la meno pericolosa'},
}

# dove il dato vuoto ha un significato (non «dato non disponibile»)
VUOTO = {'calcio_livello_massimo': 'nessuna squadra'}


def valori_testo(nome, unita, valori):
    """Testo dei codici per la pagina, o None. Controlla che ogni codice presente abbia il suo testo."""
    if unita == 'anno':
        return {str(int(v)): f'censimento {int(v)}' for v in set(valori) if v is not None}
    m = VALORI.get(nome)
    if not m:
        return None
    mancano = {v for v in valori if v is not None} - set(m)
    assert not mancano, f'{nome}: codici senza testo {mancano}'
    return {str(k): t for k, t in m.items()}


def etichetta(defin):
    """Nome breve per il menu: la definizione fino alla prima parentesi o ai due punti."""
    t = re.split(r' \(|: ', defin, maxsplit=1)[0].strip().rstrip(',.')
    return t if len(t) <= 90 else t[:87].rsplit(' ', 1)[0] + '…'


def _js(nome_var, obj):
    return f'window.{nome_var}=' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n'


def _scrivi(percorso, testo):
    os.makedirs(os.path.dirname(percorso), exist_ok=True)
    with open(percorso, 'w', encoding='utf-8') as f:
        f.write(testo)
    return hashlib.md5(testo.encode('utf-8')).hexdigest()[:8]


PAGINA = '''<a class="indietro" href="../index.html">← Tutti i video</a>
<header class="intro"><h1>La mappa dei comuni</h1>
<p>@N_IND@ numeri per ognuno dei @N_COM@ comuni italiani, tutti da fonti pubbliche. Scegli un numero e la mappa si colora; tocca un comune@CERCA_TESTO@ per vedere il suo valore e il posto in classifica. Sotto la mappa trovi da dove viene il numero e i suoi limiti.</p></header>
<section class="sezione" aria-label="Scegli il numero">
<div class="scelte">
<label>Tema<select id="scelta-tema"></select></label>
<label>Numero<select id="scelta-numero"></select></label>
</div>
@CERCA@</section>
<section class="sezione" aria-labelledby="titolo-numero">
<h2 id="titolo-numero">La mappa</h2>
<p class="nota" id="sottotitolo-numero"></p>
<div class="mappa-box" id="mappa"><canvas aria-label="Mappa dei comuni colorata secondo il numero scelto"></canvas>
<div class="mappa-comandi"><button type="button" data-zoom="piu" aria-label="Ingrandisci">+</button><button type="button" data-zoom="meno" aria-label="Rimpicciolisci">−</button><button type="button" data-zoom="italia" class="testo" aria-label="Tutta Italia">ITA</button></div>
<div class="mappa-avviso" hidden></div></div>
<ul class="fasce" id="legenda" aria-label="Legenda"></ul>
<div class="mappa-info" id="mappa-info" aria-live="polite"></div>
</section>
<section class="sezione" aria-labelledby="t-classifica">
<h2 id="t-classifica">Classifica</h2>
<p class="nota" id="nota-classifica"></p>
<div class="classifiche"><div><h3>I valori più alti</h3><ol id="primi"></ol></div><div><h3>I valori più bassi</h3><ol id="ultimi"></ol></div></div>
</section>
<section class="sezione" aria-labelledby="t-fonte">
<h2 id="t-fonte">Da dove viene questo numero</h2>
<dl class="scheda" id="scheda-numero"></dl>
<div class="azioni"><button type="button" class="bottone" id="scarica-csv">@ICONA@Scarica i dati di tutti i comuni (CSV)</button></div>
<p class="nota">Dati aggiornati al @AGGIORNATO@. Fonti e licenze sono quelle indicate per ogni numero; se trovi un errore scrivilo nei commenti di un video.</p>
</section>
<script src="dati/comuni.js?v=@V_COM@"></script>
<script src="dati/catalogo.js?v=@V_CAT@"></script>
<script src="../@D3@"></script>
<script src="../@CONFINI@"></script>
<script src="../@JS@"></script>
'''

CERCA_HTML = '''<div class="cerca cerca-comune"><label for="cerca-comune">Cerca un comune</label>
<input id="cerca-comune" type="search" autocomplete="off" placeholder="es. Mirandola" aria-controls="suggerimenti">
<ul class="proposte" id="suggerimenti" hidden></ul></div>
'''


def pagina_mappa(uscita, testa, piede, ver, icona=''):
    """Scrive mappa/ in uscita. Restituisce (comuni, indicatori)."""
    com = json.load(open(os.path.join(ESPORTAZIONE, 'comuni.json'), encoding='utf-8'))
    cat = json.load(open(os.path.join(ESPORTAZIONE, 'catalogo.json'), encoding='utf-8'))
    campi = com['campi']
    assert campi == ['codice', 'codice_mappa', 'comune', 'sigla', 'provincia', 'regione', 'residenti'], campi
    righe = com['righe']
    n = len(righe)
    dest = os.path.join(uscita, 'mappa')
    if os.path.isdir(os.path.join(dest, 'dati', 'ind')):
        vecchi = [f for f in os.listdir(os.path.join(dest, 'dati', 'ind'))
                  if f.endswith('.js') and f[:-3] not in {c['indicatore'] for c in cat}]
        if vecchi:       # nella cartella del PC non si cancella: si segnala (la pagina non li usa)
            print(f'  mappa: {len(vecchi)} file di indicatori non più nel database, da togliere a mano: {vecchi[:5]}')
    # temi
    temi = {t: [] for t, _ in TEMI}
    for c in cat:
        tema = next((t for t, r in TEMI if re.match(r, c['indicatore'])), None)
        assert tema, f'indicatore senza tema: {c["indicatore"]}'
        temi[tema].append(c['indicatore'])
    # schede e dati
    schede, versioni, etichette = {}, {}, {}
    for c in cat:
        nome = c['indicatore']
        valori = json.load(open(os.path.join(ESPORTAZIONE, c['file']), encoding='utf-8'))
        assert len(valori) == n, nome
        et = ETICHETTE.get(nome) or etichetta(c['definizione'])
        etichette.setdefault(et, []).append(nome)
        schede[nome] = dict(etichetta=et, definizione=c['definizione'], unita=c.get('unita') or '', fonte=c['fonte'],
                            dati_al=c['dati_al'], licenza=c['licenza'], soglia=c['soglia'], soglia_su=c.get('soglia_su'),
                            meglio=c['piu_alto_meglio'], limiti=c.get('limiti') or '', anno=c['anno'],
                            n=sum(v is not None for v in valori))
        vt = valori_testo(nome, schede[nome]['unita'], valori)
        if vt:
            schede[nome]['valori'] = vt
        if nome in VUOTO:
            schede[nome]['vuoto'] = VUOTO[nome]
        versioni[nome] = _scrivi(os.path.join(dest, 'dati', 'ind', nome + '.js'),
                                 f'(window.MAPPA_DATI=window.MAPPA_DATI||{{}})[{json.dumps(nome)}]='
                                 + json.dumps(valori, separators=(',', ':')) + ';\n')
    for et, nomi in etichette.items():          # nomi brevi uguali: si aggiunge l'unità per distinguerli
        if len(nomi) > 1:
            for nome in nomi:
                u = schede[nome]['unita']
                schede[nome]['etichetta'] = f'{et} ({u})' if u else f'{et} ({nome.replace("_", " ")})'
    doppi = [e for e, k in etichette.items() if len({schede[x]['etichetta'] for x in k}) < len(k)]
    for et in doppi:                            # ancora uguali: il nome dell'indicatore
        for nome in etichette[et]:
            schede[nome]['etichetta'] = f'{et} ({nome.replace("_", " ")})'
    assert PREDEFINITO in schede and not (set(ETICHETTE) | set(VALORI) | set(VUOTO)) - set(schede), (set(ETICHETTE) | set(VALORI) | set(VUOTO)) - set(schede)
    for nome in schede:
        schede[nome]['v'] = versioni[nome]
    catalogo = dict(aggiornato=com['aggiornato'], predefinito=PREDEFINITO, cerca=CERCA,
                    temi=[dict(nome=t, indicatori=sorted(k, key=lambda x: schede[x]['etichetta'].lower())) for t, k in temi.items() if k],
                    schede=schede)
    comuni = dict(campi=campi, righe=righe)
    v_com = _scrivi(os.path.join(dest, 'dati', 'comuni.js'), _js('MAPPA_COMUNI', comuni))
    v_cat = _scrivi(os.path.join(dest, 'dati', 'catalogo.js'), _js('MAPPA_CATALOGO', catalogo))
    corpo = testa('La mappa dei comuni · Comune che vai',
                  f'{len(cat)} numeri per ognuno dei {n:,} comuni italiani su una mappa: redditi, età, servizi, clima, '
                  'case, turismo e altro, da fonti pubbliche.'.replace(',', '.', 1), '../')
    if not IN_INDICE:      # finché non è collegata alla pagina principale: raggiungibile solo da chi ha il link
        corpo = corpo.replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"', 1)
    corpo += (PAGINA.replace('@N_IND@', str(len(cat))).replace('@N_COM@', f'{n:,}'.replace(',', '.'))
              .replace('@CERCA_TESTO@', ' o cercalo' if CERCA else '').replace('@CERCA@', CERCA_HTML if CERCA else '')
              .replace('@AGGIORNATO@', com['aggiornato']).replace('@ICONA@', icona)
              .replace('@V_COM@', v_com).replace('@V_CAT@', v_cat)
              .replace('@D3@', ver('d3.min.js')).replace('@CONFINI@', ver('comuni_2026.js')).replace('@JS@', ver('mappa_comuni.js')))
    corpo += piede()
    _scrivi(os.path.join(dest, 'index.html'), corpo)
    return n, len(cat)


if __name__ == '__main__':
    import sys
    sys.path.insert(0, QUI)
    from costruisci import testa, piede, ver, ICONA_SCARICA
    args = sys.argv[1:]
    uscita = args[args.index('--uscita') + 1] if '--uscita' in args else QUI
    if uscita != QUI:
        shutil.copytree(os.path.join(QUI, 'assets'), os.path.join(uscita, 'assets'), dirs_exist_ok=True)
    nc, ni = pagina_mappa(uscita, testa, piede, ver, ICONA_SCARICA)
    print(f'mappa dei comuni: {nc} comuni, {ni} indicatori, in {os.path.join(uscita, "mappa")}')
