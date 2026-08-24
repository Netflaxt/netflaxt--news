/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminUsersTab.jsx
   Tab "Utenti" del pannello Admin.
   Mostra la lista di tutti gli utenti registrati con info di
   moderazione (banCount, sospeso/disabilitato), data iscrizione,
   ultimo accesso. Permette ricerca e azioni rapide.

   Sorgente dati: collection Firestore `users/{uid}`
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
} from "firebase/firestore";
import { suspensionDurationLabel } from "../../utils/moderationService";

export default function AdminUsersTab({ onToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all"); // all | suspended | disabled | clean
  const [actionLoading, setActionLoading] = useState(null);
  const [expanded, setExpanded] = useState(null);

  // ✨ REAL-TIME: utenti aggiornati istantaneamente quando si registra,
  // elimina account o cambia banCount/suspendedUntil. Stop al "refresh"
  // manuale: lo state è sempre live.
  const refresh = () => {}; // kept for legacy callers (azioni admin)
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc")),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      async (err) => {
        console.warn(
          "Listener ordinato fallito (forse manca createdAt), provo senza ordering:",
          err
        );
        // Fallback senza ordering
        try {
          const snap = await getDocs(collection(db, "users"));
          setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e2) {
          console.error("Errore caricamento utenti:", e2);
          onToast && onToast("Errore caricamento utenti", "danger");
        } finally {
          setLoading(false);
        }
      }
    );
    /* Gli indirizzi email non stanno più nel profilo (era pubblico:
       chiunque poteva scaricarseli). Vivono in una collection che solo
       l'amministratore può leggere, e qui vengono riaccostati al
       rispettivo profilo per la ricerca e l'elenco. */
    const unsubContatti = onSnapshot(
      collection(db, "contattiUtenti"),
      (snap) => {
        const perUid = {};
        snap.docs.forEach((d) => {
          perUid[d.id] = d.data()?.email || null;
        });
        setUsers((elenco) =>
          elenco.map((u) => (perUid[u.id] ? { ...u, email: perUid[u.id] } : u))
        );
      },
      (e) => console.warn("Contatti utenti non leggibili:", e?.message)
    );

    /* Anche lo stato di moderazione è uscito dal profilo pubblico:
       motivo della sanzione, numero di ban e messaggi segnalati erano
       leggibili da chiunque. Qui vengono riaccostati al profilo, così
       l'elenco e i filtri continuano a funzionare come prima. */
    const unsubModerazione = onSnapshot(
      collection(db, "moderazione"),
      (snap) => {
        const perUid = {};
        snap.docs.forEach((d) => {
          perUid[d.id] = d.data() || {};
        });
        setUsers((elenco) =>
          elenco.map((u) => (perUid[u.id] ? { ...u, ...perUid[u.id] } : u))
        );
      },
      (e) => console.warn("Stato moderazione non leggibile:", e?.message)
    );

    return () => {
      unsub();
      unsubContatti();
      unsubModerazione();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Statistiche utenti ─── */
  const stats = useMemo(() => {
    const now = Date.now();
    const suspended = users.filter(
      (u) => u.suspendedUntil?.toDate?.()?.getTime() > now
    ).length;
    const disabled = users.filter((u) => u.accountDisabled).length;
    const withViolations = users.filter((u) => (u.banCount || 0) > 0).length;
    return {
      total: users.length,
      suspended,
      disabled,
      clean: users.length - withViolations,
    };
  }, [users]);

  /* ─── Filtro + ricerca ─── */
  const filtered = useMemo(() => {
    const now = Date.now();
    let list = users;

    if (filter === "suspended") {
      list = list.filter((u) => u.suspendedUntil?.toDate?.()?.getTime() > now);
    } else if (filter === "disabled") {
      list = list.filter((u) => u.accountDisabled);
    } else if (filter === "clean") {
      list = list.filter((u) => !(u.banCount > 0) && !u.accountDisabled);
    }

    const s = searchTerm.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (u) =>
          (u.displayName || "").toLowerCase().includes(s) ||
          (u.email || "").toLowerCase().includes(s)
      );
    }

    return list;
  }, [users, filter, searchTerm]);

  /* ─── Azioni admin ─── */
  const handleResetViolations = async (uid) => {
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, "users", uid), {
        banCount: 0,
        suspendedUntil: null,
        suspensionStartAt: null,
        suspensionReason: "",
        suspensionViolationType: null,
        flaggedMessages: [],
        accountDisabled: false,
        accountDisabledAt: null,
      });
      onToast && onToast("Violazioni resettate", "success");
      refresh();
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore reset violazioni", "danger");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleDisable = async (uid, currentlyDisabled) => {
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, "users", uid), {
        accountDisabled: !currentlyDisabled,
        accountDisabledAt: !currentlyDisabled ? new Date() : null,
      });
      onToast &&
        onToast(
          !currentlyDisabled ? "Account disattivato" : "Account riabilitato",
          !currentlyDisabled ? "danger" : "success"
        );
      refresh();
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore aggiornamento account", "danger");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ─── Statistiche ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <UserStat label="Totali" value={stats.total} color="accent" />
        <UserStat label="Senza violazioni" value={stats.clean} color="success" />
        <UserStat label="Sospesi" value={stats.suspended} color="warning" />
        <UserStat label="Disabilitati" value={stats.disabled} color="error" />
      </div>

      {/* ─── Filtri ─── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "Tutti" },
          { key: "clean", label: "Senza violazioni" },
          { key: "suspended", label: "Sospesi" },
          { key: "disabled", label: "Disabilitati" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
              filter === f.key
                ? "bg-accent/10 border-accent/40 text-accent"
                : "bg-bg-surface/50 border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={refresh}
          className="ml-auto px-3 py-2 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-border-strong text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Aggiorna
        </button>
      </div>

      {/* ─── Ricerca ─── */}
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
          placeholder="Cerca per nome o email..."
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

      {/* ─── Conteggio risultati ─── */}
      <div className="text-xs text-text-muted px-1">
        <span className="text-text-primary font-semibold tabular-nums">
          {filtered.length}
        </span>{" "}
        {filtered.length === 1 ? "utente" : "utenti"}
        {searchTerm && (
          <span>
            {" "}
            · filtro:{" "}
            <span className="text-accent font-medium">"{searchTerm}"</span>
          </span>
        )}
      </div>

      {/* ─── Lista ─── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-bg-surface border border-border rounded-xl">
          <div className="text-4xl mb-3 opacity-60">👥</div>
          <p className="text-text-secondary font-semibold">
            {searchTerm
              ? "Nessun utente trovato"
              : "Nessun utente in questa categoria"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              expanded={expanded === u.id}
              onToggle={() =>
                setExpanded(expanded === u.id ? null : u.id)
              }
              actionLoading={actionLoading === u.id}
              onResetViolations={() => handleResetViolations(u.id)}
              onToggleDisable={() =>
                handleToggleDisable(u.id, u.accountDisabled)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   USER ROW
   ════════════════════════════════════════════════════ */
function UserRow({
  user: u,
  expanded,
  onToggle,
  actionLoading,
  onResetViolations,
  onToggleDisable,
}) {
  const now = Date.now();
  const suspendedUntil = u.suspendedUntil?.toDate?.();
  const isSuspended = suspendedUntil && suspendedUntil.getTime() > now;
  const isDisabled = !!u.accountDisabled;
  const banCount = u.banCount || 0;
  const createdAt = u.createdAt?.toDate?.()?.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const lastSeen = u.lastSeenAt?.toDate?.();
  const lastSeenLabel = lastSeen ? formatRelative(lastSeen) : "—";

  let badge;
  if (isDisabled) {
    badge = {
      label: "Disabilitato",
      color: "bg-red-500/15 border-red-500/40 text-red-400",
    };
  } else if (isSuspended) {
    badge = {
      label: "Sospeso",
      color: "bg-warning/15 border-warning/40 text-warning",
    };
  } else if (banCount > 0) {
    badge = {
      label: `${banCount} violazion${banCount === 1 ? "e" : "i"}`,
      color: "bg-warning/10 border-warning/30 text-warning",
    };
  } else {
    badge = {
      label: "Regolare",
      color: "bg-success/10 border-success/30 text-success",
    };
  }

  return (
    <div className="bg-bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center gap-4 hover:bg-bg-elevated/40 transition"
      >
        {/* Avatar */}
        <div className="shrink-0">
          {u.photoURL ? (
            <img
              src={u.photoURL}
              alt={u.displayName}
              className="w-11 h-11 rounded-full object-cover border border-border bg-bg-elevated"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-xs font-black text-text-inverse">
              {(u.displayName || u.email || "?").slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-bold text-text-primary truncate">
              {u.displayName || "(senza nome)"}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${badge.color}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="text-xs text-text-muted truncate">{u.email || "—"}</div>
        </div>

        {/* Right meta */}
        <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
            Iscritto
          </div>
          <div className="text-xs font-semibold text-text-secondary tabular-nums">
            {createdAt || "—"}
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border p-5 bg-bg-base/40 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <InfoCell label="UID" value={u.id} mono />
            <InfoCell label="Iscritto" value={createdAt || "—"} />
            <InfoCell label="Ultimo accesso" value={lastSeenLabel} />
            <InfoCell
              label="Violazioni"
              value={
                <span
                  className={banCount > 0 ? "text-warning" : "text-success"}
                >
                  {banCount} / 4
                </span>
              }
            />
          </div>

          {isSuspended && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-warning mb-1">
                Sospensione attiva ({suspensionDurationLabel(banCount)})
              </div>
              <div className="text-sm text-text-primary">
                Fine sospensione:{" "}
                <span className="font-bold tabular-nums">
                  {suspendedUntil.toLocaleString("it-IT")}
                </span>
              </div>
              {u.suspensionReason && (
                <div className="text-xs text-text-secondary mt-1 italic">
                  Motivo: {u.suspensionReason}
                </div>
              )}
            </div>
          )}

          {isDisabled && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/40">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-red-400 mb-1">
                Account disabilitato definitivamente
              </div>
              <div className="text-xs text-text-secondary">
                {u.suspensionReason || "4ª violazione"}
              </div>
            </div>
          )}

          {/* Azioni */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {(banCount > 0 || isSuspended || isDisabled) && (
              <button
                onClick={onResetViolations}
                disabled={actionLoading}
                className="px-4 py-2 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-bold transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  "✓"
                )}
                Resetta violazioni
              </button>
            )}
            <button
              onClick={onToggleDisable}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-md text-sm font-bold border transition disabled:opacity-50 inline-flex items-center gap-2 ${
                isDisabled
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-red-500/10 hover:bg-red-500/20 border-red-500/40 text-red-400"
              }`}
            >
              {actionLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isDisabled ? (
                "✓"
              ) : (
                "✕"
              )}
              {isDisabled ? "Riabilita account" : "Disabilita account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════ */
function UserStat({ label, value, color = "accent" }) {
  const colorMap = {
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    error: "text-red-400",
  };
  return (
    <div className="p-4 rounded-xl bg-bg-surface border border-border">
      <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-semibold">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tabular-nums leading-none ${colorMap[color]}`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoCell({ label, value, mono = false }) {
  return (
    <div className="p-3 rounded-lg bg-bg-elevated border border-border">
      <div className="text-[9px] uppercase tracking-[0.22em] font-bold text-text-muted mb-1">
        {label}
      </div>
      <div
        className={`text-text-primary font-semibold text-sm truncate ${
          mono ? "font-mono text-[11px]" : ""
        }`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function formatRelative(date) {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 30) return "ora";
  if (min < 1) return `${sec}s fa`;
  if (min < 60) return `${min}m fa`;
  if (hr < 24) return `${hr}h fa`;
  if (day < 7) return `${day}g fa`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
