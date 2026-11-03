import { useEffect, useRef } from 'react';

const COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#ec4899', '#facc15', '#f97316'];

type Piece = { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vr: number; shape: 0 | 1 };

/** Dispara confetes dentro do elemento pai (ex.: um modal) sempre que `trigger` muda ou ao montar. */
export function ConfettiBurst({ trigger = 0 }: { trigger?: unknown }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || trigger === false || trigger === null) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let raf = 0;
    const start = window.setTimeout(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width, h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      const pieces: Piece[] = [];
      for (const side of [0, 1]) {
        for (let i = 0; i < 70; i++) {
          const angle = side === 0 ? -Math.PI / 3 - Math.random() * 0.6 : -Math.PI * 2 / 3 + Math.random() * 0.6;
          const speed = 7 + Math.random() * 9;
          pieces.push({ x: side === 0 ? 0 : w, y: h * 0.75, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 5 + Math.random() * 6, color: COLORS[(Math.random() * COLORS.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, shape: Math.random() > 0.5 ? 1 : 0 });
        }
      }
      for (let i = 0; i < 50; i++) {
        pieces.push({ x: w / 2, y: h * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 10 - 2, size: 5 + Math.random() * 6, color: COLORS[(Math.random() * COLORS.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, shape: Math.random() > 0.5 ? 1 : 0 });
      }
      const tick = () => {
        frame++;
        ctx.clearRect(0, 0, w, h);
        const fade = Math.max(0, 1 - Math.max(0, frame - 120) / 60);
        ctx.globalAlpha = fade;
        for (const p of pieces) {
          p.vy += 0.25; p.vx *= 0.99; p.vy *= 0.99;
          p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
          if (p.shape) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        if (fade > 0) raf = requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, w, h);
      };
      raf = requestAnimationFrame(tick);
    }, 120);
    return () => { window.clearTimeout(start); cancelAnimationFrame(raf); };
  }, [trigger]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }} />;
}
