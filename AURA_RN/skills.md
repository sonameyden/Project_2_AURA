# AURA React Native Development Skills

Project-specific guidance for developing AURA_RN. Follow this alongside
[AGENTS.md](./AGENTS.md), the [README](./README.md), and the official
documentation for the versions in `package.json`.

## Project baseline

- App: Expo SDK 58, React Native 0.88, TypeScript (strict), Expo Router, and
  React Native Web.
- Keep AURA_RN's existing structure. Do not introduce a second routing,
  state-management, styling, or API-client convention without a clear need.
- The app talks to the existing AURA backend. Firebase ID tokens authenticate
  requests; the app must not connect directly to Supabase or R2.
- `src/app/` is for Expo Router routes and layouts. Keep route files small and
  render screens from `src/features/`.

## Architecture and ownership

Keep dependencies flowing from routes and UI, through feature logic, to shared
services:

```text
src/
  app/          Expo Router route files and layouts only
  features/     Feature screens, UI, hooks, and feature-specific logic
  components/   UI shared across multiple features
  core/         Shared API, auth, query, playback, theme, and app infrastructure
  hooks/        Hooks genuinely shared across features
  constants/    Shared constants
  types/        Shared platform or library type compatibility
```

- A route should connect a URL and navigation parameters to a feature screen;
  it should not become the home for feature business logic.
- Keep feature-specific screens, hooks, and UI with their feature. Promote code
  to `components/`, `hooks/`, or `core/` only when it is genuinely shared.
- Keep screens focused on presentation and user interaction. Put server state
  and reusable data logic in hooks, and transport/authentication concerns in
  `core/`.
- Preserve the current structure instead of creating parallel `pages/`,
  `services/`, or `contexts/` trees.
- Use lowercase kebab-case for new non-component filenames and PascalCase for
  React component files, following nearby conventions.

Every feature folder uses the same layout. Screens (what `src/app/` routes
re-export) stay at the top; everything else goes in a subfolder. Create a
subfolder only when it has something in it:

```text
features/<feature>/
  XxxScreen.tsx   Screens rendered by routes
  components/     UI used only by this feature
  hooks/          Query/mutation hooks used only by this feature
  lib/            Plain logic with no React (easy to unit test)
  __tests__/      Tests for this feature
```

- Inside a feature, import with relative paths (`./components/…`,
  `../lib/…`). Across folders, use the `@/` alias.
- Features never import from other features. When a second feature needs
  something, move it to `src/components/ui/` (UI), `src/hooks/` (hooks), or
  `src/core/` (infrastructure). Today `src/hooks/` holds
  `use-liked-songs`, `use-open-add-to-playlist` and `use-user-profile`.
