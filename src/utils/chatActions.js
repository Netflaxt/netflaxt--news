/* ─────────────────────────────────────────────────────────────
   src/utils/chatActions.js
   Helper RTDB per reazioni + reply ai messaggi della chat.
   ───────────────────────────────────────────────────────────── */
import { rtdb, db } from "../firebase/firebase";
import {
  ref,
  push,
  set,
  remove,
  get,
  serverTimestamp,
} from "firebase/database";
import {
  doc as fsDoc,
  setDoc as fsSetDoc,
  increment as fsIncrement,
} from "firebase/firestore";

// Incrementa un counter su users/{uid} (best-effort, mai blocca).
async function bumpUserCounter(uid, field, by = 1) {
  if (!uid || !field) return;
  try {
    await fsSetDoc(
      fsDoc(db, "users", uid),
      { [field]: fsIncrement(by) },
      { merge: true }
    );
  } catch (e) {
    console.warn(`bumpUserCounter ${field} fallito:`, e);
  }
}

/* Emoji ammessi (5 reazioni rapide) */
export const ALLOWED_REACTIONS = ["👍", "🦅", "❤️", "🔥", "😂"];

/**
 * Toggle di una reazione sul messaggio.
 * Path: messages/{messageId}/reactions/{emojiKey}/{uid} = true
 *
 * Usiamo `emojiKey` (alfa-only) come key perché alcune chiavi
 * RTDB non possono contenere certi simboli. Es: 👍 → "thumb"
 */
const EMOJI_KEY_MAP = {
  "👍": "thumb",
  "🦅": "eagle",
  "❤️": "heart",
  "🔥": "fire",
  "😂": "lol",
};
const KEY_TO_EMOJI = Object.fromEntries(
  Object.entries(EMOJI_KEY_MAP).map(([e, k]) => [k, e])
);

export function emojiToKey(emoji) {
  return EMOJI_KEY_MAP[emoji] || null;
}

export function keyToEmoji(key) {
  return KEY_TO_EMOJI[key] || key;
}

/**
 * Toggle: se l'utente ha già reagito con quell'emoji → rimuove;
 *         altrimenti → aggiunge.
 */
export async function toggleReaction(messageId, emoji, uid) {
  if (!messageId || !emoji || !uid) return;
  const key = emojiToKey(emoji);
  if (!key) return;

  const reactionRef = ref(rtdb, `messages/${messageId}/reactions/${key}/${uid}`);
  try {
    const snap = await get(reactionRef);
    if (snap.exists()) {
      await remove(reactionRef);
    } else {
      await set(reactionRef, true);
      // Incrementa il contatore reazioni (badge "tifoso reattivo")
      bumpUserCounter(uid, "reactionsCount", 1);
    }
  } catch (e) {
    console.error("toggleReaction error:", e);
  }
}

/**
 * Invio messaggio con eventuale replyTo e/o media allegato.
 * @param {object} args
 * @param {object} args.user       — utente corrente (uid, displayName, photoURL)
 * @param {string} args.text       — testo (può essere vuoto se c'è media)
 * @param {object|null} args.replyTo — { id, text, displayName }
 * @param {object|null} args.media — { type:'image'|'video', url, width?, height? }
 */
export async function sendMessageWithReply({ user, text, replyTo = null, media = null }) {
  if (!user?.uid) return;
  const cleanText = (text || "").trim();
  // Serve almeno testo O media
  if (!cleanText && !media) return;

  const messagesRef = ref(rtdb, "messages");

  const payload = {
    uid: user.uid,
    displayName:
      user.displayName || (user.email ? user.email.split("@")[0] : "Anonimo"),
    photoURL: user.photoURL || null,
    text: cleanText,
    // ServerTimestamp: l'orologio del server Firebase garantisce
    // ordinamento cronologico anche con utenti che hanno orologi
    // locali diversi tra loro.
    timestamp: serverTimestamp(),
  };

  if (replyTo && replyTo.id) {
    payload.replyTo = {
      id: replyTo.id,
      text: (replyTo.text || "").slice(0, 200), // tronca per non saturare
      displayName: replyTo.displayName || "Utente",
    };
  }

  if (media && media.url && (media.type === "image" || media.type === "video")) {
    payload.media = {
      type: media.type,
      url: media.url,
      width: media.width || null,
      height: media.height || null,
    };
  }

  await push(messagesRef, payload);
  // Aggiorna il contatore messaggi (sblocca badge chatter_10 / chatter_100)
  bumpUserCounter(user.uid, "chatCount", 1);
}

/* ─────────────────────────────────────────────────────────────
   SONDAGGI (#21)
   Un sondaggio è un messaggio speciale con type === "poll".
   Path: messages/{id}
     {
       type: "poll",
       uid, displayName, photoURL,
       question: string,
       options: [{ id, text }],
       votes: { [uid]: optionId },   // un voto per utente
       closed: boolean,
       timestamp
     }
   ───────────────────────────────────────────────────────────── */

/** Crea un sondaggio in chat. options: array di stringhe (2-4). */
export async function createPoll({ user, question, options }) {
  if (!user?.uid) throw new Error("Utente mancante");
  const q = (question || "").trim();
  const cleanOptions = (options || [])
    .map((o) => (o || "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((text, i) => ({ id: `o${i + 1}`, text: text.slice(0, 80) }));

  if (!q) throw new Error("La domanda è obbligatoria");
  if (cleanOptions.length < 2) throw new Error("Servono almeno 2 opzioni");

  await push(ref(rtdb, "messages"), {
    type: "poll",
    uid: user.uid,
    displayName:
      user.displayName || (user.email ? user.email.split("@")[0] : "Anonimo"),
    photoURL: user.photoURL || null,
    question: q.slice(0, 200),
    options: cleanOptions,
    votes: {},
    closed: false,
    timestamp: serverTimestamp(),
  });
}

/** Vota (o annulla il voto) un'opzione del sondaggio. */
export async function votePoll(messageId, optionId, uid, currentVote) {
  if (!messageId || !optionId || !uid) return;
  const voteRef = ref(rtdb, `messages/${messageId}/votes/${uid}`);
  try {
    if (currentVote === optionId) {
      await remove(voteRef); // toggle off
    } else {
      await set(voteRef, optionId);
    }
  } catch (e) {
    console.error("votePoll error:", e);
  }
}

/** Chiude un sondaggio (solo l'autore/admin dovrebbe poterlo fare). */
export async function closePoll(messageId) {
  if (!messageId) return;
  try {
    await set(ref(rtdb, `messages/${messageId}/closed`), true);
  } catch (e) {
    console.error("closePoll error:", e);
  }
}

/**
 * Conta le reazioni di un messaggio raggruppate per emoji.
 * Input: oggetto reactions del messaggio { thumb: { uid1: true, ... }, heart: ... }
 * Output: [{ emoji: "👍", count: 3, uids: ["a","b","c"] }, ...]
 */
export function parseReactions(reactionsObj) {
  if (!reactionsObj || typeof reactionsObj !== "object") return [];
  return Object.entries(reactionsObj)
    .map(([key, users]) => ({
      key,
      emoji: keyToEmoji(key),
      uids: Object.keys(users || {}),
      count: Object.keys(users || {}).length,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}
