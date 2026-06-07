# ScholarTrack — Academic Management API

A NestJS REST API for managing courses, students, teachers, grades, and attendance in an academic institution.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Auth | Better Auth (session cookies) |
| Validation | class-validator + class-transformer |
| Tests | Jest (unit + integration) |
| API Docs | Swagger / OpenAPI |

---

## Setup

### Prerequisites

- Docker + Docker Compose

### Run with Docker (recommended)

```bash
# Copy environment file
cp .env.example .env
# Edit BETTER_AUTH_SECRET with a random string (required in production)

# Build and start everything (app + PostgreSQL)
docker compose up -d --build

# Run Prisma migrations
docker compose exec app npx prisma migrate deploy

# (Optional) Seed a first admin account
docker compose exec app npx prisma db seed
```

The API is available at **http://localhost:3000**.  
Swagger UI is at **http://localhost:3000/api/docs**.

### Run without Docker

```bash
# 1. Install dependencies
npm install

# 2. Start a PostgreSQL instance and fill in DATABASE_URL in .env
cp .env.example .env

# 3. Run migrations
npx prisma migrate deploy

# 4. Start in watch mode
npm run start:dev
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start in watch mode (auto-reload) |
| `npm run start:prod` | Start compiled production build |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test` | Run unit + integration tests |
| `npm run test:cov` | Run tests with coverage report |
| `npm run lint` | Lint and auto-fix with ESLint |
| `npm run format` | Format with Prettier |
| `npm run docker:up` | Start containers in background |
| `npm run docker:down` | Stop and remove containers |
| `npm run docker:logs` | Follow app container logs |
| `npm run docker:rebuild` | Rebuild image and restart |
| `npm run docker:shell` | Open a shell inside the app container |
| `npm run docker:prisma` | Run Prisma CLI inside the container |

---

## Modules

### `AuthModule`
Session-based authentication via Better Auth. Exposes `/api/auth/**` routes (sign-in, sign-out, session). All other routes require an active session.

### `UsersModule`
Admin-only CRUD for user accounts (`STUDENT`, `TEACHER`, `ADMIN`). New accounts are created via Better Auth then promoted to the requested role.  
Routes: `POST /admin/users`, `GET /admin/users`, `GET /admin/users/:id`

### `CoursesModule`
Course catalogue with role-based access. Teachers create and own courses; students browse. Supports evaluation weight configuration (must sum to 1) and capacity enforcement via a dedicated pipe.  
Routes: `GET /courses`, `POST /courses`, `PATCH /courses/:id`, `DELETE /courses/:id`, `PUT /courses/:id/weights`

### `EnrollmentsModule`
Student enrollment with capacity checks. The `CourseCapacityPipe` rejects over-capacity requests before the controller runs.  
Routes: `POST /courses/:id/enroll`, `DELETE /courses/:id/enroll`, `GET /me/enrollments`

### `GradesModule`
Grade recording, weighted average computation, and bulk CSV import (all-or-nothing). Each evaluation type is configured per course; the average normalises over graded types only and flags `isPartial: true` when some types are missing.  
Routes: `POST /grades`, `GET /grades`, `PATCH /grades/:id`, `DELETE /grades/:id`, `GET /grades/average`, `POST /grades/import`

### `AttendancesModule`
Class session management and attendance recording (bulk upsert per session). Computes per-student attendance rates and flags students as `atRisk` when their absence rate exceeds the configurable threshold.  
Routes: `POST /courses/:courseId/sessions`, `GET /courses/:courseId/sessions`, `GET /courses/:courseId/attendance-rate`, `POST /sessions/:sessionId/attendances`

### `AdminModule`
Reporting and bulk operations for administrators.
- `GET /admin/stats?semester=` — aggregated semester statistics (courses, students, grades, atRisk count)
- `GET /admin/export?semester=` — semester results as a downloadable CSV
- `POST /admin/import/enrollments` — bulk enrollment import from CSV (duplicates skipped, capacity enforced, per-row error reporting)

### `RateLimitModule`
Manual sliding-window rate limiter applied globally. Identifies clients by authenticated user ID or IP address. Returns `429 Too Many Requests` with a `Retry-After` header when the threshold is exceeded.

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | — | Secret for signing sessions (change in production) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Public URL of the API |
| `PORT` | `3000` | HTTP port |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per client |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds |
| `AT_RISK_THRESHOLD` | `0.20` | Absence rate above which a student is flagged atRisk |

---

## API Documentation

Interactive Swagger UI: **http://localhost:3000/api/docs**

All routes require Bearer authentication. Use the **Authorize** button in Swagger and paste your session token, or authenticate via `POST /api/auth/sign-in/email` first.

---

## Tests

```bash
# Inside Docker (recommended — matches the runtime environment)
docker compose exec app npx jest --no-coverage
docker compose exec app npx jest --coverage

# Or directly on the host
npm run test
npm run test:cov
```

168 tests across 18 suites — 84.75% statement coverage.
