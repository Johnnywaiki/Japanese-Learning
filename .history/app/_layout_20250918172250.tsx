// app/_layout.tsx
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

// Keep the native splash on until fonts/assets are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? '#000' : '#fff';
  const headerTint = isDark ? '#fff' : '#111';

  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Preload Ionicons font to avoid "Unable to save asset ... .ttf" errors
        await Font.loadAsync(Ionicons.font);
      } catch (e) {
        console.warn('[font] load failed', e);
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Bottom tabs (handles its own headers) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Settings (use Root Stack header) */}
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: '設定',
            headerStyle: { backgroundColor: headerBg },
            headerTitleStyle: { color: headerTint },
            headerTintColor: headerTint,
          }}
        />
      </Stack>

      {/* If you ever need top-level portals/screens without headers */}
      <Slot />
    </GestureHandlerRootView>
  );
}
