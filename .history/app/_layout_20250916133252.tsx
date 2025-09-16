// 一定要喺其它 import 之前先載入（舊版需要；安全做法）
import 'react-native-gesture-handler';

import { Tabs, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? '#000' : '#fff';
  const headerTint = isDark ? '#fff' : '#111';
  const tabBorder = isDark ? '#222' : '#eee';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { color: headerTint },
          headerTintColor: headerTint,
          tabBarStyle: { backgroundColor: headerBg, borderTopColor: tabBorder },
          tabBarActiveTintColor: headerTint,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '篩選',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="funnel-outline" color={color} size={size} />
            ),
            headerLeft: () => (
              <Image
                source={require('../../assets/images/icon.png')}
                style={{ width: 24, height: 24, marginLeft: 12, borderRadius: 6 }}
                resizeMode="contain"
              />
            ),
            headerRight: () => (
              <Link href="/settings" asChild>
                <Pressable hitSlop={10} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Ionicons name="settings-outline" size={22} color={headerTint} />
                </Pressable>
              </Link>
            ),
          }}
        />
        <Tabs.Screen
          name="practice"
          options={{
            title: '練習',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="create-outline" color={color} size={size} />
            ),
            headerLeft: () => null,
            headerRight: () => null,
          }}
        />
        <Tabs.Screen
          name="mistakes"
          options={{
            title: '錯題',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="alert-circle-outline" color={color} size={size} />
            ),
            headerLeft: () => null,
            headerRight: () => null,
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  );
}
