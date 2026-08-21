# WhoPaid security model

WhoPaid uses Supabase Auth and PostgreSQL. The browser receives only the project
URL and publishable anonymous key; authorization is enforced in PostgreSQL with
Row Level Security (RLS). A Supabase service-role key must never be placed in a
Vite variable, browser bundle, repository, or GitHub Pages secret.

## Access model

- A profile row is readable and writable only by its authenticated user.
- A trip owner is identified by `trips.owner_id`.
- Joined-user access is represented by `trip_memberships`, independently from
  display-only participant records in `trip_members`.
- Trip invitations use a cryptographically random token. The public share URL
  contains this token, not the PostgreSQL trip ID.
- The `join_trip` database function validates an active token and inserts the
  caller's membership atomically; invitation rows are not readable by invitees.
- Trip rows, expenses, settlements, members, activities, and receipts are
  available only to the owner or a user with that trip membership.
- Receipt images are compressed and stored inside protected expense JSONB;
  WhoPaid does not create public receipt URLs.

Anyone who possesses an active invite link can join its trip after signing in.
Treat invite links like bearer credentials and share them only with intended
participants.

## Local verification

```bash
npm test
npm run build
npm audit --omit=dev
```

## Deployment checklist

1. Create a Supabase project and apply
   `supabase/migrations/202608210001_initial_schema.sql` before deploying the client.
2. Enable only the required Auth providers and add both the GitHub Pages URL and
   local development URL to the Supabase Auth redirect allow list.
3. Store `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub repository
   secrets. Never create a client-side service-role variable.
4. Verify with two separate accounts that an outsider cannot read a trip, a
   signed-in invitee can join once, and a member sees expense changes in realtime.
5. Migrate existing production records before switching DNS/deployment. This
   repository intentionally contains no privileged migration credentials.

## Supabase console checklist

- Disable authentication providers that are not used.
- Keep RLS enabled on every public table.
- Review Auth, database, and Realtime usage and configure quota alerts.
- Rotate any key immediately if a service-role key is exposed.

## Reporting a vulnerability

Do not open a public issue containing user data, credentials, receipt images, or
working exploit details. Contact the repository owner privately first.
