// Admin orders - rota para gerenciar pedidos
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { sendFacebookServerEvent } from '@/lib/facebook-capi.server';

export const updateOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({
    orderCode: z.string(),
    status: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { orderCode, status } = data;

    // Se o status for 'concluido', dispara o evento Purchase via CAPI
    if (status === 'concluido') {
      try {
        await sendFacebookServerEvent({
          eventName: 'Purchase',
          eventId: orderCode,
          order: {
            code: orderCode,
            total: 0,
            customer: {
              name: '',
              phone: '',
            },
          },
        });
      } catch (error) {
        console.error(`Falha ao enviar evento Purchase para pedido ${orderCode}:`, error);
      }
    }

    return { success: true };
  });