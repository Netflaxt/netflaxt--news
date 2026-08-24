/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminDashboardTab.jsx
   Dashboard riassuntiva: utenti, registrazioni 30gg, top articoli
   per reazioni, top commentatori, pronostici, segnalazioni in coda.
   Tutte letture leggere (limit 200, aggregazione client).
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase/firebase";
import {
  collection,
  collectionGroup,
  getDocs,
  onSnapshot,
  query,
  where,
  limit,
} from "firebase/firestore";
import { totalReactions, REACTION_TYPES } from "../../utils/reactions";
import { countPendingReports } from "../../utils/reports";
import { subscribeMatches } from "../../utils/matches";

export default function AdminDashboardTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    users: [],
    articles: [],
    predictions: [],
    polls: [],
    bookmarksCount: 0,
    pendingReports: 0,
    topCommenters: [],
    matches: [],
  });

  // ✨ REAL-TIME: ogni collection (users/articles/predictions/polls) usa
  // un listener onSnapshot. Quando un utente si elimina o si registra,
  // il conteggio si aggiorna istantaneamente senza dover ricaricare.
  useEffect(() => {
    const unsubs = [];

    unsubs.push(
      onSnapshot(
        collection(db, "users"),
        (snap) => {
          setData((p) => ({
            ...p,
            users: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          }));
        },
        (e) => console.error("Errore listener users:", e)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "articles"),
        (snap) => {
          setData((p) => ({
            ...p,
            articles: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          }));
        },
        (e) => console.error("Errore listener articles:", e)
      )
    );

    /* Serve a sapere QUALE partita è la prossima: i pronostici sono
       tanti e riferiti a partite diverse, senza il calendario non si
       potrebbe isolare quelli della gara che sta per giocarsi. */
    unsubs.push(
      subscribeMatches(
        (list) => setData((p) => ({ ...p, matches: list })),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "predictions"),
        (snap) => {
          setData((p) => ({
            ...p,
            predictions: snap.docs.map((d) => d.data()),
          }));
        },
        (e) => console.error("Errore listener predictions:", e)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "polls"),
        (snap) => {
          setData((p) => ({
            ...p,
            polls: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          }));
        },
        (e) => console.error("Errore listener polls:", e)
      )
    );

    /* ⚠️ QUESTA PARTE HA FATTO ESAURIRE LA QUOTA DEL DATABASE.

       Rileggeva fino a 500 commenti OGNI 60 SECONDI. Con il pannello
       admin lasciato aperto sono 30.000 letture all'ora: il limite
       giornaliero del piano gratuito (50.000) finiva in meno di due
       ore, e da quel momento TUTTO il sito smetteva di funzionare —
       partita ferma, email di conferma non spedite, accessi in loop
       (24/08/2026, sera dell'annuncio).

       Ora si legge una volta sola all'apertura. Sono numeri di
       riepilogo: chi li guarda ricarica la pagina se li vuole freschi.
       ⚠️ Non rimettere un intervallo qui. */
    let cancelled = false;
    const loadSlow = async () => {
      try {
        const pending = await countPendingReports();
        let topCommenters = [];
        try {
          const commentsSnap = await getDocs(
            query(collectionGroup(db, "comments"), limit(120))
          );
          const counts = new Map();
          commentsSnap.docs.forEach((d) => {
            const c = d.data();
            if (!c.uid) return;
            const e = counts.get(c.uid) || {
              uid: c.uid,
              displayName: c.displayName || "Tifoso",
              photoURL: c.photoURL || null,
              count: 0,
            };
            e.count += 1;
            if (c.displayName) e.displayName = c.displayName;
            if (c.photoURL) e.photoURL = c.photoURL;
            counts.set(c.uid, e);
          });
          topCommenters = Array.from(counts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        } catch {}
        if (cancelled) return;
        setData((p) => ({ ...p, pendingReports: pending, topCommenters }));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSlow();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u && u());
    };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const usersInLast30 = data.users.filter((u) => {
      const ms = u.createdAt?.toMillis?.() ?? (u.updatedAt?.toMillis?.() || 0);
      return ms >= thirtyDaysAgo;
    });
    const articlesInLast7 = data.articles.filter((a) => {
      const ms = a.date?.toMillis?.() || 0;
      return ms >= sevenDaysAgo;
    });

    /* ─── Pronostici sulla prossima partita ───────────────────
       Stessa scelta della barra in home: se c'è una partita in corso
       vale quella, altrimenti la prima non ancora giocata. Così il
       riquadro parla sempre della gara di cui si sta parlando. */
    const adesso = Date.now();
    const prossima = data.matches
      .filter((m) => {
        const k = m.kickoff?.toMillis?.() ?? 0;
        return m.status !== "finished" && k > adesso;
      })
      .sort((a, b) => (a.kickoff?.toMillis?.() || 0) - (b.kickoff?.toMillis?.() || 0))[0] || null;

    let pronosticiProssima = null;
    if (prossima) {
      const suQuestaPartita = data.predictions.filter((p) => p.matchId === prossima.id);
      const perEsito = { "1": 0, X: 0, "2": 0 };
      const perRisultato = {};
      suQuestaPartita.forEach((p) => {
        if (perEsito[p.outcome] !== undefined) perEsito[p.outcome] += 1;
        const r = `${p.homeScore}-${p.awayScore}`;
        perRisultato[r] = (perRisultato[r] || 0) + 1;
      });
      const piuGettonato = Object.entries(perRisultato).sort((a, b) => b[1] - a[1])[0];
      pronosticiProssima = {
        partita: `${prossima.homeTeam} - ${prossima.awayTeam}`,
        quando: prossima.kickoff?.toDate?.()
          ? prossima.kickoff.toDate().toLocaleString("it-IT", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "data da confermare",
        quanti: suQuestaPartita.length,
        perEsito,
        risultatoPiuGettonato: piuGettonato ? piuGettonato[0] : null,
        quantePerQuelRisultato: piuGettonato ? piuGettonato[1] : 0,
      };
    }

    const evaluatedPreds = data.predictions.filter((p) => p.points != null);
    const exactPreds = evaluatedPreds.filter((p) => p.points === 3).length;
    const correctPreds = evaluatedPreds.filter((p) => p.points === 1).length;
    const totalScored = evaluatedPreds.length;
    const hitRate =
      totalScored > 0
        ? Math.round(((exactPreds + correctPreds) / totalScored) * 100)
        : 0;

    const totalReactionsAll = data.articles.reduce(
      (s, a) => s + totalReactions(a),
      0
    );

    const topArticlesByReactions = [...data.articles]
      .map((a) => ({ ...a, _r: totalReactions(a) }))
      .sort((a, b) => b._r - a._r)
      .slice(0, 5);

    const activePolls = data.polls.filter((p) => p.status === "active");
    const closedPolls = data.polls.filter((p) => p.status === "closed");
    const totalPollVotes = data.polls.reduce(
      (s, p) => s + (Number(p.totalVotes) || 0),
      0
    );

    return {
      usersTotal: data.users.length,
      usersInLast30: usersInLast30.length,
      articlesTotal: data.articles.length,
      articlesInLast7: articlesInLast7.length,
      predictionsTotal: data.predictions.length,
      predictionsEvaluated: totalScored,
      exactPreds,
      correctPreds,
      hitRate,
      pronosticiProssima,
      totalReactionsAll,
      topArticlesByReactions,
      pollsActive: activePolls.length,
      pollsClosed: closedPolls.length,
      totalPollVotes,
      pendingReports: data.pendingReports,
      topCommenters: data.topCommenters,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI principali */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Utenti" value={stats.usersTotal} accent />
        <Kpi
          label="Iscritti 30gg"
          value={stats.usersInLast30}
          delta={stats.usersInLast30 > 0 ? "+" : ""}
        />
        <Kpi label="Articoli" value={stats.articlesTotal} />
        <Kpi label="Pubbl. 7gg" value={stats.articlesInLast7} />
        <Kpi
          label="Reazioni"
          value={stats.totalReactionsAll}
          accent={stats.totalReactionsAll > 0}
        />
        <Kpi
          label="Segnalazioni"
          value={stats.pendingReports}
          warn={stats.pendingReports > 0}
        />
      </div>

      {/* Chi ha pronosticato la prossima partita — solo per l'admin.
          È l'informazione che serve prima della gara: quanti hanno
          giocato, e cosa si aspettano. Le statistiche generali qui
          sotto guardano invece tutto lo storico. */}
      {stats.pronosticiProssima && (
        <Card
          title="Pronostici sulla prossima partita"
          subtitle={`${stats.pronosticiProssima.partita} · ${stats.pronosticiProssima.quando}`}
        >
          {stats.pronosticiProssima.quanti === 0 ? (
            <p className="text-sm text-text-secondary">
              Ancora nessun pronostico su questa partita.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi
                  label="Hanno pronosticato"
                  value={stats.pronosticiProssima.quanti}
                  accent
                />
                <Kpi label="Vittoria casa (1)" value={stats.pronosticiProssima.perEsito["1"]} />
                <Kpi label="Pareggio (X)" value={stats.pronosticiProssima.perEsito.X} />
                <Kpi label="Vittoria fuori (2)" value={stats.pronosticiProssima.perEsito["2"]} />
              </div>

              {stats.pronosticiProssima.risultatoPiuGettonato && (
                <p className="mt-4 text-sm text-text-secondary">
                  Risultato più pronosticato:{" "}
                  <span className="font-bold text-text-primary">
                    {stats.pronosticiProssima.risultatoPiuGettonato}
                  </span>{" "}
                  <span className="text-text-muted">
                    ({stats.pronosticiProssima.quantePerQuelRisultato}{" "}
                    {stats.pronosticiProssima.quantePerQuelRisultato === 1
                      ? "tifoso"
                      : "tifosi"}
                    )
                  </span>
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {/* Pronostici */}
      <Card title="Pronostici" subtitle="Risultati globali della community">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Totali" value={stats.predictionsTotal} />
          <Kpi label="Valutati" value={stats.predictionsEvaluated} />
          <Kpi label="Esatti (+3)" value={stats.exactPreds} accent />
          <Kpi label="Hit-rate globale" value={`${stats.hitRate}%`} />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top articoli */}
        <Card title="Top articoli per reazioni">
          {stats.topArticlesByReactions.length === 0 ? (
            <div className="p-6 text-center text-text-muted">
              Ancora nessuna reazione.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {stats.topArticlesByReactions.map((a, i) => (
                <li key={a.id} className="py-3 flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-black text-text-muted tabular-nums">
                    {i + 1}
                  </span>
                  {a.imageUrl ? (
                    <img
                      src={a.imageUrl}
                      alt=""
                      className="w-14 h-10 object-cover rounded-md border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-10 rounded-md bg-bg-elevated border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/news/${a.id}`}
                      className="text-sm font-semibold text-text-primary hover:text-accent truncate block"
                    >
                      {a.title}
                    </Link>
                    <div className="text-[10px] text-text-muted truncate">
                      {REACTION_TYPES.map((r) => {
                        const n = a.reactionCounts?.[r.id] || 0;
                        return n > 0 ? `${r.emoji}${n} ` : "";
                      }).join("")}
                    </div>
                  </div>
                  <div className="text-xl font-black tabular-nums text-text-primary">
                    {a._r}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top commentatori */}
        <Card title="Top commentatori">
          {stats.topCommenters.length === 0 ? (
            <div className="p-6 text-center text-text-muted">
              Nessun commento ancora.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {stats.topCommenters.map((c, i) => (
                <li key={c.uid} className="py-3 flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-black text-text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <Avatar photoURL={c.photoURL} name={c.displayName} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">
                      {c.displayName}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {c.count} {c.count === 1 ? "commento" : "commenti"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Sondaggi */}
      <Card title="Sondaggi" subtitle="Performance della funzione community">
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Attivi" value={stats.pollsActive} accent />
          <Kpi label="Chiusi" value={stats.pollsClosed} />
          <Kpi label="Voti totali" value={stats.totalPollVotes} />
        </div>
      </Card>
    </div>
  );
}

/* ─── Sub-componenti ─────────────────────────────────────── */
function Card({ title, subtitle, children }) {
  return (
    <div className="bg-bg-surface rounded-2xl border border-border overflow-hidden">
      <div className="p-5 border-b border-border">
        <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
          {title}
        </div>
        {subtitle && (
          <div className="mt-1 text-xs text-text-muted">{subtitle}</div>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Kpi({ label, value, accent, warn, delta }) {
  return (
    <div
      className={`rounded-2xl p-4 border transition-all ${
        accent
          ? "bg-accent/10 border-accent/30"
          : warn
          ? "bg-error/10 border-error/30"
          : "bg-bg-surface border-border"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-black leading-none tabular-nums ${
          accent
            ? "text-accent"
            : warn
            ? "text-error"
            : "text-text-primary"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {delta}
        {value}
      </div>
    </div>
  );
}

function Avatar({ photoURL, name }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center text-[11px] font-black text-text-inverse shrink-0">
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}
