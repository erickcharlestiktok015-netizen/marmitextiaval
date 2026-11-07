import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertCircle,
  Ban, Bell, Bike, CheckCircle2, ChefHat, Check, ChevronDown, ChevronRight, Clock3, CreditCard, Banknote,
  LayoutDashboard, LineChart, LogOut, MapPin, Menu, MessageCircle, MoreVertical, Phone, QrCode,
  ReceiptText, RefreshCw, ShieldCheck, ShoppingBag, Store, User, UtensilsCrossed, Wallet, X, BookOpen, CalendarDays, Hourglass,
  CalendarCheck, Sparkles, TrendingUp, ArrowRight,
} from 'lucide-react';
import {
  parsePlanNotes,
  planDeliveredCount,
  planDateLabel,
  nextPendingPlanDate,
  dishForDateKey,
  encodePlanNotes,
  PLAN_DAYS,
  type PlanMeta,
} from '@/lib/weekly-plan';

type OrderItem = { meal_name: string; size_label: string; quantity: number; unit_price: number; notes?: string | null };
type Order = {
  id: string; code: string; order_for: 'hoje' | 'amanha'; customer_name: string; customer_phone: string;
  fulfillment: 'entrega' | 'retirada'; address: { cep?: string; street?: string; number?: string; complement?: string; bairro?: string } | null;
  payment_method: string; payment_status: string; order_status: string; subtotal: number; delivery_fee: number;
  total: number; change_for: number | null; created_at: string; estimated_delivery_at?: string | null; items: OrderItem[];
  notes?: string | null;
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

const SP_TZ = 'America/Sao_Paulo';
const spDateKey = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: SP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const money = (value: number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const phoneDigits = (value: string) => value.replace(/\D/g, '');
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP_TZ });
const addressLine = (o: Order) => o.address
  ? [[o.address.street, o.address.number].filter(Boolean).join(', '), o.address.complement, o.address.bairro].filter(Boolean).join(' · ') || 'Endereço não informado'
  : 'Endereço não informado';

