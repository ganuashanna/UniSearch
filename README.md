# UniSearch

UniSearch is a student search and records portal for Dr. Babasaheb Ambedkar Marathwada University. It includes a public search experience, CSV export, and an admin dashboard for CSV imports and semester record management.

## Tech Stack
- Frontend: HTML, CSS, Vanilla JavaScript, Tailwind CSS, Font Awesome
- Backend: Node.js serverless functions on Vercel
- Database: Supabase Postgres via the Supabase REST API
- Exports: jsPDF and SheetJS

## Features
- Student search with autocomplete
- Filters by status, department, and admission year
- Table and grid result views
- Student profile modal with semester history
- CSV, PDF, and Excel exports
- Admin login, CSV import, and semester result updates

## Local Development
1. Install the Vercel CLI if needed: `npm i -g vercel`
2. Add the required environment variables in `.env.local` or in your Vercel project
3. Run locally with `vercel dev`

Required environment variables:

```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=any_32_character_random_string
```

## Admin Access
Set `ADMIN_PASSWORD` in your environment. The fallback default is `admin123`, but you should change it in production.

## Deployment
Deployment and database setup steps are in [DEPLOYMENT.md](./DEPLOYMENT.md).
