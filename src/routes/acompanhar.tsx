import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Bell, Bike, CheckCircle2, Clock3, CookingPot, MapPin, PackageCheck, Store } from 'lucide-react';

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
const moneyDate = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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
        setOrder(next); setLastUpdated(new Date().toLocaleTimeString('pt-BR'));
        setError('');
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao consultar pedido.');
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, alertsEnabled]);

  return <main className="min-h-screen bg-[#f7f4ed] px-4 py-8 text-[#25251f] sm:py-12">
    <div className="mx-auto max-w-xl space-y-5">
      <header className="rounded-2xl bg-[#25251f] p-6 text-[#fffaf0] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#e9c878]">Marmitex da Tia Val</p>
        <h1 className="mt-2 text-3xl font-bold">Seu pedido, passo a passo</h1>
        <p className="mt-2 text-sm text-[#e0d9c9]">Acompanhe por aqui. Atualizamos esta página automaticamente.</p>
        {order && <p className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm">Pedido #{order.code}</p>}
      </header>
      {error && !order && <div role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-800">{error}</div>}
      {order && <>
        <section className="rounded-2xl border border-[#e5dfd2] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm text-[#777266]">Situação atual</p><h2 className="mt-1 text-xl font-bold">{order.courier_status === 'cheguei' ? 'O motoboy chegou ao endereço!' : steps.find(s => s.value === order.order_status)?.title ?? order.order_status}</h2></div>
            {order.courier_status === 'cheguei' ? <MapPin className="text-[#9a742a]" size={27} /> : order.order_status === 'concluido' ? <CheckCircle2 className="text-emerald-700" size={27} /> : <Bike className="text-[#9a742a]" size={27} />}
          </div>
          {order.estimated_delivery_at && !['concluido','cancelado'].includes(order.order_status) && <div className="mt-4 rounded-xl bg-[#f8f1df] p-4"><p className="text-sm text-[#78612c]">Previsão de chegada</p><p className="mt-1 text-2xl font-bold">{moneyDate(order.estimated_delivery_at)}</p></div>}
          {order.payment_method === 'online' && <p className="mt-4 text-sm">{order.payment_status === 'approved' ? '✓ Pagamento online confirmado' : 'Pagamento online aguardando confirmação'}</p>}
          {order.courier_status === 'cheguei' && <div className="mt-4 rounded-xl border border-[#e9c878] bg-[#fff9e8] p-4"><p className="font-semibold">O motoboy avisou que chegou.</p>{order.confirmation_code && <><p className="mt-2 text-sm">Mostre este código ao entregador para confirmar o recebimento:</p><p className="mt-1 text-3xl font-bold tracking-[.25em]">{order.confirmation_code}</p></>}</div>}
          <button type="button" onClick={() => { setAlertsEnabled(true); try { const C = window.AudioContext; const a = new C(); void a.resume().then(() => a.close()); } catch { /* optional */ } }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#ddd5c4] px-4 py-2 text-sm font-semibold"><Bell size={16} /> {alertsEnabled ? 'Avisos sonoros ativados' : 'Ativar aviso sonoro neste celular'}</button>
          <p className="mt-2 text-xs text-[#777266]">Última atualização: {lastUpdated || 'consultando…'} · Atualiza a cada 5 segundos.</p>
        </section>
        <section className="rounded-2xl border border-[#e5dfd2] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold">Andamento do pedido</h2>
          <ol className="mt-5 space-y-5">{steps.map((step, index) => {
            const current = orderIndex(order.order_status);
            const done = current >= 0 && index <= current;
            return <li key={step.value} className="flex gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${done ? 'bg-[#e9c878] text-[#25251f]' : 'bg-[#f0ede6] text-[#938d7f]'}`}>{done ? <CheckCircle2 size={19} /> : index === 2 ? <CookingPot size={19} /> : index === 3 ? <Bike size={19} /> : index === 4 ? <PackageCheck size={19} /> : <Clock3 size={19} />}</span>
              <span><strong>{step.title}</strong><span className="mt-1 block text-sm text-[#777266]">{step.description}</span></span>
            </li>;
          })}</ol>
          <div className="mt-5 border-t border-[#eee9df] pt-4"><p className="text-sm font-semibold">Itens do pedido</p>{order.items.map((item, i) => <p key={i} className="mt-2 text-sm text-[#5f5a50]">{item.quantity}× {item.meal_name} · {item.size_label}</p>)}</div>
        </section>
      </>}
      <p className="text-center text-xs text-[#777266]">Feito com carinho pela Marmitex da Tia Val.</p>
    </div>
  </main>;
}
