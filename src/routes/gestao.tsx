import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Users,
  Search,
  Phone,
  MessageCircle,
  ShoppingBag,
  Clock,
  Sparkles,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronUp,
  Store,
  DollarSign,
  TrendingUp,
  UserCheck,
  UserPlus,
  Shield,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Crown,
  Repeat,
  AlertTriangle,
  X,
  PlusCircle,
  Calendar,
  Layers,
  ArrowUpDown,
  FileCode2,
} from 'lucide-react';

type RecentOrder = {
  code: string;
  total: number;
  orderStatus: string;
  createdAt: string;
};

type Customer = {
  phone: string;
  rawPhone: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalOrders: number;
  totalSpent: number;
  hasPurchased: boolean;
  status: 'vip' | 'recorrente' | 'primeira_compra' | 'lead';
  notes?: string | null;
  lastOrder?: {
    code: string;
    total: number;
    orderStatus: string;
    paymentStatus: string;
    createdAt: string;
    fulfillment: string;
  };
  recentOrders: RecentOrder[];
};

type Summary = {
  totalCustomers: number;
  totalPurchasers: number;
  totalLeads: number;
  totalVips?: number;
  totalRecurring?: number;
  todayNew: number;
  todayActive: number;
  totalRevenue: number;
};

export const Route = createFileRoute('/gestao')({
  component: GestaoPage,
});

const formatPhone = (val: string) => {
  const d = val.replace(/\D/g, '');
  const digits = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return val;
};

