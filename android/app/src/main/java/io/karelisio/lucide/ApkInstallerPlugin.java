package io.karelisio.lucide;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Lance l'installateur système Android sur un APK déjà téléchargé sur le
 * disque, via un content:// URI FileProvider. Utilisé par la mise à jour
 * manuelle (Réglages > Mises à jour) puisque l'app n'est pas distribuée via
 * le Play Store.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Paramètre 'path' manquant.");
            return;
        }

        File apkFile = new File(path);
        if (!apkFile.exists()) {
            call.reject("Fichier introuvable : " + path);
            return;
        }

        try {
            Context context = getContext();
            Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apkFile);

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Impossible de lancer l'installation : " + e.getMessage(), e);
        }
    }
}
