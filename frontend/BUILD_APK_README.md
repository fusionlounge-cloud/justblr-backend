# Justblr Matrix - APK Build Instructions

## Super Simple Steps (Only 3 commands!)

### Step 1: Install EAS CLI (one-time)
Open Terminal/Command Prompt and run:
```
npm install -g eas-cli
```

### Step 2: Navigate to this folder
```
cd justblr-matrix-app
```

### Step 3: Login and Build
Run this ONE command - it will ask for your Expo login:
```
eas login && eas build:configure && eas build --platform android --profile preview
```

That's it! The build will happen in the cloud. You'll get a download link for your APK when it's done (usually 10-15 minutes).

---

## Troubleshooting

**"eas: command not found"**
→ Run `npm install -g eas-cli` again

**"Not logged in"**
→ Run `eas login` and enter your expo.dev credentials

**Build fails?**
→ Run `eas build:configure` first, then try the build command again

---

## After Building

1. Download the APK from the link Expo provides
2. Transfer the APK to your phone
3. Install it (you may need to enable "Install from unknown sources")
4. The app will connect to: https://alarm-dash-preview.preview.emergentagent.com

Enjoy your Justblr Matrix Assistant!
