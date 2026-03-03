import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, BackHandler, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If we're on the home screen (index), let the default behavior (exit app) happen
      if (segments.length === 0 || (segments.length === 1 && segments[0] === 'index')) {
        return false; // Let system handle it (exit app)
      }
      // Otherwise, go back
      router.back();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [segments]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
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
