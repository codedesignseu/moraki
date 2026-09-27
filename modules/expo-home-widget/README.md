# expo-home-widget

P5-02's scaffold: a home-screen widget on both platforms showing "time since
last feed", reading the same `LiveActivityPayload` shape P5-01's Live
Activity uses (`src/domain/liveActivity/liveActivityPayload.ts`) — one
shared value, two native surfaces, not two calculations of the same thing.

**Status: scaffold only, never compiled or run.** This machine has no
Xcode and no Android SDK, so nothing here has built, on a device, a
simulator or an emulator. Treat every file as a starting point to verify on
first real `eas build`, not as working code.

## What's here

- `src/` — the TypeScript bridge (`reload(payload)`), real and typed, no
  different in kind from `expo-live-activity`'s.
- `plugin/withHomeWidget.js` — the one part of this that actually runs
  today: a config plugin adding an iOS App Group entitlement
  (`com.apple.security.application-groups`), the mechanism both the host app
  and a widget extension use to share one small store of data across their
  separate sandboxes. Real, tested (`plugin/withHomeWidget.test.ts`), wired
  into the root `app.json`.
- `ios/HomeWidgetModule.swift` — the Expo Module: writes the payload into
  the App Group's shared `UserDefaults` and asks WidgetKit to redraw.
- `ios/widget/LastFeedWidget.swift` — the `TimelineProvider` and view
  WidgetKit would render. **Not wired into any Xcode target**, for the same
  reason as P5-01's Live Activity view: a home-screen widget's UI lives in
  a Widget Extension, a second target this scaffold can't safely fabricate
  blind.
- `android/` — a real Expo Android module (`HomeWidgetModule.kt`) plus an
  `AppWidgetProvider` (`LastFeedWidgetProvider.kt`) and its resources
  (`res/xml/last_feed_widget_info.xml`, `res/layout/widget_last_feed.xml`).
  Unlike iOS, an Android widget doesn't need a second build target — Gradle
  merges a library module's own `AndroidManifest.xml` `<receiver>`
  declaration into the app automatically, so this side is more complete.
  Still never built: no Android SDK on this machine to confirm the manifest
  merge, the layout, or the provider actually work.

## What's not here, and has to happen before this does anything

1. **iOS:** open the project in Xcode (after a prebuild) and add a Widget
   Extension target sharing the same App Group as the plugin sets up, with
   `ios/widget/LastFeedWidget.swift` as its source.
2. **Both platforms:** confirm the native code actually compiles and that a
   widget added to a real home screen updates when `reload()` is called —
   nothing here has run once.
3. Decide where in the app `reload()` gets called from, same as P5-01's
   `start`/`update` — this scaffold ships the bridge and the native side,
   not a call site.
4. The widget's own UI text is plain English, not `src/i18n` (CLAUDE.md
   rule 9), for the same reason as the Live Activity's view: a widget
   extension is a separate target that can't easily import the RN app's
   i18n setup. One task, once either widget is real, not two.
