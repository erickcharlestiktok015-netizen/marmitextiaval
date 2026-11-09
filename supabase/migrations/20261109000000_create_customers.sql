-- Tabela de clientes e leads cadastrados no site
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notes text
);

create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customers_created_at_idx on public.customers (created_at desc);
create index if not exists customers_last_seen_at_idx on public.customers (last_seen_at desc);

alter table public.customers enable row level security;
