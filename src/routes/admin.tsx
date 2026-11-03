import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Ban, Bell, Bike, CheckCircle2, ChefHat, Check, ChevronDown, ChevronRight, Clock3, CreditCard, Banknote,
  LayoutDashboard, LineChart, LogOut, MapPin, Menu, MessageCircle, MoreVertical, Phone, QrCode,
  ReceiptText, RefreshCw, ShieldCheck, ShoppingBag, Store, User, UtensilsCrossed, Wallet, X, BookOpen, CalendarDays, Hourglass,
} from 'lucide-react';

type OrderItem = { meal_name: string; size_label: string; quantity: number; unit_price: number; notes?: string | null };
type Order = {
  id: string; code: string; order_for: 'hoje' | 'amanha'; customer_name: string; customer_phone: string;
  fulfillment: 'entrega' | 'retirada'; address: { cep?: string; street?: string; number?: string; complement?: string; bairro?: string } | null;
  payment_method: string; payment_status: string; order_status: string; subtotal: number; delivery_fee: number;
  total: number; change_for: number | null; created_at: string; estimated_delivery_at?: string | null; items: OrderItem[];
};
const statuses = [
  { value: 'novo', label: 'Novo pedido' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'preparando', label: 'Em preparação' },
  { value: 'pronto_entrega', label: 'Pronto para entrega' },
  { value: 'saiu_entrega', label: 'Saiu com motoboy' },
  { value: 'pronto_retirada', label: 'Pronto para retirada' },
  { value: 'concluido', label: 'Concluído / entregue' },
  { value: 'cancelado', label: 'Cancelado' },
];
const money = (value: number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const phoneDigits = (value: string) => value.replace(/\D/g, '');
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const addressLine = (o: Order) => o.address
  ? [[o.address.street, o.address.number].filter(Boolean).join(', '), o.address.complement, o.address.bairro].filter(Boolean).join(' · ') || 'Endereço não informado'
  : 'Endereço não informado';
const whatsappUrl = (phone: string) => {
  const d = phoneDigits(phone);
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}`;
};
const isFinished = (o: Order) => ['concluido', 'cancelado'].includes(o.order_status);
const isUnpaidOnline = (o: Order) => o.payment_method === 'online' && o.payment_status !== 'approved';

type Tone = { bar: string; border: string; badge: string; label: string };
const toneFor = (o: Order): Tone => {
  if (isUnpaidOnline(o)) return { bar: 'bg-amber-400', border: 'border-amber-400/60 shadow-[0_0_24px_-8px_rgba(251,191,36,.6)]', badge: 'bg-amber-400/15 text-amber-300 border-amber-400/50', label: 'Aguardando pagamento' };
  switch (o.order_status) {
    case 'novo': return { bar: 'bg-rose-500', border: 'border-rose-500/70 shadow-[0_0_28px_-8px_rgba(244,63,94,.7)]', badge: 'bg-rose-600 text-white border-rose-500', label: 'Novo' };
    case 'confirmado': return { bar: 'bg-sky-400', border: 'border-sky-400/60 shadow-[0_0_24px_-8px_rgba(56,189,248,.6)]', badge: 'bg-sky-400/15 text-sky-300 border-sky-400/50', label: 'Confirmado' };
    case 'preparando': return { bar: 'bg-sky-400', border: 'border-sky-400/60 shadow-[0_0_24px_-8px_rgba(56,189,248,.6)]', badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/50', label: 'Em preparação' };
    case 'pronto_entrega': return { bar: 'bg-emerald-400', border: 'border-emerald-400/60 shadow-[0_0_24px_-8px_rgba(52,211,153,.6)]', badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/50', label: 'Pronto para entrega' };
    case 'pronto_retirada': return { bar: 'bg-emerald-400', border: 'border-emerald-400/60 shadow-[0_0_24px_-8px_rgba(52,211,153,.6)]', badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/50', label: 'Pronto p/ retirada' };
    case 'saiu_entrega': return { bar: 'bg-blue-500', border: 'border-blue-500/60 shadow-[0_0_24px_-8px_rgba(59,130,246,.6)]', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/50', label: 'Em rota' };
    case 'cancelado': return { bar: 'bg-red-700', border: 'border-red-800/60', badge: 'bg-red-900/40 text-red-300 border-red-700/50', label: 'Cancelado' };
    default: return { bar: 'bg-slate-500', border: 'border-slate-600/60', badge: 'bg-slate-700/60 text-slate-200 border-slate-500/50', label: 'Concluído' };
  }
};

const paymentInfo = (o: Order) => {
  const icon = o.payment_method === 'online' ? Wallet : o.payment_method === 'entrega-pix' ? QrCode : o.payment_method === 'entrega-cartao' ? CreditCard : Banknote;
  const label = o.payment_method === 'online' ? 'Mercado Pago (online)' : o.payment_method === 'entrega-pix' ? 'Pix na entrega' : o.payment_method === 'entrega-cartao' ? 'Cartão na maquininha' : o.payment_method === 'entrega-dinheiro' ? 'Dinheiro na entrega' : o.payment_method;
  const status = o.payment_method === 'online'
    ? ({ approved: 'Aprovado', pending: 'Pendente', rejected: 'Recusado', cancelled: 'Cancelado', refunded: 'Estornado' } as Record<string, string>)[o.payment_status] ?? o.payment_status
    : 'Pagar na entrega';
  const ok = o.payment_method === 'online' && o.payment_status === 'approved';
  return { icon, label, status, ok };
};

const SOUND_KEY = 'tiaval-admin-sound';

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Painel da Cozinha · Marmitex da Tia Val' }, { name: 'robots', content: 'noindex' },
      { name: 'theme-color', content: '#070818' }, { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, { name: 'apple-mobile-web-app-title', content: 'Tia Val Cozinha' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest-admin.webmanifest' }, { rel: 'apple-touch-icon', href: '/icons/cozinha-180.png' },
      { rel: 'icon', type: 'image/png', href: '/icons/cozinha-192.png' },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ativos');
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [busyUpdate, setBusyUpdate] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [section, setSection] = useState<'painel' | 'pedidos' | 'financeiro' | 'relatorios'>('painel');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const soundRef = useRef(false);
  soundRef.current = soundOn;

  useEffect(() => {
    setSoundOn(window.localStorage.getItem(SOUND_KEY) === '1');
    const timer = window.setInterval(() => setClockNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Sininho gerado pelo próprio navegador (não depende de arquivo de som).
  const playBell = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const ring = (start: number, freq: number) => {
        [1, 2.76, 5.4].forEach((mult, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq * mult;
          const vol = [0.5, 0.18, 0.08][i] ?? 0.1;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start); osc.stop(start + 1.5);
        });
      };
      const t = ctx.currentTime + 0.05;
      ring(t, 1318); ring(t + 0.35, 1046); ring(t + 0.9, 1318); ring(t + 1.25, 1046);
    } catch { /* navegador sem suporte a som */ }
  }, []);

  const notify = useCallback((order: Order) => {
    if (!soundRef.current) return;
    playBell();
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('Pedido da Tia Val!', {
        body: `Pedido #${order.code} · ${order.customer_name} · ${money(order.total)}`,
        icon: '/favicon.ico', tag: order.id, requireInteraction: true,
      });
      n.onclick = () => window.focus();
    }
  }, [playBell]);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (response.status === 401) { setLoggedIn(false); setOrders([]); knownIds.current = null; return; }
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os pedidos.');
      const list = data.orders ?? [];
      // Avisa só sobre pedidos que chegaram depois da primeira carga e que já podem ir para a cozinha.
      if (knownIds.current) {
        for (const o of list) {
          if (!knownIds.current.has(o.id) && !isFinished(o) && !isUnpaidOnline(o)) notify(o);
        }
      }
      knownIds.current = new Set(list.filter((o) => !isUnpaidOnline(o)).map((o) => o.id));
      setOrders(list);
      setLoggedIn(true);
      setLastUpdate(Date.now());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos.');
    } finally {
      if (!quiet) setLoading(false);
      setChecked(true);
    }
  }, [notify]);

  useEffect(() => { void loadOrders(true); }, [loadOrders]);
  useEffect(() => {
    if (!loggedIn) return;
    const timer = window.setInterval(() => { void loadOrders(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [loggedIn, loadOrders]);

  const toggleSound = async () => {
    const next = !soundOn;
    if (next) {
      if ('Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }
      playBell();
    }
    setSoundOn(next);
    window.localStorage.setItem(SOUND_KEY, next ? '1' : '0');
  };

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

  const patchOrder = async (order: Order, body: Record<string, unknown>, fallback: string) => {
    setError('');
    setBusyUpdate(order.id);
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, ...body }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || fallback);
      await loadOrders(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally { setBusyUpdate(null); }
  };
  const updateStatus = (order: Order, order_status: string) => patchOrder(order, { order_status }, 'Não foi possível atualizar o pedido.');
  const updateEta = (order: Order, value: string) => patchOrder(order, { estimated_delivery_at: value ? new Date(value).toISOString() : null }, 'Não foi possível salvar a previsão.');
  const cancelOrder = (order: Order) => {
    setMenuOpen(null);
    if (window.confirm(`Tem certeza que deseja cancelar o pedido #${order.code} de ${order.customer_name}?`)) void updateStatus(order, 'cancelado');
  };

  const toLocalDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const logout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }); }
    finally { setLoggedIn(false); setOrders([]); knownIds.current = null; }
  };

  // Pedidos online só vão para a cozinha depois do pagamento aprovado.
  const unpaidOnlineOrders = orders.filter(isUnpaidOnline);
  const eligibleOrders = orders.filter((o) => !isUnpaidOnline(o));
  const activeOrders = eligibleOrders.filter((o) => !isFinished(o));
  const visibleOrders = filter === 'pagamentos-pendentes'
    ? unpaidOnlineOrders
    : eligibleOrders.filter((o) => filter === 'todos' ? true : filter === 'ativos' ? !isFinished(o) : o.order_status === filter);
  const newCount = eligibleOrders.filter((o) => o.order_status === 'novo').length;
  const inProgressCount = activeOrders.filter((o) => o.order_status !== 'novo').length;
  const todayCount = orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
  const totalSales = eligibleOrders.filter((o) => o.order_status !== 'cancelado').reduce((s, o) => s + Number(o.total), 0);
  const pendingPayments = orders.filter((o) => o.payment_method === 'online' && o.payment_status === 'pending').reduce((s, o) => s + Number(o.total), 0);
  const approvedPayments = orders.filter((o) => o.payment_method === 'online' && o.payment_status === 'approved').reduce((s, o) => s + Number(o.total), 0);

  const orderAgeMinutes = (createdAt: string) => Math.max(0, Math.floor((clockNow - new Date(createdAt).getTime()) / 60000));

  const goTo = (s: typeof section) => {
    setSection(s); setNavOpen(false);
    if (s === 'painel') setFilter('ativos');
    if (s === 'pedidos') setFilter('todos');
    if (s === 'relatorios') setFilter('concluido');
    if (s === 'financeiro') document.getElementById('resumo')?.scrollIntoView({ behavior: 'smooth' });
    else document.getElementById('lista')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a1d3a,_#070818_70%)] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-rose-500/30 bg-[#0b0d22]/80 p-8 shadow-[0_0_60px_-20px_rgba(244,63,94,.6)]">
          <div className="text-center space-y-2">
<img src="/icons/cozinha-logo.webp" alt="Tia Val Cozinha" className="mx-auto h-20 w-20 rounded-2xl" />
            <p className="text-xs font-bold uppercase tracking-[.25em] text-rose-400">Marmitex da Tia Val</p>
            <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
            <p className="text-sm text-slate-400">Área privada da família</p>
          </div>
          {!checked ? (
            <p className="text-center text-sm text-slate-400">Carregando…</p>
          ) : (
            <form onSubmit={login} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium mb-1 block">Senha de acesso</span>
                <input type="password" autoComplete="current-password" required maxLength={256} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha"
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500" />
              </label>
              {error && <p role="alert" className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500 text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 font-semibold disabled:opacity-50 transition hover:brightness-110">
                {loading ? 'Entrando…' : 'Entrar no painel'}
              </button>
            </form>
          )}
          <div className="border-t border-slate-700/50 pt-6">
            <p className="mb-2 text-center text-sm text-slate-400">Ou entre como entregador</p>
            <a href="/motoboy" className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-400 font-medium hover:bg-rose-500/20">
              <Bike className="h-5 w-5" /> Área do motoboy
            </a>
          </div>
        </div>
      </main>
    );
  }

  const navItems = [
    { id: 'painel' as const, label: 'Painel', icon: LayoutDashboard },
    { id: 'pedidos' as const, label: 'Pedidos', icon: ReceiptText },
    { id: 'financeiro' as const, label: 'Financeiro', icon: Wallet },
    { id: 'relatorios' as const, label: 'Relatórios', icon: LineChart },
  ];

  const stats = [
    { label: 'Pedidos novos', value: String(newCount), sub: 'Aguardando confirmação', icon: ShoppingBag, cls: 'border-rose-500/60 text-rose-400 shadow-[0_0_24px_-10px_rgba(244,63,94,.8)]', ic: 'bg-rose-500', onClick: () => { setFilter('novo'); goToList(); } },
    { label: 'Em andamento', value: String(inProgressCount), sub: 'Na cozinha ou em rota', icon: ChefHat, cls: 'border-sky-500/60 text-sky-400 shadow-[0_0_24px_-10px_rgba(56,189,248,.8)]', ic: 'bg-sky-500', onClick: () => { setFilter('ativos'); goToList(); } },
    { label: 'Hoje', value: String(todayCount), sub: 'Total de pedidos', icon: CalendarDays, cls: 'border-amber-500/60 text-amber-400 shadow-[0_0_24px_-10px_rgba(245,158,11,.8)]', ic: 'bg-amber-500', onClick: () => { setFilter('todos'); goToList(); } },
    { label: 'Vendas totais', value: money(totalSales), sub: 'Faturamento', icon: LineChart, cls: 'border-emerald-500/60 text-emerald-400 shadow-[0_0_24px_-10px_rgba(16,185,129,.8)]', ic: 'bg-emerald-500' },
    { label: 'Pendentes', value: money(pendingPayments), sub: 'Aguardando aprovação', icon: Clock3, cls: 'border-violet-500/60 text-violet-400 shadow-[0_0_24px_-10px_rgba(139,92,246,.8)]', ic: 'bg-violet-500', onClick: () => { setFilter('pagamentos-pendentes'); goToList(); } },
    { label: 'Aprovados', value: money(approvedPayments), sub: 'Pagamento aprovado', icon: CheckCircle2, cls: 'border-teal-500/60 text-teal-400 shadow-[0_0_24px_-10px_rgba(20,184,166,.8)]', ic: 'bg-teal-500' },
  ];
  function goToList() { document.getElementById('lista')?.scrollIntoView({ behavior: 'smooth' }); }

  const tabs = [
    { id: 'ativos', label: 'Pedidos Ativos', short: 'Ativos', count: activeOrders.length, icon: ShoppingBag },
    { id: 'todos', label: 'Todos os Pedidos', short: 'Todos', count: eligibleOrders.length, icon: RefreshCw },
    { id: 'pagamentos-pendentes', label: 'Pagamentos Pendentes', short: 'Pendentes', count: unpaidOnlineOrders.length, icon: Wallet },
  ];

  const primaryAction = (o: Order): { label: string; icon: typeof Check; next?: string; disabled?: boolean } | null => {
    if (isUnpaidOnline(o)) return { label: 'Aguardando aprovação', icon: Hourglass, disabled: true };
    switch (o.order_status) {
      case 'novo': return { label: 'Confirmar pedido', icon: Check, next: 'confirmado' };
      case 'confirmado': return { label: 'Iniciar preparo', icon: ChefHat, next: 'preparando' };
      case 'preparando': return { label: 'Marcar como pronto', icon: Check, next: o.fulfillment === 'entrega' ? 'pronto_entrega' : 'pronto_retirada' };
      // Entregas: a partir daqui quem avança é o motoboy no app dele
      // (Iniciar entrega -> Cheguei -> código de confirmação do cliente).
      case 'pronto_entrega': return { label: 'Aguardando motoboy', icon: Bike, disabled: true };
      case 'saiu_entrega': return { label: 'Com o motoboy', icon: Bike, disabled: true };
      case 'pronto_retirada': return { label: 'Cliente retirou', icon: CheckCircle2, next: 'concluido' };
      default: return null;
    }
  };

  const updatedAgo = lastUpdate ? Math.max(0, Math.round((clockNow - lastUpdate) / 1000)) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#14183a,_#070818_65%)] text-slate-100 lg:flex">
      {/* Sidebar (PC) / gaveta (celular) */}
      {navOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 border-r border-slate-800 bg-[#080a1c] p-4 flex flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between lg:justify-center py-2">
<img src="/icons/cozinha-logo.webp" alt="Tia Val Cozinha" className="h-20 w-20 rounded-2xl" />
          <button className="lg:hidden p-2" aria-label="Fechar" onClick={() => setNavOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => goTo(item.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${section === item.id ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-[0_0_20px_-6px_rgba(244,63,94,.9)]' : 'text-slate-300 hover:bg-slate-800/60'}`}>
              <item.icon className="h-5 w-5" /> {item.label}
            </button>
          ))}
          <a href="/" target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/60">
            <BookOpen className="h-5 w-5" /> Cardápio
          </a>
        </nav>
        <p className="mt-auto pb-4 text-center font-[cursive] text-xl leading-tight text-amber-300 -rotate-6">Aqui tem sabor<br />e carinho! <span className="text-rose-500">♥</span></p>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#080a1c]/90 backdrop-blur px-4 py-3 lg:px-6 lg:py-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:justify-between">
            <button className="lg:hidden p-1" aria-label="Abrir menu" onClick={() => setNavOpen(true)}><Menu className="h-6 w-6" /></button>
            <div className="min-w-0 flex items-center gap-3">
              <img src="/icons/cozinha-logo.webp" alt="" className="h-10 w-10 shrink-0 rounded-xl lg:hidden" />
              <div className="min-w-0">
              <p className="text-xs lg:text-sm font-semibold text-slate-300 truncate">Marmitex da Tia Val</p>
              <h1 className="text-lg lg:text-2xl font-bold truncate">Painel da Cozinha</h1>
              <p className="hidden lg:block text-sm text-slate-400">Comida caseira de verdade! <span className="text-rose-500">♥</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="font-medium text-emerald-300">Sistema online</span>
                <span className="text-xs text-slate-400">Atualiza a cada 15s{updatedAgo !== null ? ` · há ${updatedAgo}s` : ''}</span>
              </div>
              <button onClick={() => void loadOrders()} aria-label="Atualizar agora" className="hidden sm:inline-flex items-center rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 hover:bg-slate-800">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => void toggleSound()} role="switch" aria-checked={soundOn}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${soundOn ? 'border-rose-500/60 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-900/60 text-slate-300'}`}>
                <Bell className="h-4 w-4" /> <span className="hidden sm:inline">Avisos sonoros</span>
                <span className={`relative h-5 w-9 rounded-full transition ${soundOn ? 'bg-rose-500' : 'bg-slate-600'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${soundOn ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
              <button onClick={logout} aria-label="Sair" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm hover:bg-slate-800">
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-4 lg:px-6 lg:py-6 space-y-5">
          {/* Resumo */}
          <section id="resumo" className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-6">
            {stats.map((s) => {
              const Tag = s.onClick ? 'button' : 'div';
              return (
                <Tag key={s.label} onClick={s.onClick}
                  className={`relative min-w-0 rounded-2xl border bg-[#0b0e24]/80 p-2.5 sm:p-4 text-left transition ${s.onClick ? 'hover:brightness-125' : ''} ${s.cls}`}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className={`grid h-7 w-7 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-full text-white ${s.ic}`}><s.icon className="h-4 w-4 sm:h-5 sm:w-5" /></span>
                    <span className="text-[11px] sm:text-sm font-medium leading-tight">{s.label}</span>
                  </div>
                  <p className="mt-1 sm:mt-2 text-lg sm:text-2xl xl:text-[1.6rem] font-extrabold truncate">{s.value}</p>
                  <p className="hidden sm:block text-xs text-slate-300 truncate">{s.sub}</p>
                  {s.onClick && <ChevronRight className="hidden sm:block absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
                </Tag>
              );
            })}
          </section>

          {/* Abas e filtro */}
          <section id="lista" className="scroll-mt-24 rounded-2xl border border-slate-800 bg-[#0b0e24]/70 p-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 gap-1 lg:flex">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setFilter(t.id)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 lg:px-4 text-xs sm:text-sm font-medium transition ${filter === t.id ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_0_20px_-6px_rgba(244,63,94,.9)]' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                  <t.icon className="hidden sm:block h-4 w-4" />
                  <span className="lg:hidden">{t.short}</span><span className="hidden lg:inline">{t.label}</span>
                  <span className={`rounded-full px-2 text-xs ${filter === t.id ? 'bg-white/25' : 'bg-slate-700'}`}>{t.count}</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm">
              <span className="hidden sm:inline text-slate-300 shrink-0">Filtrar por status</span>
              <span className="relative flex-1">
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                  className="w-full appearance-none bg-transparent py-1 pr-6 text-slate-100 focus:outline-none lg:min-w-[180px]">
                  <option className="bg-slate-900" value="ativos">Pedidos ativos</option>
                  <option className="bg-slate-900" value="todos">Todos os status</option>
                  <option className="bg-slate-900" value="pagamentos-pendentes">Pagamentos pendentes</option>
                  {statuses.map((s) => <option className="bg-slate-900" key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2" />
              </span>
            </label>
          </section>

          {error && <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
          {loading && orders.length === 0 && <p className="py-12 text-center text-sm text-slate-400">Carregando pedidos…</p>}

          {!loading && visibleOrders.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0b0e24]/70 p-10 text-center">
              <Store className="mx-auto mb-4 h-12 w-12 text-slate-500" />
              <h3 className="mb-2 font-semibold">{filter === 'pagamentos-pendentes' ? 'Nenhum pagamento pendente' : 'Nenhum pedido por aqui'}</h3>
              <p className="text-sm text-slate-400">{filter === 'pagamentos-pendentes' ? 'Pedidos online só são liberados para a cozinha após a confirmação do Mercado Pago.' : 'Quando houver pedidos liberados, eles aparecerão nesta tela.'}</p>
            </div>
          )}

          {visibleOrders.length > 0 && (
            <div className="grid gap-3 lg:gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleOrders.map((order) => {
                const tone = toneFor(order);
                const pay = paymentInfo(order);
                const action = primaryAction(order);
                const open = expanded === order.id;
                const busy = busyUpdate === order.id;
                const age = orderAgeMinutes(order.created_at);
                const late = !isFinished(order) && age >= 15;
                return (
                  <article key={order.id} className={`relative flex flex-col rounded-2xl border-2 bg-[#0b0e24]/90 p-4 ${tone.border}`}>
                    {/* Topo */}
                    <div className="flex items-center gap-3">
                      <span className={`h-7 w-1.5 shrink-0 rounded-full ${tone.bar}`} />
                      <h3 className="text-xl lg:text-2xl font-extrabold">#{order.code}</h3>
                      <span className={`inline-flex items-center gap-1 text-sm ${late ? 'text-red-400 font-bold' : 'text-slate-300'}`} title={`Há ${age} min`}>
                        <Clock3 className="h-4 w-4" /> {timeLabel(order.created_at)}
                      </span>
                      {order.order_for === 'amanha' && <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-300">Amanhã</span>}
                      <span className={`ml-auto shrink-0 rounded-md border px-2 py-1 text-[10px] sm:text-xs font-bold uppercase ${tone.badge}`}>{tone.label}</span>
                    </div>

                    {/* Cliente */}
                    <div className="mt-3 flex items-center gap-3 border-b border-slate-800 pb-3">
                      <User className="h-5 w-5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{order.customer_name}</span>
                      <a href={whatsappUrl(order.customer_phone)} target="_blank" rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/60 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    </div>

                    {/* Entrega + pagamento */}
                    <div className="mt-3 space-y-2 text-sm">
                      {order.fulfillment === 'entrega' ? (
                        <div className="flex items-start gap-3">
                          <Bike className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">Entrega Motoboy</p>
                            <p className="flex items-start gap-1 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" /> {addressLine(order)}</p>
                          </div>
                          <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">Taxa: {money(Number(order.delivery_fee))}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3"><Store className="h-5 w-5 text-slate-300" /> <span className="font-medium">Retirada no balcão</span></div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1">
                          <pay.icon className="h-4 w-4 text-teal-300" /> {pay.label}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${pay.ok ? 'bg-emerald-500/15 text-emerald-300' : order.payment_method === 'online' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700/60 text-slate-300'}`}>{pay.status}</span>
                        {order.change_for ? <span className="text-xs text-slate-300">Troco p/ {money(Number(order.change_for))}</span> : null}
                      </div>
                    </div>

                    {/* Itens */}
                    <div className="mt-3 flex gap-3 text-sm">
                      <UtensilsCrossed className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium">Itens do pedido</p>
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex gap-2 text-slate-300">
                            <span className="shrink-0 font-semibold">{item.quantity}x</span>
                            <span className="min-w-0">{item.meal_name}{item.size_label ? <span className="text-slate-400"> · {item.size_label}</span> : null}</span>
                            <span className="ml-auto shrink-0 text-xs text-slate-400">{money(Number(item.unit_price) * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {order.items?.filter((i) => i.notes).map((item, i) => (
                      <p key={i} className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/70 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-200">
                        <MessageCircle className="h-4 w-4 shrink-0" /> <span><b>Observação:</b> {item.notes}</span>
                      </p>
                    ))}

                    {/* Detalhes extras */}
                    {open && (
                      <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-sm">
                        <div className="grid grid-cols-2 gap-2 text-slate-300">
                          <p>Marmitas: <b>{money(Number(order.subtotal))}</b></p>
                          <p>Entrega: <b>{money(Number(order.delivery_fee))}</b></p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a href={`tel:+55${phoneDigits(order.customer_phone)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 hover:bg-slate-800"><Phone className="h-4 w-4" /> {order.customer_phone}</a>
                          {order.fulfillment === 'entrega' && order.address && (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([order.address.street, order.address.number, order.address.complement, order.address.bairro, order.address.cep].filter(Boolean).join(', '))}`}
                              target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 hover:bg-slate-800"><MapPin className="h-4 w-4" /> Abrir mapa</a>
                          )}
                        </div>
                        {order.fulfillment === 'entrega' && order.order_for === 'amanha' && !isFinished(order) && (
                          <label className="block space-y-1">
                            <span className="text-xs font-bold text-slate-300">Agendamento da entrega</span>
                            <input type="datetime-local" value={toLocalDateTime(order.estimated_delivery_at)} onChange={(e) => void updateEta(order, e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100" />
                          </label>
                        )}
                        <label className="flex items-center gap-2">
                          <span className="shrink-0 text-xs font-bold text-slate-300">Situação</span>
                          <select value={order.order_status} disabled={busy} onChange={(e) => void updateStatus(order, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 disabled:opacity-50">
                            {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </label>
                      </div>
                    )}

                    {/* Total + ações */}
                    <div className="mt-auto pt-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total do pedido</p>
                        <p className="text-xl font-extrabold">{money(Number(order.total))}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {action && (
                          <button type="button" disabled={busy || action.disabled} onClick={() => action.next && void updateStatus(order, action.next)}
                            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${action.disabled ? 'border border-slate-700 bg-slate-900/60 text-slate-300' : 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_0_20px_-6px_rgba(244,63,94,.9)] hover:brightness-110 disabled:opacity-60'}`}>
                            <action.icon className="h-4 w-4" /> {busy ? 'Salvando…' : action.label}
                          </button>
                        )}
                        <button type="button" onClick={() => setExpanded(open ? null : order.id)}
                          className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm font-medium hover:bg-slate-800">
                          {open ? 'Ocultar detalhes' : 'Ver detalhes'}
                        </button>
                        <div className="relative">
                          <button type="button" aria-label="Mais opções" onClick={() => setMenuOpen(menuOpen === order.id ? null : order.id)}
                            className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 hover:bg-slate-800"><MoreVertical className="h-4 w-4" /></button>
                          {menuOpen === order.id && (
                            <div className="absolute bottom-full right-0 z-20 mb-2 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                              <a href={`tel:+55${phoneDigits(order.customer_phone)}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-800"><Phone className="h-4 w-4" /> Ligar para cliente</a>
                              {!isFinished(order) && (
                                <button type="button" disabled={busy} onClick={() => cancelOrder(order)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"><Ban className="h-4 w-4" /> Cancelar pedido</button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        <footer className="hidden lg:flex items-center justify-between border-t border-slate-800 px-6 py-3 text-xs text-slate-400">
          <span>Marmitex da Tia Val · Painel da Cozinha</span>
          <span><span className="text-rose-500">♥</span> Comida caseira feita com amor!</span>
        </footer>

        {/* Barra inferior (celular) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-800 bg-[#080a1c]/95 backdrop-blur lg:hidden">
          <button onClick={() => goTo('painel')} className={`relative flex flex-col items-center gap-1 py-2.5 text-xs ${section === 'painel' ? 'text-rose-400' : 'text-slate-300'}`}>
            <ReceiptText className="h-5 w-5" /> Pedidos
            {newCount > 0 && <span className="absolute top-1 left-1/2 ml-2 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{newCount}</span>}
          </button>
          <button onClick={() => { setFilter('pagamentos-pendentes'); setSection('pedidos'); goToList(); }} className={`flex flex-col items-center gap-1 py-2.5 text-xs ${filter === 'pagamentos-pendentes' ? 'text-rose-400' : 'text-slate-300'}`}>
            <Wallet className="h-5 w-5" /> Pendentes
          </button>
          <button onClick={() => goTo('financeiro')} className={`flex flex-col items-center gap-1 py-2.5 text-xs ${section === 'financeiro' ? 'text-rose-400' : 'text-slate-300'}`}>
            <LineChart className="h-5 w-5" /> Ganhos
          </button>
        </nav>
      </div>
    </div>
  );
}
