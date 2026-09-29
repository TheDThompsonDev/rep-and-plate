# Rep & Plate for iPhone and Android

The Expo app uses native React Native views, camera/barcode capture, audio recording, file sharing, and device storage. It shares the existing food, pantry, recipe, planning, workout, and cloud contracts with the web app. The web app remains available during migration.

## Start development

From the repository root, in separate terminals:

```sh
npm run dev
npm run mobile:api
npm run mobile
```

On a fresh checkout, install both packages first: `npm ci` and `npm --prefix mobile ci`.

Install the Expo Go version compatible with this project's Expo SDK 57, then scan Expo's QR code on your phone. Both devices must be on the same trusted private network. Expo's web preview is also available with `npm --prefix mobile run web`; it exercises the React Native interface but does not substitute for phone testing.

Open **profile → Connection** in the app. Enter the private server address and pairing code printed by `mobile:api`. For the Android emulator, use `adb reverse tcp:5174 tcp:5174` and `http://127.0.0.1:5174`. If Metro uses localhost, also reverse port 8081.

The gateway runs on port 5174 and forwards authenticated requests to the existing loopback API on port 5173. Stop it when finished. The pairing code is saved in ignored `.local-checks/mobile-pairing.json`; delete that file and restart the bridge to rotate it. This gateway is for trusted local development, not public deployment.

No provider, database, or service-role keys belong in the mobile package or `EXPO_PUBLIC_*` variables. Existing root `.env` keys stay on the server. Native credentials use SecureStore; the optional browser preview uses session storage.

## Bring existing records across

In the web app, export a backup from your profile. In the native app, open **profile → Cloud & your records → Import a backup file**, review the counts, and confirm replacement. Import does not change the original web data. Export the phone first if it already has records you want to preserve.

Cloud uses the existing Supabase snapshot schema and revision checks. It is an explicit upload/restore workflow, not automatic multi-device synchronization. The mobile sign-in flow uses an email OTP: configure the Supabase sign-in email template to include `{{ .Token }}`. Browser-only magic links do not sign into this native app. Cloud restore is reviewed before replacement; deleting a cloud snapshot leaves local records intact.

## Native flows

- Chat is the initial screen. Text, photos, receipts, barcode lookup, and voice use the existing API and domain validation. Meal estimates require confirmation; receipts do not count as food eaten.
- Nutrition uses personal records for the selected local calendar day. Foregrounding the app and passing midnight refresh today's totals without deleting history.
- Kitchen includes receipt review, USDA package matching, pantry quantities/dates, ingredient consumption, recipe batches/leftovers, meal planning and revisions, shopping lists, swaps, and spending.
- Workouts supports starter templates, generated plans, weights, saved sets, conversational/voice logging, and history.
- Profile contains preferences, targets, reviews, connection settings, and backup/cloud tools.
- Barcode camera supports EAN-8, EAN-13, and UPC-A. Compressed UPC-E is excluded until expansion is implemented. Unknown packages can be entered or read from a nutrition-label photo.

Records are stored in the app's document directory, with a previous-generation backup and serialized writes. Images remain with their capture. Removing the app can remove local records; export or upload a copy first. Web and native do not share local storage automatically.

## Check and build

```sh
npm run mobile:check
npm run mobile:export
npm --prefix mobile run doctor
node node_modules/@playwright/test/cli.js test --config mobile/playwright.config.ts
```

For a local Android build, install Android Studio's SDK and Java 21, set `ANDROID_HOME`, then run `npm --prefix mobile run android`. Generated `mobile/android` and `mobile/ios` directories are ignored; Expo regenerates them from configuration. Local iOS builds require macOS/Xcode. The checked-in EAS profiles describe preview and production builds; using them requires your Expo project and signing credentials. No builds are uploaded or published by the commands above.

The local debug APK is generated at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. It is a development build that needs Metro running, not an offline release package. Android compilation and emulator installation succeeded. iOS JavaScript/Hermes export succeeded; an iOS signed binary has not been built on this Windows host.

See [Expo's build configuration guide](https://docs.expo.dev/build/eas-json/) for signing and distribution. Signing identifiers currently use `com.dannyshealth.app`; confirm ownership before store submission.

## Release work still required

The Supabase/Vercel beta integration now implements verified authentication, shared usage limits, private media uploads and user-scoped request caching. The migration is installed and the API is deployed at https://repandplate.com. EAS preview/production profiles use this public URL by default. Hosted connections accept an HTTPS URL with an empty pairing code, then email sign-in and explicit device ownership confirmation. Existing local pairing still works. See [beta hosting](../docs/context/beta-hosting.md) for deployment, tester access and current limitations.

Before external testers: verify auth email delivery, finish branded launch assets and signed distribution packages. Check camera denial, real barcode decoding, microphone/transcription, keyboard/safe areas, background interruption, backup sharing, and Supabase OTP on physical iPhone and Android devices. Expo-web tests and successful JavaScript exports alone do not prove those device behaviors. Cloud copies are still manually uploaded/restored, and signed-out local records remain visible on a personal device.
