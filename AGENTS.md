# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Cursor Cloud specific instructions

This is a single Expo SDK 57 app ("Muffle Demo", `expo-router`). Scripts live in `package.json`; standard commands are used as-is.

- Run (dev): `npm run web` starts Metro on `http://localhost:8081` (web is the only target testable in the cloud VM — there are no iOS/Android simulators). The mobile targets (`npm run ios`/`android`) cannot run here. `surveyor-mobile/` is an empty placeholder directory.
- Lint: `npm run lint` (`expo lint`). There is currently one pre-existing lint error in `src/hooks/use-color-scheme.web.ts` (set-state-in-effect) — it is a code issue, not an environment problem.
- Build (web): `npm run build:web` (`expo export -p web`) outputs to `dist/`.
- Tests: no automated test suite is configured.
- `npx tsc --noEmit` reports errors for `.css`/`.module.css` side-effect imports; these are resolved by Metro at bundle time (not tsc), so they are expected and not a real failure. There is no `typecheck` script.
