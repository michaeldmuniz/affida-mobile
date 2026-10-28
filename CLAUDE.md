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

auth/token, auth/refresh, me, dashboard, accounts (+[id], [id]/categories), transactions (+[id], flag), categories, budgets, goals (+[id], contributions), rules (+[id]), insights, subscriptions, chat, plaid/link-token, plaid/exchange (optional `claim: { plaidAccountId, accountId }` turns a manual account into the bank account), accounts/[id]/make-manual (POST `{ wholeBank? }`: bank → manual, the server deletes the bank connection once no account uses it), family/children (+[id], [id]/entries, [id]/tasks), family/entries/[entryId], family/tasks/[taskId] (+complete), investments, rewards (+cards/[accountId]: GET rates, PUT save, PATCH which card, DELETE reset).
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

## Keep the website's phone layout in sync
The website (`my-awesome-app`) imitates this app when opened in a phone's browser: the bottom tabs (Home, Transactions, Accounts, Budgets, Goals, plus More), the Home screen's cards and section order and chips, day-grouped Transactions with swipe-to-flag, card styling. **When you change any of those here (a tab, a Home section or its order, a label, a list layout, an interaction), make the same change in the web repo** (`components/dashboard/MobileNav.tsx`, `components/phone/PhoneHome.tsx` and `lib/queries/phone-home.ts`, the phone list in `app/(dashboard)/transactions/client.tsx`) so the two stay alike. Its CLAUDE.md says the same. The web phone layout is only ever shown to phones, never to computers.

## Receipts and the net worth forecast
- Receipt reading happens on the server and is the same for the camera scan, the photo library and the website (`processReceiptUpload` + `prepareReceiptImage` in the web repo). The app just sends the image (the document scanner's already-cropped page, or the library photo with its crop outline); don't add image processing here that the website's upload doesn't also get, and don't re-encode to a lossy format on the phone.
- Insights' Net Worth card shows the forecast the server returns as `netWorthForecast` (current month only). The calculation lives in the web repo (`lib/net-worth-forecast.ts`); change it there, never recompute it in the app.

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
- **Commit after every task, but do NOT push to `master` or start a production build/submit unless the owner says to ship it.** Work on a branch and merge on their OK. The web repo's CLAUDE.md "Release workflow" is the source of truth: dev and production use different servers, and the app picks its server from `EXPO_PUBLIC_API_URL`. Once the dev server exists, `development` and `preview` builds in `eas.json` should set it to the dev URL and only `production` to `https://affida.money`; a test build must never be pointed at production data by accident.

## Categories on shared accounts
- A transaction carries a category from its *account owner's* list. Every category picker for a transaction (edit, add, create-from-receipt) uses `hooks/useAccountCategories(accountId)` → `GET /accounts/[id]/categories`, which returns the owner's list on someone else's account (`ownerName`, and `createCategory` only when the owner gave you edit access: `POST /categories` with `accountId`). `CategoryPicker` shows "Lauren's categories" and an "Add "x" to Lauren's categories" row. Picking a different account clears the chosen category. Keep in sync with the web (`CategoryOptionGroups` `accountOwnerId`).

## Groups (businesses)
- A category can belong to a group (`businessId` on `GET /categories` rows; set with `PATCH /categories/[id]` `{ businessId }` or `POST /categories` `{ businessId }`): its spending then counts toward that group on any card. The app has no category manager yet, so there is no screen for it; the server already applies it to every total the app shows.
- An account is in the default Personal group or in one of the owner's named groups (any number, each marked Personal or Business via `kind`; shown only once one exists). The account screen's "Belongs to" row opens `BusinessPicker` (Personal / each group / "New group" with a Personal/Business toggle); it calls `PUT /accounts/[id]` with `{ businessId }` and `POST /businesses` `{ name, kind }` (`PATCH /businesses/[id]` renames and/or retypes). The Accounts header chip opens `ScopeSheet` (`GET/PUT /scope`), which lists Personal, each business by name and each connected person's shared choices. Keep in sync with the website's Settings → Sharing and account page.

## Lite bank limit (choose which banks to keep)
- Someone on Lite with more banks than Lite includes (moved down from Pro) sees `components/accounts/BankLimitBanner.tsx` at the top of Accounts (`hooks/useBankLimit.ts`: `GET /bank-limit`, `POST /bank-limit { keepIds }`). Choosing detaches the others (accounts and history stay). The server decides everything and returns nothing unless `BANK_LIMIT_ENFORCEMENT=1` is set on the server; no billing in the app, so "upgrade to Pro" points to the website. Keep in sync with the website's `components/billing/BankLimitBanner.tsx`. Type-checked only: not run on a device.
