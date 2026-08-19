# WhoPaid security model

WhoPaid is a client-side Firebase application. The Firebase web configuration
is public by design; authorization is enforced by Firestore and Storage Rules.

## Access model

- A user profile at `users/{uid}` is readable and writable only by that UID.
- A trip owner is identified by `trips/{tripId}.ownerId`.
- A joined user is authorized by
  `users/{uid}/tripMemberships/{tripId}`.
- Trip invitations use a cryptographically random token. The public share URL
  contains this token, not the Firestore trip ID.
- `tripInvites/{token}` resolves the token to a trip. It can be fetched only by
  a signed-in user and cannot be listed.
- Creating a membership document requires a live invite whose stored `tripId`
  matches the requested membership.
- Trip documents, expenses, settlements, members, activities, and receipts are
  available only to the owner or a user with that trip membership.

Anyone who possesses an active invite link can join its trip after signing in.
Treat invite links like bearer credentials and share them only with intended
participants.

## Local verification

```bash
npm test
npm run test:rules
npm run build
npm audit --omit=dev
```

`npm run test:rules` requires Java 21 because Firebase's local Firestore and
Storage emulators run on Java. CI installs this runtime automatically.

## Safe deployment and legacy migration

The GitHub Pages workflow deploys the frontend only. It does not deploy Firebase
Rules. Review the generated changes before running:

```bash
npx firebase login
npx firebase use <your-project-id>
npx firebase deploy --only firestore:rules,storage
```

For existing trips:

1. Deploy the new frontend first.
2. Have each trip owner sign in once while the previous rules are still active.
   The app adds an invite token and the owner's membership index automatically.
3. Deploy the new Firestore and Storage Rules.
4. Existing non-owner participants should open a newly generated invite link
   once. This creates their indexed membership under their authenticated UID.
5. Confirm access using two test accounts before inviting real users.

If an old trip contains sensitive information and its owner cannot perform the
migration, create a new trip rather than keeping permissive rules enabled.

## Firebase console checklist

- Restrict the public Firebase API key to the Firebase APIs used by this app.
- Disable authentication providers that are not used.
- Review Firestore and Storage usage after the rules deployment.
- Consider enabling Firebase App Check after monitoring its metrics. App Check
  is defense in depth and does not replace Security Rules.
- Enable billing and quota alerts appropriate to the project.

## Reporting a vulnerability

Do not open a public issue containing user data, credentials, receipt images, or
working exploit details. Contact the repository owner privately first.
