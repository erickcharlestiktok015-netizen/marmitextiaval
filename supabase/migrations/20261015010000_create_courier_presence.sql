-- Estado de disponibilidade do motoboy, independente de existir pedido.
create table if not exists public.courier_presence (
  id text primary key default 'motoboy' check (id = 'motoboy'),
  is_online boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.courier_presence (id, is_online)
values ('motoboy', false)
on conflict (id) do nothing;

alter table public.courier_presence enable row level security;
