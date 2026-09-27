import ActivityKit

// Never built (README.md). Written from Apple's ActivityKit docs, not
// confirmed against a compiler. The module (LiveActivityModule.swift) and
// the widget extension's view (widget/LiveActivityWidget.swift) both need
// this exact type, so it lives here rather than duplicated in either.
@available(iOS 16.1, *)
struct MorakiLiveActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// UTC epoch seconds — ActivityKit's own state is a plain value type
    /// sent to the system, so this mirrors LiveActivityPayload.lastFeedAt
    /// (which is epoch milliseconds on the JS side) converted once at the
    /// module boundary, not epoch ms carried through unchanged.
    var lastFeedAtEpochSeconds: Double?
  }
}
