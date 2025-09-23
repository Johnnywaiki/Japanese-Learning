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
        {/* Intro 開場頁（顯示你的 splash 圖），完咗會 replace 到 (tabs) */}
        <Stack.Screen name="intro" options={{ headerShown: false }} />

        {/* 底部 Tabs（自己有 header） */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* 設定頁（用 Root Stack 的 header） */}
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
