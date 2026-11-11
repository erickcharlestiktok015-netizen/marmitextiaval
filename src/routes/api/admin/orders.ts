import { createFileRoute } from '@tanstack/react-router';
import { isAdminRequest } from '@/lib/admin-auth.server';
import { supabaseRequest } from '@/lib/supabase.server';

type Row = { [key: string]: unknown; id?: unknown; code?: unknown; total?: unknown; payment_method?: unknown; payment_status?: unknown; mp_payment_id?: unknown; created_at?: unknown };

export const Route = createFileRoute('/api/admin/orders')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        try {
          const orders = await supabaseRequest<Array<Row>>('orders?select=*&order=created_at.desc&limit=100');

          // Auto-sincronização do Pix em tempo real:
          // Se houver pedidos online com status pending criados nas últimas 6 horas, checa no Mercado Pago
          const token = (process.env['MP_ACCESS_TOKEN'] || process.env['MERCADO_PAGO_ACCESS_TOKEN'] || '').trim();
          if (token) {
            const now = Date.now();
            const pendingPix = orders.filter(
              (o) =>
                o.payment_method === 'online' &&
                o.payment_status === 'pending' &&
                now - new Date(String(o.created_at || 0)).getTime() < 6 * 60 * 60 * 1000
            );

            if (pendingPix.length > 0) {
              const { getPayment, searchPaymentByCode } = await import('@/lib/mercadopago.server');
              for (const ord of pendingPix) {
                try {
                  let p: { id: number | string; status: string; transaction_amount: number; external_reference: string } | null = null;
                  if (ord.mp_payment_id && typeof ord.mp_payment_id === 'string' && /^\d+$/.test(ord.mp_payment_id)) {
                    p = await getPayment(ord.mp_payment_id).catch(() => null);
                  }
                  if (!p && typeof ord.code === 'string') {
                    p = await searchPaymentByCode(ord.code).catch(() => null);
                  }
                  if (p && p.status === 'approved' && Math.round(Number(ord.total) * 100) === Math.round(Number(p.transaction_amount) * 100)) {
                    await supabaseRequest(`orders?id=eq.${encodeURIComponent(String(ord.id))}`, {
                      method: 'PATCH',
                      headers: { Prefer: 'return=minimal' },
                      body: JSON.stringify({ payment_status: 'approved', mp_payment_id: String(p.id) }),
                    });
                    ord.payment_status = 'approved';
                    ord.mp_payment_id = String(p.id);
                  }
                } catch (syncErr) {
                  console.error('[admin-orders-sync] Erro ao sincronizar pedido:', ord.code, syncErr);
                }
              }
            }
          }

          const items = await supabaseRequest<Array<Row>>('order_items?select=*&order=created_at.asc');
          const withItems = orders.map((order) => ({ ...order, items: items.filter((item) => item.order_id === order.id) }));
          return Response.json({ orders: withItems }, { headers: { 'Cache-Control': 'no-store' } });
        } catch {
          return Response.json({ error: 'Não foi possível carregar os pedidos.' }, { status: 503 });
        }
      },
      PATCH: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        let body: { id?: unknown; order_status?: unknown; payment_status?: unknown; estimated_delivery_at?: unknown; notes?: unknown; action?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: 'Requisição inválida.' }, { status: 400 });
        }

        if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) {
          return Response.json({ error: 'ID do pedido inválido.' }, { status: 400 });
        }

        // Ação especial: Verificar pagamento no Mercado Pago sob demanda
        if (body.action === 'verify_payment') {
          try {
            const rows = await supabaseRequest<Array<Row>>(`orders?select=id,code,total,payment_status,mp_payment_id&id=eq.${encodeURIComponent(body.id)}&limit=1`);
            const target = rows[0];
            if (!target) return Response.json({ error: 'Pedido não encontrado.' }, { status: 404 });

            const { getPayment, searchPaymentByCode } = await import('@/lib/mercadopago.server');
            let p: { id: number | string; status: string; transaction_amount: number; external_reference: string } | null = null;
            if (target.mp_payment_id && typeof target.mp_payment_id === 'string' && /^\d+$/.test(target.mp_payment_id)) {
              p = await getPayment(target.mp_payment_id).catch(() => null);
            }
            if (!p && typeof target.code === 'string') {
              p = await searchPaymentByCode(target.code).catch(() => null);
            }

            if (p) {
              const statusMap: Record<string, string> = {
                approved: 'approved',
                pending: 'pending',
                in_process: 'pending',
                rejected: 'rejected',
                cancelled: 'cancelled',
              };
              const paymentStatus = statusMap[p.status] || target.payment_status;
              if (paymentStatus !== target.payment_status) {
                await supabaseRequest(`orders?id=eq.${encodeURIComponent(body.id)}`, {
                  method: 'PATCH',
                  headers: { Prefer: 'return=minimal' },
                  body: JSON.stringify({ payment_status: paymentStatus, mp_payment_id: String(p.id) }),
                });
              }
              return Response.json({ ok: true, payment_status: paymentStatus, mp_status: p.status });
            }
            return Response.json({ ok: true, payment_status: target.payment_status, message: 'Nenhum pagamento correspondente encontrado no Mercado Pago ainda.' });
          } catch (e) {
            return Response.json({ error: e instanceof Error ? e.message : 'Falha ao consultar Mercado Pago.' }, { status: 500 });
          }
        }

        const allowedOrderStatus = ['novo', 'confirmado', 'preparando', 'pronto_entrega', 'saiu_entrega', 'pronto_retirada', 'concluido', 'cancelado'];
        const validStatus = typeof body.order_status === 'string' && allowedOrderStatus.includes(body.order_status);
        const allowedPaymentStatus = ['approved', 'pending', 'rejected', 'not_required'];
        const validPayment = typeof body.payment_status === 'string' && allowedPaymentStatus.includes(body.payment_status);
        const hasEta = Object.prototype.hasOwnProperty.call(body, 'estimated_delivery_at');
        const validEta = !hasEta || body.estimated_delivery_at === null || (typeof body.estimated_delivery_at === 'string' && Number.isFinite(Date.parse(body.estimated_delivery_at)));
        const hasNotes = typeof body.notes === 'string';

        if ((!validStatus && !validPayment && !hasEta && !hasNotes) || (body.order_status !== undefined && !validStatus) || (body.payment_status !== undefined && !validPayment) || !validEta) {
          return Response.json({ error: 'Atualização inválida.' }, { status: 400 });
        }

        if (hasEta) {
          try {
            const target = await supabaseRequest<Array<Row>>(`orders?select=id,order_for,fulfillment&id=eq.${encodeURIComponent(body.id)}&limit=1`);
            if (!target[0] || target[0].order_for !== 'amanha' || target[0].fulfillment !== 'entrega') {
              return Response.json({ error: 'A previsão manual no painel é exclusiva de entregas agendadas para amanhã.' }, { status: 403 });
            }
          } catch {
            return Response.json({ error: 'Não foi possível validar o agendamento.' }, { status: 503 });
          }
        }

        try {
          const patch: Record<string, unknown> = {};
          if (validStatus) patch['order_status'] = body.order_status;
          if (validPayment) patch['payment_status'] = body.payment_status;
          if (hasEta) patch['estimated_delivery_at'] = body.estimated_delivery_at;
          if (hasNotes) patch['notes'] = body.notes;

          await supabaseRequest(`orders?id=eq.${encodeURIComponent(body.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(patch),
          });

          if (body.order_status === 'concluido' || body.payment_status === 'approved') {
            try {
              const rows = await supabaseRequest<Array<Row>>(`orders?select=id,payment_method,payment_status&id=eq.${encodeURIComponent(body.id)}&limit=1`);
              if (rows[0] && (rows[0].payment_status === 'approved' || rows[0].payment_method !== 'online')) {
                const { sendPurchaseOnce } = await import('@/lib/facebook-capi.server');
                await sendPurchaseOnce(body.id);
              }
            } catch (capiError) {
              console.error('[facebook-capi] Purchase ignorado', capiError);
            }
          }
          return Response.json({ ok: true });
        } catch {
          return Response.json({ error: 'Não foi possível atualizar o pedido.' }, { status: 503 });
        }
      },
    },
  },
});
