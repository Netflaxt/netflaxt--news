/* ─────────────────────────────────────────────────────────────
   src/components/EagleEasterEgg.jsx
   Aquila in volo con sciarpa biancoceleste sovrapposta.
   Asset principale: /public/eagle.png (immagine reale della bald eagle).
   La sciarpa è un overlay SVG posizionato sopra il collo.
   Trigger: evento "netflaxt:eagle-fly" (bottone home).
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { playEagleCry } from "../utils/eagleSound";

export const EAGLE_TRIGGER_EVENT = "netflaxt:eagle-fly";

export default function EagleEasterEgg() {
  const [flightId, setFlightId] = useState(0);
  const endTimer = useRef(null);

  const trigger = () => {
    setFlightId((id) => id + 1);
    clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => setFlightId(0), 5200);
    playEagleCry().catch(() => {});
  };

  useEffect(() => {
    const handler = () => trigger();
    window.addEventListener(EAGLE_TRIGGER_EVENT, handler);
    return () => {
      window.removeEventListener(EAGLE_TRIGGER_EVENT, handler);
      clearTimeout(endTimer.current);
    };
  }, []);

  return (
    <>
      {/* 🦅 Immagine SEMPRE in DOM (hidden) per tenerla decoded in memoria.
          Evita il decode lag al primo trigger dell'aquila. */}
      <img
        src="/eagle.png"
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        style={{
          position: "fixed",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          left: "-9999px",
          top: 0,
        }}
      />
      {flightId !== 0 && <EagleFlight key={flightId} />}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   EagleFlight — orchestrazione singolo volo
   ───────────────────────────────────────────────────────────── */
