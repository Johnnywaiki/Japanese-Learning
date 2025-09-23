// app/intro.tsx
import { useEffect } from 'react';
import { ImageBackground, View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

const splashImg = require('../assets/splash.png'); // 注意：相對 app/ 的路徑

export default function IntroScreen() {
  useEffect(() => {
    // 1～1.5 秒之後入主畫面（你可以調整）
    const t = setTimeout(() => {
      router.replace('/(tabs)'); // 去到底部 tabs（index 就係你揀卷嗰頁）
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <ImageBackground
      source={splashImg}
      resizeMode="cover"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* 可選：覆蓋一層 loading 提示 */}
      <View style={{ position: 'absolute', bottom: 60, alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: '#fff' }}>準備中…</Text>
      </View>
    </ImageBackground>
  );
}
