# Clear Money mobile (Expo)

## Run (dev)

```bash
pnpm install
# Optional: point at a local or LAN API (paths are relative to this base)
# export EXPO_PUBLIC_API_URL=http://localhost:3011
# Or same-origin style via web proxy: http://<host>:8259/cm-api
pnpm --filter @clear-money/mobile start
```

Then press `a` for Android emulator or `i` for iOS simulator.

## Production API URL

Release builds **must** set `EXPO_PUBLIC_API_URL` to the public HTTPS API base — typically:

```text
https://YOUR_DOMAIN/cm-api
```

Never ship `localhost`, `127.0.0.1`, or LAN IPs in release profiles. Configure this in:

- `eas.json` → `build.<profile>.env.EXPO_PUBLIC_API_URL` (placeholders today)
- or EAS project secrets / env UI

Rebuild after changing the domain (`eas build --profile apk` / `ios`).

## EAS builds

Profiles in `eas.json`:

| Profile | Output | Notes |
| --- | --- | --- |
| `apk` | Android APK | Sideload / internal testers |
| `production` | Android AAB | Optional; for Play upload later |
| `ios` | iOS (simulator by default) | Device/TestFlight needs Apple Developer |

Before first build:

1. Replace `expo.extra.eas.projectId` in `app.json` with a real EAS project id (`eas init` / Expo dashboard). The current value is a **placeholder**.
2. Replace `YOUR_DOMAIN` in `eas.json` env values.
3. Sign in with Expo (`eas login`).

```bash
eas build --platform android --profile apk
eas build --platform ios --profile ios
```

## Features in this app (v1)

- First-run: welcome → language → currency → notifications (opt-in) → intro → auth
- Email sign-in / sign-up against Better Auth (`/auth/sign-in/email`, `/auth/sign-up/email`) with session in `expo-secure-store`
- Tabs: Home, Activity, Reports, Spaces + persistent Add FAB
- Offline queue with idempotency keys (`src/offline`) shared by Add / Activity / Home
- Sync: `POST /spaces/:spaceId/transactions` with `Idempotency-Key`
- Device-local notification planner (`src/notifications`) — no server cron
- Shared `@clear-money/domain` for money rules
- **Free-only** monetization on mobile v1 (no IAP / Stripe checkout in the app)

## Not implemented yet

- Camera / receipt OCR
- Biometrics
- Store listing assets (final icons/splash) — placeholders remain
- Play Console / App Store upload (Phase 8)

## Notes

Notification delivery is best-effort per OS rules. Tracking still works if the user declines notification permission.
