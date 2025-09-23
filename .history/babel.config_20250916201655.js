module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 令 Metro 亦支援 alias（TS 只係型別階段）
      ['module-resolver', {
        alias: { '@': './' },
        extensions: ['.tsx', '.ts', '.js', '.jsx', '.json']
      }],
      // Reanimated 4 用呢個（避免舊提示）
      'react-native-worklets/plugin',
    ],
  };
};
