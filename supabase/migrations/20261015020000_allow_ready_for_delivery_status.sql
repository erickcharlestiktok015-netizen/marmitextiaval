-- Permite o estado "pronto_entrega" usado pelo painel do motoboy.
-- Recria apenas as restrições de status da tabela orders, preservando os estados existentes.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%order_status%'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_row.conname);
  end loop;
end $$;

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
