import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bell, Ban, Bike, CheckCircle2, Clock3, LogOut, MapPin, Phone, RefreshCw, ShieldCheck, Store, X } from 'lucide-react';

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
const statusLabel = (value: string) => statuses.find((s) => s.value === value)?.label ?? value;
const paymentLabel = (value: string) => ({
  online: 'Online (Mercado Pago)', 'entrega-pix': 'Pix na entrega',
  'entrega-cartao': 'Cartão na entrega', 'entrega-dinheiro': 'Dinheiro na entrega',
})[value] ?? value;
const paymentStatusLabel = (value: string) => ({
  pending: 'Aguardando pagamento', approved: 'Pagamento aprovado', rejected: 'Pagamento recusado',
  cancelled: 'Pagamento cancelado', refunded: 'Estornado', not_required: 'Pagar na entrega/retirada',
})[value] ?? value;

export const Route = createFileRoute('/admin')({ component: AdminPage });

function AdminPage() {
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ativos');
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [busyUpdate, setBusyUpdate] = useState<string | null>(null); // For button loading states
  const [notifiedOrders, setNotifiedOrders] = useState<Set<string>>(new Set()); // Track which orders have been notified
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio and notification permission
  useEffect(() => {
    // Create audio context for the alert sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66VVxa3rxyd3T3QDgcCA4=');
    audioRef.current.volume = 0.8;

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Resume audio context on first user interaction
    const resumeAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {}).then(() => audioRef.current!.pause());
      }
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);
  }, []);

  // Session check on mount
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (response.status === 401) { 
        setLoggedIn(false); 
        // Don't return here - we want to show login screen
      }
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os pedidos.');
      
      // Check for new orders to trigger notifications
      const newOrders = data.orders || [];
      if (!quiet && newOrders.length > 0) {
        newOrders.forEach(order => {
          // Check if this is a new order (not previously notified) and is in an active status
          const isActiveOrder = !['concluido', 'cancelado'].includes(order.order_status);
          const isNotNotifiedYet = !notifiedOrders.has(order.id);
          
          if (isActiveOrder && isNotNotifiedYet) {
            triggerOrderNotification(order);
            // Add to notified set
            setNotifiedOrders(prev => {
              const newSet = new Set(prev);
              newSet.add(order.id);
              return newSet;
            });
          }
        });
      }
      
      setOrders(data.orders ?? []);
      setLoggedIn(true);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // Trigger visual and audio notification for a new order
  const triggerOrderNotification = async (order: Order) => {
    // Play sound alert (very loud bell/alert sound)
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      }
    } catch (e) {
      console.warn('Could not play notification sound:', e);
    }
    
    // Show browser notification
    if ('Notification' in window && notificationPermission === 'granted') {
      new Notification('Pedido da Tia Val!', {
        body: `Pedido #${order.code} · ${order.customer_name} · ${money(order.total)}`,
        icon: '/favicon.ico',
        tag: order.id,
        requireInteraction: true,
      }).onclick = () => {
        window.focus();
      };
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        // Play confirmation sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      }
    }
  };

  // Initial load
  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  // Auto-refresh when logged in
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
      setBusyUpdate(order.id);
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, order_status }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o pedido.');
      await loadOrders(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar pedido.');
    } finally {
      setBusyUpdate(null);
    }
  };

  const updateEta = async (order: Order, value: string) => {
    setError('');
    try {
      setBusyUpdate(order.id);
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, estimated_delivery_at: value ? new Date(value).toISOString() : null }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a previsão.');
      await loadOrders(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar previsão.');
    } finally {
      setBusyUpdate(null);
    }
  };

  const toLocalDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      setLoggedIn(false); setOrders([]);
    }
  };

  // Pedidos pagos online e pedidos para pagar na entrega podem ir para a cozinha.
  // Pedidos online pendentes ficam numa fila separada e nunca contam como pedido ativo.
  const isKitchenEligible = (order: Order) =>
    order.payment_method !== 'online' || order.payment_status === 'approved';
  const unpaidOnlineOrders = orders.filter(
    (order) => order.payment_method === 'online' && order.payment_status !== 'approved',
  );
  const eligibleOrders = orders.filter(isKitchenEligible);
  const visibleOrders = filter === 'pagamentos-pendentes'
    ? unpaidOnlineOrders
    : eligibleOrders.filter((order) =>
        filter === 'todos'
          ? true
          : filter === 'ativos'
            ? !['concluido', 'cancelado'].includes(order.order_status)
            : order.order_status === filter,
      );
  const pendingCount = eligibleOrders.filter((order) => order.order_status === 'novo').length;
  
  // Financial metrics
  const totalSales = eligibleOrders.reduce((sum, order) => sum + order.total, 0);
  const pendingPayments = eligibleOrders
    .filter(order => order.payment_method === 'online' && order.payment_status === 'pending')
    .reduce((sum, order) => sum + order.total, 0);
  const approvedPayments = eligibleOrders
    .filter(order => order.payment_method === 'online' && order.payment_status === 'approved')
    .reduce((sum, order) => sum + order.total, 0);
    
  const orderAgeMinutes = (createdAt: string) => Math.max(0, Math.floor((clockNow - new Date(createdAt).getTime()) / 60000));
  const orderAgeLabel = (createdAt: string) => {
    const minutes = orderAgeMinutes(createdAt);
    if (minutes < 1) return 'Feito agora';
    if (minutes < 60) return `Há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `Há ${hours}h ${remainingMinutes}min` : `Há ${hours}h`;
  };

  if (!loggedIn) {
    // Login screen - matching motoboy style
    return (
      <main className="min-h-screen bg-[linear-gradient(to_bottom,_#0f172a,_#1e293b)] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-3xl bg-[linear-gradient(to_bottom_right,_#e11d48,_#dc262d)] flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[.25em] text-[#e11d48]/80">Marmitex da Tia Val</p>
            <h1 className="text-3xl font-bold text-center">Painel de Pedidos</h1>
            <p className="text-sm text-[#94a3b8]">Área privada da família</p>
          </div>
          
          <form onSubmit={login} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium mb-1 block">Senha de acesso</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#334155] bg-[rgba(30,41,59,0.5)] text-white placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e11d48]/50 focus:border-[#e11d48] transition-colors"
                placeholder="Digite sua senha"
              />
            </label>
            
            {error && (
              <p role="alert" className="w-full px-4 py-3 rounded-xl bg-[rgba(220,38,38,0.1)] border border-[#ef4444] text-[#ef4444] text-sm">
                {error}
              </p>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-[linear-gradient(to_bottom_right,_#e11d48,_#dc262d)] text-white font-medium font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[0.98]"
            >
              {loading ? 'Entrando…' : 'Entrar no painel'}
            </button>
          </form>
          
          <div className="border-t border-[#334155]/50 pt-6">
            <p className="mb-2 text-center text-sm text-[#94a3b8]">Ou entre como entregador</p>
            <a 
              href="/motoboy"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#e11d48]/50 bg-[rgba(225,29,72,0.1)] text-[#e11d48] font-medium transition-all hover:bg-[rgba(225,29,72,0.2)]"
            >
              <Bike className="h-5 w-5" /> Área do motoboy
            </a>
          </div>
          
          <div className="mt-4 p-3 rounded-xl border border-[#334155]/30 bg-[rgba(255,250,240,0.05)]">
            <p className="text-xs text-[#94a3b8] font-medium mb-1">🔔 Notificações</p>
            <p className="text-xs text-[#6b7280] leading-relaxed">
              Ao ativar, você receberá notificação sonora e visual quando houver novos pedidos. As notificações funcionam no navegador e no celular quando a página estiver aberta.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(to_bottom,_#0f172a,_#1e293b)] text-white">
      {/* Header */}
      <header className="border-b border-[#334155]/50 bg-[rgba(15,23,42,0.8)]/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-center md:text-left">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e11d48]/80">Marmitex da Tia Val</p>
              <h1 className="text-2xl font-bold text-center md:text-left">Pedidos da cozinha</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => void loadOrders()}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#334155]/50 bg-[rgba(51,65,85,0.3)] text-[#e2e8f0] text-sm font-medium hover:bg-[rgba(51,65,85,0.4)] transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Atualizar</span>
              </button>
              
              <button
                onClick={logout}
                aria-label="Sair"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#334155]/50 bg-[rgba(51,65,85,0.3)] text-[#e2e8f0] text-sm font-medium hover:bg-[rgba(51,65,85,0.4)] transition-colors"
              >
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
              </button>
              
              {notificationPermission !== 'granted' && (
                <button
                  onClick={requestNotificationPermission}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#f59e0b]/50 bg-[rgba(245,158,11,0.1)] text-[#f59e0b] text-sm font-medium hover:bg-[rgba(245,158,11,0.2)] transition-colors"
                >
                  <Bell className="h-4 w-4" /> <span className="hidden sm:inline">Ativar avisos sonoros</span>
                </button>
              )}
              {notificationPermission === 'granted' && (
                <button
                  onClick={() => { /* already granted, just visual indicator */ }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#10b981]/50 bg-[rgba(16,185,129,0.1)] text-[#10b981] text-sm font-medium"
                >
                  <Bell className="h-4 w-4 text-[#10b981]" /> <span className="hidden sm:inline text-[#10b981]">Avisos ativados</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          <div className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm p-4">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e11d48]/60">Pedidos novos</p>
            <p className="mt-2 text-3xl font-bold text-[#e11d48]">{pendingCount}</p>
          </div>
          
          <div className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm p-4">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#10b981]/60">Em andamento</p>
            <p className="mt-2 text-3xl font-bold text-[#10b981]">{eligibleOrders.filter((o) => !['concluido', 'cancelado'].includes(o.order_status)).length}</p>
          </div>
          
          <div className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm p-4">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f59e0b]/60">Hoje</p>
            <p className="mt-2 text-3xl font-bold text-[#f59e0b]">{orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length}</p>
          </div>
          
          <div className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm p-4">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#3b82f6]/60">Vendas totais</p>
            <p className="mt-2 text-3xl font-bold text-[#3b82f6]">{money(totalSales)}</p>
          </div>
          
          <div className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm p-4">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f59e0b]/60">Pendentes</p>
            <p className="mt-2 text-3xl font-bold text-[#f59e0b]">{money(pendingPayments)}</p>
          </div>
          
          <div className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm p-4">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#10b981]/60">Aprovados</p>
            <p className="mt-2 text-3xl font-bold text-[#10b981]">{money(approvedPayments)}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#e2e8f0]">Lista de pedidos</h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="min-w-[180px] px-3 py-2 rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)] text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#e11d48]/50"
            >
              <option value="ativos">Pedidos ativos</option>
              <option value="todos">Todos os pedidos</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error/Empty States */}
        {error && (
          <div className="rounded-xl border border-[#ef4444]/50 bg-[rgba(220,38,38,0.1)] p-6">
            <p role="alert" className="text-[#ef4444] text-sm font-medium">{error}</p>
          </div>
        )}
        
        {loading && orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#94a3b8] text-sm">Carregando pedidos…</p>
          </div>
        )}
        
        {!loading && visibleOrders.length === 0 && (
          <div className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm p-8 text-center">
            <Store className="mx-auto h-12 w-12 text-[#6b7280] mb-4" />
            <h3 className="font-semibold text-[#e2e8f0] mb-2">
              {filter === "pagamentos-pendentes" ? "Nenhum pagamento pendente" : "Nenhum pedido por aqui"}
            </h3>
            <p className="text-[#94a3b8] text-sm">
              {filter === "pagamentos-pendentes" 
                ? "Pedidos online só são liberados para a cozinha após a confirmação do Mercado Pago."
                : "Quando houver pedidos liberados, eles aparecerão nesta tela."}
            </p>
          </div>
        )}

        {/* Orders List */}
        {!loading && visibleOrders.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleOrders.map((order) => (
              <article 
                key={order.id} 
                className="rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)]/50 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 p-4 border-b border-[#334155]/50">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]/80">Pedido #{order.code}</p>
                    <h3 className="mt-1 text-lg font-bold text-[#e2e8f0]">{order.customer_name}</h3>
                    <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${orderAgeMinutes(order.created_at) >= 15 && !['concluido', 'cancelado'].includes(order.order_status) ? 'bg-[rgba(239,68,68,0.2)] text-[#ef4444]' : orderAgeMinutes(order.created_at) >= 5 && !['concluido', 'cancelado'].includes(order.order_status) ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]' : 'bg-[rgba(148,163,184,0.2)] text-[#d1d5db]'}`}>
                      <Clock3 className="h-4 w-4" /> {orderAgeLabel(order.created_at)}
                    </p>
                  </div>
                  
                  <span className={`rounded-full px-3 py-1 text-center text-xs font-semibold ${order.order_status === 'novo' ? 'bg-[rgba(245,158,11,0.2)] text-[#f5e0b]' : order.order_status === 'concluido' ? 'bg-[rgba(16,185,129,0.2)] text-[#10b981]' : order.order_status === 'cancelado' ? 'bg-[rgba(239,68,68,0.2)] text-[#ef4444]' : 'bg-[rgba(148,163,184,0.2)] text-[#d1d5db]'}`}>
                    {statusLabel(order.order_status)}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                  {/* Items */}
                  <div className="space-y-2">
                    {order.items?.map((item, index) => (
                      <div key={index} className="flex justify-between gap-3 text-sm text-[#94a3b8]">
                        <div>
                          <p className="font-medium">{item.quantity}× {item.meal_name}</p>
                          {item.notes && <p className="text-xs text-[#6b7280] mt-0.5">{item.notes}</p>}
                        </div>
                        <span className="font-medium">{money(Number(item.unit_price) * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-2">
                    <div className="grid gap-4 grid-cols-2 text-[#94a3b8] text-sm">
                      <div>
                        <p className="font-semibold">Marmitas</p>
                        <p>{money(Number(order.subtotal))}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Entrega</p>
                        <p>{money(Number(order.delivery_fee))}</p>
                      </div>
                      <div className="col-span-2 border-t border-[#334155]/30 pt-2">
                        <p className="font-semibold text-[#e2e8f0]">Total</p>
                        <p className="text-2xl font-bold">{money(Number(order.total))}</p>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-start gap-3 text-sm text-[#94a3b8]">
                      <Phone className="h-4 w-4 mr-1" />{order.customer_phone}
                    </div>
                    
                    <div className="flex items-start gap-3 text-sm text-[#94a3b8]">
                      {order.fulfillment === 'entrega' ? (
                        <>
                          <Bike className="h-4 w-4 mr-1" />
                          <span>{order.address ? [order.address.street, order.address.number, order.address.complement, order.address.bairro, order.address.cep].filter(Boolean).join(', ') || 'Endereço não informado' : 'Endereço não informado'}</span>
                        </>
                      ) : (
                        <>
                          <Store className="h-4 w-4 mr-1" />
                          <span>Retirada na cozinha</span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-start gap-3 text-sm text-[#94a3b8]">
                      <span className="font-medium">Pagamento:</span> <span>{order.payment_method === 'online' ? 'Online' : order.payment_method === 'entrega-pix' ? 'Pix na entrega' : order.payment_method === 'entrega-cartao' ? 'Cartão na entrega' : order.payment_method === 'entrega-dinheiro' ? 'Dinheiro na entrega' : order.payment_method}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium {order.payment_method === 'online' ? (order.payment_status === 'approved' ? 'bg-[rgba(16,185,129,0.2)] text-[#10b981]' : 'bg-[rgba(250,204,21,0.2)] text-[#f59e0b]') : 'bg-[rgba(107,114,128,0.2)] text-[#6b7280]' }">
                        {order.payment_method === 'online' ? (order.payment_status === 'approved' ? 'Pagamento aprovado' : 'Aguardando confirmação') : 'Pagamento na entrega'}
                      </span>
                    </div>
                    
                    {/* Payment method badge */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[rgba(59,130,246,0.2)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)]">
                        {order.payment_method === 'online' ? (
                          <>
                            <span className="uppercase font-bold">MP</span>
                            <span className="capitalize">{order.payment_status === 'approved' ? 'aprovado' : order.payment_status}</span>
                          </>
                        ) : order.payment_method === 'entrega-pix' ? (
                          <>💰 <span>Pix na entrega</span></>
                        ) : order.payment_method === 'entrega-cartao' ? (
                          <>💳 <span>Cartão na entrega</span></>
                        ) : order.payment_method === 'entrega-dinheiro' ? (
                          <>💵 <span>Dinheiro na entrega</span></>
                        ) : (
                          <>{order.payment_method}</>
                        )}
                      </span>
                    </div>
                    
                    {order.change_for && (
                      <div className="flex items-start gap-3 text-sm text-[#94a3b8] mt-2">
                        <span className="font-medium">Troco para:</span> <span>{money(Number(order.change_for))}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-start gap-2 text-sm text-[#94a3b8]">
                      <Phone className="h-4 w-4 mr-1" />
                      <a href={`tel:+55${phoneDigits(order.customer_phone)}`} className="text-[#3b82f6] hover:underline">Ligar</a>
                    </div>
                    
                    {order.fulfillment === 'entrega' && (
                      <>
                        <div className="flex items-start gap-2 text-sm text-[#94a3b8] mt-2">
                          <MapPin className="h-4 w-4 mr-1" />
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([order.address.street, order.address.number, order.address.complement, order.address.bairro, order.address.cep].filter(Boolean).join(', '))}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[#3b82f6] hover:underline"
                          >
                            Abrir mapa
                          </a>
                        </div>
                        
                        {order.fulfillment === 'entrega' && order.order_for === 'amanha' && !['concluido', 'cancelado'].includes(order.order_status) && (
                          <label className="block space-y-2 mt-4">
                            <span className="text-sm font-bold text-[#94a3b8] block mb-1">Agendamento da entrega</span>
                            <input
                              type="datetime-local"
                              value={toLocalDateTime(order.estimated_delivery_at)}
                              onChange={(e) => void updateEta(order, e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)] text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#e11d48]/50"
                            />
                            <span className="block text-xs font-normal text-[#6b7280] mt-1">
                              Use este campo somente para pedidos agendados. Para pedidos do dia, o motoboy informa a previsão no painel de entregas.
                            </span>
                          </label>
                        )}
                      </>
                    )}
                    
                    <div className="flex items-start gap-2 text-sm text-[#94a3b8] mt-2">
                      <label className="flex items-center gap-1 text-sm font-medium">
                        Atualizar situação
                        <select
                          value={order.order_status}
                          onChange={(e) => void updateStatus(order, e.target.value)}
                          className="ml-2 min-w-[120px] px-2 py-1 rounded-xl border border-[#334155]/50 bg-[rgba(30,41,59,0.5)] text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#e11d48]/50 disabled:{busyUpdate === order.id ? 'opacity-50 cursor-not-allowed' : ''}"
                        >
                          <option value="" disabled>Escolha o status</option>
                          {statuses.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </label>
                      
                      {(!["concluido", "cancelado"].includes(order.order_status)) && (
                        <button
                          type="button"
                          onClick={() => { 
                            if (window.confirm(`Tem certeza que deseja cancelar o pedido #${order.code} de ${order.customer_name}?`)) 
                              void updateStatus(order, "cancelado"); 
                          }}
                          disabled={busyUpdate === order.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#ef4444]/50 bg-[rgba(239,68,68,0.1)] text-[#ef4444] text-sm font-medium hover:bg-[rgba(239,68,68,0.2)] transition-colors disabled:opacity-50 cursor-not-allowed"
                        >
                          <Ban className="h-4 w-4 mr-1" /> Cancelar pedido
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <p className="mt-8 text-center text-[#64748b] text-xs">
          <Clock3 className="h-4 w-4 mr-1" /> Atualização automática a cada 15 segundos <CheckCircle2 className="h-4 w-4 ml-1" />
        </p>
      </main>
    </>
  );
}