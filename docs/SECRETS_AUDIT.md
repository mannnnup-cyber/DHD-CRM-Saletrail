# Secrets Audit (automated)

Findings (automated scan):

- `src/lib/supabase.ts` previously included a hard-coded anon key — removed and now reads from env.
- Environment variables referenced across project: `SUPABASE_PROJECT_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `WC_STORE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`.
- `supabase/email_schema.sql` references IMAP password setting key (ensure not stored in repo).

Actions taken:

- Removed embedded Supabase anon key from `src/lib/supabase.ts`.
- Added `.env.example` (already present) to document required environment variables.
- Added this audit file to `docs/`.

Recommended next steps:

1. Rotate any keys that may have been committed previously.
2. Add a CI secrets scanner (already added a simple grep step in CI; consider `git-secrets` or `truffleHog`).
3. Ensure `.env` is in `.gitignore` and never committed.
