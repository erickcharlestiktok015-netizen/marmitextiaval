import { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, Clock, KeyRound, MapPin, ShieldCheck, Star, Wallet } from 'lucide-react';
import { mapsUrl } from '@/lib/restaurant-data';

// Imagem oficial do Plano 7 Dias (feijoada + Coca-Cola gelada), hospedada no CDN.
const planBannerImage = 'https://id-preview--c979a7b3-94a4-4a46-923b-53b0de957941.lovable.app/__l5e/assets-v1/6012beb9-1303-4f47-a554-bbad46f8de18/feijoada-coca-plano.jpg';

const trackingBannerImage = 'https://id-preview--b510db96-5a56-4d53-8b44-4debd243b8fe.lovable.app/__l5e/assets-v1/d8f7689e-9ab6-4cad-98c1-cbd8b8bf5f97/motoboy_entrega_ao_vivo.jpg';
const paymentBannerImage = 'https://id-preview--b510db96-5a56-4d53-8b44-4debd243b8fe.lovable.app/__l5e/assets-v1/3545831f-1625-4034-8690-89da37cbf74b/plano_7_dias_banner.jpg';

const SLIDE_COUNT = 5;
const AUTO_MS = 5000;

function GoogleReviewBanner() {
  return <a href={mapsUrl} target="_blank" rel="noreferrer" className="block size-full bg-card p-4" aria-label="Ver avaliações no Google">
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background text-xl font-black" aria-hidden>
          <span className="bg-gradient-to-br from-[#4285F4] via-[#EA4335] to-[#FBBC05] bg-clip-text text-transparent">G</span>
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">Marmitex da Tia Val</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <strong className="text-sm text-foreground">4,9</strong>
            <span className="flex text-[#FBBC05]" aria-label="Nota 4,9 de 5">
              {[0, 1, 2, 3, 4].map(i => <Star key={i} className={`size-3.5 ${i < 4 ? 'fill-[#FBBC05]' : 'fill-[#FBBC05]/40 text-[#FBBC05]/40'}`} />)}
            </span>
            · 50 avaliações no Google
          </p>
        </div>
      </div>
      <figure className="rounded-2xl bg-muted p-3">
        <blockquote className="text-sm font-semibold text-foreground">“Melhor comida da região”</blockquote>
        <figcaption className="mt-1 text-xs text-muted-foreground">Avaliação de cliente no Google</figcaption>
      </figure>
      <p className="text-xs font-bold text-primary">Ver perfil no Google →</p>
    </div>
  </a>;
}

function GuaranteeBanner() {
  const items = [
    { icon: Clock, title: 'Entrega pontual', text: 'das 11h às 14h' },
    { icon: Bike, title: 'Sem taxa', text: 'dentro do Primeiro de Maio' },
    { icon: Wallet, title: 'Pague no Pix', text: 'ou na entrega (cartão/dinheiro)' },
  ];
  return <div className="flex size-full flex-col justify-center gap-2.5 bg-primary p-4 text-primary-foreground">
    <p className="text-xs font-bold uppercase tracking-widest opacity-80">Garantia Tia Val</p>
    {items.map(({ icon: Icon, title, text }) => <p key={title} className="flex items-center gap-2.5 text-sm font-bold">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-foreground/15"><Icon className="size-4" /></span>
      {title} <span className="font-normal opacity-90">{text}</span>
    </p>)}
  </div>;
}

// Faixa vermelha que passa sozinha com as garantias (substitui os selos verdes antigos).
const marqueeCss = '.delivery-app section > .da-no-scrollbar.text-xs{display:none}.da-marquee-track{animation:da-marquee 22s linear infinite}@keyframes da-marquee{to{transform:translateX(calc(-50% - .75rem))}}@media (prefers-reduced-motion:reduce){.da-marquee-track{animation:none}}';

function TrustMarquee() {
  return <div className="mx-4 mt-3 overflow-hidden rounded-full border-2 border-primary bg-primary py-1.5 text-xs font-bold text-primary-foreground" aria-label="Pix e cartão seguros, entrega ao vivo com código só seu, dinheiro ou maquininha">
    <style>{marqueeCss}</style>
    <div className="da-marquee-track flex w-max gap-6">
      {[0, 1].map(k => <span key={k} className="flex shrink-0 gap-6" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4" /> Pix e cartão seguros (Mercado Pago)</span>
        <span className="inline-flex items-center gap-1.5"><Bike className="size-4" /> Acompanhe a entrega ao vivo</span>
        <span className="inline-flex items-center gap-1.5"><KeyRound className="size-4" /> Código de entrega só seu</span>
        <span className="inline-flex items-center gap-1.5"><Wallet className="size-4" /> Dinheiro ou maquininha na entrega</span>
        <span className="inline-flex items-center gap-1.5"><Star className="size-4" /> Plano 7 Dias: 7 marmitas + 7 bebidas</span>
      </span>)}
    </div>
  </div>;
}

