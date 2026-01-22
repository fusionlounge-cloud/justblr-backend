# Voice Assistant Mobile App

A comprehensive voice-controlled mobile assistant app built with Expo, React Native, FastAPI, and MongoDB. Features South Indian accent-optimized speech recognition powered by ElevenLabs.

## 🎯 Features

### 📱 Two-Part Dashboard

#### Action Center (Left Panel)
- **Voice Reminders**: Create voice-controlled reminders for:
  - 📞 Calls
  - 👥 Meetings
  - 💬 SMS
  - 📱 WhatsApp messages
- **Voice Notes**: Take notes using voice input with accent support
- **Contact Integration**: Pick contacts from device for reminders
- **Local Notifications**: Get notified when reminders are due

#### Social Media Hub (Right Panel)
Quick launch buttons for:
- 📸 Instagram
- 👍 Facebook
- 💼 LinkedIn
- 🛒 Alibaba
- 💚 WhatsApp
- 💬 WeChat

### 🎤 Voice Features
- **Speech-to-Text**: Powered by ElevenLabs with South Indian accent support
- **Voice Commands**: Control app with natural language
  - "Open Instagram"
  - "Create a reminder to call John"
  - "Take a note"
- **Voice Typing**: All text fields support voice input

### 🔔 Reminders System
- Create reminders for different communication types
- Add contact information
- Schedule notifications
- Mark as complete or delete
- Filter by active/completed status

### 📝 Notes System
- Voice-to-text note creation
- Tag organization
- Local storage with MongoDB backup
- Ready for Google Keep sync (future enhancement)

## 🛠️ Tech Stack

### Frontend
- **Expo** (~54.0.32)
- **React Native** (0.81.5)
- **Expo Router** (file-based routing)
- **expo-av**: Audio recording
- **expo-contacts**: Contact picker
- **expo-notifications**: Local notifications
- **axios**: API client

### Backend
- **FastAPI**: Modern Python web framework
- **MongoDB**: Database with Motor (async driver)
- **ElevenLabs**: Speech-to-text API
- **Python 3.x**

## 📁 Project Structure

```
/app
├── backend/
│   ├── server.py          # FastAPI backend with voice APIs
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables (API keys)
├── frontend/
│   ├── app/              # Expo Router screens
│   │   ├── index.tsx     # Dashboard home
│   │   ├── voice-command.tsx
│   │   ├── voice-reminder.tsx
│   │   ├── reminders.tsx
│   │   ├── voice-note.tsx
│   │   ├── notes.tsx
│   │   └── _layout.tsx
│   ├── package.json
│   └── app.json
└── test_result.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js & Yarn
- Python 3.x
- MongoDB running on localhost:27017
- ElevenLabs API key

### Installation

1. **Backend Setup**
```bash
cd /app/backend
pip install -r requirements.txt
```

2. **Frontend Setup**
```bash
cd /app/frontend
yarn install
```

3. **Environment Variables**
Already configured in `/app/backend/.env`:
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
ELEVENLABS_API_KEY="your_key_here"
```

### Running the App

1. **Start Backend**
```bash
sudo supervisorctl restart backend
```

2. **Start Frontend**
```bash
sudo supervisorctl restart expo
```

3. **Access the App**
- Web: http://localhost:3000
- Mobile: Scan QR code in Expo Go app

## 📱 Mobile Testing

### iOS (Physical Device)
1. Install Expo Go from App Store
2. Scan QR code from terminal
3. Allow microphone and contacts permissions

### Android (Physical Device)
1. Install Expo Go from Play Store
2. Scan QR code from terminal
3. Allow microphone and contacts permissions

## 🎤 Voice Commands

The app supports natural language voice commands:

- **Social Media**: "Open [app name]"
  - "Open Instagram"
  - "Open WhatsApp"
  - "Open LinkedIn"

- **Reminders**: "Remind me to [action]"
  - "Remind me to call John"
  - "Create a meeting reminder"
  - "Send SMS to Mary"

- **Notes**: "Take a note" or "Write a note"

## 🔌 API Endpoints

### Voice APIs
- `POST /api/voice/stt` - Speech to text
- `POST /api/voice/tts` - Text to speech
- `POST /api/voice/command` - Process voice commands

