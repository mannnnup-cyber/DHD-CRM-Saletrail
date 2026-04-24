# File Map

This file explains the key files, folders, routes, dependencies, integrations,
and environment variables in the project. The JSON block is intended to stay
parseable by AI tools and harness systems.

```json
{
  "project": {
    "name": "DHD CRM SalesTrail",
    "runtime": "React 19 + TypeScript + Vite 7",
    "deployment": "Vercel",
    "packageManager": "npm",
    "entrypoints": [
      {
        "file": "src/main.tsx",
        "purpose": "Mounts the React application"
      },
      {
        "file": "src/App.tsx",
        "purpose": "Defines the app shell, auth gate, header, and route table"
      }
    ]
  },
  "routes": [
    {
      "path": "/",
      "file": "src/App.tsx",
      "purpose": "Redirects to /dashboard",
      "dependsOn": [
        "src/pages/Dashboard.tsx"
      ]
    },
    {
      "path": "/dashboard",
      "file": "src/pages/Dashboard.tsx",
      "purpose": "Main CRM analytics dashboard",
      "dependsOn": [
        "src/context/AppContext.tsx",
        "src/data/types.ts"
      ]
    },
    {
      "path": "/calls",
      "file": "src/pages/CallLogs.tsx",
      "purpose": "Call logging and call history view",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/tasks",
      "file": "src/pages/Tasks.tsx",
      "purpose": "Task management and follow-up tracking",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/pipeline",
      "file": "src/pages/Pipeline.tsx",
      "purpose": "Sales deal pipeline",
      "dependsOn": [
        "src/context/AppContext.tsx",
        "src/data/constants.ts"
      ]
    },
    {
      "path": "/quotes",
      "file": "src/pages/Quotes.tsx",
      "purpose": "Quote generation and quote status tracking",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/leads",
      "file": "src/pages/LeadImport.tsx",
      "purpose": "Lead import and lead creation workflow",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/woocommerce",
      "file": "src/pages/WooCommerce.tsx",
      "purpose": "WooCommerce sync UI",
      "dependsOn": [
        "api/woocommerce.ts",
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/call-sync",
      "file": "src/pages/CallSync.tsx",
      "purpose": "Google Sheets and MacroDroid call sync workflow",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/templates",
      "file": "src/pages/Templates.tsx",
      "purpose": "Message template management",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/team",
      "file": "src/pages/Team.tsx",
      "purpose": "Manager-only team view",
      "dependsOn": [
        "src/context/AppContext.tsx",
        "src/components/Sidebar.tsx"
      ]
    },
    {
      "path": "/reports",
      "file": "src/pages/Reports.tsx",
      "purpose": "CRM reporting and performance metrics",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/holidays",
      "file": "src/pages/Holidays.tsx",
      "purpose": "Jamaica holiday configuration and awareness",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/invoices",
      "file": "src/pages/Invoices.tsx",
      "purpose": "Invoice management",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/settings",
      "file": "src/pages/Settings.tsx",
      "purpose": "Application and integration settings",
      "dependsOn": [
        "api/settings.ts",
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/docs",
      "file": "src/pages/Documentation.tsx",
      "purpose": "In-app technical and user documentation",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/whatsapp",
      "file": "src/pages/WhatsApp.tsx",
      "purpose": "WhatsApp inbox or messaging workflow",
      "dependsOn": [
        "api/whatsapp.ts",
        "src/context/AppContext.tsx"
      ]
    },
    {
      "path": "/email",
      "file": "src/pages/EmailInbox.tsx",
      "purpose": "Email inbox workflow",
      "dependsOn": [
        "api/email.ts",
        "src/context/AppContext.tsx"
      ]
    }
  ],
  "components": [
    {
      "name": "Sidebar",
      "file": "src/components/Sidebar.tsx",
      "purpose": "Navigation, route labels, sections, role filtering, and logout control",
      "dependsOn": [
        "src/context/AppContext.tsx",
        "lucide-react"
      ]
    },
    {
      "name": "ContactModal",
      "file": "src/components/ContactModal.tsx",
      "purpose": "Contact detail modal",
      "dependsOn": [
        "src/context/AppContext.tsx"
      ]
    }
  ],
  "state": [
    {
      "name": "AppProvider",
      "file": "src/context/AppContext.tsx",
      "purpose": "Shared app state, demo login, localStorage persistence, Supabase startup load, CRM mutations, and synced-call merge",
      "dependsOn": [
        "src/data/types.ts",
        "src/data/store.ts",
        "src/lib/supabase.ts"
      ],
      "storageKeys": [
        "dhd_salestrail_state",
        "dhd_synced_calls"
      ]
    }
  ],
  "dataFiles": [
    {
      "file": "src/data/types.ts",
      "purpose": "Frontend domain types"
    },
    {
      "file": "src/data/store.ts",
      "purpose": "Initial settings, mock data, team members, and ID generation"
    },
    {
      "file": "src/data/constants.ts",
      "purpose": "Shared constants for CRM workflows"
    }
  ],
  "libraries": [
    {
      "file": "src/lib/supabase.ts",
      "purpose": "Supabase client, database types, database helper methods, and realtime subscription helper",
      "envVariables": [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY"
      ]
    },
    {
      "file": "src/lib/supabase-service.ts",
      "purpose": "Additional Supabase service layer"
    },
    {
      "file": "src/utils/cn.ts",
      "purpose": "Class name merge utility"
    }
  ],
  "apiEndpoints": [
    {
      "file": "api/woocommerce.ts",
      "purpose": "WooCommerce integration handler",
      "risk": "Credentials and third-party API behavior"
    },
    {
      "file": "api/whatsapp.ts",
      "purpose": "WhatsApp integration handler",
      "risk": "Messaging API behavior and private customer data"
    },
    {
      "file": "api/settings.ts",
      "purpose": "Settings API for integration configuration and validation",
      "envVariables": [
        "SUPABASE_PROJECT_URL",
        "SUPABASE_ANON_KEY"
      ],
      "risk": "Server-side settings storage and secret masking"
    },
    {
      "file": "api/email.ts",
      "purpose": "Email integration handler",
      "risk": "Email credentials, sync behavior, and message privacy"
    },
    {
      "file": "api/email-old.ts",
      "purpose": "Legacy email integration handler",
      "risk": "Potential stale behavior kept for compatibility"
    },
    {
      "file": "api/db-test.ts",
      "purpose": "Database connectivity test handler",
      "risk": "Should not expose sensitive diagnostics"
    }
  ],
  "database": [
    {
      "file": "supabase/schema.sql",
      "purpose": "Primary database schema"
    },
    {
      "file": "supabase/schema-update.sql",
      "purpose": "Schema update script"
    },
    {
      "file": "supabase/email_schema.sql",
      "purpose": "Email-related database schema"
    }
  ],
  "configuration": [
    {
      "file": "package.json",
      "purpose": "NPM scripts, runtime dependencies, and dev dependencies"
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
      "purpose": "Vercel deployment configuration"
    },
    {
      "file": ".env.example",
      "purpose": "Documented environment variable names without real secrets"
    },
    {
      "file": ".gitignore",
      "purpose": "Ignored dependencies, build output, environment files, IDE files, logs, and coverage"
    }
  ],
  "documentation": [
    {
      "file": "docs/README.md",
      "purpose": "Main technical documentation"
    },
    {
      "file": "AGENTS.md",
      "purpose": "Root AI agent operating instructions"
    },
    {
      "file": "docs/context/PROJECT_BRIEF.md",
      "purpose": "Product goal, users, business logic, and expected outcome"
    },
    {
      "file": "docs/context/ARCHITECTURE.md",
      "purpose": "System structure, data flow, integrations, and risk areas"
    },
    {
      "file": "docs/context/FILE_MAP.md",
      "purpose": "Human and machine-readable map of routes, files, dependencies, and env vars"
    },
    {
      "file": "docs/context/COMMENTING_STANDARD.md",
      "purpose": "Commenting and documentation expectations"
    },
    {
      "file": "docs/context/TASK_BOARD.md",
      "purpose": "Tasks, owners, status, blockers, and next steps"
    },
    {
      "file": "docs/context/MILESTONES.md",
      "purpose": "Project phases and delivery status"
    },
    {
      "file": "docs/context/CHANGELOG.md",
      "purpose": "Major updates, fixes, decisions, and completed changes"
    },
    {
      "file": "docs/context/PROMPT_TEMPLATE.md",
      "purpose": "Reusable structured prompt format for AI-assisted coding"
    }
    ,
    {
      "file": "docs/context/LOCAL_MODELS.md",
      "purpose": "Guides for running Claude Code CLI against local model hosts (Ollama) and configuring VS Code"
    }
  ],
  "tooling": [
    {
      "name": "GitNexus",
      "purpose": "Codebase indexing and dependency tracing for AI-assisted development",
      "setupCommands": [
        "npx gitnexus analyze --skip-agents-md",
        "npx gitnexus setup"
      ]
    },
    {
      "name": "Context7",
      "purpose": "Up-to-date library and API documentation for AI-assisted development",
      "setupCommands": [
        "npx ctx7 setup"
      ]
    }
  ],
  "riskChecklist": [
    "Changing AppContext can affect persistence, Supabase sync, demo login, and most pages.",
    "Changing routes in App.tsx should be mirrored in Sidebar and FILE_MAP.",
    "Changing Supabase table contracts should be checked against SQL schema files and API handlers.",
    "Changing serverless APIs can affect credentials, CORS, deployment, and third-party integrations.",
    "Changing environment variable names must be mirrored in .env.example, docs, and deployment settings."
  ]
}
```

## Maintenance Rule

Update this file whenever routes, shared components, state shape, database
contracts, serverless API handlers, integrations, environment variables, or
developer tooling change.
