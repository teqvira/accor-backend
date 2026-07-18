# Project Structure

Feature-first Express + TypeScript backend. Each module owns its HTTP surface, validation, business logic, and data access. Third-party SDKs live under `infrastructure/`. Cross-cutting helpers live under `shared/`.

## Top-level layout

```
src/
  index.ts                 # process entry (listen, bootstrap)
  app.ts                   # Express app wiring (middleware, routes, errors)
  config/                  # env loading and validation
  database/                # pool + transaction helper
  infrastructure/          # third-party SDK clients only
  modules/                 # feature modules
  routes/                  # mounts all feature routers
  shared/                  # genuinely reused middleware, types, utils
```

## Request flow

```
HTTP request
  → routes/index.ts          (mount + rate limits)
  → module *.routes.ts       (auth, validate, wire handlers)
  → module *.controller.ts   (thin: parse input, call service, send response)
  → module *.service.ts      (business rules)
  → module *.repository.ts   (SQL / DB only)
  → PostgreSQL
```

Side effects (email, SMS, S3, payout providers) are called from services (or payout providers), never from controllers or repositories.

## Dependency direction

```
Controller → Service → Repository → Database
                ↓
         infrastructure (SDK clients)
                ↓
            shared (utils / errors / response)
```

Rules:

- Controllers never import repositories.
- Controllers never contain business rules.
- Repositories never contain business rules.
- Repositories never call external APIs.
- Feature modules may import `infrastructure/` and `shared/`.
- `infrastructure/` must not depend on feature modules (payout providers stay inside `withdrawals` for that reason — see below).

## Module layout

Prefer a **flat module root** when there is only one file of a given kind:

```
modules/products/
  products.controller.ts
  products.service.ts
  product.repository.ts
  products.routes.ts
  products.validator.ts
  products.types.ts
  products.constants.ts
  index.ts                 # public exports for other modules / route mount
```

Keep a subfolder only when there are **multiple** files of that kind, or a clear boundary:

| Module        | Kept folders                         | Why                                      |
|---------------|--------------------------------------|------------------------------------------|
| `auth`        | `repositories/`                      | multiple repositories                    |
| `qr`          | `constants/`, `repositories/`, `services/`, `utils/` | multiple files each          |
| `withdrawals` | `controllers/`, `repositories/`, `routes/`, `providers/` | multiple + provider isolation |

### Naming

- Folders: plural feature names (`products`, `users`, `withdrawals`).
- Files: kebab-case (`file-upload.routes.ts`, `async-handler.ts`).
- Role suffixes: `.controller`, `.service`, `.repository`, `.routes`, `.validator`, `.types`, `.constants`, `.middleware`, `.provider`, `.client`, `.util`.

### Module public API (`index.ts`)

Each module exposes a small surface used by `routes/index.ts` and peer modules (routes, selected services/repos/types). Prefer importing from the module root for cross-module use; use deep imports only for internal wiring inside the same module.

## Infrastructure

```
infrastructure/
  email/email.client.ts      # SMTP / OTP email (nodemailer)
  sms/sms.client.ts          # SMS OTP stub / provider hook
  s3/
    s3.client.ts             # AWS S3 SDK client
    s3.object-url.ts         # generic object URL builder
```

Put **SDK wiring** here. Keep **business decisions** in feature services.

### Payout providers (Razorpay / Cashfree / mock)

These live in `modules/withdrawals/providers/`, not `infrastructure/`.

They call the withdrawals payout-profile repository after provider API calls. Moving them under `infrastructure/` would create a circular dependency (`withdrawals` → `infrastructure` → `withdrawals`). Isolating them in `providers/` still separates SDK/provider code from `withdrawal.service.ts` without changing the withdrawal flow.

## Shared

```
shared/
  middleware/    # async-handler, error-handler, validate
  types/         # API response shapes
  utils/         # errors, response helpers, params, postgres, bearer-token
```

Only code used by **more than one module** belongs here. Feature-specific helpers stay in that module (e.g. QR label utils, filename sanitization).

## Where to put new files

| Kind of change                         | Location                                      |
|----------------------------------------|-----------------------------------------------|
| New HTTP endpoint for existing feature | That module’s `*.routes.ts` + controller/service |
| New feature                            | New folder under `modules/<feature>/`         |
| New DB table access                    | `*.repository.ts` in the owning module        |
| New Zod schemas                        | Module `*.validator.ts` next to routes        |
| New email/SMS/S3/payment SDK           | `infrastructure/<provider>/`                  |
| Reusable error/response helper         | `shared/` only if used by 2+ modules          |
| Env var                                | `config/env.ts`                               |

## How to add a new feature

1. Create `src/modules/<feature>/` with a flat layout (controller, service, repository if needed, routes, validator, types).
2. Export the router (and any peer-needed types/services) from `index.ts`.
3. Mount the router in `src/routes/index.ts`.
4. Keep the controller thin; put rules in the service; put SQL in the repository.
5. If you need a third-party SDK, add a client under `infrastructure/` and call it from the service.

Example skeleton:

```
modules/notifications/
  notifications.controller.ts
  notifications.service.ts
  notifications.routes.ts
  notifications.validator.ts
  notifications.types.ts
  index.ts
```

## Existing modules

| Module         | Responsibility                                      |
|----------------|-----------------------------------------------------|
| `auth`         | Login, tokens, OTP, roles, auth middleware          |
| `users`        | User admin CRUD                                     |
| `products`     | Product catalog                                     |
| `qr`           | QR batch generation, export, labels                 |
| `redemption`   | Scan / redeem QR codes                              |
| `rewards`      | Reward ledger                                       |
| `transactions` | Redemption transaction history                      |
| `wallet`       | Wallet balance and ledger                           |
| `withdrawals`  | Payout profiles, withdrawals, provider webhooks     |
| `file-upload`  | Direct upload + presigned product image URLs        |

## Out of scope for structure alone

SQL migrations live in `sql/`. Runtime config is `.env` (see `.env.example`). Do not invent new architectural layers (use-cases, DI containers, CQRS) unless the team explicitly adopts them.
