# Sito «Fonti e dati di ogni video»

È il link in bio di Comune che vai. Per ogni video pubblicato mostra la fonte, il metodo, i numeri del video e una tabella di tutti i comuni con la ricerca, più i file da scaricare (Excel e CSV).

Indirizzo previsto: **https://comunechevai.github.io**

## Cosa c'è qui

```
sito/
  index.html        elenco dei video (generato)
  video/NN_tema/    pagina del video + NN_tema.xlsx + NN_tema.csv (generati)
  assets/           stile.css, tabella.js, icona.png
  video.json        elenco dei video pubblicati: lo aggiorna Claude
  costruisci.py     rigenera index.html e video/*
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

## Prima di pubblicare un video sul sito

- I file sono generati da `dati.py`, gli stessi numeri del video: niente si ricopia a mano.
- La scheda (fonte, link, anno, metodo, soglia, limiti) deve essere completa: `--esporta` si ferma se manca un campo.
- Per avere il valore esatto di ogni comune, non solo la fascia, nel browser si usa `M.valori` (vedi la skill): costa un trasferimento più lungo, quindi si decide video per video.
