// Pedidos do site. Ainda não há servidor: submitOrder é o ponto único onde a API
// (pedidos + Mercado Pago) será conectada depois. Tudo que a tela precisa já está no objeto Order.
import { deliveryFeePerKm } from '@/lib/restaurant-data';

export type OrderItem = { name: string; sizeLabel: string; unitPrice: number; quantity: number; notes?: string };
export type PaymentMethod = 'online' | 'entrega-pix' | 'entrega-cartao' | 'entrega-dinheiro';
export type Order = {
  when: 'hoje' | 'amanha';
  items: OrderItem[];
  customer: { name: string; phone: string };
  fulfillment: 'entrega' | 'retirada';
  address?: { cep: string; street: string; number: string; complement: string; bairro: string } | undefined;
  distanceKm: number | null;
  payment: PaymentMethod;
  changeFor?: number | null;
  totals: OrderTotals;
};
export type OrderTotals = { subtotal: number; deliveryFee: number; total: number };

export const deliveryFeeForKm = (km: number) => Math.max(1, Math.ceil(km)) * deliveryFeePerKm;

export function calculateTotals(items: OrderItem[], fulfillment: 'entrega' | 'retirada', km: number | null): OrderTotals {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const deliveryFee = fulfillment === 'entrega' && km != null ? deliveryFeeForKm(km) : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

export type SubmitResult = { code: string; paymentUrl: string | null };

const newCode = () => Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');

// Pagamento online: cria a cobrança no Mercado Pago e devolve o link do checkout.
// Pagamento na entrega: só gera o código do pedido.
export async function submitOrder(order: Order): Promise<SubmitResult> {
  const code = newCode();
  if (order.payment !== 'online') return { code, paymentUrl: null };
  const { createMercadoPagoCheckout } = await import('@/lib/payments.functions');
  const { url } = await createMercadoPagoCheckout({ data: {
    code,
    items: order.items.map(i => ({ name: i.name, sizeLabel: i.sizeLabel, quantity: i.quantity })),
    fulfillment: order.fulfillment,
    distanceKm: order.fulfillment === 'entrega' ? order.distanceKm : null,
    customer: { name: order.customer.name, phone: order.customer.phone.replace(/\D/g, '') },
  } });
  return { code, paymentUrl: url };
}
