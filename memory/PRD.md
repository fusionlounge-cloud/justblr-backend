# Justblr Matrix - Product Requirements Document

## Original Problem Statement
Voice-first mobile productivity application ("Justblr Matrix assistant") with central dashboard, reminders, task delegation, and web dashboard.

## Core Architecture
- **Mobile App**: Expo React Native (v1.8.0, versionCode 46)
- **Web Dashboard**: Static HTML/JS (`/app/backend/dashboard.html`) served by FastAPI at `/api/dashboard`
- **Backend**: FastAPI (`/app/backend/server.py`) on Render
- **Database**: MongoDB Atlas

## Completed Features
- [x] Alarm notifications fixed (P0) — cancelAllScheduledNotificationsAsync removed
- [x] Continuous alarm sound — alarm.wav loops with vibration until DISMISS
- [x] Edited reminders get alarms
- [x] "STOP ALARM" button on notifications
- [x] Reminders sorted newest first
- [x] Home screen launcher intent
- [x] WhatsApp/WA Business — expo-intent-launcher with componentName (v46)
- [x] Web dashboard contact picker for Employee form (v46)
- [x] Web contacts merged from synced + reminder + employee data (v46)
- [x] Task Delegation section moved before View All Reminders
- [x] Compact 5-icon grid layout
- [x] Email+PIN auth, Delete account compliance, Device ID recovery
- [x] **Web Dashboard Contact Auto-Discovery (Mar 28, 2026)** — Contacts now auto-load from mobile device even when web user has different device_id. Added `/api/sync/contact-sources` endpoint and smart fallback logic.
- [x] **Contact Count Indicator** — Delegation tab shows "Contacts loaded: X" banner with source info
- [x] **Dynamic Dashboard Serving** — `/api/dashboard` now reads HTML fresh from disk (no restart needed for HTML changes)
- [x] **Dynamic API_URL** — Dashboard uses `window.location.origin + '/api'` instead of hardcoded Render URL

## Backlog
- [ ] Push Notifications for Delegated Tasks
- [ ] Twilio WhatsApp/SMS automation
- [ ] Google Assistant Voice Commands
- [ ] iOS build

## Key API Endpoints
- `GET /api/dashboard` — Serves the web dashboard HTML
- `GET /api/version` — Returns version info
- `GET /api/sync/contact-sources` — Lists all device_ids that have synced contacts (with counts)
- `GET /api/sync/contacts/{device_id}` — Returns contacts for a device
- `POST /api/sync/contacts` — Mobile app pushing contacts to backend
- `POST /api/auth/register` / `POST /api/auth/login` — Email+PIN auth
- `POST /api/employees` / `GET /api/employees` — Employee CRUD
- `POST /api/tasks` / `GET /api/tasks` — Task CRUD

## Critical Notes
- DO NOT run pip freeze > requirements.txt
- DO NOT add cancelAllScheduledNotificationsAsync()
- DO NOT touch device ID generation logic
- Web dashboard changes need GitHub push for Render deployment
- Backend lives on Render — changes in container only work locally until pushed
