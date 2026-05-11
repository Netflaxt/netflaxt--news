import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Calciomercato");
  const [imageUrl, setImageUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [journalist, setJournalist] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await addDoc(collection(db, "articles"), {
        title,
        excerpt,
        content,
        category,
        imageUrl,
        featured,
        source,
        sourceUrl,
        journalist,
        author: "Mattia",
        date: Timestamp.now(),
      });
      setTitle("");
      setExcerpt("");
      setContent("");
      setImageUrl("");
      setSource("");
      setSourceUrl("");
      setJournalist("");
      setFeatured(false);
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error("Errore:", error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ["Calciomercato", "Serie A", "Coppa Italia", "Europa", "Editoriali"];

  const quillModules = {
    toolbar: [
      [{ header: [2, 3, false] }],
      ["bold", "italic", "underline", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"],
      ["clean"],
    ],
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30 py-12 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-sky-200/20 blur-3xl pointer-events-none" />
      <div className="relative mx-auto max-w-3xl px-4">
        <div
          className={`transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
            <span className="h-px w-8 bg-sky-400" />
            Pannello redazione
          </div>
          <h1
            className="mt-3 text-5xl sm:text-6xl text-slate-900 mb-2 leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Pubblica articolo
          </h1>
          <p className="text-slate-500 mb-8">Compila i campi e pubblica una nuova notizia.</p>
        </div>

        {success && (
          <div
            className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-semibold flex items-center gap-3 shadow-sm"
            style={{ animation: "slideDown 0.4s ease-out" }}
          >
            <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              ✓
            </span>
            Articolo pubblicato con successo!
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          {/* Sezione: meta */}
          <div className="p-8 border-b border-slate-100 space-y-5">
            <SectionLabel n="1" label="Informazioni principali" />

            <Field label="Titolo *">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Titolo dell'articolo"
                className="adminInput"
              />
            </Field>

            <Field label="Anteprima testo (sommario) *">
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                required
                rows={3}
                placeholder="Breve descrizione che apparirà nelle card..."
                className="adminInput resize-none"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Categoria">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="adminInput"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="URL immagine di copertina">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="adminInput"
                />
              </Field>
            </div>

            {imageUrl && (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/7]">
                <img src={imageUrl} alt="anteprima" className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 px-2 py-1 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest rounded">
                  Anteprima
                </span>
              </div>
            )}
          </div>

          {/* Sezione: contenuto rich text */}
          <div className="p-8 border-b border-slate-100 space-y-5">
            <SectionLabel n="2" label="Contenuto completo" />

            <Field label="Corpo dell'articolo">
              <div className="rounded-md border border-slate-200 overflow-hidden bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition">
                <ReactQuill
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={quillModules}
                  placeholder="Scrivi il corpo dell'articolo. Usa la toolbar per grassetto, link, liste, citazioni..."
                  style={{ minHeight: "260px" }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Tip: usa H2/H3 per i paragrafi, blockquote per le citazioni dei protagonisti.
              </p>
            </Field>
          </div>

          {/* Sezione: fonte */}
          <div className="p-8 border-b border-slate-100 space-y-5">
            <SectionLabel n="3" label="Fonte e attribuzione" />

            <Field label="Giornalista / Testata">
              <input
                type="text"
                value={journalist}
                onChange={(e) => setJournalist(e.target.value)}
                placeholder="Es. Mario Rossi · Corriere dello Sport"
                className="adminInput"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Fonte (nome)">
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Es. Sky Sport"
                  className="adminInput"
                />
              </Field>

              <Field label="Link fonte (URL)">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="adminInput"
                />
              </Field>
            </div>
          </div>

          {/* Sezione: opzioni */}
          <div className="p-8 space-y-5 bg-slate-50/50">
            <SectionLabel n="4" label="Opzioni" />

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 transition">
                  Articolo in evidenza
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Comparirà con il badge "Top" nella lista news.
                </div>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full py-3.5 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50"
            >
              <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                {loading ? "Pubblicazione in corso..." : "🚀  Pubblica articolo"}
              </span>
              <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
          </div>
        </form>
      </div>

      {/* Stili inline per Quill (la sua toolbar usa CSS proprio, dobbiamo solo armonizzarlo) */}
      <style>{`
        .adminInput {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: rgb(248 250 252);
          border: 1px solid rgb(226 232 240);
          border-radius: 0.375rem;
          color: rgb(15 23 42);
          transition: all 0.2s;
          outline: none;
        }
        .adminInput::placeholder { color: rgb(148 163 184); }
        .adminInput:focus {
          border-color: rgb(56 189 248);
          box-shadow: 0 0 0 2px rgb(224 242 254);
          background-color: white;
        }
        .ql-toolbar.ql-snow {
          border: 0 !important;
          border-bottom: 1px solid rgb(226 232 240) !important;
          background: rgb(248 250 252);
        }
        .ql-container.ql-snow { border: 0 !important; font-family: inherit; font-size: 1rem; }
        .ql-editor { min-height: 220px; }
        .ql-editor.ql-blank::before { color: rgb(148 163 184); font-style: normal; }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

function SectionLabel({ n, label }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sky-500 text-white text-xs font-black">
        {n}
      </span>
      <h3
        className="text-xl text-slate-900"
        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
      >
        {label}
      </h3>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}