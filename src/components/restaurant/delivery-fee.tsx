import { useState } from 'react';
import { Bike, LoaderCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deliveryFeeForKm } from '@/lib/orders';
import { deliveryFeePerKm, formatPrice, restaurantLocation } from '@/lib/restaurant-data';

export type FeeResult = { cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; km: number; taxa: number };

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const maskCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

async function distanceKm(lat: number, lng: number) {
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${restaurantLocation.lng},${restaurantLocation.lat};${lng},${lat}?overview=false`);
  if (!response.ok) throw new Error('Falha ao consultar a rota do motoboy.');
  const data = await response.json();
  const meters = data?.routes?.[0]?.distance;
  if (data?.code !== 'Ok' || typeof meters !== 'number' || !Number.isFinite(meters) || meters <= 0) {
    throw new Error('Não foi possível encontrar uma rota de entrega para esse endereço.');
  }
  return meters / 1000;
}

type CepInfo = { rua: string; bairro: string; cidade: string; uf: string };

export function DeliveryFee({ onResult, compact }: { onResult?: (result: FeeResult | null) => void; compact?: boolean } = {}) {
  const [cep, setCep] = useState('');
  const [info, setInfo] = useState<CepInfo | null>(null);
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FeeResult | null>(null);
  const clear = () => { setResult(null); onResult?.(null); };

  const lookupCep = async (masked: string) => {
    const digits = onlyDigits(masked);
    setInfo(null);
    if (digits.length !== 8) return;
    try {
      const viaCep = await (await fetch(`https://viacep.com.br/ws/${digits}/json/`)).json();
      if (viaCep.erro) { setError('CEP não encontrado. Confere o número.'); return; }
      setError(null);
      setInfo({ rua: viaCep.logradouro || '', bairro: viaCep.bairro || viaCep.localidade, cidade: viaCep.localidade, uf: viaCep.uf });
      if (viaCep.logradouro) setRua(viaCep.logradouro);
    } catch { setError('Não conseguimos buscar esse CEP agora.'); }
  };

  const geocode = async (q: string) => {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Falha ao localizar o endereço.');
    const geo = await r.json();
    if (!Array.isArray(geo) || !geo.length) return null;
    const lat = Number(geo[0].lat);
    const lng = Number(geo[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };

  const calculate = async () => {
    setError(null);
    clear();
    if (onlyDigits(cep).length !== 8 || !info) return setError('Digite o CEP completo, com os 8 números.');
    if (!rua.trim() || !numero.trim()) return setError('Coloque a rua e o número pra calcular os km certinhos.');
    setLoading(true);
    try {
      const base = [info.bairro, info.cidade, info.uf, onlyDigits(cep), 'Brasil'].filter(Boolean);
      // Never fall back to city center: that can charge a completely wrong distance.
      const point = await geocode([`${rua.trim()}, ${numero.trim()}`, ...base].join(', '))
        ?? await geocode([`${rua.trim()}`, ...base].join(', '));
      if (!point) throw new Error('endereco-nao-localizado');
      const km = await distanceKm(point.lat, point.lng);
      const next: FeeResult = { cep: onlyDigits(cep), rua: rua.trim(), numero: numero.trim(), complemento: complemento.trim(), bairro: info.bairro, cidade: info.cidade, km, taxa: deliveryFeeForKm(km) };
      setResult(next);
      onResult?.(next);
    } catch {
      setError('Não conseguimos localizar o endereço e traçar a rota do motoboy com segurança. Confira rua, número e CEP e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return <div className={compact ? "delivery-fee" : "delivery-fee reveal"}>
    <h3><Bike /> Taxa de entrega · {formatPrice(deliveryFeePerKm)} por km</h3>
    <p>Coloque seu endereço que a taxa do motoboy sai na hora, pela distância exata até a nossa cozinha.</p>
    <form className="delivery-form delivery-address" onSubmit={event => { event.preventDefault(); void calculate(); }}>
      <input className="da-cep" value={cep} onChange={event => { const v = maskCep(event.target.value); setCep(v); clear(); void lookupCep(v); }} inputMode="numeric" autoComplete="postal-code" placeholder="CEP 00000-000" aria-label="CEP" />
      <input className="da-rua" value={rua} onChange={event => { setRua(event.target.value); clear(); }} autoComplete="address-line1" placeholder="Rua" aria-label="Rua" maxLength={120} />
      <input className="da-num" value={numero} onChange={event => { setNumero(event.target.value); clear(); }} placeholder="Nº" aria-label="Número" maxLength={10} />
      <input className="da-comp" value={complemento} onChange={event => { setComplemento(event.target.value); onResult && result && onResult({ ...result, complemento: event.target.value.trim() }); }} autoComplete="address-line2" placeholder="Complemento (apto, bloco...)" aria-label="Complemento" maxLength={80} />
      <Button className="da-btn" type="submit" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null} Calcular entrega</Button>
    </form>
    {info && !result && <p className="delivery-hint"><MapPin size={13} /> {info.bairro}, {info.cidade}</p>}
    {error && <p className="delivery-error" role="alert">{error}</p>}
    {result && <div className="delivery-result" role="status">
      <p><MapPin size={13} /> {result.rua}, {result.numero} · {result.bairro} · ~{result.km < 1 ? 'menos de 1' : (Math.round(result.km * 10) / 10).toLocaleString('pt-BR')} km da cozinha</p>
      <p className="delivery-value"><strong>{formatPrice(result.taxa)}</strong> de taxa de entrega <small>({formatPrice(deliveryFeePerKm)} por km)</small></p>
    </div>}
  </div>;
}
