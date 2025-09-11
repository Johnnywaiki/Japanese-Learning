import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

// Keep splash until fonts ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  if (!loaded) return null;
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Tabs container */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Standalone Settings screen (opened from Tabs header button) */}
        <Stack.Screen
          name="settings"
          options={{
            title: '設定',
            // Custom back (avoid iOS showing "(tabs)")
            headerLeft: ({ tintColor }) => (
              <Pressable
                onPress={() => router.back()}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}
                hitSlop={10}
              >
                <Ionicons name="chevron-back" size={22} color={tintColor} />
                <Text style={{ color: tintColor, fontSize: 16, marginLeft: 2 }}>返回</Text>
              </Pressable>
            ),
          }}
        />

        {/* Optional modal route from template */}
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
