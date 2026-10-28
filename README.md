# Sito «Fonti e dati di ogni video»

È il link in bio di Comune che vai. Per ogni video pubblicato mostra la fonte, il metodo, i numeri del video e una tabella di tutti i comuni con la ricerca, più i file da scaricare (Excel e CSV).

Indirizzo previsto: **https://comunechevai.github.io**

## Cosa c'è qui

```
sito/
  index.html        elenco dei video (generato)
  video/NN_tema/    pagina del video + NN_tema.xlsx + NN_tema.csv (generati)
  assets/           stile.css, tabella.js, mappa.js, d3.min.js, comuni_2026.js, icona.png
  video.json        elenco dei video pubblicati: lo aggiorna Claude
  costruisci.py     rigenera index.html e video/*
  geometrie_sito.py crea assets/comuni_2026.js (confini per la mappa; una volta sola)
  .nojekyll         dice a GitHub di pubblicare i file così come sono
```

I file di ogni video nascono nella sua cartella, `video/NN_tema/dati_pubblici/`, con `render.py --esporta` (o in automatico con `--tutto`). `costruisci.py` li copia qui e scrive le pagine.

## Prima pubblicazione (una volta sola, circa 10 minuti)

1. **Account GitHub.** Su github.com crea un account gratuito con nome utente `comunechevai` (il 22/10/2026 risultava libero). Puoi usare la tua email o una del progetto.
2. **Repository.** Pulsante «New repository». Nome esattamente `comunechevai.github.io`, visibilità **Public**, nessun altro file. Crea.
3. **Carica i file.** Nella pagina del repository: «uploading an existing file». Trascina dentro **il contenuto** della cartella `sito/` (non la cartella stessa): `index.html`, `.nojekyll`, `assets`, `video.json`, `costruisci.py`, `README.md` e, quando ci saranno, `video`. Poi «Commit changes».
4. **Pages.** Settings › Pages: «Deploy from a branch», ramo `main`, cartella `/ (root)`, Save. Dopo uno o due minuti il sito è su https://comunechevai.github.io.
5. **Link in bio.** Metti `comunechevai.github.io` nel link di Instagram, TikTok e YouTube, con il testo «Fonti e dati di ogni video».

## Dopo ogni video

Claude esporta i dati del video, aggiunge il video a `video.json`, lancia `python sito/costruisci.py` e salva tutto qui. Per aggiornare il sito:

- **A mano:** carica nel repository la nuova cartella `video/NN_tema/`, `index.html` e `video.json` (stessa procedura del punto 3: i file con lo stesso nome vengono sostituiti).
- **Senza fare niente:** collega GitHub a Claude dalle impostazioni di claude.ai (Connettori) e dai accesso al repository `comunechevai/comunechevai.github.io`. Da lì in poi Claude pubblica l'aggiornamento direttamente, sempre dopo il tuo ok.

## Mappa interattiva

Ogni pagina video ha la sezione «La mappa»: stessi colori e legenda del video, zoom (pulsanti, doppio clic, Ctrl + rotellina, due dita sul telefono), tocco su un comune con nome, valore e fascia; il nome del comune nella tabella porta la mappa su quel comune. La aggiunge `costruisci.py` da solo, con i dati già presenti nella pagina.

- `assets/comuni_2026.js`: confini dei 7.896 comuni (codici ISTAT 2026), semplificati senza buchi tra comuni vicini, circa 470 KB scaricati e poi tenuti in memoria dal browser. Si rifà solo se cambiano i confini: `python sito/geometrie_sito.py <mapshaper>` (vedi l'intestazione dello script).
- `assets/mappa.js` disegna la mappa; `assets/d3.min.js` (D3 7.9.0) serve per lo zoom.
- Dopo ogni pubblicazione: aprire la pagina del video, controllare che colori e legenda siano quelli del video e toccare un paio di comuni.
- **Colonne in più** (dal video 06): in `dati.py` una voce di `ALTRE_COLONNE` con `sito=True` (e `unita`, `breve`) compare anche nella tabella del sito, ordinabile, e nel riquadro della mappa (es. «91,9% coperto» accanto ai metri quadri a testa). `scheda.json` la descrive in `altre`; nelle righe dei comuni i valori stanno dalla posizione 7. Le altre colonne restano solo in CSV ed Excel.
- **Video con zone sotto il comune** (es. il 04, i CAP di Milano): `render.py --esporta` usa `toolkit/mappe/esporta_zone.py` e scrive anche `dati_pubblici/zone.js` (confini delle zone e dei municipi, semplificati senza buchi tra zone vicine). `costruisci.py` lo riconosce dal campo `livello` di `scheda.json`: copia `zone.js` nella cartella della pagina e usa `assets/mappa_zone.js` al posto di `mappa.js`; tabella, ricerca e testi parlano di CAP invece che di comuni. Le pagine dei comuni restano identiche.

## Statistiche delle visite

Il sito usa **GoatCounter** (senza cookie, quindi senza banner): cruscotto su https://comunechevai.goatcounter.com, con l'account del progetto. `costruisci.py` mette lo script in ogni pagina e conta come eventi i click su «Scarica Excel», «Scarica CSV», «Fonte originale», «Guarda su…» e sui profili social (nomi tipo `scarica-excel-01_eta`); conta anche, una volta per visita, chi usa la mappa (`mappa-01_eta`).

Per sapere da quale social arrivano le visite, il link in bio ha un parametro diverso per piattaforma (sezione «Campagne» del cruscotto):

- Instagram: `https://comunechevai.github.io/?utm_source=instagram&utm_campaign=bio`
- YouTube: `https://comunechevai.github.io/?utm_source=youtube&utm_campaign=bio`
- TikTok (quando si sblocca il link): `https://comunechevai.github.io/?utm_source=tiktok&utm_campaign=bio`

## Prima di pubblicare un video sul sito

- I file sono generati da `dati.py`, gli stessi numeri del video: niente si ricopia a mano.
- La scheda (fonte, link, anno, metodo, soglia, limiti) deve essere completa: `--esporta` si ferma se manca un campo.
- Per avere il valore esatto di ogni comune, non solo la fascia, nel browser si usa `M.valori` (vedi la skill): costa un trasferimento più lungo, quindi si decide video per video.
