import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Bell, Bike, CalendarCheck, Check, CheckCircle2, ChevronRight, Clock3, CookingPot, MapPin, MessageCircle, PackageCheck, ReceiptText } from 'lucide-react';
import { PLAN_DAYS, planDateLabel, planDeliveredCount, type PlanMeta } from '@/lib/weekly-plan';
import { DeliveryMap, type GeoPoint } from '@/components/delivery-map';

const searchSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/).catch('') });
type SavedOrder = { code: string; token: string; savedAt: string };
type TrackingOrder = {
  address?: unknown;
  code: string; order_status: string; payment_status: string; payment_method: string;
  fulfillment: string; estimated_delivery_at: string | null; courier_status: string;
  confirmation_code: string | null; created_at: string; updated_at: string; courier_latitude: number | null; courier_longitude: number | null; courier_location_updated_at: string | null;
  plan: PlanMeta | null;
  items: Array<{ meal_name: string; size_label: string; quantity: number }>;
};

const coords = (address: unknown): GeoPoint | null => {
  if (!address || typeof address !== 'object') return null;
  const a = address as Record<string, unknown>;
  const latitude = Number(a['latitude'] ?? a['lat']);
  const longitude = Number(a['longitude'] ?? a['lng'] ?? a['lon']);
  return Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
};

const neighborhoodOf = (address: unknown) => {
  if (!address || typeof address !== 'object') return '';
  const a = address as Record<string, unknown>;
  return String(a['bairro'] ?? a['neighborhood'] ?? a['district'] ?? '').trim();
};

const addressText = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const a = value as Record<string, unknown>;
  return (
    [
      a['street'] ?? a['rua'],
      a['number'] ?? a['numero'],
      a['bairro'],
      a['cidade'],
    ]
      .filter(Boolean)
      .join(', ') || ''
  );
};

const steps = [
  { value: 'novo', title: 'Pedido recebido', description: 'Recebemos seu pedido.' },
  { value: 'confirmado', title: 'Pedido confirmado', description: 'A Tia Val confirmou seu pedido.' },
  { value: 'preparando', title: 'Na cozinha', description: 'Sua comida está sendo preparada com carinho.' },
  { value: 'saiu_entrega', title: 'Saiu com o motoboy', description: 'O motoboy está a caminho.' },
  { value: 'concluido', title: 'Entregue', description: 'Bom apetite! Obrigado por pedir com a Tia Val.' },
];
const orderIndex = (status: string) => steps.findIndex((step) => step.value === status);
const brasiliaTime = (value: string | number | Date = new Date()) =>
  (value instanceof Date ? value : new Date(value)).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const estimatedTime = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

export const Route = createFileRoute('/acompanhar')({
  validateSearch: searchSchema,
  head: () => ({ meta: [
    { title: 'Acompanhe seu pedido | Marmitex da Tia Val' },
    { name: 'robots', content: 'noindex,nofollow' },
  ] }),
  component: TrackingPage,
});

