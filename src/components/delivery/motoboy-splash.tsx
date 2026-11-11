import { useEffect, useState } from "react";

interface MotoboySplashProps {
  onComplete: () => void;
}

export function MotoboySplash({ onComplete }: MotoboySplashProps) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Incrementa o progresso de 0 a 100% de forma suave (aprox. 1.4s)
    const startTime = performance.now();
    const duration = 1400; // ms

    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawProgress = Math.min(100, Math.round((elapsed / duration) * 100));

      setProgress(rawProgress);

      if (rawProgress < 100) {
        animId = requestAnimationFrame(tick);
      } else {
        // Chegou a 100%
        window.setTimeout(() => {
          setFading(true);
          onComplete();
          window.setTimeout(() => {
            setVisible(false);
          }, 500);
        }, 180);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animId);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[1000] flex flex-col items-center justify-between bg-[#141412] px-6 py-12 text-white transition-opacity duration-500 ease-out select-none ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-label="Carregando Marmitex da Tia Val"
    >
      <style>{`
        @keyframes moto-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2.5px); }
        }
        @keyframes moto-wheel-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anim-moto-bob {
          animation: moto-bob 0.28s infinite ease-in-out;
        }
        .anim-wheel {
          transform-box: fill-box;
          transform-origin: center;
          animation: moto-wheel-spin 0.4s infinite linear;
        }
      `}</style>

      {/* Topo / Logo */}
      <div className="flex flex-col items-center text-center mt-6">
        <div className="relative mb-3">
          <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <img
            src="/icons/cozinha-logo.webp"
            alt="Logo Tia Val"
            width={88}
            height={88}
            className="relative size-20 rounded-full border-2 border-white/20 object-cover shadow-2xl"
          />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Marmitex da Tia Val</h1>
        <p className="mt-1 text-xs font-semibold text-white/70">Comida caseira quentinha · Primeiro de Maio</p>
      </div>

      {/* Centro / Pista com Motoboy */}
      <div className="w-full max-w-xs flex flex-col items-center my-auto">
        <div className="relative w-full pb-14">
          {/* Motoboy se movendo ao longo do progresso */}
          <div
            className="absolute top-0 -translate-x-1/2 transition-all duration-75 ease-linear pointer-events-none"
            style={{ left: `${Math.max(8, Math.min(92, progress))}%` }}
          >
            <div className="anim-moto-bob drop-shadow-[0_4px_12px_rgba(234,29,44,0.4)]">
              <svg width="68" height="52" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Chassi da Moto */}
                <path d="M25 70 L45 70 L60 55 L85 55 L95 70" stroke="#ea1d2c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M75 55 L85 30 L95 30" stroke="#ea1d2c" stroke-width="5" stroke-linecap="round" />
                {/* Guidão */}
                <path d="M92 28 L100 28" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
                {/* Farol aceso com cone de luz */}
                <circle cx="98" cy="35" r="4" fill="#ffeb3b" />
                <polygon points="102,33 120,22 120,48 102,37" fill="rgba(255, 235, 59, 0.2)" />
                {/* Baú de entrega da Tia Val */}
                <rect x="16" y="30" width="30" height="30" rx="5" fill="#ffffff" stroke="#ea1d2c" stroke-width="3" />
                <text x="31" y="48" fill="#ea1d2c" font-size="8.5" font-weight="900" font-family="sans-serif" text-anchor="middle">
                  TIA VAL
                </text>
                {/* Piloto / Motoboy */}
                {/* Corpo e pernas */}
                <path d="M52 52 L62 38 L78 40" stroke="#1f2937" stroke-width="9" stroke-linecap="round" />
                {/* Braço */}
                <path d="M62 38 L88 32" stroke="#ea1d2c" stroke-width="5" stroke-linecap="round" />
                {/* Capacete vermelho */}
                <circle cx="68" cy="24" r="11" fill="#ea1d2c" />
                {/* Viseira fumê */}
                <path d="M72 20 Q80 24 74 28 Z" fill="#111827" />
                {/* Roda Traseira Girando */}
                <g className="anim-wheel">
                  <circle cx="25" cy="72" r="14" fill="#111827" stroke="#9ca3af" stroke-width="3" />
                  <circle cx="25" cy="72" r="5" fill="#4b5563" />
                  <line x1="25" y1="58" x2="25" y2="86" stroke="#9ca3af" stroke-width="1.5" />
                  <line x1="11" y1="72" x2="39" y2="72" stroke="#9ca3af" stroke-width="1.5" />
                </g>
                {/* Roda Dianteira Girando */}
                <g className="anim-wheel">
                  <circle cx="95" cy="72" r="14" fill="#111827" stroke="#9ca3af" stroke-width="3" />
                  <circle cx="95" cy="72" r="5" fill="#4b5563" />
                  <line x1="95" y1="58" x2="95" y2="86" stroke="#9ca3af" stroke-width="1.5" />
                  <line x1="81" y1="72" x2="109" y2="72" stroke="#9ca3af" stroke-width="1.5" />
                </g>
                {/* Linhas de velocidade/vento atrás */}
                <line x1="2" y1="72" x2="10" y2="72" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-dasharray="3 3" />
                <line x1="4" y1="67" x2="12" y2="67" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
              </svg>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="absolute bottom-0 inset-x-0 h-2 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-orange-500 to-amber-400 transition-all duration-75 ease-linear shadow-[0_0_12px_rgba(234,29,44,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Porcentagem e status */}
        <div className="mt-4 flex items-center justify-between w-full text-[11px] font-extrabold uppercase tracking-widest text-white/80">
          <span>Carregando cardápio...</span>
          <span className="tabular-nums text-primary">{progress}%</span>
        </div>
      </div>

      {/* Rodapé do Splash */}
      <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
        <span className="size-2 rounded-full bg-success animate-ping" />
        <span>Entrega rápida no Primeiro de Maio e região</span>
      </div>
    </div>
  );
}
