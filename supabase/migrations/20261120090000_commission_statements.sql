-- M7: monthly commission statements (SPEC F12, §4.4).
--
-- Commission is earned when a stay is completed; a month's statement covers
-- the completed stays that departed in that month (Athens dates). The admin
-- reads the stays from bookings and marks each partner's statement sent or
-- paid; marking keeps the commission total of that moment, so later changes
-- don't alter a statement already sent.

create table public.commission_statements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'open' check (status in ('open', 'sent', 'paid')),
  updated_at timestamptz not null default now(),
  unique (partner_id, month)
);

alter table public.commission_statements enable row level security;
revoke all on table public.commission_statements from anon, authenticated;
grant select on table public.commission_statements to authenticated;
grant select, insert, update, delete on table public.commission_statements to service_role;

-- Admins see every statement; a partner's owners see their own.
create policy commission_statements_select_owner_or_admin
  on public.commission_statements for select
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(partner_id));

-- Admin only: sets a partner's statement for a month to open, sent or paid,
-- with the commission of the stays completed that month as its total.
create function public.set_commission_statement(p_partner_id uuid, p_month date, p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'only admins manage commission statements' using errcode = '42501';
  end if;
  if p_status not in ('open', 'sent', 'paid') then
    raise exception 'unknown status %', p_status using errcode = '22023';
  end if;
  if not exists (select 1 from public.partners p where p.id = p_partner_id) then
    raise exception 'partner not found' using errcode = 'P0002';
  end if;
  select coalesce(sum(b.commission_cents), 0)::integer into v_total
  from public.bookings b
  join public.campings c on c.id = b.camping_id
  where c.partner_id = p_partner_id and b.status = 'completed'
    and b.departure >= v_month and b.departure < (v_month + interval '1 month')::date;

  insert into public.commission_statements (partner_id, month, total_cents, status)
  values (p_partner_id, v_month, v_total, p_status)
  on conflict (partner_id, month) do update
    set total_cents = excluded.total_cents, status = excluded.status, updated_at = now();
  return v_total;
end;
$$;

revoke all on function public.set_commission_statement(uuid, date, text) from public, anon;
grant execute on function public.set_commission_statement(uuid, date, text) to authenticated, service_role;
