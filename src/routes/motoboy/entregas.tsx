import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bike, CheckCircle2, Clock3, LogOut, MapPin, Navigation, PackageCheck, Phone, RefreshCw, Route as RouteIcon, Wifi, WifiOff } from 'lucide-react';

type Delivery = {
  id: string; code: string; customer_name: string; customer_phone: string; address: unknown;
  order_status: string; payment_method: string; payment_status: string; total: number; delivery_fee?: number;
  estimated_delivery_at: string | null; courier_status: string; created_at: string;
  confirmation_code: string | null; items: Array<{ meal_name: string; size_label: string; quantity: number; notes?: string }>;
};
type Geo = { latitude: number; longitude: number };
const coords = (address: unknown): Geo | null => {
  if (!address || typeof address !== 'object') return null;
  const a = address as Record<string, unknown>;
  const latitude = Number(a.latitude ?? a.lat), longitude = Number(a.longitude ?? a.lng ?? a.lon);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
};
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
  return [a.street ?? a.rua, a.number ?? a.numero, a.complement ?? a.complemento, a.reference ?? a.referencia, a.bairro, a.cidade, a.state ?? a.estado ?? a.uf, a.cep].filter(Boolean).join(', ') || 'Endereço não informado';
};
const etaText = (value: string | null) => value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'A combinar';

