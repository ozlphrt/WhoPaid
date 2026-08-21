-- Atomically publish an owned trip and its access rows. This avoids the RLS
-- bootstrap cycle where child rows require a trip membership that cannot exist
-- until the parent trip has first been inserted.

create or replace function public.upsert_owned_trip(
  target_trip_id text,
  target_invite_token text,
  target_is_deleted boolean,
  target_payload jsonb,
  target_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  existing_owner_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select owner_id into existing_owner_id
  from public.trips
  where id = target_trip_id
  for update;

  if found and existing_owner_id is distinct from caller_id then
    raise exception 'Only the trip owner can update this trip.' using errcode = '42501';
  end if;

  insert into public.trips (
    id, owner_id, invite_token, is_deleted, payload, updated_at
  ) values (
    target_trip_id,
    caller_id,
    target_invite_token,
    coalesce(target_is_deleted, false),
    target_payload,
    coalesce(target_updated_at, now())
  )
  on conflict (id) do update set
    invite_token = excluded.invite_token,
    is_deleted = excluded.is_deleted,
    payload = excluded.payload,
    updated_at = excluded.updated_at;

  insert into public.trip_memberships (trip_id, user_id, role)
  values (target_trip_id, caller_id, 'owner')
  on conflict (trip_id, user_id) do update set role = 'owner';

  if target_invite_token is not null then
    insert into public.trip_invites (
      token, trip_id, created_by, revoked, updated_at
    ) values (
      target_invite_token, target_trip_id, caller_id, false, now()
    )
    on conflict (token) do update set
      trip_id = excluded.trip_id,
      revoked = false,
      updated_at = excluded.updated_at
    where public.trip_invites.created_by = caller_id;
  end if;
end;
$$;

revoke all on function public.upsert_owned_trip(text, text, boolean, jsonb, timestamptz)
  from public, anon;
grant execute on function public.upsert_owned_trip(text, text, boolean, jsonb, timestamptz)
  to authenticated;
