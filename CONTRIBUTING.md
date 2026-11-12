# Contributing

Issues and pull requests are welcome.

## Set up

```bash
npm ci
npm run typecheck && npm run check:versions && npm test
```

Android build: JDK 17 and the Android SDK, then `cd android && ./gradlew assembleRelease`.

## Guidelines

- Keep pure logic (parsers, classifiers, formatting) in `src/lib` without React or Expo imports so it can be unit-tested with `node --test`; use `.ts` extensions for imports in files that tests load.
- Every user-visible string goes through i18n (`src/lib/i18n/{en,ru,zh-Hans}.json`); a test keeps the three catalogs in sync.
- Bump `version` / `versionCode` in `app.json`, `package.json` and `android/app/build.gradle` together and add `changelogs/<versionCode>.txt`; `npm run check:versions` verifies it.
- No analytics, crash reporting or other network calls to third parties.

By contributing you agree that your work is released under the MIT license.
