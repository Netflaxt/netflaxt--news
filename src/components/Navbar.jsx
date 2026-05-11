import React, { useState } from "react";
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Home", href: "/" },
    { label: "News", href: "/news" },
    { label: "Chat", href: "/chat" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="h-1 w-full bg-gradient-to-r from-sky-300 via-sky-400 to-sky-300" />

      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-sky-400 flex items-center justify-center ring-2 ring-slate-900 group-hover:ring-sky-500 transition">
                <span className="text-slate-900 font-bold text-sm tracking-tighter">NN</span>
              </div>
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="text-xl text-slate-900 tracking-wide"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}
              >
                NETFLAXT <span className="text-sky-500">NEWS</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                S.S. Lazio · Live
              </span>
            </div>
          </Link>

          {/* Links desktop */}
          <ul className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <li key={l.label}>
                <Link
                  to={l.href}
                  className="relative px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition group"
                >
                  {l.label}
                  <span className="absolute left-4 right-4 -bottom-0.5 h-0.5 bg-sky-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
                </Link>
              </li>
            ))}
          </ul>

          {/* CTA desktop */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition"
            >
              Login
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-sky-500 hover:text-slate-900 rounded-md transition border-2 border-slate-900 hover:border-sky-500"
            >
              Registrati
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-md hover:bg-slate-100 transition"
            aria-label="Apri menu"
          >
            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 border-t border-slate-200 pt-3 space-y-1">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.href}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700"
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2 px-3">
              <Link to="/login" className="flex-1 py-2 text-sm font-semibold border border-slate-300 rounded-md text-center">
                Login
              </Link>
              <Link to="/login" className="flex-1 py-2 text-sm font-semibold bg-slate-900 text-white rounded-md text-center">
                Registrati
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}