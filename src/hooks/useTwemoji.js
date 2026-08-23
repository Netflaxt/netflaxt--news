/* ─────────────────────────────────────────────────────────────
   src/hooks/useTwemoji.js

   ⛔ DISATTIVATO il 23/08/2026 — e non va riattivato così com'era.

   Cosa faceva: sorvegliava l'INTERA pagina e sostituiva ogni emoji con
   un'immagine colorata, per farle apparire identiche su iPhone, Android
   e PC.

   Perché è stato tolto: quella sostituzione riscrive il DOM alle spalle
   di React. Quando React andava poi ad aggiornare o rimuovere quel
   testo non lo ritrovava più, e l'INTERA PAGINA finiva in errore
   ("Failed to execute 'removeChild' on 'Node'"), mostrando la schermata
   di errore anche quando non c'era alcun problema reale. Capitava a ogni
   pubblicazione di un articolo, per via dell'editor di testo e degli
   avvisi che compaiono e spariscono.

   Provato prima: escludere le zone volatili con `data-no-twemoji`. Non è
   bastato — il conflitto può ripresentarsi su qualsiasi contenuto che
   React aggiorna, e non è ragionevole rincorrerli tutti.

   Conseguenza di averlo tolto: le emoji sono quelle native del
   dispositivo (su iPhone quelle Apple, su Android quelle Google). Sono
   leggermente diverse fra loro, ma è la scelta che fa la quasi totalità
   dei siti — e non fa mai cadere la pagina.

   Se un domani le si volesse riavere colorate, l'unico modo sicuro è
   applicarle SOLO a contenuto che React non ri-renderizza (per esempio
   il corpo di un articolo inserito con dangerouslySetInnerHTML),
   chiamando `parseTwemoji(elemento)` su quel singolo nodo — mai
   sull'intera pagina, e mai con un MutationObserver globale.
   ───────────────────────────────────────────────────────────── */

export default function useTwemoji() {
  // Volutamente non fa nulla: vedi la spiegazione qui sopra.
}
