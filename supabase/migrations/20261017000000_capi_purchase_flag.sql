-- Trava para nao enviar Purchase duplicado para a Meta (CAPI)
alter table public.orders add column if not exists capi_purchase_sent_at timestamptz;
