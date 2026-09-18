package io.karelisio.lucide;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Widget d'écran d'accueil "Noter un rêve" : un raccourci qui ouvre directement le formulaire
 * de saisie, sans passer par l'écran d'accueil de l'app. Le tap relance MainActivity avec une
 * URL du schéma personnalisé de l'app (io.karelisio.lucide://dreams/new), interceptée côté
 * JS par le plugin App de Capacitor (appUrlOpen) pour naviguer directement vers /dreams/new.
 */
public class DreamWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_dream);

            Intent intent = new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("io.karelisio.lucide://dreams/new"),
                    context,
                    MainActivity.class
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
