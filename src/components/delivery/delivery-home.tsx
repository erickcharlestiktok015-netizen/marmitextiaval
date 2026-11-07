import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bike, CalendarCheck, ChevronRight, Clock, Heart, Instagram, LoaderCircle, LogIn, LogOut, MapPin, MessageCircle, Minus, Pause, Phone, Play, Plus, ReceiptText, RefreshCw, ShieldCheck, ShoppingBag, Store, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { CheckoutForm } from '@/components/restaurant/checkout-form';
import { trackAddToCart } from '@/components/facebook-pixel';
import { allMeals, contacts, deliveryFeePerKm, formatPrice, getTodayMeal, getTomorrowMeal, isRestaurantOpen, mapsUrl, meals, openingHours, type Meal, type MealSize } from '@/lib/restaurant-data';
import { clearCustomer, formatPhone, maskPhoneInput, orderStatusBadgeClass, orderStatusLabel, readCustomer, readPlanMeta, readSavedOrders, saveCustomer, saveOrder, savedAtLabel, trackingHref, type SavedCustomer, type SavedOrder } from '@/lib/my-orders';
import { lookupCustomerOrders, type CustomerOrder } from '@/lib/orders';
import { ContactDock } from '@/components/restaurant/contact-dock';
import { BannerCarousel } from '@/components/delivery/banner-carousel';
import { PlanSheet } from '@/components/delivery/plan-sheet';
import { PLAN_DAYS, planSizes, planDateLabel, planDeliveredCount, spDateKey } from '@/lib/weekly-plan';
import logoBannerAsset from '@/assets/marmitex-logo-banner.png';

type BagItem = { key: string; mealId: string; sizeId: string; quantity: number; notes: string };
const BAG_KEY = 'tia-val-sacola';
const findMeal = (id: string) => allMeals.find(m => m.id === id);
const sizeName = (size: MealSize) => size.label.split(' · ')[0] ?? size.label;
const sizeVolume = (size: MealSize) => size.label.split(' · ')[1] ?? '';
const minPrice = (meal: Meal) => Math.min(...meal.sizes.map(s => s.price));
const whatsappHelp = (text: string) => `https://api.whatsapp.com/send/?phone=553134454042&text=${encodeURIComponent(text)}`;

