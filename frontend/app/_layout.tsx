import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, BackHandler, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If we're on the home screen, let the default behavior (exit app) happen
      if (pathname === '/' || pathname === '/index') {
        return false; // Let system handle it (exit app)
      }
      // Otherwise, go back
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [pathname, router]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="voice-command" />
        <Stack.Screen name="action" />
        <Stack.Screen name="all-items" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
