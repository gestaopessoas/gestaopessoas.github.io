-- Cache de geocodificação do mapa (/dashboard/mapa). Chave = endereço normalizado.
-- lat/lng nulos significam "o Nominatim não achou": a página não tenta de novo.
create table public.geocodes (
  address_key text primary key,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

alter table public.geocodes enable row level security;

-- Sem UPDATE/DELETE de propósito: resultado gravado é definitivo.
create policy "geocodes legíveis por quem vê o mapa" on public.geocodes
  for select to authenticated using (public.can_access('mapa', 'view'));

create policy "geocodes gravados por quem vê o mapa" on public.geocodes
  for insert to authenticated with check (public.can_access('mapa', 'view'));
