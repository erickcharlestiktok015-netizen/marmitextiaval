import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bike, Bell, CheckCircle2, ChevronRight, Clock3, Home, ListOrdered, LogOut, MapPin, Map as MapIcon, Navigation, PackageCheck, Phone, MessageCircle, RefreshCw, Route as RouteIcon, Wallet, Wifi, WifiOff, AlertTriangle, X, Hand } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type Delivery = {
  id: string; code: string; customer_name: string; customer_phone: string; address: unknown;
  order_status: string; payment_method: string; payment_status: string; total: number; delivery_fee?: number;
  estimated_delivery_at: string | null; courier_status: string; created_at: string;
  confirmation_code: string | null; items: Array<{ meal_name: string; size_label: string; quantity: number; notes?: string }>;
};
type Geo = { latitude: number; longitude: number };
type Tab = 'inicio' | 'pedidos' | 'mapa' | 'ganhos';
type Filter = 'todos' | 'preparo' | 'prontos';
type CompletedDelivery = { id: string; code: string; fee: number; at: string };

const coords = (address: unknown): Geo | null => {
  if (!address || typeof address !== 'object') return null;
  const a = address as Record<string, unknown>;
  const latitude = Number(a['latitude'] ?? a['lat']), longitude = Number(a['longitude'] ?? a['lng'] ?? a['lon']);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
};
// Fórmula de Haversine: distância em linha reta entre dois pontos do GPS.
const distance = (a: Geo, b: Geo) => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude-a.latitude), dLon = rad(b.longitude-a.longitude);
  const x = Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
};
const addressText = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'Endereço não informado';
  const a = value as Record<string, unknown>;
  return [a['street'] ?? a['rua'], a['number'] ?? a['numero'], a['complement'] ?? a['complemento'], a['reference'] ?? a['referencia'], a['bairro'], a['cidade'], a['state'] ?? a['estado'] ?? a['uf'], a['cep']].filter(Boolean).join(', ') || 'Endereço não informado';
};
const etaText = (value: string | null) => value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'A combinar';
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paymentLabel = (m: string) => m === 'online' ? 'Pago online' : m === 'entrega-pix' ? 'Pix na entrega' : m === 'entrega-cartao' ? 'Cartão na entrega' : m === 'entrega-dinheiro' ? 'Dinheiro na entrega' : m;
const isPrep = (o: Delivery) => ['novo', 'confirmado', 'preparando'].includes(o.order_status);
const isRouteable = (o: Delivery) => ['pronto_entrega', 'saiu_entrega'].includes(o.order_status);
const fortalezaDay = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const COMPLETED_KEY = 'tia-val-courier-completed';
const IOS_DENIED = "Localização bloqueada. No iPhone, acesse Ajustes > Safari > Localização e selecione 'Permitir'.";

const statusInfo = (o: Delivery) => {
  if (o.courier_status === 'cheguei') return { label: 'Chegou ao cliente', cls: 'bg-amber-400/15 text-amber-300' };
  if (o.order_status === 'saiu_entrega') return { label: 'Em rota', cls: 'bg-sky-400/15 text-sky-300' };
  if (o.order_status === 'pronto_entrega') return { label: 'Pronto para entrega', cls: 'bg-emerald-400/15 text-emerald-300' };
  if (o.order_status === 'preparando') return { label: 'Em preparo', cls: 'bg-orange-400/15 text-orange-300' };
  if (o.order_status === 'confirmado') return { label: 'Confirmado', cls: 'bg-orange-400/15 text-orange-300' };
  return { label: 'Pedido novo', cls: 'bg-slate-500/20 text-slate-300' };
};

export const Route = createFileRoute('/motoboy/entregas')({
  head: () => ({ meta: [{ title: 'Entregas | Tia Val Entregas' }, { name: 'theme-color', content: '#070b12' }], links: [{ rel: 'manifest', href: '/manifest-motoboy.webmanifest' }, { rel: 'apple-touch-icon', href: '/icons/motoboy-180.png' }, { rel: 'icon', type: 'image/png', href: '/icons/motoboy-192.png' }] }),
  component: CourierDeliveries,
});

