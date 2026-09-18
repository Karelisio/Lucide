# Lucide 🌙

Journal de rêves **100 % hors ligne**. Aucune donnée (texte, tags, mémos audio) ne
quitte jamais l'appareil : pas de backend, pas d'analytics, pas de tracking. Seule
exception, à la demande explicite de l'utilisateur : la vérification manuelle des
mises à jour (voir plus bas), qui contacte l'API publique de GitHub.

## Fonctionnalités

- Saisie rapide d'un rêve au réveil : texte libre, mémo vocal, lieux, personnages,
  émotions (liste éditable), tags libres, note du rêve /10.
- Qualité du sommeil (1 à 5 étoiles), même les nuits sans rêve noté.
- Recherche plein texte et filtres par tags / émotions.
- Statistiques : évolution de la qualité du sommeil et de la note des rêves,
  fréquence des émotions et des tags, corrélation sommeil ↔ rêves.
- Thème Material Design 3, sombre par défaut (option claire).
- Export/backup local (JSON + fichiers audio) pour changer de téléphone sans
  rien perdre.
- Mise à jour intégrée : l'app n'étant pas sur le Play Store, elle peut
  vérifier elle-même (à la demande) si une nouvelle release GitHub existe et
  proposer de télécharger + installer l'APK.

## Stack technique

- **Frontend** : React + TypeScript + Vite.
- **Stockage** : SQLite local via `@capacitor-community/sqlite` (natif sur
  Android, WASM/IndexedDB via `jeep-sqlite` pour le développement web).
- **Audio** : `capacitor-voice-recorder` (gestion native des permissions
  microphone) + `@capacitor/filesystem` pour le stockage des mémos.
- **Empaquetage Android** : Capacitor.

## Développement

```bash
npm install
npm run dev       # serveur de dev web (http://localhost:5173)
npm run build     # build de production dans dist/
npm run lint      # oxlint
```

> `npm run dev` / `npm run build` copient automatiquement le moteur SQLite/WASM
> (`sql.js`) vers `public/assets/sql-wasm.wasm` via `scripts/copy-sqlite-wasm.mjs`.
> Ce fichier n'est pas commité : il doit rester synchronisé avec la version de
> `sql.js` épinglée dans `devDependencies` (voir le commentaire du script si
> vous devez la faire évoluer — `jeep-sqlite` embarque un glue code Emscripten
> qui n'est compatible qu'avec une version précise du binaire `.wasm`).

## Versions & changelog

Le fichier [`changelog.json`](changelog.json) (racine du dépôt) est la seule
source de vérité pour le numéro de version, à la fois pour l'app et pour l'APK
Android — **il n'y a rien d'autre à modifier** (le `versionCode` Android est
géré automatiquement par la CI, voir plus bas).

Pour publier une nouvelle version :

1. Ajoutez une entrée **en tête** de `changelog.json` :

   ```json
   {
     "version": "1.1.0",
     "date": "2026-10-02",
     "notes": ["Ce qui a changé, une puce par changement notable."]
   }
   ```

2. Committez, puis créez et poussez un tag correspondant (avec le préfixe `v`) :

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

Le tag doit correspondre exactement à la version en tête de `changelog.json` —
la CI refuse le build sinon (garde-fou pour ne pas oublier de mettre à jour le
changelog). À chaque build :

- Le **`versionName`** Android est lu depuis `changelog.json[0].version`.
- Le **`versionCode`** Android (l'entier interne qui doit toujours augmenter)
  est le numéro de run GitHub Actions (`github.run_number`) — jamais besoin d'y
  penser manuellement.
- La **release GitHub** créée sur le tag reprend automatiquement les notes de
  cette entrée comme description.
- Dans l'app, un écran **« Nouveautés »** s'affiche automatiquement au premier
  lancement suivant une mise à jour (comparaison avec la dernière version vue,
  mémorisée en base locale), et l'historique complet reste consultable dans
  *Réglages → Historique des versions*.

Un simple push sur `main` sans tag build aussi l'APK (utile pour vérifier que
tout compile) mais ne crée pas de release GitHub.

## Build Android local

```bash
npm run build
npx cap sync android
npx cap open android   # ouvre Android Studio
# ou, en ligne de commande :
cd android && ./gradlew assembleDebug
```

Sans `android/keystore.properties`, `assembleRelease` produit un APK **non
signé** (pratique pour vérifier que le build passe). Pour un APK release signé
en local, créez ce fichier (voir ci-dessous) sans le commiter.

