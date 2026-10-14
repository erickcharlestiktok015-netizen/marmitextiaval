import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const assets = import.meta.glob<{ url: string }>('../../assets/frames/*.asset.json', { eager: true, import: 'default' });
const frames = Object.entries(assets).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => new URL(value.url, 'https://tia-val-eats-digital.lovable.app').toString());

export function ScrollAnimation() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const element = canvas.current;
    const container = wrapper.current;
    const hero = container?.closest<HTMLElement>('.hero');
    const context = element?.getContext('2d');
    if (!element || !container || !context || !hero) return;
    gsap.registerPlugin(ScrollTrigger);
    let stopped = false;
    const images: (HTMLImageElement | undefined)[] = new Array(frames.length);
    const playhead = { frame: 0 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowPower = navigator.hardwareConcurrency <= 2;
    const draw = () => {
      const requested = Math.round(playhead.frame);
      let image = images[requested];
      if (!image) {
        for (let i = requested; i >= 0; i--) { if (images[i]) { image = images[i]; break; } }
      }
      if (!image || stopped) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
        element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const fit = width < 700 ? Math.max : Math.min;
      const scale = fit(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale; const h = image.naturalHeight * scale;
      context.drawImage(image, (width - w) / 2, height - h, w, h);
      element.dataset['frame'] = String(requested);
    };
    const load = (index: number) => new Promise<void>((resolve) => {
      const source = frames[index];
      if (!source) { resolve(); return; }
      const image = new Image();
      image.onload = () => { if (!stopped) { images[index] = image; draw(); } resolve(); };
      image.onerror = () => resolve();
      image.src = source;
    });
    let animationContext: gsap.Context | undefined;
    let next = 1;
    const initialize = async () => {
      await load(0);
      if (stopped) return;
      setLoading(false);
      if (reduced.matches || lowPower) return;
      animationContext = gsap.context(() => {
        const timeline = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: () => `+=${Math.round(window.innerHeight * (window.innerWidth < 701 ? 1.6 : 1.8))}`, scrub: 0.65, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
        timeline.to(playhead, { frame: frames.length - 1, ease: 'none', onUpdate: draw, duration: 1 }, 0);
        timeline.to('.hero-copy', { y: -24, duration: 1, ease: 'none' }, 0);
        timeline.to('.scroll-cue', { opacity: 0, duration: .2 }, 0);
        timeline.to('.hero-media', { scale: 1.035, duration: 1, ease: 'none' }, 0);
      }, hero);
      const worker = async () => { while (next < frames.length && !stopped) { const index = next++; await load(index); } };
      await Promise.all(Array.from({ length: 5 }, worker));
    };
    void initialize();
    const onMotionChange = () => { if (reduced.matches) { animationContext?.revert(); playhead.frame = 0; draw(); } };
    reduced.addEventListener('change', onMotionChange);
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => { stopped = true; observer.disconnect(); reduced.removeEventListener('change', onMotionChange); animationContext?.revert(); images.length = 0; };
  }, []);

  return <div className="hero-media" ref={wrapper}>
    <img className="hero-fallback" src={frames[0]} alt="Marmitex com arroz, feijão, carne e couve, envolta em vapor" fetchPriority="high" width={620} height={800} />
    <canvas ref={canvas} className="hero-canvas" aria-label="Sequência de fumaça e comida controlada pela rolagem" />
    {loading && <span className="frame-loading" role="status">Preparando uma delícia…</span>}
  </div>;
}