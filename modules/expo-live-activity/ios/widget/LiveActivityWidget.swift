import ActivityKit
import SwiftUI
import WidgetKit

// Never built (README.md), and not part of the app's own target: this file
// belongs to a Widget Extension target that doesn't exist yet in the Xcode
// project (see the module README's step 1). Written from Apple's
// ActivityKit + WidgetKit sample code, not confirmed against a compiler.
//
// Deliberately plain English rather than src/i18n text (the README's last
// point): a widget extension is a separate app target, and wiring it to the
// RN app's i18next instance is its own piece of work, not assumed here.
@available(iOS 16.1, *)
struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MorakiLiveActivityAttributes.self) { context in
      LiveActivityLockScreenView(state: context.state)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          LiveActivityLockScreenView(state: context.state)
        }
      } compactLeading: {
        Image(systemName: "drop.fill")
      } compactTrailing: {
        LiveActivityElapsedText(lastFeedAtEpochSeconds: context.state.lastFeedAtEpochSeconds)
      } minimal: {
        Image(systemName: "drop.fill")
      }
    }
  }
}

@available(iOS 16.1, *)
private struct LiveActivityLockScreenView: View {
  let state: MorakiLiveActivityAttributes.ContentState

  var body: some View {
    HStack {
      Image(systemName: "drop.fill")
      LiveActivityElapsedText(lastFeedAtEpochSeconds: state.lastFeedAtEpochSeconds)
    }
    .padding()
  }
}

/// Renders as a live-updating relative duration (SwiftUI's own `Text(_:style:)`
/// keeps counting up on the lock screen without the app or extension doing
/// anything further — the same reason the JS side sends a timestamp, not a
/// pre-formatted string, in LiveActivityPayload).
@available(iOS 16.1, *)
private struct LiveActivityElapsedText: View {
  let lastFeedAtEpochSeconds: Double?

  var body: some View {
    if let seconds = lastFeedAtEpochSeconds {
      Text(Date(timeIntervalSince1970: seconds), style: .relative)
    } else {
      Text("—")
    }
  }
}
