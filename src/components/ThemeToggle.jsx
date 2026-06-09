/* ─────────────────────────────────────────────────────────────
   src/components/ThemeToggle.jsx
   Pulsante per alternare tema dark/light. Mostra sole/luna con
   transizione morbida. Variante "compact" (icona) e "full" (con
   etichetta, per il menu mobile).
   ───────────────────────────────────────────────────────────── */
import React from "react";
import { useTheme } from "../context/ThemeContext";

function SunIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export default function ThemeToggle({ variant = "compact" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const nextLabel = isDark ? "Passa al tema chiaro" : "Passa al tema scuro";

  if (variant === "full") {
    return (
      <button
        onClick={toggleTheme}
        className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-bg-surface hover:border-border-strong transition group"
        aria-label={nextLabel}
      >
        <span className="flex items-center gap-3 text-sm font-semibold text-text-primary">
          <span className="relative h-5 w-5 text-accent">
            {isDark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
          </span>
          {isDark ? "Tema scuro" : "Tema chiaro"}
        </span>
        <span className="inline-flex items-center h-6 w-11 rounded-full border border-border bg-bg-base relative transition">
          <span
            className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-accent shadow transition-all duration-300 ${
              isDark ? "left-1" : "left-[26px]"
            }`}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-md border border-border hover:border-accent/50 bg-bg-surface/50 text-text-secondary hover:text-accent transition-all duration-300 flex items-center justify-center group"
      aria-label={nextLabel}
      title={nextLabel}
    >
      <span className="relative h-[18px] w-[18px]">
        <SunIcon
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-300 ${
            isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
          }`}
        />
        <MoonIcon
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-300 ${
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"
          }`}
        />
      </span>
    </button>
  );
}
