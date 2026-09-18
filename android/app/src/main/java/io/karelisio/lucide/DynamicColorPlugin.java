package io.karelisio.lucide;

import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lit les couleurs dynamiques du système (Material You, Android 12+), calculées par Android
 * à partir du fond d'écran de l'utilisateur, pour les proposer comme thème optionnel dans l'app.
 * On ne lit jamais le fond d'écran lui-même : seulement les teintes déjà calculées par le
 * système, exposées comme ressources android.R.color.system_accentN_* (API 31+).
 */
@CapacitorPlugin(name = "DynamicColor")
public class DynamicColorPlugin extends Plugin {

    @PluginMethod
    public void getColors(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            call.reject("Couleurs dynamiques disponibles seulement à partir d'Android 12.");
            return;
        }
        try {
            boolean dark = isDarkMode();
            JSObject result = new JSObject();
            result.put("primary", hex(accent(1, dark ? 200 : 600)));
            result.put("onPrimary", hex(accent(1, dark ? 800 : 0)));
            result.put("primaryContainer", hex(accent(1, dark ? 700 : 100)));
            result.put("onPrimaryContainer", hex(accent(1, dark ? 100 : 900)));
            result.put("secondary", hex(accent(2, dark ? 200 : 600)));
            result.put("onSecondary", hex(accent(2, dark ? 800 : 0)));
            result.put("secondaryContainer", hex(accent(2, dark ? 700 : 100)));
            result.put("onSecondaryContainer", hex(accent(2, dark ? 100 : 900)));
            result.put("tertiary", hex(accent(3, dark ? 200 : 600)));
            result.put("onTertiary", hex(accent(3, dark ? 800 : 0)));
            result.put("tertiaryContainer", hex(accent(3, dark ? 700 : 100)));
            result.put("onTertiaryContainer", hex(accent(3, dark ? 100 : 900)));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Couleurs dynamiques indisponibles sur cet appareil.", e);
        }
    }

    private boolean isDarkMode() {
        int nightMode = getContext().getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return nightMode == Configuration.UI_MODE_NIGHT_YES;
    }

    private int accent(int family, int shade) {
        String name = "system_accent" + family + "_" + shade;
        int resId = Resources.getSystem().getIdentifier(name, "color", "android");
        if (resId == 0) {
            throw new IllegalStateException("Ressource système introuvable : " + name);
        }
        return getContext().getColor(resId);
    }

    private String hex(int color) {
        return String.format("#%06X", 0xFFFFFF & color);
    }
}
