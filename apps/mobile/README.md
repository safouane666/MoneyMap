# Clear Money mobile (Expo)

## Run

```bash
pnpm install
pnpm --filter @clear-money/mobile start
```

Then press `a` for Android emulator or `i` for iOS simulator.

## Features in this app

- First-run: welcome → language → currency → notifications (opt-in) → intro → auth
- Tabs: Home, Activity, Reports, Spaces + persistent Add FAB
- Offline queue with idempotency keys (`src/offline`)
- Device-local notification planner (`src/notifications`) — no server cron
- Shared `@clear-money/domain` for money rules

## Notes

Notification delivery is best-effort per OS rules. Biometrics and camera use platform adapters when available; tracking works if the user declines.
