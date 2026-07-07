# EcoSphere Backend — Node/Express + PostgreSQL

Backend scaffold for the EcoSphere ESG Management Platform (Oodu Hackathon).
Verified: `npm install` succeeds, every route file passes `node --check`, and
`app.js` loads all 24 route modules with no runtime errors (tested without a
live DB connection).

## 1. Setup (5 minutes)

```bash
npm install
cp .env.example .env          # edit DB_USER / DB_PASSWORD / JWT_SECRET
createdb ecosphere            # or use pgAdmin/psql to create the DB
psql -U postgres -d ecosphere -f src/db/schema.sql
psql -U postgres -d ecosphere -f src/db/seed.sql   # optional sample data
npm run dev                   # nodemon, restarts on file change
```

Health check: `GET http://localhost:4000/health`

**Before using the seed data:** regenerate the admin password hash —
`node -e "console.log(require('bcryptjs').hashSync('YourPassword123',10))"`
and paste it into `seed.sql`, or just register a fresh user via `/api/auth/register`.

## 2. Folder structure

```
src/
  app.js, server.js        Express app + entrypoint
  config/db.js             pg Pool
  db/schema.sql             full Postgres schema
  db/seed.sql               sample master data
  middleware/               auth (JWT), validate, centralized errorHandler
  utils/                    ApiError, asyncHandler, crudFactory (generic CRUD)
  services/                 business logic: carbon calc, badge award, score aggregation, notifications
  modules/<name>/routes.js  one router per resource, mounted in app.js
```

Every table without special business logic (departments, categories, emission
factors, products, environmental goals, ESG policies, badges, rewards, CSR
activities, challenges, audits, diversity metrics, training completions) uses
`utils/crudFactory.js` — a generic list/get/create/update/delete controller —
so adding a new master-data endpoint is ~10 lines, not 80.

Everything with a business rule from Section 8 of the problem statement gets
its own controller:
- `carbonTransactions` — auto emission calculation (qty × emission factor)
- `employeeParticipation` / `challengeParticipation` — evidence requirement
  enforcement, XP award, badge auto-award trigger
- `complianceIssues` — owner + due date required, `/flag-overdue` endpoint
- `rewardRedemptions` — transactional stock/points deduction (row locks, no race conditions)
- `departmentScores` — weighted ESG score aggregation + `/rankings` leaderboard
- `reports` — environmental / social / governance / esg-summary / custom builder

## 3. Auth

JWT-based. `POST /api/auth/register` → `POST /api/auth/login` → use the
returned `token` as `Authorization: Bearer <token>` on every other request.
Roles: `ADMIN`, `MANAGER`, `EMPLOYEE`, `AUDITOR` — enforced per-route via the
`authorize(...)` middleware.

## 4. Key endpoints to demo

| Feature | Endpoint |
|---|---|
| Login | `POST /api/auth/login` |
| Log carbon transaction | `POST /api/carbon-transactions` |
| Approve CSR participation (evidence-gated) | `PATCH /api/employee-participation/:id/decision` |
| Approve challenge (XP + badge auto-award) | `PATCH /api/challenge-participation/:id/decision` |
| Redeem reward | `POST /api/reward-redemptions` |
| Recompute department ESG score | `POST /api/department-scores/recompute` |
| Department leaderboard | `GET /api/department-scores/rankings` |
| Flag overdue compliance issues | `POST /api/compliance-issues/flag-overdue` |
| ESG summary report | `GET /api/reports/esg-summary` |
| Toggle business rules | `GET`/`PUT /api/esg-config` |

## 5. What's stubbed / left for your team to finish

- Email dispatch in `notificationService.js` (in-app notifications work fully; email is a TODO comment — plug in nodemailer if time allows, not required for judging)
- Scoring formula in `scoreAggregationService.js` is intentionally simple/explainable — tune the constants (`BASELINE_CO2`, `SOCIAL_TARGET`) or swap the formula; the weighting + upsert plumbing stays the same
- Frontend (not included — see the build plan doc for a suggested split)
- Cron scheduling for `/flag-overdue` and periodic score recomputation (currently manual-trigger endpoints — wire up `node-cron` if time allows)

See **`ECOSPHERE_BUILD_PLAN.md`** for the full team task split and Cursor prompts to build the remaining pieces fast.