- Only `src/app/` imports from `features/`, and only screens (plus the
  root layout's `MiniPlayer`).

## React Native and cross-platform UI

- Use React Native primitives and Expo-compatible APIs, not browser DOM
  elements in native screens. Keep platform-specific implementations isolated
  in `.native.tsx` and `.web.tsx` files when behavior must differ.
- Build responsive layouts with flexbox, safe-area-aware containers, and AURA's
  shared theme. Avoid fixed device-specific layouts and repeated hard-coded
  colors or spacing.
- Use `Pressable` for interactive controls and provide meaningful
  `accessibilityRole`, `accessibilityLabel`, and state where appropriate.
  Keep touch targets usable, support text scaling, and do not communicate state
  through color alone.
- Use `FlatList` for long or growing collections; reserve `ScrollView` for
  short content. Give list items stable keys and avoid expensive work in render
  paths.
- Use Expo-compatible image, audio, and other device APIs. Request permissions
  only when needed and provide a clear experience if permission is denied.
- Measure before optimizing. Prefer clear data flow and smaller components;
  memoize or add virtualization tuning when profiling shows a need.

## State and data fetching

- Keep remote/server data in TanStack Query. Use React state or existing
  providers for transient UI, session, playback, and theme state.
- Do not duplicate query data into component state. Derive display values from
  query results where possible.
- Use feature-owned query hooks and descriptive hierarchical query keys.
  Include the signed-in user's ID in user-scoped keys; retain the existing
  cache-clearing behavior when the account changes.
- Keep API requests behind `src/core/api/` and use the existing `auraApi`
  methods. `client.ts` is the only HTTP client; endpoints are grouped by
  backend area (`catalog.ts`, `artists.ts`, `discover.ts`, `library.ts`,
  `playlists.ts`, `atmosphere.ts`) and combined in `index.ts`. Do not build
  backend URLs or attach auth headers in screens.
- Keep frontend data types aligned with `AURA_Backend/src/types.ts`. Treat
  backend changes and corresponding frontend assumptions as one contract
  change; do not silently substitute mock data when a request fails.
- Data-driven screens should handle loading, error (with a retry when useful),
  empty, and success states. Make intentional fallback content distinguishable
  from live data.
- After a mutation, invalidate or update the affected query keys. Use
  optimistic updates only when rollback behavior is clear.
- Propagate cancellation signals for requests when adding cancellation support
  to the shared client and query functions.
- Keep query retry and cache behavior appropriate to the feature. Avoid
  retrying authentication/authorization failures as ordinary transient errors.

## Authentication, security, and backend boundaries

- Retrieve Firebase ID tokens through the existing auth flow. The API client
  attaches the bearer token; never copy the old Android development-secret
  header into this app.
- `EXPO_PUBLIC_*` values are shipped in the client bundle. They may contain
  public client configuration, but never server credentials, private keys,
  service-role tokens, or other secrets.
- Keep authentication material in the existing SecureStore-backed native
  Firebase persistence. Do not store tokens or secrets in AsyncStorage.
- Use the configured backend URL and HTTPS outside local development. Do not
  put environment-specific URLs in feature screens.
- Validate user input for a helpful experience, but rely on the backend to
  enforce authorization, ownership, and security rules.
- Surface actionable errors. Do not swallow request failures or turn them into
  success-shaped empty data.

## Expo and native changes

- Before changing an Expo, EAS, or React Native API, follow `AGENTS.md`: check
  the installed major version and consult its matching official Expo
  documentation. Do not assume APIs from another SDK version still apply.
- Add Expo dependencies with `npx expo install <package>` so native package
  versions match the installed SDK. Check New Architecture compatibility for
  native libraries.
- Prefer app config and config plugins for native configuration. Make changes
  under `android/` only when a task requires native project changes, and keep
  them reproducible with the Expo configuration.
- The app must keep running in Expo Go on Android and iOS. Only use native
  modules that Expo Go bundles (`npx expo install` picks matching versions).
  Background audio and lock screen controls need a development or production
  build; guard them with `isExpoGo` from `src/core/runtime.ts`.
- Follow `eas.json` profiles for builds and updates. OTA updates must not be
  used for changes that require a new native binary.

## Quality checks

- Keep TypeScript strict and ESLint clean. Avoid `any`, unsafe casts, and
  disabling checks to get a build through.
- Add or update focused tests for new behavior. The app uses Jest with the
  `jest-expo` preset; tests live in `__tests__/` folders next to the code they
  cover. Keep logic worth testing in plain modules (e.g. `core/player/queue.ts`,
  `features/player/lib/sections.ts`) so tests don't need to render screens.
- Before considering a code change complete, run the relevant checks:

  ```sh
  npm run lint
  npm run typecheck
  npm test
  npx expo export --platform android
  npx expo export --platform web
  ```

- Test native-only behavior in a development build and verify platform-specific
  behavior on the platforms affected by the change.

## Current structure: alignment and improvement areas

The app follows TypeScript strict mode, Expo Router routes under `src/app/`,
feature-owned screens and hooks, shared cross-cutting code in `src/core/`,
platform-specific auth files, one API client, and TanStack Query with
account-scoped keys and cache clearing.

Where things live now:

- `src/core/api/` — HTTP client and endpoint groups (see above).
- `src/core/player/` — `PlayerProvider` (two expo-audio players for
  crossfade), pure queue rules in `queue.ts`, and the live audio analyser in
  `use-audio-reactivity.ts`. `usePlayer()` holds rarely-changing state;
  `usePlaybackProgress()` holds position/lyric state that updates ~4×/second,
  so only components that need the position re-render.
- `src/core/settings/` — device-only preferences (visual intensity, reduced
  motion, text size, high contrast, crossfade, cat visibility) and
  `useVisualTier()` for visual layers. Shared text components apply the text
  size; the theme applies high contrast.
- `src/components/ui/` — one shared component per file, re-exported from
  `index.ts` so imports stay `@/components/ui`.
- `src/features/player/` — Now Playing layers. `lib/sections.ts` turns the
  atmosphere's section timeline into a `SceneLook` for the current moment;
  `EnvironmentBackdrop`, `NowPlayingScene`, `CatCompanion` and
  `KaleidoscopeLayer` follow that look and crossfade when it changes.
- `src/features/library/` — playlists with live collaboration (polling every
  few seconds while open), sharing and invites (`/invite/[code]`).
- `src/features/profile/` — own profile editing and public profiles
  (`/user/[id]`).

Keep improving incrementally in these areas:

- Continue checking each data screen for explicit loading, error, empty, and
  retry states; the shared infrastructure does not guarantee every screen
  presents all of them.
- Older screens (artist dashboard, album creation, upload) still call
  `auraApi` directly inside event handlers; move them to feature-owned
  mutation hooks when they are next changed.
- There is no offline cache yet (the Kotlin app used Room); if offline
  browsing is needed, persist TanStack Query rather than adding a second store.

These are improvement opportunities, not a reason to restructure the app in a
single refactor.

## References

- [React Native Cross-Platform Development Guide: Frontend and Backend Best Practices](../React%20Native%20Cross-Platform%20Development%20Guide%20Frontend%20and%20Backend%20Best%20Practices.pdf)
- [Frontend best practices](../frontend-best-practices.md)
- [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
