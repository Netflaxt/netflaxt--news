/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminPushTab.jsx
   Compositore notifica push.
   L'invio effettivo richiede una function/endpoint esterno con la
   service-account key. Per ora il messaggio viene messo in coda
   nella collection `pushQueue` e verrà processato dal backend.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { enqueuePushNotification } from "../../utils/push";

export default function AdminPushTab({ onToast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [qSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, "pushQueue"), orderBy("createdAt", "desc"), limit(20))),
          getDocs(collection(db, "users")),
        ]);
        setQueue(qSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        const subs = usersSnap.docs.reduce((s, d) => {
          const t = d.data()?.pushTokens || [];
          return s + (Array.isArray(t) ? t.length : 0);
        }, 0);
        setSubscribers(subs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const ref = await enqueuePushNotification({ title, body, url, audience });
      onToast?.(
        "Notifica messa in coda. Verrà inviata dal backend.",
        "success"
      );
      setQueue((q) => [
        {
          id: ref.id,
          title,
          body,
          url,
          audience,
          status: "queued",
          createdAt: { toDate: () => new Date() },
        },
        ...q,
      ]);
      setTitle("");
      setBody("");
      setUrl("/");
    } catch (err) {
      onToast?.(err.message || "Errore invio", "danger");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* Compositore */}
      <form
        onSubmit={handleSend}
        className="lg:col-span-7 bg-bg-surface rounded-2xl border border-border shadow-xl overflow-hidden h-fit"
      >
        <div className="p-6 border-b border-border">
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
            Notifica push
          </div>
          <h3 className="mt-1 text-2xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
            Componi notifica
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Verrà mostrata sul telefono/desktop degli utenti che hanno attivato
            le notifiche.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-text-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Iscritti attivi:{" "}
            <span className="text-text-primary font-bold tabular-nums">
              {subscribers}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Titolo *
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 60))}
              maxLength={60}
              placeholder="Es. Sarri lascia ufficialmente la Lazio"
              required
              className="adminInput"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Testo *
            </span>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 180))}
              maxLength={180}
              placeholder="Riassunto breve. Sarà l'unica cosa che vedono in lockscreen."
              required
              className="adminInput resize-none"
            />
            <span className="block text-right text-[10px] text-text-muted mt-1">
              {body.length}/180
            </span>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Link al click
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/news/abc123"
              className="adminInput"
            />
            <span className="block text-[11px] text-text-muted mt-1">
              Path interno (es. /news/abc123) o URL completo.
            </span>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Destinatari
            </span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="adminInput"
            >
              <option value="all">Tutti gli iscritti</option>
              <option value="subscribed-only">Solo chi è attivo da meno di 30gg</option>
            </select>
          </label>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
            <strong className="font-bold">Nota:</strong> l'invio effettivo
            richiede un endpoint serverless con la chiave service-account
            Firebase. Verrà configurato quando il dominio sarà attivo. Per ora
            la notifica viene messa in coda in <code>pushQueue/</code> e
            partirà non appena il backend sarà online.
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 bg-accent text-text-inverse font-bold rounded-md hover:shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)] transition disabled:opacity-50"
          >
            {sending ? "Invio…" : "🔔 Metti in coda invio"}
          </button>
        </div>
      </form>

      {/* Coda */}
      <div className="lg:col-span-5 space-y-3">
        <h3 className="text-xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
          Storico ultimi invii
        </h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : queue.length === 0 ? (
          <div className="p-6 text-center text-text-muted bg-bg-surface border border-border rounded-xl">
            Nessuna notifica inviata.
          </div>
        ) : (
          queue.map((n) => {
            const dt = n.createdAt?.toDate?.()?.toLocaleString("it-IT") || "";
            const status = n.status || "queued";
            const meta = {
              queued: { label: "In coda", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
              sent:   { label: "Inviata", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
              failed: { label: "Errore", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
            }[status] || { label: status, cls: "bg-bg-elevated text-text-secondary border-border" };
            return (
              <div
                key={n.id}
                className="bg-bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border ${meta.cls}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-text-muted">{dt}</span>
                </div>
                <div className="text-sm font-bold text-text-primary truncate">
                  {n.title}
                </div>
                <div className="text-xs text-text-muted line-clamp-2 mt-1">
                  {n.body}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
