-- M2: save a season's whole price grid in one call.
--
-- set_season_prices() replaces every price of a season with the given list,
-- in one transaction: either all prices are saved or none change. It runs
-- with the caller's rights (RLS and the prices triggers still apply) after an
-- explicit owner check, so a refusal is an error instead of a silent no-op.
-- p_prices: [{"item_type": "pitch"|"guest"|"extra", "item_id": uuid, "amount_cents": int}, ...]

create function public.set_season_prices(p_season_id uuid, p_prices jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_camping_id uuid;
  v_count integer;
begin
  select s.camping_id into v_camping_id from public.seasons s where s.id = p_season_id;
  if v_camping_id is null then
    raise exception 'season % not found', p_season_id using errcode = 'P0002';
  end if;
  if not (public.is_admin() or public.is_partner_owner(public.camping_partner(v_camping_id))) then
    raise exception 'only the camping''s owners can set prices' using errcode = '42501';
  end if;
  if jsonb_typeof(p_prices) is distinct from 'array' then
    raise exception 'prices must be a JSON array' using errcode = '22023';
  end if;

  delete from public.prices p where p.season_id = p_season_id;

  insert into public.prices (season_id, item_type, item_id, amount_cents)
  select p_season_id, x.item_type, x.item_id, x.amount_cents
  from jsonb_to_recordset(p_prices) as x (item_type public.price_item_type, item_id uuid, amount_cents integer);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.set_season_prices(uuid, jsonb) from public, anon;
grant execute on function public.set_season_prices(uuid, jsonb) to authenticated, service_role;
