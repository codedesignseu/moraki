import ActivityKit
import ExpoModulesCore

// Never built (README.md). Written from Apple's ActivityKit docs and the
// pattern in other Expo modules under node_modules/expo-*/ios (e.g.
// expo-sharing's SharingModule.swift), not confirmed against a compiler or
// a device — Live Activities need iOS 16.1+, which this machine can't
// simulate without Xcode either.
public final class LiveActivityModule: Module {
  @available(iOS 16.1, *)
  private var current: Activity<MorakiLiveActivityAttributes>?

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    AsyncFunction("isAvailableAsync") { () -> Bool in
      guard #available(iOS 16.1, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("start") { (payload: LiveActivityPayloadRecord) in
      guard #available(iOS 16.1, *) else { return }
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
      guard #available(iOS 16.1, *) else { return }
      try await updateCurrent(payload)
    }

    AsyncFunction("end") {
      guard #available(iOS 16.1, *) else { return }
      guard let activity = current else { return }
      await activity.end(nil, dismissalPolicy: .immediate)
      current = nil
    }
  }

  @available(iOS 16.1, *)
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
