import ExpoModulesCore
import WidgetKit

// Never built (README.md). Written from Apple's WidgetKit docs and the
// pattern in other Expo modules under node_modules/expo-*/ios, not
// confirmed against a compiler or a device.
//
// "group.eu.codedesigns.moraki" has to match plugin/withHomeWidget.js's
// APP_GROUP exactly — the plugin entitles the app with it, this writes
// into it, and the (not-yet-added) widget extension target would read
// from it. One constant in two languages, kept in sync by comment rather
// than by code, because a config plugin can't hand a value to Swift.
private let appGroupId = "group.eu.codedesigns.moraki"
private let lastFeedAtKey = "lastFeedAt"

public final class HomeWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HomeWidget")

    AsyncFunction("reload") { (payload: HomeWidgetPayloadRecord) in
      guard let defaults = UserDefaults(suiteName: appGroupId) else {
        throw MissingAppGroupException(appGroupId)
      }
      if let lastFeedAt = payload.lastFeedAt {
        defaults.set(lastFeedAt, forKey: lastFeedAtKey)
      } else {
        defaults.removeObject(forKey: lastFeedAtKey)
      }
      WidgetCenter.shared.reloadTimelines(ofKind: "LastFeedWidget")
    }
  }
}

internal final class MissingAppGroupException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "Couldn't open App Group '\(param)'. It has to be entitled in both the host app and the widget extension target (see the module README) — a build without that entitlement can't reach this shared storage at all."
  }
}

public struct HomeWidgetPayloadRecord: Record {
  @Field
  var lastFeedAt: Double?

  public init() {}
}
