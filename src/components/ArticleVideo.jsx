/* ─────────────────────────────────────────────────────────────
   src/components/ArticleVideo.jsx
   Render video di un articolo (Cloudinary diretto o YouTube/Vimeo embed).

   Fix definitivo iOS/Android:
   - URL Cloudinary trasformato al volo in MP4 + H.264 + AAC:
     /upload/f_mp4,vc_h264,ac_aac,q_auto/...
     Garantisce un container/codec supportato da OGNI browser
     (iOS Safari NON supporta webm, e i .mov nativi iPhone a volte
     non vengono interpretati dentro un <video> tag).
   - preload="metadata" → iOS deve poter leggere durata/codec PRIMA
     che l'utente prema play, altrimenti play() viene rigettato.
   - Niente crossOrigin (causerebbe CORS preflight inutile).
   - <video> sempre nel DOM + overlay play che chiama videoRef.play()
     SINCRONO nello stesso click handler → iOS riconosce il gesto.
   ───────────────────────────────────────────────────────────── */
import React, { useRef, useState } from "react";
import { parseYouTube, parseVimeo } from "../utils/videoUpload";

/**
 * Aggiunge alle URL Cloudinary video il chain di trasformazioni
 * `f_mp4,vc_h264,ac_aac,q_auto` che garantisce mp4/h264/aac =
 * universalmente compatibile (iOS Safari, Android Chrome, desktop).
 *
 * Esempi:
 *   in:  https://res.cloudinary.com/X/video/upload/v123/folder/file.mov
 *   out: https://res.cloudinary.com/X/video/upload/f_mp4,vc_h264,ac_aac,q_auto/v123/folder/file.mp4
 */
function toCloudinaryMp4(url) {
  if (!url || typeof url !== "string") return url;
  // Solo Cloudinary video
  const m = url.match(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/i
  );
  if (!m) return url;
  let [, base, rest] = m;
  // Se ci sono già trasformazioni della prima "directory", non
  // ri-iniettiamo per non rompere quelle esistenti
  const hasTransforms = /^[a-z]+_[^/]+(,[a-z]+_[^/]+)*\//i.test(rest);
  if (hasTransforms) {
    // Già trasformata: aggiungiamo f_mp4 al chain solo se manca
    if (!/f_mp4|f_auto/i.test(rest)) {
      const slash = rest.indexOf("/");
      rest = rest.slice(0, slash) + ",f_mp4,vc_h264,ac_aac" + rest.slice(slash);
    }
  } else {
    rest = "f_mp4,vc_h264,ac_aac,q_auto/" + rest;
  }
  // Forza estensione .mp4 nell'URL finale (alcuni CDN gli badano)
  rest = rest.replace(/\.(mov|webm|mkv|avi|m4v|hevc|3gp)(\?|$)/i, ".mp4$2");
  return base + rest;
}

export default function ArticleVideo({ video }) {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [embedActivated, setEmbedActivated] = useState(false);

  if (!video?.url) return null;

  // YouTube/Vimeo: embedUrl
  let embedUrl = video.embedUrl;
  let thumbnail = video.thumbnail;
  if (!embedUrl) {
    if (video.type === "youtube") {
      const y = parseYouTube(video.url);
      embedUrl = y?.embedUrl;
      thumbnail = thumbnail || y?.thumbnail;
    } else if (video.type === "vimeo") {
      const v = parseVimeo(video.url);
      embedUrl = v?.embedUrl;
    }
  }

  const isEmbed = video.type === "youtube" || video.type === "vimeo";
  // URL del file video con codec garantito (solo per Cloudinary direct)
  const fileUrl = toCloudinaryMp4(video.url);

  const handleStartVideo = () => {
    setStarted(true);
    const v = videoRef.current;
    if (!v) return;
    try {
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Se iOS rifiuta autoplay: proviamo a forzare muted poi
          // riprovare. Spesso scioglie il blocco.
          try {
            v.muted = true;
            v.play().catch(() => {});
          } catch {
            /* ignora */
          }
        });
      }
    } catch {
      /* ignora */
    }
  };

  return (
    <div className="my-8 relative rounded-2xl overflow-hidden border border-border bg-black aspect-video shadow-2xl group">
      {isEmbed ? (
        embedActivated ? (
          <iframe
            src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`Video — ${video.type}`}
          />
        ) : (
          <PlayPoster
            thumbnail={thumbnail}
            label={video.type}
            onClick={() => setEmbedActivated(true)}
          />
        )
      ) : (
        <>
          <video
            ref={videoRef}
            controls
            playsInline
            webkit-playsinline="true"
            preload="metadata"
            poster={thumbnail || undefined}
            controlsList="nodownload"
            className="absolute inset-0 w-full h-full object-contain bg-black"
          >
            <source src={fileUrl} type="video/mp4" />
            {/* fallback all'URL originale se il transform non è disponibile */}
            <source src={video.url} />
            Il tuo browser non supporta la riproduzione di questo video.
          </video>
          {!started && (
            <PlayPoster
              thumbnail={thumbnail}
              label="VIDEO"
              onClick={handleStartVideo}
              absolute
            />
          )}
        </>
      )}
    </div>
  );
}

function PlayPoster({ thumbnail, label, onClick, absolute }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${absolute ? "absolute" : ""} inset-0 w-full h-full flex items-center justify-center group cursor-pointer`}
      aria-label="Riproduci video"
    >
      {thumbnail && (
        <img
          src={thumbnail}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
      <PlayButton />
      <span className="absolute bottom-3 left-3 px-2 py-1 bg-bg-base/80 backdrop-blur text-text-primary text-[10px] font-bold uppercase tracking-widest rounded">
        ▶ {label}
      </span>
    </button>
  );
}

function PlayButton() {
  return (
    <span className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-accent text-text-inverse shadow-[0_0_40px_-4px_rgba(56,189,248,0.85)] group-hover:scale-110 transition-transform duration-300">
      <svg className="w-9 h-9 ml-1" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
    </span>
  );
}
