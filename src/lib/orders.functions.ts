import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { meals, tomorrowMenu } from '@/lib/restaurant-data';
import { deliveryFeeForKm } from '@/lib/orders';

const schema = z.object({
  when: z.enum(['hoje', 'amanha']),
  items: z.array(z.object({
    name: z.string().min(1).max(120),
    sizeLabel: z.string().min(1).max(120),
    unitPrice: z.number().nonnegative(),
    quantity: z.number().int().min(1).max(50),
    notes: z.string().max(300).optional(),
  })).min(1).max(30),
  customer: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().regex(/^\d{10,11}$/), email: z.string().trim().email().max(254).optional() }),
  fulfillment: z.enum(['entrega', 'retirada']),
  address: z.object({
    cep: z.string().max(12), street: z.string().max(160), number: z.string().max(20),
    complement: z.string().max(120), bairro: z.string().max(100),
  }).optional(),
  distanceKm: z.number().positive().max(30).nullable(),
  payment: z.enum(['online', 'entrega-pix', 'entrega-cartao', 'entrega-dinheiro']),
  onlineMethod: z.enum(['pix', 'credit_card', 'debit_card', 'ticket', 'account_money']).optional(),
  changeFor: z.number().positive().nullable().optional(),
});

const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (byte) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('');

function findMeal(name: string, sizeLabel: string) {
  const all = [
    ...meals.map((meal) => ({ name: meal.name, sizes: meal.sizes })),
    ...tomorrowMenu.map((meal) => ({ name: meal.name, sizes: meal.sizes })),
  ];
  return all.find((meal) => meal.name === name && meal.sizes.some((size) => size.label === sizeLabel));
}

export const createOrder = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => {
    try {
      return schema.parse(input);
    } catch (error) {
      console.error('Order request validation failed', error);
      throw error;
    }
  })
  .handler(async ({ data }) => {
    let stage = 'loading payment and database modules';
    let code = 'not-created';
    try {
      const { buildPreferenceItems, createPreference, createPixPayment, priceForSizeLabel } = await import('@/lib/mercadopago.server');
      const { insertOrderRecord, supabaseRequest } = await import('@/lib/supabase.server');
      stage = 'validating delivery details';
      if (data.fulfillment === 'entrega' && (!data.address || data.distanceKm == null || data.distanceKm > 30)) {
        throw new Error('Informe um endereço válido e calcule a entrega.');
      }
      if (data.payment === 'online' && !data.onlineMethod) {
        throw new Error('Escolha uma forma de pagamento online.');
      }
      if (data.payment === 'online' && data.onlineMethod === 'pix' && !data.customer.email) {
        throw new Error('Informe um e-mail válido para gerar o Pix.');
      }

      stage = 'validating menu items and prices';
      const verifiedItems = data.items.map((item) => {
        const meal = findMeal(item.name, item.sizeLabel);
        const price = priceForSizeLabel(item.sizeLabel);
        if (!meal || price == null) throw new Error('Um dos itens não existe no cardápio atual.');
        return { ...item, unitPrice: price };
      });
      const subtotal = verifiedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const deliveryFee = data.fulfillment === 'entrega' && data.distanceKm != null ? deliveryFeeForKm(data.distanceKm) : 0;
      const total = subtotal + deliveryFee;
      code = newCode();
      const itemsForPayment = verifiedItems.map(({ name, sizeLabel, quantity }) => ({ name, sizeLabel, quantity }));

      stage = 'saving order in Supabase';
      const orderId = await insertOrderRecord({
        code,
        order_for: data.when,
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        fulfillment: data.fulfillment,
        address: data.fulfillment === 'entrega' ? data.address ?? null : null,
        distance_km: data.fulfillment === 'entrega' ? data.distanceKm : null,
        payment_method: data.payment,
        payment_status: data.payment === 'online' ? 'pending' : 'not_required',
        order_status: 'novo',
        subtotal,
        delivery_fee: deliveryFee,
        total,
        change_for: data.payment === 'entrega-dinheiro' ? data.changeFor ?? null : null,
      }, verifiedItems.map((item) => ({
        meal_name: item.name,
        size_label: item.sizeLabel,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        notes: item.notes ?? null,
      })));

      if (data.payment !== 'online') return { code, paymentUrl: null as string | null };

      if (data.onlineMethod === 'pix') {
        stage = 'creating Mercado Pago Pix payment';
        const pixPayment = await createPixPayment({
          code,
          amount: total,
          description: `Pedido Marmitex da Tia Val #${code}`,
          payer: { name: data.customer.name, phone: data.customer.phone, email: data.customer.email! },
        });
        stage = 'saving Mercado Pago Pix payment ID';
        await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ mp_payment_id: pixPayment.paymentId }),
        });
        return { code, paymentUrl: null as string | null, pixPayment };
      }

      stage = 'creating Mercado Pago preference';
      const preferenceItems = buildPreferenceItems(itemsForPayment, data.fulfillment, data.fulfillment === 'entrega' ? data.distanceKm : null);
      const checkout = await createPreference({
        code,
        items: preferenceItems,
        payer: { name: data.customer.name, phone: data.customer.phone },
        onlineMethod: data.onlineMethod!,
      });
      stage = 'saving Mercado Pago preference ID';
      await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ mp_preference_id: checkout.preferenceId }),
      });
      return { code, paymentUrl: checkout.url };
    } catch (error) {
      console.error('Order submission failed', { stage, orderCode: code, error });
      throw new Error('Não foi possível concluir o pedido. A equipe técnica pode localizar o erro pelos logs do servidor.');
    }
  });


// Consulta o status do Pix sem expor o Access Token ao navegador.
export const checkPixPayment = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => z.object({ code: z.string().regex(/^[A-Z0-9]{5,10}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseRequest } = await import('@/lib/supabase.server');
    const { getPayment } = await import('@/lib/mercadopago.server');
    const rows = await supabaseRequest<Array<{ id: string; total: number; mp_payment_id: string | null; payment_status: string }>>(
      `orders?select=id,total,mp_payment_id,payment_status&code=eq.${encodeURIComponent(data.code)}&limit=1`,
    );
    const order = rows[0];
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.payment_status === 'approved' || !order.mp_payment_id) return { status: order.payment_status };
    const payment = await getPayment(order.mp_payment_id);
    if (payment.external_reference !== data.code || Math.round(Number(payment.transaction_amount) * 100) !== Math.round(Number(order.total) * 100)) {
      throw new Error('Não foi possível validar o pagamento Pix.');
    }
    const statusMap: Record<string, string> = { approved: 'approved', pending: 'pending', in_process: 'pending', rejected: 'rejected', cancelled: 'cancelled', refunded: 'refunded', charged_back: 'refunded' };
    const status = statusMap[payment.status] ?? order.payment_status;
    if (status !== order.payment_status) {
      await supabaseRequest(`orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ payment_status: status, mp_payment_id: String(payment.id) }),
      });
    }
    return { status };
  });
