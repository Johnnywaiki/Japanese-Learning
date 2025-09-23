import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

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
      }}
    >
      <Tabs.Screen name="practice" options={{ title: '練習' }} />
      <Tabs.Screen name="mistakes" options={{ title: '錯題' }} />
      <Tabs.Screen name="translate" options={{ title: '翻譯' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} /> {/* 需有上面的橋樑檔 */}
    </Tabs>
  );
}
