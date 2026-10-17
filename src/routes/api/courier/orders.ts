import { createFileRoute } from '@tanstack/react-router';
import { isCourierRequest } from '@/lib/courier-auth.server';
import { supabaseRequest } from '@/lib/supabase.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderRow = any;
const safeDatabaseError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('SUPABASE_URL') || message.includes('SUPABASE_SECRET_KEY')) {
    return 'O acesso ao banco não está configurado na Vercel. Confira SUPABASE_URL e SUPABASE_SECRET_KEY.';
  }
  return fallback;
};
const validId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
export const Route = createFileRoute('/api/courier/orders')({
  server: { handlers: {
    GET: async ({ request }) => {
      if (!(await isCourierRequest(request))) {
        console.warn('[courier-orders] GET bloqueado: sessão ausente ou inválida.');
        return Response.json({ error: 'Faça login como motoboy.' }, { status: 401 });
      }
      try {
        // select=* evita erro caso alguma coluna opcional não exista no schema.
        // Filtra os status ativos no banco: com mais de 100 pedidos antigos, um limite
        // sem filtro deixava os pedidos novos de fora da fila do motoboy.
        const orders = await supabaseRequest<OrderRow[]>(
          'orders?select=*&fulfillment=eq.entrega&order_status=in.(novo,confirmado,preparando,pronto_entrega,saiu_entrega)&order=created_at.desc&limit=200',
        ).then(rows => rows.reverse());
        let dailyEarnings = 0;
        try {
          const fortalezaDate = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(new Date());
          const dayStart = new Date(`${fortalezaDate}T00:00:00-03:00`).toISOString();
          const completedToday = await supabaseRequest<OrderRow[]>(
            `orders?select=*&fulfillment=eq.entrega&order_status=eq.concluido&updated_at=gte.${encodeURIComponent(dayStart)}&limit=1000`,
          );
          dailyEarnings = completedToday.reduce((sum, order) => {
            const fee = Number(order.delivery_fee);
            return sum + (Number.isFinite(fee) && fee > 0 ? fee : 0);
          }, 0);
        } catch { /* ganhos são opcionais; não derrubam a fila */ }
        // Todos os pedidos ativos aparecem, inclusive pagamento na entrega.
        // Só ocultamos pagamento online ainda não aprovado.
        const visibleStatuses = ['novo', 'confirmado', 'preparando', 'pronto_entrega', 'saiu_entrega'];
        const queue = orders.filter(o =>
          visibleStatuses.includes(String(o.order_status)) &&
          !(o.payment_method === 'online' && o.payment_status && !['approved', 'paid', 'aprovado'].includes(String(o.payment_status)))
        );
        const ids = queue.map(o => o.id);
        let items: OrderRow[] = [];
        if (ids.length) {
          try {
            items = await supabaseRequest<OrderRow[]>(`order_items?select=*&order_id=in.(${ids.join(',')})`);
          } catch (e) {
            console.warn('[courier-orders] Itens indisponíveis; retornando pedidos sem itens.', { type: e instanceof Error ? e.name : 'unknown' });
          }
        }
        return Response.json({
          dailyEarnings,
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
        console.error('[courier-orders] Falha ao carregar fila:', { type: error instanceof Error ? error.name : 'unknown' });
        return Response.json({ error: safeDatabaseError(error, 'Não foi possível carregar as entregas. Verifique a conexão do servidor com o banco.') }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
    },
    PATCH: async ({ request }) => {
      if (!(await isCourierRequest(request))) {
        console.warn('[courier-orders] PATCH bloqueado: sessão ausente ou inválida.');
        return Response.json({ error: 'Faça login como motoboy.' }, { status: 401 });
      }
      let body: { action?: unknown; id?: unknown; latitude?: unknown; longitude?: unknown; code?: unknown; minutes?: unknown };
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
          console.error('[courier-orders] Falha ao atualizar GPS:', { type: error instanceof Error ? error.name : 'unknown' });
          return Response.json({ error: safeDatabaseError(error, 'Não foi possível atualizar a localização. Verifique a conexão e tente novamente.') }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
      }
      if (!validId(body.id) || !['start', 'arrived', 'delivered', 'estimate'].includes(String(action))) return Response.json({ error: 'Ação inválida.' }, { status: 400 });
      try {
        const rows = await supabaseRequest<OrderRow[]>(`orders?select=id,order_status,payment_method,payment_status,courier_status,confirmation_code&id=eq.${encodeURIComponent(body.id)}&fulfillment=eq.entrega&limit=1`);
        const order = rows[0];
        if (!order) return Response.json({ error: 'Entrega não encontrada.' }, { status: 404 });
        if (order.payment_method === 'online' && order.payment_status !== 'approved') return Response.json({ error: 'O pagamento online ainda não foi aprovado.' }, { status: 409 });
        if (action === 'estimate') {
          if (!['pronto_entrega', 'saiu_entrega'].includes(order.order_status)) return Response.json({ error: 'A previsão só pode ser definida quando a entrega estiver pronta ou em rota.' }, { status: 409 });
          if (![15, 30, 45, 60].includes(Number(body.minutes))) return Response.json({ error: 'Escolha uma previsão entre 15 e 60 minutos.' }, { status: 400 });
          const estimatedAt = new Date(Date.now() + Number(body.minutes) * 60000).toISOString();
          await supabaseRequest(`orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estimated_delivery_at: estimatedAt }) });
          return Response.json({ ok: true, estimated_delivery_at: estimatedAt });
        }
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
        if (action === 'delivered' && order.payment_method !== 'online') {
          try {
            const { sendPurchaseOnce } = await import('@/lib/facebook-capi.server');
            await sendPurchaseOnce(order.id);
          } catch (capiError) { console.error('[facebook-capi] Purchase ignorado', capiError); }
        }
        return Response.json({ ok: true });
      } catch (error) {
        console.error('[courier-orders] Falha ao atualizar entrega:', { type: error instanceof Error ? error.name : 'unknown' });
        return Response.json({ error: safeDatabaseError(error, 'Não foi possível atualizar esta entrega. Verifique a conexão e tente novamente.') }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
    },
  } },
});
