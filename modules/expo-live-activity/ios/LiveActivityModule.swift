import ActivityKit
import ExpoModulesCore

// First real build (2026-09-28), after this had sat untouched as "never
// compiled": EAS's Xcode build failed on Activity.request/.end/.update,
// "only available in iOS 16.2 or newer". Written from Apple's ActivityKit
// docs at 16.1 (when ActivityKit itself, and simple authorization checks,
// became available) — these three calls specifically need 16.2, a real
// compiler caught what reading the docs alone didn't.
public final class LiveActivityModule: Module {
  // No @available here: Swift refuses it on a stored property ("stored
  // properties cannot be marked potentially unavailable"), the second real
  // build error this file produced (2026-09-28). Activity<T> itself only
  // needs iOS 16.1 to exist as a type — it's specifically .request/.end/
  // .update that need 16.2, gated below at each call site instead — and
  // 16.1 already matches this module's own deployment target
  // (ExpoLiveActivity.podspec), so the type reference alone needs no gate.
  private var current: Activity<MorakiLiveActivityAttributes>?

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    AsyncFunction("isAvailableAsync") { () -> Bool in
      // 16.2, matching start/update/end below, not 16.1: ActivityKit
      // itself exists from 16.1, but reporting "available" on a 16.1
      // device would be wrong when the calls that actually start an
      // activity need 16.2 and would silently no-op there.
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("start") { (payload: LiveActivityPayloadRecord) in
      guard #available(iOS 16.2, *) else { return }
      // Starting twice isn't meaningful — update the one already running
      // instead of layering a second on top of it.
      if current != nil {
        try await updateCurrent(payload)
        return
      }
      let state = MorakiLiveActivityAttributes.ContentState(
        lastFeedAtEpochSeconds: payload.epochSeconds
      )
      current = try Activity.request(
        attributes: MorakiLiveActivityAttributes(),
        content: .init(state: state, staleDate: nil)
      )
    }

    AsyncFunction("update") { (payload: LiveActivityPayloadRecord) in
      guard #available(iOS 16.2, *) else { return }
      try await updateCurrent(payload)
    }

    AsyncFunction("end") {
      guard #available(iOS 16.2, *) else { return }
      guard let activity = current else { return }
      await activity.end(nil, dismissalPolicy: .immediate)
      current = nil
    }
  }

  @available(iOS 16.2, *)
  private func updateCurrent(_ payload: LiveActivityPayloadRecord) async throws {
    guard let activity = current else { return }
    let state = MorakiLiveActivityAttributes.ContentState(
      lastFeedAtEpochSeconds: payload.epochSeconds
    )
    await activity.update(.init(state: state, staleDate: nil))
  }
}

// Expo Modules' `Record` reads a plain JS object straight into a typed
// Swift value by matching property names, so this mirrors the JS side's
// LiveActivityPayload field name and unit (`lastFeedAt`, epoch
// milliseconds) exactly; `epochSeconds` below converts once at this
// boundary, so ContentState — which the widget extension also reads — only
// ever deals in seconds, ActivityKit's own unit.
public struct LiveActivityPayloadRecord: Record {
  @Field
  var lastFeedAt: Double?

  var epochSeconds: Double? {
    lastFeedAt.map { $0 / 1000 }
  }

  public init() {}
}
