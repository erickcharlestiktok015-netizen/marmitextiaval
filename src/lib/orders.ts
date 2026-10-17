// Tipos e cálculos de pedidos. A gravação real ocorre em orders.functions.ts, no servidor.
import { deliveryFeePerKm } from '@/lib/restaurant-data';

export type OrderItem = { name: string; sizeLabel: string; unitPrice: number; quantity: number; notes?: string };
export type PaymentMethod = 'online' | 'entrega-pix' | 'entrega-cartao' | 'entrega-dinheiro';
export type OnlinePaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'ticket' | 'account_money';
export type Order = {
  when: 'hoje' | 'amanha';
  items: OrderItem[];
  customer: { name: string; phone: string; email?: string };
  fulfillment: 'entrega' | 'retirada';
  address?: { cep: string; street: string; number: string; complement: string; bairro: string; latitude?: number; longitude?: number } | undefined;
  distanceKm: number | null;
  payment: PaymentMethod;
  onlineMethod?: OnlinePaymentMethod;
  changeFor?: number | null;
  totals: OrderTotals;
};
export type OrderTotals = { subtotal: number; deliveryFee: number; total: number };

// Cobrança proporcional à distância real da rota: R$ 1,50 por km, sem arredondar o km para cima.
export const deliveryFeeForKm = (km: number) => Math.round(Math.max(0, km) * deliveryFeePerKm * 100) / 100;

export function calculateTotals(items: OrderItem[], fulfillment: 'entrega' | 'retirada', km: number | null): OrderTotals {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const deliveryFee = fulfillment === 'entrega' && km != null ? deliveryFeeForKm(km) : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

export type SubmitResult = { code: string; trackingToken: string; paymentUrl: string | null; pixPayment?: { paymentId: string; qrCode: string; qrCodeBase64: string; status: string } };

export async function submitOrder(order: Order): Promise<SubmitResult> {
  const { createOrder } = await import('@/lib/orders.functions');
  return createOrder({ data: {
    when: order.when,
    items: order.items,
    customer: { name: order.customer.name.trim(), phone: order.customer.phone.replace(/\D/g, ''), email: order.customer.email?.trim() },
    fulfillment: order.fulfillment,
    address: order.address,
    distanceKm: order.fulfillment === 'entrega' ? order.distanceKm : null,
    payment: order.payment,
    onlineMethod: order.onlineMethod,
    changeFor: order.changeFor ?? null,
  } });
}


export async function checkOrderPaymentStatus(code: string): Promise<{ status: string }> {
  const { checkPixPayment } = await import('@/lib/orders.functions');
  return checkPixPayment({ data: { code } });
}
