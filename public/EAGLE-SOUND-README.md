# 🦅 Verso aquila — file audio

Per avere il **verso aquila reale** al posto del suono sintetizzato, scarica un mp3 royalty-free da uno di questi siti:

- **Pixabay (gratis, no attribution)**: https://pixabay.com/sound-effects/search/eagle/
- **Freesound (gratis, alcuni richiedono credito)**: https://freesound.org/search/?q=eagle+cry
- **Mixkit (gratis, no attribution)**: https://mixkit.co/free-sound-effects/eagle/

## Come integrarlo

1. Scarica un file mp3 (durata 1-3 secondi consigliata).
2. Rinominalo in **`eagle-cry.mp3`**.
3. Mettilo in questa cartella (`/public/eagle-cry.mp3`).

Il codice in `src/utils/eagleSound.js` rileva automaticamente il file: se c'è lo riproduce, altrimenti usa un verso sintetizzato con Web Audio API come fallback.

Non serve fare altro — al prossimo trigger dell'easter egg l'aquila griderà davvero.

## Consigli di scelta

- **Durata 1.5-2.5 secondi**: ideale per non sovrapporsi al volo successivo (5s).
- **Volume normalizzato**: il player applica `volume = 0.55`. Se senti troppo basso, alza con un editor (Audacity).
- **Formato mp3 o ogg**: entrambi supportati dai browser moderni. Mp3 è universale.

## Eliminare il file

Se vuoi tornare al suono sintetizzato: cancella `eagle-cry.mp3` e basta.
