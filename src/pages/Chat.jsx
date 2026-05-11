import React, { useState, useEffect, useRef } from "react";
import { rtdb } from "../firebase/firebase";
import { ref, push, onValue, orderByChild, query } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Chat() {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);
  const endRef = useRef(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const messagesRef = query(ref(rtdb, "messages"), orderByChild("timestamp"));
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, msg]) => ({ id, ...msg }));
        setMessages(list);
      } else {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    prevCountRef.current = messages.length;
  }, [messages]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const send = async () => {
    if (!draft.trim()) return;
    await push(ref(rtdb, "messages"), {
      text: draft.trim(),
      user: user.displayName || user.email.split("@")[0],
      email: user.email,
      timestamp: Date.now(),
    });
    setDraft("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const getInitials = (name) => name?.slice(0, 2).toUpperCase() || "??";

  const colors = [
    "from-sky-300 to-sky-500",
    "from-emerald-300 to-emerald-500",
    "from-amber-300 to-amber-500",
    "from-rose-300 to-rose-500",
    "from-violet-300 to-violet-500",
    "from-orange-300 to-orange-500",
  ];

  const getColor = (email) => {
    const index = email?.charCodeAt(0) % colors.length || 0;
    return colors[index];
  };

  // raggruppa per giorno
  const groupByDay = (msgs) => {
    const groups = [];
    let currentKey = null;
    msgs.forEach((m) => {
      const d = new Date(m.timestamp);
      const key = d.toLocaleDateString("it-IT");
      if (key !== currentKey) {
        groups.push({ day: key, items: [] });
        currentKey = key;
      }
      groups[groups.length - 1].items.push(m);
    });
    return groups;
  };

  const groups = groupByDay(messages);

  return (
    <main className="h-[calc(100vh-4rem)] bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Sfondo decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] rounded-full bg-sky-400/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-sky-500/30">
            #
          </div>
          <div>
            <h3 className="font-bold text-white">general</h3>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Chat live · Solo utenti registrati
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
            Live
          </span>
        </div>
      </header>

      {/* Messaggi */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div
              className={`text-center text-slate-400 transition-all duration-700 ${
                mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-500/10 border border-sky-500/20 mb-4">
                <svg className="w-10 h-10 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="font-bold text-white text-lg">Nessun messaggio ancora.</p>
              <p className="text-sm mt-1 text-slate-500">Sii il primo a scrivere nella curva digitale!</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-1">
            {groups.map((g, gi) => (
              <div key={gi}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-semibold px-2">
                    {g.day}
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
                {g.items.map((m, idx) => {
                  const isMe = m.email === user.email;
                  const prev = g.items[idx - 1];
                  const sameAuthor = prev && prev.email === m.email && m.timestamp - prev.timestamp < 5 * 60 * 1000;
                  const isNew = idx >= g.items.length - (messages.length - prevCountRef.current);
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""} ${
                        sameAuthor ? "mt-0.5" : "mt-3"
                      } ${isNew ? "animate-in" : ""}`}
                      style={{
                        animation: isNew
                          ? `chatIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both`
                          : undefined,
                      }}
                    >
                      <div className={`flex-shrink-0 w-8 ${sameAuthor ? "invisible" : ""}`}>
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColor(
                            m.email
                          )} flex items-center justify-center text-[10px] font-black text-white ring-2 ring-slate-900 shadow-lg`}
                        >
                          {getInitials(m.user)}
                        </div>
                      </div>
                      <div className={`flex-1 max-w-[78%] sm:max-w-[70%] ${isMe ? "flex flex-col items-end" : ""}`}>
                        {!sameAuthor && (
                          <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : ""}`}>
                            <span className="text-xs font-bold text-slate-200">{m.user}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(m.timestamp).toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                        <div
                          className={`relative inline-block px-4 py-2.5 text-sm leading-relaxed break-words shadow-md ${
                            isMe
                              ? "bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-2xl rounded-tr-md shadow-sky-500/20"
                              : "bg-slate-800/90 backdrop-blur text-slate-100 border border-slate-700/50 rounded-2xl rounded-tl-md"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative z-10 border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-xl p-3 sm:p-4">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Scrivi nella curva..."
              className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 focus:bg-slate-800 transition-all duration-200"
            />
          </div>
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="group relative px-5 py-3 bg-gradient-to-br from-sky-400 to-sky-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <span className="flex items-center gap-1.5">
              Invia
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </span>
          </button>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 text-center">
          Premi{" "}
          <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
            Invio
          </kbd>{" "}
          per inviare
        </div>
      </div>

      {/* keyframes via style tag (unica eccezione necessaria per animare i nuovi messaggi) */}
      <style>{`
        @keyframes chatIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </main>
  );
}