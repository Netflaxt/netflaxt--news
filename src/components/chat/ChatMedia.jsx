/* ─────────────────────────────────────────────────────────────
   src/components/chat/ChatMedia.jsx
   Render di un media (foto o video) dentro un messaggio chat.
   - Immagine: anteprima compatta, click → lightbox a tutto schermo
   - Video: player MP4/H.264 (mobile-safe), play al tap, niente preload
   Pensato per restare FLUIDO: lazy load, preload="none", decode async.
   ───────────────────────────────────────────────────────────── */
import React, { useRef, useState } from "react";
import { toCloudinaryMp4 } from "../../utils/videoUpload";

export default function ChatMedia({ media }) {
  if (!media?.url) return null;
  if (media.type === "image") return <ChatImage media={media} />;
  if (media.type === "video") return <ChatVideo media={media} />;
  return null;
}

function ChatImage({ media }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block rounded-xl overflow-hidden w-full max-w-[280px] sm:max-w-[340px] focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-zoom-in"
        aria-label="Apri immagine a tutto schermo"
      >
        <img
          src={media.url}
          alt="Immagine condivisa in chat"
          loading="lazy"
          decoding="async"
          className="block w-full h-auto max-h-[420px] object-cover bg-bg-elevated"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-3 sm:p-6 nf-lightbox-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={media.url}
            alt="Immagine condivisa in chat"
            className="max-w-[98vw] max-h-[92vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl backdrop-blur transition"
            aria-label="Chiudi"
          >
            ✕
          </button>
          <style>{`
            @keyframes nf-lightbox-in-kf { from { opacity: 0 } to { opacity: 1 } }
            .nf-lightbox-in { animation: nf-lightbox-in-kf 0.2s ease-out both; }
          `}</style>
        </div>
      )}
    </>
  );
}

function ChatVideo({ media }) {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const fileUrl = toCloudinaryMp4(media.url);

  const handleStart = () => {
    setStarted(true);
    const v = videoRef.current;
    if (!v) return;
    try {
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          try {
            v.muted = true;
            v.play().catch(() => {});
          } catch {}
        });
      }
    } catch {}
  };

  return (
    <div className="relative mt-1 mb-0.5 rounded-lg overflow-hidden border border-border/60 bg-black max-w-[240px] sm:max-w-[300px] aspect-video">
      <video
        ref={videoRef}
        controls
        playsInline
        webkit-playsinline="true"
        preload="none"
        controlsList="nodownload"
        className="absolute inset-0 w-full h-full object-contain bg-black"
      >
        <source src={fileUrl} type="video/mp4" />
        <source src={media.url} />
      </video>
      {!started && (
        <button
          type="button"
          onClick={handleStart}
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/30 group"
          aria-label="Riproduci video"
        >
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-accent text-text-inverse shadow-[0_0_28px_-4px_rgba(56,189,248,0.85)] group-hover:scale-110 transition-transform">
            <svg className="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
