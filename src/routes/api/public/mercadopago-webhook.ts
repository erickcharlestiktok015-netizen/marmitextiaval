import { createFileRoute } from '@tanstack/react-router';
import { supabaseRequest } from '@/lib/supabase.server';

// Endereço para colar no painel do Mercado Pago (Suas integrações → Webhooks):
// https://SEU-DOMINIO/api/public/mercadopago-webhook  — evento "Pagamentos".
export const Route = createFileRoute('/api/public/mercadopago-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyWebhookSignature, getPayment } = await import('@/lib/mercadopago.server');
        const url = new URL(request.url);
        const body = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
        const dataId = url.searchParams.get('data.id') ?? (body.data?.id != null ? String(body.data.id) : null);
        const type = url.searchParams.get('type') ?? body.type;

        const secret = process.env['MP_WEBHOOK_SECRET'];
        if (!secret) return new Response('MP_WEBHOOK_SECRET não configurado', { status: 500 });
        const ok = await verifyWebhookSignature({ signature: request.headers.get('x-signature'), requestId: request.headers.get('x-request-id'), dataId, secret });
        if (!ok) return new Response('Assinatura inválida', { status: 401 });

        if (type === 'payment' && dataId && /^\d+$/.test(dataId)) {
          // Confirma direto na API (não confia só no aviso).
          const p = await getPayment(dataId);
          const code = p.external_reference;
          if (code && /^[A-Z0-9]{5,10}$/.test(code)) {
            const matching = await supabaseRequest<Array<{ id: string; total: number }>>(
              `orders?select=id,total&code=eq.${encodeURIComponent(code)}&limit=1`,
            );
            const order = matching[0];
            if (order && Math.round(Number(order.total) * 100) === Math.round(Number(p.transaction_amount) * 100)) {
              const statusMap: Record<string, string> = {
                approved: 'approved',
                pending: 'pending',
                in_process: 'pending',
                rejected: 'rejected',
                cancelled: 'cancelled',
                refunded: 'refunded',
                charged_back: 'refunded',
              };
              const paymentStatus = statusMap[p.status];
              if (paymentStatus) {
                await supabaseRequest(
                  `orders?id=eq.${encodeURIComponent(order.id)}`,
                  {
                    method: 'PATCH',
                    headers: { Prefer: 'return=minimal' },
                    body: JSON.stringify({ payment_status: paymentStatus, mp_payment_id: String(p.id) }),
                  },
                );
                if (paymentStatus === 'approved') {
                  try {
                    const { sendPurchaseOnce } = await import('@/lib/facebook-capi.server');
                    await sendPurchaseOnce(order.id, { email: (p as { payer?: { email?: string } }).payer?.email ?? null });
                  } catch (capiError) { console.error('[facebook-capi] Purchase ignorado', capiError); }
                }
              }
            }
          }
        }
        return new Response('ok');
      },
    },
  },
});
