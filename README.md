# Adhunik MES Intelligence CRM

Production-grade MES tender CRM for Adhunik Switchgears, built with Next.js 15, TypeScript, Tailwind CSS, React Query, Zustand, and Supabase.

## Features

- Supabase Auth with ADMIN, MANAGER, and USER role enforcement.
- Protected App Router layout with RLS-backed tender visibility.
- Tender data grid with search, source/status filters, sticky header, status updates, assignment actions, and CSV export.
- XLSX/XLS/CSV import with preview, duplicate tender detection, upload history, and validation.
- Manual tender entry into the same `tenders` table using `source_type`.
- Lead assignment history, follow-up widgets, analytics charts, contractor intelligence, and product intelligence.
- Supabase Storage bucket plan for `/boq`, `/aoc`, `/tender-documents`, and `/quotations`.
- Phase 2 AI placeholders for lead scoring and tender summaries.
- Vercel and GitHub Actions deployment files.

## Folder Structure

```txt
app/                  Next.js App Router routes and server actions
components/           UI, CRM screens, dashboards, imports, analytics
lib/                  Supabase clients, auth helpers, validation, data access
store/                Zustand UI store
supabase/             Schema, RLS policies, storage policies, seed data
.github/workflows/    CI workflow
```

## Setup

1. Create a Supabase Cloud project.
2. Run `supabase/schema.sql`, then `supabase/quotation_management.sql`, in the Supabase SQL editor.
3. Create the first Auth user in Supabase, then insert a matching admin profile:

```sql
insert into public.profiles (id, full_name, email, role, is_active)
values ('AUTH_USER_UUID', 'Adhunik Admin', 'admin@adhunik.com', 'ADMIN', true);
```

4. Copy `.env.example` to `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Install and run:

```bash
npm install
npm run dev
```

## Deployment

- Push this repository to GitHub.
- Import the repo into Vercel.
- Add the environment variables from `.env.example`.
- Keep Supabase RLS enabled; privileged user creation uses `SUPABASE_SERVICE_ROLE_KEY` only in server actions.

## Import Columns

Supported headers: Tender ID, Organisation Chain, GE, CWE, Tender Ref No, Tender Title, Contract Date, Bid Number, Bidder Name, Currency, Awarded Value, Contact Number 1, Contact Number 2, Contact Number 3, Address, Make, Email, BOQ Attachment, AOC Attachment, Tender Document Attachment, Our Value (Adhunik).
