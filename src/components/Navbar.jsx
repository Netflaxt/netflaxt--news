/* ─────────────────────────────────────────────────────────────
   src/components/Navbar.jsx
   Patched: badge "nuovo articolo" sul link "News" quando c'è
   stato un articolo pubblicato dopo l'ultima visita dell'utente.
   ───────────────────────────────────────────────────────────── */
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useNewArticlesBadge from "../hooks/useNewArticlesBadge";
import ThemeToggle from "./ThemeToggle";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

/* ─────────────────────────────────────────────────────────────
   Avatar utente — mostra foto profilo se presente, iniziali altrimenti
   ───────────────────────────────────────────────────────────── */
function UserAvatar({
  user,
  sizeClass = "h-7 w-7",
  textClass = "text-[10px]",
  ring = "ring-2 ring-bg-base",
}) {
  const [imgError, setImgError] = useState(false);
  const initials = (user.displayName || user.email || "??")
    .slice(0, 2)
    .toUpperCase();
  const hasPhoto = !!user.photoURL && !imgError;

  useEffect(() => {
    setImgError(false);
  }, [user.photoURL]);

  if (hasPhoto) {
    return (
      <span
        key={user.photoURL}
        className={`${sizeClass} rounded-full overflow-hidden bg-bg-elevated ${ring} shrink-0 block`}
      >
        <img
          src={user.photoURL}
          alt={user.displayName || "Profilo"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          draggable="false"
        />
      </span>
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-full bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center ${textClass} font-black text-text-inverse ${ring} shrink-0`}
    >
      {initials}
    </span>
  );
}

/* Punto rosso "nuovo articolo" — riusabile per desktop + mobile */
function NewArticleDot({ className = "" }) {
  return (
    <span
      className={`absolute flex h-2.5 w-2.5 ${className}`}
      aria-label="Nuovo articolo pubblicato"
      title="Nuovo articolo pubblicato"
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-error opacity-70 animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error ring-2 ring-bg-base" />
    </span>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const navRef = useRef(null);
  const linksRef = useRef({});

  // ✨ Badge "nuovo articolo"
  const { hasNew } = useNewArticlesBadge();

  const links = [
    { label: "Home", href: "/" },
    { label: "News", href: "/news", badge: hasNew },
    { label: "Calendario", href: "/calendario" },
    { label: "Pronostici", href: "/pronostici" },
    { label: "Classifica", href: "/classifica" },
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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const updateIndicator = () => {
    const activeLink = links.find((l) => isActive(l.href));
    if (!activeLink || !linksRef.current[activeLink.href] || !navRef.current) {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const el = linksRef.current[activeLink.href];
    const navRect = navRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({
      left: elRect.left - navRect.left,
      width: elRect.width,
      opacity: 1,
    });
  };

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "bg-bg-base/80 backdrop-blur-xl border-b border-border"
            : "bg-bg-base/40 backdrop-blur-md border-b border-transparent"
        }`}
      >
        <div
          className={`h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent transition-opacity duration-500 ${
            scrolled ? "opacity-40" : "opacity-0"
          }`}
        />

        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <div className="relative">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-bg-elevated to-bg-surface flex items-center justify-center ring-1 ring-accent/30 shadow-[0_0_20px_-4px_rgba(56,189,248,0.4)] group-hover:shadow-[0_0_28px_-2px_rgba(56,189,248,0.7)] group-hover:ring-accent/60 group-hover:scale-105 transition-all duration-300 overflow-hidden">
                  <img
                    src="/logo.png"
                    alt="Netflaxt News"
                    className="h-7 w-7 object-contain"
                    draggable="false"
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success ring-2 ring-bg-base" />
                </span>
              </div>
              <div className="flex flex-col leading-none">
                <span
                  className="text-xl text-text-primary tracking-wide"
                  style={{
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.04em",
                  }}
                >
                  NETFLAXT <span className="text-accent">NEWS</span>
                </span>
                <span className="hidden sm:block text-[9px] uppercase tracking-[0.28em] text-text-muted mt-0.5">
                  Fan site · Biancoceleste
                </span>
              </div>
            </Link>

            {/* Links desktop */}
            <div ref={navRef} className="hidden md:flex relative items-center">
              <div
                className="absolute h-8 top-1/2 -translate-y-1/2 rounded-md bg-accent/10 border border-accent/20 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                style={{
                  left: `${indicator.left}px`,
                  width: `${indicator.width}px`,
                  opacity: indicator.opacity,
                }}
              />
              <ul className="relative flex items-center gap-1">
                {links.map((l) => {
                  const active = isActive(l.href);
                  return (
                    <li key={l.label}>
                      <Link
                        ref={(el) => (linksRef.current[l.href] = el)}
                        to={l.href}
                        className={`relative px-3.5 py-2 text-sm font-medium transition-colors duration-300 rounded-md ${
                          active
                            ? "text-accent"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {l.label}
                        {/* Badge "nuovo" sul link News */}
                        {l.badge && !active && (
                          <NewArticleDot className="top-1 -right-0.5" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* CTA desktop */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <ThemeToggle />
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full hover:bg-bg-elevated border border-transparent hover:border-border transition-all duration-300 group"
                  >
                    <UserAvatar
                      user={user}
                      sizeClass="h-7 w-7"
                      textClass="text-[10px]"
                    />
                    <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition max-w-[120px] truncate">
                      {user.displayName || user.email.split("@")[0]}
                    </span>
                  </Link>

                  {user.email === ADMIN_EMAIL && (
                    <Link
                      to="/admin"
                      className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-accent bg-accent/10 border border-accent/30 rounded-md hover:bg-accent/20 hover:border-accent/50 transition-all duration-300"
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-border-strong rounded-md transition-all duration-300"
                  >
                    Esci
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-300"
                  >
                    Accedi
                  </Link>
                  <Link
                    to="/login"
                    className="group relative px-4 py-2 text-sm font-semibold text-text-inverse bg-accent rounded-md overflow-hidden transition-all duration-300 hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.7)]"
                  >
                    <span className="relative z-10">Registrati</span>
                    <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                    <span className="relative z-10 ml-1 inline-block transition-transform duration-300 group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile: theme toggle compatto + hamburger */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <button
              onClick={() => setOpen(!open)}
              className="relative w-10 h-10 rounded-md border border-border hover:border-border-strong bg-bg-surface/50 transition-colors duration-300"
              aria-label={open ? "Chiudi menu" : "Apri menu"}
              aria-expanded={open}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <span
                  className={`block h-[1.5px] w-5 bg-text-primary transition-all duration-300 origin-center ${
                    open ? "rotate-45 translate-y-[3.5px]" : ""
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-5 bg-text-primary transition-all duration-300 origin-center ${
                    open ? "-rotate-45 -translate-y-[3.5px]" : ""
                  }`}
                />
              </div>
              {/* Badge "nuovo" sul toggle mobile quando il menu è chiuso */}
              {hasNew && !open && (
                <NewArticleDot className="top-1.5 right-1.5" />
              )}
            </button>
            </div>
          </div>
        </nav>
      </header>

      {/* MOBILE MENU */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-bg-base/95 backdrop-blur-xl"
          onClick={() => setOpen(false)}
        />

        <div className="relative h-full pt-20 px-6 flex flex-col">
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent/10 blur-3xl rounded-full pointer-events-none" />

          <nav className="relative flex flex-col gap-1 mt-4">
            {links.map((l, i) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.label}
                  to={l.href}
                  className={`group flex items-center justify-between px-4 py-4 rounded-lg text-2xl font-semibold transition-all duration-300 ${
                    active
                      ? "bg-accent/10 border border-accent/20 text-accent"
                      : "border border-transparent text-text-primary hover:bg-bg-surface hover:border-border"
                  }`}
                  style={{
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.04em",
                    animation: open
                      ? `fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms both`
                      : "none",
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`block w-1 h-6 rounded-full transition-all duration-300 ${
                        active
                          ? "bg-accent"
                          : "bg-transparent group-hover:bg-text-muted"
                      }`}
                    />
                    {l.label.toUpperCase()}
                    {/* Badge mobile menu */}
                    {l.badge && !active && (
                      <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error/15 border border-error/40 text-[9px] uppercase tracking-wider text-error font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-error" />
                        Novità
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-base transition-all duration-300 ${
                      active
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                    }`}
                  >
                    →
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="my-6 divider-glow" />

          <div
            className="relative flex flex-col gap-2"
            style={{
              animation: open
                ? "fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) 280ms both"
                : "none",
            }}
          >
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-bg-surface hover:border-border-strong transition"
                >
                  <UserAvatar
                    user={user}
                    sizeClass="h-10 w-10"
                    textClass="text-sm"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {user.displayName || "Profilo"}
                    </span>
                    <span className="text-xs text-text-muted truncate">
                      {user.email}
                    </span>
                  </div>
                </Link>

                {user.email === ADMIN_EMAIL && (
                  <Link
                    to="/admin"
                    className="px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/30 text-center hover:bg-accent/20 transition"
                  >
                    Pannello Admin
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="px-4 py-3 rounded-lg text-sm font-semibold text-text-primary border border-border hover:border-error hover:text-error transition"
                >
                  Esci
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-3 rounded-lg text-sm font-semibold text-text-primary border border-border hover:border-border-strong text-center transition"
                >
                  Accedi
                </Link>
                <Link
                  to="/login"
                  className="px-4 py-3 rounded-lg text-sm font-bold text-text-inverse bg-accent hover:bg-accent-hover text-center transition shadow-[0_0_24px_-6px_rgba(56,189,248,0.6)]"
                >
                  Registrati gratis →
                </Link>
              </>
            )}
          </div>

          <div
            className="relative mt-6"
            style={{
              animation: open
                ? "fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) 340ms both"
                : "none",
            }}
          >
            <ThemeToggle variant="full" />
          </div>

          <div className="mt-auto pb-8 pt-6 text-center">
            <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted">
              Fan site · Biancoceleste
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
