# File Map

This file explains the key files, folders, routes, dependencies, integrations,
and environment variables in the project. The JSON block is intended to stay
parseable by AI tools and harness systems.

```json
{
  "project": {
    "name": "DHD CRM SalesTrail",
    "runtime": "React 19 + TypeScript + Vite 7 + Tailwind CSS",
    "deployment": "Vercel (frontend + serverless API)",
    "packageManager": "npm",
    "database": "Supabase (PostgreSQL)",
    "companionApp": "DHD-CRM-Companion (Android, separate repo)",
    "entrypoints": [
      {
        "file": "src/main.tsx",
        "purpose": "Mounts the React application"
      },
      {
        "file": "src/App.tsx",
        "purpose": "App shell, auth gate, header, route table"
      }
    ],
    "criticalNote": "The browser Supabase client in src/lib/supabase.ts falls back to {} if env vars are missing. Never call supabase.from() directly from page components — always use /api/* fetch calls instead. DataContext wraps all supabase calls with .catch(() => []) which silently hides this failure."
  },
  "routes": [
    {
      "path": "/",
      "file": "src/App.tsx",
      "purpose": "Redirects to /dashboard"
    },
    {
      "path": "/dashboard",
      "file": "src/pages/Dashboard.tsx",
      "purpose": "Main CRM analytics dashboard with ActionList widget",
      "dependsOn": ["src/context/AppContext.tsx", "src/components/ActionList.tsx"]
    },
    {
      "path": "/contacts",
      "file": "src/pages/Contacts.tsx",
      "purpose": "Master contact list with search, filters, WhatsApp button, status badge",
      "dependsOn": ["src/context/AppContext.tsx", "api/contacts.ts"]
    },
    {
      "path": "/contacts/:id",
      "file": "src/pages/ContactProfile.tsx",
      "purpose": "360° contact view: header, activity timeline, WooCommerce orders, deals, action bar",
      "dependsOn": ["api/contacts.ts", "api/whatsapp.ts", "api/woocommerce.ts"]
    },
    {
      "path": "/calls",
      "file": "src/pages/CallLogs.tsx",
      "purpose": "GSM + WhatsApp call history. Rep filter, date filter (last 24h / yesterday / week / month / all), type filter, paginated, stats bar",
      "dependsOn": ["api/whatsapp.ts"]
    },
    {
      "path": "/tasks",
      "file": "src/pages/Tasks.tsx",
      "purpose": "Task management: stats, filters (all/pending/overdue/completed), complete toggle, add task modal",
      "dependsOn": ["api/tasks.ts"],
      "note": "Uses fetch('/api/tasks') — NOT supabase.from(). Direct Supabase client is broken in browser."
    },
    {
      "path": "/pipeline",
      "file": "src/pages/Pipeline.tsx",
      "purpose": "Sales deal pipeline (kanban)",
      "dependsOn": ["src/context/AppContext.tsx", "src/data/constants.ts"]
    },
    {
      "path": "/quotes",
      "file": "src/pages/Quotes.tsx",
      "purpose": "Quote generation, Approve/Decline/Convert to Invoice",
      "dependsOn": ["src/context/AppContext.tsx"]
    },
    {
      "path": "/invoices",
      "file": "src/pages/Invoices.tsx",
      "purpose": "Invoice management, Mark Paid, overdue detection",
      "dependsOn": ["src/context/AppContext.tsx"]
    },
    {
      "path": "/leads",
      "file": "src/pages/LeadImport.tsx",
      "purpose": "Lead import with duplicate detection, AI enrichment, bulk enrichment",
      "dependsOn": ["src/context/AppContext.tsx", "api/contacts.ts"]
    },
    {
      "path": "/social",
      "file": "src/pages/SocialMedia.tsx",
      "purpose": "Social media management via BrightBean Studio: setup guide when unconfigured, connected accounts, quick links to Studio, per-account analytics",
      "dependsOn": ["api/social.ts"]
    },
    {
      "path": "/whatsapp",
      "file": "src/pages/WhatsApp.tsx",
      "purpose": "WhatsApp inbox. Contact pre-load via localStorage key dhd_wa_open_contact",
      "dependsOn": ["api/whatsapp.ts", "src/context/AppContext.tsx"]
    },
    {
      "path": "/email",
      "file": "src/pages/EmailInbox.tsx",
      "purpose": "Email inbox: IMAP sync, body rendering, sort, deduplicate, auto-sync",
      "dependsOn": ["api/email.ts", "src/context/AppContext.tsx"]
    },
    {
      "path": "/woocommerce",
      "file": "src/pages/WooCommerce.tsx",
      "purpose": "WooCommerce order and customer sync UI",
      "dependsOn": ["api/woocommerce.ts", "src/context/AppContext.tsx"]
    },
    {
      "path": "/companion",
      "file": "src/pages/CompanionApp.tsx",
      "purpose": "Companion Android app: setup guide, download link, device list, version check, health status",
      "dependsOn": ["api/whatsapp.ts"]
    },
    {
      "path": "/call-sync",
      "file": "src/pages/CallSync.tsx",
      "purpose": "Legacy Google Sheets / MacroDroid call sync workflow documentation",
      "dependsOn": ["src/context/AppContext.tsx"]
    },
    {
      "path": "/coaching",
      "file": "src/pages/CoachingDashboard.tsx",
      "purpose": "Coaching dashboard (skeleton — data integration pending)",
      "dependsOn": ["src/context/AppContext.tsx"]
    },
    {
      "path": "/recording-settings",
      "file": "src/pages/RecordingSettings.tsx",
      "purpose": "Call recording configuration",
      "dependsOn": ["api/recordings.ts"]
    },
    {
      "path": "/templates",
      "file": "src/pages/Templates.tsx",
      "purpose": "Message template management",
      "dependsOn": ["src/context/AppContext.tsx"]
    },
    {
      "path": "/team",
      "file": "src/pages/Team.tsx",
      "purpose": "Manager-only team view with live Supabase data: calls, WhatsApp, deals per rep",
      "dependsOn": ["api/crm.ts", "api/users.ts"]
    },
    {
      "path": "/reports",
      "file": "src/pages/Reports.tsx",
      "purpose": "CRM reporting and performance metrics (partially live data)",
      "dependsOn": ["src/context/AppContext.tsx"]
    },
    {
      "path": "/holidays",
      "file": "src/pages/Holidays.tsx",
      "purpose": "Jamaica holiday configuration",
      "dependsOn": ["src/context/AppContext.tsx"]
    },
    {
      "path": "/settings",
      "file": "src/pages/Settings.tsx",
      "purpose": "Integration settings: WhatsApp providers, WooCommerce, email (IMAP), AI API keys, automation rules",
      "dependsOn": ["api/settings.ts", "api/whatsapp.ts", "api/crm.ts"]
    },
    {
      "path": "/docs",
      "file": "src/pages/Documentation.tsx",
      "purpose": "In-app technical and user documentation",
      "dependsOn": []
    }
  ],
  "components": [
    {
      "name": "Sidebar",
      "file": "src/components/Sidebar.tsx",
      "purpose": "Navigation, route labels, role-based section filtering, logout",
      "dependsOn": ["src/context/AppContext.tsx", "lucide-react"]
    },
    {
      "name": "ActionList",
      "file": "src/components/ActionList.tsx",
      "purpose": "Daily missed-opportunity action list widget shown on Dashboard",
      "dependsOn": ["api/crm.ts"]
    },
    {
      "name": "CompanionConnect",
      "file": "src/components/CompanionConnect.tsx",
      "purpose": "Compact companion app connection status widget",
      "dependsOn": ["api/whatsapp.ts"]
    },
    {
      "name": "ContactModal",
      "file": "src/components/ContactModal.tsx",
      "purpose": "Quick-view contact detail modal",
      "dependsOn": ["src/context/AppContext.tsx"]
    }
  ],
  "context": [
    {
      "name": "AppContext (thin shell)",
      "file": "src/context/AppContext.tsx",
      "purpose": "Stacks AuthContext, SyncContext, DataContext. Re-exports useApp() for backward compatibility.",
      "dependsOn": ["src/context/AuthContext.tsx", "src/context/SyncContext.tsx", "src/context/DataContext.tsx"]
    },
    {
      "name": "AuthContext",
      "file": "src/context/AuthContext.tsx",
      "purpose": "Demo user list, login, logout. Swap point for Supabase Auth later.",
      "dependsOn": []
    },
    {
      "name": "SyncContext",
      "file": "src/context/SyncContext.tsx",
      "purpose": "Synced calls from companion app, Supabase connection flag, call conversion helpers.",
      "dependsOn": ["src/lib/supabase.ts"]
    },
    {
      "name": "DataContext",
      "file": "src/context/DataContext.tsx",
      "purpose": "All CRM state, localStorage persistence, Supabase startup load, all mutations. Uses supabase.from() with .catch(() => []) — failures are silent.",
      "dependsOn": ["src/data/types.ts", "src/data/store.ts", "src/lib/supabase.ts"],
      "storageKeys": ["dhd_salestrail_state", "dhd_synced_calls"]
    }
  ],
  "apiEndpoints": [
    {
      "file": "api/crm.ts",
      "purpose": "Core CRM engine: automation runner (cron), opportunity/action-list rules, team statistics endpoint",
      "actions": ["runAutomation (cron)", "opportunities", "teamStats"],
      "risk": "Automation logic creates tasks in Supabase; changes here affect daily pipeline execution"
    },
    {
      "file": "api/tasks.ts",
      "purpose": "Task CRUD: GET (list with contact+rep name joins), POST (create), PATCH (update/toggle complete)",
      "actions": ["GET /api/tasks", "POST /api/tasks", "PATCH /api/tasks"],
      "note": "Created because browser Supabase client is broken — Tasks.tsx must use this endpoint"
    },
    {
      "file": "api/contacts.ts",
      "purpose": "Contact identity resolution, list, get by id, migrate leads",
      "actions": ["list", "get", "resolve", "migrate"]
    },
    {
      "file": "api/whatsapp.ts",
      "purpose": "WhatsApp: inbox, send, webhook (Green API + Evolution API), GSM call sync, device management",
      "actions": ["send", "getMessages", "getAllCalls", "addGSMCall", "getGSMCalls", "getDevices", "updateDeviceName", "addWhatsAppCall", "getLatestRelease", "checkVersion"],
      "risk": "Handles private customer messaging data; supports two provider formats (Green API + Evolution API)"
    },
    {
      "file": "api/woocommerce.ts",
      "purpose": "WooCommerce: order/customer sync, product fetch, order list",
      "actions": ["orders", "customers", "products", "syncOrders", "test", "configured"],
      "envVariables": ["WC_STORE_URL", "WC_CONSUMER_KEY", "WC_CONSUMER_SECRET"],
      "risk": "Credentials and third-party API; syncOrders modifies contacts and woo_orders tables"
    },
    {
      "file": "api/woocommerce-webhook.ts",
      "purpose": "Dedicated WooCommerce webhook receiver for real-time order updates",
      "risk": "Public endpoint — validate webhook secret"
    },
    {
      "file": "api/social.ts",
      "purpose": "BrightBean Studio REST API proxy: social media accounts, workspace status, per-account analytics",
      "actions": ["status (default)", "accounts", "analytics"],
      "envVariables": ["BRIGHTBEAN_API_KEY", "BRIGHTBEAN_API_URL (optional, defaults to https://studio.brightbean.xyz/api/v1)"],
      "note": "API key is read from the app_settings table (setting_key BRIGHTBEAN_API_KEY, password type — masked in the Settings UI) with the env var as fallback; DB wins over env. Returns { success: true, configured: false } when no key is set so the UI can show the setup guide. BrightBean path quirk: /me/ and /accounts/ need trailing slashes, /analytics/accounts/{id} must not."
    },
    {
      "file": "api/settings.ts",
      "purpose": "Read/write app_settings table; masks password-type settings on read",
      "envVariables": ["SUPABASE_PROJECT_URL", "SUPABASE_ANON_KEY"],
      "risk": "Handles secret storage and masking — never return raw password values"
    },
    {
      "file": "api/email.ts",
      "purpose": "IMAP email sync, compose, send, contact resolution on inbound",
      "risk": "Email credentials, message privacy, IMAP library behavior"
    },
    {
      "file": "api/users.ts",
      "purpose": "User profile management: list, get, update",
      "dependsOn": ["user_profiles Supabase table"]
    },
    {
      "file": "api/recordings.ts",
      "purpose": "Call recording settings and management"
    }
  ],
  "libraries": [
    {
      "file": "src/lib/supabase.ts",
      "purpose": "Supabase client, database types, db helper methods. Browser client falls back to {} if env vars missing.",
      "envVariables": ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      "warning": "Never call supabase.from() directly from page components. All Supabase queries must go through /api/* endpoints or use DataContext which wraps with .catch(() => [])."
    },
    {
      "file": "src/lib/supabase-service.ts",
      "purpose": "Additional Supabase service layer"
    },
    {
      "file": "src/utils/cn.ts",
      "purpose": "Class name merge utility (clsx/twMerge)"
    }
  ],
  "database": [
    {
      "table": "contacts",
      "purpose": "Master customer record. All other tables link here via contact_id FK."
    },
    {
      "table": "interactions",
      "purpose": "Unified activity log: calls, emails, WhatsApp messages, notes, all linked to contacts."
    },
    {
      "table": "cellular_calls",
      "purpose": "GSM call records synced from Android companion app. Includes rep_phone, rep_name, rep_id, call_type, duration."
    },
    {
      "table": "devices",
      "purpose": "Registered companion app devices. phone_number is the filter key for call log rep filter."
    },
    {
      "table": "whatsapp_messages",
      "purpose": "WhatsApp conversation messages. Supports Green API and Evolution API providers."
    },
    {
      "table": "woo_orders",
      "purpose": "WooCommerce order snapshot. Status values: pending, completed, cancelled (DHD custom statuses not yet synced)."
    },
    {
      "table": "tasks",
      "purpose": "CRM tasks and follow-ups. Created by automation engine or manually. Columns: title, description, due_date, completed, priority, contact_id, assigned_to."
    },
    {
      "table": "automation_rules",
      "purpose": "Pipeline automation rule definitions: trigger_type, conditions, actions, priority, active flag."
    },
    {
      "table": "automation_runs",
      "purpose": "Log of automation executions. Prevents duplicate task creation for same entity."
    },
    {
      "table": "app_settings",
      "purpose": "Persistent app configuration (WhatsApp providers, API keys, integration config). Passwords masked on read."
    },
    {
      "table": "user_profiles",
      "purpose": "CRM user profiles linked to Supabase auth users. Used for rep assignment."
    },
    {
      "file": "supabase/schema.sql",
      "purpose": "Primary database schema"
    },
    {
      "file": "supabase/email_schema.sql",
      "purpose": "Email and app_settings schema"
    }
  ],
  "configuration": [
    {
      "file": "package.json",
      "purpose": "NPM scripts, runtime dependencies, dev dependencies"
    },
    {
      "file": "vite.config.ts",
      "purpose": "Vite build configuration"
    },
    {
      "file": "tsconfig.json",
      "purpose": "TypeScript compiler configuration"
    },
    {
      "file": "vercel.json",
      "purpose": "Vercel deployment config. Includes daily cron at 9am for automation engine."
    },
    {
      "file": ".env.example",
      "purpose": "Documented environment variable names — no real secrets"
    },
    {
      "file": "CLAUDE.md",
      "purpose": "AI agent operating instructions: GitNexus workflow, impact analysis rules, never-do list"
    },
    {
      "file": "AGENTS.md",
      "purpose": "Root AI agent guide (alias of CLAUDE.md content for non-Claude agents)"
    }
  ],
  "documentation": [
    {
      "file": "docs/context/PROJECT_BRIEF.md",
      "purpose": "Product goal, users, business logic, expected outcome"
    },
    {
      "file": "docs/context/ARCHITECTURE.md",
      "purpose": "System structure, data flow, integrations, risk areas"
    },
    {
      "file": "docs/context/FILE_MAP.md",
      "purpose": "Human and machine-readable map of routes, files, APIs, tables, env vars"
    },
    {
      "file": "docs/context/COMMENTING_STANDARD.md",
      "purpose": "Commenting and documentation expectations for code and AI agents"
    },
    {
      "file": "docs/context/TASK_BOARD.md",
      "purpose": "Current task status, owners, blockers, next steps"
    },
    {
      "file": "docs/context/MILESTONES.md",
      "purpose": "Project phases and delivery status"
    },
    {
      "file": "docs/context/CHANGELOG.md",
      "purpose": "Major updates, fixes, decisions, completed changes — newest first"
    },
    {
      "file": "docs/context/PROMPT_TEMPLATE.md",
      "purpose": "Reusable structured prompt format for AI-assisted coding tasks"
    }
  ],
  "tooling": [
    {
      "name": "GitNexus",
      "purpose": "Codebase indexing and dependency tracing. Run npx gitnexus analyze after major changes.",
      "setupCommands": ["npx gitnexus analyze --skip-agents-md", "npx gitnexus setup"]
    },
    {
      "name": "Context7",
      "purpose": "Up-to-date library and API documentation for AI-assisted development",
      "setupCommands": ["npx ctx7 setup"]
    }
  ],
  "environmentVariables": {
    "frontend": [
      { "key": "VITE_SUPABASE_URL", "purpose": "Supabase project URL" },
      { "key": "VITE_SUPABASE_ANON_KEY", "purpose": "Supabase anon/public key" }
    ],
    "serverside": [
      { "key": "SUPABASE_PROJECT_URL", "purpose": "Supabase URL for API handlers" },
      { "key": "SUPABASE_ANON_KEY", "purpose": "Supabase anon key for API handlers" },
      { "key": "WC_STORE_URL", "purpose": "WooCommerce store base URL" },
      { "key": "WC_CONSUMER_KEY", "purpose": "WooCommerce REST API consumer key" },
      { "key": "WC_CONSUMER_SECRET", "purpose": "WooCommerce REST API consumer secret" },
      { "key": "GREENAPI_INSTANCE_ID", "purpose": "Green API WhatsApp instance ID" },
      { "key": "GREENAPI_TOKEN", "purpose": "Green API authentication token" },
      { "key": "EVOLUTION_API_URL", "purpose": "Evolution API server URL (Railway)" },
      { "key": "EVOLUTION_API_KEY", "purpose": "Evolution API authentication key" },
      { "key": "BRIGHTBEAN_API_KEY", "purpose": "BrightBean Studio API key (bb_studio_..., workspace-scoped) for social media module" },
      { "key": "BRIGHTBEAN_API_URL", "purpose": "BrightBean Studio API base URL (optional; defaults to https://studio.brightbean.xyz/api/v1)" },
      { "key": "IMAP_HOST", "purpose": "Email server host" },
      { "key": "IMAP_USER", "purpose": "Email account username" },
      { "key": "IMAP_PASS", "purpose": "Email account password" },
      { "key": "OPENAI_API_KEY", "purpose": "OpenAI API key for AI enrichment" },
      { "key": "ANTHROPIC_API_KEY", "purpose": "Anthropic Claude API key for AI analysis" }
    ]
  },
  "riskChecklist": [
    "Changing AppContext or DataContext can affect persistence, Supabase sync, and most pages.",
    "Changing routes in App.tsx must be mirrored in Sidebar.tsx and FILE_MAP.md.",
    "Never call supabase.from() directly in page components — browser client falls back to {}.",
    "Changing Supabase table schemas requires updating SQL files, API handlers, and type definitions.",
    "Changing api/whatsapp.ts affects GSM call sync, WhatsApp inbox, device management, AND the companion Android app.",
    "The cellular_calls.rep_phone and devices.phone_number must stay in the same format for the rep filter to match.",
    "Changing automation_rules format in crm.ts affects all 11 pipeline rules and daily cron runs.",
    "Changing environment variable names must be mirrored in .env.example, Vercel settings, and docs."
  ]
}
```

## Maintenance Rule

Update this file whenever routes, shared components, state shape, database tables,
serverless API handlers, integrations, environment variables, or developer tooling change.
Also update CHANGELOG.md with a summary of what changed and why.
