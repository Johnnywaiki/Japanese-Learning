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
        headerShown: false,
        tabBarActiveTintColor: C.tint,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
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

      {/* 從頁面 push，唔顯示喺 TabBar */}
      <Tabs.Screen name="practice-daily" options={{ href: null }} />
      <Tabs.Screen name="practice-exam"  options={{ href: null }} />
      <Tabs.Screen name="practice"       options={{ href: null }} />
    </Tabs>
  );
}
