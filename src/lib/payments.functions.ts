import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const schema = z.object({
  code: z.string().regex(/^[A-Z0-9]{5,10}$/),
  items: z.array(z.object({ name: z.string().min(1).max(120), sizeLabel: z.string().min(1).max(120), quantity: z.number().int().min(1).max(50) })).min(1).max(30),
  fulfillment: z.enum(['entrega', 'retirada']),
  distanceKm: z.number().positive().max(100).nullable(),
  customer: z.object({ name: z.string().min(2).max(80), phone: z.string().regex(/^\d{10,11}$/) }),
});

export const createMercadoPagoCheckout = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { buildPreferenceItems, createPreference } = await import('./mercadopago.server');
    const items = buildPreferenceItems(data.items, data.fulfillment, data.distanceKm);
    const url = await createPreference({ code: data.code, items, payer: data.customer });
    return { url };
  });
