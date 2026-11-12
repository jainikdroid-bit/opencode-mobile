# Instructions for AI agents

**Setting this up for a person?** Read and follow [docs/AI-SETUP.md](docs/AI-SETUP.md). Run the installer with `-Doctor -Json`
first, then with `-Json -NoOpen`; treat the pairing link and the saved password as secrets.

**Working on the code?** `npm ci`, then `npm run typecheck && npm run check:versions && npm test`. Pure logic lives in `src/lib`
(no React/Expo imports, `.ts` extensions in imports of files that tests load). Every user-visible string goes through i18n
(`src/lib/i18n/{en,ru,zh-Hans}.json`, kept in sync by a test). Bump `app.json`, `package.json`, `android/app/build.gradle` and add
`changelogs/<versionCode>.txt` together. The Android build needs JDK 17 and the Android SDK (`cd android && ./gradlew assembleRelease`).
