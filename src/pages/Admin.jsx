import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { db } from "../firebase/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc,
  Timestamp, orderBy, query,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import AdminUsersTab from "./admin/AdminUsersTab";
import AdminChatTab from "./admin/AdminChatTab";
import AdminCommentsTab from "./admin/AdminCommentsTab";
import AdminMatchesTab from "./admin/AdminMatchesTab";
import AdminSystemTab from "./admin/AdminSystemTab";
import AdminEngagementTab from "./admin/AdminEngagementTab";
import AdminPollsTab from "./admin/AdminPollsTab";
import AdminReportsTab from "./admin/AdminReportsTab";
import AdminDashboardTab from "./admin/AdminDashboardTab";
import AdminPushTab from "./admin/AdminPushTab";
import AdminNewsletterTab from "./admin/AdminNewsletterTab";
import { Navigate } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import axios from "axios";
import {
  listAppeals,
  resolveAppeal,
  suspensionDurationLabel,
} from "../utils/moderationService";
import { JOURNALIST_SOURCES } from "../utils/sources";
import { enqueuePushNotification } from "../utils/push";
import {
  InboxIcon, MailIcon, EmptyIcon,
  DashboardIcon, PencilIcon, CogIcon, HeartIcon, BarsIcon,
  FlagIcon, ShieldIcon, UsersIcon, ChatIcon, CommentIcon,
  BallIcon, WrenchIcon, BellIcon,
} from "../components/icons";
import VideoUploader from "../components/admin/VideoUploader";
import { ripulisciTesto } from "../utils/testoArticolo";
import AdminTabsBar from "../components/admin/AdminTabsBar";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const CATEGORIES = ["Calciomercato", "Serie A", "Esclusive Netflaxt", "Breaking News"];

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
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  /* Seconda foto, facoltativa: compare in fondo all-articolo, prima
     del riquadro della fonte. Non ha ritaglio perche non deve stare in
     un formato fisso come la copertina. */
  const [imageUrl2, setImageUrl2] = useState("");
  const [image2Uploading, setImage2Uploading] = useState(false);
  const [video, setVideo] = useState(null); // { url, type, embedUrl, thumbnail, duration, ... }
  const [featured, setFeatured] = useState(false);
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [journalist, setJournalist] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Crop stato
  const [cropSrc, setCropSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [showCrop, setShowCrop] = useState(false);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileInput2Ref = useRef(null);
  const originalFileRef = useRef(null);

  // Gestione articoli
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Toast notifiche animate
  const [toast, setToast] = useState(null); // { id, message, type }
  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Fetch all'avvio così le statistiche sono visibili anche nel tab "Pubblica"
  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* NB: gli hook qui sotto stanno PRIMA dell'auth gate di proposito. Al
     logout `user` diventa null e il componente si ri-renderizza un'ultima
     volta prima del redirect: se stessero dopo il gate, React ne troverebbe
     di meno e romperebbe il render (schermata bianca). */
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
        completedCrop.x * scaleX, completedCrop.y * scaleY,
        completedCrop.width * scaleX, completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height
      );
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [completedCrop]);

  // ─────────────── STATISTICHE ───────────────
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = articles.filter((a) => {
      const d = a.date?.toDate?.();
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const featuredCount = articles.filter((a) => a.featured).length;
    return { total: articles.length, thisMonth, featured: featuredCount };
  }, [articles]);

  // ─────────────── LISTA FILTRATA ───────────────
  const filteredArticles = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return articles;
    return articles.filter(
      (a) =>
        (a.title || "").toLowerCase().includes(s) ||
        (a.category || "").toLowerCase().includes(s)
    );
  }, [articles, searchTerm]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/" />;

  async function fetchArticles() {
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
  }

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "articles", id));
      setArticles((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
      showToast("Articolo eliminato", "danger");
    } catch (e) {
      console.error(e);
      showToast("Errore durante l'eliminazione", "danger");
    }
  };

  const handleEdit = (article) => {
    setEditingId(article.id);
    setEditData({
      title: article.title || "",
      excerpt: article.excerpt || "",
      category: article.category || CATEGORIES[0],
      featured: article.featured || false,
      source: article.source || "",
      sourceUrl: article.sourceUrl || "",
      journalist: article.journalist || "",
      video: article.video || null,
      imageUrl2: article.imageUrl2 || "",
    });
  };

  const handleSaveEdit = async (id) => {
    try {
      /* Anche in modifica: se si reincolla del testo da un altro sito
         rientrerebbero gli spazi che impediscono di andare a capo.
         Vedi utils/testoArticolo.js. */
      const ripuliti = {
        ...editData,
        ...(editData.title !== undefined && { title: ripulisciTesto(editData.title) }),
        ...(editData.excerpt !== undefined && { excerpt: ripulisciTesto(editData.excerpt) }),
        ...(editData.content !== undefined && { content: ripulisciTesto(editData.content) }),
        // Campo vuoto significa "nessuna seconda foto", non stringa vuota
        ...(editData.imageUrl2 !== undefined && { imageUrl2: editData.imageUrl2 || null }),
      };
      await updateDoc(doc(db, "articles", id), ripuliti);
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...ripuliti } : a))
      );
      setEditingId(null);
      showToast("Modifiche salvate", "success");
    } catch (e) {
      console.error(e);
      showToast("Errore durante il salvataggio", "danger");
    }
  };

  // ─────────────── CROP HANDLERS ───────────────
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

  /* Carica la seconda foto dell'articolo.

     Nessun ritaglio: la copertina deve stare in 16:9 perché fa da
     testata, questa invece compare dentro l'articolo e va bene con le
     proporzioni originali, verticali comprese.
     Il controllo sul tipo e sulla dimensione avviene qui: Cloudinary
     rifiuterebbe comunque i file troppo grandi, ma con un messaggio
     tecnico in inglese che non aiuterebbe nessuno. */
  const caricaImmagineSemplice = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return null;

    if (!file.type.startsWith("image/")) {
      showToast("Il file scelto non è un'immagine", "danger");
      e.target.value = "";
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(
        `Immagine troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Massimo 10 MB.`,
        "danger"
      );
      e.target.value = "";
      return null;
    }

    setImage2Uploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "netflaxt/articles");
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );
      showToast("Foto caricata", "success");
      return res.data.secure_url;
    } catch (err) {
      console.error("Errore upload seconda foto:", err);
      showToast("Caricamento non riuscito. Riprova.", "danger");
      return null;
    } finally {
      setImage2Uploading(false);
      e.target.value = "";
    }
  };

  const handleSecondaImmagine = async (e) => {
    const url = await caricaImmagineSemplice(e);
    if (url) setImageUrl2(url);
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
    try {
      const nuovo = await addDoc(collection(db, "articles"), {
        title: ripulisciTesto(title),
        excerpt: ripulisciTesto(excerpt),
        /* Ripulito PRIMA di salvare: il copia-incolla da altri siti
           porta spazi che impediscono di andare a capo e sfondano la
           pagina. Vedi utils/testoArticolo.js. */
        content: ripulisciTesto(content),
        category, imageUrl,
        // Seconda foto: null se non messa, cosi la pagina sa che non c-e
        imageUrl2: imageUrl2 || null,
        video: video || null,
        featured, source, sourceUrl, journalist,
        author: "Mattia", date: Timestamp.now(),
      });

      // Avvisa i tifosi che hanno attivato le notifiche. Se fallisce non
      // deve far sembrare fallita la pubblicazione: l'articolo è già online.
      let avvisati = true;
      try {
        await enqueuePushNotification({
          title: "📰 Nuova notizia su Netflaxt",
          body: title,
          url: `/news/${nuovo.id}`,
        });
      } catch (err) {
        console.error("Notifica non inviata:", err);
        avvisati = false;
      }

      setTitle(""); setExcerpt(""); setContent(""); setImageUrl(""); setImageUrl2("");
      setSource(""); setSourceUrl(""); setJournalist(""); setFeatured(false);
      setVideo(null);
      showToast(
        avvisati
          ? "Articolo pubblicato! Notifica in arrivo ai tifosi."
          : "Articolo pubblicato (notifica non inviata)",
        avvisati ? "success" : "danger"
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      fetchArticles(); // ricarica per aggiornare le statistiche
    } catch (error) {
      console.error("Errore:", error);
      showToast("Errore durante la pubblicazione", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Quill toolbar config
  const quillModules = {
    toolbar: [
      [{ header: [2, 3, false] }],
      ["bold", "italic", "underline", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"], ["clean"],
    ],
  };

  return (
    <main className="min-h-screen bg-bg-base text-text-primary py-12 relative overflow-hidden">
      {/* Glow di sfondo coerenti col tema dark */}
      <div className="absolute -top-40 right-0 w-[600px] h-[500px] rounded-full bg-accent/8 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-accent-deep/8 blur-[120px] pointer-events-none" />

      {/* ═══════════════════ TOAST ═══════════════════ */}
      {toast && (
        <div
          key={toast.id}
          data-no-twemoji
          className="fixed bottom-6 right-6 z-[60] max-w-sm admin-toast"
          role="status"
          aria-live="polite"
        >
          <div
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border backdrop-blur-xl shadow-2xl ${
              toast.type === "success"
                ? "bg-success/15 border-success/40 text-success"
                : toast.type === "danger"
                ? "bg-red-500/15 border-red-500/40 text-red-400"
                : "bg-accent/15 border-accent/40 text-accent"
            }`}
          >
            <span
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                toast.type === "success"
                  ? "bg-success"
                  : toast.type === "danger"
                  ? "bg-red-500"
                  : "bg-accent"
              }`}
            >
              {toast.type === "success" ? "✓" : toast.type === "danger" ? "✕" : "ℹ"}
            </span>
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ═══════════════════ MODAL CROP ═══════════════════ */}
      {showCrop && cropSrc && (
        <div className="fixed inset-0 z-50 bg-bg-base/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-border">
            <div className="p-6 border-b border-border">
              <h3
                className="text-2xl text-text-primary"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Ritaglia immagine
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Trascina per selezionare l'area da usare come copertina (16:9 consigliato)
              </p>
            </div>
            <div className="p-6 flex justify-center bg-bg-elevated max-h-[60vh] overflow-auto">
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
            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button
                onClick={handleCropSkip}
                className="px-5 py-2.5 border border-border text-text-secondary font-semibold rounded-md hover:bg-bg-elevated hover:text-text-primary transition text-sm"
              >
                Carica senza ritaglio
              </button>
              <button
                onClick={handleCropConfirm}
                className="px-5 py-2.5 bg-accent text-text-inverse font-bold rounded-md hover:shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)] transition text-sm"
              >
                Conferma ritaglio →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ═══════════════════ HEADER ═══════════════════ */}
        <div
          className={`transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent font-semibold">
            <span className="h-px w-8 bg-accent" />
            Pannello redazione
          </div>
          <h1
            className="mt-3 text-5xl sm:text-6xl text-text-primary mb-2 leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Admin
          </h1>
          <p className="text-text-secondary text-sm mb-8">
            Gestisci articoli, monitora le pubblicazioni e cura i contenuti della community.
          </p>

          {/* ═══════════════════ STATISTICHE ═══════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Articoli totali"
              value={stats.total}
              hint="Tutti gli articoli pubblicati"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM9 9h6m-6 4h6m-6 4h4" />
                </svg>
              }
            />
            <StatCard
              label="Questo mese"
              value={stats.thisMonth}
              hint="Pubblicati nel mese corrente"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              accent
            />
            <StatCard
              label="In evidenza"
              value={stats.featured}
              hint="Articoli con badge Top"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
            />
          </div>

          {/* Tab switcher (scrollabile orizzontalmente, drag con mouse) */}
          <AdminTabsBar
            current={tab}
            onChange={setTab}
            tabs={[
              { key: "dashboard",    label: "Dashboard",         Icon: DashboardIcon },
              { key: "pubblica",     label: "Pubblica articolo", Icon: PencilIcon },
              { key: "gestisci",     label: "Gestisci articoli", Icon: CogIcon },
              { key: "reazioni",     label: "Reazioni",          Icon: HeartIcon },
              { key: "sondaggi",     label: "Sondaggi",          Icon: BarsIcon },
              { key: "segnalazioni", label: "Segnalazioni",      Icon: FlagIcon },
              { key: "push",         label: "Notifiche",         Icon: BellIcon },
              { key: "newsletter",   label: "Newsletter",        Icon: MailIcon },
              { key: "moderazione",  label: "Moderazione",       Icon: ShieldIcon },
              { key: "utenti",       label: "Utenti",            Icon: UsersIcon },
              { key: "chat",         label: "Chat",              Icon: ChatIcon },
              { key: "commenti",     label: "Commenti",          Icon: CommentIcon },
              { key: "partite",      label: "Partite",           Icon: BallIcon },
              { key: "sistema",      label: "Sistema",           Icon: WrenchIcon },
            ]}
          />
        </div>

        {/* ═══════════════════ TAB: PUBBLICA ═══════════════════ */}
        {tab === "pubblica" && (
          <div className="grid lg:grid-cols-12 gap-6">
            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-7 bg-bg-surface rounded-2xl border border-border shadow-xl overflow-hidden"
            >
              {/* Sezione 1 */}
              <div className="p-7 border-b border-border space-y-5">
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
                <Field label="Categoria">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="adminInput"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Immagine di copertina">
                  <div className="space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                        imageUploading
                          ? "border-accent/60 bg-accent/5"
                          : "border-border hover:border-accent/50 hover:bg-accent/5"
                      }`}
                    >
                      {imageUploading ? (
                        <>
                          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-accent font-semibold">Caricamento in corso...</span>
                        </>
                      ) : imageUrl ? (
                        <>
                          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm text-success font-semibold">Immagine caricata ✓</span>
                          <span className="text-xs text-text-muted">Clicca per cambiare</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          <div className="text-center">
                            <span className="text-sm font-semibold text-text-primary">Clicca per caricare un'immagine</span>
                            <p className="text-xs text-text-muted mt-1">PNG, JPG, WEBP — da PC o telefono</p>
                          </div>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFileSelect}
                      />
                    </div>
                    {imageUrl && !imageUploading && (
                      <div className="relative rounded-lg overflow-hidden border border-border aspect-[16/7]">
                        <img src={imageUrl} alt="anteprima" className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 px-2 py-1 bg-bg-base/80 backdrop-blur text-text-primary text-[10px] font-bold uppercase tracking-widest rounded">
                          Anteprima
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrl("");
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-text-muted uppercase tracking-wider">oppure inserisci URL</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="adminInput"
                    />
                  </div>
                </Field>
              </div>

              {/* Sezione 1bis — Video */}
              <div className="p-7 border-b border-border space-y-5">
                <SectionLabel n="2" label="Video (opzionale)" />
                <Field label="Video dell'articolo">
                  <VideoUploader value={video} onChange={setVideo} />
                  <p className="mt-2 text-xs text-text-muted">
                    Carica un video direttamente (Cloudinary, max 100 MB) oppure incolla
                    un link YouTube/Vimeo per video lunghi. Apparirà sopra al corpo dell'articolo.
                  </p>
                </Field>
              </div>

              {/* Seconda foto — compare in fondo all'articolo */}
              <div className="p-7 border-b border-border space-y-5">
                <SectionLabel n="3" label="Seconda foto (opzionale)" />
                <Field label="Foto in fondo all'articolo">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => fileInput2Ref.current?.click()}
                      disabled={image2Uploading}
                      className="w-full py-4 rounded-md border border-dashed border-border hover:border-accent/60 hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition disabled:opacity-60"
                    >
                      {image2Uploading
                        ? "Caricamento in corso…"
                        : imageUrl2
                        ? "Sostituisci la foto"
                        : "Scegli una foto dal computer"}
                    </button>
                    <input
                      ref={fileInput2Ref}
                      type="file"
                      accept="image/*"
                      onChange={handleSecondaImmagine}
                      className="hidden"
                    />

                    {imageUrl2 && !image2Uploading && (
                      <div className="relative rounded-md overflow-hidden border border-border bg-bg-elevated">
                        <img
                          src={imageUrl2}
                          alt="anteprima seconda foto"
                          className="w-full max-h-64 object-contain bg-bg-base"
                        />
                        <button
                          type="button"
                          onClick={() => setImageUrl2("")}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition text-xs font-bold"
                          aria-label="Rimuovi la seconda foto"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-text-muted uppercase tracking-wider">
                        oppure inserisci URL
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <input
                      type="url"
                      value={imageUrl2}
                      onChange={(e) => setImageUrl2(e.target.value)}
                      placeholder="https://..."
                      className="adminInput"
                    />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Appare in fondo all'articolo, subito prima del riquadro della fonte.
                    Mantiene le proporzioni originali: va bene anche verticale.
                  </p>
                </Field>
              </div>

              {/* Sezione 2 */}
              <div className="p-7 border-b border-border space-y-5">
                <SectionLabel n="4" label="Contenuto completo" />
                <Field label="Corpo dell'articolo">
                  <div className="rounded-md border border-border overflow-hidden bg-bg-elevated focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15 transition">
                    <ReactQuill
                      theme="snow"
                      value={content}
                      onChange={setContent}
                      modules={quillModules}
                      placeholder="Scrivi il corpo dell'articolo..."
                      style={{ minHeight: "260px" }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Tip: usa H2/H3 per i paragrafi, blockquote per le citazioni.
                  </p>
                </Field>
              </div>

              {/* Sezione 3 */}
              <div className="p-7 border-b border-border space-y-5">
                <SectionLabel n="5" label="Fonte e attribuzione" />
                <Field label="Giornalista / Fonte">
                  <JournalistSelect value={journalist} onChange={setJournalist} />
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

              {/* Sezione 4 */}
              <div className="p-7 space-y-5 bg-bg-elevated/40">
                <SectionLabel n="6" label="Opzioni" />
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <div className="text-sm font-semibold text-text-primary group-hover:text-accent transition">
                      Articolo in evidenza
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      Comparirà con il badge "Top" nella lista news.
                    </div>
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={loading || imageUploading}
                  className="group relative w-full py-3.5 bg-accent text-text-inverse font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 inline-flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Pubblicazione in corso...
                      </>
                    ) : (
                      <>🚀 Pubblica articolo</>
                    )}
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                </button>
              </div>
            </form>

            {/* ANTEPRIMA LIVE */}
            <aside className="lg:col-span-5">
              <div className="lg:sticky lg:top-24 space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                  </span>
                  Anteprima live
                </div>
                <article className="rounded-2xl bg-bg-surface border border-border overflow-hidden shadow-xl">
                  {/* Image */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-bg-elevated">
                    {imageUrl ? (
                      <img src={imageUrl} alt="anteprima" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <div className="text-center">
                          <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span className="text-xs uppercase tracking-widest">L'immagine apparirà qui</span>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-surface/80 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 px-2 py-1 bg-bg-base/80 backdrop-blur-md border border-border text-[10px] font-bold uppercase tracking-[0.18em] text-text-primary rounded">
                      {category}
                    </span>
                    {featured && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 bg-accent/90 backdrop-blur-md text-text-inverse text-[10px] font-bold uppercase tracking-[0.18em] rounded">
                        ★ Top
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted mb-2">
                      {new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    <h2
                      className="text-2xl font-bold text-text-primary leading-tight text-pretty"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {title || "Titolo dell'articolo"}
                    </h2>
                    {excerpt && (
                      <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                        {excerpt}
                      </p>
                    )}
                    {content && (
                      <div
                        className="adminPreviewContent mt-4 text-sm text-text-secondary leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: content }}
                      />
                    )}
                    <div className="mt-5 pt-4 border-t border-border-subtle flex items-center gap-1.5 text-xs text-text-muted">
                      {journalist ? (
                        <span className="truncate">
                          via <span className="text-text-secondary font-medium">{journalist}</span>
                        </span>
                      ) : (
                        <>
                          <img src="/logo.png" alt="" className="w-4 h-4 object-contain" />
                          <span className="text-text-secondary font-medium">Netflaxt News</span>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              </div>
            </aside>
          </div>
        )}

        {/* ═══════════════════ TAB: GESTISCI ═══════════════════ */}
        {tab === "gestisci" && (
          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca per titolo o categoria..."
                className="adminInput pl-11"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated transition"
                  aria-label="Cancella ricerca"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Conteggio risultati */}
            <div className="flex items-center justify-between text-xs text-text-muted px-1">
              <span>
                <span className="text-text-primary font-semibold tabular-nums">
                  {filteredArticles.length}
                </span>{" "}
                {filteredArticles.length === 1 ? "articolo" : "articoli"}
                {searchTerm && (
                  <span> · filtro: <span className="text-accent font-medium">"{searchTerm}"</span></span>
                )}
              </span>
              {loadingArticles && (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Aggiornamento...
                </span>
              )}
            </div>

            {loadingArticles && articles.length === 0 ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-20 bg-bg-surface border border-border rounded-xl">
                <EmptyIcon icon={InboxIcon} className="mb-3" />
                <p className="text-text-secondary font-semibold">
                  {searchTerm ? "Nessun risultato per la tua ricerca" : "Nessun articolo pubblicato"}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="mt-3 px-4 py-2 text-xs font-semibold border border-border hover:border-accent/50 hover:bg-accent/5 text-text-primary rounded-md transition"
                  >
                    Mostra tutti
                  </button>
                )}
              </div>
            ) : (
              filteredArticles.map((a) => (
                <ArticleRow
                  key={a.id}
                  article={a}
                  editing={editingId === a.id}
                  editData={editData}
                  setEditData={setEditData}
                  onStartEdit={() => handleEdit(a)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={() => handleSaveEdit(a.id)}
                  deleteConfirm={deleteConfirm === a.id}
                  onAskDelete={() => setDeleteConfirm(a.id)}
                  onCancelDelete={() => setDeleteConfirm(null)}
                  onConfirmDelete={() => handleDelete(a.id)}
                />
              ))
            )}
          </div>
        )}

        {/* ═══════════════════ TAB: DASHBOARD ═══════════════════ */}
        {tab === "dashboard" && <AdminDashboardTab />}

        {/* ═══════════════════ TAB: REAZIONI ═══════════════════ */}
        {tab === "reazioni" && <AdminEngagementTab />}

        {/* ═══════════════════ TAB: SONDAGGI ═══════════════════ */}
        {tab === "sondaggi" && <AdminPollsTab onToast={showToast} />}

        {/* ═══════════════════ TAB: SEGNALAZIONI ═══════════════════ */}
        {tab === "segnalazioni" && <AdminReportsTab onToast={showToast} />}

        {/* ═══════════════════ TAB: PUSH NOTIFICATIONS ═══════════════════ */}
        {tab === "push" && <AdminPushTab onToast={showToast} />}
        {tab === "newsletter" && <AdminNewsletterTab onToast={showToast} />}

        {/* ═══════════════════ TAB: MODERAZIONE ═══════════════════ */}
        {tab === "moderazione" && (
          <ModerationPanel onToast={showToast} />
        )}

        {/* ═══════════════════ TAB: UTENTI ═══════════════════ */}
        {tab === "utenti" && (
          <AdminUsersTab onToast={showToast} />
        )}

        {/* ═══════════════════ TAB: CHAT ═══════════════════ */}
        {tab === "chat" && (
          <AdminChatTab onToast={showToast} />
        )}

        {/* ═══════════════════ TAB: COMMENTI ═══════════════════ */}
        {tab === "commenti" && (
          <AdminCommentsTab onToast={showToast} />
        )}

        {/* ═══════════════════ TAB: PARTITE ═══════════════════ */}
        {tab === "partite" && (
          <AdminMatchesTab onToast={showToast} />
        )}

        {/* ═══════════════════ TAB: SISTEMA ═══════════════════ */}
        {tab === "sistema" && (
          <AdminSystemTab onToast={showToast} />
        )}
      </div>

      {/* ═══════════════════ STYLE OVERRIDES ═══════════════════ */}
      <style>{`
        .adminInput {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: rgb(var(--color-bg-elevated, 15 23 42) / 1);
          background-color: var(--color-bg-elevated, #1e293b);
          border: 1px solid var(--color-border, #334155);
          border-radius: 0.5rem;
          color: var(--color-text-primary, #f1f5f9);
          transition: all 0.2s;
          outline: none;
          font-size: 0.875rem;
        }
        .adminInput::placeholder { color: var(--color-text-muted, #64748b); }
        .adminInput:focus {
          border-color: var(--color-accent, #38bdf8);
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.15);
        }
        select.adminInput option {
          background-color: var(--color-bg-elevated, #1e293b);
          color: var(--color-text-primary, #f1f5f9);
        }

        /* Quill toolbar — DARK MODE override */
        .ql-toolbar.ql-snow {
          border: 0 !important;
          border-bottom: 1px solid var(--color-border, #334155) !important;
          background: var(--color-bg-surface, #0f172a);
          padding: 0.5rem 0.75rem !important;
        }
        .ql-toolbar.ql-snow .ql-stroke { stroke: var(--color-text-secondary, #94a3b8); }
        .ql-toolbar.ql-snow .ql-fill,
        .ql-toolbar.ql-snow .ql-stroke.ql-fill { fill: var(--color-text-secondary, #94a3b8); }
        .ql-toolbar.ql-snow .ql-picker-label { color: var(--color-text-secondary, #94a3b8); }
        .ql-toolbar.ql-snow .ql-picker-options {
          background: var(--color-bg-elevated, #1e293b) !important;
          border-color: var(--color-border, #334155) !important;
        }
        .ql-toolbar.ql-snow button:hover .ql-stroke,
        .ql-toolbar.ql-snow .ql-active .ql-stroke,
        .ql-toolbar.ql-snow button:focus .ql-stroke { stroke: var(--color-accent, #38bdf8); }
        .ql-toolbar.ql-snow button:hover .ql-fill,
        .ql-toolbar.ql-snow .ql-active .ql-fill,
        .ql-toolbar.ql-snow button:focus .ql-fill { fill: var(--color-accent, #38bdf8); }
        .ql-toolbar.ql-snow .ql-picker-label:hover,
        .ql-toolbar.ql-snow .ql-active .ql-picker-label { color: var(--color-accent, #38bdf8); }

        .ql-container.ql-snow {
          border: 0 !important;
          font-family: inherit;
          font-size: 0.95rem;
          background: var(--color-bg-elevated, #1e293b);
        }
        .ql-editor {
          min-height: 240px;
          color: var(--color-text-primary, #f1f5f9);
        }
        .ql-editor.ql-blank::before {
          color: var(--color-text-muted, #64748b);
          font-style: normal;
        }
        .ql-snow .ql-tooltip {
          background: var(--color-bg-elevated, #1e293b) !important;
          color: var(--color-text-primary, #f1f5f9) !important;
          border-color: var(--color-border, #334155) !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
        }
        .ql-snow .ql-tooltip input[type="text"] {
          background: var(--color-bg-surface, #0f172a);
          color: var(--color-text-primary, #f1f5f9);
          border-color: var(--color-border, #334155);
        }

        /* Preview content typography */
        .adminPreviewContent h2 { font-size: 1.25rem; font-weight: 700; color: var(--color-text-primary, #f1f5f9); margin-top: 1rem; margin-bottom: 0.5rem; }
        .adminPreviewContent h3 { font-size: 1.1rem; font-weight: 600; color: var(--color-text-primary, #f1f5f9); margin-top: 0.875rem; margin-bottom: 0.5rem; }
        .adminPreviewContent p { margin-bottom: 0.75rem; }
        .adminPreviewContent ul, .adminPreviewContent ol { padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .adminPreviewContent li { margin-bottom: 0.25rem; }
        .adminPreviewContent blockquote {
          border-left: 3px solid var(--color-accent, #38bdf8);
          padding-left: 0.875rem;
          margin: 0.75rem 0;
          font-style: italic;
          color: var(--color-text-primary, #f1f5f9);
        }
        .adminPreviewContent a { color: var(--color-accent, #38bdf8); text-decoration: underline; }
        .adminPreviewContent strong { color: var(--color-text-primary, #f1f5f9); }

        /* Toast animation */
        @keyframes admin-toast-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        .admin-toast { animation: admin-toast-in 0.35s cubic-bezier(0.16, 1, 0.3, 1); }

        /* React Crop selection visible su dark */
        .ReactCrop__crop-selection {
          box-shadow: 0 0 0 9999em rgba(15, 23, 42, 0.65) !important;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </main>
  );
}

/* ═══════════════════════════════════════════════════
   COMPONENTI HELPER
   ═══════════════════════════════════════════════════ */
function StatCard({ label, value, hint, icon, accent = false }) {
  return (
    <div
      className={`relative rounded-2xl p-5 border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${
        accent
          ? "bg-accent/10 border-accent/30"
          : "bg-bg-surface border-border hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-semibold">
            {label}
          </div>
          <div
            className={`mt-2 text-4xl font-bold tabular-nums leading-none ${
              accent ? "text-accent" : "text-text-primary"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {value}
          </div>
          <div className="mt-2 text-xs text-text-muted">{hint}</div>
        </div>
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
            accent ? "bg-accent/20 text-accent" : "bg-bg-elevated text-text-secondary"
          }`}
        >
          {icon}
        </div>
      </div>
      {accent && (
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-accent/15 rounded-full blur-2xl pointer-events-none" />
      )}
    </div>
  );
}

function ArticleRow({
  article: a,
  editing,
  editData,
  setEditData,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  deleteConfirm,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  // Se la categoria salvata non è più nelle predefinite, includila come opzione extra
  const editCategoryOptions = useMemo(() => {
    const list = [...CATEGORIES];
    if (editData?.category && !list.includes(editData.category)) {
      list.unshift(editData.category);
    }
    return list;
  }, [editData?.category]);

  return (
    <div className="bg-bg-surface rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300 hover:border-border-strong">
      {editing ? (
        /* MODE: EDIT */
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-[0.22em] text-accent font-bold">
              Modifica articolo
            </span>
            <button
              onClick={onCancelEdit}
              className="text-text-muted hover:text-text-primary transition w-7 h-7 rounded-full hover:bg-bg-elevated flex items-center justify-center"
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            placeholder="Titolo"
            className="adminInput"
          />
          <textarea
            value={editData.excerpt}
            onChange={(e) => setEditData({ ...editData, excerpt: e.target.value })}
            rows={3}
            placeholder="Sommario"
            className="adminInput resize-none"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <select
              value={editData.category}
              onChange={(e) => setEditData({ ...editData, category: e.target.value })}
              className="adminInput"
            >
              {editCategoryOptions.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIES.includes(c) ? c : `${c} (da aggiornare)`}
                </option>
              ))}
            </select>
            <JournalistSelect
              value={editData.journalist}
              onChange={(v) => setEditData({ ...editData, journalist: v })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={editData.source}
              onChange={(e) => setEditData({ ...editData, source: e.target.value })}
              placeholder="Fonte"
              className="adminInput"
            />
            <input
              type="url"
              value={editData.sourceUrl}
              onChange={(e) => setEditData({ ...editData, sourceUrl: e.target.value })}
              placeholder="Link fonte"
              className="adminInput"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Video (opzionale)
            </label>
            <VideoUploader
              value={editData.video}
              onChange={(v) => setEditData({ ...editData, video: v })}
            />
          </div>

          {/* Seconda foto, anche in modifica: senza questo blocco si
              potrebbe solo metterla alla pubblicazione e mai cambiarla
              o toglierla dopo. */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Seconda foto (in fondo all'articolo)
            </label>
            {editData.imageUrl2 ? (
              <div className="relative rounded-md overflow-hidden border border-border bg-bg-elevated mb-2">
                <img
                  src={editData.imageUrl2}
                  alt="anteprima seconda foto"
                  className="w-full max-h-48 object-contain bg-bg-base"
                />
                <button
                  type="button"
                  onClick={() => setEditData({ ...editData, imageUrl2: "" })}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition text-xs font-bold"
                  aria-label="Rimuovi la seconda foto"
                >
                  ✕
                </button>
              </div>
            ) : null}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const url = await caricaImmagineSemplice(e);
                if (url) setEditData((d) => ({ ...d, imageUrl2: url }));
              }}
              className="block w-full text-xs text-text-secondary file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-bg-elevated file:text-text-primary file:text-xs file:font-semibold hover:file:bg-border cursor-pointer"
            />
            <input
              type="url"
              value={editData.imageUrl2 || ""}
              onChange={(e) => setEditData({ ...editData, imageUrl2: e.target.value })}
              placeholder="oppure incolla un link https://..."
              className="adminInput mt-2"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editData.featured}
              onChange={(e) => setEditData({ ...editData, featured: e.target.checked })}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
            />
            <span className="text-sm font-semibold text-text-primary">In evidenza</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onSaveEdit}
              className="px-5 py-2.5 bg-accent text-text-inverse font-bold rounded-md hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] transition text-sm"
            >
              Salva modifiche
            </button>
            <button
              onClick={onCancelEdit}
              className="px-5 py-2.5 border border-border text-text-secondary font-semibold rounded-md hover:bg-bg-elevated hover:text-text-primary transition text-sm"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        /* MODE: ROW */
        <div className="flex items-center gap-4 p-4">
          {a.imageUrl && (
            <img
              src={a.imageUrl}
              alt={a.title}
              className="w-20 h-14 object-cover rounded-lg flex-shrink-0 border border-border"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider rounded">
                {a.category}
              </span>
              {a.featured && (
                <span className="px-2 py-0.5 bg-warning/15 text-warning text-[10px] font-bold uppercase tracking-wider rounded">
                  ★ Top
                </span>
              )}
              <span className="text-xs text-text-muted">
                {a.date?.toDate?.()?.toLocaleDateString("it-IT")}
              </span>
            </div>
            <h3 className="font-semibold text-text-primary truncate text-sm">
              {a.title}
            </h3>
            <p className="text-xs text-text-secondary truncate mt-0.5">{a.excerpt}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onStartEdit}
              className="px-3 py-1.5 text-xs font-bold border border-accent/40 text-accent rounded-md hover:bg-accent/10 transition"
            >
              Modifica
            </button>
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={onConfirmDelete}
                  className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-md hover:bg-red-600 transition"
                >
                  Conferma
                </button>
                <button
                  onClick={onCancelDelete}
                  className="px-3 py-1.5 text-xs font-bold border border-border text-text-secondary rounded-md hover:bg-bg-elevated transition"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={onAskDelete}
                className="px-3 py-1.5 text-xs font-bold border border-red-500/40 text-red-400 rounded-md hover:bg-red-500/10 transition"
              >
                Elimina
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ n, label }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-text-inverse text-xs font-black shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)]">
        {n}
      </span>
      <h3
        className="text-xl text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label}
      </h3>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

/* Select fonte/giornalista con opzioni preimpostate + inserimento libero */
function JournalistSelect({ value, onChange }) {
  const isPreset = JOURNALIST_SOURCES.includes(value);
  const [other, setOther] = useState(!!value && !isPreset);

  useEffect(() => {
    if (JOURNALIST_SOURCES.includes(value)) setOther(false);
    else if (value) setOther(true);
  }, [value]);

  const selectVal = other ? "__other__" : isPreset ? value : "";

  return (
    <div className="space-y-2">
      <select
        className="adminInput"
        value={selectVal}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__other__") {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(v);
          }
        }}
      >
        <option value="">— Nessuna fonte —</option>
        {JOURNALIST_SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        <option value="__other__">Oppure scrivi tu…</option>
      </select>
      {other && (
        <input
          type="text"
          className="adminInput"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scrivi la fonte / il giornalista (es. Corriere dello Sport)"
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODERATION PANEL
   ══════════════════════════════════════════════════════════════ */
function ModerationPanel({ onToast }) {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending"); // pending | all | confirmed | accepted
  const [resolving, setResolving] = useState(null); // id in corso
  const [expanded, setExpanded] = useState(null); // id espanso
  const [adminNote, setAdminNote] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAppeals();
      setAppeals(list);
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore caricamento ricorsi", "danger");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === "all") return appeals;
    return appeals.filter((a) => a.status === filter);
  }, [appeals, filter]);

  const counts = useMemo(() => ({
    pending: appeals.filter((a) => a.status === "pending").length,
    confirmed: appeals.filter((a) => a.status === "confirmed").length,
    accepted: appeals.filter((a) => a.status === "accepted").length,
    all: appeals.length,
  }), [appeals]);

  const handleResolve = async (appealId, decision) => {
    setResolving(appealId);
    try {
      await resolveAppeal(appealId, decision, adminNote || "");
      onToast && onToast(
        decision === "accepted"
          ? "Ricorso accolto, sospensione annullata"
          : "Sospensione confermata",
        decision === "accepted" ? "success" : "info"
      );
      setAdminNote("");
      setExpanded(null);
      refresh();
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore: " + e.message, "danger");
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "pending", label: "In attesa", color: "amber" },
          { key: "confirmed", label: "Confermati", color: "red" },
          { key: "accepted", label: "Accolti", color: "emerald" },
          { key: "all", label: "Tutti", color: "slate" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
              filter === f.key
                ? "bg-accent/10 border-accent/40 text-accent"
                : "bg-bg-surface/50 border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                filter === f.key
                  ? "bg-accent/20 text-accent"
                  : "bg-bg-elevated text-text-muted"
              }`}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
        <button
          onClick={refresh}
          className="ml-auto px-3 py-2 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-border-strong text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aggiorna
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-bg-surface border border-border rounded-xl">
          <EmptyIcon icon={MailIcon} className="mb-3" />
          <p className="text-text-secondary font-semibold">
            Nessun ricorso {filter === "pending" ? "in attesa" : filter !== "all" ? `«${filter}»` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <AppealCard
              key={a.id}
              appeal={a}
              expanded={expanded === a.id}
              onToggle={() => {
                setExpanded(expanded === a.id ? null : a.id);
                setAdminNote("");
              }}
              adminNote={adminNote}
              setAdminNote={setAdminNote}
              resolving={resolving === a.id}
              onAccept={() => handleResolve(a.id, "accepted")}
              onConfirm={() => handleResolve(a.id, "confirmed")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AppealCard({
  appeal: a,
  expanded,
  onToggle,
  adminNote,
  setAdminNote,
  resolving,
  onAccept,
  onConfirm,
}) {
  const statusMeta = {
    pending:   { label: "In attesa", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
    confirmed: { label: "Confermato", color: "text-red-400 bg-red-500/15 border-red-500/30" },
    accepted:  { label: "Accolto",   color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  };
  const meta = statusMeta[a.status] || statusMeta.pending;
  const createdAt = a.createdAt?.toDate?.()?.toLocaleString("it-IT") || "—";
  const resolvedAt = a.resolvedAt?.toDate?.()?.toLocaleString("it-IT");
  const startAt = a.suspensionStartAt?.toDate?.()?.toLocaleString("it-IT");
  const endAt = a.suspensionEndAt?.toDate?.()?.toLocaleString("it-IT");

  return (
    <div className="bg-bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header (clickable) */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center gap-4 hover:bg-bg-elevated/40 transition"
      >
        <div className="shrink-0">
          {a.userPhotoURL ? (
            <img
              src={a.userPhotoURL}
              alt={a.userDisplayName}
              className="w-11 h-11 rounded-full object-cover border border-border"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-xs font-black text-text-inverse">
              {(a.userDisplayName || "?").slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold text-text-primary">
              {a.userDisplayName}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              {suspensionDurationLabel(a.banCount)} · violazione n° {a.banCount}
            </span>
          </div>
          <div className="text-xs text-text-muted truncate">{a.userEmail}</div>
          <div className="text-[10px] text-text-muted mt-1">Inviato: {createdAt}</div>
        </div>
        <svg
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-4 bg-bg-base/40">
          {/* Info violazione */}
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <InfoRow label="Motivo" value={a.violationReason} />
            <InfoRow label="Tipo" value={a.violationType === "blasphemy" ? "Bestemmia" : "Insulto / slur"} />
            <InfoRow label="Inizio sospensione" value={startAt} />
            <InfoRow label="Fine sospensione" value={endAt} />
          </div>

          {/* Messaggi segnalati */}
          {Array.isArray(a.flaggedMessages) && a.flaggedMessages.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-2">
                Messaggi segnalati
              </div>
              <div className="space-y-1.5">
                {a.flaggedMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm border rounded-lg px-3 py-2 ${
                      i === a.flaggedMessages.length - 1
                        ? "bg-red-500/10 border-red-500/30 text-red-300"
                        : "bg-bg-elevated border-border text-text-secondary"
                    }`}
                  >
                    <span className="italic">"{m.text}"</span>
                    {i === a.flaggedMessages.length - 1 && (
                      <span className="ml-2 text-[9px] uppercase tracking-wider font-bold">
                        ← violazione
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messaggio del ricorso dell'utente */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-2">
              Motivazione dell'utente
            </div>
            <div className="p-4 rounded-lg bg-bg-surface border border-border text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {a.userMessage || "(nessuna motivazione fornita)"}
            </div>
          </div>

          {/* Nota admin precedente (se già risolto) */}
          {a.status !== "pending" && a.adminNote && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-2">
                Nota dell'admin
              </div>
              <div className="p-3 rounded-lg bg-bg-elevated border border-border text-sm text-text-secondary italic">
                {a.adminNote}
              </div>
              {resolvedAt && (
                <div className="mt-1 text-[10px] text-text-muted">Risolto: {resolvedAt}</div>
              )}
            </div>
          )}

          {/* Azioni — solo per pending */}
          {a.status === "pending" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-2 block">
                  Nota (opzionale) — visibile all'utente
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Es. 'Ho letto la tua motivazione, hai ragione, mi scuso per il falso positivo.'"
                  className="adminInput resize-none text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onAccept}
                  disabled={resolving}
                  className="px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {resolving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "✓"
                  )}
                  Accogli ricorso (annulla sospensione)
                </button>
                <button
                  onClick={onConfirm}
                  disabled={resolving}
                  className="px-5 py-2.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {resolving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "✕"
                  )}
                  Conferma sospensione
                </button>
              </div>
              <p className="text-[10px] text-text-muted">
                Accogliendo il ricorso, il contatore violazioni viene decrementato e la sospensione viene annullata immediatamente.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-bg-elevated border border-border">
      <div className="text-[9px] uppercase tracking-[0.22em] font-bold text-text-muted mb-1">
        {label}
      </div>
      <div className="text-text-primary font-semibold">{value || "—"}</div>
    </div>
  );
}
