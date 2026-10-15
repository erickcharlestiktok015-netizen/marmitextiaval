import { createFileRoute } from '@tanstack/react-router';
import { supabaseRequest } from '@/lib/supabase.server';

export const Route = createFileRoute('/api/public/tracking')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get('token') ?? '';
        if (!/^[a-f0-9]{64}$/.test(token)) {
          return Response.json({ error: 'Link de acompanhamento inválido.' }, { status: 400 });
        }
        try {
          const rows = await supabaseRequest<Array<{
            id: string; code: string; order_status: string; payment_status: string; payment_method: string;
            fulfillment: string; estimated_delivery_at: string | null; courier_status: string;
            confirmation_code: string | null; created_at: string; updated_at: string;
          }>>(
            `orders?select=id,code,order_status,payment_status,payment_method,fulfillment,estimated_delivery_at,courier_status,confirmation_code,created_at,updated_at&tracking_token=eq.${encodeURIComponent(token)}&limit=1`,
          );
          const order = rows[0];
          if (!order) return Response.json({ error: 'Pedido não encontrado.' }, { status: 404 });
          const items = await supabaseRequest<Array<{ meal_name: string; size_label: string; quantity: number }>>(
            `order_items?select=meal_name,size_label,quantity&order_id=eq.${encodeURIComponent(order.id)}&order=created_at.asc`,
          );
          return Response.json({
            order: {
              ...order,
              id: undefined,
              confirmation_code: order.courier_status === 'cheguei' ? order.confirmation_code : null,
              items,
            },
          }, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
        } catch {
          return Response.json({ error: 'Não foi possível consultar seu pedido agora.' }, { status: 503 });
        }
      },
    },
  },
});
