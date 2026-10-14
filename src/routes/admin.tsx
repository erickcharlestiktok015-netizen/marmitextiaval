import { useCallback, useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bike, CheckCircle2, Clock3, LogOut, MapPin, Phone, RefreshCw, ShieldCheck, Store } from 'lucide-react';

type OrderItem = { meal_name: string; size_label: string; quantity: number; unit_price: number; notes?: string | null };
type Order = {
  id: string; code: string; order_for: 'hoje' | 'amanha'; customer_name: string; customer_phone: string;
  fulfillment: 'entrega' | 'retirada'; address: { cep?: string; street?: string; number?: string; complement?: string; bairro?: string } | null;
  payment_method: string; payment_status: string; order_status: string; subtotal: number; delivery_fee: number;
  total: number; change_for: number | null; created_at: string; items: OrderItem[];
};
const statuses = [
  { value: 'novo', label: 'Novo pedido' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'preparando', label: 'Em preparação' },
  { value: 'saiu_entrega', label: 'Saiu com motoboy' },
  { value: 'pronto_retirada', label: 'Pronto para retirada' },
  { value: 'concluido', label: 'Concluído / entregue' },
  { value: 'cancelado', label: 'Cancelado' },
];
const money = (value: number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const phoneDigits = (value: string) => value.replace(/\D/g, '');
const statusLabel = (value: string) => statuses.find((s) => s.value === value)?.label ?? value;
const paymentLabel = (value: string) => ({
  online: 'Online (Mercado Pago)', 'entrega-pix': 'Pix na entrega',
  'entrega-cartao': 'Cartão na entrega', 'entrega-dinheiro': 'Dinheiro na entrega',
}[value] ?? value);
const paymentStatusLabel = (value: string) => ({
  pending: 'Aguardando pagamento', approved: 'Pagamento aprovado', rejected: 'Pagamento recusado',
  cancelled: 'Pagamento cancelado', refunded: 'Estornado', not_required: 'Pagar na entrega/retirada',
}[value] ?? value);

export const Route = createFileRoute('/admin')({ component: AdminPage });

function AdminPage() {
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ativos');

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (response.status === 401) { setLoggedIn(false); return; }
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os pedidos.');
      setOrders(data.orders ?? []);
      setLoggedIn(true);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  useEffect(() => {
    if (!loggedIn) return;
    const timer = window.setInterval(() => { void loadOrders(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [loggedIn, loadOrders]);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
      setPassword('');
      await loadOrders(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally { setLoading(false); }
  };

  const updateStatus = async (order: Order, order_status: string) => {
    setError('');
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, order_status }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o pedido.');
      await loadOrders(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao atualizar pedido.'); }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setLoggedIn(false); setOrders([]);
  };

  const visibleOrders = orders.filter((order) => filter === 'todos' || (filter === 'ativos' ? !['concluido', 'cancelado'].includes(order.order_status) : order.order_status === filter));
  const pendingCount = orders.filter((order) => order.order_status === 'novo').length;

  if (!loggedIn) return <main className="min-h-screen bg-[#171714] text-[#f7f2e8] flex items-center justify-center p-5">
    <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-[#454238] bg-[#22221e] p-7 shadow-2xl space-y-5">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e9c878] text-[#25231c]"><ShieldCheck size={27} /></div>
      <div className="text-center space-y-2"><p className="text-xs uppercase tracking-[.25em] text-[#e9c878]">Marmitex da Tia Val</p><h1 className="text-2xl font-semibold">Painel de pedidos</h1><p className="text-sm text-[#c2bdae]">Área privada da família</p></div>
      <label className="block space-y-2 text-sm">Senha de acesso<input autoComplete="current-password" type="password" required maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-[#454238] bg-[#171714] px-4 py-3 outline-none focus:border-[#e9c878]" /></label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-[#e9c878] px-4 py-3 font-semibold text-[#25231c] disabled:opacity-60">{loading ? 'Entrando…' : 'Entrar no painel'}</button>
      <p className="text-center text-xs text-[#9d998d]">Acesso protegido. Não compartilhe sua senha.</p>
    </form>
  </main>;

  return <main className="min-h-screen bg-[#f6f3ec] text-[#25251f]">
    <header className="sticky top-0 z-10 border-b border-[#e4dfd3] bg-[#fffdf8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#8b6a25]">Marmitex da Tia Val</p><h1 className="mt-1 text-xl font-bold md:text-2xl">Pedidos da cozinha</h1></div>
        <div className="flex items-center gap-2"><button onClick={() => void loadOrders()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9d2c4] px-3 text-sm"><RefreshCw size={16} /> <span className="hidden sm:inline">Atualizar</span></button><button onClick={() => void logout()} aria-label="Sair" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9d2c4] px-3 text-sm"><LogOut size={16} /><span className="hidden sm:inline">Sair</span></button></div>
      </div>
    </header>
    <section className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#e4dfd3] bg-white p-4"><p className="text-sm text-[#777266]">Pedidos novos</p><p className="mt-1 text-3xl font-bold">{pendingCount}</p></div>
        <div className="rounded-xl border border-[#e4dfd3] bg-white p-4"><p className="text-sm text-[#777266]">Em andamento</p><p className="mt-1 text-3xl font-bold">{orders.filter((o) => !['concluido', 'cancelado'].includes(o.order_status)).length}</p></div>
        <div className="col-span-2 rounded-xl border border-[#e4dfd3] bg-white p-4 md:col-span-1"><p className="text-sm text-[#777266]">Hoje</p><p className="mt-1 text-3xl font-bold">{orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length}</p></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Lista de pedidos</h2><select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-10 rounded-lg border border-[#d9d2c4] bg-white px-3 text-sm"><option value="ativos">Pedidos ativos</option><option value="todos">Todos os pedidos</option>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading && orders.length === 0 && <p className="py-8 text-center text-sm text-[#777266]">Carregando pedidos…</p>}
      {!loading && visibleOrders.length === 0 && <div className="rounded-xl border border-dashed border-[#d9d2c4] bg-white p-10 text-center"><Store className="mx-auto mb-3 text-[#8b6a25]" size={30} /><h3 className="font-semibold">Nenhum pedido por aqui</h3><p className="mt-1 text-sm text-[#777266]">Quando alguém fizer um pedido pelo site, ele aparecerá nesta tela.</p></div>}
      <div className="grid gap-4 lg:grid-cols-2">{visibleOrders.map((order) => {
        const address = order.address;
        const addressText = address ? [address.street, address.number, address.complement, address.bairro, address.cep].filter(Boolean).join(', ') : '';
        const mapUrl = addressText ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}` : '';
        const whatsappUrl = `https://wa.me/55${phoneDigits(order.customer_phone)}`;
        return <article key={order.id} className="overflow-hidden rounded-xl border border-[#e4dfd3] bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-[#eee9df] p-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#8b6a25]">Pedido #{order.code}</p><h3 className="mt-1 text-lg font-bold">{order.customer_name}</h3><p className="mt-1 text-xs text-[#777266]">{new Date(order.created_at).toLocaleString('pt-BR')} · {order.order_for === 'amanha' ? 'Reserva para amanhã' : 'Pedido de hoje'}</p></div><span className={`rounded-full px-3 py-1 text-center text-xs font-semibold ${order.order_status === 'novo' ? 'bg-amber-100 text-amber-900' : order.order_status === 'concluido' ? 'bg-emerald-100 text-emerald-900' : order.order_status === 'cancelado' ? 'bg-red-100 text-red-900' : 'bg-stone-100 text-stone-800'}`}>{statusLabel(order.order_status)}</span></div>
          <div className="space-y-4 p-4">
            <div className="space-y-2">{order.items?.map((item, index) => <div key={index} className="flex justify-between gap-3 text-sm"><div><p className="font-medium">{item.quantity}× {item.meal_name}</p><p className="text-xs text-[#777266]">{item.size_label}{item.notes ? ` · ${item.notes}` : ''}</p></div><span className="whitespace-nowrap">{money(Number(item.unit_price) * item.quantity)}</span></div>)}</div>
            <div className="rounded-lg bg-[#f7f4ed] p-3 text-sm"><div className="flex justify-between"><span className="text-[#777266]">Marmitas</span><span>{money(Number(order.subtotal))}</span></div><div className="mt-1 flex justify-between"><span className="text-[#777266]">Entrega</span><span>{money(Number(order.delivery_fee))}</span></div><div className="mt-2 flex justify-between border-t border-[#e2dccf] pt-2 text-base font-bold"><span>Total</span><span>{money(Number(order.total))}</span></div></div>
            <div className="space-y-2 text-sm"><p className="flex items-start gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-[#8b6a25]" />{order.customer_phone}</p><p className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-[#8b6a25]">{order.fulfillment === 'entrega' ? <Bike size={16} /> : <Store size={16} />}</span><span>{order.fulfillment === 'entrega' ? addressText || 'Endereço não informado' : 'Retirada na cozinha'}</span></p><p className="text-[#777266]">Pagamento: {paymentLabel(order.payment_method)} · {paymentStatusLabel(order.payment_status)}</p>{order.change_for && <p>Troco para: {money(Number(order.change_for))}</p>}</div>
            <div className="flex flex-wrap gap-2"><a href={`tel:+55${phoneDigits(order.customer_phone)}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9d2c4] px-3 text-sm"><Phone size={15} /> Ligar</a><a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9d2c4] px-3 text-sm">WhatsApp</a>{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9d2c4] px-3 text-sm"><MapPin size={15} /> Abrir mapa</a>}</div>
            <label className="block space-y-2 text-sm font-semibold">Atualizar situação<select value={order.order_status} onChange={(e) => void updateStatus(order, e.target.value)} className="min-h-11 w-full rounded-lg border border-[#d9d2c4] bg-white px-3 font-normal"><option value="" disabled>Escolha o status</option>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          </div>
        </article>;
      })}</div>
      <p className="flex items-center justify-center gap-2 py-3 text-center text-xs text-[#777266]"><Clock3 size={14} /> Atualização automática a cada 15 segundos <CheckCircle2 size={14} /></p>
    </section>
  </main>;
}
