-- Dados necessários para operação do motoboy no ambiente de preview.
alter table public.orders
  add column if not exists courier_latitude double precision,
  add column if not exists courier_longitude double precision,
  add column if not exists courier_location_updated_at timestamptz,
  add column if not exists courier_started_at timestamptz;

alter table public.orders drop constraint if exists orders_order_status_check;
alter table public.orders add constraint orders_order_status_check
  check (order_status in ('novo', 'confirmado', 'preparando', 'pronto_entrega', 'saiu_entrega', 'pronto_retirada', 'concluido', 'cancelado'));

create index if not exists orders_delivery_queue_idx
  on public.orders (order_status, fulfillment, created_at)
  where fulfillment = 'entrega';
