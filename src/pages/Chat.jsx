import React, { useState, useRef, useEffect } from "react";

/**
 * Chat — Netflaxt News
 * Layout 3 colonne: canali (sx), conversazione (centro), utenti online (dx).
 * Mobile: solo conversazione + drawer canali.
 */
export default function Chat() {
  const channels = [
    { id: 1, name: "general", unread: 0 },
    { id: 2, name: "match-live", unread: 12, hot: true },
    { id: 3, name: "calciomercato", unread: 3 },
    { id: 4, name: "tattica", unread: 0 },
    { id: 5, name: "sfottò-derby", unread: 47, hot: true },
    { id: 6, name: "off-topic", unread: 0 },
  ];

  const initialMessages = [
    {
      id: 1,
      user: "AquilaReale",
      avatar: "AR",
      color: "bg-sky-400",
      time: "20:14",
      text: "Sarri sta provando il 4-3-3 anche oggi in rifinitura. Conferma totale.",
    },
    {
      id: 2,
      user: "BiancocelesteDoc",
      avatar: "BD",
      color: "bg-amber-400",
      time: "20:15",
      text: "Speriamo recuperi Zaccagni in tempo, senza di lui sulla fascia si soffre.",
    },
    {
      id: 3,
      user: "Curva_Nord_88",
      avatar: "CN",
      color: "bg-emerald-400",
      time: "20:16",
      text: "Stadio sold out anche domenica, biglietti finiti in 2 ore 🦅",
      reactions: [{ emoji: "🔥", count: 8 }, { emoji: "🦅", count: 14 }],
    },
    {
      id: 4,
      user: "Tu",
      avatar: "TU",
      color: "bg-slate-900",
      time: "20:18",
      text: "Notizie sul rinnovo del centrocampista? Ho letto qualcosa stamattina",
      self: true,
    },
    {
      id: 5,
      user: "MisterX",
      avatar: "MX",
      color: "bg-rose-400",
      time: "20:19",
      text: "Si si confermato, contatti avanzati. Lotito ha incontrato l'agente lunedì.",
    },
  ];

  const onlineUsers = [
    { name: "AquilaReale", color: "bg-sky-400", status: "online" },
    { name: "BiancocelesteDoc", color: "bg-amber-400", status: "online" },
    { name: "Curva_Nord_88", color: "bg-emerald-400", status: "online" },
    { name: "MisterX", color: "bg-rose-400", status: "online" },
    { name: "LazioFan2010", color: "bg-violet-400", status: "away" },
    { name: "ImmobileGoal", color: "bg-orange-400", status: "online" },
  ];

  const [activeChannel, setActiveChannel] = useState(2);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!draft.trim()) return;
    setMessages([
      ...messages,
      {
        id: Date.now(),
        user: "Tu",
        avatar: "TU",
        color: "bg-slate-900",
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        text: draft.trim(),
        self: true,
      },
    ]);
    setDraft("");
  };

  const current = channels.find((c) => c.id === activeChannel);

  return (
    <main className="h-[calc(100vh-4rem)] bg-slate-50 flex">
      {/* SIDEBAR CANALI */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col border-r border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="text-xs uppercase tracking-[0.2em] text-sky-300 font-semibold">
            Comunità
          </div>
          <h2
            className="text-2xl mt-1"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Curva Digitale
          </h2>
        </div>

        <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          Canali
        </div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChannel(c.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition ${
                activeChannel === c.id
                  ? "bg-sky-400 text-slate-900 font-semibold"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="opacity-60">#</span>
                {c.name}
                {c.hot && <span className="text-[10px]">🔥</span>}
              </span>
              {c.unread > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeChannel === c.id ? "bg-slate-900 text-white" : "bg-sky-400 text-slate-900"
                  }`}
                >
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* utente corrente */}
        <div className="p-3 border-t border-slate-800 flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-sky-400 flex items-center justify-center text-slate-900 font-bold text-sm">
              TU
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Tu</div>
            <div className="text-xs text-emerald-400">online</div>
          </div>
        </div>
      </aside>

      {/* CONVERSAZIONE */}
      <section className="flex-1 flex flex-col bg-white">
        {/* Header canale */}
        <header className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">#</span>
              <h3 className="font-bold text-slate-900">{current?.name}</h3>
              {current?.hot && <span className="text-sm">🔥</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {onlineUsers.filter((u) => u.status === "online").length} membri online ·{" "}
              <span className="text-emerald-600 font-semibold">live</span>
            </div>
          </div>
          <button className="text-sm px-3 py-1.5 border border-slate-200 rounded-md text-slate-700 hover:border-sky-400 hover:text-sky-600">
            Info canale
          </button>
        </header>

        {/* Messaggi */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 bg-slate-50/50">
          <div className="text-center">
            <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Oggi
            </div>
          </div>

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.self ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex-shrink-0 w-9 h-9 rounded-full ${m.color} flex items-center justify-center text-xs font-bold ${
                  m.color === "bg-slate-900" ? "text-white" : "text-slate-900"
                }`}
              >
                {m.avatar}
              </div>
              <div className={`flex-1 max-w-[75%] ${m.self ? "items-end flex flex-col" : ""}`}>
                <div className={`flex items-baseline gap-2 mb-1 ${m.self ? "flex-row-reverse" : ""}`}>
                  <span className="text-sm font-semibold text-slate-900">{m.user}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{m.time}</span>
                </div>
                <div
                  className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.self
                      ? "bg-slate-900 text-white rounded-tr-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
                {m.reactions && (
                  <div className={`mt-1.5 flex gap-1 ${m.self ? "justify-end" : ""}`}>
                    {m.reactions.map((r, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-xs flex items-center gap-1 hover:border-sky-400 cursor-pointer"
                      >
                        <span>{r.emoji}</span>
                        <span className="font-semibold text-slate-600">{r.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* typing indicator */}
          <div className="flex gap-3 items-center">
            <div className="w-9 h-9 rounded-full bg-violet-400 flex items-center justify-center text-xs font-bold text-slate-900">
              LF
            </div>
            <div className="px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
            <span className="text-xs text-slate-500">LazioFan2010 sta scrivendo…</span>
          </div>

          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <button className="p-2.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-md transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={`Messaggio in #${current?.name}…`}
                className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-sky-600">
                😊
              </button>
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
            Premi <kbd className="px-1 py-0.5 bg-slate-100 rounded">Invio</kbd> per inviare ·
            Rispetta le regole della community
          </div>
        </div>
      </section>

      {/* SIDEBAR UTENTI ONLINE */}
      <aside className="hidden xl:flex w-64 bg-white border-l border-slate-200 flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="text-xs uppercase tracking-[0.2em] text-sky-500 font-semibold">
            Online
          </div>
          <h2
            className="text-2xl mt-1 text-slate-900"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Chi c'è ora
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {onlineUsers.map((u) => (
            <div
              key={u.name}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              <div className="relative">
                <div
                  className={`w-8 h-8 rounded-full ${u.color} flex items-center justify-center text-xs font-bold text-slate-900`}
                >
                  {u.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                    u.status === "online" ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{u.name}</div>
                <div className="text-[10px] text-slate-500 capitalize">{u.status}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}