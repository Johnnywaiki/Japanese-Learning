import { Redirect } from 'expo-router';

export default function Index() {
  // 只負責導向，唔好喺呢度 call hooks/async
  return <Redirect href="/(tabs)/practice" />;
}