export const Route = createFileRoute('/motoboy/entregas')({
  head: () => ({ meta: [{ title: 'Entregas | Tia Val Entregas' }], links: [{ rel: 'manifest', href: '/manifest-motoboy.webmanifest' }] }),
  component: CourierDeliveries,
});
function CourierDeliveries() {
  const [orders, setOrders] = useState<Delivery[]>([]);
  const [location, setLocation] = useState<Geo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmation, setConfirmation] = useState<Record<string, string>>({});
  const [geoMessage, setGeoMessage] = useState('Ative a localização para ordenar por proximidade.');
  const [updated, setUpdated] = useState('');
  const [routeMode, setRouteMode] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [presenceError, setPresenceError] = useState('');
  const [roadOrderIds, setRoadOrderIds] = useState<string[]>([]);
  const [routeCalculation, setRouteCalculation] = useState('');
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch('/api/courier/orders', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({})) as { orders?: Delivery[]; error?: string };
      if (response.status === 401) {
        setOrders([]);
        setError('A sessão do motoboy não foi reconhecida pelo servidor (HTTP 401). A página não vai mais redirecionar silenciosamente. Volte ao login, entre novamente e, se continuar, use o botão de diagnóstico na tela de login.');
        return;
      }
      if (!response.ok) throw new Error((data.error || 'Falha ao carregar entregas.') + ' (HTTP ' + response.status + ')');
      setOrders(data.orders || []); setUpdated(new Date().toLocaleTimeString('pt-BR')); setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar entregas. Verifique a conexão e tente novamente.');
    } finally {
      loadingRef.current = false;
    }
  }, []);
  const loadPresence = useCallback(async () => {
    try {
      const response = await fetch('/api/courier/presence', {
        cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => ({})) as { is_online?: boolean; error?: string };
      if (response.status === 401) {
        setPresenceError('Sua sessão expirou. Entre novamente para alterar sua disponibilidade.');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a disponibilidade.');
      setIsOnline(Boolean(data.is_online));
      setPresenceError('');
    } catch (e) {
      setPresenceError(e instanceof Error ? e.message : 'Não foi possível consultar a disponibilidade.');
    }
  }, []);

  const togglePresence = async () => {
    setPresenceBusy(true);
    setPresenceError('');
    try {
      const response = await fetch('/api/courier/presence', {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ is_online: !isOnline }),
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

  useEffect(() => {
    void load();
    void loadPresence();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') { void load(); void loadPresence(); }
    }, 5000);
    const onVisibility = () => { if (document.visibilityState === 'visible') { void load(); void loadPresence(); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, loadPresence]);

  const readyCount = orders.filter(o => o.order_status === 'pronto_entrega').length;
  const activeCount = orders.filter(o => o.order_status === 'saiu_entrega').length;
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

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
          const point = coords(remaining[i].address);
          const d = point ? distance(current, point) : Infinity;
          if (d < bestDistance) { bestDistance = d; bestIndex = i; }
        }
        if (bestIndex < 0) {
          remaining.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          result.push(...remaining); break;
        }
        const next = remaining.splice(bestIndex, 1)[0];
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
    const lastActive = activeOrdered.length ? coords(activeOrdered[activeOrdered.length - 1].address) : location;
    const routeOrders = [...activeOrdered, ...nearestSequence(ready, lastActive)];
    if (roadOrderIds.length > 1) {
      const byId = new Map(routeOrders.map(order => [order.id, order]));
      const optimized = roadOrderIds.map(id => byId.get(id)).filter((order): order is Delivery => Boolean(order));
      const optimizedIds = new Set(optimized.map(order => order.id));
      return [...optimized, ...routeOrders.filter(order => !optimizedIds.has(order.id)), ...waiting];
    }
    return [...routeOrders, ...waiting];
  }, [orders, location, roadOrderIds]);

  // Usa distâncias reais entre ruas (OSRM) para ordenar as entregas prontas/em rota.
  // Se GPS ou serviço de rotas estiver indisponível, mantém a sequência aproximada acima.
  useEffect(() => {
    let cancelled = false;
    const candidates = orders.filter(order =>
      ['pronto_entrega', 'saiu_entrega'].includes(order.order_status) && coords(order.address),
    );
    if (!location || candidates.length < 2) {
      setRoadOrderIds([]);
      setRouteCalculation(location ? 'Ative a localização e tenha pelo menos duas entregas com endereço localizado para otimizar pelas ruas.' : 'Ative o GPS para otimizar a rota pelas ruas.');
      return () => { cancelled = true; };
    }
    const stops = candidates.slice(0, 20);
    const points = [location, ...stops.map(order => coords(order.address)!)];
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
            const d = matrix[current]?.[remaining[i]];
            if (typeof d === 'number' && d < bestDistance) { bestDistance = d; bestAt = i; }
          }
          const next = remaining.splice(bestAt, 1)[0];
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
        setRoadOrderIds(sequence.map(index => stops[index - 1].id));
        setRouteCalculation(`Sequência otimizada pelas ruas para ${stops.length} entrega(s); demais paradas ficam depois, com ordem aproximada.`);
      } catch {
        if (cancelled) return;
        setRoadOrderIds([]);
        setRouteCalculation('O serviço de rotas por ruas não respondeu. Mantive a sequência aproximada e o Waze continua disponível.');
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [orders, location]);

  const estimatedRouteKm = useMemo(() => {
    let current = location, total = 0;
    for (const order of ordered.filter(o => ['pronto_entrega', 'saiu_entrega'].includes(o.order_status))) {
      const point = coords(order.address);
      if (current && point) total += distance(current, point);
      if (point) current = point;
    }
    return total;
  }, [ordered, location]);

  const getLocation = () => {
    if (!navigator.geolocation) { setGeoMessage('Este celular não oferece localização pelo navegador.'); return; }
    setGeoMessage('Obtendo localização…');
    navigator.geolocation.getCurrentPosition(pos => {
      const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(point); setGeoMessage('Localização ativada. Vou tentar ordenar pelas distâncias reais das ruas; se falhar, uso a sequência aproximada.');
      void sendLocation(point);
    }, () => setGeoMessage('Permita a localização nas configurações do navegador para ordenar as entregas.'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  };
  const sendLocation = async (point: Geo) => {
    try { await fetch('/api/courier/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'location', ...point }) }); } catch { /* next GPS update retries */ }
  };
  useEffect(() => {
    if (!location || !orders.some(o => o.order_status === 'saiu_entrega')) return;
    const watch = navigator.geolocation?.watchPosition(pos => {
      const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(point); void sendLocation(point);
    }, () => setGeoMessage('O GPS foi pausado. Verifique a permissão de localização.'), { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 });
    return () => { if (watch !== undefined) navigator.geolocation.clearWatch(watch); };
  }, [Boolean(location), orders.some(o => o.order_status === 'saiu_entrega')]);

  const action = async (order: Delivery, next: 'start'|'arrived'|'delivered') => {
    setBusy(order.id); setError('');
    try {
      const body: Record<string, unknown> = { id: order.id, action: next };
      if (next === 'delivered') body.code = confirmation[order.id] || '';
      const response = await fetch('/api/courier/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a entrega.');
      await load();
      if (next === 'start') { setRouteMode(true); getLocation(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro na entrega.'); }
    finally { setBusy(''); }
  };
  const waze = (order: Delivery) => {
    const point = coords(order.address);
    const destination = point ? `ll=${point.latitude},${point.longitude}&navigate=yes` : `q=${encodeURIComponent(addressText(order.address))}&navigate=yes`;
    window.open(`https://waze.com/ul?${destination}`, '_blank', 'noopener,noreferrer');
  };
  const openBatch = () => {
    const next = ordered.find(o => o.order_status === 'saiu_entrega') || ordered.find(o => o.order_status === 'pronto_entrega');
    if (!location) {
      setGeoMessage('Para calcular a sequência a partir de onde você está, permita a localização do celular.');
      getLocation();
      return;
    }
    if (next) waze(next);
    setRouteMode(true);
  };
  const logout = async () => {
    try {
      await fetch('/api/courier/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    } finally {
      window.location.assign('/motoboy');
    }
  };

  return <main className="courier-screen min-h-screen bg-[#f7f4ed] px-3 py-5 text-[#25251f] sm:px-5 sm:py-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-2xl bg-[#25251f] p-5 text-[#fffaf0] sm:p-7">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-[#e9c878]"><Bike size={26}/></div><div><p className="text-xs uppercase tracking-[.18em] text-[#e9c878]">Marmitex da Tia Val</p><h1 className="text-2xl font-bold">Minhas entregas</h1></div></div><button onClick={logout} aria-label="Sair" className="rounded-lg p-2 hover:bg-white/10"><LogOut size={20}/></button></div>
        <p className="mt-3 text-sm text-[#e0d9c9]">Pedidos liberados pela cozinha. A lista atualiza automaticamente.</p>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/15 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-full ${isOnline ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/60'}`}>
              {isOnline ? <Wifi size={22}/> : <WifiOff size={22}/>}
            </span>
            <div>
              <p className="font-bold">{isOnline ? 'Você está online' : 'Você está offline'}</p>
              <p className="mt-1 text-xs text-[#d4ccbc]">{isOnline ? 'Disponibilidade ativada. Você pode acompanhar as entregas.' : 'Fique online quando estiver pronto para trabalhar.'}</p>
            </div>
          </div>
          <button type="button" onClick={() => void togglePresence()} disabled={presenceBusy} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold disabled:opacity-60 ${isOnline ? 'bg-white/10 text-white' : 'bg-[#e9c878] text-[#25251f]'}`}>
            {isOnline ? <WifiOff size={18}/> : <Wifi size={18}/>}
            {presenceBusy ? 'Salvando…' : isOnline ? 'Ficar offline' : 'Ficar online'}
          </button>
        </div>
        {presenceError && <p role="alert" className="mt-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-100">{presenceError}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={getLocation} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#e9c878] px-3 text-sm font-bold text-[#25251f]"><MapPin size={16}/> Ativar GPS</button><button onClick={openBatch} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/25 px-3 text-sm font-semibold"><RouteIcon size={16}/> Iniciar/continuar rota</button><button onClick={()=>void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/25 px-3 text-sm font-semibold"><RefreshCw size={16}/> Atualizar</button></div>
        <p className="mt-3 text-xs text-[#d4ccbc]">{geoMessage} {location && ordered.length > 0 && `Estimativa: ${estimatedRouteKm.toFixed(1)} km em linha reta; a rota real por ruas e trânsito pode ser diferente.`} {routeCalculation && routeCalculation + ' '} {routeMode && 'Modo de rota ativo: conclua a parada atual e abra a próxima sugerida.'} {updated && `Atualizado às ${updated}.`}</p>
      </header>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e5dfd2] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-medium text-[#777266]">Aguardando saída</p>
          <div className="mt-2 flex items-end justify-between"><span className="text-4xl font-bold tracking-tight">{readyCount}</span><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f8f1df] text-[#9a742a]"><PackageCheck size={22}/></span></div>
          <p className="mt-2 text-xs text-[#777266]">Liberados pela cozinha</p>
        </div>
        <div className="rounded-2xl border border-[#e5dfd2] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-medium text-[#777266]">Em rota</p>
          <div className="mt-2 flex items-end justify-between"><span className="text-4xl font-bold tracking-tight">{activeCount}</span><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4eb] text-[#267342]"><Bike size={22}/></span></div>
          <p className="mt-2 text-xs text-[#777266]">Entregas em andamento</p>
        </div>
        <div className="rounded-2xl border border-[#e5dfd2] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-medium text-[#777266]">Expediente</p>
          <div className="mt-2 flex items-end justify-between"><span className="text-3xl font-bold tracking-tight">11h–14h</span><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#25251f] text-[#e9c878]"><Clock3 size={22}/></span></div>
          <p className="mt-2 text-xs capitalize text-[#777266]">{todayLabel}</p>
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-[#e5dfd2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 className="text-lg font-bold">Painel de hoje</h2><p className="mt-1 text-sm text-[#777266]">Sua operação em um só lugar. A fila atualiza a cada 5 segundos. A sequência usa distância pelas ruas quando o serviço responde e mantém alternativa aproximada quando não responde.</p></div>
        <div className="flex items-center gap-2 rounded-xl bg-[#f7f4ed] px-3 py-2 text-sm"><span className="h-2 w-2 rounded-full bg-[#2e8b57]"></span><span>Atualização automática a cada 5 s</span></div>
      </section>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800">
        <p>{error}</p>
        {error.includes('401') && <button type="button" onClick={() => window.location.assign('/motoboy')} className="mt-3 min-h-11 rounded-lg bg-[#25251f] px-4 font-semibold text-white">Voltar ao login</button>}
      </div>}
      {ordered.length === 0 && <section className="rounded-2xl border border-[#e5dfd2] bg-white p-8 text-center"><PackageCheck className="mx-auto text-[#9a742a]" size={34}/><h2 className="mt-3 text-lg font-bold">Nenhum pedido de entrega encontrado</h2><p className="mt-1 text-sm text-[#777266]">Os pedidos de entrega aparecerão aqui assim que forem registrados. A saída só será liberada quando a cozinha marcar como pronto.</p></section>}
      {ordered.map((order, index) => <article key={order.id} className="space-y-4 rounded-2xl border border-[#e5dfd2] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#9a742a]">{order.order_status === 'saiu_entrega' ? 'Em rota' : order.order_status === 'pronto_entrega' ? `Pronto para sair · parada ${index+1}` : order.order_status === 'preparando' ? 'Em preparação na cozinha' : order.order_status === 'confirmado' ? 'Pedido confirmado · aguardando cozinha' : 'Pedido novo · aguardando confirmação'}</p><h2 className="mt-1 text-xl font-bold">Pedido #{order.code}</h2><p className="mt-1 text-sm text-[#777266]">{order.customer_name}</p></div><span className="rounded-full bg-[#f8f1df] px-3 py-1 text-xs font-bold">Chegada: {etaText(order.estimated_delivery_at)}</span></div>
        <div className="rounded-xl bg-[#f7f4ed] p-3"><p className="flex gap-2 text-sm font-semibold"><MapPin size={17} className="shrink-0"/>{addressText(order.address)}</p>{coords(order.address) && <p className="mt-1 text-xs text-[#777266]">Distância aproximada: {location ? distance(location, coords(order.address)!).toFixed(1)+' km em linha reta' : 'ative o GPS para calcular proximidade'}</p>}<div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>waze(order)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#25251f] px-3 text-sm font-semibold text-white"><Navigation size={16}/> Abrir no Waze</button>{order.customer_phone && <a href={`tel:${order.customer_phone.replace(/[^+\d]/g,'')}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold"><Phone size={16}/> Ligar cliente</a>}</div></div>
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#e5dfd2] p-3 sm:grid-cols-3">
          <div><p className="text-xs text-[#777266]">Pagamento</p><p className="mt-1 text-sm font-semibold">{order.payment_method === 'online' ? 'Online' : order.payment_method === 'entrega-pix' ? 'Pix na entrega' : order.payment_method === 'entrega-cartao' ? 'Cartão na entrega' : order.payment_method === 'entrega-dinheiro' ? 'Dinheiro na entrega' : order.payment_method}</p><p className="text-xs text-[#777266]">{order.payment_method === 'online' ? (order.payment_status === 'approved' ? 'Pagamento aprovado' : 'Aguardando confirmação') : 'Pagamento na entrega'}</p></div>
          <div><p className="text-xs text-[#777266]">Taxa de entrega</p><p className="mt-1 text-sm font-semibold">{typeof order.delivery_fee === 'number' ? order.delivery_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informada'}</p></div>
          <div><p className="text-xs text-[#777266]">Total do pedido</p><p className="mt-1 text-base font-bold">{Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
        </div>
        <div><p className="text-sm font-semibold">Itens do pedido</p>{order.items.map((item,i)=><p key={i} className="mt-1 text-sm text-[#5f5a50]">{item.quantity}× {item.meal_name} · {item.size_label}{item.notes ? ` — ${item.notes}` : ''}</p>)}</div>
        <p className="text-xs text-[#777266]">Pedido recebido em {new Date(order.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
        {order.courier_status === 'cheguei' ? <div className="space-y-3 rounded-xl border border-[#e9c878] bg-[#fff9e8] p-4"><p className="font-semibold">Você marcou que chegou. Peça o código de 6 dígitos ao cliente.</p><input inputMode="numeric" maxLength={6} value={confirmation[order.id] || ''} onChange={e=>setConfirmation(v=>({...v,[order.id]:e.target.value.replace(/\D/g,'').slice(0,6)}))} placeholder="000000" className="min-h-12 w-full rounded-lg border bg-white px-4 text-center text-2xl tracking-[.3em]"/><button disabled={busy===order.id || (confirmation[order.id]||'').length!==6} onClick={()=>void action(order,'delivered')} className="min-h-11 w-full rounded-lg bg-[#25251f] px-4 font-semibold text-white disabled:opacity-50"><CheckCircle2 className="mr-2 inline" size={18}/> Confirmar entrega</button></div>
        : order.order_status === 'saiu_entrega' ? <button disabled={busy===order.id} onClick={()=>void action(order,'arrived')} className="min-h-12 w-full rounded-xl bg-[#e9c878] px-4 font-bold text-[#25251f] disabled:opacity-50"><MapPin className="mr-2 inline" size={18}/> Cheguei ao endereço</button>
        : order.order_status === 'pronto_entrega' ? <button disabled={busy===order.id} onClick={()=>void action(order,'start')} className="min-h-12 w-full rounded-xl bg-[#25251f] px-4 font-bold text-white disabled:opacity-50"><Bike className="mr-2 inline" size={18}/> Iniciar entrega e compartilhar GPS</button> : <p className="rounded-xl bg-[#f7f4ed] p-3 text-center text-sm font-semibold text-[#777266]">Aguardando liberação da cozinha. O botão de saída aparece quando o pedido estiver pronto.</p>}
      </article>)}
      <p className="flex items-center justify-center gap-2 py-3 text-center text-xs text-[#777266]"><Clock3 size={14}/> Por segurança, confirme a entrega somente após receber o código do cliente.</p>
    </div>
  </main>;
}
