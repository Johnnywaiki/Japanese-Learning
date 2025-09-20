// components/EditScreenInfo.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EditScreenInfo({ path }: { path: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit this screen:</Text>
      <Text style={styles.path}>{path}</Text>
      <Text style={styles.hint}>你可以刪除呢個組件或者自定義內容。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  title: { fontWeight: '600' },
  path: { fontFamily: 'Courier', color: '#888' },
  hint: { color: '#888' },
});
