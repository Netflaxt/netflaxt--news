/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminEngagementTab.jsx
   Top articoli per reazioni totali + breakdown per tipo.
   Sondaggi e stats live (linkati da Dashboard).
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { REACTION_TYPES, totalReactions } from "../../utils/reactions";

export default function AdminEngagementTab() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "articles"), orderBy("date", "desc"));
        const snap = await getDocs(q);
        setArticles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ranked = useMemo(() => {
    return [...articles]
      .map((a) => ({ ...a, _total: totalReactions(a) }))
      .sort((a, b) => b._total - a._total)
      .slice(0, 15);
  }, [articles]);

  const grandTotals = useMemo(() => {
    const totals = {};
    REACTION_TYPES.forEach((r) => (totals[r.id] = 0));
    articles.forEach((a) => {
      const c = a.reactionCounts || {};
      REACTION_TYPES.forEach((r) => {
        totals[r.id] += Math.max(0, Number(c[r.id]) || 0);
      });
    });
    return totals;
  }, [articles]);

  const grandTotalSum = REACTION_TYPES.reduce(
    (s, r) => s + grandTotals[r.id],
    0
  );

  return (
    <div className="space-y-6">
      {/* Totals strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl p-4 bg-accent/10 border border-accent/30">
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">
            Totale reazioni
          </div>
          <div
            className="mt-1 text-3xl font-black text-accent leading-none tabular-nums"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {grandTotalSum}
          </div>
        </div>
        {REACTION_TYPES.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl p-4 bg-bg-surface border border-border"
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted font-bold">
              <span className="text-base leading-none">{r.emoji}</span>
              {r.label}
            </div>
            <div
              className="mt-1 text-2xl font-black text-text-primary leading-none tabular-nums"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {grandTotals[r.id]}
            </div>
          </div>
        ))}
      </div>

      {/* Top articoli */}
      <div className="bg-bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
              Classifica
            </div>
            <h3
              className="mt-1 text-2xl text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Top articoli per reazioni
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ranked.length === 0 ? (
          <div className="p-10 text-center text-text-muted">
            Nessun articolo pubblicato ancora.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {ranked.map((a, i) => {
              const total = a._total;
              const counts = a.reactionCounts || {};
              return (
                <li
                  key={a.id}
                  className="p-4 sm:p-5 flex items-center gap-4 hover:bg-bg-elevated/40 transition"
                >
                  <div className="w-7 text-center text-lg font-black tabular-nums text-text-muted">
                    {i + 1}
                  </div>
                  {a.imageUrl ? (
                    <img
                      src={a.imageUrl}
                      alt=""
                      className="w-14 h-10 sm:w-20 sm:h-14 object-cover rounded-md border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-10 sm:w-20 sm:h-14 rounded-md bg-bg-elevated border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/news/${a.id}`}
                      className="text-sm font-semibold text-text-primary hover:text-accent truncate block"
                    >
                      {a.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      {REACTION_TYPES.map((r) => {
                        const n = Number(counts[r.id]) || 0;
                        if (n === 0) return null;
                        return (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-elevated border border-border text-text-secondary"
                          >
                            <span className="leading-none">{r.emoji}</span>
                            <span className="tabular-nums">{n}</span>
                          </span>
                        );
                      })}
                      {total === 0 && (
                        <span className="text-text-muted">
                          Ancora nessuna reazione
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="text-2xl font-black tabular-nums leading-none text-text-primary"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {total}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-text-muted font-bold mt-0.5">
                      Reazioni
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
