module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],     // ✅ 用 preset，唔再用 expo-router/babel
    plugins: ['react-native-reanimated/plugin'], // ✅ 一定放最後
  };
};