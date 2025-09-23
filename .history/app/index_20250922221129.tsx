// app/index.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';

export default function Index() {
  useEffect(() => {
    // 開 app 統一跳去 Intro，之後由 Intro 再跳去 /(tabs)/home
    router.replace('/intro');
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 8, color: '#666' }}>載入中…</Text>
    </View>
  );
}
