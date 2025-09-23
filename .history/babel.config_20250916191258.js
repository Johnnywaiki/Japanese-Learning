// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated plugin 已搬到 worklets
      'react-native-worklets/plugin',
      // ❌ 刪除 'expo-router/babel'（已被 preset 取代）
    ],
  };
};
