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
  customer: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().regex(/^\d{10,11}$/) }),
  fulfillment: z.enum(['entrega', 'retirada']),
  address: z.object({
    cep: z.string().max(12), street: z.string().max(160), number: z.string().max(20),
    complement: z.string().max(120), bairro: z.string().max(100),
  }).optional(),
  distanceKm: z.number().positive().max(30).nullable(),
  payment: z.enum(['online', 'entrega-pix', 'entrega-cartao', 'entrega-dinheiro']),
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
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { buildPreferenceItems, createPreference, priceForSizeLabel } = await import('@/lib/mercadopago.server');
    const { insertOrderRecord, supabaseRequest } = await import('@/lib/supabase.server');
    if (data.fulfillment === 'entrega' && (!data.address || data.distanceKm == null || data.distanceKm > 30)) {
      throw new Error('Informe um endereço válido e calcule a entrega.');
    }

    const verifiedItems = data.items.map((item) => {
      const meal = findMeal(item.name, item.sizeLabel);
      const price = priceForSizeLabel(item.sizeLabel);
      if (!meal || price == null) throw new Error('Um dos itens não existe no cardápio atual.');
      return { ...item, unitPrice: price };
    });
    const subtotal = verifiedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const deliveryFee = data.fulfillment === 'entrega' && data.distanceKm != null ? deliveryFeeForKm(data.distanceKm) : 0;
    const total = subtotal + deliveryFee;
    const code = newCode();
    const itemsForPayment = verifiedItems.map(({ name, sizeLabel, quantity }) => ({ name, sizeLabel, quantity }));

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

    try {
      const preferenceItems = buildPreferenceItems(itemsForPayment, data.fulfillment, data.fulfillment === 'entrega' ? data.distanceKm : null);
      const checkout = await createPreference({
        code,
        items: preferenceItems,
        payer: { name: data.customer.name, phone: data.customer.phone },
      });
      await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ mp_preference_id: checkout.preferenceId }),
      });
      return { code, paymentUrl: checkout.url };
    } catch (error) {
      console.error('Checkout creation failed for order', code, error);
      throw new Error('O pedido foi registrado, mas não conseguimos abrir o pagamento. Entre em contato com a loja antes de tentar novamente.');
    }
  });
