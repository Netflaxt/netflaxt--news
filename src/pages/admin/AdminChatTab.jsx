/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminChatTab.jsx
   Tab "Chat" del pannello Admin.
   - Lista messaggi LIVE (RTDB)
   - Elimina singolo messaggio
   - Pulisci tutta la chat (con conferma)
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { rtdb, db } from "../../firebase/firebase";
import {
  ref,
  onValue,
  remove,
  query,
  orderByChild,
} from "firebase/database";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { ChatIcon, EmptyIcon } from "../../components/icons";

export default function AdminChatTab({ onToast }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deleting, setDeleting] = useState(null);

  /* ─── Subscription live messaggi (RTDB) ─── */
  useEffect(() => {
    const messagesRef = query(ref(rtdb, "messages"), orderByChild("timestamp"));
    const unsub = onValue(
      messagesRef,
      (snap) => {
        const data = snap.val();
        const list = data
          ? Object.entries(data).map(([id, m]) => ({ id, ...m }))
          : [];
        // Ordinati dal più recente
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setMessages(list);
        setLoading(false);
      },
      (err) => {
        console.error("Errore lettura messaggi:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  /* ─── Filtri ─── */
  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return messages;
    return messages.filter(
      (m) =>
        (m.text || "").toLowerCase().includes(s) ||
        (m.displayName || "").toLowerCase().includes(s) ||
        (m.uid || "").toLowerCase().includes(s)
    );
  }, [messages, searchTerm]);

  /* ─── Statistiche ─── */
  const stats = useMemo(() => {
    const uniqueUsers = new Set(messages.map((m) => m.uid)).size;
    const last24h = messages.filter(
      (m) => Date.now() - (m.timestamp || 0) < 24 * 60 * 60 * 1000
    ).length;
    return {
      total: messages.length,
      users: uniqueUsers,
      last24h,
    };
  }, [messages]);

  /* ─── Azioni ─── */
  const handleDelete = async (msgId) => {
    setDeleting(msgId);
    try {
      await remove(ref(rtdb, `messages/${msgId}`));
      onToast && onToast("Messaggio eliminato", "danger");
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore eliminazione messaggio", "danger");
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    setDeleting("__all__");
    try {
      // 1) Cancella tutti i messaggi (RTDB)
      await remove(ref(rtdb, "messages"));

      // 2) Azzera il contatore chatCount su tutti gli utenti così i
      //    badge "Voce della curva" / "Capo curva" si ri-bloccano
      //    (coerenza: chat vuota → nessun messaggio → badge bloccato).
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const toReset = usersSnap.docs.filter((d) => (d.data().chatCount || 0) > 0);
        // Firestore: max 500 operazioni per batch
        for (let i = 0; i < toReset.length; i += 450) {
          const batch = writeBatch(db);
          toReset.slice(i, i + 450).forEach((d) => {
            batch.update(doc(db, "users", d.id), { chatCount: 0 });
          });
          await batch.commit();
        }
      } catch (e2) {
        console.warn("Reset chatCount fallito:", e2);
      }

      onToast && onToast("Chat svuotata + contatori azzerati", "danger");
      setConfirmClearAll(false);
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore pulizia chat", "danger");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Statistiche + pulisci tutto */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="Messaggi totali" value={stats.total} />
        <StatCard label="Utenti coinvolti" value={stats.users} />
        <StatCard label="Ultime 24h" value={stats.last24h} accent />

        {/* Pulisci tutto */}
        {confirmClearAll ? (
          <div className="p-4 rounded-xl bg-red-500/15 border-2 border-red-500/50 flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-red-400">
              Sei sicuro?
            </div>
            <div className="text-xs text-text-secondary leading-snug">
              Verranno cancellati TUTTI i {stats.total} messaggi. Non recuperabili.
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleClearAll}
                disabled={deleting === "__all__"}
                className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded transition disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                {deleting === "__all__" ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "✕"
                )}
                Conferma
              </button>
              <button
                onClick={() => setConfirmClearAll(false)}
                className="flex-1 px-3 py-2 bg-bg-elevated border border-border text-text-secondary hover:text-text-primary text-xs font-bold rounded transition"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClearAll(true)}
            disabled={stats.total === 0}
            className="p-4 rounded-xl bg-red-500/8 hover:bg-red-500/15 border border-red-500/40 hover:border-red-500/60 flex flex-col items-center justify-center gap-1 transition disabled:opacity-30 disabled:cursor-not-allowed text-red-400"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
              Pulisci tutta la chat
            </span>
          </button>
        )}
      </div>

      {/* Ricerca */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca per testo, autore o uid..."
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

      {/* Conteggio */}
      <div className="text-xs text-text-muted px-1">
        <span className="text-text-primary font-semibold tabular-nums">
          {filtered.length}
        </span>{" "}
        {filtered.length === 1 ? "messaggio" : "messaggi"}
        {searchTerm && (
          <span>
            {" "}
            · filtro: <span className="text-accent font-medium">"{searchTerm}"</span>
          </span>
        )}
        <span className="ml-3 inline-flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
          </span>
          live
        </span>
      </div>

      {/* Lista messaggi */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-bg-surface border border-border rounded-xl">
          <EmptyIcon icon={ChatIcon} className="mb-3" />
          <p className="text-text-secondary font-semibold">
            {searchTerm ? "Nessun messaggio trovato" : "Nessun messaggio in chat"}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {filtered.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              confirmDelete={confirmDeleteId === m.id}
              onAskDelete={() => setConfirmDeleteId(m.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => handleDelete(m.id)}
              deleting={deleting === m.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MESSAGE ROW
   ════════════════════════════════════════════════════ */
function MessageRow({
  message: m,
  confirmDelete,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  deleting,
}) {
  const date = new Date(m.timestamp || Date.now());
  const dateStr = date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasReactions =
    m.reactions && Object.keys(m.reactions || {}).length > 0;
  const reactionCount = hasReactions
    ? Object.values(m.reactions || {}).reduce(
        (sum, users) => sum + Object.keys(users || {}).length,
        0
      )
    : 0;

  return (
    <div className="bg-bg-surface rounded-xl border border-border shadow-sm p-3 flex items-start gap-3 hover:border-border-strong transition">
      {/* Avatar */}
      <div className="shrink-0">
        {m.photoURL ? (
          <img
            src={m.photoURL}
            alt={m.displayName}
            className="w-9 h-9 rounded-full object-cover border border-border bg-bg-elevated"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-[10px] font-black text-text-inverse">
            {(m.displayName || "?").slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-bold text-text-primary truncate">
            {m.displayName || "(senza nome)"}
          </span>
          <span className="text-[10px] text-text-muted tabular-nums">
            {dateStr}
          </span>
          {hasReactions && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-bold">
              ❤ {reactionCount}
            </span>
          )}
        </div>

        {/* Reply preview se è una risposta */}
        {m.replyTo && (
          <div className="mb-1 px-2 py-1 rounded border-l-2 border-accent/40 bg-bg-base/60">
            <div className="text-[9px] uppercase tracking-wider font-bold text-accent">
              ↳ in risposta a {m.replyTo.displayName}
            </div>
            <div className="text-[11px] text-text-muted truncate italic">
              "{m.replyTo.text}"
            </div>
          </div>
        )}

        <div className="text-sm text-text-primary leading-snug break-words">
          {m.text}
        </div>
        <div className="mt-1 text-[10px] font-mono text-text-muted truncate">
          uid: {m.uid}
        </div>
      </div>

      {/* Azioni */}
      <div className="shrink-0">
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onConfirmDelete}
              disabled={deleting}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded transition disabled:opacity-50 inline-flex items-center gap-1"
            >
              {deleting ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Conferma"
              )}
            </button>
            <button
              onClick={onCancelDelete}
              className="px-3 py-1.5 border border-border text-text-secondary hover:text-text-primary text-xs font-bold rounded transition"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={onAskDelete}
            className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition"
            title="Elimina messaggio"
            aria-label="Elimina messaggio"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   STAT CARD
   ════════════════════════════════════════════════════ */
function StatCard({ label, value, accent = false }) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        accent
          ? "bg-accent/10 border-accent/30"
          : "bg-bg-surface border-border"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-semibold">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tabular-nums leading-none ${
          accent ? "text-accent" : "text-text-primary"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
