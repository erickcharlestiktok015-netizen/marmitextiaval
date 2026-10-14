// Tipos e cálculos de pedidos. A gravação real ocorre em orders.functions.ts, no servidor.
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

export async function submitOrder(order: Order): Promise<SubmitResult> {
  const { createOrder } = await import('@/lib/orders.functions');
  return createOrder({ data: {
    when: order.when,
    items: order.items,
    customer: { name: order.customer.name.trim(), phone: order.customer.phone.replace(/\D/g, '') },
    fulfillment: order.fulfillment,
    address: order.address,
    distanceKm: order.fulfillment === 'entrega' ? order.distanceKm : null,
    payment: order.payment,
    changeFor: order.changeFor ?? null,
  } });
}
