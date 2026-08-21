-- A person may appear only once in a trip for a given email address.
-- Normalize casing and surrounding whitespace so equivalent addresses conflict.
create unique index if not exists trip_members_unique_normalized_email_per_trip
  on public.trip_members (trip_id, lower(btrim(payload ->> 'email')))
  where nullif(btrim(payload ->> 'email'), '') is not null;
