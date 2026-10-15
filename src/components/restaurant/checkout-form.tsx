import { useState } from 'react';
import { ArrowLeft, Bike, Check, CreditCard, LoaderCircle, Store } from 'lucide-react';
import { DeliveryFee, type FeeResult } from '@/components/restaurant/delivery-fee';
import { Button } from '@/components/ui/button';
import { calculateTotals, submitOrder, type Order, type OrderItem, type PaymentMethod, type SubmitResult } from '@/lib/orders';
import { contacts, formatPrice } from '@/lib/restaurant-data';

const paymentOptions: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'online', label: 'Pagar agora online', hint: 'Pix, crédito, débito, boleto ou saldo Mercado Pago' },
  { id: 'entrega-pix', label: 'Pix na entrega', hint: 'Paga quando chegar' },
  { id: 'entrega-cartao', label: 'Cartão na entrega', hint: 'Débito ou crédito na maquininha' },
  { id: 'entrega-dinheiro', label: 'Dinheiro na entrega', hint: 'Avise se precisa de troco' },
];
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

export function CheckoutForm({ items, when, initialFee, onDone }: { items: OrderItem[]; when: 'hoje' | 'amanha'; initialFee?: FeeResult | null; onDone?: () => void }) {
  const [fulfillment, setFulfillment] = useState<'entrega' | 'retirada'>('entrega');
  const [fee, setFee] = useState<FeeResult | null>(initialFee ?? null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('entrega-pix');
  const [changeFor, setChangeFor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const totals = calculateTotals(items, fulfillment, fee?.km ?? null);
  const label = when === 'amanha' ? 'reserva' : 'pedido';

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Coloque seu nome.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Coloque um telefone com DDD.');
    if (fulfillment === 'entrega') {
      if (!fee) return setError('Coloque seu endereço e clique em Calcular entrega.');
    }
    const order: Order = {
      when, items, totals, payment, fulfillment,
      customer: { name: name.trim(), phone },
      address: fulfillment === 'entrega' && fee ? { cep: fee.cep, street: fee.rua, number: fee.numero, complement: fee.complemento, bairro: fee.bairro } : undefined,
      distanceKm: fulfillment === 'entrega' ? fee?.km ?? null : null,
      changeFor: payment === 'entrega-dinheiro' && changeFor ? Number(changeFor.replace(',', '.')) || null : null,
    };
    setSending(true);
    try {
      const res = await submitOrder(order);
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      setResult(res);
    } catch {
      setError(`Não conseguimos enviar sua ${label}. Tente de novo ou ligue ${contacts.phoneLabel}.`);
    } finally { setSending(false); }
  };

  if (result) return <div className="checkout-done" role="status">
    <span className="checkout-done-icon"><Check /></span>
    <h3>{when === 'amanha' ? 'Reserva feita!' : 'Pedido feito!'}</h3>
    <p>Código <strong>#{result.code}</strong> · Total {formatPrice(totals.total)}</p>
    <p>{fulfillment === 'retirada' ? 'É só pagar quando vier buscar.' : 'É só pagar quando a marmita chegar.'}</p>
    {onDone && <Button onClick={onDone}>Fechar</Button>}
  </div>;

  return <form className="checkout checkout-form-mobile" onSubmit={e => { e.preventDefault(); void submit(); }}>
    <ul className="checkout-items">{items.map((i, idx) => <li key={idx}><span>{i.quantity}× {i.name}<small>{i.sizeLabel}{i.notes ? ` · ${i.notes}` : ''}</small></span><strong>{formatPrice(i.unitPrice * i.quantity)}</strong></li>)}</ul>

    <fieldset><legend>Seus dados</legend>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" maxLength={80} aria-label="Nome" />
      <input value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(31) 99999-9999" inputMode="tel" autoComplete="tel" aria-label="Telefone" />
    </fieldset>

    <fieldset><legend>Como vai receber?</legend>
      <div className="checkout-choice">
        <button type="button" aria-pressed={fulfillment === 'entrega'} onClick={() => setFulfillment('entrega')}><Bike size={16} /> Entrega</button>
        <button type="button" aria-pressed={fulfillment === 'retirada'} onClick={() => setFulfillment('retirada')}><Store size={16} /> Retirar na cozinha</button>
      </div>
      {fulfillment === 'entrega' && <>
        <DeliveryFee compact onResult={setFee} />
      </>}
    </fieldset>

    <fieldset><legend><CreditCard size={14} /> Pagamento</legend>
      <div className="checkout-pay">{paymentOptions.map(o => <button type="button" key={o.id} aria-pressed={payment === o.id} onClick={() => setPayment(o.id)}><strong>{o.label}</strong><small>{o.hint}</small></button>)}</div>
      {payment === 'entrega-dinheiro' && <input value={changeFor} onChange={e => setChangeFor(e.target.value.replace(/[^\d,]/g, ''))} placeholder="Troco para quanto? (opcional)" inputMode="decimal" aria-label="Troco para" />}
    </fieldset>

    <dl className="cart-totals">
      <div><dt>Marmitas</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
      <div><dt>Entrega (motoboy · R$1/km)</dt><dd>{fulfillment === 'retirada' ? 'Grátis' : fee ? formatPrice(totals.deliveryFee) : 'Informe o CEP'}</dd></div>
      <div className="cart-final"><dt>Total</dt><dd>{formatPrice(totals.total)}</dd></div>
    </dl>
    {error && <p className="delivery-error" role="alert">{error}</p>}
    <Button type="submit" size="lg" disabled={sending}>{sending && <LoaderCircle className="animate-spin" />} {payment === 'online' ? 'Confirmar e pagar' : when === 'amanha' ? 'Confirmar reserva' : 'Confirmar pedido'} · {formatPrice(totals.total)}</Button>
  </form>;
}
