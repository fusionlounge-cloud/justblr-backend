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
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // On home screen, allow default behavior (exit app)
      if (pathname === '/' || pathname === '/index' || pathname === '') {
        return false; // Let system handle (exit app)
      }
      
      // On ANY other screen, ALWAYS go to home
      router.replace('/');
      return true; // Prevent default (app exit)
    });

    return () => backHandler.remove();
  }, [pathname, router]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // Disable gesture navigation to prevent accidental app exit
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ gestureEnabled: false }} 
        />
        <Stack.Screen 
          name="action" 
          options={{ gestureEnabled: false }} 
        />
        <Stack.Screen 
          name="all-items" 
          options={{ gestureEnabled: false }} 
        />
        <Stack.Screen 
          name="voice-command" 
          options={{ gestureEnabled: false }} 
        />
        <Stack.Screen 
          name="delegation" 
          options={{ gestureEnabled: false }} 
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
