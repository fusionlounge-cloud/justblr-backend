# Justblr Matrix Assistant - Product Requirements Document

## Play Store Ready - v1.2.0

### Download APK
**https://expo.dev/artifacts/eas/hx5oTHmMCZN9zQWUsoGDzY.apk**

### Play Store Assets
- **App Icon (512x512)**: https://static.prod-images.emergentagent.com/jobs/0e021c61-d04a-4d5d-a69a-47688ed0bdbf/images/348f8352d24be2bd6625bb8fc3c70ce8badde7944bd1a1ca54d69e8e77091187.png
- **Feature Graphic (1024x500)**: https://static.prod-images.emergentagent.com/jobs/0e021c61-d04a-4d5d-a69a-47688ed0bdbf/images/b42723d551f8e86c9b314628fc7944cdb6a5c1dfe5f6b77133badf6822d91928.png
- **Privacy Policy URL**: https://matrix-task-sync.preview.emergentagent.com/api/web-static/privacy-policy.html
- **Description**: See /app/PLAY_STORE_DESCRIPTION.md

---

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
- **Automated SMS and WhatsApp sending via Twilio**

## Tech Stack
- **Mobile**: Expo SDK 54, React Native, TypeScript, expo-router
- **Web**: React 18, CSS, served via FastAPI
- **Backend**: FastAPI, MongoDB (motor), APScheduler, Twilio
- **Build**: EAS (Expo Application Services) Cloud Build
- **Data Separation**: expo-constants installationId as device_id

## Database Schema
```
reminders: {
  _id, id, reminder_type, contact_name, contact_phone,
  notes, scheduled_time, auto_execute, triggered,
  created_at, device_id, auto_execute_triggered,
  execution_result
}

contacts: {
  device_id, name, phone, email, synced_at
}

sync_codes: {
  sync_code, device_id, created_at, expires_at
}

settings: {
  key, account_sid, auth_token, phone_number,
  whatsapp_number, updated_at
}

execution_logs: {
  reminder_id, reminder_type, contact_phone,
  executed_at, status, message_sid, error
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
- `GET /api/twilio/status` - Check Twilio configuration status
- `POST /api/twilio/configure` - Configure Twilio credentials
- `POST /api/twilio/send` - Test send SMS/WhatsApp

## Completed Features
- [x] Working APK built via EAS
- [x] Multi-device data separation using device_id
- [x] Refresh Contacts button
- [x] Voice command system
- [x] Dashboard with Quick Actions and Social Media Hub
- [x] Reminder creation with scheduling
- [x] Auto-execute toggle for calls/SMS/WhatsApp
- [x] Notification system
- [x] Specific notification content - Shows "CALL: John Doe"
- [x] Back navigation - Uses router.back() properly
- [x] WhatsApp Business link - Simplified URL scheme
- [x] **Web Dashboard** - Desktop browser access
- [x] **Link to Web** - 6-digit sync code system
- [x] **Contacts sync** - Upload contacts to cloud for web access
- [x] **Twilio SMS Integration** (2026-03-06) - Auto-send SMS at scheduled time
- [x] **Twilio WhatsApp Integration** (2026-03-06) - Auto-send WhatsApp at scheduled time
- [x] **Web Dashboard Meet/Deskwork cards** (2026-03-11) - Added missing stat cards with icons and styling
- [x] **Improved contact phone filtering** (2026-03-11) - Filter out masked/invalid phone numbers
- [x] **APK v1.0.2 Released** (2026-03-12) - All reminder display issues fixed, back navigation fixed

## Latest APK
- **Version**: 1.0.2
- **Download**: https://expo.dev/artifacts/eas/kXM8kYfnrt4AbRViPKGeYa.apk
- **Build Date**: 2026-03-12

## Fixed Issues (2026-03-11/12)
1. **Issue 1: Meet/Deskwork missing on web** - Added CSS styling for `.stat-icon.meet` and `.stat-icon.deskwork`, plus proper SVG icons
2. **Issue 2: Back navigation exits app** - Changed from `router.replace('/')` to `router.back()` in action.tsx and all-items.tsx  
3. **Issue 3: Phone numbers saving incorrectly** - Removed auto-clear of phone when editing name, added filter for masked (X's) and invalid short numbers

## Pending Testing
- [ ] Build new APK with Link to Web feature
- [ ] Test notification shows contact name
- [ ] Test back swipe returns to home screen
- [ ] Test web dashboard sync flow
- [ ] Test Twilio SMS/WhatsApp automation

## Twilio Setup Required
1. Create Twilio account at https://www.twilio.com/try-twilio
2. Get Account SID, Auth Token, Phone Number from console
3. Configure via POST /api/twilio/configure

## Upcoming Tasks (P1)
- [ ] Guide user through Google Play Store publishing
- [ ] User to set up Twilio credentials

## Future Tasks (P2+)
- [ ] iOS version (requires Apple Developer account)
- [ ] Scalable solution for 36,000+ contacts
- [ ] Enhanced Google Keep integration

## Key Files
- `/app/frontend/app/index.tsx` - Dashboard, social hub, Link to Web modal
- `/app/frontend/app/action.tsx` - Create/edit reminders, notifications
- `/app/frontend/app/all-items.tsx` - Reminder list view
- `/app/frontend/app/_layout.tsx` - Navigation stack config
- `/app/backend/server.py` - API endpoints, sync endpoints, Twilio integration
- `/app/web/src/App.js` - Web dashboard React app

## Web Dashboard Access
```
https://matrix-task-sync.preview.emergentagent.com/api/web-static/index.html
```

## Known Limitations
- Voice icon inside 3rd party apps (WhatsApp/SMS) is not technically feasible
- Contact loading for 36,000+ contacts needs optimization
- Web dashboard requires mobile app to generate sync code first
- Twilio trial accounts can only send to verified numbers
- **Web dashboard un-links on app reinstall** (Issue 4) - This is an architectural limitation. The sync relies on a transient `device_id` that changes when the app is reinstalled. A proper fix requires implementing a user account system. Current workaround: User must unlink and re-link with a new sync code after reinstalling the mobile app.
