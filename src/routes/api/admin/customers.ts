import { createFileRoute } from '@tanstack/react-router';
import { isAdminRequest } from '@/lib/admin-auth.server';
import { supabaseRequest } from '@/lib/supabase.server';

type OrderRow = {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  total: number | string;
  order_status: string;
  payment_status: string;
  fulfillment: string;
  created_at: string;
};

type CustomerRow = {
  id?: string;
  phone: string;
  name?: string | null;
  created_at?: string;
  last_seen_at?: string;
  notes?: string | null;
};

type CustomerSummary = {
  phone: string;
  rawPhone: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalOrders: number;
  totalSpent: number;
  hasPurchased: boolean;
  status: 'vip' | 'recorrente' | 'primeira_compra' | 'lead';
  lastOrder?: {
    code: string;
    total: number;
    orderStatus: string;
    paymentStatus: string;
    createdAt: string;
    fulfillment: string;
  };
  recentOrders: Array<{
    code: string;
    total: number;
    orderStatus: string;
    createdAt: string;
  }>;
};

const normalizePhone = (val: string) => {
  const digits = val.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits.slice(2);
  return digits;
};

export const Route = createFileRoute('/api/admin/customers')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) {
          return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        try {
          // 1. Busca histórico de pedidos
          const orders = await supabaseRequest<OrderRow[]>(
            'orders?select=id,code,customer_name,customer_phone,total,order_status,payment_status,fulfillment,created_at&order=created_at.desc&limit=500'
          ).catch((err) => {
            console.warn('[admin-customers] Erro ao buscar orders:', err);
            return [] as OrderRow[];
          });

          // 2. Busca leads/clientes da tabela customers (se existir)
          const registered = await supabaseRequest<CustomerRow[]>(
            'customers?select=id,phone,name,created_at,last_seen_at,notes&order=last_seen_at.desc&limit=500'
          ).catch(() => [] as CustomerRow[]);

          const customerMap = new Map<string, CustomerSummary>();

          // Processa pedidos para formar a base de clientes compradores
          for (const ord of orders) {
            const key = normalizePhone(ord.customer_phone);
            if (!key || key.length < 10) continue;

            const total = Number(ord.total) || 0;
            const existing = customerMap.get(key);

            if (!existing) {
              customerMap.set(key, {
                phone: key,
                rawPhone: ord.customer_phone,
                name: ord.customer_name?.trim() || 'Cliente',
                firstSeenAt: ord.created_at,
                lastSeenAt: ord.created_at,
                totalOrders: 1,
                totalSpent: total,
                hasPurchased: true,
                status: 'primeira_compra',
                lastOrder: {
                  code: ord.code,
                  total,
                  orderStatus: ord.order_status,
                  paymentStatus: ord.payment_status,
                  createdAt: ord.created_at,
                  fulfillment: ord.fulfillment,
                },
                recentOrders: [
                  {
                    code: ord.code,
                    total,
                    orderStatus: ord.order_status,
                    createdAt: ord.created_at,
                  },
                ],
              });
            } else {
              existing.totalOrders += 1;
              existing.totalSpent += total;
              // Ajusta datas: orders vem em desc, logo o primeiro encontrado é o mais recente
              if (new Date(ord.created_at) < new Date(existing.firstSeenAt)) {
                existing.firstSeenAt = ord.created_at;
              }
              if (existing.recentOrders.length < 5) {
                existing.recentOrders.push({
                  code: ord.code,
                  total,
                  orderStatus: ord.order_status,
                  createdAt: ord.created_at,
                });
              }
            }
          }

          // Incorpora cadastros da tabela customers
          for (const reg of registered) {
            const key = normalizePhone(reg.phone);
            if (!key || key.length < 10) continue;

            const existing = customerMap.get(key);
            if (!existing) {
              customerMap.set(key, {
                phone: key,
                rawPhone: reg.phone,
                name: reg.name?.trim() || 'Interessado (Lead)',
                firstSeenAt: reg.created_at || new Date().toISOString(),
                lastSeenAt: reg.last_seen_at || reg.created_at || new Date().toISOString(),
                totalOrders: 0,
                totalSpent: 0,
                hasPurchased: false,
                status: 'lead',
                recentOrders: [],
              });
            } else {
              if (reg.name?.trim() && existing.name === 'Cliente') {
                existing.name = reg.name.trim();
              }
              if (reg.last_seen_at && new Date(reg.last_seen_at) > new Date(existing.lastSeenAt)) {
                existing.lastSeenAt = reg.last_seen_at;
              }
            }
          }

          // Define status final de cada cliente
          const list = Array.from(customerMap.values()).map((c) => {
            if (!c.hasPurchased) {
              c.status = 'lead';
            } else if (c.totalOrders >= 5) {
              c.status = 'vip';
            } else if (c.totalOrders >= 2) {
              c.status = 'recorrente';
            } else {
              c.status = 'primeira_compra';
            }
            return c;
          });

          // Ordena pelos mais recentemente ativos no topo
          list.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

          // Calcula resumo
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

          const todayNew = list.filter((c) => new Date(c.firstSeenAt).getTime() >= todayStart).length;
          const todayActive = list.filter((c) => new Date(c.lastSeenAt).getTime() >= todayStart).length;
          const totalPurchasers = list.filter((c) => c.hasPurchased).length;
          const totalLeads = list.filter((c) => !c.hasPurchased).length;
          const totalRevenue = list.reduce((acc, c) => acc + c.totalSpent, 0);

          return Response.json(
            {
              customers: list,
              summary: {
                totalCustomers: list.length,
                totalPurchasers,
                totalLeads,
                todayNew,
                todayActive,
                totalRevenue,
              },
            },
            { headers: { 'Cache-Control': 'no-store' } }
          );
        } catch (error) {
          console.error('[admin-customers] Erro geral:', error);
          return Response.json({ error: 'Falha ao carregar lista de clientes.' }, { status: 500 });
        }
      },
    },
  },
});
