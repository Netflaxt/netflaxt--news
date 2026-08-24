/* ─────────────────────────────────────────────────────────────
   src/utils/testoArticolo.js
   Ripulisce il testo degli articoli da ciò che il copia-incolla
   si porta dietro.

   IL PROBLEMA (visto in produzione il 24/08/2026, primo articolo
   pubblicato dopo l'annuncio):
   incollando da un sito o da Word, ogni spazio fra le parole diventa
   uno "spazio unificatore" (&nbsp; — il carattere  ). Quel
   carattere dice al browser di NON andare a capo lì. Con tutti gli
   spazi così, un paragrafo diventa una riga unica indivisibile: nel
   caso reale era larga 3232 pixel dentro una colonna da 704, e usciva
   dallo schermo trascinandosi dietro l'intera pagina.

   Non si vede scrivendo l'articolo, perché nell'editor lo spazio
   unificatore è identico a uno normale. Si vede solo dopo, pubblicato.
   ───────────────────────────────────────────────────────────── */

/**
 * Rende il testo capace di andare a capo, senza alterarne il contenuto.
 *
 * Gli spazi unificatori diventano spazi normali. Restano intatti tutto
 * il resto del testo, i tag HTML e la formattazione: cambia solo la
 * possibilità del browser di spezzare la riga dove serve.
 */
export function ripulisciTesto(testo) {
  if (typeof testo !== "string" || !testo) return testo;
  return (
    testo
      // il carattere vero e proprio, come arriva dal copia-incolla
      .replace(/ /g, " ")
      // e la sua scrittura in HTML, nelle varie forme ammesse
      .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
      // lo spazio stretto e quello a larghezza zero, altri ospiti
      // frequenti dei testi copiati dal web
      .replace(/[  ﻿]/g, " ")
  );
}
