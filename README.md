# Antiskino

Book a camping pitch in Greece in under a minute. A marketplace of partner
campings with a customer app and a partner dashboard in one Expo codebase
(iOS, Android, web), backed by Supabase.

- **Spec:** [SPEC.md](SPEC.md) (source of truth) · **Working rules:** [CLAUDE.md](CLAUDE.md)
- **Web preview** (deployed from `main`): https://se7enbit.github.io/antiskino/

## Quick start

```bash
npm install
cp .env.example .env        # fill in the EXPO_PUBLIC_* values
npx expo start              # press w for web
```

Checks (the same ones CI runs): `npm run typecheck`, `npm run lint`, `npm test`,
`deno test supabase/functions`, and with Docker and the Supabase CLI v3:
`supabase start`, `supabase test db`, `npm run db:types`.

Database migrations in `supabase/migrations` reach the dev project through the
Supabase GitHub integration when `main` is pushed.
