import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Bike,
  Bell,
  CheckCircle2,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Home,
  ListOrdered,
  LogOut,
  MapPin,
  Map as MapIcon,
  Navigation,
  PackageCheck,
  Phone,
  MessageCircle,
  RefreshCw,
  Route as RouteIcon,
  Wallet,
  Wifi,
  WifiOff,
  AlertTriangle,
  X,
  SlidersVertical,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { dishForDateKey, nextPendingPlanDate, parsePlanNotes, spDateKey } from '@/lib/weekly-plan';
import { DeliveryMap, type GeoPoint } from '@/components/delivery-map';

export type Delivery = {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  address: unknown;
  order_status: string;
  payment_method: string;
  payment_status: string;
  total: number;
  delivery_fee?: number;
  change_for?: number | null;
  notes?: string | null;
  estimated_delivery_at: string | null;
  courier_status: string;
  created_at: string;
  confirmation_code: string | null;
  items: Array<{ meal_name: string; size_label: string; quantity: number; notes?: string }>;
};
export type Geo = GeoPoint;
export type Tab = 'inicio' | 'pedidos' | 'mapa' | 'ganhos';
export type Filter = 'todos' | 'preparo' | 'prontos';
export type CompletedDelivery = {
  id: string;
  code: string;
  fee: number;
  at: string;
  customer_name?: string;
  address?: unknown;
};

// Pedido demonstrativo para manter a tela 100% fiel à foto quando o banco não tiver pedidos
const DEMO_DELIVERY: Delivery = {
  id: 'demo-1003',
  code: '1003',
  customer_name: 'Cliente Tia Val',
  customer_phone: '(85) 99999-0000',
  address: {
    street: 'Rua Berilo',
    number: '200',
    bairro: 'Primeiro de Maio',
    cidade: 'Fortaleza',
    state: 'CE',
    latitude: -3.7380,
    longitude: -38.5350,
  },
  order_status: 'pronto_entrega',
  payment_method: 'entrega-pix',
  payment_status: 'pendente',
  total: 28.0,
  delivery_fee: 5.0,
  change_for: null,
  notes: 'Tocar o interfone 201 ou chamar no portão',
  estimated_delivery_at: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
  courier_status: 'pendente',
  created_at: new Date().toISOString(),
  confirmation_code: '1234',
  items: [
    {
      meal_name: 'Marmita Tradicional M (Arroz, Feijão Tropeiro, Carne de Sol, Macaxeira)',
      size_label: 'M',
      quantity: 1,
      notes: 'Caprichar no vinagrete',
    },
  ],
};

const coords = (address: unknown): Geo | null => {
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

const distance = (a: Geo, b: Geo) => {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
};

const addressText = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'Endereço não informado';
  const a = value as Record<string, unknown>;
  return (
    [
      a['street'] ?? a['rua'],
      a['number'] ?? a['numero'],
      a['complement'] ?? a['complemento'],
      a['reference'] ?? a['referencia'],
      a['bairro'],
      a['cidade'],
      a['state'] ?? a['estado'] ?? a['uf'],
      a['cep'],
    ]
      .filter(Boolean)
      .join(', ') || 'Endereço não informado'
  );
};

const addressStreetAndNumber = (value: unknown) => {
  if (!value || typeof value !== 'object') return 'Endereço de entrega';
  const a = value as Record<string, unknown>;
  const street = a['street'] ?? a['rua'];
  const num = a['number'] ?? a['numero'];
  if (street && num) return `${street}, ${num}`;
  if (street) return String(street);
  return 'Endereço de entrega';
};

const addressNeighborhoodOnly = (value: unknown) => {
  if (!value || typeof value !== 'object') return '';
  const a = value as Record<string, unknown>;
  return String(a['bairro'] ?? a['neighborhood'] ?? a['district'] ?? '').trim();
};

const etaText = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : 'A combinar';
const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paymentLabel = (m: string) =>
  m === 'online'
    ? 'Pago online'
    : m === 'entrega-pix'
    ? 'Pix na entrega'
    : m === 'entrega-cartao'
    ? 'Cartão na entrega'
    : m === 'entrega-dinheiro'
    ? 'Dinheiro na entrega'
    : m;
const isPrep = (o: Delivery) => ['novo', 'confirmado', 'preparando'].includes(o.order_status);
const isRouteable = (o: Delivery) => ['pronto_entrega', 'saiu_entrega'].includes(o.order_status);
const COMPLETED_KEY = 'tia-val-courier-completed';

