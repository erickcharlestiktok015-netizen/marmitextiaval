import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type FrameSequenceProps = {
  frames: string[];
  poster: string;
  alt: string;
};

export function FrameSequence({ frames, poster, alt }: FrameSequenceProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    const container = wrapper.current;
    const context = element?.getContext('2d');
    if (!element || !container || !context || frames.length < 2) return;
    gsap.registerPlugin(ScrollTrigger);
    let stopped = false;
    const images: (HTMLImageElement | undefined)[] = new Array(frames.length);
    const playhead = { frame: 0 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowPower = (navigator.hardwareConcurrency || 4) <= 2;
    const draw = () => {
      const requested = Math.max(0, Math.min(frames.length - 1, Math.round(playhead.frame)));
      let image = images[requested];
      if (!image) { for (let i = requested; i >= 0; i--) { if (images[i]) { image = images[i]; break; } } }
      if (!image || stopped) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
        element.width = Math.round(width * ratio);
        element.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    };
    const load = (index: number) => new Promise<void>(resolve => {
      const source = frames[index];
      if (!source) { resolve(); return; }
      const image = new Image();
      image.onload = () => { if (!stopped) { images[index] = image; if (index === 0) setReady(true); draw(); } resolve(); };
      image.onerror = () => resolve();
      image.src = source;
    });
    let animationContext: gsap.Context | undefined;
    let next = 1;
    const initialize = async () => {
      await load(0);
      if (stopped) return;
      if (reduced.matches || lowPower) return;
      animationContext = gsap.context(() => {
        const timeline = gsap.timeline({ scrollTrigger: { trigger: container, scroller: document.getElementById('scroll-root') ?? window, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true } });
        timeline.to(playhead, { frame: frames.length - 1, ease: 'none', onUpdate: draw, duration: 1 }, 0);
      }, container);
      const worker = async () => { while (next < frames.length && !stopped) { const index = next++; await load(index); } };
      await Promise.all(Array.from({ length: 4 }, worker));
    };
    void initialize();
    const onMotionChange = () => { if (reduced.matches) { animationContext?.revert(); playhead.frame = 0; draw(); } };
    reduced.addEventListener('change', onMotionChange);
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => {
      stopped = true;
      observer.disconnect();
      reduced.removeEventListener('change', onMotionChange);
      animationContext?.revert();
      images.length = 0;
    };
  }, [frames]);

  return <div className={`frame-sequence${ready ? ' is-ready' : ''}`} ref={wrapper}>
    <img className="frame-poster" src={poster} alt={alt} loading="lazy" width={1280} height={896} />
    <canvas ref={canvas} className="frame-canvas" aria-hidden="true" />
  </div>;
}
