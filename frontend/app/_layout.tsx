import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="voice-command" />
        <Stack.Screen name="voice-reminder" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="voice-note" />
        <Stack.Screen name="notes" />
      </Stack>
    </GestureHandlerRootView>
  );
}
