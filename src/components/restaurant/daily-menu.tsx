import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Minus, Phone, Plus, ShoppingBag, Trash2, Utensils } from 'lucide-react';
import { CheckoutForm } from '@/components/restaurant/checkout-form';
import { Button } from '@/components/ui/button';
import { ConfettiBurst } from '@/components/restaurant/confetti-burst';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { contacts, formatPrice, meals, type Meal, type MealSize } from '@/lib/restaurant-data';

function MealMedia({ meal, className }: { meal: Meal; className?: string }) {
  if (meal.image) return <img className={className} src={meal.image} alt={meal.name} loading="lazy" />;
  return <video className={className} src={meal.video} poster={meal.poster} autoPlay muted loop playsInline preload="auto" aria-label={meal.name + ' — vídeo ilustrativo'} onCanPlay={event => { event.currentTarget.play().catch(() => {}); }} />;
}

export function MealCard({ meal, selected, onSelect }: { meal: Meal; selected: boolean; onSelect: () => void }) {
  const menorPreco = Math.min(...meal.sizes.map(size => size.price));
  return <article className={`meal-card${selected ? ' selected' : ''}`}>
    <div className="meal-image">
      <MealMedia meal={meal} />
      {meal.badge && <span className="meal-badge">{meal.badge}</span>}
      <span className="meal-number">0{meals.indexOf(meal) + 1}</span>
    </div>
    <div className="meal-details"><p className="meal-tag">DA NOSSA COZINHA <span>·</span> Prato do dia</p><h3>{meal.name}</h3><p>{meal.description}</p><div className="meal-footer"><span className="meal-price">A partir de {formatPrice(menorPreco)}<small>{meal.sizes.length > 2 ? 'Completa ou só o prato · 500ml e 750ml' : 'Pequena 500ml · Grande 750ml'}</small></span><Button variant={selected ? 'default' : 'outline'} onClick={onSelect} aria-label={`Ver detalhes de ${meal.name}`}>{selected ? <Check /> : <Plus />} Ver prato</Button></div></div>
  </article>;
}
type CartItem = { key: string; meal: Meal; size: MealSize; quantity: number; notes: string };
export function DailyMenu() {
  const [detail, setDetail] = useState<Meal | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [size, setSize] = useState<MealSize>(meals[0]!.sizes[0]!);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [checkout, setCheckout] = useState(false);
  useEffect(() => {
    if (!checkout) return;
    // Alguns navegadores móveis ignoram user-scalable=no; bloqueia pinça apenas durante o checkout.
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const preventGesture = (event: Event) => event.preventDefault();
    document.addEventListener('touchmove', preventPinch, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    return () => {
      document.removeEventListener('touchmove', preventPinch);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
    };
  }, [checkout]);
  const openMeal = (meal: Meal) => { setDetail(meal); setSize(meal.sizes[0]!); setQuantity(1); setNotes(''); };
  const addToCart = (meal: Meal) => {
    const key = `${meal.id}-${size.id}-${notes.trim()}`;
    setCart(items => items.some(i => i.key === key) ? items.map(i => i.key === key ? { ...i, quantity: Math.min(20, i.quantity + quantity) } : i) : [...items, { key, meal, size, quantity, notes: notes.trim() }]);
    setDetail(null);
    setTimeout(() => document.getElementById('carrinho')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };
  const changeQty = (key: string, delta: number) => setCart(items => items.flatMap(i => i.key !== key ? [i] : i.quantity + delta <= 0 ? [] : [{ ...i, quantity: Math.min(20, i.quantity + delta) }]));
  const subtotal = cart.reduce((sum, i) => sum + i.size.price * i.quantity, 0);
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);
  return <section id="pratos" className="section menu-section"><div className="page-width">
    <div className="section-heading reveal"><div><p className="eyebrow"><Utensils size={14} /> O CARINHO TÁ SERVIDO</p><h2>Os dois clássicos<br /><em>do dia.</em></h2></div><p>Todo almoço, duas opções.<br />O mesmo carinho de sempre.</p></div>
    <div className="menu-category"><Utensils size={16} /><span>Dois pratos do dia</span><span>Pequena 500ml · Grande 750ml</span></div>
    <div className="meal-grid">{meals.map(meal => <MealCard key={meal.id} meal={meal} selected={cart.some(i => i.meal.id === meal.id)} onSelect={() => openMeal(meal)} />)}</div>
    <p className="demo-note">Disponibilidade dos pratos a confirmar com a Tia Val.</p>
    {cart.length > 0 && <div id="carrinho" className="cart-panel" aria-label="Carrinho">
      <h3><ShoppingBag size={18} /> Seu carrinho <span>{count} {count === 1 ? 'marmita' : 'marmitas'}</span></h3>
      <ul className="cart-list">{cart.map(item => <li key={item.key}>
        <div><strong>{item.meal.name}</strong><p>{item.size.label}{item.notes ? ` · ${item.notes}` : ''}</p></div>
        <div className="quantity-stepper"><Button variant="ghost" size="icon" aria-label="Diminuir" onClick={() => changeQty(item.key, -1)}>{item.quantity === 1 ? <Trash2 /> : <Minus />}</Button><output>{item.quantity}</output><Button variant="ghost" size="icon" aria-label="Aumentar" onClick={() => changeQty(item.key, 1)}><Plus /></Button></div>
        <strong className="cart-line-total">{formatPrice(item.size.price * item.quantity)}</strong>
      </li>)}</ul>
      <dl className="cart-totals">
        <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
        <div className="cart-final"><dt>Total</dt><dd>{formatPrice(subtotal)}</dd></div>
      </dl>
      <div className="cart-actions"><Button onClick={() => setCheckout(true)}><ShoppingBag /> Finalizar pedido</Button><Button asChild variant="outline"><a href={contacts.phone}><Phone /> Ligar</a></Button><Button variant="ghost" onClick={() => { setCart([]); }}>Esvaziar carrinho</Button></div>
    </div>}
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="meal-dialog">
      {detail && <><MealMedia meal={detail} className="detail-photo" /><div className="detail-content"><p className="meal-tag">PRATO DO DIA{detail.badge ? ` · ${detail.badge.toUpperCase()}` : ''}</p><DialogTitle>{detail.name}</DialogTitle><DialogDescription>{detail.description}</DialogDescription><div className="size-picker" role="radiogroup" aria-label="Tamanho">{detail.sizes.map(option => <button key={option.id} type="button" role="radio" aria-checked={size.id === option.id} className={`size-option${size.id === option.id ? ' selected' : ''}`} onClick={() => setSize(option)}><span>{option.label}</span><strong>{formatPrice(option.price)}</strong></button>)}</div><label className="notes-label" htmlFor="meal-notes">Alguma observação?</label><textarea id="meal-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={240} placeholder="Ex.: sem cebola" rows={2} /><div className="detail-controls"><div className="quantity-stepper"><Button variant="ghost" size="icon" aria-label="Diminuir quantidade" disabled={quantity === 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus /></Button><output aria-label="Quantidade">{quantity}</output><Button variant="ghost" size="icon" aria-label="Aumentar quantidade" disabled={quantity === 10} onClick={() => setQuantity(value => Math.min(10, value + 1))}><Plus /></Button></div><Button onClick={() => addToCart(detail)}><ShoppingBag /> Adicionar · {formatPrice(size.price * quantity)} <ArrowUpRight /></Button></div><p className="demo-note">Finalize no carrinho: entrega R$1 por km, pague agora ou na entrega.</p></div></>}
    </DialogContent></Dialog>
    <Dialog open={checkout} onOpenChange={setCheckout}><DialogContent className="meal-dialog checkout-dialog">{checkout && <ConfettiBurst trigger={checkout} />}<div className="detail-content">
      <p className="meal-tag">FINALIZAR PEDIDO</p><DialogTitle>Seu pedido de hoje</DialogTitle><DialogDescription>Confira, diga onde entregar e como prefere pagar.</DialogDescription>
      <CheckoutForm when="hoje" items={cart.map(i => ({ name: i.meal.name, sizeLabel: i.size.label, unitPrice: i.size.price, quantity: i.quantity, notes: i.notes }))} onDone={() => { setCheckout(false); setCart([]); }} />
    </div></DialogContent></Dialog>
  </div></section>;
}
