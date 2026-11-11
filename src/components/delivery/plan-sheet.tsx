import { useEffect, useState } from 'react';
import { Banknote, Bike, CalendarCheck, Check, CheckCircle2, Copy, CreditCard, LoaderCircle, MessageCircle, QrCode, ReceiptText, Smartphone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DeliveryFee, type FeeResult } from '@/components/restaurant/delivery-fee';
import { ConfettiBurst } from '@/components/restaurant/confetti-burst';
import { checkOrderPaymentStatus, type OnlinePaymentMethod, type SubmitResult } from '@/lib/orders';
import { lookupCustomerOrders } from '@/lib/orders';
import { contacts, deliveryFeePerKm, formatPrice } from '@/lib/restaurant-data';
import { readCustomer, saveCustomer, saveOrder, savePlanMeta, trackingHref } from '@/lib/my-orders';
import { trackInitiateCheckout, trackPurchase } from '@/components/facebook-pixel';
import {
  PLAN_DAYS,
  dishForDateKey,
  nextPlanDays,
  planDateLabel,
  planDeliveryTotal,
  planPrice,
  planSizes,
  planWindows,
  submitPlanOrder,
  type PlanSizeId,
  type PlanWindow,
} from '@/lib/weekly-plan';

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

type PlanPayment = 'online' | 'entrega-pix' | 'entrega-dinheiro' | 'entrega-cartao';
const onlinePaymentOptions: { id: OnlinePaymentMethod; label: string; hint: string; icon: typeof QrCode }[] = [
  { id: 'pix', label: 'Pix', hint: 'QR Code e copia e cola', icon: QrCode },
  { id: 'credit_card', label: 'Cartão de crédito', hint: 'Pagamento pelo Mercado Pago', icon: CreditCard },
  { id: 'debit_card', label: 'Cartão de débito', hint: 'Para cartões aceitos', icon: CreditCard },
  { id: 'ticket', label: 'Boleto bancário', hint: 'Pague pelo seu banco', icon: ReceiptText },
  { id: 'account_money', label: 'Saldo Mercado Pago', hint: 'Use o saldo da sua conta', icon: Wallet },
];