### Reminders
- `GET /api/reminders` - List reminders
- `POST /api/reminders` - Create reminder
- `PUT /api/reminders/{id}/complete` - Mark complete
- `DELETE /api/reminders/{id}` - Delete reminder

### Notes
- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `PUT /api/notes/{id}` - Update note
- `DELETE /api/notes/{id}` - Delete note

### Health
- `GET /api/health` - Check service status

## 🔐 Permissions Required

### iOS (app.json)
```json
"NSMicrophoneUsageDescription": "Record voice commands and notes with accent support"
"NSContactsUsageDescription": "Pick contacts for reminders"
```

### Android (app.json)
```json
"permissions": [
  "RECORD_AUDIO",
  "READ_CONTACTS",
  "POST_NOTIFICATIONS",
  "SCHEDULE_EXACT_ALARM"
]
```

## 🌟 Key Features Explained

### 1. Accent-Optimized Voice Recognition
Uses ElevenLabs' `scribe_v1` model which supports:
- South Indian accents
- Multiple languages
- High accuracy transcription

### 2. Smart Voice Command Processing
The backend analyzes transcribed text to determine intent:
- Extracts action type (open app, create reminder, etc.)
- Identifies parameters (app name, contact, action)
- Returns structured response for frontend action

### 3. Dual Storage Strategy
- **MongoDB**: Permanent storage for reminders and notes
- **Local Storage**: Offline capability and quick access
- **Notifications**: Native iOS/Android scheduling

### 4. Cross-Platform Compatibility
- Works on iOS, Android, and Web
- Platform-specific code for notifications (native only)
- Responsive design for all screen sizes

## 🎨 Design Highlights

- **Modern UI**: Card-based design with shadows and colors
- **Intuitive Icons**: Vector icons for all actions
- **Visual Feedback**: Animated mic button during recording
- **Status Indicators**: Loading states and error handling
- **Touch-Friendly**: 44px minimum touch targets

## 🚧 Future Enhancements

1. **Google Keep Integration**: Full bi-directional sync
2. **Calendar Integration**: Link reminders to calendar events
3. **WhatsApp Direct Integration**: Send messages directly
4. **Time Picker**: Custom scheduling for reminders
5. **Voice Profiles**: Multiple user support
6. **Offline Mode**: Full offline functionality
7. **Export/Import**: Backup and restore data

## 📝 Development Notes

### Voice Recording Format
- **iOS**: m4a format (44.1kHz, AAC)
- **Android**: m4a format compatible
- **Quality**: HIGH_QUALITY preset

### Database Schema

**Reminders Collection:**
```javascript
{
  id: string,
  title: string,
  contact_name?: string,
  contact_phone?: string,
  reminder_type: "meet" | "call" | "sms" | "whatsapp",
  scheduled_time: datetime,
  notes?: string,
  is_completed: boolean,
  created_at: datetime
}
```

**Notes Collection:**
```javascript
{
  id: string,
  title: string,
  content: string,
  tags: string[],
  created_at: datetime,
  updated_at: datetime
}
```

## 🐛 Troubleshooting

### Voice Not Working
- Check microphone permissions
- Verify ElevenLabs API key in .env
- Check internet connection

### Contacts Not Loading
- Grant contacts permission in device settings
- Restart the app after granting permission

### Notifications Not Showing
- Grant notification permissions
- Check Do Not Disturb settings
- Verify scheduled time is in future

### Social Media Apps Not Opening
- Install the target app first
- Falls back to web version if app not found

## 📄 License

This project is built as a custom solution for voice-controlled assistant needs.

## 👥 Support

For issues or questions:
1. Check troubleshooting section
2. Review API logs in `/var/log/supervisor/backend.err.log`
3. Check frontend logs in Expo console

## 🎯 Performance Tips

1. **Voice Recording**: Keep recordings under 30 seconds for faster processing
2. **Batch Operations**: Use bulk APIs when managing multiple items
3. **Cache Management**: Clear app cache if experiencing slow performance
4. **Network**: Use Wi-Fi for voice recognition for faster results

---

Built with ❤️ using Expo, React Native, and FastAPI
