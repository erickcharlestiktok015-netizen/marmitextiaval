// Histórico local de pedidos ("Meus pedidos") e dados do cliente salvos no celular.
// Só guarda código + token de rastreio; os dados do pedido continuam no servidor.
import type { PlanMeta } from '@/lib/weekly-plan';

export type SavedOrder = { code: string; token: string; savedAt: string };

export const MY_ORDERS_KEY = 'tia-val-meus-pedidos';
export const CUSTOMER_KEY = 'tia-val-cliente';
const TOKEN_RE = /^[a-f0-9]{64}$/;

export function readSavedOrders(): SavedOrder[] {
  try {
    const saved = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || '[]') as SavedOrder[];
    if (!Array.isArray(saved)) return [];
    return saved
      .filter(item => item && typeof item.code === 'string' && typeof item.token === 'string' && TOKEN_RE.test(item.token))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function saveOrder(code: string, token: string): SavedOrder[] {
  try {
    const next = [{ code, token, savedAt: new Date().toISOString() }, ...readSavedOrders().filter(item => item.token !== token)].slice(0, 20);
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export type SavedCustomer = { name: string; phone: string };

export function readCustomer(): SavedCustomer | null {
  try {
    const data = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null') as SavedCustomer | null;
    if (!data || typeof data.name !== 'string' || typeof data.phone !== 'string') return null;
    return { name: data.name.slice(0, 80), phone: data.phone.slice(0, 20) };
  } catch {
    return null;
  }
}

export function saveCustomer(customer: SavedCustomer) {
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer)); } catch { /* opcional */ }
}

// Metadados do Plano 7 Dias salvos no celular, para o card "Plano Ativo" em Meus Pedidos.
const PLANS_KEY = 'tia-val-planos';

type PlanMap = Record<string, PlanMeta>;

function readPlanMap(): PlanMap {
  try {
    const data = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}') as PlanMap;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function savePlanMeta(token: string, meta: PlanMeta) {
  try {
    const map = readPlanMap();
    map[token] = meta;
    localStorage.setItem(PLANS_KEY, JSON.stringify(map));
  } catch { /* opcional */ }
}

export function readPlanMeta(token: string): PlanMeta | null {
  const meta = readPlanMap()[token];
  return meta && Array.isArray(meta.dates) && meta.dates.length === 7 ? meta : null;
}

export const trackingHref = (token: string) => `/acompanhar?token=${encodeURIComponent(token)}`;

export const savedAtLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};



export function clearCustomer() {
  try {
    localStorage.removeItem(CUSTOMER_KEY);
  } catch {
    /* opcional */
  }
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const clean = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return raw;
}

export function maskPhoneInput(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function orderStatusLabel(status: string): string {
  switch (status) {
    case 'novo':
      return 'Recebido';
    case 'confirmado':
      return 'Confirmado';
    case 'preparando':
      return 'Preparando';
    case 'saiu_entrega':
      return 'Saiu para entrega';
    case 'pronto_retirada':
      return 'Pronto para retirada';
    case 'concluido':
      return 'Entregue';
    case 'cancelado':
      return 'Cancelado';
    default:
      return status;
  }
}

export function orderStatusBadgeClass(status: string): string {
  switch (status) {
    case 'novo':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'confirmado':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'preparando':
      return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    case 'saiu_entrega':
      return 'bg-orange-100 text-orange-900 border-orange-200 font-bold';
    case 'pronto_retirada':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'concluido':
      return 'bg-green-100 text-green-900 border-green-200';
    case 'cancelado':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-accent text-accent-foreground border-border';
  }
}
