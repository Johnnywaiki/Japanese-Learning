// app/intro.tsx
import { useEffect } from 'react';
import { ImageBackground, View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

// 如果 assets/ 喺專案根目錄，intro.tsx 喺 app/ 之下，就用 ../
import splashImg from '../assets/splash.png';

export default function IntroScreen() {
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/(tabs)'); // 跳去底部 tabs（你嘅揀卷頁）
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <ImageBackground
      source={splashImg}
      resizeMode="cover"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', bottom: 60, alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: '#fff' }}>準備中…</Text>
      </View>
    </ImageBackground>
  );
}
