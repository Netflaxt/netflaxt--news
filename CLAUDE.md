# Netflaxt News

Le istruzioni per lavorare a questo progetto stanno in **[AGENTS.md](AGENTS.md)**.

È un unico documento invece di due copie, perché due copie divergono e poi non
si sa più quale sia quella giusta. Leggilo per intero prima di modificare
qualcosa: contiene le trappole del progetto, e quasi tutte sono state imparate
rompendo qualcosa in produzione con utenti collegati.

In sintesi, se hai fretta:

- Si risponde **in italiano**. Il proprietario non è uno sviluppatore.
- **Misura, non dedurre.** C'è una diagnostica già pronta (§8 di AGENTS.md).
- **Verifica il sito prodotto, non che la procedura sia riuscita.**
- Il repository è **pubblico**: nessun segreto nei file versionati.
- Cancello di qualità: `npm run build`. Il lint è già rosso di suo.
- Dopo ogni pubblicazione: commit e push.
