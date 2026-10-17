import { useState } from 'react';
import { ArrowUpRight, Minus, Plus } from 'lucide-react';
import { CheckoutForm } from '@/components/restaurant/checkout-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatPrice, tomorrowMenu } from '@/lib/restaurant-data';

export function ReserveTomorrowButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'pick' | 'checkout'>('pick');
  const [dishId, setDishId] = useState(tomorrowMenu[0]!.id);
  const dish = tomorrowMenu.find(d => d.id === dishId)!;
  const [sizeId, setSizeId] = useState(dish.sizes[0]!.id);
  const size = dish.sizes.find(s => s.id === sizeId) ?? dish.sizes[0]!;
  const [qty, setQty] = useState(1);
  const reset = () => { setStep('pick'); setQty(1); };
  return <>
    <Button variant="outline" className="tomorrow-cta" onClick={() => { reset(); setOpen(true); }}>Reservar minha marmitex <ArrowUpRight /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="meal-dialog"><div className="detail-content">
      <p className="meal-tag">RESERVA PARA SEGUNDA-FEIRA</p>
      <DialogTitle>Reservar marmitex</DialogTitle>
      <DialogDescription>Escolha o prato de segunda-feira, a gente separa o seu.</DialogDescription>
      {step === 'pick' ? <>
        <div className="checkout-choice">{tomorrowMenu.map(d => <button key={d.id} type="button" aria-pressed={d.id === dishId} onClick={() => { setDishId(d.id); setSizeId(d.sizes[0]!.id); }}>{d.name}</button>)}</div>
        <div className="size-picker" role="radiogroup" aria-label="Tamanho">{dish.sizes.map(o => <button key={o.id} type="button" role="radio" aria-checked={o.id === size.id} className={`size-option${o.id === size.id ? ' selected' : ''}`} onClick={() => setSizeId(o.id)}><span>{o.label}</span><strong>{formatPrice(o.price)}</strong></button>)}</div>
        <div className="detail-controls">
          <div className="quantity-stepper"><Button variant="ghost" size="icon" aria-label="Diminuir quantidade" disabled={qty === 1} onClick={() => setQty(q => q - 1)}><Minus /></Button><output>{qty}</output><Button variant="ghost" size="icon" aria-label="Aumentar quantidade" disabled={qty === 10} onClick={() => setQty(q => q + 1)}><Plus /></Button></div>
          <Button onClick={() => setStep('checkout')}>Continuar · {formatPrice(size.price * qty)} <ArrowUpRight /></Button>
        </div>
      </> : <CheckoutForm when="amanha" items={[{ name: dish.name, sizeLabel: size.label, unitPrice: size.price, quantity: qty }]} onBack={() => setStep('pick')} onDone={() => setOpen(false)} />}
    </div></DialogContent></Dialog>
  </>;
}
