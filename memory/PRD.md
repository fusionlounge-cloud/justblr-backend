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

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, TypeScript, expo-router
- **Backend**: FastAPI, MongoDB (motor), APScheduler
- **Build**: EAS (Expo Application Services) Cloud Build
- **Data Separation**: expo-constants installationId as device_id

## Database Schema
```
reminders: {
  _id,
  action_type,
  contact_name,
  contact_phone,
  notes,
  scheduled_time,
  auto_execute,
  triggered,
  created_at,
  device_id
}
```

## Key API Endpoints
- `GET /api/reminders?device_id=<string>` - Fetch reminders for device
- `POST /api/reminders` - Create reminder (requires device_id)
- `PUT /api/reminders/:id` - Update reminder
- `DELETE /api/reminders/:id` - Delete reminder
- `POST /api/voice/stt` - Speech-to-text for voice commands

## Completed Features
- [x] Working APK built via EAS (2026-03-03)
- [x] Multi-device data separation using device_id
- [x] Refresh Contacts button
- [x] Voice command system
- [x] Dashboard with Quick Actions and Social Media Hub
- [x] Reminder creation with scheduling
- [x] Auto-execute toggle for calls/SMS/WhatsApp
- [x] Notification system
- [x] **FIXED: Specific notification content** (2026-03-03) - Shows "CALL: John Doe" with contact details
- [x] **FIXED: Back navigation** (2026-03-03) - Uses router.back() instead of router.replace()
- [x] **FIXED: WhatsApp Business link** (2026-03-03) - Simplified URL scheme handling

## Pending Testing
- [ ] Test new APK with all 3 fixes
- [ ] Verify notification shows contact name
- [ ] Verify back swipe returns to previous screen
- [ ] Verify WhatsApp opens from Social Media Hub

## Upcoming Tasks (P1)
- [ ] Guide user through Google Play Store publishing

## Future Tasks (P2+)
- [ ] iOS version (requires Apple Developer account)
- [ ] Scalable solution for 36,000+ contacts
- [ ] Enhanced Google Keep integration

## Key Files
- `/app/frontend/app/action.tsx` - Create/edit reminders, notifications, contacts
- `/app/frontend/app/index.tsx` - Dashboard, social media hub
- `/app/frontend/app/all-items.tsx` - Reminder list view
- `/app/frontend/app/_layout.tsx` - Navigation stack config
- `/app/backend/server.py` - API endpoints with device_id filtering

## Known Limitations
- Voice icon inside 3rd party apps (WhatsApp/SMS) is not technically feasible
- Contact loading for 36,000+ contacts needs optimization

## User Notes
- User is non-technical - provide simple, clear instructions
- APK build process is fragile - verify fixes before requesting rebuild
- User has been frustrated with repeated build failures - be decisive
