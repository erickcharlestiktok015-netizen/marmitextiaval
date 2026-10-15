import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bike, CheckCircle2, Clock3, LogOut, MapPin, Navigation, PackageCheck, Phone, RefreshCw, Route as RouteIcon } from 'lucide-react';

type Delivery = {
  id: string; code: string; customer_name: string; customer_phone: string; address: unknown;
  order_status: string; payment_method: string; payment_status: string; total: number;
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
  return [a.street ?? a.rua, a.number ?? a.numero, a.complement ?? a.complemento, a.bairro, a.cidade].filter(Boolean).join(', ') || 'Endereço não informado';
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

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/courier/orders', { cache: 'no-store' });
      const data = await response.json() as { orders?: Delivery[]; error?: string };
      if (response.status === 401) { window.location.href = '/motoboy'; return; }
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar entregas.');
      setOrders(data.orders || []); setUpdated(new Date().toLocaleTimeString('pt-BR')); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao consultar entregas.'); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer); }, [load]);

  const ordered = useMemo(() => {
    const active = orders.filter(o => o.order_status === 'saiu_entrega');
    const ready = orders.filter(o => o.order_status === 'pronto_entrega');
    const sort = (list: Delivery[]) => [...list].sort((a,b) => {
      if (!location) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const ca = coords(a.address), cb = coords(b.address);
      if (!ca && !cb) return 0; if (!ca) return 1; if (!cb) return -1;
      return distance(location, ca) - distance(location, cb);
    });
    return [...sort(active), ...sort(ready)];
  }, [orders, location]);

  const getLocation = () => {
    if (!navigator.geolocation) { setGeoMessage('Este celular não oferece localização pelo navegador.'); return; }
    setGeoMessage('Obtendo localização…');
    navigator.geolocation.getCurrentPosition(pos => {
      const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(point); setGeoMessage('Localização ativada. A lista prioriza os endereços mais próximos em linha reta.');
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
    const stops = ordered.filter(o => o.order_status === 'pronto_entrega');
    const urls = stops.map(o => { const p = coords(o.address); return p ? `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressText(o.address))}`; });
    if (urls[0]) window.open(urls[0], '_blank', 'noopener,noreferrer');
    setRouteMode(true);
  };
  const logout = async () => { await fetch('/api/courier/logout', { method: 'POST' }); window.location.href = '/motoboy'; };

  return <main className="min-h-screen bg-[#f7f4ed] px-3 py-5 text-[#25251f] sm:px-5 sm:py-8">
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="rounded-2xl bg-[#25251f] p-5 text-[#fffaf0] sm:p-7">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-[#e9c878]"><Bike size={26}/></div><div><p className="text-xs uppercase tracking-[.18em] text-[#e9c878]">Marmitex da Tia Val</p><h1 className="text-2xl font-bold">Minhas entregas</h1></div></div><button onClick={logout} aria-label="Sair" className="rounded-lg p-2 hover:bg-white/10"><LogOut size={20}/></button></div>
        <p className="mt-3 text-sm text-[#e0d9c9]">Pedidos liberados pela cozinha. A lista atualiza automaticamente.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={getLocation} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#e9c878] px-3 text-sm font-bold text-[#25251f]"><MapPin size={16}/> Ativar GPS</button><button onClick={openBatch} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/25 px-3 text-sm font-semibold"><RouteIcon size={16}/> Ver primeira rota</button><button onClick={()=>void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/25 px-3 text-sm font-semibold"><RefreshCw size={16}/> Atualizar</button></div>
        <p className="mt-3 text-xs text-[#d4ccbc]">{geoMessage} {updated && `Atualizado às ${updated}.`}</p>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800">{error}</div>}
      {ordered.length === 0 && <section className="rounded-2xl border border-[#e5dfd2] bg-white p-8 text-center"><PackageCheck className="mx-auto text-[#9a742a]" size={34}/><h2 className="mt-3 text-lg font-bold">Nenhuma entrega liberada</h2><p className="mt-1 text-sm text-[#777266]">Quando a cozinha marcar um pedido como pronto para entrega, ele aparecerá aqui.</p></section>}
      {ordered.map((order, index) => <article key={order.id} className="space-y-4 rounded-2xl border border-[#e5dfd2] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#9a742a]">{order.order_status === 'saiu_entrega' ? 'Em rota' : `Pronto para retirar · parada ${index+1}`}</p><h2 className="mt-1 text-xl font-bold">Pedido #{order.code}</h2><p className="mt-1 text-sm text-[#777266]">{order.customer_name}</p></div><span className="rounded-full bg-[#f8f1df] px-3 py-1 text-xs font-bold">Chegada: {etaText(order.estimated_delivery_at)}</span></div>
        <div className="rounded-xl bg-[#f7f4ed] p-3"><p className="flex gap-2 text-sm font-semibold"><MapPin size={17} className="shrink-0"/>{addressText(order.address)}</p>{coords(order.address) && <p className="mt-1 text-xs text-[#777266]">Distância aproximada: {location ? distance(location, coords(order.address)!).toFixed(1)+' km em linha reta' : 'ative o GPS para calcular proximidade'}</p>}<div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>waze(order)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#25251f] px-3 text-sm font-semibold text-white"><Navigation size={16}/> Abrir no Waze</button>{order.customer_phone && <a href={`tel:${order.customer_phone.replace(/[^+\d]/g,'')}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold"><Phone size={16}/> Ligar cliente</a>}</div></div>
        <div><p className="text-sm font-semibold">Itens</p>{order.items.map((item,i)=><p key={i} className="mt-1 text-sm text-[#5f5a50]">{item.quantity}× {item.meal_name} · {item.size_label}{item.notes ? ` — ${item.notes}` : ''}</p>)}</div>
        {order.courier_status === 'cheguei' ? <div className="space-y-3 rounded-xl border border-[#e9c878] bg-[#fff9e8] p-4"><p className="font-semibold">Você marcou que chegou. Peça o código de 6 dígitos ao cliente.</p><input inputMode="numeric" maxLength={6} value={confirmation[order.id] || ''} onChange={e=>setConfirmation(v=>({...v,[order.id]:e.target.value.replace(/\D/g,'').slice(0,6)}))} placeholder="000000" className="min-h-12 w-full rounded-lg border bg-white px-4 text-center text-2xl tracking-[.3em]"/><button disabled={busy===order.id || (confirmation[order.id]||'').length!==6} onClick={()=>void action(order,'delivered')} className="min-h-11 w-full rounded-lg bg-[#25251f] px-4 font-semibold text-white disabled:opacity-50"><CheckCircle2 className="mr-2 inline" size={18}/> Confirmar entrega</button></div>
        : order.order_status === 'saiu_entrega' ? <button disabled={busy===order.id} onClick={()=>void action(order,'arrived')} className="min-h-12 w-full rounded-xl bg-[#e9c878] px-4 font-bold text-[#25251f] disabled:opacity-50"><MapPin className="mr-2 inline" size={18}/> Cheguei ao endereço</button>
        : <button disabled={busy===order.id} onClick={()=>void action(order,'start')} className="min-h-12 w-full rounded-xl bg-[#25251f] px-4 font-bold text-white disabled:opacity-50"><Bike className="mr-2 inline" size={18}/> Iniciar entrega e compartilhar GPS</button>}
      </article>)}
      <p className="flex items-center justify-center gap-2 py-3 text-center text-xs text-[#777266]"><Clock3 size={14}/> Por segurança, confirme a entrega somente após receber o código do cliente.</p>
    </div>
  </main>;
}
