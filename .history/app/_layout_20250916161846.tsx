// app/_layout.tsx
import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// （可選）如果你有用 SafeAreaView，最好喺根加 SafeAreaProvider
// import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* <SafeAreaProvider> */}
        <Stack screenOptions={{ headerShown: false }} />
      {/* </SafeAreaProvider> */}
    </GestureHandlerRootView>
  );
}
