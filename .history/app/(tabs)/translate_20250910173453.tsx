import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native';

export default function TranslateScreen() {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent:'center', alignItems:'center' }}>
      <Text>翻譯功能（開發中）</Text>
    </SafeAreaView>
  );
}