function DishVideo({ meal, className, controls = false }: { meal: Meal; className?: string; controls?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { void v.play().catch(() => {}); setPaused(false); } else { v.pause(); setPaused(true); }
  };
  return <div className={`relative overflow-hidden bg-muted ${className ?? ''}`}>
    <video ref={ref} className="size-full object-cover" src={meal.video} poster={meal.poster} autoPlay muted loop playsInline preload="metadata" aria-label={`${meal.name} — vídeo do prato`} onCanPlay={e => { if (!paused) e.currentTarget.play().catch(() => {}); }} />
    {controls && <button type="button" onClick={e => { e.stopPropagation(); toggle(); }} aria-label={paused ? 'Tocar vídeo' : 'Pausar vídeo'} className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-card/90 text-foreground shadow-card backdrop-blur">{paused ? <Play className="size-4" /> : <Pause className="size-4" />}</button>}
  </div>;
}

function Stepper({ value, onMinus, onPlus, min = 0, max = 20, small = false }: { value: number; onMinus: () => void; onPlus: () => void; min?: number; max?: number; small?: boolean }) {
  const size = small ? 'size-8' : 'size-11';
  return <div className={`flex items-center rounded-xl border border-border bg-card ${small ? 'gap-1' : 'gap-2'}`}>
    <button type="button" aria-label="Diminuir" disabled={value <= min && min > 0} onClick={onMinus} className={`grid ${size} place-items-center text-primary disabled:text-muted-foreground`}>{value <= 1 && min === 0 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}</button>
    <output className="min-w-5 text-center font-bold tabular-nums">{value}</output>
    <button type="button" aria-label="Aumentar" disabled={value >= max} onClick={onPlus} className={`grid ${size} place-items-center text-primary disabled:text-muted-foreground`}><Plus className="size-4" /></button>
  </div>;
}

export function DeliveryHome() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [todayMeal, setTodayMeal] = useState<Meal>(() => getTodayMeal());
  const [tomorrowMeal, setTomorrowMeal] = useState<Meal>(() => getTomorrowMeal());
  const [bag, setBag] = useState<BagItem[]>([]);
  const [bagLoaded, setBagLoaded] = useState(false);
  const [bump, setBump] = useState(0);
  const [itemSheet, setItemSheet] = useState<{ meal: Meal; when: 'hoje' | 'amanha' } | null>(null);
  const [sizeId, setSizeId] = useState('');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [bagStep, setBagStep] = useState<'bag' | 'checkout'>('bag');
  const [reserve, setReserve] = useState<{ meal: Meal; size: MealSize; quantity: number; notes: string } | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [saved, setSaved] = useState<SavedOrder[]>([]);
  const [tab, setTab] = useState<'hoje' | 'amanha'>('hoje');
  const [planOpen, setPlanOpen] = useState(false);
  const [customer, setCustomer] = useState<SavedCustomer | null>(() => readCustomer());
  const [phoneInput, setPhoneInput] = useState(() => (customer ? formatPhone(customer.phone) : ''));
  const [nameInput, setNameInput] = useState(() => customer?.name ?? '');
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const fetchOrdersByPhone = async (phoneToQuery: string, customerNameToSave?: string) => {
    const digits = phoneToQuery.replace(/\D/g, '');
    if (digits.length < 10) {
      setLoginError('Digite o DDD e o número do seu telefone (pelo menos 10 dígitos).');
      return;
    }
    setOrdersLoading(true);
    setLoginError('');
    try {
      const res = await lookupCustomerOrders(digits);
      const updatedCustomer: SavedCustomer = {
        name: customerNameToSave?.trim() || res.customerName || customer?.name || '',
        phone: res.phone,
      };
      saveCustomer(updatedCustomer);
      setCustomer(updatedCustomer);
      setPhoneInput(formatPhone(res.phone));
      if (updatedCustomer.name) setNameInput(updatedCustomer.name);
      setCustomerOrders(res.orders);

      for (const o of res.orders) {
        if (o.trackingToken) {
          saveOrder(o.code, o.trackingToken);
        }
      }
      setSaved(readSavedOrders());
    const initialCustomer = readCustomer();
    if (initialCustomer?.phone) {
      fetchOrdersByPhone(initialCustomer.phone);
    }
    } catch (err) {
      console.error('Falha ao buscar pedidos por telefone:', err);
      setLoginError(err instanceof Error ? err.message : 'Não foi possível carregar os pedidos do banco agora.');
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleLogoutCustomer = () => {
    clearCustomer();
    setCustomer(null);
    setPhoneInput('');
    setNameInput('');
    setCustomerOrders([]);
    setLoginError('');
  };

  useEffect(() => {
    const updateDishesAndHours = () => {
      setOpen(isRestaurantOpen());
      setTodayMeal(getTodayMeal());
      setTomorrowMeal(getTomorrowMeal());
    };
    updateDishesAndHours();
    const t = window.setInterval(updateDishesAndHours, 30_000);
    setSaved(readSavedOrders());
    try {
      const raw = JSON.parse(localStorage.getItem(BAG_KEY) || '[]') as BagItem[];
      if (Array.isArray(raw)) setBag(raw.filter(i => i && findMeal(i.mealId)?.sizes.some(s => s.id === i.sizeId) && i.quantity > 0).slice(0, 20));
    } catch { /* sacola vazia */ }
    setBagLoaded(true);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { if (bagLoaded) try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch { /* opcional */ } }, [bag, bagLoaded]);

  const lines = useMemo(() => bag.flatMap(item => {
    const meal = findMeal(item.mealId);
    const size = meal?.sizes.find(s => s.id === item.sizeId);
    return meal && size ? [{ ...item, meal, size }] : [];
  }), [bag]);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((n, l) => n + l.size.price * l.quantity, 0);
  const qtyOf = (mealId: string, sId: string) => lines.filter(l => l.mealId === mealId && l.sizeId === sId).reduce((n, l) => n + l.quantity, 0);

  const addToBag = (meal: Meal, size: MealSize, quantity: number, itemNotes = '') => {
    const key = `${meal.id}-${size.id}-${itemNotes.trim()}`;
    setBag(items => items.some(i => i.key === key)
      ? items.map(i => i.key === key ? { ...i, quantity: Math.min(20, i.quantity + quantity) } : i)
      : [...items, { key, mealId: meal.id, sizeId: size.id, quantity, notes: itemNotes.trim() }]);
    setBump(b => b + 1);
    trackAddToCart(size.price * quantity);
  };
  const changeQty = (key: string, delta: number) => setBag(items => items.flatMap(i => i.key !== key ? [i] : i.quantity + delta <= 0 ? [] : [{ ...i, quantity: Math.min(20, i.quantity + delta) }]));
  const removeFromBag = (mealId: string, sizeId: string) => {
    setBag(items => {
      let removed = false;
      const reversed = [...items].reverse();
      const updated = reversed.flatMap(i => {
        if (!removed && i.mealId === mealId && i.sizeId === sizeId) {
          removed = true;
          return i.quantity <= 1 ? [] : [{ ...i, quantity: i.quantity - 1 }];
        }
        return [i];
      });
      return updated.reverse();
    });
    setBump(b => b + 1);
  };

  const openItem = (meal: Meal, when: 'hoje' | 'amanha', preselect?: MealSize) => {
    setItemSheet({ meal, when });
    setSizeId(preselect?.id ?? '');
    setQty(1);
    setNotes('');
  };
  const sheetSize = itemSheet?.meal.sizes.find(s => s.id === sizeId);
  const confirmItem = () => {
    if (!itemSheet || !sheetSize) return;
    if (itemSheet.when === 'amanha') {
      setReserve({ meal: itemSheet.meal, size: sheetSize, quantity: qty, notes: notes.trim() });
      setItemSheet(null);
      return;
    }
    addToBag(itemSheet.meal, sheetSize, qty, notes);
    setItemSheet(null);
  };

  const goTo = (id: 'hoje' | 'amanha') => {
    setTab(id);
    document.getElementById(`secao-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sheetClass = 'delivery-app inset-x-0 mx-auto flex max-h-[94dvh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-3xl border-0 p-0';

  return <div className="delivery-app min-h-screen bg-secondary">
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-32 shadow-card">
      {/* Capa */}
      <header className="relative">
        <div className="relative aspect-[3/1] overflow-hidden">
          <img src={logoBannerAsset} alt="Marmitex da Tia Val — comida caseira feita com muito amor" className="size-full object-cover" width={1920} height={640} fetchPriority="high" />
          <div className="da-cover-fade absolute inset-0" />
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <Button variant="soft" size="sm" className="h-9 gap-1.5 px-3 text-sm font-bold shadow-sm" onClick={() => {
            setSaved(readSavedOrders());
            setOrdersOpen(true);
            const currentCustomer = readCustomer();
            if (currentCustomer?.phone) {
              fetchOrdersByPhone(currentCustomer.phone);
            }
          }}>
            {customer?.phone ? (
              <>
                <UserCheck className="size-4 text-success" />
                <span>{customer.name ? customer.name.split(' ')[0] : formatPhone(customer.phone)}</span>
              </>
            ) : (
              <>
                <ReceiptText className="size-4" />
                <span>Entrar / Pedidos</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Loja */}
      <section className="relative px-4">
        <div className="-mt-10 flex items-end gap-3">
          <img src="/icons/cozinha-logo.webp" alt="Logo Tia Val Cozinha" width={84} height={84} className="size-20 rounded-full border-4 border-background object-cover shadow-card" />
          <span className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${open === false ? 'bg-muted text-muted-foreground' : 'bg-success-surface text-success'}`}>
            <span className={`size-2 rounded-full ${open === false ? 'bg-muted-foreground' : 'bg-success'}`} />
            {open === null ? 'Cozinha · 11h às 14h' : open ? 'Cozinha aberta' : 'Cozinha fechada agora'}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-foreground">Marmitex da Tia Val</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Heart className="size-4 fill-primary text-primary" /> 6 anos de comida caseira no Primeiro de Maio</p>

        <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border text-center">
          <div className="px-2 py-3">
            <Clock className="mx-auto size-5 text-primary" />
            <p className="mt-1 text-sm font-bold">15–25 min</p>
            <p className="text-xs text-muted-foreground">entrega</p>
          </div>
          <div className="px-1.5 py-3">
            <Bike className="mx-auto size-5 text-success" />
            <p className="mt-1 text-sm font-extrabold text-foreground">
              <span className="text-success">Grátis</span> <span className="text-xs font-semibold text-muted-foreground">(1º de Maio)</span>
            </p>
            <p className="text-[11px] text-muted-foreground">{formatPrice(deliveryFeePerKm)}/km outros bairros</p>
          </div>
          <div className="px-2 py-3">
            <Store className="mx-auto size-5 text-primary" />
            <p className="mt-1 text-sm font-bold">Grátis</p>
            <p className="text-xs text-muted-foreground">retirada</p>
          </div>
        </div>

        <div className="da-trust-marquee mt-3" aria-label="Pagamento seguro, entrega acompanhada e opções para pagar na entrega">
          <div className="da-trust-track">
            {[0, 1].map(copy => <div key={copy} className="da-trust-group" aria-hidden={copy === 1 ? true : undefined}>
              <span className="da-trust-chip !border-2 !border-primary !bg-card !font-extrabold !text-foreground [&>svg]:!text-primary"><ShieldCheck className="size-4" /> Pix e cartão seguros</span>
              <span className="da-trust-chip !border-2 !border-primary !bg-card !font-extrabold !text-foreground [&>svg]:!text-primary"><Bike className="size-4" /> Acompanhe a entrega ao vivo</span>
              <span className="da-trust-chip !border-2 !border-primary !bg-card !font-extrabold !text-foreground [&>svg]:!text-primary"><span aria-hidden>💵</span> Dinheiro ou maquininha na entrega</span>
            </div>)}
          </div>
        </div>
        {open === false && <p className="mt-3 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">Agora a cozinha está fechada ({openingHours.weekdays.toLowerCase()}). Você já pode <button type="button" className="font-bold underline" onClick={() => goTo('amanha')}>reservar a marmita de amanhã</button>.</p>}
      </section>

      {/* Banners em destaque */}
      <BannerCarousel onOpenPlan={() => setPlanOpen(true)} />

      {/* Plano 7 Dias em destaque */}
      <section className="px-4 pt-4">
        <button type="button" onClick={() => setPlanOpen(true)} className="relative w-full overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary to-primary/80 p-4 text-left text-primary-foreground shadow-card transition active:scale-[.99]" aria-label="Conhecer o Plano 7 Dias">
          <span className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/15 blur-xl" aria-hidden />
          <span className="flex items-center gap-2"><CalendarCheck className="size-5" /><span className="text-[11px] font-extrabold uppercase tracking-[0.14em]">Plano 7 Dias · mais vendido</span></span>
          <span className="mt-1.5 block text-xl font-black leading-tight">7 marmitas + 7 Coca-Colas</span>
          <span className="mt-0.5 block text-sm font-semibold opacity-90">Você agenda os dias (seg a sáb) e recebe quentinha em casa.</span>
          <span className="mt-3 flex items-end justify-between gap-3">
            <span><small className="block text-[11px] font-bold opacity-85">a partir de</small><strong className="text-2xl font-black">{formatPrice(Math.min(...planSizes.map(s => s.priceWithCoke)))}</strong></span>
            <span className="rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-primary">Quero o plano →</span>
          </span>
        </button>
      </section>

      {/* Abas fixas */}
      <nav className="sticky top-0 z-20 mt-4 border-b border-border bg-background/95 px-4 backdrop-blur" aria-label="Cardápio">
        <div className="flex gap-6">
          {([['hoje', 'Prato de hoje'], ['amanha', 'Reservar amanhã']] as const).map(([id, text]) => <button key={id} type="button" onClick={() => goTo(id)} className={`relative py-3 text-sm font-bold transition ${tab === id ? 'text-primary' : 'text-muted-foreground'}`}>{text}{tab === id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}</button>)}
        </div>
      </nav>

      {/* Hoje */}
      <section id="secao-hoje" className="scroll-mt-14 px-4 pt-5">
        <h2 className="text-lg font-extrabold">Prato de hoje</h2>
        <button type="button" onClick={() => openItem(todayMeal, 'hoje')} className="mt-3 block w-full overflow-hidden rounded-2xl border border-border text-left shadow-card transition active:scale-[.99]">
          <div className="relative">
            <DishVideo meal={todayMeal} className="aspect-[16/10]" />
            {todayMeal.badge && <span className="absolute left-3 top-3 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">🔥 {todayMeal.badge}</span>}
          </div>
          <div className="p-4">
            <h3 className="text-lg font-bold">{todayMeal.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{todayMeal.description}</p>
            <p className="mt-2 text-sm"><span className="text-muted-foreground">A partir de </span><strong className="text-base text-success">{formatPrice(minPrice(todayMeal))}</strong></p>
          </div>
        </button>

        <h3 className="mt-6 text-base font-extrabold">Escolha o tamanho</h3>
        <p className="text-xs text-muted-foreground">Toque no + ou - para colocar ou retirar da sacola</p>
        <ul className="mt-2 divide-y divide-border">
          {todayMeal.sizes.map(size => {
            const inBag = qtyOf(todayMeal.id, size.id);
            const isOnlyDish = size.id.startsWith('so-');
            const subtitle = isOnlyDish
              ? ` · só ${todayMeal.name.toLowerCase()}, sem acompanhamentos`
              : ' · com arroz, feijão e acompanhamentos';
            return <li key={size.id} className="flex items-center gap-3 py-3">
              <button type="button" className="flex flex-1 flex-col items-start text-left" onClick={() => openItem(todayMeal, 'hoje', size)}>
                <span className="font-semibold">{todayMeal.name} · {sizeName(size).toLowerCase()}</span>
                <span className="text-xs text-muted-foreground">{sizeVolume(size)}{subtitle}</span>
                <span className="mt-1 font-bold">{formatPrice(size.price)}</span>
              </button>
              {inBag > 0 ? (
                <Stepper small value={inBag} onMinus={() => removeFromBag(todayMeal.id, size.id)} onPlus={() => addToBag(todayMeal, size, 1)} />
              ) : (
                <button type="button" aria-label={`Adicionar ${sizeName(size)}`} onClick={() => addToBag(todayMeal, size, 1)} className="grid size-10 place-items-center rounded-full border-2 border-primary text-primary transition active:scale-90"><Plus className="size-5" /></button>
              )}
            </li>;
          })}
        </ul>
      </section>

      {/* Amanhã */}
      <section id="secao-amanha" className="scroll-mt-14 px-4 pt-6">
        <h2 className="text-lg font-extrabold">Reservar para amanhã</h2>
        <p className="text-xs text-muted-foreground">Garanta a sua antes de acabar — a Tia Val separa a sua marmita.</p>
        <button type="button" onClick={() => openItem(tomorrowMeal, 'amanha')} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left shadow-card transition active:scale-[.99]">
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wide text-primary">Amanhã</span>
            <h3 className="text-base font-bold">{tomorrowMeal.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{tomorrowMeal.description}</p>
            <p className="mt-1 text-sm"><span className="text-muted-foreground">A partir de </span><strong className="text-success">{formatPrice(minPrice(tomorrowMeal))}</strong></p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-primary"><CalendarCheck className="size-4" /> Reservar</span>
          </div>
          <DishVideo meal={tomorrowMeal} className="size-28 shrink-0 rounded-xl" />
        </button>
      </section>

      {/* Informações */}
      <section className="mt-8 space-y-3 border-t-8 border-secondary px-4 pt-6">
        <h2 className="text-lg font-extrabold">Como funciona</h2>
        <ol className="space-y-3 text-sm">
          {['Escolha o tamanho e toque em +', 'Coloque seu endereço: a taxa sai na hora', 'Pague com Pix, cartão ou na entrega', 'Acompanhe o motoboy até a sua porta'].map((t, i) => <li key={t} className="flex items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-primary">{i + 1}</span>{t}</li>)}
        </ol>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm"><MapPin className="size-5 shrink-0 text-primary" /><span className="flex-1">Rua Padre Cyr Assumpção, 289 — Primeiro de Maio, BH<small className="block text-muted-foreground">{openingHours.weekdays} · {openingHours.sunday}</small></span><ChevronRight className="size-4 text-muted-foreground" /></a>
      </section>
    </div>

    {/* Sacola fixa */}
    {count > 0 && !bagOpen && <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg p-3 da-bag-enter">
      <button key={bump} type="button" onClick={() => { setBagStep('bag'); setBagOpen(true); }} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-primary px-4 text-primary-foreground shadow-bag active:scale-[.98] transition">
        <span className="da-pop relative grid size-9 place-items-center"><ShoppingBag className="size-6" /><span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary-foreground text-[11px] font-extrabold text-primary">{count}</span></span>
        <span className="flex-1 text-center text-base font-bold">Ver sacola</span>
        <span className="text-base font-bold tabular-nums">{formatPrice(subtotal)}</span>
      </button>
    </div>}

    {/* Item */}
    <Sheet open={Boolean(itemSheet)} onOpenChange={o => { if (!o) setItemSheet(null); }}>
      <SheetContent side="bottom" className={sheetClass}>
        {itemSheet && <>
          <div className="flex-1 overflow-y-auto">
            <DishVideo meal={itemSheet.meal} className="aspect-[16/10]" controls />
            <div className="p-4">
              {itemSheet.when === 'amanha' && <span className="text-xs font-bold uppercase tracking-wide text-primary">Reserva para amanhã</span>}
              <SheetTitle className="text-xl font-extrabold text-foreground">{itemSheet.meal.name}</SheetTitle>
              <SheetDescription className="mt-1 text-sm text-muted-foreground">{itemSheet.meal.description}</SheetDescription>
            </div>
            <div className="flex items-center justify-between bg-muted px-4 py-3">
              <div><p className="font-bold">Escolha o tamanho</p><p className="text-xs text-muted-foreground">Escolha 1 opção</p></div>
              <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase ${sheetSize ? 'bg-success-surface text-success' : 'bg-foreground text-background'}`}>{sheetSize ? 'Ok' : 'Obrigatório'}</span>
            </div>
            <div role="radiogroup" aria-label="Tamanho" className="divide-y divide-border px-4">
              {itemSheet.meal.sizes.map(size => <button key={size.id} type="button" role="radio" aria-checked={sizeId === size.id} onClick={() => setSizeId(size.id)} className="flex w-full items-center gap-3 py-3 text-left">
                <span className="flex-1"><span className="block font-semibold">{sizeName(size)}</span><span className="text-xs text-muted-foreground">{sizeVolume(size)}</span><span className="block text-sm font-bold">{formatPrice(size.price)}</span></span>
                <span className={`grid size-6 place-items-center rounded-full border-2 ${sizeId === size.id ? 'border-primary' : 'border-input'}`}>{sizeId === size.id && <span className="size-3 rounded-full bg-primary" />}</span>
              </button>)}
            </div>
            <div className="px-4 pb-4 pt-2">
              <label htmlFor="item-notes" className="text-sm font-bold">Alguma observação?</label>
              <textarea id="item-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={240} rows={2} placeholder="Ex.: sem cebola, caprichar no torresmo..." className="da-field mt-2 resize-none" />
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-border bg-background p-3">
            <Stepper value={qty} min={1} max={10} onMinus={() => setQty(q => Math.max(1, q - 1))} onPlus={() => setQty(q => Math.min(10, q + 1))} />
            <Button variant="cta" size="xl" className="flex-1 justify-between" disabled={!sheetSize} onClick={confirmItem}>
              <span>{itemSheet.when === 'amanha' ? 'Reservar' : 'Adicionar'}</span><span className="tabular-nums">{sheetSize ? formatPrice(sheetSize.price * qty) : 'Escolha'}</span>
            </Button>
          </div>
        </>}
      </SheetContent>
    </Sheet>

    {/* Sacola + checkout */}
    <Sheet open={bagOpen} onOpenChange={setBagOpen}>
      <SheetContent side="bottom" className={sheetClass}>
        <div className="border-b border-border px-4 py-4 pr-12">
          <SheetTitle className="text-lg font-extrabold text-foreground">{bagStep === 'bag' ? 'Sua sacola' : 'Finalizar pedido'}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">Marmitex da Tia Val · entrega em 15–25 min</SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {bagStep === 'bag' ? (lines.length === 0 ? <div className="py-10 text-center"><ShoppingBag className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 font-bold">Sua sacola está vazia</p><Button variant="ctaOutline" size="lg" className="mt-4" onClick={() => setBagOpen(false)}>Ver cardápio</Button></div> : <>
            <ul className="divide-y divide-border">
              {lines.map(l => <li key={l.key} className="flex items-center gap-3 py-3">
                <div className="flex-1"><p className="font-semibold">{l.meal.name}</p><p className="text-xs text-muted-foreground">{l.size.label}{l.notes ? ` · ${l.notes}` : ''}</p><p className="mt-1 font-bold">{formatPrice(l.size.price * l.quantity)}</p></div>
                <Stepper small value={l.quantity} onMinus={() => changeQty(l.key, -1)} onPlus={() => changeQty(l.key, 1)} />
              </li>)}
            </ul>
            <button type="button" onClick={() => setBagOpen(false)} className="mt-2 w-full py-3 text-center text-sm font-bold text-primary">+ Adicionar mais itens</button>
            <button type="button" onClick={() => { setBagOpen(false); setPlanOpen(true); }} className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-border bg-accent p-3 text-left transition active:scale-[.99]">
              <CalendarCheck className="size-5 shrink-0 text-primary" />
              <span className="flex-1 text-sm"><strong className="block text-primary">Prefere o Plano de 7 dias?</strong><span className="text-xs text-muted-foreground">7 marmitas + refrigerante, com entrega grátis no Primeiro de Maio</span></span>
              <ChevronRight className="size-4 text-primary" />
            </button>
            {open === false && <p className="mt-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">A cozinha está fechada agora. O pedido fica registrado e a Tia Val confirma no próximo horário.</p>}
          </>) : <CheckoutForm when="hoje" items={lines.map(l => ({ name: l.meal.name, sizeLabel: l.size.label, unitPrice: l.size.price, quantity: l.quantity, notes: l.notes }))} onDone={() => { setBagOpen(false); setBag([]); setSaved(readSavedOrders()); const c = readCustomer(); setCustomer(c); if (c?.phone) fetchOrdersByPhone(c.phone); }} />}
        </div>
        {bagStep === 'bag' && lines.length > 0 && <div className="space-y-2 border-t border-border bg-background p-3">
          <div className="flex justify-between px-1 text-sm"><span className="text-muted-foreground">Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
          <div className="flex justify-between px-1 text-xs text-muted-foreground"><span>Entrega</span><span>calculada no próximo passo ({formatPrice(deliveryFeePerKm)}/km)</span></div>
          <Button variant="cta" size="xl" className="w-full" onClick={() => setBagStep('checkout')}>Continuar</Button>
        </div>}
      </SheetContent>
    </Sheet>

    {/* Reserva amanhã */}
    <Sheet open={Boolean(reserve)} onOpenChange={o => { if (!o) setReserve(null); }}>
      <SheetContent side="bottom" className={sheetClass}>
        <div className="border-b border-border px-4 py-4 pr-12">
          <SheetTitle className="text-lg font-extrabold text-foreground">Reservar para amanhã</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">A Tia Val separa a sua marmita.</SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {reserve && <CheckoutForm when="amanha" items={[{ name: reserve.meal.name, sizeLabel: reserve.size.label, unitPrice: reserve.size.price, quantity: reserve.quantity, notes: reserve.notes }]} onDone={() => { setReserve(null); setSaved(readSavedOrders()); const c = readCustomer(); setCustomer(c); if (c?.phone) fetchOrdersByPhone(c.phone); }} />}
        </div>
      </SheetContent>
    </Sheet>

    {/* Plano 7 Dias */}
    <Sheet open={planOpen} onOpenChange={setPlanOpen}>
      <SheetContent side="bottom" className={sheetClass}>
        <div className="border-b border-border px-4 py-4 pr-12">
          <SheetTitle className="text-lg font-extrabold text-foreground">Plano 7 Dias</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">7 marmitas + 7 bebidas, entrega grátis no Primeiro de Maio</SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {planOpen && <PlanSheet onDone={() => { setPlanOpen(false); setSaved(readSavedOrders()); const c = readCustomer(); setCustomer(c); if (c?.phone) fetchOrdersByPhone(c.phone); }} />}
        </div>
      </SheetContent>
    </Sheet>

    {/* Meus pedidos e Login sem senha por telefone */}
    <Sheet open={ordersOpen} onOpenChange={setOrdersOpen}>
      <SheetContent side="bottom" className={sheetClass}>
        <div className="border-b border-border px-4 py-4 pr-12">
          <SheetTitle className="text-lg font-extrabold text-foreground">
            {customer?.phone ? 'Meus pedidos da Tia Val' : 'Entrar e ver pedidos'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {customer?.phone
              ? `Conta vinculada ao telefone ${formatPhone(customer.phone)}`
              : 'Login simples sem senha: basta colocar seu WhatsApp ou telefone'}
          </SheetDescription>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Card de identificação / formulário de telefone */}
          {customer?.phone ? (
            <div className="rounded-2xl border border-border bg-accent/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-success text-success-foreground">
                    <UserCheck className="size-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Login ativo (sem senha)</p>
                    <p className="text-sm font-extrabold text-foreground">
                      {customer.name ? `${customer.name} · ` : ''}{formatPhone(customer.phone)}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-success-surface px-2 py-0.5 text-[11px] font-extrabold text-success">
                  Conectado
                </span>
              </div>

              <div className="flex gap-2 pt-1 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs font-bold gap-1"
                  disabled={ordersLoading}
                  onClick={() => fetchOrdersByPhone(customer.phone)}
                >
                  <RefreshCw className={`size-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                  {ordersLoading ? 'Atualizando...' : 'Atualizar pedidos'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-bold text-muted-foreground hover:text-destructive"
                  onClick={handleLogoutCustomer}
                >
                  <LogOut className="size-3.5 mr-1" /> Trocar telefone
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchOrdersByPhone(phoneInput, nameInput);
              }}
              className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3"
            >
              <div className="space-y-1">
                <label htmlFor="customer-phone" className="block text-xs font-extrabold uppercase tracking-wide text-primary">
                  Acesse com seu telefone (sem senha)
                </label>
                <p className="text-xs text-muted-foreground">
                  Digite seu telefone ou WhatsApp para carregar todos os seus pedidos e salvar seus dados:
                </p>
              </div>

              <div className="space-y-2">
                <input
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(maskPhoneInput(e.target.value))}
                  placeholder="(31) 99999-9999"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  autoComplete="name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Seu nome (opcional)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              {loginError && (
                <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" /> {loginError}
                </p>
              )}

              <Button type="submit" variant="cta" size="lg" className="w-full font-bold" disabled={ordersLoading}>
                {ordersLoading ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin mr-1.5" /> Buscando pedidos no banco...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4 mr-1.5" /> Acessar meus pedidos
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Lista de Pedidos */}
          {ordersLoading && customerOrders.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
              <p className="text-sm font-bold text-muted-foreground">Consultando seus pedidos no banco de dados...</p>
            </div>
          ) : customerOrders.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pedidos encontrados ({customerOrders.length})
                </span>
              </div>

              <ul className="space-y-2.5">
                {customerOrders.map((o) => (
                  <li key={o.id} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="flex items-center gap-2">
                          <strong className="text-base font-extrabold text-foreground">Pedido #{o.code}</strong>
                          {o.isPlan && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              Plano 7 Dias
                            </span>
                          )}
                        </span>
                        <small className="block text-xs text-muted-foreground">{savedAtLabel(o.createdAt)}</small>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${orderStatusBadgeClass(
                          o.orderStatus,
                        )}`}
                      >
                        {orderStatusLabel(o.orderStatus)}
                      </span>
                    </div>

                    {o.items.length > 0 && (
                      <div className="rounded-xl bg-accent/40 p-2.5 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground mb-0.5">Itens do pedido:</p>
                        <p>
                          {o.items.map((it) => `${it.quantity}x ${it.mealName} (${it.sizeLabel})`).join(' · ')}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/50">
                      <span>
                        Total: <strong className="text-sm font-bold text-foreground">{formatPrice(o.total)}</strong>
                      </span>
                      {o.trackingToken ? (
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1 font-bold text-primary">
                          <a href={trackingHref(o.trackingToken)}>
                            Acompanhar <ChevronRight className="size-3.5" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground capitalize">{o.fulfillment}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : customer?.phone && !ordersLoading ? (
            <div className="py-8 text-center space-y-2 rounded-2xl border border-dashed border-border p-4">
              <ReceiptText className="mx-auto size-9 text-muted-foreground" />
              <p className="font-bold text-foreground">Nenhum pedido encontrado para este telefone</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Assim que você concluir um pedido pelo site com o número {formatPhone(customer.phone)}, ele aparecerá aqui
                para acompanhar.
              </p>
            </div>
          ) : saved.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                Pedidos recentes neste aparelho
              </p>
              <ul className="space-y-2">
                {saved.map((o) => {
                  const plan = readPlanMeta(o.token);
                  if (plan) {
                    const delivered = planDeliveredCount(plan);
                    const upcoming = plan.dates.filter((d) => d > spDateKey(new Date())).slice(0, 3);
                    return (
                      <li key={o.token}>
                        <a href={trackingHref(o.token)} className="block rounded-2xl border-2 border-primary/40 bg-accent p-3">
                          <span className="flex items-center gap-3">
                            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                              <CalendarCheck className="size-5" />
                            </span>
                            <span className="flex-1">
                              <strong className="block">Plano 7 Dias · #{o.code}</strong>
                              <small className="text-muted-foreground">
                                {delivered} de {PLAN_DAYS} marmitas entregues
                              </small>
                            </span>
                            <ChevronRight className="size-4 text-primary" />
                          </span>
                          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-background">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${(delivered / PLAN_DAYS) * 100}%` }}
                            />
                          </span>
                          {upcoming.length > 0 && (
                            <small className="mt-2 block text-xs text-muted-foreground">
                              Próximas: {upcoming.map(planDateLabel).join(' · ')} · {plan.window}
                            </small>
                          )}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={o.token}>
                      <a href={trackingHref(o.token)} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                        <span className="grid size-10 place-items-center rounded-full bg-accent text-primary">
                          <ReceiptText className="size-5" />
                        </span>
                        <span className="flex-1">
                          <strong className="block">Pedido #{o.code}</strong>
                          <small className="text-muted-foreground">{savedAtLabel(o.savedAt)}</small>
                        </span>
                        <span className="text-sm font-bold text-primary">Acompanhar</span>
                        <ChevronRight className="size-4 text-primary" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="py-10 text-center">
              <ReceiptText className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 font-bold">Nenhum pedido ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conecte seu telefone acima ou escolha um prato do dia para pedir.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <ContactDock />
  </div>;
}
