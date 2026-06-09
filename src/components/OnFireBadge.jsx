/* ─────────────────────────────────────────────────────────────
   src/components/OnFireBadge.jsx
   Badge "ON FIRE" con fiamme reali animate via Canvas particle.
   Mostra il numero della streak attuale e disegna fiamme dietro al
   numero quando streak ≥ 3.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef } from "react";

export default function OnFireBadge({ streak = 0, size = "md" }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Intensità fiamma proporzionale alla streak (cap a 10)
  const intensity = Math.min(Math.max(streak, 0), 10);
  const active = streak >= 3;

  const dim =
    size === "sm" ? { w: 50, h: 60, font: 16 } :
    size === "lg" ? { w: 90, h: 110, font: 30 } :
    { w: 64, h: 78, font: 22 };

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = dim.w * dpr;
    canvas.height = dim.h * dpr;
    ctx.scale(dpr, dpr);

    const particles = [];
    const targetCount = 12 + intensity * 4;

    const spawn = () => {
      particles.push({
        x: dim.w / 2 + (Math.random() - 0.5) * (12 + intensity),
        y: dim.h - 5,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -0.8 - Math.random() * 1.4,
        life: 0,
        maxLife: 35 + Math.random() * 35,
        size: 4 + Math.random() * 4 + intensity * 0.3,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, dim.w, dim.h);

      // Spawn nuovi finché sotto target
      while (particles.length < targetCount) spawn();

      // Update & disegna
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.04; // accelera verso l'alto
        p.size *= 0.97;

        if (p.life >= p.maxLife || p.size < 1) {
          particles.splice(i, 1);
          continue;
        }

        const t = p.life / p.maxLife; // 0..1
        // Colore: rosso → arancione → giallo → trasparente
        let r, g, b, a;
        if (t < 0.3) {
          r = 255; g = 80 + t * 200; b = 30; a = 1;
        } else if (t < 0.7) {
          r = 255; g = 180 + (t - 0.3) * 200; b = 50; a = 1 - (t - 0.3) * 1.0;
        } else {
          r = 255; g = 230; b = 100; a = Math.max(0, 1 - (t - 0.3));
        }

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grd.addColorStop(0, `rgba(${r},${g|0},${b},${a * 0.9})`);
        grd.addColorStop(0.6, `rgba(${r},${g|0},${b},${a * 0.5})`);
        grd.addColorStop(1, `rgba(${r},${g|0},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, intensity, dim.w, dim.h]);

  if (streak <= 0) return null;

  return (
    <div
      className="relative inline-flex items-center justify-center select-none shrink-0"
      style={{ width: dim.w, height: dim.h }}
      title={
        active
          ? `🔥 Streak ${streak} pronostici azzeccati di fila!`
          : `Streak: ${streak}`
      }
    >
      {active && (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: dim.w,
            height: dim.h,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 flex flex-col items-center leading-none">
        <span
          className="font-black tabular-nums"
          style={{
            fontSize: dim.font,
            color: active ? "#fff5e6" : "#94a3b8",
            textShadow: active
              ? "0 0 10px rgba(255,140,0,0.9), 0 0 24px rgba(255,80,0,0.6)"
              : "none",
            fontFamily: "var(--font-display)",
          }}
        >
          {streak}
        </span>
        <span
          className="text-[8px] uppercase tracking-widest font-bold"
          style={{
            color: active ? "#fde047" : "#64748b",
            textShadow: active ? "0 0 6px rgba(255,80,0,0.7)" : "none",
            marginTop: 2,
          }}
        >
          {active ? "ON FIRE" : "STREAK"}
        </span>
      </div>
    </div>
  );
}
