# Design Snapshot

- Generated: 2025-09-22 13:34:31
- Project: Language-app

## Project Structure (3 levels)
```text
.
./.expo
./.expo/types
./.git
./.history
./.history/app
./.history/app/(tabs)
./.history/app/components
./.history/app/practice
./.history/app/types
./.history/components
./.history/src
./.history/src/db
./.history/src/features
./.history/src/lib
./.history/src/remote
./.history/src/store
./.history/src/tts
./.history/types
./app
./app/(tabs)
./assets
./assets/image
./components
./constants
./node_modules
./src
./src/db
./src/features
./src/features/practice
./src/lib
./src/remote
./src/store
./src/tts
./types

./.expo/devices.json
./.expo/README.md
./.expo/types/router.d.ts
./.history/app_20250902163708.json
./.history/app_20250902175925.json
./.history/app_20250902181728.json
./.history/app_20250902182958.json
./.history/app_20250902183541.json
./.history/app_20250909160919.json
./.history/app_20250918160222.json
./.history/app_20250918161610.json
./.history/app_20250918170022.json
./.history/app_20250918180306.json
./.history/app_20250918182058.json
./.history/app/_layout_19851026171459.tsx
./.history/app/_layout_20250910165228.tsx
./.history/app/_layout_20250910170042.tsx
./.history/app/_layout_20250916133252.tsx
./.history/app/_layout_20250916133727.tsx
./.history/app/_layout_20250916160341.tsx
./.history/app/_layout_20250916161153.tsx
./.history/app/_layout_20250916161846.tsx
./.history/app/_layout_20250916162609.tsx
./.history/app/_layout_20250916162759.tsx
./.history/app/_layout_20250916163631.tsx
./.history/app/_layout_20250916164658.tsx
./.history/app/_layout_20250916165009.tsx
./.history/app/_layout_20250916173406.tsx
./.history/app/_layout_20250916180738.tsx
./.history/app/_layout_20250917093223.tsx
./.history/app/_layout_20250917095156.tsx
./.history/app/_layout_20250917100430.tsx
./.history/app/_layout_20250917102050.tsx
./.history/app/_layout_20250918172250.tsx
./.history/app/_layout_20250918173730.tsx
./.history/app/_layout_20250922103426.tsx
./.history/app/+not-found_19851026171459.tsx
./.history/app/+not-found_20250916201419.tsx
./.history/app/+not-found_20250916201520.tsx
./.history/app/+not-found_20250916201604.tsx
./.history/app/+not-found_20250916201655.tsx
./.history/app/+not-found_20250917092905.tsx
./.history/app/+not-found_20250917092913.tsx
./.history/app/index_20250902170406.tsx
./.history/app/index_20250902170447.tsx
./.history/app/index_20250902170541.tsx
./.history/app/index_20250917093223.tsx
./.history/app/index_20250917095156.tsx
./.history/app/index_20250917100430.tsx
./.history/app/index_20250917105009.tsx
./.history/app/index_20250918152922.tsx
./.history/app/index_20250920124432.tsx
./.history/app/intro_20250918152525.tsx
./.history/app/intro_20250918152547.tsx
./.history/app/intro_20250918154150.tsx
./.history/app/intro_20250918154914.tsx
./.history/app/intro_20250918160048.tsx
./.history/app/level_20250920124249.tsx
./.history/app/level_20250920124432.tsx
./.history/app/modal_19851026171459.tsx
./.history/app/modal_20250917092905.tsx
./.history/app/modal_20250917092912.tsx
./.history/app/modal_20250917094718.tsx
./.history/app/modal_20250917094803.tsx
./.history/app/result_20250922014715.tsx
./.history/app/result_20250922103426.tsx
./.history/app/result_20250922103516.tsx
./.history/app/settings_20250910123542.tsx
./.history/app/settings_20250910161703.tsx
./.history/app/settings_20250910165228.tsx
./.history/app/settings_20250910170042.tsx
./.history/app/settings_20250911182011.tsx
./.history/app/settings_20250915114132.tsx
./.history/app/settings_20250916180942.tsx
./.history/app/settings_20250916181047.tsx
./.history/app/settings_20250916181621.tsx
./.history/app/settings_20250918151651.tsx
./.history/components/EditScreenInfo_20250917094057.tsx
./.history/components/EditScreenInfo_20250917094215.tsx
./.history/components/Themed_20250916201759.tsx
./.history/components/Themed_20250917094035.tsx
./.history/components/Themed_20250917094219.tsx
./.history/package_20250916135128.json
./.history/package_20250916135148.json
./.history/package_20250916172846.json
./.history/package_20250918182453.json
./.history/tsconfig_19851026171459.json
./.history/tsconfig_20250902165548.json
./.history/tsconfig_20250902184643.json
./.history/tsconfig_20250916180738.json
./.history/tsconfig_20250916191258.json
./.history/tsconfig_20250916192128.json
./.history/tsconfig_20250916193027.json
./.history/tsconfig_20250916194612.json
./.history/tsconfig_20250916195811.json
./.history/tsconfig_20250916195905.json
./.history/tsconfig_20250916201655.json
./.history/types/images.d_20250918165944.ts
./.history/types/images.d_20250918170022.ts
./app.json
./app/_layout.tsx
./app/(tabs)/_layout.tsx
./app/(tabs)/home.tsx
./app/(tabs)/index.tsx
./app/(tabs)/mistakes.tsx
./app/(tabs)/practice.tsx
./app/(tabs)/translate.tsx
./app/+html.tsx
./app/+not-found.tsx
./app/index.tsx
./app/intro.tsx
./app/level.tsx
./app/modal.tsx
./app/result.tsx
./app/settings.tsx
./components/EditScreenInfo.tsx
./components/Themed.tsx
./constants/Colors.ts
./design_snapshot.md
./expo-env.d.ts
./package-lock.json
./package.json
./src/db/index.ts
./src/db/remote.ts
./src/db/schema.ts
./src/lib/progress.ts
./src/remote/supabase.ts
./src/store/useQuiz.ts
./src/store/useSettings.ts
./src/tts/index.ts
./tsconfig.json
./types/expo-file-system-augment.d.ts
./types/images.d.ts
```

