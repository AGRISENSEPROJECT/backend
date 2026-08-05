# AgriSense Backend

NestJS + TypeORM + PostgreSQL + Redis API for the AgriSense Smart Agriculture Platform.

Multi-role platform covering farmers, suppliers, NGOs, government, and admins — with marketplace, payments, predictions, weather/IoT, cooperatives, and community.

## Stack

- NestJS 11, TypeORM, PostgreSQL
- Redis (OTP/refresh/blacklist + BullMQ queues)
- JWT auth + RBAC (`RolesGuard`)
- Brevo email, Flutterwave payments, OpenWeather (optional)
- Swagger at `/api/docs`

## Roles & access

| Role | Status after OTP | Notes |
|------|------------------|--------|
| `farmer` | `active` | Farms, predictions, cart/orders, community write |
| `supplier` | `pending` until admin approval | Products, order fulfillment, community read |
| `ngo` / `government` | `pending` until org approval | Programs, analytics, community write |
| `admin` | seeded only | Full platform admin |

## Quick start

```bash
cp .env.example .env
# fill DB, Redis, JWT, BREVO_API_KEY, optional Flutterwave/OpenWeather

docker-compose -f docker-compose.dev.yml up -d   # Postgres + Redis
npm install   # or yarn
node scripts/run-migration.js
node scripts/seed-admin.js
npx nest start --watch
```

- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`
- Default admin (from `.env`): `ADMIN_EMAIL` / `ADMIN_PASSWORD`

## Migrations & seed

```bash
npm run migrate          # runs all migrations/*.sql
npm run seed:admin       # creates/updates platform admin
```

Latest advanced schema: `migrations/012-add-advanced-features.sql` (weather, IoT, yield, cooperatives, reports, audit).

## Auth

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/verify-otp
POST /api/auth/resend-otp
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/profile
GET  /api/auth/google | /api/auth/facebook
POST /api/auth/google/verify-token
POST /api/auth/facebook/verify-token
```

Register body includes `role`: `farmer` | `supplier` | `ngo` | `government` (not `admin`).

## Admin

```
GET    /api/admin/users
GET    /api/admin/users/:id
PATCH  /api/admin/users/:id/status
PATCH  /api/admin/users/:id/role
GET    /api/admin/suppliers
POST   /api/admin/suppliers/:id/approve
POST   /api/admin/suppliers/:id/reject
GET    /api/admin/organizations
POST   /api/admin/organizations/:id/approve
POST   /api/admin/organizations/:id/reject
GET    /api/admin/stats
```

## Farms & predictions

```
POST /api/farm
GET  /api/farm
GET  /api/farm/:id
PATCH /api/farm/:id
DELETE /api/farm/:id

POST /api/predictions/run
GET  /api/predictions/dashboard
GET  /api/predictions/history
```

Farmers own farms; admins can access any farm.

## Suppliers & marketplace

```
GET/POST/PATCH /api/suppliers/profile
GET/POST/PATCH/DELETE /api/products
GET  /api/products/catalog          # public catalog for buyers

POST /api/cart/items
GET  /api/cart
DELETE /api/cart/items/:id

POST /api/orders
GET  /api/orders
GET  /api/orders/:id
PATCH /api/orders/:id/status        # supplier fulfillment

POST /api/payments/initiate         # Flutterwave
POST /api/payments/verify
POST /api/payments/webhook          # Flutterwave webhook
POST /api/payments/cod/confirm      # supplier confirms COD
```

## Notifications

In-app notifications are created for orders, approvals, weather/IoT alerts, etc. Every notification is also queued (BullMQ) for email delivery via Brevo.

```
GET  /api/notifications
GET  /api/notifications/unread-count
PATCH /api/notifications/:id/read
POST /api/notifications/read-all
```

## NGO / Government

```
GET/POST/PATCH /api/organizations/me
GET/POST /api/programs
POST /api/programs/:id/farmers
GET  /api/analytics/overview
```

## Community

```
POST /api/community/posts                 # farmer/ngo/gov/admin (+ tags)
GET  /api/community/posts                 # paginated: ?page&limit&tag&search
POST /api/community/posts/:id/like
POST /api/community/posts/:id/comment
POST /api/community/posts/:id/report
GET  /api/community/reports               # admin
PATCH /api/community/reports/:id          # admin moderate
PATCH /api/community/posts/:id/visibility # admin hide/unhide
```

Suppliers: read-only. Hidden posts are omitted for non-admins.

## Weather & IoT

```
POST /api/weather/alerts                  # admin/government
GET  /api/weather/alerts
GET  /api/weather/alerts/:id
POST /api/weather/alerts/sync             # admin — OpenWeather pull

POST /api/iot/sensors
GET  /api/iot/sensors
PATCH /api/iot/sensors/:id/status
POST /api/iot/readings
GET  /api/iot/sensors/:id/readings
```

Hourly cron syncs OpenWeather when `OPENWEATHER_API_KEY` is set. Out-of-range IoT readings create `iot_alert` notifications.

## Yield forecasting

```
POST /api/yield/forecasts
GET  /api/yield/forecasts
GET  /api/yield/forecasts/:id
PATCH /api/yield/forecasts/:id/status
```

Baseline model uses farm size × crop tons/ha (`baseline_v1`).

## Cooperatives

```
POST /api/cooperatives
GET  /api/cooperatives
GET  /api/cooperatives/:id
POST /api/cooperatives/:id/join
POST /api/cooperatives/:id/leave
POST /api/cooperatives/:id/members
PATCH /api/cooperatives/:id/members/:userId
DELETE /api/cooperatives/:id/members/:userId
```

## Audit logs

```
GET /api/audit/logs?page&limit&resource&actorId   # admin only
```

Written for admin user/supplier/org actions, weather alerts, IoT registration, yield forecasts, cooperatives, and community moderation.

## Background jobs

- Queue: `notification-emails` (BullMQ on Redis)
- Schedule: OpenWeather hourly sync (`@nestjs/schedule`)
- Configure Redis via `REDIS_HOST`/`REDIS_PORT` or `REDIS_URL`

## Environment

See `.env.example` for the full list. Key variables:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=...                 # or DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=...
JWT_REFRESH_SECRET=...
BREVO_API_KEY=...
FLW_PUBLIC_KEY=...
FLW_SECRET_KEY=...
FLW_WEBHOOK_HASH=...
OPENWEATHER_API_KEY=...          # optional
MODEL_API_URL=http://127.0.0.1:5000
ADMIN_EMAIL=admin@agrisense.com
ADMIN_PASSWORD=Admin123!
```

## Scripts

```bash
npm run start:dev
npx nest build && npm run start:prod
npm run migrate
npm run seed:admin
npm run lint
npm test
```

## License

UNLICENSED
