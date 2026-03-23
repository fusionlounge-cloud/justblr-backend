# Justblr Matrix - Product Requirements Document

## Original Problem Statement
Voice-first mobile productivity application with central dashboard, reminders, task delegation, and web dashboard for desktop access.

## Current Architecture
- **Mobile App**: Expo (React Native) - Play Store v1.6.4 building
- **Web Dashboard**: React static site on Render
- **Backend**: FastAPI on Render (https://justblr-backend.onrender.com)
- **Database**: MongoDB Atlas

## What's Been Implemented

### March 24, 2026
- [x] Web Dashboard full CRUD (Add/Edit/Delete reminders)
- [x] Default time: Tomorrow 4:30 PM
- [x] Title made optional
- [x] 6 reminder types: Call, SMS, WhatsApp, Meet, Deskwork, Notes
- [x] Contact search on web dashboard
- [x] Filter by type on web dashboard
- [x] Multi-user authentication (unique device IDs)
- [x] Migration fix - existing users keep their data
- [x] Removed mic icon from header
- [x] "Desktop" text below laptop icon
- [x] Desktop Connect modal with website URL
- [x] Instant reminder loading with local cache

### Previous Sessions
- [x] Backend migrated to Render
- [x] Database migrated to MongoDB Atlas
- [x] Fixed back-swipe app crash
- [x] Fixed timezone saving (UTC)
- [x] Fixed double-tap save bug
- [x] Task Report shows only active employees
- [x] Web Dashboard created and deployed

## URLs
- Web Dashboard: https://justblr-web.onrender.com
- Backend API: https://justblr-backend.onrender.com
- Play Store: Closed Testing (14 testers)

## Pending / In Progress

### P0 - Critical
- [ ] v1.6.4 build completing (migration fix) - upload to Play Store when done

### P1 - High Priority
- [ ] Twilio WhatsApp/SMS automation (requires Twilio credentials)
- [ ] Test reminder notifications on edited reminders

### P2 - Medium Priority
- [ ] Render Free Tier scheduler delays (paid tier or local notifications)
- [ ] Google Assistant voice commands integration
- [ ] iOS version

## Future / Backlog
- [ ] Email/Password authentication (cross-device sync)
- [ ] Google Sign-In option
- [ ] Push notifications improvements
- [ ] Contact sync improvements on web

## Key Files
- `/app/frontend/app/index.tsx` - Main mobile app screen
- `/app/frontend/app/action.tsx` - Action/reminder creation
- `/app/frontend/app/delegation.tsx` - Task delegation
- `/app/backend/server.py` - FastAPI backend (on Render)
- `/app/web/` - Web dashboard (GitHub: fusionlounge-cloud/justblr-web)

## Build Status
- v1.6.4 building: https://expo.dev/accounts/ananthnarayan/projects/justblr-matrix/builds/88eb13ad-f6a2-4786-b79d-171c14fa3507

## Notes
- Backend is hosted on user's Render account (not Emergent preview)
- Web dashboard deployed as static site on Render
- Multi-user fix uses device ID migration to preserve existing user data
