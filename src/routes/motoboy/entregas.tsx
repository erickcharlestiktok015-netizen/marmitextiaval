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
  Hand,
  Check,
  SlidersVertical,
} from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { dishForDateKey, nextPendingPlanDate, parsePlanNotes, spDateKey } from '@/lib/weekly-plan';
import { DeliveryMap, type GeoPoint } from '@/components/delivery-map';

type Delivery = {
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
type Geo = GeoPoint;
type Tab = 'inicio' | 'pedidos' | 'mapa' | 'ganhos';
type Filter = 'todos' | 'preparo' | 'prontos';
type CompletedDelivery = {
  id: string;
  code: string;
  fee: number;
  at: string;
  customer_name?: string;
  address?: unknown;
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
  if (o.courier_status === 'cheguei') return { label: 'Chegou ao cliente', cls: 'bg-amber-400/15 text-amber-300' };
  if (o.order_status === 'saiu_entrega') return { label: 'Em rota', cls: 'bg-sky-400/15 text-sky-300' };
  if (o.order_status === 'pronto_entrega') return { label: 'Pronto para entrega', cls: 'bg-emerald-400/15 text-emerald-300' };
  if (o.order_status === 'preparando') return { label: 'Em preparo', cls: 'bg-orange-400/15 text-orange-300' };
  if (o.order_status === 'confirmado') return { label: 'Confirmado', cls: 'bg-orange-400/15 text-orange-300' };
  return { label: 'Pedido novo', cls: 'bg-slate-500/20 text-slate-300' };
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = window.localStorage.getItem('tia-val-courier-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  const toggleTheme = () => {
    setTheme((curr) => {
      const next = curr === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem('tia-val-courier-theme', next);
      } catch {}
      return next;
    });
  };

  const [orders, setOrders] = useState<Delivery[]>([]);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [serverCompleted, setServerCompleted] = useState<CompletedDelivery[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [readyAlert, setReadyAlert] = useState('');
  const [location, setLocation] = useState<Geo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmation, setConfirmation] = useState<Record<string, string>>({});
  const [geoMessage, setGeoMessage] = useState('Ative o GPS para ordenar por proximidade.');
  const [geoDenied, setGeoDenied] = useState(false);
  const [geoSpecificHelp, setGeoSpecificHelp] = useState('');
  const [updated, setUpdated] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [presenceError, setPresenceError] = useState('');
  const [roadOrderIds, setRoadOrderIds] = useState<string[]>([]);
  const [routeCalculation, setRouteCalculation] = useState('');
  const [tab, setTab] = useState<Tab>('inicio');
  const [filter, setFilter] = useState<Filter>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      if (!response.ok)
        throw new Error((data.error || 'Falha ao carregar entregas.') + ' (HTTP ' + response.status + ')');
      const freshOrders = data.orders || [];
      const freshReady = new Set(
        freshOrders.filter((o) => o.order_status === 'pronto_entrega').map((o) => o.id),
      );
      if (previousReadyIds.current && alertsEnabled) {
        const newlyReady = [...freshReady].filter((id) => !previousReadyIds.current!.has(id));
        if (newlyReady.length) {
          const readyOrder = freshOrders.find((o) => o.id === newlyReady[0]);
          setReadyAlert(
            readyOrder
              ? `Pedido #${readyOrder.code} pronto para retirada na cozinha.`
              : 'Novo pedido pronto para entrega.',
          );
          try {
            navigator.vibrate?.([180, 80, 180]);
          } catch {}
          try {
            const AudioContextClass = window.AudioContext;
            if (AudioContextClass) {
              const audio = new AudioContextClass();
              const oscillator = audio.createOscillator();
              const gain = audio.createGain();
              oscillator.type = 'sine';
              oscillator.frequency.value = 880;
              gain.gain.setValueAtTime(0.0001, audio.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28);
              oscillator.connect(gain);
              gain.connect(audio.destination);
              oscillator.start();
              oscillator.stop(audio.currentTime + 0.3);
              window.setTimeout(() => void audio.close(), 450);
            }
          } catch {}
          if (
            document.visibilityState !== 'visible' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification('Tia Val · novo pedido pronto', {
                body: readyOrder
                  ? `Pedido #${readyOrder.code} está pronto para sair.`
                  : 'Um pedido está pronto.',
              });
            } catch {}
          }
        }
      }
      previousReadyIds.current = freshReady;
      setOrders(freshOrders);
      setServerCompleted(
        (data.completedToday || []).map((c) => ({
          id: c.id,
          code: c.code,
          fee: Number(c.delivery_fee) || 0,
          at: c.completed_at,
          customer_name: c.customer_name,
          address: c.address,
        })),
      );
      setDailyEarnings(Number.isFinite(data.dailyEarnings) ? Number(data.dailyEarnings) : 0);
      setUpdated(new Date().toLocaleTimeString('pt-BR'));
      setError('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Erro ao consultar entregas. Verifique a conexão e tente novamente.',
      );
    } finally {
      setLoaded(true);
      loadingRef.current = false;
    }
  }, [alertsEnabled]);

  const loadPresence = useCallback(async () => {
    try {
      const response = await fetch('/api/courier/presence', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = (await response.json().catch(() => ({}))) as {
        is_online?: boolean;
        error?: string;
      };
      if (response.ok && typeof data.is_online === 'boolean') {
        setIsOnline(data.is_online);
      }
    } catch {}
  }, []);

  const sendLocation = async (point: Geo) => {
    try {
      await fetch('/api/courier/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'location', ...point }),
      });
    } catch {}
  };

  const handleGeoError = (err: GeolocationPositionError) => {
    const isIos =
      typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (err.code === err.PERMISSION_DENIED) {
      setGeoDenied(true);
      if (isIos) {
        setGeoSpecificHelp(
          "Localização bloqueada no iPhone. Acesse Ajustes > Safari > Localização e escolha 'Permitir'.",
        );
      } else {
        setGeoSpecificHelp(
          'Localização bloqueada no Android. Toque no ícone de cadeado na barra do navegador e permita a Localização.',
        );
      }
      setGeoMessage('Permissão de GPS negada.');
    } else {
      setGeoMessage('Sinal de GPS fraco. Verifique se a localização está ativada no aparelho.');
    }
  };

  const getLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage('Seu navegador não suporta GPS.');
      return;
    }
    setGeoMessage('Buscando sinal do GPS…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(point);
        setGeoDenied(false);
        setGeoSpecificHelp('');
        setGeoMessage('GPS conectado. Rota atualizada em tempo real.');
        void sendLocation(point);
      },
      handleGeoError,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  };

  // Watch GPS in real time
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(point);
        setGeoDenied(false);
        setGeoSpecificHelp('');
        void sendLocation(point);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) handleGeoError(err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 8000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Poll orders & presence
  useEffect(() => {
    void load();
    void loadPresence();
    getLocation();
    const interval = window.setInterval(() => {
      void load();
      void loadPresence();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [load, loadPresence]);

  const togglePresence = async (forceOnline?: boolean) => {
    const nextState = typeof forceOnline === 'boolean' ? forceOnline : !isOnline;
    setPresenceBusy(true);
    setPresenceError('');
    setShowStatusMenu(false);
    try {
      const response = await fetch('/api/courier/presence', {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_online: nextState }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        is_online?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar sua disponibilidade.');
      setIsOnline(Boolean(data.is_online));
      if (nextState) {
        getLocation();
      }
    } catch (e) {
      setPresenceError(e instanceof Error ? e.message : 'Erro ao atualizar presença.');
    } finally {
      setPresenceBusy(false);
    }
  };

  const action = async (order: Delivery, next: 'start' | 'arrived' | 'delivered') => {
    setBusy(order.id);
    setError('');
    try {
      const body: Record<string, unknown> = { id: order.id, action: next };
      if (next === 'delivered') body['code'] = confirmation[order.id] || '';
      const response = await fetch('/api/courier/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a entrega.');
      if (next === 'delivered') {
        const fee = Number(order.delivery_fee);
        const done = {
          id: order.id,
          code: order.code,
          fee: Number.isFinite(fee) && fee > 0 ? fee : 0,
          at: new Date().toISOString(),
          customer_name: order.customer_name,
          address: order.address,
        };
        setSuccess(done);
        setConfirmation((v) => ({ ...v, [order.id]: '' }));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar pedido.');
    } finally {
      setBusy('');
    }
  };

  const estimateDelivery = async (order: Delivery, minutes: number) => {
    setBusy(order.id);
    setError('');
    try {
      const response = await fetch('/api/courier/orders', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: order.id, action: 'estimate', minutes }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a estimativa.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao estimar entrega.');
    } finally {
      setBusy('');
    }
  };

  const adjustOrder = () => {
    if (!location) {
      setGeoMessage('Ative o GPS para ordenar pela proximidade.');
      getLocation();
      return;
    }
    const target = orders.filter(isRouteable);
    const unvisited = [...target];
    const sortedIds: string[] = [];
    let currentPoint = location;
    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const p = coords(unvisited[i].address);
        const d = p ? distance(currentPoint, p) : 999999;
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      const [nearest] = unvisited.splice(nearestIdx, 1);
      sortedIds.push(nearest.id);
      const nextPoint = coords(nearest.address);
      if (nextPoint) currentPoint = nextPoint;
    }
    setRoadOrderIds(sortedIds);
    setRouteCalculation('Ordem otimizada da mais próxima para a mais distante.');
    getLocation();
    setFilter('todos');
  };

  const logout = async () => {
    try {
      await fetch('/api/courier/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } finally {
      window.location.assign('/motoboy');
    }
  };

  const waze = (order: Delivery) => {
    const point = coords(order.address);
    const destination = point
      ? `ll=${point.latitude},${point.longitude}&navigate=yes`
      : `q=${encodeURIComponent(addressText(order.address))}&navigate=yes`;
    window.open(`https://waze.com/ul?${destination}`, '_blank', 'noopener,noreferrer');
  };

  const googleMaps = (order: Delivery) => {
    const point = coords(order.address);
    const destination = point
      ? `${point.latitude},${point.longitude}`
      : encodeURIComponent(addressText(order.address));
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const whatsapp = (order: Delivery, customText?: string) => {
    const phone = order.customer_phone.replace(/\D/g, '');
    if (!phone) return;
    const normalized = phone.startsWith('55') ? phone : '55' + phone;
    const message =
      customText ||
      `Olá, ${order.customer_name}! Aqui é o motoboy da Tia Val sobre o pedido #${order.code}.`;
    window.open(
      `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const ordered = useMemo(() => {
    const active = orders.filter((o) => o.order_status === 'saiu_entrega');
    const ready = orders.filter((o) => o.order_status === 'pronto_entrega');
    const waiting = orders.filter((o) => ['novo', 'confirmado', 'preparando'].includes(o.order_status));
    const sortList = (list: Delivery[]) => {
      if (roadOrderIds.length > 0) {
        return [...list].sort((a, b) => {
          const ai = roadOrderIds.indexOf(a.id);
          const bi = roadOrderIds.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return 0;
        });
      }
      if (!location) return list;
      return [...list].sort((a, b) => {
        const pa = coords(a.address);
        const pb = coords(b.address);
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        return distance(location, pa) - distance(location, pb);
      });
    };
    return [...sortList(active), ...sortList(ready), ...waiting];
  }, [orders, roadOrderIds, location]);

  const prepCount = orders.filter(isPrep).length;
  const readyCount = orders.filter((o) => o.order_status === 'pronto_entrega').length;
  const activeCount = orders.filter((o) => o.order_status === 'saiu_entrega').length;
  const routeOrders = useMemo(() => ordered.filter(isRouteable), [ordered]);
  const current =
    (selectedId && orders.find((o) => o.id === selectedId && isRouteable(o))) ||
    routeOrders.find((o) => o.order_status === 'saiu_entrega') ||
    routeOrders[0] ||
    null;
  const nextDelivery = routeOrders[0] || ordered[0] || null;
  const detailsOrder = detailsId ? orders.find((o) => o.id === detailsId) || null : null;
  const filtered = ordered.filter((o) =>
    filter === 'todos' ? true : filter === 'preparo' ? isPrep(o) : isRouteable(o),
  );

  const kmTo = (o: Delivery) => {
    const p = coords(o.address);
    return location && p ? `${distance(location, p).toFixed(1)} km` : null;
  };

  const neighborhoodOf = (order: Delivery | null) => {
    if (!order || !order.address || typeof order.address !== 'object') return '';
    const address = order.address as Record<string, unknown>;
    return String(address['bairro'] ?? address['neighborhood'] ?? address['district'] ?? '').trim();
  };

  const neighborhoodBatches = Object.entries(
    routeOrders.reduce<Record<string, Delivery[]>>((groups, order) => {
      const neighborhood = neighborhoodOf(order) || 'Outros bairros';
      (groups[neighborhood] ||= []).push(order);
      return groups;
    }, {}),
  )
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  const enableAlerts = async () => {
    setAlertsEnabled(true);
    setReadyAlert('Avisos ativados: som e vibração quando um pedido ficar pronto.');
    try {
      if ('Notification' in window && Notification.permission === 'default')
        await Notification.requestPermission();
      const AudioContextClass = window.AudioContext;
      if (AudioContextClass) {
        const audio = new AudioContextClass();
        await audio.resume();
        await audio.close();
      }
    } catch {}
    window.setTimeout(() => setReadyAlert(''), 4500);
  };

  const planInfo = (order: Delivery) => {
    const plan = parsePlanNotes(order.notes);
    if (!plan) return null;
    const todayKey = spDateKey(new Date());
    const dish = plan.dates.includes(todayKey) ? dishForDateKey(todayKey)?.name : null;
    return { nextDate: nextPendingPlanDate(plan), dish, window: plan.window };
  };

  const paymentReminder = (order: Delivery) => {
    if (order.payment_method === 'online')
      return { label: 'PAGO ONLINE · Só entregar', tone: 'bg-emerald-500/15 text-emerald-300' };
    if (order.payment_method === 'entrega-cartao')
      return { label: 'LEVAR MAQUININHA', tone: 'bg-sky-500/15 text-sky-300' };
    if (order.payment_method === 'entrega-dinheiro') {
      const change = Number(order.change_for);
      return {
        label:
          Number.isFinite(change) && change > 0
            ? `DINHEIRO · Troco para ${currency(change)}`
            : 'DINHEIRO · Sem troco informado',
        tone: 'bg-amber-500/15 text-amber-300',
      };
    }
    if (order.payment_method === 'entrega-pix')
      return { label: 'PIX NA ENTREGA', tone: 'bg-violet-500/15 text-violet-300' };
    return { label: paymentLabel(order.payment_method), tone: 'bg-slate-500/15 text-slate-300' };
  };

  const stepOf = (o: Delivery) =>
    o.courier_status === 'cheguei' ? 3 : o.order_status === 'saiu_entrega' ? 2 : 0;

  const card = 'rounded-2xl border border-white/10 bg-[#0d131d]';
  const primaryBtn =
    'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-extrabold text-white shadow-lg shadow-red-950/40 transition active:scale-[0.98] hover:bg-red-500 disabled:opacity-50';
  const ghostBtn =
    'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 font-bold text-slate-100 transition active:scale-[0.98] hover:bg-white/10 disabled:opacity-50';

  const ErrorBox = () =>
    error ? (
      <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
        {error}
      </div>
    ) : null;

  const GeoBox = () =>
    geoDenied || geoSpecificHelp ? (
      <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <span className="font-semibold">{geoSpecificHelp || geoMessage}</span>
        </div>
        <button
          type="button"
          onClick={getLocation}
          className="self-start rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 shadow hover:bg-amber-400"
        >
          Tentar novamente
        </button>
      </div>
    ) : null;

  const ActionArea = ({ order }: { order: Delivery }) => {
    if (order.courier_status === 'cheguei')
      return (
        <div className={`${card} p-4`}>
          <p className="font-bold">Código de confirmação</p>
          <p className="mt-1 text-sm text-slate-400">Peça ao cliente o código de 6 dígitos.</p>
          <div className="mt-4 flex justify-center">
            <InputOTP
              maxLength={6}
              inputMode="numeric"
              pattern="^[0-9]*$"
              value={confirmation[order.id] || ''}
              onChange={(v) =>
                setConfirmation((c) => ({ ...c, [order.id]: v.replace(/\D/g, '').slice(0, 6) }))
              }
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-11 rounded-xl border border-white/15 bg-[#080d16] text-xl font-black text-white first:rounded-xl last:rounded-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <button
            disabled={busy === order.id || (confirmation[order.id] || '').length !== 6}
            onClick={() => void action(order, 'delivered')}
            className={`${primaryBtn} mt-4`}
          >
            <CheckCircle2 size={18} /> {busy === order.id ? 'Confirmando…' : 'Confirmar entrega'}
          </button>
          {(confirmation[order.id] || '').length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmation((c) => ({ ...c, [order.id]: '' }))}
              className={`${ghostBtn} mt-2`}
            >
              Alterar código
            </button>
          )}
        </div>
      );
    if (order.order_status === 'saiu_entrega')
      return (
        <button
          disabled={busy === order.id}
          onClick={() => void action(order, 'arrived')}
          className={primaryBtn}
        >
          <MapPin size={18} /> Cheguei ao endereço
        </button>
      );
    if (order.order_status === 'pronto_entrega')
      return (
        <button
          disabled={busy === order.id}
          onClick={() => void action(order, 'start')}
          className={primaryBtn}
        >
          <Check size={18} /> Aceitar entrega / Iniciar rota
        </button>
      );
    return (
      <p className="rounded-xl bg-white/[.04] p-3 text-center text-sm font-semibold text-slate-400">
        Aguardando a cozinha. Você poderá iniciar quando o pedido estiver &quot;Pronto para entrega&quot;.
      </p>
    );
  };

  const Steps = ({ order }: { order: Delivery }) => {
    const step = stepOf(order);
    const labels = ['Retirou', 'Em rota', 'Cheguei', 'Entregue'];
    return (
      <div className="mt-4">
        <div className="flex items-center">
          {labels.map((_, i) => (
            <div key={i} className="flex flex-1 items-center last:flex-none">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                  i < step
                    ? 'bg-emerald-400 text-[#06120b]'
                    : i === step
                    ? 'bg-red-500 text-white ring-4 ring-red-500/20'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </span>
              {i < labels.length - 1 && (
                <span
                  className={`mx-1 h-1 flex-1 rounded-full ${
                    i < step - 1 ? 'bg-emerald-400' : 'bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400">
          {labels.map((l, i) => (
            <span key={l} className={i === step || i === step - 1 ? 'text-slate-100 font-bold' : ''}>
              {l}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const OrderCard = ({ order, highlight }: { order: Delivery; highlight?: boolean }) => {
    const s = statusInfo(order);
    const km = kmTo(order);
    return (
      <article
        className={`rounded-2xl border p-4 transition ${
          highlight
            ? 'border-red-500/70 bg-gradient-to-br from-[#2a0f17] to-[#101722] shadow-lg shadow-red-950/20'
            : 'border-white/10 bg-[#0d131d]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>
            <p className="mt-2 text-sm text-slate-400">
              #{order.code} ·{' '}
              {new Date(order.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <p className="mt-0.5 truncate font-bold text-base">{order.customer_name}</p>
            <p className="mt-0.5 truncate text-sm text-slate-400">
              {order.items.map((i) => `${i.quantity}× ${i.meal_name}`).join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2 py-1 text-[10px] font-black ${paymentReminder(order).tone}`}>
                {paymentReminder(order).label}
              </span>
              {planInfo(order) && (
                <span className="rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-black text-violet-300">
                  PLANO 7 DIAS · {planInfo(order)?.dish || `Próxima ${planInfo(order)?.nextDate}`} · {planInfo(order)?.window}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-black text-lg">{currency(Number(order.total))}</p>
            {km && <p className="mt-1 text-sm font-bold text-sky-400">{km}</p>}
          </div>
        </div>
        <p className="mt-3 flex gap-2 text-sm text-slate-300">
          <MapPin size={16} className="mt-0.5 shrink-0 text-red-400" />
          <span className="min-w-0">{addressText(order.address)}</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDetailsId(order.id)}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/15 text-sm font-bold hover:bg-white/5 active:scale-95"
          >
            Ver detalhes <ChevronRight size={16} />
          </button>
          {order.order_status === 'pronto_entrega' ? (
            <button
              type="button"
              disabled={busy === order.id}
              onClick={() => void action(order, 'start')}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-red-600 text-sm font-extrabold text-white shadow-md hover:bg-red-500 active:scale-95 disabled:opacity-50"
            >
              <Navigation size={15} /> Iniciar rota
            </button>
          ) : order.order_status === 'saiu_entrega' ? (
            <button
              type="button"
              onClick={() => {
                setSelectedId(order.id);
                setTab('mapa');
              }}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-sky-500 text-sm font-extrabold text-slate-950 shadow-md hover:bg-sky-400 active:scale-95"
            >
              <MapIcon size={15} /> Ver rota
            </button>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/[.04] text-xs font-semibold text-slate-500">
              Aguardando cozinha
            </span>
          )}
        </div>
      </article>
    );
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Home; badge?: number }> = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'pedidos', label: 'Pedidos', icon: ListOrdered, badge: readyCount + activeCount },
    { id: 'mapa', label: 'Mapa', icon: MapIcon },
    { id: 'ganhos', label: 'Ganhos', icon: Wallet },
  ];

  return (
    <main
      className={`courier-screen min-h-screen ${
        theme === 'light' ? 'courier-light bg-[#f4f5f7] text-[#17191d]' : 'bg-[#060a11] text-slate-100'
      }`}
      data-courier-theme={theme}
    >
      <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
        {/* ======================= TAB: INÍCIO (DASHBOARD PIQUE IFOOD) ======================= */}
        {tab === 'inicio' && (
          <div className="space-y-3.5">
            {/* Top Bar matching screenshot */}
            <header className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {/* Red Motoboy with Delivery Bag Logo */}
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 shadow-md shadow-red-950/40">
                  <img
                    src="/icons/motoboy-192.png"
                    alt="Tia Val Motoboy"
                    className="h-9 w-9 object-contain drop-shadow"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <Bike size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black leading-tight tracking-tight">
                    Marmitex <span className="text-red-500">da Tia Val</span>
                  </p>
                  {/* Status Dropdown Pill: Online / Offline */}
                  <div className="relative mt-0.5 inline-block">
                    <button
                      type="button"
                      onClick={() => setShowStatusMenu((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-black shadow-sm transition active:scale-95 ${
                        isOnline
                          ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                          : 'border border-slate-600 bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isOnline ? 'animate-pulse bg-emerald-400' : 'bg-slate-400'}`} />
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                      <ChevronDown size={13} className="text-slate-400" />
                    </button>
                    {showStatusMenu && (
                      <div className="absolute left-0 top-full z-[600] mt-1.5 w-40 rounded-xl border border-white/15 bg-slate-900 p-1.5 shadow-2xl backdrop-blur-xl">
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
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-300 hover:bg-white/5"
                        >
                          <span className="h-2 w-2 rounded-full bg-slate-500" />
                          <span>Ficar Offline</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right action icons */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label="Alternar tema"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition active:scale-95 hover:bg-white/10"
                >
                  {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('pedidos')}
                  aria-label="Notificações"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition active:scale-95 hover:bg-white/10"
                >
                  <Bell size={18} />
                  {readyCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-[#060a11]">
                      {readyCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void load()}
                  aria-label="Atualizar"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition active:scale-95 hover:bg-white/10"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </header>

            <GeoBox />
            <ErrorBox />
            {readyAlert && (
              <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
                🔔 {readyAlert}
              </div>
            )}

            {/* Main Interactive GPS Map matching reference screenshot */}
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#0a0f18] shadow-2xl">
              <DeliveryMap
                courierLocation={location}
                destinationLocation={coords(nextDelivery?.address)}
                destinationNeighborhood={neighborhoodOf(nextDelivery)}
                destinationTitle={addressText(nextDelivery?.address)}
                className="h-[50vh] sm:h-[54vh] w-full"
                showWazeButton={Boolean(nextDelivery && isRouteable(nextDelivery))}
                onRouteCalculated={(info) => setLiveRouteInfo(info)}
                onRequestLocation={getLocation}
              />
            </div>

            {/* Bottom Sheet Card / Barrinha Pique iFood */}
            {nextDelivery ? (
              <div
                className={`overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#111927] to-[#0c121e] shadow-2xl transition-all duration-300 ${
                  bottomSheetExpanded ? 'ring-2 ring-red-500/30' : ''
                }`}
              >
                {/* Pull handle bar */}
                <button
                  type="button"
                  onClick={() => setBottomSheetExpanded((v) => !v)}
                  aria-label={bottomSheetExpanded ? 'Recolher detalhes' : 'Puxar para cima para ver mais opções'}
                  className="group flex w-full flex-col items-center pt-2.5 pb-1 cursor-pointer"
                >
                  <div className="h-1.5 w-12 rounded-full bg-slate-600 transition group-hover:bg-slate-400" />
                </button>

                <div className="px-4 pb-4 pt-1 space-y-3">
                  {/* Status badge + Timer / ETA */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-red-950/40">
                        <RouteIcon size={13} />
                        <span>{nextDelivery.order_status === 'saiu_entrega' ? 'Em rota' : 'Nova entrega'}</span>
                      </span>
                      <span className="text-xs font-bold text-slate-400">#{nextDelivery.code}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-black text-slate-300">
                      <Clock3 size={14} className="text-red-400" />
                      <span>{liveRouteInfo ? `~${liveRouteInfo.durationMin} min` : etaText(nextDelivery.estimated_delivery_at)}</span>
                    </div>
                  </div>

                  {/* Customer Address with Home icon and distance */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-slate-200 shadow border border-white/10">
                        <Home size={20} className="text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white leading-tight">
                          {addressStreetAndNumber(nextDelivery.address)}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-400">
                          {neighborhoodOf(nextDelivery) || 'Fortaleza'}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-white flex items-center gap-1">
                        <span>{kmTo(nextDelivery) || (liveRouteInfo ? `${liveRouteInfo.distanceKm} km` : '2,8 km')}</span>
                        <Navigation size={13} className="text-sky-400 rotate-45" />
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {currency(Number(nextDelivery.total))}
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Buttons Row: Ver rota & Ligar */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(nextDelivery.id);
                        setTab('mapa');
                      }}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-800/80 px-3 text-xs font-black text-white shadow-sm hover:bg-slate-700 active:scale-95"
                    >
                      <MapIcon size={15} className="text-sky-400" />
                      <span>Ver rota</span>
                    </button>
                    {nextDelivery.customer_phone ? (
                      <a
                        href={`tel:${nextDelivery.customer_phone.replace(/[^+\d]/g, '')}`}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-800/80 px-3 text-xs font-black text-white shadow-sm hover:bg-slate-700 active:scale-95"
                      >
                        <Phone size={15} className="text-emerald-400" />
                        <span>Ligar</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDetailsId(nextDelivery.id)}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-800/80 px-3 text-xs font-black text-white shadow-sm hover:bg-slate-700 active:scale-95"
                      >
                        <span>Detalhes</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>

                  {/* Big Primary Action Button */}
                  <ActionArea order={nextDelivery} />

                  {/* Expanded Bottom Sheet Content (When user pulls up / taps expand) */}
                  {bottomSheetExpanded && (
                    <div className="pt-2 space-y-3 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      {/* Prominent Adjust Route Button */}
                      <button
                        type="button"
                        onClick={adjustOrder}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 text-xs font-black text-sky-300 shadow hover:bg-sky-500/20 active:scale-[0.98]"
                      >
                        <SlidersVertical size={16} />
                        <span>Ajustar rotas (mais perto primeiro com GPS)</span>
                      </button>

                      {/* Payment Reminder Badge */}
                      <div className={`rounded-xl p-3 text-center text-xs font-black ${paymentReminder(nextDelivery).tone}`}>
                        {paymentReminder(nextDelivery).label}
                      </div>

                      {/* Neighborhood Batches */}
                      {neighborhoodBatches.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/[.02] p-3 space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                            <MapPin size={15} /> Sugestão de entrega por bairro:
                          </p>
                          <div className="space-y-1.5">
                            {neighborhoodBatches.map(([bairro, grupo]) => (
                              <button
                                key={bairro}
                                type="button"
                                onClick={() => {
                                  setFilter('prontos');
                                  setTab('pedidos');
                                }}
                                className="flex w-full items-center justify-between rounded-lg bg-slate-800/60 p-2 text-xs"
                              >
                                <span className="font-bold text-white">{bairro}</span>
                                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-black text-amber-300">
                                  {grupo.length} pedidos
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Items */}
                      <div className="rounded-xl border border-white/10 bg-white/[.02] p-3 text-xs space-y-1">
                        <p className="font-bold text-slate-300">Itens:</p>
                        {nextDelivery.items.map((it, idx) => (
                          <p key={idx} className="text-slate-400">
                            {it.quantity}× {it.meal_name} · {it.size_label}
                          </p>
                        ))}
                      </div>

                      {/* WhatsApp 1-tap fast buttons */}
                      {nextDelivery.customer_phone && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              whatsapp(
                                nextDelivery,
                                `Olá, ${nextDelivery.customer_name}! Aqui é o motoboy da Tia Val. Já saí com sua marmita e chego em ~10 min!`,
                              )
                            }
                            className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] font-black text-emerald-300 hover:bg-emerald-500/20"
                          >
                            🛵 &quot;A caminho (~10 min)&quot;
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              whatsapp(
                                nextDelivery,
                                `Olá, ${nextDelivery.customer_name}! Cheguei no portão com seu pedido #${nextDelivery.code}. Pode me atender?`,
                              )
                            }
                            className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] font-black text-emerald-300 hover:bg-emerald-500/20"
                          >
                            🚪 &quot;Cheguei no portão!&quot;
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`${card} p-6 text-center space-y-3`}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <PackageCheck size={32} />
                </div>
                <div>
                  <p className="text-base font-black text-white">
                    {loaded ? 'Sem entregas pendentes' : 'Carregando entregas…'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Você está online e pronto para rodar. Assim que a cozinha aprontar uma marmita, ela aparecerá aqui!
                  </p>
                </div>
              </div>
            )}

            {/* Quick Metrics */}
            <div className={`${card} grid grid-cols-3 divide-x divide-white/10 p-2 text-center`}>
              <div className="p-2">
                <p className="text-[11px] font-bold text-slate-400">Na fila</p>
                <p className="mt-0.5 text-xl font-black text-white">{orders.length}</p>
              </div>
              <div className="p-2">
                <p className="text-[11px] font-bold text-slate-400">Ganhos hoje</p>
                <p className="mt-0.5 text-base font-black text-emerald-400">{currency(dailyEarnings)}</p>
              </div>
              <div className="p-2">
                <p className="text-[11px] font-bold text-slate-400">Em rota</p>
                <p className="mt-0.5 text-xl font-black text-sky-400">{activeCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB: PEDIDOS ======================= */}
        {tab === 'pedidos' && (
          <div className="space-y-4">
            <header className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-black">Pedidos</h1>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label="Alternar tema"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300"
                >
                  {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
                </button>
                <button
                  type="button"
                  onClick={() => void load()}
                  aria-label="Atualizar"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </header>

            <div className={`${card} flex items-center justify-between gap-3 p-3`}>
              <div>
                <p className="font-bold text-sm">Avisos sonoros de pedidos</p>
                <p className="text-xs text-slate-400">Toca quando a cozinha aprontar uma marmita</p>
              </div>
              <button
                type="button"
                onClick={() => (alertsEnabled ? setAlertsEnabled(false) : void enableAlerts())}
                className={`min-h-9 shrink-0 rounded-xl px-3 text-xs font-black ${
                  alertsEnabled ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {alertsEnabled ? 'Ativados' : 'Ativar'}
              </button>
            </div>

            {readyAlert && (
              <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
                🔔 {readyAlert}
              </div>
            )}

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ['todos', `Todos (${orders.length})`],
                  ['preparo', `Em preparo (${prepCount})`],
                  ['prontos', `Prontos (${readyCount + activeCount})`],
                ] as Array<[Filter, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${
                    filter === id
                      ? 'bg-red-600 text-white shadow-md'
                      : 'border border-white/15 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Adjust Order Button */}
            <div className={`${card} p-3 space-y-2`}>
              <button type="button" onClick={adjustOrder} className={primaryBtn}>
                <SlidersVertical size={18} />
                <span>Ajustar ordem (mais perto primeiro)</span>
              </button>
              <p className="text-xs text-slate-400 text-center">{geoMessage}</p>
              {routeCalculation && (
                <p className="text-xs text-slate-500 text-center">
                  {routeCalculation}
                  {updated && ` · Atualizado às ${updated}`}
                </p>
              )}
            </div>

            <GeoBox />
            <ErrorBox />

            {filtered.length === 0 && (
              <div className={`${card} px-5 py-10 text-center text-sm text-slate-400`}>
                Nenhum pedido neste filtro.
              </div>
            )}

            <div className="space-y-3">
              {filtered.map((o, i) => (
                <OrderCard key={o.id} order={o} highlight={i === 0 && isRouteable(o)} />
              ))}
            </div>
          </div>
        )}

        {/* ======================= TAB: MAPA ======================= */}
        {tab === 'mapa' && (
          <div className="space-y-4">
            <header className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black">
                  {current
                    ? current.courier_status === 'cheguei'
                      ? 'Chegou ao cliente'
                      : current.order_status === 'saiu_entrega'
                      ? 'Em rota'
                      : 'Próxima rota'
                    : 'Mapa'}
                </h1>
                {current && <p className="text-xs text-slate-400">Pedido #{current.code}</p>}
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Alternar tema"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300"
              >
                {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
              </button>
            </header>

            {/* Interactive GPS Map */}
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#0a0f18] shadow-2xl">
              <DeliveryMap
                courierLocation={location}
                destinationLocation={coords(current?.address)}
                destinationNeighborhood={neighborhoodOf(current)}
                destinationTitle={addressText(current?.address)}
                className="h-[46vh] sm:h-[50vh] w-full"
                showWazeButton={Boolean(current)}
                onRequestLocation={getLocation}
              />
            </div>

            <GeoBox />
            <ErrorBox />

            {current ? (
              <>
                <div className={`${card} p-4 space-y-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-400">Cliente</p>
                      <p className="font-black text-base">{current.customer_name}</p>
                    </div>
                    {kmTo(current) && (
                      <span className="rounded-full bg-sky-500/20 px-2.5 py-1 text-xs font-black text-sky-300">
                        {kmTo(current)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Endereço</p>
                    <p className="text-sm font-semibold text-slate-200">{addressText(current.address)}</p>
                  </div>

                  {/* Navigation row: Waze & Google Maps */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => waze(current)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 font-black text-white shadow-md active:scale-95"
                    >
                      <Navigation size={17} /> Waze
                    </button>
                    <button
                      type="button"
                      onClick={() => googleMaps(current)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 font-black text-white shadow-sm hover:bg-white/10 active:scale-95"
                    >
                      <MapIcon size={17} /> Google Maps
                    </button>
                  </div>

                  {current.customer_phone && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`tel:${current.customer_phone.replace(/[^+\d]/g, '')}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 font-bold text-white hover:bg-white/10"
                        >
                          <Phone size={16} /> Ligar
                        </a>
                        <button
                          type="button"
                          onClick={() => whatsapp(current)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500"
                        >
                          <MessageCircle size={16} /> WhatsApp
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            whatsapp(
                              current,
                              `Olá, ${current.customer_name}! Aqui é o motoboy da Tia Val. Já saí com sua marmita e chego em ~10 min!`,
                            )
                          }
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-center text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          🛵 &quot;A caminho (~10m)&quot;
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            whatsapp(
                              current,
                              `Olá, ${current.customer_name}! Cheguei no portão com seu pedido #${current.code}. Pode atender?`,
                            )
                          }
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-center text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          🚪 &quot;Cheguei no portão!&quot;
                        </button>
                      </div>
                    </div>
                  )}

                  {current.order_status !== 'pronto_entrega' && <Steps order={current} />}
                </div>

                <div className={`${card} p-4 space-y-2`}>
                  <p className="font-bold text-sm">Estimar horário de chegada</p>
                  <p className="text-xs text-slate-400">
                    O cliente verá essa previsão no acompanhamento. Atual: {etaText(current.estimated_delivery_at)}
                  </p>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[15, 30, 45, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={busy === current.id}
                        onClick={() => void estimateDelivery(current, m)}
                        className="min-h-11 rounded-xl border border-white/15 bg-slate-900/60 text-xs font-extrabold hover:border-red-400 hover:bg-red-500/10 active:scale-95 disabled:opacity-50"
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>

                <ActionArea order={current} />

                {routeOrders.length > 1 && (
                  <div className={`${card} p-3`}>
                    <p className="mb-2 text-xs font-bold text-slate-400">Outras paradas na rota</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {routeOrders
                        .filter((o) => o.id !== current.id)
                        .map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setSelectedId(o.id)}
                            className="shrink-0 rounded-full border border-white/15 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                          >
                            #{o.code} · {neighborhoodOf(o) || 'Parada'}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={`${card} px-5 py-10 text-center text-sm text-slate-400`}>
                Nenhuma entrega pronta ou em rota agora.
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB: GANHOS ======================= */}
        {tab === 'ganhos' && (
          <div className="space-y-4">
            <header className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-black">Ganhos</h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label="Alternar tema"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300"
                >
                  {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
                </button>
                <span className="rounded-full bg-red-600 px-3.5 py-1 text-xs font-black text-white shadow">
                  Hoje
                </span>
              </div>
            </header>

            <div className={`${card} p-5 bg-gradient-to-br from-[#131d2d] to-[#0c121e]`}>
              <p className="text-xs font-bold text-slate-400">Total do dia (taxas de entrega)</p>
              <p className="mt-1 text-4xl font-black text-emerald-400">{currency(dailyEarnings)}</p>
              <p className="mt-2 text-xs text-slate-500">
                Soma das taxas das entregas concluídas hoje no sistema.
              </p>
            </div>

            <div>
              <p className="mb-2 font-bold text-sm">Entregas concluídas hoje</p>
              {serverCompleted.length === 0 ? (
                <div className={`${card} px-5 py-8 text-center text-sm text-slate-400`}>
                  Nenhuma entrega concluída hoje.
                </div>
              ) : (
                <div className={`${card} divide-y divide-white/10`}>
                  {serverCompleted.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                        <div className="min-w-0">
                          <p className="font-bold text-sm">
                            Pedido #{c.code} · {c.customer_name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {new Date(c.at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {addressText(c.address)}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 font-black text-emerald-400">{currency(c.fee)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================= BOTTOM NAVIGATION BAR (PIQUE IFOOD) ======================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-[500] border-t border-white/10 bg-[#070b13]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 flex-col items-center justify-center py-1 transition active:scale-95 ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon size={22} className={active ? 'text-red-500' : 'text-slate-400'} />
                  {typeof t.badge === 'number' && t.badge > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className={`mt-1 text-[11px] font-bold ${active ? 'text-white' : 'text-slate-400'}`}>
                  {t.label}
                </span>
                {/* Active Red Underline Bar */}
                {active && (
                  <span className="mt-1 h-0.5 w-7 rounded-full bg-red-600 animate-in fade-in zoom-in-75 duration-200" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal / Sheet for Order Details */}
      {detailsOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[700] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4"
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
              {detailsOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs text-slate-300">
                  <span>
                    {it.quantity}× {it.meal_name} ({it.size_label})
                  </span>
                  {it.notes && <span className="text-amber-300 italic">{it.notes}</span>}
                </div>
              ))}
            </div>

            <div className={`rounded-xl p-3 text-center text-xs font-black ${paymentReminder(detailsOrder).tone}`}>
              {paymentReminder(detailsOrder).label}
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

      {/* Success Dialog when delivery finished */}
      {success && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[700] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
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
