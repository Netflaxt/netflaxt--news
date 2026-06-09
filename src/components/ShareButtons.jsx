/* ─────────────────────────────────────────────────────────────
   src/components/ShareButtons.jsx
   Toolbar di condivisione: WhatsApp, Telegram, Instagram, X, Copia.
   Su mobile usa Web Share API nativa via il pulsante "..." (opzionale).
   ───────────────────────────────────────────────────────────── */
import React, { useState } from "react";

/* Icone SVG inline (no librerie esterne) */
const Icons = {
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.3 0-.5 0-.1-.6-1.5-.9-2.1-.2-.5-.5-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.2-.2-.5-.3z"/>
      <path d="M20.5 3.5C18.3 1.2 15.3 0 12 0 5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.3zM12 22c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.7 15.7 2 13.9 2 12 2 6.5 6.5 2 12 2c2.7 0 5.2 1 7.1 2.9 1.9 1.9 2.9 4.4 2.9 7.1 0 5.5-4.5 10-10 10z"/>
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.5.2.9.5 1.3.9.4.4.7.8.9 1.3.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.5-.5.9-.9 1.3-.4.4-.8.7-1.3.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.5-.2-.9-.5-1.3-.9-.4-.4-.7-.8-.9-1.3-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.5.5-.9.9-1.3.4-.4.8-.7 1.3-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1M12 0C8.7 0 8.3 0 7.1.1 5.8.1 4.9.3 4.1.6c-.8.3-1.5.7-2.2 1.4C1.3 2.6.8 3.3.5 4.1c-.3.8-.5 1.7-.6 3C-.1 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.3 2.2.6 3 .3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.7.5 3 .6 1.3.1 1.7.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.2-.3 3-.6.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.7.6-3 .1-1.3.1-1.7.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.2-.6-3-.3-.8-.7-1.5-1.4-2.2C21.4 1.3 20.7.8 19.9.5c-.8-.3-1.7-.5-3-.6C15.7 0 15.3 0 12 0z"/>
      <path d="M12 5.8c-3.4 0-6.2 2.8-6.2 6.2s2.8 6.2 6.2 6.2 6.2-2.8 6.2-6.2-2.8-6.2-6.2-6.2zm0 10.2c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/>
      <circle cx="18.4" cy="5.6" r="1.4"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

function ShareIconButton({ label, color, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="group relative h-10 w-10 rounded-full bg-bg-elevated hover:bg-border flex items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.5)]"
      style={{ color }}
    >
      {children}
      <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-bg-base border border-border text-[9px] font-semibold uppercase tracking-wider text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </button>
  );
}

export default function ShareButtons({ title = "", url = "", className = "" }) {
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareText = title ? `${title}` : "Leggi su Netflaxt News";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const open = (href) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleInstagram = async () => {
    // IG non ha un'API di share-link diretto: copiamo il link e suggeriamo all'utente di incollarlo
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setIgCopied(true);
      setTimeout(() => setIgCopied(false), 2200);
    } catch (e) {
      console.error("IG copy failed:", e);
    }
  };

  // Web Share API nativa (mobile): tasto extra solo se supportata
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const handleNative = async () => {
    try {
      await navigator.share({ title: shareText, url: shareUrl });
    } catch (e) {
      // utente ha annullato — ignora
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 p-1.5 rounded-full bg-bg-surface border border-border ${className}`}>
      <ShareIconButton
        label="WhatsApp"
        color="#25D366"
        onClick={() => open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`)}
      >
        {Icons.whatsapp}
      </ShareIconButton>

      <ShareIconButton
        label="Telegram"
        color="#229ED9"
        onClick={() => open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`)}
      >
        {Icons.telegram}
      </ShareIconButton>

      <ShareIconButton
        label={igCopied ? "Link copiato — incollalo su IG" : "Instagram (copia link)"}
        color={igCopied ? "#10B981" : "#E1306C"}
        onClick={handleInstagram}
      >
        {igCopied ? Icons.check : Icons.instagram}
      </ShareIconButton>

      <ShareIconButton
        label="X (Twitter)"
        color="#F8FAFC"
        onClick={() => open(`https://x.com/intent/post?text=${encodedText}&url=${encodedUrl}`)}
      >
        {Icons.x}
      </ShareIconButton>

      <ShareIconButton
        label={copied ? "Copiato!" : "Copia link"}
        color={copied ? "#10B981" : "#94A3B8"}
        onClick={handleCopy}
      >
        {copied ? Icons.check : Icons.copy}
      </ShareIconButton>

      {canNativeShare && (
        <ShareIconButton
          label="Altre app"
          color="#94A3B8"
          onClick={handleNative}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
          </svg>
        </ShareIconButton>
      )}
    </div>
  );
}
