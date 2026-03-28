create table if not exists public.drink_logs (
  id bigserial primary key,
  user_id text not null default 'guest',
  brand text,
  name text,
  specs text,
  image_url text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drink_logs_user_id_idx on public.drink_logs (user_id);
create index if not exists drink_logs_created_at_idx on public.drink_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_drink_logs_updated_at on public.drink_logs;
create trigger trg_drink_logs_updated_at
before update on public.drink_logs
for each row
execute function public.set_updated_at();

