# Architecture

## Runtime Shape

DHD CRM SalesTrail is a React 19, TypeScript, Vite 7, and Tailwind CSS 4
application deployed as a Vercel-compatible frontend with serverless API routes
under `api/`.

The app uses hash-based routing through `react-router-dom`. Route definitions
live in `src/App.tsx`, and navigation labels live in `src/components/Sidebar.tsx`.

## Frontend

- Entry point: `src/main.tsx`.
- App shell and route table: `src/App.tsx`.
- Shared state provider: `src/context/AppContext.tsx`.
- Reusable components: `src/components/`.
- Pages: `src/pages/`.
- Static domain data and TypeScript types: `src/data/`.
- Utility helpers: `src/utils/`.
- Global styles: `src/index.css`.

## State And Data Flow

- `AppProvider` owns the main app state and exposes actions through `useApp`.
- Local storage is used as the fallback persistence layer.
- Supabase is attempted during startup; if data is available, it is converted
  into app state.
- Synced call data is kept separately in local storage and merged with app calls
  for reporting views.

## Backend And APIs

- Supabase client and database helper functions live in `src/lib/supabase.ts`.
- Additional Supabase service logic lives in `src/lib/supabase-service.ts`.
- SQL schema files live in `supabase/`.
- Vercel serverless API handlers live in `api/`.
- API handlers include WooCommerce, WhatsApp, settings, email, and database-test
  endpoints.

## Integrations

- Supabase: database client, tables, and optional realtime subscriptions.
- WooCommerce: order/customer sync through Vercel API handler.
- WhatsApp: inbox or messaging workflow through app pages and API handler.
- Email: inbox and settings workflow through Vercel API handlers.
- Google Sheets and MacroDroid: call sync workflow documented in the app.
- Vercel: deployment target and serverless API runtime.
- GitNexus: developer workflow tool for codebase indexing.
- Context7: developer workflow tool for up-to-date framework and library docs.

## Environment Variables

Client-side variables use the `VITE_` prefix and are available to the frontend.
Server-side variables are read from `process.env` in `api/` handlers.

Do not document real secrets in repository docs. Use names and purposes only.

## Risk Areas

- `src/context/AppContext.tsx`: shared state, persistence, Supabase sync, and
  core write actions.
- `src/App.tsx`: route definitions, layout shell, auth gate, and global UI.
- `src/components/Sidebar.tsx`: navigation, role filtering, and route labels.
- `src/lib/supabase.ts`: database table contracts and environment variables.
- `api/`: serverless handlers, credentials, third-party APIs, and CORS behavior.
- `supabase/`: database schema compatibility with frontend and API calls.

## AI Workflow Rule

AI agents should not code from a blank prompt. Each implementation task should
start by reading the context docs, checking the file map, identifying the blast
radius, verifying current library usage through official docs or Context7 when
needed, making the smallest safe change, then updating documentation.
