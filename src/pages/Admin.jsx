import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../firebase/firebase";
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, Timestamp, orderBy, query } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import axios from "axios";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("pubblica");

  // Form stato
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Calciomercato");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [journalist, setJournalist] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Crop stato
  const [cropSrc, setCropSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [showCrop, setShowCrop] = useState(false);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);
  const originalFileRef = useRef(null);

  // Gestione articoli
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (tab === "gestisci") fetchArticles();
  }, [tab]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/" />;

  const fetchArticles = async () => {
    setLoadingArticles(true);
    try {
      const q = query(collection(db, "articles"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      setArticles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "articles", id));
      setArticles((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (article) => {
    setEditingId(article.id);
    setEditData({
      title: article.title || "",
      excerpt: article.excerpt || "",
      category: article.category || "Calciomercato",
      featured: article.featured || false,
      source: article.source || "",
      sourceUrl: article.sourceUrl || "",
      journalist: article.journalist || "",
    });
  };

  const handleSaveEdit = async (id) => {
    try {
      await updateDoc(doc(db, "articles", id), editData);
      setArticles((prev) => prev.map((a) => a.id === id ? { ...a, ...editData } : a));
      setEditingId(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Crop handlers
  const onFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    originalFileRef.current = file;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result);
      setShowCrop(true);
      setCrop(undefined);
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 16 / 9));
  };

  const getCroppedBlob = useCallback(() => {
    return new Promise((resolve) => {
      if (!completedCrop || !imgRef.current) {
        resolve(null);
        return;
      }
      const image = imgRef.current;
      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0, 0,
        canvas.width,
        canvas.height
      );
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [completedCrop]);

  const handleCropConfirm = async () => {
    setShowCrop(false);
    setImageUploading(true);
    try {
      const blob = await getCroppedBlob();
      const file = blob || originalFileRef.current;
      const formData = new FormData();
      formData.append("file", file, "cover.jpg");
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "netflaxt/articles");
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );
      setImageUrl(res.data.secure_url);
    } catch (e) {
      console.error("Errore upload:", e);
    } finally {
      setImageUploading(false);
      setCropSrc(null);
    }
  };

  const handleCropSkip = async () => {
    setShowCrop(false);
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", originalFileRef.current);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "netflaxt/articles");
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );
      setImageUrl(res.data.secure_url);
    } catch (e) {
      console.error("Errore upload:", e);
    } finally {
      setImageUploading(false);
      setCropSrc(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await addDoc(collection(db, "articles"), {
        title, excerpt, content, category, imageUrl,
        featured, source, sourceUrl, journalist,
        author: "Mattia", date: Timestamp.now(),
      });
      setTitle(""); setExcerpt(""); setContent(""); setImageUrl("");
      setSource(""); setSourceUrl(""); setJournalist(""); setFeatured(false);
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
      ["link"], ["clean"],
    ],
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30 py-12 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-sky-200/20 blur-3xl pointer-events-none" />

      {/* Modal Crop */}
      {showCrop && cropSrc && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-2xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                Ritaglia immagine
              </h3>
              <p className="text-sm text-slate-500 mt-1">Trascina per selezionare l'area da usare come copertina (16:9 consigliato)</p>
            </div>
            <div className="p-6 flex justify-center bg-slate-50 max-h-[60vh] overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
              >
                <img
                  ref={imgRef}
                  src={cropSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: "50vh", maxWidth: "100%" }}
                  alt="crop"
                />
              </ReactCrop>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={handleCropSkip}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-md hover:bg-slate-50 transition text-sm"
              >
                Carica senza ritaglio
              </button>
              <button
                onClick={handleCropConfirm}
                className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-md hover:bg-sky-500 hover:text-slate-900 transition text-sm"
              >
                Conferma ritaglio →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
            <span className="h-px w-8 bg-sky-400" />
            Pannello redazione
          </div>
          <h1 className="mt-3 text-5xl sm:text-6xl text-slate-900 mb-6 leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Admin
          </h1>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-8">
            {[
              { key: "pubblica", label: "📝 Pubblica articolo" },
              { key: "gestisci", label: "⚙️ Gestisci articoli" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-2.5 rounded-md text-sm font-bold transition-all duration-200 ${
                  tab === t.key
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-sky-400 hover:text-sky-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB: PUBBLICA */}
        {tab === "pubblica" && (
          <>
            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-semibold flex items-center gap-3 shadow-sm">
                <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">✓</span>
                Articolo pubblicato con successo!
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Sezione 1 */}
              <div className="p-8 border-b border-slate-100 space-y-5">
                <SectionLabel n="1" label="Informazioni principali" />
                <Field label="Titolo *">
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Titolo dell'articolo" className="adminInput" />
                </Field>
                <Field label="Anteprima testo (sommario) *">
                  <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} required rows={3} placeholder="Breve descrizione che apparirà nelle card..." className="adminInput resize-none" />
                </Field>
                <Field label="Categoria">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="adminInput">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Immagine di copertina">
                  <div className="space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                        imageUploading ? "border-sky-300 bg-sky-50" : "border-slate-200 hover:border-sky-400 hover:bg-sky-50/50"
                      }`}
                    >
                      {imageUploading ? (
                        <>
                          <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-sky-600 font-semibold">Caricamento in corso...</span>
                        </>
                      ) : imageUrl ? (
                        <>
                          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm text-emerald-600 font-semibold">Immagine caricata ✓</span>
                          <span className="text-xs text-slate-400">Clicca per cambiare</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          <div className="text-center">
                            <span className="text-sm font-semibold text-slate-700">Clicca per caricare un'immagine</span>
                            <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP — da PC o telefono</p>
                          </div>
                        </>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
                    </div>
                    {imageUrl && !imageUploading && (
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/7]">
                        <img src={imageUrl} alt="anteprima" className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 px-2 py-1 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest rounded">Anteprima</span>
                        <button type="button" onClick={() => { setImageUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition text-xs font-bold">✕</button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400 uppercase tracking-wider">oppure inserisci URL</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="adminInput" />
                  </div>
                </Field>
              </div>

              {/* Sezione 2 */}
              <div className="p-8 border-b border-slate-100 space-y-5">
                <SectionLabel n="2" label="Contenuto completo" />
                <Field label="Corpo dell'articolo">
                  <div className="rounded-md border border-slate-200 overflow-hidden bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition">
                    <ReactQuill theme="snow" value={content} onChange={setContent} modules={quillModules} placeholder="Scrivi il corpo dell'articolo..." style={{ minHeight: "260px" }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Tip: usa H2/H3 per i paragrafi, blockquote per le citazioni.</p>
                </Field>
              </div>

              {/* Sezione 3 */}
              <div className="p-8 border-b border-slate-100 space-y-5">
                <SectionLabel n="3" label="Fonte e attribuzione" />
                <Field label="Giornalista / Testata">
                  <input type="text" value={journalist} onChange={(e) => setJournalist(e.target.value)} placeholder="Es. Mario Rossi · Corriere dello Sport" className="adminInput" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Fonte (nome)">
                    <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Es. Sky Sport" className="adminInput" />
                  </Field>
                  <Field label="Link fonte (URL)">
                    <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." className="adminInput" />
                  </Field>
                </div>
              </div>

              {/* Sezione 4 */}
              <div className="p-8 space-y-5 bg-slate-50/50">
                <SectionLabel n="4" label="Opzioni" />
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 transition">Articolo in evidenza</div>
                    <div className="text-xs text-slate-500 mt-0.5">Comparirà con il badge "Top" nella lista news.</div>
                  </div>
                </label>
                <button type="submit" disabled={loading || imageUploading} className="group relative w-full py-3.5 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50">
                  <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                    {loading ? "Pubblicazione in corso..." : "🚀  Pubblica articolo"}
                  </span>
                  <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </button>
              </div>
            </form>
          </>
        )}

        {/* TAB: GESTISCI */}
        {tab === "gestisci" && (
          <div className="space-y-4">
            {loadingArticles ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-20 text-slate-400">Nessun articolo pubblicato.</div>
            ) : (
              articles.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {editingId === a.id ? (
                    /* Modalità modifica */
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase tracking-widest text-sky-500 font-bold">Modifica articolo</span>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-700 transition">✕</button>
                      </div>
                      <input type="text" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} placeholder="Titolo" className="adminInput" />
                      <textarea value={editData.excerpt} onChange={(e) => setEditData({ ...editData, excerpt: e.target.value })} rows={3} placeholder="Sommario" className="adminInput resize-none" />
                      <div className="grid sm:grid-cols-2 gap-4">
                        <select value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value })} className="adminInput">
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="text" value={editData.journalist} onChange={(e) => setEditData({ ...editData, journalist: e.target.value })} placeholder="Giornalista" className="adminInput" />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <input type="text" value={editData.source} onChange={(e) => setEditData({ ...editData, source: e.target.value })} placeholder="Fonte" className="adminInput" />
                        <input type="url" value={editData.sourceUrl} onChange={(e) => setEditData({ ...editData, sourceUrl: e.target.value })} placeholder="Link fonte" className="adminInput" />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editData.featured} onChange={(e) => setEditData({ ...editData, featured: e.target.checked })} className="w-4 h-4" />
                        <span className="text-sm font-semibold text-slate-700">In evidenza</span>
                      </label>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => handleSaveEdit(a.id)} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-md hover:bg-sky-500 hover:text-slate-900 transition text-sm">
                          Salva modifiche
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-5 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-md hover:bg-slate-50 transition text-sm">
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Visualizzazione normale */
                    <div className="flex items-center gap-4 p-4">
                      {a.imageUrl && (
                        <img src={a.imageUrl} alt={a.title} className="w-20 h-14 object-cover rounded-lg flex-shrink-0 border border-slate-200" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] font-bold uppercase tracking-wider rounded">{a.category}</span>
                          {a.featured && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded">★ Top</span>}
                          <span className="text-xs text-slate-400">{a.date?.toDate?.()?.toLocaleDateString("it-IT")}</span>
                        </div>
                        <h3 className="font-semibold text-slate-900 truncate text-sm">{a.title}</h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{a.excerpt}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleEdit(a)} className="px-3 py-1.5 text-xs font-bold border border-sky-300 text-sky-600 rounded-md hover:bg-sky-50 transition">
                          Modifica
                        </button>
                        {deleteConfirm === a.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(a.id)} className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-md hover:bg-red-600 transition">
                              Conferma
                            </button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-xs font-bold border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 transition">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(a.id)} className="px-3 py-1.5 text-xs font-bold border border-red-200 text-red-500 rounded-md hover:bg-red-50 transition">
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

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
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sky-500 text-white text-xs font-black">{n}</span>
      <h3 className="text-xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{label}</h3>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">{label}</label>
      {children}
    </div>
  );
}