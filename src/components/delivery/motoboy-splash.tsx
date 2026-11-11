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
        /* Motoboy andando firme e reto no asfalto: ZERO balanço lateral, apenas a micro-vibração do motor */
        @keyframes moto-drive {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-1.5px);
          }
        }
        .anim-motoboy-drive {
          animation: moto-drive 0.16s infinite ease-in-out;
        }

        /* Vento passando veloz da direita para a esquerda */
        @keyframes wind-gust-fast {
          0% {
            transform: translateX(140px) scaleX(0.5);
            opacity: 0;
          }
          15% {
            opacity: 0.85;
          }
          85% {
            opacity: 0.85;
          }
          100% {
            transform: translateX(-160px) scaleX(1.1);
            opacity: 0;
          }
        }
        @keyframes wind-gust-medium {
          0% {
            transform: translateX(120px) scaleX(0.6);
            opacity: 0;
          }
          20% {
            opacity: 0.75;
          }
          80% {
            opacity: 0.75;
          }
          100% {
            transform: translateX(-140px) scaleX(1.2);
            opacity: 0;
          }
        }

        .anim-wind-1 {
          animation: wind-gust-fast 0.42s infinite linear;
        }
        .anim-wind-2 {
          animation: wind-gust-medium 0.52s infinite linear 0.14s;
        }
        .anim-wind-3 {
          animation: wind-gust-fast 0.38s infinite linear 0.22s;
        }
        .anim-wind-4 {
          animation: wind-gust-medium 0.48s infinite linear 0.08s;
        }
        .anim-wind-5 {
          animation: wind-gust-fast 0.45s infinite linear 0.28s;
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

        {/* Cenário do Motoboy com rajadas de vento passando */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[88%] max-w-[370px] pointer-events-none select-none"
          style={{ top: "33%" }}
        >
          {/* Linhas de Vento passando velozes da direita para a esquerda */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Linha 1: Acima do capacete */}
            <div
              className="anim-wind-1 absolute top-[12%] right-[10%] h-[2.5px] w-20 rounded-full bg-gradient-to-r from-transparent via-[#9ca3af]/70 to-transparent"
            />
            {/* Linha 2: Frente do guidão */}
            <div
              className="anim-wind-2 absolute top-[36%] right-[4%] h-[3px] w-28 rounded-full bg-gradient-to-r from-transparent via-[#ea1d2c]/40 to-transparent"
            />
            {/* Linha 3: Meio / corpo do motoboy */}
            <div
              className="anim-wind-3 absolute top-[52%] right-[18%] h-[2px] w-16 rounded-full bg-gradient-to-r from-transparent via-[#9ca3af]/60 to-transparent"
            />
            {/* Linha 4: Atrás do baú */}
            <div
              className="anim-wind-4 absolute top-[28%] left-[10%] h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-[#9ca3af]/60 to-transparent"
            />
            {/* Linha 5: Roda / asfalto */}
            <div
              className="anim-wind-5 absolute bottom-[18%] right-[8%] h-[2.5px] w-24 rounded-full bg-gradient-to-r from-transparent via-[#ea1d2c]/30 to-transparent"
            />
          </div>

          {/* Motoboy andando reto e firme (sem balançar pro lado) */}
          <div className="anim-motoboy-drive relative flex items-center justify-center drop-shadow-[0_12px_20px_rgba(0,0,0,0.08)]">
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
