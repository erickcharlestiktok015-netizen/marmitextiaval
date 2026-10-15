import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bell, Bike, CheckCircle2, Clock3, CookingPot, MapPin, PackageCheck, RefreshCw } from 'lucide-react';

const searchSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/).catch('') });
type TrackingOrder = {
  code: string; order_status: string; payment_status: string; payment_method: string;
  fulfillment: string; estimated_delivery_at: string | null; courier_status: string;
  confirmation_code: string | null; created_at: string; updated_at: string;
  items: Array<{ meal_name: string; size_label: string; quantity: number }>;
};
const steps = [
  { value: 'novo', title: 'Pedido recebido', description: 'Recebemos seu pedido.' },
  { value: 'confirmado', title: 'Pedido confirmado', description: 'A Tia Val confirmou seu pedido.' },
  { value: 'preparando', title: 'Preparando com carinho', description: 'Sua comida está sendo preparada.' },
  { value: 'saiu_entrega', title: 'Saiu para entrega', description: 'O motoboy está a caminho.' },
  { value: 'concluido', title: 'Pedido entregue', description: 'Bom apetite! Obrigado por pedir com a Tia Val.' },
];
const orderIndex = (status: string) => steps.findIndex((step) => step.value === status);
const brasiliaTime = (value: string | number | Date = new Date()) =>
  new Date(value).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  const [error, setError] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const previousStatus = useRef('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [clock, setClock] = useState(() => brasiliaTime());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(brasiliaTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) { setError('Este link de acompanhamento está incompleto. Abra o link que apareceu ao finalizar o pedido.'); return; }
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/public/tracking?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = await response.json() as { order?: TrackingOrder; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error || 'Pedido não encontrado.');
        if (!active) return;
        const next = data.order;
        if (previousStatus.current && alertsEnabled && (previousStatus.current !== next.order_status || (previousStatus.current !== 'cheguei' && next.courier_status === 'cheguei'))) {
          try {
            const AudioContextClass = window.AudioContext;
            const audio = new AudioContextClass();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = 'sine'; oscillator.frequency.value = 880;
            gain.gain.value = 0.12;
            oscillator.connect(gain); gain.connect(audio.destination);
            oscillator.start(); oscillator.stop(audio.currentTime + 0.25);
            oscillator.onended = () => { void audio.close(); };
          } catch { /* Sound is optional; visual updates still work. */ }
        }
        previousStatus.current = next.order_status;
        setOrder(next); setLastUpdated(brasiliaTime());
        setError('');
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao consultar pedido.');
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, alertsEnabled]);

  const currentStep = order ? orderIndex(order.order_status) : -1;
  const finished = order ? ['concluido', 'cancelado'].includes(order.order_status) : false;

  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fffaf0_0%,_#f7f4ed_52%,_#efe9dc_100%)] px-4 py-6 text-[#25251f] sm:py-10">
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-[#25251f] p-6 text-[#fffaf0] shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border-[24px] border-white/5" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e9c878]">Marmitex da Tia Val</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Seu pedido, passo a passo</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#e0d9c9]">Acompanhe cada etapa por aqui. As informações são consultadas automaticamente.</p>
          </div>
          <div className="hidden h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#e9c878] sm:grid"><Bike size={30}/></div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          {order && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-bold">Pedido #{order.code}</span>}
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"/> Acompanhamento ao vivo</span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e5dfd2] bg-white/90 p-4 shadow-sm sm:p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#777266]"><Clock3 size={15}/> Horário de Brasília</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight">{clock}</p>
          <p className="mt-1 text-xs text-[#777266]">Relógio atualizado em tempo real (UTC−3).</p>
        </div>
        <div className="rounded-2xl border border-[#e5dfd2] bg-white/90 p-4 shadow-sm sm:p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#777266]"><RefreshCw size={15}/> Sincronização do pedido</p>
          <p className="mt-2 text-xl font-bold">{lastUpdated ? `Atualizado às ${lastUpdated}` : 'Consultando pedido…'}</p>
          <p className="mt-1 text-xs text-[#777266]">Consulta automática a cada 5 segundos.</p>
        </div>
      </section>

      {error && !order && <div role="alert" className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-800 shadow-sm">{error}</div>}
      {order && <>
        <section className="rounded-3xl border border-[#e5dfd2] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-[#9a742a]">Situação atual</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">{order.courier_status === 'cheguei' ? 'O motoboy chegou ao endereço!' : steps.find(s => s.value === order.order_status)?.title ?? order.order_status}</h2></div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f8f1df] text-[#9a742a]">{order.courier_status === 'cheguei' ? <MapPin size={25}/> : order.order_status === 'concluido' ? <CheckCircle2 size={25} className="text-emerald-700"/> : <Bike size={25}/>}</span>
          </div>
          {order.estimated_delivery_at && !finished && <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#ead9a8] bg-[#fff9e8] p-4"><div><p className="text-sm font-medium text-[#78612c]">Previsão de chegada</p><p className="mt-1 text-xs text-[#8b7950]">Horário de Brasília</p></div><p className="text-3xl font-extrabold tabular-nums">{estimatedTime(order.estimated_delivery_at)}</p></div>}
          {order.payment_method === 'online' && <p className="mt-4 rounded-xl bg-[#f7f4ed] px-4 py-3 text-sm font-medium">{order.payment_status === 'approved' ? '✓ Pagamento online confirmado' : 'Pagamento online aguardando confirmação'}</p>}
          {order.courier_status === 'cheguei' && <div className="mt-4 rounded-2xl border border-[#e9c878] bg-[#fff9e8] p-4"><p className="font-bold">O motoboy avisou que chegou.</p>{order.confirmation_code && <><p className="mt-2 text-sm">Mostre este código ao entregador para confirmar o recebimento:</p><p className="mt-2 text-3xl font-extrabold tracking-[.25em]">{order.confirmation_code}</p></>}</div>}
          <button type="button" onClick={() => { setAlertsEnabled(true); try { const C = window.AudioContext; const a = new C(); void a.resume().then(() => a.close()); } catch { /* optional */ } }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ddd5c4] px-4 py-2 text-sm font-semibold transition hover:bg-[#f7f4ed]"><Bell size={16}/> {alertsEnabled ? 'Avisos sonoros ativados' : 'Ativar aviso sonoro neste celular'}</button>
        </section>

        <section className="rounded-3xl border border-[#e5dfd2] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Andamento do pedido</h2><span className="rounded-full bg-[#f7f4ed] px-3 py-1 text-xs font-bold text-[#777266]">{currentStep >= 0 ? `Etapa ${currentStep + 1} de ${steps.length}` : 'Em atualização'}</span></div>
          <ol className="mt-6 space-y-0">{steps.map((step, index) => {
            const done = currentStep >= 0 && index <= currentStep;
            const current = index === currentStep;
            return <li key={step.value} className="relative flex gap-4 pb-6 last:pb-0">
              {index < steps.length - 1 && <span className={`absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5 ${index < currentStep ? 'bg-[#d8b95e]' : 'bg-[#eee9df]'}`}/>}
              <span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-white ${done ? 'bg-[#e9c878] text-[#25251f]' : 'bg-[#f0ede6] text-[#938d7f]'} ${current ? 'shadow-[0_0_0_4px_#fff4d5]' : ''}`}>{done ? <CheckCircle2 size={19}/> : index === 2 ? <CookingPot size={19}/> : index === 3 ? <Bike size={19}/> : index === 4 ? <PackageCheck size={19}/> : <Clock3 size={19}/>}</span>
              <span className="pt-1"><strong className={current ? 'text-[#9a742a]' : ''}>{step.title}</strong><span className="mt-1 block text-sm leading-5 text-[#777266]">{step.description}</span></span>
            </li>;
          })}</ol>
          <div className="mt-2 rounded-2xl bg-[#f7f4ed] p-4 sm:p-5"><p className="text-sm font-bold">Itens do pedido</p>{order.items.map((item, i) => <div key={i} className="mt-3 flex items-start justify-between gap-3 border-b border-[#e8e1d4] pb-3 last:border-0 last:pb-0"><span className="text-sm text-[#5f5a50]">{item.meal_name} · {item.size_label}</span><span className="shrink-0 rounded-lg bg-white px-2 py-1 text-sm font-bold">{item.quantity}×</span></div>)}</div>
        </section>
      </>}
      <footer className="pb-2 text-center text-xs text-[#777266]">Feito com carinho pela Marmitex da Tia Val · Horários exibidos no fuso de Brasília.</footer>
    </div>
  </main>;
}