## Key Design Index (grep)
```text
app/settings.tsx:9:import { useQuiz } from '../src/store/useQuiz';
app/settings.tsx:22:  const s = StyleSheet.create({
app/settings.tsx:48:export default function SettingsScreen() {
app/settings.tsx:52:  const { init } = useQuiz();
app/settings.tsx:149:        <Pressable onPress={() => router.replace('/(tabs)')} style={[s.pill, s.pillActive, { alignSelf: 'flex-start' }]}>
app/index.tsx:9:export default function Index() {
app/index.tsx:14:        if (lv) router.replace('/(tabs)/home');
app/index.tsx:15:        else router.replace('/level');
app/index.tsx:17:        router.replace('/level');
app/intro.tsx:6:export default function IntroScreen() {
app/intro.tsx:9:      router.replace('/(tabs)'); // 或 '/(tabs)/index' 視乎你嘅初始 tab
app/intro.tsx:29:const styles = StyleSheet.create({
app/result.tsx:6:export default function ResultModal() {
app/result.tsx:31:    router.replace(from === 'home' ? HOME : INDEX);
app/result.tsx:71:const s = StyleSheet.create({
app/(tabs)/index.tsx:13:import { useQuiz } from '../../src/store/useQuiz';
app/(tabs)/index.tsx:35:  const s = StyleSheet.create({
app/(tabs)/index.tsx:96:export default function PracticeFilterScreen() {
app/(tabs)/index.tsx:99:  const { init } = useQuiz();
app/(tabs)/index.tsx:137:    void init(base).then(() => router.navigate('/(tabs)/practice'));
app/(tabs)/practice.tsx:10:import { useQuiz } from '../../src/store/useQuiz';
app/(tabs)/practice.tsx:33:  const s = StyleSheet.create({
app/(tabs)/practice.tsx:85:export default function PracticeScreen() {
app/(tabs)/practice.tsx:95:  } = useQuiz();
app/(tabs)/practice.tsx:119:      if (mode === 'daily') router.replace('/(tabs)/home');
app/(tabs)/practice.tsx:120:      else router.replace('/(tabs)/index');
app/(tabs)/practice.tsx:136:  const onPickNewPaper = useCallback(() => { router.replace('/(tabs)'); }, []);
app/(tabs)/translate.tsx:4:export default function TranslateScreen() {
app/(tabs)/home.tsx:15:import { useQuiz } from '../../src/store/useQuiz';
app/(tabs)/home.tsx:53:  const s = StyleSheet.create({
app/(tabs)/home.tsx:170:export default function HomeScreen() {
app/(tabs)/home.tsx:231:      const ok = await useQuiz.getState().init({
app/(tabs)/home.tsx:241:      if (ok) router.push('/(tabs)/practice');
app/(tabs)/_layout.tsx:7:export default function TabsLayout() {
app/(tabs)/mistakes.tsx:43:  const s = StyleSheet.create({
app/(tabs)/mistakes.tsx:104:export default function MistakesScreen() {
app/+not-found.tsx:6:export default function NotFoundScreen() {
app/+not-found.tsx:21:const styles = StyleSheet.create({
app/_layout.tsx:10:export default function RootLayout() {
app/level.tsx:17:  const s = StyleSheet.create({
app/level.tsx:35:export default function LevelScreen() {
app/level.tsx:41:    router.replace('/(tabs)/home');
app/modal.tsx:7:export default function ModalScreen() {
app/modal.tsx:20:const styles = StyleSheet.create({
app/+html.tsx:7:export default function Root({ children }: { children: React.ReactNode }) {
src/db/remote.ts:4:import { createClient, type SupabaseClient } from '@supabase/supabase-js';
src/db/remote.ts:22:    console.warn('[supabase] missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
src/db/remote.ts:25:  _sb = createClient(url, anon, { db: { schema: 'public' } });
src/db/index.ts:41:    console.log(ok ? '[seed] synced from supabase' : '[seed] supabase unavailable');
src/db/index.ts:57:export function getAllForFilter(f: PracticeFilter): { pool: PoolQuestion[] } {
src/store/useQuiz.ts:1:// src/store/useQuiz.ts
src/store/useQuiz.ts:5:  getAllForFilter,
src/store/useQuiz.ts:98:export const useQuiz = create<State>((set, get) => ({
src/store/useQuiz.ts:136:        console.warn('[useQuiz.init] daily pool empty:', daily_key);
src/store/useQuiz.ts:149:      const r = getAllForFilter(f);
src/store/useQuiz.ts:161:        console.warn('[useQuiz.init] mock pool empty:', { raw });
src/remote/supabase.ts:1:// src/remote/supabase.ts
src/remote/supabase.ts:2:import { createClient } from '@supabase/supabase-js';
src/remote/supabase.ts:13:export const supabase = url && anon
src/remote/supabase.ts:14:  ? createClient(url, anon, { auth: { persistSession: false } })
```

