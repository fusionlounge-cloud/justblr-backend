# Justblr Matrix Assistant - Product Requirements Document

## Original Problem Statement
Build a voice-first mobile productivity application named "Justblr Matrix Assistant" with:
- Central dashboard for managing reminders and notes
- Quick actions for: Meet, Call, SMS, WhatsApp, Deskwork, Keep Notes
- Note-taking feature (deep-links to Google Keep)
- Social media hub for quick access to Instagram, Facebook, LinkedIn, Alibaba, WhatsApp, WeChat
- All features controllable via voice commands
- Contact integration for reminders
- Schedule reminders for specific date/time with auto-execute option
- Android APK for distribution
- **Web dashboard synced with mobile app**

## Tech Stack
- **Mobile**: Expo SDK 54, React Native, TypeScript, expo-router
- **Web**: React 18, CSS, served via FastAPI
- **Backend**: FastAPI, MongoDB (motor), APScheduler
- **Build**: EAS (Expo Application Services) Cloud Build
- **Data Separation**: expo-constants installationId as device_id

## Database Schema
```
reminders: {
  _id, id, action_type, contact_name, contact_phone,
  notes, scheduled_time, auto_execute, triggered,
  created_at, device_id
}

contacts: {
  device_id, name, phone, email, synced_at
}

sync_codes: {
  sync_code, device_id, created_at, expires_at
}
```

## Key API Endpoints
- `GET /api/reminders?device_id=<string>` - Fetch reminders for device
- `POST /api/reminders` - Create reminder (requires device_id)
- `PUT /api/reminders/:id` - Update reminder
- `DELETE /api/reminders/:id` - Delete reminder
- `POST /api/voice/stt` - Speech-to-text for voice commands
- `POST /api/sync/generate-code` - Generate 6-digit sync code
- `POST /api/sync/verify-code` - Verify sync code and get device_id
- `POST /api/sync/contacts` - Sync contacts from mobile
- `GET /api/sync/contacts/{device_id}` - Get synced contacts
- `GET /api/web-static/index.html` - Web dashboard

## Completed Features
- [x] Working APK built via EAS
- [x] Multi-device data separation using device_id
- [x] Refresh Contacts button
- [x] Voice command system
- [x] Dashboard with Quick Actions and Social Media Hub
- [x] Reminder creation with scheduling
- [x] Auto-execute toggle for calls/SMS/WhatsApp
- [x] Notification system
- [x] **FIXED: Specific notification content** - Shows "CALL: John Doe"
- [x] **FIXED: Back navigation** - Uses router.replace('/') to go home
- [x] **FIXED: WhatsApp Business link** - Simplified URL scheme
- [x] **NEW: Web Dashboard** (2026-03-06) - Desktop browser access
- [x] **NEW: Link to Web** (2026-03-06) - 6-digit sync code system
- [x] **NEW: Contacts sync** (2026-03-06) - Upload contacts to cloud for web access

## Pending Testing
- [ ] Build new APK with Link to Web feature
- [ ] Test notification shows contact name
- [ ] Test back swipe returns to home screen
- [ ] Test web dashboard sync flow

## Upcoming Tasks (P1)
- [ ] Guide user through Google Play Store publishing

## Future Tasks (P2+)
- [ ] iOS version (requires Apple Developer account)
- [ ] Scalable solution for 36,000+ contacts
- [ ] Enhanced Google Keep integration

## Key Files
- `/app/frontend/app/index.tsx` - Dashboard, social hub, Link to Web modal
- `/app/frontend/app/action.tsx` - Create/edit reminders, notifications
- `/app/frontend/app/all-items.tsx` - Reminder list view
- `/app/frontend/app/_layout.tsx` - Navigation stack config
- `/app/backend/server.py` - API endpoints, sync endpoints
- `/app/web/src/App.js` - Web dashboard React app

## Web Dashboard Access
```
https://reminder-voice-app-1.preview.emergentagent.com/api/web-static/index.html
```

## Known Limitations
- Voice icon inside 3rd party apps (WhatsApp/SMS) is not technically feasible
- Contact loading for 36,000+ contacts needs optimization
- Web dashboard requires mobile app to generate sync code first