function PlanHighlight({ onOpenPlan }: { onOpenPlan: () => void }) {
  return <div className="mx-4 mt-4 overflow-hidden rounded-2xl border-2 border-primary bg-accent shadow-card">
    <button type="button" onClick={onOpenPlan} className="flex w-full items-center gap-3 p-4 text-left transition active:scale-[.99]">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-2xl" aria-hidden>🍱</span>
      <span className="min-w-0 flex-1">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">Plano 7 Dias · mais econômico</span>
        <strong className="block text-base leading-tight text-foreground">7 marmitas + 7 bebidas, você escolhe os dias</strong>
        <span className="text-sm text-muted-foreground">7 dias por <strong className="text-primary">R$ 130</strong> · entrega grátis no bairro</span>
      </span>
    </button>
    <div className="grid grid-cols-2 gap-2 px-4 pb-4">
      <button type="button" onClick={onOpenPlan} className="h-11 rounded-xl border-2 border-primary text-sm font-bold text-primary">Ver como funciona</button>
      <button type="button" onClick={onOpenPlan} className="h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground">Quero assinar →</button>
    </div>
  </div>;
}

export function BannerCarousel({ onOpenPlan }: { onOpenPlan: () => void }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const goTo = useCallback((next: number) => {
    const wrapped = ((next % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
    setIndex(wrapped);
    trackRef.current?.scrollTo({ left: wrapped * (trackRef.current.clientWidth || 0), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => goTo(index + 1), AUTO_MS);
    return () => window.clearInterval(timer);
  }, [index, goTo]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const current = Math.round(el.scrollLeft / el.clientWidth);
    if (current !== index) setIndex(current);
  };

  return <section aria-label="Destaques" className="mt-4">
    <TrustMarquee />
    <div className="mt-4" />
    <div
      ref={trackRef}
      onScroll={onScroll}
      onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={e => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      className="da-no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
    >
      <div className="w-full shrink-0 snap-center px-4">
        <button type="button" onClick={onOpenPlan} className="relative block aspect-video w-full overflow-hidden rounded-2xl text-left shadow-card transition active:scale-[.99]" aria-label="Conhecer o Plano 7 Dias">
          <img src={planBannerImage} alt="Feijoada da Tia Val com Coca-Cola gelada" className="size-full object-cover" loading="lazy" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" aria-hidden />
          <span className="absolute inset-x-0 bottom-0 p-4 text-white">
            <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-primary-foreground">Plano 7 Dias</span>
            <span className="mt-1.5 block text-lg font-extrabold leading-tight">7 marmitas + 7 bebidas<br />com entrega grátis no Primeiro de Maio</span>
            <span className="mt-1 inline-flex items-center rounded-lg bg-white/95 px-2.5 py-1 text-xs font-extrabold text-foreground">Quero assinar →</span>
          </span>
        </button>
      </div>
      <div className="w-full shrink-0 snap-center px-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-card">
          <img src={trackingBannerImage} alt="Motoboy da Tia Val mostrando o pedido no mapa em tempo real" className="size-full object-cover" loading="lazy" />
          <span className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" aria-hidden />
          <span className="absolute inset-y-0 left-0 flex w-[62%] flex-col justify-center gap-1.5 p-4 text-white">
            <span className="w-fit rounded-md bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">Entrega ao vivo</span>
            <span className="text-base font-extrabold leading-tight">Peça em 1 minuto e veja o motoboy chegando no mapa</span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold"><MapPin className="size-3.5 shrink-0" /> Tempo real, do fogão até sua porta</span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold"><KeyRound className="size-3.5 shrink-0" /> Código de entrega só seu: segurança total</span>
          </span>
        </div>
      </div>
      <div className="w-full shrink-0 snap-center px-4">
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-card shadow-card">
          <img src={paymentBannerImage} alt="Formas de pagamento: Pix, cartão de crédito e débito, Mercado Pago e pagamento na entrega" className="size-full object-contain" loading="lazy" />
        </div>
      </div>
      <div className="w-full shrink-0 snap-center px-4">
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border shadow-card"><GoogleReviewBanner /></div>
      </div>
      <div className="w-full shrink-0 snap-center px-4">
        <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-card"><GuaranteeBanner /></div>
      </div>
    </div>
    <div className="mt-2.5 flex justify-center gap-1.5" role="tablist" aria-label="Escolher destaque">
      {Array.from({ length: SLIDE_COUNT }, (_, i) => i).map(i => <button key={i} type="button" role="tab" aria-selected={index === i} aria-label={`Destaque ${i + 1}`} onClick={() => goTo(i)} className={`h-1.5 rounded-full transition-all ${index === i ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />)}
    </div>
    <PlanHighlight onOpenPlan={onOpenPlan} />
  </section>;
}
