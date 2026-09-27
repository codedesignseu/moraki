package expo.modules.homewidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import java.util.concurrent.TimeUnit

// Never built (README.md); written from Android's own AppWidgetProvider
// docs, not confirmed against a compiler or a device.
class LastFeedWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    manager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    updateAll(context, manager, appWidgetIds)
  }

  companion object {
    fun updateAll(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val lastFeedAt = if (prefs.contains(LAST_FEED_AT_KEY)) prefs.getLong(LAST_FEED_AT_KEY, 0) else null

      for (id in appWidgetIds) {
        val views = RemoteViews(context.packageName, R.layout.widget_last_feed)
        views.setTextViewText(R.id.widget_last_feed_label, "Last feed")
        views.setTextViewText(R.id.widget_last_feed_value, elapsedLabel(lastFeedAt))
        manager.updateAppWidget(id, views)
      }
    }

    // A plain "Xh Ym ago", not SwiftUI's self-updating Text(_:style:.relative)
    // — Android's RemoteViews has no equivalent, so this widget is only as
    // fresh as the last reload() call, same limitation any Android home
    // widget without a running timer has.
    private fun elapsedLabel(lastFeedAt: Long?): String {
      if (lastFeedAt == null) return "—"
      val minutes = TimeUnit.MILLISECONDS.toMinutes(System.currentTimeMillis() - lastFeedAt)
      val hours = minutes / 60
      return if (hours > 0) "${hours}h ${minutes % 60}m ago" else "${minutes}m ago"
    }
  }
}
