/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminMatchesTab.jsx
   Tab "Partite" del pannello Admin (#16).
   - Aggiunta/modifica/eliminazione partite
   - Finalizzazione risultato → assegna i punti ai pronostici (#25)
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MatchEventIcon } from "../../components/MatchEventIcon";
import {
  subscribeMatches,
  createMatch,
  updateMatch,
  deleteMatch,
  finalizeMatch,
  saveMatchEvents,
  setMatchLock,
  setLiveState,
  clearLiveState,
  scoreFromEvents,
  EVENT_TYPES,
  COMPETITIONS,
} from "../../utils/matches";
import { clearAllPredictions, clearLeaderboard } from "../../utils/predictions";
import { logoForTeam, SERIE_A_TEAMS_2026_27 } from "../../utils/teamLogos";
import { uploadImageToCloudinary } from "../../utils/imageUpload";
import { CalendarIcon, EmptyIcon } from "../../components/icons";
import AdminButton from "../../components/admin/AdminButton";

function CrestPreview({ name, logo }) {
  const src = logo || logoForTeam(name);
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-7 h-7 object-contain rounded-full bg-bg-elevated p-0.5"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="w-7 h-7 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[9px] font-black text-text-muted">
          {name.slice(0, 3).toUpperCase()}
        </span>
      )}
      <span className="truncate max-w-[140px]">{name}</span>
      {!src && <span className="text-text-muted">(logo: aggiungi URL)</span>}
    </span>
  );
}

/**
 * Selettore squadra:
 * - chip rapide con le 20 squadre Serie A 2026/27
 * - input testuale libero (per amichevoli o altre squadre)
 * - upload immagine dal PC (PNG/JPG/SVG/WEBP) → Cloudinary
 * - input URL logo opzionale (es. da Wikipedia)
 */
