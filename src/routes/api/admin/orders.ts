import { createFileRoute } from '@tanstack/react-router';
import { isAdminRequest } from '@/lib/admin-auth.server';
import { supabaseRequest } from '@/lib/supabase.server';

type Row = { [key: string]: unknown; id?: unknown; order_id?: unknown; order_for?: unknown; fulfillment?: unknown };

export const Route = createFileRoute('/api/admin/orders')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        try {
          const orders = await supabaseRequest<Array<Row>>('orders?select=*&order=created_at.desc&limit=100');
          const items = await supabaseRequest<Array<Row>>('order_items?select=*&order=created_at.asc');
          const withItems = orders.map((order) => ({ ...order, items: items.filter((item) => item.order_id === order.id) }));
          return Response.json({ orders: withItems }, { headers: { 'Cache-Control': 'no-store' } });
        } catch {
          return Response.json({ error: 'Não foi possível carregar os pedidos.' }, { status: 503 });
        }
      },
      PATCH: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        let body: { id?: unknown; order_status?: unknown; estimated_delivery_at?: unknown };
        try { body = await request.json() as { id?: unknown; order_status?: unknown; estimated_delivery_at?: unknown }; }
        catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
        const allowed = ['novo', 'confirmado', 'preparando', 'pronto_entrega', 'saiu_entrega', 'pronto_retirada', 'concluido', 'cancelado'];
        const validStatus = typeof body.order_status === 'string' && allowed.includes(body.order_status);
        const hasEta = Object.prototype.hasOwnProperty.call(body, 'estimated_delivery_at');
        const validEta = !hasEta || body.estimated_delivery_at === null || (typeof body.estimated_delivery_at === 'string' && Number.isFinite(Date.parse(body.estimated_delivery_at)));
        if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || (!validStatus && !hasEta) || (body.order_status !== undefined && !validStatus) || !validEta) {
          return Response.json({ error: 'Atualização inválida.' }, { status: 400 });
        }
        if (hasEta) {
          try {
            const target = await supabaseRequest<Array<Row>>(`orders?select=id,order_for,fulfillment&id=eq.${encodeURIComponent(body.id)}&limit=1`);
            if (!target[0] || target[0].order_for !== 'amanha' || target[0].fulfillment !== 'entrega') {
              return Response.json({ error: 'A previsão manual no painel é exclusiva de entregas agendadas para amanhã. Nos pedidos de hoje, o motoboy define a estimativa.' }, { status: 403 });
            }
          } catch { return Response.json({ error: 'Não foi possível validar o agendamento.' }, { status: 503 }); }
        }
        try {
          const patch: Record<string, unknown> = {};
          if (validStatus) patch['order_status'] = body.order_status;
          if (hasEta) patch['estimated_delivery_at'] = body.estimated_delivery_at;
          await supabaseRequest(`orders?id=eq.${encodeURIComponent(body.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(patch),
          });
          if (body.order_status === 'concluido') {
            try {
              const rows = await supabaseRequest<Array<Row>>(`orders?select=id,payment_method&id=eq.${encodeURIComponent(body.id)}&limit=1`);
              if (rows[0] && rows[0]['payment_method'] !== 'online') {
                const { sendPurchaseOnce } = await import('@/lib/facebook-capi.server');
                await sendPurchaseOnce(body.id);
              }
            } catch (capiError) { console.error('[facebook-capi] Purchase ignorado', capiError); }
          }
          return Response.json({ ok: true });
        } catch {
          return Response.json({ error: 'Não foi possível atualizar o pedido.' }, { status: 503 });
        }
      },
    },
  },
});
