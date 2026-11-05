# AURA React Native

Cross-platform React Native app for AURA, built with Expo, TypeScript, and Expo Router. The original Kotlin app remains in `../AURA`; this app reuses the Cloudflare Worker backend and its Firebase ID-token authentication.

## Run locally

1. Install Node.js 24 or newer.
2. From this folder, install dependencies with `npm ci`.
3. Copy `.env.example` to `.env`. In Firebase Console, open **Project settings → General → Your apps** and copy the config values for the Firebase Web app into the matching `EXPO_PUBLIC_FIREBASE_*` entries. If there is no Web app yet, register one first. The backend URL defaults to the deployed URL used by the Kotlin app; override `EXPO_PUBLIC_API_URL` if your deployment differs.
4. Enable Email/Password sign-in in Firebase Authentication and ensure `EXPO_PUBLIC_FIREBASE_PROJECT_ID` matches the backend's `FIREBASE_PROJECT_ID`.
5. To use the app in a standard Expo Go session, run `npx expo start --go`. Native-only features such as Rive and background audio are not available in Expo Go. For the full app on Android without installing Android Studio, create a custom development build with EAS:

   ```sh
   npm install --global eas-cli
   eas login
   eas init
   eas build --platform android --profile development
   ```

   Install the generated APK on your phone. Before building, add `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, and `EXPO_PUBLIC_FIREBASE_APP_ID` to the Expo project's **development** environment at [expo.dev](https://expo.dev). Local `.env` files are not uploaded to EAS Build. These `EXPO_PUBLIC_*` values are included in the client bundle; do not put server secrets in them.

   After installing the development build, start the bundler with `npx expo start --dev-client --tunnel` and open AURA's development app (not Expo Go). The build uses the `development` profile in `eas.json` and produces an installable APK.

   Alternatively, with Android Studio and a local Android toolchain installed, run `npx expo run:android`. iOS native builds require macOS. `npm run web` starts the web build.

`EXPO_PUBLIC_*` values are bundled into the client. Firebase client configuration is not a server secret; restrict its API key in Google Cloud. Never put OpenAI, Supabase service-role, Genius, or other server credentials in this app. Requests use the signed-in Firebase user's bearer token; the old Android dev-secret header is intentionally not copied. Native Firebase Auth persistence uses `expo-secure-store`; theme preferences use AsyncStorage.

Background playback is enabled by the `expo-audio` config plugin. The Kotlin login animation is bundled under `assets/rive/` and rendered with Rive on native platforms. Rive and background audio require a development/production native build (`npx expo run:android`, EAS Build, or an iOS build on macOS); Expo Go does not include these native modules/config changes. `expo-dev-client` is installed to support the custom development app.

## Architecture

```text
src/
  app/          Expo Router routes and tab layouts
  components/   Shared accessible UI primitives
  core/         API client, Firebase auth, playback, theme, models
  features/     Feature screens, data hooks, and platform-specific UI
  types/        Platform SDK type compatibility
```

- Feature routes own loading, empty, and error states; API and playback logic live outside the presentation layer.
- TanStack Query owns the discovery, catalog-search, and playlist-list server caches; query keys are scoped to the signed-in user and caches are cleared when the account changes. Extend feature-owned query hooks to remaining screens as they are migrated.
- API DTOs match `AURA_Backend/src/types.ts`. A small fetch client attaches Firebase tokens, reports HTTP/network errors, and never talks to Supabase or R2 directly.
- Firebase auth persists in SecureStore on iOS/Android and browser persistence on web.
- Expo Router provides typed, file-based navigation for iOS, Android, and web. Platform-specific Firebase persistence is isolated in `.native.ts` and `.web.ts` modules.
- Expo Audio streams catalog URLs, supports queue controls and background playback, and drives time-based lyric highlighting. The atmosphere profile colors the Now Playing scene.

## Backend integration

The app implements the existing `/catalog`, `/atmosphere`, `/lyrics`, and `/library` routes, including search, mood discovery, profile updates, favorites, listening history, playlists, artist following, albums, and creator uploads. The Worker CORS allow-list includes the HTTP methods used by the browser build; native requests do not use browser CORS.

The Kotlin app's login and sign-up background animation is bundled at `assets/rive/auth-background.riv`. The Kotlin Now Playing environments are procedural Compose visuals, and the other environment `.riv` files mentioned in Kotlin source are not present in the assets folder. The React Native cat companion and atmosphere scene currently use native UI primitives. Artist uploads require a track duration (in seconds) because the Worker requires `durationMs`; audio is capped at the backend's 50 MB limit.

## Validation

```sh
npm run typecheck
npx expo export --platform android
npx expo export --platform web
```

## References

- [AURA React Native development guidance](./skills.md)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/)
- [React Native platform-specific code](https://reactnative.dev/docs/platform-specific-code)
