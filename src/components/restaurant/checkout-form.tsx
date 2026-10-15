import { useState } from 'react';
import { ArrowLeft, Bike, Check, CreditCard, LoaderCircle, QrCode, ReceiptText, Store, Wallet, Landmark } from 'lucide-react';
import { DeliveryFee, type FeeResult } from '@/components/restaurant/delivery-fee';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { calculateTotals, submitOrder, type Order, type OrderItem, type PaymentMethod, type SubmitResult, type OnlinePaymentMethod } from '@/lib/orders';
import { contacts, formatPrice } from '@/lib/restaurant-data';

const paymentOptions: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'online', label: 'Pagar agora online', hint: 'Pix, crédito, débito, boleto ou saldo Mercado Pago' },
  { id: 'entrega-pix', label: 'Pix na entrega', hint: 'Paga quando chegar' },
  { id: 'entrega-cartao', label: 'Cartão na entrega', hint: 'Débito ou crédito na maquininha' },
  { id: 'entrega-dinheiro', label: 'Dinheiro na entrega', hint: 'Avise se precisa de troco' },
];
const onlinePaymentOptions: { id: OnlinePaymentMethod; label: string; hint: string; brand: string; icon: typeof QrCode }[] = [
  { id: 'pix', label: 'Pix', hint: 'Pagamento instantâneo', brand: 'PIX', icon: QrCode },
  { id: 'credit_card', label: 'Cartão de crédito', hint: 'Consulte parcelamento no Mercado Pago', brand: 'CRED', icon: CreditCard },
  { id: 'debit_card', label: 'Cartão de débito', hint: 'Para cartões aceitos pelo Mercado Pago', brand: 'DEB', icon: CreditCard },
  { id: 'ticket', label: 'Boleto bancário', hint: 'Pague pelo seu banco', brand: 'BOLETO', icon: ReceiptText },
  { id: 'account_money', label: 'Saldo Mercado Pago', hint: 'Use o saldo da sua conta', brand: 'MP', icon: Wallet },
];
const maskPhone = (v: string) => {
  const d = v.replace(/\\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

export function CheckoutForm({ items, when, initialFee, onBack, onDone }: { items: OrderItem[]; when: 'hoje' | 'amanha'; initialFee?: FeeResult | null; onBack?: () => void; onDone?: () => void }) {
  const [fulfillment, setFulfillment] = useState<'entrega' | 'retirada'>('entrega');
  const [fee, setFee] = useState<FeeResult | null>(initialFee ?? null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('entrega-pix');
  const [onlineMethod, setOnlineMethod] = useState<OnlinePaymentMethod>('pix');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const totals = calculateTotals(items, fulfillment, fee?.km ?? null);
  const label = when === 'amanha' ? 'reserva' : 'pedido';
  const selectedOnlineMethod = onlinePaymentOptions.find(option => option.id === onlineMethod)!;

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Coloque seu nome.');
    if (phone.replace(/\\D/g, '').length < 10) return setError('Coloque um telefone com DDD.');
    if (fulfillment === 'entrega' && !fee) return setError('Coloque seu endereço e clique em Calcular entrega.');
    if (payment === 'online' && !onlineMethod) return setError('Escolha uma forma de pagamento online.');
    const order: Order = {
      when, items, totals, payment, fulfillment,
      onlineMethod: payment === 'online' ? onlineMethod : undefined,
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

  return <>
    <form className="checkout" onSubmit={e => { e.preventDefault(); void submit(); }}>
      {onBack && <button type="button" className="checkout-back" onClick={onBack}><ArrowLeft size={14} /> Voltar</button>}
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
        {fulfillment === 'entrega' && <DeliveryFee compact onResult={setFee} />}
      </fieldset>

      <fieldset><legend><CreditCard size={14} /> Pagamento</legend>
        <div className="checkout-pay">{paymentOptions.map(o => <button type="button" key={o.id} aria-pressed={payment === o.id} onClick={() => { setPayment(o.id); if (o.id === 'online') setPaymentDialog(true); }}><strong>{o.label}</strong><small>{o.hint}</small></button>)}</div>
        {payment === 'online' && <div className="online-payment-selected"><span>Forma escolhida: <strong>{selectedOnlineMethod.label}</strong></span><Button type="button" variant="outline" size="sm" onClick={() => setPaymentDialog(true)}>Trocar</Button></div>}
        {payment === 'entrega-dinheiro' && <input value={changeFor} onChange={e => setChangeFor(e.target.value.replace(/[^\\d,]/g, ''))} placeholder="Troco para quanto? (opcional)" inputMode="decimal" aria-label="Troco para" />}
      </fieldset>

      <dl className="cart-totals">
        <div><dt>Marmitas</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
        <div><dt>Entrega (motoboy · R$1/km)</dt><dd>{fulfillment === 'retirada' ? 'Grátis' : fee ? formatPrice(totals.deliveryFee) : 'Informe o CEP'}</dd></div>
        <div className="cart-final"><dt>Total</dt><dd>{formatPrice(totals.total)}</dd></div>
      </dl>
      {error && <p className="delivery-error" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={sending}>{sending && <LoaderCircle className="animate-spin" />} {payment === 'online' ? `Pagar com ${selectedOnlineMethod.label}` : when === 'amanha' ? 'Confirmar reserva' : 'Confirmar pedido'} · {formatPrice(totals.total)}</Button>
    </form>

    <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
      <DialogContent className="payment-method-dialog">
        <div className="detail-content">
          <p className="meal-tag">PAGAMENTO SEGURO</p>
          <DialogTitle>Como você quer pagar?</DialogTitle>
          <DialogDescription>Escolha uma forma. Você continuará para o ambiente seguro do Mercado Pago.</DialogDescription>
          <div className="online-payment-options">
            {onlinePaymentOptions.map(option => {
              const Icon = option.icon;
              return <button type="button" key={option.id} className={`online-payment-option${onlineMethod === option.id ? ' selected' : ''}`} aria-pressed={onlineMethod === option.id} onClick={() => { setOnlineMethod(option.id); setError(null); }}>
                <span className={`payment-brand payment-brand-${option.id}`} aria-hidden="true">{option.id === 'pix' ? <><Icon size={22} /><b>pix</b></> : option.id === 'credit_card' ? <><Icon size={21} /><b>VISA</b><b>Mastercard</b></> : option.id === 'debit_card' ? <><Icon size={21} /><b>DÉBITO</b></> : <><Icon size={21} /><b>{option.brand}</b></>}</span>
                <span className="online-payment-copy"><strong>{option.label}</strong><small>{option.hint}</small></span>
                <span className="payment-radio">{onlineMethod === option.id && <Check size={15} />}</span>
              </button>;
            })}
          </div>
          <p className="payment-method-note"><Landmark size={14} /> A disponibilidade depende da conta e do método habilitado pelo Mercado Pago.</p>
          <Button type="button" size="lg" onClick={() => { setPayment('online'); setPaymentDialog(false); }}>Continuar com {selectedOnlineMethod.label}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
