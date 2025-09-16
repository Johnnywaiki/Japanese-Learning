// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#111',
        headerShown: false,
        tabBarStyle: { paddingTop: Platform.OS === 'ios' ? 6 : 0 },
      }}
    >
      {/* 第 1 個：篩選（首頁） */}
      <Tabs.Screen
        name="index"
        options={{
          title: '篩選',
          tabBarIcon: ({ color, size }) => <Ionicons name="funnel-outline" color={color} size={size} />,
        }}
      />
      {/* 第 2 個：練習（新加） */}
      <Tabs.Screen
        name="practice"
        options={{
          title: '練習',
          tabBarIcon: ({ color, size }) => <Ionicons name="create-outline" color={color} size={size} />,
        }}
      />
      {/* 第 3 個：錯題 */}
      <Tabs.Screen
        name="mistakes"
        options={{
          title: '錯題',
          tabBarIcon: ({ color, size }) => <Ionicons name="alert-circle-outline" color={color} size={size} />,
        }}
      />
      {/* 第 4 個：設定 */}
      <Tabs.Screen
        name="two"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
