// components/Themed.tsx
import React from 'react';
import {
  Text as RNText,
  View as RNView,
  type TextProps,
  type ViewProps,
  useColorScheme,
} from 'react-native';

type Extra = { lightColor?: string; darkColor?: string };

export function Text({ lightColor, darkColor, style, ...rest }: TextProps & Extra) {
  const isDark = useColorScheme() === 'dark';
  const color = isDark ? (darkColor ?? '#fff') : (lightColor ?? '#111');
  return <RNText {...rest} style={[{ color }, style]} />;
}

export function View({ lightColor, darkColor, style, ...rest }: ViewProps & Extra) {
  const isDark = useColorScheme() === 'dark';
  const backgroundColor = isDark ? (darkColor ?? '#000') : (lightColor ?? '#fff');
  return <RNView {...rest} style={[{ backgroundColor }, style]} />;
}

export default {};
