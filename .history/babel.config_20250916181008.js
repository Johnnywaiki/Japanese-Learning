module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-worklets/plugin', // 代替舊的 react-native-reanimated/plugin
      // **不要再放** 'expo-router/babel'
    ],
  };
};
