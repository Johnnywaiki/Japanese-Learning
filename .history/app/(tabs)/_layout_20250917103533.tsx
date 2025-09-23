// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, useColorScheme } from 'react-native';
import { router } from 'expo-router';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? '#000' : '#fff';
  const headerTint = isDark ? '#fff' : '#111';
  const tabBg = isDark ? '#0b0b0b' : '#fff';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerTint,
        headerTitleStyle: { color: headerTint },
        tabBarActiveTintColor: isDark ? '#fff' : '#111',
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        tabBarStyle: { backgroundColor: tabBg },
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={10}
            style={{ paddingHorizontal: 12 }}
          >
            <Ionicons name="settings-outline" size={22} color={headerTint} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '試卷',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: '練習',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mistakes"
        options={{
          title: '錯題',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="close-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="translate"
        options={{
          title: '翻譯',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="language" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
