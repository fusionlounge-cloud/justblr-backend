# Justblr Matrix - Product Requirements Document

## Original Problem Statement
Voice-first mobile productivity application ("Justblr Matrix assistant") with a central dashboard, reminders, task delegation, and a web dashboard. Currently in Google Play Closed Testing.

## Core Architecture
- **Mobile App**: Expo React Native (Play Store testing, v1.8.0, versionCode 40)
- **Web Dashboard**: Standalone HTML/JS (`/app/web/index.html`) hosted on Render
- **Backend**: FastAPI (`/app/backend/server.py`) hosted on Render
- **Database**: MongoDB Atlas (external)
- **Key Integrations**: Deepgram (voice), Twilio (SMS/WhatsApp - pending credentials)

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
- [x] **Alarm Notifications Fixed (v35)** — Removed destructive cancelAllScheduledNotificationsAsync()
- [x] **Continuous Alarm Sound (v35)** — alarm.wav loops with vibration until DISMISS
- [x] **Custom alarm.wav for notifications (v35)** — Background notifications use 15s alarm sound
- [x] **Notification channel v3 (v35)** — Fresh channel with alarm.wav sound
- [x] **Edited reminders now get alarms (v36)** — scheduleNotification() called for both new and edited reminders
- [x] **"STOP ALARM" button on notifications (v36)** — Notification category with Dismiss action button
- [x] **Reminders sorted newest first (v37)** — Sorted by scheduled_time descending
- [x] **WhatsApp Business fix (v40)** — Reverted to original working intent URL format
- [x] **Home Screen Launcher (v38)** — Added HOME intent filter so user can set Justblr as default Android home screen

### Backlog
- [ ] Push Notifications for Delegated Tasks (notify employee when task is assigned)
- [ ] Twilio WhatsApp/SMS automation (backend logic exists, needs user's Twilio credentials)
- [ ] Google Assistant Voice Commands ("Hey Google, open Justblr...")
- [ ] iOS version build

## Critical Deployment Notes
1. Backend lives on user's Render account. Changes need GitHub push for Render deployment.
2. Mobile app changes require EAS build + Play Store upload.
3. DO NOT run `pip freeze > requirements.txt`
4. DO NOT touch device ID generation logic
5. DO NOT add cancelAllScheduledNotificationsAsync() anywhere
