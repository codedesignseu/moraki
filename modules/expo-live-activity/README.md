# expo-live-activity

P5-01's scaffold: a local Expo module for an iOS Live Activity showing "time
since last feed" on the lock screen after the app is backgrounded.

**Status: two real build errors fixed so far, a clean build still hasn't
happened.** First real `eas build --profile development --platform ios`
(2026-09-28) failed twice on `ios/LiveActivityModule.swift`, each fix only
found by the next build, not by re-reading the docs harder:

1. `Activity.request`/`.end`/`.update` need iOS 16.2, not the 16.1 this
   file's original `#available` guards assumed.
2. Swift refuses `@available` on a _stored property_ at all ("stored
   properties cannot be marked potentially unavailable") — `current`'s own
   type only needs 16.1 to exist, so it needed no gate in the first place;
   the gate belongs on the calls that touch it, not the property itself.

Next `eas build` is still the only real signal. `ios/widget/LiveActivityWidget.swift`
is untouched by any build (excluded from the podspec on purpose, see
below) and still needs the Xcode step in "What's not here" — a clean
module build wouldn't mean a Live Activity has ever actually shown on a
lock screen either.

## What's here

- `src/` — the TypeScript bridge (`start`, `update`, `end`), typed with
  `src/domain/liveActivity/liveActivityPayload.ts`'s `LiveActivityPayload`
  from the main app — that part is real, tested, pure domain code.
- `ios/LiveActivityModule.swift` — the Expo Module exposing `start`/`update`/
  `end` to JavaScript, calling ActivityKit.
- `ios/LiveActivityAttributes.swift` — the `ActivityAttributes` struct the
  module and the widget extension both need to agree on.
- `ios/widget/LiveActivityWidget.swift` — the SwiftUI view ActivityKit
  renders on the lock screen. **Not wired into any Xcode target**: a Live
  Activity's UI lives in a Widget Extension, a second target inside the iOS
  project with its own bundle ID and Info.plist. Creating that target's
  Xcode project entries correctly, blind, with no way to open the project and
  check, is exactly the kind of native surgery this scaffold stops short of
  — it needs a real Xcode session (or `expo-target`-style tooling run and
  checked by someone who can build). This file is what goes in that target
  once it exists.
- `plugin/withLiveActivity.js` — the one part of this that runs today: a
  config plugin adding `NSSupportsLiveActivities: true` to Info.plist
  (Apple's own required flag for any Live Activity, widget extension or
  not). Wired into the root `app.json`. Real, and has a test
  (`plugin/withLiveActivity.test.js`) confirming what it writes.

## What's not here, and has to happen before this does anything

1. Open the iOS project (after a prebuild) in Xcode and add a Widget
   Extension target for the Live Activity, with `ios/widget/LiveActivityWidget.swift`
   and `ios/LiveActivityAttributes.swift` as its sources.
2. `LiveActivityModule.swift` compiles (confirmed 2026-09-28); confirm
   `start`/`update`/`end` actually _behave_ as expected on a real device
   running iOS 16.2+ (`isAvailableAsync` reports false below that, on
   purpose — see the file's own comments).
3. Decide where in the app `start`/`update` get called from (this scaffold
   deliberately doesn't wire itself into any feature screen — the "app-side
   data model" it ships, `LiveActivityPayload`, is meant to be read from
   wherever that's decided, once the native side is confirmed working).
4. The widget extension's own UI text is plain English, not read from
   `src/i18n` (CLAUDE.md rule 9) — a widget extension is a separate app
   target that can't easily import the RN app's i18n setup. Worth its own
   task once this is real; noted rather than solved here.
