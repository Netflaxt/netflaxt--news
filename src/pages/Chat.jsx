import React, { useState, useEffect, useRef } from "react";
import { rtdb } from "../firebase/firebase";
import { ref, push, onValue, orderByChild, query } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Chat() {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    const messagesRef = query(ref(rtdb, "messages"), orderByChild("timestamp"));
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, msg]) => ({
          id,
          ...msg,
        }));
        setMessages(list);
      } else {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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
    "bg-sky-400", "bg-emerald-400", "bg-amber-400",
    "bg-rose-400", "bg-violet-400", "bg-orange-400"
  ];

  const getColor = (email) => {
    const index = email?.charCodeAt(0) % colors.length || 0;
    return colors[index];
  };

  return (
    <main className="h-[calc(100vh-4rem)] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900"># general</h3>
          <div className="text-xs text-slate-500 mt-0.5">
            Chat live · Solo utenti registrati
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-500">Live</span>
        </div>
      </header>

      {/* Messaggi */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-400">
              <div className="text-4xl mb-3">💬</div>
              <p className="font-semibold">Nessun messaggio ancora.</p>
              <p className="text-sm mt-1">Sii il primo a scrivere!</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.email === user.email;
            return (
              <div key={m.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                <div className={`flex-shrink-0 w-9 h-9 rounded-full ${getColor(m.email)} flex items-center justify-center text-xs font-bold text-slate-900`}>
                  {getInitials(m.user)}
                </div>
                <div className={`flex-1 max-w-[75%] ${isMe ? "items-end flex flex-col" : ""}`}>
                  <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : ""}`}>
                    <span className="text-sm font-semibold text-slate-900">{m.user}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(m.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-slate-900 text-white rounded-tr-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                  }`}>
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Scrivi un messaggio..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
            />
          </div>
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="px-5 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-sky-500 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Invia
          </button>
        </div>
        <div className="mt-2 text-[10px] text-slate-400 text-center">
          Premi <kbd className="px-1 py-0.5 bg-slate-100 rounded">Invio</kbd> per inviare
        </div>
      </div>
    </main>
  );
}