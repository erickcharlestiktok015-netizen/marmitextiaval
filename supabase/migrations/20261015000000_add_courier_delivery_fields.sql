-- Campos que a API existente do motoboy já utiliza.
-- Esta migration é idempotente; revise e aplique no projeto Supabase correto antes de usar.
alter table public.orders
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists courier_status text not null default 'aguardando',
  add column if not exists courier_latitude double precision,
  add column if not exists courier_longitude double precision,
  add column if not exists courier_location_updated_at timestamptz,
  add column if not exists courier_started_at timestamptz,
  add column if not exists confirmation_code text
    default lpad(floor(random() * 1000000)::integer::text, 6, '0');

-- Pedidos anteriores também precisam de código para a etapa de confirmação.
update public.orders
set confirmation_code = lpad(floor(random() * 1000000)::integer::text, 6, '0')
where confirmation_code is null;

alter table public.orders
  alter column confirmation_code set default lpad(floor(random() * 1000000)::integer::text, 6, '0');

-- A API administrativa e a tela do motoboy já utilizam "pronto_entrega".
-- A constraint original da migration inicial não permitia esse estado.
alter table public.orders
  drop constraint if exists orders_order_status_check;

alter table public.orders
  add constraint orders_order_status_check
  check (order_status in (
    'novo',
    'confirmado',
    'preparando',
    'pronto_entrega',
    'saiu_entrega',
    'pronto_retirada',
    'concluido',
    'cancelado'
  ));
