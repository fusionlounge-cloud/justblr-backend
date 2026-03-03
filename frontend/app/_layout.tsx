import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, BackHandler, Platform } from 'react-native';
import { useRouter, usePathname, useNavigation } from 'expo-router';
import * as Notifications from 'expo-notifications';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useNavigation();

  // Create notification channel for Android (REQUIRED for Android 8.0+)
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#667eea',
        sound: 'default',
      });
    }
  }, []);

  // Handle Android hardware back button at root level
  // This is a fallback - individual screens also handle back navigation
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // On home screen, allow default behavior (exit app)
      if (pathname === '/' || pathname === '/index' || pathname === '') {
        return false;
      }
      
      // On other screens, navigate back
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true; // Prevent default (app exit)
      }
      
      // If can't go back but not on home, try router
      router.back();
      return true;
    });

    return () => backHandler.remove();
  }, [pathname, navigation, router]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ gestureEnabled: false }} 
        />
        <Stack.Screen name="action" />
        <Stack.Screen name="all-items" />
        <Stack.Screen name="voice-command" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
