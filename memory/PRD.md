# Justblr Matrix - Product Requirements Document

## Original Problem Statement
Voice-first mobile productivity application ("Justblr Matrix assistant") with central dashboard, reminders, task delegation, and web dashboard.

## Core Architecture
- **Mobile App**: Expo React Native (v1.8.0, versionCode 46)
- **Web Dashboard**: Static HTML/JS deployed as `justblr-web` on Render (separate repo: `fusionlounge-cloud/justblr-web`)
- **Backend**: FastAPI (`/app/backend/server.py`) deployed as `justblr-backend` on Render (separate repo)
- **Database**: MongoDB Atlas

## Deployment Notes
- TWO separate Render services from TWO separate GitHub repos
- `justblr-web` (Static Site) → `fusionlounge-cloud/justblr-web` repo → serves web dashboard
- `justblr-backend` (Web Service) → separate repo → serves API
- Emergent "Save to Github" only pushes to the Emergent repo, NOT to `justblr-web` repo
- Web dashboard changes must be manually copied to `fusionlounge-cloud/justblr-web` and deployed via Render Manual Deploy

## Completed Features
- [x] Alarm notifications fixed (P0)
- [x] Continuous alarm sound with vibration
- [x] Edited reminders get alarms
- [x] "STOP ALARM" button on notifications
- [x] Reminders sorted newest first
- [x] Home screen launcher intent
- [x] WhatsApp/WA Business via expo-intent-launcher (v46)
- [x] Email+PIN auth, Delete account, Device ID recovery
- [x] Task Delegation section moved before View All Reminders
- [x] Compact 5-icon grid layout
- [x] **Web Dashboard Contact Picker for Task Delegation (Mar 28, 2026)** — Employee Add modal now has contact search dropdown with auto-fill phone
- [x] **Contact Auto-Discovery** — `loadContacts()` auto-discovers contacts from mobile device even when web user has different device_id via `/api/sync/contact-sources`
- [x] **Contact Count Indicator** — Delegation tab shows "Contacts loaded: 13,832" banner
- [x] **Backend contact-sources endpoint** — `GET /api/sync/contact-sources` lists all device_ids with contact counts

## Backlog
- [ ] Push Notifications for Delegated Tasks (P1)
- [ ] Twilio WhatsApp/SMS automation (P1, needs credentials)
- [ ] Google Assistant Voice Commands (P2)
- [ ] iOS version build (P2)

## Key API Endpoints
- `GET /api/sync/contact-sources` — Lists device_ids with synced contact counts
- `GET /api/sync/contacts/{device_id}` — Returns contacts for a device
- `POST /api/sync/contacts` — Mobile app pushing contacts
- `GET /api/dashboard` — Serves dashboard HTML (backend version)
- `POST /api/auth/register` / `POST /api/auth/login` — Email+PIN auth
- `POST /api/employees` / `GET /api/employees` — Employee CRUD
- `POST /api/tasks` / `GET /api/tasks` — Task CRUD

## Critical Notes
- DO NOT run pip freeze > requirements.txt
- DO NOT add cancelAllScheduledNotificationsAsync()
- DO NOT touch device ID generation logic
- Web dashboard (`justblr-web`) is a SEPARATE GitHub repo from the Emergent workspace
- Always manually deploy on Render after pushing changes
