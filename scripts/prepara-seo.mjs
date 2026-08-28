/* ─────────────────────────────────────────────────────────────
   scripts/prepara-seo.mjs
   Prepara il sito per i motori di ricerca, dopo la compilazione.

   IL PROBLEMA CHE RISOLVE
   Il sito è un'applicazione: il titolo di un articolo viene scritto dal
   browser DOPO aver caricato la pagina. Nel codice grezzo — quello che
   Google legge per primo — tutti i 19 articoli avevano lo stesso titolo
   e la stessa descrizione, quella generica del sito. Diciannove pagine
   identiche sono il modo più efficace per non comparire in nessuna
   ricerca (verificato il 30/08/2026 leggendo il codice servito).

   COSA FA
   1. Scrive la mappa del sito con dentro TUTTI gli articoli, non solo
      le otto pagine fisse scritte a mano mesi fa.
   2. Per ogni articolo crea una pagina con il SUO titolo, la sua
      descrizione, la sua immagine e i dati da notizia. Il sito poi si
      avvia normalmente: cambia solo ciò che si legge prima.

   Gira dopo `vite build` e lavora dentro `dist/`. Legge gli articoli
   dal database senza credenziali: sono pubblici, come le pagine che
   descrivono.
   ───────────────────────────────────────────────────────────── */
import fs from "node:fs";
import path from "node:path";

const SITO = "https://netflaxt.it";
const PROGETTO = "netflaxt-news";
const DIST = path.resolve("dist");

/* Le pagine che esistono a prescindere dagli articoli. `cambia` e
   `peso` sono suggerimenti per i motori di ricerca: quanto spesso vale
   la pena ripassare, e quanto conta la pagina rispetto alle altre. */
const PAGINE_FISSE = [
  { via: "/", cambia: "daily", peso: "1.0" },
  { via: "/news", cambia: "hourly", peso: "0.9" },
  { via: "/calendario", cambia: "daily", peso: "0.8" },
  { via: "/pronostici", cambia: "daily", peso: "0.8" },
  { via: "/classifica", cambia: "daily", peso: "0.7" },
  { via: "/about", cambia: "monthly", peso: "0.5" },
  { via: "/privacy", cambia: "yearly", peso: "0.3" },
  { via: "/login", cambia: "monthly", peso: "0.4" },
];

const valore = (campo) => {
  if (!campo) return null;
  if (campo.stringValue !== undefined) return campo.stringValue;
  if (campo.timestampValue !== undefined) return campo.timestampValue;
  if (campo.integerValue !== undefined) return Number(campo.integerValue);
  if (campo.booleanValue !== undefined) return campo.booleanValue;
  return null;
};

const proteggi = (testo) =>
  String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* Toglie i tag e accorcia: serve per la descrizione, che deve stare in
   una riga sotto al titolo nei risultati di ricerca. */
function riassumi(html, quanto = 155) {
  const testo = String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (testo.length <= quanto) return testo;
  const tagliato = testo.slice(0, quanto);
  const ultimoSpazio = tagliato.lastIndexOf(" ");
  return (ultimoSpazio > 60 ? tagliato.slice(0, ultimoSpazio) : tagliato) + "…";
}

async function leggiArticoli() {
  const base = `https://firestore.googleapis.com/v1/projects/${PROGETTO}/databases/(default)/documents/articles`;
  const trovati = [];
  let token = null;
  do {
    const url = base + "?pageSize=300" + (token ? `&pageToken=${token}` : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`database non raggiungibile: HTTP ${res.status}`);
    const dati = await res.json();
    if (dati.error) throw new Error(dati.error.status || "errore database");
    for (const doc of dati.documents || []) {
      const f = doc.fields || {};
      trovati.push({
        id: doc.name.split("/").pop(),
        titolo: valore(f.title) || "",
        sommario: valore(f.excerpt) || "",
        contenuto: valore(f.content) || "",
        immagine: valore(f.imageUrl) || "",
        categoria: valore(f.category) || "",
        autore: valore(f.author) || "Netflaxt News",
        data: valore(f.date) || null,
      });
    }
    token = dati.nextPageToken;
  } while (token);
  return trovati;
}

