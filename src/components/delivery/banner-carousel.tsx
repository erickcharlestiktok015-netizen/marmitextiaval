import { useCallback, useEffect, useRef } from 'react';
import { useState } from 'react';
import { Bike, Clock, Star, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { mapsUrl } from '@/lib/restaurant-data';
// Imagens hospedadas no CDN do Lovable.
const paymentBannerAsset = 'https://id-preview--2fff413a-7193-4dd0-902d-b541fb31df57.lovable.app/__l5e/assets-v1/88fe4c02-5c97-4cba-b41f-4a971235e0d6/formas-pagamento.webp';
const trackingBannerImage = 'https://id-preview--2fff413a-7193-4dd0-902d-b541fb31df57.lovable.app/__l5e/assets-v1/e43fadb3-61f4-4a03-bb79-8fb255d9176b/entrega-tempo-real.webp';

// Imagem oficial do Plano 7 Dias (feijoada + Coca-Cola gelada), hospedada no CDN.
const planBannerImage = 'https://id-preview--c979a7b3-94a4-4a46-923b-53b0de957941.lovable.app/__l5e/assets-v1/6012beb9-1303-4f47-a554-bbad46f8de18/feijoada-coca-plano.jpg';

const SLIDE_COUNT = 4;
const AUTO_MS = 8500;

function GoogleReviewBanner() {
  return <a href={mapsUrl} target="_blank" rel="noreferrer" className="relative block size-full overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-100 p-4" aria-label="Ver avaliações no Google">
    <span className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-emerald-200/40 blur-2xl" aria-hidden />
    <span className="pointer-events-none absolute -bottom-12 -left-8 size-32 rounded-full bg-green-300/30 blur-2xl" aria-hidden />
    <div className="relative z-10 flex h-full flex-col justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-emerald-100 bg-white shadow-sm text-xl font-black" aria-hidden>
          <span className="bg-gradient-to-br from-[#4285F4] via-[#EA4335] to-[#FBBC05] bg-clip-text text-transparent">G</span>
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">Avaliações no Google</p>
          <p className="truncate text-sm font-bold text-foreground">Marmitex da Tia Val</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-emerald-200 bg-white/80 px-2 py-1 text-[10px] font-bold text-emerald-800">Clientes recomendam</span>
      </div>
      <div className="flex items-end gap-3">
        <p className="text-3xl font-black leading-none tracking-tight text-emerald-950">4,9</p>
        <div className="pb-0.5">
          <span className="flex text-[#FBBC05]" aria-label="Nota 4,9 de 5">
            {[0, 1, 2, 3, 4].map(i => <Star key={i} className={`size-3.5 ${i < 4 ? 'fill-[#FBBC05]' : 'fill-[#FBBC05]/40 text-[#FBBC05]/40'}`} />)}
          </span>
          <p className="mt-1 text-[11px] font-medium text-emerald-900/70">50 avaliações no Google</p>
        </div>
      </div>
      <figure className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
        <blockquote className="text-sm font-semibold text-emerald-950">“Melhor comida da região”</blockquote>
        <figcaption className="mt-0.5 text-[11px] text-emerald-900/65">Avaliação de cliente no Google</figcaption>
      </figure>
      <p className="text-xs font-extrabold text-emerald-800">Ver perfil e avaliações no Google <span aria-hidden>→</span></p>
    </div>
  </a>;
}

function GuaranteeBanner({ onOpen }: { onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="block size-full cursor-zoom-in overflow-hidden bg-[#fff4e7]" aria-label="Ampliar informações sobre as formas de pagamento">
    <img src={paymentBannerAsset} alt="Pagamento seguro: Pix, cartões de crédito e débito, boleto, saldo Mercado Pago e pagamento na entrega" className="size-full object-cover" loading="lazy" />
  </button>;
}

export function BannerCarousel({ onOpenPlan }: { onOpenPlan: () => void }) {
  const [index, setIndex] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
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
          <img src={trackingBannerImage} alt="Motoboy da Tia Val mostrando o pedido sendo acompanhado no celular" className="size-full object-cover" loading="lazy" />
          <span className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" aria-hidden />
          <span className="absolute inset-y-0 left-0 flex w-[62%] flex-col justify-center gap-1.5 p-4 text-white">
            <span className="w-fit rounded-md bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">Entrega acompanhada</span>
            <span className="text-base font-extrabold leading-tight sm:text-xl">Peça em poucos toques e veja sua marmita chegando em tempo real</span>
            <span className="text-[11px] font-semibold leading-snug text-white/90 sm:text-sm">🔒 Código de entrega: o motoboy só finaliza quando você confirma o código</span>
          </span>
        </div>
      </div>
      <div className="w-full shrink-0 snap-center px-4">
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border shadow-card"><GoogleReviewBanner /></div>
      </div>
      <div className="w-full shrink-0 snap-center px-4">
        <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-card"><GuaranteeBanner onOpen={() => setPaymentOpen(true)} /></div>
      </div>
    </div>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
      <DialogContent className="delivery-app max-h-[94dvh] w-[calc(100%-20px)] max-w-3xl overflow-y-auto rounded-3xl border-0 bg-[#fff4e7] p-3 sm:p-5">
        <DialogTitle className="pr-8 text-lg font-extrabold">Formas de pagamento</DialogTitle>
        <DialogDescription>Toque para conferir as opções disponíveis online e na entrega.</DialogDescription>
        <img src={paymentBannerAsset} alt="Pix, cartões de crédito e débito, boleto, saldo Mercado Pago e pagamento na entrega" className="mx-auto max-h-[75dvh] w-auto max-w-full rounded-2xl object-contain" />
      </DialogContent>
    </Dialog>
    <div className="mt-2.5 flex justify-center gap-1.5" role="tablist" aria-label="Escolher destaque">
      {Array.from({ length: SLIDE_COUNT }, (_, i) => i).map(i => <button key={i} type="button" role="tab" aria-selected={index === i} aria-label={`Destaque ${i + 1}`} onClick={() => goTo(i)} className={`h-1.5 rounded-full transition-all ${index === i ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />)}
    </div>
  </section>;
}
