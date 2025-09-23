// components/Themed.tsx
import { Text as RNText, View as RNView, TextProps, ViewProps } from 'react-native';
export const Text = (p: TextProps) => <RNText {...p} />;
export const View = (p: ViewProps) => <RNView {...p} />;
