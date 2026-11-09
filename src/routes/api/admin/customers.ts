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
  notes?: string | null;
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
          // 1. Busca histórico de pedidos (base de compradores)
          const orders = await supabaseRequest<OrderRow[]>(
            'orders?select=id,code,customer_name,customer_phone,total,order_status,payment_status,fulfillment,created_at&order=created_at.desc&limit=1000'
          ).catch((err) => {
            console.warn('[admin-customers] Erro ao buscar orders:', err);
            return [] as OrderRow[];
          });

          // 2. Busca cadastros/leads da tabela customers (se existir)
          let hasCustomersTable = true;
          const registered = await supabaseRequest<CustomerRow[]>(
            'customers?select=id,phone,name,created_at,last_seen_at,notes&order=last_seen_at.desc&limit=1000'
          ).catch((err) => {
            console.warn('[admin-customers] Tabela customers ainda não existe ou inacessível:', err);
            hasCustomersTable = false;
            return [] as CustomerRow[];
          });

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
              if (new Date(ord.created_at) < new Date(existing.firstSeenAt)) {
                existing.firstSeenAt = ord.created_at;
              }
              if (existing.recentOrders.length < 8) {
                existing.recentOrders.push({
                  code: ord.code,
                  total,
                  orderStatus: ord.order_status,
                  createdAt: ord.created_at,
                });
              }
            }
          }

          // Incorpora cadastros da tabela customers (leads sem pedido ou nomes atualizados)
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
                notes: reg.notes || null,
                recentOrders: [],
              });
            } else {
              if (reg.name?.trim() && (existing.name === 'Cliente' || !existing.name)) {
                existing.name = reg.name.trim();
              }
              if (reg.notes) {
                existing.notes = reg.notes;
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
          const totalVips = list.filter((c) => c.status === 'vip').length;
          const totalRecurring = list.filter((c) => c.status === 'recorrente').length;
          const totalRevenue = list.reduce((acc, c) => acc + c.totalSpent, 0);

          return Response.json(
            {
              customers: list,
              hasCustomersTable,
              summary: {
                totalCustomers: list.length,
                totalPurchasers,
                totalLeads,
                totalVips,
                totalRecurring,
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

      POST: async ({ request }) => {
        if (!(await isAdminRequest(request))) {
          return Response.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        try {
          const body = (await request.json().catch(() => ({}))) as {
            phone?: string;
            name?: string;
            notes?: string;
          };

          if (!body.phone) {
            return Response.json({ error: 'Telefone é obrigatório.' }, { status: 400 });
          }

          const raw = body.phone.replace(/\D/g, '');
          const cleanPhone = raw.startsWith('55') && raw.length >= 12 ? raw.slice(2) : raw;
          if (cleanPhone.length < 10) {
            return Response.json({ error: 'Telefone precisa ter DDD e pelo menos 10 dígitos.' }, { status: 400 });
          }

          await supabaseRequest('customers?on_conflict=phone', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({
              phone: cleanPhone,
              name: body.name?.trim() || null,
              notes: body.notes?.trim() || null,
              last_seen_at: new Date().toISOString(),
            }),
          });

          return Response.json({ success: true, phone: cleanPhone });
        } catch (err) {
          console.error('[admin-customers] Falha ao cadastrar manualmente:', err);
          return Response.json(
            {
              error:
                'Não foi possível salvar na tabela customers. Certifique-se de que a tabela customers foi criada no seu Supabase.',
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
