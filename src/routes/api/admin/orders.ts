import { createFileRoute } from '@tanstack/react-router';
import { isAdminRequest } from '@/lib/admin-auth.server';
import { supabaseRequest } from '@/lib/supabase.server';

export const Route = createFileRoute('/api/admin/orders')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        try {
          const orders = await supabaseRequest<Array<Record<string, unknown>>>('orders?select=*&order=created_at.desc&limit=100');
          const items = await supabaseRequest<Array<Record<string, unknown>>>('order_items?select=*&order=created_at.asc');
          const withItems = orders.map((order) => ({ ...order, items: items.filter((item) => item.order_id === order.id) }));
          return Response.json({ orders: withItems }, { headers: { 'Cache-Control': 'no-store' } });
        } catch {
          return Response.json({ error: 'Não foi possível carregar os pedidos.' }, { status: 503 });
        }
      },
      PATCH: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        let body: { id?: unknown; order_status?: unknown };
        try { body = await request.json() as { id?: unknown; order_status?: unknown }; }
        catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
        const allowed = ['novo', 'confirmado', 'preparando', 'saiu_entrega', 'pronto_retirada', 'concluido', 'cancelado'];
        if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.order_status !== 'string' || !allowed.includes(body.order_status)) {
          return Response.json({ error: 'Status inválido.' }, { status: 400 });
        }
        try {
          await supabaseRequest(`orders?id=eq.${encodeURIComponent(body.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ order_status: body.order_status }),
          });
          return Response.json({ ok: true });
        } catch {
          return Response.json({ error: 'Não foi possível atualizar o pedido.' }, { status: 503 });
        }
      },
    },
  },
});
