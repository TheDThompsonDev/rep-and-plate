# Native migration

The native client lives in `mobile/` as a separate Expo package. Install root and mobile dependencies separately. Metro watches the parent repository and resolves mobile dependencies first; do not alias React to type declaration files or disable hierarchical resolution. The mobile compiler uses TypeScript 7, matching the root: TypeScript 6 overflowed while instantiating the shared Zod-backed state types.

Reuse domain/schema functions from `src/`; do not import browser components into native screens. `mobile/src/runtime.ts` installs UUID/structuredClone support before shared code runs. Native persistence and credential storage are in `mobile/src/storage.ts`; common snapshot recovery/serialized writes are in `src/platform/snapshot.ts`.

The paired development gateway in `server/mobile-gateway.ts` authenticates a private bearer code before proxying only `/api/` requests to a fixed loopback upstream. It strips the incoming host/origin/authorization before forwarding. Do not expose the existing server by merely relaxing its host check: it has no production user authorization and request caches are not scoped by identity. The gateway does not provide production multi-user security.

Native UI verification: `mobile/e2e/native-flows.spec.ts` runs the Expo web target in an isolated context. It covers the shared native component interactions, streamed chat receipts, non-consumption of purchases, preference/list/workout persistence, barcode confirmation, and portable backup export/import. Provider responses are fixtures. Separately verify Android/iOS hardware behavior; don't conflate a browser run with camera or audio verification.

Local Android smoke testing used Expo Go on the Pixel_9_Pro API 36 emulator: native Chat/Kitchen/profile render, receipt camera permission/capture/preview, saved profile after force-stop/relaunch, and authenticated native connection to `/api/status`. The emulator stores test records separately from the user's existing web data. The Expo Go tools overlay can cover the top-right profile control; the hamburger also opens the profile page.

A live chat question completed through the paired gateway and returned an AI response in native Chat. Keyboard testing exposed a composer overlap on Android; `KeyboardAvoidingView` now uses height adjustment on Android and padding on iOS, including modal tools. The Android accessibility bounds confirm the composer moves above the keyboard. Headless emulator screenshots were black despite the accessible native view tree, so visual review also uses the Expo-web screenshot; this does not establish physical-device visual parity.

Expo Doctor excludes only the intentional TypeScript 7 compiler upgrade from its SDK version recommendation. Runtime packages remain checked against SDK 57.

Android prebuild/Gradle `:app:assembleDebug` succeeded for arm64-v8a and x86_64, and the APK installed on the emulator. Keep the image-picker microphone permission enabled: setting it to `false` blocks RECORD_AUDIO globally, including expo-audio, and removes the iOS usage description. The corrected merged Android manifest includes RECORD_AUDIO.

The installed `com.dannyshealth.app` debug build opened the native Chat screen, requested Android microphone permission, entered recording, and returned to Chat when the recording sheet was cancelled. This confirms native recording startup/cancellation, not real speech transcription quality.

The exported Expo-web target passed all four native interaction tests. Running Gradle compilation, two Metro bundlers, and both browser suites together caused timeouts; run the final suites sequentially. A scan of exported artifacts found no configured server API/database secrets. Native hardware scanning, microphone transcription, Supabase OTP, and physical iOS verification remain release checks.

Read `mobile/README.md` for startup, migration, cloud OTP requirements, and remaining distribution work. The existing web application remains independently runnable.
