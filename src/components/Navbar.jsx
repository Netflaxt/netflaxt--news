import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { label: "Home", href: "/" },
    { label: "News", href: "/news" },
    { label: "Chat", href: "/chat" },
    { label: "Chi sono", href: "/about" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (href) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const Avatar = ({ size = "h-7 w-7" }) => (
    user.photoURL ? (
      <img
        src={user.photoURL}
        alt="avatar"
        className={`${size} rounded-full object-cover ring-2 ring-sky-400`}
      />
    ) : (
      <span className={`${size} rounded-full bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center text-[10px] font-black text-white`}>
        {(user.displayName || user.email).slice(0, 2).toUpperCase()}
      </span>
    )
  );

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/85 backdrop-blur-xl border-b border-slate-200 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]"
          : "bg-white/70 backdrop-blur-md border-b border-transparent"
      }`}
    >
      <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-sky-400 to-transparent" />

      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center ring-1 ring-slate-900/10 shadow-sm shadow-sky-500/30 group-hover:shadow-md group-hover:shadow-sky-500/40 group-hover:scale-105 transition-all duration-300">
                <span className="text-white font-black text-sm tracking-tighter drop-shadow-sm">
                  NN
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="text-xl text-slate-900 tracking-wide"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}
              >
                NETFLAXT <span className="text-sky-500">NEWS</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-slate-400 mt-0.5">
                Fan site · Biancoceleste
              </span>
            </div>
          </Link>

          {/* Links desktop */}
          <ul className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <li key={l.label}>
                  <Link
                    to={l.href}
                    className={`relative px-4 py-2 text-sm font-semibold transition-colors duration-200 group ${
                      active ? "text-sky-600" : "text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    {l.label}
                    <span
                      className={`absolute left-3 right-3 -bottom-0.5 h-[2px] bg-sky-400 origin-left transition-transform duration-300 ${
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* CTA desktop */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100 transition group"
                >
                  <Avatar size="h-7 w-7" />
                  <span className="text-sm text-slate-700 font-medium group-hover:text-sky-600 transition max-w-[140px] truncate">
                    {user.displayName || user.email}
                  </span>
                </Link>
                {user.email === ADMIN_EMAIL && (
                  <Link
                    to="/admin"
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 rounded-md hover:bg-sky-100 hover:border-sky-300 transition"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-white hover:bg-slate-900 border border-slate-200 hover:border-slate-900 rounded-md transition-all duration-200"
                >
                  Esci
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition"
                >
                  Accedi
                </Link>
                <Link
                  to="/login"
                  className="relative px-4 py-2 text-sm font-bold text-white bg-slate-900 rounded-md overflow-hidden group transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/30"
                >
                  <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                    Registrati
                  </span>
                  <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-md hover:bg-slate-100 transition"
            aria-label="Apri menu"
          >
            <div className="w-6 h-6 relative">
              <span className={`absolute left-0 top-1.5 h-0.5 w-6 bg-slate-900 transition-all duration-300 ${open ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`absolute left-0 top-3 h-0.5 w-6 bg-slate-900 transition-all duration-200 ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-[18px] h-0.5 w-6 bg-slate-900 transition-all duration-300 ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${open ? "max-h-[500px] pb-4" : "max-h-0"}`}>
          <div className="border-t border-slate-200 pt-3 space-y-1">
            {links.map((l, i) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.label}
                  to={l.href}
                  className={`block px-3 py-2.5 rounded-md text-base font-medium transition-all duration-200 ${
                    active
                      ? "bg-sky-50 text-sky-700 border-l-2 border-sky-400 pl-3.5"
                      : "text-slate-700 hover:bg-slate-50 hover:text-sky-700"
                  }`}
                  style={{ transitionDelay: open ? `${i * 30}ms` : "0ms" }}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="flex gap-2 pt-3 px-1">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex-1 py-2.5 text-sm font-semibold border border-slate-300 rounded-md text-center text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2"
                  >
                    <Avatar size="h-5 w-5" />
                    Profilo
                  </Link>
                  {user.email === ADMIN_EMAIL && (
                    <Link
                      to="/admin"
                      className="flex-1 py-2.5 text-sm font-semibold border border-sky-400 bg-sky-50 text-sky-700 rounded-md text-center hover:bg-sky-100 transition"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-md hover:bg-red-600 transition"
                  >
                    Esci
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="flex-1 py-2.5 text-sm font-semibold border border-slate-300 rounded-md text-center hover:bg-slate-50 transition">
                    Accedi
                  </Link>
                  <Link to="/login" className="flex-1 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-md text-center hover:bg-sky-500 hover:text-slate-900 transition">
                    Registrati
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}