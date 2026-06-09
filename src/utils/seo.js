/* ─────────────────────────────────────────────────────────────
   src/utils/seo.js
   Helper per impostare meta tag dinamici (title, description, og:*)
   USO: dentro un componente
     useEffect(() => {
       setSEO({ title: "...", description: "...", image: "..." });
       return () => resetSEO();
     }, []);
   ───────────────────────────────────────────────────────────── */

const DEFAULTS = {
  title: "Netflaxt News · La Lazio dal divano",
  description:
    "Notizie, analisi e curva biancoceleste. Calciomercato, Serie A ed esclusive della redazione Netflaxt News.",
  image: "/icon-512.png",
  url: "https://netflaxtnews.it",
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
  }
}

/**
 * Resetta ai meta default.
 */
export function resetSEO() {
  setSEO();
}
