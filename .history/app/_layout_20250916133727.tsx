import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? '#000' : '#fff';
  const headerTint = isDark ? '#fff' : '#111';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { color: headerTint },
          headerTintColor: headerTint,
        }}
      >
        {/* Tabs */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Settings page */}
        <Stack.Screen name="settings" options={{ title: '設定' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
