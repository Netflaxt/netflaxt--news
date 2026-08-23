/* ─────────────────────────────────────────────────────────────
   Netflaxt — Invio della newsletter
   L'admin scrive il messaggio dal pannello: finisce in coda su
   Firestore (`newsletterQueue`) e questo modulo lo spedisce agli
   iscritti tramite Resend.

   Stessa impostazione delle notifiche push: nessun servizio in più da
   configurare, gira nel Worker già attivo, e se qualcosa fallisce non
   blocca il resto.

   Struttura di un messaggio in coda:
     { subject, body, url, status: "queued"|"sending"|"sent"|"failed",
       createdAt, sentCount, failedCount }

   Iscritti: collection `newsletter`, un documento per indirizzo
     { email, createdAt, confirmed, source, token? }
   ───────────────────────────────────────────────────────────── */

const SITO = "https://netflaxt.it";
const MITTENTE = "Netflaxt News <news@netflaxt.it>";

// Cloudflare limita le chiamate esterne per esecuzione: spediamo a
// blocchi e riprendiamo al giro successivo se gli iscritti sono tanti.
const MAX_INVII_PER_GIRO = 30;

export async function processNewsletter(env, auth, helpers) {
  const { runQuery, patchDoc, fval } = helpers;
  if (!env.RESEND_KEY) return { newsletter: "chiave Resend non configurata" };

  const inCoda = await runQuery(auth, {
    from: [{ collectionId: "newsletterQueue" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "status" },
        op: "EQUAL",
        value: { stringValue: "queued" },
      },
    },
    limit: 1, // una newsletter per volta: sono invii pesanti
  });
  if (!inCoda.length) return { newsletter: "niente da inviare" };

  const msg = inCoda[0];
  const oggetto = fval(msg.fields.subject) || "Novità da Netflaxt News";
  const testo = fval(msg.fields.body) || "";
  const link = fval(msg.fields.url) || SITO;
  const giaInviate = Number(fval(msg.fields.sentCount) ?? 0);

  // Presa in carico: se il Worker parte due volte, la seconda non
  // rispedisce lo stesso messaggio agli stessi indirizzi.
  try {
    await patchDoc(auth, `newsletterQueue/${msg.id}`, {
      status: "sending",
      sendingAt: new Date(),
    });
  } catch {
    return { newsletter: "gia in lavorazione" };
  }

  const iscritti = await runQuery(auth, {
    from: [{ collectionId: "newsletter" }],
    limit: 2000,
  });

  if (!iscritti.length) {
    await patchDoc(auth, `newsletterQueue/${msg.id}`, {
      status: "sent",
      sentCount: 0,
      sentAt: new Date(),
      note: "nessun iscritto",
    });
    return { newsletter: "nessun iscritto" };
  }

  const blocco = iscritti.slice(giaInviate, giaInviate + MAX_INVII_PER_GIRO);
  let ok = 0;
  let ko = 0;
  let ultimoErrore = null;

  for (const iscritto of blocco) {
    const indirizzo = fval(iscritto.fields.email);
    if (!indirizzo) continue;

    // Ogni iscritto ha un codice personale per potersi cancellare senza
    // che un estraneo possa disiscrivere altri conoscendone l'indirizzo.
    let token = fval(iscritto.fields.token);
    if (!token) {
      token = crypto.randomUUID();
      await patchDoc(auth, `newsletter/${iscritto.id}`, { token }).catch(() => {});
    }

    const esito = await inviaEmail(env, {
      a: indirizzo,
      oggetto,
      html: componiEmail({ oggetto, testo, link, token }),
    });
    if (esito.ok) ok++;
    else {
      ko++;
      ultimoErrore = esito.dettaglio;
    }
  }

  const totale = giaInviate + blocco.length;
  const finito = totale >= iscritti.length;

  await patchDoc(auth, `newsletterQueue/${msg.id}`, {
    status: finito ? "sent" : "queued", // se restano iscritti, riprende dopo
    sentCount: totale,
    failedCount: ko,
    ...(ultimoErrore ? { error: String(ultimoErrore).slice(0, 300) } : {}),
    ...(finito ? { sentAt: new Date() } : {}),
  });

  return {
    newsletter: {
      id: msg.id,
      iscritti: iscritti.length,
      inviate: ok,
      fallite: ko,
      completata: finito,
    },
  };
}

/* ── Invio singolo tramite Resend ─────────────────────────────── */
async function inviaEmail(env, { a, oggetto, html }) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: MITTENTE, to: [a], subject: oggetto, html }),
    });
    if (res.ok) return { ok: true };
    const dettaglio = (await res.text()).slice(0, 200);
    console.error(`Resend ${res.status}: ${dettaglio}`);
    return { ok: false, stato: res.status, dettaglio };
  } catch (e) {
    return { ok: false, dettaglio: e.message };
  }
}

/* ── Modello dell'email ────────────────────────────────────────
   Volutamente semplice: le caselle di posta ignorano gran parte del
   CSS moderno, quindi si usano tabelle e stili in riga. Il link di
   cancellazione in fondo è obbligatorio per legge. ─────────────── */
function componiEmail({ oggetto, testo, link, token }) {
  const paragrafi = String(testo)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#334155;font-size:15px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const cancellati = `${SITO}/disiscriviti?t=${encodeURIComponent(token)}`;

  return `<!doctype html>
<html lang="it"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">

        <tr><td style="background:#05070D;padding:20px 24px" align="center">
          <div style="color:#38bdf8;font-size:20px;font-weight:bold;letter-spacing:1px">NETFLAXT NEWS</div>
          <div style="color:#94a3b8;font-size:11px;letter-spacing:2px;margin-top:4px">FAN SITE · BIANCOCELESTE</div>
        </td></tr>

        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 18px;font-size:21px;color:#0f172a;line-height:1.3">${escapeHtml(oggetto)}</h1>
          ${paragrafi}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px">
            <tr><td style="background:#0284c7;border-radius:8px">
              <a href="${escapeAttr(link)}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">Leggi su Netflaxt →</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:18px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.5">
            Ricevi questa email perché ti sei iscritto alla newsletter di Netflaxt News.
          </p>
          <p style="margin:0;font-size:12px;color:#64748b">
            <a href="${escapeAttr(cancellati)}" style="color:#64748b">Cancella l'iscrizione</a>
            &nbsp;·&nbsp;
            <a href="${SITO}" style="color:#64748b">netflaxt.it</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/* ── Cancellazione iscrizione ──────────────────────────────────
   Chiamata dalla pagina /disiscriviti tramite il Worker: il codice
   personale identifica l'iscritto, così nessuno può cancellare
   l'iscrizione di un altro conoscendone soltanto l'indirizzo. */
export async function disiscrivi(auth, helpers, token) {
  const { runQuery, eliminaDoc } = helpers;
  if (!token) return { ok: false, motivo: "codice mancante" };

  const trovati = await runQuery(auth, {
    from: [{ collectionId: "newsletter" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "token" },
        op: "EQUAL",
        value: { stringValue: token },
      },
    },
    limit: 1,
  });
  if (!trovati.length) return { ok: false, motivo: "iscrizione non trovata" };

  await eliminaDoc(auth, `newsletter/${trovati[0].id}`);
  return { ok: true };
}
