// app/(tabs)/_layout.tsx
import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';
  const C = useMemo(() => ({
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    tint: isDark ? '#fff' : '#111',
    border: isDark ? '#222' : '#e5e7eb',
  }), [isDark]);

  return (
    <Tabs
      initialRouteName="home"           // ✅ 預設打開 Home
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.tint,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
      }}
    >
      {/* Home（Daily） */}
      <Tabs.Screen
        name="home"
        options={{
          title: '每日練習',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
          ),
        }}
      />

      {/* Index（Exam/Mock 揀卷頁） → 要出喺 Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: '試卷',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document-multiple-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 錯題本 */}
      <Tabs.Screen
        name="mistakes"
        options={{
          title: '錯題',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="book-alert-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 翻譯工具 */}
      <Tabs.Screen
        name="translate"
        options={{
          title: '翻譯',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="translate" size={size} color={color} />
          ),
        }}
      />

      {/* 下列練習畫面係從頁內 push，唔要顯示喺 Tab Bar */}
      <Tabs.Screen name="practice-daily" options={{ href: null }} />
      <Tabs.Screen name="practice-exam"  options={{ href: null }} />
      <Tabs.Screen name="practice"       options={{ href: null }} />

      {/* ❌ 注意：唔好喺 Tabs 入面宣告 settings
          settings 係 root Stack（app/_layout.tsx）管理，否則會出警告 */}
    </Tabs>
  );
}
