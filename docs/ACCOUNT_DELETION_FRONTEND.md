# Account Deletion — Frontend Integration Guide

Soft-delete only: user data is kept, login is blocked after deletion is applied.

| Channel | Behaviour |
|---------|-----------|
| **Mobile app** | Immediate soft-delete |
| **Public website** | 4-day hold, then soft-delete |
| **Admin panel** | See requests, cancel hold, or process early |

Base URL: `https://api.accorlubes.com/api` (or your env host + `/api`).

---

## 1. Mobile app (already integrated)

**Endpoint:** `DELETE /users/me`  
**Auth:** Bearer access token (logged-in partner)

```http
DELETE /api/users/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{}
```

Optional body: `{ "reason": "..." }`

**Success (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully",
  "data": {
    "deleted": true,
    "deletedAt": "2026-09-12T12:00:00.000Z",
    "holdDays": 0,
    "request": { "...": "..." }
  }
}
```

**App UX flow:**
1. Profile → **Delete Account**
2. Confirm dialog
3. Call API
4. Clear local session / tokens
5. Navigate to login / onboarding  
User cannot log in again after this.

---

## 2. Public website flow

No login required. Ownership is proven with OTP on the registered mobile.

### Step A — Send OTP

```http
POST /api/account-deletion/send-otp
Content-Type: application/json

{ "mobileNumber": "9876543210" }
```

**Success (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobileNumber": "+91 ******3210",
    "expiresIn": 600,
    "holdDays": 4
  }
}
```

**Common errors:**
| Case | Meaning |
|------|---------|
| 404 | No partner account for that mobile |
| 400 | Already deleted / deactivated, or OTP cooldown |
| 409 | A deletion request is already pending |

### Step B — Confirm (schedule deletion)

```http
POST /api/account-deletion/confirm
Content-Type: application/json

{
  "mobileNumber": "9876543210",
  "otp": "123456",
  "reason": "Optional reason"
}
```

**Success (200):**
```json
{
  "success": true,
  "message": "Account deletion scheduled successfully",
  "data": {
    "deleted": false,
    "holdDays": 4,
    "scheduledFor": "2026-09-16T12:00:00.000Z",
    "message": "Your account deletion is scheduled. The account will be deactivated in 4 days.",
    "request": {
      "id": "uuid",
      "status": "pending",
      "source": "website",
      "scheduledFor": "2026-09-16T12:00:00.000Z"
    }
  }
}
```

**Website UX flow:**
1. Page: “Delete Accor account”
2. User enters **10-digit mobile** → **Send OTP**
3. User enters OTP (+ optional reason) → **Confirm**
4. Show success: *“Deletion scheduled. Account stays active for 4 days, then it will be deactivated.”*
5. Do **not** log the user out of the app during the hold (they can still use the app until `scheduledFor`)

**After 4 days:** backend job soft-deletes automatically. Login then fails with account deleted / deactivated.

```
┌─────────────┐     send-otp      ┌─────────────┐
│  Website UI │ ───────────────►  │   Backend   │
│  mobile +   │ ◄─── OTP SMS ───  │             │
│  OTP form   │     confirm       │  pending    │
│             │ ───────────────►  │  + 4 days   │
└─────────────┘                   └──────┬──────┘
                                         │ after scheduledFor
                                         ▼
                                   soft-delete
                                   (can't login)
```

---

## 3. Admin panel flow

**Auth:** Admin / Super Admin Bearer token on all routes below.

### List deletion requests

```http
GET /api/account-deletion?page=1&limit=20&status=pending
Authorization: Bearer <adminAccessToken>
```

Query params (all optional):
- `page`, `limit`
- `status`: `pending` | `completed` | `cancelled`
- `source`: `app` | `website` | `admin`
- `search`: name / email / mobile

**Success data shape:**
```json
{
  "items": [
    {
      "id": "uuid",
      "userId": "uuid",
      "mobileNumber": "9876543210",
      "source": "website",
      "status": "pending",
      "reason": "...",
      "requestedAt": "...",
      "scheduledFor": "...",
      "processedAt": null,
      "cancelledAt": null,
      "user": {
        "name": "...",
        "email": "...",
        "isActive": true,
        "deletedAt": null
      }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### Get one request

```http
GET /api/account-deletion/:id
Authorization: Bearer <adminAccessToken>
```

### Cancel pending hold (user keeps account)

```http
POST /api/account-deletion/:id/cancel
Authorization: Bearer <adminAccessToken>
```

Use when support decides the request should not proceed.

### Process now (soft-delete immediately)

```http
POST /api/account-deletion/:id/process
Authorization: Bearer <adminAccessToken>
```

Skips the remaining wait; same soft-delete as mobile / job.

**Admin UX suggestions:**
1. Menu / tab: **Account deletion requests** (filter default `status=pending`)
2. Row actions for `pending`:
   - **Cancel** → call `/cancel`
   - **Delete now** → confirm → call `/process`
3. Show `source` badge (`app` / `website`) and `scheduledFor` countdown for website holds
4. Optional: listen to in-app notification type `account_deletion` (admins are pushed when app deletes or website schedules)

```
Website confirm ──► pending request ──► Admin list
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
         Cancel      Process now    Wait 4 days
      (stay active)  (delete now)   (auto job)
```

---

## 4. Status meanings

| Status | Meaning |
|--------|---------|
| `pending` | Website hold; user still active |
| `completed` | Soft-deleted (app, admin process, or job) |
| `cancelled` | Admin cancelled; user stays active |

Soft-delete means: `is_active = false`, `deleted_at` set, tokens revoked. Data remains in DB.

---

## 5. Frontend checklist

### Website
- [ ] Mobile input (10-digit Indian) + Send OTP
- [ ] OTP input + Confirm
- [ ] Success copy mentioning **4-day** hold
- [ ] Error toasts for 404 / 409 / invalid OTP
- [ ] No auth header required

### Admin
- [ ] List with status / source filters
- [ ] Cancel + Process actions on pending rows
- [ ] Show partner name, mobile, scheduled date
- [ ] Use admin JWT

### Mobile
- [x] Profile → Delete Account → `DELETE /users/me` → clear session
