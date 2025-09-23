// app/index.tsx
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [dest, setDest] = useState<'checking' | 'intro' | 'home'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('has_seen_intro_v1');
        if (cancelled) return;
        if (seen) {
          setDest('home');      // 不是第一次 → 直接去 tabs（揀卷）
        } else {
          await AsyncStorage.setItem('has_seen_intro_v1', '1');
          if (!cancelled) setDest('intro'); // 第一次 → 先去 intro
        }
      } catch {
        if (!cancelled) setDest('home');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (dest === 'checking') {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop:8, color:'#888' }}>載入中…</Text>
      </View>
    );
  }

  if (dest === 'intro') {
    return <Redirect href="/intro" />;
  }

  // 直接去 tabs（tabs 的默認頁即你嘅揀卷頁 app/(tabs)/index.tsx）
  return <Redirect href="/(tabs)" />;
}
