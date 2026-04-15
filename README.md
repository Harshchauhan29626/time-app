# TimeFlow

TimeFlow is a full-stack employee time-tracking MVP with role-based access, live attendance tracking, timesheets, leave management, schedules, holidays, team management, activity feed, and company settings.

## Tech Stack
- Frontend: React + Vite + React Router + Tailwind + Axios + Zustand + Recharts
- Backend: Node.js + Express + Prisma ORM + Zod
- Database: MySQL
- Auth: JWT access token + refresh token rotation table

## Monorepo Structure
```
.
├── backend/
│   ├── prisma/
│   └── src/
└── frontend/
    └── src/
```

## Prerequisites
- Node.js 20+
- npm 10+
- MySQL 8+

## Setup
1. Install dependencies:
```bash
npm install
npm run install:all
```

2. Configure env files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Create database (example):
```sql
CREATE DATABASE timeflow;
```

4. Run Prisma migration + generate client:
```bash
npm run prisma:generate -w backend
npm run prisma:migrate -w backend -- --name init
```

5. Seed demo data:
```bash
npm run seed -w backend
```

## Run
Backend:
```bash
npm run dev -w backend
```
Frontend:
```bash
npm run dev -w frontend
```

Or both from root:
```bash
npm run dev
```

## Lint
```bash
npm run lint
```

## Demo Credentials
- Admin: `admin@timeflow.dev` / `Password123!`
- Manager: `manager@timeflow.dev` / `Password123!`
- Employee: `evan@timeflow.dev` / `Password123!`

## Implemented Endpoints
- Auth: register, login, refresh, logout, me profile
- Dashboard summary for day/week/month
- Time tracking (clock-in/out, break start/end, current)
- Paginated timesheets with range filters
- Time off types + request + status updates
- Work schedule CRUD
- Holiday CRUD
- Team list/create/update
- Activities feed
- Settings load/update

## Notes / TODOs
- Add persistent frontend token storage strategy (e.g. secure httpOnly cookie flow)
- Add stricter manager team-scoping rules (currently company-scoped for manager role)
- Add richer table UX sorting/search/export
- Add automated backend tests
