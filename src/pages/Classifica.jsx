/* ─────────────────────────────────────────────────────────────
   src/pages/Classifica.jsx
   Classifica generale unificata: somma i punti dei pronostici
   (POINTS.exact / POINTS.outcome assegnati a partita finita) e
   i punti del quiz (1 punto per ogni risposta corretta).
   Colonne: Punti Quiz, Punti Pronostici, Totale.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { POINTS } from "../utils/predictions";
import { db } from "../firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { TrophyIcon, EmptyIcon } from "../components/icons";
import { setSEO, resetSEO } from "../utils/seo";

function Avatar({ photoURL, displayName }) {
  const [broken, setBroken] = useState(false);
  if (photoURL && !broken) {
    return (
      <img
        src={photoURL}
        alt={displayName || ""}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="w-10 h-10 rounded-full object-cover bg-bg-elevated"
      />
    );
  }
  const initials = (displayName || "?").slice(0, 2).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center text-xs font-black text-text-inverse">
      {initials}
    </div>
  );
}

export default function Classifica() {
  const { user } = useAuth();
  const [board, setBoard] = useState([]);
  const [usernamesByUid, setUsernamesByUid] = useState({});
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setSEO({
      title: "Classifica generale",
      description:
        "Classifica generale dei tifosi su Netflaxt News: punti quiz + punti pronostici sommati.",
      type: "website",
    });

    // ✨ REAL-TIME: listener su predictions e users.
    // Quando admin azzera la classifica o un utente fa un nuovo
    // pronostico/quiz, la pagina si aggiorna istantaneamente senza
    // dover navigare via e tornare.
    let predictionsRaw = [];
    let usersRaw = [];

    const recompute = () => {
      // Mappa meta utenti
      const userMeta = {};
      const uByUid = {};
      const quizPoints = {};
      usersRaw.forEach((d) => {
        userMeta[d.id] = d;
        if (d?.username) uByUid[d.id] = d.username;
        if (d?.quizPoints > 0) quizPoints[d.id] = d.quizPoints;
      });

      // Aggrega punti pronostici per utente
      const predBoardMap = new Map();
      predictionsRaw.forEach((p) => {
        if (p.points == null) return; // non valutato
        const entry =
          predBoardMap.get(p.uid) || {
            uid: p.uid,
            displayName: p.displayName || "Tifoso",
            photoURL: p.photoURL || null,
            points: 0,
            played: 0,
            exact: 0,
            correct: 0,
          };
        entry.points += p.points || 0;
        entry.played += 1;
        if (p.points === POINTS.exact) entry.exact += 1;
        else if (p.points === POINTS.outcome) entry.correct += 1;
        if (p.displayName) entry.displayName = p.displayName;
        if (p.photoURL) entry.photoURL = p.photoURL;
        predBoardMap.set(p.uid, entry);
      });

      // Unione: tutti gli uid in pronostici OR quiz
      const seen = new Set();
      const merged = [];

      predBoardMap.forEach((entry) => {
        seen.add(entry.uid);
        const meta = userMeta[entry.uid] || {};
        const qp = quizPoints[entry.uid] || 0;
        merged.push({
          uid: entry.uid,
          displayName: meta.username || entry.displayName || "Tifoso",
          photoURL: meta.photoURL || entry.photoURL || null,
          quizPoints: qp,
          predictionPoints: entry.points || 0,
          totalPoints: (entry.points || 0) + qp,
          played: entry.played || 0,
          exact: entry.exact || 0,
        });
      });

      Object.entries(quizPoints).forEach(([uid, qp]) => {
        if (seen.has(uid) || qp <= 0) return;
        const meta = userMeta[uid] || {};
        merged.push({
          uid,
          displayName:
            meta.username ||
            meta.firstName ||
            (meta.email ? meta.email.split("@")[0] : "Tifoso"),
          photoURL: meta.photoURL || null,
          quizPoints: qp,
          predictionPoints: 0,
          totalPoints: qp,
          played: 0,
          exact: 0,
        });
      });

      merged.sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          b.predictionPoints - a.predictionPoints ||
          b.quizPoints - a.quizPoints
      );

      setBoard(merged);
      setUsernamesByUid(uByUid);
      setLoading(false);
    };

    const unsubPreds = onSnapshot(
      collection(db, "predictions"),
      (snap) => {
        predictionsRaw = snap.docs.map((d) => d.data());
        recompute();
      },
      (e) => {
        console.error("Errore listener predictions:", e);
        setLoading(false);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        usersRaw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        console.error("Errore listener users:", e);
        setLoading(false);
      }
    );

    return () => {
      unsubPreds();
      unsubUsers();
      resetSEO();
    };
  }, []);

  const myRank = useMemo(() => {
    if (!user) return null;
    const idx = board.findIndex((b) => b.uid === user.uid);
    return idx === -1 ? null : idx + 1;
  }, [board, user]);

  const myRow = useMemo(() => {
    if (!user) return null;
    return board.find((b) => b.uid === user.uid) || null;
  }, [board, user]);

  return (
    <main className="min-h-screen bg-bg-base text-text-primary relative overflow-hidden">
      <div className="absolute -top-40 left-0 w-[600px] h-[500px] rounded-full bg-accent/8 blur-[140px] pointer-events-none" />

      <div
        className={`relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent font-semibold">
          <span className="h-px w-8 bg-accent" />
          La curva digitale
        </div>
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <h1
            className="text-5xl sm:text-6xl text-text-primary leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Classifica
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/pronostici"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-bg-surface text-text-secondary hover:text-text-primary hover:border-accent/40 text-xs font-bold uppercase tracking-wider transition"
            >
              Pronostici
            </Link>
            <Link
              to="/calendario"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-text-inverse text-xs font-bold uppercase tracking-wider hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] transition"
            >
              Vai a pronosticare →
            </Link>
          </div>
        </div>
        <p className="mt-2 text-text-secondary text-sm mb-8 max-w-2xl">
          Somma dei <span className="text-text-primary font-semibold">punti quiz</span>{" "}
          (1 punto per ogni risposta corretta) e dei{" "}
          <span className="text-text-primary font-semibold">punti pronostici</span>{" "}
          (1 punto per esito esatto, 3 punti per risultato esatto). Vince chi
          ha più <span className="text-accent font-semibold">punti totali</span>.
        </p>

        {/* La mia posizione */}
        {user && myRow && (
          <div className="mb-8 rounded-2xl border border-accent/30 bg-accent/5 p-5">
            <div className="flex items-center gap-4">
              <div
                className="text-4xl font-black text-accent tabular-nums leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {myRank ? `#${myRank}` : "—"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text-primary">
                  La tua posizione
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {myRow.totalPoints} punti totali ·{" "}
                  <span className="text-accent">{myRow.quizPoints}</span> quiz +{" "}
                  <span className="text-success">{myRow.predictionPoints}</span>{" "}
                  pronostici
                </div>
              </div>
            </div>
          </div>
        )}

        {user && !myRow && !loading && (
          <div className="mb-8 rounded-2xl border border-border bg-bg-surface p-5 text-sm text-text-secondary">
            Non sei ancora in classifica. Gioca al{" "}
            <Link to="/" className="text-accent font-semibold hover:underline">
              quiz giornaliero
            </Link>{" "}
            o pronostica dal{" "}
            <Link
              to="/calendario"
              className="text-accent font-semibold hover:underline"
            >
              calendario
            </Link>{" "}
            per entrarci.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : board.length === 0 ? (
          <div className="text-center py-16 bg-bg-surface border border-border rounded-2xl">
            <EmptyIcon icon={TrophyIcon} className="mb-4" />
            <h3
              className="text-2xl text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Classifica vuota
            </h3>
            <p className="mt-2 text-text-secondary text-sm max-w-sm mx-auto">
              Nessun punto ancora assegnato. I primi a giocare al quiz o
              pronosticare compaiono qui!
            </p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              <Link
                to="/"
                className="px-5 py-2.5 rounded-md bg-accent text-text-inverse text-sm font-bold hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] transition"
              >
                Vai al quiz →
              </Link>
              <Link
                to="/calendario"
                className="px-5 py-2.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 text-sm font-bold transition"
              >
                Calendario partite
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Header tabella (desktop) */}
            <div className="hidden sm:grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem] gap-3 items-center px-4 pb-2 text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">
              <div>#</div>
              <div>Tifoso</div>
              <div className="text-right">Quiz</div>
              <div className="text-right">Pronostici</div>
              <div className="text-right">Totale</div>
            </div>

            <ul className="space-y-2">
              {board.map((b, i) => {
                const isMe = user && b.uid === user.uid;
                const medal =
                  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                const linkName = usernamesByUid[b.uid];
                const nameNode = linkName ? (
                  <Link
                    to={`/u/${linkName}`}
                    className="hover:text-accent transition"
                  >
                    {b.displayName}
                  </Link>
                ) : (
                  b.displayName
                );

                return (
                  <li
                    key={b.uid}
                    className={`rounded-xl border ${
                      isMe
                        ? "border-accent/50 bg-accent/5 shadow-[0_0_24px_-12px_rgba(56,189,248,0.5)]"
                        : "border-border bg-bg-surface"
                    }`}
                  >
                    {/* Desktop: tabella */}
                    <div className="hidden sm:grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem] gap-3 items-center px-4 py-3">
                      <div className="text-center">
                        {medal ? (
                          <span className="text-xl">{medal}</span>
                        ) : (
                          <span className="text-sm font-bold text-text-muted tabular-nums">
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          photoURL={b.photoURL}
                          displayName={b.displayName}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-text-primary truncate">
                            {nameNode}
                            {isMe && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                                tu
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-text-muted truncate">
                            {b.played > 0 && (
                              <span>{b.exact} esatti · {b.played} pronost.</span>
                            )}
                            {b.played > 0 && b.quizPoints > 0 && (
                              <span> · </span>
                            )}
                            {b.quizPoints > 0 && (
                              <span className="text-accent">
                                {b.quizPoints} pt quiz
                              </span>
                            )}
                            {b.played === 0 && b.quizPoints === 0 && (
                              <span className="italic">in attesa…</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-base font-bold text-accent">
                          {b.quizPoints}
                        </span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-base font-bold text-success">
                          {b.predictionPoints}
                        </span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span
                          className="text-2xl font-black text-text-primary"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {b.totalPoints}
                        </span>
                      </div>
                    </div>

                    {/* Mobile: layout impilato */}
                    <div className="sm:hidden p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-center shrink-0">
                          {medal ? (
                            <span className="text-xl">{medal}</span>
                          ) : (
                            <span className="text-sm font-bold text-text-muted tabular-nums">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <Avatar
                          photoURL={b.photoURL}
                          displayName={b.displayName}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-text-primary truncate">
                            {nameNode}
                            {isMe && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                                tu
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-text-muted truncate">
                            {b.played > 0 && (
                              <span>{b.exact} esatti · {b.played} pronost.</span>
                            )}
                            {b.played === 0 && b.quizPoints > 0 && (
                              <span className="text-accent">solo quiz</span>
                            )}
                            {b.played === 0 && b.quizPoints === 0 && (
                              <span className="italic">in attesa…</span>
                            )}
                          </div>
                        </div>
                        <div
                          className="text-2xl font-black text-text-primary tabular-nums shrink-0"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {b.totalPoints}
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-2 pl-11">
                        <div className="rounded-md bg-bg-base/40 border border-border px-2.5 py-1.5">
                          <div className="text-[9px] uppercase tracking-wider text-text-muted font-bold">
                            Quiz
                          </div>
                          <div className="text-sm font-bold text-accent tabular-nums">
                            {b.quizPoints}
                          </div>
                        </div>
                        <div className="rounded-md bg-bg-base/40 border border-border px-2.5 py-1.5">
                          <div className="text-[9px] uppercase tracking-wider text-text-muted font-bold">
                            Pronostici
                          </div>
                          <div className="text-sm font-bold text-success tabular-nums">
                            {b.predictionPoints}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
