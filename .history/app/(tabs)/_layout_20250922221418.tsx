// app/(tabs)/_layout.tsx
import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';
  const C = useMemo(() => ({
    bg: isDark ? '#000' : '#fff',
    tint: isDark ? '#fff' : '#111',
    border: isDark ? '#222' : '#e5e7eb',
  }), [isDark]);

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: true,                 // 👈 顯示頂部 Header
        tabBarActiveTintColor: C.tint,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { color: C.tint, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '每日練習',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: '試卷',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document-multiple-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="mistakes"
        options={{
          title: '錯題',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="book-alert-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="translate"
        options={{
          title: '翻譯',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="translate" size={size} color={color} />
          ),
        }}
      />

      {/* 非 Tab 頁：唔顯示喺底部，但保持有 Header */}
      <Tabs.Screen name="practice-daily" options={{ href: null, title: '每日練習' }} />
      <Tabs.Screen name="practice-exam"  options={{ href: null, title: '試卷練習' }} />
      <Tabs.Screen name="practice"       options={{ href: null, title: '練習' }} />
    </Tabs>
  );
}
