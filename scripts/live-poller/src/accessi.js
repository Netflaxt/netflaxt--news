/* ─────────────────────────────────────────────────────────────
   Netflaxt — Approvazione degli accessi da dispositivi nuovi

   Quando qualcuno entra in un account da un dispositivo mai visto,
   l'accesso resta sospeso e qui parte l'email di conferma verso
   l'indirizzo dell'account. Chi non ha accesso a quella casella non
   entra, anche conoscendo la password.

   Due funzioni:
     richiediApprovazione → manda l'email con il link di conferma
     confermaDispositivo  → il link è stato aperto: sblocca l'accesso
   ───────────────────────────────────────────────────────────── */

const SITO = "https://netflaxt.it";
const MITTENTE = "Netflaxt News <news@netflaxt.it>";

/* Spedisce l'email di conferma. Viene chiamata dal sito subito dopo il
   tentativo di accesso, quindi deve essere rapida. */
export async function richiediApprovazione(env, auth, helpers, uid, deviceId) {
  const { leggiDoc, fval } = helpers;
  if (!env.RESEND_KEY) return { ok: false, motivo: "invio email non configurato" };
  if (!uid || !deviceId) return { ok: false, motivo: "richiesta incompleta" };

  // La richiesta deve esistere davvero: senza questo controllo chiunque
  // potrebbe far partire email a raffica verso indirizzi altrui.
  const dispositivo = await leggiDoc(auth, `users/${uid}/devices/${deviceId}`);
  if (!dispositivo?.fields) return { ok: false, motivo: "dispositivo sconosciuto" };
  if (fval(dispositivo.fields.approved) !== false) {
    return { ok: false, motivo: "nessuna conferma in attesa" };
  }

  const token = fval(dispositivo.fields.approvalToken);
  if (!token) return { ok: false, motivo: "codice mancante" };

  const utente = await leggiDoc(auth, `users/${uid}`);
  const email = fval(utente?.fields?.email);
  if (!email) return { ok: false, motivo: "indirizzo non disponibile" };

  const descrizione = fval(dispositivo.fields.label) || "Dispositivo sconosciuto";
  const nome = fval(utente?.fields?.displayName) || "";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: MITTENTE,
      to: [email],
      subject: "Conferma l'accesso a Netflaxt News",
      html: emailApprovazione({ nome, descrizione, token, uid }),
    }),
  });

  if (!res.ok) {
    const dettaglio = (await res.text()).slice(0, 200);
    console.error(`Resend ${res.status}: ${dettaglio}`);
    return { ok: false, motivo: "invio non riuscito" };
  }
  return { ok: true };
}

/* Il link nell'email è stato aperto: il dispositivo diventa di fiducia.

   Il link porta con sé anche l'identificativo dell'account, così la
   ricerca avviene fra i dispositivi di QUELL'utente. Cercare fra quelli
   di tutti gli utenti richiederebbe un indice dedicato su Firestore, e
   senza di quello la conferma fallirebbe.
   Non è un'informazione sensibile: da sola non permette nulla, serve
   comunque il codice, che è casuale e valido una volta sola. */
export async function confermaDispositivo(auth, helpers, token, uid) {
  const { runQuery, patchDoc } = helpers;
  if (!token) return { ok: false, motivo: "codice mancante" };
  if (!uid) return { ok: false, motivo: "link incompleto" };

  const trovati = await runQuery(
    auth,
    {
      from: [{ collectionId: "devices" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "approvalToken" },
          op: "EQUAL",
          value: { stringValue: token },
        },
      },
      limit: 1,
    },
    `users/${uid}` // cerca solo fra i dispositivi di questo account
  );
  if (!trovati.length) return { ok: false, motivo: "richiesta non trovata o già confermata" };

  await patchDoc(auth, trovati[0].percorso, {
    approved: true,
    approvedAt: new Date(),
    approvalToken: null, // usato una volta sola
  });
  return { ok: true };
}

function emailApprovazione({ nome, descrizione, token, uid }) {
  const link = `${SITO}/approva?t=${encodeURIComponent(token)}&u=${encodeURIComponent(uid)}`;
  const saluto = nome ? `Ciao ${escapeHtml(nome)},` : "Ciao,";

  return `<!doctype html>
<html lang="it"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">

        <tr><td style="background:#05070D;padding:20px 24px" align="center">
          <div style="color:#38bdf8;font-size:20px;font-weight:bold;letter-spacing:1px">NETFLAXT NEWS</div>
        </td></tr>

        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">Nuovo accesso al tuo account</h1>
          <p style="margin:0 0 14px;line-height:1.6;color:#334155;font-size:15px">${saluto}</p>
          <p style="margin:0 0 14px;line-height:1.6;color:#334155;font-size:15px">
            Qualcuno ha appena provato ad accedere al tuo account da un dispositivo
            che non avevamo mai visto:
          </p>
          <p style="margin:0 0 20px;padding:12px 14px;background:#f1f5f9;border-radius:8px;color:#0f172a;font-size:14px;font-weight:bold">
            ${escapeHtml(descrizione)}
          </p>
          <p style="margin:0 0 6px;line-height:1.6;color:#334155;font-size:15px">
            <strong>Sei stato tu?</strong> Conferma qui sotto e potrai entrare.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0">
            <tr><td style="background:#0284c7;border-radius:8px">
              <a href="${escapeAttr(link)}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">Sì, sono io — conferma l'accesso</a>
            </td></tr>
          </table>
          <p style="margin:0;line-height:1.6;color:#b91c1c;font-size:14px">
            <strong>Non sei stato tu?</strong> Non aprire il link e cambia subito la
            password: qualcuno la conosce.
          </p>
        </td></tr>

        <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5">
            Ricevi questo messaggio perché è stato richiesto un accesso al tuo
            account su <a href="${SITO}" style="color:#64748b">netflaxt.it</a>.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
