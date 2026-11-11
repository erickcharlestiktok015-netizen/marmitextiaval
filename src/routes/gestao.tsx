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
  Menu,
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
  } | null;
  recentOrders?: RecentOrder[];
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

type NavTab = 'leads' | 'compradores' | 'recorrentes' | 'vips' | 'primeira' | 'hoje' | 'todos' | 'metricas';

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
  const diffDays = Math.floor(diffDaysCalc(diffMs));
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const diffDaysCalc = (ms: number) => ms / (1000 * 60 * 60 * 24);

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

const SQL_MIGRATION_CODE = `-- Tabela de clientes e leads cadastrados no site
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

-- Permitir acesso às consultas da aplicação
alter table public.customers enable row level security;
create policy "Acesso irrestrito pelo service role" on public.customers
  for all to service_role using (true) with check (true);
create policy "Leitura publica customers" on public.customers
  for select using (true);
create policy "Gravacao publica customers" on public.customers
  for insert with check (true);
create policy "Atualizacao publica customers" on public.customers
  for update using (true);
`;

export function GestaoPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hasCustomersTable, setHasCustomersTable] = useState(true);

  // Navegação da Sidebar
  const [activeTab, setActiveTab] = useState<NavTab>('leads');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Busca e Ordenação
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recente' | 'pedidos' | 'valor' | 'nome'>('recente');

  // Modais e utilitários
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Busca dados de clientes
  const fetchCustomers = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/customers');
      if (res.status === 401) {
        setAuthenticated(false);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }
      if (!res.ok) throw new Error('Falha ao carregar dados');

      const data = await res.json();
      setCustomers(data.customers || []);
      setSummary(data.summary || null);
      setHasCustomersTable(data.hasCustomersTable !== false);
      setAuthenticated(true);
    } catch (err) {
      console.warn('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Polling automático em tempo real (4 segundos)
  useEffect(() => {
    fetchCustomers();
    const timer = setInterval(() => {
      fetchCustomers(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchCustomers]);

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthenticated(true);
        fetchCustomers();
      } else {
        setLoginError('Senha incorreta.');
      }
    } catch {
      setLoginError('Erro ao tentar conectar.');
    }
  };

  // Logout
  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setAuthenticated(false);
    setPassword('');
  };

  // Copiar SQL
  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_CODE);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Cadastrar manual
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const raw = newPhone.replace(/\D/g, '');
    if (raw.length < 10) {
      setAddError('Informe um telefone válido com DDD (mínimo 10 dígitos).');
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: raw,
          name: newName,
          notes: newNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível cadastrar');
      }
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      setNewNotes('');
      fetchCustomers();
    } catch (err: any) {
      setAddError(err.message || 'Erro ao salvar contato.');
    } finally {
      setAddSaving(false);
    }
  };

  // Contadores calculados para as abas da sidebar
  const tabCounts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const leads = customers.filter((c) => c.status === 'lead' || !c.hasPurchased).length;
    const compradores = customers.filter((c) => c.hasPurchased).length;
    const vips = customers.filter((c) => c.status === 'vip').length;
    const recorrentes = customers.filter((c) => c.status === 'recorrente').length;
    const primeira = customers.filter((c) => c.status === 'primeira_compra').length;
    const hoje = customers.filter((c) => {
      const lastSeen = new Date(c.lastSeenAt).getTime();
      const firstSeen = new Date(c.firstSeenAt).getTime();
      return lastSeen >= todayStart || firstSeen >= todayStart;
    }).length;

    return {
      todos: customers.length,
      leads,
      compradores,
      vips,
      recorrentes,
      primeira,
      hoje,
    };
  }, [customers]);

  // Lista filtrada e ordenada de acordo com a aba selecionada na sidebar
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const list = customers.filter((c) => {
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.rawPhone.includes(term);

      if (!matchesSearch) return false;

      if (activeTab === 'leads') return c.status === 'lead' || !c.hasPurchased;
      if (activeTab === 'compradores') return c.hasPurchased;
      if (activeTab === 'vips') return c.status === 'vip';
      if (activeTab === 'recorrentes') return c.status === 'recorrente';
      if (activeTab === 'primeira') return c.status === 'primeira_compra';
      if (activeTab === 'hoje') {
        const lastSeen = new Date(c.lastSeenAt).getTime();
        const firstSeen = new Date(c.firstSeenAt).getTime();
        return lastSeen >= todayStart || firstSeen >= todayStart;
      }
      return true; // 'todos' ou 'metricas'
    });

    list.sort((a, b) => {
      if (sortBy === 'pedidos') return b.totalOrders - a.totalOrders;
      if (sortBy === 'valor') return b.totalSpent - a.totalSpent;
      if (sortBy === 'nome') return a.name.localeCompare(b.name);
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });

    return list;
  }, [customers, searchTerm, activeTab, sortBy]);

  // Tela de Login
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
              Painel exclusivo de contatos, clientes e leads em tempo real
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
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            {loginError && <p className="text-xs font-semibold text-rose-400">{loginError}</p>}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-sm font-black text-white shadow-lg shadow-rose-950/40 transition hover:brightness-110 active:scale-[0.99]"
            >
              <span>Acessar Painel de Gestão</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Carregamento inicial
  if (loading && authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-rose-500" />
          <p className="text-sm font-bold">Carregando painel de gestão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0b0e14] text-slate-100">
      {/* SIDEBAR LATERAL ESQUERDA (DESKTOP & TABLET) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-[#0f141d] transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'
        }`}
      >
        {/* Topo da Sidebar */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white font-black shadow-md shadow-rose-950/50">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Tia Val</span>
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-rose-300">
                  Gestão
                </span>
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>Ao vivo · 4s</span>
              </div>
            </div>
          </div>
          {/* Botão fechar sidebar no mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Botão de Adicionar Contato em Destaque */}
        <div className="p-3 pb-1">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 py-2.5 text-xs font-black text-white shadow-md shadow-rose-950/40 transition hover:brightness-110 active:scale-[0.99]"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Novo Cliente / Lead</span>
          </button>
        </div>

        {/* Menu de Abas da Sidebar */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Categorias de Contato
          </div>

          {/* 1. Leads (Só se cadastrou) - Destaque máximo! */}
          <button
            onClick={() => {
              setActiveTab('leads');
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              activeTab === 'leads'
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="block font-black">Só se cadastrou</span>
                <span className="block text-[10px] font-normal text-rose-300/80">Leads sem compra</span>
              </div>
            </div>
            <span className="rounded-full bg-rose-500/30 px-2 py-0.5 text-[11px] font-black text-rose-200">
              {tabCounts.leads}
            </span>
          </button>

          {/* 2. Compradores */}
          <button
            onClick={() => {
              setActiveTab('compradores');
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              activeTab === 'compradores'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <ShoppingBag className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="block font-black">Já compraram</span>
                <span className="block text-[10px] font-normal text-slate-400">Clientes com pedidos</span>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-black text-emerald-300">
              {tabCounts.compradores}
            </span>
          </button>

          {/* 3. Recorrentes */}
          <button
            onClick={() => {
              setActiveTab('recorrentes');
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              activeTab === 'recorrentes'
                ? 'bg-blue-500/20 text-blue-200 border border-blue-500/40 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <Repeat className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="block font-black">Recorrentes</span>
                <span className="block text-[10px] font-normal text-slate-400">2 a 4 pedidos</span>
              </div>
            </div>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-black text-blue-300">
              {tabCounts.recorrentes}
            </span>
          </button>

          {/* 4. VIPs */}
          <button
            onClick={() => {
              setActiveTab('vips');
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              activeTab === 'vips'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Crown className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="block font-black">Clientes VIPs</span>
                <span className="block text-[10px] font-normal text-slate-400">5+ marmitas</span>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-black text-amber-300">
              {tabCounts.vips}
            </span>
          </button>

          {/* 5. 1º Pedido */}
          <button
            onClick={() => {
              setActiveTab('primeira');
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              activeTab === 'primeira'
                ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
                <UserCheck className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="block font-black">1º Pedido</span>
                <span className="block text-[10px] font-normal text-slate-400">Novos compradores</span>
              </div>
            </div>
            <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[11px] font-black text-teal-300">
              {tabCounts.primeira}
            </span>
          </button>

          {/* 6. Ativos Hoje */}
          <button
            onClick={() => {
              setActiveTab('hoje');
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              activeTab === 'hoje'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="block font-black">Ativos Hoje</span>
                <span className="block text-[10px] font-normal text-slate-400">Acessaram hoje</span>
              </div>
            </div>
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[11px] font-black text-cyan-300">
              +{tabCounts.hoje}
            </span>
          </button>

          {/* 7. Todos */}
          <button
            onClick={() => {
              setActiveTab('todos');
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              activeTab === 'todos'
                ? 'bg-slate-700/60 text-white border border-slate-600 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                <Users className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="block font-black">Todos os Contatos</span>
                <span className="block text-[10px] font-normal text-slate-400">Base completa</span>
              </div>
            </div>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-black text-slate-300">
              {tabCounts.todos}
            </span>
          </button>

          {/* Divisor */}
          <div className="pt-2">
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Painel Financeiro
            </div>

            {/* 8. Métricas */}
            <button
              onClick={() => {
                setActiveTab('metricas');
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                activeTab === 'metricas'
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <div className="text-left">
                  <span className="block font-black">Resumo & Métricas</span>
                  <span className="block text-[10px] font-normal text-slate-400">Faturamento e médias</span>
                </div>
              </div>
              <DollarSign className="h-4 w-4 text-purple-400" />
            </button>
          </div>
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="shrink-0 border-t border-slate-800 p-3 space-y-1.5 bg-[#0b0e14]">
          <Link
            to="/admin"
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-amber-400" />
              <span>Painel da Cozinha</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
          </Link>

          <Link
            to="/"
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-emerald-400" />
              <span>Ver Cardápio do Site</span>
            </div>
            <span className="text-[10px] text-slate-500">Cliente</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800/80 py-2 text-xs font-bold text-slate-400 transition hover:bg-rose-950/40 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* OVERLAY MOBILE DA SIDEBAR */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ÁREA PRINCIPAL DA DIREITA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Superior da Área Principal */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-[#0f141d]/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            {/* Botão de abrir menu no mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Título dinâmico da aba ativa */}
            <div>
              <h1 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                {activeTab === 'leads' && (
                  <>
                    <Sparkles className="h-5 w-5 text-rose-400" />
                    <span>Só se cadastraram (Leads)</span>
                  </>
                )}
                {activeTab === 'compradores' && (
                  <>
                    <ShoppingBag className="h-5 w-5 text-emerald-400" />
                    <span>Clientes Compradores</span>
                  </>
                )}
                {activeTab === 'recorrentes' && (
                  <>
                    <Repeat className="h-5 w-5 text-blue-400" />
                    <span>Clientes Recorrentes (2 a 4 pedidos)</span>
                  </>
                )}
                {activeTab === 'vips' && (
                  <>
                    <Crown className="h-5 w-5 text-amber-400" />
                    <span>Clientes VIPs (5+ pedidos)</span>
                  </>
                )}
                {activeTab === 'primeira' && (
                  <>
                    <UserCheck className="h-5 w-5 text-teal-400" />
                    <span>Primeira Compra</span>
                  </>
                )}
                {activeTab === 'hoje' && (
                  <>
                    <Clock className="h-5 w-5 text-cyan-400" />
                    <span>Contatos Ativos Hoje</span>
                  </>
                )}
                {activeTab === 'todos' && (
                  <>
                    <Users className="h-5 w-5 text-slate-300" />
                    <span>Todos os Contatos Cadastrados</span>
                  </>
                )}
                {activeTab === 'metricas' && (
                  <>
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                    <span>Resumo Geral & Métricas</span>
                  </>
                )}
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {activeTab === 'leads' &&
                  'Pessoas que digitaram o telefone no site mas ainda não fecharam marmita. Chame no WhatsApp com uma oferta rápida!'}
                {activeTab === 'compradores' &&
                  'Base completa de quem já pediu na Tia Val. Acompanhe frequência e ticket de compra.'}
                {activeTab === 'recorrentes' &&
                  'Clientes que já pediram de 2 a 4 vezes e gostam do tempero.'}
                {activeTab === 'vips' &&
                  'Seus clientes mais fiéis de marmita (5 ou mais pedidos). Merecem atenção especial!'}
                {activeTab === 'primeira' &&
                  'Compraram pela 1ª vez recentemente. Ótimo momento para pedir avaliação e fidelizar.'}
                {activeTab === 'hoje' &&
                  'Pessoas que interagiram com o site ou fizeram pedidos hoje.'}
                {activeTab === 'todos' &&
                  'Visão unificada de toda a base de números cadastrados no sistema.'}
                {activeTab === 'metricas' &&
                  'Indicadores financeiros, volume de vendas e taxa de conversão.'}
              </p>
            </div>
          </div>

          {/* Ações do Header */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition hover:brightness-110 active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">+ Novo</span>
            </button>

            <button
              onClick={() => fetchCustomers()}
              disabled={isRefreshing}
              title="Atualizar dados agora"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          </div>
        </header>

        {/* Conteúdo com Scroll */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* BANNER DO SUPABASE CASO A TABELA NÃO EXISTA */}
          {!hasCustomersTable && (
            <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 sm:p-5 text-amber-200 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-amber-100 text-sm sm:text-base">
                      Crie a tabela customers no Supabase para listar quem só se cadastra
                    </h3>
                    <p className="mt-0.5 text-xs text-amber-300/90 leading-relaxed max-w-2xl">
                      Os compradores que já pediram marmita aparecem normalmente. Mas para salvar e listar as pessoas que apenas colocam o telefone no site sem comprar (leads), execute a query SQL no editor do seu Supabase.
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-300 active:scale-95"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-950" />
                        <span>SQL Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copiar SQL</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowSqlModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-black/40 px-3.5 py-2.5 text-xs font-bold text-amber-200 hover:bg-black/60"
                  >
                    <FileCode2 className="h-4 w-4" />
                    <span>Ver Código</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISÃO ESPECÍFICA: RESUMO & MÉTRICAS */}
          {activeTab === 'metricas' && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-[#141922] p-5">
                  <p className="text-xs font-bold text-slate-400">Total de Cadastros</p>
                  <p className="mt-2 text-3xl font-black text-white">{summary.totalCustomers}</p>
                  <p className="mt-1 text-xs text-slate-500">Base total identificada</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <p className="text-xs font-bold text-emerald-400">Já Compraram</p>
                  <p className="mt-2 text-3xl font-black text-emerald-300">{summary.totalPurchasers}</p>
                  <p className="mt-1 text-xs text-emerald-400/70">
                    {summary.totalCustomers > 0
                      ? `${Math.round((summary.totalPurchasers / summary.totalCustomers) * 100)}% de conversão`
                      : '0%'}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
                  <p className="text-xs font-bold text-rose-400">Só se Cadastraram (Leads)</p>
                  <p className="mt-2 text-3xl font-black text-rose-300">{summary.totalLeads}</p>
                  <p className="mt-1 text-xs text-rose-400/70">Oportunidade para WhatsApp</p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <p className="text-xs font-bold text-amber-400">Clientes VIPs</p>
                  <p className="mt-2 text-3xl font-black text-amber-300">{tabCounts.vips}</p>
                  <p className="mt-1 text-xs text-amber-400/70">5 ou mais marmitas pedidas</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#141922] p-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span>Desempenho Financeiro Acumulado</span>
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <p className="text-xs text-slate-400 font-medium">Faturamento Total dos Pedidos</p>
                    <p className="mt-1 text-2xl font-black text-emerald-400">{formatMoney(summary.totalRevenue)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <p className="text-xs text-slate-400 font-medium">Ticket Médio por Comprador</p>
                    <p className="mt-1 text-2xl font-black text-blue-400">
                      {summary.totalPurchasers > 0
                        ? formatMoney(summary.totalRevenue / summary.totalPurchasers)
                        : 'R$ 0,00'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <p className="text-xs text-slate-400 font-medium">Cadastros / Pedidos Hoje</p>
                    <p className="mt-1 text-2xl font-black text-cyan-400">+{summary.todayActive}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISÃO DE LISTA DE CLIENTES / LEADS */}
          {activeTab !== 'metricas' && (
            <div className="space-y-4">
              {/* Barra de Filtro e Busca Rápida */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-800 bg-[#141922] p-3.5">
                {/* Input de Busca */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, DDD ou número..."
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900 pl-10 pr-10 py-2 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-rose-500"
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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-rose-500"
                  >
                    <option value="recente">Mais recente primeiro</option>
                    <option value="pedidos">Mais pedidos</option>
                    <option value="valor">Maior valor gasto (R$)</option>
                    <option value="nome">Nome (A - Z)</option>
                  </select>
                </div>
              </div>

              {/* Informação do grupo */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Mostrando <strong className="text-white">{filteredCustomers.length}</strong> contatos nesta aba
                </span>
                {searchTerm && (
                  <span>
                    Filtrado por: <strong className="text-rose-400">"{searchTerm}"</strong>
                  </span>
                )}
              </div>

              {/* Lista Vazia */}
              {filteredCustomers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-[#141922]/50 p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
                    <Users className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">Nenhum contato encontrado</h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                    {searchTerm
                      ? 'Nenhum resultado corresponde à sua busca. Tente buscar outro nome ou telefone.'
                      : activeTab === 'leads'
                      ? 'Ainda não há leads registrados sem compra. Assim que alguém digitar o telefone no site ou você cadastrar manualmente, aparecerá aqui.'
                      : 'Nenhum cliente nessa categoria no momento.'}
                  </p>
                  {activeTab === 'leads' && !hasCustomersTable && (
                    <button
                      onClick={() => setShowSqlModal(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Ver SQL para Ativar Leads</span>
                    </button>
                  )}
                </div>
              )}

              {/* Grid de Cards de Contatos */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCustomers.map((c) => {
                  const isLead = c.status === 'lead' || !c.hasPurchased;
                  const isExpanded = expandedPhone === c.phone;

                  return (
                    <div
                      key={c.phone}
                      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border transition hover:border-slate-700 ${
                        isLead
                          ? 'border-rose-500/30 bg-[#141822]'
                          : c.status === 'vip'
                          ? 'border-amber-500/30 bg-[#151720]'
                          : 'border-slate-800 bg-[#141922]'
                      }`}
                    >
                      {/* Topo do Card */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          {/* Avatar e Identificação */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-sm shadow-sm ${
                                isLead
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : c.status === 'vip'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : c.status === 'recorrente'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {c.name ? c.name.charAt(0).toUpperCase() : <Phone className="h-4 w-4" />}
                            </div>

                            <div className="min-w-0">
                              <h3 className="truncate font-black text-white text-sm">
                                {c.name || 'Cliente Sem Nome'}
                              </h3>
                              <p className="font-mono text-xs font-bold text-slate-300">
                                {formatPhone(c.phone)}
                              </p>
                            </div>
                          </div>

                          {/* Badge de Status */}
                          <div className="shrink-0">
                            {isLead && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-rose-300">
                                <Sparkles className="h-3 w-3" />
                                <span>Lead</span>
                              </span>
                            )}
                            {c.status === 'vip' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">
                                <Crown className="h-3 w-3" />
                                <span>VIP</span>
                              </span>
                            )}
                            {c.status === 'recorrente' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-300">
                                <Repeat className="h-3 w-3" />
                                <span>Recorrente</span>
                              </span>
                            )}
                            {c.status === 'primeira_compra' && !isLead && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                                <ShoppingBag className="h-3 w-3" />
                                <span>1º Pedido</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Estatísticas do Contato */}
                        <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl bg-slate-900/80 p-2.5 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">
                              Pedidos Feitos
                            </span>
                            <span className="font-black text-white">
                              {c.totalOrders > 0 ? `${c.totalOrders} marmitas` : 'Nenhum pedido'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">
                              Total Gasto
                            </span>
                            <span className="font-black text-emerald-400">
                              {c.totalSpent > 0 ? formatMoney(c.totalSpent) : 'R$ 0,00'}
                            </span>
                          </div>
                        </div>

                        {/* Tempo do Último Acesso */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span>Visto {timeAgo(c.lastSeenAt)}</span>
                          </span>
                          <span className="text-slate-500">
                            Cadastrado {new Date(c.firstSeenAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        {/* Último Pedido / Notas */}
                        {c.lastOrder && (
                          <div className="mt-2.5 rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
                            <div className="flex items-center justify-between font-bold text-slate-300">
                              <span>Último: #{c.lastOrder.code}</span>
                              <span className="text-emerald-400">{formatMoney(c.lastOrder.total)}</span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between text-slate-400 text-[10px]">
                              <span>Status: {c.lastOrder.orderStatus}</span>
                              <span>{formatFullDate(c.lastOrder.createdAt)}</span>
                            </div>
                          </div>
                        )}

                        {c.notes && (
                          <div className="mt-2 rounded-lg bg-slate-800/60 p-2 text-[11px] text-slate-300 italic">
                            "{c.notes}"
                          </div>
                        )}

                        {/* Histórico Expansível se houver pedidos */}
                        {c.recentOrders && c.recentOrders.length > 1 && (
                          <div className="mt-2.5">
                            <button
                              onClick={() => setExpandedPhone(isExpanded ? null : c.phone)}
                              className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white"
                            >
                              <span>Ver todos os {c.recentOrders.length} pedidos</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 space-y-1 rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-[11px]">
                                {c.recentOrders.map((ro) => (
                                  <div
                                    key={ro.code}
                                    className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0"
                                  >
                                    <span className="font-bold text-white">#{ro.code}</span>
                                    <span className="text-slate-400">{formatFullDate(ro.createdAt)}</span>
                                    <span className="font-bold text-emerald-400">{formatMoney(ro.total)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação do Card */}
                      <div className="border-t border-slate-800 bg-[#0f131a] p-3 flex items-center gap-2">
                        {/* WhatsApp com mensagem inteligente */}
                        <a
                          href={isLead ? whatsappLeadUrl(c.phone, c.name) : whatsappCustomerUrl(c.phone, c.name, c.status)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-950/40 transition active:scale-95"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span>Chamar no WhatsApp</span>
                        </a>

                        {/* Ligação telefônica direta */}
                        <a
                          href={`tel:${c.phone}`}
                          title="Ligar para o cliente"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-95"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CADASTRAR NOVO CLIENTE / LEAD */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#161b22] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-rose-500" />
                <span>Adicionar Novo Contato</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nome do Contato
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Telefone com DDD <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(31) 99999-9999"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Observações / Como Conheceu
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Lead do Instagram, pediu para mandar cardápio..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-rose-500"
                />
              </div>

              {addError && <p className="text-xs font-bold text-rose-400">{addError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2 text-xs font-black text-white hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {addSaving ? 'Salvando...' : 'Salvar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CÓDIGO SQL DA MIGRAÇÃO DO SUPABASE */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-[#161b22] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-black text-white">SQL para Criar a Tabela no Supabase</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Abra o <strong>SQL Editor</strong> no painel do seu Supabase, cole o código abaixo e clique em <strong>Run</strong>. Isso cria a tabela <code className="text-amber-300">customers</code> necessária para gravar e listar todas as pessoas que se cadastram no site sem comprar.
              </p>

              <div className="mt-3 relative rounded-xl border border-slate-800 bg-black/60 p-4 font-mono text-xs text-amber-200 overflow-x-auto max-h-72">
                <pre>{SQL_MIGRATION_CODE}</pre>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 active:scale-95"
                >
                  {copiedSql ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copiado com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar Código SQL</span>
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
        </div>
      )}
    </div>
  );
}
