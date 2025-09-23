// app/(tabs)/_layout.tsx
import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

function SettingsButton() {
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={10}
      style={({ pressed }) => [{ paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="開啟設定"
    >
      <MaterialCommunityIcons name="cog-outline" size={22} />
    </Pressable>
  );
}

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
        headerShown: true,
        headerLeft: () => <SettingsButton />,             // ⬅️  每個 Tab 都有設定鍵
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { color: C.tint, fontWeight: '700' },
        tabBarActiveTintColor: C.tint,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
      }}
    >
      {/* 顯示中的 Tabs */}
      <Tabs.Screen
        name="home"
        options={{
          title: '每日練習',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="calendar-check" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="kanji"
        options={{
          title: '漢字',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="format-letter-matches" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="mistakes"
        options={{
          title: '錯題',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="book-alert-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: '模擬試卷',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="file-document-multiple-outline" size={size} color={color} />,
        }}
      />

      {/* 收起的頁面（仍可程式導航進入） */}
      <Tabs.Screen name="practice-daily" options={{ href: null, title: '每日練習' }} />
      <Tabs.Screen name="practice-exam"  options={{ href: null, title: '試卷練習' }} />
      <Tabs.Screen name="practice"       options={{ href: null, title: '練習' }} />
      <Tabs.Screen name="translate"      options={{ href: null, title: '翻譯' }} />
    </Tabs>
  );
}
