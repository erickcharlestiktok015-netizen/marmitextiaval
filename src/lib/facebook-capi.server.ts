// Meta Conversions API (CAPI) — envio de eventos de venda pelo servidor.
// Usa FB_PIXEL_ID e FB_ACCESS_TOKEN (variáveis de ambiente da Vercel).
// Nenhuma falha aqui pode travar o pedido: tudo roda em try/catch com timeout.
import { createHash } from 'node:crypto';
import { supabaseRequest } from '@/lib/supabase.server';

export type CapiEventName = 'Purchase' | 'InitiateCheckout';

export type CapiOrder = {
  code: string;
  total: number | string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
};

export type CapiRequestInfo = {
  ip?: string | null;
  userAgent?: string | null;
  sourceUrl?: string | null;
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const normalizeEmail = (email?: string | null) => {
  const v = (email ?? '').trim().toLowerCase().replace(/\s+/g, '');
  return v.includes('@') ? v : null;
};

export const normalizePhone = (phone?: string | null) => {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('55') || digits.length <= 11) digits = `55${digits}`;
  return digits;
};

export const normalizeFirstName = (name?: string | null) => {
  const first = (name ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const clean = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  return clean || null;
};

export const hashEmail = (email?: string | null) => { const v = normalizeEmail(email); return v ? sha256(v) : null; };
export const hashPhone = (phone?: string | null) => { const v = normalizePhone(phone); return v ? sha256(v) : null; };
export const hashFirstName = (name?: string | null) => { const v = normalizeFirstName(name); return v ? sha256(v) : null; };

/** Extrai IP / user agent / URL de uma Request (quando disponível). */
export function requestInfoFrom(req?: Request | null): CapiRequestInfo | undefined {
  if (!req) return undefined;
  const h = req.headers;
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || h.get('cf-connecting-ip') || null;
  return { ip, userAgent: h.get('user-agent'), sourceUrl: h.get('referer') };
}

/** Lê a Request atual dentro de um createServerFn (sem quebrar se indisponível). */
export async function currentRequestInfo(): Promise<CapiRequestInfo | undefined> {
  try {
    const mod = await import('@tanstack/react-start/server');
    return requestInfoFrom(mod.getRequest());
  } catch {
    return undefined;
  }
}

export async function sendFacebookServerEvent({ eventName, eventId, order, req }: {
  eventName: CapiEventName;
  eventId: string;
  order: CapiOrder;
  req?: Request | CapiRequestInfo | null | undefined;
}): Promise<boolean> {
  try {
    const pixelId = process.env['FB_PIXEL_ID'];
    const accessToken = process.env['FB_ACCESS_TOKEN'];
    if (!pixelId || !accessToken) {
      console.warn('[facebook-capi] FB_PIXEL_ID ou FB_ACCESS_TOKEN ausente; evento ignorado.', { eventName, eventId });
      return false;
    }
    const info = req instanceof Request ? requestInfoFrom(req) : req ?? undefined;

    const userData: Record<string, unknown> = {};
    const em = hashEmail(order.customer_email);
    const ph = hashPhone(order.customer_phone);
    const fn = hashFirstName(order.customer_name);
    if (em) userData['em'] = [em];
    if (ph) userData['ph'] = [ph];
    if (fn) userData['fn'] = [fn];
    if (info?.ip) userData['client_ip_address'] = info.ip;
    if (info?.userAgent) userData['client_user_agent'] = info.userAgent;

    const event: Record<string, unknown> = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: { currency: 'BRL', value: Number(order.total), order_id: order.code },
    };
    if (info?.sourceUrl) event['event_source_url'] = info.sourceUrl;

    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[facebook-capi] Meta recusou o evento', { eventName, eventId, status: response.status, detail: detail.slice(0, 500) });
      return false;
    }
    console.info('[facebook-capi] Evento enviado', { eventName, eventId });
    return true;
  } catch (error) {
    console.error('[facebook-capi] Falha ao enviar evento', { eventName, eventId, error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}

/**
 * Envia Purchase uma única vez por pedido.
 * Trava atômica: só quem consegue marcar capi_purchase_sent_at (ainda nulo) envia.
 * Se o envio falhar, a trava é liberada para uma próxima confirmação tentar de novo.
 */
export async function sendPurchaseOnce(orderId: string, opts: { email?: string | null; req?: Request | CapiRequestInfo | null | undefined } = {}) {
  try {
    const claimed = await supabaseRequest<Array<CapiOrder & { id: string }>>(
      `orders?id=eq.${encodeURIComponent(orderId)}&capi_purchase_sent_at=is.null&select=id,code,total,customer_name,customer_phone`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ capi_purchase_sent_at: new Date().toISOString() }) },
    );
    const order = claimed?.[0];
    if (!order) return false; // já enviado antes
    const ok = await sendFacebookServerEvent({
      eventName: 'Purchase',
      eventId: order.code,
      order: { ...order, customer_email: opts.email ?? null },
      req: opts.req,
    });
    if (!ok) {
      await supabaseRequest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ capi_purchase_sent_at: null }),
      }).catch(() => undefined);
    }
    return ok;
  } catch (error) {
    console.error('[facebook-capi] Falha na trava de Purchase', { orderId, error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}
