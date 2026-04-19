---
description: Auth rules, protected routes, domain restrictions, and email verification
---

- All routes except `LoginPage` are protected. New pages must be placed inside the authenticated route group in `App.tsx`.
- Only `@finematrix.com` emails and the hardcoded admin (`dylanyeois@gmail.com`) are allowed. Do not change domain restrictions without explicit instruction.
- Email verification is required for non-admin accounts. Do not bypass or comment out this check.
- All auth logic lives in `src/lib/auth.tsx`. Do not duplicate auth checks in individual pages or components.
- Use the `useAuth()` hook to access the current user and auth functions. Never import `auth` from `firebase.ts` directly in a component.
- If a user's email domain is not allowed, they are automatically signed out — this happens in the auth state listener, not in the UI.
