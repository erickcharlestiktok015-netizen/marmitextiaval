import { useEffect, useState } from 'react';
import { readCustomer, saveCustomer, saveOrder, trackingHref } from '@/lib/my-orders';
import { Banknote, Bike, Check, CheckCircle2, Copy, CreditCard, Landmark, LoaderCircle, MessageCircle, QrCode, ReceiptText, Smartphone, Store, Wallet } from 'lucide-react';
import { DeliveryFee, type FeeResult } from '@/components/restaurant/delivery-fee';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { calculateTotals, checkOrderPaymentStatus, submitOrder, type Order, type OrderItem, type PaymentMethod, type SubmitResult, type OnlinePaymentMethod } from '@/lib/orders';
import { lookupCustomerOrders } from '@/lib/orders';
import { contacts, deliveryFeePerKm, formatPrice } from '@/lib/restaurant-data';
import { ConfettiBurst } from '@/components/restaurant/confetti-burst';
import { trackPurchase, trackInitiateCheckout } from '@/components/facebook-pixel';

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
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

export function CheckoutForm({ items, when, initialFee, onBack, onDone }: { items: OrderItem[]; when: 'hoje' | 'amanha'; initialFee?: FeeResult | null; onBack?: () => void; onDone?: () => void }) {
  const [fulfillment, setFulfillment] = useState<'entrega' | 'retirada'>('entrega');
  const [fee, setFee] = useState<FeeResult | null>(initialFee ?? null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('entrega-pix');
  const [onlineMethod, setOnlineMethod] = useState<OnlinePaymentMethod>('pix');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pixStatus, setPixStatus] = useState('pending');
  const [copiedPix, setCopiedPix] = useState(false);
  const totals = calculateTotals(items, fulfillment, fee?.km ?? null);
  const label = when === 'amanha' ? 'reserva' : 'pedido';
  const selectedOnlineMethod = onlinePaymentOptions.find(option => option.id === onlineMethod)!;
  const [remembered, setRemembered] = useState(false);
  useEffect(() => {
    const saved = readCustomer();
    if (saved) { setName(saved.name); setPhone(maskPhone(saved.phone)); setRemembered(true); }
  }, []);

  useEffect(() => {
    if (!result?.pixPayment) return;
    let active = true;
    const checkStatus = async () => {
      try {
        const payment = await checkOrderPaymentStatus(result.code);
        if (active) setPixStatus(payment.status);
      } catch {
        // A próxima consulta automática tentará novamente; não interrompe o pagamento.
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => { void checkStatus(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [result?.code, result?.pixPayment?.paymentId]);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Coloque seu nome.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Coloque um telefone com DDD.');
    if (payment === 'online' && onlineMethod === 'pix' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Informe um e-mail válido para gerar o Pix.');
    if (fulfillment === 'entrega' && !fee) return setError('Coloque seu endereço e clique em Calcular entrega.');
    if (payment === 'online' && !onlineMethod) return setError('Escolha uma forma de pagamento online.');
    // Dispara evento de início do checkout
    trackInitiateCheckout(totals.total);
    const order: Order = {
      when, items, totals, payment, fulfillment,
      onlineMethod: payment === 'online' ? onlineMethod : undefined,
      customer: { name: name.trim(), phone: phone.replace(/\D/g, ''), email: payment === 'online' && onlineMethod === 'pix' ? email.trim() : undefined },
      address: fulfillment === 'entrega' && fee ? { cep: fee.cep, street: fee.rua, number: fee.numero, complement: fee.complemento, bairro: fee.bairro, latitude: fee.latitude, longitude: fee.longitude } : undefined,
      distanceKm: fulfillment === 'entrega' ? fee?.km ?? null : null,
      changeFor: payment === 'entrega-dinheiro' && changeFor ? Number(changeFor.replace(',', '.')) || null : null,
    };
    setSending(true);
    try {
      const res = await submitOrder(order);
      saveCustomer({ name: name.trim(), phone: phone.replace(/\D/g, '') });
      if (res.trackingToken) saveOrder(res.code, res.trackingToken);
      // Dispara evento de compra no Facebook Pixel
      if (res.paymentUrl || res.pixPayment) {
        trackPurchase(totals.total);
      }
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      setResult(res);
      if (res.pixPayment) { setPixStatus(res.pixPayment.status); setCopiedPix(false); setPaymentDialog(true); }
    } catch {
      setError(`Não conseguimos enviar sua ${label}. Tente de novo ou ligue ${contacts.phoneLabel}.`);
    } finally { setSending(false); }
  };

  const payIcons: Record<PaymentMethod, typeof QrCode> = { online: Smartphone, 'entrega-pix': QrCode, 'entrega-cartao': CreditCard, 'entrega-dinheiro': Banknote };
  const sectionTitle = 'flex items-center gap-2 text-base font-bold';

  if (result && !result.pixPayment) return <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
    <ConfettiBurst trigger={result.code} />
    <span className="da-pop grid size-16 place-items-center rounded-full bg-success text-success-foreground"><Check className="size-8" /></span>
    <h3 className="text-2xl font-bold">{when === 'amanha' ? 'Reserva feita!' : 'Pedido feito!'}</h3>
    <p className="text-muted-foreground">Código <strong className="text-foreground">#{result.code}</strong> · Total <strong className="text-foreground">{formatPrice(totals.total)}</strong></p>
    <p className="text-sm text-muted-foreground">{fulfillment === 'retirada' ? 'É só pagar quando vier buscar.' : 'É só pagar quando a marmita chegar.'}</p>
    <Button asChild variant="cta" size="xl" className="w-full"><a href={trackingHref(result.trackingToken)}><Bike /> Acompanhar meu pedido</a></Button>
    <Button asChild variant="whatsapp" size="xl" className="w-full"><a href={`https://api.whatsapp.com/send/?phone=553134454042&text=${encodeURIComponent(`Olá, Tia Val! Acabei de fazer o pedido #${result.code}.`)}`} target="_blank" rel="noreferrer"><MessageCircle /> Avisar no WhatsApp</a></Button>
    <p className="text-xs text-muted-foreground">O pedido fica salvo em “Meus pedidos” neste celular.</p>
    {onDone && <Button variant="ghost" onClick={onDone}>Fechar</Button>}
  </div>;

  return <>
    <form className="space-y-6" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <ul className="divide-y divide-border rounded-2xl bg-muted px-4">{items.map((i, idx) => <li key={idx} className="flex items-start justify-between gap-3 py-3"><span className="text-sm"><strong className="font-semibold">{i.quantity}× {i.name}</strong><small className="block text-muted-foreground">{i.sizeLabel}{i.notes ? ` · ${i.notes}` : ''}</small></span><strong className="text-sm">{formatPrice(i.unitPrice * i.quantity)}</strong></li>)}</ul>

      <fieldset className="space-y-3"><legend className={sectionTitle}>Seus dados</legend>
        {remembered && <p className="text-xs text-muted-foreground">Preenchemos com os dados do seu último pedido.</p>}
        <input className="da-field" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" maxLength={80} aria-label="Nome" />
        <input className="da-field" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} onBlur={() => { const d = phone.replace(/\D/g, ""); if (d.length >= 10) void lookupCustomerOrders(d, name).catch(() => {}); }} placeholder="(31) 99999-9999" inputMode="tel" autoComplete="tel" aria-label="Telefone" />
        {payment === 'online' && onlineMethod === 'pix' && <input className="da-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu e-mail para o pagamento Pix" autoComplete="email" maxLength={254} aria-label="E-mail para pagamento Pix" required />}
      </fieldset>

      <fieldset className="space-y-3"><legend className={sectionTitle}>Como vai receber?</legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
          {([['entrega', 'Entrega', Bike], ['retirada', 'Retirar na cozinha', Store]] as const).map(([id, text, Icon]) => <button key={id} type="button" aria-pressed={fulfillment === id} onClick={() => setFulfillment(id)} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${fulfillment === id ? 'bg-primary text-primary-foreground shadow-card' : 'text-secondary-foreground'}`}><Icon size={16} /> {text}</button>)}
        </div>
        {fulfillment === 'entrega' && <DeliveryFee compact onResult={setFee} />}
      </fieldset>

      <fieldset className="space-y-3"><legend className={sectionTitle}><CreditCard size={16} /> Pagamento</legend>
        <div className="grid grid-cols-2 gap-2">{paymentOptions.map(o => { const Icon = payIcons[o.id]; const on = payment === o.id; return <button type="button" key={o.id} aria-pressed={on} onClick={() => { setPayment(o.id); if (o.id === 'online') setPaymentDialog(true); }} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition ${on ? 'border-primary bg-accent' : 'border-border bg-card'}`}><Icon className={`size-5 ${on ? 'text-primary' : 'text-muted-foreground'}`} /><strong className="text-sm leading-tight">{o.label}</strong><small className="text-xs leading-snug text-muted-foreground">{o.hint}</small></button>; })}</div>
        {payment === 'online' && <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm"><span>Forma escolhida: <strong>{selectedOnlineMethod.label}</strong></span><Button type="button" variant="ctaOutline" size="sm" onClick={() => setPaymentDialog(true)}>Trocar</Button></div>}
        {payment === 'entrega-dinheiro' && <input className="da-field" value={changeFor} onChange={e => setChangeFor(e.target.value.replace(/[^\d,]/g, ''))} placeholder="Troco para quanto? (opcional)" inputMode="decimal" aria-label="Troco para" />}
      </fieldset>

      <dl className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Marmitas</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Entrega ({formatPrice(deliveryFeePerKm)}/km)</dt><dd>{fulfillment === 'retirada' ? 'Grátis' : fee ? formatPrice(totals.deliveryFee) : 'Informe o endereço'}</dd></div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>Total</dt><dd>{formatPrice(totals.total)}</dd></div>
      </dl>
      {error && <p className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-primary" role="alert">{error}</p>}
      <Button type="submit" variant="cta" size="xl" className="w-full" disabled={sending || Boolean(result)}>{sending && <LoaderCircle className="animate-spin" />} {payment === 'online' ? `Pagar com ${selectedOnlineMethod.label}` : when === 'amanha' ? 'Confirmar reserva' : 'Confirmar pedido'} · {formatPrice(totals.total)}</Button>
    </form>

    <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
      <DialogContent className="delivery-app max-h-[90dvh] w-[calc(100%-24px)] max-w-md overflow-y-auto rounded-3xl border-0 p-5">
        {result?.pixPayment && <ConfettiBurst trigger={result.code} />}
        {result?.pixPayment ? <div className="flex flex-col gap-3">
          <p className="text-xs font-bold tracking-widest text-primary">PIX · MERCADO PAGO</p>
          <DialogTitle className="text-2xl font-bold">{pixStatus === 'approved' ? 'Pix confirmado!' : 'Pague com Pix'}</DialogTitle>
          <DialogDescription>{pixStatus === 'approved' ? 'Recebemos a confirmação do pagamento.' : `Pedido #${result.code} · Total ${formatPrice(totals.total)}. Escaneie o QR Code ou copie o código abaixo.`}</DialogDescription>
          <Button asChild variant="ctaOutline" size="lg"><a href={trackingHref(result.trackingToken)}><Bike /> Acompanhar meu pedido</a></Button>
          {pixStatus === 'approved' ? <div className="flex flex-col items-center gap-2 rounded-2xl bg-success-surface p-5 text-center"><CheckCircle2 className="size-10 text-success" /><strong>Pagamento aprovado</strong><span className="text-sm text-muted-foreground">Seu pedido foi registrado. A cozinha já pode confirmar o recebimento.</span></div> : <>
            <img className="mx-auto w-56 rounded-2xl bg-card p-2" src={`data:image/png;base64,${result.pixPayment.qrCodeBase64}`} alt="QR Code Pix para pagamento do pedido" />
            <label className="text-sm font-semibold" htmlFor="pix-copy-code">Pix copia e cola</label>
            <textarea id="pix-copy-code" className="da-field resize-none font-mono text-xs" readOnly value={result.pixPayment.qrCode} rows={4} />
            <Button type="button" variant="cta" size="lg" onClick={() => { void navigator.clipboard.writeText(result.pixPayment!.qrCode).then(() => setCopiedPix(true)).catch(() => setError('Não foi possível copiar automaticamente. Selecione e copie o código Pix.')); }}>{copiedPix ? <Check /> : <Copy />}{copiedPix ? 'Código copiado' : 'Copiar código Pix'}</Button>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={15} className="animate-spin" /> Aguardando confirmação do pagamento…</p>
          </>}
          <Button type="button" size="lg" variant={pixStatus === 'approved' ? 'cta' : 'ghost'} onClick={() => setPaymentDialog(false)}>{pixStatus === 'approved' ? 'Concluir' : 'Fechar e pagar depois'}</Button>
        </div> : <div className="flex flex-col gap-3">
          <p className="text-xs font-bold tracking-widest text-primary">PAGAMENTO SEGURO</p>
          <DialogTitle className="text-2xl font-bold">Como você quer pagar?</DialogTitle>
          <DialogDescription>Para Pix, o QR Code aparece aqui mesmo no site.</DialogDescription>
          <div className="flex flex-col gap-2">
            {onlinePaymentOptions.map(option => {
              const Icon = option.icon;
              const on = onlineMethod === option.id;
              return <button type="button" key={option.id} aria-pressed={on} onClick={() => { setOnlineMethod(option.id); setError(null); }} className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${on ? 'border-primary bg-accent' : 'border-border bg-card'}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}><Icon size={20} /></span>
                <span className="flex-1"><strong className="block text-sm">{option.label}</strong><small className="text-xs text-muted-foreground">{option.hint}</small></span>
                <span className={`grid size-6 place-items-center rounded-full border-2 ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{on && <Check size={14} />}</span>
              </button>;
            })}
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark size={14} /> A disponibilidade depende do que estiver ativo na conta Mercado Pago.</p>
          <Button type="button" variant="cta" size="xl" onClick={() => { setPayment('online'); setPaymentDialog(false); }}>Continuar com {selectedOnlineMethod.label}</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
