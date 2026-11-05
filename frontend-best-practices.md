# Frontend Best Practices

Generic guidance for building maintainable, performant, production-ready frontend apps (React-oriented, but most principles are framework-agnostic).

> **Legend:** Items marked **[+]** are additions not present in the source findings. Everything else is derived directly from them.

---

## Contents
1. Remote state with a query library
2. Feature-based structure
3. Code splitting and lazy loading
4. Service / API layer
5. Loading, error, empty, and fallback states
6. Security and production risks
7. Testing
8. Accessibility, performance, and quality [+]
9. Acceptance checklist

---

## 1. Remote state with a query library

**Principle:** Server data belongs in a query cache, not in hand-rolled `useEffect` + `useState` blocks.

**Why:** Manual fetching causes duplicated code, inconsistent caching, duplicate requests, and awkward refresh/error handling.

**Rules**
- Use TanStack Query (React Query) or an equivalent. Mount a `QueryClientProvider` near the app root.
- Convert reads to query hooks; convert writes and downloads to mutations where appropriate.
- Set stale times and retry behavior **per feature**, not globally by accident.
- Centralize error handling and the labeling of fallback data.
- Start converting with the most common, cache-friendly data (e.g., lists that many pages use), then move outward.
- Name hooks by what they fetch and colocate them with the feature:
```text
src/features/<feature>/api/useThing.js
src/features/<feature>/api/useUpdateThing.js
```
- **[+]** Use structured, hierarchical query keys (`['feature', 'resource', params]`) so invalidation is predictable.
- **[+]** Invalidate or update related queries after mutations; use optimistic updates only where failure is cheap to roll back.
- **[+]** Do not mirror query data into local state; derive it with selectors.

---

## 2. Feature-based structure

**Principle:** Pages are thin route shells. Each feature owns its UI, hooks, API wrappers, and helpers.

**Rules**
- `pages/*Page.jsx` only wires routing to feature components.
- Feature-specific UI goes in `features/<feature>/components`.
- Feature hooks go in `features/<feature>/hooks` or `api`.
- Feature transformations and selectors go in `features/<feature>/utils`.
- Put code in global folders (`components`, `services`) **only** when more than one feature uses it.
- Move only cross-feature API/client primitives to `services` or `lib`.

**Recommended structure**
```text
src/
  app/            # providers, router setup, app-level config
  pages/          # thin route shells
  features/
    <feature>/
      api/
      components/
      hooks/
      utils/
  components/     # global reusable UI only
  services/       # shared HTTP client / base utilities only
  contexts/       # auth/theme/i18n providers if still needed
```

**Smells to watch for**
- A single page file that fetches, holds fallback data, manages UI state, transforms data, renders charts, and handles forms.
- Fallback/mock data duplicated across multiple pages.
- **[+]** Features importing from each other's internals (import through a feature's public entry point instead).

---

## 3. Code splitting and lazy loading

- Wrap route components in `React.lazy` + `Suspense`.
- Lazy-load heavy maps, charts, and report UIs inside features where needed.
- Use one consistent route-level loading placeholder.
- Run a production build before and after splitting and compare chunk sizes to confirm the gain.
- **[+]** Preload likely-next routes on hover/idle for perceived speed.
- **[+]** Use dynamic imports for heavy third-party libraries, not just routes.
- **[+]** Set and monitor a bundle-size budget in CI.

---

## 4. Service / API layer

- Keep **one** shared HTTP client (e.g., Axios) with interceptors.
- Place feature endpoint wrappers next to the feature that owns them; query hooks call those wrappers.
- Avoid one global file holding every feature's API calls (it becomes a merge hotspot with unclear ownership).
- Keep binary/file download behavior explicit and tested.
- Never duplicate fallback data inside multiple UI pages.
- **[+]** Validate or type API responses at the boundary (e.g., Zod or TypeScript types) so contract drift fails loudly.
- **[+]** Use request cancellation (AbortSignal) so stale requests don't overwrite newer state.

---

## 5. Loading, error, empty, and fallback states

**Principle:** Degraded mode is acceptable for resilience, but it must be visible and distinguishable from live data.

- Provide shared components: `LoadingState`, `ErrorState`, `EmptyState`, `FallbackDataBanner`.
- Drive them from query status fields (`isLoading`, `isError`, `isFetching`, empty data) for consistency.
- Always label mock/fallback data in the UI. Silent fallback hides backend failures.
- Track and log fallback usage in production/staging.
- **[+]** Use skeleton loaders that match final layout to avoid layout shift.
- **[+]** Offer a retry action on error states.
- **[+]** Add an error boundary at the route level so one feature failing doesn't blank the app.
- **[+]** Show "last updated" times on time-sensitive data.

---

## 6. Security and production risks

- Prefer secure, `HttpOnly` cookie-based auth over `localStorage` bearer tokens when deployment demands stronger security.
- Handle 401s through an auth/logout event or router navigation, not a hard `window.location` redirect in the HTTP interceptor.
- Keep all source files UTF-8 and fix corrupted (mojibake) strings.
- Provide a `.env.example` at the project root, or clearly document where it lives.
- **[+]** Never put secrets in frontend env vars; anything bundled is public.
- **[+]** Avoid `dangerouslySetInnerHTML` with untrusted content; sanitize if unavoidable.
- **[+]** Set a Content Security Policy and audit dependencies regularly.

---

## 7. Testing

- Add frontend route tests and feature-level component/hook tests (made easier by colocated features).
- Test download/binary flows explicitly.
- Keep backend schemas and frontend response assumptions aligned and tested.
- **[+]** Test hooks with a fresh `QueryClient` per test and mock the feature API wrapper, not the network library.
- **[+]** Run lint, build, and tests in CI; add an encoding check.

---

## 8. Accessibility, performance, and quality [+]

- **[+]** Semantic HTML, keyboard navigation, visible focus, and ARIA only where semantics are insufficient.
- **[+]** Don't convey meaning by color alone (important for charts and status indicators).
- **[+]** Memoize only after measuring; prefer fixing data flow and splitting components first.
- **[+]** Virtualize long lists and lazy-load images.
- **[+]** Centralize i18n strings and theme tokens rather than hardcoding.
- **[+]** Use ESLint/Prettier and consistent naming conventions.

---

## 9. Acceptance checklist

A frontend refactor task is done only when:

- [ ] Remote data loads through feature query hooks, not duplicated `useEffect` blocks.
- [ ] Page components are thin route shells; feature code is colocated under `features/`.
- [ ] Shared components/services contain only genuinely cross-feature code.
- [ ] Fallback/mock data is visible to users and distinguishable from live data.
- [ ] Routes are lazy-loaded and chunk sizes verified after a production build.
- [ ] The production build passes and key routes have tests.