const whatsappUrl = (phone: string, text = 'Olá! É da cozinha da Tia Val sobre o seu pedido.') => {
  const d = phoneDigits(phone);
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}?text=${encodeURIComponent(text)}`;
};

const isFinished = (o: Order) => ['concluido', 'cancelado'].includes(o.order_status);
const isUnpaidOnline = (o: Order) => o.payment_method === 'online' && o.payment_status !== 'approved';

type Tone = { bar: string; border: string; badge: string; label: string };
const toneFor = (o: Order): Tone => {
  if (isUnpaidOnline(o)) return { bar: 'bg-amber-400', border: 'border-amber-400/60 shadow-[0_0_24px_-8px_rgba(251,191,36,.6)]', badge: 'bg-amber-400/15 text-amber-300 border-amber-400/50', label: 'Aguardando pagamento' };
  switch (o.order_status) {
    case 'novo': return { bar: 'bg-rose-500', border: 'border-rose-500/80 shadow-[0_0_28px_-6px_rgba(244,63,94,.8)]', badge: 'bg-rose-600 text-white border-rose-500 animate-pulse', label: 'Novo pedido' };
    case 'confirmado': return { bar: 'bg-sky-400', border: 'border-sky-400/60 shadow-[0_0_24px_-8px_rgba(56,189,248,.6)]', badge: 'bg-sky-400/15 text-sky-300 border-sky-400/50', label: 'Confirmado' };
    case 'preparando': return { bar: 'bg-amber-500', border: 'border-amber-500/60 shadow-[0_0_24px_-8px_rgba(245,158,11,.6)]', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/50', label: 'Na cozinha' };
    case 'pronto_entrega': return { bar: 'bg-emerald-400', border: 'border-emerald-400/60 shadow-[0_0_24px_-8px_rgba(52,211,153,.6)]', badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/50', label: 'Aguardando motoboy' };
    case 'pronto_retirada': return { bar: 'bg-emerald-400', border: 'border-emerald-400/60 shadow-[0_0_24px_-8px_rgba(52,211,153,.6)]', badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/50', label: 'Pronto p/ retirada' };
    case 'saiu_entrega': return { bar: 'bg-blue-500', border: 'border-blue-500/60 shadow-[0_0_24px_-8px_rgba(59,130,246,.6)]', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/50', label: 'Com motoboy' };
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
      { title: 'Gestor de Pedidos · Marmitex da Tia Val' }, { name: 'robots', content: 'noindex' },
      { name: 'theme-color', content: '#070818' }, { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, { name: 'apple-mobile-web-app-title', content: 'Tia Val Gestor' },
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
  const [filter, setFilter] = useState<'novos' | 'cozinha' | 'prontos' | 'plano' | 'concluidos' | 'todos' | 'pendentes'>('novos');
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
      const n = new Notification('Novo pedido na Tia Val!', {
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

  const completePlanDeliveryToday = async (order: Order, dateToComplete: string) => {
    const plan = parsePlanNotes(order.notes);
    if (!plan) return;
    const currentCompleted = Array.isArray(plan.completedDates) ? [...plan.completedDates] : [];
    if (!currentCompleted.includes(dateToComplete)) {
      currentCompleted.push(dateToComplete);
    }
    const updatedPlan: PlanMeta = { ...plan, completedDates: currentCompleted };
    const updatedNotes = encodePlanNotes(updatedPlan);
    const patchBody: Record<string, unknown> = { notes: updatedNotes };
    if (currentCompleted.length >= PLAN_DAYS) {
      patchBody['order_status'] = 'concluido';
    }
    await patchOrder(order, patchBody, 'Não foi possível registrar a entrega da marmita.');
  };

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

  // Cálculos diários e dados precisos
  const todayStr = spDateKey(new Date());
  const yesterdayStr = spDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const unpaidOnlineOrders = orders.filter(isUnpaidOnline);
  const eligibleOrders = orders.filter((o) => !isUnpaidOnline(o));

  // Pedidos de Hoje e Ontem
  const todayOrders = orders.filter((o) => spDateKey(new Date(o.created_at)) === todayStr && !isUnpaidOnline(o));
  const todayCount = todayOrders.length;
  const todaySales = todayOrders.filter((o) => o.order_status !== 'cancelado').reduce((s, o) => s + Number(o.total), 0);

  const yesterdayOrders = orders.filter((o) => spDateKey(new Date(o.created_at)) === yesterdayStr && !isUnpaidOnline(o));
  const yesterdayCount = yesterdayOrders.length;
  const yesterdaySales = yesterdayOrders.filter((o) => o.order_status !== 'cancelado').reduce((s, o) => s + Number(o.total), 0);

  // Clientes e marmitas do Plano 7 Dias
  const planOrders = eligibleOrders.filter((o) => Boolean(parsePlanNotes(o.notes)));
  const activePlanOrders = planOrders.filter((o) => {
    if (o.order_status === 'cancelado') return false;
    const p = parsePlanNotes(o.notes);
    return p && (p.completedDates?.length ?? 0) < PLAN_DAYS;
  });
  const todayPlanOrders = activePlanOrders.filter((o) => {
    const p = parsePlanNotes(o.notes);
    return p && p.dates.includes(todayStr);
  });
  const todayPlanPendingOrders = todayPlanOrders.filter((o) => {
    const p = parsePlanNotes(o.notes);
    return p && (!p.completedDates || !p.completedDates.includes(todayStr));
  });

  // Categorias de pedidos estilo iFood / 99Food
  const newOrders = eligibleOrders.filter((o) => o.order_status === 'novo');
  const inKitchenOrders = eligibleOrders.filter((o) => ['confirmado', 'preparando'].includes(o.order_status));
  const readyOrRouteOrders = eligibleOrders.filter((o) => ['pronto_entrega', 'saiu_entrega', 'pronto_retirada'].includes(o.order_status));
  const finishedOrders = eligibleOrders.filter((o) => isFinished(o));

  const totalSales = eligibleOrders.filter((o) => o.order_status !== 'cancelado').reduce((s, o) => s + Number(o.total), 0);
  const pendingPayments = orders.filter((o) => o.payment_method === 'online' && o.payment_status === 'pending').reduce((s, o) => s + Number(o.total), 0);

  const orderAgeMinutes = (createdAt: string) => Math.max(0, Math.floor((clockNow - new Date(createdAt).getTime()) / 60000));

  let visibleOrders: Order[] = [];
  if (filter === 'novos') visibleOrders = newOrders;
  else if (filter === 'cozinha') visibleOrders = inKitchenOrders;
  else if (filter === 'prontos') visibleOrders = readyOrRouteOrders;
  else if (filter === 'plano') visibleOrders = planOrders;
  else if (filter === 'concluidos') visibleOrders = finishedOrders;
  else if (filter === 'pendentes') visibleOrders = unpaidOnlineOrders;
  else visibleOrders = eligibleOrders;

  const primaryAction = (o: Order): { label: string; icon: typeof Check; next?: string; disabled?: boolean } | null => {
    if (isUnpaidOnline(o)) return { label: 'Aguardando aprovação', icon: Hourglass, disabled: true };
    switch (o.order_status) {
      case 'novo': return { label: 'Aceitar e Preparar', icon: ChefHat, next: 'preparando' };
      case 'confirmado': return { label: 'Iniciar preparo', icon: ChefHat, next: 'preparando' };
      case 'preparando': return { label: 'Marcar como pronto', icon: Check, next: o.fulfillment === 'entrega' ? 'pronto_entrega' : 'pronto_retirada' };
      case 'pronto_entrega': return { label: 'Aguardando motoboy', icon: Bike, disabled: true };
      case 'saiu_entrega': return { label: 'Com o motoboy', icon: Bike, disabled: true };
      case 'pronto_retirada': return { label: 'Cliente retirou', icon: CheckCircle2, next: 'concluido' };
      default: return null;
    }
  };

  const updatedAgo = lastUpdate ? Math.max(0, Math.round((clockNow - lastUpdate) / 1000)) : null;

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a1d3a,_#070818_70%)] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-rose-500/30 bg-[#0b0d22]/80 p-8 shadow-[0_0_60px_-20px_rgba(244,63,94,.6)]">
          <div className="text-center space-y-2">
            <img src="/icons/cozinha-logo.webp" alt="Tia Val Cozinha" className="mx-auto h-20 w-20 rounded-2xl" />
            <p className="text-xs font-bold uppercase tracking-[.25em] text-rose-400">Marmitex da Tia Val</p>
            <h1 className="text-3xl font-bold">Gestor de Pedidos</h1>
            <p className="text-sm text-slate-400">Acesso da Cozinha & Entregas</p>
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
                {loading ? 'Entrando…' : 'Entrar no gestor'}
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

  const tabs = [
    { id: 'novos' as const, label: 'Novos', short: 'Novos', count: newOrders.length, icon: ShoppingBag, pulse: newOrders.length > 0, color: 'text-rose-400' },
    { id: 'cozinha' as const, label: 'Na Cozinha', short: 'Cozinha', count: inKitchenOrders.length, icon: ChefHat, color: 'text-amber-400' },
    { id: 'prontos' as const, label: 'Prontos / Em Rota', short: 'Prontos', count: readyOrRouteOrders.length, icon: Bike, color: 'text-emerald-400' },
    { id: 'plano' as const, label: 'Plano 7 Dias', short: 'Plano 7 Dias', count: activePlanOrders.length, icon: CalendarDays, color: 'text-fuchsia-400', special: todayPlanOrders.length > 0 ? `${todayPlanOrders.length} hoje` : undefined },
    { id: 'concluidos' as const, label: 'Concluídos', short: 'Concluídos', count: finishedOrders.length, icon: CheckCircle2, color: 'text-slate-400' },
    { id: 'todos' as const, label: 'Todos', short: 'Todos', count: eligibleOrders.length, icon: RefreshCw, color: 'text-sky-400' },
    { id: 'pendentes' as const, label: 'Pagamentos Pendentes', short: 'Pendentes', count: unpaidOnlineOrders.length, icon: Wallet, color: 'text-violet-400' },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#14183a,_#070818_65%)] text-slate-100 lg:flex pb-20 lg:pb-0">
      {navOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* Sidebar Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 bg-[#080a1c] border-r border-slate-800 p-6 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3">
          <img src="/icons/cozinha-logo.webp" alt="Tia Val Cozinha" className="h-12 w-12 rounded-xl border border-rose-500/30" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold truncate">Tia Val Cozinha</h1>
            <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Gestor de Pedidos</p>
          </div>
          <button aria-label="Fechar menu" onClick={() => setNavOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo do dia na sidebar */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Hoje vs Ontem</span>
            <span className="text-emerald-400">Em tempo real</span>
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/80">
              <p className="text-xs text-slate-400">Hoje</p>
              <p className="text-lg font-extrabold text-white">{todayCount}</p>
              <p className="text-[11px] text-emerald-400 font-semibold">{money(todaySales)}</p>
            </div>
            <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/80">
              <p className="text-xs text-slate-400">Ontem</p>
              <p className="text-lg font-extrabold text-slate-300">{yesterdayCount}</p>
              <p className="text-[11px] text-slate-400 font-semibold">{money(yesterdaySales)}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Assinantes do Plano:</span>
            <strong className="text-fuchsia-300">{activePlanOrders.length} ativos ({todayPlanOrders.length} hoje)</strong>
          </div>
        </div>

        <nav className="mt-6 space-y-1 flex-1">
          {tabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setFilter(tab.id); setNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition ${
                  active ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_16px_-4px_rgba(244,63,94,.5)]' : 'text-slate-300 hover:bg-slate-900/60 hover:text-white'
                }`}
              >
                <tab.icon className={`h-4 w-4 shrink-0 ${tab.color}`} />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    tab.pulse ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.special && (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-fuchsia-500/30 text-fuchsia-200">
                    {tab.special}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800 space-y-2">
          <a href="/motoboy" className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-500/20">
            <Bike className="h-4 w-4" /> App do Motoboy
          </a>
          <button onClick={() => void logout()} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-400 text-xs hover:bg-slate-900 hover:text-white">
            <LogOut className="h-4 w-4" /> Sair do painel
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Topo do Gestor */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <button aria-label="Abrir menu" onClick={() => setNavOpen(true)} className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Gestor de Pedidos</h2>
              </div>
              <p className="text-xs text-slate-400">
                Atualizado há {updatedAgo !== null ? `${updatedAgo}s` : 'instantes'} · Cozinha aberta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void toggleSound()}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                soundOn ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_16px_-4px_rgba(52,211,153,.5)]' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>{soundOn ? 'Som ativo (avisa novo pedido)' : 'Ativar som'}</span>
            </button>
            <button
              onClick={() => void loadOrders(false)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        {/* Métricas Diárias & Comparativos */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3" aria-label="Estatísticas do dia">
          <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-500/10 to-transparent p-4 shadow-[0_0_20px_-8px_rgba(244,63,94,.5)]">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
              <span>Hoje</span>
              <CalendarDays className="h-4 w-4" />
            </p>
            <p className="mt-2 text-2xl font-black text-white">{todayCount} <span className="text-xs font-normal text-slate-400">pedidos</span></p>
            <p className="mt-1 text-xs font-semibold text-emerald-400">{money(todaySales)}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Ontem</span>
              <Clock3 className="h-4 w-4" />
            </p>
            <p className="mt-2 text-2xl font-black text-slate-200">{yesterdayCount} <span className="text-xs font-normal text-slate-400">pedidos</span></p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{money(yesterdaySales)}</p>
          </div>

          <div className="rounded-2xl border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-4 shadow-[0_0_20px_-8px_rgba(217,70,239,.4)] cursor-pointer hover:border-fuchsia-400" onClick={() => setFilter('plano')}>
            <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-400 flex items-center justify-between">
              <span>Plano 7 Dias</span>
              <CalendarCheck className="h-4 w-4" />
            </p>
            <p className="mt-2 text-2xl font-black text-white">{activePlanOrders.length} <span className="text-xs font-normal text-slate-400">ativos</span></p>
            <p className="mt-1 text-xs font-semibold text-fuchsia-300">{todayPlanOrders.length} saem hoje ({todayPlanPendingOrders.length} pendentes)</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              <span>Faturamento Total</span>
              <TrendingUp className="h-4 w-4" />
            </p>
            <p className="mt-2 text-2xl font-black text-white">{money(totalSales)}</p>
            <p className="mt-1 text-xs text-slate-400">{eligibleOrders.length} pedidos no total</p>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center justify-between">
              <span>Em Andamento</span>
              <ChefHat className="h-4 w-4" />
            </p>
            <p className="mt-2 text-2xl font-black text-white">{newOrders.length + inKitchenOrders.length + readyOrRouteOrders.length}</p>
            <p className="mt-1 text-xs text-slate-400">{newOrders.length} novos · {inKitchenOrders.length} no fogo</p>
          </div>
        </section>

        {/* Abas horizontais estilo iFood (mobile e desktop) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800/80">
          {tabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
                  active
                    ? 'bg-rose-600 text-white shadow-[0_0_20px_-6px_rgba(244,63,94,.8)]'
                    : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                    active ? 'bg-white text-rose-600' : tab.pulse ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Seção Especial da Aba: Plano 7 Dias */}
        {filter === 'plano' && (
          <section className="rounded-3xl border-2 border-fuchsia-500/40 bg-fuchsia-950/20 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                  <CalendarDays className="h-3.5 w-3.5" /> Gestor de Assinantes do Plano 7 Dias
                </span>
                <h3 className="text-xl sm:text-2xl font-black mt-2">Marmitas do Plano para Hoje</h3>
                <p className="text-sm text-slate-300">
                  Todo dia útil sai o prato do cardápio. Quando finalizar a entrega de hoje, o cliente avança automaticamente para o próximo dia escolhido!
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total de marmitas hoje:</p>
                <p className="text-2xl font-black text-fuchsia-300">{todayPlanOrders.length} marmitas</p>
              </div>
            </div>

            {todayPlanOrders.length === 0 ? (
              <div className="rounded-2xl border border-fuchsia-500/20 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
                Nenhum cliente do Plano 7 Dias agendado especificamente para a data de hoje ({todayStr}). Abaixo estão todos os clientes com seus planos e próximas datas.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todayPlanOrders.map((order) => {
                  const plan = parsePlanNotes(order.notes);
                  if (!plan) return null;
                  const delivered = planDeliveredCount(plan);
                  const isDoneToday = plan.completedDates?.includes(todayStr);
                  const todayDish = dishForDateKey(todayStr);
                  const busy = busyUpdate === order.id;

                  return (
                    <div key={order.id} className={`rounded-2xl border-2 p-4 transition ${isDoneToday ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-fuchsia-500/60 bg-slate-900/90 shadow-[0_0_24px_-8px_rgba(217,70,239,.4)]'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-fuchsia-400">Marmita {delivered} de {PLAN_DAYS}</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isDoneToday ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {isDoneToday ? '✓ Entregue hoje' : 'Pendente de entrega'}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold mt-1">{order.customer_name}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-rose-400 shrink-0" /> {addressLine(order)}
                      </p>
                      <div className="mt-3 rounded-xl bg-slate-950/60 p-2.5 border border-slate-800 text-xs space-y-1">
                        <p><strong className="text-white">Prato de Hoje:</strong> {todayDish ? todayDish.name : 'Prato do dia'}</p>
                        <p><strong className="text-white">Marmita:</strong> Completa {plan.sizeId === 'grande' ? 'Grande' : 'Pequena'} {plan.withCoke ? '· Com Coca-Cola' : '· Sem bebida'}</p>
                        <p><strong className="text-white">Horário:</strong> Janela {plan.window}</p>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <a href={whatsappUrl(order.customer_phone, `Olá ${order.customer_name}! É da Marmitex da Tia Val sobre a sua marmita de hoje do Plano 7 Dias.`)}
                          target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold hover:bg-emerald-600/30">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                        {!isDoneToday ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void completePlanDeliveryToday(order, todayStr)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white text-xs font-bold shadow hover:brightness-110 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> {busy ? 'Salvando…' : 'Concluir Hoje'}
                          </button>
                        ) : (
                          <span className="flex-1 text-center text-xs font-bold text-emerald-400 py-2">
                            ✓ Concluída
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Lista de Pedidos */}
        <section id="lista" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <span>{tabs.find((t) => t.id === filter)?.label ?? 'Pedidos'}</span>
              <span className="text-sm font-semibold text-slate-400">({visibleOrders.length})</span>
            </h3>
            {filter === 'novos' && visibleOrders.length > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
                Ação rápida necessária
              </span>
            )}
          </div>

          {error && <p role="alert" className="p-4 rounded-xl bg-red-500/10 border border-red-500 text-red-400 text-sm font-medium">{error}</p>}

          {visibleOrders.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-12 text-center space-y-3">
              <ShoppingBag className="mx-auto h-12 w-12 text-slate-600" />
              <p className="text-base font-bold text-slate-300">Nenhum pedido nesta aba</p>
              <p className="text-sm text-slate-500">
                {filter === 'novos'
                  ? 'Nenhum pedido novo aguardando confirmação no momento. Bom trabalho!'
                  : filter === 'pendentes'
                  ? 'Nenhum pagamento pendente no Mercado Pago.'
                  : 'Os pedidos aparecerão aqui assim que forem realizados.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleOrders.map((order) => {
                const tone = toneFor(order);
                const pay = paymentInfo(order);
                const plan = parsePlanNotes(order.notes);
                const action = primaryAction(order);
                const open = expanded === order.id;
                const busy = busyUpdate === order.id;
                const age = orderAgeMinutes(order.created_at);
                const late = !isFinished(order) && age >= 15;
                const deliveredCount = plan ? planDeliveredCount(plan) : 0;
                const nextDate = plan ? nextPendingPlanDate(plan) : null;
                const nextDish = nextDate ? dishForDateKey(nextDate) : null;

                return (
                  <article key={order.id} className={`relative flex flex-col rounded-2xl border-2 bg-[#0b0e24]/90 p-4 transition-all ${tone.border}`}>
                    {/* Topo do card */}
                    <div className="flex items-center gap-3">
                      <span className={`h-7 w-1.5 shrink-0 rounded-full ${tone.bar}`} />
                      <h4 className="text-xl lg:text-2xl font-extrabold tracking-tight">#{order.code}</h4>
                      <span className={`inline-flex items-center gap-1 text-sm ${late ? 'text-red-400 font-bold' : 'text-slate-300'}`} title={`Há ${age} min`}>
                        <Clock3 className="h-4 w-4" /> {timeLabel(order.created_at)}
                      </span>
                      {order.order_for === 'amanha' && (
                        <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-300">Amanhã</span>
                      )}
                      {plan && (
                        <span className="rounded-md bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-fuchsia-300">
                          Plano 7 Dias · {deliveredCount} de {PLAN_DAYS}
                        </span>
                      )}
                      <span className={`ml-auto shrink-0 rounded-md border px-2 py-1 text-[10px] sm:text-xs font-bold uppercase ${tone.badge}`}>{tone.label}</span>
                    </div>

                    {/* Cliente */}
                    <div className="mt-3 flex items-center gap-3 border-b border-slate-800 pb-3">
                      <User className="h-5 w-5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate font-semibold text-base">{order.customer_name}</span>
                      <a href={whatsappUrl(order.customer_phone, `Olá ${order.customer_name}! É da Marmitex da Tia Val sobre seu pedido #${order.code}.`)} target="_blank" rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/60 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    </div>

                    {/* Destaque sequencial do Plano 7 Dias se for pedido de plano */}
                    {plan && (
                      <div className="mt-3 rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/30 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-fuchsia-300">Progresso do Plano:</span>
                          <span className="text-fuchsia-200">{deliveredCount} de {PLAN_DAYS} entregues</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-fuchsia-500 to-rose-500 rounded-full transition-all" style={{ width: `${(deliveredCount / PLAN_DAYS) * 100}%` }} />
                        </div>
                        {nextDate && nextDish ? (
                          <div className="text-xs text-slate-200 bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                            <div>
                              <strong className="block text-fuchsia-300">Próxima entrega:</strong>
                              <span>{planDateLabel(nextDate)} · {nextDish.name}</span>
                            </div>
                            <span className="shrink-0 text-[11px] font-bold text-slate-400">Janela {plan.window}</span>
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-emerald-400">✓ Todas as 7 marmitas concluídas!</p>
                        )}
                        {nextDate === todayStr && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void completePlanDeliveryToday(order, todayStr)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-xs font-bold hover:bg-fuchsia-500 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Concluir marmita de hoje ({planDateLabel(todayStr)})
                          </button>
                        )}
                      </div>
                    )}

                    {/* Entrega e Pagamento */}
                    <div className="mt-3 space-y-2 text-sm">
                      {order.fulfillment === 'entrega' ? (
                        <div className="flex items-start gap-3">
                          <Bike className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">Entrega Motoboy</p>
                            <p className="flex items-start gap-1 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" /> {addressLine(order)}</p>
                          </div>
                          <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                            Taxa: {Number(order.delivery_fee) === 0 ? 'Grátis (1º de Maio)' : money(Number(order.delivery_fee))}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3"><Store className="h-5 w-5 text-slate-300" /> <span className="font-medium">Retirada no balcão</span></div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs">
                          <pay.icon className="h-4 w-4 text-teal-300" /> {pay.label}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${pay.ok ? 'bg-emerald-500/15 text-emerald-300' : order.payment_method === 'online' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700/60 text-slate-300'}`}>
                          {plan ? (pay.ok ? 'Já Pago' : `Cobrar ${money(Number(order.total))} na 1ª Entrega`) : pay.status}
                        </span>
                        {order.change_for ? <span className="text-xs text-slate-300">Troco p/ {money(Number(order.change_for))}</span> : null}
                      </div>
                    </div>

                    {/* Itens do pedido */}
                    <div className="mt-3 flex gap-3 text-sm">
                      <UtensilsCrossed className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium">Itens do pedido</p>
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex gap-2 text-slate-300">
                            <span className="shrink-0 font-semibold text-white">{item.quantity}x</span>
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
                        <div className="grid grid-cols-2 gap-2 text-slate-300 text-xs">
                          <p>Marmitas: <b>{money(Number(order.subtotal))}</b></p>
                          <p>Entrega: <b>{money(Number(order.delivery_fee))}</b></p>
                        </div>
                        {plan && (
                          <div className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/5 p-3">
                            <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-fuchsia-300">
                              <CalendarDays className="h-4 w-4" /> Calendário das 7 Marmitas
                            </p>
                            <ol className="mt-2 space-y-1 text-xs text-slate-300">
                              {plan.dates.map((d, i) => {
                                const isDone = plan.completedDates?.includes(d) || i < deliveredCount;
                                const isNext = d === nextDate;
                                const dish = dishForDateKey(d);
                                return (
                                  <li key={d} className="flex items-center gap-2">
                                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${isDone ? 'bg-emerald-500/20 text-emerald-300' : isNext ? 'bg-fuchsia-500 text-white' : 'bg-slate-700/60 text-slate-300'}`}>{i + 1}</span>
                                    <span className={`capitalize ${isDone ? 'text-slate-400 line-through' : isNext ? 'font-bold text-fuchsia-200' : ''}`}>{planDateLabel(d)} · {dish?.name}</span>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <a href={`tel:+55${phoneDigits(order.customer_phone)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800"><Phone className="h-3.5 w-3.5" /> Ligar</a>
                          {order.fulfillment === 'entrega' && order.address && (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([order.address.street, order.address.number, order.address.complement, order.address.bairro, order.address.cep].filter(Boolean).join(', '))}`}
                              target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800"><MapPin className="h-3.5 w-3.5" /> Abrir mapa</a>
                          )}
                        </div>
                        {order.fulfillment === 'entrega' && order.order_for === 'amanha' && !isFinished(order) && (
                          <label className="block space-y-1">
                            <span className="text-xs font-bold text-slate-300">Previsão manual da entrega</span>
                            <input type="datetime-local" value={toLocalDateTime(order.estimated_delivery_at)} onChange={(e) => void updateEta(order, e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 text-xs" />
                          </label>
                        )}
                        <label className="flex items-center gap-2">
                          <span className="shrink-0 text-xs font-bold text-slate-300">Alterar Situação:</span>
                          <select value={order.order_status} disabled={busy} onChange={(e) => void updateStatus(order, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 text-xs disabled:opacity-50">
                            {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </label>
                      </div>
                    )}

                    {/* Total e Ações Rápidas Estilo iFood */}
                    <div className="mt-auto pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Total do pedido</span>
                        <span className="text-xl font-extrabold text-white">{money(Number(order.total))}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {action && (
                          <button
                            type="button"
                            disabled={busy || action.disabled}
                            onClick={() => action.next && void updateStatus(order, action.next)}
                            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed ${
                              action.disabled
                                ? 'border border-slate-700 bg-slate-900/60 text-slate-400'
                                : 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_0_20px_-6px_rgba(244,63,94,.9)] hover:brightness-110 disabled:opacity-60'
                            }`}
                          >
                            <action.icon className="h-4 w-4" /> {busy ? 'Salvando…' : action.label}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : order.id)}
                          className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          {open ? 'Menos' : 'Detalhes'}
                        </button>
                        {!isFinished(order) && (
                          <button
                            type="button"
                            onClick={() => cancelOrder(order)}
                            className="p-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10"
                            title="Cancelar pedido"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Barra de Navegação Inferior Móvel (Celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden bg-[#080a1c]/95 border-t border-slate-800 backdrop-blur px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setFilter('novos')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${filter === 'novos' ? 'text-rose-400' : 'text-slate-400'}`}
        >
          <div className="relative">
            <ShoppingBag className="h-5 w-5" />
            {newOrders.length > 0 && <span className="absolute -top-1 -right-2 size-3.5 bg-rose-500 text-white text-[9px] grid place-items-center rounded-full animate-pulse">{newOrders.length}</span>}
          </div>
          <span className="mt-0.5">Novos</span>
        </button>

        <button
          onClick={() => setFilter('cozinha')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${filter === 'cozinha' ? 'text-amber-400' : 'text-slate-400'}`}
        >
          <div className="relative">
            <ChefHat className="h-5 w-5" />
            {inKitchenOrders.length > 0 && <span className="absolute -top-1 -right-2 size-3.5 bg-amber-500 text-black text-[9px] grid place-items-center rounded-full">{inKitchenOrders.length}</span>}
          </div>
          <span className="mt-0.5">Cozinha</span>
        </button>

        <button
          onClick={() => setFilter('plano')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${filter === 'plano' ? 'text-fuchsia-400' : 'text-slate-400'}`}
        >
          <div className="relative">
            <CalendarDays className="h-5 w-5" />
            {todayPlanOrders.length > 0 && <span className="absolute -top-1 -right-2 size-3.5 bg-fuchsia-500 text-white text-[9px] grid place-items-center rounded-full">{todayPlanOrders.length}</span>}
          </div>
          <span className="mt-0.5">Plano 7D</span>
        </button>

        <button
          onClick={() => setFilter('prontos')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${filter === 'prontos' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          <div className="relative">
            <Bike className="h-5 w-5" />
            {readyOrRouteOrders.length > 0 && <span className="absolute -top-1 -right-2 size-3.5 bg-emerald-500 text-black text-[9px] grid place-items-center rounded-full">{readyOrRouteOrders.length}</span>}
          </div>
          <span className="mt-0.5">Prontos</span>
        </button>

        <button
          onClick={() => setFilter('todos')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${filter === 'todos' ? 'text-sky-400' : 'text-slate-400'}`}
        >
          <RefreshCw className="h-5 w-5" />
          <span className="mt-0.5">Todos</span>
        </button>
      </nav>
    </div>
  );
}
