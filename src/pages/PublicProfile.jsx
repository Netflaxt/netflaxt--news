/* ─────────────────────────────────────────────────────────────
   src/pages/PublicProfile.jsx
   Profilo pubblico (read-only) di un tifoso.
   Route: /u/:username
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { BADGES, getBadgeById, collectUserStats, computeUnlockedBadges } from "../utils/badges";
import BadgeChip, { StreakFire } from "../components/BadgeChip";
import OnFireBadge from "../components/OnFireBadge";
import { computePredictionStreak } from "../utils/predictions";
import { SkeletonRow } from "../components/Skeleton";
import NotFound from "./NotFound";
import { setSEO, resetSEO } from "../utils/seo";

export default function PublicProfile() {
  const { username } = useParams();
  const [state, setState] = useState({ loading: true, user: null });
  const [stats, setStats] = useState({});
  const [streak, setStreak] = useState({ current: 0, best: 0, totalScored: 0, hitRate: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("username", "==", (username || "").toLowerCase()),
          limit(1)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        if (snap.empty) {
          setState({ loading: false, user: null });
          return;
        }
        const docSnap = snap.docs[0];
        const u = { uid: docSnap.id, ...docSnap.data() };
        setState({ loading: false, user: u });
        setSEO({
          title: `@${u.username} · Profilo Netflaxt`,
          description: u.bio || `Profilo pubblico di ${u.firstName || u.username} su Netflaxt News.`,
          type: "profile",
        });

        const [s, sk] = await Promise.all([
          collectUserStats(u.uid),
          computePredictionStreak(u.uid),
        ]);
        if (cancelled) return;
        setStats(s);
        setStreak(sk);
      } catch (e) {
        console.error(e);
        if (!cancelled) setState({ loading: false, user: null });
      }
    })();
    return () => {
      cancelled = true;
      resetSEO();
    };
  }, [username]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-bg-base py-12">
        <div className="mx-auto max-w-3xl px-4 space-y-6">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </main>
    );
  }

  if (!state.user) return <NotFound />;
  const u = state.user;

  // ─── Badge ─────────────────────────────────────────
  const ctx = {
    user: { uid: u.uid, photoURL: u.photoURL, metadata: { creationTime: u.createdAt?.toDate?.()?.toISOString?.() } },
    profile: u,
    bestStreak: streak.best,
    exactCount: stats.exactCount,
    predictionCount: stats.predictionCount,
    bookmarksCount: stats.bookmarksCount,
    commentCount: stats.commentCount,
    chatCount: stats.chatCount,
    reactionsCount: stats.reactionsCount,
  };
  const unlocked = new Set([
    ...((u.badges || []).map((b) => b.id)),
    ...computeUnlockedBadges(ctx),
  ]);
  const fullName =
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Tifoso";
  const photoURL = u.photoURL || null;

  return (
    <main className="min-h-screen bg-bg-base text-text-primary py-12 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-accent/8 blur-3xl pointer-events-none" />
      <div className="relative mx-auto max-w-3xl px-4 space-y-6">
        {/* Header card */}
        <div className="relative bg-bg-surface rounded-2xl border border-border shadow-sm">
          {/* Banner (con overflow-hidden solo sul banner: l'avatar fuoriesce) */}
          <div className="relative h-32 rounded-t-2xl overflow-hidden bg-gradient-to-br from-accent via-accent-deep to-bg-elevated">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)",
              }}
            />
            {/* Streak badge in alto a destra, dentro il banner */}
            {streak.best > 0 && (
              <div className="absolute top-3 right-4 z-20">
                <OnFireBadge streak={streak.current || streak.best} size="md" />
              </div>
            )}
          </div>

          <div className="relative px-7 pb-7">
            {/* Avatar sopra al banner, con anello scuro e bordo accent per contrasto */}
            <div className="relative -mt-14 mb-4 z-10">
              <div className="w-28 h-28 rounded-2xl ring-4 ring-bg-surface border-2 border-accent/40 shadow-2xl overflow-hidden bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={fullName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl font-black text-text-inverse">
                    {fullName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">
                Profilo tifoso
              </div>
              <h1 className="mt-1 text-4xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
                {fullName}
              </h1>
              <p className="text-accent text-sm font-semibold mt-0.5">@{u.username}</p>
              {u.bio && (
                <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-prose whitespace-pre-wrap">
                  {u.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Punti totali" value={stats.totalPoints || 0} accent />
          <StatTile label="Esatti (3pt)" value={stats.exactCount || 0} />
          <StatTile label="Esiti (1pt)" value={stats.correctCount || 0} />
          <StatTile label="Errate" value={stats.wrongCount || 0} />
        </div>

        {/* Badge */}
        <section className="bg-bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
                Riconoscimenti
              </div>
              <h2 className="text-2xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
                Badge
              </h2>
            </div>
            <div className="text-xs text-text-muted">
              <span className="text-text-primary font-bold tabular-nums">
                {unlocked.size}
              </span>
              /{BADGES.length}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {BADGES.map((b) => (
              <BadgeChip key={b.id} badge={b} locked={!unlocked.has(b.id)} />
            ))}
          </div>
        </section>

        <div className="text-center pt-2">
          <Link
            to="/pronostici"
            className="text-xs uppercase tracking-[0.22em] text-text-secondary hover:text-text-primary font-bold transition"
          >
            ← Vai alla classifica pronostici
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        accent
          ? "bg-accent/10 border-accent/30"
          : "bg-bg-surface border-border"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-black tabular-nums leading-none ${
          accent ? "text-accent" : "text-text-primary"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