## Signature Android & CI/CD

Le workflow [`.github/workflows/android-release.yml`](.github/workflows/android-release.yml)
build automatiquement l'app à chaque push sur `main` (ou sur un tag `v*`) :
installe les dépendances, build le frontend, `cap sync`, puis compile et signe
l'APK release avec un keystore fourni via les secrets du dépôt. L'APK est
publié comme artefact de build, et comme release GitHub sur un tag `v*`.

### 1. Générer un keystore de release

À faire **une seule fois** ; ce même keystore doit être réutilisé pour toutes
les versions futures (une signature différente empêcherait la mise à jour de
l'app sans désinstallation préalable). Gardez ce fichier et son mot de passe
en lieu sûr, en dehors du dépôt.

```bash
keytool -genkeypair -v \
  -keystore lucide-release.keystore \
  -alias lucide \
  -keyalg RSA -keysize 2048 -validity 10000
```

Répondez aux questions (nom, organisation, etc.) puis choisissez un mot de
passe pour le keystore et pour la clé (vous pouvez utiliser le même).

### 2. Encoder le keystore en base64

```bash
base64 -w0 lucide-release.keystore > lucide-release.keystore.b64   # Linux
# base64 -i lucide-release.keystore | tr -d '\n' > lucide-release.keystore.b64   # macOS
```

### 3. Configurer les secrets du dépôt GitHub

Dans *Settings → Secrets and variables → Actions*, créez :

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Contenu du fichier `.b64` généré ci-dessus |
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | Alias de la clé (`lucide` dans l'exemple ci-dessus) |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé |

Le workflow décode `ANDROID_KEYSTORE_BASE64` dans `android/app/release.keystore`
et génère un `android/keystore.properties` éphémère (supprimé en fin de job)
que `android/app/build.gradle` utilise pour signer l'APK release.

## Mise à jour intégrée à l'app

Lucide n'étant pas distribué via le Play Store, il n'y a pas de mise à jour
automatique par le système. À la place, *Réglages → Mises à jour* permet de :

1. Vérifier manuellement (bouton, jamais automatique/en arrière-plan) s'il
   existe une release GitHub plus récente que la version installée, via l'API
   publique `GET /repos/Karelisio/Lucide/releases/latest`.
2. Télécharger l'APK de cette release et lancer l'installateur système
   Android (écran de confirmation natif, comme pour toute installation
   d'APK hors Play Store).

**Prérequis : le dépôt GitHub doit être public** (ou au moins ses releases
accessibles), car l'app n'embarque aucun token d'authentification — en mettre
un dans le code d'une app cliente le rendrait extractible par n'importe qui.
Si le dépôt est privé, la vérification échoue proprement avec un message
d'erreur, sans casser le reste de l'app.

Côté technique :

- `src/utils/updateChecker.ts` : appel à l'API GitHub, téléchargement de
  l'APK (avec progression), écriture dans le cache de l'app.
- `android/app/src/main/java/io/karelisio/lucide/ApkInstallerPlugin.java` :
  petit plugin Capacitor natif maison qui ouvre l'installateur système sur
  l'APK téléchargé (via `FileProvider` + `Intent.ACTION_VIEW`).
- Permission `REQUEST_INSTALL_PACKAGES` déclarée dans le manifeste (nécessaire
  pour proposer une installation depuis une app qui n'est pas elle-même
  distribuée via le Play Store ; Android affiche son propre écran de
  confirmation avant toute installation).

## Confidentialité

- Lucide ne contacte aucun serveur pour ses données (rêves, tags, audio) —
  la seule requête réseau de toute l'app est la vérification manuelle des
  mises à jour ci-dessus, déclenchée uniquement par un tap explicite.
- La permission Internet déclarée dans le manifeste Android est aussi requise
  par le moteur WebView pour servir le contenu local de l'app (contrainte du
  système, indépendante de la fonctionnalité de mise à jour) — voir le
  commentaire dans `android/app/src/main/AndroidManifest.xml`.
- La permission microphone est demandée à la première utilisation du bouton
  d'enregistrement, avec l'intitulé du système décrivant son usage (mémos
  vocaux de rêves, stockés uniquement en local).
- L'export de sauvegarde (Réglages → Exporter mes données) écrit un dossier
  JSON + audio dans le stockage local de l'app (dossier Documents), à copier
  manuellement lors d'un changement de téléphone.
