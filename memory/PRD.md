# Justblr Matrix - Product Requirements Document

## Original Problem Statement
Voice-first mobile productivity application ("Justblr Matrix assistant") with central dashboard, reminders, task delegation, and web dashboard.

## Core Architecture
- **Mobile App**: Expo React Native (v1.8.0, versionCode 45)
- **Web Dashboard**: Static HTML/JS (`/app/web/index.html`) on Render
- **Backend**: FastAPI (`/app/backend/server.py`) on Render
- **Database**: MongoDB Atlas

## Completed Features
- [x] Alarm notifications fixed (P0) — cancelAllScheduledNotificationsAsync removed
- [x] Continuous alarm sound — alarm.wav loops with vibration until DISMISS
- [x] Edited reminders get alarms
- [x] "STOP ALARM" button on notifications
- [x] Reminders sorted newest first
- [x] Home screen launcher intent
- [x] WhatsApp/WA Business — expo-intent-launcher with componentName (v45)
- [x] Web dashboard contact picker for Employee form (v45)
- [x] Web contacts merged from synced + reminder + employee data (v45)
- [x] Task Delegation section moved before View All Reminders
- [x] Compact 5-icon grid layout
- [x] Email+PIN auth, Delete account compliance, Device ID recovery

## Backlog
- [ ] Push Notifications for Delegated Tasks
- [ ] Twilio WhatsApp/SMS automation
- [ ] Google Assistant Voice Commands
- [ ] iOS build

## Critical Notes
- DO NOT run pip freeze > requirements.txt
- DO NOT add cancelAllScheduledNotificationsAsync()
- DO NOT touch device ID generation logic
- Web dashboard changes need GitHub push for Render deployment
