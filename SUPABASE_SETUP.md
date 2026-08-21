# Supabase cutover

The WhoPaid client no longer contains Firebase or Firestore code. Complete these
steps before deploying v2.0.0; otherwise authentication and cloud data will be
unavailable.

## 1. Create and initialize the project

1. Create a Supabase project in the region you want to use.
2. Open the SQL editor and run
   `supabase/migrations/202608210001_initial_schema.sql` in full.
3. Confirm that RLS is enabled on every table and that the six trip-content
   tables are included in the `supabase_realtime` publication.

## 2. Configure authentication

Enable Email and Google under Authentication > Providers. Add these redirect
URLs under Authentication > URL Configuration:

- `https://ozlphrt.github.io/WhoPaid/`
- `http://localhost:5173/WhoPaid/`
- `http://127.0.0.1:5173/WhoPaid/`

Apple, Azure/Microsoft, Facebook, and anonymous sign-in are already supported by
the client boundary but should remain disabled unless the corresponding UI and
provider configuration are intentionally enabled.

## 3. Configure the client

Copy `.env.example` to `.env.local` for development and set only:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-anon-key>
```

Add the same names as GitHub repository secrets. The anonymous/publishable key
is designed for browser use and is constrained by RLS. Never add a secret or
service-role key to a `VITE_` variable.

## 4. Migrate existing production data before cutover

This repository does not contain privileged Firebase or Supabase credentials,
so it cannot perform the production migration automatically. Use Supabase's
[official Auth migration guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth)
and [Firestore data migration guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/firestore-data)
to export the source data.
During transformation:

1. Build a mapping from each previous Auth UID to its new Supabase Auth UUID.
2. Rewrite every trip `ownerId`, joined member `authUid`, and membership user ID
   with that map. Placeholder participant `userId` values stay unchanged.
3. Insert trips first, then memberships and invites, then members, households,
   expenses, settlements, activities, and profiles.
4. Keep receipt data inside each expense payload; no public storage bucket is
   required.
5. Compare row counts and test owner, member, outsider, QR join, rename, expense,
   and realtime flows with two test accounts before changing the live secrets.

Do not deploy the v2 client before this step if the existing trips must remain
available. Keep the old backend read-only during validation, then retire it only
after the Supabase data and authentication checks pass.