function TrackingPage() {
  const { token } = Route.useSearch();
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [error, setError] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const previousStatus = useRef<{ order_status: string; courier_status: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [clock, setClock] = useState(() => brasiliaTime());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tia-val-meus-pedidos') || '[]') as SavedOrder[];
      if (Array.isArray(saved)) setSavedOrders(saved.filter(item => item && typeof item.code === 'string' && typeof item.token === 'string' && /^[a-f0-9]{64}$/.test(item.token)).slice(0, 20));
    } catch { setSavedOrders([]); }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(brasiliaTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/public/tracking?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = await response.json() as { order?: TrackingOrder; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error || 'Pedido não encontrado.');
        if (!active) return;
        const next = data.order;
        try {
          const key = 'tia-val-meus-pedidos';
          const saved = JSON.parse(localStorage.getItem(key) || '[]') as SavedOrder[];
          const item = { code: next.code, token, savedAt: new Date().toISOString() };
          const updated = [item, ...saved.filter(order => order.token !== token)].slice(0, 20);
          localStorage.setItem(key, JSON.stringify(updated));
          setSavedOrders(updated);
        } catch { /* A página de acompanhamento continua funcionando sem histórico local. */ }
        const previous = previousStatus.current;
        const justArrived = Boolean(previous && previous.courier_status !== 'cheguei' && next.courier_status === 'cheguei');
        const statusChanged = Boolean(previous && previous.order_status !== next.order_status);
        if (previous && alertsEnabled && (statusChanged || justArrived)) {
          try {
            const AudioContextClass = window.AudioContext;
            const audio = new AudioContextClass();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = 'sine'; oscillator.frequency.value = justArrived ? 1046 : 880;
            gain.gain.value = 0.12;
            oscillator.connect(gain); gain.connect(audio.destination);
            oscillator.start(); oscillator.stop(audio.currentTime + 0.3);
            oscillator.onended = () => { void audio.close(); };
          } catch { /* Sound is optional; visual updates still work. */ }
        }
        if (justArrived && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('O motoboy chegou!', {
              body: `O motoboy chegou ao endereço do pedido #${next.code}. Confira o acompanhamento para ver o código de confirmação.`,
              tag: `tia-val-chegou-${next.code}`,
            });
          } catch { /* The status remains visible on the tracking page. */ }
        }
        previousStatus.current = { order_status: next.order_status, courier_status: next.courier_status };
        setOrder(next); setLastUpdated(brasiliaTime());
        setError('');
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao consultar pedido.');
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, alertsEnabled]);

  if (!token) return <main className="delivery-app min-h-screen bg-secondary px-4 py-8">
    <section className="mx-auto max-w-lg rounded-3xl bg-card p-6 shadow-card">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Marmitex da Tia Val</p>
      <h1 className="mt-2 text-2xl font-extrabold">Meus pedidos</h1>
      <p className="mt-2 text-sm text-muted-foreground">Os pedidos salvos neste celular aparecem aqui para acompanhar o preparo e a entrega.</p>
      {savedOrders.length ? <div className="mt-5 space-y-2">{savedOrders.map(item => <a key={item.token} href={`/acompanhar?token=${encodeURIComponent(item.token)}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border p-4 transition active:scale-[.99]">
        <span className="grid size-10 place-items-center rounded-full bg-accent text-primary"><ReceiptText className="size-5" /></span>
        <span className="flex-1"><strong className="block">Pedido #{item.code}</strong><small className="text-muted-foreground">Abrir acompanhamento</small></span>
        <ChevronRight className="size-4 text-primary" />
      </a>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-border p-6 text-center"><p className="font-bold">Nenhum pedido salvo neste celular ainda</p><p className="mt-2 text-sm text-muted-foreground">Depois de finalizar um pedido, ele ficará disponível aqui.</p></div>}
      <a href="/" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground">Voltar à loja</a>
    </section>
  </main>;

  const currentStep = order ? orderIndex(order.order_status) : -1;
  const finished = order ? ['concluido', 'cancelado'].includes(order.order_status) : false;
  const plan = order?.plan ?? null;
  const planDelivered = plan ? planDeliveredCount(plan) : 0;

  return <main className="delivery-app min-h-screen bg-secondary pb-8">
    <div className="mx-auto max-w-lg space-y-3 px-4 py-5">
      <header className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Marmitex da Tia Val</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{plan ? 'Seu Plano 7 Dias' : 'Seu pedido, passo a passo'}</h1>
            <p className="mt-1 text-sm opacity-90">Atualizado automaticamente a cada 10 segundos.</p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15"><Bike className="size-6" /></span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {order && <span className="rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-bold">Pedido #{order.code}</span>}
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold"><span className="size-2 animate-pulse rounded-full bg-success" /> Ao vivo · {clock}</span>
        </div>
      </header>

      {error && !order && <div role="alert" className="rounded-2xl bg-card p-5 text-sm font-medium text-destructive shadow-card">{error}</div>}

      {order && <>
        {/* Situação atual */}
        <section className="rounded-3xl bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Situação atual</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">{order.courier_status === 'cheguei' ? 'O motoboy chegou ao endereço!' : steps.find(s => s.value === order.order_status)?.title ?? order.order_status}</h2>
              {lastUpdated && <p className="mt-1 text-xs text-muted-foreground">Sincronizado às {lastUpdated}</p>}
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-primary">{order.courier_status === 'cheguei' ? <MapPin className="size-6" /> : order.order_status === 'concluido' ? <CheckCircle2 className="size-6 text-success" /> : <Bike className="size-6" />}</span>
          </div>
          {order.estimated_delivery_at && !finished && <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-accent p-4">
            <div><p className="text-sm font-bold text-primary">Previsão de chegada</p><p className="text-xs text-muted-foreground">Horário de Brasília</p></div>
            <p className="text-3xl font-extrabold tabular-nums text-primary">{estimatedTime(order.estimated_delivery_at)}</p>
          </div>}
          {order.payment_method === 'online' && <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm font-medium">{order.payment_status === 'approved' ? '✓ Pagamento online confirmado' : 'Pagamento online aguardando confirmação'}</p>}
          {order.courier_status === 'cheguei' && <div className="mt-4 rounded-2xl border-2 border-primary/40 bg-accent p-4">
            <p className="font-bold">O motoboy avisou que chegou.</p>
            {order.confirmation_code && <><p className="mt-2 text-sm text-muted-foreground">Mostre este código ao entregador para confirmar o recebimento:</p><p className="mt-2 text-center text-3xl font-extrabold tracking-[.25em] text-primary">{order.confirmation_code}</p></>}
          </div>}
          <button type="button" onClick={() => { setAlertsEnabled(true); try { const C = window.AudioContext; const a = new C(); void a.resume().then(() => a.close()); } catch { /* optional */ } if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission(); }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition active:scale-[.98]"><Bell className="size-4" /> {alertsEnabled ? (typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'Notificações e som ativados' : 'Avisos sonoros ativados') : 'Ativar notificações e som'}</button>
        </section>

        {/* Plano 7 Dias */}
        {plan && <section className="rounded-3xl bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><CalendarCheck className="size-5" /></span>
            <div className="flex-1">
              <h2 className="font-extrabold">Plano 7 Dias {plan.withCoke ? '· com Coca-Cola' : '· sem bebida'}</h2>
              <p className="text-sm text-muted-foreground">{planDelivered} de {PLAN_DAYS} marmitas entregues · janela {plan.window}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(planDelivered / PLAN_DAYS) * 100}%` }} /></div>
          <ol className="mt-4 space-y-2">
            {plan.dates.map((d, i) => {
              const done = i < planDelivered;
              return <li key={d} className="flex items-center gap-3 text-sm">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? 'bg-success-surface text-success' : 'bg-muted text-muted-foreground'}`}>{done ? <Check className="size-3.5" /> : i + 1}</span>
                <span className={`capitalize ${done ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{planDateLabel(d)}</span>
              </li>;
            })}
          </ol>
        </section>}

        {/* Mapa do motoboy estilo iFood */}
        {order.order_status === 'saiu_entrega' && typeof order.courier_latitude === 'number' && typeof order.courier_longitude === 'number' && (
          <section className="overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Acompanhamento da entrega</p>
                <h2 className="mt-0.5 text-lg font-black flex items-center gap-2">
                  <span>Seu motoboy está a caminho</span>
                  <span className="text-xl">🛵</span>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Acompanhe em tempo real. O bonequinho atualiza o GPS a cada 10 segundos.
                </p>
                {order.courier_location_updated_at && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Última localização às {brasiliaTime(order.courier_location_updated_at)}.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-success-surface px-3 py-1.5 text-xs font-bold text-success">
                <span className="size-2 animate-ping rounded-full bg-success" />
                <span className="-ml-3 size-2 rounded-full bg-success" />
                <span>GPS ao vivo</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-inner">
              <DeliveryMap
                courierLocation={{
                  latitude: order.courier_latitude,
                  longitude: order.courier_longitude,
                }}
                destinationLocation={coords(order.address)}
                destinationNeighborhood={neighborhoodOf(order.address)}
                destinationTitle={addressText(order.address)}
                className="h-72 w-full sm:h-80"
                showWazeButton={false}
              />
            </div>
          </section>
        )}

        {/* Timeline */}
        <section className="rounded-3xl bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Andamento do pedido</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{currentStep >= 0 ? `Etapa ${currentStep + 1} de ${steps.length}` : 'Em atualização'}</span>
          </div>
          <ol className="mt-5">{steps.map((step, index) => {
            const done = currentStep >= 0 && index <= currentStep;
            const current = index === currentStep;
            return <li key={step.value} className="relative flex gap-4 pb-6 last:pb-0">
              {index < steps.length - 1 && <span className={`absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5 ${index < currentStep ? 'bg-primary' : 'bg-border'}`} />}
              <span className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-card ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{done ? <Check className="size-4" /> : index === 2 ? <CookingPot className="size-4" /> : index === 3 ? <Bike className="size-4" /> : index === 4 ? <PackageCheck className="size-4" /> : <Clock3 className="size-4" />}</span>
              <span className="pt-1"><strong className={current ? 'text-primary' : ''}>{step.title}</strong><span className="mt-0.5 block text-sm text-muted-foreground">{step.description}</span></span>
            </li>;
          })}</ol>
          <div className="mt-2 rounded-2xl bg-muted p-4">
            <p className="text-sm font-bold">Itens do pedido</p>
            {order.items.map((item, i) => <div key={i} className="mt-3 flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"><span className="text-sm text-muted-foreground">{item.meal_name} · {item.size_label}</span><span className="shrink-0 rounded-lg bg-card px-2 py-1 text-sm font-bold">{item.quantity}×</span></div>)}
          </div>
        </section>
      </>}

      <a href={`https://api.whatsapp.com/send/?phone=553134454042&text=${encodeURIComponent(order ? `Olá, Tia Val! Estou falando sobre o pedido #${order.code}.` : 'Olá, Tia Val! Preciso de ajuda com meu pedido.')}&type=phone_number&app_absent=0`} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-success px-5 py-4 text-center font-bold text-success-foreground shadow-card transition active:scale-[.99]"><MessageCircle className="size-5" /> Falar com a Tia Val pelo WhatsApp</a>
      <footer className="pb-2 text-center text-xs text-muted-foreground">Feito com carinho pela Marmitex da Tia Val · Horários no fuso de Brasília.</footer>
    </div>
  </main>;
}
