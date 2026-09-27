package expo.modules.homewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// Never built (README.md). Written from the pattern in other Expo modules
// under node_modules/expo-*/android, not confirmed against a compiler or a
// device — no Android SDK on this machine.
const val PREFS_NAME = "expo_home_widget"
const val LAST_FEED_AT_KEY = "lastFeedAt"

class HomeWidgetPayloadRecord : Record {
  @Field
  var lastFeedAt: Double? = null
}

class HomeWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HomeWidget")

    AsyncFunction("reload") { payload: HomeWidgetPayloadRecord ->
      val context: Context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val lastFeedAt = payload.lastFeedAt
      if (lastFeedAt != null) {
        prefs.edit().putLong(LAST_FEED_AT_KEY, lastFeedAt.toLong()).apply()
      } else {
        prefs.edit().remove(LAST_FEED_AT_KEY).apply()
      }

      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, LastFeedWidgetProvider::class.java))
      LastFeedWidgetProvider.updateAll(context, manager, ids)
    }
  }
}
