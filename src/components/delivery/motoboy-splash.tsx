import { useEffect, useState } from "react";
import { SPLASH_BG_IMAGE, SPLASH_MOTOBOY_IMAGE } from "./splash-assets";

interface MotoboySplashProps {
  onComplete: () => void;
}

export function MotoboySplash({ onComplete }: MotoboySplashProps) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Incrementa o progresso de 0 a 100% de forma suave (aprox. 1.35s)
    const startTime = performance.now();
    const duration = 1350;

    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawProgress = Math.min(100, Math.round((elapsed / duration) * 100));

      setProgress(rawProgress);

      if (rawProgress < 100) {
        animId = requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => {
          setFading(true);
          onComplete();
          window.setTimeout(() => {
            setVisible(false);
          }, 450);
        }, 160);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animId);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center bg-[#fdfdfd] transition-opacity duration-500 ease-out select-none overflow-hidden ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-label="Carregando o sabor da Tia Val"
    >
      <style>{`
        @keyframes moto-ride {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-4px) rotate(-1deg);
          }
          50% {
            transform: translateY(1.5px) rotate(0.6deg);
          }
          75% {
            transform: translateY(-2px) rotate(-0.4deg);
          }
        }
        .anim-motoboy-ride {
          animation: moto-ride 0.36s infinite ease-in-out;
          transform-origin: bottom center;
        }
      `}</style>

      {/* Frame responsivo no aspect ratio oficial do splash */}
      <div className="relative w-full max-w-[430px] h-full max-h-[100dvh] aspect-[941/1672] flex flex-col justify-between overflow-hidden shadow-2xl">
        {/* Imagem de Fundo Oficial (Logo, topo, rodapé, ondas e corações) */}
        <img
          src={SPLASH_BG_IMAGE}
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        />

        {/* Motoboy Animado (acelerando suavemente com fumaça e movimento) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[88%] max-w-[370px] pointer-events-none select-none"
          style={{ top: "33%" }}
        >
          <div className="anim-motoboy-ride relative flex items-center justify-center drop-shadow-[0_12px_20px_rgba(0,0,0,0.08)]">
            <img
              src={SPLASH_MOTOBOY_IMAGE}
              alt="Motoboy Tia Val acelerando"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>

        {/* Seção da Barra de Progresso + Porcentagem + Status */}
        <div
          className="absolute inset-x-0 px-6 sm:px-8 flex flex-col items-center"
          style={{ top: "69.5%" }}
        >
          {/* Linha da barra com porcentagem ao lado (exatamente como no design) */}
          <div className="w-full flex items-center gap-3">
            {/* Trilho da barra com borda arredondada e relevo */}
            <div className="flex-1 h-5 sm:h-6 rounded-full bg-[#f1f1f3] border-2 border-[#e6e6e8] p-[2.5px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ba0008] via-[#e51c24] to-[#f42b37] shadow-[0_2px_8px_rgba(229,28,36,0.45)] transition-all duration-75 ease-linear"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>

            {/* Porcentagem em negrito escuro */}
            <span className="min-w-[48px] text-right font-black text-lg sm:text-xl tracking-tight text-[#222222] tabular-nums">
              {progress}%
            </span>
          </div>

          {/* Texto "Carregando cardápio..." */}
          <div className="mt-3 flex items-center justify-center gap-1.5 text-center font-extrabold text-sm sm:text-base text-[#1c1c1c] tracking-tight">
            <span>Carregando cardápio</span>
            <span className="inline-flex">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse delay-150">.</span>
              <span className="animate-pulse delay-300">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
