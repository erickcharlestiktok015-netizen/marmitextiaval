import { createFileRoute } from '@tanstack/react-router';
import { isCourierRequest } from '@/lib/courier-auth.server';
import { supabaseRequest } from '@/lib/supabase.server';

type OrderRow = Record<string, any>;
const validId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
export const Route = createFileRoute('/api/courier/orders')({
  server: { handlers: {
    GET: async ({ request }) => {
      if (!(await isCourierRequest(request))) {
        console.warn('[courier-orders] GET bloqueado: sessão ausente ou inválida.');
        return Response.json({ error: 'Faça login como motoboy.' }, { status: 401 });
      }
      try {
        const orders = await supabaseRequest<OrderRow[]>(
          "orders?select=id,code,customer_name,customer_phone,address,order_status,payment_method,payment_status,total,delivery_fee,estimated_delivery_at,courier_status,courier_latitude,courier_longitude,courier_location_updated_at,created_at,confirmation_code&fulfillment=eq.entrega&order=created_at.asc&limit=100",
        );
        // Mostrar o pedido ao motoboy assim que entrar na operação de entrega,
        // mas a tela só permite iniciar a saída quando a cozinha marcar pronto_entrega.
        const visibleStatuses = ['novo', 'confirmado', 'preparando', 'pronto_entrega', 'saiu_entrega'];
        const queue = orders.filter(o =>
          visibleStatuses.includes(String(o.order_status)) &&
          (o.fulfillment === 'entrega') &&
          (o.payment_method !== 'online' || o.payment_status === 'approved')
        );
        const ids = queue.map(o => o.id);
        const items = ids.length
          ? await supabaseRequest<OrderRow[]>(`order_items?select=order_id,meal_name,size_label,quantity,notes&order_id=in.(${ids.join(',')})&order=created_at.asc`)
          : [];
        return Response.json({
          orders: queue.map(o => ({
            id: o.id, code: o.code, customer_name: o.customer_name, customer_phone: o.customer_phone,
            address: o.address, order_status: o.order_status, payment_method: o.payment_method,
            payment_status: o.payment_status, total: o.total, delivery_fee: o.delivery_fee,
            estimated_delivery_at: o.estimated_delivery_at, courier_status: o.courier_status,
            courier_latitude: o.courier_latitude, courier_longitude: o.courier_longitude,
            courier_location_updated_at: o.courier_location_updated_at, created_at: o.created_at,
            confirmation_code: o.courier_status === 'cheguei' ? o.confirmation_code : null,
            items: items.filter(i => i.order_id === o.id),
          })),
        }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
      } catch (error) {
        console.error('[courier-orders] Falha ao carregar fila:', error instanceof Error ? { name: error.name, message: error.message } : { error: String(error) });
        return Response.json({ error: 'Não foi possível carregar as entregas.' }, { status: 503 });
      }
    },
    PATCH: async ({ request }) => {
      if (!(await isCourierRequest(request))) {
        console.warn('[courier-orders] PATCH bloqueado: sessão ausente ou inválida.');
        return Response.json({ error: 'Faça login como motoboy.' }, { status: 401 });
      }
      let body: { action?: unknown; id?: unknown; latitude?: unknown; longitude?: unknown; code?: unknown };
      try { body = await request.json() as typeof body; } catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
      const action = body.action;
      if (action === 'location') {
        if (typeof body.latitude !== 'number' || body.latitude < -90 || body.latitude > 90 ||
            typeof body.longitude !== 'number' || body.longitude < -180 || body.longitude > 180) {
          return Response.json({ error: 'Localização inválida.' }, { status: 400 });
        }
        try {
          const active = await supabaseRequest<OrderRow[]>("orders?select=id&order_status=eq.saiu_entrega&fulfillment=eq.entrega&limit=100");
          await Promise.all(active.map(o => supabaseRequest(`orders?id=eq.${encodeURIComponent(o.id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ courier_latitude: body.latitude, courier_longitude: body.longitude, courier_location_updated_at: new Date().toISOString() }),
          })));
          return Response.json({ ok: true, active: active.length });
        } catch (error) {
          console.error('[courier-orders] Falha ao atualizar GPS:', error instanceof Error ? { name: error.name, message: error.message } : { error: String(error) });
          return Response.json({ error: 'Não foi possível atualizar a localização.' }, { status: 503 });
        }
      }
      if (!validId(body.id) || !['start', 'arrived', 'delivered'].includes(String(action))) return Response.json({ error: 'Ação inválida.' }, { status: 400 });
      try {
        const rows = await supabaseRequest<OrderRow[]>(`orders?select=id,order_status,payment_method,payment_status,courier_status,confirmation_code& id=eq.${encodeURIComponent(body.id)}&fulfillment=eq.entrega&limit=1`.replace('& id=', '&id='));
        const order = rows[0];
        if (!order) return Response.json({ error: 'Entrega não encontrada.' }, { status: 404 });
        if (order.payment_method === 'online' && order.payment_status !== 'approved') return Response.json({ error: 'O pagamento online ainda não foi aprovado.' }, { status: 409 });
        let patch: Record<string, unknown>;
        if (action === 'start') {
          if (!['pronto_entrega', 'saiu_entrega'].includes(order.order_status)) return Response.json({ error: 'Esta entrega ainda não está pronta para sair.' }, { status: 409 });
          patch = { order_status: 'saiu_entrega', courier_status: 'saiu_entrega', courier_started_at: new Date().toISOString() };
        } else if (action === 'arrived') {
          if (order.order_status !== 'saiu_entrega') return Response.json({ error: 'Inicie a entrega primeiro.' }, { status: 409 });
          patch = { courier_status: 'cheguei' };
        } else {
          if (order.courier_status !== 'cheguei') return Response.json({ error: 'Marque que chegou ao endereço antes de concluir.' }, { status: 409 });
          if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code) || body.code !== order.confirmation_code) return Response.json({ error: 'Código de confirmação incorreto.' }, { status: 400 });
          patch = { order_status: 'concluido', courier_status: 'entregue' };
        }
        await supabaseRequest(`orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        return Response.json({ ok: true });
      } catch (error) {
        console.error('[courier-orders] Falha ao atualizar entrega:', error instanceof Error ? { name: error.name, message: error.message } : { error: String(error) });
        return Response.json({ error: 'Não foi possível atualizar esta entrega.' }, { status: 503 });
      }
    },
  } },
});
