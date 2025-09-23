// app/_layout.tsx
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? '#000' : '#fff';
  const headerTint = isDark ? '#fff' : '#111';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* ✅ 結果頁：用 modal 呈現 */}
        <Stack.Screen
          name="result"
          options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }}
        />

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
    </GestureHandlerRootView>
  );
}
