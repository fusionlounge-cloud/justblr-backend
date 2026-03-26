# Justblr Matrix - Product Requirements Document

## Original Problem Statement
Voice-first mobile productivity application ("Justblr Matrix assistant") with a central dashboard, reminders, task delegation, and a web dashboard. Currently in Google Play Closed Testing.

## Core Architecture
- **Mobile App**: Expo React Native (Play Store testing, up to v37)
- **Web Dashboard**: Standalone HTML/JS (`/app/web/index.html`) hosted on Render
- **Backend**: FastAPI (`/app/backend/server.py`) hosted on Render
- **Database**: MongoDB Atlas (external)
- **Key Integrations**: Deepgram (voice), Twilio (SMS/WhatsApp - pending credentials)

## User Personas
- Primary user managing personal/business reminders
- Team members receiving delegated tasks

## Key Features & Status

### Completed
- [x] Full CRUD for reminders (call, SMS, WhatsApp, meet, deskwork, keepnotes)
- [x] Voice commands via Deepgram STT
- [x] Local caching for instant reminder loading
- [x] Multi-tenant unique device IDs (data isolation)
- [x] Social Media Hub (7 icons, 2 rows)
- [x] Web Dashboard with full CRUD + delegation
- [x] Desktop Connect (6-digit sync code)
- [x] Email + 4-digit PIN Authentication (mobile + web + backend)
- [x] Task delegation system with employees
- [x] Delete account for Google Play Data Safety compliance
- [x] Device ID recovery fallback (master_justblr_primary_user)
- [x] **Alarm Notifications Fixed (v35)** — Removed destructive cancelAllScheduledNotificationsAsync() that was wiping alarms on dashboard load
- [x] **Continuous Alarm Sound (v35)** — alarm.wav plays in loop with continuous vibration until DISMISS is tapped (foreground)
- [x] **Custom alarm.wav for notifications (v35)** — Background notifications use 15s alarm sound instead of default ding
- [x] **Notification channel v3 (v35)** — Fresh channel with alarm.wav sound, old channels cleaned up
- [x] **Edited reminders now get alarms (v36)** — scheduleNotification() called for both new and edited reminders
- [x] **"STOP ALARM" button on notifications (v36)** — Notification category with Dismiss action button
- [x] **Reminders sorted newest first (v37)** — Sorted by scheduled_time descending
- [x] **WhatsApp Business fix (v37)** — Updated intent URL format with LAUNCHER action for Android

### In Progress / Pending
- [ ] **Home screen/launcher feature** — User wants Justblr as default Android home screen (requires native launcher config or user guidance)

### Backlog
- [ ] Push Notifications for Delegated Tasks (notify employee when task is assigned)
- [ ] Twilio WhatsApp/SMS automation (backend logic exists, needs user's Twilio credentials)
- [ ] Google Assistant Voice Commands ("Hey Google, open Justblr...")
- [ ] iOS version build

## Data Models
- `users`: { id, email, password_hash, name, device_id, auth_token, created_at, is_active }
- `reminders`: { id, title, scheduled_time, reminder_type, device_id, contact_name, contact_phone, notes }
- `tasks`: { id, description, employee_id, is_completed, device_id }
- `employees`: { id, name, role, device_id }
- `contacts`: { device_id, contacts[] }

## API Endpoints
- `POST /api/auth/register` — Register with email + PIN
- `POST /api/auth/login` — Login with email + PIN
- `GET /api/auth/me` — Get current user info (token auth)
- `POST /api/auth/logout` — Invalidate token
- `POST /api/reminders/migrate` — Migrate data between device IDs
- `POST /api/reminders` — Create reminder
- `GET /api/reminders` — List reminders (by device_id)
- `PUT /api/reminders/{id}` — Update reminder
- `DELETE /api/reminders/{id}` — Delete reminder
- `POST /api/voice/stt` — Speech to text
- `POST /api/voice/command` — Process voice command
- `POST/GET /api/employees` — Employee CRUD
- `POST/GET /api/tasks` — Task CRUD
- `POST /api/sync/generate-code` — Generate 6-digit link code
- `POST /api/sync/verify-code` — Verify link code
- `GET /api/delete-account` — HTML page for Google Play compliance

## File References
- `/app/backend/server.py` — FastAPI monolith with all endpoints
- `/app/frontend/app/index.tsx` — Main mobile dashboard with alarm + auth modals
- `/app/frontend/app/action.tsx` — Reminder creation with alarm scheduling
- `/app/frontend/app/delegation.tsx` — Task delegation screen
- `/app/frontend/app.json` — Expo config (v1.7.0, versionCode 37)
- `/app/frontend/assets/sounds/alarm.wav` — Custom alarm sound (15s, 678KB)
- `/app/frontend/utils/auth.ts` — Auth utility functions
- `/app/web/index.html` — Web dashboard with auth + code link

## Critical Deployment Notes
1. User's live app points to Render backend (`https://justblr-backend.onrender.com`). Changes to server.py need to be pushed to GitHub for Render deployment.
2. Mobile app changes require EAS build + Play Store upload.
3. Web dashboard is a static HTML file served from Render.
4. DO NOT run `pip freeze > requirements.txt` — it will inject Emergent container dependencies and crash Render.
5. DO NOT touch device ID generation logic unless absolutely necessary.
6. DO NOT add cancelAllScheduledNotificationsAsync() anywhere — it was the root cause of the alarm bug.
