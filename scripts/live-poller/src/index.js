/* ─────────────────────────────────────────────────────────────
   Netflaxt — Live poller (Cloudflare Worker)
   Ogni 2 minuti: se c'è una partita della Lazio in corso, legge da
   API-Football (minuto, recupero, stato, risultato) e scrive i campi
   live su Firestore. Il sito mostra il ticker in tempo reale (con
   interpolazione client-side per ticchettare ogni minuto).

   Economia chiamate: legge PRIMA da Firestore (gratis) se siamo nella
   finestra di una partita; SOLO in quel caso chiama API-Football
   (piano free 100/giorno) → ~75 chiamate per partita.

   Secret/vars (impostati con `wrangler secret put` / wrangler.toml):
     FIREBASE_SERVICE_ACCOUNT  (secret JSON)
     APIFOOTBALL_KEY           (secret)
     TEAM_ID                   (var, default 487 = SS Lazio)
   ───────────────────────────────────────────────────────────── */

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(poll(env).catch((e) => console.error("poll error:", e.message)));
  },
  // Endpoint manuale per testare: apri l'URL del Worker nel browser
  async fetch(req, env) {
    try {
      const r = await poll(env);
      return json(r);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

const WINDOW_BEFORE_MS = 10 * 60 * 1000;  // 10 min prima del kickoff
const WINDOW_AFTER_MS = 150 * 60 * 1000;  // 150 min dopo (copre recuperi/ET)
const IN_PLAY = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
const FINISHED = ["FT", "AET", "PEN"];

async function poll(env) {
  const auth = await getAccessToken(env);

  // 1) C'è una partita Lazio nella finestra oraria? (lettura Firestore gratis)
  const now = Date.now();
  const lo = new Date(now - WINDOW_AFTER_MS).toISOString();
  const hi = new Date(now + WINDOW_BEFORE_MS).toISOString();
  const candidates = await runQuery(auth, {
    from: [{ collectionId: "matches" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "kickoff" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: lo } } },
          { fieldFilter: { field: { fieldPath: "kickoff" }, op: "LESS_THAN_OR_EQUAL", value: { timestampValue: hi } } },
        ],
      },
    },
    limit: 5,
  });
  const m = candidates.find((c) => fval(c.fields.status) !== "finished");
  if (!m) return { skipped: "nessuna partita nella finestra" };

  // 2) Dati live da API-Football. Usiamo ?live=all (accessibile sul piano
  //    GRATIS) e filtriamo la Lazio: ?season=2026 sul free è bloccato.
  const fx = await fetchLiveLazio(env);
  const curLive = fval(m.fields.live) === true;
  const curStatus = fval(m.fields.liveStatus);

  // 3) In gioco (la partita compare tra le live): aggiorna minuto/recupero/risultato
  if (fx) {
    const short = fx.fixture?.status?.short || "2H";
    const elapsed = fx.fixture?.status?.elapsed ?? null;
    const extra = fx.fixture?.status?.extra ?? null;
    const home = fx.goals?.home ?? 0;
    const away = fx.goals?.away ?? 0;
    await patchMatch(auth, m.id, {
      live: true,
      liveStatus: short,
      liveMinute: elapsed,
      liveExtra: extra,
      liveHome: home,
      liveAway: away,
      liveUpdatedAt: new Date(),
    });
    return { updated: m.id, short, elapsed, extra, score: `${home}-${away}` };
  }

  // La Lazio non è tra le partite live:
  //  - se la NOSTRA era live → è appena finita: scrivi "FT" una volta sola
  //    (poi diventa stale dopo 15 min, oppure l'admin finalizza il risultato);
  //  - altrimenti non è ancora iniziata → niente.
  if (curLive && curStatus !== "FT") {
    await patchMatch(auth, m.id, { liveStatus: "FT", liveUpdatedAt: new Date() });
    return { finished: m.id };
  }
  return { skipped: "non in corso", curLive };
}

/* ── API-Football: partite LIVE (?live=all). A differenza di ?season=…
   questo endpoint è accessibile anche sul piano gratuito. ──────── */
async function fetchLiveLazio(env) {
  const teamId = env.TEAM_ID || "487";
  const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: { "x-apisports-key": env.APIFOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data.response) ? data.response : [];
  return (
    list.find(
      (fx) =>
        String(fx.teams?.home?.id) === teamId ||
        String(fx.teams?.away?.id) === teamId
    ) || null
  );
}

/* ── Firestore REST (auth service account) ────────────────────── */
async function getAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error("manca FIREBASE_SERVICE_ACCOUNT");
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const jwt = await signJwt(claim, sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("token: " + JSON.stringify(data));
  return { token: data.access_token, projectId: sa.project_id };
}

async function runQuery(auth, structuredQuery) {
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`runQuery HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data || [])
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split("/").pop(), fields: r.document.fields || {} }));
}

async function patchMatch(auth, id, fields) {
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/matches/${id}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({ fields: toFields(fields) }),
  });
  if (!res.ok) throw new Error(`patch HTTP ${res.status}: ${await res.text()}`);
}

/* ── Helpers Firestore typed values ───────────────────────────── */
function fval(f) {
  if (!f) return null;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("timestampValue" in f) return new Date(f.timestampValue).getTime();
  return null;
}
function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) out[k] = { nullValue: null };
    else if (typeof v === "boolean") out[k] = { booleanValue: v };
    else if (typeof v === "number")
      out[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (v instanceof Date) out[k] = { timestampValue: v.toISOString() };
    else out[k] = { stringValue: String(v) };
  }
  return out;
}

/* ── JWT RS256 via Web Crypto ─────────────────────────────────── */
async function signJwt(claim, pem) {
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const data = `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claim)}`;
  const key = await importKey(pem);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}
async function importKey(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}
