import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Navbar } from './navbar';
import { Hero } from './hero';
import { DailyMenu } from './daily-menu';
import { BrandValues, Promotions, Reviews, HowToOrder, Footer } from './sections';
import { AmbientParticles } from './ambient-particles';
import { ContactDock } from './contact-dock';
import { OpeningHours } from './opening-hours';

export function RestaurantPage() {
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    let scrollAnimation = 0;
    const cancelScroll = () => { window.cancelAnimationFrame(scrollAnimation); };
    const handleAnchor = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      const id = link?.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!link || !target || link.classList.contains('skip-link')) return;
      event.preventDefault();
      cancelScroll();
      const scroller = document.getElementById('scroll-root');
      const start = scroller ? scroller.scrollTop : window.scrollY;
      const maxScroll = scroller ? scroller.scrollHeight - scroller.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
      const end = Math.max(0, Math.min(start + target.getBoundingClientRect().top - 24, maxScroll));
      const distance = end - start;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { if (scroller) scroller.scrollTop = end; else window.scrollTo({ top: end, behavior: 'instant' }); return; }
      const duration = Math.min(5200, Math.max(1400, Math.abs(distance) * 2.1));
      const began = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - began) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        if (scroller) scroller.scrollTop = start + distance * eased; else window.scrollTo({ top: start + distance * eased, behavior: 'instant' });
        if (progress < 1) scrollAnimation = window.requestAnimationFrame(tick);
      };
      scrollAnimation = window.requestAnimationFrame(tick);
    };
    const element = page.current;
    element?.addEventListener('click', handleAnchor);
    window.addEventListener('wheel', cancelScroll, { passive: true });
    window.addEventListener('touchstart', cancelScroll, { passive: true });
    window.addEventListener('keydown', cancelScroll);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('.reveal').forEach(element => {
          gsap.from(element, { y: 28, opacity: 0, duration: 0.75, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 96%', toggleActions: 'play none none reverse' } });
        });
        gsap.utils.toArray<HTMLElement>('.meal-card').forEach((element, index) => {
          gsap.from(element, { y: 65, rotation: index % 2 ? 1.8 : -1.8, opacity: 0, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 98%', end: 'top 62%', scrub: .6 } });
          const image = element.querySelector('img');
          if (image) gsap.fromTo(image, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: 'none', scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: .7 } });
        });
      }, page);
      return () => context.revert();
    });
    return () => { media.revert(); cancelScroll(); element?.removeEventListener('click', handleAnchor); window.removeEventListener('wheel', cancelScroll); window.removeEventListener('touchstart', cancelScroll); window.removeEventListener('keydown', cancelScroll); };
  }, []);
  return <div ref={page} className="restaurant-page"><AmbientParticles /><a className="skip-link" href="#pratos">Ir para os pratos</a><Navbar /><main><Hero /><BrandValues /><OpeningHours /><DailyMenu /><Promotions /><Reviews /><HowToOrder /></main><Footer /><ContactDock /></div>;
}
