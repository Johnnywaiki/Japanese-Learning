// app/intro.tsx
import { useEffect } from 'react';
import { ImageBackground, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function IntroScreen() {
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/(tabs)'); // 或 '/(tabs)/index' 視乎你嘅初始 tab
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <ImageBackground
      // <<<<<< 重要：用相對於 app/intro.tsx 的路徑
      source={require('../assets/splash.png')}
      resizeMode="cover"
      style={styles.bg}
    >
      <View style={styles.bottom}>
        <ActivityIndicator />
        <Text style={styles.caption}>準備中…</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', bottom: 60, alignItems: 'center' },
  caption: { marginTop: 8, color: '#fff' },
});
