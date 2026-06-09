/* ─────────────────────────────────────────────────────────────
   src/context/ThemeContext.jsx
   Gestione tema dark/light a livello app.
   - Persistenza in localStorage ("netflaxt_theme")
   - Applica l'attributo data-theme su <html> (i token CSS in
     index.css cambiano di conseguenza)
   - Aggiorna <meta name="theme-color"> per la chrome del browser
     mobile / PWA
   ───────────────────────────────────────────────────────────── */
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {}, setTheme: () => {} });

const STORAGE_KEY = "netflaxt_theme";
const THEME_COLORS = { dark: "#05070D", light: "#EEF2F7" };

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark"; // default: dark (identità del sito)
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.dark);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next === "light" ? "light" : "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
