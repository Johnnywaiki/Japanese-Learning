// app/index.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const LEVEL_KEY = 'user.level';

export default function Index() {
  useEffect(() => {
    (async () => {
      try {
        const lv = await AsyncStorage.getItem(LEVEL_KEY);
        if (lv) router.replace('/(tabs)/home');
        else router.replace('/level');
      } catch {
        router.replace('/level');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 8, color: '#666' }}>載入中…</Text>
    </View>
  );
}
