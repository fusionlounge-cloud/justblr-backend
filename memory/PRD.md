# Justblr Matrix - Product Requirements Document

## Original Problem Statement
Voice-first mobile productivity application ("Justblr Matrix assistant") with central dashboard, reminders, task delegation, and web dashboard.

## Core Architecture
- **Mobile App**: Expo React Native (v1.8.0, versionCode 54)
- **Web Dashboard**: Static HTML/JS deployed as `justblr-web` on Render (repo: `fusionlounge-cloud/justblr-web`)
- **Backend**: FastAPI (`/app/backend/server.py`) deployed as `justblr-backend` on Render
- **Database**: MongoDB Atlas

## Completed Features
- [x] Alarm notifications with continuous sound
- [x] Home screen launcher intent
- [x] WhatsApp/WA Business via expo-intent-launcher
- [x] Email+PIN auth, Delete account, Device ID recovery
- [x] Web Dashboard Contact Picker with auto-discovery
- [x] Contact count indicator in Delegation tab
- [x] **v48: Soothing bell chime alarm** (replaced danger alarm, loud volume)
- [x] **v48: Exact DATE trigger for notifications** (was TIME_INTERVAL, now precise)
- [x] **v48: Past time validation** (blocks saving reminders with past times)
- [x] **v48: Faster loading** (cached device ID, no network call on every open)
- [x] **v48: Offline contact queue** (saves locally, auto-syncs on next launch)
- [x] **v48: Priority color coding** (Optional Normal/Urgent/Critical with color badges)
- [x] **v48: Notification channel v4** with bypassDnd and soothing sound
- [x] **v54: Dashboard renamed** to "Justblr Matrix Task Management"
- [x] **v54: Numbered left-aligned section titles** (1-4)
- [x] **v54: Exact minute trigger fix** (seconds/ms zeroed on time picker and trigger date)
- [x] **v54: Alarm persistence fix** (tapping background notification now shows alarm modal with looping sound)
- [x] **v54: Priority color coding updated** (Normal=light green, Urgent=light blue, Critical=light red with visible fonts)

## Backlog
- [ ] Push Notifications for Delegated Tasks (P1)
- [ ] Twilio WhatsApp/SMS automation (P1, needs credentials)
- [ ] Google Assistant Voice Commands (P2)
- [ ] iOS version build (P2)
- [ ] Production Play Store Release (P1, pending tester confirmation)

## Key API Endpoints
- `GET /api/sync/contact-sources` — Lists device_ids with synced contact counts
- `GET /api/sync/contacts/{device_id}` — Returns contacts for a device
- `POST /api/sync/contacts` — Mobile app pushing contacts
- `POST /api/auth/register` / `POST /api/auth/login` — Email+PIN auth
- `POST /api/employees` / `GET /api/employees` — Employee CRUD
- `POST /api/tasks` / `GET /api/tasks` — Task CRUD

## Deployment Notes
- TWO separate Render services from TWO separate GitHub repos
- `justblr-web` (Static Site) -> `fusionlounge-cloud/justblr-web` -> web dashboard
- `justblr-backend` (Web Service) -> separate repo -> API
- Web dashboard HTML must be manually copied to `justblr-web` repo
- EAS builds use `preview` profile with Render backend URL

## Critical Notes
- DO NOT run pip freeze > requirements.txt
- DO NOT add cancelAllScheduledNotificationsAsync()
- DO NOT touch device ID generation logic
- Notification channel is now `justblr-alarm-v4`
- Alarm sound: soothing bell chime (generated programmatically)
