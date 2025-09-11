// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // 開 app 時直接跳去 (tabs) 的「練習/設定」tab 組
  return <Redirect href="/(tabs)" />;
}
