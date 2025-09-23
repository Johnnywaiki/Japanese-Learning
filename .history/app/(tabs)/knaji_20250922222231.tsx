// app/(tabs)/kanji.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function KanjiTab() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>漢字（開發緊）</Text>
      <Text style={{ marginTop: 8, color: '#888', textAlign: 'center' }}>
        之後會放每日漢字練習 / 題庫。
      </Text>
    </View>
  );
}
