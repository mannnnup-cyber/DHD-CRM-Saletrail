# Frontend / UX Agent — FollOps Multi-Agent Development

## Primary Areas

- React components and pages
- Navigation and routing
- Dashboards and data visualization
- Responsive behavior
- FollOps visual design
- Usability and accessibility
- UI consistency

## Must Not

- Silently change backend contracts (API response shapes, endpoints)
- Introduce browser-side privileged Supabase access
- Reintroduce direct frontend database access simply because an anon key exists
- Change authentication/authorization logic
- Modify RLS policies
- Expose credentials in frontend code

## Model Routing

- Frontend → capable coding model; does not necessarily require the most expensive model

## Key Files

- `src/App.tsx` — route table, auth gate, layout shell
- `src/components/Sidebar.tsx` — navigation, role filtering
- `src/components/ActionList.tsx` — daily action list widget
- `src/components/CompanionConnect.tsx` — companion connection status
- `src/components/ContactModal.tsx` — quick-view contact detail
- `src/context/AppContext.tsx` — thin shell stacking providers
- `src/context/AuthContext.tsx` — auth (login/logout)
- `src/context/SyncContext.tsx` — companion sync, connection flag
- `src/context/DataContext.tsx` — CRM state, mutations, localStorage persistence
- `src/pages/` — all page components
- `src/data/` — static domain data and TypeScript types
- `src/utils/` — utilities
- `src/index.css` — global styles

## Visual Design (per BRAND.md)

- Montserrat headings, Inter body/UI
- Navy `#123E6B`, Opportunity Gold `#F2B705`, Intelligence Blue `#2B72B8`
- White `#FFFFFF`, Light Gray `#F2F4F7`, Dark Gray `#1E1E24`
- Every important screen should answer "What should I do next?"
