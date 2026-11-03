-- Acompanhamento de pedidos, previsão de entrega e confirmação.
-- Execute no SQL Editor do Supabase do projeto conectado à Vercel antes de testar.
alter table public.orders
  add column if not exists tracking_token text,
  add column if not exists confirmation_code text,
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists courier_name text,
  add column if not exists courier_status text not null default 'nao_atribuido'
    check (courier_status in ('nao_atribuido', 'atribuido', 'saiu_entrega', 'cheguei', 'entregue'));

create unique index if not exists orders_tracking_token_idx
  on public.orders (tracking_token) where tracking_token is not null;

create index if not exists orders_courier_status_idx
  on public.orders (courier_status);

-- Existing orders are intentionally not assigned public tracking tokens automatically.
