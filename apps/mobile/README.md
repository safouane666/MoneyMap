# Clear Money mobile (Expo)

Native Expo Router app (auth, spaces, Penny, sync) pointed at the production API.

## Run (dev)

```powershell
cd D:\Work\MoneyMap\apps\mobile
# Optional .env:
# EXPO_PUBLIC_API_URL=https://moneymap.phronexus-ai.com/cm-api
# EXPO_PUBLIC_WEB_URL=https://moneymap.phronexus-ai.com
pnpm exec expo start --clear --lan
```

### Penny (Skia)

- **Expo Go:** View-based Penny (Skia/SVG Fabric natives often fail with “View config … undefined” in monorepo + New Arch).
- **EAS APK / `expo-dev-client`:** Skia Penny (`@shopify/react-native-skia@1.5.0`, same geometry as web). Metro pins the `react-native` package field for Skia.

### Google sign-in

Opens the **system browser** at `/cm-api/public/mobile-google-oauth` (not a WebView). That route sets Better Auth’s OAuth state cookie in the browser jar, redirects to Google, then `/cm-api/public/mobile-google-done` deep-links back (`clearmoney://` / `exp://`) with the session.

**Requires a redeployed API** that includes those two `/public/mobile-google-*` routes. Until then the browser will 404 / bounce to the website instead of Google.

On the VPS (from the MoneyMap clone):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml \
  --env-file .env.production up -d --build api web
```

Smoke:

```bash
curl -sI "https://moneymap.phronexus-ai.com/cm-api/public/mobile-google-oauth?to=clearmoney://auth/callback"
# expect 302 Location: https://accounts.google.com/...
```

## EAS APK

```powershell
cd D:\Work\MoneyMap\apps\mobile
.\eas-on-d.ps1 build --platform android --profile apk
```

Env in `eas.json` already points at production. Never ship `localhost` / LAN IPs in release profiles.

| Profile | Output |
| --- | --- |
| `apk` | Android APK |
| `production` | Android AAB |
| `ios` | iOS |

After install: open **Settings → Enable reminders** (or **Send test notifications**) and allow OS permission. You should get ~10 alerts over ~3 minutes, plus the normal planner schedule.

## v1 scope

Auth + personal space + add/list/sync + Penny + local notifications. Free-only (no IAP).
