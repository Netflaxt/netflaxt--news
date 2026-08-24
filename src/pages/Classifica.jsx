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

function Avatar({ photoURL, displayName, size = "md" }) {
  const [broken, setBroken] = useState(false);
  const cls = size === "lg" ? "w-16 h-16 text-lg" : "w-10 h-10 text-xs";
  if (photoURL && !broken) {
    return (
      <img
        src={photoURL}
        alt={displayName || ""}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${cls} rounded-full object-cover bg-bg-elevated`}
      />
    );
  }
  const initials = (displayName || "?").slice(0, 2).toUpperCase();
  return (
    <div
      className={`${cls} rounded-full bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center font-black text-text-inverse`}
    >
      {initials}
    </div>
  );
}

/* Contatore che sale da 0 al valore (eased). Reduced-motion: il giro è
   istantaneo (rAF singolo) → mostra subito il numero finale. */
function CountUp({ value }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round((value || 0) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

/* Una posizione del podio (1°, 2° o 3°). */
function PodiumSpot({ entry, rank, usernamesByUid, currentUid }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const baseH = rank === 1 ? "h-24 sm:h-28" : rank === 2 ? "h-16 sm:h-20" : "h-12 sm:h-16";
  const isFirst = rank === 1;
  const isMe = entry.uid === currentUid;
  const uname = usernamesByUid[entry.uid];
  const nameNode = uname ? (
    <Link to={`/u/${uname}`} className="hover:text-accent transition">
      {entry.displayName}
    </Link>
  ) : (
    entry.displayName
  );
  return (
    <div className="flex flex-col items-center justify-end">
      <div className="relative mb-2.5">
        <div
          className={
            isFirst
              ? "rounded-full p-0.5 ring-2 ring-accent shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)]"
              : ""
          }
        >
          <Avatar
            photoURL={entry.photoURL}
            displayName={entry.displayName}
            size={isFirst ? "lg" : "md"}
          />
        </div>
        <span className="absolute -bottom-1.5 -right-1.5 text-xl">{medal}</span>
      </div>
      <div
        className={`text-sm font-bold truncate max-w-[7.5rem] text-center ${
          isMe ? "text-accent" : "text-text-primary"
        }`}
      >
        {nameNode}
        {isMe && <span className="ml-1 text-[9px] uppercase tracking-wider">tu</span>}
      </div>
      <div
        className="text-2xl sm:text-3xl font-black text-text-primary tabular-nums leading-none mt-0.5"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <CountUp value={entry.totalPoints} />
      </div>
      <div className="text-[9px] uppercase tracking-wider text-text-muted font-bold mb-2.5">
        punti
      </div>
      <div
        className={`w-full ${baseH} rounded-t-xl border border-b-0 flex items-start justify-center pt-2 ${
          isFirst ? "border-accent/40 bg-accent/10" : "border-border bg-bg-surface"
        }`}
      >
        <span
          className="text-2xl font-black leading-none"
          style={{
            fontFamily: "var(--font-display)",
            color: isFirst ? "var(--color-accent)" : "var(--color-text-muted)",
          }}
        >
          {rank}
        </span>
      </div>
    </div>
  );
}

/* Podio Top-3 (mostrato solo se ci sono almeno 3 in classifica). */
function Podium({ board, usernamesByUid, currentUid }) {
  if (board.length < 3) return null;
  const [first, second, third] = board;
  return (
    <div className="mb-10 grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-lg mx-auto">
      <PodiumSpot entry={second} rank={2} usernamesByUid={usernamesByUid} currentUid={currentUid} />
      <PodiumSpot entry={first} rank={1} usernamesByUid={usernamesByUid} currentUid={currentUid} />
      <PodiumSpot entry={third} rank={3} usernamesByUid={usernamesByUid} currentUid={currentUid} />
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
          // Niente ripiego sull'indirizzo email: mostrava in pubblico
          // un pezzo dell'indirizzo di chi non aveva scelto un nome.
          displayName: meta.username || "Tifoso",
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

    /* Si legge dalla collection `classifica`, non dall'elenco degli
       iscritti. Quest'ultimo, per far funzionare una pagina pubblica,
       avrebbe dovuto restare leggibile da chiunque — e insieme ai punti
       usciva tutto il resto: indirizzi email, nome e cognome, storico
       delle sanzioni. Qui c'è soltanto nome, foto e punti del quiz.
       Vedi utils/classifica.js. */
    const unsubUsers = onSnapshot(
      collection(db, "classifica"),
      (snap) => {
        usersRaw = snap.docs.map((d) => {
          const v = d.data();
          return { id: d.id, username: v.nome, photoURL: v.foto, quizPoints: v.puntiQuiz };
        });
        recompute();
      },
      (e) => {
        console.error("Errore listener classifica:", e);
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

  // Con almeno 3 in classifica mostriamo il podio e la lista parte dalla 4ª
  const showPodium = board.length >= 3;
  const listEntries = showPodium ? board.slice(3) : board;

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
              className="nf-shimmer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-text-inverse text-xs font-bold uppercase tracking-wider hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] transition"
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
            {/* Podio Top-3 */}
            <Podium board={board} usernamesByUid={usernamesByUid} currentUid={user?.uid} />

            {listEntries.length > 0 && (
            <>
            {showPodium && (
              <div className="text-[10px] uppercase tracking-[0.3em] text-text-muted font-bold mb-3">
                Classifica completa
              </div>
            )}
            {/* Header tabella (desktop) */}
            <div className="hidden sm:grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem] gap-3 items-center px-4 pb-2 text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">
              <div>#</div>
              <div>Tifoso</div>
              <div className="text-right">Quiz</div>
              <div className="text-right">Pronostici</div>
              <div className="text-right">Totale</div>
            </div>

            <ul className="space-y-2">
              {listEntries.map((b, i) => {
                const rank = (showPodium ? 3 : 0) + i + 1;
                const isMe = user && b.uid === user.uid;
                const medal =
                  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
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
                            {rank}
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
          </>
        )}
      </div>
    </main>
  );
}
