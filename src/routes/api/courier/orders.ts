import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { sendFacebookServerEvent } from '@/lib/facebook-capi.server';

export const fetchPendingDeliveries = createServerFn({ method: 'GET' }).handler(async () => {
  // Em produção, isso faria uma chamada para o Supabase ou API real
  // Por agora, retorna dados mockados para teste
  return [
    {
      code: 'TEST001',
      customerName: 'Maria Silva',
      customerPhone: '(31) 99999-8888',
      address: 'Rua das Flores, 100',
      addressDetails: 'Apto 201',
      distanceKm: 2.5,
      total: 25.00,
      status: 'pending',
      items: [{ name: 'Feijoada', sizeLabel: 'Completa grande', quantity: 1 }],
      orderTime: '2024-01-15T12:00:00Z'
    },
    {
      code: 'TEST002',
      customerName: 'João Santos',
      customerPhone: '(31) 98765-4321',
      address: 'Av. Antônio Carlos, 500',
      distanceKm: 4.3,
      total: 35.00,
      status: 'pending',
      items: [{ name: 'Marmitex Tropeiro', sizeLabel: 'Completa pequena', quantity: 1 }],
      orderTime: '2024-01-15T13:30:00Z'
    }
  ];
});

// Ação de confirmação de entrega pelo motoboy (código de 6 dígitos)
export const confirmDelivery = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({
    orderCode: z.string().length(6),
    verificationCode: z.string().length(6),
    courierId: z.string(),
  }).parse(data))
  .handler(async ({ data, request }) => {
    const { orderCode, verificationCode, courierId } = data;

    // Em produção: validar código no banco
    // const order = await validateDeliveryCode(orderCode, verificationCode);
    // if (!order) throw new Error('Código inválido');

    // Dispara evento Purchase via CAPI para pagamento na entrega/retirada
    try {
      await sendFacebookServerEvent({
        eventName: 'Purchase',
        eventId: orderCode,
        order: {
          code: orderCode,
          total: 25.00, // valor real viria do banco
          customer: {
            name: 'Cliente',
            phone: '(31) 99999-8888',
          },
        },
        req: request,
      });
    } catch (error) {
      console.error(`Falha ao enviar evento Purchase para entrega ${orderCode}:`, error);
    }

    return { success: true, message: 'Entrega confirmada' };
  });