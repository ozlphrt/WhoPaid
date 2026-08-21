-- WhoPaid Supabase/PostgreSQL schema.
-- Run with `supabase db push` or paste into a new Supabase project's SQL editor.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  default_currency text not null default 'EUR',
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table public.trips (
  id text primary key,
  owner_id uuid not null references auth.users(id),
  invite_token text unique,
  is_deleted boolean not null default false,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.trip_memberships (
  trip_id text not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  member_id text,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.trip_invites (
  token text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.households (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.settlements (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.activities (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_memberships to authenticated;
grant select, insert, update, delete on public.trip_invites to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.settlements to authenticated;
grant select, insert, update, delete on public.activities to authenticated;

create or replace function private.normalize_trip_payload()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.payload := new.payload || jsonb_build_object(
    'id', new.id,
    'ownerId', new.owner_id::text,
    'inviteToken', new.invite_token
  );
  return new;
end;
$$;

create trigger trips_normalize_payload
before insert or update on public.trips
for each row execute function private.normalize_trip_payload();

create or replace function private.normalize_child_payload()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.payload := new.payload || jsonb_build_object('id', new.id, 'tripId', new.trip_id);
  if tg_table_name = 'trip_members' then
    new.payload := jsonb_set(
      new.payload,
      '{role}',
      to_jsonb(
        case when new.payload->>'authUid' = (
          select t.owner_id::text from public.trips t where t.id = new.trip_id
        ) then 'owner' else 'member' end
      )
    );
  end if;
  return new;
end;
$$;

create trigger trip_members_normalize_payload before insert or update on public.trip_members
for each row execute function private.normalize_child_payload();
create trigger households_normalize_payload before insert or update on public.households
for each row execute function private.normalize_child_payload();
create trigger expenses_normalize_payload before insert or update on public.expenses
for each row execute function private.normalize_child_payload();
create trigger settlements_normalize_payload before insert or update on public.settlements
for each row execute function private.normalize_child_payload();
create trigger activities_normalize_payload before insert or update on public.activities
for each row execute function private.normalize_child_payload();

create index trips_owner_id_idx on public.trips(owner_id) where not is_deleted;
create index trip_memberships_user_id_idx on public.trip_memberships(user_id, trip_id);
create index trip_members_trip_id_idx on public.trip_members(trip_id);
create index households_trip_id_idx on public.households(trip_id);
create index expenses_trip_id_idx on public.expenses(trip_id);
create index settlements_trip_id_idx on public.settlements(trip_id);
create index activities_trip_id_idx on public.activities(trip_id);

create or replace function private.is_trip_member(target_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t
    where t.id = target_trip_id and t.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.trip_memberships m
    where m.trip_id = target_trip_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_trip_owner(target_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t
    where t.id = target_trip_id and t.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.is_trip_member(text) from public;
revoke all on function private.is_trip_owner(text) from public;
grant execute on function private.is_trip_member(text) to authenticated;
grant execute on function private.is_trip_owner(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_memberships enable row level security;
alter table public.trip_invites enable row level security;
alter table public.trip_members enable row level security;
alter table public.households enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;
alter table public.activities enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy trips_member_select on public.trips for select to authenticated
  using ((select private.is_trip_member(id)));
create policy trips_owner_insert on public.trips for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy trips_owner_update on public.trips for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy trips_owner_delete on public.trips for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy memberships_self_or_owner_select on public.trip_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_trip_owner(trip_id)));
create policy memberships_owner_insert on public.trip_memberships for insert to authenticated
  with check ((select private.is_trip_owner(trip_id)));
create policy memberships_owner_update on public.trip_memberships for update to authenticated
  using ((select private.is_trip_owner(trip_id))) with check ((select private.is_trip_owner(trip_id)));
create policy memberships_self_or_owner_delete on public.trip_memberships for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_trip_owner(trip_id)));

create policy invites_owner_select on public.trip_invites for select to authenticated
  using ((select private.is_trip_owner(trip_id)));
create policy invites_owner_insert on public.trip_invites for insert to authenticated
  with check ((select private.is_trip_owner(trip_id)) and created_by = (select auth.uid()));
create policy invites_owner_update on public.trip_invites for update to authenticated
  using ((select private.is_trip_owner(trip_id))) with check ((select private.is_trip_owner(trip_id)));
create policy invites_owner_delete on public.trip_invites for delete to authenticated
  using ((select private.is_trip_owner(trip_id)));

create policy trip_members_member_select on public.trip_members for select to authenticated
  using ((select private.is_trip_member(trip_id)));
create policy trip_members_owner_or_self_insert on public.trip_members for insert to authenticated
  with check (
    (select private.is_trip_member(trip_id)) and (
      (select private.is_trip_owner(trip_id)) or
      payload->>'authUid' = (select auth.uid())::text
    )
  );
create policy trip_members_owner_or_self_update on public.trip_members for update to authenticated
  using (
    (select private.is_trip_owner(trip_id)) or
    payload->>'authUid' = (select auth.uid())::text or
    lower(payload->>'email') = lower((select auth.jwt()->>'email'))
  )
  with check (
    (select private.is_trip_member(trip_id)) and (
      (select private.is_trip_owner(trip_id)) or
      payload->>'authUid' = (select auth.uid())::text
    )
  );
create policy trip_members_owner_or_self_delete on public.trip_members for delete to authenticated
  using (
    (select private.is_trip_owner(trip_id)) or
    payload->>'authUid' = (select auth.uid())::text
  );

do $$
declare table_name text;
begin
  foreach table_name in array array['households', 'expenses', 'settlements', 'activities']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_trip_member(trip_id)))',
      table_name || '_member_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_trip_member(trip_id)))',
      table_name || '_member_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_trip_member(trip_id))) with check ((select private.is_trip_member(trip_id)))',
      table_name || '_member_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_trip_member(trip_id)))',
      table_name || '_member_delete', table_name
    );
  end loop;
end $$;

create or replace function public.join_trip(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_trip public.trips%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select t.* into found_trip
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where i.token = invitation_token
    and not i.revoked
    and not t.is_deleted;

  if not found then
    raise exception 'This invitation is invalid or has expired.' using errcode = 'P0002';
  end if;

  insert into public.trip_memberships (trip_id, user_id, role)
  values (found_trip.id, (select auth.uid()), case when found_trip.owner_id = (select auth.uid()) then 'owner' else 'member' end)
  on conflict (trip_id, user_id) do update set role = excluded.role;

  return found_trip.payload;
end;
$$;

revoke all on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated;

create or replace function public.transfer_trip_ownership(target_trip_id text, new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare old_owner_id uuid;
begin
  select owner_id into old_owner_id from public.trips where id = target_trip_id for update;
  if old_owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the trip owner can transfer ownership.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.trip_memberships
    where trip_id = target_trip_id and user_id = new_owner_id
  ) then
    raise exception 'The new owner must have joined the trip.' using errcode = '23514';
  end if;

  insert into public.trip_memberships (trip_id, user_id, role)
  values (target_trip_id, old_owner_id, 'member')
  on conflict (trip_id, user_id) do update set role = excluded.role;
  update public.trip_memberships set role = 'owner'
    where trip_id = target_trip_id and user_id = new_owner_id;
  update public.trips
    set owner_id = new_owner_id,
        payload = jsonb_set(payload, '{ownerId}', to_jsonb(new_owner_id::text)),
        updated_at = now()
    where id = target_trip_id;
end;
$$;

revoke all on function public.transfer_trip_ownership(text, uuid) from public, anon;
grant execute on function public.transfer_trip_ownership(text, uuid) to authenticated;

alter table public.trips replica identity full;
alter table public.trip_members replica identity full;
alter table public.households replica identity full;
alter table public.expenses replica identity full;
alter table public.settlements replica identity full;
alter table public.activities replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.trips;
  alter publication supabase_realtime add table public.trip_members;
  alter publication supabase_realtime add table public.households;
  alter publication supabase_realtime add table public.expenses;
  alter publication supabase_realtime add table public.settlements;
  alter publication supabase_realtime add table public.activities;
exception when duplicate_object then null;
end $$;
