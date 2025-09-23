// app/intro.tsx
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { seedIfEmpty } from '../src/db';

export default function IntroScreen() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 同步 DB（與一個最短顯示時間並行），體驗順滑
        await Promise.race([
          seedIfEmpty(),
          new Promise(res => setTimeout(res, 1400)), // 至少展示 ~1.4s
        ]);
      } finally {
        if (!cancelled) router.replace('/(tabs)'); // 去揀卷
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#111' }} edges={['left','right','bottom']}>
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24 }}>
        {/* 你可以換成自家圖片：Image / ImageBackground */}
        <Ionicons name="book-outline" size={72} color="#fff" />
        <Text style={{ marginTop:16, color:'#fff', fontSize:20, fontWeight:'700' }}>JLPT 練習</Text>
        <Text style={{ marginTop:6, color:'#bbb' }}>準備中，請稍候…</Text>
        <ActivityIndicator style={{ marginTop:16 }} color="#fff" />
      </View>
    </SafeAreaView>
  );
}
