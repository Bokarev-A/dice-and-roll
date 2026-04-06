# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dice & Roll** is a Telegram Mini App for managing a tabletop RPG club — campaigns, game sessions, signups, attendance, credits, and shop orders. It is a monorepo with a FastAPI backend and a React + Vite frontend.

## Development Commands

### Backend (`backend/`)
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload          # Dev server on :8000
python create_tables.py                # Initialize DB tables (first run)
alembic upgrade head                   # Apply migrations
alembic revision --autogenerate -m "Description"  # Generate migration
```

### Frontend (`frontend/`)
```bash
npm install
npm run dev      # Vite dev server on :5173 (proxies /api → :8000)
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Database
```bash
docker-compose up -d   # Start PostgreSQL (from backend/)
```

There are no automated tests. Use `SKIP_TG_VALIDATION=true` in `.env` to bypass Telegram signature verification during local development.

## Architecture

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app setup, lifespan hook (starts APScheduler), mounts static frontend
- **`config.py`** — Pydantic `BaseSettings` reading from `.env`
- **`database.py`** — Async SQLAlchemy engine + `AsyncSession` factory
- **`api/`** — 10 route modules, all prefixed `/api/`: `users`, `campaigns`, `sessions`, `signups`, `attendance`, `orders`, `credits`, `products`, `rooms`, `calendar`
- **`models/`** — SQLAlchemy ORM models (11 tables)
- **`schemas/`** — Pydantic request/response schemas (one file per resource)
- **`services/`** — Business logic: `CreditService`, `OrderService`, `SignupService`, `AttendanceService`, `NotificationService`, `SchedulerService`
- **`bot/`** — Telegram Bot API notification sender
- **`utils/`** — Telegram `initData` HMAC-SHA256 validation + auth dependencies

### Frontend (`frontend/src/`)

- **`api/`** — Single Axios instance (`api.ts`) with `X-Init-Data` header interceptor; per-resource wrapper modules (e.g. `campaigns.ts`, `orders.ts`)
- **`store/`** — Zustand: `useAuthStore` (current user), `useUIStore` (UI state)
- **`hooks/useTelegram.ts`** — Accesses `window.Telegram.WebApp`
- **`pages/`** — Role-gated pages: Player (Home, Catalog, Shop, Profile), GM (GMCampaigns, GMCampaignDetail, GMSessionDetail, Attendance), Admin (Orders, Users, Unpaid)
- **`components/`** — Organized by domain: Campaign, Credit, Layout, Order, Session, UI

### Auth Flow

1. Telegram WebApp opens the Mini App and provides `initData`
2. Frontend sends `POST /api/users/me` with `X-Init-Data: <initData>`
3. Backend validates HMAC-SHA256 signature using `BOT_TOKEN`, finds or creates the user
4. `useAuthStore` stores the authenticated user

All API endpoints require the `X-Init-Data` header. Role-based access uses FastAPI dependencies `require_gm` and `require_admin`.

### Domain Model

| Concept | Key models |
|---|---|
| Users & roles | `User` (roles: player / gm / admin) |
| Content | `Campaign`, `GameSession`, `Room`, `CampaignMember` |
| Engagement | `Signup` (confirmed / waitlist / offered / cancelled), `Attendance` |
| Credits | `Product`, `Order`, `CreditBatch` (credit / rental / gm_reward), `LedgerEntry` |

### Background Jobs (APScheduler)

Configured in `SchedulerService`, started at app startup:
- Every 10 min: expire old orders, auto-approve timed-out signup offers
- Every 15 min: send session reminder notifications
- Daily 3 AM: expire credit batches, send expiry alerts
- Daily 9 AM: remind GMs to mark attendance
- Daily 10 AM: warn players about credits expiring in 7 days

### Key Configuration (`.env` in `backend/`)

```
DATABASE_URL=postgresql+asyncpg://...
BOT_TOKEN=
INITIAL_ADMIN_TELEGRAM_ID=
CLUB_TIMEZONE=Europe/Moscow
SKIP_TG_VALIDATION=false          # Set true for local dev
OFFERED_TIMEOUT_HOURS=24
ORDER_EXPIRY_HOURS=24
REMINDER_HOURS_BEFORE=24,2
ATTENDANCE_WINDOW_HOURS=48
```

### Deployment

Vite builds the frontend to `frontend/dist/`. FastAPI serves these static files and handles SPA routing via a catch-all route that returns `index.html` for non-`/api` paths.
