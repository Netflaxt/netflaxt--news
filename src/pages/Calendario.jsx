/* ─────────────────────────────────────────────────────────────
   src/pages/Calendario.jsx
   Calendario partite (#16): prossime partite con pronostico inline
   e risultati passati. Dati live da Firestore `matches`.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeMatches } from "../utils/matches";
import MatchCard from "../components/MatchCard";
import MatchPrediction from "../components/MatchPrediction";
import { TrophyIcon, CalendarIcon, EmptyIcon } from "../components/icons";
import { setSEO, resetSEO } from "../utils/seo";
import { SkeletonMatchCard } from "../components/Skeleton";

export default function Calendario() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setSEO({
      title: "Calendario partite",
      description:
        "Calendario e risultati della Lazio: prossime partite, orari e pronostici della community Netflaxt News.",
      type: "website",
    });
    const unsub = subscribeMatches(
      (list) => {
        setMatches(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => {
      unsub();
      resetSEO();
    };
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = [];
    const pa = [];
    matches.forEach((m) => {
      const k = m.kickoff?.toDate?.()?.getTime?.() || 0;
      if (m.status === "finished" || (k && k < now && m.status !== "live" && m.homeScore != null)) {
        pa.push(m);
      } else {
        up.push(m);
      }
    });
    up.sort((a, b) => (a.kickoff?.toMillis?.() || 0) - (b.kickoff?.toMillis?.() || 0));
    pa.sort((a, b) => (b.kickoff?.toMillis?.() || 0) - (a.kickoff?.toMillis?.() || 0));
    return { upcoming: up, past: pa };
  }, [matches]);

  return (
    <main className="min-h-screen bg-bg-base text-text-primary relative overflow-hidden">
      <div className="absolute -top-40 right-0 w-[600px] h-[500px] rounded-full bg-accent/8 blur-[140px] pointer-events-none" />

      <div
        className={`relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent font-semibold">
          <span className="h-px w-8 bg-accent" />
          Stagione biancoceleste
        </div>
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <h1
            className="text-5xl sm:text-6xl text-text-primary leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Calendario
          </h1>
          <Link
            to="/pronostici"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent/10 border border-accent/30 text-accent text-xs font-bold uppercase tracking-wider hover:bg-accent/20 transition"
          >
            <TrophyIcon className="w-4 h-4" />
            Classifica pronostici →
          </Link>
        </div>
        <p className="mt-2 text-text-secondary text-sm mb-10">
          Prossime partite, orari e risultati. Pronostica e sfida gli altri tifosi.
        </p>

        {loading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonMatchCard key={i} />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-24 bg-bg-surface border border-border rounded-2xl">
            <EmptyIcon icon={CalendarIcon} className="mb-4" />
            <h3 className="text-2xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
              Nessuna partita in calendario
            </h3>
            <p className="mt-2 text-text-secondary text-sm">
              Il calendario verrà pubblicato a breve. Torna presto!
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Prossime */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-[10px] uppercase tracking-[0.3em] text-text-muted font-bold mb-4">
                  Prossime partite
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {upcoming.map((m) => (
                    <MatchCard key={m.id} match={m}>
                      <MatchPrediction match={m} />
                    </MatchCard>
                  ))}
                </div>
              </section>
            )}

            {/* Risultati */}
            {past.length > 0 && (
              <section>
                <h2 className="text-[10px] uppercase tracking-[0.3em] text-text-muted font-bold mb-4">
                  Risultati
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {past.map((m) => (
                    <MatchCard key={m.id} match={m}>
                      <MatchPrediction match={m} />
                    </MatchCard>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
