# DHD CRM SalesTrail - Technical Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Integration](#api-integration)
6. [Setup Instructions](#setup-instructions)
7. [Features](#features)
8. [Deployment](#deployment)
9. [Environment Variables](#environment-variables)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**DHD CRM SalesTrail** is a comprehensive Customer Relationship Management (CRM) system built for Dirty Hand Designs, a Jamaican company. It provides a complete sales pipeline management solution with features for managing leads, deals, calls, tasks, and team performance.

### Key Features

- Dashboard with real-time analytics
- Lead management and import
- Sales pipeline tracking
- Call logging and tracking
- Task management
- Team performance leaderboard
- WhatsApp business integration
- WooCommerce sync
- Invoice and quote generation

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router DOM 7 |
| State Management | React Context + LocalStorage |
| Backend | Supabase (PostgreSQL) |
| Deployment | Vercel |

---

## Project Structure

```
sales-app-extracted/
├── api/                    # API integration files
│   ├── woocommerce.ts
│   └── whatsapp.ts
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ContactModal.tsx
│   │   └── Sidebar.tsx
│   ├── context/           # React Context providers
│   │   └── AppContext.tsx
│   ├── data/              # Static data and types
│   │   ├── constants.ts
│   │   ├── store.ts
│   │   └── types.ts
│   ├── lib/               # Utility libraries
│   │   ├── supabase.ts         # Supabase client
│   │   └── supabase-service.ts # Supabase service
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Pipeline.tsx
│   │   ├── Leads.tsx
│   │   ├── Calls.tsx
│   │   ├── Tasks.tsx
│   │   ├── Quotes.tsx
│   │   ├── Invoices.tsx
│   │   ├── Team.tsx
│   │   ├── Reports.tsx
│   │   ├── Settings.tsx
│   │   └── ...
│   ├── utils/             # Utility functions
│   │   └── cn.ts
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── supabase/
│   └── schema.sql         # Database schema
├── .env.example           # Environment variables template
├── vercel.json            # Vercel configuration
├── vite.config.ts         # Vite configuration
└── package.json           # Dependencies
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | System users (admins, managers, sales reps) |
| `leads` | Lead/contact information |
| `deals` | Sales pipeline/deals |
| `calls` | Call log entries |
| `tasks` | Task management |
| `activities` | Activity feed |
| `quotes` | Sales quotes |
| `invoices` | Invoice records |
| `team_members` | Team member profiles |
| `settings` | Application settings |
| `woocommerce_sync` | WooCommerce order sync |
| `whatsapp_messages` | WhatsApp message storage |

### Row Level Security (RLS)

All tables have RLS enabled with policies that allow full access for demonstration purposes. In production, you should restrict these policies based on user authentication.

---

## API Integration

### Supabase Client

The app uses `@supabase/supabase-js` for database operations. The client is configured in `src/lib/supabase.ts`.

### Key Functions

```typescript
// Database operations
db.getLeads()
db.createLead(lead)
db.updateLead(id, lead)
db.deleteLead(id)

db.getDeals()
db.createDeal(deal)
db.updateDeal(id, deal)
db.deleteDeal(id)

db.getCalls()
db.createCall(call)

db.getTasks()
db.createTask(task)
db.updateTask(id, task)
db.deleteTask(id)

db.getActivities()
db.createActivity(activity)

db.getQuotes()
db.createQuote(quote)

db.getInvoices()
db.createInvoice(invoice)

db.getSettings()
db.updateSetting(key, value)
```

### Real-time Subscriptions

```typescript
// Subscribe to changes
db.subscribeToTable('leads', (payload) => {
  console.log('Lead changed:', payload);
});
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Supabase account

### 1. Clone the Repository

```bash
git clone https://github.com/mannnnup-cyber/DHD-CRM-Saletrail.git
cd DHD-CRM-Saletrail
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Supabase

#### Option A: Use Existing Project

The app is already configured to use your Supabase project:
- URL: `https://vatsonbvjkyzxqrnderr.supabase.co`

#### Option B: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** in your Supabase dashboard
3. Copy and execute the contents of `supabase/schema.sql`
4. Update `.env.example` with your credentials

### 4. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your Supabase credentials
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 5. Run Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

### 6. Build for Production

```bash
pnpm build
```

---

## Features

### Dashboard
- Today's call statistics
- Active pipeline overview
- Revenue tracking (JMD)
- 14-day call volume chart
- Pipeline distribution pie chart
- Monthly leaderboard
- Recent activity feed

### Pipeline Management
- Visual pipeline with stages: New Lead → Consultation → Quote Sent → Design Review → In Production → Delivered
- Deal value tracking
- Expected close dates
- Lead association

### Lead Management
- Lead import from CSV
- Lead status tracking (new, contacted, qualified, converted, lost)
- Assignment to sales reps
- Notes and description

### Call Logging
- Manual call entry
- Call type (Incoming, Outgoing, WhatsApp)
- Duration tracking
- Contact association
- Call sync from external sources

### Task Management
- Task creation with due dates
- Priority levels (low, medium, high, urgent)
- Assignment to team members
- Completion tracking

### Reports
- Team performance metrics
- Conversion rates
- Revenue tracking

### Integrations

#### WooCommerce
- Sync orders from WooCommerce store
- Customer information import
- Order status tracking

#### WhatsApp
- WhatsApp message storage
- Message history
- Contact association

---

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your GitHub repository
4. Configure build settings:
   - Framework Preset: Vite
   - Build Command: `pnpm build`
   - Output Directory: `dist`
5. Add environment variables in Vercel project settings
6. Deploy

### GitHub Integration

The project is already connected to GitHub. Every push to the `master` branch will trigger a new deployment on Vercel (if configured).

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |

---

## Troubleshooting

### Build Errors

If you encounter build errors, try:

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Supabase Connection Issues

1. Verify your Supabase URL and anon key are correct
2. Check that RLS policies allow your operations
3. Ensure the database tables exist

### Authentication Issues

The demo version uses hardcoded credentials:
- Username: `manager`, Password: `manager123` (Manager)
- Username: `keisha`, Password: `keisha123` (Sales Rep)

### Port Already in Use

```bash
# Find and kill process on port 5173
lsof -i :5173
kill -9 <PID>
```

---

## Security Notes

1. **API Keys**: Never commit API keys to GitHub. Use environment variables.
2. **RLS Policies**: In production, implement proper Row Level Security policies.
3. **Authentication**: The demo uses simple username/password. Production should use Supabase Auth.
4. **Token Exposure**: If you exposed your GitHub token, revoke it immediately and create a new one.

---

## License

This project is proprietary software for Dirty Hand Designs.

---

## Support

For issues or questions, please contact the development team.

---

*Document generated: March 2026*
*Version: 1.0.0*
