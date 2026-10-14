-- Marmitex da Tia Val: estrutura inicial de pedidos
-- Execute no SQL Editor do Supabase do projeto correto.
-- A API do servidor usa a chave secreta; nenhuma política pública é criada.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  order_for text not null check (order_for in ('hoje', 'amanha')),
  customer_name text not null,
  customer_phone text not null,
  fulfillment text not null check (fulfillment in ('entrega', 'retirada')),
  address jsonb,
  distance_km numeric(7,2),
  payment_method text not null check (payment_method in ('online', 'entrega-pix', 'entrega-cartao', 'entrega-dinheiro')),
  payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  order_status text not null default 'novo'
    check (order_status in ('novo', 'confirmado', 'preparando', 'saiu_entrega', 'pronto_retirada', 'concluido', 'cancelado')),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  change_for numeric(10,2),
  notes text,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  meal_name text not null,
  size_label text not null,
  quantity integer not null check (quantity between 1 and 50),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_order_status_idx on public.orders (order_status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Não crie políticas para anon/authenticated: pedidos pessoais só devem ser acessados
-- pelas rotas autenticadas do servidor usando SUPABASE_SECRET_KEY.
