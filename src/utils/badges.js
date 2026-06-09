/* ─────────────────────────────────────────────────────────────
   src/utils/badges.js
   Catalogo badge + calcolo runtime in base allo stato utente.
   Salvataggio:
     - users/{uid}.badges = [{ id, unlockedAt }]   (storico)
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export const BADGES = [
  {
    id: "founder_2026",
    title: "Tifoso del 2026",
    description: "Iscritto nei primi mesi di Netflaxt.",
    emoji: "🦅",
    color: "from-sky-400 to-sky-600",
    test: ({ user }) => {
      const c = user?.metadata?.creationTime
        ? new Date(user.metadata.creationTime)
        : null;
      if (!c) return false;
      return c.getFullYear() <= 2026;
    },
  },
  {
    id: "profile_complete",
    title: "Profilo completo",
    description: "Avatar, username e nome impostati.",
    emoji: "✨",
    color: "from-emerald-400 to-emerald-600",
    test: ({ user, profile }) =>
      !!user?.photoURL && !!profile?.username && !!profile?.firstName,
  },
  {
    id: "chatter_10",
    title: "Voce della curva",
    description: "Almeno 10 messaggi in chat.",
    emoji: "💬",
    color: "from-amber-400 to-amber-600",
    test: ({ chatCount }) => (chatCount || 0) >= 10,
  },
  {
    id: "chatter_100",
    title: "Capo curva",
    description: "Più di 100 messaggi in chat.",
    emoji: "📣",
    color: "from-rose-400 to-rose-600",
    test: ({ chatCount }) => (chatCount || 0) >= 100,
  },
  {
    id: "commenter_10",
    title: "Opinionista",
    description: "Almeno 10 commenti sotto gli articoli.",
    emoji: "🗣",
    color: "from-violet-400 to-violet-600",
    test: ({ commentCount }) => (commentCount || 0) >= 10,
  },
  {
    id: "predictor_first",
    title: "Primo pronostico",
    description: "Hai dato il tuo primo pronostico.",
    emoji: "🎯",
    color: "from-cyan-400 to-cyan-600",
    test: ({ predictionCount }) => (predictionCount || 0) >= 1,
  },
  {
    id: "predictor_perfect",
    title: "Pronostico perfetto",
    description: "Hai indovinato almeno un risultato esatto.",
    emoji: "🔮",
    color: "from-fuchsia-400 to-fuchsia-600",
    test: ({ exactCount }) => (exactCount || 0) >= 1,
  },
  {
    id: "streak_3",
    title: "On fire",
    description: "3 pronostici azzeccati di fila.",
    emoji: "🔥",
    color: "from-orange-400 to-orange-600",
    test: ({ bestStreak }) => (bestStreak || 0) >= 3,
  },
  {
    id: "streak_5",
    title: "Mago della curva",
    description: "5 pronostici azzeccati di fila.",
    emoji: "🧙",
    color: "from-yellow-400 to-yellow-600",
    test: ({ bestStreak }) => (bestStreak || 0) >= 5,
  },
  {
    id: "top10_season",
    title: "Top 10 stagione",
    description: "Tra i primi 10 nella classifica pronostici.",
    emoji: "🏆",
    color: "from-amber-300 to-amber-600",
    test: ({ leaderboardRank }) =>
      leaderboardRank != null && leaderboardRank <= 10,
  },
  {
    id: "saver_10",
    title: "Bibliotecario",
    description: "Hai salvato almeno 10 articoli.",
    emoji: "📚",
    color: "from-teal-400 to-teal-600",
    test: ({ bookmarksCount }) => (bookmarksCount || 0) >= 10,
  },
  {
    id: "reactor",
    title: "Tifoso reattivo",
    description: "Hai lasciato almeno 5 reazioni.",
    emoji: "💙",
    color: "from-sky-300 to-sky-500",
    test: ({ reactionsCount }) => (reactionsCount || 0) >= 5,
  },
];

export function getBadgeById(id) {
  return BADGES.find((b) => b.id === id) || null;
}

/* ─── Raccolta stats utente da varie collection ─────────────────
   Pensata per essere chiamata su Profile (proprio) o /u/:username.
   Ottimizzata per il piano Spark: nessuna scrittura, count via getDocs.
   ───────────────────────────────────────────────────────────── */
export async function collectUserStats(uid) {
  if (!uid) return {};
  const stats = {
    predictionCount: 0,
    exactCount: 0,    // pronostico con risultato esatto (3 pt)
    correctCount: 0,  // solo esito 1X2 indovinato (1 pt)
    wrongCount: 0,    // pronostico valutato e SBAGLIATO (0 pt)
    predictionPoints: 0, // somma punti SOLO pronostici
    quizPoints: 0,    // punti dal quiz
    totalPoints: 0,   // pronostici + quiz (= valore in classifica)
    commentCount: 0,
    chatCount: 0,
    reactionsCount: 0,
    bookmarksCount: 0,
    leaderboardRank: null,
  };

  // Predictions
  try {
    const q = query(collection(db, "predictions"), where("uid", "==", uid));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const p = d.data();
      stats.predictionCount += 1;
      if (p.points === 3) stats.exactCount += 1;
      else if (p.points === 1) stats.correctCount += 1;
      else if (p.points === 0) stats.wrongCount += 1;
      stats.predictionPoints += Number(p.points) || 0;
    });
  } catch {}

  // Bookmarks (subcollezione under users/{uid}/bookmarks)
  try {
    const snap = await getDocs(collection(db, "users", uid, "bookmarks"));
    stats.bookmarksCount = snap.size;
  } catch {}

  // Counter cumulativi + quizPoints + profilo dal doc utente
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const u = userSnap.data();
      stats.commentCount = u.commentCount || 0;
      stats.chatCount = u.chatCount || 0;
      stats.reactionsCount = u.reactionsCount || 0;
      stats.quizPoints = u.quizPoints || 0;
      stats.username = u.username || "";
      stats.firstName = u.firstName || "";
      stats.photoURL = u.photoURL || null;
    }
  } catch {}

  // Totale = pronostici + quiz (coerente con la classifica generale)
  stats.totalPoints = stats.predictionPoints + stats.quizPoints;

  return stats;
}

/* ─── Computa quali badge sono sbloccati ────────────────────── */
export function computeUnlockedBadges(ctx) {
  const unlocked = [];
  for (const b of BADGES) {
    try {
      if (b.test(ctx || {})) unlocked.push(b.id);
    } catch {}
  }
  return unlocked;
}

/* ─── Persisti su Firestore (idempotente) ──────────────────── */
export async function persistBadgeUnlocks(uid, unlockedIds) {
  if (!uid || !Array.isArray(unlockedIds)) return [];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const prev = snap.exists() ? snap.data() : {};
    const existing = Array.isArray(prev.badges) ? prev.badges : [];
    const existingIds = new Set(existing.map((b) => b.id));
    const newOnes = [];
    const now = new Date().toISOString();
    for (const id of unlockedIds) {
      if (!existingIds.has(id)) {
        newOnes.push({ id, unlockedAt: now });
      }
    }
    if (newOnes.length === 0) return [];
    await setDoc(
      doc(db, "users", uid),
      { badges: [...existing, ...newOnes] },
      { merge: true }
    );
    return newOnes.map((b) => b.id);
  } catch {
    return [];
  }
}