## File: package.json
```json
{
  "name": "language-app",
  "main": "expo-router/entry",
  "version": "1.0.0",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest --watchAll"
  },
  "jest": {
    "preset": "jest-expo"
  },
  "dependencies": {
    "@expo/vector-icons": "^15.0.2",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-navigation/native": "^7.1.6",
    "@supabase/supabase-js": "^2.57.4",
    "expo": "54.0.8",
    "expo-asset": "~12.0.9",
    "expo-constants": "~18.0.9",
    "expo-file-system": "19.0.14",
    "expo-font": "~14.0.8",
    "expo-linear-gradient": "~15.0.7",
    "expo-linking": "~8.0.8",
    "expo-router": "~6.0.7",
    "expo-speech": "~14.0.7",
    "expo-splash-screen": "~31.0.10",
    "expo-sqlite": "~16.0.8",
    "expo-status-bar": "~3.0.8",
    "expo-system-ui": "~6.0.7",
    "expo-web-browser": "~15.0.7",
    "install": "^0.13.0",
    "jest-expo": "~54.0.12",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.4",
    "react-native-gesture-handler": "~2.28.0",
    "react-native-get-random-values": "~1.11.0",
    "react-native-reanimated": "~4.1.0",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-url-polyfill": "^2.0.0",
    "react-native-web": "^0.21.0",
    "zustand": "^5.0.8"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/node": "^24.5.0",
    "@types/react": "^19.1.13",
    "babel-plugin-module-resolver": "^5.0.2",
    "jest": "^29.2.1",
    "jest-expo": "~54.0.11",
    "react-test-renderer": "^19.1.0",
    "typescript": "~5.9.2"
  },
  "private": true
}
```

## File: tsconfig.json
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./*"
      ]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

## File: app.json
```json
{
  "expo": {
    "name": "Language-app",
    "slug": "Language-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "languageapp",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "edgeToEdgeEnabled": true,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-font",
      "expo-web-browser",
      "expo-asset"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "EXPO_PUBLIC_SUPABASE_URL": "https://nhviizcdqtylwxcpygpx.supabase.co",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odmlpemNkcXR5bHd4Y3B5Z3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNTg5NzYsImV4cCI6MjA3MjYzNDk3Nn0.-zaOLHNQHasEQhc0tRZvSoGzZSFyKMQkV19TCmV7XHI",
      "router": {}
    }
  }
}
```

