import React, { useState } from "react";
import { db } from "../firebase/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("Calciomercato");
  const [imageUrl, setImageUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
        category,
        imageUrl,
        featured,
        author: "Mattia",
        date: Timestamp.now(),
      });
      setTitle("");
      setExcerpt("");
      setImageUrl("");
      setFeatured(false);
      setSuccess(true);
    } catch (error) {
      console.error("Errore:", error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ["Calciomercato", "Serie A", "Coppa Italia", "Europa", "Editoriali"];

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
          Pannello
        </div>
        <h1
          className="mt-2 text-5xl text-slate-900 mb-8"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          Pubblica un articolo
        </h1>

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 font-semibold">
            ✅ Articolo pubblicato con successo!
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Titolo
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Titolo dell'articolo"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Anteprima testo
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              required
              rows={4}
              placeholder="Breve descrizione dell'articolo..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-sky-400 transition"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              URL Immagine
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-sky-500"
            />
            <span className="text-sm font-semibold text-slate-700">In evidenza</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-slate-900 text-white font-bold rounded-md hover:bg-sky-500 hover:text-slate-900 transition disabled:opacity-50"
          >
            {loading ? "Pubblicazione..." : "Pubblica articolo"}
          </button>
        </form>
      </div>
    </main>
  );
}