const formatMoney = (val: number) =>
  Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const formatFullDate = (iso: string) => {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const whatsappLeadUrl = (phone: string, name: string) => {
  const d = phone.replace(/\D/g, '');
  const fullPhone = d.startsWith('55') ? d : `55${d}`;
  const firstName = name?.trim().split(' ')[0] || '';
  const greeting = firstName ? `Olá ${firstName}!` : 'Olá!';
  const msg = `${greeting} Tudo bem? Vi que você acessou o cardápio da Tia Val Marmitex. Quer que eu te envie o prato de hoje com entrega quentinha aí pra você?`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
};

const whatsappCustomerUrl = (phone: string, name: string, status: Customer['status']) => {
  const d = phone.replace(/\D/g, '');
  const fullPhone = d.startsWith('55') ? d : `55${d}`;
  const firstName = name?.trim().split(' ')[0] || '';
  const greeting = firstName ? `Olá ${firstName}!` : 'Olá!';
  let msg = '';
  if (status === 'vip') {
    msg = `${greeting} Tudo bem? É da Marmitex da Tia Val! Passando para agradecer sua preferência de sempre como cliente VIP. Já sabe o que vai querer de almoço hoje?`;
  } else if (status === 'primeira_compra') {
    msg = `${greeting} Tudo bem? Aqui é da Marmitex da Tia Val! Passando para saber o que você achou do seu pedido. Foi tudo bem com a comida e a entrega?`;
  } else {
    msg = `${greeting} Tudo bem? É da Marmitex da Tia Val! Passando para desejar um ótimo dia. Se quiser pedir seu almoço hoje é só me dar um alô!`;
  }
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
};

const orderStatusBadge = (status: string) => {
  switch (status) {
    case 'concluido':
      return { label: 'Concluído', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'saiu_entrega':
      return { label: 'Em entrega', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    case 'preparando':
      return { label: 'Na cozinha', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'confirmado':
      return { label: 'Confirmado', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    case 'cancelado':
      return { label: 'Cancelado', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    default:
      return { label: status, color: 'bg-slate-700/40 text-slate-300 border-slate-600/30' };
  }
};

const SQL_MIGRATION_CODE = `-- Marmitex da Tia Val: Tabela de Leads e Cadastros
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notes text
);

create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customers_created_at_idx on public.customers (created_at desc);
create index if not exists customers_last_seen_at_idx on public.customers (last_seen_at desc);

alter table public.customers enable row level security;`;

function GestaoPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hasCustomersTable, setHasCustomersTable] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [tabFilter, setTabFilter] = useState<'todos' | 'vips' | 'recorrentes' | 'primeira' | 'leads' | 'hoje'>('todos');
  const [sortBy, setSortBy] = useState<'recente' | 'pedidos' | 'valor' | 'nome'>('recente');
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);

  // Estados de cópia e modais
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form de novo cliente manual
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [addError, setAddError] = useState('');

  // Carrega clientes
  const fetchCustomers = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/customers', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthenticated(false);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as {
          customers: Customer[];
          summary: Summary;
          hasCustomersTable?: boolean;
        };
        setCustomers(data.customers || []);
        setSummary(data.summary || null);
        if (typeof data.hasCustomersTable === 'boolean') {
          setHasCustomersTable(data.hasCustomersTable);
        }
        setAuthenticated(true);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Falha ao carregar clientes:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Polling em tempo real a cada 4 segundos
  useEffect(() => {
    fetchCustomers();
    const interval = setInterval(() => {
      fetchCustomers(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchCustomers]);

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoadingLogin(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword('');
        setAuthenticated(true);
        fetchCustomers();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setLoginError(data.error || 'Senha incorreta.');
      }
    } catch {
      setLoginError('Erro de conexão ao tentar fazer login.');
    } finally {
      setLoadingLogin(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      setAuthenticated(false);
    }
  };

  // Copiar telefone com feedback
  const handleCopyPhone = (phone: string) => {
    const d = phone.replace(/\D/g, '');
    navigator.clipboard.writeText(d).then(() => {
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    });
  };

  // Copiar SQL de migração
  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_CODE).then(() => {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    });
  };

  // Cadastrar cliente manual
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = newPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setAddError('Digite o telefone com DDD (mínimo 10 números).');
      return;
    }
    setSavingCustomer(true);
    setAddError('');
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          name: newName,
          notes: newNotes,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewPhone('');
        setNewName('');
        setNewNotes('');
        await fetchCustomers();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setAddError(data.error || 'Falha ao cadastrar cliente.');
      }
    } catch {
      setAddError('Erro de conexão.');
    } finally {
      setSavingCustomer(false);
    }
  };

  // Contadores para as abas
  const tabCounts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return {
      todos: customers.length,
      vips: customers.filter((c) => c.status === 'vip').length,
      recorrentes: customers.filter((c) => c.status === 'recorrente').length,
      primeira: customers.filter((c) => c.status === 'primeira_compra').length,
      leads: customers.filter((c) => c.status === 'lead').length,
      hoje: customers.filter((c) => {
        const lastSeen = new Date(c.lastSeenAt).getTime();
        const firstSeen = new Date(c.firstSeenAt).getTime();
        return lastSeen >= todayStart || firstSeen >= todayStart;
      }).length,
    };
  }, [customers]);

  // Filtragem e ordenação dos clientes
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const list = customers.filter((c) => {
      // Busca por nome ou telefone
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.rawPhone.includes(term);

      if (!matchesSearch) return false;

      // Filtro de abas
      if (tabFilter === 'vips') return c.status === 'vip';
      if (tabFilter === 'recorrentes') return c.status === 'recorrente';
      if (tabFilter === 'primeira') return c.status === 'primeira_compra';
      if (tabFilter === 'leads') return c.status === 'lead';
      if (tabFilter === 'hoje') {
        const lastSeen = new Date(c.lastSeenAt).getTime();
        const firstSeen = new Date(c.firstSeenAt).getTime();
        return lastSeen >= todayStart || firstSeen >= todayStart;
      }
      return true;
    });

    // Ordenação
    list.sort((a, b) => {
      if (sortBy === 'pedidos') return b.totalOrders - a.totalOrders;
      if (sortBy === 'valor') return b.totalSpent - a.totalSpent;
      if (sortBy === 'nome') return a.name.localeCompare(b.name);
      // Padrão: mais recente
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });

    return list;
  }, [customers, searchTerm, tabFilter, sortBy]);

  // Tela de login
  if (authenticated === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
        <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-rose-950/50">
              <Shield className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-white">Tia Val · Gestão</h1>
            <p className="mt-1 text-xs text-slate-400">
              Acompanhamento de cadastros e clientes em tempo real
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Senha de Administrador
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha..."
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-3 text-sm font-semibold text-white outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            {loginError && (
              <p className="rounded-lg bg-rose-500/10 p-2.5 text-center text-xs font-bold text-rose-400">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loadingLogin || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-sm font-black text-white shadow-md shadow-rose-900/30 transition hover:brightness-110 active:scale-[.99] disabled:opacity-50"
            >
              {loadingLogin ? 'Entrando...' : 'Acessar Painel de Gestão'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/admin" className="text-xs font-semibold text-slate-400 hover:text-white">
              ← Voltar ao painel da cozinha
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] pb-16 text-slate-100 antialiased">
      {/* Header Superior Moderno */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#161b22]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 font-bold text-white shadow-lg shadow-rose-950/40">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">Tia Val · Gestão de Clientes</span>
                <span className="hidden rounded-full bg-gradient-to-r from-rose-500/20 to-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-500/30 sm:inline-block">
                  Painel do Dono
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-emerald-400">Ao vivo</span>
                {lastUpdated && (
                  <span className="text-slate-400">
                    · atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition hover:brightness-110 active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">+ Novo Cliente / Lead</span>
              <span className="sm:hidden">+ Novo</span>
            </button>

            <button
              onClick={() => fetchCustomers()}
              disabled={isRefreshing}
              title="Atualizar dados agora"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
            </button>

            <Link
              to="/admin"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white md:flex"
            >
              <Store className="h-3.5 w-3.5 text-amber-400" />
              <span>Cozinha</span>
            </Link>

            <button
              onClick={handleLogout}
              title="Sair do painel"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 transition hover:bg-rose-950/40 hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {/* Banner de Aviso de Ativação do Supabase caso a tabela de leads não exista */}
        {!hasCustomersTable && (
          <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 text-amber-200 shadow-lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-amber-100 text-sm sm:text-base">
                    Ative a captura de novos números sem pedido (Leads)
                  </h3>
                  <p className="mt-0.5 text-xs text-amber-300/90 leading-relaxed">
                    Os 61 clientes que já compraram aparecem normalmente abaixo. Para registrar também quem apenas digita o telefone para olhar o cardápio (sem comprar), crie a tabela <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-amber-200">customers</code> no seu Supabase.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-300 active:scale-95"
                >
                  {copiedSql ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-900" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowSqlModal(true)}
                  className="flex items-center gap-1 rounded-xl border border-amber-400/40 bg-black/30 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-black/50"
                >
                  <FileCode2 className="h-3.5 w-3.5" />
                  <span>Ver código</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resumo / Métricas com visual Premium */}
        {summary && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {/* Total de Clientes */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#161b22] p-4 shadow-sm transition hover:border-slate-700">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Clientes</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-white sm:text-3xl">{summary.totalCustomers}</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                <span className="font-bold text-emerald-400">{summary.totalPurchasers}</span> compradores
              </div>
            </div>

            {/* Clientes VIPs */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-[#161b22] p-4 shadow-sm transition hover:border-amber-500/50">
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">Clientes VIPs</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
                  <Crown className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                {summary.totalVips ?? customers.filter((c) => c.status === 'vip').length}
              </p>
              <p className="mt-1 text-[11px] text-amber-400/80 font-medium">5+ pedidos cada</p>
            </div>

            {/* Novos / Ativos Hoje */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-[#161b22] p-4 shadow-sm transition hover:border-emerald-500/50">
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Ativos Hoje</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                  <UserPlus className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-400 sm:text-3xl">
                +{summary.todayActive}
              </p>
              <p className="mt-1 text-[11px] text-emerald-400/80 font-medium">
                {summary.todayNew > 0 ? `+${summary.todayNew} cadastros novos` : 'Clientes ativos hoje'}
              </p>
            </div>

            {/* Leads no Site */}
            <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/5 to-[#161b22] p-4 shadow-sm transition hover:border-rose-500/50">
              <div className="flex items-center justify-between text-rose-300">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">Leads no Site</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-rose-300 sm:text-3xl">{summary.totalLeads}</p>
              <p className="mt-1 text-[11px] text-rose-400/80 font-medium">Sem pedido feito ainda</p>
            </div>

            {/* Faturamento Acumulado */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-1 relative overflow-hidden rounded-2xl border border-slate-800 bg-[#161b22] p-4 shadow-sm transition hover:border-slate-700">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Faturado</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black text-emerald-400 sm:text-2xl">
                {formatMoney(summary.totalRevenue)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Média: {summary.totalPurchasers > 0 ? formatMoney(summary.totalRevenue / summary.totalPurchasers) : 'R$ 0,00'}/cliente
              </p>
            </div>
          </div>
        )}

        {/* Barra de Filtros, Busca e Ordenação */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Campo de Busca */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, DDD ou número..."
                className="w-full rounded-xl border border-slate-700/80 bg-[#161b22] pl-10 pr-10 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-slate-700/80 bg-[#161b22] px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-rose-500"
              >
                <option value="recente">Mais recentes primeiro</option>
                <option value="pedidos">Mais pedidos feitos</option>
                <option value="valor">Maior valor gasto (R$)</option>
                <option value="nome">Nome (A - Z)</option>
              </select>
            </div>
          </div>

          {/* Abas de Filtro com badges */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTabFilter('todos')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                tabFilter === 'todos'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                  : 'border border-slate-800 bg-[#161b22] text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>Todos</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-black">
                {tabCounts.todos}
              </span>
            </button>

            <button
              onClick={() => setTabFilter('vips')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                tabFilter === 'vips'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-950/40'
                  : 'border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <Crown className="h-3 w-3" />
              <span>VIPs (5+)</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-black">
                {tabCounts.vips}
              </span>
            </button>

            <button
              onClick={() => setTabFilter('recorrentes')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                tabFilter === 'recorrentes'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40'
                  : 'border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
              }`}
            >
              <Repeat className="h-3 w-3" />
              <span>Recorrentes (2 a 4)</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-black">
                {tabCounts.recorrentes}
              </span>
            </button>

            <button
              onClick={() => setTabFilter('primeira')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                tabFilter === 'primeira'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              <ShoppingBag className="h-3 w-3" />
              <span>1º Pedido</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-black">
                {tabCounts.primeira}
              </span>
            </button>

            <button
              onClick={() => setTabFilter('leads')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                tabFilter === 'leads'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-950/40'
                  : 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Leads (Sem pedido)</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-black">
                {tabCounts.leads}
              </span>
            </button>

            <button
              onClick={() => setTabFilter('hoje')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                tabFilter === 'hoje'
                  ? 'bg-slate-200 text-slate-900 font-black shadow-md'
                  : 'border border-slate-800 bg-[#161b22] text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>Ativos Hoje</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-black">
                {tabCounts.hoje}
              </span>
            </button>
          </div>
        </div>

        {/* Lista de Clientes em Cards Modernos ("Fácil de ver cada um") */}
        <div className="space-y-3.5">
          {filteredCustomers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-800 bg-[#161b22]/50 py-16 text-center text-slate-400">
              <Users className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-3 text-lg font-bold text-slate-200">Nenhum cliente encontrado</p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                {searchTerm
                  ? 'Tente buscar com outro nome ou número de telefone.'
                  : 'Assim que novos clientes acessarem ou fizerem pedidos, aparecerão aqui automaticamente.'}
              </p>
            </div>
          ) : (
            filteredCustomers.map((customer) => {
              const isExpanded = expandedPhone === customer.phone;
              const isLead = !customer.hasPurchased;

              // Cor temática do card baseado no status
              let badgeTheme = {
                badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                badgeText: '1º Pedido Feito',
                avatarBg: 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white',
                borderHover: 'hover:border-emerald-500/40',
              };

              if (customer.status === 'vip') {
                badgeTheme = {
                  badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  badgeText: `👑 VIP · ${customer.totalOrders} pedidos`,
                  avatarBg: 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black',
                  borderHover: 'hover:border-amber-500/50',
                };
              } else if (customer.status === 'recorrente') {
                badgeTheme = {
                  badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                  badgeText: `🔄 Recorrente · ${customer.totalOrders} pedidos`,
                  avatarBg: 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white',
                  borderHover: 'hover:border-blue-500/40',
                };
              } else if (customer.status === 'lead') {
                badgeTheme = {
                  badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                  badgeText: '🎯 Lead · Ainda não pediu',
                  avatarBg: 'bg-gradient-to-tr from-rose-600 to-red-500 text-white',
                  borderHover: 'hover:border-rose-500/40',
                };
              }

              const initialLetter =
                customer.name && customer.name !== 'Cliente' && customer.name !== 'Interessado (Lead)'
                  ? customer.name.charAt(0).toUpperCase()
                  : 'C';

              return (
                <div
                  key={customer.phone}
                  className={`overflow-hidden rounded-2xl border border-slate-800 bg-[#161b22] p-4 sm:p-5 shadow-sm transition-all duration-200 ${badgeTheme.borderHover}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Bloco 1: Avatar, Nome, Status e Telefone */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-black shadow-md ${badgeTheme.avatarBg}`}
                      >
                        {initialLetter}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                            {customer.name}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${badgeTheme.badgeBg}`}
                          >
                            {badgeTheme.badgeText}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                          {/* Telefone com botão de cópia rápida */}
                          <div className="flex items-center gap-1 font-mono font-bold text-slate-200 bg-black/40 px-2 py-0.5 rounded-lg border border-slate-800">
                            <span>{formatPhone(customer.phone)}</span>
                            <button
                              onClick={() => handleCopyPhone(customer.phone)}
                              title="Copiar número"
                              className="ml-1 text-slate-400 hover:text-white transition"
                            >
                              {copiedPhone === customer.phone ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>

                          <span>·</span>
                          <span
                            className="flex items-center gap-1 text-slate-400"
                            title={formatFullDate(customer.lastSeenAt)}
                          >
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {timeAgo(customer.lastSeenAt)}
                          </span>

                          {customer.notes && (
                            <>
                              <span>·</span>
                              <span className="italic text-slate-400">"{customer.notes}"</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Mini Indicadores (Gasto, Pedidos, Ticket Médio) */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/30 p-2.5 border border-slate-800/80 text-center sm:gap-4 sm:px-4">
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Total Gasto
                        </span>
                        <span className="text-sm font-black text-emerald-400 sm:text-base">
                          {formatMoney(customer.totalSpent)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Pedidos
                        </span>
                        <span className="text-sm font-black text-white sm:text-base">
                          {customer.totalOrders}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Média/Ped.
                        </span>
                        <span className="text-sm font-black text-slate-300 sm:text-base">
                          {customer.totalOrders > 0
                            ? formatMoney(customer.totalSpent / customer.totalOrders)
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Bloco 3: Botões de Ação Imediata (WhatsApp, Ligar, Ver Pedidos) */}
                    <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                      {/* WhatsApp com mensagem inteligente */}
                      <a
                        href={
                          isLead
                            ? whatsappLeadUrl(customer.phone, customer.name)
                            : whatsappCustomerUrl(customer.phone, customer.name, customer.status)
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] px-3.5 py-2 text-xs font-black text-slate-950 shadow-md shadow-emerald-950/40 transition active:scale-95"
                      >
                        <MessageCircle className="h-4 w-4 fill-slate-950" />
                        <span>Chamar no WhatsApp</span>
                      </a>

                      {/* Ligar */}
                      <a
                        href={`tel:${customer.phone.replace(/\D/g, '')}`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                        title="Ligar para o cliente"
                      >
                        <Phone className="h-4 w-4" />
                      </a>

                      {/* Abrir Histórico de Pedidos */}
                      {customer.recentOrders.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedPhone(isExpanded ? null : customer.phone)
                          }
                          className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                        >
                          <ShoppingBag className="h-3.5 w-3.5 text-rose-400" />
                          <span>{customer.totalOrders} pedidos</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resumo do Último Pedido (Visível sempre se houver) */}
                  {customer.lastOrder && !isExpanded && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-slate-400 border border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-300">
                          Último pedido: #{customer.lastOrder.code}
                        </span>
                        <span>·</span>
                        <span className="font-bold text-emerald-400">
                          {formatMoney(customer.lastOrder.total)}
                        </span>
                        <span>·</span>
                        <span>{timeAgo(customer.lastOrder.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                            orderStatusBadge(customer.lastOrder.orderStatus).color
                          }`}
                        >
                          {orderStatusBadge(customer.lastOrder.orderStatus).label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Histórico Completo Expansível */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-slate-800/80 pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                          Histórico Recente de Pedidos ({customer.recentOrders.length})
                        </span>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {customer.recentOrders.map((ord) => {
                          const badge = orderStatusBadge(ord.orderStatus);
                          return (
                            <div
                              key={ord.code}
                              className="flex items-center justify-between rounded-xl border border-slate-800 bg-black/40 p-2.5 text-xs"
                            >
                              <div>
                                <span className="font-black text-white">Pedido #{ord.code}</span>
                                <span className="ml-2 font-bold text-emerald-400">
                                  {formatMoney(ord.total)}
                                </span>
                                <p className="text-[11px] text-slate-500">
                                  {formatFullDate(ord.createdAt)} ({timeAgo(ord.createdAt)})
                                </p>
                              </div>

                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.color}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Modal de Cadastro Manual de Cliente */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#161b22] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-rose-500" />
                <h3 className="font-black text-white text-base">Novo Cliente ou Lead</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  WhatsApp ou Telefone com DDD *
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(33) 99487-5161"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nome do Cliente (Opcional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Erick Charles"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Observações (Opcional)
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Cliente pediu pelo WhatsApp, gosta de marmita média sem cebola..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-rose-500 resize-none"
                />
              </div>

              {addError && (
                <p className="rounded-lg bg-rose-500/10 p-2 text-xs font-bold text-rose-400">
                  {addError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-xs font-black text-white hover:brightness-110 disabled:opacity-50"
                >
                  {savingCustomer ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Código SQL da Tabela Supabase */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-[#161b22] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-amber-400" />
                <h3 className="font-black text-white text-base">Código SQL da Tabela customers</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              Abra seu <strong>Supabase</strong> no navegador, clique em <strong>SQL Editor</strong> no menu lateral esquerdo, cole o código abaixo e clique em <strong>Run</strong>. Leva menos de 30 segundos:
            </p>

            <div className="relative mt-3 rounded-2xl bg-black/70 p-4 border border-slate-800">
              <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
                {SQL_MIGRATION_CODE}
              </pre>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCopySql}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copiar Comando SQL</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowSqlModal(false)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
