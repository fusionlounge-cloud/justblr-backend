import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, BackHandler, Platform } from 'react-native';
import { useRouter, usePathname, useNavigation } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useNavigation();

  // Handle Android hardware back button and gesture
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If we're on the home screen, let the default behavior (exit app) happen
      if (pathname === '/' || pathname === '/index' || pathname === '') {
        return false; // Let system handle it (exit app)
      }
      // Otherwise, go back
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true; // Prevent default behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [pathname, navigation]);

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
          options={{ 
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen 
          name="action" 
          options={{ 
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }} 
        />
        <Stack.Screen 
          name="all-items" 
          options={{ 
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }} 
        />
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