function TeamPicker({ label, name, logo, onChange }) {
  const fileRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState("");
  const [progress, setProgress] = React.useState(0);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset così se ricarico lo stesso file scatta onChange
    if (!f) return;
    setUploading(true);
    setUploadError("");
    setProgress(0);
    try {
      const res = await uploadImageToCloudinary(f, setProgress);
      onChange({ logo: res.url });
    } catch (err) {
      setUploadError(err.message || "Upload fallito");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
        {label}
      </label>
      <input
        value={name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="adminInput"
        placeholder="es. Lazio, Inter, Pro Vercelli…"
      />

      {/* Quick-pick Serie A 2026/27 */}
      <div className="mt-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-bold mb-1.5">
          Serie A 2026/27 · click per selezionare
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SERIE_A_TEAMS_2026_27.map((t) => {
            const active = name === t;
            const teamLogo = logoForTeam(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ name: t, logo: "" })}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition ${
                  active
                    ? "bg-accent/15 border-accent/50 text-accent"
                    : "bg-bg-elevated border-border text-text-secondary hover:text-text-primary hover:border-accent/30"
                }`}
              >
                {teamLogo && (
                  <img
                    src={teamLogo}
                    alt=""
                    className="w-4 h-4 object-contain"
                    referrerPolicy="no-referrer"
                  />
                )}
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Logo personalizzato: upload da PC */}
      <div className="mt-3 p-3 rounded-lg border border-border bg-bg-base/40 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-bold">
          Logo personalizzato (per squadre fuori lista)
        </div>

        {/* Upload da PC */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/15 border border-accent/40 text-accent text-xs font-bold hover:bg-accent/25 transition disabled:opacity-50"
          >
            {uploading ? (
              <>
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Caricamento… {progress}%
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5v12.75" />
                </svg>
                Carica da PC (PNG, JPG, SVG, WEBP)
              </>
            )}
          </button>
          {logo && !uploading && (
            <button
              type="button"
              onClick={() => onChange({ logo: "" })}
              className="text-[11px] text-text-muted hover:text-error transition"
            >
              ✕ rimuovi logo
            </button>
          )}
        </div>

        {uploadError && (
          <div className="text-[11px] text-error font-semibold">{uploadError}</div>
        )}

        {logo && (
          <div className="text-[10px] text-success font-semibold truncate">
            ✓ Logo caricato
          </div>
        )}
      </div>
    </div>
  );
}

function toLocalInput(ts) {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  homeTeam: "Lazio",
  awayTeam: "",
  competition: "Serie A",
  matchday: "",
  kickoff: "",
  homeLogo: "",
  awayLogo: "",
};

export default function AdminMatchesTab({ onToast }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [resultMatch, setResultMatch] = useState(null);
  const [busy, setBusy] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const unsub = subscribeMatches(
      (list) => {
        setMatches(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createMatch(form);
      setForm(EMPTY_FORM);
      onToast && onToast("Partita aggiunta", "success");
    } catch (err) {
      onToast && onToast(err.message || "Errore aggiunta partita", "danger");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditData({
      homeTeam: m.homeTeam || "",
      awayTeam: m.awayTeam || "",
      competition: m.competition || "Serie A",
      matchday: m.matchday ?? "",
      kickoff: toLocalInput(m.kickoff),
      homeLogo: m.homeLogo || "",
      awayLogo: m.awayLogo || "",
      status: m.status || "scheduled",
    });
  };

  const saveEdit = async (id) => {
    setBusy(id);
    try {
      await updateMatch(id, editData);
      setEditingId(null);
      onToast && onToast("Partita aggiornata", "success");
    } catch (err) {
      onToast && onToast(err.message || "Errore aggiornamento", "danger");
    } finally {
      setBusy(null);
    }
  };

  const handleClearPredictions = async () => {
    setClearing(true);
    try {
      // Azzera DAVVERO la classifica generale: pronostici + punti quiz
      const res = await clearLeaderboard();
      setConfirmClear(false);
      onToast &&
        onToast(
          `Classifica azzerata · ${res.predictionsDeleted} pronostici, quiz di ${res.usersReset} utenti`,
          "danger"
        );
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore azzeramento classifica", "danger");
    } finally {
      setClearing(false);
    }
  };

  const doDelete = async (id) => {
    setBusy(id);
    try {
      await deleteMatch(id);
      setDeleteConfirm(null);
      onToast && onToast("Partita eliminata", "danger");
    } catch {
      onToast && onToast("Errore eliminazione", "danger");
    } finally {
      setBusy(null);
    }
  };

  /* Attrezzo da collaudo: scrive valori finti per vedere come appare una
     diretta. Serve PRIMA che la partita cominci.

     ⚠️ Su una partita già iniziata era un disastro: sovrascriveva minuto
     e punteggio veri con 2° tempo, 67', 1-0 fissi. È quello che i tifosi
     hanno visto durante Lazio-Genoa del 30/08/2026, mentre si giocava il
     primo tempo. Da qui il blocco: dal fischio d'inizio in poi comanda
     il servizio automatico, non la simulazione. */
  const toggleSimLive = async (m) => {
    const iniziata = m.kickoff ? new Date(m.kickoff).getTime() <= Date.now() : false;
    if (!m.live && iniziata) {
      onToast &&
        onToast(
          "Partita già iniziata: la simulazione sovrascriverebbe i dati veri",
          "danger"
        );
      return;
    }
    setBusy(m.id);
    try {
      if (m.live) {
        await clearLiveState(m.id);
        onToast && onToast("Live spento", "success");
      } else {
        await setLiveState(m.id, { status: "2H", minute: 67, home: 1, away: 0 });
        onToast && onToast("Live simulato: 2° tempo, 67' (1-0)", "success");
      }
    } catch {
      onToast && onToast("Errore stato live", "danger");
    } finally {
      setBusy(null);
    }
  };

  const toggleLock = async (m) => {
    setBusy(m.id);
    try {
      await setMatchLock(m.id, !m.lockedByAdmin);
      onToast &&
        onToast(
          !m.lockedByAdmin
            ? "Partita bloccata: l'auto-sync non la modificherà"
            : "Partita sbloccata: torna gestita dall'auto-sync",
          "success"
        );
    } catch {
      onToast && onToast("Errore aggiornamento blocco", "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Form aggiunta ── */}
      <form onSubmit={handleCreate} className="bg-bg-surface rounded-2xl border border-border p-6 space-y-5">
        <h3 className="text-xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
          Aggiungi partita
        </h3>
        <div className="grid lg:grid-cols-2 gap-5">
          <TeamPicker
            label="Squadra casa *"
            name={form.homeTeam}
            logo={form.homeLogo}
            onChange={(patch) => {
              if (patch.name !== undefined) setF("homeTeam", patch.name);
              if (patch.logo !== undefined) setF("homeLogo", patch.logo);
            }}
          />
          <TeamPicker
            label="Squadra trasferta *"
            name={form.awayTeam}
            logo={form.awayLogo}
            onChange={(patch) => {
              if (patch.name !== undefined) setF("awayTeam", patch.name);
              if (patch.logo !== undefined) setF("awayLogo", patch.logo);
            }}
          />
        </div>
        {(form.homeTeam || form.awayTeam) && (
          <div className="flex items-center gap-4 flex-wrap p-3 rounded-lg bg-bg-elevated/60 border border-border">
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-bold">
              Anteprima
            </span>
            <CrestPreview name={form.homeTeam} logo={form.homeLogo} />
            {form.homeTeam && form.awayTeam && <span className="text-text-muted text-xs">vs</span>}
            <CrestPreview name={form.awayTeam} logo={form.awayLogo} />
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">Competizione</label>
            <select value={form.competition} onChange={(e) => setF("competition", e.target.value)} className="adminInput">
              {COMPETITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">Giornata</label>
            <input type="number" min="1" value={form.matchday} onChange={(e) => setF("matchday", e.target.value)} className="adminInput" placeholder="es. 36" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">Data e ora *</label>
            <input type="datetime-local" value={form.kickoff} onChange={(e) => setF("kickoff", e.target.value)} className="adminInput" />
          </div>
        </div>
        <AdminButton type="submit" variant="accent" icon="plus" disabled={creating}>
          {creating ? "Aggiunta..." : "Aggiungi partita"}
        </AdminButton>
      </form>

      {/* ── Azzera classifica generale ── */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-surface px-4 py-3">
        <div className="text-xs text-text-secondary min-w-0">
          <span className="font-semibold text-text-primary">Azzera classifica generale</span> —
          cancella tutti i pronostici E azzera i punti quiz di ogni utente.
        </div>
        {confirmClear ? (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleClearPredictions}
              disabled={clearing}
              className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
            >
              {clearing ? "..." : "Conferma azzeramento totale"}
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1.5 text-xs font-bold border border-border text-text-secondary rounded-md hover:bg-bg-elevated"
            >
              Annulla
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="px-3 py-1.5 text-xs font-bold border border-red-500/40 text-red-400 rounded-md hover:bg-red-500/10 shrink-0"
          >
            Azzera classifica
          </button>
        )}
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 bg-bg-surface border border-border rounded-xl">
          <EmptyIcon icon={CalendarIcon} className="mb-3" />
          <p className="text-text-secondary font-semibold">Nessuna partita in calendario</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => {
            const kickoff = m.kickoff?.toDate?.();
            const editing = editingId === m.id;
            return (
              <div key={m.id} className="bg-bg-surface rounded-xl border border-border overflow-hidden">
                {editing ? (
                  <div className="p-4 space-y-4">
                    <div className="grid lg:grid-cols-2 gap-4">
                      <TeamPicker
                        label="Squadra casa"
                        name={editData.homeTeam}
                        logo={editData.homeLogo}
                        onChange={(patch) =>
                          setEditData((p) => ({
                            ...p,
                            ...(patch.name !== undefined && { homeTeam: patch.name }),
                            ...(patch.logo !== undefined && { homeLogo: patch.logo }),
                          }))
                        }
                      />
                      <TeamPicker
                        label="Squadra trasferta"
                        name={editData.awayTeam}
                        logo={editData.awayLogo}
                        onChange={(patch) =>
                          setEditData((p) => ({
                            ...p,
                            ...(patch.name !== undefined && { awayTeam: patch.name }),
                            ...(patch.logo !== undefined && { awayLogo: patch.logo }),
                          }))
                        }
                      />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <select value={editData.competition} onChange={(e) => setEditData({ ...editData, competition: e.target.value })} className="adminInput">
                        {COMPETITIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input type="number" min="1" value={editData.matchday} onChange={(e) => setEditData({ ...editData, matchday: e.target.value })} className="adminInput" placeholder="Giornata" />
                      <input type="datetime-local" value={editData.kickoff} onChange={(e) => setEditData({ ...editData, kickoff: e.target.value })} className="adminInput" />
                    </div>
                    <div className="flex gap-2">
                      <AdminButton onClick={() => saveEdit(m.id)} disabled={busy === m.id} variant="save" icon="check">Salva</AdminButton>
                      <AdminButton onClick={() => setEditingId(null)} variant="ghost" icon="x">Annulla</AdminButton>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-2 py-0.5 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider rounded">
                        {m.competition}{m.matchday != null ? ` · ${m.matchday}ª` : ""}
                      </span>
                      <span className="text-[11px] text-text-muted tabular-nums">
                        {kickoff
                          ? m.timeConfirmed === false
                            ? `${kickoff.toLocaleDateString("it-IT")} · orario da definire`
                            : kickoff.toLocaleString("it-IT")
                          : "—"}
                      </span>
                      {m.source === "football-data" && (
                        <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase tracking-wider rounded inline-flex items-center gap-1" title="Caricata e aggiornata automaticamente da football-data.org">
                          🔄 auto
                        </span>
                      )}
                      {m.lockedByAdmin && (
                        <span className="px-2 py-0.5 bg-warning/15 text-warning text-[10px] font-bold uppercase tracking-wider rounded" title="L'auto-sync non modificherà questa partita">
                          🔒 bloccata
                        </span>
                      )}
                      {m.postponed && (
                        <span className="px-2 py-0.5 bg-error/10 text-error text-[10px] font-bold uppercase tracking-wider rounded">Rinviata</span>
                      )}
                      {m.status === "finished" && (
                        <span className="px-2 py-0.5 bg-success/15 text-success text-[10px] font-bold uppercase tracking-wider rounded">Finita</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-sm font-bold text-text-primary">{m.homeTeam}</span>
                      <span className="text-lg font-black tabular-nums text-text-primary">
                        {m.homeScore != null ? `${m.homeScore} : ${m.awayScore}` : "vs"}
                      </span>
                      <span className="text-sm font-bold text-text-primary">{m.awayTeam}</span>
                    </div>

                    {/* Azioni */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setResultMatch(m)}
                        className="px-3 py-1.5 text-xs font-bold border border-success/40 text-success rounded-md hover:bg-success/10 transition"
                      >
                        {m.status === "finished" ? "Modifica risultato" : "Inserisci risultato"}
                      </button>
                      <button onClick={() => startEdit(m)} className="px-3 py-1.5 text-xs font-bold border border-accent/40 text-accent rounded-md hover:bg-accent/10 transition">
                        Modifica
                      </button>
                      {(m.source === "football-data" || m.externalId) && (
                        <button
                          onClick={() => toggleLock(m)}
                          disabled={busy === m.id}
                          title={
                            m.lockedByAdmin
                              ? "Sblocca: torna gestita dall'auto-sync"
                              : "Blocca: l'auto-sync non modificherà data/ora di questa partita"
                          }
                          className={`px-3 py-1.5 text-xs font-bold border rounded-md transition disabled:opacity-50 ${
                            m.lockedByAdmin
                              ? "border-warning/40 text-warning hover:bg-warning/10"
                              : "border-border text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                          }`}
                        >
                          {m.lockedByAdmin ? "🔓 Sblocca da sync" : "🔒 Blocca da sync"}
                        </button>
                      )}
                      <button
                        onClick={() => toggleSimLive(m)}
                        disabled={busy === m.id}
                        title="Test: imposta/azzera lo stato LIVE per provare il ticker sul calendario"
                        className={`px-3 py-1.5 text-xs font-bold border rounded-md transition disabled:opacity-50 ${
                          m.live
                            ? "border-error/50 text-error hover:bg-error/10"
                            : "border-border text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                        }`}
                      >
                        {m.live ? "⏹ Ferma live" : "🔴 Simula live"}
                      </button>
                      {deleteConfirm === m.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button onClick={() => doDelete(m.id)} disabled={busy === m.id} className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50">Conferma</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-xs font-bold border border-border text-text-secondary rounded-md hover:bg-bg-elevated">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(m.id)} className="px-3 py-1.5 text-xs font-bold border border-red-500/40 text-red-400 rounded-md hover:bg-red-500/10 transition">
                          Elimina
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {resultMatch && (
        <ResultEditor
          match={resultMatch}
          onClose={() => setResultMatch(null)}
          onSaved={onToast}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   RESULT EDITOR — punteggio + tabellino (marcatori/cartellini/infortuni)
   ════════════════════════════════════════════════════════════════ */
const RE_INPUT =
  "px-3 py-2 bg-bg-elevated border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition";

function ScoreStepper({ label, value, onChange }) {
  const v = Number(value) || 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted max-w-[110px] truncate">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, v - 1))} className="w-8 h-8 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition">
          −
        </button>
        <span className="w-10 text-center text-3xl font-black tabular-nums text-text-primary">{v}</span>
        <button type="button" onClick={() => onChange(v + 1)} className="w-8 h-8 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition">
          +
        </button>
      </div>
    </div>
  );
}

function EventRow({ ev, match, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap rounded-lg border border-border bg-bg-base/40 p-2">
      <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-bold shrink-0">
        <button
          type="button"
          onClick={() => onChange({ team: "home" })}
          className={`px-2 py-1.5 max-w-[90px] truncate ${ev.team === "home" ? "bg-accent text-text-inverse" : "bg-bg-elevated text-text-secondary hover:text-text-primary"}`}
        >
          {match.homeTeam}
        </button>
        <button
          type="button"
          onClick={() => onChange({ team: "away" })}
          className={`px-2 py-1.5 max-w-[90px] truncate ${ev.team === "away" ? "bg-accent text-text-inverse" : "bg-bg-elevated text-text-secondary hover:text-text-primary"}`}
        >
          {match.awayTeam}
        </button>
      </div>
      {/* Icona colorata del tipo selezionato (il menu nativo non può
          mostrare SVG nelle voci: l'icona la mostriamo qui accanto) */}
      <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md bg-bg-elevated border border-border">
        <MatchEventIcon type={ev.type} className="w-5 h-5" />
      </span>
      <select value={ev.type} onChange={(e) => onChange({ type: e.target.value })} className={`${RE_INPUT} shrink-0`}>
        {EVENT_TYPES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        value={ev.player}
        onChange={(e) => onChange({ player: e.target.value })}
        placeholder="Giocatore"
        className={`${RE_INPUT} flex-1 min-w-[120px]`}
      />
      <input
        type="number"
        min="0"
        max="130"
        value={ev.minute}
        onChange={(e) => onChange({ minute: e.target.value })}
        placeholder="min"
        className={`${RE_INPUT} w-16 text-center shrink-0`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 w-8 h-8 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition"
        aria-label="Rimuovi evento"
      >
        ✕
      </button>
    </div>
  );
}

function ResultEditor({ match, onClose, onSaved }) {
  const [home, setHome] = useState(match.homeScore ?? 0);
  const [away, setAway] = useState(match.awayScore ?? 0);
  const [events, setEvents] = useState(() =>
    (match.events || []).map((e, i) => ({ ...e, _id: `${i}-${Math.random()}` }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confermaChiusura, setConfermaChiusura] = useState(false);

  /* Partita in corso: o il servizio automatico la sta seguendo, o è
     segnata come live. In questo stato l'editor aggiorna il tabellino
     e non tocca lo stato della partita. */
  const inCorso = match.live === true || match.status === "live";

  const addEvent = () =>
    setEvents((p) => [
      ...p,
      { _id: `${Date.now()}-${Math.random()}`, team: "home", type: "goal", player: "", minute: "" },
    ]);
  const updateEvent = (id, patch) =>
    setEvents((p) => p.map((e) => (e._id === id ? { ...e, ...patch } : e)));
  const removeEvent = (id) => setEvents((p) => p.filter((e) => e._id !== id));

  const autoScore = () => {
    const s = scoreFromEvents(events);
    setHome(s.home);
    setAway(s.away);
  };

  /* Salva il tabellino SENZA chiudere la partita.
     ⚠️ Prima questo bottone chiamava sempre finalizeMatch: aggiungere un
     infortunio a partita in corso la dichiarava finita e mandava in
     valutazione i pronostici (Lazio-Genoa, 30/08/2026). Ora, finché la
     gara è in corso, si aggiorna e basta — a chiuderla ci pensa il
     servizio automatico al fischio finale, con i dati veri. */
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (inCorso) {
        await saveMatchEvents(match.id, events.map(({ _id, ...e }) => e));
        onSaved && onSaved("Tabellino aggiornato · la partita resta in corso", "success");
      } else {
        const res = await finalizeMatch(
          match,
          home,
          away,
          events.map(({ _id, ...e }) => e)
        );
        onSaved &&
          onSaved(
            `Risultato salvato · ${res.scored} pronostic${res.scored === 1 ? "o" : "i"} valutat${res.scored === 1 ? "o" : "i"}`,
            "success"
          );
      }
      onClose();
    } catch (e) {
      setError(e.message || "Errore nel salvataggio");
      setBusy(false);
    }
  };

  /* Chiusura manuale, esplicita e solo su richiesta. Serve quando il
     servizio automatico non ce la fa (API muta, partita sospesa). */
  const chiudiOra = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await finalizeMatch(
        match,
        home,
        away,
        events.map(({ _id, ...e }) => e)
      );
      onSaved &&
        onSaved(
          `Partita chiusa · ${res.scored} pronostic${res.scored === 1 ? "o" : "i"} valutat${res.scored === 1 ? "o" : "i"}`,
          "success"
        );
      onClose();
    } catch (e) {
      setError(e.message || "Errore nella chiusura");
      setBusy(false);
      setConfermaChiusura(false);
    }
  };

  // Portal su document.body: il modal esce da qualsiasi contenitore con
  // transform/filter (es. il wrapper .nf-page-enter) che altrimenti
  // intrappolerebbe il position:fixed facendolo finire fuori schermo.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-bg-base/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
              {match.competition}
              {match.matchday != null ? ` · ${match.matchday}ª giornata` : ""}
            </div>
            <h3 className="text-2xl text-text-primary leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {match.homeTeam} <span className="text-text-muted text-lg">vs</span> {match.awayTeam}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-7">
          {/* Punteggio */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-3">
              Risultato finale
            </div>
            <div className="flex items-center justify-center gap-6">
              <ScoreStepper label={match.homeTeam} value={home} onChange={setHome} />
              <span className="text-3xl font-black text-text-muted pt-4">:</span>
              <ScoreStepper label={match.awayTeam} value={away} onChange={setAway} />
            </div>
            <div className="mt-3 text-center">
              <button onClick={autoScore} className="text-xs font-semibold text-accent hover:underline">
                ↻ Calcola dai marcatori
              </button>
            </div>
          </div>

          {/* Tabellino */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">
                Tabellino · marcatori, cartellini, infortuni
              </div>
              <button
                onClick={addEvent}
                className="px-3 py-1.5 rounded-md bg-accent/10 border border-accent/30 text-accent text-xs font-bold hover:bg-accent/20 transition shrink-0"
              >
                + Aggiungi evento
              </button>
            </div>
            {events.length === 0 ? (
              <div className="text-center py-6 rounded-lg border border-dashed border-border text-text-muted text-sm">
                Nessun evento. Aggiungi gol, cartellini o infortuni.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <EventRow
                    key={e._id}
                    ev={e}
                    match={match}
                    onChange={(patch) => updateEvent(e._id, patch)}
                    onRemove={() => removeEvent(e._id)}
                  />
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex flex-col gap-3">
          {inCorso && (
            <p className="text-xs text-text-secondary leading-relaxed">
              <span className="font-bold text-accent">Partita in corso.</span>{" "}
              Il salvataggio aggiorna il tabellino e basta: il risultato e i
              punti restano in mano al servizio automatico, che chiude la
              partita al fischio finale.
            </p>
          )}
          <div className="flex justify-end gap-2 flex-wrap">
            <AdminButton onClick={onClose} disabled={busy} variant="ghost" icon="x">
              Annulla
            </AdminButton>
            {inCorso &&
              (confermaChiusura ? (
                <AdminButton onClick={chiudiOra} disabled={busy} variant="danger" icon="check">
                  Confermi? Chiude e assegna i punti
                </AdminButton>
              ) : (
                <AdminButton
                  onClick={() => setConfermaChiusura(true)}
                  disabled={busy}
                  variant="ghost"
                >
                  Chiudi la partita a mano
                </AdminButton>
              ))}
            <AdminButton onClick={save} disabled={busy} variant="save" icon={busy ? undefined : "check"}>
              {busy && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {inCorso ? "Salva tabellino" : "Salva risultato e assegna punti"}
            </AdminButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
