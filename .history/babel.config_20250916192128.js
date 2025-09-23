module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-worklets/plugin', // 取代舊的 'react-native-reanimated/plugin'
      // 千祈唔好再放 'expo-router/babel'
    ],
  };
};
