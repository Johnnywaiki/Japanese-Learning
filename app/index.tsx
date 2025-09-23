// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // 一開 app 直接去 Intro，由 Intro 再跳 /(tabs)/home
  return <Redirect href="/intro" />;
}
