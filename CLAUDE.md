# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Affida Mobile** — the Expo / React Native companion app for the Affida personal-finance web app (Next.js repo: `my-awesome-app`). Real users are on the web app today; mobile talks to the same production backend, so never ship anything that could mutate or wipe user data unexpectedly.

## Commands

```bash
npm install              # Install dependencies
npx expo start           # Dev server (Expo Go / dev client)
npx tsc --noEmit         # Typecheck — the main pre-commit verification
npx expo export --platform ios --output-dir /tmp/export-test   # Verify the bundle compiles
eas build --platform ios # Production build (EAS credentials configured in eas.json)
```

There is no test suite or linter in this repo; typecheck + export are the verification gates.

## Architecture

- **Expo SDK 54, expo-router v6** (file-based routing), React 19, RN 0.81
- **NativeWind 4** (Tailwind classes in RN) — theme colors in `tailwind.config.js` (`brand-bg`, `brand-surface`, `brand-accent`, etc.). Dark-mode only.
- **State**: `@tanstack/react-query` for all server state; `zustand` + `expo-secure-store` for auth (`lib/auth-store.ts`) and local settings (`lib/settings-store.ts`)
- **API**: axios client in `lib/api-client.ts` → `${EXPO_PUBLIC_API_URL}/api/mobile/*`, Bearer JWT with 401 refresh-and-retry queue. AI chat streams plain text via `expo/fetch` in `lib/chat-api.ts`.
- **Charts**: hand-rolled SVG components in `components/charts/` (DonutChart, LineChart, TrendBars) using `react-native-svg` — no chart library
- **Haptics**: always use the `haptics` wrapper from `lib/haptics.ts`, never call expo-haptics directly

### Navigation (app/(app)/_layout.tsx)

Five visible tabs: **Home (`index`), Transactions, Insights, Budgets, Goals**.
Hidden tab screens (pushed, tab bar hidden, own back button): `accounts/index`, `settings`, `assistant` (AI chat), `subscriptions` (recurring), `rules`.
Auth group `(auth)`: `login`, `mfa`. Tokenless users are redirected to login by the app layout.

### App Lock

Face ID / biometric lock lives in the app layout: `useSettingsStore.appLockEnabled` + `components/LockScreen.tsx` (expo-local-authentication). Re-locks when AppState goes to background. The toggle is in Settings and verifies biometrics before enabling. `NSFaceIDUsageDescription` is set in app.json.

### Backend endpoints used (web repo `app/api/mobile/`)

auth/token, auth/refresh, me, dashboard, accounts (+[id]), transactions (+[id], flag), categories, budgets, goals (+[id], contributions), rules (+[id]), insights, subscriptions, chat, plaid/link-token, plaid/exchange.
All responses are `{ data, error }`; mutations invalidate the matching react-query keys.

### Conventions

- Screens: `SafeAreaView` with `edges={['top']}`, header inside the ScrollView, pull-to-refresh via `RefreshControl` tinted `#5B7BF8`
- Edit/create flows are `<Modal presentationStyle="formSheet">` sheets in `components/<domain>/` (see `budgets/EditSheet.tsx` as the canonical example)
- Pickers: reuse `components/OptionPicker.tsx` and `components/transactions/CategoryPicker.tsx`
- Currency: `AmountText` component (negative = red, positive = green, `neutral` for plain)
- Skeleton placeholders (`bg-brand-elevated` blocks) while loading, designed empty states with a CTA when there's no data

## Cross-Platform Consistency

Keep this app and the web app (`my-awesome-app`) consistent — any feature, copy, or UX pattern added to one should be considered for the other. New mobile features usually need a matching `app/api/mobile/` route in the web repo first; follow the `getMobileUser` + `lib/queries/*` pattern there.

## Cost Efficiency

Never call a paid external API (OpenAI via chat, Plaid) in a loop; the backend already batches. Cache with react-query `staleTime` instead of refetching aggressively.
