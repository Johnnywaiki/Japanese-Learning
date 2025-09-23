import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? '#000' : '#fff';
  const headerTint = isDark ? '#fff' : '#111';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: headerBg },
        headerTitleStyle: { color: headerTint },
        headerTintColor: headerTint,
        tabBarActiveTintColor: headerTint,
      }}
    >
      <Tabs.Screen
        name="practice"
        options={{
          title: '練習',
          tabBarIcon: ({ color, size }) => <Ionicons name="school" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
