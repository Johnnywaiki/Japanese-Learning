import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useQuiz } from '../src/store/useQuiz';

export default function Index() {
  const { init } = useQuiz();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await init({} as any); } finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [init]);

  if (!ready) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop:8, color:'#888' }}>載入中…</Text>
      </View>
    );
  }
  return <Redirect href="/(tabs)/practice" />;
}