function CourierDeliveries() {
  const [orders, setOrders] = useState<Delivery[]>([]);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [location, setLocation] = useState<Geo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmation, setConfirmation] = useState<Record<string, string>>({});
  const [geoMessage, setGeoMessage] = useState('Ative a localização para ordenar por proximidade.');
  const [geoDenied, setGeoDenied] = useState(false);
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
  const loadingRef = useRef(false);
  const routeDataRef = useRef({ orders, location });
  routeDataRef.current = { orders, location };

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch('/api/courier/orders', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({})) as { orders?: Delivery[]; dailyEarnings?: number; error?: string };
      if (response.status === 401) { window.location.assign('/motoboy'); return; }
      if (!response.ok) throw new Error((data.error || 'Falha ao carregar entregas.') + ' (HTTP ' + response.status + ')');
      setOrders(data.orders || []); setDailyEarnings(Number.isFinite(data.dailyEarnings) ? Number(data.dailyEarnings) : 0); setUpdated(new Date().toLocaleTimeString('pt-BR')); setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar entregas. Verifique a conexão e tente novamente.');
    } finally {
      loadingRef.current = false;
      setLoaded(true);
    }
  }, []);
  const loadPresence = useCallback(async () => {
    try {
      const response = await fetch('/api/courier/presence', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({})) as { is_online?: boolean; error?: string };
      if (response.status === 401) { setPresenceError('Sua sessão expirou. Entre novamente para alterar sua disponibilidade.'); return; }
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a disponibilidade.');
      setIsOnline(Boolean(data.is_online));
      setPresenceError('');
    } catch (e) {
      setPresenceError(e instanceof Error ? e.message : 'Não foi possível consultar a disponibilidade.');
    }
  }, []);

  // Entregas concluídas hoje neste aparelho (o total oficial vem do servidor em dailyEarnings).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COMPLETED_KEY) || '{}') as { day?: string; list?: CompletedDelivery[] };
      if (saved.day === fortalezaDay() && Array.isArray(saved.list)) setCompleted(saved.list);
    } catch { /* storage indisponível */ }
  }, []);
  const rememberCompleted = (item: CompletedDelivery) => setCompleted(current => {
    const next = [item, ...current.filter(c => c.id !== item.id)];
    try { window.localStorage.setItem(COMPLETED_KEY, JSON.stringify({ day: fortalezaDay(), list: next })); } catch { /* ok */ }
    return next;
  });

  useEffect(() => {
    void load();
    void loadPresence();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') { void load(); void loadPresence(); }
    }, 5000);
    const onVisibility = () => { if (document.visibilityState === 'visible') { void load(); void loadPresence(); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [load, loadPresence]);

  const prepCount = orders.filter(isPrep).length;
  const readyCount = orders.filter(o => o.order_status === 'pronto_entrega').length;
  const activeCount = orders.filter(o => o.order_status === 'saiu_entrega').length;

  // Sequência aproximada por vizinho mais próximo, usando as coordenadas disponíveis.
  // A distância é em linha reta; o trânsito e o trajeto real são calculados pelo Waze.
  const ordered = useMemo(() => {
    const active = orders.filter(o => o.order_status === 'saiu_entrega');
    const ready = orders.filter(o => o.order_status === 'pronto_entrega');
    const waiting = orders.filter(o => ['novo', 'confirmado', 'preparando'].includes(o.order_status)).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const nearestSequence = (input: Delivery[], origin: Geo | null) => {
      const remaining = [...input];
      const result: Delivery[] = [];
      let current = origin;
      while (remaining.length) {
        if (!current) {
          remaining.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          result.push(...remaining); break;
        }
        let bestIndex = -1, bestDistance = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const point = coords(remaining[i]!.address);
          const d = point ? distance(current, point) : Infinity;
          if (d < bestDistance) { bestDistance = d; bestIndex = i; }
        }
        if (bestIndex < 0) {
          remaining.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          result.push(...remaining); break;
        }
        const next = remaining.splice(bestIndex, 1)[0]!;
        result.push(next); current = coords(next.address);
      }
      // Melhora a sequência inicial com 2-opt: reverte trechos quando isso
      // reduz a distância total em linha reta entre a origem e as paradas.
      // É uma estimativa geométrica; não substitui distâncias reais de ruas/trânsito.
      if (result.length >= 4 && result.every(order => coords(order.address))) {
        const routeDistance = (route: Delivery[]) => {
          let total = 0;
          let from = origin;
          for (const order of route) {
            const to = coords(order.address)!;
            if (from) total += distance(from, to);
            from = to;
          }
          return total;
        };
        let improved = true;
        let passes = 0;
        while (improved && passes < 12) {
          improved = false;
          passes++;
          for (let i = 0; i < result.length - 2; i++) {
            for (let k = i + 1; k < result.length - 1; k++) {
              const candidate = [...result.slice(0, i), ...result.slice(i, k + 1).reverse(), ...result.slice(k + 1)];
              if (routeDistance(candidate) + 0.05 < routeDistance(result)) {
                result.splice(0, result.length, ...candidate);
                improved = true;
              }
            }
          }
        }
      }
      return result;
    };
    const activeOrdered = nearestSequence(active, location);
    const lastActive = activeOrdered.length ? coords(activeOrdered[activeOrdered.length - 1]!.address) : location;
    const routeOrders = [...activeOrdered, ...nearestSequence(ready, lastActive)];
    if (roadOrderIds.length > 1) {
      const byId = new Map(routeOrders.map(order => [order.id, order]));
      const optimized = roadOrderIds.map(id => byId.get(id)).filter((order): order is Delivery => Boolean(order));
      const optimizedIds = new Set(optimized.map(order => order.id));
      return [...optimized, ...routeOrders.filter(order => !optimizedIds.has(order.id)), ...waiting];
    }
    return [...routeOrders, ...waiting];
  }, [orders, location, roadOrderIds]);

  const routeOptimizationKey = [
    location ? `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}` : 'no-gps',
    ...orders
      .filter(order => ['pronto_entrega', 'saiu_entrega'].includes(order.order_status) && coords(order.address))
      .map(order => {
        const point = coords(order.address)!;
        return `${order.id}:${order.order_status}:${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
      })
      .sort(),
  ].join('|');

  // Usa distâncias reais entre ruas (OSRM) para ordenar as entregas prontas/em rota.
  // A chave estável evita consultar o serviço a cada atualização automática de 5 segundos.
  // Se GPS ou serviço de rotas estiver indisponível, mantém a sequência aproximada acima.
  useEffect(() => {
    let cancelled = false;
    const { orders: latestOrders, location: latestLocation } = routeDataRef.current;
    const candidates = latestOrders.filter(order =>
      ['pronto_entrega', 'saiu_entrega'].includes(order.order_status) && coords(order.address),
    );
    if (!latestLocation || candidates.length < 2) {
      setRoadOrderIds([]);
      setRouteCalculation(latestLocation ? 'Ative a localização e tenha pelo menos duas entregas com endereço localizado para otimizar pelas ruas.' : 'Ative o GPS para otimizar a rota pelas ruas.');
      return () => { cancelled = true; };
    }
    const stops = candidates.slice(0, 20);
    const points = [latestLocation, ...stops.map(order => coords(order.address)!)];
    const coordinateList = points.map(point => `${point.longitude},${point.latitude}`).join(';');
    setRouteCalculation('Calculando sequência pelas ruas…');
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/table/v1/driving/${coordinateList}?annotations=distance`,
          { signal: controller.signal, cache: 'no-store' },
        );
        if (!response.ok) throw new Error('Serviço de rotas indisponível');
        const data = await response.json() as { code?: string; distances?: Array<Array<number | null>> };
        if (data.code !== 'Ok' || !Array.isArray(data.distances)) throw new Error('Matriz de ruas inválida');
        const matrix = data.distances;
        const remaining = stops.map((_, index) => index + 1);
        const sequence: number[] = [];
        let current = 0;
        while (remaining.length) {
          let bestAt = 0, bestDistance = Infinity;
          for (let i = 0; i < remaining.length; i++) {
            const d = matrix[current]?.[remaining[i]!];
            if (typeof d === 'number' && d < bestDistance) { bestDistance = d; bestAt = i; }
          }
          const next = remaining.splice(bestAt, 1)[0]!;
          sequence.push(next);
          current = next;
        }
        const routeLength = (indexes: number[]) => {
          let total = 0, from = 0;
          for (const to of indexes) {
            const d = matrix[from]?.[to];
            if (typeof d !== 'number') return Infinity;
            total += d;
            from = to;
          }
          return total;
        };
        let improved = true, passes = 0;
        while (improved && passes < 8 && sequence.length >= 4) {
          improved = false;
          passes++;
          for (let i = 0; i < sequence.length - 2; i++) {
            for (let k = i + 1; k < sequence.length - 1; k++) {
              const candidate = [...sequence.slice(0, i), ...sequence.slice(i, k + 1).reverse(), ...sequence.slice(k + 1)];
              if (routeLength(candidate) + 25 < routeLength(sequence)) {
                sequence.splice(0, sequence.length, ...candidate);
                improved = true;
              }
            }
          }
        }
        if (cancelled) return;
        setRoadOrderIds(sequence.map(index => stops[index - 1]!.id));
        setRouteCalculation(`Sequência otimizada pelas ruas para ${stops.length} entrega(s); demais paradas ficam depois, com ordem aproximada.`);
      } catch {
        if (cancelled) return;
        setRoadOrderIds([]);
        setRouteCalculation('O serviço de rotas por ruas não respondeu. Mantive a sequência aproximada e o Waze continua disponível.');
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  // Os dados atuais são lidos por ref; só recalcula quando a localização (arredondada) ou a fila muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOptimizationKey]);

  const estimatedRouteKm = useMemo(() => {
    let current = location, total = 0;
    for (const order of ordered.filter(o => ['pronto_entrega', 'saiu_entrega'].includes(o.order_status))) {
      const point = coords(order.address);
      if (current && point) total += distance(current, point);
      if (point) current = point;
    }
    return total;
  }, [ordered, location]);

  const sendLocation = async (point: Geo) => {
    try { await fetch('/api/courier/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'location', ...point }) }); } catch { /* next GPS update retries */ }
  };
  const geoErrorMessage = (err: GeolocationPositionError) => {
    if (err.code === 1) { setGeoDenied(true); return IOS_DENIED; }
    if (err.code === 3) return 'O GPS demorou para responder. Vá para um lugar aberto e toque em "Ativar GPS" de novo.';
    return 'Não foi possível obter sua localização. Verifique se o GPS do celular está ligado.';
  };
  // IMPORTANTE (iPhone/Safari): esta função precisa ser chamada de forma SÍNCRONA
  // dentro do toque do usuário, antes de qualquer await. Se for chamada depois de um
  // fetch, o Safari perde o contexto do clique e bloqueia o pedido de permissão.
  const getLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoMessage('Este celular não oferece localização pelo navegador.'); return; }
    setGeoMessage('Obtendo localização…');
    navigator.geolocation.getCurrentPosition(pos => {
      const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(point); setGeoDenied(false);
      setGeoMessage('GPS ativo. Entregas ordenadas pela proximidade.');
      void sendLocation(point);
    }, err => setGeoMessage(geoErrorMessage(err)), { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  };
  const hasActive = orders.some(o => o.order_status === 'saiu_entrega');
  useEffect(() => {
    if (!location || !hasActive) return;
    const watch = navigator.geolocation?.watchPosition(pos => {
      const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(point); void sendLocation(point);
    }, err => setGeoMessage(err.code === 1 ? geoErrorMessage(err) : 'O GPS foi pausado. Verifique a permissão de localização.'), { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 });
    return () => { if (watch !== undefined) navigator.geolocation.clearWatch(watch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(location), hasActive]);

  const togglePresence = async () => {
    const goingOnline = !isOnline;
    // Pede o GPS no mesmo toque, antes do await (exigência do Safari no iPhone).
    if (goingOnline) getLocation();
    setPresenceBusy(true);
    setPresenceError('');
    try {
      const response = await fetch('/api/courier/presence', {
        method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ is_online: goingOnline }),
      });
      const data = await response.json().catch(() => ({})) as { is_online?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar sua disponibilidade.');
      setIsOnline(Boolean(data.is_online));
    } catch (e) {
      setPresenceError(e instanceof Error ? e.message : 'Não foi possível alterar sua disponibilidade.');
    } finally {
      setPresenceBusy(false);
    }
  };

  const action = async (order: Delivery, next: 'start'|'arrived'|'delivered') => {
    // Ao iniciar a entrega, o GPS é pedido já no toque (antes do fetch) para funcionar no iPhone.
    if (next === 'start') getLocation();
    setBusy(order.id); setError('');
    try {
      const body: Record<string, unknown> = { id: order.id, action: next };
      if (next === 'delivered') body['code'] = confirmation[order.id] || '';
      const response = await fetch('/api/courier/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a entrega.');
      if (next === 'delivered') {
        const fee = Number(order.delivery_fee);
        const done = { id: order.id, code: order.code, fee: Number.isFinite(fee) && fee > 0 ? fee : 0, at: new Date().toISOString() };
        rememberCompleted(done);
        setSuccess(done);
        setConfirmation(v => ({ ...v, [order.id]: '' }));
      }
      if (next === 'start') { setSelectedId(order.id); setDetailsId(null); setTab('mapa'); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro na entrega.'); }
    finally { setBusy(''); }
  };
  const estimateDelivery = async (order: Delivery, minutes: number) => {
    setBusy(order.id); setError('');
    try {
      const response = await fetch('/api/courier/orders', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ id: order.id, action: 'estimate', minutes }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a previsão.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao estimar a entrega.'); }
    finally { setBusy(''); }
  };
  const waze = (order: Delivery) => {
    const point = coords(order.address);
    const destination = point ? `ll=${point.latitude},${point.longitude}&navigate=yes` : `q=${encodeURIComponent(addressText(order.address))}&navigate=yes`;
    window.open(`https://waze.com/ul?${destination}`, '_blank', 'noopener,noreferrer');
  };
  const googleMaps = (order: Delivery) => {
    const point = coords(order.address);
    const destination = point ? `${point.latitude},${point.longitude}` : encodeURIComponent(addressText(order.address));
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`, '_blank', 'noopener,noreferrer');
  };
  const whatsapp = (order: Delivery) => {
    const phone = order.customer_phone.replace(/\D/g, '');
    if (!phone) return;
    const normalized = phone.startsWith('55') ? phone : '55' + phone;
    const message = 'Olá, ' + order.customer_name + '! Aqui é o motoboy da Tia Val sobre o pedido #' + order.code + '.';
    window.open('https://wa.me/' + normalized + '?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
  };
  // "Ajustar ordem": usa o GPS (pedido no toque) para sequenciar da mais perto para a mais longe.
  const adjustOrder = () => {
    getLocation();
    setFilter('todos');
  };
  const logout = async () => {
    try { await fetch('/api/courier/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }); }
    finally { window.location.assign('/motoboy'); }
  };

  const routeOrders = ordered.filter(isRouteable);
  const current = (selectedId && orders.find(o => o.id === selectedId && isRouteable(o))) || routeOrders.find(o => o.order_status === 'saiu_entrega') || routeOrders[0] || null;
  const nextDelivery = routeOrders[0] || ordered[0] || null;
  const detailsOrder = detailsId ? orders.find(o => o.id === detailsId) || null : null;
  const filtered = ordered.filter(o => filter === 'todos' ? true : filter === 'preparo' ? isPrep(o) : isRouteable(o));
  const kmTo = (o: Delivery) => { const p = coords(o.address); return location && p ? `${distance(location, p).toFixed(1)} km` : null; };
  const mapCenter = (current && coords(current.address)) || location;
  const mapSrc = mapCenter ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.longitude-0.02}%2C${mapCenter.latitude-0.014}%2C${mapCenter.longitude+0.02}%2C${mapCenter.latitude+0.014}&layer=mapnik&marker=${mapCenter.latitude}%2C${mapCenter.longitude}` : '';
  const stepOf = (o: Delivery) => o.courier_status === 'cheguei' ? 3 : o.order_status === 'saiu_entrega' ? 2 : 0;

  const card = 'rounded-2xl border border-white/10 bg-[#101722]';
  const primaryBtn = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 font-extrabold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400 disabled:opacity-50';
  const ghostBtn = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 font-bold text-slate-100 transition hover:bg-white/10 disabled:opacity-50';

  const ErrorBox = () => error ? <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null;
  const GeoBox = () => geoDenied ? <div role="alert" className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><span>{IOS_DENIED}</span></div> : null;

  const ActionArea = ({ order }: { order: Delivery }) => {
    if (order.courier_status === 'cheguei') return <div className={`${card} p-4`}>
      <p className="font-bold">Código de confirmação</p>
      <p className="mt-1 text-sm text-slate-400">Peça ao cliente o código de 6 dígitos.</p>
      <div className="mt-4 flex justify-center">
        <InputOTP maxLength={6} inputMode="numeric" pattern="^[0-9]*$" value={confirmation[order.id] || ''} onChange={v => setConfirmation(c => ({ ...c, [order.id]: v.replace(/\D/g, '').slice(0, 6) }))}>
          <InputOTPGroup className="gap-2">
            {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="h-12 w-11 rounded-xl border border-white/15 bg-[#080d16] text-xl font-black text-white first:rounded-xl last:rounded-xl"/>)}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <button disabled={busy === order.id || (confirmation[order.id] || '').length !== 6} onClick={() => void action(order, 'delivered')} className={`${primaryBtn} mt-4`}><CheckCircle2 size={18}/> {busy === order.id ? 'Confirmando…' : 'Confirmar entrega'}</button>
      {(confirmation[order.id] || '').length > 0 && <button type="button" onClick={() => setConfirmation(c => ({ ...c, [order.id]: '' }))} className={`${ghostBtn} mt-2`}>Alterar código</button>}
    </div>;
    if (order.order_status === 'saiu_entrega') return <button disabled={busy === order.id} onClick={() => void action(order, 'arrived')} className={primaryBtn}><MapPin size={18}/> Cheguei ao endereço</button>;
    if (order.order_status === 'pronto_entrega') return <button disabled={busy === order.id} onClick={() => void action(order, 'start')} className={primaryBtn}><Navigation size={18}/> Iniciar entrega e compartilhar GPS</button>;
    return <p className="rounded-xl bg-white/[.04] p-3 text-center text-sm font-semibold text-slate-400">Aguardando a cozinha. Você poderá iniciar quando o pedido estiver "Pronto para entrega".</p>;
  };

  const Steps = ({ order }: { order: Delivery }) => {
    const step = stepOf(order);
    const labels = ['Retirou', 'Em rota', 'Cheguei', 'Entregue'];
    return <div className="mt-4">
      <div className="flex items-center">
        {labels.map((_, i) => <div key={i} className="flex flex-1 items-center last:flex-none">
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${i < step ? 'bg-emerald-400 text-[#06120b]' : i === step ? 'bg-red-500 text-white ring-4 ring-red-500/20' : 'bg-slate-700 text-slate-400'}`}>{i < step ? '✓' : i + 1}</span>
          {i < labels.length - 1 && <span className={`mx-1 h-1 flex-1 rounded-full ${i < step - 1 ? 'bg-emerald-400' : 'bg-slate-700'}`}/>}
        </div>)}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400">{labels.map((l, i) => <span key={l} className={i === step || i === step - 1 ? 'text-slate-100' : ''}>{l}</span>)}</div>
    </div>;
  };

  const OrderCard = ({ order, highlight }: { order: Delivery; highlight?: boolean }) => {
    const s = statusInfo(order);
    const km = kmTo(order);
    return <article className={`rounded-2xl border p-4 ${highlight ? 'border-red-500/70 bg-gradient-to-br from-[#2a0f17] to-[#101722]' : 'border-white/10 bg-[#101722]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>
          <p className="mt-2 text-sm text-slate-400">#{order.code} · {new Date(order.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
          <p className="mt-0.5 truncate font-bold">{order.customer_name}</p>
          <p className="mt-0.5 truncate text-sm text-slate-400">{order.items.map(i => `${i.quantity}× ${i.meal_name}`).join(' · ')}</p>
        </div>
        <div className="shrink-0 text-right"><p className="font-black">{currency(Number(order.total))}</p>{km && <p className="mt-1 text-sm text-slate-400">{km}</p>}</div>
      </div>
      <p className="mt-3 flex gap-2 text-sm text-slate-300"><MapPin size={16} className="mt-0.5 shrink-0 text-red-400"/><span className="min-w-0">{addressText(order.address)}</span></p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDetailsId(order.id)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/15 text-sm font-bold hover:bg-white/5">Ver detalhes <ChevronRight size={16}/></button>
        {order.order_status === 'pronto_entrega'
          ? <button type="button" disabled={busy === order.id} onClick={() => void action(order, 'start')} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-red-500 text-sm font-extrabold text-white hover:bg-red-400 disabled:opacity-50"><Navigation size={15}/> Iniciar rota</button>
          : order.order_status === 'saiu_entrega'
            ? <button type="button" onClick={() => { setSelectedId(order.id); setTab('mapa'); }} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-sky-500 text-sm font-extrabold text-slate-950 hover:bg-sky-400"><MapIcon size={15}/> Ver rota</button>
            : <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/[.04] text-xs font-semibold text-slate-500">Aguardando cozinha</span>}
      </div>
    </article>;
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Home; badge?: number }> = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'pedidos', label: 'Pedidos', icon: ListOrdered, badge: readyCount + activeCount },
    { id: 'mapa', label: 'Mapa', icon: MapIcon },
    { id: 'ganhos', label: 'Ganhos', icon: Wallet },
  ];

  return <main className="courier-screen min-h-screen bg-[#070b12] text-slate-100" data-courier-theme="dark">
    <div className="mx-auto max-w-lg px-4 pb-28 pt-5">
      {tab === 'inicio' && <div className="space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icons/motoboy-192.png" alt="Tia Val Motoboy" className="h-12 w-12 shrink-0 rounded-2xl object-cover"/>

            <div className="min-w-0"><p className="truncate text-lg font-black"><span className="text-red-500">Tia Val</span> · Motoboy</p><p className="truncate text-xs text-slate-400">Entregas rápidas · Com segurança</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setTab('pedidos')} aria-label="Pedidos prontos" className="relative rounded-xl p-2.5 text-slate-300 hover:bg-white/5"><Bell size={20}/>{readyCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"/>}</button>
            <button type="button" onClick={() => void logout()} aria-label="Sair" className="rounded-xl p-2.5 text-slate-300 hover:bg-white/5"><LogOut size={20}/></button>
          </div>
        </header>
        <div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${isOnline ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-700/60 text-slate-300'}`}><span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`}/>{isOnline ? 'Online' : 'Offline'}</span>
          <h1 className="mt-3 flex items-center gap-2 text-3xl font-black">Olá, parceiro! <Hand size={26} className="text-amber-300"/></h1>
          <p className="mt-1 text-slate-400">{isOnline ? 'Bora fazer mais entregas hoje?' : 'Fique online quando estiver pronto para rodar.'}</p>
        </div>
        <button type="button" onClick={() => void togglePresence()} disabled={presenceBusy} className={isOnline ? ghostBtn : primaryBtn}>{isOnline ? <WifiOff size={18}/> : <Wifi size={18}/>}{presenceBusy ? 'Salvando…' : isOnline ? 'Ficar offline' : 'Ficar online e ativar GPS'}</button>
        {presenceError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{presenceError}</p>}
        <GeoBox/>
        <div className={`${card} grid grid-cols-3 divide-x divide-white/10`}>
          <div className="p-3"><p className="text-xs text-slate-400">Na fila</p><p className="mt-1 text-2xl font-black">{orders.length}</p></div>
          <div className="p-3"><p className="text-xs text-slate-400">Ganhos do dia</p><p className="mt-1 text-lg font-black">{currency(dailyEarnings)}</p></div>
          <div className="p-3"><p className="text-xs text-slate-400">Em rota</p><p className="mt-1 text-2xl font-black">{activeCount}</p></div>
        </div>
        {nextDelivery ? <div className="rounded-2xl border border-red-500/60 bg-gradient-to-br from-[#2a0f17] via-[#1a1016] to-[#101722] p-4">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Próxima entrega</p>
          <p className="mt-2 text-xl font-black">Pedido #{nextDelivery.code}</p>
          <p className="text-sm text-slate-300">{nextDelivery.customer_name}</p>
          <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusInfo(nextDelivery).cls}`}>{statusInfo(nextDelivery).label}</span>
          <p className="mt-3 flex gap-2 text-sm text-slate-300"><MapPin size={16} className="mt-0.5 shrink-0 text-red-400"/>{addressText(nextDelivery.address)}{kmTo(nextDelivery) ? ` · ${kmTo(nextDelivery)}` : ''}</p>
          <div className="mt-4">{isRouteable(nextDelivery) && nextDelivery.order_status === 'saiu_entrega'
            ? <button type="button" onClick={() => { setSelectedId(nextDelivery.id); setTab('mapa'); }} className={primaryBtn}>Abrir rota <ChevronRight size={18}/></button>
            : nextDelivery.order_status === 'pronto_entrega'
              ? <button type="button" disabled={busy === nextDelivery.id} onClick={() => void action(nextDelivery, 'start')} className={primaryBtn}><Navigation size={18}/> Iniciar entrega</button>
              : <button type="button" onClick={() => setDetailsId(nextDelivery.id)} className={primaryBtn}>Ver detalhes <ChevronRight size={18}/></button>}</div>
        </div> : <div className={`${card} px-5 py-10 text-center`}><PackageCheck className="mx-auto text-slate-500" size={34}/><p className="mt-3 font-bold">{loaded ? 'Nenhuma entrega na fila' : 'Carregando entregas…'}</p><p className="mt-1 text-sm text-slate-400">Os pedidos aparecem aqui assim que forem registrados.</p></div>}
        <div className={`${card} p-4`}>
          <p className="flex items-center gap-2 font-bold"><Clock3 size={18} className="text-red-400"/> Resumo do turno</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-xs text-slate-400">Em preparo</p><p className="text-xl font-black">{prepCount}</p></div>
            <div><p className="text-xs text-slate-400">Prontos</p><p className="text-xl font-black">{readyCount}</p></div>
            <div><p className="text-xs text-slate-400">Expediente</p><p className="text-xl font-black">11h–14h</p></div>
          </div>
        </div>
        <ErrorBox/>
      </div>}

      {tab === 'pedidos' && <div className="space-y-4">
        <header className="flex items-center justify-between"><h1 className="text-2xl font-black">Pedidos</h1><button type="button" onClick={() => void load()} aria-label="Atualizar" className="rounded-xl p-2.5 text-slate-300 hover:bg-white/5"><RefreshCw size={20}/></button></header>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([['todos', `Todos (${orders.length})`], ['preparo', `Em preparo (${prepCount})`], ['prontos', `Prontos (${readyCount + activeCount})`]] as Array<[Filter, string]>).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${filter === id ? 'bg-red-500 text-white' : 'border border-white/15 text-slate-300'}`}>{label}</button>)}
        </div>
        <div className={`${card} p-3`}>
          <button type="button" onClick={adjustOrder} className={primaryBtn}><RouteIcon size={18}/> Ajustar ordem (mais perto primeiro)</button>
          <p className="mt-2 text-xs text-slate-400">{geoMessage}</p>
          {routeCalculation && <p className="mt-1 text-xs text-slate-500">{routeCalculation}{updated && ` · Atualizado às ${updated}`}</p>}
        </div>
        <GeoBox/>
        <ErrorBox/>
        {filtered.length === 0 && <div className={`${card} px-5 py-10 text-center text-sm text-slate-400`}>Nenhum pedido neste filtro.</div>}
        <div className="space-y-3">{filtered.map((o, i) => <OrderCard key={o.id} order={o} highlight={i === 0 && isRouteable(o)}/>)}</div>
      </div>}

      {tab === 'mapa' && <div className="space-y-4">
        <header><h1 className="text-2xl font-black">{current ? (current.courier_status === 'cheguei' ? 'Chegou' : current.order_status === 'saiu_entrega' ? 'Em rota' : 'Próxima rota') : 'Mapa'}</h1>{current && <p className="text-sm text-slate-400">Pedido #{current.code}</p>}</header>
        <div className="relative h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1420]">
          {mapSrc ? <iframe title="Mapa da entrega" src={mapSrc} className="h-full w-full border-0 opacity-90" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><MapPin size={34} className="text-red-400"/><p className="mt-2 font-bold">Ative o GPS para ver o mapa</p><button type="button" onClick={getLocation} className="mt-3 rounded-xl bg-red-500 px-4 py-2.5 font-bold text-white">Ativar GPS</button></div>}
          {current && kmTo(current) && <span className="absolute right-3 top-3 rounded-xl bg-[#080d16]/90 px-3 py-1.5 text-sm font-bold">{kmTo(current)}</span>}
          <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-[#080d16]/90 px-3 py-1.5 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${location ? 'bg-emerald-400' : 'bg-amber-400'}`}/>{location ? (hasActive ? 'Compartilhando localização' : 'GPS conectado') : 'GPS aguardando'}</span>
        </div>
        <GeoBox/>
        <ErrorBox/>
        {current ? <>
          <div className={`${card} p-4`}>
            <p className="text-xs text-slate-400">Cliente</p>
            <p className="font-bold">{current.customer_name}</p>
            <p className="mt-2 text-xs text-slate-400">Endereço</p>
            <p className="text-sm">{addressText(current.address)}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => waze(current)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-500 font-bold text-white hover:bg-red-400"><Navigation size={17}/> Waze</button>
              <button type="button" onClick={() => googleMaps(current)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 font-bold hover:bg-white/5"><MapIcon size={17}/> Google Maps</button>
              {current.customer_phone && <>
                <a href={`tel:${current.customer_phone.replace(/[^+\d]/g, '')}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 font-bold hover:bg-white/5"><Phone size={17}/> Ligar</a>
                <button type="button" onClick={() => whatsapp(current)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500"><MessageCircle size={17}/> WhatsApp</button>
              </>}
            </div>
            {current.order_status !== 'pronto_entrega' && <Steps order={current}/>}
          </div>
          <div className={`${card} p-4`}>
            <p className="font-bold">Estimar horário de chegada</p>
            <p className="mt-1 text-xs text-slate-400">O cliente verá essa previsão. Atual: {etaText(current.estimated_delivery_at)}</p>
            <div className="mt-3 grid grid-cols-4 gap-2">{[15, 30, 45, 60].map(m => <button key={m} type="button" disabled={busy === current.id} onClick={() => void estimateDelivery(current, m)} className="min-h-11 rounded-xl border border-white/15 text-sm font-extrabold hover:border-red-400 hover:bg-red-500/10 disabled:opacity-50">{m} min</button>)}</div>
          </div>
          <ActionArea order={current}/>
          {routeOrders.length > 1 && <div className={`${card} p-3`}><p className="mb-2 text-xs font-bold text-slate-400">Outras paradas</p><div className="flex gap-2 overflow-x-auto">{routeOrders.filter(o => o.id !== current.id).map(o => <button key={o.id} type="button" onClick={() => setSelectedId(o.id)} className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-sm font-bold">#{o.code}</button>)}</div></div>}
        </> : <div className={`${card} px-5 py-10 text-center text-sm text-slate-400`}>Nenhuma entrega pronta ou em rota agora.</div>}
      </div>}

      {tab === 'ganhos' && <div className="space-y-4">
        <header className="flex items-center justify-between"><h1 className="text-2xl font-black">Ganhos</h1><span className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white">Hoje</span></header>
        <div className={`${card} p-5`}>
          <p className="text-sm text-slate-400">Total do dia (taxas de entrega)</p>
          <p className="mt-1 text-4xl font-black">{currency(dailyEarnings)}</p>
          <p className="mt-2 text-xs text-slate-500">Soma das taxas das entregas concluídas hoje. O pagamento do motoboy continua sendo feito pela loja.</p>
        </div>
        <div>
          <p className="mb-2 font-bold">Entregas concluídas hoje</p>
          {completed.length === 0 ? <div className={`${card} px-5 py-8 text-center text-sm text-slate-400`}>Nenhuma entrega concluída neste aparelho hoje.</div>
            : <div className={`${card} divide-y divide-white/10`}>{completed.map(c => <div key={c.id} className="flex items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-3"><CheckCircle2 size={20} className="shrink-0 text-emerald-400"/><div className="min-w-0"><p className="font-bold">Pedido #{c.code}</p><p className="text-xs text-slate-400">{new Date(c.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div></div><p className="shrink-0 font-black">{currency(c.fee)}</p></div>)}</div>}
          <p className="mt-2 text-xs text-slate-500">A lista mostra as entregas finalizadas neste celular. O total acima vem do sistema.</p>
        </div>
      </div>}
    </div>

    {detailsOrder && <div className="fixed inset-0 z-40 overflow-y-auto bg-[#070b12]">
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-10 pt-5">
        <header className="flex items-center gap-3"><button type="button" onClick={() => setDetailsId(null)} aria-label="Voltar" className="rounded-xl p-2 hover:bg-white/5"><X size={22}/></button><h1 className="text-xl font-black">Detalhes do pedido</h1></header>
        <div className={`rounded-2xl p-4 ${statusInfo(detailsOrder).cls}`}><p className="font-bold">{statusInfo(detailsOrder).label}</p><p className="text-xs opacity-80">{detailsOrder.order_status === 'pronto_entrega' ? 'Aguardando você iniciar a entrega' : isPrep(detailsOrder) ? 'A cozinha ainda está preparando' : 'Entrega em andamento'}</p></div>
        <div className={`${card} p-4`}><p className="text-lg font-black">Pedido #{detailsOrder.code}</p><p className="text-sm text-slate-300">{detailsOrder.customer_name}</p><p className="mt-1 text-sm text-slate-400">{new Date(detailsOrder.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p><p className="mt-3 flex gap-2 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-red-400"/>{addressText(detailsOrder.address)}</p></div>
        <div className={`${card} p-4`}><p className="font-bold">Itens do pedido</p>{detailsOrder.items.map((it, i) => <p key={i} className="mt-2 text-sm text-slate-300">{it.quantity}× {it.meal_name} · {it.size_label}{it.notes ? ` — ${it.notes}` : ''}</p>)}</div>
        <div className={`${card} space-y-2 p-4 text-sm`}>
          <div className="flex justify-between"><span className="text-slate-400">Pagamento</span><span className="font-bold">{paymentLabel(detailsOrder.payment_method)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Taxa de entrega</span><span className="font-bold">{typeof detailsOrder.delivery_fee === 'number' ? currency(detailsOrder.delivery_fee) : 'Não informada'}</span></div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-base"><span className="font-bold">Total do pedido</span><span className="font-black">{currency(Number(detailsOrder.total))}</span></div>
        </div>
        <div className={`${card} p-4 text-sm`}><p className="font-bold">Distância aproximada</p><p className="text-slate-400">{kmTo(detailsOrder) ? `${kmTo(detailsOrder)} em linha reta` : 'Ative o GPS para calcular proximidade'}</p></div>
        <ErrorBox/>
        <ActionArea order={detailsOrder}/>
      </div>
    </div>}

    {success && <div className="fixed inset-0 z-50 grid place-items-center bg-[#070b12]/95 px-4">
      <div className={`${card} w-full max-w-sm p-6 text-center`}>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-emerald-400 bg-emerald-400/10"><CheckCircle2 size={44} className="text-emerald-400"/></div>
        <h2 className="mt-4 text-2xl font-black">Entrega concluída!</h2>
        <p className="mt-1 text-sm text-slate-400">Obrigado por mais uma entrega!</p>
        <div className="mt-4 rounded-xl bg-white/[.04] p-3 text-left text-sm"><div className="flex justify-between"><span>Pedido #{success.code}</span><span className="font-bold">{currency(success.fee)}</span></div></div>
        <button type="button" onClick={() => { setSuccess(null); setDetailsId(null); setSelectedId(null); setTab(routeOrders.length ? 'mapa' : 'inicio'); }} className={`${primaryBtn} mt-5`}>Ver próximo pedido</button>
      </div>
    </div>}

    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0a0f18]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map(t => <button key={t.id} type="button" onClick={() => { setTab(t.id); setDetailsId(null); }} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${tab === t.id ? 'text-red-500' : 'text-slate-400'}`}>
          <span className="relative"><t.icon size={22}/>{t.badge ? <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{t.badge}</span> : null}</span>
          {t.label}
        </button>)}
      </div>
    </nav>
  </main>;
}