const statusInfo = (o: Delivery) => {
  if (o.courier_status === 'cheguei') return { label: 'Chegou ao cliente', cls: 'bg-amber-400/20 text-amber-300 border border-amber-400/30' };
  if (o.order_status === 'saiu_entrega') return { label: 'Em rota', cls: 'bg-sky-400/20 text-sky-300 border border-sky-400/30' };
  if (o.order_status === 'pronto_entrega') return { label: 'Nova entrega', cls: 'bg-red-600 text-white shadow-md shadow-red-950/40' };
  if (o.order_status === 'preparando') return { label: 'Em preparo', cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' };
  if (o.order_status === 'confirmado') return { label: 'Confirmado', cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' };
  return { label: 'Pedido novo', cls: 'bg-slate-700/40 text-slate-300 border border-slate-600/30' };
};

export const Route = createFileRoute('/motoboy/entregas')({
  head: () => ({
    meta: [
      { title: 'Painel do Motoboy | Tia Val Entregas' },
      { name: 'theme-color', content: '#070b12' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest-motoboy.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/motoboy-180.png' },
      { rel: 'icon', type: 'image/png', href: '/icons/motoboy-192.png' },
    ],
  }),
  component: CourierDeliveries,
});

function CourierDeliveries() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [orders, setOrders] = useState<Delivery[]>([]);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [serverCompleted, setServerCompleted] = useState<CompletedDelivery[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [readyAlert, setReadyAlert] = useState('');
  const [location, setLocation] = useState<Geo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmation, setConfirmation] = useState<Record<string, string>>({});
  const [geoMessage, setGeoMessage] = useState('');
  const [geoDenied, setGeoDenied] = useState(false);
  const [geoSpecificHelp, setGeoSpecificHelp] = useState('');
  const [updated, setUpdated] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [presenceError, setPresenceError] = useState('');
  const [roadOrderIds, setRoadOrderIds] = useState<string[]>([]);
  const [demoState, setDemoState] = useState<{ status: string; courierStatus: string }>({
    status: 'pronto_entrega',
    courierStatus: 'pendente',
  });
  const [routeCalculation, setRouteCalculation] = useState('');
  const [tab, setTab] = useState<Tab>('mapa'); // Abre direto no Mapa igual à foto
  const [filter, setFilter] = useState<Filter>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeActiveFor, setRouteActiveFor] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [success, setSuccess] = useState<CompletedDelivery | null>(null);
  const [completed, setCompleted] = useState<CompletedDelivery[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);
  const [liveRouteInfo, setLiveRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const loadingRef = useRef(false);
  const previousReadyIds = useRef<Set<string> | null>(null);
  const routeDataRef = useRef({ orders, location });
  routeDataRef.current = { orders, location };

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch('/api/courier/orders', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = (await response.json().catch(() => ({}))) as {
        orders?: Delivery[];
        dailyEarnings?: number;
        completedToday?: Array<{
          id: string;
          code: string;
          customer_name: string;
          address: unknown;
          delivery_fee: number;
          completed_at: string;
        }>;
        error?: string;
      };
      if (response.status === 401) {
        window.location.assign('/motoboy');
        return;
      }
      if (!response.ok) {
        setError(data.error ?? 'Erro ao carregar entregas.');
        return;
      }
      setError('');
      setOrders(data.orders ?? []);
      if (typeof data.dailyEarnings === 'number') setDailyEarnings(data.dailyEarnings);
      if (Array.isArray(data.completedToday)) {
        setServerCompleted(
          data.completedToday.map((c) => ({
            id: c.id,
            code: c.code,
            customer_name: c.customer_name,
            address: c.address,
            fee: c.delivery_fee,
            at: c.completed_at,
          })),
        );
      }
      setUpdated(new Date().toLocaleTimeString('pt-BR'));
      setLoaded(true);
    } catch {
      setError('Falha de conexão com o servidor.');
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const sendLocation = async (point: Geo) => {
    try {
      await fetch('/api/courier/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(point),
      });
    } catch {
      // offline silent
    }
  };

  const handleGeoError = (err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setGeoDenied(true);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isIOS) {
        setGeoSpecificHelp('No iPhone: Ajustes > Safari (ou navegador) > Localização > Permitir.');
      } else if (isAndroid) {
        setGeoSpecificHelp('No Android: Toque no cadeado ao lado do site > Permissões > Localização > Permitir.');
      }
      setGeoMessage('Permissão de GPS negada. Toque para tentar novamente.');
    } else {
      setGeoMessage('Aguardando sinal estável do GPS…');
    }
  };

  const getLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage('Seu dispositivo não suporta GPS.');
      return;
    }
    setGeoMessage('Buscando sinal GPS com alta precisão…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(point);
        setGeoDenied(false);
        setGeoSpecificHelp('');
        setGeoMessage('');
        void sendLocation(point);
      },
      handleGeoError,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  };

  // Watch GPS continuamente com alta precisão
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(point);
        setGeoDenied(false);
        setGeoSpecificHelp('');
        setGeoMessage('');
        void sendLocation(point);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoDenied(true);
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 8000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 12000);
    return () => clearInterval(interval);
  }, [load]);

  const togglePresence = async (forceOnline?: boolean) => {
    setPresenceBusy(true);
    setPresenceError('');
    setShowStatusMenu(false);
    const next = typeof forceOnline === 'boolean' ? forceOnline : !isOnline;
    try {
      const res = await fetch('/api/courier/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_online: next }),
      });
      if (res.ok) {
        setIsOnline(next);
        if (next) getLocation();
      } else {
        setPresenceError('Falha ao atualizar status.');
      }
    } catch {
      setIsOnline(next); // Otimista se sem internet
    } finally {
      setPresenceBusy(false);
    }
  };

  // Pedido ativo selecionado ou primeiro disponível
  const orderedOrders = useMemo(() => {
    if (!roadOrderIds.length) return orders;
    const rank = new Map(roadOrderIds.map((id, index) => [id, index]));
    return [...orders].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [orders, roadOrderIds]);
  const hasRealOrders = orderedOrders.length > 0;
  // Se não houver pedidos reais no banco, mantemos DEMO_DELIVERY fixo para a barrinha
  // nunca sumir da tela do motoboy (igual à referência enviada).
  const activeDelivery: Delivery = useMemo(() => {
    if (!hasRealOrders) {
      return {
        ...DEMO_DELIVERY,
        order_status: demoState.status,
        courier_status: demoState.courierStatus,
      };
    }
    if (selectedId) {
      const found = orderedOrders.find((o) => o.id === selectedId);
      if (found) return found;
    }
    return orderedOrders.find((o) => isRouteable(o)) || orderedOrders[0] || DEMO_DELIVERY;
  }, [hasRealOrders, orderedOrders, selectedId, demoState]);

  const currentIndex = activeDelivery ? orderedOrders.findIndex((o) => o.id === activeDelivery.id) : -1;
  const handleNextDelivery = () => {
    if (orderedOrders.length <= 1) return;
    const nextIdx = (currentIndex + 1) % orderedOrders.length;
    setSelectedId(orderedOrders[nextIdx].id);
  };
  const handlePrevDelivery = () => {
    if (orderedOrders.length <= 1) return;
    const prevIdx = (currentIndex - 1 + orderedOrders.length) % orderedOrders.length;
    setSelectedId(orderedOrders[prevIdx].id);
  };

  const handleViewRoute = (order: Delivery) => {
    getLocation();
    setSelectedId(order.id);
    setRouteActiveFor(order.id);
    setLiveRouteInfo(null);
    setTab('inicio');
  };

  // Botão "Ajustar rotas mais perto (com GPS)" que reordena pedidos pela distância real do motoboy
  const adjustOrder = () => {
    if (!location) {
      setRouteCalculation('Ative o GPS para ordenar pela distância real.');
      getLocation();
      return;
    }
    if (orders.length === 0) {
      setRouteCalculation('Nenhuma entrega na fila para ajustar.');
      setTimeout(() => setRouteCalculation(''), 2500);
      return;
    }
    const sortable = [...orderedOrders];
    sortable.sort((a, b) => {
      const ca = coords(a.address);
      const cb = coords(b.address);
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;
      return distance(location, ca) - distance(location, cb);
    });
    setRoadOrderIds(sortable.map((o) => o.id));
    if (sortable[0]) {
      setSelectedId(sortable[0].id);
      if (routeActiveFor) setRouteActiveFor(sortable[0].id);
    }
    setRouteCalculation('⚡ Rotas reordenadas pela proximidade do seu GPS!');
    setTimeout(() => setRouteCalculation(''), 4500);
  };

  const action = async (order: Delivery, next: 'start' | 'arrive' | 'complete') => {
    setBusy(order.id);
    // Suporte para o pedido teste/demo nunca travar ou dar erro de rede na interface
    if (order.id === DEMO_DELIVERY.id) {
      setTimeout(() => {
        if (next === 'start') {
          setDemoState({ status: 'saiu_entrega', courierStatus: 'saiu_entrega' });
        } else if (next === 'arrive') {
          setDemoState({ status: 'saiu_entrega', courierStatus: 'cheguei' });
        } else if (next === 'complete') {
          setSuccess({ id: order.id, code: order.code, fee: 5.0, at: new Date().toISOString() });
          setDemoState({ status: 'concluido', courierStatus: 'entregue' });
        }
        setBusy('');
      }, 350);
      return;
    }
    try {
      const code = confirmation[order.id] || '';
      const apiAction = next === 'start' ? 'start' : next === 'arrive' ? 'arrived' : 'delivered';
      const res = await fetch('/api/courier/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, action: apiAction, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha ao processar ação.');
        return;
      }
      if (next === 'complete') {
        setSuccess({ id: order.id, code: order.code, fee: order.delivery_fee || 5.0, at: new Date().toISOString() });
      }
      await load();
    } catch {
      setError('Erro de conexão ao salvar status.');
    } finally {
      setBusy('');
    }
  };

  const waze = (order: Delivery) => {
    const c = coords(order.address);
    if (c) {
      window.open(`https://waze.com/ul?ll=${c.latitude},${c.longitude}&navigate=yes`, '_blank', 'noopener,noreferrer');
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(addressText(order.address))}&navigate=yes`, '_blank', 'noopener,noreferrer');
    }
  };

  const googleMaps = (order: Delivery) => {
    const c = coords(order.address);
    if (c) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(order.address))}`, '_blank', 'noopener,noreferrer');
    }
  };

  const whatsapp = (order: Delivery, customText?: string) => {
    if (!order.customer_phone) return;
    const phone = order.customer_phone.replace(/\D/g, '');
    const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const msg =
      customText ||
      `Olá ${order.customer_name}! Sou o motoboy da Marmitex da Tia Val e já estou com seu pedido #${order.code}. Chego em instantes!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const kmTo = (o: Delivery) => {
    if (!location) return null;
    const c = coords(o.address);
    if (!c) return null;
    const k = distance(location, c);
    return `${k.toFixed(1).replace('.', ',')} km`;
  };

  const neighborhoodOf = (order: Delivery | null) => {
    if (!order) return '';
    return addressNeighborhoodOnly(order.address) || 'Fortaleza';
  };

  const logout = async () => {
    await fetch('/api/courier/logout', { method: 'POST' }).catch(() => {});
    window.location.assign('/motoboy');
  };

  const detailsOrder = detailsId
    ? orders.find((o) => o.id === detailsId) || (detailsId === DEMO_DELIVERY.id ? DEMO_DELIVERY : null)
    : null;

  return (
    <main className="fixed inset-0 flex flex-col h-[100dvh] w-screen overflow-hidden bg-[#070b12] text-slate-100 select-none">
      {/* 1. TOP HEADER (Estilo iFood Dark com Status Online e Notificações) */}
      <header className="relative z-30 shrink-0 flex items-center justify-between border-b border-white/10 bg-[#080d17]/95 px-4 py-2.5 backdrop-blur-md">
        <div className="flex flex-col">
          <span className="text-[13px] font-extrabold tracking-wide text-white drop-shadow-sm">
            Marmitex da Tia Val
          </span>
          <div className="relative mt-0.5">
            <button
              type="button"
              onClick={() => setShowStatusMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-500/20 active:scale-95"
            >
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
              <ChevronDown size={12} className="text-emerald-400/80" />
            </button>

            {/* Menu Dropdown de Status */}
            {showStatusMenu && (
              <div className="absolute left-0 top-full mt-1.5 z-50 w-36 rounded-xl border border-white/15 bg-[#0e1626] p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => void togglePresence(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-emerald-400 hover:bg-white/5"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Ficar Online</span>
                </button>
                <button
                  type="button"
                  onClick={() => void togglePresence(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-400 hover:bg-white/5"
                >
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  <span>Ficar Offline</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ações da Direita */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void load()}
            title="Atualizar dados"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 active:scale-95"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={() => setTab('pedidos')}
            title="Ver pedidos"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 active:scale-95"
          >
            <Bell size={16} />
            {orders.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-[#080d17]">
                {orders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={logout}
            title="Sair do painel"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-red-500/20 hover:text-red-300 active:scale-95"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Alerta de permissão de GPS no Android / iOS se necessário */}
      {geoDenied && (
        <div className="relative z-20 shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-center text-xs font-bold text-amber-300">
          <span>⚠️ {geoSpecificHelp || 'GPS desativado. Ative a localização para traçar rotas.'}</span>
          <button
            type="button"
            onClick={getLocation}
            className="ml-2 underline font-black text-white hover:text-amber-200"
          >
            Ativar GPS
          </button>
        </div>
      )}

      {/* Notificação flutuante de reordenação */}
      {routeCalculation && (
        <div className="absolute top-14 left-1/2 z-40 -translate-x-1/2 rounded-full border border-sky-400/40 bg-sky-950/90 px-4 py-1.5 text-xs font-black text-sky-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          {routeCalculation}
        </div>
      )}

      {/* 2. CONTEÚDO CENTRAL POR ABA */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* ABA MAPA / INÍCIO (VISÃO IDÊNTICA À FOTO DE REFERÊNCIA) */}
        {(tab === 'mapa' || tab === 'inicio') && (
          <div className="relative h-full w-full overflow-hidden">
            {/* O MAPA OCUPA 100% DA ÁREA CENTRAL (COM TILES ESRI SEM ERRO DE API KEY) */}
            <DeliveryMap
              courierLocation={location}
              destinationLocation={activeDelivery ? coords(activeDelivery.address) : null}
              destinationNeighborhood={activeDelivery ? neighborhoodOf(activeDelivery) : ''}
              destinationTitle={activeDelivery ? addressText(activeDelivery.address) : ''}
              className="absolute inset-0 h-full w-full"
              showRoute={Boolean(activeDelivery && routeActiveFor === activeDelivery.id)}
              showWazeButton={false}
              showLocationPill={true}
              onRouteCalculated={(info) => setLiveRouteInfo(info)}
              onRequestLocation={getLocation}
            />

            {/* BARRINHA INFERIOR PUXÁVEL (BOTTOM SHEET PIQUE IFOOD IGUAL À FOTO) */}
            <div
              className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${
                bottomSheetExpanded ? 'h-[65%]' : 'h-auto'
              }`}
            >
              <div className="flex h-full flex-col overflow-hidden rounded-t-[28px] border-t border-white/15 bg-[#0e131d]/95 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                {/* Alça de puxar (Drag Handle) */}
                <button
                  type="button"
                  onClick={(event) => {
                    if ((event.currentTarget as HTMLButtonElement).dataset.swiped === 'true') {
                      (event.currentTarget as HTMLButtonElement).dataset.swiped = 'false';
                      return;
                    }
                    setBottomSheetExpanded((v) => !v);
                  }}
                  onTouchStart={(event) => {
                    const startY = event.touches[0]?.clientY ?? 0;
                    (event.currentTarget as HTMLButtonElement).dataset.startY = String(startY);
                  }}
                  onTouchEnd={(event) => {
                    const startY = Number((event.currentTarget as HTMLButtonElement).dataset.startY || 0);
                    const endY = event.changedTouches[0]?.clientY ?? startY;
                    const delta = startY - endY;
                    if (delta > 25) {
                      setBottomSheetExpanded(true);
                      (event.currentTarget as HTMLButtonElement).dataset.swiped = 'true';
                    }
                    if (delta < -25) {
                      setBottomSheetExpanded(false);
                      (event.currentTarget as HTMLButtonElement).dataset.swiped = 'true';
                    }
                  }}
                  className="group flex w-full flex-col items-center pt-2 pb-1 cursor-pointer touch-none focus:outline-none"
                  aria-label={bottomSheetExpanded ? 'Recolher detalhes' : 'Puxar para cima'}
                >
                  <div className="h-1.5 w-12 rounded-full bg-slate-600 transition group-hover:bg-slate-400" />
                </button>

                <div className="flex-1 overflow-y-auto px-4 pb-3 pt-1 space-y-3">
                  {!activeDelivery ? (
                    <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
                      <PackageCheck size={26} className="text-slate-500" />
                      <p className="text-sm font-bold text-slate-300">Não há entregas no momento</p>
                      <p className="text-xs text-slate-500">Os novos pedidos aparecerão aqui automaticamente.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-red-950/40">
                            <RouteIcon size={13} />
                            <span>{activeDelivery.order_status === 'saiu_entrega' ? 'Em rota' : 'Nova entrega'}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-400">#{activeDelivery.code}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                          {orderedOrders.length > 1 && <span>{Math.max(currentIndex + 1, 1)} de {orderedOrders.length}</span>}
                          <Clock3 size={14} className="text-red-400" />
                          <span>{routeActiveFor === activeDelivery.id && liveRouteInfo ? `~${liveRouteInfo.durationMin} min` : etaText(activeDelivery.estimated_delivery_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-800 text-red-500 shadow">
                            <Home size={22} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-black leading-tight text-white">{addressStreetAndNumber(activeDelivery.address)}</p>
                            <p className="truncate text-xs font-semibold text-slate-400">{neighborhoodOf(activeDelivery)}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setDetailsId(activeDelivery.id)} className="flex shrink-0 items-center gap-0.5 text-sm font-black text-white transition hover:text-red-400">
                          <span>{kmTo(activeDelivery) || (routeActiveFor === activeDelivery.id && liveRouteInfo ? `${liveRouteInfo.distanceKm.toFixed(1)} km` : 'Ver detalhes')}</span>
                          <ChevronRight size={16} className="text-slate-400" />
                        </button>
                      </div>

                      {orderedOrders.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {orderedOrders.map((order, index) => (
                            <button key={order.id} type="button" onClick={() => { setSelectedId(order.id); setLiveRouteInfo(null); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${order.id === activeDelivery.id ? 'border-red-500 bg-red-600/20 text-white' : 'border-white/10 bg-white/5 text-slate-400'}`}>
                              #{order.code} · {index + 1}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => handleViewRoute(activeDelivery)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1c2331] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#252f42] active:scale-95">
                          <Navigation size={15} className="text-sky-400" />
                          <span>{routeActiveFor === activeDelivery.id ? 'Atualizar rota' : 'Ver rota'}</span>
                        </button>
                        <a href={`tel:${(activeDelivery.customer_phone || '').replace(/\D/g, '')}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#13263b] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#1a334f] active:scale-95">
                          <Phone size={15} className="text-sky-400" />
                          <span>Ligar</span>
                        </a>
                      </div>

                      {isRouteable(activeDelivery) && activeDelivery.order_status !== 'saiu_entrega' && activeDelivery.courier_status !== 'cheguei' && (
                        <button type="button" disabled={busy === activeDelivery.id} onClick={() => void action(activeDelivery, 'start')} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ea1d2c] px-4 text-base font-black text-white shadow-lg shadow-red-950/60 transition hover:bg-red-700 active:scale-[0.98]">
                          <Bike size={20} />
                          <span>{busy === activeDelivery.id ? 'Iniciando…' : 'Aceitar entrega'}</span>
                        </button>
                      )}
                      {!isRouteable(activeDelivery) && (
                        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center text-xs font-bold text-amber-200">Aguardando o pedido ficar pronto para entrega</div>
                      )}
                      {activeDelivery.order_status === 'saiu_entrega' && activeDelivery.courier_status !== 'cheguei' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => whatsapp(activeDelivery)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-500"><MessageCircle size={15} /> WhatsApp</button>
                          <button type="button" onClick={() => waze(activeDelivery)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-xs font-black text-white transition hover:bg-sky-500"><ExternalLink size={15} /> Abrir Waze</button>
                          <button type="button" disabled={busy === activeDelivery.id} onClick={() => void action(activeDelivery, 'arrive')} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-black text-slate-950 transition hover:bg-amber-400"><MapPin size={15} /> Cheguei</button>
                        </div>
                      )}
                      {activeDelivery.courier_status === 'cheguei' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input type="text" inputMode="numeric" maxLength={6} placeholder="Código 6 dígitos" value={confirmation[activeDelivery.id] || ''} onChange={(e) => setConfirmation({ ...confirmation, [activeDelivery.id]: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="h-12 flex-1 rounded-xl border border-white/20 bg-slate-900 px-3 text-center text-lg font-black tracking-widest text-white focus:border-red-500 focus:outline-none" />
                            <button type="button" disabled={busy === activeDelivery.id || (activeDelivery.confirmation_code ? (confirmation[activeDelivery.id] || '').length !== 6 : false)} onClick={() => void action(activeDelivery, 'complete')} className="flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 active:scale-95">Confirmar</button>
                          </div>
                        </div>
                      )}

                      {bottomSheetExpanded && (
                        <div className="space-y-3.5 border-t border-white/10 pt-2 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-400">Fila de entregas ({orderedOrders.length})</p>
                            <button type="button" disabled={orderedOrders.length < 2} onClick={adjustOrder} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-3 py-2 text-[11px] font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><SlidersVertical size={14} /> Ajustar ordem</button>
                          </div>
                          {orderedOrders.length === 0 ? (
                            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs text-slate-500">Nenhuma entrega para organizar.</p>
                          ) : (
                            <div className="space-y-2">
                              {orderedOrders.map((order, index) => (
                                <div key={order.id} draggable onDragStart={() => setDraggedOrderId(order.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => {
                                  if (!draggedOrderId || draggedOrderId === order.id) return;
                                  const next = [...orderedOrders];
                                  const from = next.findIndex((item) => item.id === draggedOrderId);
                                  const to = next.findIndex((item) => item.id === order.id);
                                  if (from < 0 || to < 0) return;
                                  const [moved] = next.splice(from, 1);
                                  next.splice(to, 0, moved);
                                  setRoadOrderIds(next.map((item) => item.id));
                                  setDraggedOrderId(null);
                                }} onDragEnd={() => setDraggedOrderId(null)} className={`flex items-center gap-3 rounded-xl border p-3 transition ${order.id === activeDelivery.id ? 'border-red-500/50 bg-red-600/10' : 'border-white/10 bg-white/[0.03]'} ${draggedOrderId === order.id ? 'opacity-50' : ''}`}>
                                  <span className="cursor-grab text-slate-500">⋮⋮</span>
                                  <button type="button" onClick={() => { setSelectedId(order.id); setLiveRouteInfo(null); }} className="min-w-0 flex-1 text-left"><span className="block text-xs font-black text-white">{index + 1}. Pedido #{order.code}</span><span className="block truncate text-[11px] text-slate-400">{addressStreetAndNumber(order.address)} · {neighborhoodOf(order)}</span></button>
                                  <div className="flex shrink-0 flex-col">
                                    <button type="button" aria-label={`Mover pedido ${order.code} para cima`} disabled={index === 0} onClick={() => {
                                      const next = [...orderedOrders];
                                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                      setRoadOrderIds(next.map((item) => item.id));
                                    }} className="rounded p-0.5 text-slate-400 disabled:opacity-30"><ChevronUp size={14} /></button>
                                    <button type="button" aria-label={`Mover pedido ${order.code} para baixo`} disabled={index === orderedOrders.length - 1} onClick={() => {
                                      const next = [...orderedOrders];
                                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                      setRoadOrderIds(next.map((item) => item.id));
                                    }} className="rounded p-0.5 text-slate-400 disabled:opacity-30"><ChevronDown size={14} /></button>
                                  </div>
                                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">{statusInfo(order).label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
                            <p className="text-xs font-bold text-slate-400">Itens do pedido selecionado:</p>
                            {activeDelivery.items?.map((it, idx) => <div key={idx} className="flex justify-between text-xs text-white"><span>{it.quantity}× {it.meal_name} ({it.size_label})</span></div>)}
                            {activeDelivery.notes && <p className="pt-1 text-[11px] italic text-amber-300">Obs: {activeDelivery.notes}</p>}
                          </div>
                          <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300"><span>Total: <b className="mt-1 text-sm text-white">{currency(Number(activeDelivery.total))}</b></span><span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-emerald-300">{paymentLabel(activeDelivery.payment_method)}</span></div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button type="button" onClick={() => whatsapp(activeDelivery)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-black text-white transition hover:bg-emerald-500"><MessageCircle size={15} /> WhatsApp</button>
                            <button type="button" onClick={() => waze(activeDelivery)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-black text-white transition hover:bg-sky-500"><ExternalLink size={15} /> Abrir no Waze</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA PEDIDOS (LISTA COMPLETA COM FILTROS E AJUSTE DE ROTAS) */}
        {tab === 'pedidos' && (
          <div className="flex h-full flex-col overflow-hidden px-4 pt-3 pb-2 space-y-3">
            {/* Header com Filtros */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Pedidos ({orders.length})</h2>
              <button
                type="button"
                onClick={adjustOrder}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600/20 border border-sky-400/40 px-3 py-1.5 text-xs font-black text-sky-300 hover:bg-sky-600/30 transition active:scale-95"
              >
                <SlidersVertical size={13} />
                <span>Mais perto primeiro</span>
              </button>
            </div>

            {/* Filtros rápidos */}
            <div className="flex gap-2">
              {(['todos', 'prontos', 'preparo'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider transition ${
                    filter === f
                      ? 'bg-red-600 text-white shadow'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'prontos' ? 'Prontos' : 'Em preparo'}
                </button>
              ))}
            </div>

            {/* Lista de Pedidos */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pb-20">
              {orderedOrders.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0e1422] p-6 text-center space-y-3">
                  <PackageCheck size={32} className="mx-auto text-slate-600" />
                  <p className="text-sm font-bold text-slate-400">Nenhum pedido real no momento.</p>
                  <p className="text-xs text-slate-500">Exibindo demonstração na aba Mapa.</p>
                  <button
                    type="button"
                    onClick={() => setTab('mapa')}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white"
                  >
                    Ver Mapa estilo iFood
                  </button>
                </div>
              ) : (
                orders
                  .filter((o) => {
                    if (filter === 'prontos') return isRouteable(o);
                    if (filter === 'preparo') return isPrep(o);
                    return true;
                  })
                  .map((order) => {
                    const st = statusInfo(order);
                    return (
                      <div
                        key={order.id}
                        onClick={() => {
                          setSelectedId(order.id);
                          setTab('mapa');
                        }}
                        className="cursor-pointer rounded-2xl border border-white/10 bg-[#0e1422] p-3.5 space-y-2 hover:border-red-500/40 transition active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${st.cls}`}>
                            {st.label}
                          </span>
                          <span className="text-xs font-bold text-slate-400">#{order.code}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{addressStreetAndNumber(order.address)}</p>
                          <p className="text-xs text-slate-400">{neighborhoodOf(order)}</p>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                          <span className="font-bold text-slate-400">{kmTo(order) || 'Calcular rota'}</span>
                          <span className="font-black text-emerald-400">{currency(Number(order.total))}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ABA GANHOS (RESUMO FINANCEIRO DA DIÁRIA) */}
        {tab === 'ganhos' && (
          <div className="flex h-full flex-col overflow-hidden px-4 pt-4 pb-2 space-y-4">
            <h2 className="text-lg font-black text-white">Ganhos de Hoje</h2>

            {/* Card com Total */}
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-[#0b1c16] to-[#07130e] p-5 shadow-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total acumulado</span>
              <p className="text-3xl font-black text-white mt-1">
                {currency(dailyEarnings || serverCompleted.reduce((s, c) => s + c.fee, 0))}
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-300">
                <span>Entregas: <b className="text-white">{serverCompleted.length}</b></span>
                <span>Taxa média: <b className="text-emerald-400">R$ 5,00</b></span>
              </div>
            </div>

            {/* Histórico do dia */}
            <div className="flex-1 overflow-y-auto space-y-2 pb-20">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Histórico de entregas</p>
              {serverCompleted.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0e1422] p-5 text-center text-xs text-slate-400">
                  Nenhuma entrega finalizada hoje ainda.
                </div>
              ) : (
                serverCompleted.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0e1422] p-3 text-xs">
                    <div>
                      <p className="font-black text-white">Pedido #{c.code}</p>
                      <p className="text-slate-400 text-[11px]">{new Date(c.at).toLocaleTimeString('pt-BR')}</p>
                    </div>
                    <span className="font-black text-emerald-400">+{currency(c.fee)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. BARRA DE NAVEGAÇÃO INFERIOR FIXA (COM AS 4 ABAS DA FOTO) */}
      <nav className="relative z-40 shrink-0 flex items-center justify-around border-t border-white/10 bg-[#0b0f19] py-2 px-2">
        <button
          type="button"
          onClick={() => setTab('inicio')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition ${
            tab === 'inicio' ? 'text-red-500 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <Home size={22} className={tab === 'inicio' ? 'text-red-500' : 'text-slate-400'} />
          <span className="text-[11px]">Início</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('pedidos')}
          className={`relative flex flex-col items-center gap-1 py-1 px-3 transition ${
            tab === 'pedidos' ? 'text-red-500 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <ListOrdered size={22} className={tab === 'pedidos' ? 'text-red-500' : 'text-slate-400'} />
          {orders.length > 0 && (
            <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
              {orders.length}
            </span>
          )}
          <span className="text-[11px]">Pedidos</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('mapa')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition ${
            tab === 'mapa' ? 'text-red-500 font-black' : 'text-slate-400 font-medium'
          }`}
        >
          <MapPin size={22} className={tab === 'mapa' ? 'text-red-500 fill-red-500/20' : 'text-slate-400'} />
          <span className="text-[11px]">Mapa</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('ganhos')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition ${
            tab === 'ganhos' ? 'text-red-500 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <Wallet size={22} className={tab === 'ganhos' ? 'text-red-500' : 'text-slate-400'} />
          <span className="text-[11px]">Ganhos</span>
        </button>
      </nav>

      {/* Modal / Sheet de Detalhes do Pedido */}
      {detailsOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[700] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0d131d] p-5 shadow-2xl sm:rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <p className="text-lg font-black text-white">Detalhes do Pedido #{detailsOrder.code}</p>
              <button
                type="button"
                onClick={() => setDetailsId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-400">Cliente</p>
              <p className="text-base font-black text-white">{detailsOrder.customer_name}</p>
              {detailsOrder.customer_phone && (
                <p className="text-xs text-slate-300">{detailsOrder.customer_phone}</p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-400">Endereço de entrega</p>
              <p className="text-sm font-semibold text-slate-200">{addressText(detailsOrder.address)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[.02] p-3 space-y-2">
              <p className="text-xs font-bold text-slate-300">Itens pedidos:</p>
              {detailsOrder.items?.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs text-slate-300">
                  <span>
                    {it.quantity}× {it.meal_name} ({it.size_label})
                  </span>
                  {it.notes && <span className="text-amber-300 italic">{it.notes}</span>}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm font-bold text-slate-400">Total do pedido</span>
              <span className="text-xl font-black text-white">{currency(Number(detailsOrder.total))}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => waze(detailsOrder)}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-black text-white"
              >
                <Navigation size={15} /> Abrir Waze
              </button>
              <button
                type="button"
                onClick={() => googleMaps(detailsOrder)}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 text-xs font-black text-white"
              >
                <MapIcon size={15} /> Google Maps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de Sucesso de Entrega Concluída */}
      {success && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[700] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl border border-emerald-400/30 bg-[#0d1714] p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <p className="text-xl font-black text-white">Entrega Concluída!</p>
              <p className="mt-1 text-sm text-slate-300">Pedido #{success.code} finalizado com sucesso.</p>
              {success.fee > 0 && (
                <p className="mt-2 text-lg font-black text-emerald-400">
                  +{currency(success.fee)} na sua diária
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="min-h-12 w-full rounded-xl bg-emerald-500 font-black text-slate-950 shadow hover:bg-emerald-400"
            >
              Continuar rodando
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