function EagleFlight() {
  const stars = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        delay: i * 0.08,
        size: 6 + Math.random() * 10,
        offsetY: (Math.random() - 0.5) * 60,
        offsetX: Math.random() * 30,
      })),
    []
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden nf-eagle-root"
      aria-hidden="true"
    >
      {/* Flash iniziale */}
      <div className="nf-eagle-flash" />

      {/* Stelle dietro l'aquila */}
      <div className="nf-eagle-stars-track">
        {stars.map((s) => (
          <span
            key={s.id}
            className="nf-eagle-star"
            style={{
              top: `calc(38vh + ${s.offsetY}px)`,
              animationDelay: `${s.delay}s`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              left: `${-5 + s.offsetX}vw`,
            }}
          >
            <StarSVG />
          </span>
        ))}
      </div>

      {/* Scia luminosa */}
      <div className="nf-eagle-trail" />

      {/* Aquila — wrapper animato */}
      <div className="nf-eagle-wrap">
        <EagleWithScarf />
      </div>

      <style>{`
        @keyframes nf-eagle-fly {
          0%   { transform: translate(-20vw, 40vh) rotate(-4deg) scale(0.92); opacity: 0.6; }
          2%   { opacity: 1; }
          25%  { transform: translate(15vw, 22vh) rotate(2deg)  scale(1.05); }
          50%  { transform: translate(45vw, 38vh) rotate(-3deg) scale(1.05); }
          75%  { transform: translate(75vw, 24vh) rotate(4deg)  scale(1.1); }
          92%  { opacity: 1; }
          100% { transform: translate(125vw, 38vh) rotate(-2deg) scale(0.9); opacity: 0; }
        }
        @keyframes nf-eagle-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-4px) rotate(1deg); }
        }
        @keyframes nf-eagle-trail-kf {
          0%   { transform: translateX(-30vw); opacity: 0; }
          15%  { opacity: 0.7; }
          85%  { opacity: 0.7; }
          100% { transform: translateX(120vw); opacity: 0; }
        }
        @keyframes nf-eagle-flash-kf {
          0%   { opacity: 0; }
          5%   { opacity: 0.6; }
          25%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes nf-star-rise {
          0%   { transform: translate(-10vw, 0) scale(0) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; transform: translate(10vw, -10px) scale(1) rotate(45deg); }
          70%  { opacity: 0.9; }
          100% { transform: translate(125vw, 80px) scale(0.4) rotate(720deg); opacity: 0; }
        }
        @keyframes nf-scarf-wave {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(4deg); }
        }

        .nf-eagle-wrap {
          position: absolute;
          top: 0; left: 0;
          width: clamp(280px, 38vw, 620px);
          height: auto;
          will-change: transform, opacity;
          animation: nf-eagle-fly 5s cubic-bezier(0.55, 0.05, 0.45, 0.95) forwards;
          filter:
            drop-shadow(0 0 26px rgba(56, 189, 248, 0.75))
            drop-shadow(0 0 50px rgba(56, 189, 248, 0.4))
            drop-shadow(0 8px 22px rgba(0, 0, 0, 0.5));
          transform: translateZ(0); /* abilita GPU compositing */
          backface-visibility: hidden;
        }
        /* Su mobile: riduco drop-shadow per evitare lag/scoppio ritardato */
        @media (max-width: 768px) {
          .nf-eagle-wrap {
            filter: drop-shadow(0 0 16px rgba(56, 189, 248, 0.6))
                    drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45));
            animation-timing-function: cubic-bezier(0.45, 0.05, 0.55, 0.95);
          }
        }
        .nf-eagle-body {
          position: relative;
          width: 100%;
          height: auto;
          animation: nf-eagle-bob 0.42s ease-in-out infinite;
          will-change: transform;
        }
        /* Mobile: disabilito bob per ridurre carico GPU */
        @media (max-width: 768px) {
          .nf-eagle-body { animation: none; }
        }
        .nf-eagle-img {
          width: 100%;
          height: auto;
          display: block;
          /* L'immagine eagle.png è già orientata con becco verso destra,
             coerente con la direzione di movimento sx → dx */
        }
        .nf-eagle-scarf-svg {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .nf-eagle-scarf-tail {
          transform-origin: 670px 360px;
          transform-box: view-box;
          animation: nf-scarf-wave 0.55s ease-in-out infinite;
        }
        .nf-eagle-trail {
          position: absolute;
          top: 36vh;
          left: 0;
          width: 55vw;
          height: 10px;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(56, 189, 248, 0) 5%,
            rgba(56, 189, 248, 0.6) 40%,
            rgba(255, 255, 255, 0.95) 92%,
            transparent 100%
          );
          filter: blur(10px);
          border-radius: 999px;
          will-change: transform, opacity;
          animation: nf-eagle-trail-kf 5s ease-in-out forwards;
        }
        .nf-eagle-flash {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at 18% 45%,
            rgba(56, 189, 248, 0.35),
            transparent 55%
          );
          animation: nf-eagle-flash-kf 1.6s ease-out forwards;
        }
        .nf-eagle-stars-track { position: absolute; inset: 0; }
        .nf-eagle-star {
          position: absolute;
          display: inline-block;
          will-change: transform, opacity;
          animation: nf-star-rise 5s cubic-bezier(0.4, 0, 0.6, 1) forwards;
          color: #fff;
          filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.9));
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-eagle-wrap, .nf-eagle-body, .nf-eagle-trail,
          .nf-eagle-flash, .nf-eagle-star, .nf-eagle-scarf-tail {
            animation-duration: 0.01s !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   EagleWithScarf — immagine PNG dell'aquila + sciarpa SVG overlay
   La sciarpa è posizionata percentualmente per restare ancorata al
   collo dell'aquila in qualunque dimensione.
   ───────────────────────────────────────────────────────────── */
function EagleWithScarf() {
  return (
    <div className="nf-eagle-body">
      <img
        src="/eagle.png"
        alt=""
        className="nf-eagle-img"
        draggable={false}
        onError={(e) => {
          // Fallback se l'immagine non esiste ancora
          e.currentTarget.style.display = "none";
        }}
      />
      {/* Sciarpa overlay: SVG posizionata sopra il collo dell'aquila.
          Coordinate calibrate per immagine eagle.png ~560x320 (proporzione
          della foto fornita). Adattare se l'immagine ha proporzioni diverse. */}
      <ScarfOverlay />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ScarfOverlay — sciarpa biancoceleste in lana
   Calibrata per la nuova eagle.png (profilo laterale, becco a
   destra). viewBox 1000 x 540 ≈ proporzioni reali della foto.
   ───────────────────────────────────────────────────────────── */
function ScarfOverlay() {
  return (
    <svg
      className="nf-eagle-scarf-svg"
      viewBox="0 0 1000 540"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nfScarfNavy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="nfScarfNavyDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1e40af" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <pattern id="nfScarfWool" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M0 2 L4 2" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* SCIARPA — posizionata sul collo dell'aquila
          (giunzione tra testa bianca e corpo marrone).
          Coordinate misurate dal PNG eagle.png:
          - Punto collo: ≈ (660, 320) in viewBox 1000x540
          - Aquila inclinata in volo planante → rotazione -10° */}
      <g transform="rotate(-12 660 320)">

        {/* ANELLO ATTORNO AL COLLO (ellisse in prospettiva) */}
        <ellipse
          cx="660" cy="320"
          rx="58" ry="22"
          fill="url(#nfScarfNavy)"
          stroke="#0a0604"
          strokeWidth="2.2"
        />
        {/* Texture lana sopra l'anello */}
        <ellipse
          cx="660" cy="320"
          rx="58" ry="22"
          fill="url(#nfScarfWool)"
        />
        {/* Strisce sull'anello */}
        <path d="M 604 312 Q 660 308, 716 314"
              stroke="#ffffff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M 602 322 Q 660 318, 718 324"
              stroke="#7dd3fc" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M 604 332 Q 660 328, 716 334"
              stroke="#ffffff" strokeWidth="3.6" fill="none" strokeLinecap="round" />

        {/* Parte posteriore (sotto, semi-nascosta dietro al collo) */}
        <path
          d="M 604 320 Q 620 348, 660 354 Q 700 348, 716 320"
          fill="none"
          stroke="#0a0604"
          strokeWidth="1.4"
          opacity="0.5"
        />

        {/* LEMBO PRINCIPALE che pende dal davanti del collo */}
        <g className="nf-eagle-scarf-tail">
          <path
            d="M 624 338
               L 600 390
               L 596 450
               L 644 472
               L 696 462
               L 700 400
               L 692 336 Z"
            fill="url(#nfScarfNavy)"
            stroke="#0a0604"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Texture lana */}
          <path
            d="M 624 338
               L 600 390
               L 596 450
               L 644 472
               L 696 462
               L 700 400
               L 692 336 Z"
            fill="url(#nfScarfWool)"
          />

          {/* Strisce orizzontali alternate */}
          <path d="M 618 364 L 696 364"
                stroke="#ffffff" strokeWidth="6" />
          <path d="M 612 380 L 700 380"
                stroke="#7dd3fc" strokeWidth="5.4" />
          <path d="M 608 396 L 700 396"
                stroke="#ffffff" strokeWidth="4.8" />

          <path d="M 600 426 L 698 426"
                stroke="#ffffff" strokeWidth="6" />
          <path d="M 596 442 L 696 442"
                stroke="#7dd3fc" strokeWidth="5.4" />
          <path d="M 596 458 L 696 458"
                stroke="#ffffff" strokeWidth="4.8" />

          {/* Frange svolazzanti */}
          {Array.from({ length: 13 }).map((_, i) => {
            const x = 598 + i * 8;
            const y1 = i % 2 === 0 ? 468 : 470;
            const y2 = y1 + 28 + (i % 3) * 5;
            const sway = (i - 6) * 1.4;
            return (
              <line
                key={i}
                x1={x} y1={y1}
                x2={x + sway} y2={y2}
                stroke="#ffffff"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            );
          })}
        </g>

      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   STAR — stellina biancoceleste per la scia
   ───────────────────────────────────────────────────────────── */
function StarSVG() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="nfStarG" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </radialGradient>
      </defs>
      <path
        d="M12 2 L14.6 8.8 L22 9.3 L16.3 14.1 L18.2 21.2 L12 17.3 L5.8 21.2 L7.7 14.1 L2 9.3 L9.4 8.8 Z"
        fill="url(#nfStarG)"
        stroke="#0c4a6e"
        strokeWidth="0.6"
      />
    </svg>
  );
}
