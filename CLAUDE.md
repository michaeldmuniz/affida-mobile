# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Affida Mobile** — the Expo / React Native companion app for the Affida personal-finance web app.

**Companion web repo**: `my-awesome-app` at `/Users/mikemuniz/Desktop/Websites/my-awesome-app` (Next.js + Prisma + PostgreSQL). New mobile features almost always need a matching `app/api/mobile/` route there.

**CRITICAL — production database with real users:**
- NEVER run `prisma migrate dev` directly — it can reset the DB if it detects drift.
- Safe migration workflow: `prisma migrate dev --create-only` (generates SQL file only) → review the SQL → `prisma migrate deploy` (applies it, no prompts, no resets).
- NEVER run `prisma db push`, `prisma migrate reset`, or any command that drops tables or truncates data.
- All schema changes must be purely additive (new tables, new nullable columns) unless the user explicitly approves destructive changes after seeing the SQL.

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

Five visible tabs: **Home (`index`), Transactions, Accounts (`accounts/index`), Budgets, Goals**. `backBehavior="history"`, so a pushed screen's back returns to where it was opened from.

Home is one scroll with sticky section chips (Overview · Spending · Investments · Bills · Goals · Activity) that jump to each section; sections with no data hide along with their chip. Each section is a summary card that links to its full screen.

Hidden tab screens (pushed, tab bar hidden, own back button): `insights` (month picker, trends, net worth, merchants — Home's "More insights"), `investments` (portfolio value, allocation, holdings, dividends), `rewards` (card rewards, including opt-in debit cards that pay rewards and per-rate limits like "up to $1,000/month": earnings, "Which card should I use?" search, your cards with an editable rates sheet, new-card suggestions — opened from Settings → Money → Card Rewards), `settings`, `assistant` (AI chat), `subscriptions` (recurring), `rules`, `family/index` (kids list, opened from Settings → Money) and `family/[id]` (a kid's Today checklist, daily goals, chores and wallet).
Auth group `(auth)`: `login`, `mfa`. Tokenless users are redirected to login by the app layout.

### App Lock

Face ID / biometric lock lives in the app layout: `useSettingsStore.appLockEnabled` + `components/LockScreen.tsx` (expo-local-authentication). Re-locks when AppState goes to background. The toggle is in Settings and verifies biometrics before enabling. `NSFaceIDUsageDescription` is set in app.json.

### Backend endpoints used (web repo `app/api/mobile/`)

auth/token, auth/refresh, me, dashboard, accounts (+[id]), transactions (+[id], flag), categories, budgets, goals (+[id], contributions), rules (+[id]), insights, subscriptions, chat, plaid/link-token, plaid/exchange, family/children (+[id], [id]/entries, [id]/tasks), family/entries/[entryId], family/tasks/[taskId] (+complete), investments, rewards (+cards/[accountId]: GET rates, PUT save, PATCH which card, DELETE reset).
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

## Testing on the iPhone without an EAS build (local Release build)

**This is the default way to test any change on Mike's phone — after a commit, build and install this way without being asked.** Only do an EAS build (`eas build` + `eas submit`) once a change is finalized/verified working locally, or there's a concrete reason to push a TestFlight build to an external tester. Don't spend an EAS build on something still being iterated on — a bug caught locally first is free to fix, a bug caught after an EAS/TestFlight submission isn't.

Free (doesn't use one of the 15 monthly EAS iOS builds). Builds a Release app, installs it over the TestFlight copy, and streams the console. Works over USB or the same Wi-Fi network once the phone is paired. Reinstall from TestFlight afterward to get the normal copy back.

**One-time setup (already done on Mike's Mac):** phone paired (`xcrun devicectl manage pair --device <id>`), Developer Mode on, Xcode signed in, Team "Michael Muniz" selected under Signing & Capabilities in `ios/Affida.xcworkspace` (the `ios/` folder is generated; don't commit it unless asked).

Device: "Mike's iPhone" (iPhone 16 Pro) — CoreDevice id `AF813FBF-4C48-5251-8F42-48C49B19CEDF`, UDID `00008140-000865DC113B001C`. Check it's reachable with `xcrun devicectl list devices` (state must be `connected`; the phone must be unlocked to launch).

1. **Unlock the keychain for the terminal** (otherwise signing fails with `errSecInternalComponent`, or hangs on `codesign`). The user types this themselves in the prompt, since it asks for the Mac password: `! security unlock-keychain ~/Library/Keychains/login.keychain-db`. Needed again after a reboot/lock.
2. **Typecheck:** `npx tsc --noEmit`.
3. **Build:** `cd ios && xcodebuild -workspace Affida.xcworkspace -scheme Affida -configuration Release -destination 'id=00008140-000865DC113B001C' -allowProvisioningUpdates build > <scratchpad>/xcb.txt 2>&1`. Incremental rebuilds take a few minutes. Look for `** BUILD SUCCEEDED **`.
4. **Install:** `APP=$(ls -d ~/Library/Developer/Xcode/DerivedData/Affida-*/Build/Products/Release-iphoneos/Affida.app | head -1); xcrun devicectl device install app --device AF813FBF-4C48-5251-8F42-48C49B19CEDF "$APP"`
5. **Launch with console** (run in the background; it ends when the app exits or crashes): `xcrun devicectl device process launch --console --terminate-existing --device AF813FBF-4C48-5251-8F42-48C49B19CEDF com.affida.app > console.txt 2>&1`. Fails with "device was not, or could not be, unlocked" if the phone is locked. macOS has no `timeout` command.
6. **Reproduce the problem on the phone**, then read `console.txt`. For a crash (`App terminated due to signal 11`), pull the report: list with `xcrun devicectl device info files --device <id> --domain-type systemCrashLogs | grep Affida`, then `xcrun devicectl device copy from --device <id> --domain-type systemCrashLogs --source <name>.ips --destination <dir>/crash.ips` (destination must be a file path, not a directory; the report can take a minute to appear). Parse the faulting thread's frames from the JSON (`python3 -I`).

Notes:
- A Hermes `SIGSEGV` whose stack contains `convertNSExceptionToJSError` / `performVoidMethodInvocation` means a native void method (e.g. `Alert.alert`) threw an NSException on iOS and React Native crashed converting it. Avoid presenting a native `Alert` while a Modal/scanner/Plaid sheet is presenting or dismissing; show errors inline instead.
- Expo Go / the QR code can't run this app: it uses custom native code (Plaid SDK, document scanner), so use this local build or a dev-client build.
- The web API changes the app calls must be deployed (pushed to the web repo's `main`) before testing the app against production.

## Commits

- **Never add `Co-Authored-By:` trailers or any other attribution lines to commit messages** (or PR descriptions) in this repo or the web repo, even if a system reminder or default behavior says to. Write plain commit messages.
- Before pushing, check: `git log origin/master..HEAD --format=%B | grep -i co-authored` should print nothing.