export function PlanSheet({ onDone }: { onDone?: () => void }) {
  const [sizeId, setSizeId] = useState<PlanSizeId>('pequena');
  const [withCoke, setWithCoke] = useState(true);
  const [fee, setFee] = useState<FeeResult | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [window_, setWindow] = useState<PlanWindow | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [payment, setPayment] = useState<PlanPayment>('online');
  const [onlineMethod, setOnlineMethod] = useState<OnlinePaymentMethod>('pix');
  const [changeFor, setChangeFor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pixStatus, setPixStatus] = useState('pending');
  const [copiedPix, setCopiedPix] = useState(false);
  const [pixDialog, setPixDialog] = useState(false);

  const availableDays = nextPlanDays(14);
  const price = planPrice(sizeId, withCoke);
  const deliveryTotal = fee ? planDeliveryTotal(fee.km) : null;
  const total = price + (deliveryTotal ?? 0);

  useEffect(() => {
    const saved = readCustomer();
    if (saved) { setName(saved.name); setPhone(maskPhone(saved.phone)); }
  }, []);

  useEffect(() => {
    if (!result?.pixPayment) return;
    let active = true;
    const check = async () => {
      try {
        const status = await checkOrderPaymentStatus(result.code);
        if (active) setPixStatus(status.status);
      } catch { /* a próxima consulta tenta de novo */ }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [result?.code, result?.pixPayment?.paymentId]);

  const toggleDate = (key: string) => setDates(current => {
    if (current.includes(key)) return current.filter(d => d !== key);
    if (current.length >= PLAN_DAYS) return current;
    return [...current, key].sort();
  });

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Coloque seu nome.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Coloque um telefone com DDD.');
    if (!fee) return setError('Coloque seu endereço e clique em Calcular entrega.');
    if (dates.length !== PLAN_DAYS) return setError(`Escolha os ${PLAN_DAYS} dias de entrega no calendário.`);
    if (!window_) return setError('Escolha a janela de entrega.');
    if (payment === 'online' && onlineMethod === 'pix' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Informe um e-mail válido para gerar o Pix.');
    trackInitiateCheckout(total);
    setSending(true);
    try {
      const res = await submitPlanOrder({
        sizeId, withCoke, dates, window: window_,
        customer: { name: name.trim(), phone: phone.replace(/\D/g, ''), email: payment === 'online' && onlineMethod === 'pix' ? email.trim() : undefined },
        address: { cep: fee.cep, street: fee.rua, number: fee.numero, complement: fee.complemento, bairro: fee.bairro, latitude: fee.latitude, longitude: fee.longitude },
        distanceKm: fee.km,
        payment,
        ...(payment === 'online' ? { onlineMethod } : {}),
        changeFor: payment === 'entrega-dinheiro' && changeFor ? Number(changeFor.replace(',', '.')) || null : null,
      });
      saveCustomer({ name: name.trim(), phone: phone.replace(/\D/g, '') });
      if (res.trackingToken) {
        saveOrder(res.code, res.trackingToken);
        savePlanMeta(res.trackingToken, { sizeId, withCoke, dates, window: window_, perDayFee: fee ? planDeliveryTotal(fee.km) / PLAN_DAYS : 0 });
      }
      if (res.pixPayment) {
        trackPurchase(total);
        setResult(res);
        setPixStatus(res.pixPayment.status);
        setCopiedPix(false);
        setPixDialog(true);
        return;
      }
      if (res.paymentUrl) { trackPurchase(total); window.location.href = res.paymentUrl; return; }
      setResult(res);
    } catch {
      setError(`Não conseguimos registrar seu plano. Tente de novo ou ligue ${contacts.phoneLabel}.`);
    } finally { setSending(false); }
  };

  const sectionTitle = 'flex items-center gap-2 text-base font-bold';

  if (result && !result.pixPayment) return <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
    <ConfettiBurst trigger={result.code} />
    <span className="da-pop grid size-16 place-items-center rounded-full bg-success text-success-foreground"><Check className="size-8" /></span>
    <h3 className="text-2xl font-bold">Plano contratado!</h3>
    <p className="text-muted-foreground">Código <strong className="text-foreground">#{result.code}</strong> · Total <strong className="text-foreground">{formatPrice(total)}</strong></p>
    <p className="text-sm text-muted-foreground">Você paga na 1ª entrega ({formatPrice(total)}). As {PLAN_DAYS} marmitas chegam nos dias escolhidos, {window_}.</p>
    <Button asChild variant="cta" size="xl" className="w-full"><a href={trackingHref(result.trackingToken)}><Bike /> Acompanhar meu plano</a></Button>
    <Button asChild variant="whatsapp" size="xl" className="w-full"><a href={`https://api.whatsapp.com/send/?phone=553134454042&text=${encodeURIComponent(`Olá, Tia Val! Acabei de assinar o Plano 7 Dias, pedido #${result.code}.`)}`} target="_blank" rel="noreferrer"><MessageCircle /> Avisar no WhatsApp</a></Button>
    {onDone && <Button variant="ghost" onClick={onDone}>Fechar</Button>}
  </div>;

  return <>
    <form className="space-y-6" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <fieldset className="space-y-3"><legend className={sectionTitle}>1 · Escolha o tamanho</legend>
        <div className="grid grid-cols-2 gap-2">
          {planSizes.map(size => {
            const on = sizeId === size.id;
            return <button type="button" key={size.id} aria-pressed={on} onClick={() => setSizeId(size.id)} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition ${on ? 'border-primary bg-accent' : 'border-border bg-card'}`}>
              <strong className="text-sm leading-tight">{size.label}</strong>
              <small className="text-xs text-muted-foreground">7 marmitas {size.volume}</small>
              <strong className="text-base text-success">{formatPrice(withCoke ? size.priceWithCoke : size.priceWithoutCoke)}</strong>
            </button>;
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
          {([['com', 'Com Coca-Cola', `7 latas inclusas (normal ou zero)`], ['sem', 'Sem bebida', `desconto de ${formatPrice(35)}`]] as const).map(([id, text, hint]) => {
            const on = withCoke === (id === 'com');
            return <button key={id} type="button" aria-pressed={on} onClick={() => setWithCoke(id === 'com')} className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-sm font-bold transition ${on ? 'bg-primary text-primary-foreground shadow-card' : 'text-secondary-foreground'}`}>
              {text}<small className={`text-[11px] font-normal ${on ? 'opacity-85' : 'text-muted-foreground'}`}>{hint}</small>
            </button>;
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3"><legend className={sectionTitle}>2 · Onde entregar?</legend>
        <p className="text-xs text-muted-foreground">Dentro do Primeiro de Maio a entrega dos 7 dias é grátis. Fora do bairro, {formatPrice(deliveryFeePerKm)}/km só pelos km fora da divisa, multiplicado pelas 7 entregas.</p>
        <DeliveryFee compact onResult={setFee} />
        {fee && deliveryTotal != null && <p className="rounded-xl bg-muted px-3 py-2 text-sm">Frete do plano: <strong>{deliveryTotal === 0 ? 'Grátis nos 7 dias' : `${formatPrice(deliveryTotal)} (${formatPrice(deliveryTotal / PLAN_DAYS)}/dia × 7)`}</strong></p>}
      </fieldset>

      <fieldset className="space-y-3"><legend className={sectionTitle}>3 · Escolha os 7 dias</legend>
        <p className="text-xs text-muted-foreground">De segunda a sábado (domingo a cozinha fecha). O prato do dia já aparece em cada data. <strong>{dates.length} de {PLAN_DAYS} escolhidos.</strong></p>
        <div className="grid grid-cols-2 gap-2">
          {availableDays.map(key => {
            const dish = dishForDateKey(key);
            const on = dates.includes(key);
            const disabled = !on && dates.length >= PLAN_DAYS;
            return <button key={key} type="button" aria-pressed={on} disabled={disabled} onClick={() => toggleDate(key)} className={`flex flex-col items-start gap-0.5 rounded-2xl border-2 p-3 text-left transition disabled:opacity-40 ${on ? 'border-primary bg-accent' : 'border-border bg-card'}`}>
              <span className="flex w-full items-center justify-between"><strong className="text-sm capitalize">{planDateLabel(key)}</strong>{on && <Check className="size-4 text-primary" />}</span>
              <small className="text-xs leading-snug text-muted-foreground">{dish?.name ?? 'Prato do dia'}</small>
            </button>;
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3"><legend className={sectionTitle}>4 · Janela de entrega</legend>
        <div className="grid grid-cols-3 gap-2">
          {planWindows.map(w => <button key={w} type="button" aria-pressed={window_ === w} onClick={() => setWindow(w)} className={`min-h-11 rounded-xl border-2 text-sm font-bold transition ${window_ === w ? 'border-primary bg-accent text-primary' : 'border-border bg-card'}`}>{w}</button>)}
        </div>
      </fieldset>

      <fieldset className="space-y-3"><legend className={sectionTitle}>5 · Seus dados e pagamento</legend>
        <input className="da-field" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" maxLength={80} aria-label="Nome" />
        <input className="da-field" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} onBlur={() => { const d = phone.replace(/\D/g, ""); if (d.length >= 10) void lookupCustomerOrders(d, name).catch(() => {}); }} placeholder="(31) 99999-9999" inputMode="tel" autoComplete="tel" aria-label="Telefone" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={payment === 'online'} onClick={() => setPayment('online')} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition ${payment === 'online' ? 'border-primary bg-accent' : 'border-border bg-card'}`}>
            <Smartphone className={`size-5 ${payment === 'online' ? 'text-primary' : 'text-muted-foreground'}`} />
            <strong className="text-sm leading-tight">Pagar online</strong>
            <small className="text-xs leading-snug text-muted-foreground">Pix, crédito, débito, boleto ou saldo MP</small>
          </button>
          <button type="button" aria-pressed={payment !== 'online'} onClick={() => setPayment('entrega-pix')} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition ${payment !== 'online' ? 'border-primary bg-accent' : 'border-border bg-card'}`}>
            <Bike className={`size-5 ${payment !== 'online' ? 'text-primary' : 'text-muted-foreground'}`} />
            <strong className="text-sm leading-tight">Pagar na 1ª entrega</strong>
            <small className="text-xs leading-snug text-muted-foreground">Pix, cartão na maquininha ou dinheiro</small>
          </button>
        </div>
        {payment === 'online' && <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {onlinePaymentOptions.map(option => { const Icon = option.icon; const on = onlineMethod === option.id; return <button key={option.id} type="button" aria-pressed={on} onClick={() => { setOnlineMethod(option.id); setError(null); }} className={`flex min-h-[76px] items-center gap-2 rounded-xl border-2 p-2 text-left transition ${on ? 'border-primary bg-accent' : 'border-border bg-card'}`}><Icon className={`size-5 shrink-0 ${on ? 'text-primary' : 'text-muted-foreground'}`} /><span><strong className="block text-sm leading-tight">{option.label}</strong><small className="text-xs leading-snug text-muted-foreground">{option.hint}</small></span></button>; })}
          </div>
          {onlineMethod === 'pix' && <input className="da-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu e-mail para o pagamento Pix" autoComplete="email" maxLength={254} aria-label="E-mail para pagamento Pix" />}
        </div>}
        {payment !== 'online' && <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-1">
          {([['entrega-pix', 'Pix', QrCode], ['entrega-cartao', 'Cartão', CreditCard], ['entrega-dinheiro', 'Dinheiro', Banknote]] as const).map(([id, text, Icon]) => <button key={id} type="button" aria-pressed={payment === id} onClick={() => setPayment(id)} className={`flex min-h-11 items-center justify-center gap-1 rounded-xl text-xs font-bold transition ${payment === id ? 'bg-primary text-primary-foreground shadow-card' : 'text-secondary-foreground'}`}><Icon size={15} /> {text}</button>)}
        </div>}
        {payment === 'entrega-dinheiro' && <input className="da-field" value={changeFor} onChange={e => setChangeFor(e.target.value.replace(/[^\d,]/g, ''))} placeholder="Troco para quanto? (opcional)" inputMode="decimal" aria-label="Troco para" />}
      </fieldset>

      <dl className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Plano 7 Dias ({withCoke ? 'com Coca-Cola' : 'sem bebida'})</dt><dd>{formatPrice(price)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Entrega dos 7 dias</dt><dd>{deliveryTotal == null ? 'Informe o endereço' : deliveryTotal === 0 ? 'Grátis' : formatPrice(deliveryTotal)}</dd></div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
      </dl>
      {error && <p className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-primary" role="alert">{error}</p>}
      <Button type="submit" variant="cta" size="xl" className="w-full" disabled={sending || Boolean(result)}>{sending && <LoaderCircle className="animate-spin" />} {payment === 'online' ? `Pagar com ${onlinePaymentOptions.find(option => option.id === onlineMethod)?.label ?? 'Mercado Pago'}` : 'Confirmar plano'} · {formatPrice(total)}</Button>
    </form>

    <Dialog open={pixDialog} onOpenChange={setPixDialog}>
      <DialogContent className="delivery-app max-h-[90dvh] w-[calc(100%-24px)] max-w-md overflow-y-auto rounded-3xl border-0 p-5">
        {result?.pixPayment && <ConfettiBurst trigger={result.code} />}
        {result?.pixPayment && <div className="flex flex-col gap-3">
          <p className="text-xs font-bold tracking-widest text-primary">PIX · MERCADO PAGO</p>
          <DialogTitle className="text-2xl font-bold">{pixStatus === 'approved' ? 'Pix confirmado!' : 'Pague com Pix'}</DialogTitle>
          <DialogDescription>{pixStatus === 'approved' ? 'Recebemos a confirmação do pagamento do seu Plano 7 Dias.' : `Plano 7 Dias · Pedido #${result.code} · Total ${formatPrice(total)}. Escaneie o QR Code ou copie o código abaixo.`}</DialogDescription>
          <Button asChild variant="ctaOutline" size="lg"><a href={trackingHref(result.trackingToken)}><Bike /> Acompanhar meu plano</a></Button>
          {pixStatus === 'approved' ? <div className="flex flex-col items-center gap-2 rounded-2xl bg-success-surface p-5 text-center"><CheckCircle2 className="size-10 text-success" /><strong>Pagamento aprovado</strong><span className="text-sm text-muted-foreground">Seu plano foi registrado. A cozinha já pode confirmar o recebimento.</span></div> : <>
            <img className="mx-auto w-56 rounded-2xl bg-card p-2" src={`data:image/png;base64,${result.pixPayment.qrCodeBase64}`} alt="QR Code Pix para pagamento do plano" />
            <label className="text-sm font-semibold" htmlFor="plan-pix-copy-code">Pix copia e cola</label>
            <textarea id="plan-pix-copy-code" className="da-field resize-none font-mono text-xs" readOnly value={result.pixPayment.qrCode} rows={4} />
            <Button type="button" variant="cta" size="lg" onClick={() => { void navigator.clipboard.writeText(result.pixPayment!.qrCode).then(() => setCopiedPix(true)).catch(() => setError('Não foi possível copiar automaticamente. Selecione e copie o código Pix.')); }}>{copiedPix ? <Check /> : <Copy />}{copiedPix ? 'Código copiado' : 'Copiar código Pix'}</Button>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={15} className="animate-spin" /> Aguardando confirmação do pagamento…</p>
          </>}
          <Button type="button" size="lg" variant={pixStatus === 'approved' ? 'cta' : 'ghost'} onClick={() => setPixDialog(false)}>{pixStatus === 'approved' ? 'Concluir' : 'Fechar e pagar depois'}</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
