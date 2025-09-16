// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,               // ← 打開標頭，自動避開瀏海
        tabBarActiveTintColor: '#111',
        tabBarStyle: { paddingTop: Platform.OS === 'ios' ? 6 : 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '篩選',
          tabBarIcon: ({ color, size }) => <Ionicons name="funnel-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: '練習',
          tabBarIcon: ({ color, size }) => <Ionicons name="create-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mistakes"
        options={{
          title: '錯題',
          tabBarIcon: ({ color, size }) => <Ionicons name="alert-circle-outline" color={color} size={size} />,
        }}
      />
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
