/* ─────────────────────────────────────────────────────────────
   src/utils/seo.js
   Helper per impostare meta tag dinamici (title, description, og:*)
   USO: dentro un componente
     useEffect(() => {
       setSEO({ title: "...", description: "...", image: "..." });
       return () => resetSEO();
     }, []);
   ───────────────────────────────────────────────────────────── */

/* Indirizzo ufficiale del sito. Deve coincidere con il canonical in
   index.html: se i due divergono, Google riceve indicazioni contrastanti
   su quale sia il vero indirizzo delle pagine. */
export const SITO = "https://netflaxt.it";

const DEFAULTS = {
  title: "Netflaxt News · La casa dei tifosi laziali",
  description:
    "Notizie, analisi e curva biancoceleste. Calciomercato, Serie A ed esclusive della redazione Netflaxt News.",
  image: "/icon-512.png",
  url: SITO,
  type: "website",
};

function setMeta(name, content, isProperty = false) {
  if (!content) return;
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/* ── Dati strutturati (schema.org) ─────────────────────────────
   Sono un'etichetta invisibile che spiega a Google COSA sta leggendo:
   non un testo qualunque, ma un articolo di cronaca sportiva con un
   titolo, una data, un autore e un'immagine. Con questa etichetta un
   risultato di ricerca può mostrare data e anteprima invece di essere
   un link spoglio, e il sito viene trattato come fonte di notizie.
   ───────────────────────────────────────────────────────────── */
const ID_SCHEMA_ARTICOLO = "nf-schema-articolo";

function setJsonLd(id, dati) {
  let el = document.getElementById(id);
  if (!dati) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(dati);
}

function schemaArticolo({ title, description, image, url, author, publishedTime, category }) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: (title || "").slice(0, 110), // Google ignora titoli più lunghi
    description,
    image: image ? [image] : undefined,
    datePublished: publishedTime || undefined,
    dateModified: publishedTime || undefined,
    articleSection: category || undefined,
    inLanguage: "it-IT",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Person", name: author || "Netflaxt News" },
    publisher: {
      "@type": "Organization",
      name: "Netflaxt News",
      logo: { "@type": "ImageObject", url: `${SITO}/icon-512.png` },
    },
  };
}

/**
 * Imposta i meta tag SEO + Open Graph + Twitter Card.
 * Tutti i campi sono opzionali — quelli mancanti usano i DEFAULTS.
 */
export function setSEO({
  title,
  description,
  image,
  url,
  type = "article",
  author,
  publishedTime,
  category,
} = {}) {
  const finalTitle = title
    ? `${title} · Netflaxt News`
    : DEFAULTS.title;
  const finalDescription = description || DEFAULTS.description;
  const finalImage = image
    ? image.startsWith("http") ? image : `${window.location.origin}${image}`
    : `${window.location.origin}${DEFAULTS.image}`;
  const finalUrl = url || window.location.href;

  // Document title
  document.title = finalTitle;

  // Description
  setMeta("description", finalDescription);

  // Canonical URL
  setLink("canonical", finalUrl);

  // Open Graph
  setMeta("og:title", finalTitle, true);
  setMeta("og:description", finalDescription, true);
  setMeta("og:image", finalImage, true);
  setMeta("og:url", finalUrl, true);
  setMeta("og:type", type, true);
  setMeta("og:site_name", "Netflaxt News", true);
  setMeta("og:locale", "it_IT", true);

  // Twitter Card
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", finalTitle);
  setMeta("twitter:description", finalDescription);
  setMeta("twitter:image", finalImage);

  // Article-specific
  if (type === "article") {
    if (author) setMeta("article:author", author, true);
    if (publishedTime) setMeta("article:published_time", publishedTime, true);
    if (category) setMeta("article:section", category, true);
    setJsonLd(
      ID_SCHEMA_ARTICOLO,
      schemaArticolo({
        title: finalTitle,
        description: finalDescription,
        image: finalImage,
        url: finalUrl,
        author,
        publishedTime,
        category,
      })
    );
  } else {
    // Fuori da un articolo l'etichetta va tolta, altrimenti resterebbe
    // appiccicata alle pagine successive descrivendo un contenuto sbagliato.
    setJsonLd(ID_SCHEMA_ARTICOLO, null);
  }
}

/**
 * Resetta ai meta default.
 */
export function resetSEO() {
  setSEO();
}
