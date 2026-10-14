import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import heroMeal from '@/assets/meal-beef.jpg';

export function ScrollAnimation() {
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = wrapper.current;
    const hero = container?.closest<HTMLElement>('.hero');
    if (!container || !hero) return;

    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowPower = (navigator.hardwareConcurrency || 4) <= 2;
    if (reduced.matches || lowPower) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * (window.innerWidth < 701 ? 1.2 : 1.5))}`,
          scrub: 0.65,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      timeline.to('.hero-copy', { y: -24, ease: 'none', duration: 1 }, 0);
      timeline.to('.scroll-cue', { opacity: 0, ease: 'none', duration: 0.2 }, 0);
      timeline.to('.hero-media', { scale: 1.035, ease: 'none', duration: 1 }, 0);
      timeline.to('.hero-fallback', { scale: 1.06, ease: 'none', duration: 1 }, 0);
    }, hero);

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(hero);

    return () => {
      observer.disconnect();
      window.removeEventListener('load', refresh);
      context.revert();
    };
  }, []);

  return (
    <div className="hero-media" ref={wrapper}>
      <img
        className="hero-fallback"
        src={heroMeal}
        alt="Marmitex da Tia Val com comida caseira"
        fetchPriority="high"
        decoding="async"
        width={620}
        height={800}
      />
    </div>
  );
}
