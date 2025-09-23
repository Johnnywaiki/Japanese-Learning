module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 由 Reanimated 搬去 Worklets
      'react-native-worklets/plugin',
    ],
  };
};