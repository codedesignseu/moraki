import SwiftUI
import WidgetKit

// Never built (README.md), and not part of the app's own target: this file
// belongs to a Widget Extension target that doesn't exist yet in the Xcode
// project (see the module README's step 1). Written from Apple's WidgetKit
// sample code, not confirmed against a compiler.
//
// "group.eu.codedesigns.moraki"/"lastFeedAt" have to match
// HomeWidgetModule.swift's constants exactly — see its comment.
private let appGroupId = "group.eu.codedesigns.moraki"
private let lastFeedAtKey = "lastFeedAt"

struct LastFeedEntry: TimelineEntry {
  let date: Date
  let lastFeedAt: Date?
}

struct LastFeedProvider: TimelineProvider {
  func placeholder(in context: Context) -> LastFeedEntry {
    LastFeedEntry(date: Date(), lastFeedAt: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (LastFeedEntry) -> Void) {
    completion(currentEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<LastFeedEntry>) -> Void) {
    // One entry, refreshed whenever HomeWidgetModule.reload() calls
    // WidgetCenter.reloadTimelines — there's nothing to precompute a
    // schedule for, since "time since last feed" only changes when a new
    // feed is logged, not on a timer.
    completion(Timeline(entries: [currentEntry()], policy: .never))
  }

  private func currentEntry() -> LastFeedEntry {
    let defaults = UserDefaults(suiteName: appGroupId)
    let epochMs = defaults?.object(forKey: lastFeedAtKey) as? Double
    let lastFeedAt = epochMs.map { Date(timeIntervalSince1970: $0 / 1000) }
    return LastFeedEntry(date: Date(), lastFeedAt: lastFeedAt)
  }
}

// Deliberately plain English rather than src/i18n text (the README's last
// point) — same reasoning as P5-01's Live Activity view.
struct LastFeedWidgetView: View {
  let entry: LastFeedEntry

  var body: some View {
    VStack(alignment: .leading) {
      Text("Last feed")
        .font(.caption)
      if let lastFeedAt = entry.lastFeedAt {
        Text(lastFeedAt, style: .relative)
          .font(.headline)
      } else {
        Text("—")
          .font(.headline)
      }
    }
    .padding()
  }
}

struct LastFeedWidget: Widget {
  let kind: String = "LastFeedWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: LastFeedProvider()) { entry in
      LastFeedWidgetView(entry: entry)
    }
    .configurationDisplayName("Last feed")
    .description("Shows how long since the last feed.")
    .supportedFamilies([.systemSmall])
  }
}