function scriviMappa(articoli) {
  const oggi = new Date().toISOString().slice(0, 10);

  const righeFisse = PAGINE_FISSE.map(
    (p) => `  <url>
    <loc>${SITO}${p.via}</loc>
    <lastmod>${oggi}</lastmod>
    <changefreq>${p.cambia}</changefreq>
    <priority>${p.peso}</priority>
  </url>`
  );

  /* Gli articoli recenti valgono più di quelli vecchi: è un suggerimento
     su cosa vale la pena ripassare per primo, non una classifica. */
  const ordinati = [...articoli].sort(
    (a, b) => new Date(b.data || 0) - new Date(a.data || 0)
  );

  const righeArticoli = ordinati.map((a, i) => {
    const quando = a.data ? new Date(a.data).toISOString().slice(0, 10) : oggi;
    return `  <url>
    <loc>${SITO}/news/${a.id}</loc>
    <lastmod>${quando}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${i < 10 ? "0.8" : "0.6"}</priority>
  </url>`;
  });

  const SCHEMA = "http://www.sitemaps.org/schemas/sitemap/0.9";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Mappa generata automaticamente a ogni pubblicazione del sito.
  NON modificarla a mano: viene riscritta da scripts/prepara-seo.mjs.
-->
<urlset xmlns="${SCHEMA}">
${[...righeFisse, ...righeArticoli].join("\n")}
</urlset>
`;

  fs.writeFileSync(path.join(DIST, "sitemap.xml"), xml, "utf8");
  return PAGINE_FISSE.length + ordinati.length;
}

/* Sostituisce nel modello quello che i motori di ricerca leggono per
   primo. Tutto il resto della pagina resta identico, quindi il sito
   parte e si comporta come sempre. */
function paginaArticolo(modello, a) {
  const titolo = a.titolo || "Netflaxt News";
  const descrizione = a.sommario || riassumi(a.contenuto) || "Notizie sulla SS Lazio.";
  const immagine = a.immagine || `${SITO}/icon-512.png`;
  const indirizzo = `${SITO}/news/${a.id}`;

  let html = modello;

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${proteggi(titolo)} · Netflaxt News</title>`
  );
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${proteggi(descrizione)}" />`
  );

  const sostituisciProprieta = (prop, val) => {
    const cerca = new RegExp(`<meta property="${prop}" content="[^"]*"\\s*/?>`, "i");
    const nuovo = `<meta property="${prop}" content="${proteggi(val)}" />`;
    html = cerca.test(html) ? html.replace(cerca, nuovo) : html;
  };
  const sostituisciNome = (nome, val) => {
    const cerca = new RegExp(`<meta name="${nome}" content="[^"]*"\\s*/?>`, "i");
    const nuovo = `<meta name="${nome}" content="${proteggi(val)}" />`;
    html = cerca.test(html) ? html.replace(cerca, nuovo) : html;
  };

  sostituisciProprieta("og:title", titolo);
  sostituisciProprieta("og:description", descrizione);
  sostituisciProprieta("og:image", immagine);
  sostituisciProprieta("og:url", indirizzo);
  sostituisciProprieta("og:type", "article");
  sostituisciNome("twitter:title", titolo);
  sostituisciNome("twitter:description", descrizione);
  sostituisciNome("twitter:image", immagine);

  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${indirizzo}" />`
  );

  /* I dati strutturati da notizia: sono quelli che permettono a Google
     di trattare la pagina come un articolo giornalistico invece che
     come una pagina qualsiasi. */
  const datiNotizia = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: titolo.slice(0, 110),
    description: descrizione,
    image: [immagine],
    datePublished: a.data || undefined,
    dateModified: a.data || undefined,
    articleSection: a.categoria || undefined,
    author: { "@type": "Organization", name: "Netflaxt News", url: SITO },
    publisher: {
      "@type": "Organization",
      name: "Netflaxt News",
      logo: { "@type": "ImageObject", url: `${SITO}/icon-512.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": indirizzo },
    inLanguage: "it-IT",
  };

  html = html.replace(
    "</head>",
    `    <script type="application/ld+json">${JSON.stringify(datiNotizia)}</script>\n  </head>`
  );

  return html;
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("dist/index.html non trovato: eseguire prima la compilazione");
  }
  const modello = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

  const articoli = await leggiArticoli();
  const inMappa = scriviMappa(articoli);

  let scritte = 0;
  for (const a of articoli) {
    if (!a.id) continue;
    const cartella = path.join(DIST, "news", a.id);
    fs.mkdirSync(cartella, { recursive: true });
    fs.writeFileSync(path.join(cartella, "index.html"), paginaArticolo(modello, a), "utf8");
    scritte++;
  }

  console.log(`SEO: mappa con ${inMappa} indirizzi, ${scritte} pagine articolo generate`);
}

/* Se il database non risponde la pubblicazione NON deve fallire: il
   sito va online lo stesso, con la mappa del rilascio precedente.
   Meglio una mappa vecchia di un giorno che un sito non pubblicato. */
main().catch((e) => {
  console.warn(`SEO: preparazione saltata — ${e.message}`);
});
